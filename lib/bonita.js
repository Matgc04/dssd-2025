import { cookies } from "next/headers";
import { store } from "@/lib/store";

const RAW_BONITA_BASE = process.env.BONITA_URL || process.env.BONITA_BASE_URL || "http://localhost:8080";
const DEFAULT_BONITA_BASE = stripTrailingSlash(RAW_BONITA_BASE);

function stripTrailingSlash(value) {
  return (value || "").trim().replace(/\/+$/, "");
}

function normalizeBase(baseUrl) {
  return stripTrailingSlash(
    typeof baseUrl === "string" && baseUrl.trim() ? baseUrl : DEFAULT_BONITA_BASE
  );
}

function getSetCookieArray(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const raw = typeof headers.raw === "function" ? headers.raw() : null;
  if (raw?.["set-cookie"]) return raw["set-cookie"];
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function pickCookiePair(cookiesArr, name) {
  if (!Array.isArray(cookiesArr)) return null;
  const cookie = cookiesArr.find((entry) => entry?.trim().startsWith(`${name}=`));
  return cookie ? cookie.trim().split(";")[0] : null;
}

function applySessionHeaders(headers, session) {
  headers.set("Cookie", session.jsessionId);
  headers.set("X-Bonita-API-Token", session.csrfToken);
}

function buildBonitaUrl(base, path) {
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function errorWithStatus(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function loginBonitaUser({ username, password, baseUrl } = {}) {
  if (!username || !password) {
    throw errorWithStatus("Se necesita usuario y contraseña", 400);
  }

  const bonitaBase = normalizeBase(baseUrl);
  const res = await fetch(`${bonitaBase}/bonita/loginservice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    },
    body: new URLSearchParams({ username: username.trim(), password }).toString(),
    redirect: "manual",
  });

  if (!res.ok) {
    throw errorWithStatus("Login en Bonita falló", res.status === 401 ? 401 : res.status || 500);
  }

  const cookiesArr = getSetCookieArray(res.headers);
  const jsessionId = pickCookiePair(cookiesArr, "JSESSIONID");
  const headerToken = res.headers.get("X-Bonita-API-Token") || res.headers.get("x-bonita-api-token");
  const cookieToken = pickCookiePair(cookiesArr, "X-Bonita-API-Token");
  const csrfToken = headerToken || cookieToken?.split("=")[1] || null;

  if (!jsessionId || !csrfToken) {
    throw errorWithStatus("Missing session or CSRF token", 500);
  }

  return { bonitaBase, jsessionId, csrfToken };
}

export async function fetchBonitaJson(session, path, init = {}) {
  const url = buildBonitaUrl(session.bonitaBase, path);
  const headers = new Headers(init.headers || {});
  applySessionHeaders(headers, session);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers, redirect: init.redirect ?? "manual" });
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const message =
      typeof payload === "string" ? payload : payload?.error || "Bonita request failed";
    throw errorWithStatus(message, res.status || 500);
  }

  return payload;
}

export async function bonitaFetch(path, init) {
  const cookieStore = await cookies();

  const sid = cookieStore.get("sid")?.value;
  if (!sid) throw new Error("Debes iniciar sesión");

  const sess = await store.get(sid);
  //console.log("Sess desde store:", sess);

  if (!sess) throw new Error("La sesión ha expirado, por favor inicia sesión nuevamente");

  const url = buildBonitaUrl(sess.bonitaBase, path);

  // inyectar cookie JSESSIONID y CSRF
  const headers = new Headers(init?.headers || {});
  applySessionHeaders(headers, sess);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let res;
  try {
    res = await fetch(url, { ...init, headers, redirect: "manual" });
  } catch (err) {
    console.error("Error en fetch a Bonita:", err);
    throw err;
  }
  // Si expira (401/403), podrías: 1) relogin y reintentar, o 2) borrar sess y 401 al cliente.
  if (res.status === 401 || res.status === 403) {
    // opcional: await store.del(sid)
    throw new Error(`Bonita auth failed: ${res.status}`);
  }

  return res;
}

export async function readBonitaPayload(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const text = await response.text();
  return text || null;
}

export async function fetchProcessByDisplayName(displayName, options = {}) {
  if (!displayName) {
    throw new Error("displayName is required");
  }

  const filters = [`displayName=${encodeURIComponent(displayName)}`];
  if (options.activationState) {
    filters.push(`activationState=${options.activationState}`);
  }
  if (Array.isArray(options.additionalFilters)) {
    options.additionalFilters.forEach((filter) => {
      if (typeof filter === "string" && filter.trim()) {
        filters.push(filter.trim());
      }
    });
  }

  const query = [
    ...filters.map((filter) => `f=${filter}`),
    `p=${options.page ?? 0}`,
    `c=${options.count ?? 1}`,
  ].join("&");

  const res = await bonitaFetch(`/bonita/API/bpm/process?${query}`);
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string" ? payload : payload?.error || "Bonita process fetch failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  return Array.isArray(payload) ? payload : [];
}

export async function instantiateProcess(processId, contract = {}) {
  if (!processId) {
    throw new Error("processId is required");
  }

  const res = await bonitaFetch(`/bonita/API/bpm/process/${processId}/instantiation`, {
    method: "POST",
    body: JSON.stringify(contract),
  });

  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string" ? payload : payload?.error || "Bonita process instantiation failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  return payload ?? { ok: true };
}

export async function searchActivityByCaseId(caseId, options = {}) {
  if (!caseId) {
    throw new Error("caseId is required");
  }

  const filters = [`caseId=${encodeURIComponent(caseId)}`];
  if (options.state) {
    filters.push(`state=${encodeURIComponent(options.state)}`);
  }
  if (options.userId) {
    filters.push(`user_id=${encodeURIComponent(options.userId)}`);
  }
  if (Array.isArray(options.additionalFilters)) {
    options.additionalFilters.forEach((filter) => {
      if (typeof filter === "string" && filter.trim()) {
        filters.push(filter.trim());
      }
    });
  }

  const queryParts = [
    ...filters.map((filter) => `f=${filter}`),
    `p=${options.page ?? 0}`,
    `c=${options.count ?? 10}`,
  ];

  if (options.sort) {
    queryParts.push(`o=${encodeURIComponent(options.sort)}`);
  }

  const endpoint = options.endpoint ?? "/bonita/API/bpm/humanTask";
  const res = await bonitaFetch(`${endpoint}?${queryParts.join("&")}`);
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string" ? payload : payload?.error || "Bonita task search failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  return Array.isArray(payload) ? payload : [];
}

export async function getCurrentSession() {
  const res = await bonitaFetch("/bonita/API/system/session/unusedId", { method: "GET" });
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const err = new Error(
      typeof payload === "string" ? payload : payload?.error || "Bonita session fetch failed"
    );
    err.status = res.status;
    throw err;
  }

  return payload;
}

async function ensureTaskAssignedToCurrentUser(taskId) {
  const session = await getCurrentSession();
  const userId = session?.user_id;
  if (!userId) {
    const err = new Error("Unable to determine current Bonita user id");
    err.status = 500;
    throw err;
  }

  const assignRes = await bonitaFetch(`/bonita/API/bpm/userTask/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ assigned_id: userId }),
  });

  const assignPayload = await readBonitaPayload(assignRes);
  if (!assignRes.ok) {
    const err = new Error(
      typeof assignPayload === "string"
        ? assignPayload
        : assignPayload?.error || "Bonita task assign failed"
    );
    err.status = assignRes.status;
    throw err;
  }

  return { userId, task: assignPayload };
}

export async function completeActivity(taskId, contractValues = {}, options = {}) {
  if (!taskId) {
    throw new Error("taskId is required");
  }

  if (options.assign !== false) {
    await ensureTaskAssignedToCurrentUser(taskId);
  }

  const body = {
    state: "completed",
    contractValues,
  };

  const res = await bonitaFetch(`/bonita/API/bpm/userTask/${taskId}/execution`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string" ? payload : payload?.error || "Bonita complete activity failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  return payload ?? { ok: true };
}

// Si necesitás un tipo específico lo pasás por options.type,
// y si querés que salga el valor crudo (por ejemplo, enteros) usás stringify: false cuando lo pasas
function serializeValue(value, options) { 
  if (value === undefined) return null;
  if (value === null) return null;
  if (options?.stringify === false) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export async function setCaseVariable(caseId, variableName, value, options = {}) {
  if (!caseId) throw new Error("caseId is required");
  if (!variableName) throw new Error("variableName is required");

  const body = {
    value: serializeValue(value, options),
  };

  if (options.type) {
    body.type = options.type;
  }

  const res = await bonitaFetch(
    `/bonita/API/bpm/caseVariable/${caseId}/${encodeURIComponent(variableName)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );

  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    console.error("setCaseVariable error payload:", payload);
    const error =
      typeof payload === "string" ? payload : payload?.error || "Bonita set case variable failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  return payload ?? { ok: true };
}

export async function getCaseVariable(caseId, variableName) {
  if (!caseId) throw new Error("caseId is required");
  if (!variableName) throw new Error("variableName is required");

  const res = await bonitaFetch(
    `/bonita/API/bpm/caseVariable/${caseId}/${encodeURIComponent(variableName)}`
  );
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string"
        ? payload
        : payload?.error || "Bonita get case variable failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  return payload;
}
