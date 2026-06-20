---
status: accepted
---

# Keep the WISMO POC minimal and single-store

WISMO is a low-volume proof of concept for one store. Keep the existing application and PostgreSQL database simple: no tenant abstraction, queues, workers, caching layer, or production-scale infrastructure unless a demonstrated POC requirement needs one.

The application is deliberately split into two separately deployable apps on distinct URLs: an Express JSON API (`apps/api`, owns Prisma and all business logic) and a UI-only Next.js SPA (`apps/web`). This is the intended product direction — an API-first backend with a thin frontend — and supersedes the earlier single-process Next.js layout. It is not a move to microservices: there remains one backend service and one database, organised as an npm-workspaces monorepo with a shared TypeScript contract package (`packages/shared`).

Seed exactly four customer accounts, one administrator account, and the four manager-supplied orders. Store order items as relational line items rather than JSON; each line item carries its carrier and tracking details. An order may note that it is split-shipped, while TrackingMore remains the only live source of shipment status and Retell remains responsible only for the visible conversation flow.

Voice-agent tracking requests run synchronously: Retell waits while the backend validates order ownership, calls TrackingMore, and returns the result in the same function request. This keeps the spoken response tied to fresh provider data without queues or background workers.

Customer names, phone numbers, addresses, and related account details are PII. Keep them behind authenticated backend access and use them only when customer verification requires them; do not place them in Retell knowledge-base content.

When authenticated web-call context identifies the customer, the voice agent does not ask for their phone number. Phone verification is reserved for a missing or failed identity context and must be validated by the backend.

All four customers and the administrator use one storefront-style login page with passwords. The backend verifies hashed credentials, establishes the authenticated session, and redirects users according to their role; passwordless identity-selection links are not sufficient for this POC.

Use email and password as login credentials. Seed fake, non-deliverable customer emails derived from their names: `dylan.delannoy@example.com`, `nick.greaves@example.com`, `joel.hastings@example.com`, and `adrian.harris@example.com`.

All five seeded accounts share one demo-only password for easy walkthroughs. Store only its password hash in PostgreSQL; never store or compare plaintext passwords in application data.

The shared seeded demo password is `WismoDemo!2026`. It is intentionally non-production test data; production credentials must never be documented this way.

Successful login issues a signed, short-lived JWT containing only necessary identity claims such as user ID and role. Because the frontend and API are separate origins, the API returns the JWT in the login response body and the SPA stores it and sends it as an `Authorization: Bearer` header on every request. The backend must verify the JWT before customer, order, tracking, or administrator access. (Trade-off accepted for the POC: a bearer token held in browser storage is reachable by JavaScript and therefore weaker against XSS than the previous `HttpOnly` cookie; before production this should move to short-lived access tokens with refresh, or a same-site cookie via an API gateway on a shared parent domain.)

The POC has no formal recovery-point or recovery-time commitment. Local database state may be discarded and recreated from Prisma migrations and deterministic seed data.

Availability is best-effort for the POC. Synchronous tracking lookup targets are p50 below 2 seconds, p95 below 5 seconds, and p99 below 8 seconds; tracking-provider failures must fail clearly and follow the support-ticket flow rather than substituting mock status.

Each order line item is fulfilled in at most one parcel and therefore has at most one carrier, tracking ID, and tracking URL. The POC does not support splitting the quantity of one line item across multiple parcels; supporting that later requires a separate shipment-allocation model.

The required order-level carrier, tracking ID, and tracking URL fields remain on `Order`. For a normal shipment, those order-level fields are authoritative. Only for a split shipment are the tracking fields on its `LineItem` rows authoritative; the order notes must clearly state that the shipment is split.

The backend identifies a split shipment from more than one distinct, non-empty Line Item tracking ID; it never parses notes to make routing or tracking decisions. After authentication and order-ownership checks, the backend passes any Order notes with tracking results so Retell Conversation Flow can convey relevant additional information to the customer. Notes remain dynamic backend data and must not be copied into Retell knowledge-base content.

Every value in `Order.notes` is customer-safe and may be spoken by the voice agent when relevant. Internal operational commentary must use a separate field or record and must never be mixed into `Order.notes`.

Fields not supplied by the manager use arbitrary but fixed fixture values. Seed runs remain deterministic so accounts, orders, line items, and walkthrough results do not change between database resets.

Use the carrier associated with each supplied last-mile tracking ID: YTO Global for `G20216581231`, Australia Post for `34YEK857516701000910909`, iMile for `6060626349451`, and Australia Post for `34YEK858511601000910904`.

Store manager-supplied human-readable order numbers in their hash-prefixed form (`#21505`, `#21509`, `#21511`, `#21515`). Existing backend normalization continues accepting speech input with or without the leading hash.

Normalize stored Australian phone numbers to E.164: Dylan `+61477118384`, Nicholas `+61457485866`, Joel `+61422214779`, and Adrian `+61447379418`. Any fallback phone-verification input is normalized before backend comparison.
