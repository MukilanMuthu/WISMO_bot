"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Package, Truck } from "lucide-react";
import type { OrderDTO } from "@wismo/shared";
import { AppHeader } from "@/components/app-header";
import { VoiceCallButton } from "@/components/voice-call-button";
import { apiFetch, ApiError } from "@/lib/api";

// Render one owned order with tracking identifiers but without caching live carrier status.
export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiFetch<OrderDTO>(`/customer/orders/${params.orderId}`)
      .then(setOrder)
      .catch((error) => {
        // Ownership/not-found surfaces as 404; other errors (incl. 401) are handled by apiFetch.
        if (error instanceof ApiError && error.status === 404) setMissing(true);
      });
  }, [params.orderId]);

  if (missing) {
    return (
      <div className="app-shell">
        <AppHeader mode="customer" />
        <main className="page-content narrow">
          <Link className="back-link" href="/orders"><ArrowLeft size={16} /> All orders</Link>
          <p className="muted">Order not found.</p>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="app-shell">
        <AppHeader mode="customer" />
        <main className="page-content narrow"><p className="muted">Loading order…</p></main>
      </div>
    );
  }

  const address = order.shippingAddress;

  return (
    <div className="app-shell">
      <AppHeader mode="customer" />
      <main className="page-content narrow">
        <Link className="back-link" href="/orders"><ArrowLeft size={16} /> All orders</Link>
        <section className="page-heading heading-actions detail-heading">
          <div>
            <p className="eyebrow">Order detail</p>
            <h1>{order.orderNumber}</h1>
            <p className="muted">Placed {new Date(order.createdAt).toLocaleDateString("en-AU", { dateStyle: "long" })}</p>
          </div>
          <VoiceCallButton orderId={order.id} />
        </section>

        <section className="detail-band">
          <div className="detail-status"><Truck size={22} /><span><small>Fulfillment</small><strong>{order.fulfillmentStatus.replaceAll("_", " ")}</strong></span></div>
          <div><small>Carrier</small><strong>{order.shippingCarrier}</strong></div>
          <div><small>Tracking number</small><strong>{order.trackingNumber}</strong></div>
        </section>

        <div className="detail-grid">
          <section className="content-section">
            <h2><Package size={19} /> Items</h2>
            {order.lineItems.map((item) => (
              <div className="line-item" key={item.id}>
                <span><strong>{item.name}</strong><small>{item.sku}</small><small>{item.carrierName} · {item.trackingId}</small></span>
                <span>Qty {item.quantity}<a href={item.trackingUrl} target="_blank" rel="noreferrer" aria-label={`Track ${item.name}`}><ExternalLink size={13} /></a></span>
              </div>
            ))}
            {order.notes ? <div className="order-note"><strong>Order note</strong><p>{order.notes}</p></div> : null}
          </section>
          <section className="content-section">
            <h2><MapPin size={19} /> Delivery</h2>
            <address>{address.line1}<br />{address.city}, {address.region} {address.postalCode}<br />{address.country}</address>
            <div className="date-pair">
              <span>Shipped<strong>{order.shippedAt ? new Date(order.shippedAt).toLocaleDateString("en-AU") : "—"}</strong></span>
              <span>Estimated<strong>{order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString("en-AU") : "—"}</strong></span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
