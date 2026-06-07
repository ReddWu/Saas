// Test: reload between navigations to force fresh data fetch.
import { loginFresh, openSimilarweb } from "./lib.mjs";

const TESTS = ["ai visibility tools", "best seo ai tools", "ai seo tools comparison"];

function buildUrl(kw) {
  return `https://sim.3ue.co/#/digitalsuite/acquisition/keyword/organic/search/999/2026.04-2026.04/overview_2?keyword=${encodeURIComponent(kw)}&tab=0&mtd=false&webSource=Total`;
}

const { browser, context, page } = await loginFresh({ headless: true });
const sw = await openSimilarweb(context, page);
console.log(`✓ similarweb at ${sw.url()}`);

for (const kw of TESTS) {
  console.log(`\n--- ${kw} ---`);
  // Navigate with hard reload by going to about:blank first
  await sw.goto("about:blank");
  await sw.waitForTimeout(300);
  await sw.goto(buildUrl(kw), { waitUntil: "domcontentloaded" });

  // Poll until 规模 appears AND the keyword name appears in the body (so data is keyed correctly)
  let stableCount = 0;
  let lastVol = "";
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await sw.waitForTimeout(800);
    const probe = await sw.evaluate((kw) => {
      const txt = document.body.innerText.replace(/\s+/g, " ");
      const vol = (txt.match(/规模\s*([0-9.]+[KM]?)/) || [])[1] || "";
      const kd = (txt.match(/有机搜索难度\s*([0-9-]+)/) || [])[1] || "";
      const cpc = (txt.match(/点击点击费用范围\s*\$([0-9.]+)\s*-\s*\$([0-9.,K]+)/) || []).slice(1).join(",");
      const hasKw = txt.toLowerCase().includes(kw.toLowerCase());
      return { vol, kd, cpc, hasKw };
    }, kw);
    process.stdout.write(`  vol=${probe.vol} kd=${probe.kd} cpc=${probe.cpc} kwInBody=${probe.hasKw}  `);
    if (probe.vol === lastVol && probe.vol) {
      stableCount++;
      if (stableCount >= 2 && probe.hasKw) { console.log("[stable+kw]"); break; }
    } else {
      stableCount = 0;
      lastVol = probe.vol;
    }
    console.log("");
  }
  await sw.screenshot({ path: `/tmp/sw-${kw.replace(/\s+/g, "_")}.png`, fullPage: false });
}

await browser.close();
