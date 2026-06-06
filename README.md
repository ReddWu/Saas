# 🧬 DarwinSaaS

**The self-evolving SaaS factory. Nobody touches a keyboard.**

DarwinSaaS hunts internet trends, throws 10 micro-SaaS ideas into a ruthless 4-persona
**death-match debate**, ships the lone survivor as a live website, makes a public **bet**
on its own launch success, then **rewrites its own code** until it wins the bet.

## The autonomous loop
1. **🛰️ Scout** — pulls the LIVE Hacker News front page (official API) and synthesizes
   10 micro-SaaS ideas from today's real signals (cached pulse as offline fallback).
   Every idea must commit to a concrete **website type** and a **revenue model**
   (subscription / Google Ads / usage-based).
2. **⚔️ Boardroom** — 4 extreme personas (🧐 Socratic Questioner, 🔪 Savage Architect,
   💸 Biased Investor, ⚰️ Historical Archaeologist) score & shred all 10 in parallel, cull
   to 3 finalists, then tear those apart until **exactly 1 survives**. Every verdict has
   **pros AND cons** — no idea dies without a fair hearing (its strongest case is carved
   on the tombstone). In the death-match the judges consult the **live YC registry**
   (~6,000 real companies, public yc-oss dataset) for each finalist's nearest actual
   neighbors and their fates. The same 4 lenses author the **Prediction Matrix** (the bet).
3. **🏭 Factory** — builds the survivor's landing site from the idea + deploys it (Vercel).
4. **🧬 Mutation** — runs a real **Lighthouse SEO** audit (the fitness function). The first
   deploy is a bare MVP that **fails** the bet → red alert → the ops agent rewrites the
   source (SEO landing pages, meta tags, structured data, sitemap) → redeploys → re-measures
   → **passes** → green. The species survives.
5. **🧭 Founder** — the boardroom flips from prosecution to advocacy: the **Founder's
   Brief** (why it wins — precedent-anchored, opportunities, risks, your input → the
   milestones out) plus a self-assigned **Growth Backlog** where every task is a
   falsifiable bet (e.g. *"2 blog posts/day until 20 are live — hypothesis: +1000 search
   impressions"*, topics sourced from the product **and today's live HN trends**).
   DarwinSaaS is a long-term founder copilot, not a page generator.

## Run it
```bash
npm install
npm run dev                                # live mode (uses .env.local)
# open http://localhost:3000 → press ⚡ AWAKEN DARWIN  (~2.5 min full arc)
# http://localhost:3000/archive → the Species Archive (every past run)

npm run build && DARWIN_MOCK=1 npm start   # guaranteed-complete offline demo
```

`DARWIN_MOCK=1` uses the offline replay provider (zero external calls) so the demo always
completes. Each integration (LLM, Vercel deploy, Lighthouse) flips mock↔real with one env
var, no code change — see `.env.local.example`.

## Sponsor integrations
- **InsForge** — every debate LLM call routes through the **InsForge Model Gateway**
  (project-provisioned OpenRouter key via `npx @insforge/cli ai setup`), and InsForge
  Postgres is the **system of record**: every run + every emitted event lands in
  `darwin_runs` / `darwin_events`, which powers the public **Species Archive** page.
- **Vercel** — every generated SaaS site ships to a real public `*.vercel.app` URL
  (`DARWIN_VERCEL=1` or `VERCEL_TOKEN`), and each mutation cycle redeploys for real.
- **Replicas** — the 4 debater personas as a parallel agent fleet (one VM-isolated agent
  per persona) behind a `REPLICAS_API_KEY` flag, with the in-process fan-out as fallback
  so the demo never blocks on fleet cold-starts. Contract: `REPLICAS_HANDOFF.md`.

## Architecture
- `lib/llm.ts` — swappable model wrapper (Anthropic ↔ InsForge gateway ↔ offline mock).
- `lib/store.ts` — event bus backing the SSE stream (swap point for InsForge realtime).
- `lib/scout.ts` / `boardroom.ts` / `factory.ts` / `mutation.ts` — the 4 stages.
- `lib/personas.ts` — the 4 persona system prompts.
- `lib/sitegen.ts` — weak v1 vs evolved v2 static-site generators.
- `lib/lighthouse.ts` — PageSpeed Insights API + offline structural SEO scorer.
- `lib/founder.ts` — stage 5: the advocate's brief + the hypothesis-driven growth backlog.
- `lib/knowledge.ts` — the judges' libraries: distilled book doctrines (Mom Test, Zero to
  One, 7 Powers, PG essays) + a casebook of real startup outcomes they must cite.
- `lib/yc.ts` — the live YC registry: ~6,000 real companies (yc-oss public dataset),
  keyword-matched per idea so judges argue from actual fates, not vibes.
- `lib/insforge.ts` — InsForge Postgres persistence (runs + events, read + write).
- `app/page.tsx` — the live Control Room dashboard.
- `app/archive/page.tsx` — the Species Archive, read from InsForge (every species
  Darwin ever shipped, plus the graveyard of every idea it killed).

## Roadmap — the long-term founder copilot
- **Adopt → real product**: today's shipped site is the smoke test (10s to a public URL).
  When a founder adopts a project from the Library, Darwin scaffolds the REAL app from a
  production starter kit (Next.js + auth + db + payments, e.g. raphael-starterkit) and
  the Growth Backlog tasks become pull requests. Cardboard to validate, steel to commit.
- **Close the loop on task bets**: wire Google Search Console so the "+1000 impressions"
  hypothesis is verified by real data — tasks that lose their bets get mutated like sites do.
- **Talk to the boardroom**: a chat panel to interrogate the 4 judges (and the advocate)
  about any decision they made.
- **Demand sensors**: every generated site gets an email-capture CTA writing back to
  InsForge — signups become the next fitness function, and species nobody wants get culled.
- **Replicas fleet for every stage**: scout, ops and founder agents in their own VMs.
