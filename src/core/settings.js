const fs = require('fs')
const path = require('path')

const SETTINGS_VERSION = 2

// Keys that were stored at the root in v1 and belong to mif-to-xlsx options now.
const LEGACY_MIF_TO_XLSX_KEYS = [
  'recursive',
  'paintRows',
  'skipBlack',
  'combineIntoOneWorkbook',
  'combinedName',
  'includeCsv',
  'includeColorColumn',
  'colorColumnName',
  'freezeHeader',
  'autofilter',
]

function getDefaultSettings() {
  return {
    version: SETTINGS_VERSION,
    language: 'en',
    inputMode: 'folder',
    inputFolder: '',
    outputFolder: '',
    selectedFiles: [],
    converterId: 'mif-to-xlsx',
    converterOptions: {},
  }
}

function loadSettings(settingsPath) {
  try {
    if (!fs.existsSync(settingsPath)) {
      return getDefaultSettings()
    }

    const raw = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(raw)
    return migrate(parsed)
  } catch (error) {
    return getDefaultSettings()
  }
}

function migrate(stored) {
  const base = getDefaultSettings()
  if (!stored || typeof stored !== 'object') {
    return base
  }

  // Already on the latest format.
  if (stored.version === SETTINGS_VERSION) {
    return {
      ...base,
      ...stored,
      converterOptions: { ...stored.converterOptions },
    }
  }

  // v1: flat option keys at the root, no converterId, no converterOptions.
  const carryOver = {
    language: stored.language,
    inputMode: stored.inputMode,
    inputFolder: stored.inputFolder,
    outputFolder: stored.outputFolder,
    selectedFiles: stored.selectedFiles,
  }

  const mifToXlsxOptions = {}
  for (const key of LEGACY_MIF_TO_XLSX_KEYS) {
    if (Object.prototype.hasOwnProperty.call(stored, key)) {
      mifToXlsxOptions[key] = stored[key]
    }
  }

  return {
    ...base,
    ...Object.fromEntries(Object.entries(carryOver).filter(([, v]) => v !== undefined)),
    converterId: 'mif-to-xlsx',
    converterOptions: Object.keys(mifToXlsxOptions).length
      ? { 'mif-to-xlsx': mifToXlsxOptions }
      : {},
  }
}

function saveSettings(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  const payload = { ...settings, version: SETTINGS_VERSION }
  fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8')
}

module.exports = {
  getDefaultSettings,
  loadSettings,
  saveSettings,
  migrate,
  SETTINGS_VERSION,
}
