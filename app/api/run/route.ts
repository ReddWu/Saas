import { NextResponse } from "next/server";
import { runPipeline, isActive } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (isActive()) {
    return NextResponse.json({ ok: false, msg: "A run is already in progress." });
  }
  // Fire and forget — the SSE stream carries progress.
  runPipeline();
  return NextResponse.json({ ok: true });
}
