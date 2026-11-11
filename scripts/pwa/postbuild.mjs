// Runs right after "vite build" (see package.json "build"). Turns the built "dist" folder into an installable offline app:
//  - works out the list of every file the game needs (and FAILS the build if something is missing or unknown),
//  - writes dist/sw.js (the offline helper) with that list and a version,
//  - or, when pwa-mode.txt says "retire", writes the kill-switch sw.js instead.
// Plain Node, no extra libraries. Usage: node scripts/pwa/postbuild.mjs [distFolder]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OFFLINE_PAGE, SW_FILE, planPrecache, readMode, renderSw, versionOf } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const dist = resolve(process.argv[2] ?? join(root, "dist"));

function readIfExists(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

try {
  const mode = readMode(readIfExists(join(root, "pwa-mode.txt")));

  if (mode === "retire") {
    writeFileSync(join(dist, SW_FILE), readFileSync(join(here, "sw-kill.js"), "utf8"));
    console.log("[pwa] pwa-mode.txt says RETIRE: wrote the kill-switch sw.js. The offline app is switched off.");
    process.exit(0);
  }

  const plan = planPrecache(dist);
  const template = readFileSync(join(here, "sw.template.js"), "utf8");
  const version = versionOf(plan.files, template);
  const offlineHtml = readFileSync(join(dist, OFFLINE_PAGE), "utf8");
  writeFileSync(join(dist, SW_FILE), renderSw(template, { version, files: plan.files, offlineHtml }));

  console.log(`[pwa] version ${version}: ${plan.files.length} files kept for offline play`);
  for (const f of plan.files) console.log(`[pwa]   kept   ${f.path}`);
  for (const p of plan.devOnly) console.log(`[pwa]   online-only (developer pages)   ${p}`);
} catch (error) {
  console.error(`[pwa] BUILD STOPPED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
