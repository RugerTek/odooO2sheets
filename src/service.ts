import {
  getConnection,
  getCredential,
  getCurrentContext,
  getDatasource,
  getEphemeralCredential,
  listConnections,
  listDatasources,
  saveCredential,
  saveEphemeralCredential,
  touchUpdatedAt,
  upsertConnection,
  upsertDatasource,
} from "./storage";
import { authenticate, canUseAdvanced, callKw, getVersionInfo, OdooSession } from "./odoo";
import { Connection, Credential, Datasource, DatasourceField, SchedulerConfig } from "./types";
import { normalizeConnectionName, normalizeOdooUrl, nowIso, parseDomain, uuidV4 } from "./util";
import { ensureSchedulerTrigger } from "./scheduler";
import { refreshDatasourceById } from "./refresh";

export function api_getBootstrap(): {
  context: { spreadsheetId: string; userEmail: string };
  connections: Connection[];
  datasources: Datasource[];
} {
  return {
    context: getCurrentContext(),
    connections: listConnections(),
    datasources: listDatasources(),
  };
}

export function api_testOdooUrl(input: { odooUrl: string }): any {
  const res = getVersionInfo(input.odooUrl);
  if (!res?.ok) throw new Error(res?.hint || "Odoo URL not reachable. Check the URL.");
  return res;
}

export function api_createConnection(input: {
  name?: string;
  title?: string;
  odooUrl: string;
  odooDb: string;
  storeConnections: boolean;
  shareCredentials: boolean;
}): Connection {
  const ctx = getCurrentContext();
  const odooUrl = normalizeOdooUrl(input.odooUrl);
  const host = (() => {
    try {
      return new URL(odooUrl).hostname || "odoo";
    } catch {
      return "odoo";
    }
  })();
  const baseTitle = (input.title || "").trim() || host;

  const toAutoName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  let nameRaw = (input.name || "").trim();
  if (!nameRaw) nameRaw = toAutoName(host);
  if (!nameRaw) nameRaw = "main";

  // Ensure unique even if user doesn't care about names.
  let name = normalizeConnectionName(nameRaw);
  const existingNames = new Set(listConnections().map((c) => c.name));
  if (existingNames.has(name)) {
    let i = 2;
    while (existingNames.has(`${name}${i}`)) i += 1;
    name = `${name}${i}`;
  }

  const conn: Connection = {
    id: uuidV4(),
    name,
    title: baseTitle,
    odooUrl,
    odooDb: input.odooDb.trim(),
    storeConnections: Boolean(input.storeConnections),
    shareCredentials: Boolean(input.shareCredentials),
    createdBy: ctx.userEmail,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (!conn.odooDb) throw new Error("Database is required.");
  upsertConnection(conn);
  return conn;
}

export function api_updateConnection(input: {
  id: string;
  title: string;
  odooUrl: string;
  odooDb: string;
  storeConnections: boolean;
  shareCredentials: boolean;
}): Connection {
  const conn = getConnection(input.id);
  if (!conn) throw new Error("Connection not found.");
  conn.title = input.title.trim() || conn.title;
  conn.odooUrl = normalizeOdooUrl(input.odooUrl);
  conn.odooDb = input.odooDb.trim();
  conn.storeConnections = Boolean(input.storeConnections);
  conn.shareCredentials = Boolean(input.shareCredentials);
  touchUpdatedAt(conn);
  upsertConnection(conn);
  return conn;
}

export function api_setCredential(input: {
  connectionId: string;
  odooUsername: string;
  odooPassword: string;
  remember: boolean;
}): { ok: true; uid: number; canUseAdvanced: boolean } {
  const conn = getConnection(input.connectionId);
  if (!conn) throw new Error("Connection not found.");
  const session = authenticate({
    odooUrl: conn.odooUrl,
    db: conn.odooDb,
    username: input.odooUsername,
    password: input.odooPassword,
  });

  const scope: Credential["scope"] = conn.shareCredentials ? "DOCUMENT" : "USER";
  if (input.remember) {
    const cred: Credential = {
      connectionId: conn.id,
      scope,
      odooUsername: input.odooUsername,
      // Placeholder: store plain password. Replace with encryption as per SECURITY.md.
      secret: input.odooPassword,
      updatedAt: nowIso(),
    };
    saveCredential(cred);
  } else {
    // Keep it usable for manual actions during this session without persisting to PropertiesService.
    saveEphemeralCredential({
      connectionId: conn.id,
      odooUsername: input.odooUsername,
      secret: input.odooPassword,
    });
  }

  return { ok: true, uid: session.uid, canUseAdvanced: canUseAdvanced(session) };
}

function getSessionForConnection(connectionId: string): OdooSession {
  const conn = getConnection(connectionId);
  if (!conn) throw new Error("Connection not found.");

  const scope = conn.shareCredentials ? "DOCUMENT" : "USER";
  const cred = getCredential(connectionId, scope);
  const tmp = cred ? undefined : getEphemeralCredential(connectionId);
  if (!cred && !tmp) throw new Error("Missing credentials. Please login (and optionally remember credentials).");

  return authenticate({
    odooUrl: conn.odooUrl,
    db: conn.odooDb,
    username: cred ? cred.odooUsername : tmp!.odooUsername,
    password: cred ? cred.secret : tmp!.secret,
  });
}

export function api_searchModels(input: {
  connectionId: string;
  query: string;
  limit?: number;
}): Array<{ model: string; name: string; modules?: string }> {
  const session = getSessionForConnection(input.connectionId);
  const q = input.query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, Number(input.limit) || 20));

  // Use ir.model to search by technical model or display name.
  const domain: any[] = ["|", ["model", "ilike", q], ["name", "ilike", q]];
  const rows = callKw<Array<{ model: string; name: string; modules?: string }>>(session, {
    model: "ir.model",
    method: "search_read",
    args: [domain],
    kwargs: { fields: ["model", "name", "modules"], limit, order: "model asc" },
  });
  return rows
    .filter((r) => r && typeof r.model === "string")
    .map((r) => ({ model: r.model, name: r.name || r.model, modules: (r as any).modules }));
}

export function api_getModelFields(input: {
  connectionId: string;
  model: string;
}): Array<{ fieldName: string; label: string; type: string; relation?: string; help?: string }> {
  const session = getSessionForConnection(input.connectionId);
  const model = input.model.trim();
  if (!model) throw new Error("Model is required.");

  const mapping = callKw<Record<string, any>>(session, {
    model,
    method: "fields_get",
    args: [[], ["string", "type", "relation", "help"]],
    kwargs: {},
  });

  const out: Array<{ fieldName: string; label: string; type: string; relation?: string; help?: string }> = [];
  for (const [fieldName, info] of Object.entries(mapping || {})) {
    const label = typeof info?.string === "string" ? info.string : fieldName;
    const type = typeof info?.type === "string" ? info.type : "unknown";
    out.push({
      fieldName,
      label,
      type,
      relation: typeof info?.relation === "string" ? info.relation : undefined,
      help: typeof info?.help === "string" ? info.help : undefined,
    });
  }
  out.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
  return out;
}

export function api_listSheets(): string[] {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");
  return ss.getSheets().map((s) => s.getName());
}

export function api_createDatasource(input: {
  sheetName: string;
  connectionId: string;
  odooModel: string;
  fieldsCsv?: string;
  fields?: Array<{ fieldName: string; label?: string; order: number }>;
  limit: number;
  domain?: string;
  orderBy?: string;
  writeMode: "REPLACE" | "APPEND";
  header: boolean;
}): Datasource {
  const ctx = getCurrentContext();
  const conn = getConnection(input.connectionId);
  if (!conn) throw new Error("Connection not found.");

  const model = input.odooModel.trim();
  if (!model) throw new Error("Odoo model is required (e.g. res.partner).");

  const fromArray = (input.fields || []).filter((f) => f && f.fieldName);
  const fromCsv = (input.fieldsCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((f, idx) => ({ fieldName: f, label: f, order: idx }));
  const chosen = fromArray.length > 0 ? fromArray : fromCsv;
  if (chosen.length === 0) throw new Error("At least one field is required.");

  // Basic validation of domain JSON now (if present).
  parseDomain(input.domain);

  const dsFields: DatasourceField[] = chosen
    .map((f) => ({
      fieldName: String(f.fieldName),
      label: (f.label && String(f.label)) || String(f.fieldName),
      order: Number.isFinite(f.order as any) ? Number(f.order) : 0,
    }))
    .sort((a, b) => a.order - b.order);

  const ds: Datasource = {
    id: uuidV4(),
    documentId: ctx.spreadsheetId,
    sheetName: input.sheetName.trim(),
    connectionId: input.connectionId,
    odooModel: model,
    fields: dsFields,
    domain: input.domain?.trim() || undefined,
    orderBy: input.orderBy?.trim() || undefined,
    limit: Math.max(1, Number(input.limit) || 80),
    writeMode: input.writeMode,
    header: Boolean(input.header),
    schedulerEnabled: false,
    createdBy: ctx.userEmail,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  upsertDatasource(ds);
  return ds;
}

export function api_setDatasourceSchedule(input: {
  datasourceId: string;
  enabled: boolean;
  config?: SchedulerConfig;
}): Datasource {
  const ds = getDatasource(input.datasourceId);
  if (!ds) throw new Error("Datasource not found.");

  if (input.enabled) {
    const conn = getConnection(ds.connectionId);
    if (!conn) throw new Error("Connection not found.");
    const scope = conn.shareCredentials ? "DOCUMENT" : "USER";
    const cred = getCredential(conn.id, scope);
    if (!cred) throw new Error("Scheduler requires remembered credentials.");
    if (!input.config) throw new Error("Missing scheduler config.");
    ds.schedulerEnabled = true;
    ds.schedulerConfig = input.config;
    ensureSchedulerTrigger();
  } else {
    ds.schedulerEnabled = false;
    ds.schedulerConfig = undefined;
  }

  touchUpdatedAt(ds);
  upsertDatasource(ds);
  return ds;
}

export { refreshDatasourceById };
