# AWS SVG Lib Builder

A small collection of scripts that automates downloading and cleaning the official AWS Architecture Icons to make them easier to use in web development and diagramming projects.


## What it does

The official AWS icon set is a great resource, but using it directly can be a hassle. The directory structure is deeply nested, filenames aren't always consistent, and the SVGs themselves can be a bit messy for version control.

This project is a simple toolchain that smooths out those rough edges. It's just a handful of Node.js scripts that:

1.  **Fetches** the latest official icon package from AWS.
2.  **Deduplicates** downloads so you don't re-download unchanged files.
3.  **Flattens** the complex directory structure into a single `aws-icons/` folder.
4.  **Renames** every icon to a consistent `kebab-case` format.
5.  **Cleans** the internal `<title>` tag of each SVG for cleaner Git diffs.
6.  **Generates** a simple, static HTML page so you can easily browse, search, and copy icons.

The whole pipeline is handled by five single-file scripts with no runtime frameworks, TypeScript, or complex build tools.

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 LTS or newer)
* macOS, Linux, or WSL

### Setup

1.  Clone the repo:
    ```bash
    git clone https://github.com/m-livermore/aws-svg-lib-builder.git
    ```
2.  Go into the directory:
    ```bash
    cd aws-svg-lib-builder
    ```
3.  Install the single dependency (ESLint for development):
    ```bash
    npm install
    ```

### Running the Scripts

To update your icon library, run the main command:

```bash
npm run icons:update
````

This will run all the scripts in order, giving you a fresh `aws-icons/` directory and an updated `aws-svg-helper/` browser.

## Script Reference

You can also run the scripts individually if you only need to perform a specific task.

| Script | Command | Description |
|---|---|---|
| **Download** | `node scripts/download.js` | Fetches the ZIP from AWS and verifies its checksum. |
| **Restructure** | `node scripts/restructure.js` | Flattens the directory tree. |
| **Rename** | `node scripts/rename.js` | Standardizes all filenames to kebab-case. |
| **Clean Titles** | `node scripts/svg-title.js` | Syncs the SVG `<title>` tag with the filename. |
| **Build Helper** | `node scripts/generate-helper-pages.js` | Builds the static `index.html` for Browse icons. |

## A Note on AWS Brand Guidelines

When you use these icons, remember that they are the property of Amazon Web Services, Inc. Be sure to follow their branding and attribution rules, which include:

  * Using "AWS" or "Amazon" in the service's first visible label.
  * Not editing the colors or shapes of the icons.
  * Adding an attribution line in your document or footnote.

## Contributing

Feel free to open an issue or submit a pull request. If you're making changes, please run the linter (`npm run lint`) and keep the console output easy to read on both light and dark terminals.

## License

The code in this repository is released under the **MIT License**. The AWS architecture icons themselves are property of Amazon Web Services, Inc.
