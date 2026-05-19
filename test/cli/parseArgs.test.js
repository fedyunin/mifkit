const test = require('node:test')
const assert = require('node:assert')

const { parseArgs } = require('../../src/cli/parseArgs')

test('parseArgs splits command, positional, and flags', () => {
  const result = parseArgs(['convert', 'kml-to-mif', 'a.kmz', 'b.kmz', '--output=./out', '--flat'])
  assert.strictEqual(result.command, 'convert')
  assert.deepStrictEqual(result.positional, ['kml-to-mif', 'a.kmz', 'b.kmz'])
  assert.deepStrictEqual(result.flags, { output: './out', flat: true })
})

test('parseArgs treats --no-key as false', () => {
  const result = parseArgs(['convert', 'mif-to-xlsx', './in', '--output=./out', '--no-paint-rows', '--skip-black'])
  assert.strictEqual(result.flags['paint-rows'], false)
  assert.strictEqual(result.flags['skip-black'], true)
})

test('parseArgs parses --key=value with embedded equals', () => {
  const result = parseArgs(['--combined-name=2026 regions=production'])
  assert.strictEqual(result.flags['combined-name'], '2026 regions=production')
})

test('parseArgs treats -h, --help, -v, --version as known flags', () => {
  assert.deepStrictEqual(parseArgs(['-h']).flags, { help: true })
  assert.deepStrictEqual(parseArgs(['--help']).flags, { help: true })
  assert.deepStrictEqual(parseArgs(['-v']).flags, { version: true })
  assert.deepStrictEqual(parseArgs(['--version']).flags, { version: true })
})

test('parseArgs returns an empty command when argv is empty', () => {
  const result = parseArgs([])
  assert.strictEqual(result.command, '')
  assert.deepStrictEqual(result.positional, [])
  assert.deepStrictEqual(result.flags, {})
})
