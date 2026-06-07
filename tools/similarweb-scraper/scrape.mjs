// Production scraper: for each keyword, navigate to Similarweb overview URL with hard reload,
// wait for data to stabilize, extract 规模 / KD / CPC. Resume-safe.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loginFresh, openSimilarweb } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const QUEUE_FILE = join(PROJECT_ROOT, "rankai-keywords-to-lookup.txt");
const DATE = new Date().toISOString().slice(0, 10);
const OUT_FILE = join(PROJECT_ROOT, `similarweb-export-${DATE}.csv`);
const RESUME_FILE = join(__dirname, ".scrape-progress.json");

function overviewUrl(kw) {
  return `https://sim.3ue.co/#/digitalsuite/acquisition/keyword/organic/search/999/2026.04-2026.04/overview_2?keyword=${encodeURIComponent(kw)}&tab=0&mtd=false&webSource=Total`;
}

async function lookupKeyword(sw, kw, { maxWaitMs = 25000 } = {}) {
  // Hard navigate: about:blank → target URL forces Angular to refetch.
  await sw.goto("about:blank");
  await sw.waitForTimeout(250);
  await sw.goto(overviewUrl(kw), { waitUntil: "domcontentloaded", timeout: 30000 });

  // Poll until 规模 appears, value stabilizes for 2 consecutive reads, AND keyword text is in body.
  let stable = 0;
  let lastVol = "";
  let dashKdAge = 0; // consecutive polls where KD rendered as "-" and no vol
  const deadline = Date.now() + maxWaitMs;
  let probe = null;
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
        // SERP card present means the page successfully fetched data, even if zero
        hasSerpCard: /SERP成分/.test(txt)
      };
    }, kw);
    // Hard no-data: explicit message + nothing rendered
    if (probe.noData && !probe.vol && !probe.kd && !probe.cpcMin && !probe.clicks) {
      return { ...probe, status: "no_data" };
    }
    // Soft no-data: page rendered (SERP card visible) but KD is "-" AND no volume after 3 polls
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
  // Timed out — return whatever we have. If we have CPC or vol it's still useful.
  if (probe?.vol || probe?.cpcMin) return { ...probe, status: "ok_unstable" };
  return { ...(probe || {}), status: "timeout" };
}

async function main() {
  if (!existsSync(QUEUE_FILE)) {
    console.error(`Missing ${QUEUE_FILE}. Run scripts/build-lookup-queue.sh first.`);
    process.exit(1);
  }
  const keywords = readFileSync(QUEUE_FILE, "utf-8")
    .split("\n").map((s) => s.trim()).filter(Boolean);

  const done = existsSync(RESUME_FILE)
    ? new Set(JSON.parse(readFileSync(RESUME_FILE, "utf-8")))
    : new Set();
  let remaining = keywords.filter((k) => !done.has(k));

  const limit = parseInt(process.env.LIMIT || "0", 10);
  if (limit > 0) {
    remaining = remaining.slice(0, limit);
    console.log(`LIMIT=${limit}: will scrape ${remaining.length}`);
  }
  console.log(`Total queue: ${keywords.length} · already done: ${done.size} · to scrape: ${remaining.length}`);

  const { browser, context, page } = await loginFresh({ headless: true });
  console.log("✓ logged in");
  const sw = await openSimilarweb(context, page);
  console.log(`✓ similarweb at ${sw.url()}`);

  if (!existsSync(OUT_FILE)) {
    writeFileSync(OUT_FILE, "keyword,volume,kd,cpc_min,cpc_max,clicks,zero_click_pct,status,fetched_at\n");
  }
  const append = (row) => writeFileSync(OUT_FILE, row + "\n", { flag: "a" });

  const counts = { ok: 0, no_data: 0, ok_unstable: 0, timeout: 0, error: 0 };
  for (let i = 0; i < remaining.length; i++) {
    const kw = remaining[i];
    process.stdout.write(`[${String(i + 1).padStart(3)}/${remaining.length}] ${kw.padEnd(48)}  `);
    try {
      const r = await lookupKeyword(sw, kw);
      counts[r.status] = (counts[r.status] || 0) + 1;
      console.log(`${r.status.padEnd(12)} vol=${(r.vol || "").padEnd(6)} kd=${(r.kd || "").padEnd(4)} cpc=$${r.cpcMin || ""}-${r.cpcMax || ""}`);
      append([
        JSON.stringify(kw),
        r.vol || "",
        r.kd || "",
        r.cpcMin || "",
        r.cpcMax || "",
        r.clicks || "",
        r.zero || "",
        r.status,
        new Date().toISOString()
      ].join(","));
      done.add(kw);
      writeFileSync(RESUME_FILE, JSON.stringify([...done]));
      await sw.waitForTimeout(1200); // polite delay
    } catch (e) {
      counts.error++;
      console.log(`ERROR: ${e.message}`);
      append([JSON.stringify(kw), "", "", "", "", "", "", "error", new Date().toISOString()].join(","));
    }
  }

  console.log(`\nDone. ok=${counts.ok || 0}  no_data=${counts.no_data || 0}  ok_unstable=${counts.ok_unstable || 0}  timeout=${counts.timeout || 0}  error=${counts.error || 0}`);
  console.log(`Output: ${OUT_FILE}`);
  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
