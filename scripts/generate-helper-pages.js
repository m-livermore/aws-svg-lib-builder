#!/usr/bin/env node
"use strict";

/**
 * generate-helper-pages.js
 *
 * Builds a small static site under ./aws-svg-helper:
 *   • one HTML page per top-level category found in ./aws-icons (default)
 *   • an index.html with tile links to every category
 *
 * Options:
 *   -s | --source <dir>   icon root   (default: ./aws-icons)
 *   -d | --dest   <dir>   output dir  (default: ./aws-svg-helper)
 *        --dry-run        preview only, no writes
 */

import fs   from "node:fs/promises";
import fsc  from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";

/* ── CLI ── */
function cliCfg() {
  const cfg = { source: "aws-icons", dest: "aws-svg-helper", dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    switch (argv[i]) {
      case "-s":
      case "--source": cfg.source = argv[++i]; break;
      case "-d":
      case "--dest":   cfg.dest   = argv[++i]; break;
      case "--dry-run": cfg.dryRun = true;      break;
      default: console.error(`Unknown argument: ${argv[i]}`); exit(1);
    }
  }
  cfg.source = path.resolve(cfg.source);
  cfg.dest   = path.resolve(cfg.dest);
  return cfg;
}
const cfg = cliCfg();

/* ── helpers ── */
const colour = (c, t) =>
  `\u001b[${{ red:31, green:32, yellow:33, cyan:36 }[c]}m${t}\u001b[0m`;

const isDir  = (p) => fsc.existsSync(p) && fsc.statSync(p).isDirectory();
const exists = (p) => fsc.existsSync(p);
const ensure = (d) => fs.mkdir(d, { recursive: true });

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".svg")) yield p;
  }
}

const stripXml = (s) =>
  s.replace(/<\?xml[\s\S]*?\?>/i, "").replace(/<!DOCTYPE[\s\S]*?>/i, "").trim();

const esc = (s) =>
  s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

/* token helpers */
const tokens = (str) =>
  str.toLowerCase().replace(/\.[^.]+$/, "").split(/[-_\s/]+/).filter(Boolean);

const tokenMatch = (cat, icon) =>
  tokens(cat).every((ct) => tokens(icon).some((it) => it.startsWith(ct)));

/* dark-variant test */
const isDarkName = (name) => /dark/i.test(name);

/* fallback cloud-logo.svg */
async function loadFallback() {
  const p = path.join(cfg.source, "Architecture-Group", "Cloud-logo.svg");
  return exists(p) ? stripXml(await fs.readFile(p, "utf8")) : null;
}

/* ── main build ── */
(async () => {
  try {
    if (!isDir(cfg.source)) { console.error(colour("red", `No source: ${cfg.source}`)); exit(1); }

    if (!cfg.dryRun) { await fs.rm(cfg.dest, { recursive: true, force: true }); await ensure(cfg.dest); }

    /* discover categories (top-level dirs) */
    const categories = (await fs.readdir(cfg.source, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    console.log(colour("cyan", `Categories found: ${categories.length}`));

    /* representative icons */
    const catIcons = {};
    const catRoot  = path.join(cfg.source, "Categories");
    if (isDir(catRoot)) {
      const icons = (await fs.readdir(catRoot)).filter((f) => f.toLowerCase().endsWith(".svg"));
      for (const cat of categories) {
        const hit =
          icons.find((f) => path.basename(f, ".svg") === cat) ||
          icons.find((f) => tokenMatch(cat, path.basename(f, ".svg")));
        if (hit) catIcons[cat] = stripXml(await fs.readFile(path.join(catRoot, hit), "utf8"));
      }
    }
    const fallbackSvg = await loadFallback();

    /* build category pages */
    const built = [];
    for (const cat of categories) {
      const srcDir = path.join(cfg.source, cat);
      if (!isDir(srcDir)) continue;

      let iconsHTML = "";
      for await (const svgPath of walk(srcDir)) {
        const fname    = path.basename(svgPath);
        const dark     = isDarkName(fname) || isDarkName(cat);
        const divClass = `icon${dark ? " dark" : ""}`;
        const svg      = stripXml(await fs.readFile(svgPath, "utf8"));
        iconsHTML += `<div class="${divClass}" title="${esc(path.basename(svgPath, ".svg"))}">${svg}</div>\n`;
      }
      if (!iconsHTML) continue;

      const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${esc(cat)} – AWS Icon Helper</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0;padding:1rem;}
h1{margin-top:0;}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));}
.icon{cursor:pointer;border:1px solid #d0d0d0;border-radius:6px;padding:.5rem;text-align:center;transition:background-color .2s;}
.icon:hover{background:#f5f5f5;}
.icon svg{width:48px;height:48px;}
.icon.dark{background:#1e1e1e;border-color:#3a3a3a;}
.icon.dark:hover{background:#313131;}
a.back{display:inline-block;margin-bottom:1rem;text-decoration:none;color:#0063d1;}
</style></head><body>
<a class="back" href="index.html">← All categories</a>
<h1>${esc(cat)}</h1><p>Click an icon to copy its SVG code.</p>
<div class="grid">${iconsHTML}</div>
<script>
document.querySelectorAll('.icon').forEach(el=>{
  el.addEventListener('click',()=>{
    const svg=el.querySelector('svg').outerHTML;
    navigator.clipboard.writeText(svg).then(()=>{
      el.style.background='#c8e6c9';setTimeout(()=>el.style.background='',350);
    });
  });
});
</script></body></html>`;

      if (!cfg.dryRun) await fs.writeFile(path.join(cfg.dest, `${cat}.html`), page, "utf8");
      built.push(cat);
      console.log(colour("green", `Built ${cat}.html`));
    }

    /* build index.html */
    let tiles = "";
    for (const cat of built) {
      const thumb =
        catIcons[cat] ||
        fallbackSvg ||
        '<span style="font-size:1.6rem;">Folder</span>';
      tiles += `<a class="tile" href="${encodeURIComponent(cat)}.html" title="${esc(cat)}">
  <div class="thumb">${thumb}</div><span>${esc(cat)}</span></a>\n`;
    }

    const index = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>AWS Icon Library</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0;padding:1rem;}
h1{margin:0 0 1rem 0;}
.grid{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));}
.tile{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:#111;
      border:1px solid #d0d0d0;border-radius:8px;padding:.75rem;transition:box-shadow .2s;}
.tile:hover{box-shadow:0 0 6px rgba(0,0,0,.25);}
.thumb{margin-bottom:.5rem;}
.thumb svg{width:48px;height:48px;}
span{font-size:.85rem;text-align:center;}
</style></head><body>
<h1>AWS Icon Library</h1>
<p>Select a category to view and copy its icons.</p>
<div class="grid">${tiles}</div></body></html>`;

    if (!cfg.dryRun) await fs.writeFile(path.join(cfg.dest, "index.html"), index, "utf8");

    console.log(colour("green", "Built index.html"));
    console.log(colour("green", `SVG helper pages ready${cfg.dryRun ? " [DRY-RUN]" : ""}.`));
  } catch (err) {
    console.error(colour("red", err.stack || err.message));
    exit(2);
  }
})();
