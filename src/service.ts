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
import { authenticate, canUseAdvanced, callKw, OdooSession } from "./odoo";
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

export function api_createConnection(input: {
  name: string;
  title: string;
  odooUrl: string;
  odooDb: string;
  storeConnections: boolean;
  shareCredentials: boolean;
}): Connection {
  const ctx = getCurrentContext();
  const name = normalizeConnectionName(input.name);
  const existing = listConnections().find((c) => c.name === name);
  if (existing) throw new Error(`Connection name already exists: ${name}`);

  const conn: Connection = {
    id: uuidV4(),
    name,
    title: input.title.trim() || name,
    odooUrl: normalizeOdooUrl(input.odooUrl),
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
  fieldsCsv: string;
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

  const fields = input.fieldsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fields.length === 0) throw new Error("At least one field is required.");

  // Basic validation of domain JSON now (if present).
  parseDomain(input.domain);

  const dsFields: DatasourceField[] = fields.map((f, idx) => ({
    fieldName: f,
    label: f,
    order: idx,
  }));

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
