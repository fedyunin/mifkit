#!/usr/bin/env node
const { runCli } = require('../src/cli')

runCli(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`)
    process.exit(1)
  })
