"use client";

import { useEffect, useRef, useState } from "react";
import type { DarwinEvent, Idea, PredictionMatrix, FitnessRun, Stage, FounderBrief, GrowthTask, KeywordRow } from "@/lib/types";

const PERSONA_META: Record<string, { name: string; emoji: string; color: string }> = {
  socratic: { name: "Socratic Questioner", emoji: "🧐", color: "#6ee7ff" },
  architect: { name: "Savage Architect", emoji: "🔪", color: "#ff6e6e" },
  investor: { name: "Biased Investor", emoji: "💸", color: "#ffd166" },
  archaeologist: { name: "Historical Archaeologist", emoji: "⚰️", color: "#c792ea" },
};

const STAGES: { key: Stage; num: string; name: string }[] = [
  { key: "scout", num: "01", name: "🛰️ Scout" },
  { key: "boardroom", num: "02", name: "⚔️ Boardroom" },
  { key: "factory", num: "03", name: "🏭 Factory" },
  { key: "mutation", num: "04", name: "🧬 Mutation" },
  { key: "founder", num: "05", name: "🧭 Founder" },
];

interface FeedItem { who?: string; color?: string; text: string; kind: "verdict" | "kill" | "log"; }

export default function ControlRoom() {
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [bet, setBet] = useState<PredictionMatrix | null>(null);
  const [runs, setRuns] = useState<FitnessRun[]>([]);
  const [alert, setAlert] = useState<{ level: "red" | "green"; msg: string } | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [brief, setBrief] = useState<FounderBrief | null>(null);
  const [tasks, setTasks] = useState<GrowthTask[]>([]);
  const [handoff, setHandoff] = useState<{ repoUrl: string; prompt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [draft, setDraft] = useState<{ keyword: string; title: string; slug: string; description?: string; markdown: string } | null>(null);
  const [labBusy, setLabBusy] = useState<string | null>(null); // keyword being generated / "publish"
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [feed]);

  // Connect to the event stream on mount. The server replays history, so a refresh
  // reconstructs the current (or last) run instead of showing a blank screen.
  useEffect(() => {
    const es = new EventSource("/api/stream");
    esRef.current = es;
    es.onmessage = (m) => {
      try {
        handle(JSON.parse(m.data));
      } catch {}
    };
    return () => es.close();
  }, []);

  function handle(e: DarwinEvent) {
    switch (e.type) {
      case "stage":
        // A fresh "scout" stage marks a NEW run: clear any previous run's state so
        // secondary viewers (projector tab) don't render two runs merged together.
        if (e.stage === "scout") reset();
        setStage(e.stage);
        break;
      case "log": setFeed((f) => [...f, { text: e.msg, kind: "log" }]); break;
      case "ideas": setIdeas(e.ideas); break;
      case "verdict": {
        const p = PERSONA_META[e.verdict.persona];
        setFeed((f) => [...f, { who: `${p.emoji} ${p.name}`, color: p.color, text: e.verdict.attack, kind: "verdict" }]);
        break;
      }
      case "kill":
        setIdeas((arr) => arr.map((i) => i.id === e.ideaId ? { ...i, alive: false, causeOfDeath: e.causeOfDeath, strongestCase: e.pro } : i));
        break;
      case "survivor":
        setSurvivorId(e.idea.id);
        setIdeas((arr) => arr.map((i) => i.id === e.idea.id ? { ...i, ...e.idea, alive: true } : i));
        break;
      case "bet": setBet(e.bet); break;
      case "deploy": setDeployUrl(e.url); break;
      case "fitness": setRuns((r) => [...r, e.run]); break;
      case "alert": setAlert({ level: e.level, msg: e.msg }); break;
      case "brief": setBrief(e.brief); break;
      case "tasks": setTasks(e.tasks); break;
      case "handoff": setHandoff({ repoUrl: e.repoUrl, prompt: e.prompt }); break;
      case "keywords": setKeywords(e.keywords); break;
      case "done":
        // Keep the stream OPEN: closing it here broke any subsequent ⚡ AWAKEN
        // (the mount effect never re-runs, so no events would ever arrive again).
        setRunning(false);
        break;
    }
  }

  function reset() {
    setStage(null); setIdeas([]); setSurvivorId(null); setFeed([]);
    setBet(null); setRuns([]); setAlert(null); setDeployUrl(null);
    setBrief(null); setTasks([]); setHandoff(null); setCopied(false);
    setKeywords([]); setDraft(null); setLabBusy(null); setPublishedUrl(null);
  }

  async function generateBlog(kw: KeywordRow) {
    setLabBusy(kw.keyword); setPublishedUrl(null);
    try {
      const res = await fetch("/api/blog", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw }),
      });
      const d = await res.json();
      if (d?.markdown) setDraft({ keyword: kw.keyword, title: d.title, slug: d.slug, description: d.description, markdown: d.markdown });
    } finally { setLabBusy(null); }
  }

  async function publishBlog() {
    if (!draft) return;
    setLabBusy("publish");
    try {
      const res = await fetch("/api/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, slug: draft.slug, description: draft.description, markdown: draft.markdown }),
      });
      const d = await res.json();
      if (d?.url) { setPublishedUrl(d.url); setDraft(null); }
    } finally { setLabBusy(null); }
  }

  async function awaken() {
    if (running) return;
    reset();
    setRunning(true);
    // Defensive: if the stream ever dropped (sleep, network blip), reconnect first.
    if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
      const es = new EventSource("/api/stream");
      esRef.current = es;
      es.onmessage = (m) => {
        try { handle(JSON.parse(m.data)); } catch {}
      };
    }
    await fetch("/api/run", { method: "POST" });
  }

  const latestScore = runs.length ? runs[runs.length - 1].score : null;
  const dialColor = latestScore == null ? "#6ee7ff" : bet && latestScore >= bet.target ? "var(--green)" : "var(--red)";

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <h1>DarwinSaaS</h1>
          <span className="tag">the self-evolving SaaS factory · nobody touches a keyboard</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a className="archivelink" href="/archive">🏛️ Project Library</a>
          <button className="awaken" onClick={awaken} disabled={running}>
            {running ? "EVOLVING…" : "⚡ AWAKEN DARWIN"}
          </button>
        </div>
      </div>

      <div className="stages">
        {STAGES.map((s) => (
          <div key={s.key} className={`stage ${stage === s.key ? "active" : ""} ${
            STAGES.findIndex((x) => x.key === stage) > STAGES.findIndex((x) => x.key === s.key) || stage === "done" ? "done" : ""
          }`}>
            <div className="num">{s.num}</div>
            <div className="name">{s.name}</div>
          </div>
        ))}
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Idea Pool — survival of the fittest</h2>
          {ideas.length === 0 ? (
            <div className="empty">Press AWAKEN DARWIN to hunt today&apos;s trends…</div>
          ) : (
            <div className="ideas">
              {ideas.map((i) => (
                <div key={i.id} className={`idea ${!i.alive ? "dead" : ""} ${i.id === survivorId ? "survivor" : ""}`}>
                  <div className="t">{i.title}</div>
                  <div className="p">{i.pitch}</div>
                  {(i as any).monetization && <div className="p">💰 {(i as any).monetization}</div>}
                  {i.strongestCase && <div className="procase">✅ {i.strongestCase}</div>}
                  {i.causeOfDeath && <div className="death">☠ {i.causeOfDeath}</div>}
                  {typeof i.score === "number" && <div className="score">{i.score}</div>}
                </div>
              ))}
            </div>
          )}

          {bet && (
            <div className="bet">
              <h3>📜 Prediction Matrix — the boardroom&apos;s bet</h3>
              <p><b>Hypothesis:</b> {bet.hypothesis}</p>
              <p><b>Bet:</b> Lighthouse SEO {bet.baseline} → must reach <b>{bet.target}</b> to survive.</p>
              <p className="fail">⚠ Predicted failure mode: {bet.predictedFailureMode}</p>
            </div>
          )}

          {(bet || runs.length > 0) && (
            <>
              <div className="gauge">
                <div className="dial" style={{ ["--v" as any]: latestScore ?? 0, ["--c" as any]: dialColor } as any}>
                  <div className="inner"><div className="val">{latestScore ?? "—"}</div></div>
                </div>
                <div className="meta">
                  <div>Lighthouse SEO fitness</div>
                  {bet && <div>target: {bet.target}</div>}
                  <div className="fitnesshist">
                    {runs.map((r) => (
                      <span key={r.cycle}>cyc{r.cycle}: {r.score}{r.passed ? "✅" : "❌"}</span>
                    ))}
                  </div>
                </div>
              </div>
              {alert && <div className={`alert ${alert.level}`}>{alert.level === "red" ? "🔴 " : "🟢 "}{alert.msg}</div>}
              {deployUrl && (
                <a className="deploylink" href={deployUrl.startsWith("http") ? deployUrl : "#"} target="_blank" rel="noreferrer">
                  🔗 {deployUrl}
                </a>
              )}
              {alert?.level === "green" && deployUrl?.startsWith("http") && (
                <div className="qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=0d1320&color=4ade80&data=${encodeURIComponent(deployUrl)}`}
                    alt={`QR code for ${deployUrl}`}
                    width={160}
                    height={160}
                  />
                  <div className="qrlabel">📱 scan it — Darwin shipped this site, live, minutes ago</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <h2>The Boardroom — live kill feed</h2>
          <div className="feed" ref={feedRef}>
            {feed.length === 0 && <div className="empty">The 4 judges are waiting…</div>}
            {feed.map((m, idx) => (
              <div key={idx} className={`msg ${m.kind}`}>
                {m.who && <span className="who" style={{ color: m.color }}>{m.who}:</span>}
                {m.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {(brief || tasks.length > 0) && (
        <div className="founder">
          {brief && (
            <div className="panel">
              <h2>🧭 Founder&apos;s Brief — the case FOR it</h2>
              <div className="fb-block">
                <h3 className="fb-win">🛡️ Why it wins</h3>
                {brief.whyItWins?.map((w, i) => <p key={i} className="fb-item">• {w}</p>)}
              </div>
              <div className="fb-cols">
                <div className="fb-block">
                  <h3 className="fb-opp">🟢 Opportunities</h3>
                  {brief.opportunities?.map((o, i) => <p key={i} className="fb-item">• {o}</p>)}
                </div>
                <div className="fb-block">
                  <h3 className="fb-risk">🔴 Risks</h3>
                  {brief.risks?.map((r, i) => <p key={i} className="fb-item">• {r}</p>)}
                </div>
              </div>
              {brief.mvp && (
                <div className="fb-block mvp">
                  <h3 className="fb-mvp">🔧 What makes it USABLE</h3>
                  <p className="fb-item usable-bar">🎯 {brief.mvp.usableWhen}</p>
                  <div className="fb-cols">
                    <div>
                      <p className="fb-item"><b>Build only:</b></p>
                      {brief.mvp.core?.map((c, i) => <p key={i} className="fb-item">• {c}</p>)}
                    </div>
                    <div>
                      <p className="fb-item"><b>Cut from v1:</b></p>
                      {brief.mvp.cut?.map((c, i) => <p key={i} className="fb-item cut">✂️ {c}</p>)}
                    </div>
                  </div>
                  <p className="fb-item"><b>Stack:</b> {brief.mvp.stack}</p>
                </div>
              )}
              <div className="fb-cols">
                <div className="fb-block">
                  <h3>📥 Your input</h3>
                  <p className="fb-item">💵 {brief.input?.money}</p>
                  <p className="fb-item">⏱ {brief.input?.hoursPerWeek}</p>
                  <p className="fb-item">🛠 {brief.input?.skills?.join(" · ")}</p>
                </div>
                <div className="fb-block">
                  <h3>📤 The output</h3>
                  <p className="fb-item"><b>M1</b> {brief.output?.m1}</p>
                  <p className="fb-item"><b>M3</b> {brief.output?.m3}</p>
                  <p className="fb-item"><b>M6</b> {brief.output?.m6}</p>
                </div>
              </div>
            </div>
          )}
          {tasks.length > 0 && (
            <div className="panel">
              <h2>📋 Growth Backlog — every task is a bet</h2>
              {tasks.map((t) => (
                <div key={t.id} className="task">
                  <div className="task-head">
                    <span className="task-title">
                      <span className={`track-badge ${t.track === "build" ? "build" : "growth"}`}>
                        {t.track === "build" ? "🔨 BUILD" : "📣 GROWTH"}
                      </span>
                      {t.title}
                    </span>
                    <span className="task-due">⏳ {t.dueInDays}d · {t.cadence}</span>
                  </div>
                  {t.topics && t.topics.length > 0 && (
                    <div className="task-topics">✍️ {t.topics.slice(0, 4).join(" · ")}…</div>
                  )}
                  <div className="hypothesis">
                    📊 bet: {t.hypothesis} → <b>{t.metric} +{t.target}</b>
                  </div>
                </div>
              ))}
              {handoff && (
                <div className="handoff">
                  <h3>🚀 Hand-off — keep building</h3>
                  <p className="fb-item">
                    Darwin opened a repo with the site + a relay prompt (<code>BUILDME.md</code>):
                  </p>
                  <a className="deploylink" href={handoff.repoUrl} target="_blank" rel="noreferrer">
                    {handoff.repoUrl}
                  </a>
                  <button
                    className="copybtn"
                    onClick={() => {
                      navigator.clipboard?.writeText(handoff.prompt).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                  >
                    {copied ? "✅ Copied" : "📋 Copy prompt for Claude Code / Codex"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {keywords.length > 0 && (
        <div className="panel kwlab">
          <h2>🔎 Keyword Lab — pick a keyword, ship a post</h2>
          <table className="kwtable">
            <thead>
              <tr><th>keyword</th><th>KD</th><th>volume/mo</th><th>intent</th><th>data</th><th></th></tr>
            </thead>
            <tbody>
              {keywords.map((k) => (
                <tr key={k.keyword}>
                  <td className="kw">{k.keyword}</td>
                  <td className={k.kd != null && k.kd < 30 ? "kd easy" : "kd"}>{k.kd ?? "—"}</td>
                  <td>{k.volume.toLocaleString()}</td>
                  <td>{k.intent}</td>
                  <td><span className={`src ${k.source}`}>{k.source === "est" ? "est." : k.source === "suggest" ? "✓ live demand" : "Similarweb"}</span></td>
                  <td>
                    <button className="kwbtn" disabled={!!labBusy} onClick={() => generateBlog(k)}>
                      {labBusy === k.keyword ? "✍️ writing…" : "✍️ Generate blog"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft && (
            <div className="kweditor">
              <div className="kweditor-head">
                <input
                  className="kwtitle"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <button className="copybtn" disabled={labBusy === "publish"} onClick={publishBlog}>
                  {labBusy === "publish" ? "🚀 publishing…" : "🚀 Publish to the live site"}
                </button>
              </div>
              <textarea
                className="kwtext"
                value={draft.markdown}
                onChange={(e) => setDraft({ ...draft, markdown: e.target.value })}
                rows={14}
              />
              <div className="kwhint">markdown · edit freely · internal links stay relative (/pricing.html)</div>
            </div>
          )}

          {publishedUrl && (
            <div className="alert green" style={{ animation: "none" }}>
              ✍️ Published live →{" "}
              <a href={publishedUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                {publishedUrl}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
