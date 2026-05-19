const test = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')

const { readZip } = require('../../src/core/common/zip')

/**
 * Build a minimal valid ZIP archive in memory. Supports one entry per call.
 * Used to exercise readZip without checking in binary fixtures.
 */
function buildZip(name, content, { compress } = { compress: true }) {
  const nameBuf = Buffer.from(name, 'utf8')
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  const compressed = compress ? zlib.deflateRawSync(data) : data
  const crc = crc32(data)
  const method = compress ? 8 : 0

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0, 6)
  local.writeUInt16LE(method, 8)
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
  cd.writeUInt16LE(method, 10)
  cd.writeUInt16LE(0, 12)
  cd.writeUInt16LE(0, 14)
  cd.writeUInt32LE(crc, 16)
  cd.writeUInt32LE(compressed.length, 20)
  cd.writeUInt32LE(data.length, 24)
  cd.writeUInt16LE(nameBuf.length, 28)
  cd.writeUInt16LE(0, 30)
  cd.writeUInt16LE(0, 32)
  cd.writeUInt16LE(0, 34)
  cd.writeUInt16LE(0, 36)
  cd.writeUInt32LE(0, 38)
  cd.writeUInt32LE(0, 42)

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

test('readZip extracts a deflate-compressed entry', () => {
  const zip = buildZip('doc.kml', '<?xml version="1.0"?><kml/>')
  const { entries } = readZip(zip)
  assert.strictEqual(entries.length, 1)
  assert.strictEqual(entries[0].name, 'doc.kml')
  assert.strictEqual(entries[0].extract().toString('utf8'), '<?xml version="1.0"?><kml/>')
})

test('readZip extracts an uncompressed (stored) entry', () => {
  const zip = buildZip('plain.txt', 'hello world', { compress: false })
  const { entries } = readZip(zip)
  assert.strictEqual(entries[0].extract().toString('utf8'), 'hello world')
})

test('readZip rejects non-ZIP buffers', () => {
  assert.throws(() => readZip(Buffer.from('not a zip')), /not a ZIP archive/)
})
