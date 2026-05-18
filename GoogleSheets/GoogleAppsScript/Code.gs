/**********************************************************
 * Apps Script  (FINAL CLEAN VERSION + LOG FORMATTING)
 *  • onEdit: Модалка, Сброс уведомлений, Формат логов
 *  • findNewRequests: поиск + шаблоны + даты + формат
 *  • Модальное окно: логика полного сканирования
 **********************************************************/

/* ---------- toast-helpers ---------- */
function showToast(msg, secs, title) {
  try { SpreadsheetApp.getActive().toast(msg, title || '', secs || 5); } catch(_) {}
}
function toastDone(title) { showToast('✅ Готово', 2, title || ''); }

/* ---------- утилиты ---------- */
function getColByHeader(sheet, header) {
  const heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx   = heads.indexOf(header);
  return idx >= 0 ? idx + 1 : null;
}
function _escapeRegExp_(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

/* ---------- константы ---------- */
const SRC_SHEET   = 'Заявки';
const ITIL_SHEET  = 'ITIL';
const INITIATORS_SHEET = 'Инициаторы ITIL';
const INITIATOR_LIST_HEADER = 'Уникальный инициатор';
const INFO_HEADER = 'Информация из СУПП/ITIL';
const GREEN       = '#274e13';

// Шаблон лога: "10.04.2025 9:55:43 / ..."
// (ДД.ММ.ГГГГ Ч:ММ:СС /)
const LOG_REGEX = /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\/.*$/;

/* ---------- настройки проблем ---------- */
const TEXT_HEADER     = 'Текст заявки';
const PROBLEM_HEADER  = 'Проблемы';
const PROBLEM_OPTIONS = [
  'Публикация/Некорректная публикация/Ошибки публикации',
  'Распределение оплат',
  'Скачки долга',
  'Разночтения остатков ПКП/АИС',
  'Ошибка в работе функционала',
  'Ошибка из-за проблем с данными',
  'Системный сбой',
  'Некорректная работа отчётов',
  'Редактирование/Перемещение ИД/БП',
  'Миграция АСРН/АИС',
  'Иные заявки',
  'Запросы через ТП',
  'ЕПГУ',
  'Разное'
];


// Старый Apps Script problemPicker отключён: классификация теперь открывается расширением.
const ENABLE_APPS_SCRIPT_PROBLEM_PICKER = false;

/* ==========================================================
 * onEdit (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
 * ========================================================== */
function onEdit(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  const name = sh.getName();

  // --- ПУНКТ 1: МОДАЛЬНОЕ ОКНО (Очередь) ---
  // Работает только при наличии триггера и изменении колонки "Текст заявки"
  if (ENABLE_APPS_SCRIPT_PROBLEM_PICKER && e.triggerUid && (name === 'Заявки' || name === 'Заявки (наши)')) {
    const colText = getColByHeader(sh, TEXT_HEADER);
    const colProb = getColByHeader(sh, PROBLEM_HEADER);

    if (colText && colProb && _rangeTouchesColumn_(e.range, colText)) {
      const rows = _collectProblemRowsFromEditedRange_(sh, e.range, colText, colProb);
      if (rows.length > 0) {
        _startProblemQueue_(name, rows);
      }
    }
  }

  // --- ПУНКТ 4 & NEW: СБРОС ЦВЕТОВ и ФОРМАТИРОВАНИЕ INFO ---
  if (name === 'Заявки' || name === 'Заявки (наши)') {
    _applyInfoEditSideEffectsForEditedRange_(sh, e.range, {
      showFormattingToast: !e.triggerUid
    });
  }
}

/**
 * Общий механизм последствий редактирования колонки «Информация из СУПП/ITIL».
 * Его нужно вызывать и из onEdit, и из bridge, потому что setValue/setRichTextValue
 * из Apps Script не запускает пользовательский onEdit автоматически.
 */
function _applyInfoEditSideEffectsForEditedRange_(sh, editedRange, options) {
  if (!sh || !editedRange) return;

  const cInfo = getColByHeader(sh, INFO_HEADER);
  if (!cInfo) return;

  const firstCol = editedRange.getColumn();
  const lastCol = firstCol + editedRange.getNumColumns() - 1;

  if (cInfo < firstCol || cInfo > lastCol) return;

  _applyInfoEditSideEffects_(sh, editedRange.getRow(), editedRange.getNumRows(), options);
}

function _applyInfoEditSideEffects_(sh, startRow, numRows, options) {
  if (!sh || !startRow || !numRows || numRows <= 0) return;

  const cInfo = getColByHeader(sh, INFO_HEADER);
  if (!cInfo) return;

  const cResp = getColByHeader(sh, 'Пришел новый ответ');
  const cNumS = getColByHeader(sh, 'Номер СУПП (последний)');

  const shouldResetColors = !options || options.resetColors !== false;

  // 1. Сброс цветов: тот же механизм, который раньше был внутри onEdit.
  if (shouldResetColors && cResp && cNumS) {
    if (options && options.showFormattingToast) {
      showToast('♻️ Форматирование...', 1);
    }

    sh.getRange(startRow, cResp, numRows, 1).setBackground('#f5f5f5');
    sh.getRange(startRow, cNumS, numRows, 1).setBackground('#f5f5f5');
  }

  // 2. Форматирование INFO: оставляем в том же общем механизме,
  // чтобы bridge получал такой же результат, как ручное редактирование ячейки.
  if (cNumS) {
    const infoRange = sh.getRange(startRow, cInfo, numRows, 1);
    const suppVals = sh.getRange(startRow, cNumS, numRows, 1).getValues();
    _formatInfoRangeSimple_(infoRange, suppVals);
  }
}

/* ==========================================================
 * findNewRequests (КНОПКА)
 * ========================================================== */
function findNewRequests() {
  showToast('🔎 Ищу новые заявки…', 30, 'Новые заявки');

  const ctx = _getNewRequestsContext_({
    title: 'Новые заявки',
    needSourceDate: true,
    needItilDate: true
  });
  if (!ctx) return;

  // После ручного добавления старых периодов последняя строка уже не обязана
  // содержать самую свежую дату, поэтому используем максимальную дату в колонке.
  const latestDate = _getLatestDateInColumn_(ctx.src, ctx.colDateSrc);
  if (!(latestDate instanceof Date)) {
    toastDone('Новые заявки');
    return;
  }

  const add = _collectMissingNewRequestNumbers_(ctx, {
    needDate: true,
    predicate: row => row.date instanceof Date && row.date > latestDate
  });

  _appendNewRequestNumbers_(ctx, add, 'Новые заявки');
}

function findNewRequestsByPeriod() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'Новые заявки за период',
    'Введите период в формате дд.мм.гггг-дд.мм.гггг',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const period = _parseRuPeriod_(res.getResponseText());
  if (!period) {
    ui.alert('Введите корректный период в формате дд.мм.гггг-дд.мм.гггг, где первая дата не позже второй.');
    return;
  }

  showToast('🔎 Ищу новые заявки за период…', 30, 'Новые заявки');

  const ctx = _getNewRequestsContext_({
    title: 'Новые заявки',
    needItilDate: true
  });
  if (!ctx) return;

  const add = _collectMissingNewRequestNumbers_(ctx, {
    needDate: true,
    predicate: row =>
      row.date instanceof Date &&
      row.date >= period.start &&
      row.date < period.endExclusive
  });

  _appendNewRequestNumbers_(ctx, add, 'Новые заявки');
}

function showNewRequestsInitiatorPicker() {
  const initiators = _getUniqueItilInitiators_();
  if (!initiators.length) {
    showToast('На листе «Инициаторы ITIL» не найден список инициаторов.', 5, 'Новые заявки');
    return;
  }

  const html = HtmlService.createHtmlOutput(_buildInitiatorPickerHtml_(initiators))
    .setWidth(620)
    .setHeight(680);

  SpreadsheetApp.getUi().showModalDialog(html, 'Новые заявки по инициаторам');
}

function appendMissingNewRequestsByInitiators(selectedInitiators) {
  const initiatorKeys = new Set(
    (Array.isArray(selectedInitiators) ? selectedInitiators : [])
      .map(_normalizeTextKey_)
      .filter(Boolean)
  );
  if (!initiatorKeys.size) {
    throw new Error('Не выбраны инициаторы.');
  }

  showToast('🔎 Ищу новые заявки выбранных инициаторов…', 30, 'Новые заявки');

  const ctx = _getNewRequestsContext_({
    title: 'Новые заявки',
    needInitiator: true
  });
  if (!ctx) {
    return { added: 0 };
  }

  const add = _collectMissingNewRequestNumbers_(ctx, {
    needInitiator: true,
    predicate: row => initiatorKeys.has(_normalizeTextKey_(row.initiator))
  });

  return {
    added: _appendNewRequestNumbers_(ctx, add, 'Новые заявки')
  };
}

function _getNewRequestsContext_(options) {
  const title = options && options.title ? options.title : 'Новые заявки';
  const needSourceDate = !!(options && options.needSourceDate);
  const needItilDate = !!(options && options.needItilDate);
  const needInitiator = !!(options && options.needInitiator);

  const ss = SpreadsheetApp.getActive();
  const src = ss.getSheetByName(SRC_SHEET);
  const itil = ss.getSheetByName(ITIL_SHEET);
  if (!src || !itil) {
    showToast('Не найдены листы «Заявки» или «ITIL».', 5, title);
    return null;
  }

  const colTicketSrc = getColByHeader(src, 'Номер ITIL');
  const colDateSrc = needSourceDate ? getColByHeader(src, 'Дата заявки') : null;
  const colNumIt = getColByHeader(itil, 'Номер');
  const colDateIt = needItilDate ? getColByHeader(itil, 'Дата') : null;
  const colInitiatorIt = needInitiator ? getColByHeader(itil, 'Инициатор') : null;

  if (
    !colTicketSrc ||
    !colNumIt ||
    (needSourceDate && !colDateSrc) ||
    (needItilDate && !colDateIt) ||
    (needInitiator && !colInitiatorIt)
  ) {
    showToast('Не найдены нужные колонки на листах «Заявки» или «ITIL».', 5, title);
    return null;
  }

  return {
    src: src,
    itil: itil,
    colTicketSrc: colTicketSrc,
    colDateSrc: colDateSrc,
    colNumIt: colNumIt,
    colDateIt: colDateIt,
    colInitiatorIt: colInitiatorIt
  };
}

function _getLatestDateInColumn_(sh, col) {
  const nRows = sh.getLastRow() - 1;
  if (nRows <= 0) return null;

  const values = sh.getRange(2, col, nRows, 1).getValues();
  let latest = null;
  for (let i = 0; i < values.length; i++) {
    const d = values[i][0];
    if (d instanceof Date && (!latest || d > latest)) latest = d;
  }
  return latest;
}

function _collectMissingNewRequestNumbers_(ctx, options) {
  const predicate = options && options.predicate ? options.predicate : () => true;
  const needDate = !!(options && options.needDate);
  const needInitiator = !!(options && options.needInitiator);

  const existingKeys = _getExistingTicketKeys_(ctx.src, ctx.colTicketSrc);
  const nRows = ctx.itil.getLastRow() - 1;
  if (nRows <= 0) return [];

  const nums = ctx.itil.getRange(2, ctx.colNumIt, nRows, 1).getValues();
  const dates = needDate
    ? ctx.itil.getRange(2, ctx.colDateIt, nRows, 1).getValues()
    : null;
  const initiators = needInitiator
    ? ctx.itil.getRange(2, ctx.colInitiatorIt, nRows, 1).getDisplayValues()
    : null;

  const add = [];
  const seen = new Set();
  for (let i = 0; i < nRows; i++) {
    const ticket = nums[i][0];
    const ticketKey = _normalizeTicketKey_(ticket);
    if (!ticketKey || existingKeys.has(ticketKey) || seen.has(ticketKey)) continue;

    const row = {
      ticket: ticket,
      date: dates ? dates[i][0] : null,
      initiator: initiators ? initiators[i][0] : ''
    };
    if (!predicate(row)) continue;

    add.push(ticket);
    seen.add(ticketKey);
  }
  return add;
}

function _getExistingTicketKeys_(sh, col) {
  const nRows = sh.getLastRow() - 1;
  if (nRows <= 0) return new Set();

  const values = sh.getRange(2, col, nRows, 1).getValues();
  const keys = new Set();
  for (let i = 0; i < values.length; i++) {
    const key = _normalizeTicketKey_(values[i][0]);
    if (key) keys.add(key);
  }
  return keys;
}

function _normalizeTicketKey_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function _normalizeTextKey_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function _appendNewRequestNumbers_(ctx, add, title) {
  if (!add.length) {
    showToast('Новых заявок не найдено', 3, title);
    return 0;
  }

  const start = ctx.src.getLastRow() + 1;
  const values = add.map(v => [v]);
  ctx.src.getRange(start, ctx.colTicketSrc, values.length, 1).setValues(values);
  SpreadsheetApp.flush();

  // --- ПУНКТ 6 и 7: ПРИМЕНЕНИЕ ШАБЛОНОВ И ДАТ ---
  const newRowIndices = values.map((_, i) => start + i);
  applyTemplatesToRows(ctx.src, newRowIndices);

  // --- ПУНКТ 3: ОБНОВЛЕНИЕ HIGHLIGHTS + ФОРМАТИРОВАНИЕ ---
  refreshHighlights();

  showToast(`✅ Добавлено новых заявок: ${add.length}`, 3, title);
  return add.length;
}

function _parseRuPeriod_(value) {
  const match = String(value || '').trim().match(/^(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})$/);
  if (!match) return null;

  const start = _parseRuDate_(match[1]);
  const end = _parseRuDate_(match[2]);
  if (!start || !end || start > end) return null;

  return {
    start: start,
    endExclusive: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
  };
}

function _parseRuDate_(value) {
  const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function _getUniqueItilInitiators_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(INITIATORS_SHEET);
  if (!sh) return [];

  const col = getColByHeader(sh, INITIATOR_LIST_HEADER);
  if (!col) return [];

  const nRows = sh.getLastRow() - 1;
  if (nRows <= 0) return [];

  const values = sh.getRange(2, col, nRows, 1).getDisplayValues();
  const initiators = [];
  const seen = new Set();
  for (let i = 0; i < values.length; i++) {
    const value = _normalizeTextKey_(values[i][0]);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    initiators.push(value);
  }
  return initiators;
}

function _buildInitiatorPickerHtml_(initiators) {
  const initiatorsJson = JSON.stringify(initiators).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f8f9fa;
        color: #202124;
      }
      .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .header {
        padding: 20px 22px 14px;
        background: #fff;
        border-bottom: 1px solid #dadce0;
      }
      h1 {
        margin: 0 0 14px;
        font-size: 20px;
        line-height: 1.25;
      }
      .search {
        width: 100%;
        border: 1px solid #dadce0;
        border-radius: 8px;
        padding: 11px 12px;
        font-size: 14px;
        outline: none;
      }
      .search:focus {
        border-color: #1a73e8;
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 22px;
        font-size: 13px;
      }
      .toolbar-actions {
        display: flex;
        gap: 8px;
      }
      .link-button {
        border: 0;
        background: transparent;
        color: #1a73e8;
        padding: 0;
        cursor: pointer;
        font-size: 13px;
      }
      .list {
        flex: 1;
        overflow: auto;
        margin: 0 22px;
        padding: 8px 0;
        border: 1px solid #dadce0;
        border-radius: 10px;
        background: #fff;
      }
      .item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 9px 14px;
        line-height: 1.35;
      }
      .item:hover {
        background: #f1f3f4;
      }
      .item input {
        margin-top: 2px;
      }
      .empty {
        display: none;
        padding: 22px 14px;
        color: #5f6368;
        text-align: center;
      }
      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 20px;
      }
      button {
        border-radius: 8px;
        border: 1px solid #dadce0;
        background: #fff;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 14px;
      }
      .primary {
        border-color: #1a73e8;
        background: #1a73e8;
        color: #fff;
      }
      button:disabled {
        cursor: default;
        opacity: 0.55;
      }
      .status {
        min-height: 18px;
        padding: 0 22px;
        color: #d93025;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="header">
        <h1>Найти новые заявки по инициаторам</h1>
        <input id="search" class="search" type="text" placeholder="Поиск по инициатору..." autofocus>
      </div>
      <div class="toolbar">
        <div id="counter">Выбрано: 0</div>
        <div class="toolbar-actions">
          <button id="selectVisible" class="link-button" type="button">Выбрать видимые</button>
          <button id="clearSelection" class="link-button" type="button">Снять выбор</button>
        </div>
      </div>
      <div id="list" class="list"></div>
      <div id="empty" class="empty">Ничего не найдено</div>
      <div id="status" class="status"></div>
      <div class="footer">
        <button id="cancel" type="button">Отмена</button>
        <button id="submit" class="primary" type="button" disabled>Добавить заявки</button>
      </div>
    </div>
    <script>
      const initiators = ${initiatorsJson};
      const list = document.getElementById('list');
      const empty = document.getElementById('empty');
      const search = document.getElementById('search');
      const counter = document.getElementById('counter');
      const submit = document.getElementById('submit');
      const status = document.getElementById('status');
      const selected = new Set();

      function normalize(value) {
        return String(value || '').trim().toLocaleLowerCase('ru-RU');
      }

      function render() {
        const query = normalize(search.value);
        const fragment = document.createDocumentFragment();
        let visibleCount = 0;

        list.textContent = '';
        initiators.forEach(name => {
          if (query && !normalize(name).includes(query)) return;
          visibleCount += 1;

          const label = document.createElement('label');
          label.className = 'item';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = selected.has(name);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) selected.add(name);
            else selected.delete(name);
            updateState();
          });

          const text = document.createElement('span');
          text.textContent = name;

          label.appendChild(checkbox);
          label.appendChild(text);
          fragment.appendChild(label);
        });

        list.appendChild(fragment);
        empty.style.display = visibleCount ? 'none' : 'block';
      }

      function updateState() {
        counter.textContent = 'Выбрано: ' + selected.size;
        submit.disabled = selected.size === 0;
      }

      function getVisibleNames() {
        const query = normalize(search.value);
        return initiators.filter(name => !query || normalize(name).includes(query));
      }

      search.addEventListener('input', render);
      document.getElementById('selectVisible').addEventListener('click', () => {
        getVisibleNames().forEach(name => selected.add(name));
        render();
        updateState();
      });
      document.getElementById('clearSelection').addEventListener('click', () => {
        selected.clear();
        render();
        updateState();
      });
      document.getElementById('cancel').addEventListener('click', () => google.script.host.close());
      submit.addEventListener('click', () => {
        status.textContent = '';
        submit.disabled = true;
        submit.textContent = 'Добавляю...';
        google.script.run
          .withSuccessHandler(result => {
            status.style.color = '#188038';
            status.textContent = 'Добавлено заявок: ' + (result && result.added ? result.added : 0);
            setTimeout(() => google.script.host.close(), 500);
          })
          .withFailureHandler(error => {
            status.style.color = '#d93025';
            status.textContent = error && error.message ? error.message : 'Не удалось добавить заявки.';
            submit.textContent = 'Добавить заявки';
            updateState();
          })
          .appendMissingNewRequestsByInitiators(Array.from(selected));
      });

      render();
      updateState();
    </script>
  </body>
</html>`;
}

/* ==========================================================
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Шаблоны, Форматирование)
 * ========================================================== */

const LOG_LINE_CHECK = /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\/.*$/;

/* ==========================================================
 * ФОРМАТИРОВАНИЕ (onEdit)
 * Всегда добавляет пустую строку в конце
 * ========================================================== */
function _formatInfoRangeSimple_(range, suppVals) {
  const rtvs = range.getRichTextValues();
  const tz   = range.getSheet().getParent().getSpreadsheetTimeZone();

  const normal    = SpreadsheetApp.newTextStyle().setBold(false).setFontSize(10).build();
  const suppStyle = SpreadsheetApp.newTextStyle().setBold(true).setFontSize(11).build();
  const logStyle  = SpreadsheetApp.newTextStyle().setBold(true).build();

  const result = [];

  for (let i = 0; i < rtvs.length; i++) {
    const val = rtvs[i][0].getText();
    if (!val) {
      result.push([rtvs[i][0]]);
      continue;
    }

    const numsText = (suppVals && suppVals[i] && suppVals[i][0]) ? suppVals[i][0].toString() : '';
    const validHeaders = new Set(
      numsText.split('\n')
      .map(s => s.trim())
      .filter(s => s && s !== '–')
    );
    validHeaders.add('ИТИЛ');

    // Парсинг + Сортировка
    let processedText = _processAndSortInfoCell_(val, validHeaders, tz);

    // ВАЖНО: Всегда добавляем отступ в конце
    if (processedText.length > 0) {
       processedText = processedText.trim() + '\n\n';
    }

    const builder = SpreadsheetApp.newRichTextValue().setText(processedText);
    builder.setTextStyle(0, processedText.length, normal);

    _applyStylesByLineScan_(builder, processedText, validHeaders, suppStyle, logStyle);

    result.push([builder.build()]);
  }

  range.setRichTextValues(result);
}

/* ==========================================================
 * ЛОГИКА СОРТИРОВКИ (ИСПРАВЛЕННАЯ V3)
 * Сохраняет отступы после "пустых" заголовков
 * ========================================================== */
function _processAndSortInfoCell_(text, validHeaders, tz) {
  if (!text) return '';

  const lines = text.replace(/\r/g, '').split('\n');

  let blocks = [];
  let currentBlock = { header: null, rawLines: [] };

  // Разбивка на блоки
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isHeader = validHeaders.has(line) ||
                     /^ЗНО\s+[\d-]+/.test(line) ||
                     /^ЗНР-С-[\w-]+/.test(line);

    if (isHeader) {
      blocks.push(currentBlock);
      currentBlock = { header: line, rawLines: [] };
    } else {
      currentBlock.rawLines.push(lines[i]);
    }
  }
  blocks.push(currentBlock);

  // Сборка
  let finalResult = [];

  blocks.forEach(block => {
    // Пропускаем совсем пустые блоки (обычно самый первый, если текст начинался с номера)
    if (!block.header && block.rawLines.length === 0) return;

    const processedContent = _extractLogsFromBlock_(block.rawLines, tz);

    // 1. Добавляем заголовок
    if (block.header) {
      finalResult.push(block.header);
    }

    // 2. Добавляем контент
    if (processedContent.length > 0) {
      finalResult.push(processedContent);
    } else if (block.header) {
      // ХИТРОСТЬ: Если есть заголовок, но нет контента -> добавляем пустую строку в массив.
      // При join('\n\n') это создаст эффект: "Заголовок\n\n" (пустая строка после заголовка)
      finalResult.push('');
    }
  });

  // Собираем через двойной перенос.
  // trim() в конце убирает висячие переносы самого последнего блока,
  // но логика в _syncSuppNumbersIntoInfo_ (выше) вернет их обратно, если нужно.
  return finalResult.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ==========================================================
 * ПАРСЕР БЛОКА (FINAL V3: Контекст отправителя + Сортировка)
 * ========================================================== */
function _extractLogsFromBlock_(lines, tz) {
  const logs = [];
  const looseText = [];

  let buffer = [];
  let lastLog = null;
  let currentDateStr = null;

  // КОНТЕКСТ: Запоминаем последнего отправителя и получателя
  // { sender:Str, suffix:Str }
  let lastChatContext = null;

  // СЧЕТЧИК: Для сохранения порядка сообщений внутри одной минуты
  let logCount = 0;

  // Regex definitions
  const reLogHeader = /^(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2})\s+\/.*$/;
  const reDate      = /^(Сегодня|\d{2}\.\d{2}\.\d{4})$/i;
  const reTime      = /^(\d{1,2}:\d{2}(:\d{2})?)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. ДАТА (Сброс контекста)
    if (reDate.test(line)) {
      if (lastLog) {
        lastLog.originalIndex = logCount++;
        logs.push(lastLog);
        lastLog = null;
      }
      if (buffer.length) { looseText.push(buffer.join('\n')); buffer = []; }

      let dStr = line;
      if (dStr.toLowerCase() === 'сегодня') {
        dStr = Utilities.formatDate(new Date(), tz || 'GMT+3', 'dd.MM.yyyy');
      }
      currentDateStr = dStr;

      // Сбрасываем контекст отправителя при смене даты
      lastChatContext = null;
      continue;
    }

    // 2. ГОТОВЫЙ ЛОГ (Сброс контекста)
    const logMatch = line.match(reLogHeader);
    if (logMatch) {
      if (lastLog) {
        lastLog.originalIndex = logCount++;
        logs.push(lastLog);
        lastLog = null;
      }
      if (buffer.length) { looseText.push(buffer.join('\n')); buffer = []; }

      lastLog = {
        dateObj: _parseLogDate_(logMatch[1]),
        text: line
        // originalIndex добавим при пуше
      };

      // Если встретили готовый лог — цепочка "сырого" чата прервалась
      lastChatContext = null;
      continue;
    }

    // 3. ВРЕМЯ (Конец сообщения)
    if (!lastLog && reTime.test(line)) {
      const timeStr = line;

      if (buffer.length > 0) {
        const dateUse = currentDateStr || Utilities.formatDate(new Date(), tz || 'GMT+3', 'dd.MM.yyyy');

        const arrowIdx = buffer.findIndex(s => s === '→' || s === '->');

        let headerSuffix = '';
        let sender = '';
        let body = '';

        // СЦЕНАРИЙ А: Есть явная стрелка -> Это начало новой цепочки или явный ответ
        if (arrowIdx > 0) {
          sender = buffer[0];
          const recipient = buffer.slice(1, arrowIdx).join(' ');
          if (recipient) headerSuffix = ` → ${recipient}`;
          body = buffer.slice(arrowIdx + 1).join('\n');

          // Обновляем контекст для будущих сообщений
          lastChatContext = { sender: sender, suffix: headerSuffix };
        }
        // СЦЕНАРИЙ Б: Стрелки нет -> Проверяем контекст
        else {
          // Если у нас УЖЕ есть контекст (предыдущее сообщение было распарсено)
          // и буфер выглядит просто как текст (без явных признаков заголовка)
          if (lastChatContext) {
             sender = lastChatContext.sender;
             headerSuffix = lastChatContext.suffix;
             // Весь буфер считаем текстом сообщения
             body = buffer.join('\n');
          }
          // Если контекста нет (первое сообщение без стрелки)
          else {
             sender = buffer[0];
             body = buffer.slice(1).join('\n');
             // Запоминаем этот контекст (без получателя)
             lastChatContext = { sender: sender, suffix: '' };
          }
        }

        let fullTime = timeStr;
        if (fullTime.split(':').length === 2) fullTime += ':00';
        const dateTimeStr = `${dateUse} ${fullTime}`;

        logs.push({
          dateObj: _parseLogDate_(dateTimeStr),
          text: `${dateTimeStr} / ${sender} /${headerSuffix}\n${body}`,
          originalIndex: logCount++
        });

        buffer = [];
      } else {
        looseText.push(timeStr);
      }
      continue;
    }

    // 4. ТЕКСТ
    if (lastLog) {
      lastLog.text += '\n' + line;
    } else {
      buffer.push(line);
    }
  }

  // Сохраняем остатки
  if (lastLog) {
    lastLog.originalIndex = logCount++;
    logs.push(lastLog);
  }
  if (buffer.length) looseText.push(buffer.join('\n'));

  // --- СОРТИРОВКА ---
  logs.sort((a, b) => {
    // 1. По времени (Новые выше)
    const timeDiff = b.dateObj - a.dateObj;
    if (timeDiff !== 0) return timeDiff;

    // 2. Если время совпадает -> по исходному порядку (Кто был ниже в чате, тот станет выше в логе)
    return b.originalIndex - a.originalIndex;
  });

  // Сборка результата
  const resultParts = [];
  if (looseText.length) resultParts.push(looseText.join('\n'));
  logs.forEach(l => resultParts.push(l.text));

  return resultParts.join('\n\n');
}

/**
 * Парсит дату "DD.MM.YYYY HH:mm:ss"
 */
function _parseLogDate_(str) {
  if (!str) return new Date(0);
  try {
    const parts = str.split(' ');
    const dateParts = parts[0].split('.');
    const timeParts = parts[1].split(':');
    return new Date(
      parseInt(dateParts[2], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[0], 10),
      parseInt(timeParts[0], 10),
      parseInt(timeParts[1], 10),
      (timeParts[2] ? parseInt(timeParts[2], 10) : 0)
    );
  } catch(e) {
    return new Date(0);
  }
}

// Хелпер: Исправляет отступы (удаляет \r, ставит \n)
function _fixLogSpacing_(text) {
  if (!text) return '';
  const lines = text.replace(/\r/g, '').split('\n');
  const cleanLines = lines.map(l => l.trim()).filter(l => l !== '');

  if (cleanLines.length === 0) return '';

  let newText = cleanLines[0];
  for (let i = 1; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    if (LOG_LINE_CHECK.test(line)) {
      newText += '\n\n' + line;
    } else {
      newText += '\n' + line;
    }
  }
  return newText + '\n';
}

/**
 * Универсальная функция применения стилей (построчное сканирование)
 */
function _applyStylesByLineScan_(builder, text, setNumbers, suppStyle, logStyle) {
  if (!text) return;
  const len = text.length;
  let pos = 0;

  while (pos < len) {
    const nextNewline = text.indexOf('\n', pos);
    const end = (nextNewline === -1) ? len : nextNewline;

    const line = text.substring(pos, end);
    const trimmed = line.trim();

    // Проверка 1: Это номер СУПП ИЛИ строка строго равна "ИТИЛ"? -> suppStyle (Bold + 11)
    // trimmed === 'ИТИЛ' обеспечивает точное совпадение (без лишнего текста)
    if ((setNumbers && setNumbers.has(trimmed)) || trimmed === 'ИТИЛ') {
       if (end > pos) {
         try { builder.setTextStyle(pos, end, suppStyle); } catch (e) {}
       }
    }
    // Проверка 2: Это строка лога? -> logStyle (Bold)
    else if (logStyle && LOG_LINE_CHECK.test(trimmed)) {
       if (end > pos) {
         try { builder.setTextStyle(pos, end, logStyle); } catch (e) {}
       }
    }

    pos = end + 1;
  }
}

function applyTemplatesToRows(sh, rowsArray) {
  if (!rowsArray || !rowsArray.length) return;

  const ss = sh.getParent();
  const lastCol = sh.getLastColumn();

  const colStage      = getColByHeader(sh, 'Текущий этап');
  const colDateChange = getColByHeader(sh, 'Дата смены этапа');
  const colPrevStatus = getColByHeader(sh, 'Предыдущий статус');
  const colTicket     = getColByHeader(sh, 'Номер ITIL');
  const colNumSupp    = getColByHeader(sh, 'Номер СУПП (последний)');
  const colDateSupp   = getColByHeader(sh, 'Дата состояния в СУПП');
  const cInfo         = getColByHeader(sh, INFO_HEADER);

  if (!colStage || !colDateChange || !colPrevStatus) return;

  rowsArray.sort((a,b)=>a-b);
  const groups=[], s0=rowsArray[0]; let s=s0, p=s0, c=1;
  for (let k=1;k<rowsArray.length;k++){
    if (rowsArray[k]===p+1){p=rowsArray[k];c++;}
    else{groups.push({start:s,count:c});s=rowsArray[k];p=s;c=1;}
  }
  groups.push({start:s,count:c});

  const it = ss.getSheetByName('ITIL');
  let fNum = _=>'–', fDate = _=>null;
  if (it) {
      const cTicket = getColByHeader(it, 'Номер');
      const cNum    = getColByHeader(it, 'Номер заявки в СУПП');
      const cDate   = getColByHeader(it, 'Дата состояния заявки СУПП');
      if (cTicket && cNum && cDate) {
        const n = it.getLastRow() - 1;
        if (n>0) {
          const tickets = it.getRange(2, cTicket, n, 1).getValues();
          const nums    = it.getRange(2, cNum, n, 1).getValues();
          const dates   = it.getRange(2, cDate, n, 1).getValues();
          const numByTicket = {}, dateByTicket = {};
          for (let i = 0; i < n; i++) {
            const t = tickets[i][0];
            if (t) { numByTicket[t] = nums[i][0]||'–'; dateByTicket[t] = dates[i][0]||null; }
          }
          fNum = t => numByTicket[t]??'–';
          fDate = t => dateByTicket[t]??null;
        }
      }
  }

  const tpl = sh.getRange(2, 1, 1, lastCol);
  const tplF = tpl.getFormulasR1C1()[0];
  const skip = [colDateChange, colPrevStatus, colNumSupp, colDateSupp, colTicket];

  groups.forEach(g => {
    tpl.copyTo(sh.getRange(g.start, 1, g.count, lastCol), {formatOnly: true});
    tplF.forEach((f, i) => {
      const col = i + 1;
      if (!f || skip.indexOf(col) > -1) return;
      sh.getRange(g.start, col, g.count, 1).setFormulasR1C1(Array(g.count).fill([f]));
    });

    sh.getRange(g.start, colDateChange, g.count, 1).setValues(Array(g.count).fill([new Date()]));
    const ist = sh.getRange(g.start, colStage, g.count, 1).getValues();
    sh.getRange(g.start, colPrevStatus, g.count, 1).setValues(ist);

    if (it) {
      const nums = [], dates = [];
      for (let m = 0; m < g.count; m++) {
        const ticket = sh.getRange(g.start + m, colTicket).getValue();
        nums.push([fNum(ticket)]);
        dates.push([fDate(ticket)]);
      }
      if (colNumSupp) sh.getRange(g.start, colNumSupp, g.count, 1).setValues(nums);
      if (colDateSupp) sh.getRange(g.start, colDateSupp, g.count, 1).setValues(dates);
    }

    SpreadsheetApp.flush();
    if (cInfo) _syncSuppNumbersIntoInfo_(sh, g.start, g.count, colNumSupp, cInfo);
  });
}

/* ==========================================================
 * ОЧЕРЕДЬ МОДАЛЬНЫХ ОКОН
 * ========================================================== */
const PROBLEM_QUEUE_KEY       = 'PROBLEM_QUEUE_V1';
const PROBLEM_MODAL_STATE_KEY = 'PROBLEM_MODAL_STATE_V1';
const PROBLEM_PENDING_KEY     = 'PROBLEM_PENDING_V1';
const PROBLEM_MODAL_TTL_MS    = 2 * 60 * 1000; // 2 минуты

function _userProps_() { return PropertiesService.getUserProperties(); }

function _pendingProblemKey_(sheetName, row) {
  return `${sheetName}::${row}`;
}

function _getPendingProblemMap_() {
  const raw = _userProps_().getProperty(PROBLEM_PENDING_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function _savePendingProblemMap_(map) {
  const keys = Object.keys(map);
  if (!keys.length) {
    _userProps_().deleteProperty(PROBLEM_PENDING_KEY);
    return;
  }
  _userProps_().setProperty(PROBLEM_PENDING_KEY, JSON.stringify(map));
}

function _getPendingProblemRowsForSheet_(sheetName) {
  const map = _getPendingProblemMap_();
  const rows = new Set();

  Object.keys(map).forEach(key => {
    const item = map[key];
    if (item && item.sheet === sheetName && Number.isFinite(Number(item.row))) {
      rows.add(Number(item.row));
    }
  });

  return rows;
}

function _markProblemPending_(sheetName, row, value) {
  const map = _getPendingProblemMap_();
  map[_pendingProblemKey_(sheetName, row)] = {
    sheet: sheetName,
    row,
    value,
    ts: Date.now()
  };
  _savePendingProblemMap_(map);
}

function _clearProblemPending_(sheetName, row) {
  const map = _getPendingProblemMap_();
  delete map[_pendingProblemKey_(sheetName, row)];
  _savePendingProblemMap_(map);
}

function _rangeTouchesColumn_(range, column) {
  const start = range.getColumn();
  const end = start + range.getNumColumns() - 1;
  return column >= start && column <= end;
}

function _collectProblemRowsFromEditedRange_(sheet, range, colText, colProb) {
  const startRow = Math.max(2, range.getRow());
  const endRow = range.getRow() + range.getNumRows() - 1;
  if (endRow < startRow) return [];

  const numRows = endRow - startRow + 1;
  const textVals = sheet.getRange(startRow, colText, numRows, 1).getDisplayValues();
  const probVals = sheet.getRange(startRow, colProb, numRows, 1).getDisplayValues();
  const pendingRows = _getPendingProblemRowsForSheet_(sheet.getName());
  const rows = [];

  for (let i = 0; i < numRows; i++) {
    const text = String(textVals[i][0] || '').trim();
    const prob = String(probVals[i][0] || '').trim();
    const row = startRow + i;
    if (text && !prob && !pendingRows.has(row)) rows.push(row);
  }

  return rows;
}

function _collectProblemRowsFromSheet_(sheet) {
  const colText = getColByHeader(sheet, TEXT_HEADER);
  const colProb = getColByHeader(sheet, PROBLEM_HEADER);
  const lastRow = sheet.getLastRow();
  if (!colText || !colProb || lastRow < 2) return [];

  const numRows = lastRow - 1;
  const textVals = sheet.getRange(2, colText, numRows, 1).getDisplayValues();
  const probVals = sheet.getRange(2, colProb, numRows, 1).getDisplayValues();
  const pendingRows = _getPendingProblemRowsForSheet_(sheet.getName());
  const rows = [];

  for (let i = 0; i < numRows; i++) {
    const text = String(textVals[i][0] || '').trim();
    const prob = String(probVals[i][0] || '').trim();
    const row = i + 2;
    if (text && !prob && !pendingRows.has(row)) rows.push(row);
  }

  return rows;
}

function _withProblemLock_(fn) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) return null;
  try { return fn(); }
  finally { lock.releaseLock(); }
}

function _normalizeProblemQueueMeta_(q) {
  const rows = Array.from(new Set(
    (q && Array.isArray(q.rows) ? q.rows : [])
      .map(v => parseInt(v, 10))
      .filter(v => Number.isFinite(v) && v >= 2)
  )).sort((a, b) => a - b);

  let done = Number(q && q.done);
  if (!Number.isFinite(done) || done < 0) done = 0;
  done = Math.floor(done);

  return {
    sheet: q && q.sheet ? String(q.sheet) : '',
    rows,
    done,
    total: done + rows.length
  };
}

function _getModalState_() {
  const raw = _userProps_().getProperty(PROBLEM_MODAL_STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function _isModalOpenFor_(sheet, row) {
  const st = _getModalState_();
  if (!st || !st.sheet || !st.row || !st.ts) return false;

  if (Date.now() - st.ts > PROBLEM_MODAL_TTL_MS) {
    _userProps_().deleteProperty(PROBLEM_MODAL_STATE_KEY);
    return false;
  }
  return st.sheet === sheet && st.row === row;
}

function _setModalOpenFor_(sheet, row) {
  _userProps_().setProperty(PROBLEM_MODAL_STATE_KEY, JSON.stringify({
    sheet, row, ts: Date.now()
  }));
}

function _clearModalState_() {
  _userProps_().deleteProperty(PROBLEM_MODAL_STATE_KEY);
}

// дергается из HTML при закрытии/перезагрузке модалки
function problemPickerClosed() {
  _clearModalState_();
}

function _saveProblemQueueState_(q) {
  const normalized = _normalizeProblemQueueMeta_(q);
  if (!normalized.sheet || !normalized.rows.length) {
    _userProps_().deleteProperty(PROBLEM_QUEUE_KEY);
    return null;
  }

  _userProps_().setProperty(PROBLEM_QUEUE_KEY, JSON.stringify({
    sheet: normalized.sheet,
    rows: normalized.rows,
    done: normalized.done
  }));

  return normalized;
}

function _getNextProblemItemFromQueueUnlocked_() {
  const u = _userProps_();
  const raw = u.getProperty(PROBLEM_QUEUE_KEY);
  if (!raw) return null;

  let q;
  try { q = JSON.parse(raw); }
  catch (_) {
    u.deleteProperty(PROBLEM_QUEUE_KEY);
    _clearModalState_();
    return null;
  }

  q = _normalizeProblemQueueMeta_(q);

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(q.sheet);
  if (!sh) {
    u.deleteProperty(PROBLEM_QUEUE_KEY);
    _clearModalState_();
    return null;
  }

  const colText = getColByHeader(sh, TEXT_HEADER);
  const colProb = getColByHeader(sh, PROBLEM_HEADER);
  if (!colText || !colProb) {
    u.deleteProperty(PROBLEM_QUEUE_KEY);
    _clearModalState_();
    return null;
  }

  while (q.rows.length > 0) {
    const row = q.rows[0];
    const text = String(sh.getRange(row, colText).getDisplayValue() || '').trim();
    const prob = String(sh.getRange(row, colProb).getDisplayValue() || '').trim();

    if (text && !prob) {
      _saveProblemQueueState_(q);
      return {
        sheet: q.sheet,
        row,
        text,
        prob,
        queueIndex: q.done + 1,
        queueTotal: q.total
      };
    }

    q.rows.shift();
  }

  u.deleteProperty(PROBLEM_QUEUE_KEY);
  _clearModalState_();
  return null;
}

function _startProblemQueue_(sheetName, rows) {
  return _withProblemLock_(() => {
    const u = _userProps_();
    let currentQueue = [];
    let currentDone = 0;
    const raw = u.getProperty(PROBLEM_QUEUE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.sheet === sheetName) {
          const normalized = _normalizeProblemQueueMeta_(parsed);
          currentQueue = normalized.rows;
          currentDone = normalized.done;
        }
      } catch (e) {}
    }

    const combined = Array.from(new Set([...currentQueue, ...rows])).sort((a, b) => a - b);
    if (!combined.length) return false;

    _saveProblemQueueState_({
      sheet: sheetName,
      rows: combined,
      done: currentDone
    });

    // ВАЖНО: показываем только если нет уже "открытой" модалки (иначе второй onEdit не будет плодить окна)
    const st = _getModalState_();
    if (st && (Date.now() - st.ts <= PROBLEM_MODAL_TTL_MS)) return true;

    return _showProblemFromQueueUnlocked_();
  });
}

function _showProblemFromQueue_() {
  return _withProblemLock_(() => _showProblemFromQueueUnlocked_());
}

function _showProblemFromQueueUnlocked_() {
  const item = _getNextProblemItemFromQueueUnlocked_();
  if (!item) return false;

  if (_isModalOpenFor_(item.sheet, item.row)) return true;

  _setModalOpenFor_(item.sheet, item.row);
  showProblemPicker(item);
  return true;
}

function _resumeProblemQueueIfAny_(sheetName) {
  return _withProblemLock_(() => {
    const u = _userProps_();
    const raw = u.getProperty(PROBLEM_QUEUE_KEY);
    if (!raw) return false;

    let q;
    try { q = JSON.parse(raw); } catch (_) { return false; }
    if (q.sheet === sheetName) return _showProblemFromQueueUnlocked_();
    return false;
  });
}

function showProblemPicker(item) {
  const tmpl = HtmlService.createTemplateFromFile('problemPicker');
  tmpl.options = PROBLEM_OPTIONS;
  tmpl.initialItemJson = JSON.stringify(item).replace(/<\//g, '<\\/');

  const html = tmpl.evaluate()
                   .setWidth(1000)
                   .setHeight(650)
                   .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Классификация проблемы');
}

/* ==========================================================
 * ФУНКЦИЯ: Сохранение (БЫСТРАЯ ВЕРСИЯ)
 * Очистка текста вынесена в фоновый вызов
 * ========================================================== */
function saveProblemAndContinue(row, value) {
  return _withProblemLock_(() => {
    const u = _userProps_();
    const raw = u.getProperty(PROBLEM_QUEUE_KEY);
    if (!raw) return { done: true };

    let q;
    try { q = JSON.parse(raw); } catch (_) { return { done: true }; }

    q = _normalizeProblemQueueMeta_(q);

    const sh = SpreadsheetApp.getActive().getSheetByName(q.sheet);
    if (!sh) {
      u.deleteProperty(PROBLEM_QUEUE_KEY);
      _clearModalState_();
      return { done: true };
    }

    // 1) Быстро снимаем строку с очереди и резервируем фоновое сохранение
    const idx = q.rows.indexOf(row);
    if (idx !== -1) q.rows.splice(idx, 1);
    q.done += 1;
    _markProblemPending_(q.sheet, row, value);

    const task = { sheet: q.sheet, row, value };

    const saved = _saveProblemQueueState_(q);
    if (!saved) {
      _clearModalState_();
      return {
        done: true,
        task,
        queueIndex: q.done,
        queueTotal: q.done
      };
    }

    const nextItem = _getNextProblemItemFromQueueUnlocked_();
    if (!nextItem) {
      u.deleteProperty(PROBLEM_QUEUE_KEY);
      _clearModalState_();
      return {
        done: true,
        task,
        queueIndex: q.done,
        queueTotal: q.done
      };
    }

    _setModalOpenFor_(nextItem.sheet, nextItem.row);
    return {
      done: false,
      task,
      item: nextItem
    };
  });
}

function finalizeProblemSelection(sheetName, row, value) {
  try {
    _withProblemLock_(() => {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(sheetName);
      if (!sh) throw new Error(`Лист не найден: ${sheetName}`);

      const colProb = getColByHeader(sh, PROBLEM_HEADER);
      if (!colProb) throw new Error(`Не найдена колонка «${PROBLEM_HEADER}»`);

      sh.getRange(row, colProb).setValue(value);
      _clearProblemPending_(sheetName, row);
      return true;
    });
  } catch (e) {
    _clearProblemPending_(sheetName, row);
    _startProblemQueue_(sheetName, [row]);
    console.error('Ошибка фонового сохранения проблемы', e);
    showToast(`Ошибка фонового сохранения строки ${row}. Строка возвращена в очередь.`, 6, 'Классификация');
  }
}

function processUnclassifiedRequests() {
  const sh = SpreadsheetApp.getActiveSheet();
  const name = sh.getName();

  if (name !== 'Заявки' && name !== 'Заявки (наши)') {
    showToast('Открой лист «Заявки» или «Заявки (наши)»', 5, 'Классификация');
    return;
  }

  showToast('📋 Собираю неклассифицированные заявки…', 20, 'Классификация');
  const rows = _collectProblemRowsFromSheet_(sh);

  if (rows.length > 0) {
    _startProblemQueue_(name, rows);
    showToast(`В очередь добавлено строк: ${rows.length}`, 4, 'Классификация');
    return;
  }

  if (_resumeProblemQueueIfAny_(name)) return;

  showToast('Неклассифицированных заявок не найдено', 4, 'Классификация');
}

/* ==========================================================
 * ОСТАЛЬНЫЕ УТИЛИТЫ (Highlights, Delete, Sync)
 * ========================================================== */

function refreshHighlights() {
  const ss = SpreadsheetApp.getActive();
  ['Заявки', 'Заявки (наши)'].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() <= 2) return;
    const cT = getColByHeader(sh, 'Номер ITIL');
    const cD = getColByHeader(sh, 'Дата состояния в СУПП');
    const cN = getColByHeader(sh, 'Номер СУПП (последний)');
    const cR = getColByHeader(sh, 'Пришел новый ответ');
    if (!cT || !cD || !cN || !cR) return;

    const it = ss.getSheetByName('ITIL');
    if (!it) return;
    const cTicketIt = getColByHeader(it, 'Номер');
    const cNumSupp  = getColByHeader(it, 'Номер заявки в СУПП');
    const cDateSupp = getColByHeader(it, 'Дата состояния заявки СУПП');
    if (!cTicketIt || !cNumSupp || !cDateSupp) return;

    const nIt = it.getLastRow() - 1;
    if (nIt <= 0) return;
    const tickets = it.getRange(2, cTicketIt, nIt, 1).getValues();
    const nums    = it.getRange(2, cNumSupp , nIt, 1).getValues();
    const dates   = it.getRange(2, cDateSupp, nIt, 1).getValues();
    const numByTicket = {}, dateByTicket = {};
    for (let i = 0; i < nIt; i++) {
      const t = tickets[i][0];
      if (!t) continue;
      numByTicket[t]  = nums[i][0]  || '–';
      dateByTicket[t] = dates[i][0] || null;
    }

    const nRows = sh.getLastRow() - 1;
    const T  = sh.getRange(2, cT, nRows, 1).getValues();
    const oD = sh.getRange(2, cD, nRows, 1).getValues();
    const oN = sh.getRange(2, cN, nRows, 1).getValues();
    const oDb = sh.getRange(2, cD, nRows, 1).getBackgrounds();
    const oNb = sh.getRange(2, cN, nRows, 1).getBackgrounds();
    const oRb = sh.getRange(2, cR, nRows, 1).getBackgrounds();

    const nD = [], nDb = [], nN = [], nNb = [], nRb = [];

    for (let i = 0; i < nRows; i++) {
      const ticket = T[i][0];
      const newDate = dateByTicket[ticket] || null;
      const oldDate = oD[i][0];
      const needDateUpdate = newDate instanceof Date && (!(oldDate instanceof Date) || newDate.getTime() !== oldDate.getTime());
      if (needDateUpdate) {
        nD.push([newDate]); nDb.push([oDb[i][0]]); nRb.push(['#00ff00']);
      } else {
        nD.push([oldDate]); nDb.push([oDb[i][0]]); nRb.push([oRb[i][0]]);
      }

      const newNum = numByTicket[ticket] || '–';
      const curr   = oN[i][0] ? oN[i][0].toString() : '';
      const last   = curr.replace(/\r\n?/g,'\n').split('\n').pop();
      if (newNum !== last) {
        nN.push([curr ? curr + '\n' + newNum : newNum]); nNb.push(['#00ff00']);
      } else {
        nN.push([oN[i][0]]); nNb.push([oNb[i][0]]);
      }
    }
    sh.getRange(2, cD, nRows, 1).setValues(nD).setBackgrounds(nDb);
    sh.getRange(2, cN, nRows, 1).setValues(nN).setBackgrounds(nNb);
    sh.getRange(2, cR, nRows, 1).setBackgrounds(nRb);
    SpreadsheetApp.flush();
  });
  forceSyncInfoAll(false);
}

function deleteMarkedRows() {
  showToast('🚀 Оптимизация и удаление строк…', 60, 'Чистка');
  const ss = SpreadsheetApp.getActive();
  const targets = [
    { name: 'Заявки',        criteria: ['Дубликат', 'На удаление'] },
    { name: 'Заявки (наши)', criteria: ['Дубликат'] }
  ];

  targets.forEach(target => {
    const sh = ss.getSheetByName(target.name);
    if (!sh || sh.getLastRow() < 2) return;
    const lastRow = sh.getLastRow();
    const rangeStatus = sh.getRange(2, 1, lastRow - 1, 1);
    const vals = rangeStatus.getValues();
    const critSet = new Set(target.criteria);
    const hasRowsToDelete = vals.some(row => critSet.has(row[0]));

    if (!hasRowsToDelete) return;
    const lastCol = sh.getLastColumn();
    sh.insertColumnAfter(lastCol);
    const helperCol = lastCol + 1;
    const indices = vals.map((_, i) => [i]);
    sh.getRange(2, helperCol, lastRow - 1, 1).setValues(indices);

    const fullRange = sh.getRange(2, 1, lastRow - 1, helperCol);
    fullRange.sort({column: 1, ascending: true});
    const sortedVals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    const rowsToDelete = [];
    for (let i = 0; i < sortedVals.length; i++) {
      if (critSet.has(sortedVals[i][0])) rowsToDelete.push(i + 2);
    }
    if (rowsToDelete.length > 0) {
      rowsToDelete.sort((a, b) => a - b);
      const segments = [];
      let start = rowsToDelete[0], prev = start, count = 1;
      for (let k = 1; k < rowsToDelete.length; k++) {
        if (rowsToDelete[k] === prev + 1) { prev = rowsToDelete[k]; count++; }
        else { segments.push({ start: start, count: count }); start = rowsToDelete[k]; prev = start; count = 1; }
      }
      segments.push({ start: start, count: count });
      for (let j = segments.length - 1; j >= 0; j--) sh.deleteRows(segments[j].start, segments[j].count);
    }
    const newLastRow = sh.getLastRow();
    if (newLastRow >= 2) sh.getRange(2, 1, newLastRow - 1, helperCol).sort({column: helperCol, ascending: true});
    sh.deleteColumn(helperCol);
  });
  toastDone('Быстрая чистка');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Управление заявками')
    .addItem('🔎 Найти новые заявки', 'findNewRequests')
    .addItem('📅 Найти новые заявки за период', 'findNewRequestsByPeriod')
    .addItem('👥 Найти новые заявки по инициаторам', 'showNewRequestsInitiatorPicker')
    // Старое окно problemPicker отключено. Классификацию запускает расширение.
    // .addItem('📋 Обработать не классифицированные заявки', 'processUnclassifiedRequests')
    .addItem('🗑️ Удалить помеченные строки', 'deleteMarkedRows')
    .addSeparator()
    .addItem('↔️ Синхронизировать номера в INFO (все строки)', 'forceSyncInfoAll')
    .addItem('↔️ Синхронизировать номера в INFO (выделенная строка)', 'forceSyncInfoRow')
    .addToUi();
}

function forceSyncInfoAll(silent) {
  if (!silent) showToast('↔️ Синхронизация номеров в INFO…', 30, 'INFO');
  const ss = SpreadsheetApp.getActive();
  const sheets = ['Заявки', 'Заявки (наши)'];
  let added = 0, rows = 0;
  for (const name of sheets) {
    const sh = ss.getSheetByName(name);
    if (!sh) continue;
    const cNums = getColByHeader(sh, 'Номер СУПП (последний)');
    const cInfo = getColByHeader(sh, INFO_HEADER);
    const last  = sh.getLastRow();
    if (!cNums || !cInfo || last <= 1) continue;
    const n = last - 1;
    added += _syncSuppNumbersIntoInfo_(sh, 2, n, cNums, cInfo);
    rows  += n;
  }
  if (!silent) showToast(`✅ INFO синхронизированo • добавлено «шапок»: ${added} • строк: ${rows}`, 6, 'INFO');
}

function forceSyncInfoRow() {
  const sh = SpreadsheetApp.getActiveSheet();
  const row = sh.getActiveRange().getRow();
  if (row < 2) { showToast('Выдели строку данных (>=2)', 4, 'INFO'); return; }
  const cNums = getColByHeader(sh, 'Номер СУПП (последний)');
  const cInfo = getColByHeader(sh, INFO_HEADER);
  if (!cNums || !cInfo) { showToast('Нет колонок «Номер СУПП (последний)» / «Информация из СУПП/ITIL»', 6, 'INFO'); return; }
  const added = _syncSuppNumbersIntoInfo_(sh, row, 1, cNums, cInfo);
  showToast(`Строка ${row}: добавлено «шапок» = ${added}`, 5, 'INFO');
}

/* ==========================================================
 * СИНХРОНИЗАЦИЯ НОМЕРОВ СУПП В INFO (ИСПРАВЛЕННАЯ V2)
 * Всегда добавляет пустую строку в конце для удобства ввода
 * ========================================================== */
function _syncSuppNumbersIntoInfo_(sh, startRow, nRows, colNumSupp, cInfo) {
  if (!colNumSupp || !cInfo || nRows <= 0) return 0;

  const numsVals = sh.getRange(startRow, colNumSupp, nRows, 1).getValues();
  const infoRange = sh.getRange(startRow, cInfo, nRows, 1);
  const infoRTVs = infoRange.getRichTextValues();
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();

  const normal    = SpreadsheetApp.newTextStyle().setBold(false).setFontSize(10).build();
  const suppStyle = SpreadsheetApp.newTextStyle().setBold(true).setFontSize(11).build();
  const logStyle  = SpreadsheetApp.newTextStyle().setBold(true).build();

  const resultRTVs = [];
  let totalAdded = 0;

  for (let i = 0; i < nRows; i++) {
    const rtv = infoRTVs[i] && infoRTVs[i][0] ? infoRTVs[i][0] : null;
    let currentText = (rtv ? rtv.getText() : '');

    const numsText = (numsVals[i][0] || '').toString().replace(/\r\n?/g, '\n');
    const validNumbers = Array.from(new Set(
      numsText.split('\n')
      .map(s => s.trim())
      .filter(s => s && s !== '–')
    ));

    const setNumbers = new Set(validNumbers);
    setNumbers.add('ИТИЛ');

    if (validNumbers.length > 0) {
      const missing = validNumbers.filter(num => {
        const escNum = num.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const re = new RegExp('(^|\\n|\\s)' + escNum + '(\\s|$|:|\\n)', 'i');
        return !re.test(currentText);
      });

      if (missing.length > 0) {
        totalAdded += missing.length;
        if (!currentText.trim()) {
           currentText = missing.join('\n\n') + '\n\n';
        } else {
           const prefix = currentText.endsWith('\n') ? '\n' : '\n\n';
           currentText += prefix + missing.join('\n\n') + '\n\n';
        }
      }
    }

    try {
      // 1. Форматируем и сортируем
      let processedText = _processAndSortInfoCell_(currentText, setNumbers, tz);

      // 2. ВАЖНО: Всегда добавляем отступ в конце, если текст не пустой
      if (processedText.length > 0) {
         // trim() убирает случайные пробелы, + '\n\n' создает одну пустую строку
         processedText = processedText.trim() + '\n\n';
      }

      const builder = SpreadsheetApp.newRichTextValue().setText(processedText);
      builder.setTextStyle(0, processedText.length, normal);

      _applyStylesByLineScan_(builder, processedText, setNumbers, suppStyle, logStyle);
      resultRTVs.push([builder.build()]);

    } catch (e) {
      resultRTVs.push([SpreadsheetApp.newRichTextValue().setText(currentText).build()]);
    }
  }

  infoRange.setRichTextValues(resultRTVs);
  return totalAdded;
}

function RESET_SETTINGS() {
  PropertiesService.getUserProperties().deleteAllProperties();
  SpreadsheetApp.getActive().toast('✅ Настройки сброшены', 'System');
}
