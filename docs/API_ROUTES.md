# WISMO API — Routes Reference (for Hoppscotch testing)

Base URL: `http://localhost:3001` (or your `PUBLIC_APP_URL` tunnel for Retell)

---

## Health

### `GET /health`
- Auth: none
- Params: none
- Body: none
- Response: `{"ok":true}`

---

## Auth (public)

### `POST /login`
- Auth: none
- Headers: `Content-Type: application/json`
- Body:
  ```json
  { "email": "dylan.delannoy@example.com", "password": "WismoDemo!2026" }
  ```
- Response: `{"data":{"token":"<jwt>","role":"CUSTOMER"}}`
- Demo accounts (seed.ts): all use password `WismoDemo!2026`
  - `dylan.delannoy@example.com` — CUSTOMER
  - `nick.greaves@example.com` — CUSTOMER
  - `joel.hastings@example.com` — CUSTOMER
  - `adrian.harris@example.com` — CUSTOMER
  - `admin@example.com` — ADMIN

### `POST /logout`
- Auth: none
- Body: none
- Response: `204 No Content`

---

## Customer (Bearer JWT, role `CUSTOMER`)

Header on all routes below:
```
Authorization: Bearer <token from /login>
```

### `GET /customer/orders`
- Params/body: none
- Returns all orders owned by the authenticated customer (with `lineItems`)

### `GET /customer/orders/:orderId`
- Path param: `orderId` (e.g. `order-21505`)
- Returns one order (with `lineItems`) if owned by the authenticated customer, else `404 NOT_FOUND`

---

## Admin (Bearer JWT, role `ADMIN`)

Header:
```
Authorization: Bearer <token from /login as admin@example.com>
```

### `GET /admin/dashboard`
- Params/body: none
- Returns aggregated dashboard data

---

## Retell — Web call bootstrap (Bearer JWT, role `CUSTOMER`)

### `POST /retell/web-call`
- Header: `Authorization: Bearer <customer token>`
- Body:
  ```json
  { "orderId": "order-21505" }
  ```
  `orderId` optional; if present must belong to the authenticated customer (else `403 FORBIDDEN`)
- Requires env `RETELL_API_KEY` + `RETELL_AGENT_ID` set, else `500 RETELL_CONFIGURATION_MISSING`
- Creates a `voiceCall` row server-side (customer identity bound here, not from Retell)
- Response: `{"data":{"accessToken":"...","callId":"..."}}`

---

## Retell — server-to-server (custom function secret, no JWT)

Header on all routes below:
```
x-retell-function-secret: <RETELL_FUNCTION_SECRET from .env>
```

Identity comes from `callId` → looked up against the `voiceCall` row created in `/retell/web-call`
(or a manually seeded test row — see `npm run db:seed:test-calls` in `apps/api`).
The body may either pass `callId` directly (for manual testing) or Retell's full envelope with
`call.call_id`.

### Test call IDs (seeded via `apps/api/prisma/seed-test-calls.ts`)

| Customer | callId |
|---|---|
| Dylan Delannoy | `test-call-dylan-delannoy` |
| Nick Greaves | `test-call-nick-greaves` |
| Joel Hastings | `test-call-joel-hastings` |
| Adrian Harris | `test-call-adrian-harris` |

### `POST /retell/webhook`
- Body: Retell lifecycle event envelope, e.g.
  ```json
  { "event": "call_ended", "call": { "call_id": "test-call-dylan-delannoy" } }
  ```
- Logs the event; on `call_ended`/`call_analyzed` marks the call `COMPLETED` (unless already `ESCALATED`)

### `POST /retell/functions/resolve-order`
- Body:
  ```json
  { "callId": "test-call-dylan-delannoy", "orderNumber": "#21505" }
  ```
  (`orderNumber` accepts spoken/loose forms, normalized server-side, e.g. `"bb 1042"` → `"#BB1042"`)
- **No TrackingMore cost.**
- On match: sets `voiceCall.orderId`, resets retry counter, returns
  `code: "ORDER_FOUND"` + the **same order shape as `GET /customer/orders/:orderId`**
  (`orderNumber`, `numItems`, `orderTotal`, `currency`, `shippingCarrier`, `trackingNumber`,
  `trackingUrl`, `shippedAt`, `estimatedDelivery`, `notes`, `lineItems[]`, etc.) plus derived
  `isSplitShipment` and grouped `shipments` (carrier, tracking ID, item names per parcel).
- On no match: `code: "ORDER_NOT_FOUND"` with `attempts`/`remainingAttempts`, or
  `code: "RETRY_LIMIT_REACHED"` after 2 failed attempts.

### `POST /retell/functions/get-order-details`
- Body:
  ```json
  { "callId": "test-call-dylan-delannoy", "orderId": "order-21505" }
  ```
  `orderId` optional — falls back to `voiceCall.orderId` if already resolved on the call
- **No TrackingMore cost.** Same response shape as `resolve-order`'s `ORDER_FOUND`.
- Use this when the agent already knows the orderId (e.g. launched from the order page via
  `/retell/web-call` with `orderId` set) — skips asking the customer for an order number.
- `code: "ORDER_REQUIRED"` if no orderId known; `code: "ORDER_NOT_FOUND"` if it doesn't belong
  to the call's customer.

### `POST /retell/functions/get-tracking-status`
- Body:
  ```json
  { "callId": "test-call-dylan-delannoy", "orderId": "order-21505" }
  ```
  `orderId` optional — falls back to `voiceCall.orderId`
- **Costs one TrackingMore API call per shipment** — only call this when the customer explicitly
  asks where their order/parcel is. First-ever lookup for a shipment costs more calls: resolve
  `courier_code` (cached per carrier in the `Courier` table; calls `/couriers/detect` only the
  first time a `carrierName` is seen) then `POST /trackings/create`. Every later lookup for that
  same shipment (`Order.trackingMoreCreated` / `LineItem.trackingMoreCreated` already `true`)
  skips courier-code resolution entirely and calls `GET /trackings/get` directly.
- Response: `code: "TRACKING_FOUND"` with `orderNumber`, `isSplitShipment`, `notes`, `shipments[]`
  (each with live `status`, `latestEvent`, `latestEventAt`, `location`, `estimatedDelivery`,
  `trackingUrl`), and `tracking` (first shipment, kept for backward compatibility).
- `code: "ORDER_REQUIRED"` / `"ORDER_NOT_FOUND"` / `"TRACKING_ERROR"` on failure paths.

### `POST /retell/functions/list-recent-orders`
- Body:
  ```json
  { "callId": "test-call-dylan-delannoy", "action": "START" }
  ```
  `action` enum: `START` | `MORE` | `REPEAT`
- Paginates 5 orders at a time; `REPEAT` is capped at 2 globally per call
  (`code: "LISTING_LIMIT_REACHED"` after that)
- Response: `code: "ORDERS_LISTED"` with `orders[]` (id, orderNumber, createdAt, orderTotal,
  currency), `hasMore`, `repeatCount`

### `POST /retell/functions/create-support-ticket`
- Body:
  ```json
  { "callId": "test-call-dylan-delannoy", "reason": "Tracking provider unavailable" }
  ```
  `reason`: 3–500 chars
- Idempotent per call (returns existing open ticket if one already exists for this call)
- Marks the call `ESCALATED`
- Response: `code: "TICKET_CREATED"`, `ticketId`, `existing`

---

## Error envelope (all routes)

```json
{ "error": { "code": "UNAUTHORIZED", "message": "UNAUTHORIZED" } }
```

| `code` | HTTP status |
|---|---|
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `VALIDATION_ERROR` (Zod) | 400, includes `details` field breakdown |
| anything else | 500 |
