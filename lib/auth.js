import { cookies } from "next/headers";
import { store } from "@/lib/store";

export async function getSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  if (!sid) return null;

  const session = await store.get(sid);
  return session;
}
