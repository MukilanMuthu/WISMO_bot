# WISMO Project Rules

- The project is an npm-workspaces monorepo: `apps/api` is the Express JSON API (owns Prisma, business logic, Retell endpoints), `apps/web` is the UI-only Next.js SPA, and `packages/shared` holds the TypeScript HTTP contract both import. Keep all data access and business logic in `apps/api`; `apps/web` must talk to it only over HTTP via `@/lib/api`.
- Do not change code while the user is still planning or asking architecture questions.
- Add a concise intent comment before every meaningful code block. Do not narrate obvious assignments.
- Retell Conversation Flow owns the visible conversation journey and wording.
- Backend code owns authentication, order ownership, retry limits, TrackingMore access, and support-ticket writes.
- Treat TrackingMore as the only live source of shipment status. Never silently substitute mock tracking data.
- Keep Retell knowledge-base content static. Fetch customer, order, and tracking data through authenticated backend functions.
- Use Retell Web Call only. Do not add purchased phone-number or outbound-call flows.
