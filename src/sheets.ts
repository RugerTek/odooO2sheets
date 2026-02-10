import { Datasource } from "./types";

function ensureSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");
  return ss;
}

function findSheetById(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetId: number
): GoogleAppsScript.Spreadsheet.Sheet | undefined {
  const id = Number(sheetId);
  if (!Number.isFinite(id)) return undefined;
  const sheets = ss.getSheets();
  for (const s of sheets) {
    try {
      if (s.getSheetId() === id) return s;
    } catch (_) {}
  }
  return undefined;
}

export function ensureSheetForDatasource(ds: Datasource): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = ensureSpreadsheet();

  // 1) Prefer sheetId (stable across renames).
  if (typeof (ds as any).sheetId === "number") {
    const byId = findSheetById(ss, (ds as any).sheetId);
    if (byId) {
      // Keep name in sync after user renames the tab.
      ds.sheetName = byId.getName();
      ds.sheetId = byId.getSheetId();
      return byId;
    }
  }

  // 2) Fallback to name.
  const sheetName = String(ds.sheetName || "").trim();
  if (!sheetName) throw new Error("Sheet name is required.");
  const byName = ss.getSheetByName(sheetName);
  if (byName) {
    ds.sheetId = byName.getSheetId();
    return byName;
  }

  // 3) Create if missing.
  const created = ss.insertSheet(sheetName);
  ds.sheetId = created.getSheetId();
  return created;
}

export function writeTable(
  ds: Datasource,
  headers: string[],
  values: Array<Array<string | number | boolean | null>>
): number {
  const sheet = ensureSheetForDatasource(ds);

  const startRow = ds.writeMode === "APPEND" ? sheet.getLastRow() + 1 : 1;

  if (ds.writeMode === "REPLACE") {
    sheet.clearContents();
  }

  let rowCursor = startRow;
  if (ds.header) {
    sheet.getRange(rowCursor, 1, 1, headers.length).setValues([headers]);
    rowCursor += 1;
  }
  if (values.length > 0) {
    sheet.getRange(rowCursor, 1, values.length, headers.length).setValues(values);
  }

  return values.length;
}
