#!/usr/bin/env node
/**
 * Open-source notices for the Credits screen.
 *   lib/credits/notices.json  every production package that reaches users (web bundle + iOS shell),
 *   with its licence text from node_modules.
 * Platform-only binaries (lockfile entries with os/cpu) never leave the build or the server, so they
 * are skipped. @capacitor/ios is a devDependency here but its Swift code ships inside the IPA.
 * Usage: node scripts/gen-notices.mjs   (re-run after dependency changes; a test checks it)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
const SHIPPED_DEV = new Set(["node_modules/@capacitor/ios"]);
const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

function licenceText(dir) {
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir).filter((f) => LICENCE_FILE.test(f)).sort();
  return files.map((f) => readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n").trim()).join("\n\n");
}

function repoUrl(pkg) {
  const r = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  if (!r) return pkg.homepage || "";
  return r.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://").replace(/^ssh:\/\/git@/, "https://").replace(/^github:/, "https://github.com/");
}

/** Packages that ship no LICENSE file still carry the MIT terms; reproduce them with the author's name. */
function mitText(pkg) {
  const who = typeof pkg.author === "string" ? pkg.author : pkg.author?.name || `the ${pkg.name} authors`;
  return `MIT License\n\nCopyright (c) ${who.replace(/\s*<[^>]*>|\s*\([^)]*\)/g, "")}\n\n` +
    "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\n" +
    "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\n" +
    "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.";
}

const seen = new Set();
const out = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.os || entry.cpu) continue;
  if (entry.dev && !SHIPPED_DEV.has(path)) continue;
  const dir = join(ROOT, path);
  const pkgFile = join(dir, "package.json");
  if (!existsSync(pkgFile)) continue;
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const license = entry.license || pkg.license || "see text";
  out.push({
    name: pkg.name,
    version: pkg.version,
    license,
    url: repoUrl(pkg),
    text: licenceText(dir) || (license === "MIT" ? mitText(pkg) : ""),
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));

const file = join(ROOT, "lib", "credits", "notices.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
const missing = out.filter((p) => !p.text).map((p) => p.name);
console.log(`${out.length} packages -> lib/credits/notices.json (${missing.length} without a licence file${missing.length ? ": " + missing.join(", ") : ""})`);
