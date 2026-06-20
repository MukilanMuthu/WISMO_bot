"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Headphones, LogOut } from "lucide-react";
import { clearToken } from "@/lib/api";

// Render compact product navigation shared across authenticated workspaces.
export function AppHeader({ mode }: { mode: "customer" | "admin" }) {
  const router = useRouter();

  // Drop the bearer token client-side and return to the storefront login.
  function logout() {
    clearToken();
    router.push("/");
  }

  return (
    <header className="app-header">
      <Link className="brand" href={mode === "admin" ? "/admin" : "/orders"}>
        <span className="brand-mark"><Headphones size={18} /></span>
        <span>WISMO Desk</span>
      </Link>
      <div className="header-actions">
        <span className="role-label">{mode === "admin" ? "Operations" : "Customer portal"}</span>
        <button className="icon-button" onClick={logout} title="Log out" aria-label="Log out" type="button">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
