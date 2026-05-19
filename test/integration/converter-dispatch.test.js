const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const ExcelJS = require('exceljs')

const converters = require('../../src/core/converters')

const FIXTURES = path.join(__dirname, '..', 'fixtures')

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mifkit-dispatch-'))
}

function copyFixture(name, dstDir) {
  fs.copyFileSync(path.join(FIXTURES, name), path.join(dstDir, name))
}

test('mif-to-xlsx converter dispatched through the registry produces an xlsx', async () => {
  const inputDir = mkTmp()
  const outputDir = mkTmp()
  copyFixture('simple-colors.mif', inputDir)
  copyFixture('simple-colors.mid', inputDir)

  const converter = converters.get('mif-to-xlsx')
  assert.ok(converter)

  const { merged } = converters.validateOptions(converter, {
    paintRows: true,
    skipBlack: true,
    includeColorColumn: true,
  })

  const logs = []
  const result = await converter.run(
    { inputs: [inputDir], output: outputDir, options: merged },
    { log: (m) => logs.push(m), progress: () => {} },
  )

  assert.strictEqual(result.stats.processed, 1)
  assert.strictEqual(result.stats.skipped, 0)
  assert.deepStrictEqual(result.stats.errors, [])

  const xlsxPath = path.join(outputDir, 'simple-colors.xlsx')
  assert.ok(fs.existsSync(xlsxPath))
  assert.ok(result.outputs.includes(xlsxPath))

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(xlsxPath)
  const sheet = wb.worksheets[0]
  assert.deepStrictEqual(
    sheet.getRow(1).values.slice(1),
    ['name', 'code', 'note', 'region_color_hex'],
  )
})

test('mif-to-xlsx converter accepts explicit file list as inputs', async () => {
  const inputDir = mkTmp()
  const outputDir = mkTmp()
  copyFixture('simple-colors.mif', inputDir)
  copyFixture('simple-colors.mid', inputDir)

  const converter = converters.get('mif-to-xlsx')
  const result = await converter.run(
    {
      inputs: [path.join(inputDir, 'simple-colors.mif')],
      output: outputDir,
      options: converters.applyDefaults(converter, { paintRows: false }),
    },
    { log: () => {}, progress: () => {} },
  )

  assert.strictEqual(result.stats.processed, 1)
  assert.ok(fs.existsSync(path.join(outputDir, 'simple-colors.xlsx')))
})
