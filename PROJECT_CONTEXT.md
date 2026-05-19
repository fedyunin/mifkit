# PROJECT_CONTEXT.md

## Project name

MifKit — MapInfo data toolkit (desktop GUI + CLI). Renamed from MifMapXL in 1.1.0.

## Purpose

A growing collection of converters for MapInfo `.mif/.mid` and adjacent geo formats (KML/KMZ, GeoJSON, Shapefile, Excel). Packaged as a desktop GUI (Electron) and — once the CLI ships — a terminal binary built on the same engine.

The target user is non-technical (Windows + MapInfo Pro), so the GUI is the primary front-end. The CLI is for power users, automation, and CI pipelines.

The product mood is **ffmpeg for MapInfo data**: one engine, every conversion direction surfaces in both the GUI and CLI through the same contract, behavior is deterministic, output is correct enough to import into MapInfo Pro without manual fixing.

## Architecture

### Three layers

1. **Core engine** — `src/core/`. Pure Node.js, no Electron dependency, testable in isolation. Each converter is one folder under `src/core/converters/` exporting a Converter object.
2. **Desktop shell** — `src/main/` (Electron main process, IPC, worker orchestration) + `src/renderer/` (HTML/JS UI). The renderer is thin and schema-driven — it does not know any converter-specific details, it just renders forms from each converter's declarative `options[]` schema and dispatches the user's selection back through IPC.
3. **CLI** — `bin/mifkit` is a thin wrapper over `src/cli/index.js` which dispatches `list` / `help` / `convert` commands through the same registry. Option flags are parsed against each converter's schema (booleans via `--key` / `--no-key`, everything else via `--key=value`). GUI and CLI are interchangeable entry points to the same core.

```
bin/
  mifkit.js                        CLI entry — thin shebang over src/cli
src/
  main/                            Electron shell
    main.js · preload.js · worker.js
  renderer/                        Desktop UI
    index.html · renderer.js · styles.css · i18n.js
  cli/                             CLI — same registry, different front-end
    index.js                       runCli(argv): commands list / help / convert
    parseArgs.js · coerceOptions.js · format.js
  core/
    common/                        Shared utilities
      color.js                     KML AABBGGRR <-> MapInfo int <-> #RRGGBB
      zip.js                       Minimal ZIP reader (zlib only)
    converters/
      registry.js                  register / get / list / validateOptions
      types.js                     JSDoc Converter contract
      index.js                     Auto-registers all built-in converters
      mif-to-xlsx/                 MapInfo MIF/MID -> Excel/CSV
      kml-to-mif/                  KML/KMZ -> MapInfo MIF/MID
    convert.js                     Legacy orchestration for mif-to-xlsx
                                   (still used inside that converter; will
                                   fold into the converter folder later)
    mif.js · mid.js                MapInfo MIF/MID parsers
    excel.js · csv.js              Output writers
    files.js                       Folder scan, MIF/MID pairing
    encoding.js                    Charset detection via iconv-lite
    settings.js                    Settings persistence with v1 -> v2 migration
test/
  cli/ · core/ · integration/      node:test suite, runs on every PR
  fixtures/                        small MIF/MID/KML samples
```

### The Converter contract

Every converter exports a plain object of this shape (full JSDoc lives in `src/core/converters/types.js`):

```js
{
  id: 'kml-to-mif',                       // stable kebab-case
  name: 'KML/KMZ → MapInfo MIF/MID',
  description: '...',
  inputs:  { extensions: ['.kml', '.kmz'], type: 'file-or-folder' },
  outputs: { extensions: ['.mif', '.mid'], type: 'folder' },
  options: [
    { key: 'flat',    type: 'boolean', default: false, label: '...', description: '...' },
    { key: 'charset', type: 'enum',    values: ['WindowsCyrillic', 'Neutral'], default: 'WindowsCyrillic', label: '...' },
    // ...
  ],
  async run({ inputs, output, options }, ctx) {
    // ctx.log(message)
    // ctx.progress({ total, done, currentFile })
    // returns { outputs: string[], stats: { processed, skipped, errors: [{file, error}] } }
  },
}
```

The registry validates this shape on `register()`. `validateOptions()` checks each option against its declared type/enum/range before the converter runs.

### How the GUI talks to the engine

```
renderer (renderer.js)
  ├─ window.api.listConverters()       → IPC converters:list → registry.list()
  ├─ renders <select> + options form from the returned schema
  └─ window.api.startConversion({converterId, inputs, output, options})
        → IPC convert:start
        → Worker thread
        → converters.get(id).run(...)
        → log/progress events back to the renderer
```

### Settings shape (v2)

```jsonc
{
  "version": 2,
  "language": "en",
  "inputMode": "folder",
  "inputFolder": "...",
  "outputFolder": "...",
  "selectedFiles": [],
  "converterId": "kml-to-mif",
  "converterOptions": {
    "mif-to-xlsx": { /* per-converter options */ },
    "kml-to-mif":  { /* per-converter options */ }
  }
}
```

`migrate()` in `src/core/settings.js` lifts legacy flat keys from v1 (1.0.x) into `converterOptions['mif-to-xlsx']` automatically on first load.

## Shipped converters

### mif-to-xlsx — MapInfo → Excel/CSV

Original feature inherited from MifMapXL. Reads MIF column declarations and MID rows, extracts polygon brush foreground colors, writes `.xlsx` (and optional `.csv`) with a `region_color_hex` column and optional row background fill. Implementation currently delegates to `src/core/convert.js` via a thin adapter; can fold the legacy engine into `converters/mif-to-xlsx/` in a later refactor without changing behavior.

### kml-to-mif — KML/KMZ → MapInfo MIF/MID

Reads KML and KMZ archives, resolves each Placemark's `styleUrl` through `StyleMap → Style` chains, emits MIF/MID with matching `Pen` / `Brush` / `Symbol` styling and an attribute schema of Name + Description + StyleId + Folder. Folder hierarchy preserved as nested directories (default) or one flat directory with `parent__child` prefixes (`flat: true`). Charset: `WindowsCyrillic` (cp1251) by default for Russian/Kazakh data; `Neutral` (UTF-8) for MapInfo Pro 15.2+.

Byte-identical to the reference Python script `kml_to_mif.py` (kept outside the repo) on a real 1854-feature dataset.

## Planned converters

| id              | direction                                    | rationale |
|-----------------|----------------------------------------------|-----------|
| `mif-to-kml`    | MapInfo MIF/MID → KML/KMZ                    | Reverse direction. Validates the contract works both ways. Useful for exporting MapInfo layers to Google Earth. |
| `mif-to-geojson`| MapInfo MIF/MID → GeoJSON                    | Modern GIS interchange. |
| `geojson-to-mif`| GeoJSON → MapInfo MIF/MID                    | Reverse. |
| `shp-to-mif`    | Shapefile → MapInfo MIF/MID                  | Killer feature — no other browser-installable tool does this without GDAL. |
| `mif-to-shp`    | MapInfo MIF/MID → Shapefile                  | Reverse. |
| `excel-to-mif`  | Excel/CSV with coordinates → MIF/MID Points  | Geocoding from spreadsheets. |
| `mif-merge`     | Multiple MIF → one MIF                       | Utility op. |
| `mif-split`     | One MIF → multiple MIF (by attribute)        | Utility op. |
| `mif-style-set` | Batch style change on a MIF                  | Utility op. |

Adding a new converter is one folder under `src/core/converters/`, one fixture under `test/fixtures/`, one entry in `src/core/converters/index.js`. The GUI and (future) CLI pick it up automatically.

## Input format assumptions

### MIF (read)
- Column declarations parsed from the `Columns N` block.
- Charset detected from the `Charset "..."` line via `iconv-lite`.
- Style lines parsed for `Brush(pattern, fg, bg)` — currently only `fg` is consumed (for the Excel color column).
- Geometry keywords supported by the parser: `point`, `line`, `pline`, `region`, `arc`, `text`, `rectangle`, `roundrect`, `ellipse`, `multipoint`, `collection`, `none`.

### MID (read)
- CSV-like with quote-aware parsing: commas and newlines inside quoted values are preserved, doubled quotes `""` are unescaped, multiline values handled safely.
- Row count is normalized against the header count from MIF.

### MIF/MID (write, kml-to-mif)
- `Version 300`, `CoordSys Earth Projection 1, 104` (WGS 84 lat/long, the KML-native CRS).
- CRLF line endings throughout, including newlines that were embedded inside `<description>` values in the source KML.
- Charset declared as `WindowsCyrillic` (file encoded as cp1251) or `Neutral` (UTF-8).
- Per-feature style strings: `Pen(width, pattern=2, color)`, `Brush(pattern, fg=color, bg=16777215)`, `Symbol(35, color, 12)`. Brush pattern 1 means "no fill" (matches KML `<fill>0</fill>`).

### KML/KMZ (read)
- Parsed with `fast-xml-parser`, namespace-agnostic.
- Folder hierarchy collected by walking `Document/Folder/...`. Each leaf Folder with direct Placemarks becomes one output group; nested Folders become nested groups.
- Style resolution: `Placemark → styleUrl → (StyleMap with key=normal) → Style`. Self-referential or unresolved chains fall back to a sensible default style.
- KMZ archives unzipped in-process via `src/core/common/zip.js` (pure JS, `zlib` only, supports stored + deflate, rejects ZIP64).

## Charset handling

MapInfo files may use:
- UTF-8 (called `Neutral` in MapInfo)
- Windows-1251 / `WindowsCyrillic`
- Other Windows-* code pages (mapped in `src/core/common/encoding.js`)

The parser is defensive — anything it cannot map falls back to UTF-8. Writers explicitly declare the charset in the MIF header and encode the byte stream to match.

## Quality bar

What matters:
- Output is correct enough to round-trip through MapInfo Pro without manual fixing.
- Per-feature styles preserved as faithfully as the target format allows.
- Cyrillic / Kazakh text survives every encoding step.
- GUI does not block during conversion (work runs in `worker_threads`).
- No native dependencies. The whole toolkit installs via `npm install` and ships as a single Electron bundle.

What does not matter:
- Theoretical purity / generic abstraction layers.
- Supporting every obscure MapInfo style nuance up front — add cases as real datasets require.
- Fancy UI design. The form is utilitarian on purpose.

## Non-goals (for now)

- Editing geometries.
- Rendering map previews.
- Reprojection (CoordSys conversion). All converters currently pass through the source CRS or default to WGS 84.
- Database import/export.
- Cloud sync of settings.

## Build and run

```bash
npm install
npm run dev           # Electron in dev mode
npm test              # node:test suite
npm run dist:mac      # DMG + zip
npm run dist:linux    # AppImage + deb
npm run dist:win      # portable + NSIS installer
npm run dist          # host platform
```

Artifacts land in `dist/`.

## Definition of done for a new converter PR

1. New folder under `src/core/converters/<id>/` with `index.js` exporting a valid Converter object.
2. Registered in `src/core/converters/index.js`.
3. Real fixture in `test/fixtures/` covering the geometry types and edge cases the converter handles.
4. Unit tests for pure helpers (color, parsing, writing) and an integration test that calls `converter.run()` and checks output bytes.
5. `npm test` is green.
6. The GUI shows the converter in the dropdown with its options form rendering correctly. (Manual smoke; UI does not need code changes.)

## Guidance for future AI assistants

- Prefer adding a new converter to extending one — the registry is the seam of growth.
- When extending a converter, do not break behavior validated by an existing fixture without adjusting the fixture's assertions and explaining why.
- The Converter contract is the source of truth — when in doubt about option types or option flow, re-read `src/core/converters/types.js` and `registry.js`.
- Settings format changes require bumping `SETTINGS_VERSION` and adding a branch in `migrate()`. Never silently drop user data.
- The renderer should stay schema-driven. If a new feature needs a UI knob, expose it as an option on the converter, not as renderer-specific HTML.
- Keep `src/core/` free of Electron imports. Anything that touches `electron` belongs in `src/main/` or `src/renderer/`.
- Don't introduce native deps. If you need a ZIP, an XML parser, or an encoding lib, check `src/core/common/` first — it already covers the common cases.
