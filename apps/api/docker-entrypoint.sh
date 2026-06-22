#!/bin/sh
set -e
npx prisma migrate deploy
npx prisma db seed
exec npx tsx src/server.ts
