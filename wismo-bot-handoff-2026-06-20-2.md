# Handoff — WISMO Bot: TrackingMore memoization + list-recent-orders "more" exhaustion

**Date:** 2026-06-20
**Repo:** `c:\Users\mukil\Documents\projects\picolo_ai_test\WISMO_bot`
**Branch:** `main`

## Git state right now

- `git log --oneline -2`: `91e955e feat: build WISMO Retell voice agent monorepo` (HEAD), `c186dbe Initial commit`.
- **Uncommitted** (`git status --porcelain`):
  - Modified: `apps/api/prisma/migrations/migration_lock.toml` (line-ending noise only, LF/CRLF),
    `apps/api/prisma/schema.prisma`, `apps/api/src/lib/wismo-guardrails.ts`,
    `apps/api/src/lib/wismo.test.ts`, `apps/api/src/lib/wismo.ts`, `docs/API_ROUTES.md`,
    `docs/RETELL_SETUP.md`
  - Untracked: `apps/api/prisma/migrations/20260620141757_add_more_offense_count/`
- These uncommitted changes are **all the second feature below** (more-offense exhaustion). They
  are not yet committed — ask the user before committing, per repo convention (only commit when
  explicitly asked).
- The first feature below (TrackingMore courier-code memoization) is already inside commit
  `91e955e` — fully committed, nothing pending for it.

## Feature 1 (committed): TrackingMore create/get split + courier-code memoization

Already shipped in `91e955e`. Read the code directly rather than this summary:

- `apps/api/prisma/schema.prisma` — `Order.trackingMoreCreated`, `LineItem.trackingMoreCreated`
  (both `Boolean @default(false)`), new `Courier` model (`carrierName` unique → `courierCode`).
- `apps/api/src/lib/trackingmore.ts` — `getTrackingStatus(target)` now takes `alreadyCreated`:
  `true` → straight `GET /trackings/get` (no courier_code needed). `false` → resolve courier code
  via `resolveCourierCode()` (checks `Courier` table first, else calls live
  `POST /couriers/detect` and upserts the result) → `POST /trackings/create` → falls back to GET
  on TrackingMore's `4016` already-exists code. Returns `trackingMoreCreated: boolean`.
- `apps/api/src/lib/wismo.ts` `trackingForCall` — passes each shipment target's current
  created-flag in, and on a fresh create persists it: `db.order.update` for a normal shipment,
  `db.lineItem.updateMany` (by `orderId` + `trackingId`) for a split shipment. This split-vs-normal
  distinction mirrors the existing ADR pattern (`docs/adr/0001-keep-wismo-poc-minimal-and-single-store.md`)
  where Order-level tracking fields are authoritative for a normal shipment and LineItem-level
  fields are authoritative for a split shipment.
- `apps/api/src/lib/wismo-guardrails.ts` `trackingTargetsForOrder` — each returned target now also
  carries `trackingMoreCreated` (pulled from Order or grouped LineItems as appropriate).
- Docs already updated: `docs/API_ROUTES.md` (`get-tracking-status` section) and no flow-graph
  change needed in `docs/RETELL_SETUP.md` for this feature (no new Retell-facing codes).

**Verified live** (user tested via Hoppscotch): order `#21509` (Nick Greaves, Australia Post,
`34YEK857516701000910909`) successfully resolved `courier_code: "australia-post"` via a real
`/couriers/detect` call, stored it in the `Courier` table, then registered the tracking via
`/trackings/create`, returning `trackingMoreCreated: true`. The tracking status came back as
`"pending"` / "No tracking event supplied" — this is expected TrackingMore behavior right after a
brand-new registration (it polls the carrier asynchronously; real checkpoint data appears after a
delay, not instantly). User was about to check the TrackingMore dashboard directly to confirm
real data populates — **outcome of that check is not yet known to this session.**

**Known unverified gap carried over from the prior session's handoff:** the `iMile` courier code
(`"imile"`) used for Joel Hastings' order (`#21511`, `6060626349451`) was never confirmed against
a live response — only `yto-global` and now `australia-post` have been confirmed live. If a fresh
`/couriers/detect` call resolves a different code than `"imile"` for that carrier, the live detect
call will simply store whatever TrackingMore returns (memoization self-corrects), so this is a
non-blocking informational note, not an actual bug risk anymore — the courier-code-by-hand map
that carried this risk was deleted in this session's work.

## Feature 2 (uncommitted): `list_recent_orders` "more past the end" exhaustion

User asked: add a counter (starting at 2) that decrements each time the customer asks for `MORE`
after the order list is already exhausted; once it hits 0 and they ask again, end the call
gracefully — same pattern as the existing `repeatCount`/`LISTING_LIMIT_REACHED` exhaustion for the
`REPEAT` action.

Implementation (mirrors the existing `repeatCount` pattern exactly, including counting semantics):

- `apps/api/prisma/schema.prisma` — `VoiceCall.moreOffenseCount Int @default(2)`. Migration
  `20260620141757_add_more_offense_count` created and applied to the local dev DB already; **this
  migration directory is currently untracked in git** (see git state above).
- `apps/api/src/lib/wismo-guardrails.ts` — new exports:
  - `MORE_OFFENSE_LIMIT = 2`
  - `nextMoreOffenseState(moreOffenseCount, hitEndOfList)`: pure function, no-op if the list
    wasn't exhausted; counts down on each over-the-end request; returns `{ exhausted: true }` once
    asked again with the budget already at 0.
- `apps/api/src/lib/wismo.ts` `listRecentOrders` — detects `hitEndOfList = action === "MORE" &&
  orders.length === 0`, runs it through `nextMoreOffenseState`, persists the new count via
  `db.voiceCall.update`, and returns `LISTING_LIMIT_REACHED` once exhausted (same code Retell's
  existing flow already routes to the `escalate` node — **no Retell flow graph rewiring needed**,
  just the doc note added below).
  - **New response field `moreCount`** (added in this same uncommitted change, after the initial
    implementation): counts *up* from 0 to `MORE_OFFENSE_LIMIT`, mirroring `repeatCount`'s
    semantics exactly (count of uses so far, not remaining budget). Returned on both
    `ORDERS_LISTED` and `LISTING_LIMIT_REACHED` responses. Computed as
    `MORE_OFFENSE_LIMIT - offenseState.moreOffenseCount` (or `MORE_OFFENSE_LIMIT -
    call.moreOffenseCount` on the early `repeatCount` exhaustion branch, before any decrement).
- `apps/api/src/lib/wismo.test.ts` — 3 new unit tests for `nextMoreOffenseState` (no-op when not
  exhausted, counts down twice, exhausts on the third over-the-end ask). All 9 tests pass.
- `tsc --noEmit` clean, all in `apps/api`.
- Docs updated: `docs/API_ROUTES.md` (`list-recent-orders` section, documents the `moreCount`
  field and exhaustion behavior) and `docs/RETELL_SETUP.md` (`list_more` node row now notes the
  `LISTING_LIMIT_REACHED -> escalate` branch).

**Not yet done:**
- Existing `voiceCall` rows (including the seeded test-call rows used for Hoppscotch testing) were
  backfilled to `moreOffenseCount: 2` by the migration default — no reseed needed — but this has
  **not been live-tested via Hoppscotch yet** (unlike Feature 1's tracking-status flow). Next
  session should hit `POST /retell/functions/list-recent-orders` with `action: "MORE"` repeatedly
  past the end of a customer's order list (e.g. `test-call-dylan-delannoy` only has 1 order, so a
  `START` then two `MORE` calls past the end, then a third, should produce empty-list responses
  with `moreCount: 1`, `moreCount: 2`, then `code: "LISTING_LIMIT_REACHED"` with `moreCount: 2`).
- These changes are uncommitted — decide whether to commit (and whether to commit the two features
  together or separately, since Feature 1 is already committed and Feature 2 is a clean standalone
  diff).

## Recurring environment gotcha this session (Windows + Prisma)

`npx prisma generate` repeatedly failed with `EPERM: operation not permitted, rename ...
query_engine-windows.dll.node.tmpXXXXX -> query_engine-windows.dll.node` whenever the user's
`apps/api` dev server (or any other node process holding the file lock) was running. Fix each time
was simply: ask the user to stop their dev server, then retry `npx prisma generate` from
`apps/api`. This will likely recur if more schema changes are needed next session — don't try to
kill node processes automatically; ask the user to stop their dev server first (user preference,
established this session via an explicit choice between "ask user to stop" vs "kill all node.exe
processes" — they chose the safer manual-stop option both times it came up).

Also: the PowerShell tool's working directory does **not** reliably persist `cd`/`Set-Location`
across separate tool calls in this environment — every command in this session that needed to run
from `apps/api` had to re-issue `Set-Location "...\apps\api"` in the same call (chained with `;`),
otherwise commands silently ran from the repo root and failed (e.g. `tsc --noEmit` printing its
help text because no `tsconfig.json` was found there).

## Reference docs (do not duplicate, read these instead)

- `docs/API_ROUTES.md` — full Hoppscotch route reference, already current for both features above.
- `docs/RETELL_SETUP.md` — Retell Conversation Flow node graph, already current for both features.
- `docs/adr/0001-keep-wismo-poc-minimal-and-single-store.md` — POC scope/architecture constraints;
  explains the Order-vs-LineItem authoritative-tracking-field split that Feature 1 builds on.
- `apps/api/prisma/schema.prisma` — current DB models, read directly for exact field types/defaults.
- `apps/api/src/lib/wismo-guardrails.ts` — all pure, DB-free guardrail logic; read directly, it's
  short and fully covered by `wismo.test.ts`.

## Suggested skills for next session

- **`verify`** — use this first if continuing Feature 2, to actually drive the
  `list-recent-orders` `MORE`-exhaustion flow via Hoppscotch/curl end-to-end (per "Not yet done"
  above) rather than relying on the unit tests alone.
- **`senior-backend`** — was active this session; likely still the right lens for any further
  TrackingMore/Retell function work, given the API-design and external-integration nature of both
  features.
- **`code-review`** (`/code-review`) — worth running on the uncommitted Feature 2 diff before
  committing, and/or on Feature 1 retroactively since it already touches an external paid API
  integration and was committed without a review pass in this session.
- **`tdd`** — if Feature 2 needs the live-Hoppscotch verification above, consider writing it as a
  small integration test first instead of pure manual testing, since `wismo.test.ts` currently only
  unit-tests the guardrail functions, not `listRecentOrders` itself against a real DB.

## Redactions

No real secrets appeared in this conversation. TrackingMore API key was already configured in the
user's local `.env` (not shown in this session). No PII beyond the existing seeded demo fixtures
(already non-sensitive, documented in the prior handoff and `docs/adr/0001-...md`).
