/**
 * Semi-automatic enrollment review (Paulo 2026-11-11): every enrollment gets a few quick checks
 * before it reaches the /admin queue, so approving is one look and one tap, not reading every file.
 * Server only (DNS + one outbound request). Each check is time-boxed; a check that can't decide
 * says "unknown" and never blocks the enrollment.
 */
import dns from "node:dns/promises";
import net from "node:net";
import { isPhone } from "./enroll";

export type CheckState = "ok" | "warn" | "fail" | "unknown" | "n/a";
export type EnrollChecks = {
  email_domain: CheckState;
  phone: CheckState;
  duplicate: CheckState;
  cert_files: CheckState;
  link: CheckState;
  /** Every check is ok or n/a. */
  clean: boolean;
};

const TIMEOUT_MS = 2500;

function within<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

/** Loopback, private, link-local, CGNAT, multicast and reserved ranges: never fetched. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return true;
}

export async function emailDomainCheck(email: string): Promise<CheckState> {
  const domain = email.split("@")[1];
  if (!domain) return "fail";
  try {
    const mx = await within(dns.resolveMx(domain));
    if (mx.length) return "ok";
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND") return "fail";
    if (code !== "ENODATA") return "unknown";
  }
  // No MX record: mail can still go to the domain's own address.
  try {
    const a = await within(dns.lookup(domain, { all: true }));
    return a.length ? "ok" : "fail";
  } catch (e) {
    return (e as { code?: string }).code === "ENOTFOUND" ? "fail" : "unknown";
  }
}

/** One GET, no redirects followed, public addresses only. Sites that block robots read as unknown. */
export async function linkCheck(link: string): Promise<CheckState> {
  if (!link) return "n/a";
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return "fail";
  }
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) return "warn";
  try {
    const addrs = await within(dns.lookup(u.hostname, { all: true }));
    if (!addrs.length) return "fail";
    if (addrs.some((a) => isPrivateIp(a.address))) return "fail";
  } catch (e) {
    return (e as { code?: string }).code === "ENOTFOUND" ? "fail" : "unknown";
  }
  try {
    const res = await fetch(u, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "PneumaMundi-AgonCheck/1.0" },
    });
    res.body?.cancel().catch(() => {});
    if (res.status < 400) return "ok";
    if (res.status === 404 || res.status === 410) return "fail";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function certFilesCheck(claimed: string[], uploaded: string[]): CheckState {
  if (!claimed.length) return "n/a";
  return claimed.every((c) => uploaded.includes(c)) ? "ok" : "fail";
}

export function summarize(c: Omit<EnrollChecks, "clean">): EnrollChecks {
  const clean = Object.values(c).every((v) => v === "ok" || v === "n/a");
  return { ...c, clean };
}

export async function runChecks(input: {
  email: string;
  phone: string;
  link: string;
  duplicates: number | null;
  claimedCerts: string[];
  uploadedCerts: string[];
}): Promise<EnrollChecks> {
  const [email_domain, link] = await Promise.all([emailDomainCheck(input.email), linkCheck(input.link)]);
  return summarize({
    email_domain,
    phone: isPhone(input.phone) ? "ok" : "fail",
    duplicate: input.duplicates == null ? "unknown" : input.duplicates > 0 ? "warn" : "ok",
    cert_files: certFilesCheck(input.claimedCerts, input.uploadedCerts),
    link,
  });
}

/**
 * Auto-approve is off unless Paulo turns it on: AGON_AUTO_APPROVE="role,promoter" lists the kinds
 * whose clean enrollments go straight to the directory. Crew with certifications always wait for a
 * person, since only a person can tell a real certificate from a photo of anything.
 */
export function autoApprove(kind: string, checks: EnrollChecks, certCount: number, env = process.env.AGON_AUTO_APPROVE): boolean {
  if (!checks.clean || !env) return false;
  const kinds = env.split(",").map((s) => s.trim()).filter(Boolean);
  if (!kinds.includes(kind)) return false;
  return !(kind === "role" && certCount > 0);
}
