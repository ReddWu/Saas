// Keyword research for the survivor's SEO engine. The table ships instantly with
// honest LLM estimates (source:"est"); the Similarweb scraper path (see the
// similarweb-keyword-research skill — ~16s/keyword behind a login, too slow for a
// live run) upgrades rows to source:"similarweb" offline. The Keyword Lab UI lets
// a human pick a row, generate a blog, edit it, and publish it onto the live site.

import { llmJson } from "./llm";
import type { Idea, KeywordRow } from "./types";

export async function genKeywords(survivor: Idea): Promise<KeywordRow[]> {
  const raw = await llmJson<Omit<KeywordRow, "source">[]>(
    `You are an SEO keyword strategist. For this product:
"${survivor.title}" — ${survivor.pitch}
pain: ${survivor.painPoint} | form: ${survivor.websiteType}

List the 8 best keyword opportunities a brand-new site could realistically rank for:
favor long-tail, clear intent, and buyer proximity. Estimate difficulty and volume
honestly (these are estimates, they will be labeled as such).
Return ONLY a JSON array:
[{ "keyword": "<2-5 words>", "kd": <0-100 estimated difficulty, favor <40>,
   "volume": <estimated monthly searches>, "intent": "<how-to|comparison|tool|pain|alternative>" }]`,
    { maxTokens: 1200, temperature: 0.6 }
  );
  return raw.slice(0, 8).map((k) => ({ ...k, source: "est" as const }));
}
