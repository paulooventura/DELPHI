import { db, dbConfigured } from "./server";

/** Verifies a Supabase access token from `Authorization: Bearer …`. */
export async function userFromRequest(req: Request): Promise<{ id: string; email: string } | null> {
  if (!dbConfigured()) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > 4096) return null;
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: (data.user.email || "").toLowerCase() };
}

/** ADMIN_EMAILS (comma-separated, server env) is the whole allow-list. */
export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

export async function adminFromRequest(req: Request) {
  const user = await userFromRequest(req);
  return user && isAdminEmail(user.email) ? user : null;
}
