// Stage 3 — Factory. The builder fills the landing-site copy from the survivor idea,
// renders the (intentionally weak) v1, and deploys it. The bet is already authored
// by the boardroom; here we just ship the MVP that will be measured against it.

import { llmJson } from "./llm";
import { fallbackCopy, renderWeak } from "./sitegen";
import { deploySite, DeployResult } from "./deploy";
import type { Idea } from "./types";
import { ev } from "./store";

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "site";
}

async function buildCopy(idea: Idea) {
  try {
    const copy = await llmJson<ReturnType<typeof fallbackCopy>>(
      `Write landing-page copy for this micro-SaaS:
"${idea.title}" — ${idea.pitch} (pain: ${idea.painPoint})
Return ONLY JSON:
{
  "features": [{"title":"...","body":"..."}, x4],
  "seoPages": [{"slug":"kebab","title":"...","h1":"...","body":"..."}, x5]
}`,
      { maxTokens: 1600, temperature: 0.7 }
    );
    if (copy?.features?.length && copy?.seoPages?.length) return copy;
  } catch {
    /* fall back */
  }
  return fallbackCopy(idea);
}

export interface FactoryResult {
  deploy: DeployResult;
  slug: string;
  copy: ReturnType<typeof fallbackCopy>;
}

export async function runFactory(survivor: Idea): Promise<FactoryResult> {
  ev.stage("factory", "🏭 Factory — building & shipping the survivor");
  ev.log("factory", "Builder agent provisioning backend + writing source...");

  const copy = await buildCopy(survivor);
  const slug = slugify(survivor.title);
  const files = renderWeak(survivor, copy);

  ev.log("factory", `Generated ${Object.keys(files).length} file(s). Deploying to Vercel...`);
  const deploy = await deploySite(slug, files);
  ev.deploy(deploy.url, 1);
  ev.log(
    "factory",
    deploy.real ? `Live at ${deploy.url}` : `Built locally (no VERCEL_TOKEN): ${deploy.url}`
  );

  return { deploy, slug, copy };
}
