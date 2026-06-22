import { CallStatus, Prisma, TicketCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { getTrackingStatus } from "@/lib/trackingmore";
import {
  INVALID_ORDER_LIMIT,
  LISTING_REPEAT_LIMIT,
  MORE_OFFENSE_LIMIT,
  ORDERS_PER_PAGE,
  normalizeOrderNumber,
  nextListingState,
  nextMoreOffenseState,
  orderStatusFlags,
  ticketResultPayload,
  trackingTargetsForOrder,
} from "./wismo-guardrails";

// Find internal call state from Retell's stable external call ID.
async function requireVoiceCall(retellCallId: string) {
  const call = await db.voiceCall.findUnique({ where: { retellCallId } });
  if (!call) throw new Error("NOT_FOUND");
  return call;
}

// Mirror the same order shape GET /customer/orders/:orderId returns, so the voice agent and
// the web frontend always describe an order from one identical record (no TrackingMore cost).
// Layer on the split-shipment grouping the agent needs to speak each parcel correctly.
function orderDetailsPayload(order: Prisma.OrderGetPayload<{ include: { lineItems: true } }>) {
  const { isSplitShipment, targets } = trackingTargetsForOrder(order);
  return {
    ...order,
    orderTotal: order.orderTotal.toString(),
    isSplitShipment,
    shipments: targets.map((target) => ({ carrierName: target.carrierName, trackingId: target.trackingId, itemNames: target.itemNames })),
    // Pre-tracking branch flags for the Retell flow (no tracking lookup yet).
    ...orderStatusFlags(order),
  };
}

// Validate a spoken order number strictly inside the current customer's order set.
export async function resolveOrder(retellCallId: string, rawOrderNumber: string) {
  const call = await requireVoiceCall(retellCallId);
  const orderNumber = normalizeOrderNumber(rawOrderNumber);
  const order = await db.order.findFirst({ where: { customerId: call.customerId, orderNumber }, include: { lineItems: true } });

  if (order) {
    await db.voiceCall.update({ where: { id: call.id }, data: { orderId: order.id, invalidOrderAttempts: 0 } });
    return { code: "ORDER_FOUND" as const, ...orderDetailsPayload(order) };
  }

  const nextAttempts = call.invalidOrderAttempts + 1;
  await db.voiceCall.update({ where: { id: call.id }, data: { invalidOrderAttempts: nextAttempts } });

  if (nextAttempts >= INVALID_ORDER_LIMIT) {
    return { code: "RETRY_LIMIT_REACHED" as const, attempts: nextAttempts };
  }

  return { code: "ORDER_NOT_FOUND" as const, attempts: nextAttempts, remainingAttempts: INVALID_ORDER_LIMIT - nextAttempts };
}

// Return static order details with zero TrackingMore cost, for a call that already knows its orderId.
export async function getOrderDetails(retellCallId: string, requestedOrderId?: string) {
  const call = await requireVoiceCall(retellCallId);
  const orderId = requestedOrderId ?? call.orderId;
  if (!orderId) return { code: "ORDER_REQUIRED" as const };

  const order = await db.order.findFirst({ where: { id: orderId, customerId: call.customerId }, include: { lineItems: true } });
  if (!order) return { code: "ORDER_NOT_FOUND" as const };

  if (!call.orderId) await db.voiceCall.update({ where: { id: call.id }, data: { orderId: order.id } });
  return { code: "ORDER_FOUND" as const, ...orderDetailsPayload(order) };
}

// Read one bounded order page and enforce one global repeat budget for the listing phase.
export async function listRecentOrders(retellCallId: string, action: "START" | "MORE" | "REPEAT") {
  const call = await requireVoiceCall(retellCallId);
  const nextState = nextListingState(call.listingCursor, call.listingRepeatCount, action);
  const { cursor, repeatCount } = nextState;

  if (repeatCount > LISTING_REPEAT_LIMIT) {
    return { code: "LISTING_LIMIT_REACHED" as const, repeatCount, moreCount: MORE_OFFENSE_LIMIT - call.moreOffenseCount };
  }

  const orders = await db.order.findMany({
    where: { customerId: call.customerId },
    orderBy: { createdAt: "desc" },
    skip: cursor,
    take: ORDERS_PER_PAGE,
    select: { id: true, orderNumber: true, createdAt: true, orderTotal: true, currency: true },
  });

  const total = await db.order.count({ where: { customerId: call.customerId } });
  const hitEndOfList = action === "MORE" && orders.length === 0;
  const offenseState = nextMoreOffenseState(call.moreOffenseCount, hitEndOfList);
  const moreCount = MORE_OFFENSE_LIMIT - offenseState.moreOffenseCount;

  if (offenseState.exhausted) {
    return { code: "LISTING_LIMIT_REACHED" as const, repeatCount, moreCount };
  }

  await db.voiceCall.update({
    where: { id: call.id },
    data: { listingCursor: cursor, listingRepeatCount: repeatCount, moreOffenseCount: offenseState.moreOffenseCount },
  });

  return {
    code: "ORDERS_LISTED" as const,
    orders: orders.map((order) => ({ ...order, orderTotal: order.orderTotal.toString() })),
    hasMore: cursor + orders.length < total,
    repeatCount,
    moreCount,
  };
}

// Validate ownership again before sending any tracking identifier to the external provider.
export async function trackingForCall(retellCallId: string, requestedOrderId?: string) {
  const call = await requireVoiceCall(retellCallId);
  const orderId = requestedOrderId ?? call.orderId;
  if (!orderId) return { code: "ORDER_REQUIRED" as const };

  const order = await db.order.findFirst({ where: { id: orderId, customerId: call.customerId }, include: { lineItems: true } });
  if (!order) return { code: "ORDER_NOT_FOUND" as const };

  try {
    const selection = trackingTargetsForOrder(order);
    const shipments = await Promise.all(
      selection.targets.map(async (target) => {
        const result = await getTrackingStatus({
          orderId: order.id,
          trackingId: target.trackingId,
          trackingUrl: target.trackingUrl,
          carrierName: target.carrierName,
          alreadyCreated: target.trackingMoreCreated,
        });

        // Persist the just-created flag on whichever row is authoritative for this target, so
        // the next lookup skips courier-code resolution and goes straight to GET.
        if (!target.trackingMoreCreated && result.trackingMoreCreated) {
          if (selection.isSplitShipment) {
            await db.lineItem.updateMany({ where: { orderId: order.id, trackingId: target.trackingId }, data: { trackingMoreCreated: true } });
          } else {
            await db.order.update({ where: { id: order.id }, data: { trackingMoreCreated: true } });
          }
        }

        return { carrierName: target.carrierName, trackingId: target.trackingId, itemNames: target.itemNames, ...result };
      }),
    );

    const flags = orderStatusFlags(
      order,
      shipments.map((s) => ({ status: s.status, latestEventAt: s.latestEventAt })),
    );
    const first = shipments[0];
    return {
      code: "TRACKING_FOUND" as const,
      orderNumber: order.orderNumber,
      isSplitShipment: selection.isSplitShipment,
      notes: order.notes,
      shipments,
      tracking: first,
      // Branch flags + speakable fields, flattened to top level so each maps to one
      // Retell response-variable path. apology here is only the delivered-late case (a speak-only
      // branch with no ticket); every ticket function sets apology itself.
      ...flags,
      tracking_requested: true,
      apology: "delivered_late" in flags && flags.delivered_late === true,
      last_event: first?.latestEvent ?? null,
      last_checkpoint: first?.location ?? null,
      delivery_date: first?.latestEventAt ?? null,
      eta: first?.estimatedDelivery ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRACKING_ERROR";
    return { code: "TRACKING_ERROR" as const, message };
  }
}

// Create one open ticket per (customer, category, order) — order may be null (e.g. an
// escalation raised before any order is loaded). Dedup is scoped to the order (or to "no
// order" for that customer), not just the current call, so a callback about the same
// unresolved issue hits the same ticket instead of spawning a duplicate.
export async function createEscalationTicket(retellCallId: string, reason: string, category: TicketCategory, requestedOrderId?: string) {
  const call = await requireVoiceCall(retellCallId);
  const orderId = requestedOrderId ?? call.orderId ?? null;

  const existing = await db.supportTicket.findFirst({ where: { category, customerId: call.customerId, orderId, status: "OPEN" } });
  if (existing) return ticketResultPayload(existing);

  const ticket = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.supportTicket.create({ data: { customerId: call.customerId, callId: call.id, orderId, category, reason } });
    await tx.voiceCall.update({ where: { id: call.id }, data: { status: CallStatus.ESCALATED } });
    return created;
  });

  return ticketResultPayload(null, ticket);
}

// Verify the caller against the loaded order by email only (no phone). Stateless: the Retell flow
// owns the retry budget. Comparison is trimmed + case-insensitive to survive spoken-email quirks.
export async function verifyIdentity(retellCallId: string, email: string) {
  const call = await requireVoiceCall(retellCallId);
  if (!call.orderId) return { code: "ORDER_REQUIRED" as const };

  const order = await db.order.findFirst({ where: { id: call.orderId, customerId: call.customerId } });
  if (!order) return { code: "ORDER_NOT_FOUND" as const };

  const match = order.email.trim().toLowerCase() === email.trim().toLowerCase();
  return { code: match ? ("VERIFIED" as const) : ("NOT_VERIFIED" as const) };
}
