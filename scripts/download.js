#!/usr/bin/env node
"use strict";

const fetch   = require("node-fetch");
const cheerio = require("cheerio");
const fs      = require("fs-extra");
const path    = require("path");
const AdmZip  = require("adm-zip");
const crypto  = require("crypto");

const PAGE_URL      = "https://aws.amazon.com/architecture/icons/";
const WORK_DIR      = process.cwd();
const TARGET_DIR    = path.join(WORK_DIR, "raw-aws-icons");
const TEMP_ZIP_PATH = path.join(WORK_DIR, "__aws_icons_temp.zip");
const TEMP_UNZIP    = path.join(WORK_DIR, "__aws_icons_unzip__");

/* checksum locations to consult / update */
const CHECKSUM_FILES = [
  path.join(TARGET_DIR, "checksum.txt"),                  // primary
  path.join(WORK_DIR, "aws-icons", "checksum.txt"),       // copy placed by restructure.js
];

/* ── helpers ── */

async function getLatestZipUrl() {
  const res = await fetch(PAGE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`);

  const $           = cheerio.load(await res.text());
  const assetUrlRel = $("a[href$='.zip']")
    .map((_, el) => $(el).attr("href"))
    .get()
    .find((href) => href.includes("Asset-Package") && href.includes("architecture-icons"));

  if (!assetUrlRel) throw new Error("Full asset-package ZIP link not found");
  return assetUrlRel.startsWith("http") ? assetUrlRel : `https:${assetUrlRel}`;
}

const sha256 = (fp) => crypto.createHash("sha256").update(fs.readFileSync(fp)).digest("hex");

/* reads the first checksum*/
function readChecksum() {
  for (const file of CHECKSUM_FILES) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  }
  return null;
}

/* write / update every known location */
function writeChecksum(sum) {
  for (const file of CHECKSUM_FILES) {
    fs.ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, `${sum}\n`, "utf8");
  }
}

async function downloadFile(url, dst) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dst);
    res.body.pipe(out);
    res.body.on("error", reject);
    out.on("finish", resolve);
  });
}

async function extractZip(zipPath, checksum) {
  await fs.remove(TARGET_DIR);
  await fs.remove(TEMP_UNZIP);
  await fs.ensureDir(TEMP_UNZIP);

  new AdmZip(zipPath).extractAllTo(TEMP_UNZIP, true);

  const entries = await fs.readdir(TEMP_UNZIP);
  if (!entries.length) throw new Error("ZIP extracted but no content found");

  await fs.ensureDir(TARGET_DIR);
  for (const name of entries) {
    await fs.move(
      path.join(TEMP_UNZIP, name),
      path.join(TARGET_DIR, name),
      { overwrite: true },
    );
  }

  writeChecksum(checksum);
  await fs.remove(zipPath);
  await fs.remove(TEMP_UNZIP);
  console.log("Extraction complete");
}

/* ── main ── */
(async () => {
  try {
    const zipUrl = await getLatestZipUrl();
    console.log(`Latest package: ${zipUrl}`);

    await downloadFile(zipUrl, TEMP_ZIP_PATH);
    const latestSum = sha256(TEMP_ZIP_PATH);
    const storedSum = readChecksum();

    if (storedSum && storedSum === latestSum) {
      console.log("No changes detected; skipping extraction");
      await fs.remove(TEMP_ZIP_PATH);
      return;
    }

    console.log("New version detected; updating local copy…");
    await extractZip(TEMP_ZIP_PATH, latestSum);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
})();
