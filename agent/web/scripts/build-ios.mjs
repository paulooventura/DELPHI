#!/usr/bin/env node
/**
 * Bundled iOS build (T341): the app shell ships inside the app so it opens with no network.
 *
 * Copies the web sources to agent/.ios-build/web (outside this folder), leaves out the server-only
 * parts (app/api, app/admin, middleware), runs `next build` with `output: "export"` there and writes
 * the result to www-ios/. The repo tree and the website build are never changed.
 * `/api/*` keeps living on the site: NEXT_PUBLIC_API_BASE (and window.PM_API_BASE for public/*.js).
 *
 *   npm run build:ios            export + `cap sync ios`
 *   npm run build:ios -- --no-sync
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agent = path.dirname(web);
const scratch = path.join(agent, ".ios-build", "web");
const outDir = path.join(web, "www-ios");
const apiBase = (process.env.CAP_API_BASE || "https://delphi.pauloventura.org").trim().replace(/\/+$/, "");
const sync = !process.argv.includes("--no-sync");

const SKIP_TOP = new Set([
  "node_modules", ".next", ".vercel", "ios", "android", "www", "www-ios", "out", "coverage",
  "middleware.ts", "next.config.ts", "tsconfig.tsbuildinfo", "next-env.d.ts",
]);
const SKIP_REL = new Set([path.join("app", "api"), path.join("app", "admin")]);

function copyTree(from, to, rel = "") {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const r = rel ? path.join(rel, ent.name) : ent.name;
    if (!rel && (SKIP_TOP.has(ent.name) || ent.name.startsWith("node_modules_"))) continue;
    if (SKIP_REL.has(r) || ent.name.endsWith(".bak")) continue;
    if (ent.isSymbolicLink()) continue;
    const src = path.join(from, ent.name);
    const dst = path.join(to, ent.name);
    if (ent.isDirectory()) copyTree(src, dst, r);
    else fs.copyFileSync(src, dst);
  }
}

/** Clears copied sources but never follows or removes the node_modules link. */
function clearScratch() {
  if (!fs.existsSync(scratch)) return;
  for (const ent of fs.readdirSync(scratch, { withFileTypes: true })) {
    if (ent.name === "node_modules") continue;
    fs.rmSync(path.join(scratch, ent.name), { recursive: true, force: true });
  }
}

function linkNodeModules() {
  const link = path.join(scratch, "node_modules");
  try {
    fs.lstatSync(link);
    return;
  } catch {
    /* not linked yet */
  }
  fs.symlinkSync(path.join(web, "node_modules"), link, "junction");
}

/** Turbopack's root must hold both the scratch copy and the real node_modules (it may be a link). */
function turboRoot() {
  const a = path.resolve(agent).split(path.sep);
  const b = fs.realpathSync(path.join(web, "node_modules")).split(path.sep);
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return (a.slice(0, i).join(path.sep) || path.sep).replace(/\\/g, "/");
}

function exportConfig() {
  const root = turboRoot();
  return `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  turbopack: { root: ${JSON.stringify(root)} },
};

export default nextConfig;
`;
}

function stripDynamicExports(file) {
  const src = fs.readFileSync(file, "utf8");
  const next = src.replace(/^export const (dynamic|revalidate|fetchCache)\s*=.*$/gm, "");
  if (next !== src) fs.writeFileSync(file, next);
}

/** The scratch folder is gitignored, which throws off Tailwind's automatic scan; name the sources. */
function pinTailwindSources(file) {
  const src = fs.readFileSync(file, "utf8");
  const pinned = [
    '@import "tailwindcss" source(none);',
    ...["../app", "../components", "../lib", "../hooks", "../public"].map((d) => `@source "${d}";`),
  ].join("\n");
  fs.writeFileSync(file, src.replace(/^@import "tailwindcss";$/m, pinned));
}

function htmlFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) htmlFiles(p, acc);
    else if (ent.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function run(cmd, args, cwd, env) {
  const shell = process.platform === "win32" && cmd !== process.execPath;
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit", shell });
  if (r.status !== 0) {
    console.error(`[build-ios] ${cmd} ${args.join(" ")} failed (${r.status})`);
    process.exit(r.status ?? 1);
  }
}

run(process.execPath, [path.join("scripts", "build-sat-worker.mjs")], web, {});
console.log(`[build-ios] scratch ${scratch}`);
fs.mkdirSync(scratch, { recursive: true });
clearScratch();
copyTree(web, scratch);
linkNodeModules();
fs.writeFileSync(path.join(scratch, "next.config.ts"), exportConfig());
stripDynamicExports(path.join(scratch, "app", "layout.tsx"));
pinTailwindSources(path.join(scratch, "app", "globals.css"));

run(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "build"], scratch, {
  NEXT_PUBLIC_API_BASE: apiBase,
  NEXT_TELEMETRY_DISABLED: "1",
});

fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(path.join(scratch, "out"), outDir, { recursive: true });

const inject = `<script>window.PM_API_BASE=${JSON.stringify(apiBase)};</script>`;
for (const f of htmlFiles(outDir)) {
  const html = fs.readFileSync(f, "utf8");
  if (html.includes("window.PM_API_BASE=")) continue;
  fs.writeFileSync(f, html.replace(/<head([^>]*)>/i, `<head$1>${inject}`));
}
for (const name of ["offline.html", "astronomy.browser.min.js"]) {
  fs.copyFileSync(path.join(web, "www", name), path.join(outDir, name));
}

const bytes = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    const p = path.join(dir, e.name);
    return n + (e.isDirectory() ? bytes(p) : fs.statSync(p).size);
  }, 0);
console.log(`[build-ios] www-ios ready: ${(bytes(outDir) / 1048576).toFixed(1)} MB, API ${apiBase}`);

if (sync) run("npx", ["cap", "sync", "ios"], web, {});
