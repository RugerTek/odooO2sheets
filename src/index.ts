import {
  api_clearCredential,
  api_createConnection,
  api_createDatasource,
  api_deleteDatasource,
  api_deleteConnection,
  api_applyDraftToDatasource,
  api_clearDraftExtraction,
  api_getCompanies,
  api_getBootstrap,
  api_getDraftExtraction,
  api_getModelFields,
  api_getRunHistory,
  api_duplicateDatasource,
  api_listModules,
  api_listSheets,
  api_previewRows,
  api_refreshDatasource,
  api_renameDatasource,
  api_searchModels,
  api_setConnectionCompany,
  api_setDraftDomain,
  api_setDraftFields,
  api_setDraftModel,
  api_setCredential,
  api_setDatasourceSchedule,
  api_testOdooUrl,
  api_updateDatasource,
  api_updateConnection,
  refreshDatasourceById,
} from "./service";
import { runSchedulerTick_ } from "./scheduler";
import { ui_openColumnsPickerDialog, ui_openFilterBuilderDialog, ui_openHistoryDialog, ui_openModelPickerDialog, ui_openRenameDatasourceDialog, ui_openScheduleDialog } from "./uiDialogs";

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
(globalThis as any).api_getCompanies = api_getCompanies;
(globalThis as any).api_getDraftExtraction = api_getDraftExtraction;
(globalThis as any).api_listSheets = api_listSheets;
(globalThis as any).api_createConnection = api_createConnection;
(globalThis as any).api_updateConnection = api_updateConnection;
(globalThis as any).api_deleteConnection = api_deleteConnection;
(globalThis as any).api_clearCredential = api_clearCredential;
(globalThis as any).api_setConnectionCompany = api_setConnectionCompany;
(globalThis as any).api_setCredential = api_setCredential;
(globalThis as any).api_createDatasource = api_createDatasource;
(globalThis as any).api_refreshDatasource = api_refreshDatasource;
(globalThis as any).api_setDatasourceSchedule = api_setDatasourceSchedule;
(globalThis as any).api_deleteDatasource = api_deleteDatasource;
(globalThis as any).api_updateDatasource = api_updateDatasource;
(globalThis as any).api_duplicateDatasource = api_duplicateDatasource;
(globalThis as any).api_renameDatasource = api_renameDatasource;
(globalThis as any).api_getRunHistory = api_getRunHistory;
(globalThis as any).api_searchModels = api_searchModels;
(globalThis as any).api_getModelFields = api_getModelFields;
(globalThis as any).api_previewRows = api_previewRows;
(globalThis as any).api_listModules = api_listModules;
(globalThis as any).api_testOdooUrl = api_testOdooUrl;
(globalThis as any).api_setDraftModel = api_setDraftModel;
(globalThis as any).api_setDraftFields = api_setDraftFields;
(globalThis as any).api_setDraftDomain = api_setDraftDomain;
(globalThis as any).api_clearDraftExtraction = api_clearDraftExtraction;
(globalThis as any).api_applyDraftToDatasource = api_applyDraftToDatasource;

(globalThis as any).ui_openModelPickerDialog = ui_openModelPickerDialog;
(globalThis as any).ui_openColumnsPickerDialog = ui_openColumnsPickerDialog;
(globalThis as any).ui_openFilterBuilderDialog = ui_openFilterBuilderDialog;
(globalThis as any).ui_openScheduleDialog = ui_openScheduleDialog;
(globalThis as any).ui_openHistoryDialog = ui_openHistoryDialog;
(globalThis as any).ui_openRenameDatasourceDialog = ui_openRenameDatasourceDialog;

(globalThis as any).runSchedulerTick_ = runSchedulerTick_;
