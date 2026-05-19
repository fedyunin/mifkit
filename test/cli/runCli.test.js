const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runCli } = require('../../src/cli')

const FIXTURES = path.join(__dirname, '..', 'fixtures')

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mifkit-cli-'))
}

function captureIO() {
  const out = []
  const err = []
  return {
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    stdout: () => out.join('\n'),
    stderr: () => err.join('\n'),
  }
}

test('runCli with no args prints top-level help', async () => {
  const io = captureIO()
  const code = await runCli([], io)
  assert.strictEqual(code, 0)
  assert.match(io.stdout(), /MifKit/)
  assert.match(io.stdout(), /list/)
  assert.match(io.stdout(), /help/)
  assert.match(io.stdout(), /convert/)
})

test('runCli --version prints package version only', async () => {
  const io = captureIO()
  const code = await runCli(['--version'], io)
  assert.strictEqual(code, 0)
  assert.match(io.stdout(), /^\d+\.\d+\.\d+$/m)
})

test('runCli list shows every registered converter', async () => {
  const io = captureIO()
  const code = await runCli(['list'], io)
  assert.strictEqual(code, 0)
  assert.match(io.stdout(), /mif-to-xlsx/)
  assert.match(io.stdout(), /kml-to-mif/)
})

test('runCli help <converter> shows that converter\'s schema', async () => {
  const io = captureIO()
  const code = await runCli(['help', 'kml-to-mif'], io)
  assert.strictEqual(code, 0)
  assert.match(io.stdout(), /kml-to-mif/)
  assert.match(io.stdout(), /--flat/)
  assert.match(io.stdout(), /--charset/)
})

test('runCli help <unknown> exits 2 and lists alternatives', async () => {
  const io = captureIO()
  const code = await runCli(['help', 'no-such-converter'], io)
  assert.strictEqual(code, 2)
  assert.match(io.stderr(), /Unknown converter/)
  assert.match(io.stderr(), /mif-to-xlsx/)
})

test('runCli convert without args exits 2 with a hint', async () => {
  const io = captureIO()
  const code = await runCli(['convert'], io)
  assert.strictEqual(code, 2)
  assert.match(io.stderr(), /Missing converter id/)
})

test('runCli convert without --output exits 2', async () => {
  const io = captureIO()
  const code = await runCli(['convert', 'kml-to-mif', '/tmp/in.kmz'], io)
  assert.strictEqual(code, 2)
  assert.match(io.stderr(), /Missing --output/)
})

test('runCli convert rejects unknown options before invoking the converter', async () => {
  const io = captureIO()
  const code = await runCli(
    ['convert', 'kml-to-mif', '/tmp/in.kmz', '--output=/tmp/out', '--bogus=1'],
    io,
  )
  assert.strictEqual(code, 2)
  assert.match(io.stderr(), /Unknown option --bogus/)
})

test('runCli convert kml-to-mif end-to-end produces MIF/MID', async () => {
  const inputDir = mkTmp()
  const outputDir = mkTmp()
  fs.copyFileSync(path.join(FIXTURES, 'sample.kml'), path.join(inputDir, 'sample.kml'))

  const io = captureIO()
  const code = await runCli(
    [
      'convert',
      'kml-to-mif',
      path.join(inputDir, 'sample.kml'),
      `--output=${outputDir}`,
      '--flat=true',
      '--charset=Neutral',
    ],
    io,
  )

  assert.strictEqual(code, 0, `expected exit 0, got ${code}, stderr: ${io.stderr()}`)
  const outputs = fs.readdirSync(outputDir).sort()
  assert.deepStrictEqual(outputs, [
    'Layer_A.mid',
    'Layer_A.mif',
    'Layer_A__Sublayer.mid',
    'Layer_A__Sublayer.mif',
  ])
  // stdout lists output paths
  const outputLines = io.stdout().split('\n').filter(Boolean)
  assert.ok(outputLines.length >= 4)
})
