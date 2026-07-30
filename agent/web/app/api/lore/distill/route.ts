import { NextResponse } from "next/server";
import {
  orchestratedPrompt,
  type Composition,
  type DistillOptions,
} from "../../../../lib/lore/compose";
import { acceptPhrase } from "../../../../lib/lore/distillPhrase";

export const runtime = "nodejs";

/**
 * Model distillation — Addendum 4.
 * Builds the prompt ONLY via orchestratedPrompt(chord). Returns { phrase }
 * or a loud error so the client never fails silently into distillTemplate.
 */
export async function POST(req: Request) {
  const modelId = process.env.ANTHROPIC_DISTILL_MODEL ?? "claude-sonnet-4-6";

  try {
    const body = (await req.json()) as {
      system?: string;
      user?: string;
      chord?: Composition;
      opts?: DistillOptions;
    };

    if (!body.chord || !Array.isArray(body.chord.axes)) {
      console.error("DISTILL: missing chord — refusing stale system/user-only path");
      return NextResponse.json(
        {
          error: "chord required",
          reason: "POST body must include snapshot.chord for orchestratedPrompt",
        },
        { status: 400 },
      );
    }

    let system: string;
    let user: string;
    try {
      const prompt = orchestratedPrompt(body.chord, body.opts);
      system = prompt.system;
      user = prompt.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("DISTILL: orchestratedPrompt threw", msg);
      return NextResponse.json(
        { error: "orchestrate failed", reason: msg },
        { status: 500 },
      );
    }

    console.info("DISTILL: orchestratedPrompt ready", {
      fieldSize: body.chord.contributors?.length ?? 0,
      systemChars: system.length,
      userChars: user.length,
      model: modelId,
      registerLine: user.split("\n").find(l => l.startsWith("REGISTER:")),
    });

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      console.error(
        "DISTILL: ANTHROPIC_API_KEY missing from server env — model cannot run",
      );
      return NextResponse.json(
        {
          error: "no model key",
          reason:
            "ANTHROPIC_API_KEY missing from server env (Vercel project has no env vars). Set it in Vercel → Settings → Environment Variables for Production, then redeploy.",
        },
        { status: 503 },
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 120,
        temperature: 0.7,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const anthropicText = await res.text();
    if (!res.ok) {
      console.error("DISTILL: Anthropic API error", {
        httpStatus: res.status,
        model: modelId,
        body: anthropicText.slice(0, 800),
      });
      return NextResponse.json(
        {
          error: "model failed",
          reason: `Anthropic HTTP ${res.status}`,
          status: res.status,
          body: anthropicText.slice(0, 800),
        },
        { status: 502 },
      );
    }

    let data: { content?: Array<{ type: string; text?: string }> } = {};
    try {
      data = JSON.parse(anthropicText) as typeof data;
    } catch (err) {
      console.error("DISTILL: Anthropic JSON parse failed", anthropicText.slice(0, 400));
      return NextResponse.json(
        {
          error: "bad model response",
          reason: `JSON parse: ${err instanceof Error ? err.message : String(err)}`,
          body: anthropicText.slice(0, 800),
        },
        { status: 502 },
      );
    }

    const raw = data.content?.find(c => c.type === "text")?.text ?? "";
    const phrase = acceptPhrase(raw);
    if (!phrase) {
      console.error("DISTILL: acceptPhrase rejected model output", {
        raw: raw.slice(0, 300),
      });
      return NextResponse.json(
        {
          error: "rejected",
          reason: "acceptPhrase gate rejected model output",
          raw: raw.slice(0, 300),
        },
        { status: 422 },
      );
    }

    console.info("DISTILL: ok", phrase.slice(0, 100));
    return NextResponse.json({ phrase });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DISTILL: route threw", msg);
    return NextResponse.json(
      { error: "distill failed", reason: msg },
      { status: 500 },
    );
  }
}
