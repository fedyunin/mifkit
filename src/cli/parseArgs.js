/**
 * Minimal CLI argument parser, schema-agnostic.
 *
 * Conventions:
 *   --key=value   key set to "value"
 *   --key         key set to true (boolean shorthand)
 *   --no-key      key set to false
 *   -h, --help    parsed as { help: true }
 *   -v, --version parsed as { version: true }
 *
 * Anything not starting with "-" becomes positional. The first positional is
 * exposed as `command`; the rest stay in `positional`.
 *
 * @param {string[]} argv
 * @returns {{ command: string, positional: string[], flags: Object }}
 */
function parseArgs(argv) {
  const positional = []
  const flags = {}
  const args = Array.isArray(argv) ? argv.slice() : []

  for (const arg of args) {
    if (arg === undefined || arg === null) continue
    const token = String(arg)

    if (token === '-h' || token === '--help') {
      flags.help = true
      continue
    }
    if (token === '-v' || token === '--version') {
      flags.version = true
      continue
    }
    if (token.startsWith('--')) {
      const body = token.slice(2)
      const eq = body.indexOf('=')
      if (eq === -1) {
        if (body.startsWith('no-')) {
          flags[body.slice(3)] = false
        } else {
          flags[body] = true
        }
      } else {
        const key = body.slice(0, eq)
        const value = body.slice(eq + 1)
        flags[key] = value
      }
      continue
    }
    positional.push(token)
  }

  const [command = '', ...rest] = positional
  return { command, positional: rest, flags }
}

module.exports = { parseArgs }
