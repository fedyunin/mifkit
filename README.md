# MifKit

[![Latest release](https://img.shields.io/github/v/release/fedyunin/mifkit)](https://github.com/fedyunin/mifkit/releases/latest)
[![Tests](https://github.com/fedyunin/mifkit/actions/workflows/test.yml/badge.svg)](https://github.com/fedyunin/mifkit/actions/workflows/test.yml)

MapInfo data toolkit. A growing set of converters for MapInfo `.mif/.mid` and adjacent geo formats (KML/KMZ, GeoJSON, Shapefile, Excel) — packaged as a desktop GUI (Electron) **and** a CLI built on the same engine. Pick a converter, point it at your data, get clean output.

> Renamed from **MifMapXL** in 1.1.0. Old GitHub URLs auto-redirect. The Excel export feature is unchanged — it is now one of several converters in a pluggable registry, with a UI that adapts to whichever direction you pick.

## Converters

| id              | direction                                   | status     |
|-----------------|---------------------------------------------|------------|
| `mif-to-xlsx`   | MapInfo MIF/MID → Excel (`.xlsx`, `.csv`)   | **shipped** |
| `kml-to-mif`    | KML/KMZ → MapInfo MIF/MID                   | **shipped** |
| `mif-to-kml`    | MapInfo MIF/MID → KML/KMZ                   | planned    |
| `mif-to-geojson`| MapInfo MIF/MID → GeoJSON                   | planned    |
| `geojson-to-mif`| GeoJSON → MapInfo MIF/MID                   | planned    |
| `shp-to-mif`    | Shapefile → MapInfo MIF/MID                 | planned    |
| `mif-to-shp`    | MapInfo MIF/MID → Shapefile                 | planned    |

Adding a converter is one folder under `src/core/converters/`, one test fixture, and one entry in the registry — it then appears automatically in the GUI dropdown with an options form rendered from the schema.

## Download

The links below always point to the latest published release.

| Platform | File |
| --- | --- |
| **Windows** — installer | [MifKit-win-x64-setup.exe](https://github.com/fedyunin/mifkit/releases/latest/download/MifKit-win-x64-setup.exe) |
| **Windows** — portable | [MifKit-win-x64-portable.exe](https://github.com/fedyunin/mifkit/releases/latest/download/MifKit-win-x64-portable.exe) |
| **macOS** — Apple Silicon | [MifKit-mac-arm64.dmg](https://github.com/fedyunin/mifkit/releases/latest/download/MifKit-mac-arm64.dmg) |
| **Linux** — Debian/Ubuntu | [MifKit-linux-amd64.deb](https://github.com/fedyunin/mifkit/releases/latest/download/MifKit-linux-amd64.deb) |
| **Linux** — AppImage | [MifKit-linux-x86_64.AppImage](https://github.com/fedyunin/mifkit/releases/latest/download/MifKit-linux-x86_64.AppImage) |

All builds from the [releases page](https://github.com/fedyunin/mifkit/releases).

### macOS first run

Builds are unsigned. macOS will refuse to open the app with “MifKit.app is damaged”. Remove the quarantine attribute once:

```bash
xattr -dr com.apple.quarantine /Applications/MifKit.app
```

### Windows SmartScreen

Unsigned Windows builds may show “Windows protected your PC”. Click **More info → Run anyway**.

## CLI

The desktop installer also installs a `mifkit` binary on PATH. From a checkout, `npm link` (or `npm install -g .`) gives you the same command in your shell.

```bash
mifkit                                # show top-level help
mifkit list                           # list registered converters
mifkit help kml-to-mif                # show one converter's options schema
mifkit convert kml-to-mif input.kmz --output=./out --flat
mifkit convert mif-to-xlsx ./mif-folder --output=./out --no-paint-rows
```

Conventions:

- `--key=value` sets a string/enum/number option.
- `--key` flips a boolean to true; `--no-key` flips it to false.
- `--output=<dir>` / `-o <dir>` is required for `convert`.
- Output paths are printed to stdout (one per line); progress and log messages go to stderr — so you can pipe outputs through other tools without parsing logs.

Exit codes: `0` on success, `1` on per-file errors during conversion, `2` on usage errors (unknown converter, missing flags, invalid option types).

The CLI and GUI share the same registry and validation, so options behave identically. Run `mifkit help <id>` to discover what is available without leaving the terminal.

## Feature highlights

### `mif-to-xlsx` (MapInfo → Excel/CSV)

- choose either a folder or specific files
- recursive folder scan
- export one `.xlsx` per source file or one combined workbook
- optional `.csv` export
- optional row fill from `Brush(...)` foreground color
- skip black fill `#000000` (e.g. when "no color" was stored as black)
- per-converter settings remembered between launches

### `kml-to-mif` (KML/KMZ → MapInfo)

- per-feature colors preserved via `styleUrl → StyleMap → Style` resolution; KML `AABBGGRR` is converted to MapInfo's decimal RGB and emitted as matching `Pen` / `Brush` / `Symbol`
- four MID attribute columns: `Name`, `Description`, resolved `StyleId`, full `Folder` path (so you can `Select * where Folder like "..."` in MapInfo SQL)
- KML Folder hierarchy preserved as nested directories on disk, or flattened into one directory with `parent__child` prefixes (`flat` option)
- charsets: `WindowsCyrillic` (cp1251, default) for Russian/Kazakh data, or `Neutral` (UTF-8) for MapInfo Pro 15.2+
- KMZ archives unzipped in-process — no external tools needed
- byte-identical output to the reference Python script on a real 1854-feature dataset

## Build from source

```bash
npm install
npm run dev           # run in development
npm test              # run the test suite (81 tests, ~0.5s)
npm run dist:mac      # DMG + zip (macOS)
npm run dist:linux    # AppImage + deb (Linux)
npm run dist:win      # portable + NSIS installer (Windows)
npm run dist          # build for the host platform
```

Artifacts are written to `dist/`.

## Project structure

```
bin/
  mifkit.js                        CLI entry — thin shebang over src/cli
src/
  main/                            Electron main process, IPC, worker orchestration
    main.js · preload.js · worker.js
  renderer/                        Desktop UI (HTML + vanilla JS + CSS, i18n)
    index.html · renderer.js · styles.css · i18n.js
  cli/                             CLI — same registry, different front-end
    index.js                       runCli(argv): commands list/help/convert
    parseArgs.js · coerceOptions.js · format.js
  core/
    common/                        Shared utilities
      color.js                     KML AABBGGRR <-> MapInfo int <-> #RRGGBB
      zip.js                       Minimal ZIP reader (zlib only)
    converters/
      registry.js                  register / get / list / validateOptions
      types.js                     JSDoc Converter contract
      index.js                     auto-registers all converters
      mif-to-xlsx/                 MapInfo MIF/MID -> Excel/CSV
      kml-to-mif/                  KML/KMZ -> MapInfo MIF/MID
    convert.js                     legacy orchestration used by mif-to-xlsx
    mif.js · mid.js                MapInfo MIF/MID parsers
    excel.js · csv.js              output writers
    files.js                       folder scan, MIF/MID pairing
    encoding.js                    charset detection via iconv-lite
    settings.js                    v1 -> v2 settings migration
test/
  cli/ · core/ · integration/      node:test suite, runs on every PR
  fixtures/                        small MIF/MID/KML samples
```

## Adding a new converter

The Converter contract is a plain object — see `src/core/converters/types.js` for the JSDoc and `src/core/converters/kml-to-mif/index.js` for a real example.

```js
// src/core/converters/your-id/index.js
module.exports = {
  id: 'your-id',
  name: 'Your Source → Your Target',
  description: 'One-line summary that shows up under the dropdown in the GUI.',
  inputs:  { extensions: ['.src'], type: 'file-or-folder' },
  outputs: { extensions: ['.dst'], type: 'folder' },
  options: [
    { key: 'flag', type: 'boolean', default: false, label: 'Pretty label' },
    { key: 'mode', type: 'enum', values: ['a', 'b'], default: 'a', label: 'Mode' },
  ],
  async run({ inputs, output, options }, ctx) {
    ctx.log(`Starting ${this.id}`)
    ctx.progress({ total: inputs.length, done: 0 })
    // ... do the work ...
    return {
      outputs: ['/path/to/produced.dst'],
      stats: { processed: 1, skipped: 0, errors: [] },
    }
  },
}
```

Then add it to `src/core/converters/index.js`, drop a fixture in `test/fixtures/`, write a test under `test/integration/`, and run `npm test`. Both the desktop app and the `mifkit` CLI will surface it automatically — they share the same registry and read each converter's schema at startup.

## Architecture notes

Every converter exports a plain object: `id`, `name`, `inputs/outputs` shape, declarative `options[]` schema, and an async `run({inputs, output, options}, ctx)`. The GUI builds its options panel from the schema; the CLI parses flags from the same schema. Both call the same `run` so behavior is identical regardless of the entry point.

The desktop app runs every conversion inside a `worker_threads` Worker so the UI stays responsive. Log lines and progress events are forwarded back to the renderer over IPC. Settings are persisted as JSON in Electron's userData directory and auto-migrated from older formats on load.

For deeper background on the architecture, contracts, and quality bar, see [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md).
