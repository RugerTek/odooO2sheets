import { authenticate, callKw } from "./odoo";
import {
  getConnection,
  getCredential,
  getDatasource,
  getEphemeralCredential,
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
    const tmp = cred ? undefined : getEphemeralCredential(conn.id);
    if (!cred && !tmp) throw new Error("Missing credentials. Please login (and optionally remember credentials).");

    const session = authenticate({
      odooUrl: conn.odooUrl,
      db: conn.odooDb,
      username: cred ? cred.odooUsername : tmp!.odooUsername,
      password: cred ? cred.secret : tmp!.secret,
    });

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
    ds.lastRun = {
      status: "OK",
      at: new Date().toISOString(),
      rows: rowsFetched,
      durationMs: Date.now() - started,
    };
    touchUpdatedAt(ds);
    upsertDatasource(ds);
    return { rowsFetched };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ds.lastRun = {
      status: "ERROR",
      at: new Date().toISOString(),
      rows: 0,
      durationMs: Date.now() - started,
      error: msg,
    };
    touchUpdatedAt(ds);
    upsertDatasource(ds);
    throw e;
  } finally {
    void opts;
  }
}
