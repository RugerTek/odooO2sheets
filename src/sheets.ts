import { Datasource } from "./types";
import { truncateCell } from "./util";

export function ensureSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");
  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;
  return ss.insertSheet(sheetName);
}

export function writeRows(ds: Datasource, rows: Record<string, unknown>[]): number {
  const sheet = ensureSheet(ds.sheetName);

  const fields = [...ds.fields].sort((a, b) => a.order - b.order);
  const headers = fields.map((f) => f.label || f.fieldName);
  const fieldNames = fields.map((f) => f.fieldName);

  const values: Array<Array<string | number | boolean | null>> = rows.map((r) =>
    fieldNames.map((name) => truncateCell((r as any)[name]) as any)
  );

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

