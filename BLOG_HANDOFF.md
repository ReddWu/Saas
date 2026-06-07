# ✍️ Hand-off: the Blog Writer (Keyword Lab's content engine)

> ⚠️ **STATUS: DONE — superseded.** The owner implemented the production version
> (raw TITLE/DESCRIPTION/markdown protocol — JSON wrapping of long articles kept
> truncating). Verified live: 1,445 words, FAQ, 8 internal + 3 external links.
> Blog agent: stand down; do not overwrite lib/blogwriter.ts.

**You are the blog agent.** Improve EXACTLY ONE file — `lib/blogwriter.ts` — which already
exists with a working placeholder. Do **NOT** edit any other file: the Keyword Lab UI,
API routes, sitegen, types, and mock provider are owned by another agent working
concurrently. When you're done, your better `writeBlog` drops in automatically.

## Context
DarwinSaaS ships a static marketing site for the surviving startup idea. The Control
Room shows a keyword table (keyword, KD, volume, intent); clicking "Generate blog"
calls `writeBlog(keyword, site)`; the human edits the markdown and publishes — the
post becomes `/blog-<slug>.html` on the live site (sitemap updated, redeployed).

## The contract (keep these EXACT exports & shapes)
```ts
export interface BlogDraft { title: string; slug: string; markdown: string }
export interface BlogSiteContext {
  survivor: Idea; bet: PredictionMatrix;
  pages: { slug: string; title: string }[];
  publishedBlogs: { slug: string; title: string }[];
}
export async function writeBlog(keyword: KeywordRow, site: BlogSiteContext): Promise<BlogDraft>
```
Types come from `./types` — import, don't redefine. Use `llmJson` from `./llm` for ALL
model calls (it inherits the InsForge gateway, 60s timeout, and offline-mock fallback;
never call a provider SDK directly).

## Quality bar (what "done" means)
1. 700-1000 words of genuinely useful content targeting the keyword's intent — not
   filler. Use the survivor's painPoint/pitch as the backbone.
2. **Internal links**: ≥2, relative (`/use-cases.html`, `/`), chosen from `site.pages`,
   plus cross-link earlier posts from `site.publishedBlogs` (`/blog-<slug>.html`) when any exist.
3. **External evidence links**: ≥2 real, authoritative URLs ([text](url)) supporting
   factual claims — docs, standards, well-known industry sources. No invented URLs:
   prefer stable domains (developer.mozilla.org, docs.github.com, vendor docs, Wikipedia).
4. Markdown structure: one `#` H1 (the title), 3-5 `##` sections, ≥1 bulleted list,
   short paragraphs, a closing CTA section linking to `/`.
5. SEO: keyword appears in H1, first 100 words, and ≥1 H2 — naturally, never stuffed.
6. `slug`: kebab-case ≤50 chars (placeholder already normalizes — keep that).
7. The prompt you build MUST contain the literal phrase **"SEO blog post"** (the
   offline mock provider matches on it — breaking this breaks the insurance demo path).

## Hard rules
- ONE file only: `lib/blogwriter.ts`. No new dependencies, no new files.
- `npx tsc --noEmit` must pass before you declare done.
- No screenshots/images for now (roadmap) — text + links only.

## Test standalone (don't rely on the app)
```bash
cd /Users/reddqichaowu/darwinsaas
npx tsx -e "
import {writeBlog} from './lib/blogwriter';
writeBlog(
 {keyword:'webhook retry best practices',kd:32,volume:1900,intent:'how-to',source:'est'},
 {survivor:{id:'i1',title:'HookGuard',pitch:'Catch & replay failed webhooks',painPoint:'silent webhook failures',websiteType:'SaaS',monetization:'usage-based',alive:true},
  bet:{metric:'seo',baseline:70,target:92,hypothesis:'',predictedFailureMode:''},
  pages:[{slug:'use-cases',title:'Use cases'},{slug:'pricing',title:'Pricing'}],
  publishedBlogs:[]}
).then(d=>{console.log(d.title,'|',d.slug);console.log(d.markdown)})"
```
Verify in the output: ≥2 relative internal links, ≥2 real external links, H1+H2 structure,
keyword placement. Then run `npx tsc --noEmit`. Ping the owner when both pass.
