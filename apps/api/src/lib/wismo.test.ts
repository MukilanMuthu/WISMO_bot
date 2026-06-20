import { describe, expect, it } from "vitest";
import { LISTING_REPEAT_LIMIT, normalizeOrderNumber, nextListingState, nextMoreOffenseState, ORDERS_PER_PAGE, trackingTargetsForOrder } from "./wismo-guardrails";

// Cover speech normalization and voice-cost counters without requiring PostgreSQL.
describe("WISMO guardrails", () => {
  it("normalizes spoken order numbers", () => {
    expect(normalizeOrderNumber(" bb 1042 ")).toBe("#BB1042");
    expect(normalizeOrderNumber("#bb1043")).toBe("#BB1043");
  });

  it("pages by exactly five orders", () => {
    expect(nextListingState(0, 0, "MORE")).toEqual({ cursor: ORDERS_PER_PAGE, repeatCount: 0 });
  });

  it("tracks one global repeat budget", () => {
    const exhausted = nextListingState(ORDERS_PER_PAGE, LISTING_REPEAT_LIMIT, "REPEAT");
    expect(exhausted.repeatCount).toBe(LISTING_REPEAT_LIMIT + 1);
  });

  it("resets listing cursor when a listing starts", () => {
    expect(nextListingState(10, 1, "START")).toEqual({ cursor: 0, repeatCount: 1 });
  });

  it("leaves the more-offense budget untouched when the list isn't exhausted", () => {
    expect(nextMoreOffenseState(2, false)).toEqual({ moreOffenseCount: 2, exhausted: false });
  });

  it("counts down the more-offense budget when asked for more past the end of the list", () => {
    expect(nextMoreOffenseState(2, true)).toEqual({ moreOffenseCount: 1, exhausted: false });
    expect(nextMoreOffenseState(1, true)).toEqual({ moreOffenseCount: 0, exhausted: false });
  });

  it("exhausts once asked for more again with no budget left", () => {
    expect(nextMoreOffenseState(0, true)).toEqual({ moreOffenseCount: 0, exhausted: true });
  });

  it("uses required order tracking for a normal shipment", () => {
    const result = trackingTargetsForOrder({
      shippingCarrier: "Australia Post",
      trackingNumber: "ORDER-TRACKING",
      trackingUrl: "https://example.com/order",
      trackingMoreCreated: true,
      lineItems: [{ name: "Bag", carrierName: "Other", trackingId: "ONE-PARCEL", trackingUrl: "https://example.com/item", trackingMoreCreated: false }],
    });

    expect(result).toMatchObject({ isSplitShipment: false, targets: [{ trackingId: "ORDER-TRACKING", trackingMoreCreated: true }] });
  });

  it("groups line items by tracking ID for a split shipment", () => {
    const result = trackingTargetsForOrder({
      shippingCarrier: "Order Carrier",
      trackingNumber: "ORDER-TRACKING",
      trackingUrl: "https://example.com/order",
      trackingMoreCreated: false,
      lineItems: [
        { name: "Bag", carrierName: "Carrier A", trackingId: "PARCEL-A", trackingUrl: "https://example.com/a", trackingMoreCreated: true },
        { name: "Bottle", carrierName: "Carrier B", trackingId: "PARCEL-B", trackingUrl: "https://example.com/b", trackingMoreCreated: false },
        { name: "Cable", carrierName: "Carrier A", trackingId: "PARCEL-A", trackingUrl: "https://example.com/a", trackingMoreCreated: true },
      ],
    });

    expect(result.isSplitShipment).toBe(true);
    expect(result.targets).toEqual([
      { carrierName: "Carrier A", trackingId: "PARCEL-A", trackingUrl: "https://example.com/a", itemNames: ["Bag", "Cable"], trackingMoreCreated: true },
      { carrierName: "Carrier B", trackingId: "PARCEL-B", trackingUrl: "https://example.com/b", itemNames: ["Bottle"], trackingMoreCreated: false },
    ]);
  });
});
