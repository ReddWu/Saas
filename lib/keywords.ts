// Keyword research for the survivor's SEO engine. The table ships instantly with
// honest LLM estimates (source:"est"); the Similarweb scraper path (see the
// similarweb-keyword-research skill — ~16s/keyword behind a login, too slow for a
// live run) upgrades rows to source:"similarweb" offline. The Keyword Lab UI lets
// a human pick a row, generate a blog, edit it, and publish it onto the live site.

import { llmJson } from "./llm";
import type { Idea, KeywordRow } from "./types";

// Live Google Autosuggest — REAL search-demand evidence (free, no key, instant).
// Returns suggestions actually typed by searchers; null on any failure/offline.
async function googleSuggest(seed: string): Promise<string[] | null> {
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`,
      { signal: AbortSignal.timeout(4000), headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data: any = await res.json();
    return Array.isArray(data?.[1]) ? data[1].slice(0, 8) : null;
  } catch {
    return null;
  }
}

// Pull real autosuggest evidence for a few seed phrases derived from the idea.
async function liveDemandEvidence(survivor: Idea): Promise<string[]> {
  const seeds = [
    survivor.painPoint.split(/[,.]|\bso\b/)[0].trim().toLowerCase().slice(0, 50),
    `${survivor.websiteType.includes("SEO") ? "" : "how to "}${survivor.pitch
      .toLowerCase()
      .split(/[,.]/)[0]
      .slice(0, 45)}`,
    survivor.title.toLowerCase(),
  ].filter(Boolean);
  const results = await Promise.all(seeds.map(googleSuggest));
  return Array.from(new Set(results.filter(Boolean).flat() as string[])).slice(0, 16);
}

export async function genKeywords(survivor: Idea): Promise<KeywordRow[]> {
  const evidence = await liveDemandEvidence(survivor).catch(() => [] as string[]);

  const raw = await llmJson<Omit<KeywordRow, "source">[]>(
    `You are an SEO keyword strategist. For this product:
"${survivor.title}" — ${survivor.pitch}
pain: ${survivor.painPoint} | form: ${survivor.websiteType}
${
  evidence.length
    ? `\nLIVE Google Autosuggest evidence (REAL queries people type — prefer keywords
that match or extend these):\n${evidence.map((e) => `- ${e}`).join("\n")}\n`
    : ""
}
List the 8 best keyword opportunities a brand-new site could realistically rank for:
favor long-tail, clear intent, and buyer proximity. Estimate difficulty and volume
honestly (these are estimates, they will be labeled as such).
Return ONLY a JSON array:
[{ "keyword": "<2-5 words>", "kd": <0-100 estimated difficulty, favor <40>,
   "volume": <estimated monthly searches>, "intent": "<how-to|comparison|tool|pain|alternative>" }]`,
    { maxTokens: 1200, temperature: 0.6 }
  );

  // Rows whose keyword matches live autosuggest carry real-demand provenance.
  const evSet = new Set(evidence.map((e) => e.toLowerCase()));
  return raw.slice(0, 8).map((k) => ({
    ...k,
    source: evSet.has(k.keyword.toLowerCase()) ? ("suggest" as const) : ("est" as const),
  }));
}
