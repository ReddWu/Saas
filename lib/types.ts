// Core domain types for DarwinSaaS.

export type Stage = "scout" | "boardroom" | "factory" | "mutation" | "founder" | "done";

export interface Idea {
  id: string;
  title: string;
  pitch: string; // one-liner
  painPoint: string; // the user pain it addresses
  source?: string; // which trend signal inspired it
  websiteType: string; // the concrete kind of site this becomes (landing+app, content/SEO site, directory, tool...)
  monetization: string; // how it makes money — e.g. "Paid subscription $19/mo", "Google Ads + affiliate", "usage-based"
  alive: boolean;
  causeOfDeath?: string; // one-line epitaph if eliminated
  strongestCase?: string; // the best argument FOR it (pros survive even when the idea doesn't)
  score?: number; // aggregate survival score 0-100
}

export type PersonaId = "socratic" | "architect" | "investor" | "archaeologist";

export interface PersonaVerdict {
  persona: PersonaId;
  ideaId: string;
  score: number; // 0-100, higher = more likely to survive
  attack: string; // the persona's signature critique
  pro?: string; // the strongest thing going FOR it — no idea dies without a fair hearing
}

export interface PredictionMatrix {
  // The public "bet" the boardroom makes on the survivor.
  metric: "seo" | "performance";
  baseline: number; // expected starting score
  target: number; // score the site must hit to win the bet
  hypothesis: string; // what change is predicted to move the metric
  predictedFailureMode: string; // archaeologist's warning
}

export interface FitnessRun {
  cycle: number;
  url: string;
  score: number;
  passed: boolean;
  at: string;
}

// Stage 5 — the Founder's Brief: the advocate's case for WHY the survivor wins,
// plus the business plan a human founder needs to decide whether to commit.
export interface FounderBrief {
  whyItWins: string[]; // 3 precedent-anchored arguments FOR the idea
  opportunities: string[];
  risks: string[];
  input: { money: string; hoursPerWeek: string; skills: string[] }; // what YOU invest
  output: { m1: string; m3: string; m6: string }; // milestones at 1/3/6 months
}

// A self-assigned growth task. Like the Prediction Matrix, every task is a BET:
// it carries a falsifiable hypothesis with a metric and target.
export interface GrowthTask {
  id: string;
  title: string; // e.g. "Write & publish 2 blog posts/day (20 total)"
  cadence: string; // e.g. "2/day × 10 days"
  topics?: string[]; // first topics: product-related + today's trend hooks
  hypothesis: string; // e.g. "20 posts lift search impressions by 1000"
  metric: string; // e.g. "Google Search Console impressions"
  target: number;
  dueInDays: number;
}

// Events streamed to the Control Room (and later persisted to InsForge realtime).
export type DarwinEvent =
  | { type: "stage"; stage: Stage; label: string; ts: number }
  | { type: "log"; stage: Stage; msg: string; ts: number }
  | { type: "ideas"; ideas: Idea[]; ts: number }
  | { type: "verdict"; verdict: PersonaVerdict; ts: number }
  | { type: "kill"; ideaId: string; causeOfDeath: string; pro?: string; ts: number }
  | { type: "survivor"; idea: Idea; ts: number }
  | { type: "bet"; bet: PredictionMatrix; ts: number }
  | { type: "deploy"; url: string; cycle: number; ts: number }
  | { type: "fitness"; run: FitnessRun; ts: number }
  | { type: "alert"; level: "red" | "green"; msg: string; ts: number }
  | { type: "brief"; brief: FounderBrief; ts: number }
  | { type: "tasks"; tasks: GrowthTask[]; ts: number }
  | { type: "done"; survivorUrl: string; ts: number };
