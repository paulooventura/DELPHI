import {
  crossrefSources, openAlexSources, pubmedSources, arxivSources,
  semanticScholarSources, wikipediaSources, openLibrarySources,
  stackExchangeSources, hackerNewsSources,
  runOpenAIReview, runAnthropicReview,
  buildShortAnswer, computeConfidence, buildReport,
  scoreSource,
  type SourceItem, type ProviderReview,
} from "../../../../lib/researchEngine";

async function safely<T>(p: Promise<T[]>): Promise<T[]> {
  return p.catch(() => []);
}

function dedupeReviews(a: ProviderReview[], b: ProviderReview[]): ProviderReview[] {
  const map = new Map<string, ProviderReview>();
  [...a, ...b].filter(Boolean).forEach(r => map.set(r.provider, r));
  return [...map.values()];
}

export async function POST(req: Request) {
  const body = await req.json();
  const query = String(body.query ?? "").trim();
  if (!query) return new Response("query required", { status: 400 });

  const encoder = new TextEncoder();
  let done = false;

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: object) {
        if (!done) {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        }
      }

      const deadline = Date.now() + 57000;

      try {
        // ── PHASE 1: high-tier academic sources ──────────────────────────
        emit({ phase: 1, status: "Scanning primary academic databases…", answer: null });

        const [cr, oa, pm, ax] = await Promise.all([
          safely(crossrefSources(query)),
          safely(openAlexSources(query)),
          safely(pubmedSources(query)),
          safely(arxivSources(query)),
        ]);

        const p1raw = [...cr, ...oa, ...pm, ...ax];
        const p1 = p1raw.map(s => scoreSource(s, query, "high", { predictive: /\b(win|winner|predict|forecast|odds|chances|likely|next|future|will be|who is going to|who will)\b/i.test(query) }));

        emit({
          phase: 1,
          status: `Phase 1 complete — ${p1.length} sources`,
          answer: buildShortAnswer(query, p1, [], true),
          confidence: computeConfidence(p1, [], query),
          sources: p1.sort((a, b) => b.reliability - a.reliability).slice(0, 8),
          peerReview: [],
          report: buildReport(p1, [], "Phase 1 - primary sources only", query),
        });

        if (Date.now() > deadline) { done = true; controller.close(); return; }

        // ── PHASE 2: medium-tier + AI review ─────────────────────────────
        emit({ phase: 2, status: "Expanding to secondary sources + peer review…", answer: null });

        const [[wk, ss], aiP2] = await Promise.all([
          Promise.all([safely(wikipediaSources(query)), safely(semanticScholarSources(query))]),
          Promise.all([
            runOpenAIReview(query, p1).catch(() => null),
            runAnthropicReview(query, p1).catch(() => null),
          ]),
        ]);

        const p2med = [...wk, ...ss].map(s => scoreSource(s, query, "medium", { seenSources: p1, predictive: /\b(win|winner|predict|forecast|odds|chances|likely|next|future|will be|who is going to|who will)\b/i.test(query) }));
        const p2 = [...p1, ...p2med];
        const rev2 = aiP2.filter((r): r is ProviderReview => Boolean(r?.answer));

        emit({
          phase: 2,
          status: `Phase 2 complete — ${p2.length} sources, ${rev2.length} AI reviews`,
          answer: buildShortAnswer(query, p2, rev2, true),
          confidence: computeConfidence(p2, rev2, query),
          sources: p2.sort((a, b) => b.reliability - a.reliability).slice(0, 10),
          peerReview: rev2,
          report: buildReport(p2, rev2, "Phase 2 - secondary expansion", query),
        });

        if (Date.now() > deadline) { done = true; controller.close(); return; }

        // ── PHASE 3: low-tier + re-review + final ────────────────────────
        emit({ phase: 3, status: "Deep scan + synthesising final answer…", answer: null });

        const [[ol, se, hn], aiP3] = await Promise.all([
          Promise.all([safely(openLibrarySources(query)), safely(stackExchangeSources(query)), safely(hackerNewsSources(query))]),
          Promise.all([
            runOpenAIReview(query, p2).catch(() => null),
            runAnthropicReview(query, p2).catch(() => null),
          ]),
        ]);

        const p3low = [...ol, ...se, ...hn].map(s => scoreSource(s, query, "low", { seenSources: p2, predictive: /\b(win|winner|predict|forecast|odds|chances|likely|next|future|will be|who is going to|who will)\b/i.test(query) }));
        const p3 = [...p2, ...p3low];
        const revFinal = dedupeReviews(rev2, aiP3.filter((r): r is ProviderReview => Boolean(r?.answer)));

        const highCount = p3.filter(s => s.reliability >= 0.72).length;
        const lowCount  = p3.filter(s => s.reliability < 0.5).length;
        const stopReason =
          highCount >= 6 ? "High-reliability convergence reached."
          : lowCount > highCount ? "Reliability decay detected in deep layers — halted at noise boundary."
          : "All available providers searched.";

        emit({
          phase: 3,
          complete: true,
          status: `Complete — ${p3.length} sources total`,
          answer: buildShortAnswer(query, p3, revFinal, false),
          confidence: computeConfidence(p3, revFinal, query),
          sources: p3.sort((a, b) => b.reliability - a.reliability).slice(0, 16),
          peerReview: revFinal,
          report: buildReport(p3, revFinal, stopReason, query),
        });
      } catch (err) {
        emit({ error: String(err), phase: -1 });
      } finally {
        done = true;
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
