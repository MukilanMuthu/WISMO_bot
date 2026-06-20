# Handoff — WISMO Bot API testing & Retell function flow

**Date:** 2026-06-20
**Repo:** `c:\Users\mukil\Documents\projects\picolo_ai_test\WISMO_bot`
**Branch:** `split-express-api-nextjs`

## Where this session left off

Working session was about making the Express API (`apps/api`) testable via Hoppscotch
without spending real Retell/TrackingMore money, then fixing a real TrackingMore
integration bug discovered during that testing.

### Done this session

1. **Test call seeding** — added `apps/api/prisma/seed-test-calls.ts` (run via
   `npm run db:seed:test-calls` in `apps/api`). Creates 4 fixed `voiceCall` rows
   (`test-call-dylan-delannoy`, `test-call-nick-greaves`, `test-call-joel-hastings`,
   `test-call-adrian-harris`), one per seeded demo customer, so `/retell/functions/*`
   routes can be hit directly with a known `callId` — no real Retell call needed.
   Requires base `prisma/seed.ts` to have run first (FK on `customerId`).

2. **Order-details flow redesign** — added `getOrderDetails` in
   `apps/api/src/lib/wismo.ts` + new route `POST /retell/functions/get-order-details`.
   Rationale: TrackingMore costs per call, so order identity/line-item info should be
   free, and only live tracking status should cost money. `resolveOrder` and
   `getOrderDetails` now both return the same order shape as
   `GET /customer/orders/:orderId` (full order + `lineItems[]`), plus derived
   `isSplitShipment`/`shipments` grouping — zero TrackingMore cost. Only
   `get-tracking-status` calls TrackingMore.

3. **TrackingMore courier_code bug (in progress, just fixed, not yet re-verified)** —
   `GET /retell/functions/get-tracking-status` was failing with `TRACKINGMORE_HTTP_400`.
   Root cause: TrackingMore's API requires a `courier_code` on every create/get call;
   the code wasn't sending one. User manually confirmed via curl that
   `POST /trackings/create` with `{"tracking_number":"G20216581231","courier_code":"yto-global"}`
   succeeds and returns full tracking data in one call.

   Fix applied in `apps/api/src/lib/trackingmore.ts`:
   - Added `COURIER_CODE_BY_CARRIER` map: `"YTO Global" → "yto-global"` (confirmed live),
     `"Australia Post" → "australia-post"`, `"iMile" → "imile"` (**these two are
     TrackingMore's documented slugs but NOT yet confirmed against a live response —
     next session should verify these**).
   - `getTrackingStatus` now requires a `carrierName` param, calls
     `POST /trackings/create` first (registers + returns data in one shot); if
     TrackingMore responds with `meta.code === 4016` (already registered), falls back
     to `GET /trackings/get?...&courier_code=...`.
   - `apps/api/src/lib/wismo.ts` updated to pass `target.carrierName` through.
   - `tsc --noEmit` and `vitest run` both pass (6/6 tests).

   **Not yet done:** re-test `get-tracking-status` for Nick Greaves (`order-21509`) and
   Adrian Harris (`order-21515`), both carrier `"Australia Post"`, and Joel Hastings
   (`order-21511`), carrier `"iMile"`, to confirm the two unverified courier codes are
   actually correct. If either throws `TRACKINGMORE_UNKNOWN_CARRIER` or a 400, the error
   body is now logged (see `trackingmore.ts` — body/`meta` is included in the thrown
   error message and in `trackingLookupLog.errorMessage`), so the real TrackingMore
   error text will be visible to fix the slug.

### Reference docs (do not duplicate, read these instead)

- **`docs/API_ROUTES.md`** — full route reference for Hoppscotch testing: every
  endpoint, method, required headers (Bearer JWT vs `x-retell-function-secret`), body
  shape, response shape, error envelope. Was updated to reflect changes above (codes 2-3);
  **needs one more update** once the `get-tracking-status` retest above is done, to
  mention the courier_code requirement if the implementation changes again.
- **`docs/RETELL_SETUP.md`** — Retell Conversation Flow node graph, already updated
  this session to reflect the free `resolve_order`/`get_order_details` vs paid
  `get_tracking_status` split.
- `apps/api/prisma/schema.prisma` — DB models (`VoiceCall`, `Order`, `LineItem`, etc.)
- `apps/api/prisma/seed.ts` — base demo fixtures (4 customers + 1 admin, 1 order each).
  Demo login password is the same for all seeded accounts — see that file directly
  rather than repeating it here.

## Key architectural facts a fresh agent needs

- Retell never carries customer identity. `POST /retell/web-call` (requires customer
  JWT) creates the `voiceCall` row with `customerId` baked in *before* the call starts;
  every subsequent `/retell/functions/*` call resolves identity purely from
  `callId → voiceCall.customerId`, never from anything Retell/the caller claims.
- `x-retell-function-secret` header authenticates "this is really our backend's
  function caller," not which customer — that's a separate concern handled via the
  `voiceCall` row lookup above.
- CORS (`apps/api/src/server.ts`) only matters for the browser-facing customer/admin
  routes; it's irrelevant to server-to-server Retell calls (CORS is enforced by
  browsers, not Express).
- TrackingMore is the only paid external dependency in this codebase
  (`apps/api/src/lib/trackingmore.ts`); every other Retell function is DB-only.

## Suggested skills for next session

- **`senior-backend`** — likely needed again if more TrackingMore/API debugging or
  REST design work continues (this session's work was largely driven through this lens).
- **`verify`** — use this once `get-tracking-status` is retested with real courier
  codes, to confirm the fix actually works end-to-end rather than just type-checking.
- **`code-review`** (`/code-review`) — worth running once the courier_code fix is fully
  verified, given it touches an external paid API integration and has a fallback branch
  (`ALREADY_EXISTS_CODE`) that hasn't been exercised by tests yet.
- **`tdd`** — consider adding a unit test (with a mocked `fetch`) covering the
  create-then-fallback-to-get branch in `trackingmore.ts`, since `wismo.test.ts`
  currently only covers `wismo-guardrails.ts` (pure functions), not the TrackingMore
  network logic.

## Redactions

No real secrets appeared in this conversation — `.env.example` placeholders only, and
the TrackingMore API key was masked (`***`) in the user's pasted curl command. The
seed demo password is intentionally a hard-coded fixture for local dev only.
