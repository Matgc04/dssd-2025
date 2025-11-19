import { cookies } from "next/headers";
import { store } from "@/lib/store";

const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:8000";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId es requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cookieStore = await cookies();
    const sid = cookieStore.get("sid")?.value;
    const session = await store.get(sid);
    const tokenJWT = session?.tokenJWT;

    if (!sid) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!tokenJWT) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const endpoint = `${CLOUD_URL}/api/v1/projects/etapasNecesitanColaboracion?projectId=${encodeURIComponent(
      projectId
    )}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenJWT}`,
      },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const message = errorPayload?.error || response.statusText || "Error desconocido";
      return new Response(JSON.stringify({ error: message }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch collaboration detail:", error);
    return new Response(JSON.stringify({ error: "No se pudo obtener el proyecto" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
