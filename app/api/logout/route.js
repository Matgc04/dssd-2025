import { cookies } from 'next/headers';
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { bonitaFetch } from "@/lib/bonita";

 
export async function GET(request) {
  const cookieStore = await cookies();
  console.log("SID cookie leída:", cookieStore.get("sid"));

  const sid = cookieStore.get("sid")?.value;
  if (!sid) return NextResponse.json({ error: "No SID cookie" }, { status: 401 });

  console.log("Sesion eliminada");
  try {
    const res = await bonitaFetch("/bonita/logoutservice", { method: "GET" });
    const ct = res.headers.get("content-type") || "";
    let payload;
    if (res.status === 204) {
      payload = null;
    } else if (ct.includes("application/json")) {
      payload = await res.json();
    } else {
      // puede venir vacío o HTML
      const text = await res.text();
      payload = text || null;
    }

    return NextResponse.json({
      message: "Logged out from Bonita",
      status: res.status,
      payload,
    });
  } catch (e) {
    console.error("Error en el logout de bonita:", e);
    return NextResponse.json({ error: e.message || "Logout error" }, { status: 500 });
  } finally {
    try {
      cookieStore.delete("sid");
      await store.del(sid);
    } catch (e2) {
      console.error("Error limpiando sesión local:", e2);
    }
  }
}