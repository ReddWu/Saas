// Knowledge packs ("skills") for the boardroom judges. Each persona carries a
// distilled doctrine from the books that shaped its worldview, and the two
// market-facing judges also carry a casebook of real startup outcomes
// (YC 2005-2025 + famous non-YC wins and deaths) they MUST cite as precedent.
// These are distilled frameworks and public facts — not book text.

import type { PersonaId } from "./types";

interface CaseEntry {
  company: string;
  tag: string; // e.g. "YC W09" or "—"
  outcome: "WON" | "DIED";
  note: string; // premise + why it won / cause of death, one line
}

export const CASEBOOK: CaseEntry[] = [
  // ---- wins: WHY they won, not just that they did ----
  { company: "Stripe", tag: "YC S09", outcome: "WON", note: "payments API — won on developer love as distribution; 7 lines of code beat bank sales teams" },
  { company: "Airbnb", tag: "YC W09", outcome: "WON", note: "stranger-home rentals — survived 'this is insane' by solving supply-side trust (photos, insurance)" },
  { company: "Dropbox", tag: "YC S07", outcome: "WON", note: "file sync — won a crowded space on ONE thing working flawlessly; demo video validated demand pre-build" },
  { company: "Zapier", tag: "YC S12", outcome: "WON", note: "no-code glue — long-tail SEO pages for every integration pair = compounding distribution moat" },
  { company: "Retool", tag: "YC W17", outcome: "WON", note: "internal-tool builder — boring wedge, high willingness-to-pay buyer (eng teams), expanded from there" },
  { company: "Gusto", tag: "YC W12", outcome: "WON", note: "payroll — regulatory complexity IS the moat; nobody clones compliance in a weekend" },
  { company: "Instacart", tag: "YC S12", outcome: "WON", note: "grocery delivery — same idea as dead Webvan, but asset-light timing (smartphones + gig labor)" },
  { company: "Superhuman", tag: "—", outcome: "WON", note: "email client at $30/mo — proved prosumers pay for speed; niche depth over breadth" },
  { company: "Notion", tag: "—", outcome: "WON", note: "docs+db — nearly died twice, won on community-led distribution and template ecosystem" },
  { company: "Calendly", tag: "—", outcome: "WON", note: "scheduling link — single-feature product whose usage IS its distribution (every invite recruits)" },
  // ---- deaths: the canonical failure taxonomy ----
  { company: "Homejoy", tag: "YC S10", outcome: "DIED", note: "home cleaning — coupon-acquired users never repaid CAC; died of unit economics + worker-classification suits" },
  { company: "Atrium", tag: "YC", outcome: "DIED", note: "law-firm-as-SaaS — $75M raised; services margins never became software margins" },
  { company: "Sprig", tag: "—", outcome: "DIED", note: "healthy food delivery — per-order economics negative at any scale; growth made losses bigger" },
  { company: "Munchery", tag: "—", outcome: "DIED", note: "meal delivery — same death as Sprig; the market kept funding the same corpse" },
  { company: "Shyp", tag: "—", outcome: "DIED", note: "shipping on demand — solved a pain people had RARELY, not daily; frequency kills LTV" },
  { company: "Beepi", tag: "—", outcome: "DIED", note: "used-car marketplace — burned $150M on ops a marketplace was supposed to NOT own" },
  { company: "Juicero", tag: "—", outcome: "DIED", note: "$400 juicer — over-engineered hardware for a problem hands solved free; the squeeze test" },
  { company: "Quibi", tag: "—", outcome: "DIED", note: "$1.75B short video — distribution assumed, not earned; incumbent (TikTok) owned the habit" },
  { company: "Color Labs", tag: "—", outcome: "DIED", note: "$41M pre-launch photo app — no one could state the user's problem in one sentence" },
  { company: "Clinkle", tag: "—", outcome: "DIED", note: "payments — raised on hype, shipped nothing; secrecy is not a moat" },
  { company: "Argo AI", tag: "—", outcome: "DIED", note: "self-driving, $3.6B — technology risk priced as execution risk; timing assumption never landed" },
  { company: "IFTTT", tag: "—", outcome: "DIED", note: "(as a business) automation glue — free users loved it, nobody paid; Zapier won by charging businesses from day 1" },
  { company: "Wantful", tag: "—", outcome: "DIED", note: "curated gifting — beautiful product, episodic usage; 2 purchases/year can't fund a company" },
  { company: "Sidecar", tag: "—", outcome: "DIED", note: "rideshare pioneer — right idea, out-raised 100:1 by Uber/Lyft; capital was the game, not product" },
  { company: "Everpix", tag: "—", outcome: "DIED", note: "best photo storage of its era — 'better product' lost to platform defaults (Apple/Google bundle it)" },
];

// Distilled doctrines — the frameworks each judge runs every idea through.
const DOCTRINES: Record<PersonaId, string> = {
  socratic: `
Your library (distilled): "The Mom Test" (Fitzpatrick), "The Lean Startup" (Ries),
and PG's essay "How to Get Startup Ideas".
Frameworks you apply to EVERY idea:
- Mom Test: any claim of demand based on what people SAY (not what they DO or PAY) is void.
- Leap-of-faith stack: list the unvalidated assumptions; an idea inherits the probability PRODUCT of its stack.
- Riskiest-assumption-first: if the founder is building before testing the killer question, say so.
- Well vs sitcom (PG): good ideas are wanted DESPERATELY by a few, not mildly by millions; sitcom ideas sound plausible and die.
- User urgency (PG): "who needs this so badly they'll use a rough v1 today?" — no name, no idea.
- Made-up vs discovered (PG): ideas invented in brainstorms (not lived) are suspect by default.`,
  architect: `
Your library (distilled): "Choose Boring Technology" (McKinlay), the Google SRE book.
Frameworks you apply to EVERY idea:
- Innovation tokens: an idea gets ~1 novel technical bet; count how many this one is secretly making.
- The 3am test: name the component that pages a human at 3am once real users arrive.
- Weekend-clone test: if the defensible part is "we built it first", it is not defensible.`,
  investor: `
Your library (distilled): "Zero to One" (Thiel), "7 Powers" (Helmer), "Venture Deals" (Feld).
Frameworks you apply to EVERY idea:
- Power law: would the BEST case here even return the fund? Niche tools with $29/mo caps usually can't.
- 7 Powers: which one (scale economies / network / counter-positioning / switching costs / brand / cornered resource / process power) does it have a CREDIBLE path to? "None" = pass.
- Distribution > product: a mediocre product with a distribution engine beats the reverse (Thiel).
- Default alive or default dead (PG): does the revenue model reach profitability before the money runs out, on FACTS not hopes? Usage-based pennies and $29/mo caps usually mean default dead.`,
  archaeologist: `
Your library: the CB Insights failure taxonomy (no market need, ran out of cash, out-competed,
flawed unit economics, platform risk), PG's "The 18 Mistakes That Kill Startups"
(marginal niche, derivative idea, no specific user in mind, platform choice, launching
too slow/too early, sacrificing users for the business model...), and the casebook of
real outcomes below. Diagnose each idea with the SPECIFIC named mistake it is making.`,
};

// Compact casebook block for the prompts of the market-facing judges.
function casebookBlock(): string {
  return (
    "CASEBOOK — real precedents you MUST cite by name when relevant:\n" +
    CASEBOOK.map((c) => `- ${c.company} (${c.tag}, ${c.outcome}): ${c.note}`).join("\n")
  );
}

// The judges whose verdicts should lean on historical precedent.
const GETS_CASEBOOK: PersonaId[] = ["investor", "archaeologist"];

// Append a persona's knowledge pack to its base system prompt.
export function withKnowledge(personaId: PersonaId, baseSystem: string): string {
  const parts = [baseSystem, DOCTRINES[personaId]];
  if (GETS_CASEBOOK.includes(personaId)) {
    parts.push(
      casebookBlock(),
      `When you attack an idea, anchor the attack in the closest precedent: name the company and the specific way the outcomes rhyme. Precedent-free attacks are weak attacks.`
    );
  }
  return parts.join("\n\n");
}

// One-liner for the demo feed: what each judge has loaded.
export const LIBRARY_SUMMARY =
  "📚 Judges loaded their libraries — 🧐 The Mom Test, Lean Startup, PG essays · 🔪 Boring Technology, SRE · 💸 Zero to One, 7 Powers, Venture Deals · ⚰️ PG's 18 Mistakes + " +
  `${CASEBOOK.length} real startup outcomes (YC 2005-2025 + the famous dead)`;
