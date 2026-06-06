# 🧬 DarwinSaaS — Hackathon Submission

**One line:** An autonomous startup copilot that hunts today's real trends, debates ideas
to death in a VM-isolated agent boardroom, ships the survivor to a live public URL, bets
on its own launch, rewrites itself until it wins — then hands you the business plan and
a 30-day growth backlog where every task is a falsifiable bet.

**Run it:** `npm install && USE_REPLICAS=1 npm start` → http://localhost:3000 → ⚡ AWAKEN DARWIN
(~4 min full arc; `DARWIN_MOCK=1 npm start` for the zero-network insurance mode)

## The 5-stage autonomous loop

1. **🛰️ Scout** — pulls the LIVE Hacker News front page; derives second-order
   opportunities (cloning front-page products is a named capital offense).
2. **⚔️ Boardroom** — 4 judges with real libraries (Mom Test, Zero to One, 7 Powers,
   PG essays + a casebook of startup outcomes) shred 10 ideas. Every verdict has
   **pros AND cons** — tombstones carry the idea's strongest case alongside its cause
   of death. The death-match round consults the **live YC registry (5,954 real
   companies)** for each finalist's actual neighbors and their fates.
3. **🏭 Factory** — ships the survivor's site to a real public `*.vercel.app` URL.
4. **🧬 Mutation** — Lighthouse SEO fitness: first deploy FAILS the public bet (red),
   the ops agent rewrites the source, redeploys, re-measures → WINS (green). Judges
   scan the QR code and open the freshly-evolved site on their phones.
5. **🧭 Founder** — the boardroom flips to advocacy: why it wins (precedent-anchored),
   opportunities/risks, **what makes it USABLE** (falsifiable usability bar + core/cut
   feature split + exact stack), a 30-day **build×growth battle plan** (4 weekly BUILD
   milestones interleaved with content/launch tasks — every task a falsifiable bet),
   and the **Hand-off Kit**: Darwin pushes the site to a fresh GitHub repo with a
   BUILDME.md relay prompt, so Claude Code / Codex can continue building the real
   product with full context. From idea to first real line of code — one button.

## Sponsor integrations (all real, all verified end-to-end)

- **InsForge** — every LLM call routes through the **InsForge Model Gateway**;
  Postgres is the system of record (`darwin_runs`/`darwin_events`) powering the
  public **Project Library** page (every run is an adoptable project, graveyard included).
- **Replicas** — the 4 judges run as a real **VM-isolated agent fleet** (one Claude
  agent per persona, spawned in parallel; auto-teardown; graceful in-process fallback
  so the demo can never block on fleet weather).
- **Vercel** — every generated site (and each mutation cycle) deploys to a real
  public URL live during the demo.

## Reliability engineering (live-demo-grade)

Every external dependency has a hard timeout and a working fallback — HN pull (6s),
LLM calls (60s → offline replay), Replicas fleet (90s → in-process judges), Vercel
deploy (60s → local file://), Lighthouse (offline structural scorer). The full arc
has been rehearsed 8+ times today, including a zero-network insurance mode that
completes in 15 seconds.

## Roadmap — the long-term founder copilot

Weekly autonomous cadence (one vetted project/week via InsForge schedules) · adopt any
graveyard idea and restart its loop from the Founder stage · close the loop on task bets
with real Search Console data · chat panel to interrogate the judges · email-capture
demand sensors on every shipped site, feeding the next fitness function.
