// POST /api/publish — publish an (edited) blog draft onto the live site:
// markdown -> html, rebuild the v2 site with all published posts + updated sitemap,
// redeploy, and report the live URL. Body: { title, slug, markdown }.

import { NextResponse } from "next/server";
import { renderStrong, mdToHtml } from "@/lib/sitegen";
import { deploySite } from "@/lib/deploy";
import { getSiteState } from "@/lib/sitestate";
import { ev } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const site = getSiteState();
  if (!site) {
    return NextResponse.json({ error: "No shipped site yet — run Darwin first." }, { status: 409 });
  }
  const { title, slug, markdown } = (await req.json()) as {
    title: string;
    slug: string;
    markdown: string;
  };
  if (!title || !slug || !markdown) {
    return NextResponse.json({ error: "title, slug, markdown required" }, { status: 400 });
  }

  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  const html = mdToHtml(markdown);

  // Upsert into the published set, rebuild, redeploy (same -v2 project => same URL).
  const existing = site.blogs.findIndex((b) => b.slug === safeSlug);
  const entry = { slug: safeSlug, title, html };
  if (existing >= 0) site.blogs[existing] = entry;
  else site.blogs.push(entry);

  try {
    const files = renderStrong(site.survivor, site.copy, site.bet, site.blogs);
    const deploy = await deploySite(`${site.slug}-v2`, files);
    const blogUrl = deploy.url.startsWith("http")
      ? `${deploy.url.replace(/\/$/, "")}/blog-${safeSlug}.html`
      : deploy.url;
    ev.log("founder", `✍️ Published "${title}" → ${blogUrl}`);
    return NextResponse.json({ url: blogUrl, deployUrl: deploy.url, real: deploy.real });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
