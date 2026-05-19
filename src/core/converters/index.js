const registry = require('./registry')
const mifToXlsx = require('./mif-to-xlsx')

let initialized = false

function ensureInitialized() {
  if (initialized) {
    return
  }
  registry.register(mifToXlsx)
  initialized = true
}

ensureInitialized()

module.exports = {
  ...registry,
  ensureInitialized,
}
