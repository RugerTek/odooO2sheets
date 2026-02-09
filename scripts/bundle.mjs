import esbuild from "esbuild";
import path from "node:path";

const entry = path.join(process.cwd(), "src", "index.ts");
const outfile = path.join(process.cwd(), "dist", "Code.js");

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: "neutral",
  // Use CommonJS output to avoid an IIFE wrapper. Apps Script's editor detects
  // runnable functions only when they're defined at the top-level.
  // With `bundle: true`, esbuild will inline modules and won't emit `require()`.
  format: "cjs",
  target: ["es2020"],
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});
