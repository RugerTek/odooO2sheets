import { listConnections, listDatasources } from "./storage";
import { nowIso } from "./util";
import { Connection, Datasource } from "./types";

const STATUS_SHEET_NAME = "Odoo O2Sheets - Estado";

function safeGetSpreadsheet(spreadsheetId?: string): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  throw new Error("No active spreadsheet.");
}

function ensureStatusSheet(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): GoogleAppsScript.Spreadsheet.Sheet {
  const existing = ss.getSheetByName(STATUS_SHEET_NAME);
  if (existing) return existing;
  return ss.insertSheet(STATUS_SHEET_NAME);
}

function safeConnTitle(conns: Connection[], connId: string): string {
  const c = conns.find((x) => x.id === connId);
  return c ? c.title || c.name : connId;
}

function fmtIsoLocal(iso: string | undefined): string {
  const s = String(iso || "").trim();
  if (!s) return "";
  try {
    const d = new Date(s);
    if (String(d) === "Invalid Date") return s;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return s;
  }
}

export function updateStatusSheet(spreadsheetId?: string): void {
  const ss = safeGetSpreadsheet(spreadsheetId);
  const conns = listConnections();
  const dss = listDatasources();

  const sheet = ensureStatusSheet(ss);

  // Build rows
  const header = [
    "Extraccion",
    "Hoja",
    "Modelo",
    "Conexion",
    "Empresa",
    "AUTO",
    "Prox. auto",
    "Ultimo estado",
    "Ultima actualizacion",
    "Filas",
    "Duracion (s)",
    "Error",
  ];

  const rows = dss
    .slice()
    .sort((a, b) => {
      const at = (a.title || a.sheetName || "").localeCompare(b.title || b.sheetName || "");
      if (at) return at;
      const as = (a.sheetName || "").localeCompare(b.sheetName || "");
      if (as) return as;
      return (a.odooModel || "").localeCompare(b.odooModel || "");
    })
    .map((ds) => datasourceRow(ds, conns));

  const meta = [
    ["Actualizado:", fmtIsoLocal(nowIso())],
    ["Doc ID:", ss.getId()],
  ];

  // Write
  sheet.clearContents();
  sheet.getRange(1, 1, meta.length, 2).setValues(meta);

  const startRow = meta.length + 2;
  sheet.getRange(startRow, 1, 1, header.length).setValues([header]);
  if (rows.length) {
    sheet.getRange(startRow + 1, 1, rows.length, header.length).setValues(rows);
  }

  // Light formatting (best effort)
  try {
    sheet.setFrozenRows(startRow);
    sheet.getRange(startRow, 1, 1, header.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, Math.min(header.length, 8));
  } catch (_) {}
}

function datasourceRow(ds: Datasource, conns: Connection[]): any[] {
  const title = (ds.title || "").trim() || ds.sheetName;
  const company = ds.companyId ? `ID ${ds.companyId}` : "";
  const auto = ds.schedulerEnabled ? "ON" : "OFF";
  const nextRun = (ds as any).nextRunAt ? fmtIsoLocal(String((ds as any).nextRunAt)) : "";
  const lastStatus = ds.lastRun ? ds.lastRun.status : "";
  const lastAt = ds.lastRun ? fmtIsoLocal(ds.lastRun.at) : "";
  const rows = ds.lastRun ? Number(ds.lastRun.rows || 0) : "";
  const dur = ds.lastRun ? Math.round((Number(ds.lastRun.durationMs || 0) / 1000) * 10) / 10 : "";
  const err = ds.lastRun && ds.lastRun.status === "ERROR" ? String(ds.lastRun.error || "") : "";

  return [
    title,
    ds.sheetName,
    ds.odooModel,
    safeConnTitle(conns, ds.connectionId),
    company,
    auto,
    nextRun,
    lastStatus,
    lastAt,
    rows,
    dur,
    err,
  ];
}

