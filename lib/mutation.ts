// Stage 4 — Mutation. Measure the deployed site's SEO (the bet's fitness function).
// If the bet FAILS, the ops agent diagnoses, rewrites the source (v1 -> v2 with SEO
// pages, meta, structured data, sitemap), redeploys, and re-measures until the bet
// is won or we run out of cycles. The first deploy is built to fail so the loop
// visibly fires on stage.

import { measureSeo } from "./lighthouse";
import { renderStrong } from "./sitegen";
import { deploySite } from "./deploy";
import { llm } from "./llm";
import type { Idea, PredictionMatrix, FitnessRun } from "./types";
import { FactoryResult } from "./factory";
import { ev } from "./store";

const MAX_CYCLES = 3;

export async function runMutation(
  survivor: Idea,
  bet: PredictionMatrix,
  factory: FactoryResult
): Promise<{ won: boolean; finalUrl: string; finalDir: string; runs: FitnessRun[] }> {
  ev.stage("mutation", "🧬 Mutation — measure, mutate, survive");
  const runs: FitnessRun[] = [];
  let url = factory.deploy.url;
  let dir = factory.deploy.dir;

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    ev.log("mutation", `Cycle ${cycle}: running Lighthouse SEO audit on ${url}`);
    const res = await measureSeo(url, dir);
    const passed = res.score >= bet.target;
    const run: FitnessRun = {
      cycle,
      url,
      score: res.score,
      passed,
      at: new Date().toISOString(),
    };
    runs.push(run);
    ev.fitness(run);
    ev.log("mutation", `SEO = ${res.score} (target ${bet.target}). ${res.detail}`);

    if (passed) {
      ev.alert("green", `BET WON — SEO ${res.score} ≥ target ${bet.target}. The species survives.`);
      return { won: true, finalUrl: url, finalDir: dir, runs };
    }

    ev.alert("red", `BET FAILING — SEO ${res.score} < target ${bet.target}. Mutation required.`);

    if (cycle === MAX_CYCLES) break;

    // Ops agent diagnoses (flavor text) then rewrites the source.
    const diag = await opsDiagnosis(survivor, bet, res.score).catch(
      () => "Missing core on-page SEO. Adding metadata, semantic structure, and SEO landing pages."
    );
    ev.log("mutation", `Ops agent: ${diag}`);
    ev.log("mutation", `Rewriting source: ${bet.hypothesis}`);

    const files = renderStrong(survivor, factory.copy, bet);
    const redeploy = await deploySite(factory.slug + `-v${cycle + 1}`, files);
    url = redeploy.url;
    dir = redeploy.dir;
    ev.deploy(url, cycle + 1);
    ev.log("mutation", `Redeployed v${cycle + 1}: ${url}`);
  }

  ev.alert("red", `Bet not met after ${MAX_CYCLES} cycles. Marked for further evolution.`);
  return { won: false, finalUrl: url, finalDir: dir, runs };
}

async function opsDiagnosis(idea: Idea, bet: PredictionMatrix, score: number): Promise<string> {
  return llm(
    `You are the ops/SEO agent for an autonomous SaaS factory. The site "${idea.title}" just
scored ${score} on Lighthouse SEO but the bet requires ${bet.target}.
The planned fix is: ${bet.hypothesis}.
In ONE punchy sentence, state what you're changing and why. No preamble.`,
    { maxTokens: 120, temperature: 0.7 }
  );
}
