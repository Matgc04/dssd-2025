import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { newSid } from "@/lib/sessionStore";
import { loginBonitaUser, fetchBonitaJson } from "@/lib/bonita";

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

  console.log(`Usuario ${resolvedUserName} (${userId}) con rol ${roleName} (${roleId}) autenticado.`);

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
