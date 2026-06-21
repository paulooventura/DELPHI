import { NextResponse } from "next/server";
import { research, TIER_CONFIG } from "../../../../lib/researchEngine";
import type { ResearchRequest, ResearchTier } from "../../../../lib/researchEngine";

// Tiered research endpoint for the cycle-wheel UI. The caller picks the
// computation tier (`instant` | `standard` | `deep` | `max`); the engine maps
// it to providers + budget and streams partial ConfidenceResults as each phase
// completes so the UI never blocks. The two free tiers run with zero keys.

const VALID_TIERS: ResearchTier[] = ["instant", "standard", "deep", "max"];

// Expose the data-driven tier table so the UI can render the selector without
// duplicating it.
export async function GET() {
  return NextResponse.json({
    tiers: VALID_TIERS.map((t) => ({
      id: t,
      label: TIER_CONFIG[t].label,
      latency: TIER_CONFIG[t].latencyHint,
      approxCostUSD: TIER_CONFIG[t].approxCostUSD,
      free: TIER_CONFIG[t].approxCostUSD === 0,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = String(body.query ?? "").trim();
  if (!query) return new Response("query required", { status: 400 });

  const tier: ResearchTier = VALID_TIERS.includes(body.tier) ? body.tier : "standard";
  const request: ResearchRequest = {
    query,
    tier,
    domainFilter: Array.isArray(body.domainFilter) ? body.domainFilter.map(String) : undefined,
    recency: body.recency,
    academicOnly: Boolean(body.academicOnly),
    maxBudgetUSD: typeof body.maxBudgetUSD === "number" ? body.maxBudgetUSD : undefined,
  };

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };

      try {
        const result = await research(request, {
          onProgress: (p) => emit({ phase: p.phase, ...(p.partial ?? {}) }),
        });
        emit({ phase: "result", complete: true, ...result });
      } catch (err) {
        emit({ phase: "error", error: String(err) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
