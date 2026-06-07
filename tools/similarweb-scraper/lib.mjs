// Shared: load creds, launch browser, login, open similarweb popup, return both pages.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CRED_FILE = join(homedir(), ".claude/skills/similarweb-keyword-research/.credentials.local");

export function loadCreds() {
  const raw = readFileSync(CRED_FILE, "utf-8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="([^"]*)"$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export async function loginFresh({ headless = true } = {}) {
  const creds = loadCreds();
  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await page.goto(creds.DASH_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#input-username", { timeout: 15000 });
  await page.fill("#input-username", creds.DASH_USERNAME);
  await page.fill("#input-password", creds.DASH_PASSWORD);
  await page.click('button:has-text("登录")');
  await page.waitForURL(/\/home/, { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => null);
  return { browser, context, page };
}

// Click 打开 on similarweb card and return the popup once it lands on sim.3ue.co.
export async function openSimilarweb(context, dashPage) {
  await dashPage.locator("text=打开").nth(1).waitFor({ state: "visible", timeout: 30000 });
  await dashPage.locator("text=打开").nth(1).click();

  // Poll context.pages() for a sim.3ue.co page — more reliable than waitForEvent.
  let popup = null;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    popup = context.pages().find((p) => /sim\.3ue\.co/.test(p.url()));
    if (popup && /#\//.test(popup.url())) break;
    await dashPage.waitForTimeout(500);
  }
  if (!popup) throw new Error("similarweb popup never appeared");

  await popup.waitForLoadState("domcontentloaded");
  await popup.waitForLoadState("networkidle").catch(() => null);
  await popup.waitForTimeout(3000);
  return popup;
}

export async function waitForBodyText(page, fragment, { timeoutMs = 30000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await page.evaluate(
      (f) => document.body.innerText.toLowerCase().includes(f.toLowerCase()),
      fragment
    );
    if (ok) return true;
    await page.waitForTimeout(intervalMs);
  }
  return false;
}
