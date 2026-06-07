// Blog writer — turns a chosen keyword into a real SEO blog draft for the shipped site.
//
// Protocol note: the article is requested as RAW MARKDOWN behind a tiny TITLE/
// DESCRIPTION header — never JSON. Wrapping a 1200-word article in a JSON string
// breaks constantly (escaping + truncation -> silent mock fallback was shipping
// placeholder content). String parsing is robust at any length.

import { llm } from "./llm";
import type { Idea, PredictionMatrix, KeywordRow } from "./types";

export interface BlogDraft {
  title: string;
  slug: string; // kebab-case, used as /blog-<slug>.html
  description: string; // meta description for the blog page (<=155 chars)
  markdown: string;
}

export interface BlogSiteContext {
  survivor: Idea;
  bet: PredictionMatrix;
  pages: { slug: string; title: string }[]; // existing site pages for internal links
  publishedBlogs: { slug: string; title: string }[]; // earlier posts for cross-links
}

const kebab = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

export async function writeBlog(
  keyword: KeywordRow,
  site: BlogSiteContext
): Promise<BlogDraft> {
  const internal = [
    `/ "homepage — ${site.survivor.title}"`,
    ...site.pages.map((p) => `/${p.slug}.html "${p.title}"`),
    ...site.publishedBlogs.map((b) => `/blog-${b.slug}.html "${b.title}" (earlier post)`),
  ].join(", ");

  const raw = await llm(
    `Write an SEO blog post that could genuinely rank for the target keyword.

PRODUCT (the site this publishes on):
"${site.survivor.title}" — ${site.survivor.pitch}
Pain it solves: ${site.survivor.painPoint}

TARGET KEYWORD: "${keyword.keyword}" (search intent: ${keyword.intent})

HARD REQUIREMENTS:
- 1100-1500 words of genuinely useful, specific content for that intent — concrete
  steps, examples, trade-offs. Zero marketing fluff before the reader gets value.
- Keyword placement: in the H1, in the first 80 words, and in at least one H2 — naturally.
- Structure: one # H1; 4-6 ## sections; at least one bulleted or numbered list;
  one "## FAQ" section near the end with 3 ### questions people actually ask;
  final "## " CTA section that links to / and mentions ${site.survivor.title} honestly.
- INTERNAL LINKS: at least 3, chosen from: ${internal} — as [anchor](relative-href).
- EXTERNAL EVIDENCE: at least 2 links to real authoritative pages that support factual
  claims (official docs, MDN, Wikipedia, well-known vendor docs). Only real, stable URLs.
- Voice: a practitioner who has felt this pain — first person plural, no hype words.

OUTPUT FORMAT — exactly this, no preamble, no code fences:
TITLE: <compelling title containing the keyword, <=65 chars>
DESCRIPTION: <meta description with the keyword, 120-155 chars>
---
# <the H1>
<the full markdown article>`,
    { maxTokens: 4000, temperature: 0.7 }
  );

  // Parse the raw protocol; tolerate stray whitespace / missing pieces.
  const titleM = raw.match(/^\s*TITLE:\s*(.+)$/m);
  const descM = raw.match(/^\s*DESCRIPTION:\s*(.+)$/m);
  const bodyIdx = raw.indexOf("\n---");
  let markdown = bodyIdx >= 0 ? raw.slice(bodyIdx + 4).trim() : raw.trim();
  // Strip accidental code fences.
  markdown = markdown.replace(/^```(?:markdown)?\s*/i, "").replace(/```\s*$/, "").trim();

  const title =
    titleM?.[1]?.trim() ||
    markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    keyword.keyword;
  const description =
    descM?.[1]?.trim().slice(0, 155) ||
    `${keyword.keyword} — a practical guide from ${site.survivor.title}.`;

  if (markdown.split(/\s+/).length < 150) {
    // Far too short to be a real article — treat as failure so the caller can retry.
    throw new Error("blog draft came back too short");
  }

  return { title, slug: kebab(keyword.keyword), description, markdown };
}
