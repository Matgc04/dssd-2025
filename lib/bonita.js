import { cookies } from "next/headers";
import { store } from "@/lib/store";

export async function bonitaFetch(path, init) {
  const cookieStore = await cookies();

  const sid = cookieStore.get("sid")?.value;
  if (!sid) throw new Error("No SID");

  const sess = await store.get(sid);
  console.log("Sess desde store:", sess);

  if (!sess) throw new Error("Session expired");

  const url = `${sess.bonitaBase}${path.startsWith("/") ? "" : "/"}${path}`;

  // inyectar cookie JSESSIONID y CSRF
  const headers = new Headers(init?.headers || {});
  // Cookie: enviá ambas si querés (JSESSIONID basta para sesion); el token va como header
  headers.set("Cookie", sess.jsessionId);
  headers.set("X-Bonita-API-Token", sess.csrfToken);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers, redirect: "manual" });

  // Si expira (401/403), podrías: 1) relogin y reintentar, o 2) borrar sess y 401 al cliente.
  if (res.status === 401 || res.status === 403) {
    // opcional: await store.del(sid)
    throw new Error(`Bonita auth failed: ${res.status}`);
  }
  return res;
}