import {
  crossrefSources, openAlexSources, pubmedSources, arxivSources,
  semanticScholarSources, wikipediaSources, wikidataSources, duckDuckGoSources,
  openLibrarySources, multiSiteStackExchangeSources, hackerNewsSources, redditSources,
  buildShortAnswer, computeConfidence, buildReport,
  scoreSource, isConversationalQuery, runAllAvailableAiReviews,
} from "../../../../lib/researchEngine";

const PREDICTIVE_RE = /\b(win|winner|predict|forecast|odds|chances|likely|next|future|will be|who is going to|who will)\b/i;

// ── Real-time / live-data queries the static source set CANNOT answer.
// Crossref, arXiv, PubMed, OpenAlex, Wikipedia etc. have no live feeds, so a
// "weather tomorrow" or "stock price now" question will only ever surface
// tangential keyword matches (e.g. "space weather" papers). We detect these
// up front and refuse honestly instead of synthesizing noise.
const REALTIME_RE = /\b(weather|forecast|temperature|rain|snow|sunny|humidity|wind)\b.*\b(today|tomorrow|tonight|now|this (week|weekend|morning|afternoon|evening)|right now)\b|\b(today|tomorrow|tonight|now)\b.*\b(weather|forecast|temperature)\b|\b(stock|share) price\b|\bprice of\b.*\b(now|today)\b|\b(score|scores|game|match)\b.*\b(today|tonight|live|right now)\b|\bwhat time is it\b|\bcurrently (raining|snowing)\b/i;

// Minimum number of genuinely on-topic sources required before we are willing
// to emit a synthesized answer at all. Below this, we refuse rather than guess.
const MIN_RELEVANT_SOURCES = 2;
// A source counts as "relevant" only if its scorer assigned real topical
// overlap. Adjust to match researchEngine's relevance field name/scale.
const RELEVANCE_FLOOR = 0.45;

async function safely<T>(p: Promise<T[]>, label: string, failures: string[]): Promise<T[]> {
  return p.catch(() => { failures.push(label); return []; });
}

// Count sources that are actually on-topic, not just keyword-adjacent.
function relevantCount(sources: Array<{ relevance?: number }>): number {
  return sources.filter(s => (s.relevance ?? 0) >= RELEVANCE_FLOOR).length;
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

      // Single helper for honest refusals — gives Delphi a clean
      // insufficientEvidence flag instead of pre-templated prose to parrot.
      function refuse(reason: string, phase: number) {
        emit({
          phase,
          complete: true,
          insufficientEvidence: true,
          status: "Stopped — cannot answer reliably",
          answer: reason,
          confidence: 0,
          sources: [],
          report: null,
        });
      }

      const deadline = Date.now() + 57000;
      const predictive = PREDICTIVE_RE.test(query);
      const conversational = isConversationalQuery(query);

      // ── GUARD 0: real-time questions short-circuit before any crawling.
      if (REALTIME_RE.test(query)) {
        refuse(
          "This is a live/real-time question (e.g. current weather, prices, or scores). " +
          "This engine searches academic and reference sources, which don't carry live data, " +
          "so it can't answer this reliably. Try a dedicated weather, market, or sports service.",
          0,
        );
        done = true; try { controller.close(); } catch {}
        return;
      }

      const failures: string[] = [];

      try {
        // ── PHASE 1: high-tier academic sources.
        let p1: ReturnType<typeof scoreSource>[] = [];
        if (conversational) {
          emit({ phase: 1, status: "Conversational/advice question detected — skipping academic databases to save compute…", answer: null });
        } else {
          emit({ phase: 1, status: "Scanning primary academic databases (efficiency-first)…", answer: null });

          const [cr, oa, pm, ax] = await Promise.all([
            safely(crossrefSources(query), "Crossref", failures),
            safely(openAlexSources(query), "OpenAlex", failures),
            safely(pubmedSources(query), "PubMed", failures),
            safely(arxivSources(query), "arXiv", failures),
          ]);

          const p1raw = [...cr, ...oa, ...pm, ...ax];
          p1 = p1raw.map(s => scoreSource(s, query, "high", { predictive }));
        }
        const p1Confidence = computeConfidence(p1, query);
        const p1HighFresh = p1.filter(s => s.reliability >= 0.76 && (s.freshness ?? 0) >= 0.6).length;

        emit({
          phase: 1,
          status: `Phase 1 complete — ${p1.length} sources (${relevantCount(p1)} on-topic)${failures.length ? `, providers unavailable: ${failures.join(", ")}` : ""}`,
          answer: buildShortAnswer(query, p1, true),
          confidence: p1Confidence,
          sources: p1.sort((a, b) => b.reliability - a.reliability).slice(0, 8),
          report: buildReport(p1, "Phase 1 - primary sources only", query),
        });

        // Shortcut: stop when primary evidence is already strong AND on-topic.
        if (!predictive && p1Confidence >= 0.75 && p1HighFresh >= 4 && relevantCount(p1) >= MIN_RELEVANT_SOURCES) {
          emit({
            phase: 1,
            complete: true,
            status: "Complete - strong convergence reached in primary sources",
            answer: buildShortAnswer(query, p1, false),
            confidence: p1Confidence,
            sources: p1.sort((a, b) => b.reliability - a.reliability).slice(0, 12),
            report: buildReport(p1, "Early stop: high-confidence primary-source convergence.", query),
          });
          return;
        }

        if (Date.now() > deadline) { done = true; controller.close(); return; }

        // ── PHASE 2: general-knowledge free sources.
        emit({ phase: 2, status: "Expanding to general-knowledge sources…", answer: null });

        const [wk, ss, wd, ddg, rd] = await Promise.all([
          safely(wikipediaSources(query), "Wikipedia", failures),
          conversational ? Promise.resolve([]) : safely(semanticScholarSources(query), "Semantic Scholar", failures),
          safely(wikidataSources(query), "Wikidata", failures),
          safely(duckDuckGoSources(query), "DuckDuckGo", failures),
          conversational ? safely(redditSources(query), "Reddit", failures) : Promise.resolve([]),
        ]);

        const p2med = [...wk, ...ss, ...wd, ...ddg, ...rd].map(s => scoreSource(s, query, "medium", { seenSources: p1, predictive }));
        const p2 = [...p1, ...p2med];
        const p2Confidence = computeConfidence(p2, query);
        const p2HighFresh = p2.filter(s => s.reliability >= 0.76 && (s.freshness ?? 0) >= 0.6).length;

        emit({
          phase: 2,
          status: `Phase 2 complete — ${p2.length} sources (${relevantCount(p2)} on-topic)${failures.length ? `, providers unavailable: ${failures.join(", ")}` : ""}`,
          answer: buildShortAnswer(query, p2, true),
          confidence: p2Confidence,
          sources: p2.sort((a, b) => b.reliability - a.reliability).slice(0, 10),
          report: buildReport(p2, "Phase 2 - general-knowledge expansion", query),
        });

        if (!predictive && p2Confidence >= 0.77 && p2HighFresh >= 5 && relevantCount(p2) >= MIN_RELEVANT_SOURCES) {
          emit({
            phase: 2,
            complete: true,
            status: "Complete - enough evidence gathered without low-tier crawl",
            answer: buildShortAnswer(query, p2, false),
            confidence: p2Confidence,
            sources: p2.sort((a, b) => b.reliability - a.reliability).slice(0, 14),
            report: buildReport(p2, "Early stop: general-knowledge confidence threshold achieved.", query),
          });
          return;
        }

        if (Date.now() > deadline) { done = true; controller.close(); return; }

        // ── PHASE 3: low-tier crawl + optional AI cross-check + final synthesis.
        emit({ phase: 3, status: "Deep scan + synthesising final answer…", answer: null });

        const [[ol, se, hn], reviews] = await Promise.all([
          Promise.all([
            safely(openLibrarySources(query), "OpenLibrary", failures),
            safely(multiSiteStackExchangeSources(query, conversational), "StackExchange", failures),
            safely(hackerNewsSources(query), "HackerNews", failures),
          ]),
          runAllAvailableAiReviews(query, p2).catch(() => []),
        ]);

        const p3low = [...ol, ...se, ...hn].map(s => scoreSource(s, query, "low", { seenSources: p2, predictive }));
        const p3 = [...p2, ...p3low];

        // ── GUARD 1: relevance floor. If, after all three phases, we don't have
        // enough genuinely on-topic sources, refuse rather than synthesize.
        const onTopic = relevantCount(p3);
        if (onTopic < MIN_RELEVANT_SOURCES) {
          refuse(
            `Searched all available sources but found only ${onTopic} genuinely on-topic result${onTopic === 1 ? "" : "s"} ` +
            `(threshold ${MIN_RELEVANT_SOURCES}). The matches were keyword-adjacent rather than about your actual question, ` +
            `so there isn't enough reliable evidence to answer. Try rephrasing, or this may be outside what reference/academic sources cover.` +
            (failures.length ? ` Note: these providers were unavailable this run: ${failures.join(", ")}.` : ""),
            3,
          );
          return;
        }

        const highCount = p3.filter(s => s.reliability >= 0.72).length;
        const lowCount  = p3.filter(s => s.reliability < 0.5).length;
        const stopReason =
          highCount >= 6 ? "High-reliability convergence reached."
          : lowCount > highCount ? "Reliability decay detected in deep layers — halted at noise boundary."
          : "All available free providers searched.";

        emit({
          phase: 3,
          complete: true,
          insufficientEvidence: false,
          status: `Complete — ${p3.length} sources total, ${onTopic} on-topic${reviews.length ? `, cross-checked with ${reviews.map(r => r.provider).join(", ")}` : ""}${failures.length ? ` (unavailable: ${failures.join(", ")})` : ""}`,
          answer: buildShortAnswer(query, p3, false, reviews),
          confidence: computeConfidence(p3, query, reviews),
          sources: p3.sort((a, b) => b.reliability - a.reliability).slice(0, 16),
          peerReview: reviews,
          report: buildReport(p3, stopReason, query, reviews),
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
