/**
 * Certificate uploads for crew enrollments. Files go to the private Supabase Storage bucket
 * `agon-certs` (service role only; /admin opens them through short-lived signed links).
 */

export const CERT_BUCKET = "agon-certs";
/** Per file. The whole request also has to stay under Vercel's 4.5 MB body cap. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_BYTES = Math.floor(4.3 * 1024 * 1024);

const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type CertFile = { cert: string; name: string; type: string; size: number; ext: string };
export type FileProblem = { cert: string; problem: "type" | "size" | "empty" };

/** Checks type and size; the cert id must be one the person claimed. */
export function checkCertFiles(
  files: { cert: string; name: string; type: string; size: number }[],
  claimed: string[],
): { ok: CertFile[]; problems: FileProblem[]; total: number } {
  const ok: CertFile[] = [];
  const problems: FileProblem[] = [];
  let total = 0;
  for (const f of files) {
    if (!claimed.includes(f.cert) || ok.some((o) => o.cert === f.cert)) continue;
    const ext = TYPES[f.type.toLowerCase()];
    if (!f.size) problems.push({ cert: f.cert, problem: "empty" });
    else if (!ext) problems.push({ cert: f.cert, problem: "type" });
    else if (f.size > MAX_FILE_BYTES) problems.push({ cert: f.cert, problem: "size" });
    else {
      ok.push({ ...f, ext });
      total += f.size;
    }
  }
  return { ok, problems, total };
}

export function certPath(enrollmentId: string, f: CertFile): string {
  return `${enrollmentId}/${f.cert}.${f.ext}`;
}
