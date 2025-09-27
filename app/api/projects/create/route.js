import { NextResponse } from "next/server";
import { bonitaFetch } from "@/lib/bonita";

export async function POST(request) {
  try {
    console.log("Informacion de la request entrante:");
    console.log("Method:", request.method);
    console.log("URL:", request.url);
    const text = await request.text();
    console.log("Body:", text);

    const res = await bonitaFetch("/bonita/API/bpm/process?p=0&c=10"); // completar con path y options correctos
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Error en /api/projects/create:", e);
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}