"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Headphones, LockKeyhole } from "lucide-react";
import type { LoginResponse } from "@wismo/shared";
import { apiFetch, setToken } from "@/lib/api";

// Present one storefront login that exchanges credentials for a bearer token from the API.
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Post credentials to the API, store the returned token, and route by role.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(false);

    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<LoginResponse>("/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setToken(result.token);
      router.push(result.role === "ADMIN" ? "/admin" : "/orders");
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-visual">
        <div className="visual-grid" />
        <div className="visual-content">
          <span className="brand-mark large"><Headphones size={26} /></span>
          <p className="eyebrow">Retell voice operations</p>
          <h1>WISMO Desk</h1>
          <p>Live shipment answers, customer-safe order lookup, and visible escalation handling.</p>
          <div className="signal-row">
            <span><i className="signal green" /> Browser voice calls</span>
            <span><i className="signal amber" /> Live TrackingMore data</span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-inner">
          <p className="eyebrow">Demo access</p>
          <h2>Sign in</h2>
          <p className="muted">Customers and operations staff use the same secure storefront login.</p>
          {error ? <p className="login-error" role="alert">Email or password is incorrect.</p> : null}
          <form className="login-form" onSubmit={onSubmit}>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="button primary" type="submit" disabled={submitting}>
              <LockKeyhole size={18} /> {submitting ? "Signing in" : "Sign in"} <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
