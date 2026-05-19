/**
 * Color helpers shared by all converters.
 *
 * KML stores colors as AABBGGRR hex (8 chars). MapInfo MIF stores them as a
 * decimal integer formed as 0xRRGGBB. Excel uses #RRGGBB. Keep all conversions
 * in one place so future converters reuse the same wiring.
 */

const HEX_RE = /^[0-9a-fA-F]+$/

/**
 * Parse a KML `<color>` value (AABBGGRR or BBGGRR) to MapInfo decimal int.
 * Returns `fallback` if the input is missing or malformed.
 */
function kmlColorToMapInfo(kmlColor, fallback) {
  if (!kmlColor || typeof kmlColor !== 'string') {
    return fallback
  }

  const value = kmlColor.trim().toLowerCase()

  if (!HEX_RE.test(value)) {
    return fallback
  }

  let bb
  let gg
  let rr

  if (value.length === 8) {
    bb = value.slice(2, 4)
    gg = value.slice(4, 6)
    rr = value.slice(6, 8)
  } else if (value.length === 6) {
    bb = value.slice(0, 2)
    gg = value.slice(2, 4)
    rr = value.slice(4, 6)
  } else {
    return fallback
  }

  return parseInt(rr + gg + bb, 16)
}

/**
 * Format a MapInfo color int as `#RRGGBB`.
 */
function mapInfoColorToHex(value) {
  const safe = Number.isFinite(value) ? value & 0xffffff : 0
  return `#${safe.toString(16).toUpperCase().padStart(6, '0')}`
}

/**
 * Parse a KML `<color>` value to `#RRGGBB`. Returns null on malformed input.
 */
function kmlColorToHex(kmlColor) {
  const value = kmlColorToMapInfo(kmlColor, null)
  return value === null ? null : mapInfoColorToHex(value)
}

module.exports = {
  kmlColorToMapInfo,
  kmlColorToHex,
  mapInfoColorToHex,
}
