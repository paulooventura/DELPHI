#!/usr/bin/env node
/**
 * Compiles components/onyx/satWorker.ts to public/orrery/sat-worker.js (one classic-worker file).
 * Turbopack ships `new Worker(new URL("./x.ts"))` targets as raw TypeScript, which browsers can't run.
 * Also bundles lib/portalBundle.ts to public/pm-portal.js for the portal pages (Agon, Mouseion, Adyton): the app's
 * own ticks, bells and NOW-Chord (the time sound in every chamber) and the Pythia's answer at the Adyton tripod.
 * Runs before `npm run dev`, `npm run build` and `npm run build:ios`.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(web, "components", "onyx", "satWorker.ts")],
  outfile: path.join(web, "public", "orrery", "sat-worker.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  logLevel: "warning",
});
console.log("[sat-worker] public/orrery/sat-worker.js");

await build({
  entryPoints: [path.join(web, "lib", "portalBundle.ts")],
  outfile: path.join(web, "public", "pm-portal.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  logLevel: "warning",
});
console.log("[portal] public/pm-portal.js");
