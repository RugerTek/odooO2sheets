import { callKw, OdooSession } from "./odoo";
import { formatOdooValue, truncateCell, uniqStrings } from "./util";

type FieldInfo = { type?: string; relation?: string };
type FieldsMeta = Record<string, FieldInfo>;

function parseSegments(spec: string): string[] {
  return String(spec || "")
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getM2oId(value: unknown): number | null {
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  if (typeof value === "number") return value;
  return null;
}

function getFieldsMeta(session: OdooSession, model: string): FieldsMeta {
  const mapping = callKw<Record<string, any>>(session, {
    model,
    method: "fields_get",
    args: [[], ["type", "relation"]],
    kwargs: {},
  });
  const out: FieldsMeta = {};
  for (const [fieldName, info] of Object.entries(mapping || {})) {
    out[fieldName] = { type: info?.type, relation: info?.relation };
  }
  return out;
}

function readByIds(
  session: OdooSession,
  model: string,
  ids: number[],
  fields: string[]
): Map<number, Record<string, unknown>> {
  const uniqIds = uniqStrings(ids.map((x) => String(x)))
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  if (uniqIds.length === 0) return new Map();

  const uniqFields = uniqStrings(fields.filter(Boolean));
  // "read" always returns id; keep it predictable.
  const rows = callKw<Record<string, unknown>[]>(session, {
    model,
    method: "read",
    args: [uniqIds, uniqFields],
    kwargs: {},
  });
  const m = new Map<number, Record<string, unknown>>();
  for (const r of rows || []) {
    const id = (r as any).id;
    if (typeof id === "number") m.set(id, r);
  }
  return m;
}

export function materializeValues(params: {
  session: OdooSession;
  baseModel: string;
  baseRows: Record<string, unknown>[];
  fieldSpecs: string[];
}): Array<Array<string | number | boolean | null>> {
  const { session, baseModel, baseRows, fieldSpecs } = params;

  const specs = (fieldSpecs || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (specs.length === 0) return [];

  const segs = specs.map(parseSegments);

  // Build metadata and read caches for up to 3 many2one hops (4 segments).
  const baseMeta = getFieldsMeta(session, baseModel);
  const metaByModel = new Map<string, FieldsMeta>();
  metaByModel.set(baseModel, baseMeta);

  const recByModel = new Map<string, Map<number, Record<string, unknown>>>();

  // Level 1 requirements
  const ids1ByModel = new Map<string, Set<number>>();
  const fields1ByModel = new Map<string, Set<string>>();

  for (const s of segs) {
    if (s.length < 2) continue;
    const f0 = s[0];
    const info0 = baseMeta[f0];
    if (!info0 || info0.type !== "many2one" || !info0.relation) continue;
    const model1 = info0.relation;
    if (!ids1ByModel.has(model1)) ids1ByModel.set(model1, new Set());
    if (!fields1ByModel.has(model1)) fields1ByModel.set(model1, new Set());
    fields1ByModel.get(model1)!.add(s[1]); // next field in model1

    for (const r of baseRows) {
      const id1 = getM2oId((r as any)[f0]);
      if (id1) ids1ByModel.get(model1)!.add(id1);
    }
  }

  // Read level 1
  for (const [model1, idsSet] of ids1ByModel.entries()) {
    const fields = Array.from(fields1ByModel.get(model1) || []);
    // Ensure 'id' is available for downstream, even if not requested.
    if (!fields.includes("id")) fields.push("id");
    const recs = readByIds(session, model1, Array.from(idsSet), fields);
    recByModel.set(model1, recs);
    metaByModel.set(model1, getFieldsMeta(session, model1));
  }

  // Level 2 requirements (only if spec has 3+ segments)
  const ids2ByModel = new Map<string, Set<number>>();
  const fields2ByModel = new Map<string, Set<string>>();

  for (const s of segs) {
    if (s.length < 3) continue;
    const f0 = s[0];
    const info0 = baseMeta[f0];
    if (!info0 || info0.type !== "many2one" || !info0.relation) continue;
    const model1 = info0.relation;
    const meta1 = metaByModel.get(model1);
    const recs1 = recByModel.get(model1);
    if (!meta1 || !recs1) continue;
    const f1 = s[1];
    const info1 = meta1[f1];
    if (!info1 || info1.type !== "many2one" || !info1.relation) continue;
    const model2 = info1.relation;

    if (!ids2ByModel.has(model2)) ids2ByModel.set(model2, new Set());
    if (!fields2ByModel.has(model2)) fields2ByModel.set(model2, new Set());
    fields2ByModel.get(model2)!.add(s[2]); // leaf field in model2

    for (const r of baseRows) {
      const id1 = getM2oId((r as any)[f0]);
      if (!id1) continue;
      const r1 = recs1.get(id1);
      if (!r1) continue;
      const id2 = getM2oId((r1 as any)[f1]);
      if (id2) ids2ByModel.get(model2)!.add(id2);
    }
  }

  // Read level 2
  for (const [model2, idsSet] of ids2ByModel.entries()) {
    const fields = Array.from(fields2ByModel.get(model2) || []);
    if (!fields.includes("id")) fields.push("id");
    const recs = readByIds(session, model2, Array.from(idsSet), fields);
    recByModel.set(model2, recs);
    if (!metaByModel.has(model2)) metaByModel.set(model2, getFieldsMeta(session, model2));
  }

  // Level 3 requirements (only if spec has 4+ segments)
  const ids3ByModel = new Map<string, Set<number>>();
  const fields3ByModel = new Map<string, Set<string>>();

  for (const s of segs) {
    if (s.length < 4) continue;
    const f0 = s[0];
    const info0 = baseMeta[f0];
    if (!info0 || info0.type !== "many2one" || !info0.relation) continue;
    const model1 = info0.relation;
    const meta1 = metaByModel.get(model1);
    const recs1 = recByModel.get(model1);
    if (!meta1 || !recs1) continue;
    const f1 = s[1];
    const info1 = meta1[f1];
    if (!info1 || info1.type !== "many2one" || !info1.relation) continue;
    const model2 = info1.relation;
    const meta2 = metaByModel.get(model2);
    const recs2 = recByModel.get(model2);
    if (!meta2 || !recs2) continue;
    const f2 = s[2];
    const info2 = meta2[f2];
    if (!info2 || info2.type !== "many2one" || !info2.relation) continue;
    const model3 = info2.relation;

    if (!ids3ByModel.has(model3)) ids3ByModel.set(model3, new Set());
    if (!fields3ByModel.has(model3)) fields3ByModel.set(model3, new Set());
    fields3ByModel.get(model3)!.add(s[3]); // leaf in model3

    for (const r of baseRows) {
      const id1 = getM2oId((r as any)[f0]);
      if (!id1) continue;
      const r1 = recs1.get(id1);
      if (!r1) continue;
      const id2 = getM2oId((r1 as any)[f1]);
      if (!id2) continue;
      const r2 = recs2.get(id2);
      if (!r2) continue;
      const id3 = getM2oId((r2 as any)[f2]);
      if (id3) ids3ByModel.get(model3)!.add(id3);
    }
  }

  // Read level 3
  for (const [model3, idsSet] of ids3ByModel.entries()) {
    const fields = Array.from(fields3ByModel.get(model3) || []);
    if (!fields.includes("id")) fields.push("id");
    const recs = readByIds(session, model3, Array.from(idsSet), fields);
    recByModel.set(model3, recs);
    if (!metaByModel.has(model3)) metaByModel.set(model3, getFieldsMeta(session, model3));
  }

  function resolveOne(baseRow: Record<string, unknown>, segments: string[]): unknown {
    if (segments.length === 0) return null;
    if (segments.length === 1) return (baseRow as any)[segments[0]];

    const f0 = segments[0];
    const info0 = baseMeta[f0];
    const id1 = getM2oId((baseRow as any)[f0]);
    if (!info0 || info0.type !== "many2one" || !info0.relation || !id1) return null;
    const model1 = info0.relation;
    const r1 = recByModel.get(model1)?.get(id1);
    if (!r1) return null;
    if (segments.length === 2) {
      const f1 = segments[1];
      return f1 === "id" ? id1 : (r1 as any)[f1];
    }

    const meta1 = metaByModel.get(model1);
    const f1 = segments[1];
    const info1 = meta1 ? meta1[f1] : undefined;
    const id2 = getM2oId((r1 as any)[f1]);
    if (!info1 || info1.type !== "many2one" || !info1.relation || !id2) return null;
    const model2 = info1.relation;
    const r2 = recByModel.get(model2)?.get(id2);
    if (!r2) return null;
    if (segments.length === 3) {
      const f2 = segments[2];
      return f2 === "id" ? id2 : (r2 as any)[f2];
    }

    const meta2 = metaByModel.get(model2);
    const f2 = segments[2];
    const info2 = meta2 ? meta2[f2] : undefined;
    const id3 = getM2oId((r2 as any)[f2]);
    if (!info2 || info2.type !== "many2one" || !info2.relation || !id3) return null;
    const model3 = info2.relation;
    const r3 = recByModel.get(model3)?.get(id3);
    if (!r3) return null;
    const f3 = segments[3];
    return f3 === "id" ? id3 : (r3 as any)[f3];
  }

  const values = baseRows.map((r) =>
    segs.map((s) => truncateCell(formatOdooValue(resolveOne(r, s))) as any)
  );
  return values;
}
