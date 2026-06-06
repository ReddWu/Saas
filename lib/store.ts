// In-memory event bus that backs the Control Room SSE stream and keeps a replay
// log so a late-joining browser sees the full run.
//
// Swap target: in emit(), also write each event to an InsForge `darwin_events`
// table and let the dashboard subscribe via InsForge realtime instead of SSE.
// The producer/consumer contract here is intentionally minimal so that swap is
// a one-function change.

import type { DarwinEvent } from "./types";
import { createRun, saveEvent, finishRun } from "./insforge";

type Listener = (e: DarwinEvent) => void;

class Bus {
  private log: DarwinEvent[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;
  private runIdPromise: Promise<string | null> = Promise.resolve(null);
  running = false;

  reset() {
    this.log = [];
    this.seq = 0;
    this.running = true;
    // Create the durable run row in InsForge (best-effort, non-blocking).
    this.runIdPromise = createRun();
  }

  emit(e: DarwinEvent) {
    this.log.push(e);
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        /* listener died; ignore */
      }
    }
    this.persist(e);
  }

  // Best-effort durable write to InsForge Postgres. Never blocks the live stream.
  private persist(e: DarwinEvent) {
    const seq = this.seq++;
    const stage = (e as any).stage ?? null;
    this.runIdPromise.then((runId) => {
      if (!runId) return;
      saveEvent(runId, seq, e.type, stage, e);
      // Keep the run headline row in sync for the dashboard / audit.
      if (e.type === "survivor") finishRun(runId, { survivor_title: (e as any).idea?.title });
      else if (e.type === "bet") finishRun(runId, { bet_target: (e as any).bet?.target });
      else if (e.type === "fitness") finishRun(runId, { final_seo: (e as any).run?.score });
      else if (e.type === "done")
        finishRun(runId, { survivor_url: (e as any).survivorUrl, status: "done" });
      else if (e.type === "alert" && (e as any).level === "green")
        finishRun(runId, { won: true });
    });
  }

  history(): DarwinEvent[] {
    return [...this.log];
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

// Survive Next.js dev hot-reload by stashing on globalThis.
const g = globalThis as unknown as { __darwinBus?: Bus };
export const bus: Bus = g.__darwinBus ?? (g.__darwinBus = new Bus());

// Convenience emitters used throughout the pipeline.
const now = () => Date.now();

export const ev = {
  stage: (stage: any, label: string) => bus.emit({ type: "stage", stage, label, ts: now() }),
  log: (stage: any, msg: string) => bus.emit({ type: "log", stage, msg, ts: now() }),
  ideas: (ideas: any) => bus.emit({ type: "ideas", ideas, ts: now() }),
  verdict: (verdict: any) => bus.emit({ type: "verdict", verdict, ts: now() }),
  kill: (ideaId: string, causeOfDeath: string, pro?: string) =>
    bus.emit({ type: "kill", ideaId, causeOfDeath, pro, ts: now() }),
  survivor: (idea: any) => bus.emit({ type: "survivor", idea, ts: now() }),
  bet: (bet: any) => bus.emit({ type: "bet", bet, ts: now() }),
  deploy: (url: string, cycle: number) => bus.emit({ type: "deploy", url, cycle, ts: now() }),
  fitness: (run: any) => bus.emit({ type: "fitness", run, ts: now() }),
  alert: (level: "red" | "green", msg: string) =>
    bus.emit({ type: "alert", level, msg, ts: now() }),
  brief: (brief: any) => bus.emit({ type: "brief", brief, ts: now() }),
  tasks: (tasks: any) => bus.emit({ type: "tasks", tasks, ts: now() }),
  done: (survivorUrl: string) => bus.emit({ type: "done", survivorUrl, ts: now() }),
};
