import {
  getConnection,
  getCredential,
  getCurrentContext,
  getDatasource,
  getDraftExtraction,
  getEphemeralCredential,
  listConnections,
  listDatasources,
  setDraftExtraction,
  clearDraftExtraction,
  saveCredential,
  saveEphemeralCredential,
  touchUpdatedAt,
  upsertConnection,
  upsertDatasource,
} from "./storage";
import { authenticate, canUseAdvanced, callKw, getVersionInfo, OdooSession } from "./odoo";
import { Connection, Credential, Datasource, DatasourceField, DraftExtraction, SchedulerConfig } from "./types";
import { baseFieldName, normalizeConnectionName, normalizeOdooUrl, nowIso, parseDomain, uniqStrings, uuidV4 } from "./util";
import { ensureSchedulerTrigger } from "./scheduler";
import { refreshDatasourceById } from "./refresh";
import { materializeValues } from "./materialize";

export function api_getBootstrap(): {
  context: { spreadsheetId: string; userEmail: string };
  connections: Connection[];
  datasources: Datasource[];
  draft: DraftExtraction;
} {
  return {
    context: getCurrentContext(),
    connections: listConnections(),
    datasources: listDatasources(),
    draft: getDraftExtraction(),
  };
}

export function api_getDraftExtraction(): DraftExtraction {
  return getDraftExtraction();
}

export function api_setDraftModel(input: {
  connectionId: string;
  model: string;
  modelName?: string;
}): DraftExtraction {
  const model = input.model.trim();
  if (!model) throw new Error("Model is required.");
  return setDraftExtraction({
    connectionId: input.connectionId,
    model,
    modelName: (input.modelName || "").trim() || model,
    fields: [],
  });
}

export function api_setDraftFields(input: {
  connectionId: string;
  model: string;
  fields: Array<{ fieldName: string; label?: string; order: number; type?: string }>;
}): DraftExtraction {
  const model = input.model.trim();
  if (!model) throw new Error("Model is required.");
  const fields = (input.fields || [])
    .filter((f) => f && f.fieldName)
    .map((f) => ({
      fieldName: String(f.fieldName),
      label: (f.label && String(f.label)) || String(f.fieldName),
      order: Number.isFinite(f.order as any) ? Number(f.order) : 0,
      type: f.type ? String(f.type) : undefined,
    }))
    .sort((a, b) => a.order - b.order);
  return setDraftExtraction({
    connectionId: input.connectionId,
    model,
    fields,
  });
}

export function api_clearDraftExtraction(): { ok: true } {
  clearDraftExtraction();
  return { ok: true };
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
  // Basic reachability check early so the user gets feedback at "Save connection" time.
  const reachable = getVersionInfo(odooUrl);
  if (!reachable?.ok) throw new Error(reachable?.hint || "Odoo URL not reachable. Check the URL.");
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
  module?: string;
  limit?: number;
}): Array<{ model: string; name: string; modules?: string }> {
  const session = getSessionForConnection(input.connectionId);
  const q = (input.query || "").trim();
  const mod = (input.module || "").trim();
  if (!q && !mod) return [];

  const limit = Math.max(1, Math.min(50, Number(input.limit) || 20));

  // Use ir.model to search by technical model or display name.
  let domain: any[] = [];
  if (q && mod) domain = ["&", ["modules", "ilike", mod], "|", ["model", "ilike", q], ["name", "ilike", q]];
  else if (mod) domain = [["modules", "ilike", mod]];
  else domain = ["|", ["model", "ilike", q], ["name", "ilike", q]];
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

export function api_listModules(input: { connectionId: string; limit?: number }): Array<{ name: string; title: string; category?: string }> {
  const session = getSessionForConnection(input.connectionId);
  const limit = Math.max(1, Math.min(120, Number(input.limit) || 80));

  const rows = callKw<Array<{ name: string; shortdesc?: string; category_id?: any }>>(session, {
    model: "ir.module.module",
    method: "search_read",
    args: [[["state", "=", "installed"]]],
    kwargs: { fields: ["name", "shortdesc", "category_id"], limit, order: "shortdesc asc" },
  });

  const out = rows
    .filter((r) => r && typeof r.name === "string")
    .map((r) => ({
      name: r.name,
      title: (r as any).shortdesc || r.name,
      category: Array.isArray((r as any).category_id) ? String((r as any).category_id[1] || "") : undefined,
    }));
  return out;
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

export function api_previewRows(input: {
  connectionId: string;
  model: string;
  fields: string[];
  domain?: string;
  orderBy?: string;
  limit?: number;
}): { fields: string[]; rows: Array<Array<string | number | boolean | null>> } {
  const session = getSessionForConnection(input.connectionId);
  const model = input.model.trim();
  if (!model) throw new Error("Model is required.");
  const fields = (input.fields || []).map((f) => String(f || "").trim()).filter(Boolean);
  if (fields.length === 0) throw new Error("At least one field is required for preview.");

  const domain = parseDomain(input.domain);
  const limit = Math.max(1, Math.min(20, Number(input.limit) || 5));
  const safeSpecs = fields.slice(0, 12);
  const baseFields = uniqStrings(safeSpecs.map((f) => baseFieldName(f)).filter(Boolean));

  const result = callKw<Record<string, unknown>[]>(session, {
    model,
    method: "search_read",
    args: [domain],
    kwargs: {
      fields: baseFields,
      limit,
      order: input.orderBy?.trim() || undefined,
    },
  });

  const values = materializeValues({ session, baseModel: model, baseRows: result, fieldSpecs: safeSpecs });
  return { fields: safeSpecs, rows: values };
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
