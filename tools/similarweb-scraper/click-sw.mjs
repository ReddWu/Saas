// Simpler: log in, wait, click the second 打开 (similarweb is below SEMRUSH).
import { loginFresh } from "./lib.mjs";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in: ${page.url()}`);

// Wait for both 打开 nodes to be there
await page.locator("text=打开").nth(1).waitFor({ state: "visible", timeout: 30000 });
const total = await page.locator("text=打开").count();
console.log(`✓ found ${total} 打开 nodes`);
await page.screenshot({ path: "/tmp/before-click.png", fullPage: true });

const popupPromise = context.waitForEvent("page", { timeout: 15000 }).catch(() => null);
console.log("→ clicking 打开 nth(1) — similarweb card is the second one");
await page.locator("text=打开").nth(1).click();
await page.waitForTimeout(4000);

const popup = await popupPromise;
const target = popup ?? page;
console.log(popup ? "✓ opened in new tab" : "  same tab");
await target.waitForLoadState("domcontentloaded").catch(() => null);
await target.waitForTimeout(5000);
console.log(`  URL: ${target.url()}`);
console.log(`  title: ${await target.title()}`);
await target.screenshot({ path: "/tmp/sw-tool.png", fullPage: true });

// Dump nav links + h1 text
const info = await target.evaluate(() => {
  const links = [...document.querySelectorAll("a, [role='menuitem']")]
    .map((a) => ({ t: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30), h: a.getAttribute("href") || "" }))
    .filter((l) => l.t.length > 0 && l.t.length < 30);
  const seen = new Set();
  const dedup = [];
  for (const l of links) {
    const k = l.t + "|" + l.h;
    if (!seen.has(k)) { seen.add(k); dedup.push(l); }
  }
  return {
    bodyTextSnippet: document.body.innerText.replace(/\s+/g, " ").slice(0, 400),
    links: dedup.slice(0, 40)
  };
});
console.log("\nBody text snippet:", info.bodyTextSnippet);
console.log("\nLinks / menu items:");
info.links.forEach((l, i) => console.log(`  [${i}]`, JSON.stringify(l)));

await browser.close();
