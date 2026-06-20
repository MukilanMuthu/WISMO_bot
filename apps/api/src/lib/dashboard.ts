import { db } from "@/lib/db";

// Keep dashboard query shape identical for server-rendered page and JSON endpoint.
export async function getDashboardData() {
  const [orderCount, calls, tickets, trackingErrors] = await Promise.all([
    db.order.count(),
    db.voiceCall.findMany({ include: { customer: true, order: true }, orderBy: { startedAt: "desc" }, take: 20 }),
    db.supportTicket.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.trackingLookupLog.findMany({ where: { succeeded: false }, include: { order: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return { orderCount, calls, tickets, trackingErrors };
}
