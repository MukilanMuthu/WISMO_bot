# WISMO Bot Handoff — 2026-06-22 (session 2)

Repo: `c:\Users\mukil\Documents\projects\picolo_ai_test\WISMO_bot` (branch `main`, no commits made this session — **nothing has been committed, user wants to verify first**).

Prior handoff for general project background (Retell flow architecture, gotchas, 4-intent design): `wismo-bot-handoff-2026-06-22.md` (repo root). This doc only covers what changed in *this* session. Ponytail mode (full) is active for this repo.

## What this session did

Implemented a previously-approved plan (plan file: `C:\Users\mukil\.claude\plans\senior-backend-grill-with-docs-wismo-bo-structured-ladybug.md` — read that for full design rationale, it's the authoritative spec). Summary of outcome, not process:

1. **Fixed the ticket-collapsing bug**: `createEscalationTicket` (`apps/api/src/lib/wismo.ts`) now dedups on `{category, customerId, orderId, status:"OPEN"}` instead of just `{callId, status:"OPEN"}`. Two different issue types on the same call/order now get two distinct tickets; a genuine repeat of the same issue on the same order now correctly returns `DUPLICATE_OPEN` instead of a fresh ticket.
2. **Human-readable ticket numbers**: `SupportTicket.ticketNumber` (autoincrement Int) added. The internal cuid `id` never reaches Retell — `ticketResultPayload()` in `apps/api/src/lib/wismo-guardrails.ts` is the sole boundary that shapes what crosses to the LLM.
3. **Escalation entry point**: customer can ask for a human/supervisor/escalation at any point. If an order is already loaded, files a ticket immediately. If not, the flow asks for an order number, retries once, and if still refused, files a ticket with `orderId: NULL` noting the refusal. New nodes live in `apps/api/conversation-flow.json`: `escalation_ticket`, `escalation_ticket_no_order`, `speak_escalation_ticket`, `ask_escalation_order`, `escalation_capture_order`, `escalation_resolve_order`, `ask_escalation_order_retry`.
4. **Off-topic guardrail**: implemented as a pure `global_prompt` sentence addition (no new nodes) — matches this repo's existing convention that soft conversational limits are prompt-only, not DB counters.
5. **Dashboard drill-in**: new `GET /admin/calls/:callId` route + `apps/web/src/app/admin/calls/[callId]/page.tsx` — shows full reconstructed transcript + tickets for one call. Call rows on `/admin` are now clickable links.
6. **Dashboard metrics** (POC requirement — custom metrics, not platform analytics): containment rate, escalation rate, tickets-by-category, repeat-contact rate, avg call duration. Computed in `apps/api/src/lib/dashboard-metrics.ts` (pure, DB-free, unit-tested) over **all** calls/tickets, not just the 20 shown in listing panels.
7. **conversation-flow.json was pushed live** via `npx tsx apps/api/scripts/push-conversation-flow.ts` — flow id `conversation_flow_542ec73619e8`, now at version 1 with all the above changes. This already happened; no need to push again unless the flow JSON changes further.
8. **Prisma migration already run by the user** — `apps/api/prisma/migrations/20260622170418_add_ticket_category_order_number/` exists and is applied. Do not re-run `prisma migrate dev` for this change; `prisma generate` was also already run so the client matches the schema.

## Verification done

- `npx vitest run` in `apps/api`: 23/23 passing (2 files: `wismo.test.ts`, `dashboard.test.ts`).
- `npx tsc --noEmit` clean in both `apps/api` and `apps/web`.
- Flow JSON validated as well-formed JSON before push; confirmed zero remaining `ticket_id` references (all converted to `ticket_number`); confirmed no dangling node-id references.
- **Not done**: no live call was placed against the updated flow this session. No manual verification of the escalation subgraph, the off-topic guardrail, or the dashboard pages in a running browser/dev server.
- **Known gap**: `reconstructTranscript()` (`apps/api/src/lib/dashboard-metrics.ts`) was written against Retell's documented webhook contract (`call.transcript_object` array, falling back to `call.transcript` string) but was **not verified against a real captured `call_analyzed` payload** — Docker Desktop wasn't running this session so the local Postgres container (`docker-compose.yml`, port 5430) couldn't be inspected. Worth confirming against a real row before relying on the call-detail transcript in production.

## Files changed this session (uncommitted)

Modified: `apps/api/conversation-flow.json`, `apps/api/prisma/schema.prisma`, `apps/api/src/lib/dashboard.ts`, `apps/api/src/lib/wismo-guardrails.ts`, `apps/api/src/lib/wismo.test.ts`, `apps/api/src/lib/wismo.ts`, `apps/api/src/routes/admin.ts`, `apps/api/src/routes/retell.ts`, `apps/web/src/app/admin/page.tsx`, `packages/shared/src/index.ts`.

New: `apps/api/prisma/migrations/20260622170418_add_ticket_category_order_number/`, `apps/api/src/lib/dashboard-metrics.ts`, `apps/api/src/lib/dashboard.test.ts`, `apps/web/src/app/admin/calls/[callId]/page.tsx`.

Also untracked in the repo root (not part of this work, pre-existing/unrelated): `docs/transcript7.txt`, `docs/transcript8.txt`, `docs/transcript9.txt`, `wismo-bot-handoff-2026-06-22.md`.

Run `git diff` / `git status` for exact byte-level detail — not duplicated here.

## Pending / next steps

1. **User explicitly said: do not commit.** They want to verify the work first. Don't commit unless asked.
2. Manual verification still needed (see plan's "Verification" section for the full checklist):
   - Replay a transcript9-style call (two different ticket types, same order) → confirm two distinct ticket numbers.
   - Trigger the same issue type/order twice → confirm `DUPLICATE_OPEN` on the second.
   - Ask for "a human agent" with an order loaded → confirm `escalation_ticket` fires directly.
   - Ask for escalation before an order is known, refuse twice → confirm `escalation_ticket_no_order` fires with `orderId: NULL`; ask again afterward → confirm `DUPLICATE_OPEN`.
   - Ask something unrelated to orders (e.g. weather) → confirm one redirect, then graceful end-call if repeated.
   - Load `/admin` in a browser, click into a call, confirm transcript + tickets render; confirm metric tiles show sane values.
3. If the user wants to commit, follow the repo's existing commit style (see `git log`) — small, scoped commits; this session's change is large enough it may warrant splitting (backend dedup fix / escalation flow / dashboard, roughly matching the plan's 7 sections) rather than one giant commit. Ask the user's preference.
4. Confirm `reconstructTranscript`'s shape assumption against a real `VoiceCallEvent` row once Docker/Postgres is up (`docker compose up -d postgres` from repo root, port 5430).

## Suggested skills

- `/senior-backend` and `/grill-with-docs` — this is how the work in this session was framed; reuse if continuing in the same dense-multi-part-request style.
- Ponytail (`full`, already active) — keep enforcing minimal-diff, no speculative abstraction as further work continues.
- A code-review skill (e.g. `/code-review` or its `ultra` cloud variant) would be a good next step before the user commits, given the size of the diff — flag this as an option to the user rather than invoking it (it's user-triggered/billed).
