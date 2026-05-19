const fs = require('fs')
const path = require('path')

const { runConversion } = require('../../convert')

/**
 * mif-to-xlsx — MapInfo MIF/MID -> Excel/CSV.
 *
 * Wraps the existing convert.js engine without changing behavior. The new
 * Converter contract lets the GUI/CLI dispatch through the registry; under
 * the hood we still call runConversion(config, listeners).
 *
 * @type {import('../types').Converter}
 */
const converter = {
  id: 'mif-to-xlsx',
  name: 'MapInfo → Excel/CSV',
  description: 'Convert MapInfo MIF/MID pairs to .xlsx (and optional .csv) with extracted region colors and optional row painting.',
  inputs: { extensions: ['.mif'], type: 'file-or-folder' },
  outputs: { extensions: ['.xlsx', '.csv'], type: 'folder' },
  options: [
    { key: 'recursive',              type: 'boolean', default: true,                label: 'Scan subfolders' },
    { key: 'paintRows',              type: 'boolean', default: true,                label: 'Paint rows with region color' },
    { key: 'skipBlack',              type: 'boolean', default: true,                label: 'Skip black fill (#000000)' },
    { key: 'includeColorColumn',     type: 'boolean', default: true,                label: 'Include color column' },
    { key: 'colorColumnName',        type: 'string',  default: 'region_color_hex',  label: 'Color column name' },
    { key: 'combineIntoOneWorkbook', type: 'boolean', default: false,               label: 'Merge into one workbook' },
    { key: 'combinedName',           type: 'string',  default: 'mapinfo-converted', label: 'Combined workbook name' },
    { key: 'includeCsv',             type: 'boolean', default: false,               label: 'Also export CSV' },
    { key: 'freezeHeader',           type: 'boolean', default: false,               label: 'Freeze header row' },
    { key: 'autofilter',             type: 'boolean', default: false,               label: 'Enable autofilter' },
  ],
  async run({ inputs, output, options }, ctx) {
    const config = buildLegacyConfig(inputs, output, options)
    const listeners = { log: ctx.log, progress: ctx.progress }
    const summary = await runConversion(config, listeners)
    return {
      outputs: summary.outputs || [],
      stats: {
        processed: summary.processed || 0,
        skipped: summary.skipped || 0,
        errors: summary.errors || [],
      },
    }
  },
}

function buildLegacyConfig(inputs, output, options) {
  const paths = (inputs || []).map((p) => path.resolve(p))
  const folderInput = paths.length === 1 && safeIsDirectory(paths[0])

  return {
    inputMode: folderInput ? 'folder' : 'files',
    inputFolder: folderInput ? paths[0] : '',
    selectedFiles: folderInput ? [] : paths,
    outputFolder: output || '',
    ...options,
  }
}

function safeIsDirectory(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch (error) {
    return false
  }
}

module.exports = converter
