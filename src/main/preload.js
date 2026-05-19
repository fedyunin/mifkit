const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('api', {
  selectInputFolder: () => ipcRenderer.invoke('dialog:selectInputFolder'),
  selectOutputFolder: () => ipcRenderer.invoke('dialog:selectOutputFolder'),
  selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),
  listConverters: () => ipcRenderer.invoke('converters:list'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  startConversion: (config) => ipcRenderer.invoke('convert:start', config),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch (error) {
      return ''
    }
  },
  onLog: (callback) => {
    const handler = (_, message) => callback(message)
    ipcRenderer.on('convert:log', handler)
    return () => ipcRenderer.removeListener('convert:log', handler)
  },
  onProgress: (callback) => {
    const handler = (_, payload) => callback(payload)
    ipcRenderer.on('convert:progress', handler)
    return () => ipcRenderer.removeListener('convert:progress', handler)
  },
})
