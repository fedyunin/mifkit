const fs = require('fs')
const path = require('path')

const { readZip } = require('../../common/zip')
const { parseKml } = require('./parseKml')
const { writeMifFromKml } = require('./writeMif')

/**
 * kml-to-mif — KML/KMZ to MapInfo MIF/MID.
 *
 * Preserves per-feature colors (Pen/Brush/Symbol) by resolving each
 * Placemark's styleUrl through StyleMap and Style chains. Saves the KML
 * Folder hierarchy either as nested directories (default) or as one
 * directory with prefixed filenames (`flat`).
 *
 * @type {import('../types').Converter}
 */
const converter = {
  id: 'kml-to-mif',
  name: 'KML/KMZ → MapInfo MIF/MID',
  description: 'Convert Google Earth KML/KMZ to MapInfo Interchange (MIF/MID). Preserves per-feature colors from <Style>/<StyleMap>, line widths, polygon fill flag, and uses <name> as the Name attribute. Folder hierarchy from KML becomes nested folders or prefixed filenames.',
  inputs: { extensions: ['.kml', '.kmz'], type: 'file-or-folder' },
  outputs: { extensions: ['.mif', '.mid'], type: 'folder' },
  options: [
    {
      key: 'flat',
      type: 'boolean',
      default: false,
      label: 'Flatten folder structure',
      description: 'Put every MIF/MID pair in the output root with parent-folder names joined into the filename (avoids collisions when later merging).',
    },
    {
      key: 'charset',
      type: 'enum',
      values: ['WindowsCyrillic', 'Neutral'],
      default: 'WindowsCyrillic',
      label: 'MapInfo charset',
      description: 'WindowsCyrillic (cp1251) for Russian/Kazakh datasets. Neutral writes UTF-8, requires MapInfo Pro 15.2+.',
    },
    {
      key: 'recursive',
      type: 'boolean',
      default: true,
      label: 'Scan subfolders',
      description: 'When given a folder of KML/KMZ files, also process nested subfolders.',
    },
  ],
  async run({ inputs, output, options }, ctx) {
    const log = ctx?.log || (() => {})
    const progress = ctx?.progress || (() => {})
    const files = expandInputs(inputs, options.recursive !== false)

    if (!files.length) {
      throw new Error('No KML or KMZ files found in the provided inputs')
    }

    fs.mkdirSync(output, { recursive: true })

    const outputs = []
    const errors = []
    let processed = 0
    let skipped = 0

    progress({ total: files.length, done: 0, currentFile: '' })

    for (let i = 0; i < files.length; i += 1) {
      const filePath = files[i]
      progress({ total: files.length, done: i, currentFile: filePath })

      try {
        const kmlText = readKmlText(filePath)
        const parsed = parseKml(kmlText)
        const targetDir = files.length === 1
          ? output
          : path.join(output, path.basename(filePath, path.extname(filePath)))
        const result = writeMifFromKml(parsed, targetDir, {
          flat: !!options.flat,
          charset: options.charset || 'WindowsCyrillic',
        }, log)
        outputs.push(...result.outputs)
        processed += 1
        log(`Done ${filePath}: ${result.featuresWritten} features in ${result.groupsWritten} layer(s)`)
      } catch (error) {
        skipped += 1
        const message = error && error.message ? error.message : String(error)
        errors.push({ file: filePath, error: message })
        log(`ERROR ${filePath}: ${message}`)
      }

      progress({ total: files.length, done: i + 1, currentFile: filePath })
    }

    return {
      outputs,
      stats: { processed, skipped, errors },
    }
  },
}

function expandInputs(inputs, recursive) {
  const result = []
  for (const raw of inputs || []) {
    const p = path.resolve(raw)
    let stat
    try {
      stat = fs.statSync(p)
    } catch (error) {
      continue
    }
    if (stat.isDirectory()) {
      collectFromDir(p, recursive, result)
    } else if (stat.isFile() && isKmlOrKmz(p)) {
      result.push(p)
    }
  }
  return Array.from(new Set(result))
}

function collectFromDir(dir, recursive, out) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    return
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        collectFromDir(full, recursive, out)
      }
      continue
    }
    if (entry.isFile() && isKmlOrKmz(full)) {
      out.push(full)
    }
  }
}

function isKmlOrKmz(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.kml' || ext === '.kmz'
}

function readKmlText(filePath) {
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.kmz') {
    const { entries } = readZip(buffer)
    const doc = entries.find((e) => /\.kml$/i.test(e.name))
    if (!doc) {
      throw new Error('KMZ contains no .kml file')
    }
    return doc.extract().toString('utf8')
  }
  return buffer.toString('utf8')
}

module.exports = converter
