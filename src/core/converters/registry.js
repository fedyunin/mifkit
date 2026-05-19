const converters = new Map()

function register(converter) {
  assertConverterShape(converter)

  if (converters.has(converter.id)) {
    throw new Error(`Converter already registered: ${converter.id}`)
  }

  converters.set(converter.id, Object.freeze({ ...converter, options: Object.freeze(converter.options.slice()) }))
  return converter
}

function unregister(id) {
  return converters.delete(id)
}

function get(id) {
  return converters.get(id) || null
}

function list() {
  return Array.from(converters.values())
}

function clear() {
  converters.clear()
}

function applyDefaults(converter, options) {
  const result = {}

  for (const option of converter.options) {
    if (options && Object.prototype.hasOwnProperty.call(options, option.key)) {
      result[option.key] = options[option.key]
    } else if (option.default !== undefined) {
      result[option.key] = option.default
    }
  }

  if (options) {
    for (const key of Object.keys(options)) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = options[key]
      }
    }
  }

  return result
}

function validateOptions(converter, options) {
  const errors = []
  const merged = applyDefaults(converter, options)

  for (const option of converter.options) {
    const value = merged[option.key]

    if (value === undefined) {
      continue
    }

    if (option.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Option "${option.key}" must be boolean`)
      continue
    }

    if (option.type === 'string' && typeof value !== 'string') {
      errors.push(`Option "${option.key}" must be string`)
      continue
    }

    if (option.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`Option "${option.key}" must be a finite number`)
        continue
      }
      if (option.min !== undefined && value < option.min) {
        errors.push(`Option "${option.key}" must be >= ${option.min}`)
      }
      if (option.max !== undefined && value > option.max) {
        errors.push(`Option "${option.key}" must be <= ${option.max}`)
      }
    }

    if (option.type === 'enum') {
      if (!Array.isArray(option.values) || !option.values.includes(value)) {
        errors.push(`Option "${option.key}" must be one of: ${(option.values || []).join(', ')}`)
      }
    }
  }

  return { merged, errors }
}

function assertConverterShape(converter) {
  if (!converter || typeof converter !== 'object') {
    throw new Error('Converter must be an object')
  }
  if (!converter.id || typeof converter.id !== 'string') {
    throw new Error('Converter.id must be a non-empty string')
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(converter.id)) {
    throw new Error(`Converter.id must be kebab-case: ${converter.id}`)
  }
  if (typeof converter.name !== 'string' || !converter.name) {
    throw new Error(`Converter ${converter.id} must have a name`)
  }
  if (!converter.inputs || !Array.isArray(converter.inputs.extensions)) {
    throw new Error(`Converter ${converter.id} must declare inputs.extensions`)
  }
  if (!converter.outputs || !Array.isArray(converter.outputs.extensions)) {
    throw new Error(`Converter ${converter.id} must declare outputs.extensions`)
  }
  if (!Array.isArray(converter.options)) {
    throw new Error(`Converter ${converter.id} must declare options array`)
  }
  if (typeof converter.run !== 'function') {
    throw new Error(`Converter ${converter.id} must implement run()`)
  }
}

module.exports = {
  register,
  unregister,
  get,
  list,
  clear,
  applyDefaults,
  validateOptions,
}
