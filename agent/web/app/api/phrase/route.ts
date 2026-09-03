import { NextResponse } from "next/server";
import {
  brainKeysConfigured,
  parsePhraseBrainPayload,
  voicePhraseBrain,
} from "../../../lib/lore/phraseBrain";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * POST /api/phrase
 * Voices an already-computed chord. Body is a sanitized axis payload —
 * no birth record, no coordinates, no tradition names.
 */
export async function POST(req: Request) {
  if (!brainKeysConfigured()) {
    return NextResponse.json({ error: "no-brain" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const payload = parsePhraseBrainPayload(body);
  if (!payload) {
    return NextResponse.json({ error: "bad-payload" }, { status: 400 });
  }

  try {
    const voiced = await voicePhraseBrain(payload);
    if (!voiced) {
      return NextResponse.json({ error: "no-voice" }, { status: 502 });
    }
    return NextResponse.json(voiced);
  } catch {
    return NextResponse.json({ error: "brain-failed" }, { status: 502 });
  }
}
