export function nowIso(): string {
  return new Date().toISOString();
}

export function uuidV4(): string {
  // Apps Script doesn't provide crypto.randomUUID consistently; keep simple UUIDv4.
  const bytes = Utilities.getUuid(); // already UUIDv4 format
  return bytes;
}

export function normalizeOdooUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) throw new Error("Odoo URL must start with http(s)://");
  return u;
}

export function normalizeConnectionName(name: string): string {
  const n = name.trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(n)) {
    throw new Error("Connection Name must be lowercase alphanumeric (a-z0-9), no spaces.");
  }
  return n;
}

export function truncateCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (value.length <= 1000) return value;
    return value.slice(0, 1000);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  // Arrays/objects -> JSON string, truncated.
  const s = JSON.stringify(value);
  return s.length <= 1000 ? s : s.slice(0, 1000);
}

export function formatOdooValue(value: unknown): unknown {
  // Odoo JSON-RPC formats:
  // - many2one: [id, display_name]
  // - x2many: [id, id, ...]
  // This tries to produce what users expect to see in Sheets.
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === "number" && typeof value[1] === "string") return value[1];
    if (value.length > 0 && value.every((x) => typeof x === "number")) return value.join(",");
    if (value.length > 0 && value.every((x) => typeof x === "string")) return value.join(",");
    return value;
  }
  if (typeof value === "object") {
    const v: any = value;
    if (typeof v.display_name === "string") return v.display_name;
    return value;
  }
  return value;
}

export function baseFieldName(fieldSpec: string): string {
  const s = String(fieldSpec || "").trim();
  if (!s) return s;
  const i = s.indexOf(".");
  return i >= 0 ? s.slice(0, i) : s;
}

export function uniqStrings(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items || []) {
    const s = String(it || "");
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function extractFromRecord(record: Record<string, unknown>, fieldSpec: string): unknown {
  const spec = String(fieldSpec || "").trim();
  if (!spec) return null;
  const i = spec.indexOf(".");
  if (i < 0) return (record as any)[spec];
  const base = spec.slice(0, i);
  const sub = spec.slice(i + 1);
  const v = (record as any)[base];

  // Support only the most useful pseudo fields for many2one:
  // - field.name -> display name
  // - field.id -> id
  if (sub === "name" || sub === "display_name") {
    if (Array.isArray(v) && v.length >= 2) return v[1];
    if (v && typeof v === "object" && typeof (v as any).display_name === "string") return (v as any).display_name;
    if (typeof v === "string") return v;
    return v;
  }
  if (sub === "id") {
    if (Array.isArray(v) && v.length >= 1) return v[0];
    if (typeof v === "number") return v;
    return null;
  }
  return v;
}

export function parseDomain(domain?: string): any[] {
  if (!domain) return [];
  const trimmed = domain.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) throw new Error("Domain must be a JSON array (Odoo domain).");
  return parsed;
}
