const pkg = require('../../package.json')
const converters = require('../core/converters')
const { parseArgs } = require('./parseArgs')
const { coerceOptions } = require('./coerceOptions')
const { topHelp, listConverters, converterHelp } = require('./format')

const RESERVED = new Set(['output', 'o', 'help', 'version'])

/**
 * Run the CLI with the given argv. Pure with respect to side effects: all
 * output goes through the injected `out` / `err` writers, so tests can call
 * this directly without spawning a subprocess.
 *
 * @param {string[]} argv                          process.argv.slice(2)
 * @param {Object} [io]
 * @param {(s: string) => void} [io.out]           stdout writer
 * @param {(s: string) => void} [io.err]           stderr writer
 * @returns {Promise<number>}                      exit code
 */
async function runCli(argv, io = {}) {
  const out = io.out || ((s) => process.stdout.write(`${s}\n`))
  const err = io.err || ((s) => process.stderr.write(`${s}\n`))

  const { command, positional, flags } = parseArgs(argv)

  if (flags.version) {
    out(pkg.version)
    return 0
  }

  if (!command || flags.help) {
    if (command === 'help') {
      return runHelp(positional, out, err)
    }
    out(topHelp())
    return command ? 0 : 0
  }

  switch (command) {
    case 'list':
      return runList(out)
    case 'help':
      return runHelp(positional, out, err)
    case 'convert':
      return runConvert(positional, flags, out, err)
    default:
      err(`Unknown command: ${command}`)
      err('')
      err(topHelp())
      return 2
  }
}

function runList(out) {
  out(listConverters(converters.list()))
  return 0
}

function runHelp(positional, out, err) {
  const [id] = positional
  if (!id) {
    out(topHelp())
    return 0
  }
  const converter = converters.get(id)
  if (!converter) {
    err(`Unknown converter: ${id}`)
    err('')
    err('Available:')
    err(listConverters(converters.list()))
    return 2
  }
  out(converterHelp(converter))
  return 0
}

async function runConvert(positional, flags, out, err) {
  const [converterId, ...inputs] = positional
  if (!converterId) {
    err('Missing converter id')
    err('Usage: mifkit convert <converter> <input...> --output=<dir> [options]')
    return 2
  }
  const converter = converters.get(converterId)
  if (!converter) {
    err(`Unknown converter: ${converterId}`)
    err('')
    err('Available:')
    err(listConverters(converters.list()))
    return 2
  }
  if (!inputs.length) {
    err(`Missing input path(s) for ${converterId}`)
    err(`Try: mifkit help ${converterId}`)
    return 2
  }

  const output = flags.output || flags.o
  if (!output || typeof output !== 'string') {
    err('Missing --output=<dir>')
    return 2
  }

  const { options: rawOptions, errors: coerceErrors } = coerceOptions(
    [...converter.options],
    flags,
    RESERVED,
  )
  if (coerceErrors.length) {
    for (const e of coerceErrors) err(e)
    return 2
  }

  const validated = converters.validateOptions(converter, rawOptions)
  if (validated.errors.length) {
    for (const e of validated.errors) err(e)
    return 2
  }

  const ctx = {
    log: (msg) => err(msg),
    progress: () => {},
  }

  try {
    const result = await converter.run(
      { inputs, output, options: validated.merged },
      ctx,
    )

    const stats = result.stats || { processed: 0, skipped: 0, errors: [] }
    err(`Processed: ${stats.processed}, Skipped: ${stats.skipped}`)

    for (const o of result.outputs || []) {
      out(o)
    }

    if (stats.errors && stats.errors.length) {
      for (const e of stats.errors) {
        err(`  ${e.file}: ${e.error}`)
      }
      return 1
    }
    return 0
  } catch (error) {
    err(`FATAL: ${error && error.message ? error.message : String(error)}`)
    return 1
  }
}

module.exports = { runCli }
