export type UUID = string;

export type ConnectionId = UUID;
export type DatasourceId = UUID;

export type WriteMode = "REPLACE" | "APPEND";

export interface Connection {
  id: ConnectionId;
  name: string; // immutable slug
  title: string;
  odooUrl: string;
  odooDb: string;
  storeConnections: boolean;
  shareCredentials: boolean;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface Credential {
  connectionId: ConnectionId;
  scope: "USER" | "DOCUMENT";
  odooUsername: string;
  secret: string; // placeholder: encrypted later
  updatedAt: string; // ISO
}

export interface DatasourceField {
  fieldName: string;
  label: string;
  type?: string;
  order: number;
}

export interface SchedulerConfig {
  timezone: string;
  hours: number[]; // 0..23
  daysOfMonth: number[]; // 1..31
  weekdays: number[]; // 1..7 (Mon..Sun)
  months: number[]; // 1..12
}

export interface LastRun {
  status: "OK" | "ERROR";
  at: string; // ISO
  rows: number;
  durationMs: number;
  error?: string;
}

export interface Datasource {
  id: DatasourceId;
  documentId: string; // SpreadsheetApp.getActive().getId()
  sheetName: string;
  connectionId: ConnectionId;
  odooModel: string;
  fields: DatasourceField[];
  domain?: string; // JSON string for now
  orderBy?: string;
  limit: number;
  writeMode: WriteMode;
  header: boolean;
  schedulerEnabled: boolean;
  schedulerConfig?: SchedulerConfig;
  lastRun?: LastRun;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface AppStateDoc {
  connections: Connection[];
  datasources: Datasource[];
  version: 1;
}

export interface DraftExtraction {
  updatedAt: string; // ISO
  connectionId?: ConnectionId;
  model?: string;
  modelName?: string;
  fields?: DatasourceField[];
}
