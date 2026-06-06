// Stage 1 — Scout. LIVE trend signals from the Hacker News front page (official
// Firebase API, no key) are synthesized by one LLM call into 10 micro-SaaS idea
// cards. If the live pull fails or times out (offline demo), the cached seed
// signals below take over — the stage never blocks. Every idea MUST commit to a
// concrete website type AND a revenue model.

import { llmJson } from "./llm";
import type { Idea } from "./types";
import { ev } from "./store";

// Offline fallback signals — used when the live HN pull fails (no network).
const SEED_SIGNALS: string[] = [
  "HN front page: 'Show HN: I automated my entire job search with a local LLM' (900+ pts)",
  "Twitter: indie hackers complaining Notion AI is too generic for real workflows",
  "HN: 'The hidden cost of webhooks nobody talks about' trending in dev circles",
  "Twitter: designers furious about Figma price increase, hunting alternatives",
  "HN: 'Why every solo founder needs a fake cofounder' — AI accountability tools",
  "Reddit r/smallbusiness: owners drowning in Google review responses",
  "Twitter: surge in 'I built X in a weekend with Cursor' posts — devs want deploy glue",
  "HN: 'RSS is back' — people rebuilding personal information diets",
  "Twitter: creators want to turn long YouTube videos into SEO blog posts automatically",
  "HN: 'Cold email is dead unless it's hyper-personalized' — research-then-write tools",
];

// Pull today's REAL front page from the official HN API. Hard 6s budget: any
// failure returns null and the caller falls back to the seed signals.
// (Also used by the Founder stage to source blog topics from today's trends.)
export async function liveHnSignals(count = 10): Promise<string[] | null> {
  try {
    const signal = AbortSignal.timeout(6000);
    const ids: number[] = await (
      await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal })
    ).json();
    const items = await Promise.all(
      ids.slice(0, count).map(async (id) => {
        const it: any = await (
          await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal })
        ).json();
        return it?.title ? `HN front page: '${it.title}' (${it.score ?? 0} pts)` : null;
      })
    );
    const signals = items.filter(Boolean) as string[];
    return signals.length >= 5 ? signals : null;
  } catch {
    return null;
  }
}

const SCOUT_SYSTEM = `You are the Scout of an autonomous SaaS factory. Given raw trend signals
(live from the Hacker News front page, or this morning's cached pulse),
you generate sharp MICRO-SaaS ideas: small, single-purpose web products one person
could ship in a week.

CRITICAL — a signal is EVIDENCE OF ATTENTION, not a product to copy. First read what
each signal actually is, then derive accordingly:
- A product launch ("Show HN: X") → NEVER clone X. Derive the SECOND-ORDER opportunity:
  the complement X's users now need, the painful setup/workflow around X, the audience
  X just revealed, or the picks-and-shovels play for the whole category.
- A complaint / pain thread → the pain itself is the opportunity (the best kind).
- A platform/tech shift → the tooling, education, or migration gap it opens.
A derivative clone of something on the front page is worthless and will be executed
by the boardroom ("derivative idea" is a named startup-killer).

For EACH idea you must also answer two business questions or it is worthless:
1. What concrete website does this trend become? (e.g. a focused SaaS app, an SEO content
   site, a directory, a free tool with upsell)
2. How does that website make money? Pick a real model: paid subscription (give a price),
   Google Ads / display, affiliate, usage-based, or one-time. Be specific.
And state its EDGE in the pitch: why now, and why the incumbent won't just bundle it.`;

export async function runScout(count = 10): Promise<Idea[]> {
  ev.stage("scout", "🛰️ Scout — hunting today's trends");

  const live = await liveHnSignals();
  const signals = live ?? SEED_SIGNALS;
  ev.log(
    "scout",
    live
      ? `📡 Ingested ${live.length} LIVE trend signals from the Hacker News front page.`
      : `Ingested ${SEED_SIGNALS.length} trend signals from this morning's cached pulse.`
  );

  const prompt = `Here are this morning's trend signals:

${signals.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Generate exactly ${count} distinct micro-SaaS ideas inspired by these signals.
Return ONLY a JSON array of objects, each:
{
  "title": "punchy product name",
  "pitch": "one sentence on what it does",
  "painPoint": "the specific pain it removes",
  "source": "which signal (short phrase) inspired it",
  "websiteType": "the concrete kind of website this becomes (e.g. 'focused SaaS app', 'programmatic SEO content site', 'directory', 'free tool + paid upgrade')",
  "monetization": "how the site makes money, with specifics (e.g. 'Paid subscription $19/mo', 'Google Ads + affiliate links', 'usage-based $0.01/call')"
}`;

  const raw = await llmJson<Array<Omit<Idea, "id" | "alive">>>(prompt, {
    system: SCOUT_SYSTEM,
    maxTokens: 3500,
    temperature: 0.9,
  });

  const ideas: Idea[] = raw.slice(0, count).map((r, i) => ({
    id: `idea-${i + 1}`,
    title: r.title,
    pitch: r.pitch,
    painPoint: r.painPoint,
    source: r.source,
    websiteType: r.websiteType,
    monetization: r.monetization,
    alive: true,
  }));

  ev.log("scout", `Synthesized ${ideas.length} micro-SaaS candidates.`);
  ev.ideas(ideas);
  return ideas;
}
