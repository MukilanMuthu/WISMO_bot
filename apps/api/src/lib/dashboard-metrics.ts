type TranscriptTurn = { role: "agent" | "user"; content: string };

// Retell's call_analyzed webhook carries call.transcript_object (an ordered array of turns) as
// the structured form, and call.transcript (a "Role: text" line-per-turn string) as a fallback
// for older payload shapes. Prefer the structured array; only parse the string if it's missing.
export function reconstructTranscript(payload: unknown): TranscriptTurn[] {
  const call = (payload as { call?: Record<string, unknown> })?.call ?? (payload as Record<string, unknown>);
  const turns = call?.transcript_object;
  if (Array.isArray(turns)) {
    return turns
      .map((turn) => ({ role: (turn?.role === "agent" ? "agent" : "user") as "agent" | "user", content: String(turn?.content ?? "").trim() }))
      .filter((turn) => turn.content.length > 0);
  }

  const transcript = call?.transcript;
  if (typeof transcript === "string" && transcript.trim()) {
    return transcript
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(agent|user):\s*(.*)$/i);
        return match ? { role: match[1].toLowerCase() as "agent" | "user", content: match[2] } : { role: "user" as const, content: line };
      });
  }

  return [];
}

type MetricsCall = { id: string; orderId: string | null; startedAt: Date; endedAt: Date | null };
type MetricsTicket = { callId: string | null; orderId: string | null; category: string };

// The "agent performance story" metrics: how often the agent resolves a call on its own
// (containment) vs. needs a human (escalation/category breakdown), how often the same order
// keeps coming back (repeat contact), and how long calls run on average.
export function computeAgentMetrics(calls: MetricsCall[], tickets: MetricsTicket[]) {
  const totalCalls = calls.length;
  const callIdsWithTickets = new Set(tickets.map((t) => t.callId).filter((id): id is string => id != null));
  const containmentRate = totalCalls === 0 ? 0 : 1 - callIdsWithTickets.size / totalCalls;
  const escalationRate = totalCalls === 0 ? 0 : tickets.length / totalCalls;

  const ticketsByCategory: Record<string, number> = {};
  for (const ticket of tickets) ticketsByCategory[ticket.category] = (ticketsByCategory[ticket.category] ?? 0) + 1;

  const touchesPerOrder = new Map<string, number>();
  for (const call of calls) if (call.orderId) touchesPerOrder.set(call.orderId, (touchesPerOrder.get(call.orderId) ?? 0) + 1);
  for (const ticket of tickets) if (ticket.orderId) touchesPerOrder.set(ticket.orderId, (touchesPerOrder.get(ticket.orderId) ?? 0) + 1);
  const touchedOrders = touchesPerOrder.size;
  const repeatOrders = [...touchesPerOrder.values()].filter((count) => count > 1).length;
  const repeatContactRate = touchedOrders === 0 ? 0 : repeatOrders / touchedOrders;

  const finishedCalls = calls.filter((call) => call.endedAt != null);
  const avgCallDurationSeconds =
    finishedCalls.length === 0
      ? 0
      : finishedCalls.reduce((sum, call) => sum + (call.endedAt!.getTime() - call.startedAt.getTime()) / 1000, 0) / finishedCalls.length;

  return { containmentRate, escalationRate, ticketsByCategory, repeatContactRate, avgCallDurationSeconds };
}
