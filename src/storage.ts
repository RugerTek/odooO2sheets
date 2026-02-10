import { AppStateDoc, Connection, Credential, Datasource, DatasourceField, DraftExtraction } from "./types";
import { nowIso } from "./util";

const DOC_KEY = "o2sheets:doc:v1";
const USER_CRED_PREFIX = "o2sheets:cred:user:v1:";
const DOC_CRED_PREFIX = "o2sheets:cred:doc:v1:";
const EPHEMERAL_CRED_PREFIX = "o2sheets:cred:tmp:v1:";
const EPHEMERAL_TTL_SEC = 30 * 60;
const USER_DRAFT_KEY = "o2sheets:draft:user:v1";

function getActiveSpreadsheetId(): string {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");
  return ss.getId();
}

function getUserEmail(): string {
  // Might be empty in some contexts depending on domain policies.
  return Session.getActiveUser().getEmail() || "unknown";
}

export function loadDocState(): AppStateDoc {
  const props = PropertiesService.getDocumentProperties();
  const raw = props.getProperty(DOC_KEY);
  if (!raw) return { version: 1, connections: [], datasources: [] };
  const parsed = JSON.parse(raw) as AppStateDoc;
  if (parsed.version !== 1) throw new Error("Unsupported doc state version.");
  // Basic normalization.
  parsed.connections ||= [];
  parsed.datasources ||= [];
  // Normalize optional fields so UI can assume presence.
  parsed.connections = parsed.connections.map((c: any) => ({
    ...c,
    storeConnections: Boolean(c.storeConnections),
    shareCredentials: Boolean(c.shareCredentials),
    companyId: c.companyId === undefined || c.companyId === null ? undefined : Number(c.companyId),
  }));
  parsed.datasources = parsed.datasources.map((d: any) => ({
    ...d,
    header: Boolean(d.header),
    schedulerEnabled: Boolean(d.schedulerEnabled),
    companyId: d.companyId === undefined || d.companyId === null ? undefined : Number(d.companyId),
    runHistory: Array.isArray(d.runHistory) ? d.runHistory : [],
  }));
  return parsed;
}

export function saveDocState(state: AppStateDoc): void {
  const props = PropertiesService.getDocumentProperties();
  props.setProperty(DOC_KEY, JSON.stringify(state));
}

export function listConnections(): Connection[] {
  return loadDocState().connections;
}

export function upsertConnection(conn: Connection): void {
  const state = loadDocState();
  const idx = state.connections.findIndex((c) => c.id === conn.id);
  if (idx >= 0) state.connections[idx] = conn;
  else state.connections.push(conn);
  saveDocState(state);
}

export function deleteConnection(connectionId: string): void {
  const state = loadDocState();
  state.connections = state.connections.filter((c) => c.id !== connectionId);
  // Also remove datasources referencing it.
  state.datasources = state.datasources.filter((d) => d.connectionId !== connectionId);
  saveDocState(state);
}

export function listDatasources(): Datasource[] {
  return loadDocState().datasources;
}

export function upsertDatasource(ds: Datasource): void {
  const state = loadDocState();
  const idx = state.datasources.findIndex((d) => d.id === ds.id);
  if (idx >= 0) state.datasources[idx] = ds;
  else state.datasources.push(ds);
  saveDocState(state);
}

export function deleteDatasource(datasourceId: string): void {
  const state = loadDocState();
  state.datasources = state.datasources.filter((d) => d.id !== datasourceId);
  saveDocState(state);
}

export function getDatasource(id: string): Datasource | undefined {
  return loadDocState().datasources.find((d) => d.id === id);
}

export function getConnection(id: string): Connection | undefined {
  return loadDocState().connections.find((c) => c.id === id);
}

export function getCurrentContext(): { spreadsheetId: string; userEmail: string } {
  return { spreadsheetId: getActiveSpreadsheetId(), userEmail: getUserEmail() };
}

export function saveCredential(cred: Credential): void {
  const keyPrefix = cred.scope === "DOCUMENT" ? DOC_CRED_PREFIX : USER_CRED_PREFIX;
  const key = `${keyPrefix}${cred.connectionId}`;
  const props =
    cred.scope === "DOCUMENT"
      ? PropertiesService.getDocumentProperties()
      : PropertiesService.getUserProperties();
  props.setProperty(key, JSON.stringify(cred));
}

export function getCredential(
  connectionId: string,
  scope: "USER" | "DOCUMENT"
): Credential | undefined {
  const keyPrefix = scope === "DOCUMENT" ? DOC_CRED_PREFIX : USER_CRED_PREFIX;
  const key = `${keyPrefix}${connectionId}`;
  const props =
    scope === "DOCUMENT"
      ? PropertiesService.getDocumentProperties()
      : PropertiesService.getUserProperties();
  const raw = props.getProperty(key);
  if (!raw) return undefined;
  return JSON.parse(raw) as Credential;
}

export function deleteCredential(connectionId: string, scope: "USER" | "DOCUMENT"): void {
  const keyPrefix = scope === "DOCUMENT" ? DOC_CRED_PREFIX : USER_CRED_PREFIX;
  const key = `${keyPrefix}${connectionId}`;
  const props =
    scope === "DOCUMENT"
      ? PropertiesService.getDocumentProperties()
      : PropertiesService.getUserProperties();
  props.deleteProperty(key);
}

export function saveEphemeralCredential(input: {
  connectionId: string;
  odooUsername: string;
  secret: string;
}): void {
  const cache = CacheService.getUserCache();
  const key = `${EPHEMERAL_CRED_PREFIX}${input.connectionId}`;
  cache.put(key, JSON.stringify({ u: input.odooUsername, s: input.secret }), EPHEMERAL_TTL_SEC);
}

export function getEphemeralCredential(connectionId: string): { odooUsername: string; secret: string } | undefined {
  const cache = CacheService.getUserCache();
  const key = `${EPHEMERAL_CRED_PREFIX}${connectionId}`;
  const raw = cache.get(key);
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as { u: string; s: string };
  return { odooUsername: parsed.u, secret: parsed.s };
}

export function touchUpdatedAt<T extends { updatedAt: string }>(obj: T): T {
  obj.updatedAt = nowIso();
  return obj;
}

export function getDraftExtraction(): DraftExtraction {
  const props = PropertiesService.getUserProperties();
  const raw = props.getProperty(USER_DRAFT_KEY);
  if (!raw) return { updatedAt: "", fields: [] };
  try {
    const parsed = JSON.parse(raw) as DraftExtraction;
    parsed.updatedAt ||= "";
    parsed.fields ||= [];
    if (typeof (parsed as any).domain !== "string") (parsed as any).domain = "";
    return parsed;
  } catch {
    return { updatedAt: "", fields: [] };
  }
}

export function setDraftExtraction(patch: Partial<DraftExtraction>): DraftExtraction {
  const prev = getDraftExtraction();
  const next: DraftExtraction = {
    updatedAt: nowIso(),
    connectionId: patch.connectionId ?? prev.connectionId,
    model: patch.model ?? prev.model,
    modelName: patch.modelName ?? prev.modelName,
    fields: (patch.fields as DatasourceField[] | undefined) ?? prev.fields ?? [],
    domain: typeof patch.domain === "string" ? patch.domain : prev.domain,
  };
  const props = PropertiesService.getUserProperties();
  props.setProperty(USER_DRAFT_KEY, JSON.stringify(next));
  return next;
}

export function clearDraftExtraction(): void {
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(USER_DRAFT_KEY);
}
