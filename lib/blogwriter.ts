// Blog writer — turns a chosen keyword into an SEO blog draft for the shipped site.
// OWNED BY THE BLOG AGENT (see BLOG_HANDOFF.md). Keep the exported signature intact;
// everything else in this file may be rewritten. The pipeline only imports writeBlog.
//
// This is a working PLACEHOLDER implementation — replace its internals with the real
// one per the handoff contract (better structure, internal/external links, evidence).

import { llmJson } from "./llm";
import type { Idea, PredictionMatrix, KeywordRow } from "./types";

export interface BlogDraft {
  title: string;
  slug: string; // kebab-case, used as /blog-<slug>.html
  markdown: string;
}

export interface BlogSiteContext {
  survivor: Idea;
  bet: PredictionMatrix;
  pages: { slug: string; title: string }[]; // existing site pages for internal links
  publishedBlogs: { slug: string; title: string }[]; // earlier posts for cross-links
}

export async function writeBlog(
  keyword: KeywordRow,
  site: BlogSiteContext
): Promise<BlogDraft> {
  const draft = await llmJson<BlogDraft>(
    `Write an SEO blog post for the product "${site.survivor.title}" (${site.survivor.pitch}).
Target keyword: "${keyword.keyword}" (intent: ${keyword.intent}).
Internal pages you may link to (use relative hrefs like /use-cases.html): ${site.pages
      .map((p) => `/${p.slug}.html "${p.title}"`)
      .join(", ")} and the homepage "/".
Return ONLY JSON:
{
  "title": "<compelling, keyword-bearing title>",
  "slug": "<kebab-case-from-keyword>",
  "markdown": "<600-900 words. ## sections. MUST include >=2 internal links (relative) and >=2 external evidence links (real authoritative URLs) in [text](url) form. End with a CTA linking to />"
}`,
    { maxTokens: 2200, temperature: 0.7 }
  );
  // Defensive slug normalization.
  draft.slug = (draft.slug || keyword.keyword)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return draft;
}
