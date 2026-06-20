"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Box, PhoneCall, TicketCheck } from "lucide-react";
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

  const { orderCount, calls, tickets, trackingErrors } = data;

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

        <section className="ops-grid">
          <div className="data-panel wide">
            <div className="panel-heading"><h2>Recent calls</h2><span>{calls.length} shown</span></div>
            <div className="data-table">
              <div className="table-row table-head"><span>Customer</span><span>Order</span><span>Status</span><span>Started</span></div>
              {calls.length ? calls.map((call) => (
                <div className="table-row" key={call.id}><span>{call.customer.name}</span><span>{call.order?.orderNumber ?? "General call"}</span><span><i className={`tag ${call.status.toLowerCase()}`}>{call.status}</i></span><span>{new Date(call.startedAt).toLocaleString("en-AU")}</span></div>
              )) : <p className="empty-state">No calls yet. Launch one from customer portal.</p>}
            </div>
          </div>

          <div className="data-panel">
            <div className="panel-heading"><h2>Support tickets</h2><span>{tickets.length}</span></div>
            {tickets.length ? tickets.map((ticket) => (
              <div className="queue-item" key={ticket.id}><span><strong>{ticket.customer.name}</strong><small>{ticket.reason}</small></span><i className="tag open">{ticket.status}</i></div>
            )) : <p className="empty-state">No escalations.</p>}
          </div>

          <div className="data-panel">
            <div className="panel-heading"><h2>Tracking errors</h2><span>{trackingErrors.length}</span></div>
            {trackingErrors.length ? trackingErrors.map((error) => (
              <div className="queue-item" key={error.id}><span><strong>{error.order.orderNumber}</strong><small>{error.errorMessage}</small></span><time>{new Date(error.createdAt).toLocaleTimeString("en-AU")}</time></div>
            )) : <p className="empty-state">Provider healthy.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
