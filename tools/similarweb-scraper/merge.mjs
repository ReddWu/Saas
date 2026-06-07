// Merge similarweb-export-YYYY-MM-DD.csv → rankai-keyword-classification.csv.
// Usage:  node merge.mjs [path-to-export-csv]   (default: latest similarweb-export-*.csv)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const CLASSIFICATION = join(PROJECT_ROOT, "rankai-keyword-classification.csv");

function parseCsvLine(line) {
  // Handles simple "value","value with, comma" CSV. Returns array of strings.
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function normalizeKey(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function readExport(path) {
  const rows = readFileSync(path, "utf-8").split("\n").filter(Boolean);
  const header = parseCsvLine(rows.shift());
  const idx = (name) => header.indexOf(name);
  const map = new Map();
  for (const line of rows) {
    const cols = parseCsvLine(line);
    const kw = cols[idx("keyword")];
    if (!kw) continue;
    map.set(normalizeKey(kw), {
      keyword: kw,
      volume: cols[idx("volume")],
      kd: cols[idx("kd")],
      cpcMin: cols[idx("cpc_min")],
      cpcMax: cols[idx("cpc_max")],
      status: cols[idx("status")],
      fetchedAt: cols[idx("fetched_at")]
    });
  }
  return map;
}

function chooseExportPath() {
  const arg = process.argv[2];
  if (arg) return arg;
  const exports = readdirSync(PROJECT_ROOT)
    .filter((f) => /^similarweb-export-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
    .sort();
  if (!exports.length) {
    console.error("No similarweb-export-*.csv found in project root. Pass path as arg.");
    process.exit(1);
  }
  return join(PROJECT_ROOT, exports[exports.length - 1]);
}

const exportPath = chooseExportPath();
console.log(`Export: ${exportPath}`);
if (!existsSync(CLASSIFICATION)) {
  console.error(`Missing ${CLASSIFICATION}`);
  process.exit(1);
}

const exportMap = readExport(exportPath);
console.log(`  ${exportMap.size} keywords in export`);

// Read classification
const rawLines = readFileSync(CLASSIFICATION, "utf-8").split("\n");
const header = rawLines[0];
const headerCols = parseCsvLine(header);
const col = (n) => headerCols.indexOf(n);
const colVol = col("volume");
const colKd = col("kd");
const colStatus = col("status");
const colNotes = col("notes");
const colKw = col("keyword");

const today = new Date().toISOString().slice(0, 10);
const stats = { filled_kd: 0, filled_vol: 0, status_updated: 0, no_data_marked: 0, untouched: 0, kept_validated: 0 };

const newLines = [header];
for (let i = 1; i < rawLines.length; i++) {
  const line = rawLines[i];
  if (!line.trim()) { newLines.push(line); continue; }
  const cols = parseCsvLine(line);
  const kw = cols[colKw];
  const cur = {
    vol: cols[colVol],
    kd: cols[colKd],
    status: cols[colStatus],
    notes: cols[colNotes] || ""
  };
  const exp = exportMap.get(normalizeKey(kw));
  if (!exp) {
    // Not in export — leave row unchanged
    stats.untouched++;
    newLines.push(line);
    continue;
  }

  // Don't overwrite rows that are already "validated" (manual entry from earlier research)
  if (cur.status === "validated" && cur.kd) {
    stats.kept_validated++;
    newLines.push(line);
    continue;
  }

  let newVol = cur.vol;
  let newKd  = cur.kd;
  let newStatus = cur.status;
  let newNotes = cur.notes;

  if (exp.status === "ok" || exp.status === "ok_unstable") {
    // Fill KD if export gave us a number
    if (exp.kd && /^\d+$/.test(exp.kd) && !cur.kd) {
      newKd = exp.kd;
      stats.filled_kd++;
    }
    // Fill volume if we don't have one or if Similarweb gives a useful K-form number
    if (exp.volume && !cur.vol) {
      newVol = exp.volume;
      stats.filled_vol++;
    }
    // Mark validated (but flag unstable for manual recheck)
    newStatus = exp.status === "ok_unstable" ? "validated_unstable" : "validated";
    if (!newKd) {
      newNotes = appendNote(newNotes, `Similarweb showed no KD for this keyword (${today}); volume confirmed`);
    } else {
      newNotes = appendNote(newNotes, `Validated via Similarweb ${today}`);
    }
    stats.status_updated++;
  } else if (exp.status === "no_data") {
    newStatus = "no exact result";
    newVol = "0";
    newNotes = appendNote(newNotes, `Confirmed 0 Similarweb demand on ${today}`);
    stats.no_data_marked++;
  } else if (exp.status === "timeout" || exp.status === "error") {
    newNotes = appendNote(newNotes, `Similarweb lookup failed on ${today} (${exp.status})`);
  }

  cols[colVol] = newVol;
  cols[colKd] = newKd;
  cols[colStatus] = newStatus;
  cols[colNotes] = newNotes;

  newLines.push(cols.map(csvEscape).join(","));
}

writeFileSync(CLASSIFICATION, newLines.join("\n"));
console.log("\nMerge summary:");
console.log(`  KD newly filled:          ${stats.filled_kd}`);
console.log(`  Volume newly filled:      ${stats.filled_vol}`);
console.log(`  Status updated:           ${stats.status_updated}`);
console.log(`  Marked 'no exact result': ${stats.no_data_marked}`);
console.log(`  Untouched (not in export):${stats.untouched}`);
console.log(`  Kept pre-validated:       ${stats.kept_validated}`);
console.log(`\nWrote: ${CLASSIFICATION}`);

function appendNote(existing, addition) {
  if (!existing) return addition;
  if (existing.includes(addition)) return existing;
  return existing + " | " + addition;
}
