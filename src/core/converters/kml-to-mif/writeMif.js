const fs = require('fs')
const path = require('path')

const iconv = require('iconv-lite')

const { resolveStyle } = require('./parseKml')

const CHARSET_TO_MAPINFO = {
  'windows-1251': 'WindowsCyrillic',
  'utf-8': 'Neutral',
}

const CHARSET_TO_ICONV = {
  WindowsCyrillic: 'windows-1251',
  Neutral: 'utf-8',
  'UTF-8': 'utf-8',
}

/**
 * Write one MIF/MID pair per group from a parsed KML structure.
 *
 * @param {Object} parsed                 Output of parseKml().
 * @param {string} outDir
 * @param {Object} options
 * @param {boolean} options.flat          Put every file in outDir with prefixed names.
 * @param {string}  options.charset       MapInfo Charset value (e.g. WindowsCyrillic, Neutral).
 * @param {(msg: string) => void} [log]
 * @returns {{ outputs: string[], featuresWritten: number, groupsWritten: number }}
 */
function writeMifFromKml(parsed, outDir, options, log) {
  const charset = options.charset || 'WindowsCyrillic'
  const encoding = CHARSET_TO_ICONV[charset] || 'utf-8'
  const outputs = []
  let featuresWritten = 0

  fs.mkdirSync(outDir, { recursive: true })

  for (const group of parsed.groups) {
    const result = writeGroup({
      group,
      parsed,
      outDir,
      charset,
      encoding,
      flat: !!options.flat,
    })
    outputs.push(result.mifPath, result.midPath)
    featuresWritten += result.written
    if (log) {
      log(`Wrote ${path.relative(outDir, result.mifPath)} (${result.written} features)`)
    }
  }

  return { outputs, featuresWritten, groupsWritten: parsed.groups.length }
}

function writeGroup({ group, parsed, outDir, charset, encoding, flat }) {
  const folderPath = group.path.join(' / ')
  const mifBody = []
  const midBody = []

  for (const placemark of group.placemarks) {
    if (emitFeature(placemark, folderPath, parsed, mifBody, midBody)) {
      // counted via mid line length below
    }
  }

  const written = midBody.length

  const targetDir = flat ? outDir : path.join(outDir, ...group.path.slice(0, -1).map(safeFilename))
  fs.mkdirSync(targetDir, { recursive: true })

  const baseName = flat
    ? group.path.map(safeFilename).join('__')
    : safeFilename(group.path[group.path.length - 1])

  const mifPath = path.join(targetDir, `${baseName}.mif`)
  const midPath = path.join(targetDir, `${baseName}.mid`)

  const eol = '\r\n'
  const header = buildHeader(charset, eol)
  // Normalize every newline (including ones embedded inside <description> values)
  // to CRLF — keeps MIF/MID consistent for Windows-oriented MapInfo Pro.
  const mifText = normalizeNewlines(`${header}${eol}${mifBody.join(eol)}${eol}`)
  const midText = normalizeNewlines(`${midBody.join(eol)}${midBody.length ? eol : ''}`)
  fs.writeFileSync(mifPath, iconv.encode(mifText, encoding))
  fs.writeFileSync(midPath, iconv.encode(midText, encoding))

  return { mifPath, midPath, written }
}

function buildHeader(charset, eol) {
  return [
    'Version 300',
    `Charset "${charset}"`,
    'Delimiter ","',
    'CoordSys Earth Projection 1, 104',
    'Columns 4',
    '  Name Char(254)',
    '  Description Char(254)',
    '  StyleId Char(64)',
    '  Folder Char(254)',
    'Data',
    '',
  ].join(eol)
}

function emitFeature(placemark, folderPath, parsed, mifBody, midBody) {
  const { style, resolvedId } = resolveStyle(placemark.styleUrl, parsed.styles, parsed.stylemaps)

  if (placemark.polygons.length) {
    const rings = []
    for (const polygonRings of placemark.polygons) {
      for (const ring of polygonRings) {
        rings.push(ring)
      }
    }
    if (!rings.length) {
      return false
    }
    mifBody.push(`Region ${rings.length}`)
    for (const ring of rings) {
      mifBody.push(`  ${ring.length}`)
      for (const [x, y] of ring) {
        mifBody.push(`    ${x} ${y}`)
      }
    }
    mifBody.push(`    Pen (1,2,${style.lineColor})`)
    const brushPattern = style.polyFill ? 2 : 1
    mifBody.push(`    Brush (${brushPattern},${style.polyColor},16777215)`)
  } else if (placemark.lines.length) {
    if (placemark.lines.length === 1) {
      const pts = placemark.lines[0]
      mifBody.push(`Pline ${pts.length}`)
      for (const [x, y] of pts) {
        mifBody.push(`  ${x} ${y}`)
      }
    } else {
      mifBody.push(`Pline Multiple ${placemark.lines.length}`)
      for (const pts of placemark.lines) {
        mifBody.push(`  ${pts.length}`)
        for (const [x, y] of pts) {
          mifBody.push(`    ${x} ${y}`)
        }
      }
    }
    mifBody.push(`    Pen (${style.lineWidth},2,${style.lineColor})`)
  } else if (placemark.points.length) {
    const [x, y] = placemark.points[0]
    mifBody.push(`Point ${x} ${y}`)
    mifBody.push(`    Symbol (35,${style.iconColor},12)`)
  } else {
    return false
  }

  midBody.push(
    [
      mifQuote(placemark.name),
      mifQuote(placemark.description),
      mifQuote(resolvedId),
      mifQuote(folderPath),
    ].join(','),
  )
  return true
}

function mifQuote(value) {
  return `"${(value || '').replace(/"/g, '""')}"`
}

function normalizeNewlines(text) {
  return text.replace(/\r\n|\r|\n/g, '\r\n')
}

function safeFilename(name) {
  // Keep letters/digits (incl. Cyrillic and other Unicode), dash, dot, parens.
  // Replace runs of anything else with a single underscore, then strip edges.
  const cleaned = String(name || '')
    .replace(/[^\p{L}\p{N}\-.()]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || 'layer'
}

module.exports = {
  writeMifFromKml,
  safeFilename,
  CHARSET_TO_MAPINFO,
}
