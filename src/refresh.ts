import { authenticate, callKw } from "./odoo";
import {
  getConnection,
  getCredential,
  getDatasource,
  touchUpdatedAt,
  upsertDatasource,
} from "./storage";
import { writeTable } from "./sheets";
import { baseFieldName, parseDomain, uniqStrings } from "./util";
import { materializeValues } from "./materialize";

export function refreshDatasourceById(
  datasourceId: string,
  opts?: { automated?: boolean }
): { rowsFetched: number } {
  const ds = getDatasource(datasourceId);
  if (!ds) throw new Error("Datasource not found.");

    const started = Date.now();
  try {
    const conn = getConnection(ds.connectionId);
    if (!conn) throw new Error("Connection not found.");
    const scope = conn.shareCredentials ? "DOCUMENT" : "USER";
    const cred = getCredential(conn.id, scope);
    if (!cred) throw new Error("Missing credentials. Please login.");

    const session = authenticate({
      odooUrl: conn.odooUrl,
      db: conn.odooDb,
      username: cred.odooUsername,
      password: cred.secret,
    });
    const companyId = (ds as any).companyId || conn.companyId;
    if (companyId) session.context = { ...(session.context || {}), allowed_company_ids: [companyId] };

    const domain = parseDomain(ds.domain);
    const baseFields = uniqStrings(ds.fields.map((f) => baseFieldName(f.fieldName)).filter(Boolean));

    const result = callKw<Record<string, unknown>[]>(session, {
      model: ds.odooModel,
      method: "search_read",
      args: [domain],
      kwargs: {
        fields: baseFields,
        limit: ds.limit,
        order: ds.orderBy || undefined,
      },
    });

    // Basic runtime guard: Apps Script hard limit is ~6 min, but we preempt at ~5.5 min.
    const elapsed = Date.now() - started;
    if (elapsed > 5.5 * 60 * 1000) {
      throw new Error("Execution time limit exceeded. Add filters (domain) to reduce dataset size.");
    }

    const fields = [...ds.fields].sort((a, b) => a.order - b.order);
    const headers = fields.map((f) => f.label || f.fieldName);
    const fieldSpecs = fields.map((f) => f.fieldName);
    const values = materializeValues({ session, baseModel: ds.odooModel, baseRows: result, fieldSpecs });

    const rowsFetched = writeTable(ds, headers, values);
    const lastRun = {
      status: "OK",
      at: new Date().toISOString(),
      rows: rowsFetched,
      durationMs: Date.now() - started,
    } as const;
    ds.lastRun = lastRun;
    ds.runHistory = [lastRun, ...((ds.runHistory || []) as any[])].slice(0, 10);
    touchUpdatedAt(ds);
    upsertDatasource(ds);
    return { rowsFetched };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lastRun = {
      status: "ERROR",
      at: new Date().toISOString(),
      rows: 0,
      durationMs: Date.now() - started,
      error: msg,
    } as const;
    ds.lastRun = lastRun;
    ds.runHistory = [lastRun, ...((ds.runHistory || []) as any[])].slice(0, 10);
    touchUpdatedAt(ds);
    upsertDatasource(ds);
    throw e;
  } finally {
    void opts;
  }
}
