// The autonomous loop: Scout -> Boardroom -> Factory -> Mutation. Emits events to the
// bus throughout so the Control Room can render the whole arc live.

import { runScout } from "./scout";
import { runBoardroom } from "./boardroom";
import { runFactory } from "./factory";
import { runMutation } from "./mutation";
import { runFounder } from "./founder";
import { bus, ev } from "./store";

// Stash the active flag on globalThis (like the bus) so a dev hot-reload can't
// reset it mid-run and let a second POST start a concurrent, interleaved run.
const g = globalThis as unknown as { __darwinActive?: boolean };

export function isActive() {
  return !!g.__darwinActive;
}

export async function runPipeline() {
  if (g.__darwinActive) return;
  g.__darwinActive = true;
  bus.reset();
  try {
    // Emit the run-boundary stage FIRST: clients clear previous-run state on a
    // fresh "scout" stage, so it must precede the opening log lines.
    ev.stage("scout", "🛰️ Scout — hunting today's trends");
    ev.log("scout", "🧬 DarwinSaaS awakening. Nobody is touching a keyboard.");
    if (process.env.DARWIN_MOCK === "1") {
      ev.log("scout", "🔌 Offline replay provider active (DARWIN_MOCK=1).");
    } else if (process.env.OPENROUTER_API_KEY) {
      ev.log("scout", "⚡ All model calls routed through the InsForge Model Gateway.");
    }
    const ideas = await runScout(10);
    const { survivor, bet } = await runBoardroom(ideas);
    const factory = await runFactory(survivor);
    const { finalUrl, finalDir } = await runMutation(survivor, bet, factory);
    await runFounder(survivor, bet, { slug: factory.slug, dir: finalDir });
    ev.stage("done", "✅ Run complete");
    ev.done(finalUrl);
  } catch (e: any) {
    ev.log("scout", `❌ Pipeline error: ${e?.message || e}`);
    ev.alert("red", `Pipeline error: ${e?.message || e}`);
  } finally {
    g.__darwinActive = false;
  }
}
