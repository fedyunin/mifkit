const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { getDefaultSettings, loadSettings, saveSettings, migrate, SETTINGS_VERSION } = require('../../src/core/settings')

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mifkit-settings-'))
}

test('defaults are on the current version with the new shape', () => {
  const defaults = getDefaultSettings()
  assert.strictEqual(defaults.version, SETTINGS_VERSION)
  assert.strictEqual(defaults.converterId, 'mif-to-xlsx')
  assert.deepStrictEqual(defaults.converterOptions, {})
})

test('migrate moves legacy flat option keys into converterOptions.mif-to-xlsx', () => {
  const legacy = {
    language: 'ru',
    inputMode: 'files',
    inputFolder: '/x',
    outputFolder: '/y',
    selectedFiles: ['/a.mif'],
    recursive: false,
    skipBlack: true,
    paintRows: false,
    combineIntoOneWorkbook: true,
    combinedName: 'merged',
    includeCsv: true,
    includeColorColumn: false,
    colorColumnName: 'hex',
    freezeHeader: false,
    autofilter: false,
  }

  const migrated = migrate(legacy)
  assert.strictEqual(migrated.version, SETTINGS_VERSION)
  assert.strictEqual(migrated.converterId, 'mif-to-xlsx')
  assert.strictEqual(migrated.language, 'ru')
  assert.strictEqual(migrated.inputMode, 'files')
  assert.deepStrictEqual(migrated.selectedFiles, ['/a.mif'])
  assert.deepStrictEqual(migrated.converterOptions['mif-to-xlsx'], {
    recursive: false,
    skipBlack: true,
    paintRows: false,
    combineIntoOneWorkbook: true,
    combinedName: 'merged',
    includeCsv: true,
    includeColorColumn: false,
    colorColumnName: 'hex',
    freezeHeader: false,
    autofilter: false,
  })
})

test('migrate passes through already-current settings without losing data', () => {
  const current = {
    version: SETTINGS_VERSION,
    language: 'kk',
    converterId: 'kml-to-mif',
    converterOptions: {
      'kml-to-mif': { flat: true, charset: 'Neutral' },
      'mif-to-xlsx': { paintRows: true },
    },
    inputMode: 'folder',
    inputFolder: '/in',
    outputFolder: '/out',
    selectedFiles: [],
  }

  const migrated = migrate(current)
  assert.strictEqual(migrated.converterId, 'kml-to-mif')
  assert.deepStrictEqual(migrated.converterOptions, current.converterOptions)
  // confirm it's a copy, not the same reference, so callers can mutate safely
  assert.notStrictEqual(migrated.converterOptions, current.converterOptions)
})

test('migrate returns defaults on garbage input', () => {
  assert.deepStrictEqual(migrate(null), getDefaultSettings())
  assert.deepStrictEqual(migrate('not an object'), getDefaultSettings())
})

test('loadSettings + saveSettings round-trip writes the version field', () => {
  const dir = mkTmp()
  const file = path.join(dir, 'settings.json')
  saveSettings(file, {
    language: 'en',
    converterId: 'kml-to-mif',
    converterOptions: { 'kml-to-mif': { flat: true } },
    inputMode: 'folder',
    inputFolder: '',
    outputFolder: '',
    selectedFiles: [],
  })

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.strictEqual(raw.version, SETTINGS_VERSION)

  const loaded = loadSettings(file)
  assert.strictEqual(loaded.converterId, 'kml-to-mif')
  assert.deepStrictEqual(loaded.converterOptions['kml-to-mif'], { flat: true })
})

test('loadSettings of a v1 file on disk auto-migrates', () => {
  const dir = mkTmp()
  const file = path.join(dir, 'settings.json')
  fs.writeFileSync(file, JSON.stringify({
    language: 'ru',
    inputMode: 'folder',
    paintRows: false,
    skipBlack: true,
    colorColumnName: 'col',
  }))

  const loaded = loadSettings(file)
  assert.strictEqual(loaded.version, SETTINGS_VERSION)
  assert.strictEqual(loaded.converterId, 'mif-to-xlsx')
  assert.deepStrictEqual(loaded.converterOptions['mif-to-xlsx'], {
    paintRows: false,
    skipBlack: true,
    colorColumnName: 'col',
  })
})
