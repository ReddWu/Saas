// Navigate from home → 关键词研究 (Keyword Research). Snapshot the page.
import { loginFresh } from "./lib.mjs";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in: ${page.url()}`);
await page.locator("text=打开").nth(1).waitFor({ state: "visible", timeout: 30000 });

const [popup] = await Promise.all([
  context.waitForEvent("page", { timeout: 20000 }),
  page.locator("text=打开").nth(1).click()
]);
const sw = popup;
await sw.waitForLoadState("domcontentloaded");
await sw.waitForLoadState("networkidle").catch(() => null);
await sw.waitForTimeout(5000);
console.log(`✓ inside similarweb at ${sw.url()}`);

// Try clicking 关键词研究 in the left nav
const navItem = sw.locator("text=关键词研究").first();
await navItem.waitFor({ state: "visible", timeout: 20000 });
console.log("→ clicking 关键词研究");
await navItem.click();
await sw.waitForTimeout(6000);
await sw.waitForLoadState("networkidle").catch(() => null);
await sw.waitForTimeout(3000);

console.log(`  URL: ${sw.url()}`);
console.log(`  title: ${await sw.title()}`);
await sw.screenshot({ path: "/tmp/sw-kwresearch.png", fullPage: true });

// Look for input field + filters
const inputs = await sw.$$eval("input, textarea", (els) =>
  els.map((el) => ({
    type: el.tagName + (el.type ? "/" + el.type : ""),
    name: el.name || "",
    id: el.id || "",
    placeholder: el.placeholder || "",
    visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
  })).filter((i) => i.visible)
);
console.log("\nVisible inputs / textareas:");
inputs.forEach((i, idx) => console.log(`  [${idx}]`, JSON.stringify(i)));

// Buttons
const buttons = await sw.$$eval("button", (els) =>
  els.map((el) => ({
    text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30),
    visible: el.getBoundingClientRect().width > 0
  })).filter((b) => b.text.length > 0 && b.text.length < 30 && b.visible)
);
console.log("\nButtons:");
buttons.slice(0, 20).forEach((b, i) => console.log(`  [${i}]`, JSON.stringify(b)));

// Body snippet
const snippet = await sw.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 600));
console.log("\nBody snippet:", snippet);

await browser.close();
