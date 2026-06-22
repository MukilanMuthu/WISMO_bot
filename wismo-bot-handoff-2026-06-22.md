# Handoff — WISMO Bot: 4-intent Retell flow, live-call hardening

**Date:** 2026-06-22
**Repo:** `c:\Users\mukil\Documents\projects\picolo_ai_test\WISMO_bot`
**Branch:** `main`
**Next session focus:** continue testing the live flow from the VPS (Retell function callbacks need the public tunnel that only exists there) and fix whatever real calls surface.

## State right now

- All work is **committed to `main`**, not pushed to remote. Pull on the VPS to test. Commit chain (newest first):
  - `e81bf75` fix(retell): make terminal nodes ask-and-route in one turn
  - `d6db050` fix(retell): audit remaining speak-node pitfalls
  - `3b5daaa` fix(retell): catch delivery disputes after tracking
  - `e4cc652` feat(retell): expand WISMO flow to four customer intents
  Read the diffs rather than re-deriving.
- Flow is **pushed live**: `conversation_flow_542ec73619e8` via `apps/api/scripts/push-conversation-flow.ts` (PATCHes the id cached in `apps/api/.retell-flow-id`; re-running updates the same flow). Last push succeeded (HTTP 200).
- Backend: `npx vitest run` (apps/api) = 14 pass; `npx tsc --noEmit` = clean.

## What was built (see commits/diffs, not duplicated here)

Expanded `apps/api/conversation-flow.json` from the single thin tracking intent to the 4 entry points in `docs/RETELL_CONVERSATION_FLOW_DIAGRAMS.md` (authoritative spec, from `docs/Drawing 2026-06-22 12.33.25.excalidraw.png`): tracking, change-address (email verify → priced ticket), not-delivered (reuses tracking flags, no second lookup), tracking-wrong. All branch booleans are computed server-side (`orderStatusFlags()` in `apps/api/src/lib/wismo-guardrails.ts`) and returned via each tool's `response_variables`; new `verifyIdentity()` (email-only) + `/retell/functions/verify-identity`. Design rationale + per-entry mermaid in the approved plan:
`C:\Users\mukil\.claude\plans\grill-with-docs-wismo-bot-handoff-2026-structured-pixel.md`.

## Hard-won Retell behaviours (the crux — don't relearn by breaking)

1. **`tool_type` must be `"local"`, never `"shared"`.** Shared tool ids are rejected by the create/update-conversation-flow API; flow-level `tools[]` are referenced with `local`. (The original JSON had `shared` and had never actually pushed.)
2. **A conversation node with `always_edge` waits for a USER turn before transitioning, and re-prompts the same message on silence.** Consequences fixed across two iterations:
   - You cannot chain "speak a result" → "ask anything else" across two conversation nodes — the first stalls on silence (caused the repeat-forever-after-ticket bug). **Every terminal node now states its result AND asks "anything else?" in the SAME turn, with its own routing edges** (delivery dispute → `nd_delivered_check`, another request → `order_loaded`, else → `end_call`).
   - The 3 genuine *question* nodes (`nd_delivered_speak`, `nd_not_delivered_speak`, `tw_confirm`) still route to the shared `anything_else` because the user has just spoken there.
3. **Booleans reach Retell as `"true"`/`"false"` strings** — branch equations compare `{{flag}} == "true"`.
4. **Node positions are effectively immutable after create** — keep `.retell-flow-id` so the script PATCHes, never recreates. Layout is swim-lane per entry (see plan).
5. **`conversation-flow.json` is now standard 2-space JSON** (one-time reformat in `e81bf75`); keep that style so future diffs stay small.

## Known limitations / watch-list for next session

- **Everything rides on `gpt-5.4-nano` picking the right edge** from the caller's reply. Structure is sound now; remaining misroutes = model capability. First lever: bump the flow `model_choice.model` in `conversation-flow.json`.
- **Voice email accuracy** for `verify_identity`: the LLM transcribes the spoken email into the tool arg (no `extract_dynamic_variables` step like order number has). If verification fails on correct emails, add an extract node for email.
- **Soft 2-request cap** lives in `order_loaded`'s prompt (not a DB counter) — `nano` may miscount. Harden with a `VoiceCall` column (mirror `invalidOrderAttempts`) if it matters.
- **`FinancialStatus` has no UNPAID** (`PAID|REFUNDED|PARTIALLY_REFUNDED`) — the diagram's "unpaid" branch is unreachable; not-paid is treated as refunded.
- **Ticket priority is in the reason string** (no priority column); `createEscalationTicket` dedupes to one OPEN ticket per call.
- **Pre-existing, untested by real calls:** address-change, tracking-wrong, listing/more-exhaustion, and the not-shipped/overdue tracking branches. Only the delivered + delivered-not-received path has been driven end-to-end (transcripts 7 & 8).

## Test loop (how the user works)

User pulls `main` on the VPS, restarts the API (env has `RETELL_API_KEY`, `PUBLIC_APP_URL=https://api.gnomebyte.com`, `RETELL_FUNCTION_SECRET`), makes a Retell web/Test-Agent call, and shares `docs/transcriptN.txt` + `docs/logN.log`. Diagnose from those (node transitions are logged), edit `conversation-flow.json`, re-run the push script, re-test. Latest evidence: `docs/transcript8.txt` / `docs/log8.log` (the stall bug, now fixed).

## Reference docs (read, don't re-derive)

- `C:\Users\mukil\.claude\plans\grill-with-docs-wismo-bot-handoff-2026-structured-pixel.md` — approved plan: variables, mermaid per entry, layout.
- `docs/RETELL_CONVERSATION_FLOW_DIAGRAMS.md` — authoritative behaviour spec.
- `docs/RETELL_SETUP.md` §2a — response_variables note (current).
- `apps/api/conversation-flow.json` — the flow (63 nodes, 16 tools).
- `apps/api/src/lib/wismo.ts` / `wismo-guardrails.ts` — backend codes + flags.
- `apps/api/src/routes/retell.ts` — routes + per-call variable reset.

## Suggested skills for next session

- **`verify`** — drive the next live Test-Agent call and confirm the fixed paths (and the untested entries) actually behave.
- **`diagnosing-bugs`** — when a new transcript/log shows a misroute, work the node-transition log back to the offending node/edge.
- **`senior-backend`** — if a fix needs a backend response-shape change (e.g. add an email extract step, a 2-request DB counter, or an UNPAID financial state).
- **`ponytail`** (full) — keep the flow lean; prefer one flag-reading node over many leaf nodes.

## Redactions

No secrets here. `RETELL_API_KEY` / `RETELL_FUNCTION_SECRET` live only in the VPS/local `.env`; the flow references them as `{{env:...}}` placeholders substituted at push time. Customer fixtures (Dylan Delannoy, email/phone) in the transcripts are seeded demo data.
