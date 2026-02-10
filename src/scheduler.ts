import { listDatasources, upsertDatasource } from "./storage";
import { refreshDatasourceById } from "./refresh";

const TRIGGER_HANDLER = "runSchedulerTick_";

export function ensureSchedulerTrigger(): void {
  let triggers: GoogleAppsScript.Script.Trigger[] = [];
  try {
    triggers = ScriptApp.getProjectTriggers();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Common: missing script.scriptapp scope until the user re-authorizes after a manifest update.
    if (msg.includes("Specified permissions are not sufficient") || msg.includes("script.scriptapp")) {
      throw new Error(
        "No tengo permisos para gestionar triggers (timer). " +
          "Solucion: en el editor de Apps Script, ejecuta una funcion (por ejemplo showSidebar) y acepta los permisos. " +
          "Luego volve a activar el timer."
      );
    }
    throw new Error(`Error leyendo triggers del proyecto: ${msg}`);
  }

  const exists = triggers.some((t) => t.getHandlerFunction() === TRIGGER_HANDLER);
  if (exists) return;

  try {
    // Hourly trigger; internally we check per-datasource schedule.
    ScriptApp.newTrigger(TRIGGER_HANDLER).timeBased().everyHours(1).create();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No pude crear el trigger (timer). Detalle: ${msg}`);
  }
}

function nowPartsInTz(now: Date, timezone: string): { hour: number; day: number; month: number; wday: number } {
  // Use Apps Script / Java date formatting to compute time in the desired timezone.
  // u: day number 1..7 (Mon..Sun)
  const hour = Number(Utilities.formatDate(now, timezone, "H"));
  const day = Number(Utilities.formatDate(now, timezone, "d"));
  const month = Number(Utilities.formatDate(now, timezone, "M"));
  const wday = Number(Utilities.formatDate(now, timezone, "u"));
  return { hour, day, month, wday };
}

function shouldRunNow(ds: any, now: Date): boolean {
  if (!ds.schedulerEnabled) return false;
  const cfg = ds.schedulerConfig;
  if (!cfg) return false;

  const tz = String(cfg.timezone || Session.getScriptTimeZone() || "UTC");
  const { hour, day, month, wday } = nowPartsInTz(now, tz);

  if (Array.isArray(cfg.hours) && cfg.hours.length > 0 && !cfg.hours.includes(hour)) return false;
  if (Array.isArray(cfg.daysOfMonth) && cfg.daysOfMonth.length > 0 && !cfg.daysOfMonth.includes(day)) return false;
  if (Array.isArray(cfg.months) && cfg.months.length > 0 && !cfg.months.includes(month)) return false;
  if (Array.isArray(cfg.weekdays) && cfg.weekdays.length > 0 && !cfg.weekdays.includes(wday)) return false;

  return true;
}

// Apps Script trigger entrypoint.
export function runSchedulerTick_(): void {
  const datasources = listDatasources();
  const now = new Date();

  for (const ds of datasources) {
    try {
      if (!shouldRunNow(ds as any, now)) continue;
      refreshDatasourceById(ds.id, { automated: true });
    } catch (e) {
      // Best effort: keep ticking other datasources.
      const msg = e instanceof Error ? e.message : String(e);
      const lastRun = { status: "ERROR", at: new Date().toISOString(), rows: 0, durationMs: 0, error: msg } as const;
      (ds as any).lastRun = lastRun;
      (ds as any).runHistory = [lastRun, ...(((ds as any).runHistory || []) as any[])].slice(0, 10);
      upsertDatasource(ds);
    }
  }
}
