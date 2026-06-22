FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
WORKDIR /app/apps/api
RUN npx prisma generate
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
