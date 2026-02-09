import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Copy manifest into dist root (clasp rootDir will be dist).
copyFile(path.join(root, "appsscript.json"), path.join(distDir, "appsscript.json"));

// Copy UI html files (and any other non-TS assets) from src to dist.
for (const file of walk(srcDir)) {
  if (file.endsWith(".ts")) continue;
  const rel = path.relative(srcDir, file);
  copyFile(file, path.join(distDir, rel));
}
