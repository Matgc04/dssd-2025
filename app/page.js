"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const res = await fetch("/api/login", { method: "GET" });
      const json = await res.json().catch(() => null);
      console.log("Login response status:", res.status, "body:", json);
      alert("Login successful");
    } catch (err) {
        console.error("Login error", err);
        alert("Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch("/api/logout", { method: "GET" });
      const json = await res.json().catch(() => null);
      console.log("logout response status:", res.status, "body:", json);
      alert("Logout successful");
    } catch (err) {
        console.error("Logout error", err);
        alert("Logout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Project planning 👋</h1>
      <p>
        <Link href="/projects/new">Crear un nuevo proyecto</Link>
      </p>
      <button onClick={handleLogin}>Iniciar sesion</button>
      <button onClick={handleLogout}>Cerrar sesion</button>
    </div>
  );
}