const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const ExcelJS = require('exceljs')
const iconv = require('iconv-lite')

const { runConversion } = require('../../src/core/convert')

const FIXTURES = path.join(__dirname, '..', 'fixtures')

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mifkit-it-'))
}

function copyFixture(srcName, dstDir, dstName) {
  fs.copyFileSync(path.join(FIXTURES, srcName), path.join(dstDir, dstName || srcName))
}

function baseConfig(overrides) {
  return {
    inputMode: 'folder',
    inputFolder: '',
    outputFolder: '',
    selectedFiles: [],
    recursive: false,
    paintRows: true,
    skipBlack: true,
    combineIntoOneWorkbook: false,
    includeCsv: false,
    includeColorColumn: true,
    freezeHeader: false,
    autofilter: false,
    ...overrides,
  }
}

test('runConversion produces xlsx with color column and correct row fills', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()
  copyFixture('simple-colors.mif', workDir)
  copyFixture('simple-colors.mid', workDir)

  const summary = await runConversion(
    baseConfig({ inputFolder: workDir, outputFolder: outDir }),
    () => {},
  )

  assert.strictEqual(summary.processed, 1)
  assert.strictEqual(summary.skipped, 0)
  assert.deepStrictEqual(summary.errors, [])

  const xlsxPath = path.join(outDir, 'simple-colors.xlsx')
  assert.ok(fs.existsSync(xlsxPath))

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(xlsxPath)
  const sheet = workbook.worksheets[0]

  assert.deepStrictEqual(
    sheet.getRow(1).values.slice(1),
    ['name', 'code', 'note', 'region_color_hex'],
  )

  const redRow = sheet.getRow(2)
  assert.strictEqual(redRow.getCell(4).value, '#FF0000')
  assert.strictEqual(redRow.getCell(1).fill.fgColor.argb, 'FFFF0000')

  const blackRow = sheet.getRow(3)
  assert.strictEqual(blackRow.getCell(4).value, '#000000')
  assert.strictEqual(blackRow.getCell(1).fill, undefined)

  const greenRow = sheet.getRow(4)
  assert.strictEqual(greenRow.getCell(4).value, '#00FF00')
  assert.strictEqual(greenRow.getCell(3).value, 'Has a "quote" inside')
})

test('runConversion with includeColorColumn=false drops the column from xlsx and csv', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()
  copyFixture('simple-colors.mif', workDir)
  copyFixture('simple-colors.mid', workDir)

  await runConversion(
    baseConfig({
      inputFolder: workDir,
      outputFolder: outDir,
      includeCsv: true,
      includeColorColumn: false,
    }),
    () => {},
  )

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(outDir, 'simple-colors.xlsx'))
  const sheet = workbook.worksheets[0]
  assert.deepStrictEqual(sheet.getRow(1).values.slice(1), ['name', 'code', 'note'])

  // row fill still works without the color column
  assert.strictEqual(sheet.getRow(2).getCell(1).fill.fgColor.argb, 'FFFF0000')

  const csv = fs.readFileSync(path.join(outDir, 'simple-colors.csv'), 'utf8')
  assert.ok(!csv.includes('region_color_hex'), 'csv should not include color header')
  assert.ok(!csv.includes('#FF0000'), 'csv should not include color values')
})

test('runConversion decodes windows-1251 encoded MIF/MID', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()

  const mif = [
    'Version 300',
    'Charset "WindowsCyrillic"',
    'Delimiter ","',
    'Columns 2',
    '  name Char(50)',
    '  region Char(50)',
    'Data',
    '',
    'Region 1',
    '  5',
    '  0 0',
    '  10 0',
    '  10 10',
    '  0 10',
    '  0 0',
    '    Pen (1,2,0)',
    '    Brush (2,16711680,16777215)',
    '  Center 5 5',
    '',
  ].join('\n')
  const mid = '"Москва","Центр"\n'

  fs.writeFileSync(path.join(workDir, 'ru.mif'), iconv.encode(mif, 'windows-1251'))
  fs.writeFileSync(path.join(workDir, 'ru.mid'), iconv.encode(mid, 'windows-1251'))

  await runConversion(
    baseConfig({ inputFolder: workDir, outputFolder: outDir, paintRows: false }),
    () => {},
  )

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(outDir, 'ru.xlsx'))
  const sheet = workbook.worksheets[0]
  assert.deepStrictEqual(sheet.getRow(2).values.slice(1), ['Москва', 'Центр', '#FF0000'])
})

test('runConversion combines multiple inputs into a single workbook when requested', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()
  copyFixture('simple-colors.mif', workDir, 'alpha.mif')
  copyFixture('simple-colors.mid', workDir, 'alpha.mid')
  copyFixture('mixed-geometry.mif', workDir, 'beta.mif')
  copyFixture('mixed-geometry.mid', workDir, 'beta.mid')

  const summary = await runConversion(
    baseConfig({
      inputFolder: workDir,
      outputFolder: outDir,
      combineIntoOneWorkbook: true,
      paintRows: false,
    }),
    () => {},
  )

  assert.strictEqual(summary.processed, 2)

  const combined = path.join(outDir, 'mapinfo-converted.xlsx')
  assert.ok(fs.existsSync(combined), 'default combined workbook name should be used')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(combined)
  const names = workbook.worksheets.map((s) => s.name).sort()
  assert.deepStrictEqual(names, ['alpha', 'beta'])
})

test('runConversion uses a custom combined workbook filename when provided', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()
  copyFixture('simple-colors.mif', workDir, 'alpha.mif')
  copyFixture('simple-colors.mid', workDir, 'alpha.mid')

  await runConversion(
    baseConfig({
      inputFolder: workDir,
      outputFolder: outDir,
      combineIntoOneWorkbook: true,
      combinedName: '2026 regions',
      paintRows: false,
    }),
    () => {},
  )

  assert.ok(fs.existsSync(path.join(outDir, '2026 regions.xlsx')))
  assert.ok(!fs.existsSync(path.join(outDir, 'mapinfo-converted.xlsx')))
})

test('runConversion logs a warning when brush count does not match row count', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()
  copyFixture('mixed-geometry.mif', workDir)
  copyFixture('mixed-geometry.mid', workDir)

  const logs = []
  await runConversion(
    baseConfig({ inputFolder: workDir, outputFolder: outDir, paintRows: false }),
    (msg) => logs.push(msg),
  )

  // mixed-geometry has 3 objects and 3 MID rows, so there should be NO warning for this fixture
  const warnings = logs.filter((l) => /^WARN\b/.test(l))
  assert.deepStrictEqual(warnings, [])
})

test('runConversion throws when no MIF files are found', async () => {
  const workDir = mkTmp()
  const outDir = mkTmp()

  await assert.rejects(
    () => runConversion(
      baseConfig({ inputFolder: workDir, outputFolder: outDir }),
      () => {},
    ),
    /No valid MIF files found/,
  )
})
