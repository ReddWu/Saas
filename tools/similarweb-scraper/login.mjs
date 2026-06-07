// Actually log in, then screenshot the post-login dashboard so we can map the nav.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CRED_FILE = join(homedir(), ".claude/skills/similarweb-keyword-research/.credentials.local");
const AUTH_STATE = "./.auth.json";

function loadCreds() {
  const raw = readFileSync(CRED_FILE, "utf-8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="([^"]*)"$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const creds = loadCreds();
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"]
});
const context = await browser.newContext();
const page = await context.newPage();

console.log("→ goto login");
await page.goto(creds.DASH_URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#input-username", { timeout: 15000 });

console.log("→ filling form");
await page.fill("#input-username", creds.DASH_USERNAME);
await page.fill("#input-password", creds.DASH_PASSWORD);
await page.screenshot({ path: "/tmp/dash-before-submit.png", fullPage: true });

console.log("→ submitting");
await Promise.all([
  page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => null),
  page.click('button:has-text("登录")')
]);
await page.waitForTimeout(3000);

console.log(`✓ post-login URL: ${page.url()}`);
console.log(`  title: ${await page.title()}`);
await page.screenshot({ path: "/tmp/dash-post-login.png", fullPage: true });

// Dump nav links so we can find Similarweb / Keyword Generator
const navLinks = await page.$$eval("a, [role='menuitem'], .menu-item, nb-menu-item", (els) =>
  els
    .map((el) => ({
      text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
      href: el.getAttribute("href") || "",
      class: (el.className || "").toString().slice(0, 60)
    }))
    .filter((x) => x.text.length > 0 && x.text.length < 60)
);

console.log("\nVisible navigation links / menu items (deduped):");
const seen = new Set();
const unique = [];
for (const n of navLinks) {
  const k = `${n.text}|${n.href}`;
  if (!seen.has(k)) { seen.add(k); unique.push(n); }
}
unique.slice(0, 60).forEach((n, i) => console.log(`  [${i}]`, JSON.stringify(n)));

// Save auth so we don't need to re-login next run
await context.storageState({ path: AUTH_STATE });
console.log(`\n✓ auth state saved to ${AUTH_STATE}`);

await browser.close();
