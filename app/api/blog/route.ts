// POST /api/blog — generate an editable SEO blog draft for a chosen keyword.
// Body: { keyword: KeywordRow }. Uses the last shipped site's context.

import { NextResponse } from "next/server";
import { writeBlog } from "@/lib/blogwriter";
import { getSiteState } from "@/lib/sitestate";
import type { KeywordRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const site = getSiteState();
  if (!site) {
    return NextResponse.json({ error: "No shipped site yet — run Darwin first." }, { status: 409 });
  }
  const { keyword } = (await req.json()) as { keyword: KeywordRow };
  if (!keyword?.keyword) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }
  try {
    const draft = await writeBlog(keyword, {
      survivor: site.survivor,
      bet: site.bet,
      pages: site.copy.seoPages.map((p) => ({ slug: p.slug, title: p.title })),
      publishedBlogs: site.blogs.map((b) => ({ slug: b.slug, title: b.title })),
    });
    return NextResponse.json(draft);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
