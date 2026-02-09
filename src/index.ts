import {
  api_createConnection,
  api_createDatasource,
  api_getBootstrap,
  api_getModelFields,
  api_listSheets,
  api_searchModels,
  api_setCredential,
  api_setDatasourceSchedule,
  api_testOdooUrl,
  api_updateConnection,
  refreshDatasourceById,
} from "./service";
import { runSchedulerTick_ } from "./scheduler";

function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu("Odoo O2Sheets")
    .addItem("Open sidebar", "showSidebar")
    .addToUi();
}

function onInstall(): void {
  onOpen();
}

function showSidebar(): void {
  const html = HtmlService.createTemplateFromFile("ui/sidebar")
    .evaluate()
    .setTitle("Odoo O2Sheets");
  SpreadsheetApp.getUi().showSidebar(html);
}

// Expose server functions to global (Apps Script entrypoints).
(globalThis as any).onOpen = onOpen;
(globalThis as any).onInstall = onInstall;
(globalThis as any).showSidebar = showSidebar;

(globalThis as any).api_getBootstrap = api_getBootstrap;
(globalThis as any).api_listSheets = api_listSheets;
(globalThis as any).api_createConnection = api_createConnection;
(globalThis as any).api_updateConnection = api_updateConnection;
(globalThis as any).api_setCredential = api_setCredential;
(globalThis as any).api_createDatasource = api_createDatasource;
(globalThis as any).api_refreshDatasource = refreshDatasourceById;
(globalThis as any).api_setDatasourceSchedule = api_setDatasourceSchedule;
(globalThis as any).api_searchModels = api_searchModels;
(globalThis as any).api_getModelFields = api_getModelFields;
(globalThis as any).api_testOdooUrl = api_testOdooUrl;

(globalThis as any).runSchedulerTick_ = runSchedulerTick_;
