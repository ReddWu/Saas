// The Hand-off Kit — Darwin doesn't end at a landing page. It pushes the shipped
// site to a fresh PUBLIC repo on the logged-in gh account (user-approved) with a
// BUILDME.md "relay prompt", so a human founder can clone it, open Claude Code /
// Codex, and continue straight into building the USABLE product (per the Founder
// Brief's MVP cut). Enabled by DARWIN_GITPUSH=1; any failure degrades silently —
// the demo never depends on GitHub weather.

import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { Idea, PredictionMatrix, FounderBrief } from "./types";

const exec = promisify(execFile);

export const gitPushEnabled = process.env.DARWIN_GITPUSH === "1";

// The relay prompt: everything Claude Code / Codex needs to take over the build.
// Template-assembled (no LLM call — zero latency, zero failure surface).
export function builderPrompt(idea: Idea, bet: PredictionMatrix, brief: FounderBrief): string {
  const mvp = brief.mvp;
  return `You are taking over a validated micro-SaaS from DarwinSaaS (an autonomous
startup copilot). This repo contains the deployed smoke-test landing site that already
won its public launch bet (Lighthouse SEO ${bet.target}+).

THE PRODUCT
"${idea.title}" — ${idea.pitch}
Pain: ${idea.painPoint}
Form: ${idea.websiteType} | Revenue: ${idea.monetization}

YOUR MISSION — make it USABLE
Definition of usable (the bar to hit): ${mvp?.usableWhen ?? "a stranger completes the core flow unaided"}
Build ONLY the core: ${(mvp?.core ?? []).join("; ") || "the single flow that removes the pain"}
Explicitly CUT from v1: ${(mvp?.cut ?? []).join("; ") || "everything else"}

RECOMMENDED STACK
${mvp?.stack ?? "Next.js full-stack"}
Suggested foundation: rebuild on https://github.com/NextCTeam/raphael-starterkit-v1
(Next.js + Supabase auth/db + Tailwind/Radix) and port this repo's landing pages +
SEO structure (meta, JSON-LD, sitemap) into it — they already pass Lighthouse 90+.

HOW TO START
1. Scaffold the app from the starter kit; keep this landing page as the marketing root.
2. Ship Week 1 of the build plan: the smallest end-to-end version of the core flow.
3. Charge from day one (${idea.monetization}) — a free v1 invalidates the pricing bet.

The 30-day build×growth backlog and the full Founder Brief live in the DarwinSaaS
Control Room. Every task carries a falsifiable hypothesis — keep it that way.`;
}

// Push the generated site dir to a fresh public GitHub repo with BUILDME.md inside.
// Returns the repo URL, or null on any failure (callers treat null as "skip").
export async function pushSiteRepo(
  slug: string,
  dir: string,
  prompt: string
): Promise<string | null> {
  if (!gitPushEnabled) return null;
  try {
    await fs.writeFile(path.join(dir, "BUILDME.md"), prompt, "utf8");
    const run = (cmd: string, args: string[]) =>
      exec(cmd, args, { cwd: dir, timeout: 30_000 });

    await run("git", ["init", "-b", "main"]);
    await run("git", ["add", "-A"]);
    await run("git", ["commit", "-m", `Darwin shipped ${slug} — smoke test + BUILDME relay prompt`]);
    // Unique repo per run so reruns never collide.
    const repo = `darwin-${slug}-${Date.now().toString(36).slice(-4)}`;
    await run("gh", ["repo", "create", repo, "--public", "--source=.", "--push"]);
    const { stdout } = await run("gh", ["repo", "view", repo, "--json", "url", "-q", ".url"]);
    return stdout.trim() || null;
  } catch (e) {
    console.warn("[handoff] git push skipped:", (e as Error)?.message);
    return null;
  }
}
