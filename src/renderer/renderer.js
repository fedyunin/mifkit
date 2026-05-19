const state = {
  selectedFiles: [],
  unsubscribeLog: null,
  unsubscribeProgress: null,
  lastOutputFolder: '',
  lastOutputFile: '',
  saveTimer: null,
  settingsReady: false,
  converters: [],
  converterId: '',
  converterOptions: {},
}

const SAVE_DEBOUNCE_MS = 400

const elements = {
  languageSelect: document.getElementById('languageSelect'),
  converterSelect: document.getElementById('converterSelect'),
  converterDescription: document.getElementById('converterDescription'),
  optionsContainer: document.getElementById('optionsContainer'),
  optionsEmpty: document.getElementById('optionsEmpty'),
  inputFolder: document.getElementById('inputFolder'),
  outputFolder: document.getElementById('outputFolder'),
  selectedFilesSummary: document.getElementById('selectedFilesSummary'),
  selectedFilesList: document.getElementById('selectedFilesList'),
  folderModeBlock: document.getElementById('folderModeBlock'),
  filesModeBlock: document.getElementById('filesModeBlock'),
  selectInputFolderButton: document.getElementById('selectInputFolderButton'),
  selectOutputFolderButton: document.getElementById('selectOutputFolderButton'),
  selectFilesButton: document.getElementById('selectFilesButton'),
  startButton: document.getElementById('startButton'),
  openOutputButton: document.getElementById('openOutputButton'),
  clearLogButton: document.getElementById('clearLogButton'),
  logOutput: document.getElementById('logOutput'),
  status: document.getElementById('status'),
  sourceCard: document.getElementById('sourceCard'),
  dropHint: document.getElementById('dropHint'),
  progressRow: document.getElementById('progressRow'),
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents()
  setStatus('status.loading', 'idle')

  state.converters = await window.api.listConverters()
  populateConverterSelect()

  const savedSettings = await window.api.loadSettings()
  applySettings(savedSettings)
  state.settingsReady = true
  attachListeners()
  setStatus('status.ready', 'idle')
})

function bindEvents() {
  document.querySelectorAll('input[name="inputMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      onInputModeChange()
      scheduleSave()
    })
  })

  elements.languageSelect.addEventListener('change', () => {
    const code = elements.languageSelect.value
    window.i18n.setLanguage(code)
    refreshStatusFromKey()
    renderConverterMeta()
    renderOptionsForm()
    if (!state.selectedFiles.length) {
      renderSelectedFiles()
    }
    scheduleSave()
  })

  elements.converterSelect.addEventListener('change', () => {
    state.converterId = elements.converterSelect.value
    renderConverterMeta()
    renderOptionsForm()
    scheduleSave()
  })

  elements.selectInputFolderButton.addEventListener('click', onSelectInputFolder)
  elements.selectOutputFolderButton.addEventListener('click', onSelectOutputFolder)
  elements.selectFilesButton.addEventListener('click', onSelectFiles)
  elements.startButton.addEventListener('click', onStart)
  elements.openOutputButton.addEventListener('click', onOpenOutput)
  elements.clearLogButton.addEventListener('click', () => {
    elements.logOutput.replaceChildren()
  })

  bindDragAndDrop()
}

function getCurrentConverter() {
  return state.converters.find((c) => c.id === state.converterId) || state.converters[0]
}

function populateConverterSelect() {
  const select = elements.converterSelect
  select.replaceChildren()
  for (const c of state.converters) {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = c.name
    select.appendChild(opt)
  }
}

function renderConverterMeta() {
  const converter = getCurrentConverter()
  if (!converter) {
    elements.converterDescription.textContent = ''
    return
  }
  elements.converterDescription.textContent = converter.description || ''
}

function renderOptionsForm() {
  const converter = getCurrentConverter()
  const container = elements.optionsContainer
  container.replaceChildren()

  if (!converter || !converter.options.length) {
    elements.optionsEmpty.classList.remove('hidden')
    return
  }
  elements.optionsEmpty.classList.add('hidden')

  const saved = state.converterOptions[converter.id] || {}
  for (const option of converter.options) {
    container.appendChild(renderOptionField(option, saved[option.key]))
  }
}

function renderOptionField(option, savedValue) {
  const value = savedValue !== undefined ? savedValue : option.default

  if (option.type === 'boolean') {
    const wrapper = document.createElement('label')
    wrapper.className = 'checkbox'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = Boolean(value)
    cb.dataset.optionKey = option.key
    cb.dataset.optionType = 'boolean'
    cb.addEventListener('change', scheduleSave)
    wrapper.appendChild(cb)

    const labelText = document.createElement('span')
    labelText.textContent = option.label
    wrapper.appendChild(labelText)
    return wrapper
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'option-field stack'

  const labelEl = document.createElement('label')
  labelEl.className = 'field-label'
  labelEl.textContent = option.label
  wrapper.appendChild(labelEl)

  let input
  if (option.type === 'enum') {
    input = document.createElement('select')
    for (const v of option.values || []) {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = v
      input.appendChild(opt)
    }
    input.value = value != null ? String(value) : ''
  } else if (option.type === 'number') {
    input = document.createElement('input')
    input.type = 'number'
    if (option.min !== undefined) input.min = String(option.min)
    if (option.max !== undefined) input.max = String(option.max)
    input.value = value != null ? String(value) : ''
  } else {
    input = document.createElement('input')
    input.type = 'text'
    input.value = value != null ? String(value) : ''
  }
  input.dataset.optionKey = option.key
  input.dataset.optionType = option.type
  input.addEventListener('input', scheduleSave)
  input.addEventListener('change', scheduleSave)
  wrapper.appendChild(input)

  if (option.description) {
    const hint = document.createElement('p')
    hint.className = 'hint'
    hint.textContent = option.description
    wrapper.appendChild(hint)
  }
  return wrapper
}

function collectOptionsFromForm() {
  const converter = getCurrentConverter()
  if (!converter) return {}
  const result = {}
  const inputs = elements.optionsContainer.querySelectorAll('[data-option-key]')
  for (const input of inputs) {
    const key = input.dataset.optionKey
    const type = input.dataset.optionType
    if (type === 'boolean') {
      result[key] = input.checked
    } else if (type === 'number') {
      const raw = input.value
      const option = converter.options.find((o) => o.key === key)
      result[key] = raw === '' ? (option && option.default) : Number(raw)
    } else {
      result[key] = input.value
    }
  }
  return result
}

function scheduleSave() {
  if (!state.settingsReady) return
  // capture current form state into per-converter options before saving
  const converter = getCurrentConverter()
  if (converter) {
    state.converterOptions[converter.id] = collectOptionsFromForm()
  }
  if (state.saveTimer) clearTimeout(state.saveTimer)
  state.saveTimer = setTimeout(saveSettingsNow, SAVE_DEBOUNCE_MS)
}

async function saveSettingsNow() {
  state.saveTimer = null
  try {
    await window.api.saveSettings(collectSettings())
  } catch (error) {
    // silent — auto-save failures shouldn't surface in the UI
  }
}

function attachListeners() {
  if (state.unsubscribeLog) state.unsubscribeLog()
  if (state.unsubscribeProgress) state.unsubscribeProgress()

  state.unsubscribeLog = window.api.onLog((message) => {
    appendLog(message)
  })

  state.unsubscribeProgress = window.api.onProgress((payload) => {
    updateProgress(payload)
  })
}

function bindDragAndDrop() {
  const zone = elements.sourceCard

  const stop = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  ;['dragenter', 'dragover'].forEach((type) => {
    zone.addEventListener(type, (event) => {
      stop(event)
      zone.classList.add('dragover')
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    })
  })

  ;['dragleave', 'dragend'].forEach((type) => {
    zone.addEventListener(type, (event) => {
      stop(event)
      if (event.type === 'dragleave' && event.relatedTarget && zone.contains(event.relatedTarget)) {
        return
      }
      zone.classList.remove('dragover')
    })
  })

  zone.addEventListener('drop', (event) => {
    stop(event)
    zone.classList.remove('dragover')
    handleDroppedItems(event.dataTransfer ? event.dataTransfer.files : [])
  })

  window.addEventListener('dragover', stop)
  window.addEventListener('drop', stop)
}

function handleDroppedItems(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) return

  const paths = files
    .map((file) => window.api.getPathForFile(file))
    .filter((p) => p)

  if (!paths.length) return

  const converter = getCurrentConverter()
  const accepted = converter ? converter.inputs.extensions.map(stripDot) : []

  if (paths.length === 1) {
    const single = paths[0]
    if (looksLikeDirectory(single)) {
      setFolderMode(single)
      return
    }

    const ext = single.split('.').pop().toLowerCase()
    if (accepted.includes(ext)) {
      setFilesMode([single])
      return
    }

    setFolderMode(single)
    return
  }

  const relevant = paths.filter((p) => accepted.includes(p.split('.').pop().toLowerCase()))
  setFilesMode(relevant.length ? relevant : paths)
}

function stripDot(ext) {
  return String(ext || '').replace(/^\./, '').toLowerCase()
}

function looksLikeDirectory(filePath) {
  return !/\.[a-z0-9]{1,6}$/i.test(filePath)
}

function setFolderMode(folderPath) {
  const radio = document.querySelector('input[name="inputMode"][value="folder"]')
  if (radio) radio.checked = true
  elements.inputFolder.value = folderPath
  onInputModeChange()
  scheduleSave()
}

function setFilesMode(paths) {
  if (!paths.length) return
  const radio = document.querySelector('input[name="inputMode"][value="files"]')
  if (radio) radio.checked = true
  state.selectedFiles = paths
  renderSelectedFiles()
  onInputModeChange()
  scheduleSave()
}

function onInputModeChange() {
  const mode = getInputMode()
  const folderMode = mode === 'folder'
  elements.folderModeBlock.classList.toggle('hidden', !folderMode)
  elements.filesModeBlock.classList.toggle('hidden', folderMode)
}

async function onSelectInputFolder() {
  const selected = await window.api.selectInputFolder()
  if (!selected) return
  elements.inputFolder.value = selected
  scheduleSave()
}

async function onSelectOutputFolder() {
  const selected = await window.api.selectOutputFolder()
  if (!selected) return
  elements.outputFolder.value = selected
  scheduleSave()
}

async function onSelectFiles() {
  const converter = getCurrentConverter()
  const extensions = converter ? converter.inputs.extensions.map(stripDot) : []
  const files = await window.api.selectFiles({ extensions })
  state.selectedFiles = files || []
  renderSelectedFiles()
  scheduleSave()
}

async function onStart() {
  const converter = getCurrentConverter()
  if (!converter) {
    appendLog('No converter selected', 'error')
    return
  }

  // ensure latest form state is captured
  state.converterOptions[converter.id] = collectOptionsFromForm()

  const inputs = buildInputs()
  if (!inputs.length) {
    appendLog('No input selected', 'error')
    return
  }

  const config = {
    converterId: converter.id,
    inputs,
    output: elements.outputFolder.value.trim(),
    options: state.converterOptions[converter.id],
  }

  appendLog('------------------------------', 'info')
  appendLog(`Start: ${new Date().toLocaleString()} — ${converter.id}`, 'info')
  setStatus('status.converting', 'running')
  setRunning(true)
  showProgress(true)
  updateProgress({ total: 0, done: 0 })
  elements.openOutputButton.disabled = true
  state.lastOutputFile = ''
  state.lastOutputFolder = config.output

  const response = await window.api.startConversion(config)

  setRunning(false)
  showProgress(false)

  if (!response.ok) {
    appendLog(`FATAL: ${response.error}`, 'error')
    elements.status.textContent = response.error
    elements.status.className = 'status error'
    elements.status.removeAttribute('data-status-key')
    return
  }

  const summary = response.result
  appendLog(`Processed: ${summary.processed}`, 'info')
  appendLog(`Skipped: ${summary.skipped}`, summary.skipped ? 'warn' : 'info')

  if (summary.outputs && summary.outputs.length) {
    appendLog('Outputs:', 'info')
    for (const output of summary.outputs) {
      appendLog(`  ${output}`, 'info')
    }
    state.lastOutputFile = summary.outputs[0]
    elements.openOutputButton.disabled = false
  }

  if (summary.errors && summary.errors.length) {
    appendLog('Errors:', 'error')
    for (const item of summary.errors) {
      appendLog(`  ${item.file} -> ${item.error}`, 'error')
    }
    setStatus('status.doneErrors', 'error', { n: summary.processed })
    return
  }

  setStatus('status.done', 'success', { n: summary.processed })
}

function buildInputs() {
  if (getInputMode() === 'folder') {
    const folder = elements.inputFolder.value.trim()
    return folder ? [folder] : []
  }
  return [...state.selectedFiles]
}

async function onOpenOutput() {
  const target = state.lastOutputFolder || dirname(state.lastOutputFile)
  if (!target) return
  await window.api.openPath(target)
}

function dirname(filePath) {
  if (!filePath) return ''
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx === -1 ? '' : filePath.slice(0, idx)
}

function collectSettings() {
  return {
    language: elements.languageSelect.value,
    converterId: state.converterId,
    converterOptions: { ...state.converterOptions },
    inputMode: getInputMode(),
    inputFolder: elements.inputFolder.value.trim(),
    outputFolder: elements.outputFolder.value.trim(),
    selectedFiles: [...state.selectedFiles],
  }
}

function applySettings(settings) {
  const lang = (settings.language && window.i18n.LANGS.includes(settings.language)) ? settings.language : 'en'
  elements.languageSelect.value = lang
  window.i18n.setLanguage(lang)

  state.converterOptions = settings.converterOptions ? { ...settings.converterOptions } : {}
  const wantedId = settings.converterId
  const fallback = state.converters[0] ? state.converters[0].id : ''
  state.converterId = state.converters.some((c) => c.id === wantedId) ? wantedId : fallback
  elements.converterSelect.value = state.converterId

  const inputMode = settings.inputMode || 'folder'
  const modeRadio = document.querySelector(`input[name="inputMode"][value="${inputMode}"]`)
  if (modeRadio) modeRadio.checked = true

  elements.inputFolder.value = settings.inputFolder || ''
  elements.outputFolder.value = settings.outputFolder || ''

  state.selectedFiles = Array.isArray(settings.selectedFiles) ? settings.selectedFiles : []
  renderSelectedFiles()
  renderConverterMeta()
  renderOptionsForm()
  onInputModeChange()
}

function renderSelectedFiles() {
  const files = state.selectedFiles

  if (!files.length) {
    elements.selectedFilesSummary.value = ''
    elements.selectedFilesList.textContent = window.i18n.t('list.noFiles')
    elements.selectedFilesList.setAttribute('data-i18n', 'list.noFiles')
    elements.selectedFilesList.classList.add('empty')
    return
  }

  elements.selectedFilesSummary.value = `${files.length} file(s) selected`
  elements.selectedFilesList.classList.remove('empty')
  elements.selectedFilesList.removeAttribute('data-i18n')
  elements.selectedFilesList.innerHTML = files
    .map((filePath) => `<div class="file-item">${escapeHtml(filePath)}</div>`)
    .join('')
}

function getInputMode() {
  const selected = document.querySelector('input[name="inputMode"]:checked')
  return selected ? selected.value : 'folder'
}

function setRunning(isRunning) {
  elements.startButton.disabled = isRunning
  elements.selectFilesButton.disabled = isRunning
  elements.selectInputFolderButton.disabled = isRunning
  elements.selectOutputFolderButton.disabled = isRunning
  elements.converterSelect.disabled = isRunning
}

function showProgress(visible) {
  elements.progressRow.classList.toggle('hidden', !visible)
}

function updateProgress(payload) {
  const total = Math.max(0, Number(payload && payload.total) || 0)
  const done = Math.max(0, Number(payload && payload.done) || 0)
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  elements.progressFill.style.width = `${pct}%`
  elements.progressLabel.textContent = window.i18n.t('progress.of', { done, total })
}

function appendLog(message, level) {
  const line = document.createElement('div')
  const severity = detectLevel(message, level)
  line.className = `log-line level-${severity}`

  const time = document.createElement('span')
  time.className = 'log-time'
  time.textContent = formatTime(new Date())

  const lvl = document.createElement('span')
  lvl.className = 'log-level'
  lvl.textContent = severity

  const text = document.createElement('span')
  text.className = 'log-text'
  text.textContent = message

  line.appendChild(time)
  line.appendChild(lvl)
  line.appendChild(text)
  elements.logOutput.appendChild(line)
  elements.logOutput.scrollTop = elements.logOutput.scrollHeight
}

function detectLevel(message, hint) {
  if (hint) return hint
  const text = String(message || '')
  if (/^\s*(ERROR|FATAL)\b/i.test(text)) return 'error'
  if (/^\s*WARN\b/i.test(text)) return 'warn'
  return 'info'
}

function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function setStatus(key, variant, vars) {
  elements.status.setAttribute('data-status-key', key)
  if (vars) {
    elements.status.setAttribute('data-status-vars', JSON.stringify(vars))
  } else {
    elements.status.removeAttribute('data-status-vars')
  }
  elements.status.textContent = window.i18n.t(key, vars)
  elements.status.className = `status ${variant}`
}

function refreshStatusFromKey() {
  const key = elements.status.getAttribute('data-status-key')
  if (!key) return
  const varsRaw = elements.status.getAttribute('data-status-vars')
  let vars
  try {
    vars = varsRaw ? JSON.parse(varsRaw) : undefined
  } catch (error) {
    vars = undefined
  }
  elements.status.textContent = window.i18n.t(key, vars)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
