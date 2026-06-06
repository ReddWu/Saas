// Cross-request state of the LAST shipped site, so the Keyword Lab's blog
// generate/publish API routes can rebuild and redeploy it. Stashed on globalThis
// (same pattern as the event bus) to survive Next.js dev hot-reload.

import type { Idea, PredictionMatrix } from "./types";
import type { fallbackCopy } from "./sitegen";

export interface PublishedBlog {
  slug: string;
  title: string;
  html: string; // rendered body html
}

export interface SiteState {
  survivor: Idea;
  bet: PredictionMatrix;
  copy: ReturnType<typeof fallbackCopy>;
  slug: string; // factory slug; live deploys go to `${slug}-v2`
  blogs: PublishedBlog[];
}

const g = globalThis as unknown as { __darwinSiteState?: SiteState | null };

export function setSiteState(s: SiteState) {
  g.__darwinSiteState = s;
}

export function getSiteState(): SiteState | null {
  return g.__darwinSiteState ?? null;
}
