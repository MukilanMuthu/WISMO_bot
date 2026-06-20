import { Router } from "express";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, type AuthedRequest } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/error";
import { getRetellArgs, getRetellCallId, requireRetellFunctionAuth } from "@/middleware/retell-auth";
import { createEscalationTicket, getOrderDetails, listRecentOrders, resolveOrder, trackingForCall } from "@/lib/wismo";

const router = Router();

// ---- Browser web-call (authenticated customer) ----

const webCallSchema = z.object({ orderId: z.string().optional() });

// Create internal call state first, then request a browser-call access token from Retell.
router.post(
  "/web-call",
  requireUser("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const customer = (req as AuthedRequest).user;
    const input = webCallSchema.parse(req.body);
    const apiKey = process.env.RETELL_API_KEY;
    const agentId = process.env.RETELL_AGENT_ID;
    if (!apiKey || !agentId) throw new Error("RETELL_CONFIGURATION_MISSING");

    if (input.orderId) {
      const ownedOrder = await db.order.findFirst({ where: { id: input.orderId, customerId: customer.id } });
      if (!ownedOrder) throw new Error("FORBIDDEN");
    }

    const call = await db.voiceCall.create({ data: { customerId: customer.id, orderId: input.orderId } });
    const response = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        metadata: { internalCallId: call.id, customerId: customer.id, orderId: input.orderId ?? null },
        retell_llm_dynamic_variables: {
          customer_id: customer.id,
          customer_name: customer.name,
          order_id: input.orderId ?? "",
          has_known_order: input.orderId ? "true" : "false",
        },
      }),
    });

    if (!response.ok) {
      await db.voiceCall.update({ where: { id: call.id }, data: { status: "FAILED", endedAt: new Date() } });
      throw new Error(`RETELL_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as { access_token: string; call_id: string };
    await db.voiceCall.update({ where: { id: call.id }, data: { retellCallId: payload.call_id, status: "ACTIVE" } });
    res.json({ data: { accessToken: payload.access_token, callId: payload.call_id } });
  }),
);

// ---- Retell agent webhook (server-to-server) ----

// Store Retell lifecycle events and update terminal call state for dashboard visibility.
router.post(
  "/webhook",
  requireRetellFunctionAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const call = body.call as Record<string, unknown> | undefined;
    const retellCallId = String(call?.call_id ?? body.call_id ?? "");
    const eventType = String(body.event ?? "unknown");
    const voiceCall = await db.voiceCall.findUnique({ where: { retellCallId } });
    if (!voiceCall) throw new Error("NOT_FOUND");

    await db.voiceCallEvent.create({ data: { callId: voiceCall.id, type: eventType, payload: body as object } });

    if (["call_ended", "call_analyzed"].includes(eventType) && voiceCall.status !== "ESCALATED") {
      await db.voiceCall.update({ where: { id: voiceCall.id }, data: { status: "COMPLETED", endedAt: new Date() } });
    }

    res.json({ received: true });
  }),
);

// ---- Retell custom functions (server-to-server, called during a call) ----

const resolveSchema = z.object({ orderNumber: z.string().min(1).max(50) }).passthrough();
const listSchema = z.object({ action: z.enum(["START", "MORE", "REPEAT"]) }).passthrough();
const trackingSchema = z.object({ orderId: z.string().optional() }).passthrough();
const ticketSchema = z.object({ reason: z.string().min(3).max(500) }).passthrough();

// Resolve spoken order number while backend owns retry counting and customer scoping.
router.post(
  "/functions/resolve-order",
  requireRetellFunctionAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input = resolveSchema.parse(getRetellArgs(body));
    res.json(await resolveOrder(getRetellCallId(body), input.orderNumber));
  }),
);

// Return static order details at zero TrackingMore cost, for calls that already know their orderId.
router.post(
  "/functions/get-order-details",
  requireRetellFunctionAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input = trackingSchema.parse(getRetellArgs(body));
    res.json(await getOrderDetails(getRetellCallId(body), input.orderId));
  }),
);

// Return one bounded order page while backend enforces global listing-repeat budget.
router.post(
  "/functions/list-recent-orders",
  requireRetellFunctionAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input = listSchema.parse(getRetellArgs(body));
    res.json(await listRecentOrders(getRetellCallId(body), input.action));
  }),
);

// Fetch live tracking only after backend verifies order ownership against call customer.
router.post(
  "/functions/get-tracking-status",
  requireRetellFunctionAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input = trackingSchema.parse(getRetellArgs(body));
    res.json(await trackingForCall(getRetellCallId(body), input.orderId));
  }),
);

// Create an idempotent support ticket when Retell reaches an escalation node.
router.post(
  "/functions/create-support-ticket",
  requireRetellFunctionAuth,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input = ticketSchema.parse(getRetellArgs(body));
    res.json(await createEscalationTicket(getRetellCallId(body), input.reason));
  }),
);

export default router;
