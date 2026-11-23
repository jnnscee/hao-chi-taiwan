// Performance budget for the home page's First Load JS.
//
// Measured 2026-11-22 (the engineering-backbone slice), by this
// script's own accounting: 129.4 kB gzipped — the unique JS files
// the app-build manifest lists for the home page, gzip -9 summed.
// (`next build`'s table reports 133 kB for "/" with its own
// accounting; the two agree to within their gzip details.)
//
// BUDGET: 160 kB — the measured value plus ~25% headroom. The point
// is not the exact number; it is that a change which quietly makes
// the home page a quarter heavier fails here, in CI, instead of
// being noticed by a visitor on a slow connection.
//
// Run after `npm run build`:  node scripts/check-budget.mjs
// Exits 1 (and says by how much) when the budget is exceeded.

import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUDGET_KB = 160;
const nextDir = new URL("../.next/", import.meta.url).pathname;
const manifestPath = join(nextDir, "app-build-manifest.json");

if (!existsSync(manifestPath)) {
  console.error("check-budget: .next/app-build-manifest.json not found — run `npm run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const files = [...new Set(manifest.pages["/page"] ?? [])].filter((f) =>
  f.endsWith(".js")
);
if (files.length === 0) {
  console.error("check-budget: no JS files listed for the home page in the build manifest.");
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const path = join(nextDir, file);
  if (!existsSync(path)) {
    console.error(`check-budget: manifest file missing on disk: ${file}`);
    process.exit(1);
  }
  total += gzipSync(readFileSync(path), { level: 9 }).length;
}

const totalKB = total / 1024;
console.log(
  `check-budget: home First Load JS = ${totalKB.toFixed(1)} kB gzipped ` +
    `(${files.length} files), budget ${BUDGET_KB} kB.`
);
if (totalKB > BUDGET_KB) {
  console.error(
    `check-budget: FAIL — ${(totalKB - BUDGET_KB).toFixed(1)} kB over budget.`
  );
  process.exit(1);
}
console.log("check-budget: within budget.");
