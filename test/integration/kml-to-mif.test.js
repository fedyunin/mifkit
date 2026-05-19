const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const zlib = require('node:zlib')
const iconv = require('iconv-lite')

const converters = require('../../src/core/converters')

const FIXTURES = path.join(__dirname, '..', 'fixtures')
const SAMPLE_KML = path.join(FIXTURES, 'sample.kml')

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mifkit-kml-'))
}

function readCp1251(filePath) {
  return iconv.decode(fs.readFileSync(filePath), 'windows-1251')
}

test('kml-to-mif converter is registered with the expected option schema', () => {
  const c = converters.get('kml-to-mif')
  assert.ok(c)
  assert.deepStrictEqual(c.inputs.extensions, ['.kml', '.kmz'])
  assert.deepStrictEqual(c.outputs.extensions, ['.mif', '.mid'])
  const optionKeys = c.options.map((o) => o.key).sort()
  assert.deepStrictEqual(optionKeys, ['charset', 'flat', 'recursive'])
})

test('kml-to-mif produces MIF/MID with resolved styles and folder hierarchy', async () => {
  const outDir = mkTmp()
  const c = converters.get('kml-to-mif')
  const result = await c.run(
    {
      inputs: [SAMPLE_KML],
      output: outDir,
      options: converters.applyDefaults(c, {}),
    },
    { log: () => {}, progress: () => {} },
  )

  assert.strictEqual(result.stats.processed, 1)
  assert.strictEqual(result.stats.skipped, 0)
  assert.deepStrictEqual(result.stats.errors, [])

  const layerAMif = path.join(outDir, 'Layer_A.mif')
  const layerAMid = path.join(outDir, 'Layer_A.mid')
  const subMif = path.join(outDir, 'Layer_A', 'Sublayer.mif')
  const subMid = path.join(outDir, 'Layer_A', 'Sublayer.mid')

  assert.ok(fs.existsSync(layerAMif), 'Layer_A.mif should exist')
  assert.ok(fs.existsSync(layerAMid))
  assert.ok(fs.existsSync(subMif), 'Layer_A/Sublayer.mif should exist')
  assert.ok(fs.existsSync(subMid))

  const layerAMifText = readCp1251(layerAMif)
  // Red region (outlined, no fill): Pen color from ff0000aa -> 0xAA0000 (11141120), Brush pattern 1
  assert.match(layerAMifText, /Pen \(1,2,11141120\)/)
  assert.match(layerAMifText, /Brush \(1,11141120,16777215\)/)
  // Blue region (filled): Brush pattern 2 with poly color from ffff0000 -> 0x0000FF (255)
  assert.match(layerAMifText, /Pen \(1,2,0\)/)
  assert.match(layerAMifText, /Brush \(2,255,16777215\)/)
  // CoordSys + Columns header present
  assert.match(layerAMifText, /CoordSys Earth Projection 1, 104/)
  assert.match(layerAMifText, /Columns 4/)

  const layerAMidText = readCp1251(layerAMid)
  assert.match(layerAMidText, /"Red Region","outlined polygon","redOutline","Layer A"/)
  assert.match(layerAMidText, /"Blue Region","","blueFilled","Layer A"/)

  const subMifText = readCp1251(subMif)
  // Line with width 2 from redOutline style
  assert.match(subMifText, /Pline 3/)
  assert.match(subMifText, /Pen \(2,2,11141120\)/)
  // Point with icon color FFFF00 -> 16776960
  assert.match(subMifText, /Point 70 80/)
  assert.match(subMifText, /Symbol \(35,16776960,12\)/)

  const subMidText = readCp1251(subMid)
  assert.match(subMidText, /"Track","","redOutline","Layer A \/ Sublayer"/)
  assert.match(subMidText, /"Marker","","blueFilled","Layer A \/ Sublayer"/)
})

test('kml-to-mif with flat=true produces a single directory with prefixed names', async () => {
  const outDir = mkTmp()
  const c = converters.get('kml-to-mif')
  await c.run(
    {
      inputs: [SAMPLE_KML],
      output: outDir,
      options: converters.applyDefaults(c, { flat: true }),
    },
    { log: () => {}, progress: () => {} },
  )

  const files = fs.readdirSync(outDir).sort()
  assert.deepStrictEqual(files, [
    'Layer_A.mid',
    'Layer_A.mif',
    'Layer_A__Sublayer.mid',
    'Layer_A__Sublayer.mif',
  ])
})

test('kml-to-mif handles KMZ archives', async () => {
  // Build a tiny KMZ from the sample KML
  const kmlBuffer = fs.readFileSync(SAMPLE_KML)
  const kmzBuffer = buildKmz('doc.kml', kmlBuffer)
  const inputDir = mkTmp()
  const kmzPath = path.join(inputDir, 'sample.kmz')
  fs.writeFileSync(kmzPath, kmzBuffer)

  const outDir = mkTmp()
  const c = converters.get('kml-to-mif')
  const result = await c.run(
    {
      inputs: [kmzPath],
      output: outDir,
      options: converters.applyDefaults(c, {}),
    },
    { log: () => {}, progress: () => {} },
  )

  assert.strictEqual(result.stats.processed, 1)
  assert.ok(fs.existsSync(path.join(outDir, 'Layer_A.mif')))
})

test('kml-to-mif charset=Neutral writes UTF-8', async () => {
  const outDir = mkTmp()
  const c = converters.get('kml-to-mif')
  await c.run(
    {
      inputs: [SAMPLE_KML],
      output: outDir,
      options: converters.applyDefaults(c, { charset: 'Neutral' }),
    },
    { log: () => {}, progress: () => {} },
  )

  const mifText = fs.readFileSync(path.join(outDir, 'Layer_A.mif'), 'utf8')
  assert.match(mifText, /Charset "Neutral"/)
})

// --- KMZ builder for tests -------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildKmz(name, content) {
  const nameBuf = Buffer.from(name, 'utf8')
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  const compressed = zlib.deflateRawSync(data)
  const crc = crc32(data)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0, 6)
  local.writeUInt16LE(8, 8)
  local.writeUInt16LE(0, 10)
  local.writeUInt16LE(0, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28)

  const cd = Buffer.alloc(46)
  cd.writeUInt32LE(0x02014b50, 0)
  cd.writeUInt16LE(20, 4)
  cd.writeUInt16LE(20, 6)
  cd.writeUInt16LE(0, 8)
  cd.writeUInt16LE(8, 10)
  cd.writeUInt16LE(0, 12)
  cd.writeUInt16LE(0, 14)
  cd.writeUInt32LE(crc, 16)
  cd.writeUInt32LE(compressed.length, 20)
  cd.writeUInt32LE(data.length, 24)
  cd.writeUInt16LE(nameBuf.length, 28)

  const cdOffset = local.length + nameBuf.length + compressed.length
  const cdSize = cd.length + nameBuf.length

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cdSize, 12)
  eocd.writeUInt32LE(cdOffset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([local, nameBuf, compressed, cd, nameBuf, eocd])
}
