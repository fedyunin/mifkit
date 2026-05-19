const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const { writeCsvFile } = require('../../src/core/csv')

function tmpFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mifkit-csv-'))
  return path.join(dir, name)
}

test('writeCsvFile appends region_color_hex by default', () => {
  const file = tmpFile('out.csv')
  writeCsvFile(file, ['a', 'b'], [['1', '2']], ['#FF0000'])
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'a,b,region_color_hex\n1,2,#FF0000\n')
})

test('writeCsvFile omits region_color_hex when includeColorColumn is false', () => {
  const file = tmpFile('out.csv')
  writeCsvFile(file, ['a', 'b'], [['1', '2']], ['#FF0000'], { includeColorColumn: false })
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'a,b\n1,2\n')
})

test('writeCsvFile uses custom color column header when colorColumnName is provided', () => {
  const file = tmpFile('out.csv')
  writeCsvFile(file, ['a', 'b'], [['1', '2']], ['#FF0000'], { colorColumnName: 'Fill' })
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'a,b,Fill\n1,2,#FF0000\n')
})

test('writeCsvFile escapes commas, double quotes and newlines', () => {
  const file = tmpFile('out.csv')
  writeCsvFile(
    file,
    ['name', 'note'],
    [
      ['a, b', 'plain'],
      ['has "quotes"', 'multi\nline'],
    ],
    ['', ''],
    { includeColorColumn: false },
  )
  assert.strictEqual(
    fs.readFileSync(file, 'utf8'),
    'name,note\n"a, b",plain\n"has ""quotes""","multi\nline"\n',
  )
})

test('writeCsvFile writes empty string for missing color values', () => {
  const file = tmpFile('out.csv')
  writeCsvFile(file, ['a'], [['1'], ['2']], ['#FF0000'])
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'a,region_color_hex\n1,#FF0000\n2,\n')
})
