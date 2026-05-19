;(function () {
  const DICT = {
    en: {
      'app.subtitle': 'MapInfo data toolkit. Pick a converter and run it.',
      'section.converter': 'Converter',
      'field.converter': 'Conversion direction',
      'hint.optionsEmpty': 'This converter has no options.',
      'section.source': 'Source',
      'mode.folder': 'Folder',
      'mode.files': 'Files',
      'field.inputFolder': 'Input folder',
      'placeholder.inputFolder': 'Select folder with MIF/MID files',
      'btn.browse': 'Browse',
      'opt.recursive': 'Scan subfolders',
      'field.selectedFiles': 'Selected files',
      'placeholder.selectedFiles': 'No files selected',
      'btn.chooseFiles': 'Choose files',
      'list.noFiles': 'No files selected',
      'section.output': 'Output',
      'field.outputFolder': 'Output folder',
      'placeholder.outputFolder': 'Leave empty to save near source files',
      'hint.output': 'If empty, output goes to the selected folder or near the selected files.',
      'section.options': 'Options',
      'opt.paintRows': 'Fill row background in Excel',
      'opt.skipBlack': 'Skip black color (#000000)',
      'opt.combine': 'Combine all files into one workbook',
      'opt.csv': 'Also export CSV',
      'opt.colorColumn': 'Add color column',
      'opt.freeze': 'Freeze header row',
      'opt.autofilter': 'Add autofilter',
      'btn.convert': 'Convert',
      'btn.clearLog': 'Clear log',
      'btn.openOutput': 'Open output folder',
      'status.ready': 'Ready',
      'status.loading': 'Loading settings…',
      'status.converting': 'Conversion in progress…',
      'status.done': 'Done. Processed: {n}',
      'status.doneErrors': 'Done with errors. Processed: {n}',
      'section.log': 'Log',
      'drop.hint': 'Drop files or a folder here',
      'field.language': 'Language',
      'field.combinedName': 'Combined workbook file name',
      'placeholder.combinedName': 'mapinfo-converted.xlsx',
      'field.colorColumnName': 'Color column name',
      'placeholder.colorColumnName': 'region_color_hex',
      'progress.of': '{done} of {total}',
    },
    ru: {
      'app.subtitle': 'Набор инструментов для данных MapInfo. Выберите конвертер и запустите.',
      'section.converter': 'Конвертер',
      'field.converter': 'Направление конвертации',
      'hint.optionsEmpty': 'У этого конвертера нет параметров.',
      'section.source': 'Источник',
      'mode.folder': 'Папка',
      'mode.files': 'Файлы',
      'field.inputFolder': 'Папка с файлами',
      'placeholder.inputFolder': 'Выберите папку с файлами MIF/MID',
      'btn.browse': 'Обзор',
      'opt.recursive': 'Сканировать подпапки',
      'field.selectedFiles': 'Выбранные файлы',
      'placeholder.selectedFiles': 'Файлы не выбраны',
      'btn.chooseFiles': 'Выбрать файлы',
      'list.noFiles': 'Файлы не выбраны',
      'section.output': 'Результат',
      'field.outputFolder': 'Папка для результатов',
      'placeholder.outputFolder': 'Оставьте пустым, чтобы сохранять рядом с исходниками',
      'hint.output': 'Если пусто — файлы сохраняются в папке исходников.',
      'section.options': 'Параметры',
      'opt.paintRows': 'Заливать строку цветом региона',
      'opt.skipBlack': 'Пропускать чёрный цвет (#000000)',
      'opt.combine': 'Объединить всё в одну книгу',
      'opt.csv': 'Также экспортировать CSV',
      'opt.colorColumn': 'Добавить колонку с цветом',
      'opt.freeze': 'Закрепить заголовок',
      'opt.autofilter': 'Включить автофильтр',
      'btn.convert': 'Конвертировать',
      'btn.clearLog': 'Очистить журнал',
      'btn.openOutput': 'Открыть папку с результатом',
      'status.ready': 'Готово',
      'status.loading': 'Загрузка настроек…',
      'status.converting': 'Идёт конвертация…',
      'status.done': 'Готово. Обработано: {n}',
      'status.doneErrors': 'Завершено с ошибками. Обработано: {n}',
      'section.log': 'Журнал',
      'drop.hint': 'Перетащите сюда файлы или папку',
      'field.language': 'Язык',
      'field.combinedName': 'Имя объединённой книги',
      'placeholder.combinedName': 'mapinfo-converted.xlsx',
      'field.colorColumnName': 'Название колонки с цветом',
      'placeholder.colorColumnName': 'region_color_hex',
      'progress.of': '{done} из {total}',
    },
    kk: {
      'app.subtitle': 'MapInfo деректерімен жұмыс істеуге арналған құралдар жинағы. Конвертерді таңдап, іске қосыңыз.',
      'section.converter': 'Конвертер',
      'field.converter': 'Түрлендіру бағыты',
      'hint.optionsEmpty': 'Бұл конвертерде параметрлер жоқ.',
      'section.source': 'Дереккөз',
      'mode.folder': 'Қалта',
      'mode.files': 'Файлдар',
      'field.inputFolder': 'Кіріс қалтасы',
      'placeholder.inputFolder': 'MIF/MID файлдары бар қалтаны таңдаңыз',
      'btn.browse': 'Шолу',
      'opt.recursive': 'Ішкі қалталарды сканерлеу',
      'field.selectedFiles': 'Таңдалған файлдар',
      'placeholder.selectedFiles': 'Файлдар таңдалмаған',
      'btn.chooseFiles': 'Файлдарды таңдау',
      'list.noFiles': 'Файлдар таңдалмаған',
      'section.output': 'Нәтиже',
      'field.outputFolder': 'Нәтиже қалтасы',
      'placeholder.outputFolder': 'Бос қалдырсаңыз — бастапқы файлдар жанына сақталады',
      'hint.output': 'Бос болса — файлдар бастапқы қалтаға сақталады.',
      'section.options': 'Параметрлер',
      'opt.paintRows': 'Excel жолының фонын бояу',
      'opt.skipBlack': 'Қара түсті өткізіп жіберу (#000000)',
      'opt.combine': 'Барлық файлды бір жұмыс кітабына біріктіру',
      'opt.csv': 'CSV пішімінде де экспорттау',
      'opt.colorColumn': 'Түс бағанын қосу',
      'opt.freeze': 'Тақырып жолын бекіту',
      'opt.autofilter': 'Автосүзгіні қосу',
      'btn.convert': 'Түрлендіру',
      'btn.clearLog': 'Журналды тазалау',
      'btn.openOutput': 'Нәтиже қалтасын ашу',
      'status.ready': 'Дайын',
      'status.loading': 'Параметрлер жүктелуде…',
      'status.converting': 'Түрлендіру орындалуда…',
      'status.done': 'Дайын. Өңделді: {n}',
      'status.doneErrors': 'Қателермен аяқталды. Өңделді: {n}',
      'section.log': 'Журнал',
      'drop.hint': 'Файлдарды немесе қалтаны осы жерге тастаңыз',
      'field.language': 'Тіл',
      'field.combinedName': 'Біріктірілген кітап атауы',
      'placeholder.combinedName': 'mapinfo-converted.xlsx',
      'field.colorColumnName': 'Түс бағанының атауы',
      'placeholder.colorColumnName': 'region_color_hex',
      'progress.of': '{total} ішінен {done}',
    },
  }

  let current = 'en'

  function setLanguage(code) {
    if (!DICT[code]) {
      code = 'en'
    }
    current = code
    document.documentElement.lang = code
    apply(document)
  }

  function getLanguage() {
    return current
  }

  function t(key, vars) {
    const str = (DICT[current] && DICT[current][key]) || DICT.en[key] || key
    if (!vars) {
      return str
    }
    return str.replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
  }

  function apply(root) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'))
    })
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')))
    })
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')))
    })
  }

  window.i18n = { setLanguage, getLanguage, t, apply, LANGS: Object.keys(DICT) }
})()
