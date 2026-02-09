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

export function parseDomain(domain?: string): any[] {
  if (!domain) return [];
  const trimmed = domain.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) throw new Error("Domain must be a JSON array (Odoo domain).");
  return parsed;
}

