// Wait for Angular hydration + dump activate-buttons.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: "./.auth.json" });
const page = await context.newPage();
await page.goto("https://dash.3ue.co/zh-Hans/#/page/m/home", { waitUntil: "domcontentloaded" });

// Wait until the SEO Tools cards section renders. Polling.
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const hasSw = await page.evaluate(() => document.body.innerText.toLowerCase().includes("similarweb"));
  console.log(`  t=${i + 1}s body has 'similarweb': ${hasSw}`);
  if (hasSw) break;
}

await page.screenshot({ path: "/tmp/dash-home-loaded.png", fullPage: true });

// Now scan for 启用
const buttons = await page.$$eval("button, a, [role='button']", (els) =>
  els.map((el) => ({
    tag: el.tagName,
    text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30),
    class: (el.className || "").toString().slice(0, 60)
  })).filter((b) => b.text.length > 0 && b.text.length < 30)
);
console.log("\nAll buttons / button-like:");
buttons.slice(0, 30).forEach((b, i) => console.log(`  [${i}]`, JSON.stringify(b)));

const sw = await page.$$eval("*", (els) =>
  els.filter((el) => {
    const t = (el.textContent || "").trim().toLowerCase();
    return t.length < 600 && t.includes("similarweb") && t.includes("启用");
  }).map((el) => ({
    tag: el.tagName,
    class: (el.className || "").toString().slice(0, 60),
    text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200)
  })).slice(0, 5)
);
console.log("\nContainers with both 'similarweb' and '启用':");
sw.forEach((s, i) => console.log(`  [${i}]`, JSON.stringify(s)));

await browser.close();
