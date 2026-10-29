import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import notices from "./notices.json";

const ROOT = join(__dirname, "..", "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };

function installed(name: string): string {
  return JSON.parse(readFileSync(join(ROOT, "node_modules", name, "package.json"), "utf8")).version;
}

describe("open-source notices", () => {
  it("lists every shipped dependency at its installed version (re-run scripts/gen-notices.mjs)", () => {
    for (const name of [...Object.keys(pkg.dependencies), "@capacitor/ios"]) {
      const row = notices.find((n) => n.name === name);
      expect(row, name).toBeTruthy();
      expect(row!.version, name).toBe(installed(name));
    }
  });

  it("carries licence text for every package and no GPL-family code", () => {
    for (const n of notices) {
      expect(n.text.length, n.name).toBeGreaterThan(100);
      expect(n.license, n.name).not.toMatch(/GPL/);
    }
  });
});
