import { NextResponse } from "next/server";
import {
  availableBrains,
  brainKeysConfigured,
  parsePhraseBrainPayload,
  voicePhraseBrain,
  type PhraseBrainSource,
} from "../../../lib/lore/phraseBrain";

export const runtime = "nodejs";
export const maxDuration = 20;

function parsePrefer(raw: unknown): PhraseBrainSource | "auto" | undefined {
  if (raw === "auto" || raw === "anthropic" || raw === "openai" || raw === "gemini") {
    return raw;
  }
  return undefined;
}

/** Which minds are keyed — never the secrets themselves. */
export async function GET() {
  return NextResponse.json({ brains: availableBrains() });
}

/**
 * POST /api/phrase
 * Voices an already-computed chord. Body is a sanitized axis payload —
 * no birth record, no coordinates, no tradition names.
 */
export async function POST(req: Request) {
  if (!brainKeysConfigured()) {
    return NextResponse.json({ error: "no-brain", brains: availableBrains() }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const prefer = parsePrefer(
    body && typeof body === "object" ? (body as Record<string, unknown>).prefer : undefined,
  );
  const payload = parsePhraseBrainPayload(body);
  if (!payload) {
    return NextResponse.json({ error: "bad-payload" }, { status: 400 });
  }

  try {
    const voiced = await voicePhraseBrain(payload, prefer);
    if (!voiced) {
      return NextResponse.json({ error: "no-voice" }, { status: 502 });
    }
    return NextResponse.json(voiced);
  } catch {
    return NextResponse.json({ error: "brain-failed" }, { status: 502 });
  }
}
