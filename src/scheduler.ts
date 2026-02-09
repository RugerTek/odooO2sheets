import { listDatasources, upsertDatasource } from "./storage";
import { refreshDatasourceById } from "./refresh";

const TRIGGER_HANDLER = "runSchedulerTick_";

export function ensureSchedulerTrigger(): void {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some((t) => t.getHandlerFunction() === TRIGGER_HANDLER);
  if (exists) return;
  // Hourly trigger; internally we check per-datasource schedule.
  ScriptApp.newTrigger(TRIGGER_HANDLER).timeBased().everyHours(1).create();
}

function weekdayMon1Sun7(d: Date): number {
  // JS getDay: 0=Sun..6=Sat. We want 1=Mon..7=Sun
  const js = d.getDay();
  if (js === 0) return 7;
  return js;
}

function shouldRunNow(ds: any, now: Date): boolean {
  if (!ds.schedulerEnabled) return false;
  const cfg = ds.schedulerConfig;
  if (!cfg) return false;

  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const wday = weekdayMon1Sun7(now);

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
      ds.lastRun = { status: "ERROR", at: new Date().toISOString(), rows: 0, durationMs: 0, error: msg };
      upsertDatasource(ds);
    }
  }
}
