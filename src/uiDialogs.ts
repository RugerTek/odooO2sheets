import { getConnection, getDatasource, getDraftExtraction } from "./storage";

function makeTemplate(file: string, title: string, initial: Record<string, unknown>): GoogleAppsScript.HTML.HtmlOutput {
  const tpl = HtmlService.createTemplateFromFile(file);
  // Pass initial JSON as a string to avoid template escaping issues.
  (tpl as any).initialJson = JSON.stringify(initial || {});
  return tpl.evaluate().setTitle(title).setWidth(920).setHeight(640);
}

export function ui_openModelPickerDialog(connectionId: string, companyId?: number): void {
  const conn = getConnection(connectionId);
  if (!conn) throw new Error("Connection not found.");
  const html = makeTemplate("ui/modelPicker", "Seleccionar tabla", {
    connectionId: conn.id,
    connectionTitle: conn.title,
    companyId: companyId === undefined || companyId === null ? undefined : Number(companyId),
  });
  SpreadsheetApp.getUi().showModalDialog(html, "Seleccionar tabla");
}

export function ui_openColumnsPickerDialog(connectionId: string, model: string, companyId?: number): void {
  const conn = getConnection(connectionId);
  if (!conn) throw new Error("Connection not found.");
  const m = (model || "").trim();
  if (!m) throw new Error("Model is required.");
  const draft = getDraftExtraction();
  const html = makeTemplate("ui/columnsPicker", "Seleccionar columnas", {
    connectionId: conn.id,
    connectionTitle: conn.title,
    companyId: companyId === undefined || companyId === null ? undefined : Number(companyId),
    model: m,
    modelName: draft.model === m ? draft.modelName || m : m,
    selectedFields: draft.model === m ? (draft.fields || []) : [],
  });
  SpreadsheetApp.getUi().showModalDialog(html, "Seleccionar columnas");
}

export function ui_openScheduleDialog(datasourceId: string): void {
  const ds = getDatasource(datasourceId);
  if (!ds) throw new Error("Datasource not found.");
  const conn = getConnection(ds.connectionId);
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "UTC";
  const html = makeTemplate("ui/schedulePicker", "Timer", {
    datasourceId: ds.id,
    sheetName: ds.sheetName,
    model: ds.odooModel,
    connectionTitle: conn ? conn.title : ds.connectionId,
    enabled: Boolean(ds.schedulerEnabled),
    config: ds.schedulerConfig || {
      timezone: tz,
      hours: [9],
      weekdays: [],
      daysOfMonth: [],
      months: [],
    },
    defaultTimezone: tz,
  });
  SpreadsheetApp.getUi().showModalDialog(html, "Timer");
}

export function ui_openHistoryDialog(datasourceId: string): void {
  const ds = getDatasource(datasourceId);
  if (!ds) throw new Error("Datasource not found.");
  const conn = getConnection(ds.connectionId);
  const html = makeTemplate("ui/runHistory", "Historial", {
    datasourceId: ds.id,
    title: ds.title || "",
    sheetName: ds.sheetName,
    model: ds.odooModel,
    connectionTitle: conn ? conn.title : ds.connectionId,
  });
  SpreadsheetApp.getUi().showModalDialog(html, "Historial");
}
