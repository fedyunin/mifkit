# PROJECT_CONTEXT.md

## Project name

MifKit — MapInfo data toolkit (desktop GUI + CLI). Renamed from MifMapXL in 1.1.0.

The notes below describe the original `mif-to-xlsx` feature, which remains the first converter. Newer converters (KML/KMZ ↔ MapInfo, GeoJSON, Shapefile, etc.) are added as additional entries in `src/core/converters/` under the same Converter contract — see `src/core/converters/types.js` and `registry.js`.

## Purpose

This is a desktop app for converting MapInfo `.mif` + `.mid` pairs into:

- `.xlsx` files with all original attribute fields
- optional `.csv` export
- an extra column `region_color_hex`
- optional row background fill in Excel using the region fill color
- optional skip for black fill (`#000000`)

The app is intended for non-technical Windows users who should be able to run a normal GUI app instead of using Node.js scripts in a terminal.

---

## Product goal

The user wants a simple Windows executable with UI where they can:

- choose a folder or specific files for processing
- recursively scan subfolders if needed
- generate Excel files from MapInfo data
- add a color column extracted from polygon style
- optionally fill Excel rows with that color
- skip black fill if configured
- optionally merge all outputs into one workbook
- optionally also export CSV

The user is pragmatic and wants a working tool, not a theoretical one.

---

## Current stack

- Electron
- Node.js
- exceljs
- electron-builder

---

## High-level architecture

The project has 2 main parts:

### 1. Desktop UI
Electron app with:
- main process
- preload bridge
- renderer UI

Responsibilities:
- choose input folder or files
- choose output folder
- edit settings
- start conversion
- show logs and results

### 2. Conversion engine
Pure Node.js logic that:
- scans files
- matches `.mif` with corresponding `.mid`
- parses MIF metadata and geometry style
- parses MID records
- builds CSV/XLSX output
- applies Excel row fill
- skips black when requested

The conversion logic should stay mostly independent from Electron UI so it can be tested separately and reused later in CLI mode if needed.

---

## Input format assumptions

### MIF
Used for:
- column definitions
- charset
- geometry/style records
- `Brush(...)` parsing for polygon fill color

### MID
Used for:
- attribute rows corresponding to MIF objects

### Pairing
Files are matched by basename in the same folder:

- `example.mif`
- `example.mid`

Case-insensitive matching is required on Windows.

---

## Core functional requirements

### Required
- find `.mif` files
- find matching `.mid`
- parse column names from MIF `Columns`
- parse rows from MID safely
- extract brush color from `Brush(...)`
- create `.xlsx`
- append `region_color_hex`
- optionally fill full row in Excel
- optionally skip black `#000000`
- work with Cyrillic data where possible

### Optional / supported
- export `.csv`
- scan subfolders
- combine all processed files into one workbook
- freeze header row
- enable autofilter
- keep simple activity log in UI

---

## Important implementation details

### Color source
The color is not taken from MID attributes.
It is extracted from MIF style lines, typically:

`Brush (pattern, foregroundColor, backgroundColor)`

The app currently uses the foreground brush color as the region fill color.

### Hex conversion
The exported color column is:

- `region_color_hex`

Format:
- `#RRGGBB`

### Excel fill rule
If row fill is enabled:
- fill every cell in the row with the extracted color

If skip-black is enabled:
- rows with `#000000` must remain unfilled

### Charset handling
MapInfo files may use:
- UTF-8
- Windows-1251 / WindowsCyrillic

The parser should continue to be defensive here.

### MID parsing
MID lines must be parsed like CSV with quote-awareness:
- commas inside quoted values must not split fields
- escaped double quotes should be handled
- multiline quoted values should be handled as safely as possible

---

## UX expectations

The user prefers:
- direct practical controls
- minimal friction
- no unnecessary abstractions
- visible logs
- settings that are obvious
- ability to just select input and click convert

A good UI is:
- simple
- stable
- boring in a good way

Recommended UI sections:
- input selection
- output selection
- options
- convert button
- log panel

---

## Suggested project structure

```text
mapinfo-xlsx-app/
  package.json
  README.md
  src/
    main/
      main.js
      preload.js
    renderer/
      index.html
      renderer.js
      styles.css
    core/
      convert.js
      mif.js
      mid.js
      excel.js
      csv.js
      files.js
      settings.js
```

If the current archive uses a flatter structure, it is still worth gradually moving toward this separation.

---

## Suggested module responsibilities

### `files.js`
- scan folder
- optional recursive walk
- skip symlinks
- match `.mif` and `.mid`
- normalize case handling
- validate input set

### `mif.js`
- detect charset from MIF header
- parse `Columns`
- parse style info after `Data`
- extract brush colors

### `mid.js`
- decode MID with correct encoding
- split into logical rows
- parse quoted CSV-like records
- normalize row length against header count

### `excel.js`
- create workbook
- create one sheet or multiple sheets
- append `region_color_hex`
- apply row fills
- skip black when requested
- freeze header / autofilter / widths

### `csv.js`
- build CSV safely
- escape commas, quotes, newlines
- include `region_color_hex`

### `convert.js`
- orchestration layer
- receives settings and selected inputs
- calls scan → parse → export
- returns structured progress/log events

### `settings.js`
- load/save UI preferences
- defaults:
  - skipBlack = true
  - fillRows = true
  - recursive = true
  - exportCsv = false
  - mergeToSingleWorkbook = false

---

## Known edge cases

### 1. Mismatch between MID row count and extracted brush count
Possible causes:
- some objects may not have `Brush(...)`
- non-polygon geometries may exist
- style lines may not be one-to-one in naive parsing

Need:
- clear logging
- graceful handling
- possibly blank color if missing

### 2. Non-polygon objects
Some layers may contain:
- points
- lines
- text
- regions

Not every object has a brush fill.
Do not crash if `Brush(...)` is absent.

### 3. Root filesystem scan
Never recursively scan `/` or an entire disk by accident.
Guard against:
- filesystem root
- huge scans
- symlink loops

### 4. Broken encodings
Some files may decode imperfectly.
Need:
- fallback decoding
- warning logs
- best-effort export

### 5. Duplicate sheet names
If combining many files into one workbook:
- sheet names must be unique
- Excel limit is 31 chars
- invalid characters must be stripped

### 6. Very large datasets
Potential issues:
- memory pressure in Excel generation
- UI freeze if conversion runs in main thread

Recommended:
- keep heavy work off renderer
- consider progress events
- possibly later move work to worker process

---

## Non-goals for now

Not needed unless explicitly requested:
- editing geometries
- rendering map previews
- reading thematic style from external style config
- supporting every MapInfo style nuance
- geospatial reprojection
- shapefile or GeoJSON conversion
- database import/export
- cloud sync

---

## Build and run

### Development
```bash
npm install
npm run dev
```

### Production build
```bash
npm run dist
```

Expected output:
- Windows `.exe`
- ideally portable and/or installer package via electron-builder

---

## Quality bar

The user cares most about:
- it works on real files
- row colors are correct enough
- black can be skipped
- UI is simple
- no terminal required for the final user

The user does not care about:
- overengineering
- fancy design
- architecture purity for its own sake

---

## Recommended next steps

### Priority 1
- verify conversion on several real-world `.mif/.mid` samples
- validate color extraction logic
- validate Cyrillic text handling
- validate row count matching

### Priority 2
- improve logs and error reporting in UI
- add drag-and-drop
- add progress indicator
- allow open output folder after conversion

### Priority 3
- add single combined workbook mode polish
- add summary report after run
- add portable build preset for Windows

---

## Definition of done

A good result means:
- user runs `.exe`
- selects folder or files
- clicks convert
- gets `.xlsx` files
- sees `region_color_hex`
- rows are filled correctly
- black rows remain unfilled if option is enabled
- no coding knowledge needed for the end user

---

## Guidance for future AI assistants

When working on this project, optimize for:
- reliability over elegance
- real file compatibility over abstract correctness
- simple UI over complex workflows
- minimal dependencies unless they clearly help

Do not aggressively refactor working parsing logic unless there is a concrete bug or maintainability issue.

When changing parsing code:
- preserve quote-safe MID parsing
- preserve charset handling
- preserve Windows-friendly behavior
- test with real MIF/MID pairs

When changing UI:
- keep it obvious
- avoid hidden settings
- avoid fancy component frameworks unless there is a real benefit

When changing export behavior:
- never silently drop original fields
- always keep `region_color_hex`
- do not fill rows with black if skip-black is enabled

---

## Short project summary

This is a Windows desktop utility that converts MapInfo `.mif/.mid` files into Excel/CSV with an extra color column and optional row background fill based on region color. The main business value is making MapInfo export usable for normal spreadsheet workflows without manual GIS steps.
