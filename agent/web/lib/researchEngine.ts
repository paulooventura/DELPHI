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

// ════════════════════════════════════════════════════════════════════════════
// DELPHI Research Engine v2 — tier is a runtime parameter (see build spec §1)
//
// The caller passes a ResearchTier; the engine maps it (via TIER_CONFIG, not
// branching logic) to a set of provider calls + a budget, runs the same
// decompose → cross-reference → independence-dedup → fact-anchor → score →
// synthesize pipeline for every tier, and returns a ConfidenceResult plus a
// full transparency layer.
//
// The two free tiers (`instant`, `standard`) run entirely on free, mostly
// no-auth APIs and must produce a discerning, cross-referenced answer with
// ZERO keys configured. Paid deep-research (Valyu + Perplexity) is an opt-in
// enhancement layered on top, never a gate on basic reliability.
// ════════════════════════════════════════════════════════════════════════════

export type ResearchTier = "instant" | "standard" | "deep" | "max";

export interface ResearchRequest {
  query: string;
  tier: ResearchTier;
  domainFilter?: string[];
  recency?: "day" | "week" | "month" | "year" | "any";
  academicOnly?: boolean;
  maxBudgetUSD?: number;
}

export interface SourceResult {
  url: string;
  title: string;
  snippet: string;
  fullText?: string;
  publishedDate?: string;
  author?: string;
  domain: string;
  providerTier: 1 | 2 | 3 | 4;
  citationCount?: number;
  raw?: unknown;
}

export interface SearchAdapter {
  name: string;
  baseTier: 1 | 2 | 3 | 4;
  search(req: ResearchRequest): Promise<SourceResult[]>;
}

export interface SynthesisAdapter {
  name: string;
  research(req: ResearchRequest): Promise<{
    report: string;
    sources: SourceResult[];
    raw: unknown;
  }>;
}

export type ConfidenceLabel = "Verified" | "Likely" | "Contested" | "Unsupported";

export interface ScoredClaim {
  text: string;
  score: number;
  label: ConfidenceLabel;
  supportingSources: SourceResult[];
  contradictingSources: SourceResult[];
}

export interface ConfidenceResult {
  answer: string;
  confidenceLabel: ConfidenceLabel;
  confidenceScore: number; // 0–1
  claims: ScoredClaim[];
  sources: SourceResult[]; // ranked, deduped
  contradictions: string[]; // surfaced, not hidden
  tierUsed: ResearchTier;
  costUSD: number; // summed from provider responses
  providersUsed: string[];
  // Transparency extras the cycle-wheel UI can render but that aren't part of
  // the minimal §6 contract.
  notes: string[];
  subClaims: string[];
}

// ── §3 trust tiers → base weights. Single source of truth for scoring.
export const TRUST_TIER_WEIGHTS: Record<1 | 2 | 3 | 4, number> = {
  1: 1.0, // primary / peer-reviewed / verified (Wikidata facts, OpenAlex, PubMed…)
  2: 0.75, // reference / curated (Wikipedia + its citations, official docs…)
  3: 0.5, // general web, independent indexes (DuckDuckGo, Mojeek, Serper, Exa)
  4: 0.2, // low-trust signal (blogs, forums, Reddit) — never clears alone
};

// arXiv etc. are preprints: Tier 1 reach, but not-yet-peer-reviewed, so a small
// discount vs. published Tier-1 work.
const PREPRINT_TRUST_FACTOR = 0.9;

// ── §1 tier → behavior map, made data-driven so tiers are tunable without
// touching core flow. `searchAdapters` / `synthAdapters` reference adapter
// names registered below; unavailable (key-gated) ones are simply skipped.
export interface TierConfig {
  label: string;
  latencyHint: string;
  searchAdapters: string[];
  synthAdapters: string[]; // paid; only fire when key present AND tier allows
  maxResultsPerAdapter: number;
  fullPipeline: boolean; // decompose + cross-ref (standard+) vs single-pass
  factAnchor: boolean; // run Wikidata structured-fact anchoring
  approxCostUSD: number;
  defaultBudgetUSD: number;
  valyuMode?: "fast" | "standard" | "heavy" | "max";
}

export const TIER_CONFIG: Record<ResearchTier, TierConfig> = {
  instant: {
    label: "Instant",
    latencyHint: "~1–3s",
    searchAdapters: ["Wikidata", "Wikipedia", "DuckDuckGo", "OpenAlex"],
    synthAdapters: [],
    maxResultsPerAdapter: 5,
    fullPipeline: false,
    factAnchor: true,
    approxCostUSD: 0,
    defaultBudgetUSD: 0,
  },
  standard: {
    label: "Standard",
    latencyHint: "~5–15s",
    searchAdapters: [
      "Wikidata",
      "Wikipedia",
      "OpenAlex",
      "SemanticScholar",
      "Crossref",
      "EuropePMC",
      "arXiv",
      "DuckDuckGo",
      "Mojeek",
      "Serper",
    ],
    synthAdapters: [],
    maxResultsPerAdapter: 8,
    fullPipeline: true,
    factAnchor: true,
    approxCostUSD: 0,
    defaultBudgetUSD: 0.01, // covers an optional Serper key if the user adds one
  },
  deep: {
    label: "Deep",
    latencyHint: "~1–5 min",
    searchAdapters: [
      "Wikidata",
      "Wikipedia",
      "OpenAlex",
      "SemanticScholar",
      "Crossref",
      "EuropePMC",
      "arXiv",
      "DuckDuckGo",
      "Mojeek",
      "Serper",
      "Exa",
    ],
    synthAdapters: ["Valyu", "Perplexity"],
    maxResultsPerAdapter: 10,
    fullPipeline: true,
    factAnchor: true,
    approxCostUSD: 3.0,
    defaultBudgetUSD: 4.0,
    valyuMode: "heavy",
  },
  max: {
    label: "Max",
    latencyHint: "~3–10 min",
    searchAdapters: [
      "Wikidata",
      "Wikipedia",
      "OpenAlex",
      "SemanticScholar",
      "Crossref",
      "EuropePMC",
      "arXiv",
      "DuckDuckGo",
      "Mojeek",
      "Serper",
      "Exa",
    ],
    synthAdapters: ["Valyu", "Perplexity"],
    maxResultsPerAdapter: 12,
    fullPipeline: true,
    factAnchor: true,
    approxCostUSD: 15.0,
    defaultBudgetUSD: 20.0,
    valyuMode: "max",
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Small shared utilities for the v2 pipeline
// ──────────────────────────────────────────────────────────────────────────

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP_WORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(Number(m[0].replace(/,/g, "")));
  return out;
}

function extractYears(text: string): number[] {
  const out: number[] = [];
  const re = /\b(1[5-9]\d{2}|20\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(Number(m[1]));
  return out;
}

const NEGATION_RE = /\b(not|no longer|never|false|incorrect|debunk(?:ed|s)?|myth|hoax|disprov(?:e|ed|en)|refut(?:e|ed|es)|contrary|disput(?:e|ed)|wrong|unfounded)\b/i;

// Is this a volatile/time-sensitive topic (→ recency decay) or a settled fact
// (→ ~neutral recency)? Cheap classifier from query shape.
function isVolatileQuery(query: string): boolean {
  return (
    predictiveRisk(query) ||
    /\b(current|currently|latest|recent|now|today|this year|2024|2025|2026|price|stock|release|update|version|news|trend|live)\b/i.test(
      query,
    )
  );
}

function recencyFactor(ageDays: number | null, volatile: boolean): number {
  if (!volatile) return ageDays != null && ageDays > 3650 ? 0.9 : 1; // settled facts barely decay
  if (ageDays == null) return 0.7;
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.85;
  if (ageDays <= 365) return 0.7;
  if (ageDays <= 730) return 0.5;
  return 0.32;
}

// log-scaled citation authority (Tier-1 only). influentialCitationCount, when
// present, is a stronger authority signal than raw counts.
function citationBoost(src: SourceResult): number {
  if (src.providerTier !== 1) return 1;
  const influential =
    typeof (src.raw as Record<string, unknown>)?.influentialCitationCount === "number"
      ? ((src.raw as Record<string, unknown>).influentialCitationCount as number)
      : 0;
  const cited = src.citationCount ?? 0;
  const base = Math.log10(1 + cited) * 0.12;
  const infl = Math.log10(1 + influential) * 0.18;
  return 1 + Math.min(0.6, base + infl);
}

function ageDaysOf(src: SourceResult): number | null {
  return ageInDays(src.publishedDate ?? null);
}

// ──────────────────────────────────────────────────────────────────────────
// §2A Free evidence stack — search adapters (SourceResult shape, no keys)
// ──────────────────────────────────────────────────────────────────────────

const POLITE_MAILTO = process.env.RESEARCH_CONTACT_EMAIL ?? "research@delphi.app";

function clip<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

// Layer 1 — Wikidata entity search (the fact anchor lives in wikidataFacts()).
const wikidataAdapter: SearchAdapter = {
  name: "Wikidata",
  baseTier: 1,
  async search(req) {
    const data = await safeJson<any>(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
        req.query,
      )}&language=en&format=json&origin=*&limit=${TIER_CONFIG[req.tier].maxResultsPerAdapter}`,
    );
    return (data?.search ?? [])
      .map((it: any): SourceResult => {
        const url = it.concepturi ?? (it.id ? `https://www.wikidata.org/wiki/${it.id}` : "");
        return {
          url,
          title: it.label ?? "Untitled",
          snippet: it.description ?? "Wikidata entity",
          domain: "wikidata.org",
          providerTier: 1,
          raw: { ...it, structured: true },
        };
      })
      .filter((s: SourceResult) => s.url);
  },
};

// Known hard-fact properties → human labels, so the anchor surfaces real
// typed statements (dates, quantities) rather than opaque P-numbers.
const WIKIDATA_PROPS: Record<string, string> = {
  P569: "date of birth",
  P570: "date of death",
  P571: "inception",
  P576: "dissolved/abolished",
  P577: "publication date",
  P580: "start time",
  P582: "end time",
  P585: "point in time",
  P1082: "population",
  P2046: "area (km²)",
  P2044: "elevation (m)",
  P1083: "capacity",
  P1128: "employees",
  P2139: "total revenue",
};

export interface AnchorFact {
  entity: string;
  property: string;
  value: string;
  numeric: number | null;
  year: number | null;
  url: string;
}

function decodeWikidataValue(snak: any): { text: string; numeric: number | null; year: number | null } | null {
  const dv = snak?.mainsnak?.datavalue;
  if (!dv) return null;
  if (dv.type === "time" && typeof dv.value?.time === "string") {
    const yMatch = dv.value.time.match(/([+-]\d{1,})-(\d{2})-(\d{2})/);
    const year = yMatch ? Number(yMatch[1]) : null;
    return { text: dv.value.time.replace(/^\+/, "").slice(0, 10), numeric: null, year };
  }
  if (dv.type === "quantity" && dv.value?.amount != null) {
    const amount = Number(String(dv.value.amount).replace(/^\+/, ""));
    return { text: String(amount), numeric: Number.isFinite(amount) ? amount : null, year: null };
  }
  return null;
}

// Wikidata structured-fact anchor (§5 fact-anchor rule). Pulls typed
// statements for the best-matching entity to ground hard facts before trusting
// prose about them. Returns both readable AnchorFacts and SourceResults so the
// facts participate in normal scoring/corroboration.
export async function wikidataFacts(
  query: string,
): Promise<{ facts: AnchorFact[]; sources: SourceResult[] }> {
  const search = await safeJson<any>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      query,
    )}&language=en&format=json&origin=*&limit=1`,
  );
  const top = search?.search?.[0];
  if (!top?.id) return { facts: [], sources: [] };

  const entityData = await safeJson<any>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${top.id}&props=claims|labels|descriptions&languages=en&format=json&origin=*`,
  );
  const entity = entityData?.entities?.[top.id];
  if (!entity) return { facts: [], sources: [] };
  const entityLabel = entity.labels?.en?.value ?? top.label ?? top.id;
  const url = `https://www.wikidata.org/wiki/${top.id}`;
  const facts: AnchorFact[] = [];

  for (const [prop, propLabel] of Object.entries(WIKIDATA_PROPS)) {
    const statements = entity.claims?.[prop];
    if (!Array.isArray(statements) || statements.length === 0) continue;
    const decoded = decodeWikidataValue(statements[0]);
    if (!decoded) continue;
    facts.push({
      entity: entityLabel,
      property: propLabel,
      value: decoded.text,
      numeric: decoded.numeric,
      year: decoded.year,
      url,
    });
  }

  const sources: SourceResult[] = facts.map((f) => ({
    url: f.url,
    title: `${f.entity} — ${f.property}`,
    snippet: `${f.entity} ${f.property}: ${f.value}`,
    domain: "wikidata.org",
    providerTier: 1,
    raw: { anchor: true, structured: true, fact: f },
  }));

  return { facts, sources };
}

// Layer 1 — Wikipedia REST summary + search (Tier 2 reference layer).
const wikipediaAdapter: SearchAdapter = {
  name: "Wikipedia",
  baseTier: 2,
  async search(req) {
    const limit = TIER_CONFIG[req.tier].maxResultsPerAdapter;
    const data = await safeJson<any>(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(req.query)}&limit=${limit}`,
    );
    return (data?.pages ?? []).map((p: any): SourceResult => ({
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, "_"))}`,
      title: p.title,
      snippet: p.description ?? p.excerpt?.replace(/<[^>]+>/g, "") ?? "Wikipedia article",
      domain: "en.wikipedia.org",
      providerTier: 2,
      raw: p,
    }));
  },
};

// Layer 2 — peer-reviewed academia (all free, citation-weighted).
const openAlexAdapter: SearchAdapter = {
  name: "OpenAlex",
  baseTier: 1,
  async search(req) {
    const limit = TIER_CONFIG[req.tier].maxResultsPerAdapter;
    const data = await safeJson<any>(
      `https://api.openalex.org/works?search=${encodeURIComponent(
        req.query,
      )}&per-page=${limit}&sort=relevance_score:desc&mailto=${encodeURIComponent(POLITE_MAILTO)}`,
    );
    return (data?.results ?? [])
      .map((it: any): SourceResult => ({
        url: it.doi ?? it.id ?? "",
        title: it.display_name ?? "Untitled",
        snippet: `Cited by ${it.cited_by_count ?? 0} · ${it.publication_year ?? "n/a"} · OA: ${
          it.open_access?.is_oa ? "yes" : "no"
        }`,
        publishedDate: it.publication_date ?? (it.publication_year ? `${it.publication_year}-07-01` : undefined),
        domain: domainOf(it.doi ?? it.id ?? "") || "openalex.org",
        providerTier: 1,
        citationCount: it.cited_by_count ?? 0,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

const semanticScholarAdapter: SearchAdapter = {
  name: "SemanticScholar",
  baseTier: 1,
  async search(req) {
    const limit = TIER_CONFIG[req.tier].maxResultsPerAdapter;
    const data = await safeJson<any>(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        req.query,
      )}&limit=${limit}&fields=title,abstract,citationCount,influentialCitationCount,year,authors,openAccessPdf,url`,
    );
    return (data?.data ?? [])
      .map((it: any): SourceResult => ({
        url: it.openAccessPdf?.url ?? it.url ?? "",
        title: it.title ?? "Untitled",
        snippet: `${it.year ?? "n/a"} · cited ${it.citationCount ?? 0} (influential ${
          it.influentialCitationCount ?? 0
        }) · ${truncateClean(String(it.abstract ?? ""), 180)}`,
        publishedDate: it.year ? `${it.year}-07-01` : undefined,
        author: Array.isArray(it.authors) && it.authors[0]?.name ? it.authors[0].name : undefined,
        domain: domainOf(it.url ?? "") || "semanticscholar.org",
        providerTier: 1,
        citationCount: it.citationCount ?? 0,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

const crossrefAdapter: SearchAdapter = {
  name: "Crossref",
  baseTier: 1,
  async search(req) {
    const limit = TIER_CONFIG[req.tier].maxResultsPerAdapter;
    const data = await safeJson<any>(
      `https://api.crossref.org/works?query=${encodeURIComponent(req.query)}&rows=${limit}&sort=relevance&mailto=${encodeURIComponent(
        POLITE_MAILTO,
      )}`,
    );
    return (data?.message?.items ?? [])
      .map((it: any): SourceResult => ({
        url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : ""),
        title: Array.isArray(it.title) ? it.title[0] : it.title ?? "Untitled",
        snippet: `${(it["container-title"] ?? [])[0] ?? "DOI"} · cited ${it["is-referenced-by-count"] ?? 0} · ${
          it.created?.["date-time"]?.slice(0, 10) ?? "n/a"
        }`,
        publishedDate: it.created?.["date-time"] ?? undefined,
        domain: "doi.org",
        providerTier: 1,
        citationCount: it["is-referenced-by-count"] ?? 0,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

const europePmcAdapter: SearchAdapter = {
  name: "EuropePMC",
  baseTier: 1,
  async search(req) {
    const limit = TIER_CONFIG[req.tier].maxResultsPerAdapter;
    const data = await safeJson<any>(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
        req.query,
      )}&format=json&pageSize=${limit}`,
    );
    return (data?.resultList?.result ?? [])
      .map((it: any): SourceResult => ({
        url: it.doi
          ? `https://doi.org/${it.doi}`
          : it.pmid
            ? `https://europepmc.org/article/MED/${it.pmid}`
            : "",
        title: it.title ?? "Untitled",
        snippet: `${it.journalTitle ?? "Europe PMC"} · ${it.pubYear ?? "n/a"} · cited ${it.citedByCount ?? 0}`,
        publishedDate: it.firstPublicationDate ?? (it.pubYear ? `${it.pubYear}-07-01` : undefined),
        author: it.authorString,
        domain: it.doi ? "doi.org" : "europepmc.org",
        providerTier: 1,
        citationCount: it.citedByCount ?? 0,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

const arxivAdapter: SearchAdapter = {
  name: "arXiv",
  baseTier: 1,
  async search(req) {
    const limit = TIER_CONFIG[req.tier].maxResultsPerAdapter;
    const xml = await safeText(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(req.query)}&start=0&max_results=${limit}`,
    );
    if (!xml) return [];
    return xml
      .split("<entry>")
      .slice(1)
      .map((entry): SourceResult => {
        const url = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "";
        const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim();
        return {
          url,
          title: (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled").replace(/\s+/g, " ").trim(),
          snippet: truncateClean(
            (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/\s+/g, " ").trim(),
            200,
          ),
          publishedDate: published,
          domain: "arxiv.org",
          providerTier: 1,
          raw: { preprint: true },
        };
      })
      .filter((s) => s.url);
  },
};

// Layer 3 — raw web "noise" (independent indexes, low base trust).
const duckDuckGoAdapter: SearchAdapter = {
  name: "DuckDuckGo",
  baseTier: 3,
  async search(req) {
    const data = await safeJson<any>(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(req.query)}&format=json&no_html=1&skip_disambig=1`,
    );
    if (!data) return [];
    const out: SourceResult[] = [];
    if (data.AbstractText && data.AbstractURL) {
      out.push({
        url: data.AbstractURL,
        title: data.Heading || req.query,
        snippet: data.AbstractText,
        domain: domainOf(data.AbstractURL) || "duckduckgo.com",
        providerTier: 3,
        raw: { instantAnswer: true },
      });
    }
    for (const topic of (data.RelatedTopics ?? []).slice(0, TIER_CONFIG[req.tier].maxResultsPerAdapter)) {
      if (!topic?.FirstURL || !topic?.Text) continue;
      out.push({
        url: topic.FirstURL,
        title: String(topic.Text).split(" - ")[0]?.slice(0, 90) || String(topic.Text).slice(0, 90),
        snippet: topic.Text,
        domain: domainOf(topic.FirstURL),
        // Reddit/forum results captured here are practitioner/contrarian signal.
        providerTier: /reddit\.com|forum|blogspot|medium\.com|quora\.com/.test(domainOf(topic.FirstURL)) ? 4 : 3,
        raw: topic,
      });
    }
    return out;
  },
};

// Mojeek — genuinely independent crawler (not Google/Bing-derived), so it's a
// real second web signal for §4 independence counting. Free dev key.
const mojeekAdapter: SearchAdapter = {
  name: "Mojeek",
  baseTier: 3,
  async search(req) {
    const key = process.env.MOJEEK_API_KEY;
    if (!key) return [];
    const data = await safeJson<any>(
      `https://www.mojeek.com/search?q=${encodeURIComponent(req.query)}&api_key=${key}&fmt=json`,
    );
    return (data?.response?.results ?? [])
      .slice(0, TIER_CONFIG[req.tier].maxResultsPerAdapter)
      .map((it: any): SourceResult => ({
        url: it.url ?? "",
        title: it.title ?? "Untitled",
        snippet: it.desc ?? it.snippet ?? "",
        domain: domainOf(it.url ?? ""),
        providerTier: 3,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

// General web (Tier 3) — cheap raw retrieval, key-gated. Skipped (no cost) when
// the user hasn't configured a key, so the free tiers stay $0.
const serperAdapter: SearchAdapter = {
  name: "Serper",
  baseTier: 3,
  async search(req) {
    const key = process.env.SERPER_API_KEY;
    if (!key) return [];
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({ q: req.query, num: TIER_CONFIG[req.tier].maxResultsPerAdapter }),
    }).catch(() => null);
    if (!res || !res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return (data?.organic ?? [])
      .map((it: any): SourceResult => ({
        url: it.link ?? "",
        title: it.title ?? "Untitled",
        snippet: it.snippet ?? "",
        publishedDate: it.date ?? undefined,
        domain: domainOf(it.link ?? ""),
        providerTier: 3,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

const exaAdapter: SearchAdapter = {
  name: "Exa",
  baseTier: 3,
  async search(req) {
    const key = process.env.EXA_API_KEY;
    if (!key) return [];
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        query: req.query,
        numResults: TIER_CONFIG[req.tier].maxResultsPerAdapter,
        contents: { text: { maxCharacters: 600 } },
      }),
    }).catch(() => null);
    if (!res || !res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return (data?.results ?? [])
      .map((it: any): SourceResult => ({
        url: it.url ?? "",
        title: it.title ?? "Untitled",
        snippet: (it.text ?? it.snippet ?? "").slice(0, 400),
        publishedDate: it.publishedDate ?? undefined,
        author: it.author ?? undefined,
        domain: domainOf(it.url ?? ""),
        providerTier: 3,
        raw: it,
      }))
      .filter((s: SourceResult) => s.url);
  },
};

export const SEARCH_ADAPTERS: Record<string, SearchAdapter> = {
  Wikidata: wikidataAdapter,
  Wikipedia: wikipediaAdapter,
  OpenAlex: openAlexAdapter,
  SemanticScholar: semanticScholarAdapter,
  Crossref: crossrefAdapter,
  EuropePMC: europePmcAdapter,
  arXiv: arxivAdapter,
  DuckDuckGo: duckDuckGoAdapter,
  Mojeek: mojeekAdapter,
  Serper: serperAdapter,
  Exa: exaAdapter,
};

// ──────────────────────────────────────────────────────────────────────────
// §2 Paid synthesis adapters — second independent synthesizers (key-gated)
// ──────────────────────────────────────────────────────────────────────────

export interface SynthesisRun {
  name: string;
  report: string;
  sources: SourceResult[];
  costUSD: number;
  raw: unknown;
}

// Valyu DeepResearch — async: submit task then poll. Returns markdown report +
// sources + total_deduction_dollars (used for budget enforcement).
export async function runValyu(req: ResearchRequest, budgetRemaining: number): Promise<SynthesisRun | null> {
  const key = process.env.VALYU_API_KEY;
  if (!key) return null;
  const cfg = TIER_CONFIG[req.tier];
  const base = process.env.VALYU_API_BASE ?? "https://api.valyu.network";
  try {
    const create = await fetch(`${base}/v1/deepresearch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ query: req.query, mode: cfg.valyuMode ?? "heavy" }),
    });
    if (!create.ok) return null;
    const task: any = await create.json();
    const taskId = task?.id ?? task?.task_id;
    if (!taskId) return null;

    // Poll until complete (or budget/time gives out). DeepResearch is heavy.
    const deadline = Date.now() + (req.tier === "max" ? 9 * 60_000 : 5 * 60_000);
    let result: any = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(`${base}/v1/deepresearch/${taskId}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!poll || !poll.ok) continue;
      const body: any = await poll.json().catch(() => null);
      const status = body?.status;
      if (status === "completed" || status === "success" || body?.result) {
        result = body;
        break;
      }
      if (status === "failed" || status === "error") return null;
    }
    if (!result) return null;

    const cost = Number(result?.total_deduction_dollars ?? result?.cost ?? cfg.approxCostUSD);
    if (cost > budgetRemaining) {
      return { name: "Valyu", report: "", sources: [], costUSD: cost, raw: { abortedOverBudget: true } };
    }
    const report = String(result?.result?.report ?? result?.report ?? result?.answer ?? "");
    const sources: SourceResult[] = (result?.result?.sources ?? result?.sources ?? [])
      .map((s: any): SourceResult => ({
        url: s.url ?? "",
        title: s.title ?? "Valyu source",
        snippet: (s.content ?? s.snippet ?? "").slice(0, 400),
        domain: domainOf(s.url ?? "") || "valyu.network",
        providerTier: s.proprietary ? 1 : 3,
        raw: s,
      }))
      .filter((s: SourceResult) => s.url);
    return { name: "Valyu", report, sources, costUSD: cost, raw: result };
  } catch {
    return null;
  }
}

// Perplexity Sonar — OpenAI-compatible; second independent synthesizer.
export async function runPerplexity(req: ResearchRequest, budgetRemaining: number): Promise<SynthesisRun | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  try {
    const model = req.tier === "max" ? "sonar-deep-research" : "sonar-reasoning-pro";
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(req.tier === "max" ? 8 * 60_000 : 3 * 60_000),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: req.query }],
        search_context_size: "high",
        search_recency_filter: req.recency && req.recency !== "any" ? req.recency : undefined,
        search_domain_filter: req.domainFilter,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const cost = Number(data?.usage?.cost?.total_cost ?? 0);
    if (cost > budgetRemaining) {
      return { name: "Perplexity", report: "", sources: [], costUSD: cost, raw: { abortedOverBudget: true } };
    }
    const report = String(data?.choices?.[0]?.message?.content ?? "");
    const searchResults = data?.search_results ?? data?.citations ?? [];
    const sources: SourceResult[] = (Array.isArray(searchResults) ? searchResults : [])
      .map((s: any): SourceResult => {
        const url = typeof s === "string" ? s : (s.url ?? "");
        return {
          url,
          title: typeof s === "string" ? domainOf(s) : (s.title ?? domainOf(url)),
          snippet: typeof s === "string" ? "" : (s.snippet ?? s.date ?? ""),
          publishedDate: typeof s === "string" ? undefined : s.date,
          domain: domainOf(url),
          providerTier: 3,
          raw: s,
        };
      })
      .filter((s: SourceResult) => s.url);
    return { name: "Perplexity", report, sources, costUSD: cost, raw: data };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// §4 Pipeline — decompose → fetch → dedup → cross-ref → fact-anchor → score
// ──────────────────────────────────────────────────────────────────────────

// 1. Decompose into atomic verifiable sub-claims. Uses an Anthropic call when a
// key is present; otherwise a heuristic split so the free tiers work with ZERO
// keys configured.
export async function decomposeQuery(query: string): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          model: process.env.ANTHROPIC_DECOMPOSE_MODEL ?? "claude-sonnet-4-6",
          max_tokens: 400,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: `Decompose this question into 2-5 atomic, independently verifiable sub-claims. Return ONLY a JSON array of strings.\n\nQuestion: ${query}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const json: any = await res.json();
        const text = json?.content?.[0]?.text ?? "[]";
        const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
        if (Array.isArray(arr) && arr.length) return arr.map(String).slice(0, 5);
      }
    } catch {
      // fall through to heuristic
    }
  }
  return heuristicDecompose(query);
}

function heuristicDecompose(query: string): string[] {
  const parts = query
    .split(/(?:\?|\.|;|\band\b|\bvs\.?\b|\bversus\b|,)/i)
    .map((p) => p.trim())
    .filter((p) => queryTokens(p).length >= 2);
  const unique = Array.from(new Set([query.trim(), ...parts]));
  return unique.slice(0, 5);
}

// 2. Parallel fetch, Promise.allSettled — one dead source never kills the run.
export async function fetchAllSources(
  req: ResearchRequest,
  adapterNames: string[],
): Promise<{ sources: SourceResult[]; providersUsed: string[]; failures: string[] }> {
  const adapters = adapterNames
    .map((n) => SEARCH_ADAPTERS[n])
    .filter((a): a is SearchAdapter => Boolean(a))
    .filter((a) => !(req.academicOnly && a.baseTier !== 1));

  const settled = await Promise.allSettled(adapters.map((a) => a.search(req)));
  const sources: SourceResult[] = [];
  const providersUsed: string[] = [];
  const failures: string[] = [];

  settled.forEach((r, i) => {
    const name = adapters[i].name;
    if (r.status === "fulfilled" && r.value.length > 0) {
      providersUsed.push(name);
      for (const s of r.value) sources.push(s);
    } else if (r.status === "rejected") {
      failures.push(name);
    }
  });

  let filtered = sources.filter((s) => s.url);
  if (req.domainFilter && req.domainFilter.length) {
    filtered = filtered.filter((s) => req.domainFilter!.some((d) => s.domain.includes(d.replace(/^www\./, ""))));
  }
  return { sources: filtered, providersUsed, failures };
}

// 5. Independence dedup — collapse syndicated/copied content and compute an
// independenceFactor per source. Sources sharing a domain or near-identical
// text form one "origin group"; each member's weight is divided across the
// group so "10 copies of one story" can't masquerade as 10 corroborations.
export function independenceDedup(sources: SourceResult[]): {
  deduped: SourceResult[];
  independence: Map<string, number>;
} {
  const groups: { key: string; tokens: Set<string>; members: SourceResult[] }[] = [];
  for (const s of sources) {
    const tokens = contentTokens(`${s.title} ${s.snippet}`);
    const existing = groups.find(
      (g) => g.members[0].domain === s.domain || jaccard(g.tokens, tokens) >= 0.8,
    );
    if (existing) existing.members.push(s);
    else groups.push({ key: s.url, tokens, members: [s] });
  }

  const independence = new Map<string, number>();
  const deduped: SourceResult[] = [];
  for (const g of groups) {
    // Keep the highest-trust representative of each origin group as canonical,
    // but every member's independenceFactor is 1/groupSize.
    const factor = 1 / g.members.length;
    const sorted = [...g.members].sort(
      (a, b) => TRUST_TIER_WEIGHTS[b.providerTier] - TRUST_TIER_WEIGHTS[a.providerTier],
    );
    for (const m of g.members) independence.set(m.url, factor);
    deduped.push(sorted[0]);
  }
  return { deduped, independence };
}

// 3/4. Cluster sources by sub-claim and split into supporting vs contradicting.
function clusterBySubClaim(
  subClaim: string,
  sources: SourceResult[],
): { supporting: SourceResult[]; contradicting: SourceResult[]; representative: string | null } {
  const claimTokens = new Set(queryTokens(subClaim).map(stem));
  if (claimTokens.size === 0) return { supporting: [], contradicting: [], representative: null };

  const supporting: SourceResult[] = [];
  const contradicting: SourceResult[] = [];
  let representative: string | null = null;
  let bestOverlap = 0;

  for (const s of sources) {
    const text = `${s.title} ${s.snippet}`;
    const sTokens = new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map(stem),
    );
    let hits = 0;
    claimTokens.forEach((t) => {
      if (sTokens.has(t)) hits++;
    });
    const overlap = hits / claimTokens.size;
    if (overlap < 0.34) continue;

    if (NEGATION_RE.test(s.snippet)) contradicting.push(s);
    else supporting.push(s);

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      const sentence = s.snippet
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?])\s+/)
        .find((x) => x.length >= 24 && jaccard(new Set(queryTokens(x).map(stem)), claimTokens) > 0.2);
      representative = sentence ?? truncateClean(s.snippet, 200);
    }
  }
  return { supporting, contradicting, representative };
}

// §5 fact-anchor: detect web prose that conflicts with a Wikidata typed fact.
// Unless ≥2 independent Tier-1/2 sources override, the conflict is surfaced and
// the conflicting prose down-weighted.
function detectFactConflicts(
  anchorFacts: AnchorFact[],
  sources: SourceResult[],
): { conflicts: string[]; penalizedUrls: Set<string> } {
  const conflicts: string[] = [];
  const penalizedUrls = new Set<string>();
  for (const fact of anchorFacts) {
    if (fact.numeric == null && fact.year == null) continue;
    const target = fact.numeric ?? fact.year!;
    const overrides = sources.filter(
      (s) =>
        s.providerTier <= 2 &&
        (extractNumbers(s.snippet).some((n) => Math.abs(n - target) / Math.max(1, target) < 0.02) ||
          extractYears(s.snippet).includes(fact.year ?? -1)),
    ).length;
    for (const s of sources) {
      if (s.providerTier <= 2) continue;
      const nums = fact.year != null ? extractYears(s.snippet) : extractNumbers(s.snippet);
      if (nums.length === 0) continue;
      const conflict = nums.some((n) => Math.abs(n - target) / Math.max(1, target) > 0.05);
      const mentionsEntity = s.snippet.toLowerCase().includes(fact.entity.toLowerCase().split(" ")[0]);
      if (conflict && mentionsEntity && overrides < 2) {
        penalizedUrls.add(s.url);
        conflicts.push(
          `Wikidata records ${fact.entity} ${fact.property} = ${fact.value}, but ${s.domain} states a different value — structured fact treated as anchor.`,
        );
      }
    }
  }
  return { conflicts, penalizedUrls };
}

// §5 scoring formula:
//   claimConfidence = Σ(trustWeight × recencyFactor × independenceFactor × citationBoost)
//                     − contradictionPenalty   → normalized 0–1
function scoreClaim(
  subClaim: string,
  supporting: SourceResult[],
  contradicting: SourceResult[],
  ctx: { volatile: boolean; independence: Map<string, number>; penalizedUrls: Set<string>; representative: string | null },
): ScoredClaim {
  let raw = 0;
  for (const s of supporting) {
    let trust = TRUST_TIER_WEIGHTS[s.providerTier];
    if ((s.raw as Record<string, unknown>)?.preprint) trust *= PREPRINT_TRUST_FACTOR;
    if ((s.raw as Record<string, unknown>)?.anchor) trust = Math.max(trust, 1.0); // structured anchor
    const indep = ctx.independence.get(s.url) ?? 1;
    const recency = recencyFactor(ageDaysOf(s), ctx.volatile);
    const penalty = ctx.penalizedUrls.has(s.url) ? 0.3 : 1;
    raw += trust * recency * indep * citationBoost(s) * penalty;
  }

  // contradictionPenalty scales with independent, non-trivial dissent.
  const contradictionPenalty = contradicting.reduce(
    (sum, s) => sum + TRUST_TIER_WEIGHTS[s.providerTier] * (ctx.independence.get(s.url) ?? 1) * 0.5,
    0,
  );

  const normalized = 1 - Math.exp(-raw * 0.55);
  let score = Math.max(0, Math.min(1, normalized - contradictionPenalty * 0.25));

  // Tier-4-only support can never clear the confidence threshold alone (§3).
  if (supporting.length > 0 && supporting.every((s) => s.providerTier === 4)) score = Math.min(score, 0.38);

  return {
    text: ctx.representative ?? subClaim,
    score,
    label: scoreToLabel(score),
    supportingSources: supporting,
    contradictingSources: contradicting,
  };
}

export function scoreToLabel(score: number): ConfidenceLabel {
  if (score > 0.8) return "Verified";
  if (score >= 0.6) return "Likely";
  if (score >= 0.4) return "Contested";
  return "Unsupported";
}

// Rank sources for display: trust tier, then citation/relevance, deduped.
function rankSources(sources: SourceResult[], query: string): SourceResult[] {
  const qTokens = new Set(queryTokens(query).map(stem));
  return [...sources].sort((a, b) => {
    const ta = TRUST_TIER_WEIGHTS[a.providerTier];
    const tb = TRUST_TIER_WEIGHTS[b.providerTier];
    if (tb !== ta) return tb - ta;
    const ra = jaccard(new Set(queryTokens(`${a.title} ${a.snippet}`).map(stem)), qTokens);
    const rb = jaccard(new Set(queryTokens(`${b.title} ${b.snippet}`).map(stem)), qTokens);
    if (rb !== ra) return rb - ra;
    return (b.citationCount ?? 0) - (a.citationCount ?? 0);
  });
}

function buildAnswerFromClaims(claims: ScoredClaim[], query: string): string {
  const usable = claims.filter((c) => c.score >= 0.4 && c.text).sort((a, b) => b.score - a.score);
  if (usable.length === 0) {
    return `The free evidence stack didn't return enough genuinely on-topic, corroborated material to answer "${query}" reliably. See sources below for what was found.`;
  }
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const c of usable) {
    const key = c.text.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(c.text.replace(/\s+/g, " ").trim());
    if (lines.length >= 3) break;
  }
  return lines.join(" ");
}

// Cross-model reconciliation for deep/max: agreement → confidence justified;
// divergence → force Contested and show both (§5).
function reconcileSynthesizers(runs: SynthesisRun[]): {
  answer: string;
  agree: boolean | null;
  contradiction: string | null;
} {
  const withReport = runs.filter((r) => r.report.trim().length > 0);
  if (withReport.length === 0) return { answer: "", agree: null, contradiction: null };
  if (withReport.length === 1) return { answer: withReport[0].report, agree: null, contradiction: null };

  const [a, b] = withReport;
  const overlap = jaccard(contentTokens(a.report), contentTokens(b.report));
  if (overlap >= 0.25) {
    return { answer: a.report, agree: true, contradiction: null };
  }
  return {
    answer: `${a.name}: ${a.report}\n\n${b.name}: ${b.report}`,
    agree: false,
    contradiction: `${a.name} and ${b.name} diverged — flagged Contested; both syntheses shown.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Caching by (query, tier) hash
// ──────────────────────────────────────────────────────────────────────────

const RESEARCH_CACHE = new Map<string, { expires: number; value: ConfidenceResult }>();
const CACHE_TTL_MS = 10 * 60_000;

function cacheKey(req: ResearchRequest): string {
  return JSON.stringify({
    q: req.query.trim().toLowerCase(),
    t: req.tier,
    d: req.domainFilter ?? null,
    r: req.recency ?? null,
    a: req.academicOnly ?? false,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// §1/§4 Orchestrator — the single public entry point
// ──────────────────────────────────────────────────────────────────────────

export interface ResearchProgress {
  phase: string;
  partial?: Partial<ConfidenceResult>;
}

export async function research(
  req: ResearchRequest,
  opts: { onProgress?: (p: ResearchProgress) => void } = {},
): Promise<ConfidenceResult> {
  const notes: string[] = [];
  const onProgress = opts.onProgress ?? (() => {});

  // Tier resolution + graceful paid→free fallback (§1): if the user picks
  // deep/max without any paid synthesis key, drop to standard and tell them.
  let tier = req.tier;
  const hasPaidKey = Boolean(process.env.VALYU_API_KEY || process.env.PERPLEXITY_API_KEY);
  if ((tier === "deep" || tier === "max") && !hasPaidKey) {
    notes.push(
      "No Valyu/Perplexity key configured — ran the full free 'standard' pipeline instead. Adding a key would enable autonomous multi-step deep-research synthesis as a second opinion.",
    );
    tier = "standard";
  }
  const effectiveReq: ResearchRequest = { ...req, tier };
  const cfg = TIER_CONFIG[tier];

  const cached = RESEARCH_CACHE.get(cacheKey(effectiveReq));
  if (cached && cached.expires > Date.now()) return cached.value;

  const budget = req.maxBudgetUSD ?? cfg.defaultBudgetUSD;
  let spent = 0;
  const providersUsed: string[] = [];
  const volatile = isVolatileQuery(req.query);

  // Decompose (full pipeline only; instant is single-pass).
  onProgress({ phase: "decompose" });
  const subClaims = cfg.fullPipeline ? await decomposeQuery(req.query) : [req.query];

  // Parallel fetch the free + key-gated search stack.
  onProgress({ phase: "fetch" });
  const fetched = await fetchAllSources(effectiveReq, cfg.searchAdapters);
  providersUsed.push(...fetched.providersUsed);
  if (fetched.failures.length) notes.push(`Providers unavailable this run: ${fetched.failures.join(", ")}.`);

  // Fact anchor (Wikidata structured facts).
  let anchorFacts: AnchorFact[] = [];
  let allSources = fetched.sources;
  if (cfg.factAnchor) {
    const fa = await wikidataFacts(req.query).catch(() => ({ facts: [], sources: [] }));
    anchorFacts = fa.facts;
    if (fa.sources.length) {
      allSources = [...allSources, ...fa.sources];
      if (!providersUsed.includes("Wikidata")) providersUsed.push("Wikidata");
    }
  }

  // Independence dedup.
  const { deduped, independence } = independenceDedup(allSources);
  const { conflicts, penalizedUrls } = detectFactConflicts(anchorFacts, deduped);

  // Cross-reference + score each sub-claim.
  onProgress({ phase: "cross-reference" });
  const claims: ScoredClaim[] = subClaims.map((sc) => {
    const { supporting, contradicting, representative } = clusterBySubClaim(sc, deduped);
    return scoreClaim(sc, supporting, contradicting, {
      volatile,
      independence,
      penalizedUrls,
      representative,
    });
  });

  const contradictions = [...conflicts];
  for (const c of claims) {
    if (c.contradictingSources.length > 0 && c.supportingSources.length > 0) {
      contradictions.push(
        `"${truncateClean(c.text, 80)}" is contested: ${c.contradictingSources.length} source(s) dissent.`,
      );
    }
  }

  // Emit partial free-tier result immediately (never block the UI).
  const rankedFree = rankSources(deduped, req.query);
  const freeAnswer = buildAnswerFromClaims(claims, req.query);
  let confidenceScore = aggregateConfidence(claims);
  onProgress({
    phase: "free-synthesis",
    partial: {
      answer: freeAnswer,
      confidenceScore,
      confidenceLabel: scoreToLabel(confidenceScore),
      claims,
      sources: clip(rankedFree, 16),
      tierUsed: tier,
    },
  });

  let answer = freeAnswer;
  const synthSources: SourceResult[] = [];

  // Paid deep-research enhancement (deep/max with keys + budget).
  if (cfg.synthAdapters.length > 0 && hasPaidKey && budget > 0) {
    onProgress({ phase: "deep-synthesis" });
    const runs: SynthesisRun[] = [];
    if (cfg.synthAdapters.includes("Valyu")) {
      const v = await runValyu(effectiveReq, budget - spent).catch(() => null);
      if (v) {
        if ((v.raw as Record<string, unknown>)?.abortedOverBudget) {
          notes.push(`Valyu skipped — would exceed budget ($${budget.toFixed(2)}).`);
        } else {
          spent += v.costUSD;
          runs.push(v);
          providersUsed.push("Valyu");
          synthSources.push(...v.sources);
        }
      }
    }
    if (cfg.synthAdapters.includes("Perplexity") && spent < budget) {
      const p = await runPerplexity(effectiveReq, budget - spent).catch(() => null);
      if (p) {
        if ((p.raw as Record<string, unknown>)?.abortedOverBudget) {
          notes.push(`Perplexity skipped — would exceed budget ($${budget.toFixed(2)}).`);
        } else {
          spent += p.costUSD;
          runs.push(p);
          providersUsed.push("Perplexity");
          synthSources.push(...p.sources);
        }
      }
    }

    const reconciled = reconcileSynthesizers(runs);
    if (reconciled.answer) answer = reconciled.answer;
    if (reconciled.agree === true) confidenceScore = Math.min(0.97, confidenceScore + 0.08);
    if (reconciled.agree === false) {
      confidenceScore = Math.min(confidenceScore, 0.55); // force Contested band
      if (reconciled.contradiction) contradictions.push(reconciled.contradiction);
    }
  }

  const finalSources = rankSources([...deduped, ...synthSources], req.query);
  const result: ConfidenceResult = {
    answer,
    confidenceLabel: scoreToLabel(confidenceScore),
    confidenceScore: Number(confidenceScore.toFixed(3)),
    claims,
    sources: clip(finalSources, 20),
    contradictions: Array.from(new Set(contradictions)),
    tierUsed: tier,
    costUSD: Number(spent.toFixed(4)),
    providersUsed: Array.from(new Set(providersUsed)),
    notes,
    subClaims,
  };

  RESEARCH_CACHE.set(cacheKey(effectiveReq), { expires: Date.now() + CACHE_TTL_MS, value: result });
  onProgress({ phase: "complete", partial: result });
  return result;
}

// Overall confidence = independence/trust-weighted blend of claim scores, with
// a diversity nudge — not just the single best claim.
function aggregateConfidence(claims: ScoredClaim[]): number {
  const scored = claims.filter((c) => c.supportingSources.length > 0);
  if (scored.length === 0) return 0.2;
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 3);
  const mean = top.reduce((s, c) => s + c.score, 0) / top.length;
  const distinctDomains = new Set(scored.flatMap((c) => c.supportingSources.map((s) => s.domain))).size;
  const diversity = Math.min(0.08, distinctDomains * 0.012);
  return Math.max(0.14, Math.min(0.98, mean + diversity));
}
