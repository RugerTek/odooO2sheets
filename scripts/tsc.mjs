import { spawnSync } from "node:child_process";
import path from "node:path";

const tscJs = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc");

const res = spawnSync(process.execPath, [tscJs, "-p", "tsconfig.json", "--noEmit"], {
  stdio: "inherit",
});

process.exit(res.status ?? 1);
