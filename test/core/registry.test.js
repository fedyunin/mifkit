const test = require('node:test')
const assert = require('node:assert')

const registry = require('../../src/core/converters/registry')

test.beforeEach(() => {
  registry.clear()
})

test('register rejects converters missing required fields', () => {
  assert.throws(() => registry.register(null), /must be an object/)
  assert.throws(() => registry.register({}), /id must be a non-empty string/)
  assert.throws(() => registry.register({ id: 'CamelCase' }), /kebab-case/)
  assert.throws(() => registry.register({ id: 'no-name' }), /must have a name/)
  assert.throws(
    () => registry.register({ id: 'partial', name: 'x' }),
    /inputs.extensions/,
  )
})

test('register stores a valid converter and forbids duplicate ids', () => {
  const converter = {
    id: 'noop',
    name: 'Noop',
    description: '',
    inputs: { extensions: ['.x'], type: 'file' },
    outputs: { extensions: ['.y'], type: 'folder' },
    options: [],
    run: async () => ({ outputs: [], stats: { processed: 0, skipped: 0, errors: [] } }),
  }

  registry.register(converter)
  assert.strictEqual(registry.get('noop').id, 'noop')
  assert.strictEqual(registry.list().length, 1)
  assert.throws(() => registry.register(converter), /already registered/)
})

test('applyDefaults fills only unspecified keys and preserves explicit values', () => {
  const converter = {
    id: 'opts',
    name: 'Options test',
    inputs: { extensions: ['.x'], type: 'file' },
    outputs: { extensions: ['.y'], type: 'folder' },
    options: [
      { key: 'a', type: 'boolean', default: true },
      { key: 'b', type: 'string', default: 'fallback' },
      { key: 'c', type: 'number', default: 5 },
    ],
    run: async () => ({}),
  }

  const merged = registry.applyDefaults(converter, { b: 'explicit', extra: 'kept' })
  assert.deepStrictEqual(merged, { a: true, b: 'explicit', c: 5, extra: 'kept' })
})

test('validateOptions reports type and enum violations', () => {
  const converter = {
    id: 'val',
    name: 'Validation',
    inputs: { extensions: ['.x'], type: 'file' },
    outputs: { extensions: ['.y'], type: 'folder' },
    options: [
      { key: 'flag', type: 'boolean', default: true },
      { key: 'mode', type: 'enum', values: ['a', 'b'], default: 'a' },
      { key: 'count', type: 'number', default: 1, min: 0, max: 10 },
    ],
    run: async () => ({}),
  }

  const { errors } = registry.validateOptions(converter, { flag: 'yes', mode: 'z', count: 99 })
  assert.deepStrictEqual(errors.sort(), [
    'Option "count" must be <= 10',
    'Option "flag" must be boolean',
    'Option "mode" must be one of: a, b',
  ].sort())

  const ok = registry.validateOptions(converter, { flag: false, mode: 'b', count: 3 })
  assert.deepStrictEqual(ok.errors, [])
  assert.deepStrictEqual(ok.merged, { flag: false, mode: 'b', count: 3 })
})

test('mif-to-xlsx converter is registered by default via the index entry point', () => {
  registry.clear()
  delete require.cache[require.resolve('../../src/core/converters')]
  const converters = require('../../src/core/converters')
  const found = converters.get('mif-to-xlsx')
  assert.ok(found, 'mif-to-xlsx must be in the default registry')
  assert.strictEqual(found.inputs.extensions[0], '.mif')
  assert.ok(found.outputs.extensions.includes('.xlsx'))
  assert.ok(typeof found.run === 'function')
})
