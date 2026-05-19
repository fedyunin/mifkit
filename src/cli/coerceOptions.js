/**
 * Coerce raw string flag values to the types declared in a converter's
 * options[] schema. Numbers parsed, booleans normalized, strings/enums kept.
 *
 * Returns { options, errors }. Unknown flags are surfaced as errors so users
 * get told instead of silently ignored. Schema validation (enum/range) is
 * still expected to happen via registry.validateOptions afterwards.
 *
 * @param {Array<{key: string, type: string}>} schema
 * @param {Object} flags                                    Output of parseArgs.flags
 * @param {Set<string>} reservedFlags                       Flags the CLI consumes itself (e.g. output)
 */
function coerceOptions(schema, flags, reservedFlags = new Set()) {
  const options = {}
  const errors = []
  const knownKeys = new Set(schema.map((o) => o.key))

  for (const [rawKey, rawValue] of Object.entries(flags)) {
    if (reservedFlags.has(rawKey) || rawKey === 'help' || rawKey === 'version') {
      continue
    }
    if (!knownKeys.has(rawKey)) {
      errors.push(`Unknown option --${rawKey}`)
      continue
    }
    const option = schema.find((o) => o.key === rawKey)

    if (option.type === 'boolean') {
      if (typeof rawValue === 'boolean') {
        options[rawKey] = rawValue
      } else {
        const normalized = String(rawValue).toLowerCase()
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
          options[rawKey] = true
        } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
          options[rawKey] = false
        } else {
          errors.push(`Option --${rawKey} expects a boolean, got "${rawValue}"`)
        }
      }
      continue
    }

    if (option.type === 'number') {
      const num = Number(rawValue)
      if (!Number.isFinite(num)) {
        errors.push(`Option --${rawKey} expects a number, got "${rawValue}"`)
      } else {
        options[rawKey] = num
      }
      continue
    }

    // string / enum
    if (rawValue === true) {
      errors.push(`Option --${rawKey} expects a value (use --${rawKey}=value)`)
      continue
    }
    options[rawKey] = String(rawValue)
  }

  return { options, errors }
}

module.exports = { coerceOptions }
