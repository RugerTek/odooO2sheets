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
  return JSON.parse(text);
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
    const msg = body?.error?.data?.message || body?.error?.message || resp.getContentText();
    throw new Error(`Odoo authenticate failed (${resp.getResponseCode()}): ${msg}`);
  }
  const uid = body?.result?.uid;
  if (typeof uid !== "number") throw new Error("Odoo authenticate failed: missing uid.");
  const cookie = extractCookie(resp);
  if (!cookie) {
    // Some setups may not return cookie; still allow but later calls might fail.
    throw new Error("Odoo authenticate failed: missing session cookie (session_id).");
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
