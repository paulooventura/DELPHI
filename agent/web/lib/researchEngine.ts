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

// Optional multi-model AI cross-check. Each provider only fires when the
// user has configured their OWN API key for it (OPENAI_API_KEY /
// ANTHROPIC_API_KEY / GEMINI_API_KEY) — with no keys set, zero paid calls
// are made and the engine is exactly as free as it was before. When keys
// ARE present, every configured provider is queried (not just one), so the
// final answer is cross-checked across whichever models the user has
// access to, not locked to a single vendor.
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
  aiProvidersConsulted: string[];
};

export type ResearchResult = {
  query: string;
  answer: string;
  confidence: number;
  sources: SourceItem[];
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
  Wikidata: 0.6,
  DuckDuckGo: 0.55,
  OpenLibrary: 0.58,
  StackOverflow: 0.52,
  HackerNews: 0.44,
  Reddit: 0.4,
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "in", "of", "to", "is", "are", "was", "for", "with", "from", "by", "this", "that", "which", "have", "been", "will", "can", "not", "also", "its", "their", "they", "about", "who", "what", "when", "where", "why", "how", "does", "did", "than", "into", "over", "under", "across", "after", "before", "between", "during", "through", "would", "could", "should",
]);

// One cheap retry on transient failure (timeout/network/5xx) so a single flaky
// request doesn't silently zero out an entire free provider's results.
async function withRetry<T>(attempt: () => Promise<T | null>): Promise<T | null> {
  const first = await attempt().catch(() => null);
  if (first !== null) return first;
  await new Promise((r) => setTimeout(r, 350));
  return attempt().catch(() => null);
}

export async function safeJson<T>(url: string): Promise<T | null> {
  return withRetry(async () => {
    const res = await fetch(url, { headers: { "User-Agent": "DELPHI-Research/1.0" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  });
}

export async function safeText(url: string): Promise<string | null> {
  return withRetry(async () => {
    const res = await fetch(url, { headers: { "User-Agent": "DELPHI-Research/1.0" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return res.text();
  });
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function stem(token: string): string {
  // light stemmer: strip common inflectional suffixes for fuzzy matching
  return token
    .replace(/(ies)$/, "y")
    .replace(/(sses|ches|shes|xes)$/, "")
    .replace(/(ing|edly|edly|ed|ly|es|s)$/, "")
    .replace(/(ation|ising|izing|ise|ize)$/, "")
    .slice(0, 12);
}

function scoreRelevance(query: string, title: string, snippet: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0.45;
  const titleL = title.toLowerCase();
  const haystack = `${title} ${snippet}`.toLowerCase();
  const hayStems = new Set(haystack.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).map(stem));

  // token-level overlap, exact preferred, stem as fallback
  let matched = 0;
  let titleHits = 0;
  for (const t of tokens) {
    const exact = haystack.includes(t);
    const stemmed = exact || hayStems.has(stem(t));
    if (stemmed) matched += exact ? 1 : 0.6;
    if (titleL.includes(t)) titleHits++;
  }
  const density = matched / tokens.length;
  const titleBoost = Math.min(0.22, titleHits * 0.06);

  // phrase bonus: reward contiguous query bigrams appearing verbatim
  let phraseBonus = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (haystack.includes(`${tokens[i]} ${tokens[i + 1]}`)) phraseBonus += 0.05;
  }
  phraseBonus = Math.min(0.16, phraseBonus);

  return Math.max(0.05, Math.min(0.98, density * 0.66 + titleBoost + phraseBonus));
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

// Conversational/advice/social questions ("how do I politely tell...",
// "what should I say to...") have no real academic literature behind them —
// Crossref/PubMed/arXiv/OpenAlex/SemanticScholar will only ever return noise
// for these (matched on a stray shared word, not real topical relevance).
// Detecting this upfront skips those calls entirely: cheaper, and it removes
// the noise at the source instead of relying solely on post-hoc filtering.
export function isConversationalQuery(query: string): boolean {
  return /\b(how (do|can|should) i|how to (politely|tactfully|nicely|kindly|gracefully)|politely|tactfully|gracefully|decline|say no to|turn down|wording|word this|what should i say|how should i (tell|say|word|phrase)|tell (him|her|them|someone)|break up with|apologi[sz]e to|ask (him|her|them) (out|for))\b/i.test(query);
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

  // Hard relevance gate: a high-authority/high-tier source on a topic the
  // query never actually touches (e.g. an astrophysics paper matched on the
  // single word "event" in an etiquette question) must NOT clear the
  // acceptance floor just because tier/authority/freshness are high. Without
  // this, the tier base score alone (0.3-0.54) can exceed RELIABILITY_FLOOR
  // regardless of how irrelevant the content actually is.
  const relevanceGate = Math.max(0.12, Math.min(1, (relevance - 0.08) / 0.32));
  reliability *= relevanceGate;

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

// Truncate at a word boundary with a visible "…" instead of a hard mid-word
// cut — a sliced-off "...total respons" looks broken and, worse, can read
// like a complete sentence to the claim extractor below since it never
// reaches a period.
function truncateClean(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

export async function arxivSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const xml = await safeText(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=6`);
  if (!xml) return [];
  return xml.split("<entry>").slice(1, 7)
    .map((entry) => ({
      title: (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled").replace(/\s+/g, " ").trim(),
      url: entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "",
      // No "arXiv: " label here — the source field already carries that, and
      // a literal "arXiv: " prefix would otherwise leak straight into any
      // quoted answer text.
      snippet: truncateClean((entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/\s+/g, " ").trim(), 220),
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
      snippet: `Year: ${it.year ?? "n/a"} | Citations: ${it.citationCount ?? 0} | ${truncateClean(String(it.abstract ?? ""), 200)}`,
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

// Free, no-API-key general-knowledge sources — widen coverage beyond academic/tech.

export async function duckDuckGoSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
  if (!data) return [];
  const out: Array<Omit<SourceItem, "reliability" | "tier">> = [];

  if (data.AbstractText && data.AbstractURL) {
    out.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
      source: "DuckDuckGo",
      publishedAt: null,
    });
  }

  for (const topic of (data.RelatedTopics ?? []).slice(0, 5)) {
    if (!topic?.FirstURL || !topic?.Text) continue;
    out.push({
      title: topic.Text.split(" - ")[0]?.slice(0, 90) || topic.Text.slice(0, 90),
      url: topic.FirstURL,
      snippet: topic.Text,
      source: "DuckDuckGo",
      publishedAt: null,
    });
  }

  return out;
}

export async function wikidataSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5`);
  return (data?.search ?? [])
    .map((it: any) => ({
      title: it.label ?? "Untitled",
      url: it.concepturi ?? (it.id ? `https://www.wikidata.org/wiki/${it.id}` : ""),
      snippet: it.description ?? "Wikidata entity",
      source: "Wikidata",
      publishedAt: null,
    }))
    .filter((it: any) => it.url);
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

export async function stackExchangeSources(query: string, site = "stackoverflow"): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&accepted=True&site=${site}&q=${encodeURIComponent(query)}&pagesize=5`);
  return (data?.items ?? [])
    .map((it: any) => ({
      title: it.title ?? "Untitled",
      url: it.link ?? "",
      snippet: `Score: ${it.score ?? 0} | Answers: ${it.answer_count ?? 0} | Created: ${it.creation_date ? new Date(it.creation_date * 1000).toISOString().slice(0, 10) : "n/a"}`,
      source: site === "stackoverflow" ? "StackOverflow" : `StackExchange/${site}`,
      publishedAt: it.creation_date ? new Date(it.creation_date * 1000).toISOString() : null,
    }))
    .filter((it: any) => it.url);
}

// Picks the Stack Exchange network site(s) actually likely to carry relevant
// content for this kind of question, instead of always defaulting to
// StackOverflow (tech-only — useless for "how do I tell someone..." questions).
export async function multiSiteStackExchangeSources(query: string, conversational: boolean): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const sites = conversational ? ["interpersonal", "workplace"] : ["stackoverflow"];
  const results = await Promise.all(sites.map((site) => stackExchangeSources(query, site)));
  return results.flat();
}

// Real human discussion/advice — the genuinely "open web" complement to the
// structured reference APIs above. Only worth the request for conversational
// questions; for factual/academic queries it's mostly noise.
export async function redditSources(query: string): Promise<Array<Omit<SourceItem, "reliability" | "tier">>> {
  const data = await safeJson<any>(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=6&sort=relevance`);
  return (data?.data?.children ?? [])
    .map((c: any) => {
      const d = c?.data ?? {};
      return {
        title: d.title ?? "Untitled",
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : (d.url ?? ""),
        snippet: `r/${d.subreddit ?? "unknown"} | Score: ${d.score ?? 0} | Comments: ${d.num_comments ?? 0} | ${truncateClean(String(d.selftext ?? ""), 200)}`,
        source: "Reddit",
        publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      };
    })
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

const AI_REVIEW_PROMPT = (query: string, sources: SourceItem[]) =>
  `Q: ${query}\nSources:\n${sources.slice(0, 10).map((s) => `- ${s.title} (${s.source}, rel ${s.reliability.toFixed(2)}): ${s.snippet.slice(0, 140)}`).join("\n")}\nReturn ONLY JSON: {"answer":"2-4 sentence synthesis","confidence":0.0}`;

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
          { role: "user", content: AI_REVIEW_PROMPT(query, sources) },
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
        messages: [{ role: "user", content: AI_REVIEW_PROMPT(query, sources) }],
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

export async function runGeminiReview(query: string, sources: SourceItem[]): Promise<ProviderReview | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: AI_REVIEW_PROMPT(query, sources) }] }],
        generationConfig: { temperature: 0.12, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);
    return { provider: "Gemini", answer: String(parsed.answer ?? ""), confidence: Number(parsed.confidence ?? 0.58) };
  } catch {
    return null;
  }
}

// Query every AI provider the user has a key configured for — never just
// one. Returns [] (zero cost) when no keys are set at all.
export async function runAllAvailableAiReviews(query: string, sources: SourceItem[]): Promise<ProviderReview[]> {
  const results = await Promise.all([
    runOpenAIReview(query, sources).catch(() => null),
    runAnthropicReview(query, sources).catch(() => null),
    runGeminiReview(query, sources).catch(() => null),
  ]);
  return results.filter((r): r is ProviderReview => Boolean(r && r.answer));
}

// Merge multiple independent AI answers into one clean lead statement —
// the answer text itself stays just the content, no hedge-text about which
// models were consulted. Cross-model AGREEMENT still matters, but it's
// expressed as a confidence adjustment (see computeConfidence) instead of
// prose stuffed into the answer, so the percentage is the honesty signal.
function mergeAiReviews(reviews: ProviderReview[]): { text: string; confidence: number } {
  const sorted = [...reviews].sort((a, b) => b.confidence - a.confidence);
  const lead = sorted[0];
  if (reviews.length === 1) return { text: lead.answer, confidence: lead.confidence };

  const leadTokens = new Set(
    lead.answer.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 5),
  );
  const agreeingCount = sorted.slice(1).filter((r) => {
    const tokens = new Set(r.answer.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 5));
    let overlap = 0;
    leadTokens.forEach((t) => { if (tokens.has(t)) overlap++; });
    return overlap / Math.max(1, Math.min(leadTokens.size, tokens.size)) >= 0.3;
  }).length;

  const avgConfidence = reviews.reduce((sum, r) => sum + r.confidence, 0) / reviews.length;
  const agreementRatio = agreeingCount / (reviews.length - 1);
  // Reward real cross-model agreement, penalize divergence — this is the
  // numeric form of "do the models actually corroborate each other."
  const confidence = Math.max(0.1, Math.min(0.97, avgConfidence + (agreementRatio - 0.5) * 0.16));
  return { text: lead.answer, confidence };
}

// How many distinct sources corroborate the same content tokens — a real
// signal that a claim is supported rather than appearing once.
function corroborationStrength(sources: SourceItem[]): number {
  if (sources.length < 2) return 0;
  const docTokens = sources.map(
    (s) =>
      new Set(
        `${s.title} ${s.snippet}`
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length >= 5 && !STOP_WORDS.has(t)),
      ),
  );
  const tokenDocCount: Record<string, number> = {};
  for (const set of docTokens) {
    for (const t of set) tokenDocCount[t] = (tokenDocCount[t] ?? 0) + 1;
  }
  const corroborated = Object.values(tokenDocCount).filter((c) => c >= 3).length;
  return Math.min(0.12, corroborated * 0.012);
}

// How many OTHER, distinct-provider sources echo the same significant tokens
// as a claim fragment — the basis for "curate into one synthesized truth"
// rather than just picking whichever source happens to rank highest.
function corroborationCountForClaim(claim: string, originSource: string, sources: SourceItem[]): number {
  const claimTokens = new Set(
    claim.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 5 && !STOP_WORDS.has(t)),
  );
  if (claimTokens.size === 0) return 0;
  const seenProviders = new Set<string>();
  for (const s of sources) {
    if (s.source === originSource || seenProviders.has(s.source)) continue;
    const text = `${s.title} ${s.snippet}`.toLowerCase();
    const hits = [...claimTokens].filter((t) => text.includes(t)).length;
    if (hits / claimTokens.size >= 0.5) seenProviders.add(s.source);
  }
  return seenProviders.size;
}

// Pull the most query-relevant, most cross-source-corroborated sentence
// fragments to ground the answer in actual source content instead of just
// echoing a single provider's wording.
function extractClaims(query: string, sources: SourceItem[], limit = 3): Array<{ text: string; corroboration: number }> {
  const qTokens = queryTokens(query);
  if (qTokens.length === 0) return [];
  const candidates: Array<{ text: string; score: number; source: string }> = [];

  // Only pull claims from sources that are themselves topically on-target —
  // a single coincidental word shared with an off-topic high-authority paper
  // (e.g. "event" matching a gravitational-wave detection paper) must not be
  // promoted into the headline answer just because that source ranks high.
  for (const s of sources.filter((x) => (x.relevance ?? 0) >= 0.3).slice(0, 14)) {
    const sentences = s.snippet
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+|\s\|\s/)
      .map((x) => x.trim())
      // Require real terminal punctuation — a fragment with none is either
      // mid-truncation or a metadata label, not a complete, quotable claim.
      .filter((x) => x.length >= 24 && x.length <= 240 && /[a-z]{4,}/i.test(x) && /[.!?]$/.test(x));
    for (const sent of sentences) {
      const low = sent.toLowerCase();
      const hits = qTokens.filter((t) => low.includes(t) || low.includes(stem(t))).length;
      // Require a real fraction of the query's meaningful words to appear,
      // not just one — one shared word out of eight is noise, not a claim.
      if (hits / qTokens.length < 0.34) continue;
      // weight by query overlap and the source's reliability
      const score = (hits / qTokens.length) * 0.7 + s.reliability * 0.3;
      candidates.push({ text: sent, score, source: s.source });
    }
  }

  const scored = candidates.map((c) => ({
    ...c,
    corroboration: corroborationCountForClaim(c.text, c.source, sources),
  }));

  const out: Array<{ text: string; corroboration: number }> = [];
  const seen = new Set<string>();
  // Corroborated claims (echoed by other providers) win over a single
  // source's highest-relevance sentence — this is the "curated truth" pass.
  for (const c of scored.sort((a, b) => (b.score + b.corroboration * 0.15) - (a.score + a.corroboration * 0.15))) {
    const key = c.text.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: c.text, corroboration: c.corroboration });
    if (out.length >= limit) break;
  }
  return out;
}

function sourceDiversityBoost(sources: SourceItem[]): number {
  const distinct = new Set(sources.map((s) => s.source)).size;
  return Math.min(0.12, distinct * 0.017);
}

// The Answer box shows ONLY the direct answer — no provider names, source
// counts, or "Across X, Y converge on..." narration. How much to trust it
// is the confidence percentage's job (see computeConfidence), not prose
// hedging stuffed into the answer text itself.
export function buildShortAnswer(
  query: string,
  sources: SourceItem[],
  isPartial = false,
  reviews: ProviderReview[] = [],
): string {
  const sorted = [...sources].sort((a, b) => b.reliability - a.reliability);
  const wellMatched = sorted.filter((s) => (s.relevance ?? 0) >= 0.3);

  // Multi-model AI cross-check — only runs when the user has their own
  // key(s) configured. This is exactly the path that rescues
  // conversational/advice questions the free databases alone have no real
  // material for.
  if (reviews.length > 0) {
    return `${mergeAiReviews(reviews).text}${isPartial ? " [Refining...]" : ""}`;
  }

  if (sources.length === 0) return `Searching for "${query}"…`;

  // Honesty check: if nothing in the whole pool is actually on-topic, say so
  // plainly — no fabricated sentence out of tangential keyword matches. This
  // matters most for conversational/advice questions ("how do I politely
  // tell a venue...") that academic and reference databases simply don't
  // carry good material for.
  if (wellMatched.length === 0) {
    return `I don't have reliable evidence to answer this — the free sources this engine searches didn't return anything genuinely on-topic for "${query}".${isPartial ? " Still searching…" : ""}`;
  }

  // Curate one direct answer out of the free sources: prefer claims that
  // multiple distinct providers independently echo over a single source's
  // wording — this is the "merge into one version of the truth" pass.
  const claims = extractClaims(query, sorted, 2);
  if (claims.length === 0) {
    return `Found sources related to "${query}", but nothing specific enough to quote as a direct answer — see the sources below for the full content.${isPartial ? " Still searching…" : ""}`;
  }

  const lead = claims[0].text;
  const second = claims[1] && claims[1].text.toLowerCase() !== lead.toLowerCase() ? ` ${claims[1].text}` : "";
  return `${lead}${second}${isPartial ? " [Refining…]" : ""}`;
}

export function computeConfidence(sources: SourceItem[], query?: string, reviews: ProviderReview[] = []): number {
  if (sources.length === 0 && reviews.length === 0) return 0.22;
  const predictive = predictiveRisk(query ?? "");

  const top = [...sources].sort((a, b) => b.reliability - a.reliability).slice(0, 10);
  const srcReliability = top.length > 0 ? top.reduce((sum, s) => sum + s.reliability, 0) / top.length : 0.3;
  const srcFreshness = top.length > 0 ? top.reduce((sum, s) => sum + (s.freshness ?? 0.4), 0) / top.length : 0.4;
  const avgRelevance = top.length > 0 ? top.reduce((sum, s) => sum + (s.relevance ?? 0), 0) / top.length : 0;
  const conf0 =
    srcReliability * 0.6 +
    srcFreshness * 0.22 +
    sourceDiversityBoost(top) +
    corroborationStrength(top);

  let conf = conf0;
  if (reviews.length > 0) {
    // AI cross-check available: blend free-evidence confidence with the
    // models' own (already adjusted for cross-model agreement/divergence in
    // mergeAiReviews) — both matter, neither alone overrides the other.
    const aiConf = mergeAiReviews(reviews).confidence;
    conf = conf0 * 0.45 + aiConf * 0.55;
  } else if (avgRelevance < 0.28) {
    // Don't let a confident-looking badge survive on tangentially-matched
    // sources — if the top sources aren't actually on-topic, neither is the answer.
    conf = Math.min(conf, 0.32);
  }
  if (predictive) conf *= 0.84;
  return Math.max(0.14, Math.min(predictive ? 0.78 : 0.96, conf));
}

export function buildReport(sources: SourceItem[], stopReason: string, query?: string, reviews: ProviderReview[] = []): ResearchReport {
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
    aiProvidersConsulted: reviews.map((r) => r.provider),
  };
}
