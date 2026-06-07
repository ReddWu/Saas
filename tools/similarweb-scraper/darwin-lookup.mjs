// Darwin Keyword Lab → Similarweb lookup. Self-contained runner:
// reads ../../rankai-keywords-to-lookup.txt, writes ../../similarweb-export-<date>.csv.
// More patient popup-open than lib.mjs openSimilarweb (the sim.3ue.co SPA can take
// 30s+ to boot past its spinner; we also fall back to direct-navigating the popup).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loginFresh } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const QUEUE_FILE = join(PROJECT_ROOT, "rankai-keywords-to-lookup.txt");
const DATE = new Date().toISOString().slice(0, 10);
const OUT_FILE = join(PROJECT_ROOT, `similarweb-export-${DATE}.csv`);
const RESUME_FILE = join(__dirname, ".darwin-progress.json");

function overviewUrl(kw) {
  return `https://sim.3ue.co/#/digitalsuite/acquisition/keyword/organic/search/999/2026.04-2026.04/overview_2?keyword=${encodeURIComponent(kw)}&tab=0&mtd=false&webSource=Total`;
}

// Click the similarweb card's 打开 and wait for the SPA to actually boot.
async function openSimilarwebPatient(context, dashPage) {
  await dashPage.locator("text=打开").nth(1).waitFor({ state: "visible", timeout: 30000 });
  await dashPage.waitForTimeout(1500); // let Angular attach the click handler
  await dashPage.locator("text=打开").nth(1).click();

  // 1) wait for any sim.3ue.co page to exist (up to 90s)
  let popup = null;
  let deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    popup = context.pages().find((p) => /sim\.3ue\.co/.test(p.url()));
    if (popup) break;
    await dashPage.waitForTimeout(500);
  }
  if (!popup) {
    // retry the click once — first click can land before the handler binds
    await dashPage.locator("text=打开").nth(1).click();
    deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      popup = context.pages().find((p) => /sim\.3ue\.co/.test(p.url()));
      if (popup) break;
      await dashPage.waitForTimeout(500);
    }
  }
  if (!popup) throw new Error("similarweb popup never appeared");
  console.log("popup open at", popup.url());

  // 2) wait for the SPA to boot: hash route OR real body text (up to 90s)
  deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const booted = /#\//.test(popup.url()) ||
      (await popup.evaluate(() => document.body.innerText.trim().length > 50).catch(() => false));
    if (booted) return popup;
    await popup.waitForTimeout(1000);
  }
  // 3) still on the spinner — force the route
  console.log("SPA stuck on spinner; navigating directly to activation home");
  await popup.goto("https://sim.3ue.co/#/activation/home", { waitUntil: "domcontentloaded" });
  await popup.waitForTimeout(5000);
  return popup;
}

// Same probe logic as scrape.mjs lookupKeyword.
async function lookupKeyword(sw, kw, { maxWaitMs = 30000 } = {}) {
  await sw.goto("about:blank");
  await sw.waitForTimeout(250);
  await sw.goto(overviewUrl(kw), { waitUntil: "domcontentloaded", timeout: 30000 });

  let stable = 0, lastVol = "", dashKdAge = 0, probe = null;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sw.waitForTimeout(700);
    probe = await sw.evaluate((kw) => {
      const txt = document.body.innerText.replace(/\s+/g, " ");
      const vol = (txt.match(/规模\s*([0-9.]+[KM]?)/) || [])[1] || "";
      const kd  = (txt.match(/有机搜索难度\s*([0-9-]+)/) || [])[1] || "";
      const cpcM = txt.match(/点击点击费用范围\s*\$([0-9.]+)\s*-\s*\$([0-9.,K]+)/);
      const clicks = (txt.match(/点击量\s*([0-9.]+[KM]?)/) || [])[1] || "";
      const zero = (txt.match(/零点击搜索\s*([0-9.]+%)/) || [])[1] || "";
      return {
        vol, kd,
        cpcMin: cpcM ? cpcM[1] : "",
        cpcMax: cpcM ? cpcM[2] : "",
        clicks, zero,
        hasKw: txt.toLowerCase().includes(kw.toLowerCase()),
        noData: /暂无|无数据|没有.*结果/.test(txt),
        hasSerpCard: /SERP成分/.test(txt)
      };
    }, kw);
    if (probe.noData && !probe.vol && !probe.kd && !probe.cpcMin && !probe.clicks) {
      return { ...probe, status: "no_data" };
    }
    if (probe.kd === "-" && !probe.vol && probe.hasSerpCard && probe.hasKw) {
      dashKdAge++;
      if (dashKdAge >= 3) return { ...probe, status: "no_data" };
    } else {
      dashKdAge = 0;
    }
    if (probe.vol && probe.vol === lastVol && probe.hasKw) {
      stable++;
      if (stable >= 2) return { ...probe, status: "ok" };
    } else {
      stable = 0;
      lastVol = probe.vol;
    }
  }
  if (probe?.vol || probe?.cpcMin) return { ...probe, status: "ok_unstable" };
  return { ...(probe || {}), status: "timeout" };
}

async function main() {
  const keywords = readFileSync(QUEUE_FILE, "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);
  const done = existsSync(RESUME_FILE) ? new Set(JSON.parse(readFileSync(RESUME_FILE, "utf-8"))) : new Set();
  const remaining = keywords.filter((k) => !done.has(k));
  console.log(`queue: ${keywords.length} · done: ${done.size} · to scrape: ${remaining.length}`);

  const { browser, context, page } = await loginFresh({ headless: true });
  console.log("✓ logged in");
  const sw = await openSimilarwebPatient(context, page);
  console.log(`✓ similarweb at ${sw.url()}`);

  if (!existsSync(OUT_FILE)) {
    writeFileSync(OUT_FILE, "keyword,volume,kd,cpc_min,cpc_max,clicks,zero_click_pct,status,fetched_at\n");
  }
  const append = (row) => writeFileSync(OUT_FILE, row + "\n", { flag: "a" });

  for (let i = 0; i < remaining.length; i++) {
    const kw = remaining[i];
    process.stdout.write(`[${i + 1}/${remaining.length}] ${kw.padEnd(48)} `);
    try {
      const r = await lookupKeyword(sw, kw);
      console.log(`${r.status.padEnd(12)} vol=${(r.vol || "").padEnd(6)} kd=${(r.kd || "").padEnd(4)} cpc=$${r.cpcMin || ""}-${r.cpcMax || ""}`);
      append([JSON.stringify(kw), r.vol || "", r.kd || "", r.cpcMin || "", r.cpcMax || "", r.clicks || "", r.zero || "", r.status, new Date().toISOString()].join(","));
      done.add(kw);
      writeFileSync(RESUME_FILE, JSON.stringify([...done]));
      await sw.waitForTimeout(1500); // polite delay — shared account
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      append([JSON.stringify(kw), "", "", "", "", "", "", "error", new Date().toISOString()].join(","));
    }
  }
  console.log("Done →", OUT_FILE);
  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
