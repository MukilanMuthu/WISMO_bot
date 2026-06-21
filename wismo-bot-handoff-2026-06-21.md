# Handoff — WISMO Bot: Retell Conversation Flow build-out

**Date:** 2026-06-21
**Repo:** `c:\Users\mukil\Documents\projects\picolo_ai_test\WISMO_bot`
**Branch:** `main`

## Git state right now

- `git log --oneline -3`: `da6f40e feat(docs): updated RETELL_SETUP.md` (HEAD), `7147e99 feat(api): limit requests after order list exhaustion`, `91e955e feat: build WISMO Retell voice agent monorepo`.
- **Uncommitted**: `docs/RETELL_SETUP.md` only (123 insertions / 19 deletions vs HEAD). This is real content from this session (see below) — not committed yet, ask before committing per repo convention.
- The previous handoff's "Feature 2" (list-recent-orders MORE-exhaustion, `moreOffenseCount`) is now fully committed (`7147e99`) — nothing pending for it.
- All backend API work (TrackingMore memoization, retry/repeat/more-offense guardrails, all 5 Retell custom-function routes) is committed and considered done. This session was pure Retell-dashboard integration work, not backend code changes.

## What this session covered

1. **VPS deployment debugging** (no code changes, just diagnosis):
   - `prisma: command not found` on VPS → use `npx prisma ...`, not bare `prisma` (it's a devDependency, not global). Also use `npx prisma migrate deploy` (non-interactive), not `migrate dev`.
   - Frontend showed "Email or password is incorrect" on VPS even with correct credentials. Root cause: `apps/web/.env.local`'s `NEXT_PUBLIC_API_URL` is inlined into the browser bundle — `localhost:3001` in that file means the *visitor's* browser tries to reach its own machine, not the VPS. Fix: set it to the API's real public domain, restart the Next dev server (env only read at process start). Separately flagged that `apps/web/src/app/page.tsx:29`'s `catch {}` always shows the generic "incorrect" message regardless of the real error (network/CORS/500/etc) — proposed fixing this but **not yet done**, user hasn't asked for it explicitly.
   - Clarified `PUBLIC_APP_URL`/`WEB_ORIGIN` (apps/api `.env`) vs `NEXT_PUBLIC_API_URL` (apps/web `.env.local`) — all three must point at real public domains once split across `api.<domain>` / `<app>.<domain>`, never `localhost`, because the browser (not the VPS) is what executes these fetches.
   - VPS log showed heavy internet bot-scanning noise (wp-json, .env, .git/config, php-cgi RCE probes, etc) — normal background noise for any publicly reachable IP, flagged as a reminder to not leave the tunnel open longer than needed for the demo, not an active compromise.

2. **`docs/RETELL_SETUP.md` rewritten** to close the gap between the doc's abstract node graph and Retell's actual dashboard mechanics (discovered live while the user built the flow in `dashboard.retellai.com`):
   - §2 node table now maps each logical step to a real Retell node **type** from the palette (Conversation / Function / Logic Split / Extract Variable / Ending), not just an abstract name.
   - Clarified that one custom function = one reusable Function node; where the same function needs different fixed args (e.g. `list_recent_orders` called with `action: START/MORE/REPEAT`), the **node must be duplicated on canvas** with a different pinned literal per copy — Retell does not do this automatically. This matches the agent's **Rigid Mode** transition-flexibility setting.
   - **§2a (new): "Store Fields as Variables" table** — the key discovery this session. A Function node's Transition condition box is **free text** (type `{{variable_name}}` literally), not a dropdown — and a response field (like the backend's `code` field) only becomes referenceable as `{{result_code}}` once explicitly mapped on the **custom function's own edit dialog**, under "Store Fields as Variables" (left = variable name you choose, right = JSON path into the response body, e.g. `code`, `id`). This mapping needs to be done once per function in the dashboard; the table in §2a lists exactly which mappings each of the 5 functions needs (`result_code` ← `code` on all 5; `order_id` ← `id` on `get_order_details` and `resolve_order` only).
   - This discovery also let the design simplify: the originally-planned standalone "Extract Variable: order_id" node is gone — `get_order_details`/`resolve_order` overwrite `{{order_id}}` automatically via their own Store-Fields-as-Variables mapping, so their success transition routes straight to `Speak Order Details`.
   - §2b mermaid diagram updated to match — uses real `{{result_code}} = "..."` condition syntax, no orphaned capture node.
   - One flagged-but-unverified assumption carried into next session: whether Retell's `Else` branch only fires on "no condition matched" (as assumed throughout the doc) vs some other semantics — recommended the user verify this on one node before trusting it everywhere.

3. **Live build progress in the Retell dashboard** (state as of this session, not committed anywhere — lives only in the Retell UI):
   - All 5 custom functions created (`resolve_order`, `get_order_details`, `get_tracking_status`, `list_recent_orders`, `create_support_ticket`), each pointing at `https://api.gnomebyte.com/retell/functions/...` with the `x-retell-function-secret` header set (value not recorded here — see user's own `.env`).
   - `resolve_order` tested directly via Hoppscotch (bypassing Retell) with a seeded test call ID — confirmed working. Retell's own isolated "Test Custom Function" panel returns a misleading 404 `NOT_FOUND` for any function needing `call.call_id`, because that panel can't simulate a real call context — this is expected, not a bug; real validation must go through Hoppscotch (seeded `callId`) or a full Test Agent call.
   - `list_recent_orders`'s `action` parameter needed to move from the Form tab's type dropdown (no enum support) to the **JSON tab**, hand-writing a JSON Schema `enum: ["START","MORE","REPEAT"]` — Form-tab types (String/Object/Number/Boolean/Array) don't expose enum.
   - On canvas: `Begin` → `Logic Split` (`{{has_known_order}} = "true"`) → `greeting`/Ask Order Number Conversation node, plus a `Get Order Details` Function node (renamed from `load_known_order`) with `result_code = "ORDER_FOUND"` condition successfully configured. **Not yet wired**: the actual transition lines from these nodes to their destinations, and none of the other 4 functions' nodes/transitions/Store-Fields-as-Variables mappings have been built yet — only `get_order_details` got the full treatment (Store Fields as Variables + Transition condition) live in this session.

## Not yet done (pick up here)

1. Apply the same "Store Fields as Variables" mapping (§2a in the doc) to the remaining 4 functions: `resolve_order`, `get_tracking_status`, `list_recent_orders`, `create_support_ticket`.
2. Build out the rest of the node graph per `docs/RETELL_SETUP.md` §2/§2b: `Ask Order Number` → Extract Variable (`order_number`) → `Resolve Order` Function node with its 3-way transition; the `List Orders`/`List More`/`Repeat Orders` triplicate-with-pinned-`action` pattern; `Speak Order Details`/`Speak Tracking`/`Speak Listed Orders` Conversation nodes; `Track Order`; `Tracking Error Ticket`/`Escalate` triplicate of `create_support_ticket`; final `End Call` Ending node.
3. Verify the `Else` branch semantics assumption flagged above on one already-built node before relying on it everywhere else.
4. Once the flow is fully wired: create and publish the Agent (doc §4), set the webhook URL + header, copy `RETELL_AGENT_ID`/`RETELL_API_KEY` into the VPS `.env`, then run the doc's §6 test checklist end-to-end.
5. `docs/RETELL_SETUP.md` is uncommitted — decide whether/when to commit it (it's documentation-only, no app code changed, but still ask first per repo convention).
6. Optional, not requested yet: fix `apps/web/src/app/page.tsx:29`'s swallowed-error login message (currently always says "Email or password is incorrect" regardless of actual cause).

## Reference docs (read these, don't re-derive)

- `docs/RETELL_SETUP.md` — fully current for the node-build mechanics as of this session; this is the primary artifact, not duplicated here.
- `docs/API_ROUTES.md` — Hoppscotch route reference for all backend endpoints including the 5 Retell functions, still current.
- `apps/api/src/lib/wismo.ts` / `wismo-guardrails.ts` — backend logic and exact response `code` values referenced throughout the Retell doc's transition conditions.
- `apps/api/src/routes/retell.ts` / `apps/api/src/middleware/retell-auth.ts` — the actual endpoints/auth Retell calls into.
- Prior handoff `wismo-bot-handoff-2026-06-20-2.md` (repo root, if still present) — covers the backend feature work that predates this session; superseded for anything Retell-related by this doc.

## Suggested skills for next session

- **`senior-backend`** — was active for parts of this session (env/CORS/deployment reasoning); likely still the right lens if any backend adjustments come up while wiring the remaining functions (e.g. if a function's response shape needs a tweak to support a transition cleanly).
- **`verify`** — once the full flow is wired, use this to actually drive a test call end-to-end (Retell Test Agent or web call) rather than trusting the node graph by inspection alone.
- **`code-review`** (`/code-review`) — worth running once `docs/RETELL_SETUP.md`'s uncommitted changes are about to be committed, just as a sanity pass on the doc's accuracy against the dashboard, given how many corrections happened live this session.

## Redactions

The `RETELL_FUNCTION_SECRET` header value shown in the user's dashboard screenshots during this session has been omitted from this document — it lives in the user's own `.env` / Retell dashboard, not reproduced here. No other secrets, API keys, or PII surfaced in this session beyond what's already documented as non-sensitive demo fixtures in prior handoffs.
