#!/usr/bin/env node
"use strict";

/**
 * Normalises <title> tags inside every SVG below a root directory.
 * Mirrors rename.js token rules so titles and filenames stay aligned.
 *
 * Options:
 *   -r | --root <dir>   Path to the icon set   (default: ./aws-icons)
 *        --dry-run      Preview changes only   (no writes)
 */

import fs   from "node:fs/promises";
import fsc  from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";

/* ── CLI ── */
function parseArgs() {
  const opts = { root: "aws-icons", dryRun: false };

  for (let i = 2; i < argv.length; i += 1) {
    switch (argv[i]) {
      case "-r":
      case "--root":
        opts.root = argv[++i];
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        exit(1);
    }
  }

  opts.root = path.resolve(opts.root);

  try {
    const st = fsc.statSync(opts.root);
    if (!st.isDirectory()) throw new Error("not a directory");
  } catch {
    console.error(`Root directory not found: ${opts.root}`);
    exit(1);
  }
  return opts;
}

const cfg = parseArgs();

/* ── helpers ── */
const colour = (c, t) =>
  `\u001b[${{ red:31, green:32, yellow:33, cyan:36 }[c]}m${t}\u001b[0m`;

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes:true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.toLowerCase().endsWith(".svg")) yield p;
  }
}

/* remove prefixes, brands, size suffixes, stray separators */
function cleanTitle(raw) {
  let s = raw;
  if (s.includes("/")) s = s.split("/").pop();      // last path segment
  s = s.replace(/^(?:Arch_|Res_)/i, "");            // prefixes
  s = s.replace(/_\d+$/i, "");                      // size suffixes
  s = s.replace(/__+/g, "_");                       // doubles
  s = s.replace(/^[-_]+|[-_]+$/g, "");              // trim
  return s || raw;
}

/* ── core ── */
async function processSvg(fp) {
  const data = await fs.readFile(fp, "utf8");
  const rx   = /<title>([\s\S]*?)<\/title>/i;
  const m    = data.match(rx);
  if (!m) return;                                   // no title tag

  const original = m[1].trim();
  const cleaned  = cleanTitle(original);
  if (original === cleaned) return;                 // already clean

  const updated = data.replace(rx, `<title>${cleaned}</title>`);
  const rel     = path.relative(cfg.root, fp);

  if (cfg.dryRun) {
    console.log(colour("cyan", `DRY  ${rel}: "${original}" -> "${cleaned}"`));
  } else {
    await fs.writeFile(fp, updated, "utf8");
    console.log(colour("green", `Updated ${rel}: "${original}" -> "${cleaned}"`));
  }
}

/* ── runner ── */
(async () => {
  try {
    console.log(colour("cyan", `Root : ${cfg.root}`));
    console.log(colour("cyan", `Mode : ${cfg.dryRun ? "DRY-RUN" : "LIVE"}`));
    console.log("");

    const tasks = [];
    for await (const svg of walk(cfg.root)) tasks.push(processSvg(svg));
    await Promise.all(tasks);

    console.log(colour("green", "\nTitle update pass complete."));
  } catch (err) {
    console.error(colour("red", err.stack || err.message));
    exit(2);
  }
})();
