// Screenshot all /best/* pages with JS disabled (clean SSR render, no React 19 dev overlay).
import { chromium } from 'playwright';

const PAGES = [
  { slug: 'best', file: '/tmp/pr-1-best-index.png', h: 1500 },
  { slug: 'best/ai-visibility-tools', file: '/tmp/pr-2-ai-visibility-tools.png', h: 7500 },
  { slug: 'best/geo-agencies', file: '/tmp/pr-3-geo-agencies.png', h: 6500 },
  { slug: 'best/ai-seo-tools', file: '/tmp/pr-4-ai-seo-tools.png', h: 7500 },
  { slug: 'best/llm-seo-agencies', file: '/tmp/pr-5-llm-seo-agencies.png', h: 6000 },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  javaScriptEnabled: false, // <- the part that --disable-javascript wasn't doing
  viewport: { width: 1440, height: 1000 },
});

for (const p of PAGES) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: p.h });
  console.log(`→ ${p.slug}`);
  await page.goto(`http://localhost:3000/${p.slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000); // give CSS time to apply
  await page.screenshot({ path: p.file, fullPage: true });
  await page.close();
  console.log(`  ✓ ${p.file}`);
}

await browser.close();
