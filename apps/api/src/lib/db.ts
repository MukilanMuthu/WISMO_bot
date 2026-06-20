import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Reuse one Prisma client during development hot reloads to avoid connection exhaustion.
export const db = globalForPrisma.prisma ?? new PrismaClient();

// Cache only outside production, where each process owns its client lifecycle.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
