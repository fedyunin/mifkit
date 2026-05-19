const test = require('node:test')
const assert = require('node:assert')

const { kmlColorToMapInfo, kmlColorToHex, mapInfoColorToHex } = require('../../src/core/common/color')

test('kmlColorToMapInfo converts AABBGGRR to MapInfo RGB int', () => {
  // ff0000aa (alpha=ff, blue=00, green=00, red=aa) -> RGB=AA0000 -> 0xAA0000
  assert.strictEqual(kmlColorToMapInfo('ff0000aa', -1), 0xaa0000)
  // ff00ffff -> RGB=FFFF00
  assert.strictEqual(kmlColorToMapInfo('ff00ffff', -1), 0xffff00)
  // ffff0000 -> RGB=0000FF
  assert.strictEqual(kmlColorToMapInfo('ffff0000', -1), 0x0000ff)
})

test('kmlColorToMapInfo handles 6-char BBGGRR input', () => {
  assert.strictEqual(kmlColorToMapInfo('0000aa', -1), 0xaa0000)
})

test('kmlColorToMapInfo returns fallback for invalid input', () => {
  assert.strictEqual(kmlColorToMapInfo(undefined, 42), 42)
  assert.strictEqual(kmlColorToMapInfo(null, 42), 42)
  assert.strictEqual(kmlColorToMapInfo('', 42), 42)
  assert.strictEqual(kmlColorToMapInfo('xyz', 42), 42)
  assert.strictEqual(kmlColorToMapInfo('ffff', 42), 42)
})

test('mapInfoColorToHex formats decimal as #RRGGBB', () => {
  assert.strictEqual(mapInfoColorToHex(0xaa0000), '#AA0000')
  assert.strictEqual(mapInfoColorToHex(0), '#000000')
  assert.strictEqual(mapInfoColorToHex(0xffffff), '#FFFFFF')
})

test('kmlColorToHex composes both conversions', () => {
  assert.strictEqual(kmlColorToHex('ff0000aa'), '#AA0000')
  assert.strictEqual(kmlColorToHex('bogus'), null)
})
