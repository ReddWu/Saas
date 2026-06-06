// The Project Library (née Species Archive) — every run Darwin ever made is a
// PROJECT: the shipped survivor, and a graveyard of judged ideas each carrying
// its pros AND cons, available for a human founder to adopt. Read straight from
// the InsForge system of record (darwin_runs + darwin_events), server-rendered
// on each visit so the newest run shows up as soon as it lands in Postgres.

import Link from "next/link";
import { listRuns, listRunEvents } from "@/lib/insforge";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Species {
  id: string;
  createdAt: string;
  status: string;
  survivorTitle: string | null;
  survivorUrl: string | null;
  betTarget: number | null;
  finalSeo: number | null;
  won: boolean | null;
  graveyard: { title: string; pitch?: string; epitaph: string; pro?: string }[];
}

async function loadArchive(): Promise<Species[]> {
  const runs = await listRuns();
  const events = await listRunEvents(runs.map((r) => r.id));

  const byRun = new Map<string, { ideas: Idea[]; kills: Map<string, { epitaph: string; pro?: string }> }>();
  for (const e of events) {
    const slot = byRun.get(e.run_id) ?? { ideas: [], kills: new Map() };
    if (e.type === "ideas" && Array.isArray(e.payload?.ideas)) slot.ideas = e.payload.ideas;
    if (e.type === "kill" && e.payload?.ideaId)
      slot.kills.set(e.payload.ideaId, { epitaph: e.payload.causeOfDeath ?? "", pro: e.payload.pro });
    byRun.set(e.run_id, slot);
  }

  return runs.map((r) => {
    const slot = byRun.get(r.id);
    const graveyard = slot
      ? slot.ideas
          .filter((i) => slot.kills.has(i.id))
          .map((i) => ({
            title: i.title,
            pitch: i.pitch,
            epitaph: slot.kills.get(i.id)!.epitaph,
            pro: slot.kills.get(i.id)!.pro,
          }))
      : [];
    return {
      id: r.id,
      createdAt: r.created_at,
      status: r.status,
      survivorTitle: r.survivor_title,
      survivorUrl: r.survivor_url,
      betTarget: r.bet_target,
      finalSeo: r.final_seo,
      won: r.won,
      graveyard,
    };
  });
}

function outcome(s: Species) {
  if (s.status === "running") return { label: "⏳ EVOLVING", cls: "running" };
  if (s.won) return { label: "🟢 SHIPPED & WON", cls: "won" };
  if (s.finalSeo != null && s.betTarget != null) return { label: "🔴 BET LOST · adoptable", cls: "lost" };
  return { label: "💤 ADOPTABLE", cls: "running" };
}

export default async function Archive() {
  const species = await loadArchive();

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <h1>Project Library</h1>
          <span className="tag">every run is a project — shipped survivors, and judged ideas waiting to be adopted</span>
        </div>
        <Link className="backlink" href="/">← Control Room</Link>
      </div>

      {species.length === 0 ? (
        <div className="panel">
          <div className="empty">No runs recorded yet. Awaken Darwin once and the archive begins.</div>
        </div>
      ) : (
        <div className="archive">
          {species.map((s) => {
            const o = outcome(s);
            return (
              <div key={s.id} className="panel specimen">
                <div className="spec-head">
                  <div>
                    <div className="spec-title">{s.survivorTitle ?? "(no survivor)"}</div>
                    <div className="spec-date">{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`spec-outcome ${o.cls}`}>{o.label}</span>
                </div>

                <div className="spec-stats">
                  {s.betTarget != null && <span>🎯 bet: SEO ≥ {s.betTarget}</span>}
                  {s.finalSeo != null && <span>🧬 final: {s.finalSeo}</span>}
                  {s.survivorUrl?.startsWith("http") && (
                    <a href={s.survivorUrl} target="_blank" rel="noreferrer">🔗 live site</a>
                  )}
                </div>

                {s.graveyard.length > 0 && (
                  <>
                    <div className="grave-head">🪦 judged ideas — adoptable, verdicts included</div>
                    <div className="graveyard">
                      {s.graveyard.map((g) => (
                        <div key={g.title} className="tomb">
                          <div className="tomb-title">{g.title}</div>
                          {g.pro && <div className="tomb-pro">✅ {g.pro}</div>}
                          <div className="tomb-epitaph">☠ {g.epitaph}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <footer className="archive-foot">
        system of record: InsForge Postgres — darwin_runs · darwin_events ·
        adopt-a-project flow coming next: pick any idea here and Darwin restarts its
        loop from the Founder stage
      </footer>
    </div>
  );
}
