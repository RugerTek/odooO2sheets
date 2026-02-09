import esbuild from "esbuild";
import path from "node:path";

const entry = path.join(process.cwd(), "src", "index.ts");
const outfile = path.join(process.cwd(), "dist", "Code.js");

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: "neutral",
  format: "iife",
  target: ["es2020"],
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});

