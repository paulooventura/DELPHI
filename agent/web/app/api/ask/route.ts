import { NextResponse } from "next/server";
import { runProwler } from "../../../lib/runProwler";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query : "";

    const result = await runProwler(query);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
