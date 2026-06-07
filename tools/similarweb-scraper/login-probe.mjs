// Login probe — open dash.3ue.co, take screenshots, identify selectors.
// Reads credentials from ~/.claude/skills/similarweb-keyword-research/.credentials.local
// Saves storage state to .auth.json for reuse.

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CRED_FILE = join(homedir(), ".claude/skills/similarweb-keyword-research/.credentials.local");
const AUTH_STATE = "./.auth.json";
const SCREENSHOT_DIR = "/tmp";

function loadCreds() {
  const raw = readFileSync(CRED_FILE, "utf-8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="([^"]*)"$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const creds = loadCreds();
  const url = creds.DASH_URL || "https://dash.3ue.co/";
  const user = creds.DASH_USERNAME;
  const pass = creds.DASH_PASSWORD;
  console.log(`Probing ${url} with user=${user}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"]
  });
  const context = existsSync(AUTH_STATE)
    ? await browser.newContext({ storageState: AUTH_STATE })
    : await browser.newContext();
  const page = await context.newPage();

  console.log("→ navigating to landing page");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/dash-landing.png`, fullPage: true });
  console.log(`✓ landing screenshot → ${SCREENSHOT_DIR}/dash-landing.png`);
  console.log(`  current URL: ${page.url()}`);
  console.log(`  title: ${await page.title()}`);

  // Print all visible input fields so we can identify login form
  const inputs = await page.$$eval("input", (els) =>
    els.map((el) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      class: el.className?.slice(0, 80) ?? ""
    }))
  );
  console.log("\nVisible inputs on landing page:");
  inputs.forEach((i, idx) => console.log(`  [${idx}]`, JSON.stringify(i)));

  // Print all buttons too
  const buttons = await page.$$eval("button", (els) =>
    els.map((el) => ({
      text: el.innerText?.slice(0, 40),
      class: el.className?.slice(0, 60)
    })).filter(b => b.text && b.text.trim())
  );
  console.log("\nVisible buttons on landing page:");
  buttons.forEach((b, idx) => console.log(`  [${idx}]`, JSON.stringify(b)));

  await context.storageState({ path: AUTH_STATE });
  await browser.close();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
