// Replicas fleet integration — the 4 boardroom personas as a REAL parallel agent fleet,
// one VM-isolated Claude agent per persona (Best-Sponsor-Tool centerpiece).
//
// Auth: reads REPLICAS_API_KEY + REPLICAS_ORG_ID from env, or falls back to the local
// `~/.replicas/config.json` session (access_token + organization_id) written by the
// Replicas login. Each agent must have Claude credentials connected in the Replicas
// dashboard (Settings → Agents) — without that the agent boots but returns
// "Couldn't authenticate with Claude".
//
// Flow per persona: POST /v1/replica (coding_agent "claude") with the persona prompt +
// ideas, instructing the agent to write its verdicts to ~/.replicas/canvas/verdict.json;
// poll GET /v1/replica/{id}/canvas/verdict.json until present; parse PersonaVerdict[].
// Falls back to parsing the agent's final chat result if it answered inline.

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Idea, PersonaVerdict, PersonaId } from "./types";
import { PERSONA_BY_ID } from "./personas";
import { extractJson } from "./llm";
import { ev } from "./store";

const API = "https://api.tryreplicas.com";
const ENV_ID = process.env.REPLICAS_ENV_ID || "a5186171-8929-4dd5-9fed-3e1fdd96bb41"; // Global env
const MODEL = process.env.REPLICAS_MODEL || "sonnet";
const POLL_MS = 4000;
const TIMEOUT_MS = Number(process.env.REPLICAS_TIMEOUT_MS || 180_000);

interface Creds {
  token: string;
  org: string;
}

let cachedCreds: Creds | null | undefined;

function readCreds(): Creds | null {
  if (cachedCreds !== undefined) return cachedCreds;
  // Prefer explicit env (production / CI).
  if (process.env.REPLICAS_API_KEY && process.env.REPLICAS_ORG_ID) {
    cachedCreds = { token: process.env.REPLICAS_API_KEY, org: process.env.REPLICAS_ORG_ID };
    return cachedCreds;
  }
  // Fall back to the local Replicas login session.
  try {
    const raw = require("fs").readFileSync(
      path.join(os.homedir(), ".replicas", "config.json"),
      "utf8"
    );
    const c = JSON.parse(raw);
    if (c.access_token && c.organization_id) {
      cachedCreds = { token: c.access_token, org: c.organization_id };
      return cachedCreds;
    }
  } catch {
    /* no local session */
  }
  cachedCreds = null;
  return null;
}

export const replicasEnabled = !!readCreds();

function headers(c: Creds) {
  return {
    Authorization: `Bearer ${c.token}`,
    "Replicas-Org-Id": c.org,
    "X-Replicas-Api-Version": "2026-05-17",
    "Content-Type": "application/json",
  };
}

function ideaBlock(ideas: Idea[]): string {
  return ideas
    .map(
      (i) =>
        `[${i.id}] ${i.title} — ${i.pitch}\n    pain: ${i.painPoint} | site: ${i.websiteType} | revenue: ${i.monetization}`
    )
    .join("\n");
}

async function spawn(c: Creds, persona: PersonaId, ideas: Idea[], extra = ""): Promise<string> {
  const p = PERSONA_BY_ID[persona];
  const message = `${p.system}
${extra ? `\n${extra}\n` : ""}
Here are ${ideas.length} startup ideas:
${ideaBlock(ideas)}

Judge EACH idea in your persona. Do NOT write any files, run any tools, or explore — just
think and answer. Your FINAL message must be ONLY a raw JSON array (no prose, no markdown
fences, no preamble), one object per idea:
[{ "ideaId": "idea-N", "score": <0-100, harsh>, "attack": "<one sharp in-character sentence, MAX 25 words>", "pro": "<the strongest thing FOR it, MAX 18 words>" }]`;

  const res = await fetch(`${API}/v1/replica`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({
      name: `darwin-${persona}`,
      environment_id: ENV_ID,
      coding_agent: "claude",
      model: MODEL,
      size: "small",
      message,
    }),
  });
  if (!res.ok) throw new Error(`spawn ${persona} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const id = data?.replica?.id || data?.id;
  if (!id) throw new Error(`spawn ${persona}: no replica id in response`);
  return id;
}

async function pollVerdicts(c: Creds, id: string, persona: PersonaId): Promise<PersonaVerdict[]> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const hist = await fetch(`${API}/v1/replica/${id}/history`, { headers: headers(c) });
    if (hist.ok) {
      const h = await hist.json();
      const events = h.events || [];
      // The agent's final result message carries the answer (and error status).
      const result = events.find((e: any) => e?.type === "claude-result");
      const payload = result?.payload ?? result?.content;
      if (payload?.is_error) throw new Error(`replica ${persona} agent error: ${payload.result}`);
      if (payload?.result && /\[\s*\{/.test(payload.result)) {
        // Anchor on the JSON-array-of-objects start: agents sometimes open with
        // bracketed prose like "[PERSONALIZED...]" which is not the verdict array.
        const jsonish = payload.result.slice(payload.result.search(/\[\s*\{/));
        const raw = extractJson<PersonaVerdict[]>(jsonish);
        return raw.map((v) => ({ ...v, persona }));
      }
      // Fallback: a Canvas file, if the agent wrote one.
      const cv = await fetch(`${API}/v1/replica/${id}/canvas/verdict.json`, { headers: headers(c) });
      if (cv.ok) {
        const item = await cv.json();
        const content = item?.content ?? item?.text ?? "";
        if (content && /\[\s*\{/.test(content)) {
          const raw = extractJson<PersonaVerdict[]>(content.slice(content.search(/\[\s*\{/)));
          return raw.map((v) => ({ ...v, persona }));
        }
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`replica ${persona} timed out after ${TIMEOUT_MS}ms`);
}

// Run the given personas over the given ideas as a real Replicas fleet, in parallel.
// `extra` is optional shared context (e.g. the YC-registry evidence block).
export async function runPersonaFleet(
  personaIds: PersonaId[],
  ideas: Idea[],
  extra = ""
): Promise<PersonaVerdict[]> {
  const c = readCreds();
  if (!c) throw new Error("Replicas not configured");
  ev.log("boardroom", `🛰️ Replicas: spawning ${personaIds.length} VM-isolated agents in parallel…`);
  const results = await Promise.all(
    personaIds.map(async (pid) => {
      const id = await spawn(c, pid, ideas, extra);
      ev.log("boardroom", `🛰️ Replicas: agent ${PERSONA_BY_ID[pid].name} live (${id.slice(0, 8)})`);
      try {
        return await pollVerdicts(c, id, pid);
      } finally {
        // Always tear the VM down — leaked workspaces burn the minutes quota and
        // eventually exhaust the account's concurrency limit.
        fetch(`${API}/v1/replica/${id}`, { method: "DELETE", headers: headers(c) }).catch(() => {});
      }
    })
  );
  return results.flat();
}
