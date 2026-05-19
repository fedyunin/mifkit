const pkg = require('../../package.json')

const RESERVED_FLAGS = ['output', 'o', 'help', 'version']

function topHelp() {
  return [
    `MifKit ${pkg.version} — MapInfo data toolkit`,
    '',
    'Usage:',
    '  mifkit <command> [args]',
    '',
    'Commands:',
    '  list                                   List all converters',
    '  help <converter>                       Show options for a converter',
    '  convert <converter> <input...> [opts]  Run a conversion',
    '',
    'Common flags:',
    '  --output=<dir>, -o <dir>               Output folder (required for convert)',
    '  --help, -h                             Show help',
    '  --version, -v                          Show version',
    '',
    'Examples:',
    '  mifkit list',
    '  mifkit help kml-to-mif',
    '  mifkit convert kml-to-mif input.kmz --output=./out --flat',
    '  mifkit convert mif-to-xlsx ./mif-folder --output=./out --no-paint-rows',
  ].join('\n')
}

function listConverters(converters) {
  if (!converters.length) {
    return 'No converters registered.'
  }
  const width = Math.max(...converters.map((c) => c.id.length))
  return converters
    .map((c) => `  ${c.id.padEnd(width)}  ${c.name}`)
    .join('\n')
}

function converterHelp(converter) {
  const lines = [
    `${converter.id} — ${converter.name}`,
    '',
    indent(converter.description || ''),
    '',
    `Inputs:  ${converter.inputs.extensions.join(', ')} (${converter.inputs.type})`,
    `Outputs: ${converter.outputs.extensions.join(', ')} (${converter.outputs.type})`,
    '',
    'Options:',
  ]

  if (!converter.options.length) {
    lines.push('  (none)')
  } else {
    for (const opt of converter.options) {
      lines.push(formatOption(opt))
      if (opt.description) {
        lines.push(indent(opt.description, '      '))
      }
    }
  }

  lines.push('')
  lines.push(
    `Example:`,
    `  mifkit convert ${converter.id} <input> --output=<dir>${exampleFlags(converter)}`,
  )

  return lines.join('\n')
}

function formatOption(option) {
  switch (option.type) {
    case 'boolean':
      return `  --${option.key} / --no-${option.key}  (boolean, default: ${option.default ?? false})`
    case 'enum':
      return `  --${option.key}=<value>            (enum: ${(option.values || []).join(' | ')}, default: ${option.default})`
    case 'number': {
      const range = (option.min !== undefined || option.max !== undefined)
        ? `, range: ${option.min ?? '-∞'}..${option.max ?? '+∞'}`
        : ''
      return `  --${option.key}=<n>                (number, default: ${option.default}${range})`
    }
    default:
      return `  --${option.key}=<text>             (string, default: ${option.default ? `"${option.default}"` : '(empty)'})`
  }
}

function exampleFlags(converter) {
  const example = converter.options
    .find((o) => o.type === 'boolean' && o.default === false)
  return example ? ` --${example.key}` : ''
}

function indent(text, prefix = '  ') {
  return String(text || '')
    .split('\n')
    .map((line) => prefix + line)
    .join('\n')
}

module.exports = {
  topHelp,
  listConverters,
  converterHelp,
  RESERVED_FLAGS,
}
