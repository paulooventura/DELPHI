import { NextResponse } from "next/server";
import { acceptPhrase } from "../../../../lib/lore/distillPhrase";

/**
 * Model distillation endpoint (Sonnet when keyed).
 * Returns { phrase } or 503 so the client falls back to distillTemplate.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { system?: string; user?: string };
    const system = body.system?.trim();
    const user = body.user?.trim();
    if (!system || !user) {
      return NextResponse.json({ error: "system and user required" }, { status: 400 });
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "no model key" }, { status: 503 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_DISTILL_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 120,
        temperature: 0.7,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "model failed" }, { status: 502 });
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const raw = data.content?.find(c => c.type === "text")?.text ?? "";
    const phrase = acceptPhrase(raw);
    if (!phrase) {
      return NextResponse.json({ error: "rejected" }, { status: 422 });
    }
    return NextResponse.json({ phrase });
  } catch {
    return NextResponse.json({ error: "distill failed" }, { status: 500 });
  }
}
