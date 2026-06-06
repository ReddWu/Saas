// Measures the SEO score of a deployed site — the fitness function for the bet.
// Real path: Google PageSpeed Insights API on a public https URL (no install).
// Offline path: a structural SEO score computed directly from the site's HTML
// (title, meta description, lang, semantic headings, canonical, robots meta,
// sitemap, structured data). The offline score moves for the SAME real reasons
// Lighthouse's SEO audit does, so the v1->v2 delta is faithful in the demo too.

import { promises as fs } from "fs";
import path from "path";

export interface LighthouseResult {
  score: number; // 0-100 SEO
  real: boolean;
  detail: string;
}

export async function measureSeo(url: string, dir: string): Promise<LighthouseResult> {
  if (url.startsWith("http") && process.env.PAGESPEED_API_KEY) {
    try {
      const api =
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
        `&category=seo&key=${process.env.PAGESPEED_API_KEY}`;
      const res = await fetch(api);
      const json: any = await res.json();
      const raw = json?.lighthouseResult?.categories?.seo?.score;
      if (typeof raw === "number") {
        return { score: Math.round(raw * 100), real: true, detail: "PageSpeed Insights API" };
      }
    } catch {
      /* fall through */
    }
  }
  // Offline structural scorer.
  const html = await fs.readFile(path.join(dir, "index.html"), "utf8").catch(() => "");
  const hasSitemap = await fs
    .access(path.join(dir, "sitemap.xml"))
    .then(() => true)
    .catch(() => false);
  return structuralSeo(html, hasSitemap);
}

function structuralSeo(html: string, hasSitemap: boolean): LighthouseResult {
  // Weighted to roughly mirror Lighthouse's SEO audits.
  const checks: [boolean, number, string][] = [
    [/<title>[^<]{5,}<\/title>/i.test(html), 18, "title"],
    [/<meta\s+name=["']description["'][^>]*content=("|').{20,}?\1/i.test(html), 18, "meta description"],
    [/<html[^>]*\blang=/i.test(html), 12, "html lang"],
    [/<meta\s+name=["']viewport["']/i.test(html), 12, "viewport"],
    [/<h1[\s>]/i.test(html), 12, "h1"],
    [/<meta\s+name=["']robots["'][^>]*content=["'][^"']*index/i.test(html), 8, "robots index"],
    [/rel=["']canonical["']/i.test(html), 8, "canonical"],
    [/application\/ld\+json/i.test(html), 6, "structured data"],
    [hasSitemap, 6, "sitemap.xml"],
  ];
  let score = 0;
  const passed: string[] = [];
  const failed: string[] = [];
  for (const [ok, w, label] of checks) {
    if (ok) {
      score += w;
      passed.push(label);
    } else failed.push(label);
  }
  return {
    score: Math.min(100, score),
    real: false,
    detail: failed.length ? `missing: ${failed.join(", ")}` : `all SEO checks passed`,
  };
}
