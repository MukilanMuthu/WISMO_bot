"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Box, CalendarDays, PackageCheck } from "lucide-react";
import type { OrderDTO } from "@wismo/shared";
import { AppHeader } from "@/components/app-header";
import { VoiceCallButton } from "@/components/voice-call-button";
import { apiFetch } from "@/lib/api";

// Format monetary values consistently for seeded order currencies.
function money(value: string, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(Number(value));
}

// Fetch and render customer-owned orders and the general-context voice entry point.
export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);

  useEffect(() => {
    // apiFetch redirects to login on 401, so a thrown error here is non-auth and can be swallowed.
    apiFetch<OrderDTO[]>("/customer/orders").then(setOrders).catch(() => setOrders([]));
  }, []);

  if (!orders) {
    return (
      <div className="app-shell">
        <AppHeader mode="customer" />
        <main className="page-content"><p className="muted">Loading your orders…</p></main>
      </div>
    );
  }

  const firstName = orders[0]?.customerName.split(" ")[0] ?? "there";

  return (
    <div className="app-shell">
      <AppHeader mode="customer" />
      <main className="page-content">
        <section className="page-heading heading-actions">
          <div>
            <p className="eyebrow">Welcome back, {firstName}</p>
            <h1>Your orders</h1>
            <p className="muted">Choose an order, or start a general voice call and tell us its number.</p>
          </div>
          <VoiceCallButton />
        </section>

        <section className="summary-strip" aria-label="Order summary">
          <div><Box size={19} /><span><strong>{orders.length}</strong> total orders</span></div>
          <div><PackageCheck size={19} /><span><strong>{orders.filter((order) => order.fulfillmentStatus === "FULFILLED").length}</strong> fulfilled</span></div>
          <div><CalendarDays size={19} /><span>Latest order <strong>{orders[0] ? new Date(orders[0].createdAt).toLocaleDateString("en-AU") : "—"}</strong></span></div>
        </section>

        <section className="order-list">
          {orders.map((order) => (
            <Link className="order-row" href={`/orders/${order.id}`} key={order.id} aria-label={`View ${order.orderNumber}`}>
              <div className="order-main">
                <div className="package-mark"><Box size={20} /></div>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <p>{order.numItems} items · Ordered {new Date(order.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>
              <div className="order-status">
                <span className="status-dot" />
                <span>{order.fulfillmentStatus.replaceAll("_", " ").toLowerCase()}</span>
              </div>
              <strong className="order-total">{money(order.orderTotal, order.currency)}</strong>
              <ArrowRight size={18} className="icon-button" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
