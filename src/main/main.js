const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const { Worker } = require('worker_threads')
const { loadSettings, saveSettings } = require('../core/settings')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'MifKit',
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('dialog:selectInputFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })

  if (result.canceled || !result.filePaths.length) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('dialog:selectOutputFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  })

  if (result.canceled || !result.filePaths.length) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('dialog:selectFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'MapInfo files', extensions: ['mif', 'mid'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePaths.length) {
    return []
  }

  return result.filePaths
})

ipcMain.handle('settings:load', async () => {
  return loadSettings(getSettingsPath())
})

ipcMain.handle('settings:save', async (event, settings) => {
  saveSettings(getSettingsPath(), settings)
  return true
})

ipcMain.handle('convert:start', async (event, config) => {
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { config },
    })

    let finished = false

    const finish = (payload) => {
      if (finished) {
        return
      }
      finished = true
      worker.terminate().catch(() => {})
      resolve(payload)
    }

    worker.on('message', (msg) => {
      if (msg.type === 'log') {
        event.sender.send('convert:log', msg.message)
        return
      }

      if (msg.type === 'progress') {
        event.sender.send('convert:progress', msg.payload)
        return
      }

      if (msg.type === 'done') {
        finish({ ok: true, result: msg.result })
        return
      }

      if (msg.type === 'error') {
        finish({ ok: false, error: msg.error })
      }
    })

    worker.on('error', (error) => {
      finish({ ok: false, error: error && error.message ? error.message : String(error) })
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        finish({ ok: false, error: `Worker exited with code ${code}` })
      }
    })
  })
})

ipcMain.handle('shell:openPath', async (event, targetPath) => {
  if (!targetPath) {
    return false
  }
  const error = await shell.openPath(targetPath)
  return !error
})

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}
