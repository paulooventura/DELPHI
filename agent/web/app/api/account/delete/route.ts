import { NextResponse } from "next/server";
import { userFromRequest } from "../../../../lib/db/auth";
import { db } from "../../../../lib/db/server";

export const runtime = "nodejs";

/** POST /api/account/delete — removes the auth user; the vault row cascades. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await db().auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "delete-failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
