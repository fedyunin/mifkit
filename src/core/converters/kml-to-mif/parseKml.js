const { XMLParser } = require('fast-xml-parser')

const { kmlColorToMapInfo } = require('../../common/color')

const DEFAULT_STYLE = Object.freeze({
  lineColor: 0,
  lineWidth: 1,
  polyColor: 0xc0c0c0,
  polyFill: true,
  iconColor: 0xffff00,
})

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  // Preserve arrays where multiple siblings can appear.
  isArray: (name) => ARRAY_NODES.has(name),
})

const ARRAY_NODES = new Set([
  'Folder',
  'Placemark',
  'Pair',
  'Style',
  'StyleMap',
  'Polygon',
  'LineString',
  'Point',
  'innerBoundaryIs',
])

/**
 * Parse a KML document text into a normalized structure:
 *   {
 *     styles:    Map<id, ResolvedStyle>,
 *     stylemaps: Map<id, string>,        // styleMapId -> normal styleId
 *     groups:    Array<{ path: string[], placemarks: Placemark[] }>
 *   }
 */
function parseKml(kmlText) {
  const root = PARSER.parse(kmlText)
  const document = (root && (root.kml?.Document || root.Document)) || root
  if (!document) {
    throw new Error('KML has no Document element')
  }

  const styles = collectStyles(document)
  const stylemaps = collectStyleMaps(document)
  const groups = []

  const topFolders = ensureArray(document.Folder)
  for (const folder of topFolders) {
    walkFolder(folder, [], groups)
  }

  const directPlacemarks = ensureArray(document.Placemark)
  if (directPlacemarks.length) {
    groups.push({ path: ['root'], placemarks: directPlacemarks.map(normalizePlacemark) })
  }

  return { styles, stylemaps, groups }
}

function collectStyles(document) {
  const styles = new Map()
  const queue = [document]

  while (queue.length) {
    const node = queue.shift()
    if (!node || typeof node !== 'object') {
      continue
    }

    for (const style of ensureArray(node.Style)) {
      const id = style['@_id']
      if (!id) {
        continue
      }
      styles.set(id, extractStyle(style))
    }

    for (const folder of ensureArray(node.Folder)) {
      queue.push(folder)
    }
  }

  return styles
}

function collectStyleMaps(document) {
  const stylemaps = new Map()
  const queue = [document]

  while (queue.length) {
    const node = queue.shift()
    if (!node || typeof node !== 'object') {
      continue
    }

    for (const sm of ensureArray(node.StyleMap)) {
      const id = sm['@_id']
      if (!id) {
        continue
      }
      const pairs = ensureArray(sm.Pair)
      const normalPair = pairs.find((p) => textOf(p.key) === 'normal')
      if (normalPair && normalPair.styleUrl) {
        stylemaps.set(id, stripHash(textOf(normalPair.styleUrl)))
      }
    }

    for (const folder of ensureArray(node.Folder)) {
      queue.push(folder)
    }
  }

  return stylemaps
}

function extractStyle(node) {
  const style = { ...DEFAULT_STYLE }

  const lineStyle = node.LineStyle
  if (lineStyle) {
    style.lineColor = kmlColorToMapInfo(textOf(lineStyle.color), style.lineColor)
    const widthText = textOf(lineStyle.width)
    if (widthText) {
      const parsed = Number(widthText)
      if (Number.isFinite(parsed)) {
        style.lineWidth = Math.max(1, Math.round(parsed))
      }
    }
  }

  const polyStyle = node.PolyStyle
  if (polyStyle) {
    style.polyColor = kmlColorToMapInfo(textOf(polyStyle.color), style.polyColor)
    const fillText = textOf(polyStyle.fill)
    if (fillText === '0') {
      style.polyFill = false
    }
  }

  const iconStyle = node.IconStyle
  if (iconStyle) {
    style.iconColor = kmlColorToMapInfo(textOf(iconStyle.color), style.iconColor)
  }

  return style
}

function walkFolder(folder, path, out) {
  const name = textOf(folder.name).trim()
  const here = name ? [...path, name] : path

  const placemarks = ensureArray(folder.Placemark)
  if (placemarks.length) {
    out.push({
      path: here.length ? here : ['root'],
      placemarks: placemarks.map(normalizePlacemark),
    })
  }

  for (const sub of ensureArray(folder.Folder)) {
    walkFolder(sub, here, out)
  }
}

function normalizePlacemark(pm) {
  const styleUrl = stripHash(textOf(pm.styleUrl))
  const polygons = collectGeometries(pm.Polygon, pm.MultiGeometry?.Polygon)
    .map(extractPolygon)
    .filter((rings) => rings.length)

  const lines = collectGeometries(pm.LineString, pm.MultiGeometry?.LineString)
    .map(extractLineString)
    .filter((pts) => pts.length >= 2)

  const points = collectGeometries(pm.Point, pm.MultiGeometry?.Point)
    .map(extractPoint)
    .filter((p) => p !== null)

  return {
    name: textOf(pm.name).trim(),
    description: textOf(pm.description).trim(),
    styleUrl,
    polygons,
    lines,
    points,
  }
}

function collectGeometries(...sources) {
  const result = []
  for (const source of sources) {
    if (source === undefined || source === null) {
      continue
    }
    if (Array.isArray(source)) {
      result.push(...source)
    } else {
      result.push(source)
    }
  }
  return result
}

function extractPolygon(polygon) {
  const rings = []
  const outer = polygon?.outerBoundaryIs?.LinearRing?.coordinates
  const outerPts = parseCoordinates(textOf(outer))
  if (outerPts.length >= 3) {
    rings.push(outerPts)
  }
  const inners = ensureArray(polygon?.innerBoundaryIs)
  for (const inner of inners) {
    const pts = parseCoordinates(textOf(inner?.LinearRing?.coordinates))
    if (pts.length >= 3) {
      rings.push(pts)
    }
  }
  return rings
}

function extractLineString(line) {
  return parseCoordinates(textOf(line?.coordinates))
}

function extractPoint(point) {
  const pts = parseCoordinates(textOf(point?.coordinates))
  return pts.length ? pts[0] : null
}

function parseCoordinates(text) {
  if (!text) {
    return []
  }
  const pts = []
  for (const token of text.trim().split(/\s+/)) {
    if (!token) {
      continue
    }
    const parts = token.split(',')
    if (parts.length < 2) {
      continue
    }
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pts.push([x, y])
    }
  }
  return pts
}

function resolveStyle(styleUrl, styles, stylemaps) {
  let ref = stripHash(styleUrl)
  const seen = new Set()
  while (ref && stylemaps.has(ref) && !seen.has(ref)) {
    seen.add(ref)
    ref = stylemaps.get(ref)
  }
  if (ref && styles.has(ref)) {
    return { style: styles.get(ref), resolvedId: ref }
  }
  return { style: { ...DEFAULT_STYLE }, resolvedId: ref || '' }
}

function stripHash(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.startsWith('#') ? value.slice(1) : value
}

function textOf(node) {
  if (node === undefined || node === null) {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (typeof node === 'object') {
    if (Object.prototype.hasOwnProperty.call(node, '#text')) {
      return String(node['#text'])
    }
  }
  return ''
}

function ensureArray(value) {
  if (value === undefined || value === null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

module.exports = {
  parseKml,
  resolveStyle,
  DEFAULT_STYLE,
}
