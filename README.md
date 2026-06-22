# WISMO Retell Voice Agent

A "Where is my order?" voice prototype, split into two separately deployed apps:

- **`apps/api`** — Express JSON API (port `3001`). Owns Prisma, authentication, customer/order validation, retry limits, TrackingMore lookups, support-ticket escalation, and all Retell endpoints.
- **`apps/web`** — UI-only Next.js SPA (port `3000`). Talks to the API over HTTP with a bearer token; holds no database access.
- **`packages/shared`** — TypeScript HTTP contract (DTOs) imported by both.

Retell Conversation Flow owns dialogue routing; the API owns all business logic.

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env` (JWT, Retell, TrackingMore, function secret) and `apps/web/.env.example` to `apps/web/.env.local` (`NEXT_PUBLIC_API_URL`).
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install` (workspaces install both apps).
4. Generate/migrate/seed DB with `npm run db:generate`, `npm run db:migrate -- --name init`, and `npm run db:seed` (all delegate to `apps/api`).
5. Start both apps with `npm run dev` — API on `http://localhost:3001`, web on `http://localhost:3000`. Open the web URL.

## Apps

- Customer portal (`apps/web`): four password-protected customer accounts with one manager-supplied order each.
- Operations dashboard (`apps/web`): recent calls, support tickets, and TrackingMore failures.
- Voice functions (`apps/api`): shared-secret authenticated endpoints under `/retell/functions/*`.

## Testing

- Unit tests: `npm test` (runs `vitest` in `apps/api`).
- Manual API testing (Hoppscotch/curl): see [API routes reference](docs/API_ROUTES.md) for every endpoint, auth header, body, and response shape.
- To hit `/retell/functions/*` routes without a real Retell call, seed fixed `voiceCall` rows with `npm run db:seed:test-calls --workspace @wismo/api` (after the base seed) and use the printed `callId`s.

## Production (Docker)

Runs production builds of both apps plus Postgres, all from one root `.env` (copy `.env.example` → `.env`, never committed).

Build and push images (done on a machine that can build, not necessarily the VPS):
```
docker login ghcr.io -u <github-username>   # paste a PAT with write:packages as the password
docker compose --env-file .env build
docker compose --env-file .env push
```

On the VPS, pull and run the prebuilt images:
```
docker login ghcr.io -u <github-username>   # packages are private by default
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

The `api` container runs `prisma migrate deploy` then `prisma db seed` on every start, so `docker compose down && docker compose up -d` always comes back with migrations applied and demo data seeded. `NEXT_PUBLIC_API_URL` is resolved into the `web` container's build output at startup (not baked in at image-build time), so the same image works against whatever URL is set in `.env`. Set `IMAGE_TAG` in `.env` to version releases (defaults to `latest`).

## Provider setup

See [Retell setup](docs/RETELL_SETUP.md) for Conversation Flow node map and custom-function contracts. Live order/tracking data must never be added to Retell Knowledge Base.
