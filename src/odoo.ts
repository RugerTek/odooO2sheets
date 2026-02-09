import { normalizeOdooUrl } from "./util";

export interface OdooSession {
  odooUrl: string;
  db: string;
  username: string;
  uid: number;
  cookie: string; // Cookie header value (session_id)
}

export function getVersionInfo(odooUrlInput: string): any {
  const odooUrl = normalizeOdooUrl(odooUrlInput);
  const checks: Array<{ url: string; code: number; contentType?: string }> = [];

  function tryGet(path: string, accept?: string): { code: number; text: string; contentType?: string } {
    const url = `${odooUrl}${path}`;
    const resp = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
      headers: accept ? { Accept: accept } : undefined,
    });
    const code = resp.getResponseCode();
    const hdrs = resp.getAllHeaders() as Record<string, string | string[]>;
    const ct = String(hdrs["Content-Type"] || hdrs["content-type"] || "");
    checks.push({ url, code, contentType: ct });
    return { code, text: resp.getContentText() || "", contentType: ct };
  }

  // Best-effort reachability test. Some Odoo setups may not like JSON Accept headers.
  const v = tryGet("/web/webclient/version_info", "application/json");
  if (v.code >= 200 && v.code < 400) {
    try {
      const parsed = JSON.parse(v.text);
      return { ok: true, kind: "version_info", checks, version: parsed };
    } catch {
      return { ok: true, kind: "version_info_nonjson", checks, preview: v.text.slice(0, 200) };
    }
  }

  const login = tryGet("/web/login");
  if (login.code >= 200 && login.code < 400) {
    return { ok: true, kind: "web_login", checks };
  }

  const root = tryGet("/");
  if (root.code >= 200 && root.code < 400) {
    return { ok: true, kind: "root", checks };
  }

  // If we got here, we couldn't reach any expected endpoint.
  return {
    ok: false,
    kind: "unreachable",
    checks,
    hint:
      "Verify the URL is correct (for Odoo Online it should end with .odoo.com). If your site is not public, it won't work.",
  };
}

function jsonRpc(url: string, payload: unknown, cookie?: string): GoogleAppsScript.URL_Fetch.HTTPResponse {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (cookie) headers.Cookie = cookie;
  return UrlFetchApp.fetch(url, {
    method: "post",
    headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true,
  });
}

function extractCookie(resp: GoogleAppsScript.URL_Fetch.HTTPResponse): string | undefined {
  const headers = resp.getAllHeaders() as Record<string, string | string[]>;
  const setCookie = headers["Set-Cookie"] || headers["set-cookie"];
  if (!setCookie) return undefined;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  // Keep only cookie pair, discard attributes. Prefer session_id.
  const session = arr
    .map((h) => String(h).split(";")[0])
    .find((c) => c.toLowerCase().startsWith("session_id="));
  return session || String(arr[0]).split(";")[0];
}

function parseJson(resp: GoogleAppsScript.URL_Fetch.HTTPResponse): any {
  const text = resp.getContentText();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, __preview: text.slice(0, 300) };
  }
}

export function authenticate(params: {
  odooUrl: string;
  db: string;
  username: string;
  password: string;
}): OdooSession {
  const odooUrl = normalizeOdooUrl(params.odooUrl);
  const endpoint = `${odooUrl}/web/session/authenticate`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: { db: params.db, login: params.username, password: params.password },
    id: new Date().getTime(),
  };
  const resp = jsonRpc(endpoint, payload);
  const body = parseJson(resp);
  if (resp.getResponseCode() >= 400) {
    const msg =
      body?.error?.data?.message ||
      body?.error?.message ||
      (body?.__nonJson ? body.__preview : resp.getContentText());
    throw new Error(
      `No se pudo conectar a Odoo (${resp.getResponseCode()}). Verifica URL y Database. Detalle: ${msg}`
    );
  }
  if (body?.error) {
    const msg = body?.error?.data?.message || body?.error?.message || "Unknown Odoo error";
    const lower = String(msg).toLowerCase();
    if (lower.includes("database not found")) {
      throw new Error(
        `Database no encontrada: "${params.db}". En Odoo Online / Odoo.sh el Database no siempre es el subdominio. Si tenes un link tipo psql postgresql://...@HOST/DB, el Database es lo que va despues de la ultima '/': DB.`
      );
    }
    if (lower.includes("access denied") || lower.includes("wrong login") || lower.includes("authentication")) {
      throw new Error("Usuario o password incorrectos. Proba con el mismo usuario exacto que usas en el navegador.");
    }
    throw new Error(`Login rechazado por Odoo. Detalle: ${msg}`);
  }
  const uid = body?.result?.uid;
  // Odoo returns uid=false on wrong credentials (and no cookie).
  if (uid === false || uid === null || uid === undefined) {
    throw new Error(
      "Login fallido. Revisá estos 3 puntos: 1) Database (en Odoo Online suele ser el subdominio) 2) Usuario 3) Password. Tip: si en el navegador inicias sesion con 'admin' (sin @), probalo asi aqui tambien."
    );
  }
  if (typeof uid !== "number") {
    const preview = body?.__nonJson ? ` Preview: ${body.__preview}` : "";
    throw new Error(`Respuesta inesperada de Odoo (no devolvio uid).${preview}`);
  }
  const cookie = extractCookie(resp);
  if (!cookie) {
    // Some setups may not return cookie; still allow but later calls might fail.
    throw new Error(
      "Login OK pero Odoo no devolvio cookie de sesion (session_id). Esto suele indicar un proxy o bloqueo. Proba nuevamente o revisa configuracion de la instancia."
    );
  }
  return { odooUrl, db: params.db, username: params.username, uid, cookie };
}

export function callKw<T>(session: OdooSession, args: {
  model: string;
  method: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
}): T {
  const endpoint = `${session.odooUrl}/web/dataset/call_kw/${encodeURIComponent(args.model)}/${encodeURIComponent(
    args.method
  )}`;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: args.model,
      method: args.method,
      args: args.args ?? [],
      kwargs: args.kwargs ?? {},
    },
    id: new Date().getTime(),
  };
  const resp = jsonRpc(endpoint, payload, session.cookie);
  const body = parseJson(resp);
  if (resp.getResponseCode() >= 400) {
    const msg = body?.error?.data?.message || body?.error?.message || resp.getContentText();
    throw new Error(`Odoo call_kw failed (${resp.getResponseCode()}): ${msg}`);
  }
  if (body?.error) {
    const msg = body?.error?.data?.message || body?.error?.message || "Unknown Odoo error";
    throw new Error(`Odoo call_kw error: ${msg}`);
  }
  return body.result as T;
}

export function canUseAdvanced(session: OdooSession): boolean {
  // base.group_system == Settings / Administration
  try {
    const ok = callKw<boolean>(session, {
      model: "res.users",
      method: "has_group",
      args: ["base.group_system"],
    });
    return Boolean(ok);
  } catch {
    return false;
  }
}
