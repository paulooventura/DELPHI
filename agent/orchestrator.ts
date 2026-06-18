export async function runProwler(query: string) {
  // MOCK INTELLIGENCE (replace with APIs later)

  const models = ["GPT", "Claude", "Gemini"];

  const insights = models.map((m) => ({
    model: m,
    text: `${m} analyzed: ${query}`,
    confidence: 0.7 + Math.random() * 0.2
  }));

  const avgConfidence =
    insights.reduce((s, i) => s + i.confidence, 0) /
    insights.length;

  return {
    query,
    insights,
    confidence: avgConfidence,
    mode: "v7-one-copy"
  };
}