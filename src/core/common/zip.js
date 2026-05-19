const zlib = require('zlib')

const SIG_LOCAL = 0x04034b50
const SIG_CDIR = 0x02014b50
const SIG_EOCD = 0x06054b50
const SIG_EOCD64 = 0x06064b50

const MAX_EOCD_COMMENT = 0xffff
const EOCD_FIXED_SIZE = 22

/**
 * Read a ZIP archive into an in-memory directory of entries.
 *
 * Supports stored (method 0) and deflate (method 8) compression — enough for
 * KMZ archives and ZIP-bundled Shapefiles. ZIP64 is detected and treated as
 * unsupported (most KMZ/SHP bundles are well under 4 GB).
 *
 * @param {Buffer} buffer
 * @returns {{ entries: Array<{ name: string, size: number, extract: () => Buffer }> }}
 */
function readZip(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('readZip expects a Buffer')
  }

  const eocd = findEOCD(buffer)

  if (eocd.method === 'zip64') {
    throw new Error('ZIP64 archives are not supported')
  }

  const entries = readCentralDirectory(buffer, eocd.cdOffset, eocd.totalEntries)
  return {
    entries: entries.map((entry) => ({
      name: entry.name,
      size: entry.uncompressedSize,
      extract: () => extractEntry(buffer, entry),
    })),
  }
}

function findEOCD(buffer) {
  const minOffset = Math.max(0, buffer.length - EOCD_FIXED_SIZE - MAX_EOCD_COMMENT)

  for (let i = buffer.length - EOCD_FIXED_SIZE; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) {
      const totalEntries = buffer.readUInt16LE(i + 10)
      const cdOffset = buffer.readUInt32LE(i + 16)

      if (totalEntries === 0xffff || cdOffset === 0xffffffff) {
        return { method: 'zip64' }
      }

      return { method: 'standard', totalEntries, cdOffset }
    }

    if (buffer.readUInt32LE(i) === SIG_EOCD64) {
      return { method: 'zip64' }
    }
  }

  throw new Error('End of central directory not found — not a ZIP archive')
}

function readCentralDirectory(buffer, cdOffset, totalEntries) {
  const entries = []
  let cursor = cdOffset

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(cursor) !== SIG_CDIR) {
      throw new Error(`Central directory record corrupted at offset ${cursor}`)
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.slice(cursor + 46, cursor + 46 + nameLength).toString('utf8')

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new Error(`ZIP64 entry "${name}" is not supported`)
    }

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    })

    cursor += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

function extractEntry(buffer, entry) {
  const localOffset = entry.localHeaderOffset

  if (buffer.readUInt32LE(localOffset) !== SIG_LOCAL) {
    throw new Error(`Local file header missing for ${entry.name}`)
  }

  const nameLength = buffer.readUInt16LE(localOffset + 26)
  const extraLength = buffer.readUInt16LE(localOffset + 28)
  const dataOffset = localOffset + 30 + nameLength + extraLength
  const compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize)

  if (entry.compressionMethod === 0) {
    return Buffer.from(compressed)
  }

  if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(compressed)
  }

  throw new Error(`Unsupported compression method ${entry.compressionMethod} for ${entry.name}`)
}

module.exports = {
  readZip,
}
