import { AppStateDoc, Connection, Credential, Datasource } from "./types";
import { nowIso } from "./util";

const DOC_KEY = "o2sheets:doc:v1";
const USER_CRED_PREFIX = "o2sheets:cred:user:v1:";
const DOC_CRED_PREFIX = "o2sheets:cred:doc:v1:";

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

export function touchUpdatedAt<T extends { updatedAt: string }>(obj: T): T {
  obj.updatedAt = nowIso();
  return obj;
}

