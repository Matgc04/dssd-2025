import { cookies } from 'next/headers';
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { newSid } from "@/lib/sessionStore";
 
export async function GET(request) {
  const cookieStore = await cookies();
  console.log("SID cookie leída:", cookieStore.get("sid"));

  const sid = cookieStore.get("sid")?.value;
  if (!sid) return NextResponse.json({ error: "No SID cookie" }, { status: 401 });

  const sess = await store.get(sid);
  console.log("Sess desde store:", sess);

  cookieStore.delete("sid");
  await store.del(sid);

  console.log("Sesion eliminada");

  return NextResponse.json({ ok: true }); 
}