const registry = require('./registry')
const mifToXlsx = require('./mif-to-xlsx')
const kmlToMif = require('./kml-to-mif')

let initialized = false

function ensureInitialized() {
  if (initialized) {
    return
  }
  registry.register(mifToXlsx)
  registry.register(kmlToMif)
  initialized = true
}

ensureInitialized()

module.exports = {
  ...registry,
  ensureInitialized,
}
