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

// Minimal markdown -> HTML for published blogs (headings, bold, links, lists, paras).
// No dependency; good enough for LLM-authored posts.
export function mdToHtml(md: string): string {
  const esc2 = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc2(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  const blocks = md.split(/\n{2,}/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      if (/^-{3,}$/.test(t)) return "<hr>";
      if (/^###\s/.test(t)) return `<h3>${inline(t.replace(/^###\s+/, ""))}</h3>`;
      if (/^##\s/.test(t)) return `<h2>${inline(t.replace(/^##\s+/, ""))}</h2>`;
      if (/^#\s/.test(t)) return `<h1>${inline(t.replace(/^#\s+/, ""))}</h1>`;
      if (/^[-*]\s/m.test(t))
        return `<ul>${t
          .split(/\n/)
          .filter((l) => /^[-*]\s/.test(l.trim()))
          .map((l) => `<li>${inline(l.trim().replace(/^[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      return `<p>${inline(t).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

export interface BlogEntry {
  slug: string;
  title: string;
  description?: string; // per-post meta description (falls back to the site's)
  html: string; // body html (already converted from markdown)
}

// ---- Blog reading theme (light, rankai.ai-style: violet accent, TOC sidebar) ----
const blogCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#3f3f46;line-height:1.75}
.bwrap{max-width:1100px;margin:0 auto;padding:28px 24px 0}
.crumbs{font-size:13px;color:#71717a}
.crumbs a{color:#71717a;text-decoration:none}
.crumbs a:hover{color:#6d28d9}
.eyebrow{color:#6d28d9;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:12px;margin:40px 0 12px}
.btitle{font-size:clamp(30px,4.5vw,44px);line-height:1.12;letter-spacing:-.02em;color:#18181b;font-weight:800;max-width:780px}
.meta{margin-top:18px;font-size:14px;color:#71717a;display:flex;flex-wrap:wrap;gap:6px 14px}
.meta b{color:#3f3f46;font-weight:500}
.bgrid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;margin-top:40px;align-items:start}
@media(max-width:900px){.bgrid{grid-template-columns:1fr}.baside{display:none}}
article{font-size:17px}
article h2{font-size:25px;color:#18181b;font-weight:700;letter-spacing:-.01em;margin:46px 0 14px;scroll-margin-top:24px}
article h3{font-size:19px;color:#18181b;font-weight:600;margin:30px 0 8px}
article p{margin:13px 0}
article ul{margin:13px 0 13px 24px}
article li{margin:7px 0}
article a{color:#6d28d9;text-decoration:underline;text-underline-offset:2px}
article code{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:1px 6px;font-size:.88em;color:#18181b}
article strong{color:#18181b}
article hr{border:0;border-top:1px solid #e4e4e7;margin:38px 0}
.baside{position:sticky;top:24px;display:flex;flex-direction:column;gap:20px}
.toc{border:1px solid #e4e4e7;border-radius:16px;padding:20px 22px}
.toc .toct{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin-bottom:10px}
.toc a{display:block;font-size:14px;color:#52525b;text-decoration:none;padding:4px 0}
.toc a:hover{color:#6d28d9}
.ctacard{border:1px solid #ddd6fe;background:#f5f3ff;border-radius:16px;padding:22px}
.ctacard .ctt{font-size:16px;font-weight:700;color:#18181b}
.ctacard p{font-size:14px;color:#52525b;margin:8px 0 14px}
.ctabtn{display:inline-block;background:#6d28d9;color:#fff;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;text-decoration:none}
.fcta{background:#18181b;margin-top:72px;padding:56px 24px;text-align:center}
.fcta .ft{font-size:26px;font-weight:800;color:#fff;letter-spacing:-.01em}
.fcta p{color:#a1a1aa;max-width:560px;margin:10px auto 22px;font-size:15px}
.bnav{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:28px 24px 36px;background:#18181b}
.bnav a{color:#a1a1aa;font-size:13px;text-decoration:none;border:1px solid #3f3f46;padding:6px 12px;border-radius:8px}
.bnav a:hover{color:#fff}
.postlist{margin-top:40px;display:flex;flex-direction:column;gap:16px;max-width:780px}
.postcard{display:block;border:1px solid #e4e4e7;border-radius:16px;padding:22px 24px;text-decoration:none}
.postcard:hover{border-color:#ddd6fe;background:#f5f3ff}
.postcard .pt{font-size:19px;font-weight:700;color:#18181b;letter-spacing:-.01em}
.postcard p{font-size:14.5px;color:#52525b;margin-top:6px;line-height:1.6}
.postcard .pm{font-size:13px;color:#8b5cf6;margin-top:10px;font-weight:500}
`;

// Strip the duplicate leading <h1> (the header renders the title), give every <h2>
// an anchor id, and derive the table of contents + reading time.
function prepArticle(html: string) {
  const body0 = html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "")
    // legacy posts stored before mdToHtml understood "---" separators
    .replace(/<p>-{3,}<\/p>/g, "<hr>");
  const toc: { id: string; label: string }[] = [];
  // [^>]* tolerates h2s that already carry an id (re-rendering stays idempotent).
  const body = body0.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_m, t: string) => {
    const plain = t.replace(/<[^>]+>/g, "").trim();
    const id =
      "s-" + (plain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || String(toc.length));
    toc.push({ id, label: plain });
    return `<h2 id="${id}">${t}</h2>`;
  });
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return { body, toc, minutes: Math.max(2, Math.round(words / 200)), words };
}

// ---- v2: SEO-strong (title, meta, lang, semantic h1/h2, structured data, sitemap, landing pages) ----
export function renderStrong(
  idea: Idea,
  copy: SiteCopy,
  bet: PredictionMatrix,
  blogs: BlogEntry[] = []
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

  const page = (title: string, bodyHtml: string, extraHead = "", pageDesc = desc) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${pageDesc}">
<link rel="canonical" href="/">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${pageDesc}">
<meta name="robots" content="index,follow">
${extraHead}
<style>${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  const nav = `<nav class="links">
    ${copy.seoPages.map((p) => `<a href="/${esc(p.slug)}.html">${esc(p.h1)}</a>`).join("\n    ")}${
      blogs.length ? `\n    <a href="/blog.html">Blog</a>` : ""
    }
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
    ${
      blogs.length
        ? `<section class="card" style="margin-top:48px"><h3>From the blog</h3>
      <ul style="margin:8px 0 0 20px">${blogs
        .map((b) => `<li><a style="color:#9fb0c8" href="/blog-${esc(b.slug)}.html">${esc(b.title)}</a></li>`)
        .join("\n      ")}</ul></section>`
        : ""
    }
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

  // Published Keyword-Lab blogs: /blog-<slug>.html + a blog index when any exist.
  // These use the light reading theme (rankai.ai-style) rather than the dark landing chrome.
  const today = new Date().toISOString().slice(0, 10);
  const bnav = `<nav class="bnav">
    <a href="/">${esc(idea.title)} home</a>
    <a href="/blog.html">Blog</a>
    ${copy.seoPages.map((p) => `<a href="/${esc(p.slug)}.html">${esc(p.h1)}</a>`).join("\n    ")}
  </nav>`;
  const fcta = `<div class="fcta">
    <div class="ft">Try ${esc(idea.title)}</div>
    <p>${esc(idea.pitch)}</p>
    <a class="ctabtn" href="/">Get started</a>
  </div>${bnav}`;

  const blogShell = (title: string, bodyHtml: string, pageDesc: string, extraHead = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${pageDesc}">
<link rel="canonical" href="/">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${pageDesc}">
<meta name="robots" content="index,follow">
${extraHead}
<style>${blogCss}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  for (const b of blogs) {
    const art = prepArticle(b.html);
    const pageDesc = b.description ? esc(b.description) : desc;
    const jsonldPost = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: b.title,
      description: b.description || undefined,
      wordCount: art.words,
      dateModified: today,
      author: { "@type": "Organization", name: idea.title },
    }).replace(/</g, "\\u003c");
    files[`blog-${b.slug}.html`] = blogShell(
      `${b.title} | ${idea.title}`,
      `<div class="bwrap">
  <p class="crumbs"><a href="/">Home</a> / <a href="/blog.html">Blog</a></p>
  <header>
    <p class="eyebrow">${esc(idea.title)} blog</p>
    <h1 class="btitle">${esc(b.title)}</h1>
    <div class="meta"><span>By <b>the ${esc(idea.title)} team</b></span><span>·</span><time datetime="${today}">Updated ${today}</time><span>·</span><span>${art.minutes} min read</span></div>
  </header>
  <div class="bgrid">
    <article>${art.body}</article>
    <aside class="baside">
      <div class="toc"><p class="toct">On this page</p>
        ${art.toc.map((t) => `<a href="#${t.id}">${esc(t.label)}</a>`).join("\n        ")}
      </div>
      <div class="ctacard"><p class="ctt">${esc(idea.title)}</p><p>${esc(idea.pitch.slice(0, 140))}</p><a class="ctabtn" href="/">Get started</a></div>
    </aside>
  </div>
</div>
${fcta}`,
      pageDesc,
      `<script type="application/ld+json">${jsonldPost}</script>`
    );
  }
  if (blogs.length) {
    files["blog.html"] = blogShell(
      `Blog | ${idea.title}`,
      `<div class="bwrap">
  <p class="crumbs"><a href="/">Home</a> / Blog</p>
  <header>
    <p class="eyebrow">${esc(idea.title)}</p>
    <h1 class="btitle">Blog</h1>
    <div class="meta"><span>Practical guides on the problems ${esc(idea.title)} solves.</span></div>
  </header>
  <div class="postlist">
    ${blogs
      .map((b) => {
        const m = prepArticle(b.html);
        return `<a class="postcard" href="/blog-${esc(b.slug)}.html"><span class="pt">${esc(b.title)}</span>${
          b.description ? `<p>${esc(b.description)}</p>` : ""
        }<span class="pm">${m.minutes} min read →</span></a>`;
      })
      .join("\n    ")}
  </div>
</div>
${fcta}`,
      desc
    );
  }

  // sitemap + robots help SEO score
  const urls = [
    "/",
    ...copy.seoPages.map((p) => `/${p.slug}.html`),
    ...(blogs.length ? ["/blog.html", ...blogs.map((b) => `/blog-${b.slug}.html`)] : []),
  ];
  files["sitemap.xml"] =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>`;
  files["robots.txt"] = "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n";

  return files;
}
