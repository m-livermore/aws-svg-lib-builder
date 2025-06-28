#!/usr/bin/env node
"use strict";

/**
 * Recursively rename every file / directory under a root, stripping:
 *   Prefixes : Arch-Category_, Arch-Category-, Arch_, Arch-, Res_, Res-
 *   Brands   : Amazon, AWS
 *   Sizes    : _48, _32   (before the extension)
 *
 * Pass --dry-run to preview the changes without touching the file-system.
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

function cleanName(name, isFile) {
  let ext = "";
  let base = name;

  if (isFile) {
    ext  = path.extname(name);
    base = path.basename(name, ext);
  }

  base = base
    /* 1 - prefixes */           .replace(/^(?:Arch[-_]Category[-_]|Arch[-_]|Res[-_])/i, "")
    /* 2 - brands  */           .replace(/Amazon|AWS/gi, "")
    /* 3 - sizes   */           .replace(/_(?:48|32)$/i, "")
    /* 4 - dedupe  */           .replace(/[-_]{2,}/g, "_")
    /* 5 - trim    */           .replace(/^[-_]+|[-_]+$/g, "");

  if (!base) base = name;          // guard against empty
  return isFile ? `${base}${ext}` : base;
}

async function renameSafe(parent, oldName, newName) {
  const src = path.join(parent, oldName);
  const dst = path.join(parent, newName);
  if (src === dst) return;

  if (cfg.dryRun) {
    console.log(colour("cyan", `DRY  ${oldName} -> ${newName}`));
    return;
  }

  if (fsc.existsSync(dst)) {
    console.warn(colour("yellow", `Warning: destination exists, skipping ${newName}`));
    return;
  }

  await fs.rename(src, dst);
  console.log(colour("green", `Renamed ${oldName} -> ${newName}`));
}

async function processDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await processDir(full);                     // recurse first
      await renameSafe(dir, entry.name, cleanName(entry.name, false));
    } else {
      await renameSafe(dir, entry.name, cleanName(entry.name, true));
    }
  }
}

/* ── runner ── */
(async () => {
  try {
    console.log(colour("cyan", `Root   : ${cfg.root}`));
    console.log(colour("cyan", `Mode   : ${cfg.dryRun ? "DRY-RUN (no changes)" : "LIVE"}`));
    console.log("");

    await processDir(cfg.root);

    console.log(colour("green", "Rename pass complete."));
  } catch (err) {
    console.error(colour("red", err.stack || err.message));
    exit(2);
  }
})();
