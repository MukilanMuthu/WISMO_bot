# Retell Conversation Flow Setup

## Direct answers

- Do not publish an empty agent or flow. Build and test the minimum node graph below first.
- There is no "Enable Web Call" switch on the agent. Web Call begins when this app calls Retell's `POST /v2/create-web-call`; frontend then joins using returned access token.
- `agent_id` identifies Retell agent, not Conversation Flow. Open agent in Retell dashboard and copy Agent ID shown in agent details. If current dashboard hides it, copy ID from agent page URL or call Retell List Agents API. Store value in `.env` as `RETELL_AGENT_ID`.
- Conversation Flow and Agent are separate resources. Build flow first, then create/edit agent and select that flow as agent's response engine.

## Before Retell setup

Retell calls the **Express API** (`apps/api`, default port `3001`), not the Next.js frontend. Retell cannot call `localhost`. Start the API, expose it through an HTTPS tunnel, then use the tunnel base URL below as `PUBLIC_APP_URL`. The API mounts these endpoints without an `/api` prefix (e.g. `/retell/functions/resolve-order`, `/retell/webhook`).

Example: `https://your-tunnel.example.com`

Required `.env` values:

- `RETELL_API_KEY`: Retell dashboard API key.
- `RETELL_AGENT_ID`: agent ID copied after agent is created.
- `RETELL_FUNCTION_SECRET`: same secret configured as custom header on every Retell function.
- `TRACKINGMORE_API_KEY`: real TrackingMore API key.

## 1. Create Conversation Flow

In Retell dashboard:

1. Open Conversation Flows and create blank flow named `WISMO Customer Flow`.
2. Open Global Settings.
3. Set language/voice defaults.
4. Add global prompt:

> You are an ecommerce order-status assistant. Help only with orders owned by authenticated customer context supplied by backend. Never invent order or tracking data. Keep responses brief and suitable for speech. Follow node transitions and backend result codes exactly. When backend returns an error or escalation result, do not work around it.

5. Add nodes from next section.
6. Test both known-order and general-order paths.
7. Publish flow only after all required transitions work.

## 2. Build minimum node graph

| Node | Type | Purpose and transition |
| --- | --- | --- |
| `start` | Conversation | Greet customer. If `{{has_known_order}}` is `true`, go to `load_known_order`; otherwise go to `ask_order_number`. |
| `load_known_order` | Function | Call `get_order_details` with `orderId={{order_id}}`. Free (no TrackingMore). Branch on returned `code`, then go to `speak_order_details`. |
| `ask_order_number` | Conversation | Ask for visible order number, capture it, then call `resolve_order`. |
| `resolve_order` | Function | Send captured `orderNumber`. Free (no TrackingMore). `ORDER_FOUND` -> `speak_order_details`; `ORDER_NOT_FOUND` -> `ask_order_number`; `RETRY_LIMIT_REACHED` -> `list_orders`. |
| `speak_order_details` | Conversation | `resolve_order`/`get_order_details` already returned items, carrier, notes, estimated delivery — speak from that response directly, no extra call. Ask if customer wants live tracking status; if yes go to `track_order`, else end/escalate as needed. |
| `track_order` | Function | Call `get_tracking_status` without `orderId`; backend uses order resolved into call state. Only call this when the customer explicitly asks where the order/parcel is — it is the one function that costs a TrackingMore API call. |
| `speak_tracking` | Conversation | Speak every returned shipment's item names, carrier, status, latest event, date/location, and estimated delivery when present. Convey non-empty `notes` naturally, then ask whether anything should be repeated. |
| `list_orders` | Function | Call `list_recent_orders` with `START`; read order number, ordered date, amount, currency only. |
| `list_more` | Function | Call `list_recent_orders` with `MORE`. `LISTING_LIMIT_REACHED` -> `escalate` (returned after asking for more twice past the end of the list). |
| `repeat_orders` | Function | Call `list_recent_orders` with `REPEAT`. `LISTING_LIMIT_REACHED` -> `escalate`. |
| `escalate` | Function | Call `create_support_ticket`, confirm ticket creation, then end call. |
| `tracking_error` | Conversation + Function | Apologize, create support ticket with reason `Tracking provider unavailable`, then end call. |
| `end` | End | Close call politely. |

Do not rely on prompt text to enforce retry/repeat limits. Backend persists those counters.

## 3. Create four custom functions

For every custom function:

- Method: `POST`.
- Header: `x-retell-function-secret` = exact `.env` `RETELL_FUNCTION_SECRET` value.
- Leave `Payload: args only` disabled. Full payload includes `call.call_id`, needed to load backend call state.
- Use public HTTPS tunnel URL, never localhost.

For every custom function below, the API expects four (now five) functions. `get_order_details` and `resolve_order` are free — DB-only, no TrackingMore call. `get_tracking_status` is the only function that costs a TrackingMore API call; wire it only behind explicit "where is my order" intent, not into the initial order-load path.

| Function | URL | Parameter schema |
| --- | --- | --- |
| `resolve_order` | `PUBLIC_APP_URL/retell/functions/resolve-order` | Required string `orderNumber` |
| `get_order_details` | `PUBLIC_APP_URL/retell/functions/get-order-details` | Optional string `orderId` |
| `get_tracking_status` | `PUBLIC_APP_URL/retell/functions/get-tracking-status` | Optional string `orderId` |
| `list_recent_orders` | `PUBLIC_APP_URL/retell/functions/list-recent-orders` | Required enum string `action`: `START`, `MORE`, `REPEAT` |
| `create_support_ticket` | `PUBLIC_APP_URL/retell/functions/create-support-ticket` | Required string `reason` |

Retell sends full function envelope containing `name`, `call`, and `args`. Backend reads call ID from `call.call_id` and function fields from `args`.

`resolve_order` and `get_order_details` both return `code: "ORDER_FOUND"` plus the exact same order record `GET /customer/orders/:orderId` returns (`orderNumber`, `numItems`, `orderTotal`, `currency`, `shippingCarrier`, `trackingNumber`, `trackingUrl`, `shippedAt`, `estimatedDelivery`, `notes`, `lineItems[]`, etc.) — one shared shape across web and voice, zero TrackingMore cost. They do **not** include live tracking status.

`get_tracking_status` returns `isSplitShipment`, `shipments` (same parcels, now with live status), customer-safe `notes`, and a backwards-compatible first `tracking` result. When `isSplitShipment` is true, speak every shipment in `shipments`; line-item tracking is authoritative. When false, the single shipment comes from required order-level tracking fields. Never infer split shipment by reading notes.

## 4. Create and publish Agent

1. Open Agents and create agent named `WISMO Web Agent`.
2. Choose Conversation Flow as response engine.
3. Select published `WISMO Customer Flow`.
4. Configure voice, language, interruption sensitivity, and agent webhook.
5. Set webhook URL to `PUBLIC_APP_URL/retell/webhook`.
6. Add webhook header `x-retell-function-secret` with same local secret if dashboard supports webhook headers. Otherwise webhook signature verification must be implemented before enabling webhook.
7. Save/publish agent.
8. Copy Agent ID into `.env` as `RETELL_AGENT_ID`.
9. Copy Retell API key into `.env` as `RETELL_API_KEY`.

Do not buy or attach phone number. Agent can be used by Web Call API without phone number.

## 5. How Web Call works in this app

1. Customer clicks voice button.
2. Browser calls the API endpoint `POST {NEXT_PUBLIC_API_URL}/retell/web-call` with its `Authorization: Bearer` token.
3. API calls Retell `POST /v2/create-web-call` using `RETELL_AGENT_ID` and secret API key.
4. Retell returns access token valid for short time.
5. Browser Retell SDK starts call using access token.

Therefore Web Call is enabled by API integration, not dashboard toggle.

## 6. Test before production use

1. Order-specific call: open `#BB1042`, launch call, confirm no order-number question.
2. General call: launch from orders page, say valid order number, confirm tracking lookup.
3. Say invalid order twice, confirm last five orders are listed.
4. Request list repeat three times, confirm support ticket created after allowed two repeats.
5. Stop TrackingMore access, confirm agent does not invent status and creates ticket.
6. Check admin dashboard for call, tracking error, and ticket records.

## Static knowledge base

Suitable: opening hours, support channels, shipping policy, refund policy, escalation expectations.

Never store customer records, orders, tracking numbers, shipment status, call counters, or ticket state in Retell Knowledge Base. Those values come from backend custom functions.

## Official references

- [Conversation Flow overview](https://docs.retellai.com/build/conversation-flow/overview)
- [Custom functions](https://docs.retellai.com/build/conversation-flow/custom-function)
- [Web Call SDK](https://docs.retellai.com/deploy/web-call)
- [Create Web Call API](https://docs.retellai.com/api-references/create-web-call)
