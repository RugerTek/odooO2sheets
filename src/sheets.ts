import { Datasource } from "./types";

export function ensureSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");
  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;
  return ss.insertSheet(sheetName);
}

export function writeTable(
  ds: Datasource,
  headers: string[],
  values: Array<Array<string | number | boolean | null>>
): number {
  const sheet = ensureSheet(ds.sheetName);

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
