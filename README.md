# MifKit

[![Latest release](https://img.shields.io/github/v/release/fedyunin/mifkit)](https://github.com/fedyunin/mifkit/releases/latest)
[![Tests](https://github.com/fedyunin/mifkit/actions/workflows/test.yml/badge.svg)](https://github.com/fedyunin/mifkit/actions/workflows/test.yml)

MapInfo data toolkit. A growing set of converters for MapInfo `.mif/.mid` and adjacent geo formats (KML/KMZ, GeoJSON, Shapefile, Excel) — packaged as a desktop GUI (Electron) and a CLI built on the same engine.

> Renamed from **MifMapXL** in 1.1.0. Old GitHub URLs auto-redirect. The Excel export feature is unchanged — it is now one converter (`mif-to-xlsx`) inside a pluggable registry.

## Converters

| id              | direction                                  | status     |
|-----------------|--------------------------------------------|------------|
| `mif-to-xlsx`   | MapInfo MIF/MID → Excel (`.xlsx`, `.csv`)  | shipped    |
| `kml-to-mif`    | KML/KMZ → MapInfo MIF/MID                  | planned    |
| `mif-to-kml`    | MapInfo MIF/MID → KML/KMZ                  | planned    |
| `mif-to-geojson`| MapInfo MIF/MID → GeoJSON                  | planned    |
| `geojson-to-mif`| GeoJSON → MapInfo MIF/MID                  | planned    |
| `shp-to-mif`    | Shapefile → MapInfo MIF/MID                | planned    |
| `mif-to-shp`    | MapInfo MIF/MID → Shapefile                | planned    |

Adding a converter is one folder under `src/core/converters/`, one test fixture, and one entry in the registry — it then appears automatically in the GUI and CLI.

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

## `mif-to-xlsx` features

- choose either a folder or specific files
- recursive folder scan
- export one xlsx per source file or one combined workbook
- optional csv export
- optional row fill from `Brush(...)`
- skip black fill `#000000`
- remembers settings between launches
- log window with processing output

## Build from source

```bash
npm install
npm run dev           # run in development
npm test              # run the test suite
npm run dist:mac      # DMG + zip (macOS)
npm run dist:linux    # AppImage + deb (Linux)
npm run dist:win      # portable + NSIS installer (Windows)
npm run dist          # build for the host platform
```

Artifacts are written to `dist/`.

## Project structure

```
src/
  main/                            Electron main process, IPC, worker orchestration
    main.js · preload.js · worker.js
  renderer/                        Desktop UI (HTML + vanilla JS + CSS, i18n)
    index.html · renderer.js · styles.css · i18n.js
  core/
    convert.js                     legacy orchestration for mif-to-xlsx (will fold into the converter)
    mif.js · mid.js                MapInfo MIF/MID parsers
    excel.js · csv.js              output writers
    files.js                       folder scan, MIF/MID pairing
    encoding.js                    charset detection via iconv-lite
    settings.js                    settings persistence
    converters/
      registry.js                  register / get / list / validateOptions
      types.js                     JSDoc Converter contract
      index.js                     auto-registers all converters
      mif-to-xlsx/                 first converter (wraps convert.js for now)
test/
  core/ · integration/ · fixtures/ node:test suite, runs on every PR
```

## Architecture notes

Every converter exports a plain object: `id`, `name`, `inputs/outputs` shape, declarative `options[]` schema, and an async `run({inputs, output, options}, ctx)`. The GUI builds its options panel from the schema; the CLI parses flags from the same schema. Both call the same `run` so behavior is identical regardless of the entry point.
