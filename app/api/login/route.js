import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { newSid } from "@/lib/sessionStore";
import { loginBonitaUser, fetchBonitaJson } from "@/lib/bonita";

const BONITA =
  process.env.BONITA_URL || "http://localhost:8080"; // yo puse esta ip http://172.28.224.1:8080 porque con WSL me arma quilombo con localhost

const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:8000"; 
//en el dockerfile esta el 8080 pero en localp ara que no se choque con bonita le pueden cambiar a 8000 cuando hacen el docker run

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCloudWithRetry(url, options, { retries = 2, delayMs = 800, timeoutMs = 8000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      const body = await res.text().catch(() => "");
      const err = new Error(`Cloud login failed with status ${res.status}`);
      err.status = res.status;
      err.body = body;
      lastError = err;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
    }
    if (attempt < retries) {
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError || new Error("Cloud login failed");
}

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

  let sessionTokens;
  try {
    sessionTokens = await loginBonitaUser({ username, password, baseUrl: BONITA });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Login en Bonita falló" },
      { status: err.status ?? 500 }
    );
  }

  let userId;
  let resolvedUserName = username;
  let roleId;
  let roleName;

  try {
    const sessionInfo = await fetchBonitaJson(sessionTokens, "/bonita/API/system/session/unusedId");
    userId = sessionInfo?.user_id;
    resolvedUserName = sessionInfo?.user_name || resolvedUserName;
    if (!userId) {
      const err = new Error("No se pudo determinar el usuario de Bonita");
      err.status = 500;
      throw err;
    }

    const memberships = await fetchBonitaJson(
      sessionTokens,
      `/bonita/API/identity/membership?f=user_id=${encodeURIComponent(userId)}&p=0&c=1`
    );
    const primaryMembership = Array.isArray(memberships) ? memberships[0] : null;
    roleId = primaryMembership?.role_id;
    if (!roleId) {
      const err = new Error("El usuario no tiene roles asociados");
      err.status = 404;
      throw err;
    }

    const role = await fetchBonitaJson(
      sessionTokens,
      `/bonita/API/identity/role/${encodeURIComponent(roleId)}`
    );
    roleName = role?.name ?? null;
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "No se pudo obtener la información del usuario en Bonita" },
      { status: err.status ?? 500 }
    );
  }

  console.log(`Usuario ${resolvedUserName} (${userId}) con rol ${roleName} (${roleId}) autenticado en bonita.`);

  //Nos logueamos en el cloud para obtener el token JWT (con reintentos ante timeouts)
  let res;
  try {
    res = await fetchCloudWithRetry(CLOUD_URL + "/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    console.error("Login en cloud fallido tras reintentos:", err?.body || err?.message || err);
    const status = err?.status || 502;
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio cloud para autenticación" },
      { status }
    );
  }

  const data = await res.json();
  const token = data.access_token;

  console.log(`Usuario ${resolvedUserName} autenticado en cloud. Token: ${token}`);

  // 2) crear SID y guardar en store con TTL
  const sid = newSid();
  await store.set(
    sid,
    {
      jsessionId: sessionTokens.jsessionId,
      csrfToken: sessionTokens.csrfToken,
      bonitaBase: sessionTokens.bonitaBase,
      user: resolvedUserName,
      userId,
      roleId,
      roleName: String(roleName).toUpperCase(),
      tokenJWT: token,
    },
    25 * 60 //TODO: hacer que el ttl sea el mismo que el del cloud o menos
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

  return NextResponse.json({
    ok: true,
    user: resolvedUserName,
    role: roleName,
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST with credentials" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
