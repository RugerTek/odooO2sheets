import { normalizeOdooUrl } from "./util";

export interface OdooSession {
  odooUrl: string;
  db: string;
  username: string;
  uid: number;
  // Password or API key. Stored in-memory and used for JSON-RPC object calls.
  secret: string;
  // Base context applied to every execute_kw call (e.g. multi-company).
  context?: Record<string, unknown>;
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

function jsonRpcPost(odooUrl: string, payload: unknown): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return UrlFetchApp.fetch(`${odooUrl}/jsonrpc`, {
    method: "post",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true,
  });
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

function extractOdooError(body: any): string {
  return (
    body?.error?.data?.message ||
    body?.error?.message ||
    (body?.__nonJson ? body.__preview : "") ||
    "Unknown Odoo error"
  );
}

function rpcCall(odooUrl: string, service: "common" | "object", method: string, args: unknown[]): any {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: { service, method, args },
    id: new Date().getTime(),
  };
  const resp = jsonRpcPost(odooUrl, payload);
  const body = parseJson(resp);
  if (resp.getResponseCode() >= 400) {
    const msg = extractOdooError(body) || resp.getContentText();
    throw new Error(`Odoo JSON-RPC failed (${resp.getResponseCode()}): ${msg}`);
  }
  if (body?.error) {
    throw new Error(extractOdooError(body));
  }
  return body?.result;
}

export function authenticate(params: { odooUrl: string; db: string; username: string; password: string }): OdooSession {
  const odooUrl = normalizeOdooUrl(params.odooUrl);
  let uid: any;
  try {
    uid = rpcCall(odooUrl, "common", "authenticate", [params.db, params.username, params.password, {}]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (lower.includes("database") && lower.includes("not found")) {
      throw new Error(
        `Database no encontrada: "${params.db}". En Odoo Online / Odoo.sh el Database no siempre es el subdominio. ` +
          `Si tenes un link tipo psql postgresql://.../DB, el Database es lo que va despues de la ultima '/': DB.`
      );
    }
    throw new Error(`No se pudo autenticar contra Odoo. Detalle: ${msg}`);
  }

  // Wrong creds => uid=false.
  if (!uid) {
    throw new Error(
      "Usuario o password/API key incorrectos. Si usas API Key, pegala en el campo password (API keys funcionan via JSON-RPC)."
    );
  }
  if (typeof uid !== "number") {
    throw new Error(`Respuesta inesperada de Odoo (uid=${String(uid)}).`);
  }

  return { odooUrl, db: params.db, username: params.username, uid, secret: params.password, context: {} };
}

export function callKw<T>(
  session: OdooSession,
  args: { model: string; method: string; args?: unknown[]; kwargs?: Record<string, unknown> }
): T {
  const model = args.model;
  const method = args.method;
  const posArgs = args.args ?? [];
  const kw = { ...(args.kwargs ?? {}) } as Record<string, unknown>;

  // Merge context (session.context takes lower precedence than explicit kwargs.context).
  const baseCtx =
    session.context && typeof session.context === "object" && !Array.isArray(session.context) ? session.context : {};
  const kwCtxRaw = (kw as any).context;
  const kwCtx =
    kwCtxRaw && typeof kwCtxRaw === "object" && !Array.isArray(kwCtxRaw) ? (kwCtxRaw as Record<string, unknown>) : {};
  (kw as any).context = { ...baseCtx, ...kwCtx };

  const result = rpcCall(session.odooUrl, "object", "execute_kw", [
    session.db,
    session.uid,
    session.secret,
    model,
    method,
    posArgs,
    kw,
  ]);
  return result as T;
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

