(function () {
  'use strict';

  if (window.__googleSheetsProblemPickerRun) return;
  window.__googleSheetsProblemPickerRun = true;

  const CONFIG = Object.assign({
    spreadsheetId: '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo',
    allowedSheetNames: ['Заявки', 'Заявки (наши)'],
    bridgeUrl: '',
    storageKey: 'dup_google_sheets_problem_picker_bridge_url'
  }, window.GOOGLE_SHEETS_PROBLEM_PICKER_CONFIG || {});

  const TEXT_HEADER = 'Текст заявки';
  const PROBLEM_HEADER = 'Проблемы';
  const DEFAULT_VALUE = 'Публикация/Некорректная публикация/Ошибки публикации';
  const SAVE_ACTION = 'GOOGLE_SHEETS_PROBLEM_PICKER_SAVE';
  const ITIL_FILL_ACTION = 'GOOGLE_SHEETS_ITIL_FILL_ROW';
  const SUPP_FILL_ACTION = 'GOOGLE_SHEETS_SUPP_FILL_ROW';
  const ITIL_NUMBER_HEADER = 'Номер ITIL';
  const SUPP_NUMBER_HEADER = 'Номер СУПП (последний)';
  const ITIL_INFO_HEADER = 'Информация из СУПП/ITIL';
  const NEW_RESPONSE_HEADER = 'Пришел новый ответ';
  const ROOT_ID = 'dup-google-sheets-problem-picker-root';
  const MODAL_ID = 'dup-google-sheets-problem-picker-modal';
  const MENU_ID = 'dup-google-sheets-problem-picker-menu';
  const MENU_OVERLAY_ID = 'dup-google-sheets-problem-picker-menu-overlay';
  const STYLE_ID = 'dup-google-sheets-problem-picker-style';
  const AUTO_OPEN_AFTER_EDIT_DELAY_MS = 1500;
  const AUTO_OPEN_AFTER_EDIT_COOLDOWN_MS = 2500;
  const KEY_CODE_F2 = 113;

  const OPTIONS = Object.freeze([
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
  ]);

  let state = {
    bridgeUrl: '',
    queue: [],
    currentIndex: 0,
    sentCount: 0,
    pendingSaveCount: 0,
    failedSaveCount: 0,
    lastBackgroundError: '',
    sheetName: '',
    gid: '',
    rowsCount: 0,
    columns: null,
    isLoading: false
  };

  let autoOpenTimer = 0;
  let autoOpenInProgress = false;
  let lastAutoOpenAtMs = 0;
  let menuStatusText = '';
  let menuStatusIsError = false;
  let itilRunId = 0;
  let suppRunId = 0;

  let itilState = {
    queue: [],
    currentIndex: 0,
    successCount: 0,
    failedCount: 0,
    currentItem: null,
    sheetName: '',
    gid: '',
    rowsCount: 0,
    columns: null,
    isRunning: false,
    stopRequested: false,
    pendingBridgeSaves: [],
    statusText: 'Ожидание запуска.',
    lastError: ''
  };

  let suppState = {
    queue: [],
    currentIndex: 0,
    successCount: 0,
    failedCount: 0,
    currentItem: null,
    sheetName: '',
    gid: '',
    rowsCount: 0,
    columns: null,
    isRunning: false,
    stopRequested: false,
    pendingBridgeSaves: [],
    statusText: 'Ожидание запуска.',
    lastError: ''
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const FILE_NAME_ONLY_LINE_RE = /^\s*[^\r\n\\/:*?"<>|]+\.(?:png|jpe?g|gif|bmp|webp|svg|heic|pdf|docx?|xlsx?|pptx?|txt|rtf|csv|xml|json|zip|rar|7z)\s*$/i;

  function isFileNameOnlyLine(line) {
    return !!line && FILE_NAME_ONLY_LINE_RE.test(String(line).trim());
  }

  function cleanItilMessageBodyLines(bodyLines) {
    const cleaned = [];
    let prevEmpty = false;

    for (let index = 0; index < bodyLines.length; index++) {
      const rightTrimmed = bodyLines[index].replace(/[ \t]+$/g, '');
      const trimmed = rightTrimmed.trim();

      if (isFileNameOnlyLine(trimmed)) continue;

      if (!trimmed) {
        if (!prevEmpty && cleaned.length > 0) {
          cleaned.push('');
          prevEmpty = true;
        }
        continue;
      }

      cleaned.push(rightTrimmed);
      prevEmpty = false;
    }

    while (cleaned.length && cleaned[cleaned.length - 1] === '') cleaned.pop();
    return cleaned.join('\n');
  }

  function extractFirstItilMessageBody(text) {
    if (!text) return '';

    const normalized = String(text).replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const authorLineRe = /^\s*[^\r\n()]+?\s+\(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2}\):\s*$/;

    const markers = [];
    for (let index = 0; index < lines.length; index++) {
      if (authorLineRe.test(lines[index])) {
        markers.push(index);
        if (markers.length >= 2) break;
      }
    }

    if (!markers.length) return normalized;

    const endIndex = markers.length >= 2 ? markers[1] : lines.length;
    return cleanItilMessageBodyLines(lines.slice(markers[0] + 1, endIndex));
  }

  function processRequestText(text) {
    if (!text) return '';

    let result = String(text);
    result = extractFirstItilMessageBody(result);

    const startMarker = 'Детальное описание:';
    const endMarker = 'Причина возникновения инцидента:';
    const startIdx = result.toLowerCase().indexOf(startMarker.toLowerCase());
    if (startIdx !== -1) result = result.substring(startIdx + startMarker.length);

    const endIdx = result.toLowerCase().indexOf(endMarker.toLowerCase());
    if (endIdx !== -1) result = result.substring(0, endIdx);

    result = result.replace(/ЗНО\s+[\d-]+:(?:\s+.*?\(\d{2}\.\d{2}\.\d{4}.*?\))?\s*:?\s*/gi, '');
    result = result.replace(/\r/g, '');
    result = result.replace(/[ \t]+$/gm, '');
    result = result.replace(/^\n+/, '');
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
  }

  function isTargetSpreadsheet() {
    return location.hostname === 'docs.google.com'
      && String(location.pathname || '').includes(`/spreadsheets/d/${CONFIG.spreadsheetId}/`);
  }

  function chromeStorageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      } catch (error) {
        resolve({});
      }
    });
  }

  function chromeStorageSet(values) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(values, () => resolve(true));
      } catch (error) {
        resolve(false);
      }
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : '';
          resolve(runtimeError
            ? { success: false, error: runtimeError }
            : (response || { success: false, error: 'NO_RESPONSE' }));
        });
      } catch (error) {
        resolve({ success: false, error: error && error.message ? error.message : 'SEND_FAILED' });
      }
    });
  }

  async function loadBridgeUrl() {
    const stored = await chromeStorageGet([CONFIG.storageKey]);
    state.bridgeUrl = String(stored[CONFIG.storageKey] || CONFIG.bridgeUrl || '').trim();
    return state.bridgeUrl;
  }

  async function saveBridgeUrl(url) {
    state.bridgeUrl = String(url || '').trim();
    await chromeStorageSet({ [CONFIG.storageKey]: state.bridgeUrl });
    updateLauncherStatus(state.bridgeUrl ? 'URL bridge сохранён.' : 'URL bridge очищен.', false);
    renderModal();
  }

  function getActiveSheetName() {
    const activeTab = $('.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name')
      || $('.docs-sheet-active-tab');
    return activeTab instanceof HTMLElement ? String(activeTab.textContent || '').trim() : '';
  }

  function getActiveGid() {
    const searchGid = new URLSearchParams(location.search || '').get('gid');
    if (searchGid) return String(searchGid).trim();

    const hashMatch = String(location.hash || '').match(/gid=([^&]+)/);
    return hashMatch ? decodeURIComponent(hashMatch[1]) : '';
  }

  function getCsvUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const value = String(text || '');

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];

      if (inQuotes) {
        if (ch === '"') {
          if (value[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }

    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  async function loadQueue() {
    const sheetName = getActiveSheetName();
    const allowedSheets = Array.isArray(CONFIG.allowedSheetNames) ? CONFIG.allowedSheetNames : [];
    if (!allowedSheets.includes(sheetName)) {
      throw new Error('Открой лист «Заявки» или «Заявки (наши)».');
    }

    const gid = getActiveGid();
    if (!gid) throw new Error('Не удалось определить gid активного листа.');

    const response = await fetch(getCsvUrl(gid), { credentials: 'omit' });
    if (!response.ok) throw new Error(`CSV-экспорт вернул HTTP ${response.status}.`);

    const rows = parseCsv(await response.text());
    const headers = rows[0] || [];
    const textColumnIndex = headers.indexOf(TEXT_HEADER);
    const problemColumnIndex = headers.indexOf(PROBLEM_HEADER);
    if (textColumnIndex < 0 || problemColumnIndex < 0) {
      throw new Error('Не найдены колонки «Текст заявки» или «Проблемы».');
    }

    const queue = [];
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const text = String(row[textColumnIndex] || '').trim();
      const problem = String(row[problemColumnIndex] || '').trim();

      if (text && !problem) {
        queue.push({
          row: index + 1,
          text
        });
      }
    }

    state = {
      ...state,
      queue,
      currentIndex: 0,
      sentCount: 0,
      pendingSaveCount: 0,
      failedSaveCount: 0,
      lastBackgroundError: '',
      sheetName,
      gid,
      rowsCount: rows.length,
      columns: {
        text: textColumnIndex + 1,
        problem: problemColumnIndex + 1
      },
      isLoading: false
    };
  }

  async function loadItilQueue() {
    const sheetName = getActiveSheetName();
    const allowedSheets = Array.isArray(CONFIG.allowedSheetNames) ? CONFIG.allowedSheetNames : [];
    if (!allowedSheets.includes(sheetName)) {
      throw new Error('Открой лист «Заявки» или «Заявки (наши)».');
    }

    const gid = getActiveGid();
    if (!gid) throw new Error('Не удалось определить gid активного листа.');

    const response = await fetch(getCsvUrl(gid), { credentials: 'omit' });
    if (!response.ok) throw new Error(`CSV-экспорт вернул HTTP ${response.status}.`);

    const rows = parseCsv(await response.text());
    const headers = rows[0] || [];
    const itilColumnIndex = headers.indexOf(ITIL_NUMBER_HEADER);
    const suppColumnIndex = headers.indexOf(SUPP_NUMBER_HEADER);
    const textColumnIndex = headers.indexOf(TEXT_HEADER);
    const infoColumnIndex = headers.indexOf(ITIL_INFO_HEADER);
    const responseColumnIndex = headers.indexOf(NEW_RESPONSE_HEADER);

    if (itilColumnIndex < 0 || suppColumnIndex < 0 || textColumnIndex < 0 || infoColumnIndex < 0) {
      throw new Error('Не найдены колонки «Номер ITIL», «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
    }

    const queue = [];
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const itilNumber = String(row[itilColumnIndex] || '').trim();
      const suppNumber = String(row[suppColumnIndex] || '').trim();
      const text = String(row[textColumnIndex] || '').trim();

      if (itilNumber && suppNumber === '–' && !text) {
        queue.push({
          row: index + 1,
          itilNumber
        });
      }
    }

    itilState = {
      ...itilState,
      queue,
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName,
      gid,
      rowsCount: rows.length,
      columns: {
        itil: itilColumnIndex + 1,
        supp: suppColumnIndex + 1,
        text: textColumnIndex + 1,
        info: infoColumnIndex + 1,
        response: responseColumnIndex >= 0 ? responseColumnIndex + 1 : 0
      },
      lastError: '',
      statusText: queue.length ? 'Очередь ITIL собрана.' : 'Строк для заполнения из ITIL не найдено.'
    };
  }

  function extractSuppNumber(value) {
    const text = String(value || '').replace(/\r\n?/g, '\n');
    const matches = text.match(/ЗНР-[A-Za-zА-Яа-яЁё0-9-]+/g);
    return matches && matches.length ? matches[matches.length - 1].trim() : '';
  }

  async function loadSuppQueue() {
    const sheetName = getActiveSheetName();
    const allowedSheets = Array.isArray(CONFIG.allowedSheetNames) ? CONFIG.allowedSheetNames : [];
    if (!allowedSheets.includes(sheetName)) {
      throw new Error('Открой лист «Заявки» или «Заявки (наши)».');
    }

    const gid = getActiveGid();
    if (!gid) throw new Error('Не удалось определить gid активного листа.');

    const response = await fetch(getCsvUrl(gid), { credentials: 'omit' });
    if (!response.ok) throw new Error(`CSV-экспорт вернул HTTP ${response.status}.`);

    const rows = parseCsv(await response.text());
    const headers = rows[0] || [];
    const suppColumnIndex = headers.indexOf(SUPP_NUMBER_HEADER);
    const textColumnIndex = headers.indexOf(TEXT_HEADER);
    const infoColumnIndex = headers.indexOf(ITIL_INFO_HEADER);
    const responseColumnIndex = headers.indexOf(NEW_RESPONSE_HEADER);

    if (suppColumnIndex < 0 || textColumnIndex < 0 || infoColumnIndex < 0) {
      throw new Error('Не найдены колонки «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
    }

    const queue = [];
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const suppNumber = extractSuppNumber(row[suppColumnIndex]);
      const text = String(row[textColumnIndex] || '').trim();

      if (suppNumber && !text) {
        queue.push({
          row: index + 1,
          suppNumber
        });
      }
    }

    suppState = {
      ...suppState,
      queue,
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName,
      gid,
      rowsCount: rows.length,
      columns: {
        supp: suppColumnIndex + 1,
        text: textColumnIndex + 1,
        info: infoColumnIndex + 1,
        response: responseColumnIndex >= 0 ? responseColumnIndex + 1 : 0
      },
      lastError: '',
      statusText: queue.length ? 'Очередь СУПП собрана.' : 'Строк для заполнения из СУПП не найдено.'
    };
  }

  function getCurrentItem() {
    return state.queue[state.currentIndex] || null;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{position:fixed;right:18px;bottom:58px;z-index:2147483640;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:"Segoe UI",Tahoma,sans-serif}
      #${ROOT_ID} .gs-problem-picker-actions{display:flex;gap:6px}
      #${ROOT_ID} button,#${MODAL_ID} button{border:1px solid #b7c2d3;border-radius:7px;background:#fff;color:#162033;cursor:pointer;font:600 13px/1.2 "Segoe UI",Tahoma,sans-serif;padding:8px 12px}
      #${ROOT_ID} .gs-problem-picker-open{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.24)}
      #${ROOT_ID} .gs-problem-picker-url{min-width:44px}
      #${ROOT_ID} .gs-problem-picker-status{max-width:360px;min-height:18px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.94);color:#24513a;font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.12)}
      #${ROOT_ID} .gs-problem-picker-status.is-error,#${MODAL_ID} .gs-problem-picker-message.is-error{color:#b3261e}
      #${MENU_OVERLAY_ID}{position:fixed;inset:0;z-index:2147483644;background:rgba(17,24,39,.38);font-family:"Segoe UI",Tahoma,sans-serif}
      #${MENU_ID}{position:fixed;right:24px;top:76px;z-index:2147483645;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 110px);overflow:auto;box-sizing:border-box;padding:18px;border:1px solid #d5dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.24);font-family:"Segoe UI",Tahoma,sans-serif}
      #${MENU_OVERLAY_ID}[hidden],#${MENU_ID}[hidden]{display:none!important}
      #${MENU_ID} .gs-problem-picker-menu-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      #${MENU_ID} .gs-problem-picker-menu-title{font-size:20px;line-height:1.2;font-weight:700}
      #${MENU_ID} .gs-problem-picker-menu-subtitle{margin-top:4px;color:#566176;font-size:13px}
      #${MENU_ID} .gs-problem-picker-menu-close{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${MENU_ID} .gs-problem-picker-menu-section{display:grid;gap:10px;border-top:1px solid #e3e8f0;padding-top:14px;margin-top:14px}
      #${MENU_ID} .gs-problem-picker-menu-section:first-of-type{border-top:0;padding-top:0;margin-top:0}
      #${MENU_ID} .gs-problem-picker-menu-section-title{font-size:14px;font-weight:700;color:#253044}
      #${MENU_ID} .gs-problem-picker-menu-actions{display:flex;flex-wrap:wrap;gap:8px}
      #${MENU_ID} .gs-problem-picker-itil-grid,#${MENU_ID} .gs-problem-picker-supp-grid{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;font-size:13px;color:#39465c}
      #${MENU_ID} .gs-problem-picker-itil-grid dt,#${MENU_ID} .gs-problem-picker-supp-grid dt{font-weight:700;color:#5d6678}
      #${MENU_ID} .gs-problem-picker-itil-grid dd,#${MENU_ID} .gs-problem-picker-supp-grid dd{margin:0;min-width:0;overflow-wrap:anywhere}
      #${MENU_ID} .gs-problem-picker-status{min-height:18px;color:#24513a;font-size:13px}
      #${MENU_ID} .gs-problem-picker-status.is-error,#${MENU_ID} .gs-problem-picker-itil-status.is-error,#${MENU_ID} .gs-problem-picker-supp-status.is-error{color:#b3261e}
      #${MENU_ID} .gs-problem-picker-itil-status,#${MENU_ID} .gs-problem-picker-supp-status{min-height:18px;color:#24513a;font-size:13px;overflow-wrap:anywhere}
      #${ROOT_ID} button,#${MODAL_ID} button,#${MENU_ID} button{border:1px solid #b7c2d3;border-radius:7px;background:#fff;color:#162033;cursor:pointer;font:600 13px/1.2 "Segoe UI",Tahoma,sans-serif;padding:8px 12px}
      #${MENU_ID} button:disabled{opacity:.58;cursor:default}
      #${MENU_ID} .gs-problem-picker-open,#${MENU_ID} .gs-problem-picker-itil-start,#${MENU_ID} .gs-problem-picker-supp-start,#${MENU_ID} .gs-problem-picker-supp-test{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.2)}
      #${MENU_ID} .gs-problem-picker-itil-stop,#${MENU_ID} .gs-problem-picker-supp-stop{border-color:#b3261e;color:#b3261e}
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(17,24,39,.42);font-family:"Segoe UI",Tahoma,sans-serif}
      #${MODAL_ID}[hidden],html.dup-ext-screenshot-mode #${ROOT_ID},html.dup-ext-screenshot-mode #${MODAL_ID},html.dup-ext-screenshot-mode #${MENU_ID},html.dup-ext-screenshot-mode #${MENU_OVERLAY_ID}{display:none!important}
      #${MODAL_ID} .gs-problem-picker-layout{width:min(1292px,calc(100vw - 32px));height:min(680px,calc(100vh - 32px));display:grid;grid-template-columns:minmax(0,980px) 298px;gap:14px;align-items:stretch}
      #${MODAL_ID} .gs-problem-picker-panel{width:100%;height:100%;min-width:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:14px;box-sizing:border-box;padding:22px;border:1px solid #d6dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.26)}
      #${MODAL_ID} .gs-problem-picker-header,#${MODAL_ID} .gs-problem-picker-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #${MODAL_ID} .gs-problem-picker-title{font-size:22px;line-height:1.2;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-meta,#${MODAL_ID} .gs-problem-picker-message{color:#566176;font-size:13px}
      #${MODAL_ID} .gs-problem-picker-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${MODAL_ID} .gs-problem-picker-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-text-wrap{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}
      #${MODAL_ID} .gs-problem-picker-label{color:#4b5563;font-size:13px;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-text{min-height:0;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font-size:15px;line-height:1.55}
      #${MODAL_ID} .gs-problem-picker-footer{align-items:center;border-top:1px solid #e3e8f0;padding-top:14px}
      #${MODAL_ID} .gs-problem-picker-buttons{display:flex;flex-shrink:0;gap:10px}
      #${MODAL_ID} .gs-problem-picker-category-rail{height:100%;min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;box-sizing:border-box;padding:18px;border:1px solid #d6dce8;border-radius:8px;background:#f8fafc;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.18)}
      #${MODAL_ID} .gs-problem-picker-category-title{font-size:15px;line-height:1.25;font-weight:700;color:#253044}
      #${MODAL_ID} .gs-problem-picker-category-list{min-height:0;overflow:auto;display:grid;align-content:start;gap:8px;padding-right:2px}
      #${MODAL_ID} .gs-problem-picker-category-button{width:100%;min-height:40px;text-align:left;white-space:normal;overflow-wrap:anywhere;line-height:1.25;padding:9px 10px;border-color:#cbd5e1;background:#fff;color:#172033;box-shadow:0 3px 10px rgba(15,23,42,.05)}
      #${MODAL_ID} .gs-problem-picker-category-button:hover:not(:disabled),#${MODAL_ID} .gs-problem-picker-category-button:focus-visible{border-color:#1155cc;background:#eef5ff;color:#0f3f99;outline:none}
      #${MODAL_ID} .gs-problem-picker-category-button.is-default{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.2)}
      #${MODAL_ID} .gs-problem-picker-category-button:disabled{opacity:.58;cursor:default;box-shadow:none}
      @media (max-width:1323px){
        #${MODAL_ID}{align-items:flex-start;overflow:auto;padding:16px;box-sizing:border-box}
        #${MODAL_ID} .gs-problem-picker-layout{width:min(980px,100%);height:auto;min-height:min(680px,calc(100vh - 32px));grid-template-columns:1fr;grid-template-rows:minmax(520px,680px) auto}
        #${MODAL_ID} .gs-problem-picker-category-rail{height:auto;max-height:260px}
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function updateLauncherStatus(text, isError) {
    menuStatusText = String(text || '');
    menuStatusIsError = !!isError;

    const statuses = [
      $(`#${ROOT_ID} .gs-problem-picker-status`),
      $(`#${MENU_ID} .gs-problem-picker-status`)
    ];

    statuses.forEach((status) => {
      if (!(status instanceof HTMLElement)) return;
      status.textContent = menuStatusText;
      status.classList.toggle('is-error', menuStatusIsError);
    });
  }

  function setModalMessage(text, isError) {
    const message = $(`#${MODAL_ID} .gs-problem-picker-message`);
    if (!(message instanceof HTMLElement)) return;
    message.textContent = String(text || '');
    message.classList.toggle('is-error', !!isError);
  }

  function getItilCurrentText() {
    const queuedItem = itilState.isRunning && !itilState.stopRequested ? itilState.queue[itilState.currentIndex] : null;
    const item = itilState.currentItem || queuedItem || null;
    return item ? `строка ${item.row}, ITIL ${item.itilNumber}` : 'нет';
  }

  function getSuppCurrentText() {
    const queuedItem = suppState.isRunning && !suppState.stopRequested ? suppState.queue[suppState.currentIndex] : null;
    const item = suppState.currentItem || queuedItem || null;
    return item ? `строка ${item.row}, СУПП ${item.suppNumber}` : 'нет';
  }

  function renderItilStatus() {
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const total = itilState.queue.length;
    const processed = Math.min(total, itilState.successCount + itilState.failedCount);

    const collected = $('.gs-problem-picker-itil-collected', menu);
    const progress = $('.gs-problem-picker-itil-progress', menu);
    const current = $('.gs-problem-picker-itil-current', menu);
    const status = $('.gs-problem-picker-itil-status', menu);
    const startButton = $('.gs-problem-picker-itil-start', menu);
    const stopButton = $('.gs-problem-picker-itil-stop', menu);

    if (collected instanceof HTMLElement) collected.textContent = String(total);
    if (progress instanceof HTMLElement) progress.textContent = `${processed}/${total}`;
    if (current instanceof HTMLElement) current.textContent = getItilCurrentText();
    if (status instanceof HTMLElement) {
      status.textContent = itilState.lastError || itilState.statusText || '';
      status.classList.toggle('is-error', !!itilState.lastError);
    }
    if (startButton instanceof HTMLButtonElement) startButton.disabled = itilState.isRunning || suppState.isRunning;
    if (stopButton instanceof HTMLButtonElement) stopButton.disabled = !itilState.isRunning || !!itilState.stopRequested;
  }

  function renderSuppStatus() {
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const total = suppState.queue.length;
    const processed = Math.min(total, suppState.successCount + suppState.failedCount);

    const collected = $('.gs-problem-picker-supp-collected', menu);
    const progress = $('.gs-problem-picker-supp-progress', menu);
    const current = $('.gs-problem-picker-supp-current', menu);
    const status = $('.gs-problem-picker-supp-status', menu);
    const startButton = $('.gs-problem-picker-supp-start', menu);
    const testButton = $('.gs-problem-picker-supp-test', menu);
    const stopButton = $('.gs-problem-picker-supp-stop', menu);

    if (collected instanceof HTMLElement) collected.textContent = String(total);
    if (progress instanceof HTMLElement) progress.textContent = `${processed}/${total}`;
    if (current instanceof HTMLElement) current.textContent = getSuppCurrentText();
    if (status instanceof HTMLElement) {
      status.textContent = suppState.lastError || suppState.statusText || '';
      status.classList.toggle('is-error', !!suppState.lastError);
    }
    if (startButton instanceof HTMLButtonElement) startButton.disabled = suppState.isRunning || itilState.isRunning;
    if (testButton instanceof HTMLButtonElement) testButton.disabled = suppState.isRunning || itilState.isRunning;
    if (stopButton instanceof HTMLButtonElement) stopButton.disabled = !suppState.isRunning || !!suppState.stopRequested;
  }

  function closeMenu() {
    const overlay = document.getElementById(MENU_OVERLAY_ID);
    const menu = document.getElementById(MENU_ID);
    if (overlay instanceof HTMLElement) overlay.hidden = true;
    if (menu instanceof HTMLElement) menu.hidden = true;
  }

  function ensureMenu() {
    ensureStyle();

    let overlay = document.getElementById(MENU_OVERLAY_ID);
    let menu = document.getElementById(MENU_ID);
    const host = document.body || document.documentElement;
    if (!(host instanceof HTMLElement)) return null;

    if (overlay instanceof HTMLElement && menu instanceof HTMLElement) {
      renderItilStatus();
      renderSuppStatus();
      updateLauncherStatus(menuStatusText, menuStatusIsError);
      return menu;
    }

    overlay = document.createElement('div');
    overlay.id = MENU_OVERLAY_ID;
    overlay.hidden = true;
    overlay.addEventListener('click', closeMenu, { capture: true });

    menu = document.createElement('section');
    menu.id = MENU_ID;
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Меню Google Sheets');
    menu.innerHTML = `
      <header class="gs-problem-picker-menu-header">
        <div>
          <div class="gs-problem-picker-menu-title">Меню Google Sheets</div>
          <div class="gs-problem-picker-menu-subtitle">Горячая клавиша: F2</div>
        </div>
        <button type="button" class="gs-problem-picker-menu-close" aria-label="Закрыть">×</button>
      </header>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">Классификация</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-problem-picker-open">Классификация</button>
          <button type="button" class="gs-problem-picker-url">URL bridge</button>
        </div>
        <div class="gs-problem-picker-status" aria-live="polite"></div>
      </section>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">ITIL: заполнить текст заявок</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-problem-picker-itil-start">Старт</button>
          <button type="button" class="gs-problem-picker-itil-stop" disabled>Стоп</button>
        </div>
        <dl class="gs-problem-picker-itil-grid">
          <dt>Собрано строк</dt>
          <dd class="gs-problem-picker-itil-collected">0</dd>
          <dt>Обработано</dt>
          <dd class="gs-problem-picker-itil-progress">0/0</dd>
          <dt>Сейчас</dt>
          <dd class="gs-problem-picker-itil-current">нет</dd>
          <dt>Статус</dt>
          <dd class="gs-problem-picker-itil-status" aria-live="polite">Ожидание запуска.</dd>
        </dl>
      </section>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">СУПП: заполнить текст заявок</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-problem-picker-supp-start">Старт</button>
          <button type="button" class="gs-problem-picker-supp-test">Тест 1 заявка</button>
          <button type="button" class="gs-problem-picker-supp-stop" disabled>Стоп</button>
        </div>
        <dl class="gs-problem-picker-supp-grid">
          <dt>Собрано строк</dt>
          <dd class="gs-problem-picker-supp-collected">0</dd>
          <dt>Обработано</dt>
          <dd class="gs-problem-picker-supp-progress">0/0</dd>
          <dt>Сейчас</dt>
          <dd class="gs-problem-picker-supp-current">нет</dd>
          <dt>Статус</dt>
          <dd class="gs-problem-picker-supp-status" aria-live="polite">Ожидание запуска.</dd>
        </dl>
      </section>
    `;

    $('.gs-problem-picker-menu-close', menu)?.addEventListener('click', closeMenu, { capture: true });
    $('.gs-problem-picker-open', menu)?.addEventListener('click', () => {
      void openPicker();
    }, { capture: true });
    $('.gs-problem-picker-url', menu)?.addEventListener('click', () => {
      void promptBridgeUrl();
    }, { capture: true });
    $('.gs-problem-picker-itil-start', menu)?.addEventListener('click', () => {
      void startItilFill();
    }, { capture: true });
    $('.gs-problem-picker-itil-stop', menu)?.addEventListener('click', () => {
      stopItilFill();
    }, { capture: true });
    $('.gs-problem-picker-supp-start', menu)?.addEventListener('click', () => {
      void startSuppFill(0);
    }, { capture: true });
    $('.gs-problem-picker-supp-test', menu)?.addEventListener('click', () => {
      void startSuppFill(1);
    }, { capture: true });
    $('.gs-problem-picker-supp-stop', menu)?.addEventListener('click', () => {
      stopSuppFill();
    }, { capture: true });

    host.append(overlay, menu);
    updateLauncherStatus(menuStatusText, menuStatusIsError);
    renderItilStatus();
    renderSuppStatus();
    return menu;
  }

  function openMenu() {
    const menu = ensureMenu();
    const overlay = document.getElementById(MENU_OVERLAY_ID);
    if (!(menu instanceof HTMLElement)) return false;
    if (overlay instanceof HTMLElement) overlay.hidden = false;
    menu.hidden = false;
    renderItilStatus();
    renderSuppStatus();
    updateLauncherStatus(menuStatusText, menuStatusIsError);
    return true;
  }

  function toggleMenu() {
    const menu = ensureMenu();
    if (!(menu instanceof HTMLElement)) return false;
    if (menu.hidden) return openMenu();
    closeMenu();
    return false;
  }

  function isF2Hotkey(event) {
    const key = event && event.key ? String(event.key) : '';
    const code = event && event.code ? String(event.code) : '';
    const keyCode = Number(event && event.keyCode);
    return key === 'F2' || code === 'F2' || keyCode === KEY_CODE_F2;
  }

  function handleMenuHotkey(event) {
    if (event.type !== 'keydown' || event.repeat || !isF2Hotkey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    toggleMenu();
  }

  function handleMenuEscape(event) {
    if (event.type !== 'keydown' || event.repeat || event.key !== 'Escape') return;
    const menu = document.getElementById(MENU_ID);
    if (menu instanceof HTMLElement && !menu.hidden) {
      event.preventDefault();
      closeMenu();
    }
  }

  function removeLegacyLauncher() {
    const root = document.getElementById(ROOT_ID);
    if (root instanceof HTMLElement) root.remove();
  }

  async function promptBridgeUrl() {
    const current = state.bridgeUrl || await loadBridgeUrl();
    const next = prompt('Вставь URL Apps Script bridge:', current);
    if (next === null) return;
    await saveBridgeUrl(next);
  }

  function ensureModal() {
    ensureStyle();

    const existing = document.getElementById(MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <div class="gs-problem-picker-layout" role="dialog" aria-modal="true" aria-label="Классификация проблемы">
        <section class="gs-problem-picker-panel">
          <header class="gs-problem-picker-header">
            <div>
              <div class="gs-problem-picker-title">Классификация проблемы</div>
              <div class="gs-problem-picker-meta"></div>
            </div>
            <button type="button" class="gs-problem-picker-close-x" aria-label="Закрыть">×</button>
          </header>
          <div class="gs-problem-picker-progress"></div>
          <div class="gs-problem-picker-text-wrap">
            <div class="gs-problem-picker-label gs-problem-picker-text-label"></div>
            <div class="gs-problem-picker-text"></div>
          </div>
          <footer class="gs-problem-picker-footer">
            <div class="gs-problem-picker-message" aria-live="polite"></div>
            <div class="gs-problem-picker-buttons">
              <button type="button" class="gs-problem-picker-close">Закрыть</button>
            </div>
          </footer>
        </section>
        <aside class="gs-problem-picker-category-rail" aria-label="Категории проблем">
          <div class="gs-problem-picker-category-title">Категория</div>
          <div class="gs-problem-picker-category-list" role="group" aria-label="Выбор категории проблемы"></div>
        </aside>
      </div>
    `;

    const categoryList = $('.gs-problem-picker-category-list', modal);
    if (categoryList instanceof HTMLElement) {
      OPTIONS.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gs-problem-picker-category-button';
        button.dataset.value = option;
        button.textContent = option;
        if (option === DEFAULT_VALUE) button.classList.add('is-default');
        button.addEventListener('click', () => {
          void saveCurrentItem(option);
        }, { capture: true });
        categoryList.appendChild(button);
      });
    }

    const close = () => {
      modal.hidden = true;
    };

    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });

    $('.gs-problem-picker-close-x', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-problem-picker-close', modal)?.addEventListener('click', close, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function getCategoryButtons(modal) {
    return Array.from(modal.querySelectorAll('.gs-problem-picker-category-button'))
      .filter((button) => button instanceof HTMLButtonElement);
  }

  function focusDefaultCategoryButton(modal) {
    const buttons = getCategoryButtons(modal);
    const button = buttons.find((item) => item.dataset.value === DEFAULT_VALUE && !item.disabled)
      || buttons.find((item) => !item.disabled);
    if (button instanceof HTMLButtonElement) button.focus();
  }

  function renderModal() {
    const modal = ensureModal();
    const item = getCurrentItem();
    const meta = $('.gs-problem-picker-meta', modal);
    const progress = $('.gs-problem-picker-progress', modal);
    const textLabel = $('.gs-problem-picker-text-label', modal);
    const text = $('.gs-problem-picker-text', modal);
    const categoryButtons = getCategoryButtons(modal);

    const pending = state.pendingSaveCount ? ` · в фоне: ${state.pendingSaveCount}` : '';
    const failed = state.failedSaveCount ? ` · ошибок: ${state.failedSaveCount}` : '';

    if (meta instanceof HTMLElement) {
      meta.textContent = `Лист: ${state.sheetName || 'не выбран'} · строк в экспорте: ${Math.max(0, state.rowsCount - 1)}`;
    }

    if (!item) {
      if (progress instanceof HTMLElement) progress.textContent = `Отправлено: ${state.sentCount}/${state.queue.length}${pending}${failed}`;
      if (textLabel instanceof HTMLElement) textLabel.textContent = 'Неклассифицированных заявок нет';
      if (text instanceof HTMLElement) text.textContent = 'Очередь завершена.';
      categoryButtons.forEach((button) => {
        button.disabled = true;
        button.title = '';
      });
    } else {
      if (progress instanceof HTMLElement) {
        progress.textContent = `Очередь: ${state.currentIndex + 1}/${state.queue.length} · отправлено: ${state.sentCount}${pending}${failed}`;
      }
      if (textLabel instanceof HTMLElement) textLabel.textContent = `Текст заявки (строка ${item.row}):`;
      if (text instanceof HTMLElement) text.textContent = item.text || '';
      categoryButtons.forEach((button) => {
        button.disabled = !state.bridgeUrl;
        button.title = state.bridgeUrl ? '' : 'Нажми F2, затем «URL bridge» и задай Apps Script bridge.';
      });
    }

    if (!state.bridgeUrl) {
      setModalMessage('URL bridge не задан. Нажми F2, затем «URL bridge».', true);
    } else if (state.failedSaveCount) {
      setModalMessage(state.lastBackgroundError || `Есть ошибки фонового сохранения: ${state.failedSaveCount}.`, true);
    } else if (state.pendingSaveCount) {
      setModalMessage(item
        ? `Сохранение идёт в фоне: ${state.pendingSaveCount}. Можно классифицировать дальше.`
        : `Очередь завершена. Дожидаюсь фонового сохранения: ${state.pendingSaveCount}.`, false);
    } else {
      setModalMessage(item ? '' : 'Классификация завершена.', false);
    }
  }

  async function openPicker() {
    if (state.isLoading) return;

    state.isLoading = true;
    updateLauncherStatus('Загружаю очередь...', false);

    try {
      await loadBridgeUrl();
      await loadQueue();
      const modal = ensureModal();
      renderModal();
      modal.hidden = false;

      focusDefaultCategoryButton(modal);

      updateLauncherStatus(`В очереди строк: ${state.queue.length}.`, false);
    } catch (error) {
      updateLauncherStatus(error && error.message ? error.message : 'Не удалось загрузить очередь.', true);
    } finally {
      state.isLoading = false;
    }
  }

  function refreshVisibleModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal instanceof HTMLElement && !modal.hidden) renderModal();
  }

  function enqueueBackgroundSave(item, value, bridgeUrl, sheetName) {
    const row = item && item.row;

    state.pendingSaveCount += 1;
    state.lastBackgroundError = '';
    updateLauncherStatus(`Строка ${row} отправлена на сохранение в фоне. В обработке: ${state.pendingSaveCount}.`, false);

    void sendRuntimeMessage({
      action: SAVE_ACTION,
      data: {
        bridgeUrl,
        payload: {
          action: 'saveProblem',
          spreadsheetId: CONFIG.spreadsheetId,
          sheetName,
          row,
          value,
          columns: state.columns,
          cleanText: processRequestText(item && item.text ? item.text : '')
        }
      }
    }).then((response) => {
      state.pendingSaveCount = Math.max(0, state.pendingSaveCount - 1);

      if (!response || response.success !== true) {
        state.failedSaveCount += 1;
        state.lastBackgroundError = `Строка ${row} не сохранилась: ${response && response.error ? response.error : 'неизвестная ошибка'}`;
        updateLauncherStatus(`${state.lastBackgroundError}. В обработке: ${state.pendingSaveCount}.`, true);
      } else {
        updateLauncherStatus(`Строка ${row} сохранена. В обработке: ${state.pendingSaveCount}.`, false);
      }

      refreshVisibleModal();
    }).catch((error) => {
      state.pendingSaveCount = Math.max(0, state.pendingSaveCount - 1);
      state.failedSaveCount += 1;
      state.lastBackgroundError = `Строка ${row} не сохранилась: ${error && error.message ? error.message : String(error)}`;
      updateLauncherStatus(`${state.lastBackgroundError}. В обработке: ${state.pendingSaveCount}.`, true);
      refreshVisibleModal();
    });
  }

  async function saveCurrentItem(value) {
    const item = getCurrentItem();
    if (!item) return;

    const modal = ensureModal();
    const selectedValue = String(value || '').trim();

    if (!selectedValue) {
      setModalMessage('Выберите проблему.', true);
      return;
    }

    if (!state.bridgeUrl) {
      setModalMessage('URL bridge не задан. Нажми F2, затем «URL bridge».', true);
      return;
    }

    state.sentCount += 1;
    state.currentIndex += 1;

    enqueueBackgroundSave({ ...item }, selectedValue, state.bridgeUrl, state.sheetName);
    renderModal();

    focusDefaultCategoryButton(modal);
  }

  function uniqueRows(rows) {
    return Array.from(new Set((rows || [])
      .map((row) => Number(row))
      .filter((row) => Number.isInteger(row) && row >= 2)))
      .sort((a, b) => a - b);
  }

  function getRuntimeResponseError(response, fallback) {
    return response && response.error ? response.error : fallback;
  }

  function createBridgeSaveTracker(payload, row, label) {
    const targetRow = Number(row);
    const targetLabel = String(label || `строка ${targetRow}`);

    if (!payload || typeof payload !== 'object') {
      return Promise.resolve({
        success: false,
        row: targetRow,
        errorText: `${targetLabel}: не получен payload для bridge.`
      });
    }

    return sendRuntimeMessage({
      action: SAVE_ACTION,
      data: {
        bridgeUrl: state.bridgeUrl,
        payload
      }
    }).then((response) => {
      if (!response || response.success !== true) {
        return {
          success: false,
          row: targetRow,
          errorText: `${targetLabel}: ${getRuntimeResponseError(response, 'bridge не сохранил данные')}`
        };
      }

      return {
        success: true,
        row: targetRow
      };
    }).catch((error) => ({
      success: false,
      row: targetRow,
      errorText: `${targetLabel}: ${error && error.message ? error.message : String(error)}`
    }));
  }

  function queueItilBridgeSave(result, item) {
    const row = Number(item && item.row);
    const label = `строка ${row}, ITIL ${item && item.itilNumber ? item.itilNumber : ''}`;
    const tracked = createBridgeSaveTracker(result && result.bridgePayload, row, label);
    itilState = {
      ...itilState,
      pendingBridgeSaves: [...(itilState.pendingBridgeSaves || []), tracked]
    };
  }

  function queueSuppBridgeSave(result, item) {
    const row = Number(item && item.row);
    const label = `строка ${row}, СУПП ${item && item.suppNumber ? item.suppNumber : ''}`;
    const tracked = createBridgeSaveTracker(result && result.bridgePayload, row, label);
    suppState = {
      ...suppState,
      pendingBridgeSaves: [...(suppState.pendingBridgeSaves || []), tracked]
    };
  }

  function summarizeBridgeFinalizeErrors(results) {
    const errors = (results || [])
      .filter((item) => item && item.success !== true)
      .map((item) => item.errorText || 'неизвестная ошибка bridge');

    const parts = [];
    if (errors.length) {
      const visible = errors.slice(0, 3).join('; ');
      const hiddenCount = errors.length - 3;
      parts.push(`Ошибки отправки в bridge: ${visible}${hiddenCount > 0 ? `; ещё ${hiddenCount}` : ''}.`);
    }
    return parts.join(' ');
  }

  async function waitBridgeSaves(pendingSaves) {
    const results = await Promise.all(pendingSaves || []);
    const savedRows = uniqueRows(results
      .filter((item) => item && item.success === true)
      .map((item) => item.row));

    return {
      results,
      savedRows,
      resetRowsCount: savedRows.length,
      errorText: summarizeBridgeFinalizeErrors(results)
    };
  }

  function stopItilFill() {
    if (itilState.isRunning) {
      itilState = {
        ...itilState,
        stopRequested: true,
        statusText: 'Останавливаю после текущей строки...',
        lastError: ''
      };
      renderItilStatus();
      renderSuppStatus();
      return;
    }

    itilRunId += 1;
    itilState = {
      queue: [],
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName: '',
      gid: '',
      rowsCount: 0,
      columns: null,
      isRunning: false,
      stopRequested: false,
      pendingBridgeSaves: [],
      statusText: 'Остановлено.',
      lastError: ''
    };
    renderItilStatus();
    renderSuppStatus();
  }

  async function startItilFill() {
    if (itilState.isRunning || suppState.isRunning) return;

    const runId = itilRunId + 1;
    itilRunId = runId;

    itilState = {
      ...itilState,
      queue: [],
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      isRunning: true,
      stopRequested: false,
      pendingBridgeSaves: [],
      statusText: 'Собираю строки для заполнения из ITIL...',
      lastError: ''
    };
    renderItilStatus();
    renderSuppStatus();

    try {
      await loadBridgeUrl();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан. Нажми «URL bridge» и задай Apps Script bridge.');

      await loadItilQueue();
      if (runId !== itilRunId) return;

      if (!itilState.queue.length) {
        itilState = {
          ...itilState,
          isRunning: false,
          stopRequested: false,
          pendingBridgeSaves: [],
          currentItem: null,
          statusText: 'Строк для заполнения из ITIL не найдено.',
          lastError: ''
        };
        renderItilStatus();
        renderSuppStatus();
        return;
      }

      itilState = {
        ...itilState,
        isRunning: true,
        statusText: `В очереди ITIL строк: ${itilState.queue.length}.`,
        lastError: ''
      };
      renderItilStatus();

      for (let index = 0; index < itilState.queue.length; index++) {
        if (runId !== itilRunId) return;
        if (itilState.stopRequested) break;

        const item = itilState.queue[index];
        itilState = {
          ...itilState,
          currentIndex: index,
          currentItem: item,
          statusText: `Ищу ITIL ${item.itilNumber} для строки ${item.row}...`,
          lastError: ''
        };
        renderItilStatus();

        const response = await sendRuntimeMessage({
          action: ITIL_FILL_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            payload: {
              spreadsheetId: CONFIG.spreadsheetId,
              sheetName: itilState.sheetName,
              row: item.row,
              itilNumber: item.itilNumber,
              columns: itilState.columns
            }
          }
        });

        if (runId !== itilRunId) return;

        if (!response || response.success !== true) {
          const errorText = response && response.error ? response.error : 'неизвестная ошибка';
          itilState = {
            ...itilState,
            currentItem: null,
            statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
            lastError: ''
          };
          renderItilStatus();
          const bridgeFinalize = await waitBridgeSaves(itilState.pendingBridgeSaves);
          if (runId !== itilRunId) return;
          const finalError = [bridgeFinalize.errorText, `Строка ${item.row}, ITIL ${item.itilNumber}: ${errorText}`]
            .filter(Boolean)
            .join(' ');
          itilState = {
            ...itilState,
            failedCount: itilState.failedCount + 1,
            isRunning: false,
            stopRequested: false,
            statusText: '',
            lastError: finalError
          };
          renderItilStatus();
          renderSuppStatus();
          return;
        }

        const result = response.result || {};
        queueItilBridgeSave(result, item);
        const textLength = Number(result.requestTextLength || 0);
        const solutionLength = Number(result.solutionTextLength || 0);
        itilState = {
          ...itilState,
          currentIndex: index + 1,
          successCount: itilState.successCount + 1,
          currentItem: null,
          statusText: `Строка ${item.row} подготовлена. Сохранение в bridge поставлено в очередь. Текст: ${textLength} симв., решение: ${solutionLength} симв.`,
          lastError: ''
        };
        renderItilStatus();
      }

      if (runId !== itilRunId) return;
      const wasStopped = !!itilState.stopRequested;

      itilState = {
        ...itilState,
        currentItem: null,
        statusText: 'Дожидаюсь отправки в bridge...',
        lastError: ''
      };
      renderItilStatus();

      const bridgeFinalize = await waitBridgeSaves(itilState.pendingBridgeSaves);
      if (runId !== itilRunId) return;

      itilState = {
        ...itilState,
        isRunning: false,
        stopRequested: false,
        currentItem: null,
        statusText: wasStopped
          ? `Остановлено. Обработано строк: ${itilState.successCount}/${itilState.queue.length}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`
          : `Готово. Обработано строк: ${itilState.successCount}/${itilState.queue.length}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`,
        lastError: bridgeFinalize.errorText
      };
      renderItilStatus();
      renderSuppStatus();
    } catch (error) {
      if (runId !== itilRunId) return;
      const message = error && error.message ? error.message : 'Не удалось запустить заполнение из ITIL.';
      let bridgeFinalize = { errorText: '' };
      if (itilState.pendingBridgeSaves && itilState.pendingBridgeSaves.length) {
        itilState = {
          ...itilState,
          currentItem: null,
          statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
          lastError: ''
        };
        renderItilStatus();
        bridgeFinalize = await waitBridgeSaves(itilState.pendingBridgeSaves);
        if (runId !== itilRunId) return;
      }
      itilState = {
        ...itilState,
        isRunning: false,
        stopRequested: false,
        currentItem: null,
        statusText: '',
        lastError: [message, bridgeFinalize.errorText].filter(Boolean).join(' ')
      };
      renderItilStatus();
      renderSuppStatus();
    }
  }

  function stopSuppFill() {
    if (suppState.isRunning) {
      suppState = {
        ...suppState,
        stopRequested: true,
        statusText: 'Останавливаю после текущей строки...',
        lastError: ''
      };
      renderSuppStatus();
      renderItilStatus();
      return;
    }

    suppRunId += 1;
    suppState = {
      queue: [],
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName: '',
      gid: '',
      rowsCount: 0,
      columns: null,
      isRunning: false,
      stopRequested: false,
      pendingBridgeSaves: [],
      statusText: 'Остановлено.',
      lastError: ''
    };
    renderSuppStatus();
    renderItilStatus();
  }

  async function startSuppFill(limit) {
    if (suppState.isRunning || itilState.isRunning) return;

    const maxRows = Math.max(0, Number(limit || 0));
    const isTestRun = maxRows === 1;
    const runId = suppRunId + 1;
    suppRunId = runId;

    suppState = {
      ...suppState,
      queue: [],
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      isRunning: true,
      stopRequested: false,
      pendingBridgeSaves: [],
      statusText: isTestRun ? 'Собираю строки для тестового заполнения из СУПП...' : 'Собираю строки для заполнения из СУПП...',
      lastError: ''
    };
    renderSuppStatus();
    renderItilStatus();

    try {
      await loadBridgeUrl();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан. Нажми «URL bridge» и задай Apps Script bridge.');

      await loadSuppQueue();
      if (runId !== suppRunId) return;

      if (!suppState.queue.length) {
        suppState = {
          ...suppState,
          isRunning: false,
          stopRequested: false,
          pendingBridgeSaves: [],
          currentItem: null,
          statusText: 'Строк для заполнения из СУПП не найдено.',
          lastError: ''
        };
        renderSuppStatus();
        renderItilStatus();
        return;
      }

      const rowsToProcess = maxRows > 0 ? Math.min(maxRows, suppState.queue.length) : suppState.queue.length;
      suppState = {
        ...suppState,
        isRunning: true,
        statusText: isTestRun ? `Тестовый запуск: будет обработана 1 строка из ${suppState.queue.length}.` : `В очереди СУПП строк: ${suppState.queue.length}.`,
        lastError: ''
      };
      renderSuppStatus();

      for (let index = 0; index < rowsToProcess; index++) {
        if (runId !== suppRunId) return;
        if (suppState.stopRequested) break;

        const item = suppState.queue[index];
        suppState = {
          ...suppState,
          currentIndex: index,
          currentItem: item,
          statusText: `Ищу СУПП ${item.suppNumber} для строки ${item.row}...`,
          lastError: ''
        };
        renderSuppStatus();

        const response = await sendRuntimeMessage({
          action: SUPP_FILL_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            payload: {
              spreadsheetId: CONFIG.spreadsheetId,
              sheetName: suppState.sheetName,
              row: item.row,
              suppNumber: item.suppNumber,
              columns: suppState.columns
            }
          }
        });

        if (runId !== suppRunId) return;

        if (!response || response.success !== true) {
          const errorText = response && response.error ? response.error : 'неизвестная ошибка';
          suppState = {
            ...suppState,
            currentItem: null,
            statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
            lastError: ''
          };
          renderSuppStatus();
          const bridgeFinalize = await waitBridgeSaves(suppState.pendingBridgeSaves);
          if (runId !== suppRunId) return;
          const finalError = [bridgeFinalize.errorText, `Строка ${item.row}, СУПП ${item.suppNumber}: ${errorText}`]
            .filter(Boolean)
            .join(' ');
          suppState = {
            ...suppState,
            failedCount: suppState.failedCount + 1,
            isRunning: false,
            stopRequested: false,
            statusText: '',
            lastError: finalError
          };
          renderSuppStatus();
          renderItilStatus();
          return;
        }

        const result = response.result || {};
        queueSuppBridgeSave(result, item);
        const textLength = Number(result.requestTextLength || 0);
        const infoLength = Number(result.infoTextLength || 0);
        suppState = {
          ...suppState,
          currentIndex: index + 1,
          successCount: suppState.successCount + 1,
          currentItem: null,
          statusText: `Строка ${item.row} подготовлена. Сохранение в bridge поставлено в очередь. Текст: ${textLength} симв., информация: ${infoLength} симв.`,
          lastError: ''
        };
        renderSuppStatus();
      }

      if (runId !== suppRunId) return;
      const wasStopped = !!suppState.stopRequested;

      suppState = {
        ...suppState,
        currentItem: null,
        statusText: 'Дожидаюсь отправки в bridge...',
        lastError: ''
      };
      renderSuppStatus();

      const bridgeFinalize = await waitBridgeSaves(suppState.pendingBridgeSaves);
      if (runId !== suppRunId) return;

      suppState = {
        ...suppState,
        isRunning: false,
        stopRequested: false,
        currentItem: null,
        statusText: wasStopped
          ? `Остановлено. Обработано строк: ${suppState.successCount}/${rowsToProcess}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`
          : isTestRun
            ? `Тестовый запуск завершён. Обработано строк: ${suppState.successCount}/${rowsToProcess}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`
            : `Готово. Обработано строк: ${suppState.successCount}/${suppState.queue.length}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`,
        lastError: bridgeFinalize.errorText
      };
      renderSuppStatus();
      renderItilStatus();
    } catch (error) {
      if (runId !== suppRunId) return;
      const message = error && error.message ? error.message : 'Не удалось запустить заполнение из СУПП.';
      let bridgeFinalize = { errorText: '' };
      if (suppState.pendingBridgeSaves && suppState.pendingBridgeSaves.length) {
        suppState = {
          ...suppState,
          currentItem: null,
          statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
          lastError: ''
        };
        renderSuppStatus();
        bridgeFinalize = await waitBridgeSaves(suppState.pendingBridgeSaves);
        if (runId !== suppRunId) return;
      }
      suppState = {
        ...suppState,
        isRunning: false,
        stopRequested: false,
        currentItem: null,
        statusText: '',
        lastError: [message, bridgeFinalize.errorText].filter(Boolean).join(' ')
      };
      renderSuppStatus();
      renderItilStatus();
    }
  }

  function isInsideProblemPickerUi(target) {
    if (!(target instanceof Node)) return false;

    const root = document.getElementById(ROOT_ID);
    const modal = document.getElementById(MODAL_ID);
    const menu = document.getElementById(MENU_ID);
    const menuOverlay = document.getElementById(MENU_OVERLAY_ID);

    return !!(
      (root && root.contains(target))
      || (modal && modal.contains(target))
      || (menu && menu.contains(target))
      || (menuOverlay && menuOverlay.contains(target))
    );
  }

  async function openPickerIfQueueHasRows(source) {
    const now = Date.now();

    if (autoOpenInProgress || state.isLoading) return;
    if (now - lastAutoOpenAtMs < AUTO_OPEN_AFTER_EDIT_COOLDOWN_MS) return;

    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal instanceof HTMLElement && !existingModal.hidden) return;

    autoOpenInProgress = true;

    try {
      await loadBridgeUrl();
      await loadQueue();

      if (!state.queue.length) return;

      lastAutoOpenAtMs = Date.now();

      const modal = ensureModal();
      renderModal();
      modal.hidden = false;

      focusDefaultCategoryButton(modal);

      updateLauncherStatus(`Автооткрытие после редактирования: в очереди строк ${state.queue.length}.`, false);
    } catch (error) {
      updateLauncherStatus(
        error && error.message ? error.message : `Не удалось автооткрыть классификацию (${source || 'edit'}).`,
        true
      );
    } finally {
      autoOpenInProgress = false;
    }
  }

  function scheduleAutoOpenAfterPossibleSheetEdit(source) {
    if (!isTargetSpreadsheet()) return;

    window.clearTimeout(autoOpenTimer);
    autoOpenTimer = window.setTimeout(() => {
      void openPickerIfQueueHasRows(source);
    }, AUTO_OPEN_AFTER_EDIT_DELAY_MS);
  }

  function installAutoOpenListeners() {
    document.addEventListener('keydown', (event) => {
      if (isInsideProblemPickerUi(event.target)) return;

      const key = event && event.key ? String(event.key) : '';
      if (key === 'Enter' || key === 'Tab') {
        scheduleAutoOpenAfterPossibleSheetEdit('keydown');
      }
    }, true);

    document.addEventListener('paste', (event) => {
      if (!isInsideProblemPickerUi(event.target)) {
        scheduleAutoOpenAfterPossibleSheetEdit('paste');
      }
    }, true);

    document.addEventListener('input', (event) => {
      if (!isInsideProblemPickerUi(event.target)) {
        scheduleAutoOpenAfterPossibleSheetEdit('input');
      }
    }, true);
  }

  function init() {
    if (!isTargetSpreadsheet()) return;

    removeLegacyLauncher();
    ensureMenu();
    installAutoOpenListeners();
    document.addEventListener('keydown', handleMenuHotkey, true);
    document.addEventListener('keydown', handleMenuEscape, true);
    void loadBridgeUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
