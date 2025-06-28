#!/usr/bin/env node

/**
 * Restructure AWS official AWS icon ZIP into a tidy ./aws-icons directory.
 * Mirrors optional flags: --source, --dest, --size, --formats, etc.
 */

import fs   from 'node:fs/promises';
import fsc  from 'node:fs';
import path from 'node:path';
import os   from 'node:os';
import { argv, exit } from 'node:process';

/* CLI parsing ─────────────────────────────────────────────────────────── */

function parseCli() {
  const cfg = {
    dryRun:         false,
    size:           '48',
    formats:        ['svg'],
    concurrency:    os.cpus().length,
    allowUnmatched: false,
    source:         null,
    dest:           null,
    defaultSource:  null,
  };

  let userSetSource = false;

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '-s':
      case '--source': cfg.source = argv[++i]; userSetSource = true; break;
      case '-d':
      case '--dest':   cfg.dest   = argv[++i]; break;
      case '--dry-run': cfg.dryRun = true; break;
      case '--size':    cfg.size  = argv[++i]; break;
      case '--formats': cfg.formats = argv[++i].split(',').map(x => x.trim().toLowerCase()); break;
      case '--concurrency': cfg.concurrency = Number(argv[++i]) || 1; break;
      case '--allow-unmatched': cfg.allowUnmatched = true; break;
      default: console.error(`Unknown arg ${a}`); exit(1);
    }
  }

  if (!cfg.source) cfg.source = 'raw-aws-icons';
  if (!cfg.dest)   cfg.dest   = 'aws-icons';

  cfg.defaultSource = path.resolve('raw-aws-icons');
  cfg.source = path.resolve(cfg.source);
  cfg.dest   = path.resolve(cfg.dest);
  cfg.userSetSource = userSetSource;

  try {
    const st = fsc.statSync(cfg.source);
    if (!st.isDirectory()) throw new Error('not a directory');
  } catch {
    console.error(`Source directory not found: ${cfg.source}`); exit(1);
  }

  return cfg;
}

const cfg = parseCli();

/* Helpers ─────────────────────────────────────────────────────────────── */

const colour = (c, t) =>
  `\u001b[${{ red:31, green:32, yellow:33, cyan:36 }[c]}m${t}\u001b[0m`;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes:true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

const ensureDir = d => fs.mkdir(d, { recursive:true });

const newest = (root, pfx) => {
  const rx = /_(\d{8}|\d{6})$/;
  const dirs = fsc.readdirSync(root, { withFileTypes:true })
                  .filter(e => e.isDirectory() && e.name.startsWith(pfx));
  if (!dirs.length) throw new Error(`Missing ${pfx}*`);
  if (dirs.length === 1) return path.join(root, dirs[0].name);
  return path.join(
    root,
    dirs.sort((a, b) =>
      (b.name.match(rx)?.[1] ?? '').localeCompare(a.name.match(rx)?.[1] ?? '')
    )[0].name
  );
};

const matchesSize = fp => {
  const ext  = path.extname(fp).slice(1).toLowerCase();
  if (!cfg.formats.includes(ext)) return false;
  const base = path.basename(fp).toLowerCase();
  if (base.endsWith(`_${cfg.size}.${ext}`)) return true;
  return fp.split(path.sep).includes(cfg.size);
};

/* Locate raw category roots ───────────────────────────────────────────── */

const archRoot = newest(cfg.source, 'Architecture-Service-Icons');
const resRoot  = newest(cfg.source, 'Resource-Icons');
const groupDir = newest(cfg.source, 'Architecture-Group-Icons');
const catDir   = newest(cfg.source, 'Category-Icons');
await ensureDir(cfg.dest);

/* Alias resolution for category merges ───────────────────────────────── */

const archCats = new Map();
const resCats  = new Map();

for (const e of fsc.readdirSync(archRoot, { withFileTypes:true }))
  if (e.isDirectory() && e.name.startsWith('Arch_'))
    archCats.set(slug(e.name.slice(5)), e.name);

for (const e of fsc.readdirSync(resRoot, { withFileTypes:true }))
  if (e.isDirectory() && e.name.startsWith('Res_'))
    resCats.set(slug(e.name.slice(4)), e.name);

const manualAlias = { appintegration:'applicationintegration', iot:'internetofthings' };

const autoAlias = {};
for (const k of archCats.keys())
  if (!resCats.has(k)) {
    const hit = [...resCats.keys()].find(x => x.includes(k) || k.includes(x));
    if (hit) autoAlias[k] = hit;
  }

const alias = { ...autoAlias, ...manualAlias };

/* Copy helpers ───────────────────────────────────────────────────────── */

async function copyAllSvgs(src, dst) {
  await ensureDir(dst);
  for await (const f of walk(src)) {
    if (path.extname(f).toLowerCase() === '.svg') {
      const out = path.join(dst, path.relative(src, f));
      if (!cfg.dryRun) {
        await ensureDir(path.dirname(out));
        await fs.copyFile(f, out);
      }
    }
  }
}

const copyGroup = () => copyAllSvgs(groupDir, path.join(cfg.dest, 'Architecture-Group'));

const copyCats = async () => {
  const dst = path.join(cfg.dest, 'Categories');
  await ensureDir(dst);
  const seen = new Set();
  for await (const f of walk(catDir)) {
    if (matchesSize(f)) {
      const out = path.join(dst, path.basename(f));
      if (seen.has(out)) continue;
      seen.add(out);
      if (!cfg.dryRun) await fs.copyFile(f, out, fsc.constants.COPYFILE_EXCL);
    }
  }
};

/* General-Icons light and dark ───────────────────────────────────────── */

async function processGeneral(archDir, resDir) {
  const dstLight = path.join(cfg.dest, 'General-Icons-Light');
  const dstDark  = path.join(cfg.dest, 'General-Icons-Dark');
  await ensureDir(dstLight); await ensureDir(dstDark);

  async function ingest(src) {
    if (!src) return;
    for await (const f of walk(src)) {
      if (path.extname(f).toLowerCase() !== '.svg') continue;
      const base = path.basename(f);
      const dark = /([_-]|^)dark([_-]|\.svg$)/i.test(base) ||
                   f.toLowerCase().includes(`${path.sep}dark${path.sep}`);
      const out  = path.join(dark ? dstDark : dstLight, base);
      if (!cfg.dryRun) await fs.copyFile(f, out, fsc.constants.COPYFILE_EXCL);
    }
  }

  await ingest(archDir);
  await ingest(resDir);
}

/* Merge loop ─────────────────────────────────────────────────────────── */

const sum = { copied:0, skipped:0, merged:0, archOnly:0, unmatched:[] };

async function mergeCat(slugCat, archDirName) {
  if (archDirName === 'Arch_General-Icons') {
    const archDir   = path.join(archRoot, archDirName);
    const resDir    = resCats.get(alias[slugCat] ?? slugCat);
    const resFull   = resDir ? path.join(resRoot, resDir) : null;
    await processGeneral(archDir, resFull);
    sum.archOnly += 1;
    return;
  }

  const resDirName = resCats.get(alias[slugCat] ?? slugCat);
  const dstDir     = path.join(cfg.dest, archDirName);
  await ensureDir(dstDir);

  const jobs = [];

  for await (const f of walk(path.join(archRoot, archDirName, cfg.size)))
    if (matchesSize(f)) jobs.push({ src:f, dst:path.join(dstDir, path.basename(f)) });

  if (resDirName)
    for await (const f of walk(path.join(resRoot, resDirName)))
      if (matchesSize(f)) jobs.push({ src:f, dst:path.join(dstDir, path.basename(f)) });
  else {
    sum.archOnly += 1; sum.unmatched.push(archDirName);
  }

  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const { src, dst } = jobs[i++];
      if (cfg.dryRun) { sum.copied += 1; continue; }
      try   { await fs.copyFile(src, dst, fsc.constants.COPYFILE_EXCL); sum.copied += 1; }
      catch { sum.skipped += 1; }
    }
  }

  await Promise.all(Array.from({ length: cfg.concurrency }, worker));
  if (resDirName) sum.merged += 1;
}

await Promise.all([...archCats].map(([s, d]) => mergeCat(s, d)));

await copyGroup();
await copyCats();

if (!cfg.dryRun) {
  try {
    await fs.copyFile(path.join(cfg.source, 'checksum.txt'),
                      path.join(cfg.dest,  'checksum.txt'));
  } catch {/* optional */}
}

/* Summary ────────────────────────────────────────────────────────────── */

console.log(`\n${colour('cyan','AWS-Icon restructure complete')}`);
console.log('Source :', cfg.source);
console.log('Dest   :', cfg.dest);
console.log('Mode   :', cfg.dryRun ? 'DRY-RUN' : 'LIVE');
console.log(`${colour('green',`${sum.copied} copied`)}, ${colour('yellow',`${sum.skipped} duplicates skipped`)}`);
console.log(`Merged categories : ${sum.merged}`);
console.log(`Arch only         : ${sum.archOnly}`);

if (sum.unmatched.length && !cfg.allowUnmatched) {
  console.log('\nArch folders with no matching Resource folder:');
  sum.unmatched.sort().forEach(c => console.log('  •', colour('yellow', c)));
}

/* Workspace tidy-up (default source only) */
if (!cfg.dryRun && !cfg.userSetSource && path.resolve(cfg.source) === cfg.defaultSource) {
  try {
    await fs.rm(cfg.source, { recursive:true, force:true });
    console.log(colour('green', `\nRemoved default raw directory: ${cfg.source}`));
  } catch (err) {
    console.error(colour('red', `\nFailed to remove raw directory: ${err.message}`));
  }
}

console.log('');
