// The YC registry — a REAL database of every launched Y Combinator company
// (~6,000, via the public yc-oss dataset, cached at .darwin/yc-companies.json).
// Given an idea, find its nearest real-world neighbors and their fates, so the
// judges argue from the actual ledger of who lived and who died in this space.
// Fully offline once cached; every consumer degrades silently if the file is absent.

import { readFileSync } from "fs";
import path from "path";

interface YcCompany {
  name: string;
  one_liner?: string;
  industry?: string;
  subindustry?: string;
  batch?: string;
  status: "Active" | "Acquired" | "Inactive" | "Public";
  tags?: string[];
}

let cache: YcCompany[] | null | undefined;

export function ycRegistry(): YcCompany[] | null {
  if (cache !== undefined) return cache;
  try {
    const raw = readFileSync(path.join(process.cwd(), ".darwin", "yc-companies.json"), "utf8");
    cache = JSON.parse(raw) as YcCompany[];
  } catch {
    cache = null;
  }
  return cache;
}

const STOP = new Set([
  "the","a","an","and","or","for","with","that","this","your","their","from","into",
  "tool","tools","app","apps","platform","website","saas","service","based","using",
  "auto","every","without","makes","make","help","helps",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w))
  );
}

// Nearest YC companies to a free-text idea description, fate included.
// Guarantees at least one Inactive (dead) neighbor when any matches — the
// archaeologist always gets a corpse to point at.
export function ycNeighbors(ideaText: string, limit = 4): YcCompany[] {
  const reg = ycRegistry();
  if (!reg) return [];
  const q = tokens(ideaText);
  const scored = reg
    .map((c) => {
      const hay = tokens(`${c.one_liner ?? ""} ${c.subindustry ?? ""} ${(c.tags ?? []).join(" ")}`);
      let score = 0;
      for (const w of q) if (hay.has(w)) score++;
      return { c, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, limit).map((x) => x.c);
  if (!top.some((c) => c.status === "Inactive")) {
    const dead = scored.find((x) => x.c.status === "Inactive")?.c;
    if (dead) top.splice(Math.max(0, top.length - 1), 1, dead);
  }
  return top;
}

const FATE: Record<YcCompany["status"], string> = {
  Active: "still alive",
  Acquired: "ACQUIRED (exit)",
  Public: "WENT PUBLIC",
  Inactive: "DEAD",
};

// Compact prompt block: real neighbors + fates for one idea. Empty string if no data.
export function ycNeighborBlock(ideaText: string, limit = 4): string {
  const hits = ycNeighbors(ideaText, limit);
  if (hits.length === 0) return "";
  return hits
    .map((c) => `- ${c.name} (YC ${c.batch ?? "?"}, ${FATE[c.status]}): ${c.one_liner ?? c.subindustry ?? ""}`)
    .join("\n");
}
