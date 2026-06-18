export type SourceTier = "high" | "medium" | "low";

export type SourceItem = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  tier: SourceTier;
  reliability: number;
  publishedAt?: string | null;
  ageDays?: number | null;
  relevance?: number;
  freshness?: number;
};

export type ProviderReview = {
  provider: string;
  answer: string;
  confidence: number;
};

export type ProviderRun = {
  provider: string;
  tier: SourceTier;
  fetched: number;
  accepted: number;
  rejected: number;
  avgReliability: number;
};

export type ResearchReport = {
  searchedProviders: ProviderRun[];
  reliabilityFloor: number;
  stopReason: string;
  acceptedSources: number;
  rejectedSources: number;
  avgFreshness: number;
  predictiveQuery: boolean;
  uncertaintyNote: string;
};

export type ResearchResult = {
  query: string;
  answer: string;
  confidence: number;
  sources: SourceItem[];
  peerReview: ProviderReview[];
  notes: string[];
  report: ResearchReport;
};

export const RELIABILITY_FLOOR = 0.44;

const SOURCE_AUTHORITY: Record<string, number> = {
  Crossref: 0.92,
  PubMed: 0.95,
  arXiv: 0.81,
  OpenAlex: 0.83,
  SemanticScholar: 0.84,
  Wikipedia: 0.62,
  OpenLibrary: 0.58,
  StackOverflow: 0.52,
  HackerNews: 0.44,
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "in", "of", "to", "is", "are", "was", "for", "with", "from", "by", "this", "that", "which", "have", "been", "will", "can", "not", "also", "its", "their", "they", "about", "who", "what", "when", "where", "why", "how", "does", "did", "than", "into", "over", "under", "across", "after", "before", "between", "during", "through", "would", "could", "should",
]);

export async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "DELPHI-Research/1.0" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function safeText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "DELPHI-Research/1.0" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function scoreRelevance(query: string, title: string, snippet: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0.45;
  const haystack = `${title} ${snippet}`.toLowerCase();
  const overlap = tokens.filter((t) => haystack.includes(t)).length;
  const density = overlap / tokens.length;
  const titleHits = tokens.filter((t) => title.toLowerCase().includes(t)).length;
  const titleBoost = Math.min(0.22, titleHits * 0.06);
  return Math.max(0.05, Math.min(0.98, density * 0.78 + titleBoost));
}

function extractPublishedDate(item: { title: string; snippet: string; source: string }): string | null {
  const text = `${item.title} ${item.snippet}`;
  const m = text.match(/\b(20\d{2}|19\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (m) {
    const y = Number(m[1]);
    const mm = String(Number(m[2])).padStart(2, "0");
    const dd = String(Number(m[3])).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  const ym = text.match(/\b(20\d{2}|19\d{2})[-\/](\d{1,2})\b/);
  if (ym) {
    const y = Number(ym[1]);
    const mm = String(Number(ym[2])).padStart(2, "0");
    return `${y}-${mm}-15`;
  }

  const yOnly = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (yOnly) return `${Number(yOnly[1])}-07-01`;

  return null;
}

function ageInDays(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function freshnessScore(ageDays: number | null, tier: SourceTier): number {
  if (ageDays == null) return tier === "high" ? 0.55 : tier === "medium" ? 0.42 : 0.3;
  if (ageDays <= 14) return 1;
  if (ageDays <= 60) return 0.92;
  if (ageDays <= 180) return 0.8;
  if (ageDays <= 365) return 0.64;
  if (ageDays <= 730) return 0.46;
  if (ageDays <= 1825) return 0.26;
  return 0.14;
}

function predictiveRisk(query: string): boolean {
  return /\b(win|winner|predict|forecast|odds|chances|likely|next|future|will be|who is going to|who will)\b/i.test(query);
}

function sourceAuthority(source: string): number {
  return SOURCE_AUTHORITY[source] ?? 0.45;
}

function noveltyPenalty(candidate: Omit<SourceItem, "reliability" | "tier">, pool: SourceItem[]): number {
  const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  const tokens = text.split(/\s+/).filter((t) => t.length > 3);
  if (tokens.length === 0 || pool.length === 0) return 0;
  const tokenSet = new Set(tokens);
  const maxOverlap = pool.reduce((mx, s) => {
    const sTokens = new Set(`${s.title} ${s.snippet}`.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
    let overlap = 0;
    tokenSet.forEach((t) => { if (sTokens.has(t)) overlap++; });
    const ratio = overlap / Math.max(1, Math.min(tokenSet.size, sTokens.size));
    return Math.max(mx, ratio);
  }, 0);
  return maxOverlap > 0.82 ? 0.12 : maxOverlap > 0.66 ? 0.07 : 0;
}

export function scoreSource(
  item: Omit<SourceItem, "reliability" | "tier">,
  query: string,
  tier: SourceTier,
  context: { seenSources?: SourceItem[]; predictive?: boolean } = {},
): SourceItem {
  const predictive = context.predictive ?? predictiveRisk(query);
  const publishedAt = item.publishedAt ?? extractPublishedDate(item);
  const ageDays = ageInDays(publishedAt);
  const freshness = freshnessScore(ageDays, tier);
  const relevance = scoreRelevance(query, item.title, item.snippet);
  const authority = sourceAuthority(item.source);

  const methodBoost =
    /meta-analysis|systematic review|randomized|cohort|dataset|elo|expected goals|xg|model/i.test(item.snippet) ? 0.1
    : /opinion|blog|forum|comment|thread|rumor/i.test(item.snippet) ? -0.12
    : 0;

  const base = tier === "high" ? 0.54 : tier === "medium" ? 0.42 : 0.3;
  const novelty = noveltyPenalty(item, context.seenSources ?? []);

  let reliability =
    base +
    relevance * 0.3 +
    freshness * 0.24 +
    authority * 0.2 +
    methodBoost -
    novelty;

  if (predictive) {
    const stalePenalty = ageDays == null ? 0.06 : ageDays > 365 ? 0.18 : ageDays > 120 ? 0.08 : 0;
    reliability -= stalePenalty;
    reliability = Math.min(reliability, 0.82);
  }

  reliability = Math.max(0.04, Math.min(0.98, reliability));

  return {
    ...item,
    tier,
    reliability,
    publishedAt,
    ageDays,
    relevance,
    freshness,
  };
}

export async function crossrefSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=6&sort=relevance`);
  return (data?.message?.items ?? [])
    .map((it: any) => ({
      title: Array.isArray(it.title) ? it.title[0] : "Untitled",
      url: it.URL ?? "",
      snippet: `DOI: ${it.DOI ?? "n/a"} | Published: ${it.created?.["date-time"]?.slice(0, 10) ?? "n/a"}`,
      source: "Crossref",
      publishedAt: it.created?.["date-time"] ?? null,
    }))
    .filter((it: any) => it.url);
}

export async function openAlexSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=6&sort=relevance_score:desc`);
  return (data?.results ?? [])
    .map((it: any) => ({
      title: it.display_name ?? "Untitled",
      url: it.id ?? "",
      snippet: `Cited by ${it.cited_by_count ?? 0} | Year ${it.publication_year ?? "n/a"}`,
      source: "OpenAlex",
      publishedAt: it.publication_date ?? (it.publication_year ? `${it.publication_year}-07-01` : null),
    }))
    .filter((it: any) => it.url);
}

export async function pubmedSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const search = await safeJson<any>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=6&term=${encodeURIComponent(query)}`);
  const ids: string[] = search?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const summary = await safeJson<any>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`);
  return ids.map((id) => {
    const it = summary?.result?.[id];
    const pubdate = typeof it?.pubdate === "string" ? it.pubdate : null;
    return {
      title: it?.title ?? `PMID ${id}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      snippet: `PMID: ${id} | Journal: ${it?.fulljournalname ?? "n/a"} | ${pubdate ?? "n/a"}`,
      source: "PubMed",
      publishedAt: pubdate,
    };
  });
}

export async function arxivSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const xml = await safeText(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=6`);
  if (!xml) return [];
  return xml.split("<entry>").slice(1, 7)
    .map((entry) => ({
      title: (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled").replace(/\s+/g, " ").trim(),
      url: entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "",
      snippet: `arXiv: ${(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 220)}`,
      source: "arXiv",
      publishedAt: entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() ?? null,
    }))
    .filter((it) => it.url);
}

export async function semanticScholarSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=6&fields=title,url,year,citationCount,abstract`);
  return (data?.data ?? [])
    .map((it: any) => ({
      title: it.title ?? "Untitled",
      url: it.url ?? "",
      snippet: `Year: ${it.year ?? "n/a"} | Citations: ${it.citationCount ?? 0} | ${String(it.abstract ?? "").slice(0, 200)}`,
      source: "SemanticScholar",
      publishedAt: it.year ? `${it.year}-07-01` : null,
    }))
    .filter((it: any) => it.url);
}

export async function wikipediaSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=5`);
  return (data?.pages ?? []).map((p: any) => ({
    title: p.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
    snippet: p.description ?? "Wikipedia article",
    source: "Wikipedia",
    publishedAt: null,
  }));
}

export async function openLibrarySources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
  return (data?.docs ?? [])
    .map((doc: any) => ({
      title: doc.title ?? "Untitled",
      url: doc.key ? `https://openlibrary.org${doc.key}` : "",
      snippet: `Author: ${Array.isArray(doc.author_name) ? doc.author_name[0] : "n/a"} | First published: ${doc.first_publish_year ?? "n/a"}`,
      source: "OpenLibrary",
      publishedAt: doc.first_publish_year ? `${doc.first_publish_year}-07-01` : null,
    }))
    .filter((it: any) => it.url);
}

export async function stackExchangeSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&accepted=True&site=stackoverflow&q=${encodeURIComponent(query)}&pagesize=5`);
  return (data?.items ?? [])
    .map((it: any) => ({
      title: it.title ?? "Untitled",
      url: it.link ?? "",
      snippet: `Score: ${it.score ?? 0} | Answers: ${it.answer_count ?? 0} | Created: ${it.creation_date ? new Date(it.creation_date * 1000).toISOString().slice(0, 10) : "n/a"}`,
      source: "StackOverflow",
      publishedAt: it.creation_date ? new Date(it.creation_date * 1000).toISOString() : null,
    }))
    .filter((it: any) => it.url);
}

export async function hackerNewsSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=6`);
  return (data?.hits ?? [])
    .map((it: any) => ({
      title: it.title ?? it.story_title ?? "Untitled",
      url: it.url ?? it.story_url ?? "",
      snippet: `Points: ${it.points ?? 0} | Comments: ${it.num_comments ?? 0}`,
      source: "HackerNews",
      publishedAt: it.created_at ?? null,
    }))
    .filter((it: any) => it.url);
}

export async function runOpenAIReview(query: string, sources: SourceItem[]): Promise<ProviderReview | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: "Strict researcher. Return ONLY JSON: {\"answer\":\"2-4 sentence synthesis\",\"confidence\":0.0}" },
          {
            role: "user",
            content: `Q: ${query}\nSources:\n${sources.slice(0, 10).map((s) => `- ${s.title} (${s.source}, rel ${s.reliability.toFixed(2)}): ${s.snippet.slice(0, 140)}`).join("\n")}`,
          },
        ],
        temperature: 0.12,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}");
    return { provider: "OpenAI", answer: String(parsed.answer ?? ""), confidence: Number(parsed.confidence ?? 0.58) };
  } catch {
    return null;
  }
}

export async function runAnthropicReview(query: string, sources: SourceItem[]): Promise<ProviderReview | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
        max_tokens: 360,
        temperature: 0.12,
        messages: [{ role: "user", content: `Q: ${query}\nSources:\n${sources.slice(0, 10).map((s) => `- ${s.title} (${s.source}, rel ${s.reliability.toFixed(2)}): ${s.snippet.slice(0, 140)}`).join("\n")}\nReturn ONLY JSON: {"answer":"2-4 sentence synthesis","confidence":0.0}` }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json?.content?.[0]?.text ?? "{}");
    return { provider: "Anthropic", answer: String(parsed.answer ?? ""), confidence: Number(parsed.confidence ?? 0.58) };
  } catch {
    return null;
  }
}

function topicTerms(sources: SourceItem[]): string[] {
  const freq: Record<string, number> = {};
  for (const s of sources) {
    const text = `${s.title} ${s.snippet}`.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    for (const t of text.split(/\s+/)) {
      if (t.length < 4 || STOP_WORDS.has(t)) continue;
      freq[t] = (freq[t] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);
}

function sourceDiversityBoost(sources: SourceItem[]): number {
  const distinct = new Set(sources.map((s) => s.source)).size;
  return Math.min(0.12, distinct * 0.017);
}

function predictiveUncertaintyNote(query: string, topFreshHigh: SourceItem[]): string {
  if (!predictiveRisk(query)) return "";
  if (topFreshHigh.length === 0) {
    return "This is a predictive question; no recent high-authority evidence was found, so uncertainty is high.";
  }
  const avgAge = topFreshHigh.reduce((sum, s) => sum + (s.ageDays ?? 3650), 0) / topFreshHigh.length;
  if (avgAge > 365) return "Predictive question with mostly older evidence; treat this as directional, not deterministic.";
  return "Predictive question: this is an evidence-based estimate, not a guaranteed outcome.";
}

export function buildShortAnswer(
  query: string,
  sources: SourceItem[],
  reviews: ProviderReview[],
  isPartial = false,
): string {
  if (sources.length === 0) return `Initialising search for \"${query}\"...`;

  const sorted = [...sources].sort((a, b) => b.reliability - a.reliability);
  const high = sorted.filter((s) => s.reliability >= 0.72);
  const freshHigh = high.filter((s) => (s.ageDays ?? 10_000) <= 365);
  const providers = [...new Set(sorted.slice(0, 8).map((s) => s.source))].join(", ");
  const terms = topicTerms(sorted);

  if (reviews.length > 0) {
    const best = [...reviews].sort((a, b) => b.confidence - a.confidence)[0];
    const uncertainty = predictiveUncertaintyNote(query, freshHigh);
    const evidenceLine =
      freshHigh.length > 0
        ? ` Built on ${freshHigh.length} recent high-authority sources.`
        : high.length > 0
          ? " Evidence exists but freshness is limited."
          : " High-authority evidence is sparse.";
    return `${best.answer}${evidenceLine}${uncertainty ? ` ${uncertainty}` : ""}${isPartial ? " [Refining...]" : ""}`;
  }

  if (freshHigh.length >= 3) {
    return `Evidence synthesis from ${providers}: strongest agreement centers on ${terms.slice(0, 3).join(", ")}. ${freshHigh.length} recent high-authority sources align.${isPartial ? " [Peer review in progress...]" : ""}`;
  }
  if (high.length >= 2) {
    return `Moderate evidence from ${providers}. Core signals: ${terms.slice(0, 3).join(", ")}. Reliability is constrained by source freshness.${isPartial ? " [Expanding...]" : ""}`;
  }
  return `Directional only: source quality/freshness is limited across ${providers}. Use this as hypothesis generation, not firm conclusion.${isPartial ? " [Searching for stronger sources...]" : ""}`;
}

export function computeConfidence(sources: SourceItem[], reviews: ProviderReview[], query?: string): number {
  if (sources.length === 0) return 0.22;
  const predictive = predictiveRisk(query ?? "");

  const top = [...sources].sort((a, b) => b.reliability - a.reliability).slice(0, 10);
  const srcReliability = top.reduce((sum, s) => sum + s.reliability, 0) / top.length;
  const srcFreshness = top.reduce((sum, s) => sum + (s.freshness ?? 0.4), 0) / top.length;
  const base = srcReliability * 0.64 + srcFreshness * 0.24 + sourceDiversityBoost(top);

  const reviewConfidence =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.confidence, 0) / reviews.length
      : base;

  let conf = base * 0.72 + reviewConfidence * 0.28;
  if (predictive) conf *= 0.84;
  return Math.max(0.14, Math.min(predictive ? 0.78 : 0.96, conf));
}

export function buildReport(sources: SourceItem[], _reviews: ProviderReview[], stopReason: string, query?: string): ResearchReport {
  const runs: Record<string, ProviderRun> = {};
  for (const s of sources) {
    if (!runs[s.source]) {
      runs[s.source] = {
        provider: s.source,
        tier: s.tier,
        fetched: 0,
        accepted: 0,
        rejected: 0,
        avgReliability: 0,
      };
    }
    runs[s.source].fetched++;
    if (s.reliability >= RELIABILITY_FLOOR) runs[s.source].accepted++;
    else runs[s.source].rejected++;
  }

  for (const r of Object.values(runs)) {
    const mine = sources.filter((s) => s.source === r.provider);
    r.avgReliability = mine.length > 0
      ? Number((mine.reduce((acc, s) => acc + s.reliability, 0) / mine.length).toFixed(3))
      : 0;
  }

  const accepted = sources.filter((s) => s.reliability >= RELIABILITY_FLOOR);
  const avgFreshness = accepted.length > 0
    ? Number((accepted.reduce((sum, s) => sum + (s.freshness ?? 0.4), 0) / accepted.length).toFixed(3))
    : 0;

  const predictive = predictiveRisk(query ?? "");
  const uncertaintyNote = predictive
    ? "Prediction mode enabled: confidence intentionally capped; stale evidence penalized."
    : "Non-predictive mode: confidence reflects evidence quality and freshness.";

  return {
    searchedProviders: Object.values(runs),
    reliabilityFloor: RELIABILITY_FLOOR,
    stopReason,
    acceptedSources: accepted.length,
    rejectedSources: sources.length - accepted.length,
    avgFreshness,
    predictiveQuery: predictive,
    uncertaintyNote,
  };
}
