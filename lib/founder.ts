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

Write the Founder's Brief — why this startup wins, and the plan. Return ONLY JSON:
{
  "whyItWins": ["<3 sharp arguments FOR it; each MUST anchor on a casebook precedent by name (e.g. 'like Calendly, its usage is its distribution')>"],
  "opportunities": ["<2-3 concrete openings: underserved segment, timing, channel>"],
  "risks": ["<2-3 honest risks, each with the named failure-mode it rhymes with>"],
  "input": { "money": "<realistic $ to first revenue>", "hoursPerWeek": "<solo-founder hours>", "skills": ["<2-3 skills needed>"] },
  "output": { "m1": "<month-1 milestone, measurable>", "m3": "<month-3 milestone>", "m6": "<month-6 milestone>" }
}`,
    { system: ADVOCATE_SYSTEM, maxTokens: 1400, temperature: 0.7 }
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

Write the 30-day growth backlog: 4-6 self-assigned tasks. REQUIREMENTS:
- Task 1 MUST be the content engine: write 2 blog posts/day until 20 are published.
  Include "topics": the first 6 post titles — mostly product/pain-point related, plus
  1-2 riding today's trend signals above.
- Every task is a BET: a falsifiable hypothesis with a metric and a numeric target
  (e.g. "publishing 20 posts lifts Search Console impressions by 1000").
- Cover at least: content/SEO, distribution (launch/community), and product feedback.
Return ONLY a JSON array:
[{ "title": "...", "cadence": "...", "topics": ["..."] (content task only),
   "hypothesis": "...", "metric": "...", "target": <number>, "dueInDays": <number> }]`,
    { system: ADVOCATE_SYSTEM, maxTokens: 1800, temperature: 0.7 }
  );

  return raw.slice(0, 6).map((t, i) => ({ ...t, id: `task-${i + 1}` }));
}

export async function runFounder(survivor: Idea, bet: PredictionMatrix): Promise<void> {
  ev.stage("founder", "🧭 Founder — the case FOR it, and the plan");
  ev.log("founder", "The boardroom flips from prosecution to advocacy…");

  // Brief and backlog are independent — run them in parallel (saves ~30s on stage).
  const [brief, tasks] = await Promise.all([
    buildBrief(survivor, bet),
    (async () => {
      // Reuse today's live trends as blog-topic hooks (best-effort; null is fine).
      const trends = await liveHnSignals(8).catch(() => null);
      return buildBacklog(survivor, trends);
    })(),
  ]);

  ev.brief(brief);
  ev.log("founder", `🛡️ Why it wins: ${brief.whyItWins?.[0] ?? "case filed."}`);
  ev.tasks(tasks);
  ev.log(
    "founder",
    `📋 Growth backlog: ${tasks.length} self-assigned bets — first: ${tasks[0]?.title ?? "n/a"}`
  );
}
