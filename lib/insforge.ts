// Server-side InsForge persistence. Writes the run + every emitted event to InsForge
// Postgres via the PostgREST-style REST API, using the admin key. Best-effort: a failed
// write never breaks the live run (the SSE stream is the source of truth for the UI;
// this is the durable system of record that fills the InsForge dashboard during the demo).

const HOST = process.env.INSFORGE_OSS_HOST;
const KEY = process.env.INSFORGE_API_KEY;

export const insforgeEnabled = !!HOST && !!KEY;

function url(table: string, query = "") {
  return `${HOST}/api/database/records/${table}${query}`;
}
const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// Insert rows; returns the created representation (array).
export async function dbInsert<T = any>(table: string, rows: any[]): Promise<T[]> {
  const res = await fetch(url(table), {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`insforge insert ${table} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Patch a row by id (PostgREST filter).
export async function dbUpdate(table: string, id: string, patch: Record<string, any>): Promise<void> {
  const res = await fetch(url(table, `?id=eq.${id}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`insforge update ${table} ${res.status}: ${await res.text()}`);
}

// Read rows with a PostgREST-style query string (e.g. "?order=created_at.desc&limit=24").
export async function dbSelect<T = any>(table: string, query: string): Promise<T[]> {
  const res = await fetch(url(table, query), { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`insforge select ${table} ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface RunRow {
  id: string;
  survivor_title: string | null;
  survivor_url: string | null;
  bet_target: number | null;
  final_seo: number | null;
  won: boolean | null;
  status: string;
  created_at: string;
}

// The Species Archive: every run Darwin ever made, newest first.
export async function listRuns(limit = 24): Promise<RunRow[]> {
  if (!insforgeEnabled) return [];
  try {
    return await dbSelect<RunRow>("darwin_runs", `?order=created_at.desc&limit=${limit}`);
  } catch (e) {
    console.warn("[insforge] listRuns failed:", (e as Error)?.message);
    return [];
  }
}

// The idea pools + kills for a set of runs, for the graveyard wall.
export async function listRunEvents(runIds: string[]): Promise<
  { run_id: string; type: string; payload: any }[]
> {
  if (!insforgeEnabled || runIds.length === 0) return [];
  try {
    return await dbSelect(
      "darwin_events",
      `?run_id=in.(${runIds.join(",")})&type=in.(ideas,kill)&order=seq&select=run_id,type,payload`
    );
  } catch (e) {
    console.warn("[insforge] listRunEvents failed:", (e as Error)?.message);
    return [];
  }
}

export async function createRun(): Promise<string | null> {
  if (!insforgeEnabled) return null;
  try {
    const [row] = await dbInsert<{ id: string }>("darwin_runs", [{ status: "running" }]);
    return row?.id ?? null;
  } catch (e) {
    console.warn("[insforge] createRun failed:", (e as Error)?.message);
    return null;
  }
}

export async function saveEvent(runId: string, seq: number, type: string, stage: string | null, payload: any) {
  if (!insforgeEnabled) return;
  try {
    await dbInsert("darwin_events", [{ run_id: runId, seq, type, stage, payload }]);
  } catch (e) {
    console.warn("[insforge] saveEvent failed:", (e as Error)?.message);
  }
}

export async function finishRun(runId: string, patch: Record<string, any>) {
  if (!insforgeEnabled) return;
  try {
    await dbUpdate("darwin_runs", runId, patch);
  } catch (e) {
    console.warn("[insforge] finishRun failed:", (e as Error)?.message);
  }
}
