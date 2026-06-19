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

// 1. ADD THE INTENT FILTER REGEX HERE
const LOCAL_REALTIME_RE = /\b(weather|temperature|rain|forecast|sports score|restaurant|bars near|traffic|local news)\b/i;

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

  // 2. INSERT THE INTERCEPT BLOCK RIGHT HERE
  if (LOCAL_REALTIME_RE.test(query)) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            phase: 1,
            complete: true,
            status: "Query out of scope for literature engine.",
            answer: "This research engine is calibrated strictly for deep literature and academic analysis. It does not have access to live, local, or real-time web utilities (like current weather or local business directories). Please pivot to a standard search assistant for real-time local lookups.",
            confidence: 0,
            sources: [],
            peerReview: [],
            report: "Intercepted: Real-time/Local intent detected.",
          })}\n\n`));
        } catch {}
        finally { try { controller.close(); } catch {} }
      }
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  }

  // 3. THE REST OF YOUR CODE CONTINUES AS NORMAL BELOW HERE
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
        
        // ... all the remaining Phase 1, Phase 2, and Phase 3 logic we patched earlier ...
