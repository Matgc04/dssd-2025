import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { newSid } from "@/lib/sessionStore";

const BONITA =
  process.env.BONITA_URL || "http://localhost:8080"; // yo puse esta ip http://172.28.224.1:8080 porque con WSL me arma quilombo con localhost

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const username = payload?.username?.trim();
  const password = payload?.password;

  if (!username || !password) {
    return NextResponse.json({ error: "Se necesita usuario y contraseña" }, { status: 400 });
  }

  // 1) Login en Bonita
  const loginRes = await fetch(`${BONITA}/bonita/loginservice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: "manual",
  });

  if (!loginRes.ok) {
    //console.log("Login en Bonita falló", loginRes.status, loginRes.headers);
    return NextResponse.json(
      { error: "Login en Bonita falló" },
      { status: loginRes.status === 401 ? 401 : 500 }
    );
  }

  const raw =
    typeof loginRes.headers.raw === "function"
      ? loginRes.headers.raw()
      : null;
  const setCookies =
    raw?.["set-cookie"] ??
    (typeof loginRes.headers.getSetCookie === "function"
      ? loginRes.headers.getSetCookie()
      : null) ??
    [];

  const jsessionCookie =
    setCookies.find((c) => c.startsWith("JSESSIONID=")) || null;
  const jsessionId = jsessionCookie?.split(";")[0] ?? null;
  const tokenCookie =
    setCookies.find((c) => c.startsWith("X-Bonita-API-Token=")) || null;

  const headerToken =
    loginRes.headers.get("X-Bonita-API-Token") ||
    loginRes.headers.get("x-bonita-api-token") ||
    null;

  const cookiePairToValue = (c) =>
    c ? c.split(";")[0].split("=")[1] : null;

  const csrfToken = headerToken ?? cookiePairToValue(tokenCookie);

  if (!jsessionId || !csrfToken) {
    return NextResponse.json({ error: "Missing session or CSRF token" }, { status: 500 });
  }

  // 2) crear SID y guardar en store con TTL
  const sid = newSid();
  await store.set(
    sid,
    {
      jsessionId,
      csrfToken,
      bonitaBase: BONITA,
      user: username,
    },
    25 * 60
  );

  // setear cookie opaca para el cliente
  const cookieStore = await cookies();
  cookieStore.set("sid", sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // <- en dev debe ser false,
    sameSite: "lax",
    path: "/",
    maxAge: 25 * 60,
  });

  console.log("Guardé sesión SID:", sid);

  return NextResponse.json({ ok: true, user: username });
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST with credentials" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
