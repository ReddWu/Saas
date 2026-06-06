// Stage 5 — The Founder. After the species wins its bet, the boardroom flips from
// prosecution to advocacy: WHY this startup wins (precedent-anchored, using the same
// casebook the judges attacked with), the business plan a human founder needs
// (opportunities, risks, what you put in, what comes out), and a self-assigned
// Growth Backlog where every task is a falsifiable bet (hypothesis + metric + target).
// This is what makes DarwinSaaS a long-term founder copilot, not a page generator.

import { llmJson } from "./llm";
import { CASEBOOK } from "./knowledge";
import { liveHnSignals } from "./scout";
import { ycNeighborBlock } from "./yc";
import { builderPrompt, pushSiteRepo, gitPushEnabled } from "./handoff";
import { genKeywords } from "./keywords";
import type { Idea, PredictionMatrix, FounderBrief, GrowthTask } from "./types";
import { ev } from "./store";

const ADVOCATE_SYSTEM = `You are the same four-person boardroom that just tried to kill this
startup idea — and it SURVIVED. Now you flip roles: you are its advocates and co-founders.
You still think in precedents and falsifiable bets, never in hype.

CASEBOOK — cite these real outcomes by name when arguing why it wins:
${CASEBOOK.map((c) => `- ${c.company} (${c.tag}, ${c.outcome}): ${c.note}`).join("\n")}`;

async function buildBrief(survivor: Idea, bet: PredictionMatrix): Promise<FounderBrief> {
  const neighbors = ycNeighborBlock(
    `${survivor.title} ${survivor.pitch} ${survivor.painPoint} ${survivor.websiteType}`
  );
  return llmJson<FounderBrief>(
    `The surviving idea:
"${survivor.title}" — ${survivor.pitch}
pain: ${survivor.painPoint} | site: ${survivor.websiteType} | revenue: ${survivor.monetization}
Launch bet already won: Lighthouse SEO reached ${bet.target}+.
${neighbors ? `\nNearest REAL YC companies in this space (live registry) — weigh their fates in your plan:\n${neighbors}\n` : ""}

Write the Founder's Brief — why this startup wins, and the plan. The current site is
only a landing page; "mvp" must tell the founder exactly what makes it a USABLE product.
Return ONLY JSON:
{
  "whyItWins": ["<3 sharp arguments FOR it; each MUST anchor on a casebook precedent by name (e.g. 'like Calendly, its usage is its distribution')>"],
  "opportunities": ["<2-3 concrete openings: underserved segment, timing, channel>"],
  "risks": ["<2-3 honest risks, each with the named failure-mode it rhymes with>"],
  "mvp": {
    "usableWhen": "<a falsifiable usability bar: 'a stranger can ___ unaided in ___ minutes'>",
    "core": ["<the 1-3 features that constitute usable — nothing more>"],
    "cut": ["<2-3 things explicitly NOT in v1, however tempting>"],
    "stack": "<concrete build stack, e.g. 'Next.js + raphael-starterkit (Supabase auth/db) + Vercel'>"
  },
  "input": { "money": "<realistic $ to first revenue>", "hoursPerWeek": "<solo-founder hours>", "skills": ["<2-3 skills needed>"] },
  "output": { "m1": "<month-1 milestone, measurable>", "m3": "<month-3 milestone>", "m6": "<month-6 milestone>" }
}`,
    { system: ADVOCATE_SYSTEM, maxTokens: 1800, temperature: 0.7 }
  );
}

async function buildBacklog(survivor: Idea, trendSignals: string[] | null): Promise<GrowthTask[]> {
  const trends = trendSignals?.length
    ? `Today's live trend signals (use the relevant ones as blog-topic hooks):\n${trendSignals
        .slice(0, 6)
        .map((s) => `- ${s}`)
        .join("\n")}`
    : "";

  const raw = await llmJson<Omit<GrowthTask, "id">[]>(
    `The founder is committing to "${survivor.title}" (${survivor.pitch}).
${trends}

Write the 30-day battle plan: 7-8 self-assigned tasks on TWO interleaved tracks.

BUILD track ("track":"build") — turn the landing page into a USABLE product:
- Exactly 4 tasks, one per week (dueInDays 7/14/21/28). Week 1 MUST ship the smallest
  end-to-end version of the core flow. Each has a verifiable definition-of-done in the
  title (what a stranger can DO after it ships), and its hypothesis bets on activation,
  retention, or conversion.

GROWTH track ("track":"growth") — make it found:
- 3-4 tasks. The first MUST be the content engine: 2 blog posts/day until 20 are
  published, with "topics": the first 6 titles — mostly product/pain related, 1-2
  riding today's trend signals above. Also cover launch/community + user interviews.

Every task is a BET: falsifiable hypothesis + metric + numeric target.
Return ONLY a JSON array:
[{ "track": "build"|"growth", "title": "...", "cadence": "...", "topics": ["..."] (content task only),
   "hypothesis": "...", "metric": "...", "target": <number>, "dueInDays": <number> }]`,
    { system: ADVOCATE_SYSTEM, maxTokens: 2400, temperature: 0.7 }
  );

  return raw.slice(0, 8).map((t, i) => ({ ...t, id: `task-${i + 1}` }));
}

export async function runFounder(
  survivor: Idea,
  bet: PredictionMatrix,
  site?: { slug: string; dir: string }
): Promise<void> {
  ev.stage("founder", "🧭 Founder — the case FOR it, and the plan");
  ev.log("founder", "The boardroom flips from prosecution to advocacy…");

  // Brief, backlog and keyword research are independent — run all three in parallel.
  const [brief, tasks, keywords] = await Promise.all([
    buildBrief(survivor, bet),
    (async () => {
      // Reuse today's live trends as blog-topic hooks (best-effort; null is fine).
      const trends = await liveHnSignals(8).catch(() => null);
      return buildBacklog(survivor, trends);
    })(),
    genKeywords(survivor).catch(() => [] as import("./types").KeywordRow[]),
  ]);

  ev.brief(brief);
  ev.log("founder", `🛡️ Why it wins: ${brief.whyItWins?.[0] ?? "case filed."}`);
  ev.tasks(tasks);
  if (keywords.length) {
    ev.keywords(keywords);
    ev.log("founder", `🔎 Keyword Lab armed: ${keywords.length} opportunities mapped (KD/volume estimated).`);
  }
  ev.log(
    "founder",
    `📋 30-day battle plan: ${tasks.length} bets (${tasks.filter((t) => t.track === "build").length} build / ${tasks.filter((t) => t.track !== "build").length} growth)`
  );

  // Hand-off Kit: push the winning site to a fresh repo with the relay prompt inside,
  // so a human can continue building in Claude Code / Codex with full context.
  if (site && gitPushEnabled) {
    ev.log("founder", "🚀 Opening a GitHub repo with the relay prompt for Claude Code…");
    const prompt = builderPrompt(survivor, bet, brief);
    const repoUrl = await pushSiteRepo(site.slug, site.dir, prompt);
    if (repoUrl) {
      ev.handoff(repoUrl, prompt);
      ev.log("founder", `🚀 Hand-off ready: ${repoUrl} (BUILDME.md inside)`);
    }
  }
}
