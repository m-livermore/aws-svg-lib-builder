# AWS Architecture Icons Toolkit

*A small, dependency‑light toolchain for fetching, cleaning, and browsing the official AWS Architecture Icons.*

---

## ✨ What this project does

1. **Fetches** the latest public *Asset Package* ZIP published by AWS.
2. **Deduplicates** downloads via SHA‑256 so repeat runs are instant when nothing changed.
3. **Cleans & reorganises** every SVG – flattening the directory structure, standardizing file‑names, and removing legacy prefixes that clutter Git diffs.
4. **Normalizes** the internal `<title>` tag of each SVG **while preserving the full service name, including the required “AWS/ Amazon” prefix**.
5. **Generates** a tiny static site so you can browse, search, and copy the icons without installing drawing software.

Five single‑file Node scripts (see **/scripts**) handle the whole pipeline – no Webpack, no TypeScript, no runtime framework.

---

## Folder overview

```text
.
├── scripts/               # All automation lives here
├── demo/                  # Sample run – cleaned icons + helper pages
│   ├── aws-icons/         # ≈4 000 tidy SVGs
│   └── aws-svg-helper/    # Static browser
├── LICENSE                # MIT for *this* codebase
└── README.md              # You are here
```

> **Heads‑up:** The scripts default to the repo root.  Pass `--source`, `--dest`, or `--root` flags to point them at another folder (e.g. `out/` in CI).

---

## Getting started

### Prerequisites

* Node **18 LTS** or newer
* macOS, Linux, or WSL (PowerShell works but watch quoting)

```bash
# 1. Pull runtime deps
npm ci

# 2. Fire the full pipeline
npm run icons:update   # shorthand for the five steps below
```

> `icons:update` is defined in **package.json** – tweak it if you prefer an `out/` folder or want extra flags.

### Manual execution

```bash
node scripts/download.js                             # → raw-aws-icons/
node scripts/restructure.js  --source raw-aws-icons  # → aws-icons/
node scripts/rename.js       --source aws-icons      # filenames
node scripts/svg-title.js    --root   aws-icons      # <title> tags
node scripts/generate-helper-pages.js --dest aws-svg-helper
                                                    # static browser
```

Open **aws-svg-helper/index.html** afterwards and you’re off.

---

## CLI reference

| Script                     | Job                                                    | Popular flags                |
| -------------------------- | ------------------------------------------------------ | ---------------------------- |
| `download.js`              | Fetch ZIP, verify checksum                             | `--dry-run` *(no extract)*   |
| `restructure.js`           | Flatten + clean tree                                   | `-s, --source` · `--dry-run` |
| `rename.js`                | Kebab‑case filenames (keeps *internal* names intact)   | `--dry-run`                  |
| `svg-title.js`             | Sync `<title>` with filename (keeps AWS/Amazon prefix) | `-r, --root`                 |
| `generate-helper-pages.js` | Build static browser                                   | `-d, --dest` · `--dry-run`   |

All scripts are idempotent and colourise output with plain ANSI.

---

## Brand & naming rules

AWS ships a short *Usage Guidelines* sheet with every icon release.  The key points you need to respect – and that this toolkit automates – are:

* **Always include “AWS” or “Amazon” in the service’s first visible label.**  This applies to SVG `<title>` tags as they are exposed to screen‑readers.
* **Do not edit colours, aspect ratio, or shapes.** Resizing is fine; stretching or recolouring is not.
* **Only use the icons to depict workloads that run (or will run) on AWS.**  No product logos or swag.
* **Add the AWS attribution line somewhere in your doc or footnote.**  See below for a copy‑paste snippet.

Filenames in your repo may omit the prefix for convenience; the important part is what appears to end‑users.

---

## Updating to new AWS releases

AWS typically refreshes the library three times a year (late Jan, Apr, Jul).  When that happens simply run:

```bash
npm run icons:update
```

`download.js` spots the new checksum and cascades the other steps automatically.

---

## Contributing

Found a weird edge‑case filename or an SVG that breaks parsing?  PRs are welcome.  Please:

1. Run `npm run lint` (ESLint flat‑config).
2. Keep console output legible on dark & light terminals.
3. Add a unit test if you fix a parsing bug.

---

## License & attribution

The code in this repository is released under the **MIT License**.

The AWS architecture icons are property of Amazon Web Services, Inc. (AWS), sourced from the official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) page and used under the [AWS Trademark Guidelines](https://aws.amazon.com/trademark-guidelines/).

In compliance with these guidelines, the following notices are provided:

> © 2025, Amazon Web Services, Inc. or its affiliates.
>
> AWS is a trademark of Amazon.com, Inc. or its affiliates.

---


### Maintainer

|             |                                       |
| ----------- | ------------------------------------- |
| **Author**  | Mason Livermore – [@m-livermore](https://github.com/m-livermore)                   |
| **Website** | masonlivermore.com |


> *Happy diagramming!*
