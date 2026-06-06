// Stage 2 — The Boardroom death-match. 4 extreme personas evaluate 10 ideas in
// parallel (the Replicas fleet, when wired), cull to 3 finalists, then unleash their
// signature attacks until exactly 1 survives. The same 4 lenses then author the
// Prediction Matrix (the bet) that drives the Factory + Mutation stages.

import { llmJson } from "./llm";
import { PERSONAS, PERSONA_BY_ID } from "./personas";
import { LIBRARY_SUMMARY } from "./knowledge";
import { ycNeighborBlock, ycRegistry } from "./yc";
import type { Idea, PersonaVerdict, PredictionMatrix } from "./types";
import { ev } from "./store";
import { runPersonaFleet, replicasEnabled } from "./replicas";

// Use the real Replicas fleet only when explicitly enabled AND configured. The
// in-process parallel-LLM path stays the default (snappy, no fleet cold-start) and is
// also the automatic fallback if the fleet errors mid-run.
const useFleet = process.env.USE_REPLICAS === "1" && replicasEnabled;

// Which boardroom round runs on the fleet. Default "r2": the 3-finalist death-match —
// short enough for VM agents to finish well inside the timeout (10-idea round 1 made
// the slowest agent overrun even 90s), and it's the round armed with the YC registry.
// Options: r1 | r2 | both.
const FLEET_MODE = process.env.DARWIN_FLEET_MODE || "r2";
const fleetForRound = (round: number) =>
  FLEET_MODE === "both" || (FLEET_MODE === "r1" && round === 1) || (FLEET_MODE === "r2" && round === 2);

// Gather verdicts from all personas over a set of ideas — via the Replicas fleet when
// enabled, else 4 parallel in-process LLM calls. Falls back to in-process on fleet error.
async function gatherVerdicts(ideas: Idea[], round = 1, extra = ""): Promise<PersonaVerdict[]> {
  if (useFleet && fleetForRound(round)) {
    try {
      return await runPersonaFleet(PERSONAS.map((p) => p.id), ideas, extra);
    } catch (e) {
      ev.log("boardroom", `🛰️ Replicas fleet failed (${(e as Error).message}); falling back to in-process judges.`);
    }
  }
  return (await Promise.all(PERSONAS.map((p) => personaScores(p.id, ideas, extra)))).flat();
}

// Run one persona over a set of ideas, returning a score + attack per idea.
async function personaScores(
  personaId: (typeof PERSONAS)[number]["id"],
  ideas: Idea[],
  extra = ""
): Promise<PersonaVerdict[]> {
  const persona = PERSONA_BY_ID[personaId];
  const prompt = `${extra ? extra + "\n\n" : ""}Here are ${ideas.length} startup ideas:

${ideas
  .map(
    (i) =>
      `[${i.id}] ${i.title} — ${i.pitch}\n    pain: ${i.painPoint}\n    site: ${i.websiteType} | revenue: ${i.monetization}`
  )
  .join("\n")}

Judge EACH idea in your persona — and scrutinize whether the website type and revenue
model actually hold up. A death sentence without a fair hearing is lazy judging: state
the strongest case FOR each idea too. Return ONLY a JSON array, one object per idea:
{
  "ideaId": "idea-N",
  "score": <0-100, how likely you'd let this one survive — be harsh>,
  "attack": "<your single sharpest sentence against it, in character — MAX 25 words>",
  "pro": "<the single strongest thing going FOR it — one honest sentence, MAX 18 words>"
}`;

  // Knowledge-pack judges write longer attacks (now attack + pro per idea); budget
  // generously so the 10-idea JSON array never truncates mid-string (-> mock fallback).
  const raw = await llmJson<PersonaVerdict[]>(prompt, {
    system: persona.system,
    maxTokens: 6500,
    temperature: 0.85,
  });
  return raw.map((v) => ({ ...v, persona: personaId }));
}

// Persona weights for the final survival vote.
const WEIGHTS: Record<string, number> = {
  socratic: 1.0,
  architect: 1.0,
  investor: 1.2, // willingness-to-pay matters most
  archaeologist: 0.9,
};

function aggregate(ideas: Idea[], verdicts: PersonaVerdict[]): Map<string, number> {
  const totals = new Map<string, { sum: number; w: number }>();
  for (const v of verdicts) {
    const entry = totals.get(v.ideaId) ?? { sum: 0, w: 0 };
    const w = WEIGHTS[v.persona] ?? 1;
    entry.sum += v.score * w;
    entry.w += w;
    totals.set(v.ideaId, entry);
  }
  const out = new Map<string, number>();
  for (const i of ideas) {
    const e = totals.get(i.id);
    out.set(i.id, e ? Math.round(e.sum / e.w) : 0);
  }
  return out;
}

export interface BoardroomResult {
  survivor: Idea;
  bet: PredictionMatrix;
}

export async function runBoardroom(ideas: Idea[]): Promise<BoardroomResult> {
  ev.stage("boardroom", "⚔️ Boardroom — the death-match begins");
  ev.log("boardroom", LIBRARY_SUMMARY);

  // --- Cull round: all 4 personas score all ideas in parallel ---
  ev.log("boardroom", "Round 1 — all 4 judges score every idea in parallel.");
  const cullVerdicts = await gatherVerdicts(ideas);
  for (const v of cullVerdicts) ev.verdict(v);

  const cullScores = aggregate(ideas, cullVerdicts);
  const ranked = [...ideas].sort((a, b) => (cullScores.get(b.id)! - cullScores.get(a.id)!));
  const finalists = ranked.slice(0, 3);
  const culled = ranked.slice(3);

  // Kill the culled ideas with a one-line cause of death (harshest attack) — but
  // every idea also gets a fair hearing: its strongest pro (from its kindest judge).
  for (const idea of culled) {
    const verdicts = cullVerdicts.filter((v) => v.ideaId === idea.id);
    const worst = [...verdicts].sort((a, b) => a.score - b.score)[0];
    const kindest = [...verdicts].sort((a, b) => b.score - a.score).find((v) => v.pro);
    const cause = worst ? worst.attack : "Failed to make the shortlist.";
    idea.alive = false;
    idea.causeOfDeath = cause;
    idea.strongestCase = kindest?.pro;
    idea.score = cullScores.get(idea.id);
    ev.kill(idea.id, cause, kindest?.pro);
  }
  ev.log(
    "boardroom",
    `Round 1 verdict: ${finalists.map((f) => f.title).join(", ")} advance. ${culled.length} dead.`
  );

  // --- Death-match: 4 personas attack the 3 finalists, harder — now armed with
  // the REAL YC registry: each finalist's nearest actual companies and their fates.
  ev.log("boardroom", "Round 2 — the death-match. Finalists get torn apart.");
  let registryBlock = "";
  if (ycRegistry()) {
    const sections = finalists
      .map((f) => {
        const block = ycNeighborBlock(`${f.title} ${f.pitch} ${f.painPoint} ${f.websiteType}`);
        return block ? `[${f.id}] ${f.title} — nearest real YC companies:\n${block}` : "";
      })
      .filter(Boolean);
    if (sections.length) {
      registryBlock = `LIVE YC REGISTRY (${ycRegistry()!.length} real companies) — the actual fates of this space's neighbors. Use them as evidence:\n\n${sections.join("\n\n")}`;
      const dead = (registryBlock.match(/DEAD/g) || []).length;
      ev.log(
        "boardroom",
        `⚰️ Judges consulted the live YC registry (${ycRegistry()!.length.toLocaleString()} companies): ${dead} dead neighbor(s) found near the finalists.`
      );
    }
  }
  const finalVerdicts = await gatherVerdicts(finalists, 2, registryBlock);
  for (const v of finalVerdicts) ev.verdict(v);

  const finalScores = aggregate(finalists, finalVerdicts);
  const finalRanked = [...finalists].sort(
    (a, b) => finalScores.get(b.id)! - finalScores.get(a.id)!
  );
  const survivor = finalRanked[0];
  survivor.score = finalScores.get(survivor.id);

  // Kill the runner-up finalists (with their fair hearing too).
  for (const idea of finalRanked.slice(1)) {
    const verdicts = finalVerdicts.filter((v) => v.ideaId === idea.id);
    const worst = [...verdicts].sort((a, b) => a.score - b.score)[0];
    const kindest = [...verdicts].sort((a, b) => b.score - a.score).find((v) => v.pro);
    const cause = worst ? worst.attack : "Lost the death-match.";
    idea.alive = false;
    idea.causeOfDeath = cause;
    idea.strongestCase = kindest?.pro;
    idea.score = finalScores.get(idea.id);
    ev.kill(idea.id, cause, kindest?.pro);
  }

  // The survivor's own strongest case rides along to the Founder stage and the UI.
  const champion = finalVerdicts
    .filter((v) => v.ideaId === survivor.id && v.pro)
    .sort((a, b) => b.score - a.score)[0];
  survivor.strongestCase = champion?.pro;

  ev.survivor(survivor);
  ev.log("boardroom", `SURVIVOR: ${survivor.title} (score ${survivor.score}).`);

  // --- The bet: same 4 lenses author the Prediction Matrix ---
  const bet = await authorBet(survivor);
  ev.bet(bet);

  return { survivor, bet };
}

async function authorBet(survivor: Idea): Promise<PredictionMatrix> {
  const prompt = `The boardroom approved this idea to be built and deployed:
"${survivor.title}" — ${survivor.pitch} (pain: ${survivor.painPoint})

Now make a PUBLIC BET (a "Prediction Matrix") on its launch success, measured by the
Lighthouse SEO score of the deployed site. The first deploy will be a bare MVP.
Return ONLY JSON:
{
  "metric": "seo",
  "baseline": <integer 60-78, the expected weak first-deploy score>,
  "target": <integer 88-98, the score the site must reach to WIN the bet>,
  "hypothesis": "<the specific change predicted to move the metric, e.g. add N SEO landing pages + meta tags + structured data>",
  "predictedFailureMode": "<the Archaeologist's one-line warning about how this could still die>"
}`;
  const bet = await llmJson<PredictionMatrix>(prompt, { maxTokens: 700, temperature: 0.7 });
  bet.metric = "seo";
  // Clamp to sane demo ranges.
  bet.baseline = Math.min(78, Math.max(55, Math.round(bet.baseline)));
  bet.target = Math.min(99, Math.max(85, Math.round(bet.target)));
  return bet;
}
