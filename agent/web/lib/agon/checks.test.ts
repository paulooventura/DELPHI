import { describe, expect, it } from "vitest";
import { autoApprove, certFilesCheck, isPrivateIp, summarize } from "./checks";
import { checkCertFiles } from "./files";

describe("enrollment checks", () => {
  it("never fetches private or local addresses", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "192.168.1.1", "172.20.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("2606:4700::1111")).toBe(false);
  });

  it("every claimed certification needs a file", () => {
    expect(certFilesCheck([], [])).toBe("n/a");
    expect(certFilesCheck(["tips"], ["tips"])).toBe("ok");
    expect(certFilesCheck(["tips", "cpr-aed"], ["tips"])).toBe("fail");
  });

  it("clean only when every check passes", () => {
    const ok = summarize({ email_domain: "ok", phone: "ok", duplicate: "ok", cert_files: "n/a", link: "n/a" });
    expect(ok.clean).toBe(true);
    expect(summarize({ ...ok, link: "unknown" }).clean).toBe(false);
  });

  it("auto-approve is off by default and never for crew with certificates", () => {
    const clean = summarize({ email_domain: "ok", phone: "ok", duplicate: "ok", cert_files: "ok", link: "n/a" });
    expect(autoApprove("role", clean, 0, undefined)).toBe(false);
    expect(autoApprove("role", clean, 0, "role,promoter")).toBe(true);
    expect(autoApprove("role", clean, 2, "role")).toBe(false);
    expect(autoApprove("venue", clean, 0, "role")).toBe(false);
  });

  it("file rules: type, size, claimed only", () => {
    const r = checkCertFiles(
      [
        { cert: "tips", name: "a.pdf", type: "application/pdf", size: 1000 },
        { cert: "cpr-aed", name: "b.exe", type: "application/x-msdownload", size: 1000 },
        { cert: "first-aid", name: "c.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 },
        { cert: "nope", name: "d.png", type: "image/png", size: 10 },
      ],
      ["tips", "cpr-aed", "first-aid"],
    );
    expect(r.ok.map((f) => f.cert)).toEqual(["tips"]);
    expect(r.problems).toEqual([
      { cert: "cpr-aed", problem: "type" },
      { cert: "first-aid", problem: "size" },
    ]);
  });
});
