const { parentPort, workerData } = require('worker_threads')
const converters = require('../core/converters')

const listeners = {
  log: (message) => parentPort.postMessage({ type: 'log', message }),
  progress: (payload) => parentPort.postMessage({ type: 'progress', payload }),
}

async function run() {
  const { config } = workerData
  const { converterId, inputs, output, options } = config
  const converter = converters.get(converterId)

  if (!converter) {
    throw new Error(`Unknown converter: ${converterId || '<unset>'}`)
  }

  const validated = converters.validateOptions(converter, options || {})
  if (validated.errors.length) {
    throw new Error(`Invalid options:\n  ${validated.errors.join('\n  ')}`)
  }

  return converter.run(
    { inputs: inputs || [], output: output || '', options: validated.merged },
    listeners,
  )
}

run()
  .then((result) => {
    parentPort.postMessage({
      type: 'done',
      result: {
        outputs: result.outputs || [],
        processed: result.stats?.processed || 0,
        skipped: result.stats?.skipped || 0,
        errors: result.stats?.errors || [],
      },
    })
  })
  .catch((error) => {
    parentPort.postMessage({
      type: 'error',
      error: error && error.message ? error.message : String(error),
    })
  })
