"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MessageSquare, TicketCheck } from "lucide-react";
import type { CallDetailDTO } from "@wismo/shared";
import { AppHeader } from "@/components/app-header";
import { apiFetch, ApiError } from "@/lib/api";

// Drill-in view for one call: header, every ticket it raised, and its reconstructed transcript.
export default function CallDetailPage() {
  const params = useParams<{ callId: string }>();
  const [call, setCall] = useState<CallDetailDTO | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiFetch<CallDetailDTO>(`/admin/calls/${params.callId}`)
      .then(setCall)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) setMissing(true);
      });
  }, [params.callId]);

  if (missing) {
    return (
      <div className="app-shell admin-shell">
        <AppHeader mode="admin" />
        <main className="page-content narrow">
          <Link className="back-link" href="/admin"><ArrowLeft size={16} /> Dashboard</Link>
          <p className="muted">Call not found.</p>
        </main>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="app-shell admin-shell">
        <AppHeader mode="admin" />
        <main className="page-content narrow"><p className="muted">Loading call…</p></main>
      </div>
    );
  }

  const durationSeconds = call.endedAt ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000 : null;

  return (
    <div className="app-shell admin-shell">
      <AppHeader mode="admin" />
      <main className="page-content narrow">
        <Link className="back-link" href="/admin"><ArrowLeft size={16} /> Dashboard</Link>
        <section className="page-heading detail-heading">
          <div>
            <p className="eyebrow">Call detail</p>
            <h1>{call.order?.orderNumber ?? "General call"}</h1>
            <p className="muted">{call.customer.name} · {call.customer.email}</p>
          </div>
        </section>

        <section className="detail-band">
          <div><small>Status</small><strong><i className={`tag ${call.status.toLowerCase()}`}>{call.status}</i></strong></div>
          <div><small>Started</small><strong>{new Date(call.startedAt).toLocaleString("en-AU")}</strong></div>
          <div><small>Duration</small><strong>{durationSeconds != null ? `${Math.round(durationSeconds)}s` : "In progress"}</strong></div>
        </section>

        <div className="detail-grid">
          <section className="content-section">
            <h2><MessageSquare size={19} /> Transcript</h2>
            {call.transcript.length ? (
              <div className="data-table">
                {call.transcript.map((turn, i) => (
                  <div className="table-row" key={i} style={{ gridTemplateColumns: "100px 1fr" }}>
                    <span>{turn.role === "agent" ? "Agent" : "Customer"}</span>
                    <span>{turn.content}</span>
                  </div>
                ))}
              </div>
            ) : <p className="empty-state">No transcript captured for this call yet.</p>}
          </section>

          <section className="content-section">
            <h2><TicketCheck size={19} /> Tickets</h2>
            {call.tickets.length ? call.tickets.map((ticket) => (
              <div className="queue-item" key={ticket.id}>
                <span><strong>#{ticket.ticketNumber} · {ticket.category.replaceAll("_", " ")}</strong><small>{ticket.reason}</small></span>
                <i className={`tag ${ticket.status === "OPEN" ? "open" : ""}`}>{ticket.status}</i>
              </div>
            )) : <p className="empty-state">No tickets raised on this call.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
