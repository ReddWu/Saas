// Generates the static landing site for the surviving idea.
// v1 (weak) deliberately omits <title>, meta description, semantic headings, lang,
// and a sitemap -> low Lighthouse SEO. The mutation pass produces v2 (strong) which
// adds all of those + N SEO landing pages -> high Lighthouse SEO. The delta is real.

import type { Idea, PredictionMatrix } from "./types";

const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0f17;color:#e8edf6;line-height:1.6}
.wrap{max-width:880px;margin:0 auto;padding:64px 24px}
.hero{padding:80px 0 48px}
.eyebrow{color:#6ee7ff;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:13px}
h1,.h1{font-size:48px;line-height:1.1;margin:16px 0;font-weight:800;background:linear-gradient(90deg,#6ee7ff,#c792ea);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.sub{font-size:20px;color:#9fb0c8;max-width:620px}
.cta{display:inline-block;margin-top:32px;background:#6ee7ff;color:#0b0f17;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:64px}
.card{background:#121826;border:1px solid #1e2940;border-radius:14px;padding:24px}
.card h3,.card .h3{color:#6ee7ff;margin-bottom:8px;font-size:18px}
.links{margin-top:48px;display:flex;flex-wrap:wrap;gap:12px}
.links a{color:#9fb0c8;font-size:14px;text-decoration:none;border:1px solid #1e2940;padding:6px 12px;border-radius:8px}
footer{color:#5a6b86;font-size:13px;padding:48px 0 24px}
`;

interface SiteCopy {
  features: { title: string; body: string }[];
  seoPages: { slug: string; title: string; h1: string; body: string }[];
}

// LLM copy is untrusted text: escape it so a stray <, > or " can never break the
// rendered page (or the SEO scorer's title/meta checks) on the deployed site.
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The builder agent fills this; we provide a deterministic fallback so the pipeline
// never blocks on the model.
export function fallbackCopy(idea: Idea): SiteCopy {
  return {
    features: [
      { title: "Built for the pain", body: idea.painPoint },
      { title: "One job, done well", body: idea.pitch },
      { title: "Ship in minutes", body: "No setup. Connect once and go." },
      { title: "Made for solo founders", body: "Priced and scoped for one person." },
    ],
    seoPages: [
      { slug: "use-cases", title: `${idea.title} use cases`, h1: `${idea.title} use cases`, body: idea.pitch },
      { slug: "pricing", title: `${idea.title} pricing`, h1: `Simple pricing`, body: "One flat plan." },
      { slug: "alternatives", title: `${idea.title} alternatives`, h1: `Why ${idea.title}`, body: idea.painPoint },
      { slug: "faq", title: `${idea.title} FAQ`, h1: `Frequently asked questions`, body: idea.pitch },
      { slug: "about", title: `About ${idea.title}`, h1: `About ${idea.title}`, body: "Born in a boardroom death-match." },
    ],
  };
}

// ---- v1: a bare MVP. It has the basics a naive dev ships (title, lang, viewport,
// a real h1, canonical, robots) but is MISSING the SEO-specific work the bet calls for:
// meta description, JSON-LD structured data, a sitemap, and dedicated SEO landing pages.
// Scores ~70 on the SEO audit — enough to fail a 90+ bet. ----
export function renderWeak(idea: Idea, copy: SiteCopy): Record<string, string> {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(idea.title)}</title>
<link rel="canonical" href="/">
<meta name="robots" content="index,follow">
<style>${css}</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <p class="eyebrow">DarwinSaaS · v1 · bare MVP</p>
    <h1>${esc(idea.title)}</h1>
    <p class="sub">${esc(idea.pitch)}</p>
    <a class="cta" href="#">Get started</a>
  </header>
  <div class="feat">
    ${copy.features
      .map((f) => `<div class="card"><h3>${esc(f.title)}</h3><div>${esc(f.body)}</div></div>`)
      .join("\n    ")}
  </div>
  <footer>${esc(idea.title)} — shipped autonomously.</footer>
</div>
</body>
</html>`;
  // Note: no meta description, no JSON-LD, no sitemap.xml -> SEO audit ~70.
  return { "index.html": html };
}

// ---- v2: SEO-strong (title, meta, lang, semantic h1/h2, structured data, sitemap, landing pages) ----
export function renderStrong(
  idea: Idea,
  copy: SiteCopy,
  bet: PredictionMatrix
): Record<string, string> {
  const desc = esc(`${idea.pitch} ${idea.painPoint}`.slice(0, 155));
  // <-escape so model copy containing "</script>" can't break out of the JSON-LD tag.
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: idea.title,
    description: `${idea.pitch} ${idea.painPoint}`.slice(0, 155),
    applicationCategory: "BusinessApplication",
    offers: { "@type": "Offer", price: "19", priceCurrency: "USD" },
  }).replace(/</g, "\\u003c");

  const page = (title: string, bodyHtml: string, extraHead = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="/">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${desc}">
<meta name="robots" content="index,follow">
${extraHead}
<style>${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  const nav = `<nav class="links">
    ${copy.seoPages.map((p) => `<a href="/${esc(p.slug)}.html">${esc(p.h1)}</a>`).join("\n    ")}
  </nav>`;

  const home = page(
    `${idea.title} — ${idea.pitch}`,
    `<div class="wrap">
  <header class="hero">
    <p class="eyebrow">DarwinSaaS · v2 · evolved</p>
    <h1>${esc(idea.title)}</h1>
    <p class="sub">${esc(idea.pitch)}</p>
    <a class="cta" href="/pricing.html">Get started</a>
  </header>
  <main>
    <section class="feat">
      ${copy.features
        .map((f) => `<article class="card"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></article>`)
        .join("\n      ")}
    </section>
    ${nav}
  </main>
  <footer>${esc(idea.title)} — evolved to win its bet (${esc(bet.hypothesis)}).</footer>
</div>`,
    `<script type="application/ld+json">${jsonld}</script>`
  );

  const files: Record<string, string> = { "index.html": home };

  for (const p of copy.seoPages) {
    files[`${p.slug}.html`] = page(
      `${p.title} | ${idea.title}`,
      `<div class="wrap">
  <header class="hero"><h1>${esc(p.h1)}</h1><p class="sub">${esc(p.body)}</p>
  <a class="cta" href="/">← ${esc(idea.title)} home</a></header>
  ${nav}
</div>`
    );
  }

  // sitemap + robots help SEO score
  const urls = ["/", ...copy.seoPages.map((p) => `/${p.slug}.html`)];
  files["sitemap.xml"] =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>`;
  files["robots.txt"] = "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n";

  return files;
}
