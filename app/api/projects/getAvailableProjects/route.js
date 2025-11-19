import { cookies } from "next/headers";
import { store } from "@/lib/store";

//fetch projects available for colaboration in the cloud endpoint, take it from .env or make it localhost 8000
const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:8000";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("sid")?.value;
    const sess = await store.get(sid);
    const tokenJWT = sess?.tokenJWT;

    //console.log(cookieStore);
    // console.log("Fetching available projects with sid:", sid);
    // console.log(sess);
    // console.log("Using tokenJWT:", tokenJWT);

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

    const response = await fetch(`${CLOUD_URL}/api/v1/projects/pendientesNecesitanColaboracion`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenJWT}`,
      },
    });

    console.log("response", response);

    if (!response.ok) {
      throw new Error(`Error fetching available projects: ${response.statusText}`);
    }

    const projects = await response.json();
    return new Response(JSON.stringify(projects), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch available projects:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
