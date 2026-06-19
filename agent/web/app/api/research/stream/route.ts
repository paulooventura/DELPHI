import {
  crossrefSources, openAlexSources, pubmedSources, arxivSources,
  semanticScholarSources, wikipediaSources, openLibrarySources,
  stackExchangeSources, hackerNewsSources,
  runOpenAIReview, runAnthropicReview,
  buildShortAnswer, computeConfidence, buildReport,
  scoreSource,
  type SourceItem, type ProviderReview,
} from "../../../../lib/researchEngine";

const PREDICTIVE_RE = /\b(win|winner|predict|forecast|odds|chances|likely|next|future|will be|who is going to|who will)\b/i;

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
      const predictive = PREDICTIVE_RE.test(query);

      try {
        // ── PHASE 1: Academic Foundations ──────────────────────────
        emit({ phase: 1, status: "Scanning primary databases for verifiable records…", answer: null });

        const [cr, oa, pm, ax] = await Promise.all([
          safely(crossrefSources(query)),
          safely(openAlexSources(query)),
          safely(pubmedSources(query)),
          safely(arxivSources(query)),
        ]);

        const p1raw = [...cr, ...oa, ...pm, ...ax];
        const p1 = p1raw.map(s => scoreSource(s, query, "high", { predictive }));
        const p1Confidence = computeConfidence(p1, [], query);
        const p1HighFresh = p1.filter(s => s.reliability >= 0.76 && (s.freshness ?? 0) >= 0.6).length;

        // CRITICAL FIX: If zero matching items come back across all core engines, stop early 
        // instead of allowing the model to hallucinate over unrelated snippets.
        if (p1.length === 0 || p1Confidence < 0.15) {
          emit({
            phase: 1,
            complete: true,
            status: "No verified academic or primary records found for this query.",
            answer: "The research engine could not locate sufficiently reliable, verified data matching your specific request. Please refine or broaden your query parameters.",
            confidence: 0,
            sources: [],
            peerReview: [],
            report: "Halted: Query does not align with active knowledge domains.",
          });
          return;
        }

        emit({
          phase: 1,
          status: `Phase 1 complete — ${p1.length} sources`,
          answer: buildShortAnswer(query, p1, [], true),
          confidence: p1Confidence,
          sources: p1.sort((a, b) => b.reliability - a.reliability).slice(0, 8),
          peerReview: [],
          report: buildReport(p1, [], "Phase 1 - primary sources only", query),
        });

        if (!predictive && p1Confidence >= 0.75 && p1HighFresh >= 4) {
          emit({
            phase: 1,
            complete: true,
            status: "Complete - strong convergence reached in primary sources",
            answer: buildShortAnswer(query, p1, [], false),
            confidence: p1Confidence,
            sources: p1.sort((a, b) => b.reliability - a.reliability).slice(0, 12),
            peerReview: [],
            report: buildReport(p1, [], "Early stop: high-confidence primary-source convergence.", query),
          });
          return;
        }

        if (Date.now() > deadline) { done = true; controller.close(); return; }

        // ── PHASE 2: Medium-tier Verification ─────────────────────────────
        emit({ phase: 2, status: "Expanding cross-references and evaluating context…", answer: null });

        const runAiPhase2 = predictive || p1Confidence < 0.72;

        const [[wk, ss], aiP2] = await Promise.all([
          Promise.all([safely(wikipediaSources(query)), safely(semanticScholarSources(query))]),
          runAiPhase2
            ? Promise.all([
                runOpenAIReview(query, p1).catch(() => null),
                runAnthropicReview(query, p1).catch(() => null),
              ])
            : Promise.resolve([null, null] as (ProviderReview | null)[]),
        ]);

        const p2med = [...wk, ...ss].map(s => scoreSource(s, query, "medium", { seenSources: p1, predictive }));
        const p2 = [...p1, ...p2med];
        const rev2: ProviderReview[] = aiP2.filter((r): r is ProviderReview => Boolean(r && r.answer));
        const p2Confidence = computeConfidence(p2, rev2, query);
        const p2HighFresh = p2.filter(s => s.reliability >= 0.76 && (s.freshness ?? 0) >= 0.6).length;

        // CRITICAL FIX: If quality drops off significantly during expansion, halt before noise injection
        if (p2Confidence < 0.35) {
          emit({
            phase: 2,
            complete: true,
            status: "Halted: Secondary source divergence detected.",
            answer: "Insufficient reliable documentation found. Results cannot be verified with high structural confidence.",
            confidence: p2Confidence,
            sources: p2.sort((a, b) => b.reliability - a.reliability).slice(0, 5),
            peerReview: rev2,
            report: "Halted at noise boundary: Secondary expansion failed convergence thresholds.",
          });
          return;
        }

        emit({
          phase: 2,
          status: `Phase 2 complete — ${p2.length} sources, ${rev2.length} AI reviews`,
          answer: buildShortAnswer(query, p2, rev2, true),
          confidence: p2Confidence,
          sources: p2.sort((a, b) => b.reliability - a.reliability).slice(0, 10),
          peerReview: rev2,
          report: buildReport(p2, rev2, "Phase 2 - secondary expansion", query),
        });

        if (!predictive && p2Confidence >= 0.77 && p2HighFresh >= 5) {
          emit({
            phase: 2,
            complete: true,
            status: "Complete - enough evidence gathered without low-tier crawl",
            answer: buildShortAnswer(query, p2, rev2, false),
            confidence: p2Confidence,
            sources: p2.sort((a, b) => b.reliability - a.reliability).slice(0, 14),
            peerReview: rev2,
            report: buildReport(p2, rev2, "Early stop: medium-phase confidence threshold achieved.", query),
          });
          return;
        }

        if (Date.now() > deadline) { done = true; controller.close(); return; }

        // ── PHASE 3: Deep Scan Finalization ────────────────────────
        emit({ phase: 3, status: "Deep scan + synthesizing final answer…", answer: null });

        const runAiPhase3 = predictive || p2Confidence < 0.7;

        const [[ol, se, hn], aiP3] = await Promise.all([
          Promise.all([safely(openLibrarySources(query)), safely(stackExchangeSources(query)), safely(hackerNewsSources(query))]),
          runAiPhase3
            ? Promise.all([
                runOpenAIReview(query, p2).catch(() => null),
                runAnthropicReview(query, p2).catch(() => null),
              ])
            : Promise.resolve([null, null] as (ProviderReview | null)[]),
        ]);

        const p3low = [...ol, ...se, ...hn].map(s => scoreSource(s, query, "low", { seenSources: p2, predictive }));
        const p3 = [...p2, ...p3low];
        const revFinal = dedupeReviews(rev2, aiP3.filter((r): r is ProviderReview => Boolean(r && r.answer)));

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
