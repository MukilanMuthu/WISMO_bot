"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Box, Clock, PhoneCall, ShieldCheck, TicketCheck } from "lucide-react";
import type { DashboardDTO } from "@wismo/shared";
import { AppHeader } from "@/components/app-header";
import { apiFetch } from "@/lib/api";

// Fetch and render operational metrics and recent exception queues for admin review.
export default function AdminPage() {
  const [data, setData] = useState<DashboardDTO | null>(null);

  useEffect(() => {
    apiFetch<DashboardDTO>("/admin/dashboard").then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="app-shell admin-shell">
        <AppHeader mode="admin" />
        <main className="page-content"><p className="muted">Loading dashboard…</p></main>
      </div>
    );
  }

  const { orderCount, calls, tickets, trackingErrors, containmentRate, escalationRate, ticketsByCategory, avgCallDurationSeconds } = data;

  return (
    <div className="app-shell admin-shell">
      <AppHeader mode="admin" />
      <main className="page-content">
        <section className="page-heading">
          <p className="eyebrow">Operations</p>
          <h1>Voice service health</h1>
          <p className="muted">Calls, escalations, and tracking-provider failures in one queue.</p>
        </section>
        <section className="metric-grid">
          <div className="metric"><Box size={20} /><span>Orders<strong>{orderCount}</strong></span></div>
          <div className="metric"><PhoneCall size={20} /><span>Voice calls<strong>{calls.length}</strong></span></div>
          <div className="metric"><TicketCheck size={20} /><span>Open tickets<strong>{tickets.filter((ticket) => ticket.status === "OPEN").length}</strong></span></div>
          <div className="metric warning"><AlertTriangle size={20} /><span>Tracking errors<strong>{trackingErrors.length}</strong></span></div>
        </section>

        <section className="page-heading">
          <p className="eyebrow">Agent performance</p>
          <h2>How the agent is doing</h2>
        </section>
        <section className="metric-grid">
          <div className="metric"><ShieldCheck size={20} /><span>Containment rate<strong>{(containmentRate * 100).toFixed(0)}%</strong></span></div>
          <div className="metric"><TicketCheck size={20} /><span>Escalation rate<strong>{(escalationRate * 100).toFixed(0)}%</strong></span></div>
          <div className="metric"><Clock size={20} /><span>Avg call duration<strong>{(avgCallDurationSeconds / 60).toFixed(1)}m</strong></span></div>
        </section>

        <section className="ops-grid">
          <div className="data-panel wide">
            <div className="panel-heading"><h2>Recent calls</h2><span>{calls.length} shown</span></div>
            <div className="data-table">
              <div className="table-row table-head"><span>Customer</span><span>Order</span><span>Status</span><span>Started</span></div>
              {calls.length ? calls.map((call) => (
                <Link className="table-row" href={`/admin/calls/${call.id}`} key={call.id}><span>{call.customer.name}</span><span>{call.order?.orderNumber ?? "General call"}</span><span><i className={`tag ${call.status.toLowerCase()}`}>{call.status}</i></span><span>{new Date(call.startedAt).toLocaleString("en-AU")}</span></Link>
              )) : <p className="empty-state">No calls yet. Launch one from customer portal.</p>}
            </div>
          </div>

          <div className="data-panel">
            <div className="panel-heading"><h2>Support tickets</h2><span>{tickets.length}</span></div>
            {tickets.length ? tickets.map((ticket) => (
              ticket.callId ? (
                <Link className="queue-item" href={`/admin/calls/${ticket.callId}`} key={ticket.id}><span><strong>#{ticket.ticketNumber} · {ticket.customer.name}</strong><small>{ticket.reason}</small></span><i className="tag open">{ticket.status}</i></Link>
              ) : (
                <div className="queue-item" key={ticket.id}><span><strong>#{ticket.ticketNumber} · {ticket.customer.name}</strong><small>{ticket.reason}</small></span><i className="tag open">{ticket.status}</i></div>
              )
            )) : <p className="empty-state">No escalations.</p>}
          </div>

          <div className="data-panel">
            <div className="panel-heading"><h2>Tracking errors</h2><span>{trackingErrors.length}</span></div>
            {trackingErrors.length ? trackingErrors.map((error) => (
              <div className="queue-item" key={error.id}><span><strong>{error.order.orderNumber}</strong><small>{error.errorMessage}</small></span><time>{new Date(error.createdAt).toLocaleTimeString("en-AU")}</time></div>
            )) : <p className="empty-state">Provider healthy.</p>}
          </div>

          <div className="data-panel">
            <div className="panel-heading"><h2>Tickets by reason</h2><span>{tickets.length}</span></div>
            {Object.keys(ticketsByCategory).length ? Object.entries(ticketsByCategory).map(([category, count]) => (
              <div className="queue-item" key={category}><span><strong>{category.replaceAll("_", " ")}</strong></span><i className="tag open">{count}</i></div>
            )) : <p className="empty-state">No tickets raised.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
