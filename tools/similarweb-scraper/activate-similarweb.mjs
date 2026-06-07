// Fresh login + click similarweb 启用 + follow.
import { loginFresh, waitForBodyText } from "./lib.mjs";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in, at ${page.url()}`);

// Wait for similarweb card to render
const ok = await waitForBodyText(page, "similarweb", { timeoutMs: 30000 });
console.log(`similarweb text visible: ${ok}`);
await page.screenshot({ path: "/tmp/dash-home-fresh.png", fullPage: true });

// Dump all 启用 buttons (with context) so we can click the right one
const buttons = await page.locator("button:has-text('启用')").all();
console.log(`found ${buttons.length} 启用 buttons`);

let swBtn = null;
for (let i = 0; i < buttons.length; i++) {
  const text = await buttons[i].evaluate((btn) => {
    let p = btn;
    for (let k = 0; k < 8 && p; k++) p = p.parentElement;
    return p ? (p.textContent || "").replace(/\s+/g, " ").slice(0, 200) : "";
  });
  console.log(`  btn[${i}]:`, text.slice(0, 120));
  if (/similarweb/i.test(text)) swBtn = buttons[i];
}

if (!swBtn) {
  console.log("✗ no similarweb activate button");
  await browser.close();
  process.exit(1);
}

console.log("→ clicking similarweb 启用");
const popupPromise = context.waitForEvent("page", { timeout: 15000 }).catch(() => null);
await swBtn.click();
await page.waitForTimeout(3000);
const popup = await popupPromise;

const target = popup ?? page;
if (popup) {
  console.log("→ similarweb opened in new tab");
} else {
  console.log("→ similarweb opened in same tab (or no nav happened)");
}
await target.waitForLoadState("domcontentloaded").catch(() => null);
await target.waitForTimeout(5000);
console.log(`  URL: ${target.url()}`);
console.log(`  title: ${await target.title()}`);
await target.screenshot({ path: "/tmp/sw-after-activate.png", fullPage: true });

// Also dump body text + visible nav so we can find Keyword Generator
const navInfo = await target.evaluate(() => {
  const all = [...document.querySelectorAll("a, button, [role='menuitem'], li")]
    .map((el) => ({
      text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      tag: el.tagName,
      href: el.getAttribute("href") || ""
    }))
    .filter((e) => e.text.length > 0 && e.text.length < 40);
  const seen = new Set();
  const out = [];
  for (const e of all) {
    const k = e.text + "|" + e.href;
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out.slice(0, 50);
});
console.log("\nNav-like items on similarweb tab:");
navInfo.forEach((n, i) => console.log(`  [${i}]`, JSON.stringify(n)));

await browser.close();
