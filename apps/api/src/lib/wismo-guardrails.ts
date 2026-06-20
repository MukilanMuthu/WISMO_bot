export const INVALID_ORDER_LIMIT = 2;
export const LISTING_REPEAT_LIMIT = 2;
export const ORDERS_PER_PAGE = 5;
export const MORE_OFFENSE_LIMIT = 2;

// Normalize speech-friendly order numbers into the stored uppercase hash-prefixed form.
export function normalizeOrderNumber(rawOrderNumber: string) {
  const normalized = rawOrderNumber.trim().toUpperCase().replace(/\s+/g, "");
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

type TrackingLineItem = {
  name: string;
  carrierName: string;
  trackingId: string;
  trackingUrl: string;
  trackingMoreCreated: boolean;
};

type TrackingOrder = {
  shippingCarrier: string;
  trackingNumber: string;
  trackingUrl: string;
  trackingMoreCreated: boolean;
  lineItems: TrackingLineItem[];
};

// Select order tracking normally, but group authoritative line-item tracking for split shipments.
// trackingMoreCreated on each target tracks whether TrackingMore has already registered that
// trackingId: Order.trackingMoreCreated is authoritative for a normal shipment, LineItem.trackingMoreCreated
// for a split shipment (mirrors which row owns carrierName/trackingId/trackingUrl in each case).
export function trackingTargetsForOrder(order: TrackingOrder) {
  const grouped = new Map<string, { carrierName: string; trackingId: string; trackingUrl: string; itemNames: string[]; trackingMoreCreated: boolean }>();

  // Group products sharing one parcel so Retell can describe every split shipment once.
  for (const item of order.lineItems) {
    if (!item.trackingId.trim()) continue;
    const existing = grouped.get(item.trackingId);
    if (existing) existing.itemNames.push(item.name);
    else grouped.set(item.trackingId, { carrierName: item.carrierName, trackingId: item.trackingId, trackingUrl: item.trackingUrl, itemNames: [item.name], trackingMoreCreated: item.trackingMoreCreated });
  }

  const isSplitShipment = grouped.size > 1;
  return {
    isSplitShipment,
    targets: isSplitShipment
      ? [...grouped.values()]
      : [
          {
            carrierName: order.shippingCarrier,
            trackingId: order.trackingNumber,
            trackingUrl: order.trackingUrl,
            itemNames: order.lineItems.map((item) => item.name),
            trackingMoreCreated: order.trackingMoreCreated,
          },
        ],
  };
}

// Calculate listing counters without database side effects so billing limits remain directly testable.
export function nextListingState(cursor: number, repeatCount: number, action: "START" | "MORE" | "REPEAT") {
  return {
    cursor: action === "START" ? 0 : action === "MORE" ? cursor + ORDERS_PER_PAGE : cursor,
    repeatCount: action === "REPEAT" ? repeatCount + 1 : repeatCount,
  };
}

// Count down a separate per-call budget for asking "more" after the list is already exhausted
// (distinct from the repeat-the-same-page budget above). Only ticks when the customer actually
// hit the end of the list and asked for more anyway; exhausted once that happens with no budget left.
export function nextMoreOffenseState(moreOffenseCount: number, hitEndOfList: boolean) {
  if (!hitEndOfList) return { moreOffenseCount, exhausted: false };
  if (moreOffenseCount <= 0) return { moreOffenseCount, exhausted: true };
  return { moreOffenseCount: moreOffenseCount - 1, exhausted: false };
}
