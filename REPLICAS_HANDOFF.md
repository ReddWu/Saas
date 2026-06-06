# 🛰️ Hand-off: Replicas fleet integration (the Best-Sponsor-Tool centerpiece)

**You are a second agent.** Build ONE new file — `lib/replicas.ts` — to the contract below.
Do **NOT** edit any other file; the core pipeline is owned by another agent and will be
edited concurrently. When you're done, the owner wires it in with a one-line import swap.

## Goal
Right now the 4 boardroom personas run as 4 parallel LLM calls inside one process
(`lib/boardroom.ts` → `personaScores`). Replace that fan-out with a **real Replicas
fleet**: spawn one Replicas agent per persona (each gets its own VM/shell/browser/MCP),
have each agent judge the ideas in character, and return the verdicts. This is what wins
"Best Use of a Sponsor Tool" — the parallel agents must be real and visible.

## The exact contract to implement
Create `lib/replicas.ts` exporting this function (types come from `lib/types.ts` and the
persona prompts from `lib/personas.ts` — import, don't redefine):

```ts
import type { Idea, PersonaVerdict, PersonaId } from "./types";
import { PERSONAS, PERSONA_BY_ID } from "./personas";

// Run the given personas over the given ideas as a REAL Replicas fleet (one agent each,
// in parallel). Must return one PersonaVerdict per (persona × idea).
export async function runPersonaFleet(
  personaIds: PersonaId[],
  ideas: Idea[]
): Promise<PersonaVerdict[]>;

// True only when REPLICAS_API_KEY is set AND the fleet path should be used.
export const replicasEnabled: boolean;
```

### PersonaVerdict shape (must match exactly)
```ts
{ persona: PersonaId; ideaId: string; score: number /*0-100*/; attack: string }
```

### What each fleet agent must do
- System prompt = `PERSONA_BY_ID[personaId].system` (the in-character death-panel prompt).
- User prompt = the idea list. Reuse this format so scores stay comparable:
  ```
  [idea-1] Title — pitch
      pain: ... | site: <websiteType> | revenue: <monetization>
  ...
  Return ONLY a JSON array, one object per idea:
  { "ideaId": "idea-N", "score": <0-100, harsh>, "attack": "<one sharp in-character sentence>" }
  ```
- Parse the agent's JSON output into `PersonaVerdict[]`, stamping `persona: personaId`.

## Integration point (owner will do this — just match the signature)
In `lib/boardroom.ts`, the two `Promise.all(PERSONAS.map((p) => personaScores(p.id, ideas)))`
calls get replaced by `runPersonaFleet(PERSONAS.map(p=>p.id), ideas)` when `replicasEnabled`.

## Hard requirements
1. **One new file only:** `lib/replicas.ts`. No edits to `boardroom.ts`, `llm.ts`, etc.
2. **Graceful fallback:** if the fleet errors or `REPLICAS_API_KEY` is unset, throw/return
   in a way the caller can catch — the owner keeps the existing in-process path as fallback,
   so the demo never breaks. Prefer: export `replicasEnabled=false` when no key.
3. **Emit progress (optional but great for the demo):** if you want the dashboard to show
   the fleet spinning up, import `{ ev }` from `./store` and call
   `ev.log("boardroom", "🛰️ Replicas: spawned 4 agents in parallel...")`. Read-only use of
   `ev` is fine; do not modify `store.ts`.
4. **Env:** read `process.env.REPLICAS_API_KEY`. Add it to `.env.local` yourself; document
   any extra vars at the top of `lib/replicas.ts`.

## Test your file standalone (don't rely on the app)
```bash
# from /Users/reddqichaowu/darwinsaas
npx tsx -e "import {runPersonaFleet} from './lib/replicas'; import {PERSONAS} from './lib/personas';
runPersonaFleet(PERSONAS.map(p=>p.id), [
 {id:'idea-1',title:'HookGuard',pitch:'Catch & replay failed webhooks',painPoint:'silent webhook failures',websiteType:'SaaS app',monetization:'usage-based',alive:true},
 {id:'idea-2',title:'TubePost',pitch:'YouTube → SEO blog posts',painPoint:'repurposing video',websiteType:'tool',monetization:'freemium',alive:true},
].then(v=>console.log(JSON.stringify(v,null,2)))"
```
Expect 8 verdicts (4 personas × 2 ideas), each with a score + a sharp in-character attack.

## Docs
- Replicas API: https://tryreplicas.com (spawn/orchestrate agent fleets via API).
- The owner is reachable via the shared repo; ping when `npx tsc --noEmit` passes on your file.
