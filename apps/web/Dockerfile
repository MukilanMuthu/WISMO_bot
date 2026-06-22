FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_PUBLIC_API_URL=__RUNTIME_NEXT_PUBLIC_API_URL__
RUN npm run build --workspace @wismo/web

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY apps/web/docker-entrypoint.sh ./apps/web/docker-entrypoint.sh
RUN chmod +x apps/web/docker-entrypoint.sh
EXPOSE 3000
CMD ["./apps/web/docker-entrypoint.sh"]
