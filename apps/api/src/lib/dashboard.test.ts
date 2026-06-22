import { describe, expect, it } from "vitest";
import { computeAgentMetrics, reconstructTranscript } from "./dashboard-metrics";

describe("dashboard", () => {
  it("reconstructs a transcript from the structured transcript_object", () => {
    const payload = { call: { transcript_object: [{ role: "agent", content: "Hi" }, { role: "user", content: "Hello" }] } };
    expect(reconstructTranscript(payload)).toEqual([
      { role: "agent", content: "Hi" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("falls back to parsing the transcript string when transcript_object is missing", () => {
    const payload = { call: { transcript: "Agent: Hi there\nUser: Hello" } };
    expect(reconstructTranscript(payload)).toEqual([
      { role: "agent", content: "Hi there" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("returns an empty transcript when neither field is present", () => {
    expect(reconstructTranscript({ call: {} })).toEqual([]);
  });

  it("computes zero rates with no calls (no div-by-zero)", () => {
    expect(computeAgentMetrics([], [])).toEqual({
      containmentRate: 0,
      escalationRate: 0,
      ticketsByCategory: {},
      avgCallDurationSeconds: 0,
    });
  });

  it("counts a call with no ticket as contained, and a call with a ticket as not", () => {
    const calls = [
      { id: "c1", orderId: "o1", startedAt: new Date(), endedAt: null },
      { id: "c2", orderId: "o2", startedAt: new Date(), endedAt: null },
    ];
    const tickets = [{ callId: "c2", orderId: "o2", category: "ADDRESS_CHANGE" }];
    const metrics = computeAgentMetrics(calls, tickets);
    expect(metrics.containmentRate).toBe(0.5);
    expect(metrics.escalationRate).toBe(0.5);
  });

  it("averages call duration only over calls that have ended", () => {
    const calls = [
      { id: "c1", orderId: null, startedAt: new Date("2026-06-22T00:00:00Z"), endedAt: new Date("2026-06-22T00:02:00Z") },
      { id: "c2", orderId: null, startedAt: new Date("2026-06-22T00:00:00Z"), endedAt: null },
    ];
    expect(computeAgentMetrics(calls, []).avgCallDurationSeconds).toBe(120);
  });
});
