import { db } from "@/lib/db";

type TrackingSummary = {
  status: string;
  latestEvent: string;
  latestEventAt: string | null;
  location: string | null;
  estimatedDelivery: string | null;
  trackingUrl: string;
};

// Convert unknown provider values into safe object records.
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

// Select event collection used by either legacy or current carrier payloads.
function trackingEvents(shipment: Record<string, unknown>) {
  const originInfo = (shipment.origin_info ?? {}) as Record<string, unknown>;
  if (Array.isArray(originInfo.trackinfo)) return originInfo.trackinfo.map(asRecord);
  if (Array.isArray(shipment.track_info)) return shipment.track_info.map(asRecord);
  return [];
}

// Rank how much usable detail a candidate shipment record carries, so duplicate registrations
// of one tracking number (re-created across sessions under a different guessed courier_code)
// don't silently pick whichever happens to be array index 0.
function completenessScore(shipment: Record<string, unknown>) {
  const events = trackingEvents(shipment);
  const latest = asRecord(events[0]);
  let score = 0;
  if (latest.location) score += 2;
  if (shipment.origin_country) score += 1;
  if (events.length > 0) score += 1;
  return score;
}

// Select the most complete shipment regardless of TrackingMore response envelope variant: `data`
// itself can be the shipment array (GET /trackings/get), or an object wrapping `.items`/`.data`
// (other endpoints/versions).
function firstShipment(payload: unknown) {
  const root = asRecord(payload);
  const rawData = root.data ?? root;
  const items = Array.isArray(rawData)
    ? rawData
    : Array.isArray(asRecord(rawData).items)
      ? (asRecord(rawData).items as unknown[])
      : Array.isArray(asRecord(rawData).data)
        ? (asRecord(rawData).data as unknown[])
        : [];

  if (items.length === 0) return asRecord(rawData);
  const candidates = items.map(asRecord);
  return candidates.reduce((best, candidate) => (completenessScore(candidate) > completenessScore(best) ? candidate : best));
}

// Read likely field variants because TrackingMore payloads can differ by carrier and endpoint version.
function extractSummary(payload: unknown, trackingUrl: string): TrackingSummary {
  const shipment = firstShipment(payload);
  const latest = trackingEvents(shipment)[0] ?? {};

  return {
    status: String(shipment.delivery_status ?? shipment.status ?? "unknown"),
    latestEvent: String(latest.tracking_detail ?? latest.description ?? shipment.latest_event ?? "No tracking event supplied"),
    latestEventAt: latest.checkpoint_date ? String(latest.checkpoint_date) : null,
    location: latest.location ? String(latest.location) : null,
    estimatedDelivery: shipment.scheduled_delivery_date ? String(shipment.scheduled_delivery_date) : null,
    trackingUrl,
  };
}

// TrackingMore returns one of these meta.code values when a tracking_number/courier_code pair
// is already registered (4101 confirmed live: "Tracking No. already exists."); treat either as
// success and fall through to GET instead of throwing.
const ALREADY_EXISTS_CODES = [4016, 4101];

type TrackingMoreMeta = { code?: number; message?: string };
type TrackingMoreContext = { orderId: string; trackingUrl: string; apiKey: string; baseUrl: string };

// GET never needs courier_code once a tracking_number is registered; logs and normalizes the
// response the same way regardless of which caller (already-created or just-created) reached it.
async function getResults(trackingId: string, ctx: TrackingMoreContext): Promise<TrackingSummary> {
  const headers = { "Tracking-Api-Key": ctx.apiKey, Accept: "application/json" };
  const query = new URLSearchParams({ tracking_numbers: trackingId });
  const response = await fetch(`${ctx.baseUrl}/trackings/get?${query}`, { headers });

  if (!response.ok) {
    const body = await response.text();
    const message = `TRACKINGMORE_HTTP_${response.status}: ${body.slice(0, 500)}`;
    await db.trackingLookupLog.create({ data: { orderId: ctx.orderId, succeeded: false, responseStatus: response.status, errorMessage: message } });
    throw new Error(message);
  }

  const payload = (await response.json()) as unknown;
  await db.trackingLookupLog.create({ data: { orderId: ctx.orderId, succeeded: true, responseStatus: response.status } });
  return extractSummary(payload, ctx.trackingUrl);
}

// Resolve carrierName -> TrackingMore courier_code via the Courier memoization table; only call
// the live /couriers/detect endpoint the first time a carrierName is seen.
async function resolveCourierCode(carrierName: string, trackingId: string, ctx: Pick<TrackingMoreContext, "apiKey" | "baseUrl">): Promise<string> {
  const existing = await db.courier.findUnique({ where: { carrierName } });
  if (existing) return existing.courierCode;

  const headers = { "Tracking-Api-Key": ctx.apiKey, Accept: "application/json", "Content-Type": "application/json" };
  const response = await fetch(`${ctx.baseUrl}/couriers/detect`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tracking_number: trackingId }),
  });
  const payload = (await response.json()) as { meta?: TrackingMoreMeta; data?: unknown };

  if (!response.ok || payload.meta?.code !== 200) {
    throw new Error(`TRACKINGMORE_DETECT_HTTP_${response.status}: ${JSON.stringify(payload.meta ?? payload).slice(0, 500)}`);
  }

  const candidates = Array.isArray(payload.data) ? payload.data.map(asRecord) : [];
  const courierCode = candidates[0]?.courier_code ? String(candidates[0].courier_code) : null;
  if (!courierCode) throw new Error(`TRACKINGMORE_DETECT_NO_MATCH: ${carrierName} (${trackingId})`);

  const courier = await db.courier.upsert({ where: { carrierName }, update: { courierCode }, create: { carrierName, courierCode } });
  return courier.courierCode;
}

// Fetch live shipment state; missing credentials and provider failures are explicit errors, never mock fallbacks.
// target.alreadyCreated tells us whether TrackingMore has already registered trackingId (per
// Order.trackingMoreCreated / LineItem.trackingMoreCreated) so we can skip courier-code
// resolution and go straight to the cheaper GET.
export async function getTrackingStatus(target: {
  orderId: string;
  trackingId: string;
  trackingUrl: string;
  carrierName: string;
  alreadyCreated: boolean;
}): Promise<TrackingSummary & { trackingMoreCreated: boolean }> {
  const apiKey = process.env.TRACKINGMORE_API_KEY;
  const baseUrl = process.env.TRACKINGMORE_BASE_URL ?? "https://api.trackingmore.com/v4";

  if (!apiKey) {
    await db.trackingLookupLog.create({ data: { orderId: target.orderId, succeeded: false, errorMessage: "TRACKINGMORE_API_KEY_MISSING" } });
    throw new Error("TRACKINGMORE_API_KEY_MISSING");
  }

  const ctx: TrackingMoreContext = { orderId: target.orderId, trackingUrl: target.trackingUrl, apiKey, baseUrl };

  if (target.alreadyCreated) {
    return { ...(await getResults(target.trackingId, ctx)), trackingMoreCreated: true };
  }

  const courierCode = await resolveCourierCode(target.carrierName, target.trackingId, ctx);
  const headers = { "Tracking-Api-Key": apiKey, Accept: "application/json" };

  // POST /trackings/create registers + returns current status in one call; if it's already
  // registered (our DB flag was stale), TrackingMore reports ALREADY_EXISTS_CODE instead of
  // erroring, so fall back to GET for that one case.
  const createResponse = await fetch(`${baseUrl}/trackings/create`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ tracking_number: target.trackingId, courier_code: courierCode }),
  });
  const createPayload = (await createResponse.json()) as { meta?: TrackingMoreMeta; data?: unknown };

  if (createResponse.ok && createPayload.meta?.code === 200) {
    await db.trackingLookupLog.create({ data: { orderId: target.orderId, succeeded: true, responseStatus: createResponse.status } });
    return { ...extractSummary(createPayload, target.trackingUrl), trackingMoreCreated: true };
  }

  if (!ALREADY_EXISTS_CODES.includes(createPayload.meta?.code ?? -1)) {
    const message = `TRACKINGMORE_HTTP_${createResponse.status}: ${JSON.stringify(createPayload.meta ?? createPayload).slice(0, 500)}`;
    await db.trackingLookupLog.create({ data: { orderId: target.orderId, succeeded: false, responseStatus: createResponse.status, errorMessage: message } });
    throw new Error(message);
  }

  return { ...(await getResults(target.trackingId, ctx)), trackingMoreCreated: true };
}
