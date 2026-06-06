// Offline replay provider. Produces believable, varied, schema-correct outputs for
// every prompt the pipeline issues, so the full demo runs with ZERO external calls.
// Activated by DARWIN_MOCK=1, or automatically when the real API call fails (e.g. no
// credits / no network) — this is the plan's "cached debate fallback" reliability net.

// Deterministic per-call jitter so repeated runs vary a little without Math.random.
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const MOCK_IDEAS = [
  { title: "ReviewReply AI", pitch: "Auto-drafts on-brand replies to every Google review.", painPoint: "SMB owners drown in review responses.", source: "Reddit r/smallbusiness review overload", websiteType: "focused SaaS app", monetization: "Paid subscription $29/mo" },
  { title: "ClipToPost", pitch: "Turns long YouTube videos into SEO-ready blog posts.", painPoint: "Creators waste hours repurposing video into text.", source: "Twitter: video-to-blog demand", websiteType: "free tool + paid upgrade", monetization: "Freemium, $19/mo Pro" },
  { title: "WebhookWatch", pitch: "Drop-in dashboard that catches and replays failed webhooks.", painPoint: "Silent webhook failures cost revenue.", source: "HN: hidden cost of webhooks", websiteType: "focused SaaS app", monetization: "Usage-based $0.001/event" },
  { title: "FakeCofounder", pitch: "A daily AI accountability partner that grills you on your goals.", painPoint: "Solo founders lack accountability.", source: "HN: fake cofounder", websiteType: "focused SaaS app", monetization: "Paid subscription $15/mo" },
  { title: "FigmaEscape", pitch: "Directory + comparison of Figma alternatives by use case.", painPoint: "Designers hunting cheaper Figma swaps.", source: "Twitter: Figma price anger", websiteType: "programmatic SEO content site", monetization: "Google Ads + affiliate links" },
  { title: "ColdResearch", pitch: "Researches a prospect, then writes the cold email.", painPoint: "Generic cold email is dead.", source: "HN: hyper-personalized cold email", websiteType: "focused SaaS app", monetization: "Usage-based, $0.10/email" },
  { title: "JobHunterOS", pitch: "Local-LLM job-search autopilot that tailors every application.", painPoint: "Job hunting is repetitive grunt work.", source: "HN: automated job search", websiteType: "focused SaaS app", monetization: "Paid subscription $25/mo" },
  { title: "DietRSS", pitch: "Curated RSS feeds to rebuild a healthy information diet.", painPoint: "People want to escape the algorithm.", source: "HN: RSS is back", websiteType: "programmatic SEO content site", monetization: "Google Ads + $5/mo ad-free" },
  { title: "DeployGlue", pitch: "One command to wire a weekend Cursor app to a real backend.", painPoint: "Vibe-coded apps stall at deploy.", source: "Twitter: built X in a weekend", websiteType: "developer tool", monetization: "Usage-based + $39/mo team" },
  { title: "FlowForge", pitch: "Workflow-specific AI templates, unlike generic Notion AI.", painPoint: "Notion AI is too generic for real work.", source: "Twitter: Notion AI too generic", websiteType: "free tool + paid upgrade", monetization: "Freemium, $12/mo" },
];

const ATTACKS: Record<string, string[]> = {
  socratic: [
    "What is the user actually doing today instead — and why would they switch?",
    "This stacks three unvalidated assumptions; which one, if wrong, kills it on day one?",
    "You've described a feature. Where is the workflow a human would pay to never do again?",
    "Who told you this pain is acute and not merely annoying? Show me the evidence.",
  ],
  architect: [
    "Three unconfirmed assumptions, and the rate-limit on that API kills you at 100 users.",
    "This is a weekend clone with a landing page. The moat is a CSS gradient.",
    "Over-engineered for a problem a cron job and a prompt already solve for free.",
    "Your 'realtime' layer falls over the first time two people use it at once.",
  ],
  investor: [
    "No distribution story, willingness-to-pay is a guess, and incumbents bundle this for free.",
    "I just saw a near-identical pitch with more traction; your 'advantage' is a feature, not a company.",
    "Three reasons I pass: thin moat, fuzzy ICP, and a price no one validated.",
    "The 'unique' angle you're proudest of is the easiest thing for a competitor to copy.",
  ],
  archaeologist: [
    "This is 2021's failed cohort reborn — they died of zero willingness to pay. Same grave awaits.",
    "I've buried four of these: all 'feature-not-a-company,' all platform-risk roadkill.",
    "Looks exactly like a product that died when the platform it depended on changed one API.",
    "Confident founders, identical pitch, dead in 14 months — the cause of death was distribution.",
  ],
};

const PROS = [
  "The pain is real and felt weekly — frequency is on its side.",
  "Genuinely cheap to validate: a landing page and 10 conversations settle it.",
  "The wedge is narrow enough to own before incumbents notice.",
  "Usage naturally spreads it — every output is a small ad for the product.",
  "Willingness-to-pay is plausible: it touches revenue, not convenience.",
  "Timing works: the underlying platform shift is real and recent.",
];

function detectPersona(system: string): keyof typeof ATTACKS {
  if (/Socratic/i.test(system)) return "socratic";
  if (/Architect/i.test(system)) return "architect";
  if (/Investor/i.test(system)) return "investor";
  return "archaeologist";
}

// Extract [idea-N] ids present in a judging prompt.
function idsIn(prompt: string): string[] {
  return Array.from(prompt.matchAll(/\[(idea-\d+)\]/g)).map((m) => m[1]);
}

export function mockLlm(prompt: string, system?: string): string {
  // Scout: generate ideas
  if (/micro-SaaS ideas/i.test(prompt) && /websiteType/i.test(prompt)) {
    return JSON.stringify(MOCK_IDEAS);
  }
  // Persona judging
  if (/Judge EACH idea/i.test(prompt)) {
    const persona = detectPersona(system || "");
    const ids = idsIn(prompt);
    const out = ids.map((id, i) => {
      const seed = hash(id + persona + i);
      // Spread scores so ranking is non-trivial; investor a touch harsher.
      const base = 35 + (Math.abs(seed) % 55);
      const score = persona === "investor" ? Math.max(20, base - 8) : base;
      return { ideaId: id, score, attack: pick(ATTACKS[persona], seed), pro: pick(PROS, seed + 7) };
    });
    return JSON.stringify(out);
  }
  // Prediction Matrix bet
  if (/Prediction Matrix/i.test(prompt)) {
    return JSON.stringify({
      metric: "seo",
      baseline: 70,
      target: 90,
      hypothesis: "Add 5 long-tail SEO landing pages, a meta description, JSON-LD structured data, and a sitemap.",
      predictedFailureMode: "If it stays a single bare page with no metadata, Google never indexes it and growth flatlines.",
    });
  }
  // Landing copy
  if (/landing-page copy/i.test(prompt)) {
    return JSON.stringify({
      features: [
        { title: "Solves the real pain", body: "Removes the busywork in one click." },
        { title: "One job, done well", body: "No bloat, no generic AI — just the workflow." },
        { title: "Ship in minutes", body: "Connect once and you're live." },
        { title: "Priced for solos", body: "Flat, honest pricing built for one person." },
      ],
      seoPages: [
        { slug: "use-cases", title: "Use cases", h1: "Use cases", body: "Where this saves you hours every week." },
        { slug: "pricing", title: "Pricing", h1: "Simple pricing", body: "One flat plan, cancel anytime." },
        { slug: "alternatives", title: "Alternatives", h1: "Why switch", body: "How it beats the generic incumbents." },
        { slug: "faq", title: "FAQ", h1: "Frequently asked questions", body: "Everything you need before signing up." },
        { slug: "about", title: "About", h1: "About us", body: "Born in a boardroom death-match." },
      ],
    });
  }
  // Ops diagnosis
  if (/ONE punchy sentence/i.test(prompt)) {
    return "Injecting full on-page SEO — titles, meta descriptions, JSON-LD, and five indexed landing pages — so Google can actually find us.";
  }
  // Founder's Brief — the advocate's case + business plan
  if (/Founder's Brief/i.test(prompt)) {
    return JSON.stringify({
      whyItWins: [
        "Like Calendly, every use of the product is its own distribution — the output it generates carries the brand to the next user.",
        "It counter-positions against bloated incumbents the way Superhuman did against Gmail: narrow, fast, and unapologetically paid.",
        "The pain is felt weekly, not yearly — the frequency that killed Shyp works FOR this one.",
      ],
      opportunities: [
        "The incumbent's pricing anger is an open switching window right now.",
        "Long-tail SEO is uncontested: nobody owns the comparison keywords yet.",
        "Indie-hacker communities will share it for free if the free tier is honest.",
      ],
      risks: [
        "Platform risk: one API/ToS change upstream and the core loop breaks (the Twitter-ecosystem death).",
        "Feature-not-a-company: an incumbent could bundle this in a quarter (the Everpix squeeze).",
      ],
      input: { money: "$500 to first revenue (domain, email tool, ads test)", hoursPerWeek: "15-20 solo-founder hours", skills: ["shipping fast", "SEO writing", "talking to users"] },
      output: { m1: "20 posts live, 10 user interviews, 100 signups", m3: "1,000 search impressions/day, first 10 paying customers", m6: "$1k MRR or a documented kill decision" },
    });
  }
  // Growth Backlog — self-assigned tasks, each a falsifiable bet
  if (/growth backlog/i.test(prompt)) {
    return JSON.stringify([
      { title: "Write & publish 2 blog posts/day until 20 are live", cadence: "2/day × 10 days", topics: ["How [pain] silently costs you revenue", "X alternatives compared (2026)", "We analyzed 100 failures at [workflow]", "The 10-minute setup guide", "Why we charge from day one", "What today's HN front page means for [niche]"], hypothesis: "20 posts lift Search Console impressions by 1000", metric: "GSC impressions", target: 1000, dueInDays: 10 },
      { title: "Launch on HN/Product Hunt + 5 niche communities", cadence: "one launch/week", hypothesis: "Launches drive 300 visits and 30 signups", metric: "signups", target: 30, dueInDays: 14 },
      { title: "Run 10 user interviews from early signups", cadence: "3/week", hypothesis: "Interviews surface one must-fix objection blocking 50% of conversions", metric: "interviews done", target: 10, dueInDays: 21 },
      { title: "Ship the one most-requested integration", cadence: "single sprint", hypothesis: "Top integration lifts activation rate by 20%", metric: "activation %", target: 20, dueInDays: 30 },
    ]);
  }
  return "{}";
}
