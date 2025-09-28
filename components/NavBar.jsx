"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NavBar({ isAuthenticated }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/logout", { method: "GET" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.error) {
        console.error(json?.error || `Request failed with status ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <header className="app-navbar">
      <div className="app-navbar__inner">
        <Link href="/" className="app-navbar__brand">
          Project planning
        </Link>
        <nav className="app-navbar__actions" aria-label="Primary">
          {isAuthenticated ? (
            <button
              type="button"
              className="app-navbar__button app-navbar__button--ghost"
              onClick={handleLogout}
              disabled={submitting}
            >
              {submitting ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          ) : (
            <Link href="/login" className="app-navbar__button">
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
