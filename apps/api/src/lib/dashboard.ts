import { db } from "@/lib/db";
import { computeAgentMetrics, reconstructTranscript } from "./dashboard-metrics";

// Keep dashboard query shape identical for server-rendered page and JSON endpoint.
export async function getDashboardData() {
  const [orderCount, calls, tickets, trackingErrors, allCalls, allTickets] = await Promise.all([
    db.order.count(),
    db.voiceCall.findMany({ include: { customer: true, order: true }, orderBy: { startedAt: "desc" }, take: 20 }),
    db.supportTicket.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.trackingLookupLog.findMany({ where: { succeeded: false }, include: { order: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    // Unbounded, narrow-column reads for metrics — the agent-performance story must reflect every
    // call/ticket, not just the most recent 20 shown in the listing panels above.
    db.voiceCall.findMany({ select: { id: true, orderId: true, startedAt: true, endedAt: true } }),
    db.supportTicket.findMany({ select: { callId: true, orderId: true, category: true } }),
  ]);

  const metrics = computeAgentMetrics(allCalls, allTickets);

  return { orderCount, calls, tickets, trackingErrors, ...metrics };
}

// Load everything the call-detail page needs in one shot: the call header, every event in
// order, the tickets it raised, and the transcript reconstructed from its last call_analyzed event.
export async function getCallDetail(callId: string) {
  const call = await db.voiceCall.findUnique({
    where: { id: callId },
    include: {
      customer: true,
      order: true,
      tickets: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!call) return null;

  const lastAnalyzed = [...call.events].reverse().find((event) => event.type === "call_analyzed");
  const transcript = lastAnalyzed ? reconstructTranscript(lastAnalyzed.payload) : [];

  return { ...call, transcript };
}
