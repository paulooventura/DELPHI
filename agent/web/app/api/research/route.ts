import { NextResponse } from "next/server";

// Use /api/research/stream for the progressive streaming version.
export async function POST() {
  return NextResponse.json(
    { error: "Use /api/research/stream for research results." },
    { status: 410 },
  );
}
