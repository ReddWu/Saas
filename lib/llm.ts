// Thin LLM wrapper with a swappable provider, in priority order:
//   1. DARWIN_MOCK=1            -> offline replay provider (guaranteed-complete demo)
//   2. OPENROUTER_API_KEY set   -> InsForge model gateway (OpenRouter, OpenAI-compatible)  [sponsor]
//   3. ANTHROPIC_API_KEY set    -> Anthropic direct
//   4. any failure above        -> offline replay provider (reliability net)
// The call signature is identical across providers, so swapping is config-only.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { mockLlm } from "./mock";

const forceMock = process.env.DARWIN_MOCK === "1";
const useGateway = !!process.env.OPENROUTER_API_KEY;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// InsForge model gateway via OpenRouter's OpenAI-compatible API.
const gateway = useGateway
  ? new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: { "X-Title": "DarwinSaaS" },
    })
  : null;

// Anthropic-style model id (direct) and the gateway-style id (OpenRouter).
const ANTHROPIC_MODEL = process.env.DARWIN_MODEL || "claude-sonnet-4-6";
const GATEWAY_MODEL = process.env.DARWIN_GATEWAY_MODEL || "anthropic/claude-sonnet-4.6";

export interface LlmOpts {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function llm(prompt: string, opts: LlmOpts = {}): Promise<string> {
  if (forceMock) return mockLlm(prompt, opts.system);
  try {
    if (gateway) {
      const res = await gateway.chat.completions.create(
        {
          model: GATEWAY_MODEL,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.8,
          messages: [
            ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
            { role: "user" as const, content: prompt },
          ],
        },
        // Hard timeout: a stalled gateway must throw (-> mock fallback), never hang the run.
        { timeout: 60_000 }
      );
      return res.choices[0]?.message?.content ?? "";
    }
    if (anthropic) {
      const res = await anthropic.messages.create(
        {
          model: ANTHROPIC_MODEL,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.8,
          ...(opts.system ? { system: opts.system } : {}),
          messages: [{ role: "user", content: prompt }],
        },
        { timeout: 60_000 }
      );
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    }
    // No provider configured.
    return mockLlm(prompt, opts.system);
  } catch (e) {
    // Reliability net: if the real provider is unavailable, fall back to the offline
    // replay provider so the demo always completes.
    console.warn("[llm] provider call failed, using mock:", (e as Error)?.message);
    return mockLlm(prompt, opts.system);
  }
}

// Resilient structured call: get JSON from the real provider, and if the call OR the
// parse fails for any reason (truncation, prose, provider down), fall back to the
// offline replay provider's valid output. Stages that need structured data use this so
// a single bad model response can never crash the run.
export async function llmJson<T>(prompt: string, opts: LlmOpts = {}): Promise<T> {
  try {
    const text = await llm(prompt, opts);
    return extractJson<T>(text);
  } catch (e) {
    console.warn("[llmJson] real/parse failed, using mock:", (e as Error)?.message);
    return extractJson<T>(mockLlm(prompt, opts.system));
  }
}

// Parse a JSON object/array out of an LLM response, tolerating prose/markdown fences.
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[\[{]/);
  if (start === -1) throw new Error("no JSON found in LLM output: " + text.slice(0, 200));
  const open = body[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let end = -1;
  for (let i = start; i < body.length; i++) {
    if (body[i] === open) depth++;
    else if (body[i] === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const slice = body.slice(start, end === -1 ? undefined : end + 1);
  return JSON.parse(slice) as T;
}
