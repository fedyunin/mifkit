const test = require('node:test')
const assert = require('node:assert')

const { coerceOptions } = require('../../src/cli/coerceOptions')

const SCHEMA = [
  { key: 'flat', type: 'boolean', default: false },
  { key: 'charset', type: 'enum', values: ['A', 'B'], default: 'A' },
  { key: 'width', type: 'number', default: 1 },
  { key: 'name', type: 'string', default: '' },
]

test('coerceOptions parses booleans from --no-* / --key shorthand', () => {
  const { options, errors } = coerceOptions(SCHEMA, { flat: true })
  assert.deepStrictEqual(errors, [])
  assert.strictEqual(options.flat, true)

  const off = coerceOptions(SCHEMA, { flat: false })
  assert.strictEqual(off.options.flat, false)
})

test('coerceOptions parses boolean from string aliases (true/false/yes/no/1/0)', () => {
  assert.strictEqual(coerceOptions(SCHEMA, { flat: 'true' }).options.flat, true)
  assert.strictEqual(coerceOptions(SCHEMA, { flat: 'YES' }).options.flat, true)
  assert.strictEqual(coerceOptions(SCHEMA, { flat: '1' }).options.flat, true)
  assert.strictEqual(coerceOptions(SCHEMA, { flat: 'no' }).options.flat, false)
  assert.strictEqual(coerceOptions(SCHEMA, { flat: '0' }).options.flat, false)
})

test('coerceOptions parses numbers and reports non-numeric input', () => {
  const ok = coerceOptions(SCHEMA, { width: '5' })
  assert.deepStrictEqual(ok.errors, [])
  assert.strictEqual(ok.options.width, 5)

  const bad = coerceOptions(SCHEMA, { width: 'abc' })
  assert.match(bad.errors[0], /expects a number/)
})

test('coerceOptions accepts string and enum values as plain strings', () => {
  const { options, errors } = coerceOptions(SCHEMA, { charset: 'B', name: 'hello' })
  assert.deepStrictEqual(errors, [])
  assert.strictEqual(options.charset, 'B')
  assert.strictEqual(options.name, 'hello')
})

test('coerceOptions errors on a string flag passed without value (--key but no =)', () => {
  const { errors } = coerceOptions(SCHEMA, { charset: true })
  assert.match(errors[0], /expects a value/)
})

test('coerceOptions reports unknown options', () => {
  const { errors } = coerceOptions(SCHEMA, { bogus: 'x' })
  assert.match(errors[0], /Unknown option --bogus/)
})

test('coerceOptions ignores reserved and meta flags', () => {
  const reserved = new Set(['output', 'o'])
  const { options, errors } = coerceOptions(
    SCHEMA,
    { output: './out', o: './out', help: true, version: true, flat: true },
    reserved,
  )
  assert.deepStrictEqual(errors, [])
  assert.deepStrictEqual(options, { flat: true })
})
