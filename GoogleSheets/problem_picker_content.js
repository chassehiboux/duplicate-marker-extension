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

  const WAIT_TIMEOUTS_STORAGE_KEY = 'dup_google_sheets_problem_picker_wait_timeouts_v1';
  const WAIT_TIMEOUT_DEFINITIONS = Object.freeze([
    { key: 'tabLoadMs', group: 'Общее', label: 'Загрузка вкладки ITIL/СУПП', defaultSeconds: 90 },
    { key: 'oneCReadyMs', group: 'Общее', label: 'Готовность рабочей страницы 1С', defaultSeconds: 90 },
    { key: 'itilAccountMs', group: 'ITIL', label: 'Личный кабинет ITIL', defaultSeconds: 90 },
    { key: 'itilServiceDeskMs', group: 'ITIL', label: 'Пункт Service Desk', defaultSeconds: 30 },
    { key: 'itilSearchInputMs', group: 'ITIL', label: 'Поле поиска Service Desk', defaultSeconds: 60 },
    { key: 'itilSearchResultMs', group: 'ITIL', label: 'Строка ITIL в результатах', defaultSeconds: 60 },
    { key: 'itilRequestTabMs', group: 'ITIL', label: 'Открытие вкладки заявки', defaultSeconds: 60 },
    { key: 'itilRequestTextMs', group: 'ITIL', label: 'Загрузка текста заявки', defaultSeconds: 60 },
    { key: 'itilRequestCloseMs', group: 'ITIL', label: 'Закрытие вкладки заявки', defaultSeconds: 15 },
    { key: 'suppSearchInputMs', group: 'СУПП', label: 'Глобальное поле поиска', defaultSeconds: 90 },
    { key: 'suppSearchResultMs', group: 'СУПП', label: 'Результат поиска заявки', defaultSeconds: 35 },
    { key: 'suppCardOpenMs', group: 'СУПП', label: 'Открытие карточки из результата', defaultSeconds: 7 },
    { key: 'suppFallbackCardOpenMs', group: 'СУПП', label: 'Открытие карточки запасным способом', defaultSeconds: 8 },
    { key: 'suppRequestTextMs', group: 'СУПП', label: 'Загрузка текста заявки', defaultSeconds: 60 },
    { key: 'suppDiscussionMs', group: 'СУПП', label: 'Загрузка обсуждения', defaultSeconds: 8 },
    { key: 'suppCloseStepMs', group: 'СУПП', label: 'Одна попытка закрытия карточки', defaultSeconds: 2.5 },
    { key: 'suppCloseRetryMs', group: 'СУПП', label: 'Ожидание между повторами закрытия', defaultSeconds: 3 },
    { key: 'suppCloseFinalMs', group: 'СУПП', label: 'Финальное ожидание закрытия', defaultSeconds: 5 }
  ]);
  const WAIT_TIMEOUT_DEFAULTS_MS = Object.freeze(WAIT_TIMEOUT_DEFINITIONS.reduce((result, definition) => {
    result[definition.key] = definition.defaultSeconds * 1000;
    return result;
  }, {}));

  const TEXT_HEADER = 'Текст заявки';
  const PROBLEM_HEADER = 'Проблемы';
  const DEFAULT_VALUE = 'Публикация/Некорректная публикация/Ошибки публикации';
  const SAVE_ACTION = 'GOOGLE_SHEETS_PROBLEM_PICKER_SAVE';
  const ITIL_FILL_ACTION = 'GOOGLE_SHEETS_ITIL_FILL_ROW';
  const SUPP_FILL_ACTION = 'GOOGLE_SHEETS_SUPP_FILL_ROW';
  const ITIL_OPEN_REQUEST_ACTION = 'GOOGLE_SHEETS_ITIL_OPEN_REQUEST';
  const SUPP_OPEN_REQUEST_ACTION = 'GOOGLE_SHEETS_SUPP_OPEN_REQUEST';
  const ITIL_INFO_REFRESH_ACTION = 'GOOGLE_SHEETS_ITIL_REFRESH_INFO_ROW';
  const SUPP_INFO_REFRESH_ACTION = 'GOOGLE_SHEETS_SUPP_REFRESH_INFO_ROW';
  const CHATGPT_SEARCH_ACTION = 'GOOGLE_SHEETS_CHATGPT_SEARCH';
  const CHATGPT_QUESTION_ACTION = 'GOOGLE_SHEETS_CHATGPT_QUESTION';
  const CHATGPT_OPEN_TAB_ACTION = 'GOOGLE_SHEETS_CHATGPT_OPEN_TAB';
  const CHATGPT_PROGRESS_ACTION = 'GOOGLE_SHEETS_CHATGPT_PROGRESS';
  const CHATGPT_CLOSE_TAB_ACTION = 'GOOGLE_SHEETS_CHATGPT_CLOSE_TAB';
  const ITIL_NUMBER_HEADER = 'Номер ITIL';
  const SUPP_NUMBER_HEADER = 'Номер СУПП (последний)';
  const ITIL_INFO_HEADER = 'Информация из СУПП/ITIL';
  const NEW_RESPONSE_HEADER = 'Пришел новый ответ';
  const FAVORITE_HEADER = 'Избранное';
  const REQUEST_DATE_HEADER = 'Дата заявки';
  const REQUEST_STATUS_HEADER = 'Статус заявки';
  const CURRENT_STAGE_HEADER = 'Текущий этап';
  const INITIATOR_HEADER = 'Инициатор';
  const CHATGPT_SEARCH_SHEET_NAME = 'Заявки';
  const CHATGPT_RESULT_SHEET_NAME = 'Поиск заявок (ИИ)';
  const ITIL_IMPORT_SHEET_NAME = 'ITIL';
  const ITIL_IMPORT_START_ROW = 2003;
  const ITIL_IMPORT_COLUMN_COUNT = 22;
  const ITIL_IMPORT_BATCH_ROWS = 300;
  const ITIL_IMPORT_BATCH_BYTES = 512 * 1024;
  const WSS_SHEET_NAME = 'WSS';
  const WSS_IMPORT_BATCH_SIZE = 80;
  const WSS_IMPORT_TEXT_LIMIT = 45000;
  const ITIL_IMPORT_HEADERS = Object.freeze([
    'Индекс картинки события',
    'Статус порядок',
    'Дата',
    'Приоритет',
    'Номер',
    'Текущий этап',
    'Наименование',
    'Номер заявки в СУПП',
    'Дата передачи заявки в СУПП',
    'Состояние в СУПП',
    'Дата состояния заявки СУПП',
    'Инициатор',
    'Текущий исполнитель',
    'Комментарий исполнителя',
    'Крайний срок устранения',
    'Дата завершения',
    'Массовый',
    'Время перехода',
    'Маршрут',
    'Организация',
    'Исполнитель в ПК СУПП',
    'Последний исполнитель'
  ]);
  const CHATGPT_MODE_SEARCH = 'search';
  const CHATGPT_MODE_QUESTION = 'question';
  const CHATGPT_MODE_WSS_SEARCH = 'wss_search';
  const CHATGPT_ROW_ID_HEADER = '__row_id';
  const CHATGPT_SEARCH_FILE_NAME = 'zayavki-search.csv';
  const CHATGPT_QUESTION_FILE_NAME = 'zayavki-question.csv';
  const WSS_CHATGPT_SEARCH_FILE_NAME = 'wss-search.csv';
  const SUPP_NOT_FOUND_INFO_TEXT = 'Не найдена заявка в СУПП. Проверьте вручную';
  const CHATGPT_SEARCH_VISIBLE_HEADERS = Object.freeze([
    'Дата заявки',
    REQUEST_STATUS_HEADER,
    'Проблемы',
    'Инициатор',
    ITIL_NUMBER_HEADER,
    SUPP_NUMBER_HEADER,
    TEXT_HEADER,
    ITIL_INFO_HEADER
  ]);
  const CHATGPT_SEARCH_CSV_HEADERS = Object.freeze([
    CHATGPT_ROW_ID_HEADER,
    ...CHATGPT_SEARCH_VISIBLE_HEADERS
  ]);
  const WSS_CHATGPT_VISIBLE_HEADERS = Object.freeze([
    'WSS ID',
    'Рег. номер',
    'Краткое описание задачи',
    'Содержание',
    'Расширенная история решений',
    'Доп. файлы',
    'Дата регистрации',
    'Этап',
    'Статус',
    'Заказчик',
    'Ответственный',
    'Комментарий',
    'Номер заявки в СУПП',
    'Состояние заявки в СУПП',
    'Связанные задачи СУПП',
    'last_parsed_at'
  ]);
  const WSS_CHATGPT_CSV_HEADERS = Object.freeze([
    CHATGPT_ROW_ID_HEADER,
    ...WSS_CHATGPT_VISIBLE_HEADERS
  ]);
  const WSS_CHATGPT_LONG_TEXT_HEADERS = Object.freeze({
    'Содержание': 4000,
    'Расширенная история решений': 3500,
    'Доп. файлы': 2500,
    'Комментарий': 1200
  });
  const ROOT_ID = 'dup-google-sheets-problem-picker-root';
  const MODAL_ID = 'dup-google-sheets-problem-picker-modal';
  const NEW_RESPONSE_REVIEW_MODAL_ID = 'dup-google-sheets-new-response-review-modal';
  const CHATGPT_SEARCH_MODAL_ID = 'dup-google-sheets-chatgpt-search-modal';
  const ITIL_IMPORT_MODAL_ID = 'dup-google-sheets-itil-import-modal';
  const WSS_IMPORT_MODAL_ID = 'dup-google-sheets-wss-import-modal';
  const WSS_IMPORT_REVIEW_MODAL_ID = 'dup-google-sheets-wss-import-review-modal';
  const MENU_ID = 'dup-google-sheets-problem-picker-menu';
  const MENU_OVERLAY_ID = 'dup-google-sheets-problem-picker-menu-overlay';
  const PROCESSING_ROW_HIGHLIGHT_ID = 'dup-google-sheets-processing-row-highlight';
  const MENU_LAYOUT_VERSION = '2026-08-21-wait-settings-1';
  const MENU_BOUND_FLAG = '__dupGoogleSheetsMenuBound';
  const MENU_OVERLAY_BOUND_FLAG = '__dupGoogleSheetsMenuOverlayBound';
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
    viewIndex: 0,
    sentCount: 0,
    pendingSaveCount: 0,
    failedSaveCount: 0,
    lastBackgroundError: '',
    sheetName: '',
    gid: '',
    rowsCount: 0,
    columns: null,
    isLoading: false,
    savedSelections: {}
  };

  let autoOpenTimer = 0;
  let classificationDetailsRefresh = null;
  let autoOpenInProgress = false;
  let lastAutoOpenAtMs = 0;
  let menuStatusText = '';
  let waitTimeoutOverrides = {};
  let waitTimeoutSettingsLoaded = false;
  let waitSettingsPanelOpen = false;
  let waitSettingsStatusText = '';
  let waitSettingsStatusIsError = false;
  let menuStatusIsError = false;
  let itilRunId = 0;
  let suppRunId = 0;
  let newResponseRunId = 0;
  let combinedFlowRunId = 0;
  let processingRowHighlightTarget = null;
  let processingRowHighlightTimer = 0;
  let processingRowHighlightFrame = 0;
  let processingRowHighlightListenersBound = false;

  let chatGptSearchState = {
    isRunning: false,
    mode: CHATGPT_MODE_SEARCH,
    searchQuery: '',
    questionQuery: '',
    wssSearchQuery: '',
    statusText: 'Введите запрос и запустите поиск.',
    lastError: '',
    compactRowsCount: 0,
    foundCount: 0,
    chatTabId: null,
    sentPrompt: '',
    resultSheetId: null
  };

  let itilImportState = {
    rawText: '',
    headers: [],
    tableRows: [],
    isParsing: false,
    isImporting: false,
    currentBatch: 0,
    totalBatches: 0,
    insertedRowsCount: 0,
    nextRowOffset: 0,
    statusText: 'Вставьте таблицу из буфера обмена.',
    lastError: ''
  };
  let itilImportParseTimer = 0;
  let itilImportParseRunId = 0;

  let wssImportState = {
    fileName: '',
    rows: [],
    stats: null,
    preview: null,
    isParsing: false,
    isImporting: false,
    currentBatch: 0,
    totalBatches: 0,
    imported: {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      newResponses: 0
    },
    statusText: 'Выберите zip-архив выгрузки WSS.',
    lastError: ''
  };

  let wssImportReviewState = {
    queue: [],
    currentIndex: 0,
    totalExpected: 0,
    statusText: 'Новых или обновленных заявок WSS для просмотра нет.',
    errorText: ''
  };

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
    skippedCount: 0,
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

  let newResponseState = {
    queue: [],
    currentIndex: 0,
    successCount: 0,
    skippedCount: 0,
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
  function createNewResponseReviewState(overrides) {
    return Object.assign({
      queue: [],
      currentIndex: 0,
      totalExpected: 0,
      isProcessing: false,
      isAcknowledging: false,
      pendingAcknowledgeCount: 0,
      failedAcknowledgeCount: 0,
      dismissedEventIds: {},
      statusText: 'Ожидание запуска.',
      errorText: '',
      sourceSheetName: ''
    }, overrides || {});
  }

  let newResponseReviewState = createNewResponseReviewState();
  let newResponseInboxState = {
    unreadCount: 0,
    isLoading: false,
    lastError: ''
  };
  let combinedFlowState = {
    queue: [],
    currentIndex: 0,
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    currentItem: null,
    sheetName: '',
    gid: '',
    rowsCount: 0,
    columns: null,
    isRunning: false,
    stopRequested: false,
    pendingBridgeSaves: [],
    stage: 'idle',
    statusText: 'Ожидание запуска.',
    lastError: '',
    manualDropdownOpen: false,
    classificationQueueCount: 0
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const FILE_NAME_ONLY_LINE_RE = /^\s*[^\r\n\\/:*?"<>|]+\.(?:png|jpe?g|gif|bmp|webp|svg|heic|pdf|docx?|xlsx?|pptx?|txt|rtf|csv|xml|json|zip|rar|7z)\s*$/i;

  function clonePlainData(value) {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) {
        // Fallback ниже.
      }
    }

    return JSON.parse(JSON.stringify(value));
  }

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
    return sendRuntimeMessage({
      action: 'DUP_SYNC_SET',
      data: {
        values,
        options: { reason: 'google-sheets-problem-picker' }
      }
    }).then((response) => {
      if (response && response.success !== false) return true;
      return false;
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

  function sanitizeWaitTimeoutOverrides(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = {};

    WAIT_TIMEOUT_DEFINITIONS.forEach((definition) => {
      const timeoutMs = Number(source[definition.key]);
      if (Number.isFinite(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 3600000) {
        result[definition.key] = Math.round(timeoutMs);
      }
    });

    return result;
  }

  async function loadWaitTimeoutSettings() {
    const stored = await chromeStorageGet([WAIT_TIMEOUTS_STORAGE_KEY]);
    waitTimeoutOverrides = sanitizeWaitTimeoutOverrides(stored[WAIT_TIMEOUTS_STORAGE_KEY]);
    waitTimeoutSettingsLoaded = true;
    return waitTimeoutOverrides;
  }

  function getEffectiveWaitTimeouts() {
    return {
      ...WAIT_TIMEOUT_DEFAULTS_MS,
      ...sanitizeWaitTimeoutOverrides(waitTimeoutOverrides)
    };
  }

  function getWaitSettingsMarkup() {
    const groups = [];
    WAIT_TIMEOUT_DEFINITIONS.forEach((definition) => {
      let group = groups.find((item) => item.name === definition.group);
      if (!group) {
        group = { name: definition.group, definitions: [] };
        groups.push(group);
      }
      group.definitions.push(definition);
    });

    const groupMarkup = groups.map((group) => `
      <fieldset class="gs-wait-settings-group">
        <legend>${escapeHtml(group.name)}</legend>
        <div class="gs-wait-settings-grid">
          ${group.definitions.map((definition) => `
            <label class="gs-wait-settings-field">
              <span>${escapeHtml(definition.label)}</span>
              <span class="gs-wait-settings-control">
                <input type="number" min="1" max="3600" step="0.5" inputmode="decimal"
                  data-wait-timeout-key="${escapeHtml(definition.key)}"
                  placeholder="${definition.defaultSeconds}"
                  aria-label="${escapeHtml(`${definition.label}, секунд`)}">
                <span>сек.</span>
              </span>
            </label>
          `).join('')}
        </div>
      </fieldset>
    `).join('');

    return `
      <div class="gs-wait-settings-panel" hidden>
        <div class="gs-wait-settings-intro">
          Пустое поле использует штатное значение, указанное серым. Изменения применятся со следующей обрабатываемой заявки.
        </div>
        ${groupMarkup}
        <div class="gs-wait-settings-actions">
          <button type="button" class="gs-wait-settings-save">Сохранить</button>
          <button type="button" class="gs-wait-settings-defaults">Вернуть все по умолчанию</button>
        </div>
        <div class="gs-wait-settings-status" aria-live="polite"></div>
      </div>
    `;
  }

  function renderWaitSettingsPanel() {
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const panel = $('.gs-wait-settings-panel', menu);
    const toggle = $('.gs-wait-settings-toggle', menu);
    const status = $('.gs-wait-settings-status', menu);
    if (panel instanceof HTMLElement) panel.hidden = !waitSettingsPanelOpen;
    if (toggle instanceof HTMLButtonElement) {
      toggle.setAttribute('aria-expanded', waitSettingsPanelOpen ? 'true' : 'false');
    }
    if (status instanceof HTMLElement) {
      status.textContent = waitSettingsStatusText;
      status.classList.toggle('is-error', waitSettingsStatusIsError);
    }

    if (!waitTimeoutSettingsLoaded) return;
    $$('[data-wait-timeout-key]', menu).forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const key = String(input.dataset.waitTimeoutKey || '');
      const customMs = Number(waitTimeoutOverrides[key]);
      input.value = Number.isFinite(customMs) ? String(customMs / 1000) : '';
    });
  }

  async function openWaitSettings() {
    waitSettingsPanelOpen = !waitSettingsPanelOpen;
    waitSettingsStatusText = '';
    waitSettingsStatusIsError = false;
    renderWaitSettingsPanel();
    if (!waitSettingsPanelOpen || waitTimeoutSettingsLoaded) return;

    await loadWaitTimeoutSettings();
    renderWaitSettingsPanel();
  }

  async function saveWaitSettings(useDefaults) {
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const nextOverrides = {};
    if (!useDefaults) {
      for (const input of $$('[data-wait-timeout-key]', menu)) {
        if (!(input instanceof HTMLInputElement)) continue;
        const rawValue = String(input.value || '').trim().replace(',', '.');
        if (!rawValue) continue;

        const seconds = Number(rawValue);
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) {
          waitSettingsStatusText = 'Укажите время от 1 до 3600 секунд или оставьте поле пустым.';
          waitSettingsStatusIsError = true;
          renderWaitSettingsPanel();
          input.focus();
          return;
        }
        nextOverrides[String(input.dataset.waitTimeoutKey || '')] = Math.round(seconds * 1000);
      }
    }

    const saved = await chromeStorageSet({ [WAIT_TIMEOUTS_STORAGE_KEY]: nextOverrides });
    if (!saved) {
      waitSettingsStatusText = 'Не удалось сохранить настройки ожидания.';
      waitSettingsStatusIsError = true;
      renderWaitSettingsPanel();
      return;
    }

    waitTimeoutOverrides = nextOverrides;
    waitTimeoutSettingsLoaded = true;
    waitSettingsStatusText = useDefaults
      ? 'Все ожидания возвращены к штатным значениям.'
      : 'Настройки сохранены и применятся со следующей заявки.';
    waitSettingsStatusIsError = false;
    renderWaitSettingsPanel();
  }

  function getActiveSheetName() {
    const activeTab = $('.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name')
      || $('.docs-sheet-active-tab');
    return activeTab instanceof HTMLElement ? String(activeTab.textContent || '').trim() : '';
  }

  function activateSheetTabByName(sheetName) {
    const targetName = String(sheetName || '').trim();
    if (!targetName) return false;

    const tab = Array.from(document.querySelectorAll('.docs-sheet-tab')).find((candidate) => {
      const nameElement = $('.docs-sheet-tab-name', candidate) || candidate;
      return String(nameElement.textContent || '').trim() === targetName;
    });

    if (!(tab instanceof HTMLElement)) return false;
    tab.click();
    return true;
  }

  function getActiveGid() {
    const searchGid = new URLSearchParams(location.search || '').get('gid');
    if (searchGid) return String(searchGid).trim();

    const hashMatch = String(location.hash || '').match(/gid=([^&]+)/);
    return hashMatch ? decodeURIComponent(hashMatch[1]) : '';
  }

  function focusSheetRow(row, gid) {
    const targetRow = Number(row);
    const targetGid = String(gid || getActiveGid()).trim();
    if (!Number.isInteger(targetRow) || targetRow < 2 || !targetGid) return false;

    const nextHash = `#gid=${encodeURIComponent(targetGid)}&range=A${targetRow}`;
    if (location.hash !== nextHash) location.replace(nextHash);
    showProcessingRowHighlight(targetRow, targetGid);
    return true;
  }

  function getVisibleElementRect(element) {
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return null;
    return rect;
  }

  function findActiveSheetSelection() {
    const directSelectors = [
      '.waffle-selection-frame',
      '.waffle-active-cell',
      '.waffle-row-header-active',
      '[role="rowheader"][aria-selected="true"]'
    ];

    for (const selector of directSelectors) {
      const candidates = Array.from(document.querySelectorAll(selector));
      for (let index = candidates.length - 1; index >= 0; index--) {
        const rect = getVisibleElementRect(candidates[index]);
        if (rect && rect.height >= 8 && rect.height <= 120) {
          return { element: candidates[index], rect };
        }
      }
    }

    const borderElements = Array.from(document.querySelectorAll(
      '.active-cell-border,.waffle-border-active,[class*="waffle-border-"][class*="active"]'
    ));
    const visibleBorders = borderElements
      .map((element) => ({ element, rect: getVisibleElementRect(element) }))
      .filter((entry) => !!entry.rect);
    if (visibleBorders.length < 2) return null;

    const left = Math.min(...visibleBorders.map((entry) => entry.rect.left));
    const right = Math.max(...visibleBorders.map((entry) => entry.rect.right));
    const top = Math.min(...visibleBorders.map((entry) => entry.rect.top));
    const bottom = Math.max(...visibleBorders.map((entry) => entry.rect.bottom));
    if ((bottom - top) < 8 || (bottom - top) > 120 || right <= left) return null;

    return {
      element: visibleBorders[0].element,
      rect: { left, right, top, bottom, width: right - left, height: bottom - top }
    };
  }

  function findSheetGridRect(anchorElement, anchorRect) {
    const gridSelector = '.waffle-grid-container,.grid-table-container,.docs-sheet-container,.docs-sheet-tab-view';
    const closestGrid = anchorElement instanceof HTMLElement ? anchorElement.closest(gridSelector) : null;
    const closestRect = getVisibleElementRect(closestGrid);
    if (closestRect && closestRect.right > anchorRect.right) return closestRect;

    const centerY = anchorRect.top + (anchorRect.height / 2);
    const candidates = Array.from(document.querySelectorAll(gridSelector))
      .map((element) => getVisibleElementRect(element))
      .filter((rect) => rect
        && rect.top <= centerY
        && rect.bottom >= centerY
        && rect.right > anchorRect.right
        && rect.width > anchorRect.width);
    candidates.sort((first, second) => (first.width * first.height) - (second.width * second.height));
    return candidates[0] || null;
  }

  function positionProcessingRowHighlight() {
    if (!processingRowHighlightTarget) return false;
    const overlay = document.getElementById(PROCESSING_ROW_HIGHLIGHT_ID);
    const selection = findActiveSheetSelection();
    if (!(overlay instanceof HTMLElement) || !selection) return false;

    const gridRect = findSheetGridRect(selection.element, selection.rect);
    const left = Math.max(0, selection.rect.left);
    const right = Math.min(window.innerWidth, gridRect ? gridRect.right : window.innerWidth - 8);
    const top = Math.max(0, selection.rect.top);
    const bottom = Math.min(window.innerHeight, selection.rect.bottom);
    if (right <= left || bottom <= top) return false;

    overlay.style.left = `${Math.round(left)}px`;
    overlay.style.top = `${Math.round(top)}px`;
    overlay.style.width = `${Math.round(right - left)}px`;
    overlay.style.height = `${Math.max(2, Math.round(bottom - top))}px`;
    overlay.dataset.row = String(processingRowHighlightTarget.row);
    overlay.hidden = false;
    return true;
  }

  function scheduleProcessingRowHighlightPosition(delay, remainingAttempts) {
    if (!processingRowHighlightTarget) return;
    if (processingRowHighlightTimer) window.clearTimeout(processingRowHighlightTimer);
    processingRowHighlightTimer = window.setTimeout(() => {
      processingRowHighlightTimer = 0;
      positionProcessingRowHighlight();
      if (processingRowHighlightTarget && remainingAttempts > 0) {
        scheduleProcessingRowHighlightPosition(120, remainingAttempts - 1);
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function queueProcessingRowHighlightPosition() {
    if (!processingRowHighlightTarget || processingRowHighlightFrame) return;
    processingRowHighlightFrame = window.requestAnimationFrame(() => {
      processingRowHighlightFrame = 0;
      positionProcessingRowHighlight();
    });
  }

  function ensureProcessingRowHighlight() {
    ensureStyle();
    let overlay = document.getElementById(PROCESSING_ROW_HIGHLIGHT_ID);
    if (!(overlay instanceof HTMLElement)) {
      overlay = document.createElement('div');
      overlay.id = PROCESSING_ROW_HIGHLIGHT_ID;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      (document.body || document.documentElement).appendChild(overlay);
    }

    if (!processingRowHighlightListenersBound) {
      processingRowHighlightListenersBound = true;
      window.addEventListener('resize', queueProcessingRowHighlightPosition, { passive: true });
      document.addEventListener('scroll', queueProcessingRowHighlightPosition, { capture: true, passive: true });
    }
    return overlay;
  }

  function showProcessingRowHighlight(row, gid) {
    const overlay = ensureProcessingRowHighlight();
    processingRowHighlightTarget = { row: Number(row), gid: String(gid || '') };
    overlay.hidden = true;
    scheduleProcessingRowHighlightPosition(180, 12);
  }

  function hideProcessingRowHighlight() {
    processingRowHighlightTarget = null;
    if (processingRowHighlightTimer) {
      window.clearTimeout(processingRowHighlightTimer);
      processingRowHighlightTimer = 0;
    }
    if (processingRowHighlightFrame) {
      window.cancelAnimationFrame(processingRowHighlightFrame);
      processingRowHighlightFrame = 0;
    }
    const overlay = document.getElementById(PROCESSING_ROW_HIGHLIGHT_ID);
    if (overlay instanceof HTMLElement) overlay.hidden = true;
  }

  function syncProcessingRowHighlightVisibility() {
    const hasActiveItem = !!(
      combinedFlowState.currentItem
      || itilState.currentItem
      || suppState.currentItem
      || newResponseState.currentItem
    );
    if (!hasActiveItem) hideProcessingRowHighlight();
  }

  function getCsvUrl(gid, range = '') {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
    return range ? `${url}&range=${encodeURIComponent(range)}` : url;
  }

  function getSheetCsvUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  function getChatGptSearchCsvUrl() {
    return getSheetCsvUrl(CHATGPT_SEARCH_SHEET_NAME);
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

  function stringifyCsvCell(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildCsvText(rows) {
    return (rows || [])
      .map((row) => (row || []).map(stringifyCsvCell).join(','))
      .join('\r\n');
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getLittleEndianUint16(view, offset) {
    return view.getUint16(offset, true);
  }

  function getLittleEndianUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  async function inflateRawZipBytes(bytes) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Браузер не поддерживает DecompressionStream для распаковки zip.');
    }

    let stream;
    try {
      stream = new DecompressionStream('deflate-raw');
    } catch (error) {
      throw new Error('Браузер не поддерживает deflate-raw для zip-архивов.');
    }

    const inflatedStream = new Blob([bytes]).stream().pipeThrough(stream);
    const inflated = await new Response(inflatedStream).arrayBuffer();
    return new Uint8Array(inflated);
  }

  function decodeZipEntryName(bytes, isUtf8) {
    const preferred = isUtf8 ? 'utf-8' : 'windows-1251';
    try {
      return new TextDecoder(preferred, { fatal: false }).decode(bytes);
    } catch (_) {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
  }

  async function readZipEntries(arrayBuffer) {
    const source = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer;
    const view = new DataView(source);
    const bytes = new Uint8Array(source);
    const minEocdOffset = Math.max(0, bytes.length - 22 - 65535);
    let eocdOffset = -1;

    for (let offset = bytes.length - 22; offset >= minEocdOffset; offset--) {
      if (getLittleEndianUint32(view, offset) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }

    if (eocdOffset < 0) throw new Error('Не найден центральный каталог zip.');

    const entriesCount = getLittleEndianUint16(view, eocdOffset + 10);
    let centralOffset = getLittleEndianUint32(view, eocdOffset + 16);
    const entries = new Map();

    for (let index = 0; index < entriesCount; index++) {
      if (getLittleEndianUint32(view, centralOffset) !== 0x02014b50) {
        throw new Error('Некорректная запись центрального каталога zip.');
      }

      const flags = getLittleEndianUint16(view, centralOffset + 8);
      const method = getLittleEndianUint16(view, centralOffset + 10);
      const compressedSize = getLittleEndianUint32(view, centralOffset + 20);
      const uncompressedSize = getLittleEndianUint32(view, centralOffset + 24);
      const nameLength = getLittleEndianUint16(view, centralOffset + 28);
      const extraLength = getLittleEndianUint16(view, centralOffset + 30);
      const commentLength = getLittleEndianUint16(view, centralOffset + 32);
      const localHeaderOffset = getLittleEndianUint32(view, centralOffset + 42);
      const nameBytes = bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength);
      const name = decodeZipEntryName(nameBytes, (flags & 0x0800) !== 0).replace(/\\/g, '/');

      centralOffset += 46 + nameLength + extraLength + commentLength;
      if (!name || name.endsWith('/')) continue;

      if (getLittleEndianUint32(view, localHeaderOffset) !== 0x04034b50) {
        throw new Error('Некорректный локальный заголовок zip для файла ' + name + '.');
      }

      const localNameLength = getLittleEndianUint16(view, localHeaderOffset + 26);
      const localExtraLength = getLittleEndianUint16(view, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      let data;

      if (method === 0) {
        data = compressed;
      } else if (method === 8) {
        data = await inflateRawZipBytes(compressed);
      } else {
        throw new Error('Zip использует неподдержанный метод сжатия ' + method + ' для файла ' + name + '.');
      }

      if (uncompressedSize && data.length !== uncompressedSize) {
        throw new Error('Размер распакованного файла не совпал для ' + name + '.');
      }

      entries.set(name, data);
    }

    return entries;
  }

  function decodeUtf8Text(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (_) {
      try {
        return new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
      } catch (error) {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      }
    }
  }

  function parseXmlDocument(xmlText, label) {
    const documentXml = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
    const parserError = documentXml.querySelector('parsererror');
    if (parserError) throw new Error('Не удалось прочитать XML: ' + label + '.');
    return documentXml;
  }

  function getFirstZipEntry(entries, names) {
    for (const name of names) {
      if (entries.has(name)) return entries.get(name);
    }
    return null;
  }

  function getZipEntryText(entries, name) {
    const data = entries.get(name);
    return data ? decodeUtf8Text(data) : '';
  }

  function getXmlTextContent(node) {
    return node ? String(node.textContent || '') : '';
  }

  function parseXlsxSharedStrings(entries) {
    const xml = getZipEntryText(entries, 'xl/sharedStrings.xml');
    if (!xml) return [];

    const doc = parseXmlDocument(xml, 'sharedStrings.xml');
    return Array.from(doc.getElementsByTagName('si')).map((si) => {
      const textNodes = Array.from(si.getElementsByTagName('t'));
      return textNodes.map(getXmlTextContent).join('');
    });
  }

  function getXlsxSheetPath(entries, targetSheetName) {
    const workbookXml = getZipEntryText(entries, 'xl/workbook.xml');
    if (!workbookXml) return 'xl/worksheets/sheet1.xml';

    const workbook = parseXmlDocument(workbookXml, 'workbook.xml');
    const sheets = Array.from(workbook.getElementsByTagName('sheet'));
    const targetSheet = sheets.find((sheet) => String(sheet.getAttribute('name') || '').trim() === targetSheetName)
      || sheets[0];
    if (!targetSheet) return 'xl/worksheets/sheet1.xml';

    const relId = targetSheet.getAttribute('r:id') || targetSheet.getAttribute('id') || '';
    if (!relId) return 'xl/worksheets/sheet1.xml';

    const relsXml = getZipEntryText(entries, 'xl/_rels/workbook.xml.rels');
    if (!relsXml) return 'xl/worksheets/sheet1.xml';

    const rels = parseXmlDocument(relsXml, 'workbook.xml.rels');
    const rel = Array.from(rels.getElementsByTagName('Relationship'))
      .find((item) => String(item.getAttribute('Id') || '') === relId);
    const target = rel ? String(rel.getAttribute('Target') || '').replace(/\\/g, '/') : '';
    if (!target) return 'xl/worksheets/sheet1.xml';
    if (target.startsWith('/')) return target.replace(/^\/+/, '');
    if (target.startsWith('xl/')) return target;
    return 'xl/' + target.replace(/^\/+/, '');
  }

  function getColumnIndexFromCellRef(cellRef) {
    const letters = String(cellRef || '').match(/^[A-Z]+/i);
    if (!letters) return 0;

    let result = 0;
    for (const letter of letters[0].toUpperCase()) {
      result = result * 26 + (letter.charCodeAt(0) - 64);
    }
    return Math.max(0, result - 1);
  }

  async function parseXlsxRows(bytes, targetSheetName) {
    const entries = await readZipEntries(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const sharedStrings = parseXlsxSharedStrings(entries);
    const sheetPath = getXlsxSheetPath(entries, targetSheetName);
    const sheetData = getFirstZipEntry(entries, [sheetPath, 'xl/worksheets/sheet1.xml']);
    if (!sheetData) throw new Error('В status_index.xlsx не найден лист ' + targetSheetName + '.');

    const sheet = parseXmlDocument(decodeUtf8Text(sheetData), sheetPath);
    const rows = [];
    Array.from(sheet.getElementsByTagName('row')).forEach((rowNode) => {
      const row = [];
      Array.from(rowNode.getElementsByTagName('c')).forEach((cellNode) => {
        const cellRef = cellNode.getAttribute('r') || '';
        const columnIndex = getColumnIndexFromCellRef(cellRef);
        const cellType = cellNode.getAttribute('t') || '';
        let value = '';

        if (cellType === 'inlineStr') {
          value = getXmlTextContent(cellNode.getElementsByTagName('t')[0]);
        } else {
          const rawValue = getXmlTextContent(cellNode.getElementsByTagName('v')[0]);
          value = cellType === 's'
            ? String(sharedStrings[Number(rawValue)] || '')
            : String(rawValue || '');
        }

        row[columnIndex] = value;
      });
      rows.push(row.map((value) => String(value == null ? '' : value)));
    });

    return rows;
  }

  function normalizeWssText(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+$/gm, '')
      .replace(/^\n+|\n+$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeWssCellValue(value) {
    const text = normalizeWssText(value);
    return text === '-' || text === '–' || text === '—' ? '' : text;
  }

  function decodeHtmlFragment(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  }

  function normalizeWssTableCell(value) {
    return normalizeWssText(decodeHtmlFragment(String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\\\|/g, '|')));
  }

  function normalizeWssHeaderPart(value) {
    return normalizeWssTableCell(value).replace(/\n+/g, ', ').trim();
  }

  function stripMarkdownFence(value) {
    const text = String(value || '').trim();
    const match = text.match(/^```(?:text)?\s*\n([\s\S]*?)\n```\s*$/i);
    return match ? match[1] : text;
  }

  function extractWssMetaValue(markdown, label) {
    const match = String(markdown || '').match(new RegExp('^-\\s+`' + escapeRegExp(label) + '`:\\s*(.*?)\\s*$', 'm'));
    return match ? normalizeWssCellValue(match[1]) : '';
  }

  function extractWssHeadingBlock(markdown, level, label) {
    const prefix = '#'.repeat(level);
    const re = new RegExp('^' + prefix + '\\s+' + escapeRegExp(label) + '\\s*\\n([\\s\\S]*?)(?=^#{1,' + level + '}\\s+|\\Z)', 'm');
    const match = String(markdown || '').match(re);
    return match ? match[1].trim() : '';
  }

  function extractWssCardValue(markdown, label) {
    return normalizeWssCellValue(stripMarkdownFence(extractWssHeadingBlock(markdown, 3, label)));
  }

  function splitMarkdownTableRow(line) {
    const text = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells = [];
    let current = '';
    let escaped = false;

    for (const ch of text) {
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        current += ch;
        continue;
      }
      if (ch === '|') {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }

    cells.push(current.trim());
    return cells;
  }

  function parseWssHistoryEntries(markdown) {
    const section = extractWssHeadingBlock(markdown, 2, 'Расширенная история решений');
    if (!section) return [];

    return section.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|'))
      .filter((line) => !/^\|\s*-+/.test(line))
      .filter((line) => !/^\|\s*Роль\s*\|/.test(line))
      .map((line) => splitMarkdownTableRow(line))
      .filter((cells) => cells.length >= 6)
      .map((cells) => {
        const user = normalizeWssHeaderPart(cells[1]);
        const solution = normalizeWssHeaderPart(cells[2]);
        const date = normalizeWssHeaderPart(cells[3]);
        const comment = normalizeWssTableCell(cells[4]) || 'комментария нет';
        const notified = normalizeWssHeaderPart(cells[5]);
        return {
          date,
          user,
          notified,
          solution,
          comment
        };
      })
      .filter((entry) => entry.date || entry.user || entry.notified || entry.solution || entry.comment);
  }

  function getWssAttachmentBlocks(markdown) {
    const section = extractWssHeadingBlock(markdown, 2, 'Доп. файлы');
    if (!section) return [];

    const matches = [];
    const re = /^###\s+Файл\s+(.+?)\s*$([\s\S]*?)(?=^###\s+Файл\s+|\Z)/gm;
    let match;
    while ((match = re.exec(section)) !== null) {
      matches.push({
        title: normalizeWssText(match[1]),
        body: String(match[2] || '').trim()
      });
    }
    return matches;
  }

  function extractWssAttachmentText(body) {
    const textBlockMatch = String(body || '').match(/^####\s+.+?\s*\n```(?:text)?\s*\n([\s\S]*?)\n```/m);
    return normalizeWssCellValue(textBlockMatch ? textBlockMatch[1] : '');
  }

  function parseWssAttachmentEntries(markdown) {
    return getWssAttachmentBlocks(markdown)
      .map((block) => {
        const statusMatch = block.body.match(/^-+\s*Статус:\s*(.+?)\s*$/m) || block.body.match(/^-\s+Статус:\s*(.+?)\s*$/m);
        const status = statusMatch ? normalizeWssText(statusMatch[1]).toLocaleLowerCase('ru-RU') : '';
        if (status !== 'ок') return null;

        const text = extractWssAttachmentText(block.body);
        if (!text || /^Документ не содержит извлекаемого текста\.?$/i.test(text)) return null;

        const fileName = normalizeWssText(block.title.replace(/^\d+\.\s*/, ''));
        return {
          title: fileName ? 'Файл ' + fileName : 'Файл',
          text
        };
      })
      .filter(Boolean);
  }

  function parseStatusIndexRows(rows) {
    const headers = (rows[0] || []).map((value) => String(value || '').trim());
    const headerMap = {};
    headers.forEach((header, index) => {
      if (header && !Object.prototype.hasOwnProperty.call(headerMap, header)) headerMap[header] = index;
    });

    ['wss_id', 'last_parsed_at'].forEach((header) => {
      if (!Object.prototype.hasOwnProperty.call(headerMap, header)) {
        throw new Error('В status_index.xlsx не найдена колонка ' + header + '.');
      }
    });

    const byWssId = new Map();
    rows.slice(1).forEach((row) => {
      const wssId = String(row[headerMap.wss_id] || '').trim();
      if (!wssId) return;
      byWssId.set(wssId, {
        wssId,
        regNumber: String(row[headerMap.reg_number] || '').trim(),
        lastParsedAt: String(row[headerMap.last_parsed_at] || '').trim(),
        lastParseResult: Object.prototype.hasOwnProperty.call(headerMap, 'last_parse_result')
          ? String(row[headerMap.last_parse_result] || '').trim()
          : ''
      });
    });
    return byWssId;
  }

  function parseWssMarkdownRow(markdown, indexEntry) {
    const text = String(markdown || '').replace(/\r\n?/g, '\n');
    const wssId = extractWssMetaValue(text, 'WSS ID');
    if (!wssId) throw new Error('В md-файле не найден WSS ID.');

    return {
      wssId,
      lastParsedAt: indexEntry && indexEntry.lastParsedAt ? indexEntry.lastParsedAt : '',
      values: {
        'WSS ID': wssId,
        'Рег. номер': extractWssMetaValue(text, 'Рег. номер'),
        'Краткое описание задачи': extractWssCardValue(text, 'Краткое описание задачи'),
        'Содержание': extractWssCardValue(text, 'Содержание'),
        'Дата регистрации': extractWssMetaValue(text, 'Дата регистрации'),
        'Этап': extractWssMetaValue(text, 'Этап'),
        'Статус': extractWssMetaValue(text, 'Статус'),
        'Призано исполненным': extractWssMetaValue(text, 'Признано исполненным'),
        'Заказчик': extractWssCardValue(text, 'Заказчик'),
        'Ответственный': extractWssCardValue(text, 'Ответственный'),
        'Плановое количество часов': extractWssCardValue(text, 'Плановое количество часов'),
        'Исполнить до': extractWssCardValue(text, 'Исполнить до'),
        'Комментарий': extractWssCardValue(text, 'Комментарий'),
        'Номер заявки в СУПП': extractWssCardValue(text, 'Номер заявки в СУПП'),
        'Состояние заявки в СУПП': extractWssCardValue(text, 'Состояние заявки в СУПП'),
        'Связанные задачи СУПП': extractWssCardValue(text, 'Связанные задачи СУПП'),
        'last_parsed_at': indexEntry && indexEntry.lastParsedAt ? indexEntry.lastParsedAt : ''
      },
      historyEntries: parseWssHistoryEntries(text),
      attachmentEntries: parseWssAttachmentEntries(text)
    };
  }

  async function buildWssArchiveRows(file) {
    const archiveEntries = await readZipEntries(await file.arrayBuffer());
    const statusIndexEntry = archiveEntries.get('status_index.xlsx')
      || archiveEntries.get('Status_index.xlsx')
      || archiveEntries.get('STATUS_INDEX.XLSX')
      || Array.from(archiveEntries.entries()).find(([name]) => /(^|\/)status_index\.xlsx$/i.test(name))?.[1];
    if (!statusIndexEntry) throw new Error('В архиве не найден status_index.xlsx.');

    const statusRows = await parseXlsxRows(statusIndexEntry, 'status_index');
    const indexByWssId = parseStatusIndexRows(statusRows);
    const markdownEntries = Array.from(archiveEntries.entries())
      .filter(([name]) => /\.md$/i.test(name))
      .sort((left, right) => left[0].localeCompare(right[0], 'ru-RU'));

    if (!markdownEntries.length) throw new Error('В архиве не найдены md-файлы заявок.');

    const rows = [];
    const errors = [];
    const seen = new Set();
    let skippedMissingIndex = 0;

    markdownEntries.forEach(([name, data]) => {
      try {
        const markdown = decodeUtf8Text(data);
        const wssId = extractWssMetaValue(markdown, 'WSS ID');
        if (!wssId) throw new Error('не найден WSS ID');
        if (seen.has(wssId)) throw new Error('дублирующийся WSS ID ' + wssId);
        seen.add(wssId);

        const indexEntry = indexByWssId.get(wssId);
        if (!indexEntry) {
          skippedMissingIndex += 1;
          errors.push(name + ': WSS ID ' + wssId + ' отсутствует в status_index.xlsx');
          return;
        }

        rows.push(parseWssMarkdownRow(markdown, indexEntry));
      } catch (error) {
        errors.push(name + ': ' + (error && error.message ? error.message : String(error)));
      }
    });

    const indexMissingMarkdown = Array.from(indexByWssId.keys()).filter((wssId) => !seen.has(wssId));
    const attachmentsCount = rows.reduce((sum, row) => sum + row.attachmentEntries.length, 0);
    const historyEntriesCount = rows.reduce((sum, row) => sum + row.historyEntries.length, 0);
    const longFieldsCount = rows.reduce((sum, row) => {
      const content = String(row.values['Содержание'] || '');
      const historyLength = row.historyEntries.reduce((total, entry) => total
        + String(entry.date || '').length
        + String(entry.user || '').length
        + String(entry.notified || '').length
        + String(entry.solution || '').length
        + String(entry.comment || '').length
        + 8, 0);
      const attachmentsLength = row.attachmentEntries.reduce((total, entry) => total + String(entry.title || '').length + String(entry.text || '').length + 2, 0);
      return sum + (content.length > WSS_IMPORT_TEXT_LIMIT ? 1 : 0)
        + (historyLength > WSS_IMPORT_TEXT_LIMIT ? 1 : 0)
        + (attachmentsLength > WSS_IMPORT_TEXT_LIMIT ? 1 : 0);
    }, 0);

    return {
      rows,
      stats: {
        fileName: file.name,
        mdCount: markdownEntries.length,
        statusIndexCount: indexByWssId.size,
        readyCount: rows.length,
        attachmentsCount,
        historyEntriesCount,
        longFieldsCount,
        skippedMissingIndex,
        indexMissingMarkdownCount: indexMissingMarkdown.length,
        errors: errors.slice(0, 20),
        errorsCount: errors.length
      }
    };
  }

  function normalizeChatGptMode(mode) {
    if (mode === CHATGPT_MODE_WSS_SEARCH) return CHATGPT_MODE_WSS_SEARCH;
    return mode === CHATGPT_MODE_QUESTION ? CHATGPT_MODE_QUESTION : CHATGPT_MODE_SEARCH;
  }

  function getChatGptModeDraft(mode) {
    const normalizedMode = normalizeChatGptMode(mode);
    if (normalizedMode === CHATGPT_MODE_QUESTION) return String(chatGptSearchState.questionQuery || '');
    if (normalizedMode === CHATGPT_MODE_WSS_SEARCH) return String(chatGptSearchState.wssSearchQuery || '');
    return String(chatGptSearchState.searchQuery || '');
  }

  function setChatGptModeDraft(mode, value) {
    const text = String(value || '');
    const normalizedMode = normalizeChatGptMode(mode);
    if (normalizedMode === CHATGPT_MODE_QUESTION) {
      chatGptSearchState.questionQuery = text;
      return;
    }
    if (normalizedMode === CHATGPT_MODE_WSS_SEARCH) {
      chatGptSearchState.wssSearchQuery = text;
      return;
    }
    chatGptSearchState.searchQuery = text;
  }

  function isChatGptOpenChatMode(mode) {
    const normalizedMode = normalizeChatGptMode(mode);
    return normalizedMode === CHATGPT_MODE_QUESTION || normalizedMode === CHATGPT_MODE_WSS_SEARCH;
  }

  function buildChatGptSearchPrompt(query) {
    return `${String(query || '').trim()}

Используй только данные из приложенного CSV-файла. Не используй внешние знания, интернет, догадки или сведения, которых нет в CSV.

Ищи заявки по смыслу, а не по точному совпадению слов.
Приоритет анализа:
1. Главный источник смысла — столбец «Текст заявки».
2. Второй по важности — столбец «Информация из СУПП/ITIL».
3. Остальные столбцы используй только как вспомогательные признаки для уточнения и подтверждения совпадения, но не как основной критерий поиска.

Не своди поиск к полям «Проблемы», «Инициатор», номерам заявок или буквальному совпадению формулировок.

Верни только один JSON-объект без markdown, без пояснений до или после него, строго в таком формате:
{"matches":[{"row_id":123,"reason":"краткое объяснение совпадения"}]}

Правила ответа:
- row_id бери только из столбца «${CHATGPT_ROW_ID_HEADER}» приложенного CSV;
- добавляй строку только если она действительно соответствует смыслу запроса;
- reason можешь оставить пустой строкой, если пояснение не нужно;
- внутри reason не используй двойные кавычки; если они нужны, замени их на одинарные или оставь reason пустым;
- JSON должен быть валидным: используй двойные кавычки и не ставь завершающие запятые перед } или ];
- не возвращай исходные данные строк и не переписывай значения других столбцов;
- если совпадений нет, верни ровно {"matches":[]}.`;
  }

  function buildChatGptQuestionPrompt(query) {
    return `${String(query || '').trim()}

Используй только данные из приложенного CSV-файла. Не используй внешние знания, интернет, догадки или сведения, которых нет в CSV.

Работай как исследователь по внутреннему архиву заявок. Нужен развернутый аналитический ответ по существующим заявкам, а не общий совет.

Приоритет анализа:
1. Главный источник смысла — столбец «${TEXT_HEADER}».
2. Второй по важности — столбец «${ITIL_INFO_HEADER}».
3. Остальные столбцы используй как контекст: дата, статус, инициатор, проблема и номера заявок.

Обязательные правила:
- отвечай только на основе CSV;
- не додумывай причины, факты или выводы, которых нет в заявках;
- если данных недостаточно для уверенного ответа, прямо так и напиши;
- если в заявках есть разные версии или противоречия, вынеси их отдельным блоком;
- каждый существенный вывод подтверждай ссылками на конкретные заявки и точными короткими цитатами;
- если в строке есть «${SUPP_NUMBER_HEADER}» и оно не пустое и не равно «-» или «–», ссылайся на заявку по номеру СУПП;
- если «${SUPP_NUMBER_HEADER}» пустое или равно «-» или «–», ссылайся на «${ITIL_NUMBER_HEADER}»;
- если отсутствуют оба номера, используй «${CHATGPT_ROW_ID_HEADER}» как резервную ссылку;
- цитаты бери только из приложенного CSV и не меняй их смысл.

Оформи ответ в стиле глубокого исследования с такими разделами:
1. Краткий вывод
2. Развернутый анализ
3. Подтверждающие заявки и цитаты
4. Противоречия и альтернативные трактовки
5. Чего не хватает в данных

В разделе «Подтверждающие заявки и цитаты» для каждой заявки используй формат:
- Источник: СУПП <номер> / ITIL <номер> / row_id <номер>
- Что подтверждает: ...
- Цитата: ...

Не используй markdown-таблицы. Можно использовать обычные абзацы и списки.`;
  }

  function buildWssChatGptSearchPrompt(query) {
    return `${String(query || '').trim()}

Используй только данные из приложенного CSV-файла листа WSS. Не используй внешние знания, интернет, догадки или сведения, которых нет в CSV.

Нужно найти заявки WSS, которые лучше всего соответствуют запросу пользователя. Ищи по смыслу, а не только по буквальному совпадению.

Приоритет анализа:
1. Главный источник смысла — столбцы «Краткое описание задачи» и «Содержание».
2. Второй по важности источник — «Расширенная история решений».
3. «Доп. файлы», «Комментарий», статусы, этапы, заказчик, ответственный и связанные задачи СУПП используй как дополнительный контекст.

Обязательные правила:
- отвечай только на основе CSV;
- не придумывай факты, которых нет в заявках;
- если точного совпадения нет, отдельно покажи частичные совпадения или прямо напиши, что подходящих заявок не найдено;
- каждый найденный результат подтверждай WSS ID, рег. номером и короткой точной цитатой из CSV;
- если несколько заявок похожи, отсортируй их от наиболее релевантной к менее релевантной;
- не используй markdown-таблицы.

Оформи ответ так:
1. Лучшие совпадения
2. Почему они подходят
3. Подтверждающие цитаты
4. Частичные или сомнительные совпадения
5. Чего не хватает для уверенного вывода

Для каждой заявки используй формат:
- WSS ID: <номер>, рег. номер: <номер>
- Статус/этап: ...
- Почему подходит: ...
- Цитата: ...`;
  }

  function getChatGptModeConfig(mode) {
    const normalizedMode = normalizeChatGptMode(mode);
    if (normalizedMode === CHATGPT_MODE_WSS_SEARCH) {
      return {
        title: 'Поиск заявки WSS',
        subtitle: 'Расширение само соберёт компактный CSV листа «WSS», откроет временный чат ChatGPT, прикрепит CSV и отправит поисковый запрос по архиву WSS.',
        label: 'Введите запрос для поиска заявки WSS',
        placeholder: 'Например: заявки по ошибкам публикации, распределению оплат или конкретному функционалу',
        startText: 'Отправить в ChatGPT',
        runningText: 'Отправляю…',
        idleStatus: 'Введите запрос и откройте поиск WSS в ChatGPT.',
        emptyQueryError: 'Введите запрос для поиска заявки WSS.',
        collectStatus: 'Собираю компактный CSV листа «WSS»...',
        openingStatus: 'Открываю вкладку ChatGPT, прикрепляю CSV WSS и отправляю запрос...',
        successStatus: 'CSV WSS и поисковый промпт отправлены в ChatGPT. Продолжай работу в открытой вкладке чата.',
        launcherSuccessStatus: 'Поиск по WSS отправлен в ChatGPT. Продолжай работу в открытой вкладке.',
        errorFallback: 'Не удалось отправить поиск WSS в ChatGPT.',
        promptBuilder: buildWssChatGptSearchPrompt,
        fileName: WSS_CHATGPT_SEARCH_FILE_NAME,
        sheetName: WSS_SHEET_NAME,
        visibleHeaders: WSS_CHATGPT_VISIBLE_HEADERS,
        csvHeaders: WSS_CHATGPT_CSV_HEADERS,
        openInChat: true
      };
    }

    if (normalizedMode === CHATGPT_MODE_QUESTION) {
      return {
        title: 'Задать вопрос по заявкам',
        subtitle: 'Расширение само соберёт компактный CSV листа «Заявки», откроет временный чат ChatGPT, прикрепит CSV и отправит вопрос вместе с исследовательским промптом. Дальше работа продолжится прямо во вкладке ChatGPT.',
        label: 'Введите вопрос по существующим заявкам',
        placeholder: 'Например: какие повторяющиеся причины отказов или ошибок чаще всего встречаются в заявках по ЕПГУ?',
        startText: 'Отправить в ChatGPT',
        runningText: 'Отправляю…',
        idleStatus: 'Введите вопрос и откройте исследование в ChatGPT.',
        emptyQueryError: 'Введите вопрос по заявкам.',
        collectStatus: 'Собираю компактный CSV листа «Заявки»...',
        openingStatus: 'Открываю вкладку ChatGPT, прикрепляю CSV и отправляю вопрос...',
        successStatus: 'CSV, вопрос и исследовательский промпт отправлены в ChatGPT. Продолжай работу в открытой вкладке чата.',
        launcherSuccessStatus: 'Вопрос по заявкам отправлен в ChatGPT. Продолжай работу в открытой вкладке.',
        errorFallback: 'Не удалось отправить вопрос в ChatGPT.',
        promptBuilder: buildChatGptQuestionPrompt,
        fileName: CHATGPT_QUESTION_FILE_NAME,
        sheetName: CHATGPT_SEARCH_SHEET_NAME,
        visibleHeaders: CHATGPT_SEARCH_VISIBLE_HEADERS,
        csvHeaders: CHATGPT_SEARCH_CSV_HEADERS,
        openInChat: true
      };
    }

    return {
      title: 'Поиск заявки',
      subtitle: `Расширение само соберёт компактный CSV листа «Заявки», отправит запрос в фоновый временный чат и запишет найденные строки на лист «${CHATGPT_RESULT_SHEET_NAME}».`,
      label: 'Введите произвольный запрос для поиска заявки',
      placeholder: 'Например: заявки Зуйкевич Данил Иванович по теме ЕПГУ',
      startText: 'Найти заявки',
      runningText: 'Ищу…',
      idleStatus: 'Введите запрос и запустите поиск.',
      emptyQueryError: 'Введите запрос для поиска заявки.',
      collectStatus: 'Собираю компактный CSV листа «Заявки»...',
      openingStatus: 'Открываю вкладку ChatGPT и готовлю отправку...',
      successStatus: '',
      errorFallback: 'Не удалось выполнить поиск через ChatGPT.',
      promptBuilder: buildChatGptSearchPrompt,
      fileName: CHATGPT_SEARCH_FILE_NAME,
      sheetName: CHATGPT_SEARCH_SHEET_NAME,
      visibleHeaders: CHATGPT_SEARCH_VISIBLE_HEADERS,
      csvHeaders: CHATGPT_SEARCH_CSV_HEADERS,
      openInChat: false
    };
  }

  function normalizeChatGptCsvCell(header, value) {
    const text = String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim();
    const limit = Number(WSS_CHATGPT_LONG_TEXT_HEADERS[header] || 0);
    if (!limit || text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 19)).replace(/\s+$/g, '') + '\n[текст сокращен]';
  }

  async function loadChatGptSearchCsv(modeConfig) {
    const config = modeConfig && typeof modeConfig === 'object'
      ? modeConfig
      : getChatGptModeConfig(CHATGPT_MODE_SEARCH);
    const sheetName = String(config.sheetName || CHATGPT_SEARCH_SHEET_NAME);
    const visibleHeaders = Array.isArray(config.visibleHeaders) && config.visibleHeaders.length
      ? config.visibleHeaders
      : CHATGPT_SEARCH_VISIBLE_HEADERS;
    const csvHeaders = Array.isArray(config.csvHeaders) && config.csvHeaders.length
      ? config.csvHeaders
      : [CHATGPT_ROW_ID_HEADER, ...visibleHeaders];
    const response = await fetch(getSheetCsvUrl(sheetName), { credentials: 'omit' });
    if (!response.ok) throw new Error(`CSV-экспорт листа «${sheetName}» вернул HTTP ${response.status}.`);

    const rows = parseCsv(await response.text());
    const headers = rows[0] || [];
    const columnIndexes = visibleHeaders.map((header) => headers.indexOf(header));
    const missingHeaders = visibleHeaders.filter((header, index) => columnIndexes[index] < 0);
    if (missingHeaders.length) {
      throw new Error(`Не найдены колонки для поиска: ${missingHeaders.join(', ')}.`);
    }

    const compactRows = [csvHeaders.slice()];
    const rowMap = {};
    for (let index = 1; index < rows.length; index++) {
      const sourceRow = rows[index] || [];
      const visibleRow = columnIndexes.map((columnIndex, headerIndex) => normalizeChatGptCsvCell(
        visibleHeaders[headerIndex],
        sourceRow[columnIndex]
      ));
      if (!visibleRow.some((cell) => cell.trim())) continue;

      const rowId = index + 1;
      compactRows.push([String(rowId), ...visibleRow]);
      rowMap[rowId] = visibleRow;
    }

    return {
      csvText: buildCsvText(compactRows),
      rowsCount: compactRows.length - 1,
      headers: visibleHeaders.slice(),
      rowMap
    };
  }

  function parseChatGptSearchMatches(answerText) {
    const text = String(answerText || '').trim();
    if (!text) throw new Error('ChatGPT вернул пустой ответ.');

    const parsed = parseChatGptSearchJson(text);

    const source = parsed && Array.isArray(parsed.matches) ? parsed.matches : null;
    if (!source) throw new Error('ChatGPT вернул JSON без массива matches.');

    const seen = new Set();
    return source.map((item) => {
      const rowId = Number(item && item.row_id);
      if (!Number.isInteger(rowId) || rowId < 2 || seen.has(rowId)) return null;
      seen.add(rowId);
      return {
        rowId,
        reason: String(item && item.reason || '').trim()
      };
    }).filter(Boolean);
  }

  function parseChatGptSearchJson(text) {
    const candidates = [];
    const addCandidate = (value) => {
      const candidate = normalizeChatGptSearchJsonCandidate(value);
      if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    };

    addCandidate(text);
    addCandidate(extractFirstJsonObjectText(text));

    let lastError = null;
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        lastError = error;
      }

      const repaired = repairChatGptSearchJson(candidate);
      if (repaired === candidate) continue;

      try {
        return JSON.parse(repaired);
      } catch (error) {
        lastError = error;
      }
    }

    for (const candidate of candidates) {
      const loose = parseChatGptSearchJsonLoosely(candidate);
      if (loose) return loose;
    }

    throw new Error(lastError && lastError.message
      ? `ChatGPT вернул некорректный JSON: ${lastError.message}`
      : 'ChatGPT вернул ответ не в JSON-формате.');
  }

  function normalizeChatGptSearchJsonCandidate(value) {
    return String(value || '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  function repairChatGptSearchJson(value) {
    return String(value || '').replace(/,\s*([}\]])/g, '$1');
  }

  function parseChatGptSearchJsonLoosely(value) {
    const text = String(value || '');
    const rowIdMatches = Array.from(text.matchAll(/["']row_id["']\s*:\s*(-?\d+)/gi));
    if (!rowIdMatches.length) return null;

    const matches = rowIdMatches.map((match, index) => {
      const rowId = Number(match[1]);
      if (!Number.isInteger(rowId)) return null;

      const nextMatch = rowIdMatches[index + 1];
      const startIndex = match.index + match[0].length;
      const endIndex = nextMatch ? nextMatch.index : text.length;
      return {
        row_id: rowId,
        reason: extractLooseChatGptSearchReason_(text.slice(startIndex, endIndex))
      };
    }).filter(Boolean);

    return matches.length ? { matches } : null;
  }

  function extractLooseChatGptSearchReason_(value) {
    const text = String(value || '');
    const reasonMatch = text.match(/["']reason["']\s*:\s*/i);
    if (!reasonMatch) return '';

    let index = reasonMatch.index + reasonMatch[0].length;
    while (index < text.length && /\s/.test(text[index])) index++;
    if (index >= text.length) return '';

    const quote = text[index];
    if (quote !== '"' && quote !== '\'') {
      const endIndex = text.slice(index).search(/\s*[,}\]]/);
      return String(endIndex === -1 ? text.slice(index) : text.slice(index, index + endIndex)).trim();
    }

    let result = '';
    let isEscaped = false;
    for (let cursor = index + 1; cursor < text.length; cursor++) {
      const ch = text[cursor];

      if (isEscaped) {
        result += decodeLooseChatGptSearchEscape_(ch);
        isEscaped = false;
        continue;
      }

      if (ch === '\\') {
        isEscaped = true;
        continue;
      }

      if (ch === quote) {
        const tail = text.slice(cursor + 1);
        if (/^\s*(?:[,}\]])/.test(tail)) {
          return result.trim();
        }
      }

      result += ch;
    }

    return result.trim();
  }

  function decodeLooseChatGptSearchEscape_(value) {
    switch (value) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case '"':
        return '"';
      case '\'':
        return '\'';
      case '\\':
        return '\\';
      default:
        return String(value || '');
    }
  }

  function extractFirstJsonObjectText(value) {
    const text = String(value || '');
    const startIndex = text.indexOf('{');
    if (startIndex < 0) return '';

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = startIndex; index < text.length; index++) {
      const ch = text[index];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (ch === '\\') {
          isEscaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (!depth) return text.slice(startIndex, index + 1);
      }
    }

    return '';
  }

  function buildChatGptSearchResultTable(csv, matches) {
    const headers = [...csv.headers];
    const hasReasons = matches.some((match) => match.reason);
    if (hasReasons) headers.push('Пояснение совпадения');

    const missingRowIds = [];
    const rows = matches.map((match) => {
      const sourceRow = csv.rowMap[match.rowId];
      if (!Array.isArray(sourceRow)) {
        missingRowIds.push(match.rowId);
        return null;
      }
      return hasReasons ? [...sourceRow, match.reason] : sourceRow.slice();
    }).filter(Boolean);

    if (missingRowIds.length) {
      throw new Error(`ChatGPT вернул неизвестные row_id: ${missingRowIds.join(', ')}.`);
    }

    return { headers, rows };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeCsvTable(rows) {
    return (rows || []).map((row) => (row || []).map((value) => String(value == null ? '' : value)));
  }

  function areCsvTablesEqual(leftRows, rightRows) {
    const left = normalizeCsvTable(leftRows);
    const right = normalizeCsvTable(rightRows);

    if (left.length !== right.length) return false;

    for (let rowIndex = 0; rowIndex < left.length; rowIndex++) {
      const leftRow = left[rowIndex] || [];
      const rightRow = right[rowIndex] || [];
      if (leftRow.length !== rightRow.length) return false;

      for (let columnIndex = 0; columnIndex < leftRow.length; columnIndex++) {
        if (leftRow[columnIndex] !== rightRow[columnIndex]) return false;
      }
    }

    return true;
  }

  function buildHeaderIndexMap(headers) {
    const map = Object.create(null);
    (headers || []).forEach((header, index) => {
      const normalized = String(header == null ? '' : header).trim();
      if (normalized && !Object.prototype.hasOwnProperty.call(map, normalized)) {
        map[normalized] = index;
      }
    });
    return map;
  }

  function getNonEmptyCsvRows(rows) {
    return normalizeCsvTable(rows).filter((row) => row.some((value) => String(value || '').trim()));
  }

  function buildRowsByHeaders(headers, rows) {
    const normalizedHeaders = (headers || []).map((header) => String(header == null ? '' : header).trim());
    return getNonEmptyCsvRows(rows).map((row) => normalizedHeaders.map((header, index) => {
      if (!header) return '';
      return String(row[index] == null ? '' : row[index]);
    }));
  }

  function extractRowsFromActualSheet(actualRows, expectedHeaders) {
    const normalizedExpectedHeaders = (expectedHeaders || []).map((header) => String(header == null ? '' : header).trim());
    const actualTable = normalizeCsvTable(actualRows);
    const actualHeaders = actualTable[0] || [];
    const actualHeaderIndexMap = buildHeaderIndexMap(actualHeaders);

    const missingHeaders = normalizedExpectedHeaders.filter((header) => header && !Object.prototype.hasOwnProperty.call(actualHeaderIndexMap, header));
    if (missingHeaders.length) return null;

    return getNonEmptyCsvRows(actualTable.slice(1)).map((row) => normalizedExpectedHeaders.map((header) => {
      if (!header) return '';
      const sourceIndex = actualHeaderIndexMap[header];
      return String(row[sourceIndex] == null ? '' : row[sourceIndex]);
    }));
  }

  async function verifyChatGptResultSheetWrite(resultTable) {
    const expectedHeaders = (resultTable.headers || []).map((header) => String(header == null ? '' : header).trim());
    const expectedRows = buildRowsByHeaders(expectedHeaders, resultTable.rows || []);

    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt) await wait(1000);

      try {
        const response = await fetch(`${getSheetCsvUrl(CHATGPT_RESULT_SHEET_NAME)}&cache_bust=${Date.now()}-${attempt}`, {
          credentials: 'omit',
          cache: 'no-store'
        });
        if (!response.ok) continue;

        const actualRows = parseCsv(await response.text());
        const actualMappedRows = extractRowsFromActualSheet(actualRows, expectedHeaders);
        if (!actualMappedRows) continue;
        if (areCsvTablesEqual([expectedHeaders].concat(expectedRows), [expectedHeaders].concat(actualMappedRows))) return true;
      } catch (error) {
        // После сетевой ошибки bridge повторная проверка листа — best effort.
      }
    }

    return false;
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
    const infoColumnIndex = headers.indexOf(ITIL_INFO_HEADER);
    const problemColumnIndex = headers.indexOf(PROBLEM_HEADER);
    const dateColumnIndex = headers.indexOf(REQUEST_DATE_HEADER);
    const statusColumnIndex = headers.indexOf(REQUEST_STATUS_HEADER);
    const currentStageColumnIndex = headers.indexOf(CURRENT_STAGE_HEADER);
    const initiatorColumnIndex = headers.indexOf(INITIATOR_HEADER);
    const itilColumnIndex = headers.indexOf(ITIL_NUMBER_HEADER);
    const suppColumnIndex = headers.indexOf(SUPP_NUMBER_HEADER);
    const favoriteColumnIndex = headers.indexOf(FAVORITE_HEADER);
    if (
      textColumnIndex < 0 ||
      infoColumnIndex < 0 ||
      problemColumnIndex < 0 ||
      dateColumnIndex < 0 ||
      statusColumnIndex < 0 ||
      initiatorColumnIndex < 0 ||
      itilColumnIndex < 0 ||
      suppColumnIndex < 0 ||
      favoriteColumnIndex < 0
    ) {
      throw new Error('Не найдены колонки «Дата заявки», «Статус заявки», «Инициатор», «Номер ITIL», «Номер СУПП (последний)», «Текст заявки», «Информация из СУПП/ITIL», «Проблемы» или «Избранное».');
    }

    const queue = [];
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const text = String(row[textColumnIndex] || '').trim();
      const info = String(row[infoColumnIndex] || '').trim();
      const problem = String(row[problemColumnIndex] || '').trim();

      if (text && !problem) {
        const suppValue = String(row[suppColumnIndex] || '').trim();
        queue.push({
          row: index + 1,
          text,
          info,
          date: String(row[dateColumnIndex] || '').trim(),
          status: String(row[statusColumnIndex] || '').trim(),
          currentStage: currentStageColumnIndex >= 0 ? String(row[currentStageColumnIndex] || '').trim() : '',
          initiator: String(row[initiatorColumnIndex] || '').trim(),
          itilNumber: String(row[itilColumnIndex] || '').trim(),
          suppValue,
          suppNumbers: extractSuppNumbers(suppValue),
          favorite: isFavoriteCellValue(row[favoriteColumnIndex]),
          favoriteAvailable: true
        });
      }
    }
    const summaryRows = queue.map((item) => item.row);
    const [statusBackgrounds, currentStageBackgrounds, initiatorBackgrounds] = await Promise.all([
      loadSummaryColumnBackgrounds(sheetName, summaryRows, statusColumnIndex),
      loadSummaryColumnBackgrounds(sheetName, summaryRows, currentStageColumnIndex),
      loadSummaryColumnBackgrounds(sheetName, summaryRows, initiatorColumnIndex)
    ]);
    applyColumnBackgrounds(queue, 'statusBackgroundColor', statusBackgrounds);
    applyColumnBackgrounds(queue, 'currentStageBackgroundColor', currentStageBackgrounds);
    applyColumnBackgrounds(queue, 'initiatorBackgroundColor', initiatorBackgrounds);

    state = {
      ...state,
      queue,
      currentIndex: 0,
      viewIndex: 0,
      sentCount: 0,
      pendingSaveCount: 0,
      failedSaveCount: 0,
      lastBackgroundError: '',
      sheetName,
      gid,
      rowsCount: rows.length,
      columns: {
        text: textColumnIndex + 1,
        info: infoColumnIndex + 1,
        problem: problemColumnIndex + 1,
        date: dateColumnIndex + 1,
        status: statusColumnIndex + 1,
        initiator: initiatorColumnIndex + 1,
        itil: itilColumnIndex + 1,
        supp: suppColumnIndex + 1,
        favorite: favoriteColumnIndex + 1
      },
      isLoading: false,
      savedSelections: {}
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
      const suppValue = String(row[suppColumnIndex] || '').trim();
      const text = String(row[textColumnIndex] || '').trim();

      if (itilNumber && isSuppPlaceholderLine(suppValue) && !text) {
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

  function isSuppPlaceholderLine(value) {
    const text = String(value || '').trim();
    return text === '–' || text === '—' || text === '-';
  }

  function isFavoriteCellValue(value) {
    return String(value == null ? '' : value).trim().toLowerCase() === 'да';
  }

  function extractSuppNumbers(value) {
    const lines = String(value || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .filter((line) => !isSuppPlaceholderLine(line));

    const unique = [];
    const seen = new Set();
    lines.forEach((line) => {
      if (seen.has(line)) return;
      seen.add(line);
      unique.push(line);
    });

    return unique.reverse();
  }

  function extractSuppNumber(value) {
    const suppNumbers = extractSuppNumbers(value);
    return suppNumbers[0] || '';
  }

  function getItemSuppNumbers(item) {
    if (item && Array.isArray(item.suppNumbers) && item.suppNumbers.length) {
      return item.suppNumbers
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    }
    return extractSuppNumbers(item && item.suppValue ? item.suppValue : '');
  }

  async function loadCurrentSheetSnapshot() {
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
    const indexes = {
      date: headers.indexOf(REQUEST_DATE_HEADER),
      status: headers.indexOf(REQUEST_STATUS_HEADER),
      currentStage: headers.indexOf(CURRENT_STAGE_HEADER),
      initiator: headers.indexOf(INITIATOR_HEADER),
      itil: headers.indexOf(ITIL_NUMBER_HEADER),
      supp: headers.indexOf(SUPP_NUMBER_HEADER),
      text: headers.indexOf(TEXT_HEADER),
      info: headers.indexOf(ITIL_INFO_HEADER),
      favorite: headers.indexOf(FAVORITE_HEADER)
    };

    if ([indexes.date, indexes.status, indexes.initiator, indexes.itil, indexes.supp, indexes.text, indexes.info, indexes.favorite].some((index) => index < 0)) {
      throw new Error('Не найдены колонки «Дата заявки», «Статус заявки», «Инициатор», «Номер ITIL», «Номер СУПП (последний)», «Текст заявки», «Информация из СУПП/ITIL» или «Избранное».');
    }

    const byRow = new Map();
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const rowNumber = index + 1;
        byRow.set(rowNumber, {
          row: rowNumber,
          date: String(row[indexes.date] || '').trim(),
          status: String(row[indexes.status] || '').trim(),
          currentStage: indexes.currentStage >= 0 ? String(row[indexes.currentStage] || '').trim() : '',
          initiator: String(row[indexes.initiator] || '').trim(),
          itilNumber: String(row[indexes.itil] || '').trim(),
          suppValue: String(row[indexes.supp] || '').trim(),
          suppNumbers: extractSuppNumbers(row[indexes.supp]),
          text: String(row[indexes.text] || '').trim(),
          info: String(row[indexes.info] || '').trim(),
          favorite: isFavoriteCellValue(row[indexes.favorite]),
          favoriteAvailable: true
        });
    }

    return {
      sheetName,
      gid,
      rowsCount: rows.length,
      indexes,
      byRow
    };
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

    const itilColumnIndex = headers.indexOf(ITIL_NUMBER_HEADER);

    if (suppColumnIndex < 0 || textColumnIndex < 0 || infoColumnIndex < 0 || itilColumnIndex < 0) {
      throw new Error('Не найдены колонки «Номер ITIL», «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
    }

    const queue = [];
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const suppValue = String(row[suppColumnIndex] || '').trim();
      const suppNumbers = extractSuppNumbers(suppValue);
      const suppNumber = suppNumbers[0] || '';
      const itilNumber = String(row[itilColumnIndex] || '').trim();
      const text = String(row[textColumnIndex] || '').trim();

      if (suppNumber && !text) {
        queue.push({
          row: index + 1,
          suppNumber,
          suppNumbers,
          suppValue,
          itilNumber
        });
      }
    }

    suppState = {
      ...suppState,
      queue,
      currentIndex: 0,
      successCount: 0,
      skippedCount: 0,
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
      statusText: queue.length ? 'Очередь СУПП собрана.' : 'Строк для заполнения из СУПП не найдено.'
    };
  }

  async function loadCombinedSearchQueue() {
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
      const rowNumber = index + 1;
      const text = String(row[textColumnIndex] || '').trim();
      if (text) continue;

      const suppValue = String(row[suppColumnIndex] || '').trim();
      const suppNumbers = extractSuppNumbers(suppValue);
      const suppNumber = suppNumbers[0] || '';
      const itilNumber = String(row[itilColumnIndex] || '').trim();

      if (suppNumber) {
        queue.push({
          mode: 'supp',
          row: rowNumber,
          suppNumber,
          suppNumbers,
          suppValue,
          itilNumber
        });
        continue;
      }

      if (itilNumber && isSuppPlaceholderLine(suppValue)) {
        queue.push({
          mode: 'itil',
          row: rowNumber,
          itilNumber
        });
      }
    }

    combinedFlowState = {
      ...combinedFlowState,
      queue,
      currentIndex: 0,
      successCount: 0,
      skippedCount: 0,
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
      pendingBridgeSaves: [],
      lastError: '',
      statusText: queue.length
        ? `Общая очередь поиска собрана: ${queue.length} строк.`
        : 'Строк для поиска текста заявок не найдено.'
    };
  }

  function getBridgeActionResult(response) {
    return response && response.result && response.result.result
      ? response.result.result
      : null;
  }

  function normalizeSheetBackgroundColor(value) {
    const color = String(value || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) return '';
    const normalized = color.toLowerCase();
    return normalized === '#ffffff' ? '' : normalized;
  }

  async function loadColumnBackgrounds(sheetName, rows, column) {
    const uniqueRows = Array.from(new Set((rows || [])
      .map((row) => Number(row))
      .filter((row) => Number.isInteger(row) && row >= 2)))
      .sort((left, right) => left - right);
    const normalizedColumn = Number(column);

    if (!state.bridgeUrl || !sheetName || !uniqueRows.length || !Number.isInteger(normalizedColumn) || normalizedColumn <= 0) {
      return new Map();
    }

    try {
      const response = await sendRuntimeMessage({
        action: SAVE_ACTION,
        data: {
          bridgeUrl: state.bridgeUrl,
          payload: {
            action: 'getInitiatorBackgrounds',
            spreadsheetId: CONFIG.spreadsheetId,
            sheetName,
            rows: uniqueRows,
            columns: {
              initiator: normalizedColumn
            }
          }
        }
      });

      if (!response || response.success !== true) return new Map();
      const result = getBridgeActionResult(response);
      const backgrounds = new Map();
      (result && Array.isArray(result.rows) ? result.rows : []).forEach((item) => {
        const row = Number(item && item.row);
        const backgroundColor = normalizeSheetBackgroundColor(item && item.backgroundColor);
        if (Number.isInteger(row) && row >= 2 && backgroundColor) {
          backgrounds.set(row, backgroundColor);
        }
      });
      return backgrounds;
    } catch (_) {
      // Форматирование в сводке — удобство, а не причина ломать основной сценарий.
      return new Map();
    }
  }

  function loadSummaryColumnBackgrounds(sheetName, rows, columnIndex) {
    const normalizedIndex = Number(columnIndex);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
      return Promise.resolve(new Map());
    }
    return loadColumnBackgrounds(sheetName, rows, normalizedIndex + 1);
  }

  function applyColumnBackgrounds(queue, colorKey, backgrounds) {
    if (!Array.isArray(queue) || !(backgrounds instanceof Map) || !backgrounds.size) return;

    queue.forEach((item) => {
      if (!item || !Number.isInteger(Number(item.row))) return;
      item[colorKey] = backgrounds.get(Number(item.row)) || '';
    });
  }

  async function loadNewResponseQueue() {
    const snapshot = await loadCurrentSheetSnapshot();
    const sheetName = snapshot.sheetName;

    const response = await sendRuntimeMessage({
      action: SAVE_ACTION,
      data: {
        bridgeUrl: state.bridgeUrl,
        payload: {
          action: 'getNewResponseRows',
          spreadsheetId: CONFIG.spreadsheetId,
          sheetName
        }
      }
    });

    if (!response || response.success !== true) {
      throw new Error(getRuntimeResponseError(response, 'bridge не вернул строки с новыми ответами'));
    }

    const bridgeResult = getBridgeActionResult(response);
    if (!bridgeResult || !Array.isArray(bridgeResult.rows)) {
      throw new Error('Bridge вернул некорректный список строк с новыми ответами.');
    }

    const queue = bridgeResult.rows.map((rowData) => {
      const row = Number(rowData && rowData.row);
      const itilNumber = String(rowData && rowData.itilNumber || '').trim();
      const suppValue = String(rowData && rowData.suppValue || '').trim();
      const suppNumbers = extractSuppNumbers(suppValue);
      const suppNumber = suppNumbers[0] || '';
      const snapshotItem = snapshot.byRow.get(row) || null;
      const forceEmptyInfoPlaceholder = !!(rowData && rowData.forceEmptyInfoPlaceholder);

      if (suppNumber) {
        return {
          row,
          mode: 'supp',
          suppNumber,
          suppNumbers,
          suppValue,
          itilNumber,
          forceEmptyInfoPlaceholder,
          ...(snapshotItem || {})
        };
      }

      if (isSuppPlaceholderLine(suppValue)) {
        return {
          row,
          mode: 'itil',
          itilNumber,
          suppValue,
          forceEmptyInfoPlaceholder,
          ...(snapshotItem || {})
        };
      }

      return {
        row,
        mode: 'invalid',
        suppValue,
        itilNumber,
        ...(snapshotItem || {})
      };
    });
    const summaryRows = queue.map((item) => item.row);
    const [statusBackgrounds, currentStageBackgrounds, initiatorBackgrounds] = await Promise.all([
      loadSummaryColumnBackgrounds(sheetName, summaryRows, snapshot.indexes.status),
      loadSummaryColumnBackgrounds(sheetName, summaryRows, snapshot.indexes.currentStage),
      loadSummaryColumnBackgrounds(sheetName, summaryRows, snapshot.indexes.initiator)
    ]);
    applyColumnBackgrounds(queue, 'statusBackgroundColor', statusBackgrounds);
    applyColumnBackgrounds(queue, 'currentStageBackgroundColor', currentStageBackgrounds);
    applyColumnBackgrounds(queue, 'initiatorBackgroundColor', initiatorBackgrounds);

    newResponseState = {
      ...newResponseState,
      queue,
      currentIndex: 0,
      successCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName,
      gid: snapshot.gid,
      rowsCount: Number(bridgeResult.rowsCount || 0),
      columns: {
        ...(bridgeResult.columns && typeof bridgeResult.columns === 'object' ? bridgeResult.columns : {}),
        date: snapshot.indexes.date + 1,
        status: snapshot.indexes.status + 1,
        initiator: snapshot.indexes.initiator + 1,
        text: snapshot.indexes.text + 1,
        info: snapshot.indexes.info + 1
      },
      lastError: '',
      statusText: queue.length ? 'Очередь новых ответов собрана.' : 'Строк для проверки новых ответов не найдено.'
    };
  }

  function getCurrentItem() {
    return state.queue[state.viewIndex] || null;
  }

  function getCurrentPendingClassificationItem() {
    return state.queue[state.currentIndex] || null;
  }

  function getSavedSelectionForRow(row) {
    const key = String(row || '');
    return Object.prototype.hasOwnProperty.call(state.savedSelections || {}, key)
      ? String(state.savedSelections[key] || '')
      : '';
  }

  function isViewingPastClassificationItem() {
    return Number.isInteger(state.viewIndex) && state.viewIndex < state.currentIndex;
  }

  function canGoBackInClassification() {
    return Array.isArray(state.queue) && state.queue.length > 0 && state.viewIndex > 0;
  }

  function resetClassificationView() {
    state = {
      ...state,
      viewIndex: state.currentIndex
    };
  }

  function goToPreviousClassificationItem() {
    if (!canGoBackInClassification()) return;

    state = {
      ...state,
      viewIndex: Math.max(0, Math.min(state.viewIndex - 1, state.queue.length - 1))
    };

    const modal = ensureModal();
    renderModal();
    focusDefaultCategoryButton(modal, getCurrentItem());
  }

  function getNewResponseReviewCurrentItem() {
    return newResponseReviewState.queue[newResponseReviewState.currentIndex] || null;
  }

  function renderFavoriteControl(modal, item, buttonSelector, layoutSelector) {
    if (!(modal instanceof HTMLElement)) return;

    const button = $(buttonSelector, modal);
    const layout = $(layoutSelector, modal);
    const isFavorite = !!(item && item.favorite);
    const isSaving = !!(item && item.favoriteSaving);
    const isAvailable = !!item && item.favoriteAvailable !== false && !!state.bridgeUrl;

    if (layout instanceof HTMLElement) {
      layout.classList.toggle('is-favorite', isFavorite);
    }

    if (!(button instanceof HTMLButtonElement)) return;
    button.textContent = isFavorite ? '★' : '☆';
    button.classList.toggle('is-active', isFavorite);
    button.classList.toggle('is-saving', isSaving);
    button.disabled = !isAvailable || isSaving;
    button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');

    if (!item) {
      button.setAttribute('aria-label', 'Нет текущей заявки для избранного');
      button.title = 'Нет текущей заявки';
    } else if (!state.bridgeUrl) {
      button.setAttribute('aria-label', 'URL bridge не задан');
      button.title = 'Нажми F2, затем «URL bridge» и задай Apps Script bridge.';
    } else if (item.favoriteAvailable === false) {
      button.setAttribute('aria-label', 'Избранное для этой заявки недоступно');
      button.title = 'Обновите Apps Script bridge и проверьте исходную строку заявки.';
    } else if (isSaving) {
      button.setAttribute('aria-label', 'Сохраняю состояние избранного');
      button.title = 'Сохраняю...';
    } else if (isFavorite) {
      button.setAttribute('aria-label', 'Убрать заявку из избранного');
      button.title = 'Убрать из избранного';
    } else {
      button.setAttribute('aria-label', 'Добавить заявку в избранное');
      button.title = 'Добавить в избранное';
    }
  }

  async function toggleFavoriteItem(item, sheetName, render) {
    if (!item || item.favoriteSaving || item.favoriteAvailable === false) return;

    item.favoriteSaving = true;
    item.favoriteError = '';
    if (typeof render === 'function') render();

    try {
      await loadBridgeUrl();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан. Нажми F2, затем «URL bridge».');

      const nextFavorite = !item.favorite;
      const response = await sendRuntimeMessage({
        action: SAVE_ACTION,
        data: {
          bridgeUrl: state.bridgeUrl,
          payload: {
            action: 'setFavoriteState',
            spreadsheetId: CONFIG.spreadsheetId,
            sheetName: String(sheetName || '').trim(),
            row: Number(item.row),
            isFavorite: nextFavorite,
            expectedItilNumber: String(item.itilNumber || ''),
            expectedSuppValue: String(item.suppValue || ''),
            expectedRequestText: String(item.text || ''),
            expectedCleanRequestText: processRequestText(item && item.text ? item.text : '')
          }
        }
      });
      if (!response || response.success !== true) {
        throw new Error(getRuntimeResponseError(response, 'bridge не сохранил состояние избранного'));
      }

      const bridgeResult = getBridgeActionResult(response);
      item.favorite = bridgeResult && typeof bridgeResult.favorite === 'boolean'
        ? bridgeResult.favorite
        : nextFavorite;
    } catch (error) {
      item.favoriteError = error && error.message
        ? error.message
        : 'Не удалось сохранить состояние избранного.';
    } finally {
      item.favoriteSaving = false;
      if (typeof render === 'function') render();
    }
  }

  function toggleCurrentClassificationFavorite() {
    return toggleFavoriteItem(getCurrentItem(), state.sheetName, renderModal);
  }

  function toggleCurrentNewResponseFavorite() {
    const item = getNewResponseReviewCurrentItem();
    return toggleFavoriteItem(item, item && item.sourceSheetName, renderNewResponseReviewModal);
  }

  function hasNewResponseReviewHistory() {
    return newResponseInboxState.unreadCount > 0
      || (Array.isArray(newResponseReviewState.queue) && newResponseReviewState.queue.length > 0);
  }

  function buildNewResponseReviewItemFromInbox(item) {
    const beforeInfo = String(item && item.beforeInfo || '').trim();
    const afterInfo = String(item && item.afterInfo || '').trim();
    return {
      eventId: String(item && item.eventId || '').trim(),
      createdAt: String(item && item.createdAt || '').trim(),
      sourceSheetName: String(item && item.sourceSheetName || '').trim(),
      row: Number(item && item.row || 0),
      mode: String(item && item.mode || '').trim(),
      date: String(item && item.date || '').trim(),
      status: String(item && item.status || '').trim(),
      statusBackgroundColor: normalizeSheetBackgroundColor(item && item.statusBackgroundColor),
      currentStage: String(item && item.currentStage || '').trim(),
      currentStageBackgroundColor: normalizeSheetBackgroundColor(item && item.currentStageBackgroundColor),
      initiator: String(item && item.initiator || '').trim(),
      initiatorBackgroundColor: normalizeSheetBackgroundColor(item && item.initiatorBackgroundColor),
      itilNumber: String(item && item.itilNumber || '').trim(),
      suppValue: String(item && item.suppValue || '').trim(),
      suppNumbers: Array.isArray(item && item.suppNumbers)
        ? item.suppNumbers.map((value) => String(value || '').trim()).filter(Boolean)
        : extractSuppNumbers(String(item && item.suppValue || '')),
      text: String(item && item.text || '').trim(),
      beforeInfo,
      afterInfo,
      infoBlocks: buildInfoBlockDiff(beforeInfo, afterInfo),
      favorite: !!(item && item.favorite),
      favoriteAvailable: !!(item && item.favoriteAvailable === true)
    };
  }

  async function loadNewResponseInbox(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const summaryOnly = settings.summaryOnly === true;
    newResponseInboxState = {
      ...newResponseInboxState,
      isLoading: true,
      lastError: ''
    };
    renderNewResponseStatus();

    try {
      await loadBridgeUrl();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан.');

      const response = await sendRuntimeMessage({
        action: SAVE_ACTION,
        data: {
          bridgeUrl: state.bridgeUrl,
          payload: {
            action: 'getNewResponseInbox',
            spreadsheetId: CONFIG.spreadsheetId,
            summaryOnly
          }
        }
      });
      if (!response || response.success !== true) {
        throw new Error(getRuntimeResponseError(response, 'bridge не вернул очередь непрочитанных ответов'));
      }

      const bridgeResult = getBridgeActionResult(response);
      const unreadCount = Math.max(0, Number(bridgeResult && bridgeResult.itemsCount) || 0);
      newResponseInboxState = {
        ...newResponseInboxState,
        unreadCount,
        lastError: ''
      };

      if (!summaryOnly) {
        const dismissedEventIds = newResponseReviewState.dismissedEventIds || {};
        const queue = (bridgeResult && Array.isArray(bridgeResult.items) ? bridgeResult.items : [])
          .map(buildNewResponseReviewItemFromInbox)
          .filter((item) => !!item.eventId && !dismissedEventIds[item.eventId]);
        newResponseReviewState = createNewResponseReviewState({
          queue,
          currentIndex: 0,
          totalExpected: queue.length,
          pendingAcknowledgeCount: newResponseReviewState.pendingAcknowledgeCount,
          failedAcknowledgeCount: newResponseReviewState.failedAcknowledgeCount,
          dismissedEventIds,
          statusText: queue.length
            ? 'Показываю непрочитанные новые ответы.'
            : 'Непрочитанных новых ответов нет.',
          sourceSheetName: ''
        });
        renderNewResponseReviewModal();
      }

      return true;
    } catch (error) {
      const message = error && error.message ? error.message : 'Не удалось загрузить непрочитанные новые ответы.';
      newResponseInboxState = {
        ...newResponseInboxState,
        lastError: message
      };
      if (!summaryOnly) {
        newResponseReviewState = {
          ...newResponseReviewState,
          errorText: message,
          isProcessing: false
        };
        renderNewResponseReviewModal();
      }
      return false;
    } finally {
      newResponseInboxState = {
        ...newResponseInboxState,
        isLoading: false
      };
      renderNewResponseStatus();
    }
  }

  function refreshNewResponseInboxSummary() {
    return loadNewResponseInbox({ summaryOnly: true });
  }

  async function openLastNewResponseReviewHistory() {
    closeMenu();
    const loaded = await loadNewResponseInbox({ summaryOnly: false });
    if (!loaded) {
      openNewResponseReviewModal();
      return;
    }
    if (!newResponseReviewState.queue.length) {
      updateLauncherStatus('Непрочитанных новых ответов нет.', false);
      return;
    }
    openNewResponseReviewModal();
  }

  function normalizeInfoText(value) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  function normalizeInfoLine(value) {
    return String(value || '').replace(/[ \t]+$/g, '');
  }

  function trimInfoBlockLines(lines) {
    const prepared = Array.isArray(lines)
      ? lines.map((line) => normalizeInfoLine(line))
      : [];

    while (prepared.length && !String(prepared[0] || '').trim()) prepared.shift();
    while (prepared.length && !String(prepared[prepared.length - 1] || '').trim()) prepared.pop();

    return prepared.join('\n').trim();
  }

  function isInfoSourceLine(value) {
    const text = String(value || '').trim();
    return text === 'ИТИЛ' || /^[^\s/:]+(?:-[^\s/:]+)+$/.test(text);
  }

  function isInfoLogHeaderLine(value) {
    return /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\/.*$/.test(String(value || '').trim());
  }

  function isInfoSectionHeaderLine(value) {
    const text = String(value || '').trim();
    return text === 'Причина возникновения инцидента:'
      || text === 'Решение обращения:'
      || text === 'Дополнительная информация:'
      || text === 'Решение обращения (ITIL):'
      || text === 'Дополнительная информация (ITIL):';
  }

  function buildParsedInfoBlock(text) {
    const normalized = normalizeInfoText(text);
    if (!normalized) return null;

    const lines = normalized.split('\n');
    const firstLine = String(lines[0] || '').trim();
    const hasLogHeader = isInfoLogHeaderLine(firstLine);
    const hasSectionHeader = isInfoSectionHeaderLine(firstLine);
    const bodyText = hasLogHeader
      ? trimInfoBlockLines(lines.slice(1))
      : hasSectionHeader
        ? trimInfoBlockLines(lines.slice(1))
      : normalized;

    return {
      text: normalized,
      headerText: (hasLogHeader || hasSectionHeader) ? firstLine : '',
      bodyText
    };
  }

  function decodeSerializedInfoPlainLine(line) {
    const value = String(line || '');
    if (/^\\\\/.test(value) || /^\\\[\[Q\d+\]\](?:\s|$)/i.test(value)) return value.slice(1);
    return value;
  }

  function parseSerializedInfoQuoteLine(line) {
    const value = String(line || '');
    if (!value || /^\\\\/.test(value) || /^\\\[\[Q\d+\]\](?:\s|$)/i.test(value)) return null;

    const match = value.match(/^\[\[Q(\d+)\]\](?:\s(.*))?$/i);
    if (!match) return null;

    return {
      depth: Math.max(1, Number(match[1]) || 1),
      text: String(match[2] || '')
    };
  }

  function trimFragmentLines(lines) {
    const prepared = Array.isArray(lines)
      ? lines.map((line) => String(line || ''))
      : [];

    while (prepared.length && !prepared[0].trim()) prepared.shift();
    while (prepared.length && !prepared[prepared.length - 1].trim()) prepared.pop();

    return prepared;
  }

  function trimQuoteFragmentLines(lines) {
    const prepared = Array.isArray(lines)
      ? lines.map((line) => ({
        depth: Math.max(1, Number(line && line.depth) || 1),
        text: String(line && typeof line.text === 'string' ? line.text : '')
      }))
      : [];

    while (prepared.length && !prepared[0].text.trim()) prepared.shift();
    while (prepared.length && !prepared[prepared.length - 1].text.trim()) prepared.pop();

    return prepared;
  }

  function parseInfoBodyFragments(value) {
    const text = String(value || '').replace(/\r\n?/g, '\n');
    if (!text) return [];

    const lines = text.split('\n');
    const fragments = [];
    let textLines = [];
    let quoteLines = [];

    const flushText = () => {
      const prepared = trimFragmentLines(textLines)
        .map((line) => decodeSerializedInfoPlainLine(line));
      textLines = [];
      if (!prepared.length) return;
      fragments.push({
        type: 'text',
        text: prepared.join('\n')
      });
    };

    const flushQuote = () => {
      const prepared = trimQuoteFragmentLines(quoteLines);
      quoteLines = [];
      if (!prepared.length) return;
      fragments.push({
        type: 'quote',
        lines: prepared
      });
    };

    lines.forEach((line) => {
      const quoteLine = parseSerializedInfoQuoteLine(line);
      if (quoteLine) {
        flushText();
        quoteLines.push(quoteLine);
        return;
      }

      flushQuote();
      textLines.push(line);
    });

    flushQuote();
    flushText();

    return fragments;
  }

  function isInfoWarningText(value) {
    return String(value || '').includes(SUPP_NOT_FOUND_INFO_TEXT);
  }

  function buildInfoSection(sourceLabel, lines) {
    const normalizedSourceLabel = String(sourceLabel || '').trim();
    const preparedLines = Array.isArray(lines) ? lines : [];
    const blocks = [];
    let currentLines = [];
    const pushCurrentBlock = () => {
      const block = buildParsedInfoBlock(trimInfoBlockLines(currentLines));
      currentLines = [];
      if (!block) return;
      const warningText = [block.headerText, block.bodyText, block.text].filter(Boolean).join('\n');
      blocks.push({
        ...block,
        isWarning: isInfoWarningText(warningText)
      });
    };

    for (let index = 0; index < preparedLines.length; index += 1) {
      const line = preparedLines[index];
      const trimmed = String(line || '').trim();

      if (isInfoLogHeaderLine(trimmed) || isInfoSectionHeaderLine(trimmed)) {
        pushCurrentBlock();
        currentLines = [trimmed];
        continue;
      }

      if (!currentLines.length && !trimmed) continue;
      currentLines.push(line);
    }

    pushCurrentBlock();

    if (!normalizedSourceLabel && !blocks.length) return null;
    return {
      sourceLabel: normalizedSourceLabel,
      blocks,
      isWarning: blocks.some((block) => !!(block && block.isWarning))
    };
  }

  function parseInfoPresentation(value) {
    const text = normalizeInfoText(value);
    if (!text) {
      return {
        sections: []
      };
    }

    const lines = text.split('\n').map((line) => normalizeInfoLine(line));
    const sections = [];
    let currentSourceLabel = '';
    let currentSectionLines = [];

    const pushCurrentSection = () => {
      const section = buildInfoSection(currentSourceLabel, currentSectionLines);
      currentSourceLabel = '';
      currentSectionLines = [];
      if (section) sections.push(section);
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = String(line || '').trim();

      if (!trimmed && !currentSourceLabel && !currentSectionLines.length) continue;

      if (isInfoSourceLine(trimmed)) {
        pushCurrentSection();
        currentSourceLabel = trimmed;
        continue;
      }

      currentSectionLines.push(line);
    }

    pushCurrentSection();

    return {
      sections
    };
  }

  function buildInfoBlockCounts(sections) {
    const counts = new Map();
    (sections || []).forEach((section) => {
      const sourceLabel = String(section && section.sourceLabel || '').trim();
      (Array.isArray(section && section.blocks) ? section.blocks : []).forEach((block) => {
        const text = block && block.text ? block.text : '';
        if (!text) return;
        const key = `${sourceLabel}\n${text}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return counts;
  }

  function buildItilInfoText(solutionText) {
    const body = normalizeInfoText(solutionText);
    return body ? `ИТИЛ\n\n${body}` : 'ИТИЛ';
  }

  function buildSuppInfoText(infoText) {
    return normalizeInfoText(infoText);
  }

  function buildInfoBlockDiff(beforeInfo, afterInfo) {
    const previousPresentation = parseInfoPresentation(beforeInfo);
    const nextPresentation = parseInfoPresentation(afterInfo);
    const previousCounts = buildInfoBlockCounts(previousPresentation.sections);

    return {
      sections: (nextPresentation.sections || []).map((section) => {
        const sourceLabel = String(section && section.sourceLabel || '').trim();
        const blocks = (Array.isArray(section && section.blocks) ? section.blocks : []).map((block) => {
          const text = block && block.text ? block.text : '';
          const key = `${sourceLabel}\n${text}`;
          const previousCount = previousCounts.get(key) || 0;
          if (previousCount > 0) {
            previousCounts.set(key, previousCount - 1);
            return {
              ...block,
              isNew: false
            };
          }
          return {
            ...block,
            isNew: true
          };
        });
        return {
          sourceLabel,
          blocks,
          isWarning: !!(section && section.isWarning)
        };
      })
    };
  }

  function buildDefaultInfoBlocks(value) {
    const presentation = parseInfoPresentation(value);
    return {
      sections: (presentation.sections || []).map((section) => ({
        sourceLabel: String(section && section.sourceLabel || '').trim(),
        isWarning: !!(section && section.isWarning),
        blocks: (Array.isArray(section && section.blocks) ? section.blocks : []).map((block) => ({
          ...block,
          isNew: false
        }))
      }))
    };
  }

  function renderInfoBlocks(container, presentation) {
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();

    const data = presentation && typeof presentation === 'object'
      ? presentation
      : { sections: [] };
    const sections = Array.isArray(data.sections) ? data.sections : [];

    if (!sections.length) {
      container.textContent = '';
      return;
    }

    sections.forEach((section) => {
      const sectionElement = document.createElement('div');
      sectionElement.className = 'gs-info-section';

      const sourceLabel = String(section && section.sourceLabel || '').trim();
      const blocks = Array.isArray(section && section.blocks) ? section.blocks : [];
      const isWarningSection = !!(section && section.isWarning);

      if (sourceLabel) {
        const source = document.createElement('div');
        source.className = 'gs-info-source';
        if (isWarningSection) source.classList.add('is-warning');

        const sourceCaption = document.createElement('div');
        sourceCaption.className = 'gs-info-source-caption';
        sourceCaption.textContent = 'Источник';

        const sourceValue = document.createElement('div');
        sourceValue.className = 'gs-info-source-value';
        sourceValue.textContent = sourceLabel;

        source.append(sourceCaption, sourceValue);
        sectionElement.appendChild(source);
      }

      blocks.forEach((block) => {
        const element = document.createElement('div');
        element.className = 'gs-info-block';
        if (block && block.isNew) {
          element.classList.add('is-new');
        } else {
          element.classList.add('is-default');
        }
        if (block && block.isWarning) {
          element.classList.add('is-warning');
        }

        const headerText = block && block.headerText ? String(block.headerText).trim() : '';
        const bodyText = block && typeof block.bodyText === 'string'
          ? block.bodyText
          : (block && block.text ? block.text : '');

        if (headerText) {
          const header = document.createElement('div');
          header.className = 'gs-info-block-header';
          header.textContent = headerText;
          element.appendChild(header);
        }

        if (bodyText) {
          const body = document.createElement('div');
          body.className = 'gs-info-block-body';
          const fragments = parseInfoBodyFragments(bodyText);
          if (!fragments.length) {
            body.textContent = bodyText;
          } else {
            fragments.forEach((fragment) => {
              if (fragment.type === 'quote') {
                const quote = document.createElement('div');
                quote.className = 'gs-info-quote';

                (Array.isArray(fragment.lines) ? fragment.lines : []).forEach((quoteLine) => {
                  const line = document.createElement('div');
                  line.className = 'gs-info-quote-line';
                  line.style.setProperty('--gs-info-quote-depth', String(Math.max(1, Number(quoteLine && quoteLine.depth) || 1)));
                  line.textContent = quoteLine && typeof quoteLine.text === 'string' && quoteLine.text
                    ? quoteLine.text
                    : ' ';
                  quote.appendChild(line);
                });

                body.appendChild(quote);
                return;
              }

              const textFragment = document.createElement('div');
              textFragment.className = 'gs-info-block-body-text';
              textFragment.textContent = fragment && fragment.text ? fragment.text : '';
              body.appendChild(textFragment);
            });
          }
          element.appendChild(body);
        }

        sectionElement.appendChild(element);
      });

      container.appendChild(sectionElement);
    });
  }

  function buildNewResponseReviewItem(item, result) {
    const payload = result && result.bridgePayload && typeof result.bridgePayload === 'object'
      ? result.bridgePayload
      : {};
    const afterInfo = item && item.mode === 'supp'
      ? buildSuppInfoText(payload.infoText)
      : buildItilInfoText(payload.solutionText);

    return {
      eventId: '',
      sourceSheetName: String(newResponseState.sheetName || '').trim(),
      row: Number(item && item.row),
      date: String(item && item.date || '').trim(),
      status: String(item && item.status || '').trim(),
      statusBackgroundColor: normalizeSheetBackgroundColor(item && item.statusBackgroundColor),
      currentStage: String(item && item.currentStage || '').trim(),
      currentStageBackgroundColor: normalizeSheetBackgroundColor(item && item.currentStageBackgroundColor),
      initiator: String(item && item.initiator || '').trim(),
      initiatorBackgroundColor: normalizeSheetBackgroundColor(item && item.initiatorBackgroundColor),
      itilNumber: String(item && item.itilNumber || '').trim(),
      suppValue: String(item && item.suppValue || '').trim(),
      suppNumbers: getItemSuppNumbers(item),
      text: String(item && item.text || '').trim(),
      beforeInfo: String(item && item.info || '').trim(),
      afterInfo,
      infoBlocks: buildInfoBlockDiff(item && item.info, afterInfo),
      favorite: !!(item && item.favorite),
      favoriteAvailable: item && item.favoriteAvailable !== false
    };
  }

  function buildNewResponseReviewSnapshot(reviewItem) {
    const item = reviewItem && typeof reviewItem === 'object' ? reviewItem : {};
    return {
      date: String(item.date || ''),
      status: String(item.status || ''),
      statusBackgroundColor: normalizeSheetBackgroundColor(item.statusBackgroundColor),
      currentStage: String(item.currentStage || ''),
      currentStageBackgroundColor: normalizeSheetBackgroundColor(item.currentStageBackgroundColor),
      initiator: String(item.initiator || ''),
      initiatorBackgroundColor: normalizeSheetBackgroundColor(item.initiatorBackgroundColor),
      text: String(item.text || ''),
      itilNumber: String(item.itilNumber || ''),
      suppValue: String(item.suppValue || ''),
      suppNumbers: getItemSuppNumbers(item),
      beforeInfo: String(item.beforeInfo || ''),
      afterInfo: String(item.afterInfo || '')
    };
  }

  function buildSuppSummaryItems(item) {
    const suppNumbers = getItemSuppNumbers(item);
    const hasMultipleSuppNumbers = suppNumbers.length > 1;
    return suppNumbers.map((suppNumber, index) => ({
      label: hasMultipleSuppNumbers && index === 0 ? `СУПП ${suppNumber} (последняя)` : `СУПП ${suppNumber}`,
      value: suppNumber,
      copyValue: suppNumber,
      openAction: SUPP_OPEN_REQUEST_ACTION,
      openValue: suppNumber,
      isPrimary: hasMultipleSuppNumbers && index === 0
    }));
  }

  function renderRequestSummary(container, item) {
    if (!(container instanceof HTMLElement)) return;

    const fields = [
      { key: 'row', label: 'Номер строки', value: item && item.row ? String(item.row) : '—' },
      { key: 'date', label: 'Дата заявки', value: item && item.date ? item.date : '—' },
      {
        key: 'status',
        label: 'Статус заявки',
        value: item && item.status ? item.status : '—',
        backgroundColor: normalizeSheetBackgroundColor(item && item.statusBackgroundColor)
      },
      {
        key: 'currentStage',
        label: 'Текущий этап',
        value: item && item.currentStage ? item.currentStage : '—',
        backgroundColor: normalizeSheetBackgroundColor(item && item.currentStageBackgroundColor)
      },
      {
        key: 'initiator',
        label: 'Инициатор',
        value: item && item.initiator ? item.initiator : '—',
        backgroundColor: normalizeSheetBackgroundColor(item && item.initiatorBackgroundColor)
      },
      {
        key: 'itil',
        label: 'Номер ITIL',
        value: item && item.itilNumber ? item.itilNumber : '—',
        openAction: ITIL_OPEN_REQUEST_ACTION,
        openValue: item && item.itilNumber ? item.itilNumber : ''
      },
      {
        key: 'supp',
        label: 'Связанные заявки СУПП',
        value: item && item.suppValue ? item.suppValue : '—',
        items: buildSuppSummaryItems(item)
      }
    ];

    container.replaceChildren();
    fields.forEach((fieldData) => {
      const labelText = fieldData.label;
      const valueText = fieldData.value;
      const listItems = Array.isArray(fieldData.items) ? fieldData.items : [];
      const hasListItems = listItems.length > 0;
      const field = document.createElement('div');
      field.className = 'gs-request-summary-item';
      if (fieldData.backgroundColor) {
        field.classList.add('has-sheet-background');
        field.style.setProperty('--gs-request-summary-sheet-bg', fieldData.backgroundColor);
      }

      const label = document.createElement('div');
      label.className = 'gs-request-summary-label';
      label.textContent = labelText;

      const header = document.createElement('div');
      header.className = 'gs-request-summary-header';

      const actions = document.createElement('div');
      actions.className = 'gs-request-summary-actions';

      header.append(label);

      if (hasListItems) {
        const value = document.createElement('div');
        value.className = 'gs-request-summary-value';

        const list = document.createElement('div');
        list.className = 'gs-request-summary-list';

        listItems.forEach((listItem) => {
          const itemRow = document.createElement('div');
          itemRow.className = 'gs-request-summary-list-item';
          if (listItem && listItem.isPrimary) itemRow.classList.add('is-primary');

          const itemValueWrap = document.createElement('div');
          itemValueWrap.className = 'gs-request-summary-list-value-wrap';

          const itemValue = document.createElement('div');
          itemValue.className = 'gs-request-summary-list-value';
          itemValue.textContent = listItem && listItem.value ? listItem.value : '—';
          itemValueWrap.appendChild(itemValue);

          if (listItem && listItem.isPrimary) {
            const badge = document.createElement('div');
            badge.className = 'gs-request-summary-list-badge';
            badge.textContent = 'последняя';
            itemValueWrap.appendChild(badge);
          }

          const itemActions = document.createElement('div');
          itemActions.className = 'gs-request-summary-list-actions';

          const itemOpenButton = document.createElement('button');
          itemOpenButton.type = 'button';
          itemOpenButton.className = 'gs-request-summary-open';
          itemOpenButton.title = `Открыть заявку: ${listItem && listItem.label ? listItem.label : labelText}`;
          itemOpenButton.setAttribute('aria-label', `Открыть заявку ${listItem && listItem.value ? listItem.value : ''}`);
          itemOpenButton.disabled = !(listItem && listItem.openAction && listItem.openValue);
          setSummaryOpenButtonIcon(itemOpenButton, 'open');
          itemOpenButton.addEventListener('click', () => {
            void openSummaryRequest(itemOpenButton, listItem);
          }, { capture: true });

          const itemCopyButton = document.createElement('button');
          itemCopyButton.type = 'button';
          itemCopyButton.className = 'gs-request-summary-copy';
          itemCopyButton.title = `Копировать: ${listItem && listItem.label ? listItem.label : labelText}`;
          itemCopyButton.setAttribute('aria-label', `Копировать заявку ${listItem && listItem.value ? listItem.value : ''}`);
          itemCopyButton.disabled = !(listItem && listItem.copyValue);
          setSummaryCopyButtonIcon(itemCopyButton, 'copy');
          itemCopyButton.addEventListener('click', () => {
            void copySummaryValue(itemCopyButton, listItem && listItem.copyValue ? listItem.copyValue : '');
          }, { capture: true });

          itemActions.append(itemOpenButton, itemCopyButton);
          itemRow.append(itemValueWrap, itemActions);
          list.appendChild(itemRow);
        });

        value.appendChild(list);
        field.append(header, value);
      } else {
        const value = document.createElement('div');
        value.className = 'gs-request-summary-value';
        value.textContent = valueText;

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'gs-request-summary-open';
        openButton.title = `Открыть заявку: ${labelText}`;
        openButton.setAttribute('aria-label', `Открыть заявку из поля «${labelText}»`);
        openButton.disabled = !fieldData.openAction || !fieldData.openValue;
        setSummaryOpenButtonIcon(openButton, 'open');
        openButton.addEventListener('click', () => {
          void openSummaryRequest(openButton, fieldData);
        }, { capture: true });

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'gs-request-summary-copy';
        copyButton.title = `Копировать: ${labelText}`;
        copyButton.setAttribute('aria-label', `Копировать поле «${labelText}»`);
        copyButton.disabled = !valueText || valueText === '—';
        setSummaryCopyButtonIcon(copyButton, 'copy');
        copyButton.addEventListener('click', () => {
          void copySummaryValue(copyButton, valueText);
        }, { capture: true });

        if (fieldData.openAction) actions.appendChild(openButton);
        actions.appendChild(copyButton);
        header.appendChild(actions);
        field.append(header, value);
      }

      container.appendChild(field);
    });
  }

  function setSummaryOpenButtonIcon(button, stateName) {
    if (!(button instanceof HTMLButtonElement)) return;

    const icons = {
      open: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 5h5v5"></path>
          <path d="m10 14 9-9"></path>
          <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"></path>
        </svg>
      `,
      opened: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12.5 4.25 4.25L19 7"></path>
        </svg>
      `,
      error: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8v5"></path>
          <path d="M12 16h.01"></path>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
        </svg>
      `
    };

    button.innerHTML = icons[stateName] || icons.open;
  }

  function setSummaryCopyButtonIcon(button, stateName) {
    if (!(button instanceof HTMLButtonElement)) return;

    const icons = {
      copy: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 8.25A2.25 2.25 0 0 1 11.25 6h6.5A2.25 2.25 0 0 1 20 8.25v9.5A2.25 2.25 0 0 1 17.75 20h-6.5A2.25 2.25 0 0 1 9 17.75v-9.5Z"></path>
          <path d="M6.75 16H6A2 2 0 0 1 4 14V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v.25"></path>
        </svg>
      `,
      copied: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12.5 4.25 4.25L19 7"></path>
        </svg>
      `,
      error: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8v5"></path>
          <path d="M12 17.5h.01"></path>
          <path d="M10.29 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
        </svg>
      `
    };

    button.innerHTML = icons[stateName] || icons.copy;
  }

  async function copyTextToClipboard(value) {
    const text = String(value || '');
    if (!text) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';

    (document.body || document.documentElement).appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } catch (_) {
      return false;
    } finally {
      textarea.remove();
    }
  }

  async function copySummaryValue(button, value) {
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const copied = await copyTextToClipboard(value);
    setSummaryCopyButtonIcon(button, copied ? 'copied' : 'error');
    button.classList.toggle('is-copied', copied);
    button.classList.toggle('is-error', !copied);
    button.disabled = true;

    window.setTimeout(() => {
      setSummaryCopyButtonIcon(button, 'copy');
      button.classList.remove('is-copied', 'is-error');
      button.disabled = !value || value === '—';
    }, 1200);
  }

  function setNewResponseReviewMessage(text, isError) {
    const message = $(`#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-message`);
    if (!(message instanceof HTMLElement)) return;
    message.textContent = String(text || '');
    message.classList.toggle('is-error', !!isError);
  }

  function setSummaryActionMessage(button, text, isError) {
    if (!(button instanceof HTMLElement)) return;

    if (button.closest(`#${MODAL_ID}`)) {
      setModalMessage(text, isError);
      return;
    }

    if (button.closest(`#${NEW_RESPONSE_REVIEW_MODAL_ID}`)) {
      setNewResponseReviewMessage(text, isError);
      return;
    }

    updateLauncherStatus(text, isError);
  }

  async function openSummaryRequest(button, fieldData) {
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const action = String(fieldData && fieldData.openAction || '').trim();
    const requestNumber = String(fieldData && fieldData.openValue || '').trim();
    const labelText = String(fieldData && fieldData.label || 'заявка').trim();

    if (!action || !requestNumber) return;

    button.disabled = true;
    setSummaryActionMessage(button, `Открываю ${labelText}: ${requestNumber}...`, false);

    try {
      if (!waitTimeoutSettingsLoaded) await loadWaitTimeoutSettings();
      const response = await sendRuntimeMessage({
        action,
        data: action === ITIL_OPEN_REQUEST_ACTION
          ? { itilNumber: requestNumber, waitTimeouts: getEffectiveWaitTimeouts() }
          : { suppNumber: requestNumber, waitTimeouts: getEffectiveWaitTimeouts() }
      });

      if (!response || response.success !== true) {
        throw new Error(response && response.error ? response.error : 'Не удалось открыть заявку.');
      }

      setSummaryOpenButtonIcon(button, 'opened');
      button.classList.add('is-opened');
      setSummaryActionMessage(button, `Открыта заявка ${requestNumber}.`, false);
    } catch (error) {
      setSummaryOpenButtonIcon(button, 'error');
      button.classList.add('is-error');
      setSummaryActionMessage(
        button,
        error && error.message ? error.message : `Не удалось открыть заявку ${requestNumber}.`,
        true
      );
    } finally {
      window.setTimeout(() => {
        setSummaryOpenButtonIcon(button, 'open');
        button.classList.remove('is-opened', 'is-error');
        button.disabled = !action || !requestNumber;
      }, 1200);
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{position:fixed;right:18px;bottom:58px;z-index:2147483640;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:"Segoe UI",Tahoma,sans-serif}
      #${PROCESSING_ROW_HIGHLIGHT_ID}{position:fixed;z-index:2147483639;box-sizing:border-box;border:3px solid rgba(52,168,83,.95);border-radius:3px;background:rgba(52,168,83,.035);box-shadow:0 0 0 1px rgba(52,168,83,.12),0 0 9px rgba(52,168,83,.34);pointer-events:none;animation:dup-gs-processing-row-pulse 1.35s ease-in-out infinite}
      #${PROCESSING_ROW_HIGHLIGHT_ID}[hidden]{display:none!important}
      @keyframes dup-gs-processing-row-pulse{0%,100%{border-color:rgba(52,168,83,.72);box-shadow:0 0 0 1px rgba(52,168,83,.08),0 0 5px rgba(52,168,83,.2)}50%{border-color:rgba(30,142,62,1);box-shadow:0 0 0 1px rgba(52,168,83,.2),0 0 12px rgba(52,168,83,.48)}}
      @media (prefers-reduced-motion:reduce){#${PROCESSING_ROW_HIGHLIGHT_ID}{animation:none}}
      #${ROOT_ID} .gs-problem-picker-actions{display:flex;gap:6px}
      #${ROOT_ID} button,#${MODAL_ID} button,#${NEW_RESPONSE_REVIEW_MODAL_ID} button,#${CHATGPT_SEARCH_MODAL_ID} button,#${ITIL_IMPORT_MODAL_ID} button,#${WSS_IMPORT_MODAL_ID} button,#${WSS_IMPORT_REVIEW_MODAL_ID} button{border:1px solid #b7c2d3;border-radius:7px;background:#fff;color:#162033;cursor:pointer;font:600 13px/1.2 "Segoe UI",Tahoma,sans-serif;padding:8px 12px}
      #${ROOT_ID} .gs-problem-picker-open{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.24)}
      #${ROOT_ID} .gs-problem-picker-url{min-width:44px}
      #${ROOT_ID} .gs-problem-picker-status{max-width:360px;min-height:18px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.94);color:#24513a;font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.12)}
      #${ROOT_ID} .gs-problem-picker-status.is-error,#${MODAL_ID} .gs-problem-picker-message.is-error,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-message.is-error{color:#b3261e}
      #${MENU_OVERLAY_ID}{position:fixed;inset:0;z-index:2147483644;background:rgba(17,24,39,.38);pointer-events:none;font-family:"Segoe UI",Tahoma,sans-serif}
      #${MENU_ID}{position:fixed;right:24px;top:76px;z-index:2147483645;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 110px);overflow:auto;box-sizing:border-box;padding:18px;border:1px solid #d5dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.24);pointer-events:auto;font-family:"Segoe UI",Tahoma,sans-serif}
      #${MENU_OVERLAY_ID}[hidden],#${MENU_ID}[hidden]{display:none!important}
      #${MENU_ID} .gs-problem-picker-menu-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      #${MENU_ID} .gs-problem-picker-menu-title{font-size:20px;line-height:1.2;font-weight:700}
      #${MENU_ID} .gs-problem-picker-menu-subtitle{margin-top:4px;color:#566176;font-size:13px}
      #${MENU_ID} .gs-problem-picker-menu-close{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${MENU_ID} .gs-problem-picker-menu-section{display:grid;gap:10px;border-top:1px solid #e3e8f0;padding-top:14px;margin-top:14px}
      #${MENU_ID} .gs-problem-picker-menu-section:first-of-type{border-top:0;padding-top:0;margin-top:0}
      #${MENU_ID} .gs-problem-picker-menu-section-title{font-size:14px;font-weight:700;color:#253044}
      #${MENU_ID} .gs-problem-picker-menu-actions{display:flex;flex-wrap:wrap;gap:8px}
      #${MENU_ID} .gs-wait-settings-toggle{border-color:#c4d1e6;background:#f6f9ff;color:#234b8f}
      #${MENU_ID} .gs-wait-settings-panel{display:grid;gap:14px;padding:16px;border:1px solid #cdd8e8;border-radius:12px;background:linear-gradient(145deg,#f8fbff 0%,#eef4fb 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.85)}
      #${MENU_ID} .gs-wait-settings-panel[hidden]{display:none!important}
      #${MENU_ID} .gs-wait-settings-intro{color:#536176;font-size:12px;line-height:1.45}
      #${MENU_ID} .gs-wait-settings-group{min-width:0;margin:0;padding:12px;border:1px solid rgba(93,116,151,.22);border-radius:10px;background:rgba(255,255,255,.72)}
      #${MENU_ID} .gs-wait-settings-group legend{padding:0 7px;color:#27466f;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
      #${MENU_ID} .gs-wait-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}
      #${MENU_ID} .gs-wait-settings-field{display:grid;gap:5px;min-width:0;color:#334155;font-size:12px;font-weight:600}
      #${MENU_ID} .gs-wait-settings-control{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;color:#64748b;font-weight:500}
      #${MENU_ID} .gs-wait-settings-control input{width:100%;min-width:0;box-sizing:border-box;padding:7px 9px;border:1px solid #b9c7d9;border-radius:7px;background:#fff;color:#172033;font:600 13px/1.2 "Segoe UI",Tahoma,sans-serif;outline:none}
      #${MENU_ID} .gs-wait-settings-control input:focus{border-color:#1155cc;box-shadow:0 0 0 3px rgba(17,85,204,.14)}
      #${MENU_ID} .gs-wait-settings-control input::placeholder{color:#8a96a8;opacity:1}
      #${MENU_ID} .gs-wait-settings-actions{display:flex;flex-wrap:wrap;gap:8px}
      #${MENU_ID} .gs-wait-settings-save{border-color:#1155cc;background:#1155cc;color:#fff}
      #${MENU_ID} .gs-wait-settings-status{min-height:18px;color:#24513a;font-size:12px}
      #${MENU_ID} .gs-wait-settings-status.is-error{color:#b3261e}
      #${MENU_ID} .gs-problem-picker-combined-grid,#${MENU_ID} .gs-problem-picker-itil-grid,#${MENU_ID} .gs-problem-picker-supp-grid,#${MENU_ID} .gs-problem-picker-new-response-grid{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;font-size:13px;color:#39465c}
      #${MENU_ID} .gs-problem-picker-combined-grid dt,#${MENU_ID} .gs-problem-picker-itil-grid dt,#${MENU_ID} .gs-problem-picker-supp-grid dt,#${MENU_ID} .gs-problem-picker-new-response-grid dt{font-weight:700;color:#5d6678}
      #${MENU_ID} .gs-problem-picker-combined-grid dd,#${MENU_ID} .gs-problem-picker-itil-grid dd,#${MENU_ID} .gs-problem-picker-supp-grid dd,#${MENU_ID} .gs-problem-picker-new-response-grid dd{margin:0;min-width:0;overflow-wrap:anywhere}
      #${MENU_ID} .gs-problem-picker-combined-status{min-height:18px;color:#24513a;font-size:13px;overflow-wrap:anywhere}
      #${MENU_ID} .gs-problem-picker-combined-status.is-error{color:#b3261e}
      #${MENU_ID} .gs-problem-picker-manual-toggle{min-width:46px;padding-inline:0}
      #${MENU_ID} .gs-problem-picker-manual-panel{display:grid;gap:12px;padding:14px;border:1px solid #dbe2ec;border-radius:12px;background:rgba(148,163,184,.08)}
      #${MENU_ID} .gs-problem-picker-manual-panel[hidden]{display:none!important}
      #${MENU_ID} .gs-problem-picker-manual-title{font-size:13px;font-weight:700;color:#314157}
      #${MENU_ID} .gs-problem-picker-manual-section{display:grid;gap:8px;padding-top:12px;border-top:1px solid rgba(148,163,184,.22)}
      #${MENU_ID} .gs-problem-picker-manual-section:first-of-type{padding-top:0;border-top:0}
      #${MENU_ID} .gs-problem-picker-manual-section-title{font-size:13px;font-weight:700;color:#253044}
      #${MENU_ID} .gs-problem-picker-status{min-height:18px;color:#24513a;font-size:13px}
      #${MENU_ID} .gs-problem-picker-status.is-error,#${MENU_ID} .gs-problem-picker-itil-status.is-error,#${MENU_ID} .gs-problem-picker-supp-status.is-error,#${MENU_ID} .gs-problem-picker-new-response-status.is-error,#${MENU_ID} .gs-itil-import-menu-status.is-error,#${MENU_ID} .gs-wss-import-menu-status.is-error{color:#b3261e}
      #${MENU_ID} .gs-problem-picker-itil-status,#${MENU_ID} .gs-problem-picker-supp-status,#${MENU_ID} .gs-problem-picker-new-response-status{min-height:18px;color:#24513a;font-size:13px;overflow-wrap:anywhere}
      #${MENU_ID} .gs-itil-import-menu-status{min-height:18px;color:#24513a;font-size:13px;overflow-wrap:anywhere}
      #${MENU_ID} .gs-wss-import-menu-status{min-height:18px;color:#24513a;font-size:13px;overflow-wrap:anywhere}
      #${MENU_ID} .gs-problem-picker-chatgpt-note{color:#566176;font-size:13px;line-height:1.45}
      #${ROOT_ID} button,#${MODAL_ID} button,#${NEW_RESPONSE_REVIEW_MODAL_ID} button,#${CHATGPT_SEARCH_MODAL_ID} button,#${ITIL_IMPORT_MODAL_ID} button,#${WSS_IMPORT_MODAL_ID} button,#${WSS_IMPORT_REVIEW_MODAL_ID} button,#${MENU_ID} button{border:1px solid #b7c2d3;border-radius:7px;background:#fff;color:#162033;cursor:pointer;font:600 13px/1.2 "Segoe UI",Tahoma,sans-serif;padding:8px 12px}
      #${MENU_ID} button:disabled{opacity:.58;cursor:default}
      #${MENU_ID} .gs-problem-picker-open,#${MENU_ID} .gs-problem-picker-chatgpt-search-open,#${MENU_ID} .gs-itil-import-open,#${MENU_ID} .gs-wss-import-open,#${MENU_ID} .gs-wss-chatgpt-search-open,#${MENU_ID} .gs-problem-picker-combined-start,#${MENU_ID} .gs-problem-picker-itil-start,#${MENU_ID} .gs-problem-picker-supp-start,#${MENU_ID} .gs-problem-picker-supp-test,#${MENU_ID} .gs-problem-picker-new-response-start{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.2)}
      #${MENU_ID} .gs-problem-picker-new-response-history{border-color:#c9d7ef;background:#f4f8ff;color:#0f3f99}
      #${MENU_ID} .gs-problem-picker-combined-stop,#${MENU_ID} .gs-problem-picker-itil-stop,#${MENU_ID} .gs-problem-picker-supp-stop,#${MENU_ID} .gs-problem-picker-new-response-stop{border-color:#b3261e;color:#b3261e}
      @media (max-width:680px){#${MENU_ID} .gs-wait-settings-grid{grid-template-columns:1fr}}
      #${MODAL_ID},#${NEW_RESPONSE_REVIEW_MODAL_ID},#${ITIL_IMPORT_MODAL_ID},#${WSS_IMPORT_MODAL_ID},#${WSS_IMPORT_REVIEW_MODAL_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:16px;overflow:hidden;background:rgba(17,24,39,.42);pointer-events:none;font-family:"Segoe UI",Tahoma,sans-serif}
      #${CHATGPT_SEARCH_MODAL_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(15,23,42,.48);pointer-events:none;font-family:"Segoe UI",Tahoma,sans-serif}
      #${MODAL_ID}[hidden],#${NEW_RESPONSE_REVIEW_MODAL_ID}[hidden],#${CHATGPT_SEARCH_MODAL_ID}[hidden],#${ITIL_IMPORT_MODAL_ID}[hidden],#${WSS_IMPORT_MODAL_ID}[hidden],#${WSS_IMPORT_REVIEW_MODAL_ID}[hidden],html.dup-ext-screenshot-mode #${ROOT_ID},html.dup-ext-screenshot-mode #${MODAL_ID},html.dup-ext-screenshot-mode #${NEW_RESPONSE_REVIEW_MODAL_ID},html.dup-ext-screenshot-mode #${CHATGPT_SEARCH_MODAL_ID},html.dup-ext-screenshot-mode #${ITIL_IMPORT_MODAL_ID},html.dup-ext-screenshot-mode #${WSS_IMPORT_MODAL_ID},html.dup-ext-screenshot-mode #${WSS_IMPORT_REVIEW_MODAL_ID},html.dup-ext-screenshot-mode #${MENU_ID},html.dup-ext-screenshot-mode #${MENU_OVERLAY_ID},html.dup-ext-screenshot-mode #${PROCESSING_ROW_HIGHLIGHT_ID}{display:none!important}
      #${MODAL_ID} .gs-problem-picker-layout{width:min(1840px,calc(100vw - 32px));height:min(880px,calc(100vh - 32px));max-height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 298px;gap:14px;align-items:stretch;overflow:hidden;pointer-events:auto}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-layout{width:min(1540px,calc(100vw - 32px));height:min(880px,calc(100vh - 32px));max-height:100%;min-height:0;display:grid;grid-template-columns:1fr;align-items:stretch;overflow:hidden;pointer-events:auto}
      #${MODAL_ID} .gs-problem-picker-panel,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-panel{width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;gap:14px;box-sizing:border-box;padding:22px;border:1px solid #d6dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.26)}
      #${MODAL_ID} .gs-problem-picker-header,#${MODAL_ID} .gs-problem-picker-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-header,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #${MODAL_ID} .gs-problem-picker-title{font-size:22px;line-height:1.2;font-weight:700}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-title{font-size:22px;line-height:1.2;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-meta,#${MODAL_ID} .gs-problem-picker-message{color:#566176;font-size:13px}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-meta,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-message{color:#566176;font-size:13px}
      #${MODAL_ID} .gs-problem-picker-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${MODAL_ID} .gs-modal-header-actions,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-modal-header-actions{display:flex;align-items:center;gap:8px;flex:none}
      #${MODAL_ID} .gs-favorite-toggle,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-favorite-toggle{width:34px;height:34px;display:grid;place-items:center;padding:0;border-color:#d5c89b;background:#fffdf5;color:#806b2a;font-size:23px;line-height:1;box-shadow:none;transition:background-color .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease}
      #${MODAL_ID} .gs-favorite-toggle:hover:not(:disabled),#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-favorite-toggle:hover:not(:disabled),#${MODAL_ID} .gs-favorite-toggle:focus-visible,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-favorite-toggle:focus-visible{border-color:#d39b00;background:#fff4bd;color:#8a5b00;outline:2px solid rgba(211,155,0,.2);outline-offset:2px;transform:translateY(-1px)}
      #${MODAL_ID} .gs-favorite-toggle.is-active,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-favorite-toggle.is-active{border-color:#d69e00;background:#fbbc04;color:#674600;box-shadow:0 7px 18px rgba(180,125,0,.24)}
      #${MODAL_ID} .gs-favorite-toggle:disabled,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-favorite-toggle:disabled{opacity:.56;cursor:default;transform:none}
      #${MODAL_ID} .gs-problem-picker-panel,#${MODAL_ID} .gs-problem-picker-category-rail,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-panel{transition:background .2s ease,border-color .2s ease,box-shadow .2s ease}
      #${MODAL_ID} .gs-problem-picker-layout.is-favorite .gs-problem-picker-panel,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-layout.is-favorite .gs-new-response-review-panel{border-color:#e2c55d;background:linear-gradient(145deg,#fffef8 0%,#fff8d7 100%);box-shadow:0 24px 70px rgba(116,79,0,.3),inset 0 0 0 1px rgba(251,188,4,.1)}
      #${MODAL_ID} .gs-problem-picker-layout.is-favorite .gs-problem-picker-category-rail{border-color:#e2c55d;background:linear-gradient(155deg,#fffdf5 0%,#fff3bf 100%);box-shadow:0 24px 70px rgba(116,79,0,.22),inset 0 0 0 1px rgba(251,188,4,.08)}
      #${MODAL_ID} .gs-problem-picker-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${MODAL_ID} .gs-request-summary,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;gap:8px}
      #${MODAL_ID} .gs-request-summary-item,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-item{flex:0 1 auto;width:max-content;max-width:min(320px,100%);min-width:0;padding:8px 9px 9px;border:1px solid #dbe2ec;border-radius:10px;background:#f7f9fc}
      #${MODAL_ID} .gs-request-summary-item.has-sheet-background,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-item.has-sheet-background{background:var(--gs-request-summary-sheet-bg,#f7f9fc);border-color:rgba(15,23,42,.16)}
      #${MODAL_ID} .gs-request-summary-header,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}
      #${MODAL_ID} .gs-request-summary-actions,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-actions{display:flex;align-items:center;gap:6px;flex:none}
      #${MODAL_ID} .gs-request-summary-label,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-label{min-width:0;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
      #${MODAL_ID} .gs-request-summary-value,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-value{min-width:0;overflow-wrap:anywhere;color:#172033;font-size:13px;font-weight:600;line-height:1.35}
      #${MODAL_ID} .gs-request-summary-list,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list{display:flex;flex-direction:column;gap:7px}
      #${MODAL_ID} .gs-request-summary-list-item,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 9px;border-radius:9px;background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(148,163,184,.16)}
      #${MODAL_ID} .gs-request-summary-list-item.is-primary,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list-item.is-primary{background:rgba(226,240,255,.78);box-shadow:inset 0 0 0 1px rgba(59,130,246,.18)}
      #${MODAL_ID} .gs-request-summary-list-value-wrap,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list-value-wrap{display:flex;flex-direction:column;gap:4px;min-width:0}
      #${MODAL_ID} .gs-request-summary-list-value,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list-value{min-width:0;overflow-wrap:anywhere;color:#172033;font-size:13px;font-weight:600;line-height:1.35}
      #${MODAL_ID} .gs-request-summary-list-badge,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list-badge{width:fit-content;padding:2px 7px;border-radius:999px;background:#dcecff;color:#0f3f99;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
      #${MODAL_ID} .gs-request-summary-list-actions,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-list-actions{display:flex;align-items:center;gap:6px;flex:none}
      #${MODAL_ID} .gs-request-summary-open,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-open{flex:none;width:20px;height:20px;display:grid;place-items:center;padding:0;border-radius:6px;border-color:#d1d9e6;background:#fff;color:#526071;line-height:1;box-shadow:none}
      #${MODAL_ID} .gs-request-summary-open svg,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-open svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      #${MODAL_ID} .gs-request-summary-open:hover:not(:disabled),#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-open:hover:not(:disabled){border-color:#1155cc;color:#0f3f99;background:#eef5ff}
      #${MODAL_ID} .gs-request-summary-open.is-opened,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-open.is-opened{border-color:#8ec9a3;background:#e8f3ee;color:#14532d}
      #${MODAL_ID} .gs-request-summary-open.is-error,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-open.is-error{border-color:#f0b7b3;background:#fff1f0;color:#b3261e}
      #${MODAL_ID} .gs-request-summary-open:disabled,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-open:disabled{opacity:.58;cursor:default}
      #${MODAL_ID} .gs-request-summary-copy,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-copy{flex:none;width:20px;height:20px;display:grid;place-items:center;padding:0;border-radius:6px;border-color:#d1d9e6;background:#fff;color:#526071;line-height:1;box-shadow:none}
      #${MODAL_ID} .gs-request-summary-copy svg,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-copy svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      #${MODAL_ID} .gs-request-summary-copy:hover:not(:disabled),#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-copy:hover:not(:disabled){border-color:#1155cc;color:#0f3f99;background:#eef5ff}
      #${MODAL_ID} .gs-request-summary-copy.is-copied,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-copy.is-copied{border-color:#8ec9a3;background:#e8f3ee;color:#14532d}
      #${MODAL_ID} .gs-request-summary-copy.is-error,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-copy.is-error{border-color:#f0b7b3;background:#fff1f0;color:#b3261e}
      #${MODAL_ID} .gs-request-summary-copy:disabled,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-request-summary-copy:disabled{opacity:.58;cursor:default}
      #${MODAL_ID} .gs-problem-picker-text-grid{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-problem-picker-text-grid{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #${MODAL_ID} .gs-problem-picker-text-wrap{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-problem-picker-text-wrap{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}
      #${MODAL_ID} .gs-problem-picker-label{color:#4b5563;font-size:13px;font-weight:700}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-problem-picker-label{color:#4b5563;font-size:13px;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-text{height:100%;max-height:100%;min-height:0;box-sizing:border-box;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font-size:15px;line-height:1.55}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-problem-picker-text{height:100%;max-height:100%;min-height:0;box-sizing:border-box;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font-size:15px;line-height:1.55}
      #${MODAL_ID} .gs-problem-picker-info,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-problem-picker-info{display:flex;flex-direction:column;gap:12px;border-left-color:#2e7d32;white-space:normal}
      #${MODAL_ID} .gs-info-section,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-section{display:flex;flex-direction:column;gap:10px}
      #${MODAL_ID} .gs-info-source,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-source{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:rgba(59,130,246,.14);box-shadow:inset 0 0 0 1px rgba(59,130,246,.2)}
      #${MODAL_ID} .gs-info-source.is-warning,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-source.is-warning{background:rgba(251,191,36,.18);box-shadow:inset 0 0 0 1px rgba(217,119,6,.24)}
      #${MODAL_ID} .gs-info-source-caption,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-source-caption{color:#5473a6;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      #${MODAL_ID} .gs-info-source.is-warning .gs-info-source-caption,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-source.is-warning .gs-info-source-caption{color:#9a6700}
      #${MODAL_ID} .gs-info-source-value,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-source-value{color:#1f4f8b;font-size:14px;font-weight:700;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}
      #${MODAL_ID} .gs-info-source.is-warning .gs-info-source-value,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-source.is-warning .gs-info-source-value{color:#7c4a03}
      #${MODAL_ID} .gs-info-block,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-block{padding:12px 14px;border-radius:12px;background:rgba(148,163,184,.13);box-shadow:inset 0 0 0 1px rgba(148,163,184,.18)}
      #${MODAL_ID} .gs-info-block.is-new,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-block.is-new{background:rgba(34,197,94,.12);box-shadow:inset 0 0 0 1px rgba(22,163,74,.18)}
      #${MODAL_ID} .gs-info-block.is-warning,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-block.is-warning{background:rgba(251,191,36,.18);box-shadow:inset 0 0 0 1px rgba(217,119,6,.24)}
      #${MODAL_ID} .gs-info-block-header,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-block-header{margin-bottom:6px;color:#263244;font-size:13px;font-weight:700;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
      #${MODAL_ID} .gs-info-block-body,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-block-body{display:flex;flex-direction:column;gap:8px;color:#1f2937;font-size:14px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
      #${MODAL_ID} .gs-info-block-body-text,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-block-body-text{white-space:pre-wrap;overflow-wrap:anywhere}
      #${MODAL_ID} .gs-info-quote,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-quote{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-left:3px solid rgba(59,130,246,.55);border-radius:10px;background:rgba(59,130,246,.08)}
      #${MODAL_ID} .gs-info-quote-line,#${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-info-quote-line{padding-left:calc((var(--gs-info-quote-depth, 1) - 1) * 12px);color:#45556f;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      #${MODAL_ID} .gs-problem-picker-footer{align-items:center;border-top:1px solid #e3e8f0;padding-top:14px}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-footer{align-items:center;border-top:1px solid #e3e8f0;padding-top:14px}
      #${MODAL_ID} .gs-problem-picker-buttons{display:flex;flex-shrink:0;gap:10px}
      #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-buttons{display:flex;flex-shrink:0;gap:10px}
      #${MODAL_ID} .gs-problem-picker-category-rail{height:100%;min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;box-sizing:border-box;padding:18px;border:1px solid #d6dce8;border-radius:8px;background:#f8fafc;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.18)}
      #${MODAL_ID} .gs-problem-picker-category-title{font-size:15px;line-height:1.25;font-weight:700;color:#253044}
      #${MODAL_ID} .gs-problem-picker-category-list{min-height:0;overflow:auto;display:grid;align-content:start;gap:8px;padding-right:2px}
      #${MODAL_ID} .gs-problem-picker-category-button{width:100%;min-height:40px;text-align:left;white-space:normal;overflow-wrap:anywhere;line-height:1.25;padding:9px 10px;border-color:#cbd5e1;background:#fff;color:#172033;box-shadow:0 3px 10px rgba(15,23,42,.05)}
      #${MODAL_ID} .gs-problem-picker-category-button:hover:not(:disabled),#${MODAL_ID} .gs-problem-picker-category-button:focus-visible{border-color:#1155cc;background:#eef5ff;color:#0f3f99;outline:none}
      #${MODAL_ID} .gs-problem-picker-category-list:not(.has-prediction) .gs-problem-picker-category-button.is-default{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.2)}
      #${MODAL_ID} .gs-problem-picker-category-button.is-selected{border-color:#2e7d32;box-shadow:0 0 0 2px rgba(46,125,50,.14),0 3px 10px rgba(15,23,42,.05)}
      #${MODAL_ID} .gs-problem-picker-category-list:not(.has-prediction) .gs-problem-picker-category-button.is-selected:not(.is-default){background:#e9f6ee;color:#14532d}
      #${MODAL_ID} .gs-problem-picker-category-list .gs-problem-picker-category-button[data-prediction-level="high"]{border-color:#15803d;background:#86efac;color:#052e16}
      #${MODAL_ID} .gs-problem-picker-category-list .gs-problem-picker-category-button[data-prediction-level="medium"]{border-color:#a16207;background:#fde047;color:#422006}
      #${MODAL_ID} .gs-problem-picker-category-list .gs-problem-picker-category-button[data-prediction-level="low"]{border-color:#b91c1c;background:#fca5a5;color:#450a0a}
      #${MODAL_ID} .gs-problem-picker-category-button[data-prediction-level]:focus-visible{outline:2px solid currentColor;outline-offset:2px}
      #${MODAL_ID} .gs-problem-picker-category-list.has-prediction .gs-problem-picker-category-button:focus-visible:not([data-prediction-level]){background:#fff;outline:2px solid #1155cc;outline-offset:2px}
      #${MODAL_ID} .gs-problem-picker-category-button:disabled{opacity:.58;cursor:default;box-shadow:none}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-card{width:min(860px,100%);max-height:min(760px,calc(100vh - 32px));display:grid;grid-template-rows:auto auto minmax(240px,1fr) minmax(160px,1fr) auto;gap:14px;box-sizing:border-box;padding:22px;border:1px solid #d6dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.26);pointer-events:auto}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-header,#${ITIL_IMPORT_MODAL_ID} .gs-itil-import-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-title{font-size:22px;line-height:1.2;font-weight:700}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-subtitle{margin-top:4px;color:#566176;font-size:13px;line-height:1.45}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-input{width:100%;height:100%;min-height:240px;resize:none;box-sizing:border-box;border:1px solid #c8d2e1;border-radius:10px;background:#fff;color:#172033;font:13px/1.5 Consolas,"Courier New",monospace;padding:14px}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-input:focus{outline:2px solid rgba(17,85,204,.18);border-color:#1155cc}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-details{min-height:0;margin:0;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font:13px/1.5 Consolas,"Courier New",monospace}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-status{min-height:18px;color:#566176;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-status.is-error{color:#b3261e}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-footer{flex-wrap:wrap}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-buttons{display:flex;flex-wrap:wrap;gap:10px}
      #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-start{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.2)}
      #${ITIL_IMPORT_MODAL_ID} button:disabled{opacity:.58;cursor:default;box-shadow:none}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-card{width:min(760px,100%);max-height:min(760px,calc(100vh - 32px));display:grid;grid-template-rows:auto auto auto minmax(180px,1fr) auto;gap:14px;box-sizing:border-box;padding:22px;border:1px solid #d6dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.26);pointer-events:auto}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-header,#${WSS_IMPORT_MODAL_ID} .gs-wss-import-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-title{font-size:22px;line-height:1.2;font-weight:700}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-subtitle{margin-top:4px;color:#566176;font-size:13px}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #dbe2ec;border-radius:8px;background:#f7f9fc}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#253044;font-size:13px;font-weight:700}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-choose,#${WSS_IMPORT_MODAL_ID} .gs-wss-import-start{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 8px 22px rgba(17,85,204,.2)}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-details{min-height:0;margin:0;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font:13px/1.5 Consolas,"Courier New",monospace}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-status{min-height:18px;color:#566176;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-status.is-error{color:#b3261e}
      #${WSS_IMPORT_MODAL_ID} .gs-wss-import-buttons{display:flex;flex-shrink:0;gap:10px}
      #${WSS_IMPORT_MODAL_ID} button:disabled{opacity:.58;cursor:default;box-shadow:none}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-panel{width:min(1280px,calc(100vw - 32px));height:min(820px,calc(100vh - 32px));min-height:0;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;gap:14px;box-sizing:border-box;padding:22px;border:1px solid #d6dce8;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px rgba(15,23,42,.26);pointer-events:auto}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-header,#${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-title{font-size:22px;line-height:1.2;font-weight:700}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-meta,#${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-message{color:#566176;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-message.is-error{color:#b3261e}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-pill{padding:6px 10px;border-radius:999px;background:#eef5ff;color:#0f3f99;font-size:12px;font-weight:700;overflow-wrap:anywhere}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-pill.is-created{background:#e8f3ee;color:#14532d}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-pill.is-updated{background:#fff7e6;color:#8a5700}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-grid{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-wrap{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-label{color:#4b5563;font-size:13px;font-weight:700}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-text{height:100%;max-height:100%;min-height:0;box-sizing:border-box;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font-size:14px;line-height:1.55}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-side{border-left-color:#2e7d32}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-footer{align-items:center;border-top:1px solid #e3e8f0;padding-top:14px}
      #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-buttons{display:flex;flex-shrink:0;gap:10px}
      #${WSS_IMPORT_REVIEW_MODAL_ID} button:disabled{opacity:.58;cursor:default;box-shadow:none}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-card{width:min(1180px,100%);max-height:min(780px,calc(100vh - 32px));display:grid;grid-template-rows:auto auto auto auto;gap:16px;box-sizing:border-box;padding:22px;border:1px solid rgba(182,193,210,.92);border-radius:16px;background:linear-gradient(145deg,#fbfdff 0%,#f3f7ff 54%,#eef6f3 100%);color:#172033;box-shadow:0 28px 90px rgba(15,23,42,.28);pointer-events:auto}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-kicker{margin-bottom:5px;color:#49627b;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-title{font-size:24px;line-height:1.2;font-weight:700}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-subtitle{margin-top:6px;color:#566176;font-size:13px;line-height:1.45}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-close{width:36px;height:36px;padding:0;font-size:22px;line-height:1}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-form{display:grid;gap:10px;padding:16px;border:1px solid rgba(183,194,211,.72);border-radius:12px;background:rgba(255,255,255,.78)}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-label{font-size:13px;font-weight:700;color:#253044}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-input{width:100%;min-height:92px;resize:vertical;box-sizing:border-box;border:1px solid #c8d2e1;border-radius:10px;background:#fff;color:#172033;font:14px/1.5 "Segoe UI",Tahoma,sans-serif;padding:12px 13px}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-input:focus{outline:2px solid rgba(17,85,204,.18);border-color:#1155cc}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-start{border-color:#1155cc;background:#1155cc;color:#fff;box-shadow:0 10px 26px rgba(17,85,204,.2)}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-open-chat[hidden]{display:none!important}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-status{min-height:19px;color:#24513a;font-size:13px;line-height:1.45}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-status.is-error{color:#b3261e}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-result-meta{display:flex;flex-wrap:wrap;gap:8px;color:#566176;font-size:12px}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-pill{padding:5px 9px;border-radius:999px;background:rgba(17,85,204,.1);color:#0f3f99;font-weight:700}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-details{border-top:1px solid rgba(183,194,211,.72);padding-top:12px}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-details[hidden]{display:none!important}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-details summary{cursor:pointer;color:#314157;font-size:13px;font-weight:700}
      #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-prompt{max-height:180px;overflow:auto;margin:10px 0 0;padding:12px;border-radius:10px;background:rgba(15,23,42,.05);white-space:pre-wrap;color:#334155;font:12px/1.5 Consolas,"Courier New",monospace}
      @media (max-width:1480px){
        #${MODAL_ID} .gs-problem-picker-layout{width:min(1180px,100%);height:min(880px,calc(100vh - 32px));grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,220px)}
        #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-new-response-review-layout{width:min(1180px,100%);height:min(880px,calc(100vh - 32px))}
        #${MODAL_ID} .gs-problem-picker-category-rail{height:100%;max-height:none}
      }
      @media (max-width:980px){
        #${MODAL_ID} .gs-problem-picker-text-grid{grid-template-columns:1fr;grid-template-rows:repeat(2,minmax(0,1fr))}
        #${NEW_RESPONSE_REVIEW_MODAL_ID} .gs-problem-picker-text-grid{grid-template-columns:1fr;grid-template-rows:repeat(2,minmax(0,1fr))}
      }
      @media (max-width:860px){
        #${CHATGPT_SEARCH_MODAL_ID}{align-items:flex-start;overflow:auto}
        #${CHATGPT_SEARCH_MODAL_ID} .gs-chatgpt-search-card{max-height:none;grid-template-rows:auto auto auto auto}
        #${ITIL_IMPORT_MODAL_ID}{align-items:flex-start;overflow:auto}
        #${ITIL_IMPORT_MODAL_ID} .gs-itil-import-card{max-height:none;grid-template-rows:auto auto minmax(260px,1fr) minmax(180px,1fr) auto}
        #${WSS_IMPORT_MODAL_ID}{align-items:flex-start;overflow:auto}
        #${WSS_IMPORT_MODAL_ID} .gs-wss-import-card{max-height:none;grid-template-rows:auto auto auto minmax(220px,1fr) auto}
        #${WSS_IMPORT_MODAL_ID} .gs-wss-import-file{grid-template-columns:1fr}
        #${WSS_IMPORT_REVIEW_MODAL_ID}{align-items:flex-start;overflow:auto}
        #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-panel{height:auto;min-height:min(760px,calc(100vh - 32px))}
        #${WSS_IMPORT_REVIEW_MODAL_ID} .gs-wss-review-grid{grid-template-columns:1fr;grid-template-rows:repeat(2,minmax(240px,1fr))}
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

  function formatSuppRequestLabel(item) {
    const suppNumbers = getItemSuppNumbers(item);
    const primarySuppNumber = suppNumbers[0] || String(item && item.suppNumber || '').trim();
    if (!primarySuppNumber) return 'СУПП не задан';
    return suppNumbers.length > 1
      ? `СУПП ${primarySuppNumber} +${suppNumbers.length - 1}`
      : `СУПП ${primarySuppNumber}`;
  }

  function getItilCurrentText() {
    const queuedItem = itilState.isRunning && !itilState.stopRequested ? itilState.queue[itilState.currentIndex] : null;
    const item = itilState.currentItem || queuedItem || null;
    return item ? `строка ${item.row}, ITIL ${item.itilNumber}` : 'нет';
  }

  function getSuppCurrentText() {
    const queuedItem = suppState.isRunning && !suppState.stopRequested ? suppState.queue[suppState.currentIndex] : null;
    const item = suppState.currentItem || queuedItem || null;
    if (!item) return 'нет';
    return `строка ${item.row}, ${formatSuppRequestLabel(item)}`;
  }

  function getNewResponseCurrentText() {
    const queuedItem = newResponseState.isRunning && !newResponseState.stopRequested
      ? newResponseState.queue[newResponseState.currentIndex]
      : null;
    const item = newResponseState.currentItem || queuedItem || null;
    if (!item) return 'нет';
    if (item.mode === 'supp') return `строка ${item.row}, ${formatSuppRequestLabel(item)}`;
    if (item.mode === 'itil') return `строка ${item.row}, ITIL ${item.itilNumber || 'не задан'}`;
    return `строка ${item.row}, неизвестная ветка`;
  }

  function isCombinedFlowClassificationStage() {
    return combinedFlowState.isRunning && combinedFlowState.stage === 'classification';
  }

  function getCombinedCurrentText() {
    if (combinedFlowState.stage === 'classification') {
      if (state.isLoading) return 'подготавливаю очередь классификации';
      const item = getCurrentPendingClassificationItem();
      return item ? `классификация: строка ${item.row}` : 'классификация завершена';
    }

    const queuedItem = combinedFlowState.isRunning && !combinedFlowState.stopRequested
      ? combinedFlowState.queue[combinedFlowState.currentIndex]
      : null;
    const item = combinedFlowState.currentItem || queuedItem || null;
    if (!item) return 'нет';

    if (item.mode === 'supp') return `строка ${item.row}, ${formatSuppRequestLabel(item)}`;

    if (item.mode === 'itil') return `строка ${item.row}, ITIL ${item.itilNumber || 'не задан'}`;
    return `строка ${item.row}, неизвестная ветка`;
  }

  function getCombinedStageNote() {
    if (combinedFlowState.lastError) return combinedFlowState.lastError;
    if (combinedFlowState.stage === 'classification') {
      const baseText = state.isLoading
        ? 'Поиск завершён. Загружаю очередь классификации.'
        : (combinedFlowState.statusText || 'Классификация открыта.');
      if (newResponseState.lastError) return `${baseText} Новые ответы завершились с ошибкой: ${newResponseState.lastError}`;
      if (newResponseState.isRunning) return `${baseText} Новые ответы обрабатываются в фоне.`;
      if (newResponseReviewState.totalExpected > 0 || newResponseReviewState.queue.length > 0) {
        return `${baseText} Новые ответы уже подготовлены и ждут перехода.`;
      }
      return baseText;
    }
    return combinedFlowState.statusText || 'Ожидание запуска.';
  }

  function renderCombinedFlowStatus() {
    syncProcessingRowHighlightVisibility();
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const total = combinedFlowState.queue.length;
    const processed = Math.min(total, combinedFlowState.successCount + combinedFlowState.skippedCount + combinedFlowState.failedCount);
    const collected = $('.gs-problem-picker-combined-collected', menu);
    const progress = $('.gs-problem-picker-combined-progress', menu);
    const current = $('.gs-problem-picker-combined-current', menu);
    const status = $('.gs-problem-picker-combined-status', menu);
    const startButton = $('.gs-problem-picker-combined-start', menu);
    const stopButton = $('.gs-problem-picker-combined-stop', menu);
    const manualToggle = $('.gs-problem-picker-manual-toggle', menu);
    const manualPanel = $('.gs-problem-picker-manual-panel', menu);
    const manualClassificationButton = $('.gs-problem-picker-open', menu);
    const isClassificationStage = combinedFlowState.isRunning && combinedFlowState.stage === 'classification';
    const classificationReady = isClassificationStage && !state.isLoading;

    if (collected instanceof HTMLElement) collected.textContent = String(total);
    if (progress instanceof HTMLElement) {
      if (isClassificationStage) {
        if (state.isLoading) {
          progress.textContent = `поиск ${processed}/${total} · классификация загружается`;
        } else {
          const queueTotal = combinedFlowState.classificationQueueCount || state.queue.length;
          const queueDone = Math.min(queueTotal, state.currentIndex);
          progress.textContent = `поиск ${processed}/${total} · классификация ${queueDone}/${queueTotal}`;
        }
      } else {
        progress.textContent = `${processed}/${total}`;
      }
    }
    if (current instanceof HTMLElement) current.textContent = getCombinedCurrentText();
    if (status instanceof HTMLElement) {
      status.textContent = getCombinedStageNote();
      status.classList.toggle('is-error', !!(combinedFlowState.lastError || (isClassificationStage && newResponseState.lastError)));
    }

    const hasExternalBlockingRun = itilState.isRunning || suppState.isRunning || newResponseState.isRunning || state.isLoading;
    if (startButton instanceof HTMLButtonElement) {
      startButton.textContent = isClassificationStage ? 'К классификации' : 'Старт';
      startButton.disabled = isClassificationStage ? !classificationReady : (combinedFlowState.isRunning || hasExternalBlockingRun);
    }
    if (stopButton instanceof HTMLButtonElement) {
      stopButton.disabled = !(combinedFlowState.isRunning && combinedFlowState.stage === 'search');
    }
    if (manualClassificationButton instanceof HTMLButtonElement) {
      const canOpenClassification = isClassificationStage
        ? classificationReady
        : !(state.isLoading || itilState.isRunning || suppState.isRunning || (combinedFlowState.isRunning && combinedFlowState.stage === 'search'));
      manualClassificationButton.disabled = !canOpenClassification;
    }
    if (manualToggle instanceof HTMLButtonElement) {
      manualToggle.textContent = combinedFlowState.manualDropdownOpen ? '▲' : '▼';
      manualToggle.setAttribute('aria-expanded', combinedFlowState.manualDropdownOpen ? 'true' : 'false');
    }
    if (manualPanel instanceof HTMLElement) {
      manualPanel.hidden = !combinedFlowState.manualDropdownOpen;
    }
  }

  function renderItilStatus() {
    syncProcessingRowHighlightVisibility();
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
    const newResponseStartButton = $('.gs-problem-picker-new-response-start', menu);

    if (collected instanceof HTMLElement) collected.textContent = String(total);
    if (progress instanceof HTMLElement) progress.textContent = `${processed}/${total}`;
    if (current instanceof HTMLElement) current.textContent = getItilCurrentText();
    if (status instanceof HTMLElement) {
      status.textContent = itilState.lastError || itilState.statusText || '';
      status.classList.toggle('is-error', !!itilState.lastError);
    }
    if (startButton instanceof HTMLButtonElement) startButton.disabled = itilState.isRunning || suppState.isRunning || newResponseState.isRunning || combinedFlowState.isRunning;
    if (stopButton instanceof HTMLButtonElement) stopButton.disabled = !itilState.isRunning || !!itilState.stopRequested;
    if (newResponseStartButton instanceof HTMLButtonElement) newResponseStartButton.disabled = newResponseState.isRunning || itilState.isRunning || suppState.isRunning || combinedFlowState.isRunning;
  }

  function renderSuppStatus() {
    syncProcessingRowHighlightVisibility();
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const total = suppState.queue.length;
    const processed = Math.min(total, suppState.successCount + suppState.skippedCount + suppState.failedCount);

    const collected = $('.gs-problem-picker-supp-collected', menu);
    const progress = $('.gs-problem-picker-supp-progress', menu);
    const current = $('.gs-problem-picker-supp-current', menu);
    const status = $('.gs-problem-picker-supp-status', menu);
    const startButton = $('.gs-problem-picker-supp-start', menu);
    const testButton = $('.gs-problem-picker-supp-test', menu);
    const stopButton = $('.gs-problem-picker-supp-stop', menu);
    const newResponseStartButton = $('.gs-problem-picker-new-response-start', menu);

    if (collected instanceof HTMLElement) collected.textContent = String(total);
    if (progress instanceof HTMLElement) progress.textContent = `${processed}/${total}`;
    if (current instanceof HTMLElement) current.textContent = getSuppCurrentText();
    if (status instanceof HTMLElement) {
      status.textContent = suppState.lastError || suppState.statusText || '';
      status.classList.toggle('is-error', !!suppState.lastError);
    }
    if (startButton instanceof HTMLButtonElement) startButton.disabled = suppState.isRunning || itilState.isRunning || newResponseState.isRunning || combinedFlowState.isRunning;
    if (testButton instanceof HTMLButtonElement) testButton.disabled = suppState.isRunning || itilState.isRunning || newResponseState.isRunning || combinedFlowState.isRunning;
    if (stopButton instanceof HTMLButtonElement) stopButton.disabled = !suppState.isRunning || !!suppState.stopRequested;
    if (newResponseStartButton instanceof HTMLButtonElement) newResponseStartButton.disabled = newResponseState.isRunning || itilState.isRunning || suppState.isRunning || combinedFlowState.isRunning;
  }

  function renderNewResponseStatus() {
    syncProcessingRowHighlightVisibility();
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const total = newResponseState.queue.length;
    const processed = Math.min(total, newResponseState.successCount + newResponseState.skippedCount + newResponseState.failedCount);

    const collected = $('.gs-problem-picker-new-response-collected', menu);
    const progress = $('.gs-problem-picker-new-response-progress', menu);
    const current = $('.gs-problem-picker-new-response-current', menu);
    const status = $('.gs-problem-picker-new-response-status', menu);
    const startButton = $('.gs-problem-picker-new-response-start', menu);
    const historyButton = $('.gs-problem-picker-new-response-history', menu);
    const stopButton = $('.gs-problem-picker-new-response-stop', menu);

    if (collected instanceof HTMLElement) collected.textContent = String(total);
    if (progress instanceof HTMLElement) progress.textContent = `${processed}/${total}`;
    if (current instanceof HTMLElement) current.textContent = getNewResponseCurrentText();
    if (status instanceof HTMLElement) {
      status.textContent = newResponseState.lastError || newResponseState.statusText || '';
      status.classList.toggle('is-error', !!newResponseState.lastError);
    }
    if (startButton instanceof HTMLButtonElement) startButton.disabled = newResponseState.isRunning || itilState.isRunning || suppState.isRunning || combinedFlowState.isRunning;
    if (historyButton instanceof HTMLButtonElement) {
      const visibleUnreadCount = Math.max(
        Math.max(0, Number(newResponseInboxState.unreadCount) || 0),
        newResponseReviewState.isProcessing ? 0 : newResponseReviewState.queue.length
      );
      historyButton.textContent = `Непрочитанные (${visibleUnreadCount})`;
      historyButton.disabled = newResponseState.isRunning
        || itilState.isRunning
        || suppState.isRunning
        || combinedFlowState.isRunning
        || newResponseInboxState.isLoading
        || !hasNewResponseReviewHistory();
    }
    if (stopButton instanceof HTMLButtonElement) stopButton.disabled = !newResponseState.isRunning || !!newResponseState.stopRequested;
    renderNewResponseReviewModal();
    renderCombinedFlowStatus();
  }

  function renderWssImportStatus() {
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const status = $('.gs-wss-import-menu-status', menu);
    const importButton = $('.gs-wss-import-open', menu);
    const searchButton = $('.gs-wss-chatgpt-search-open', menu);
    const imported = wssImportState.imported || {};
    const text = wssImportState.lastError
      || (wssImportState.isParsing ? 'Разбираю архив...'
        : (wssImportState.isImporting ? `Импорт: пакет ${wssImportState.currentBatch}/${wssImportState.totalBatches}`
          : (wssImportState.statusText || 'Ожидание запуска.')));

    if (status instanceof HTMLElement) {
      status.textContent = text;
      status.classList.toggle('is-error', !!wssImportState.lastError);
      if (!wssImportState.lastError && !wssImportState.isParsing && !wssImportState.isImporting && (imported.created || imported.updated || imported.skipped)) {
        status.textContent = `Последний импорт: создано ${Number(imported.created || 0)}, обновлено ${Number(imported.updated || 0)}, пропущено ${Number(imported.skipped || 0)}.`;
      }
    }

    if (importButton instanceof HTMLButtonElement) {
      importButton.disabled = wssImportState.isParsing || wssImportState.isImporting;
    }
    if (searchButton instanceof HTMLButtonElement) {
      searchButton.disabled = wssImportState.isParsing || wssImportState.isImporting;
    }
  }

  function getItilImportDataRowsCount() {
    return Math.max(0, Number(itilImportState.tableRows && itilImportState.tableRows.length || 0) - 1);
  }

  function renderItilImportStatus() {
    const menu = document.getElementById(MENU_ID);
    if (!(menu instanceof HTMLElement)) return;

    const status = $('.gs-itil-import-menu-status', menu);
    const button = $('.gs-itil-import-open', menu);
    const text = itilImportState.lastError
      || (itilImportState.isParsing
        ? 'Разбираю вставленную таблицу...'
        : (itilImportState.isImporting
          ? (itilImportState.statusText || 'Загружаю таблицу...')
          : (itilImportState.statusText || 'Вставьте таблицу из буфера обмена.')));

    if (status instanceof HTMLElement) {
      status.textContent = text;
      status.classList.toggle('is-error', !!itilImportState.lastError);
    }

    if (button instanceof HTMLButtonElement) {
      button.disabled = itilImportState.isParsing || itilImportState.isImporting;
    }
  }

  function setChatGptSearchStatus(text, isError) {
    chatGptSearchState.statusText = String(text || '');
    chatGptSearchState.lastError = isError ? String(text || '') : '';
    renderChatGptSearchModal();
  }

  function renderChatGptSearchModal() {
    const modal = document.getElementById(CHATGPT_SEARCH_MODAL_ID);
    if (!(modal instanceof HTMLElement)) return;

    const mode = normalizeChatGptMode(chatGptSearchState.mode);
    const modeConfig = getChatGptModeConfig(mode);
    const title = $('.gs-chatgpt-search-title', modal);
    const subtitle = $('.gs-chatgpt-search-subtitle', modal);
    const label = $('.gs-chatgpt-search-label', modal);
    const queryInput = $('.gs-chatgpt-search-input', modal);
    const startButton = $('.gs-chatgpt-search-start', modal);
    const openChatButton = $('.gs-chatgpt-search-open-chat', modal);
    const status = $('.gs-chatgpt-search-status', modal);
    const resultMeta = $('.gs-chatgpt-search-result-meta', modal);
    const details = $('.gs-chatgpt-search-details', modal);
    const prompt = $('.gs-chatgpt-search-prompt', modal);

    if (title instanceof HTMLElement) title.textContent = modeConfig.title;
    if (subtitle instanceof HTMLElement) subtitle.textContent = modeConfig.subtitle;
    if (label instanceof HTMLElement) label.textContent = modeConfig.label;

    if (queryInput instanceof HTMLTextAreaElement) {
      const draft = getChatGptModeDraft(mode);
      if (queryInput.value !== draft) queryInput.value = draft;
      queryInput.placeholder = modeConfig.placeholder;
      queryInput.disabled = chatGptSearchState.isRunning;
    }

    if (startButton instanceof HTMLButtonElement) {
      startButton.disabled = chatGptSearchState.isRunning;
      startButton.textContent = chatGptSearchState.isRunning ? modeConfig.runningText : modeConfig.startText;
    }

    if (openChatButton instanceof HTMLButtonElement) {
      const hasChatTab = Number.isInteger(chatGptSearchState.chatTabId);
      openChatButton.hidden = !hasChatTab;
      openChatButton.disabled = chatGptSearchState.isRunning || !hasChatTab;
    }

    if (status instanceof HTMLElement) {
      status.textContent = chatGptSearchState.lastError || chatGptSearchState.statusText || '';
      status.classList.toggle('is-error', !!chatGptSearchState.lastError);
    }

    if (resultMeta instanceof HTMLElement) {
      resultMeta.replaceChildren();
      if (chatGptSearchState.compactRowsCount > 0) {
        const rowsPill = document.createElement('span');
        rowsPill.className = 'gs-chatgpt-search-pill';
        rowsPill.textContent = `Строк в CSV: ${chatGptSearchState.compactRowsCount}`;
        resultMeta.appendChild(rowsPill);
      }
      if (mode === CHATGPT_MODE_SEARCH && (chatGptSearchState.foundCount > 0 || chatGptSearchState.resultSheetId !== null)) {
        const foundPill = document.createElement('span');
        foundPill.className = 'gs-chatgpt-search-pill';
        foundPill.textContent = `Найдено заявок: ${chatGptSearchState.foundCount}`;
        resultMeta.appendChild(foundPill);
      }
      if (isChatGptOpenChatMode(mode) && Number.isInteger(chatGptSearchState.chatTabId) && !chatGptSearchState.isRunning) {
        const chatPill = document.createElement('span');
        chatPill.className = 'gs-chatgpt-search-pill';
        chatPill.textContent = 'Чат ChatGPT подготовлен';
        resultMeta.appendChild(chatPill);
      }
    }

    if (details instanceof HTMLDetailsElement) {
      details.hidden = !chatGptSearchState.sentPrompt;
    }
    if (prompt instanceof HTMLElement) {
      prompt.textContent = chatGptSearchState.sentPrompt || '';
    }
  }

  function closeChatGptSearchModal() {
    const modal = document.getElementById(CHATGPT_SEARCH_MODAL_ID);
    if (modal instanceof HTMLElement) modal.hidden = true;
  }

  function ensureChatGptSearchModal() {
    ensureStyle();

    const existing = document.getElementById(CHATGPT_SEARCH_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = CHATGPT_SEARCH_MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <section class="gs-chatgpt-search-card" role="dialog" aria-modal="true" aria-label="Поиск заявки через ChatGPT">
        <header class="gs-chatgpt-search-header">
          <div>
            <div class="gs-chatgpt-search-kicker">Google Sheets → ChatGPT</div>
            <div class="gs-chatgpt-search-title">Поиск заявки</div>
            <div class="gs-chatgpt-search-subtitle">Расширение само соберёт компактный CSV листа «Заявки», отправит запрос в фоновый временный чат и запишет найденные строки на лист «${CHATGPT_RESULT_SHEET_NAME}».</div>
          </div>
          <button type="button" class="gs-chatgpt-search-close" aria-label="Закрыть">×</button>
        </header>

        <section class="gs-chatgpt-search-form">
          <label class="gs-chatgpt-search-label" for="dup-google-sheets-chatgpt-search-input">Введите произвольный запрос для поиска заявки</label>
          <textarea id="dup-google-sheets-chatgpt-search-input" class="gs-chatgpt-search-input" placeholder="Например: заявки Зуйкевич Данил Иванович по теме ЕПГУ"></textarea>
          <div class="gs-chatgpt-search-actions">
            <button type="button" class="gs-chatgpt-search-start">Найти заявки</button>
            <button type="button" class="gs-chatgpt-search-open-chat" hidden>Открыть чат ChatGPT</button>
          </div>
          <div class="gs-chatgpt-search-status" aria-live="polite"></div>
        </section>

        <div class="gs-chatgpt-search-result-meta"></div>

        <details class="gs-chatgpt-search-details" hidden>
          <summary>Что было отправлено</summary>
          <pre class="gs-chatgpt-search-prompt"></pre>
        </details>
      </section>
    `;

    $('.gs-chatgpt-search-close', modal)?.addEventListener('click', closeChatGptSearchModal, { capture: true });
    $('.gs-chatgpt-search-start', modal)?.addEventListener('click', () => {
      void startChatGptSearch();
    }, { capture: true });
    $('.gs-chatgpt-search-open-chat', modal)?.addEventListener('click', () => {
      void openChatGptSearchTab();
    }, { capture: true });
    $('.gs-chatgpt-search-input', modal)?.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) {
        setChatGptModeDraft(chatGptSearchState.mode, target.value);
      }
    });

    (document.body || document.documentElement).appendChild(modal);
    renderChatGptSearchModal();
    return modal;
  }

  function openChatGptSearchModal(mode) {
    closeMenu();
    const nextMode = normalizeChatGptMode(mode);
    const modeConfig = getChatGptModeConfig(nextMode);
    chatGptSearchState = {
      ...chatGptSearchState,
      mode: nextMode,
      statusText: modeConfig.idleStatus,
      lastError: '',
      compactRowsCount: 0,
      foundCount: 0,
      chatTabId: null,
      sentPrompt: '',
      resultSheetId: null
    };
    const modal = ensureChatGptSearchModal();
    modal.hidden = false;
    renderChatGptSearchModal();

    const queryInput = $('.gs-chatgpt-search-input', modal);
    if (queryInput instanceof HTMLTextAreaElement) queryInput.focus();
  }

  function closeMenu() {
    const overlay = document.getElementById(MENU_OVERLAY_ID);
    const menu = document.getElementById(MENU_ID);
    if (overlay instanceof HTMLElement) overlay.hidden = true;
    if (menu instanceof HTMLElement) menu.hidden = true;
  }

  function getMenuMarkup() {
    return `
      <header class="gs-problem-picker-menu-header">
        <div>
          <div class="gs-problem-picker-menu-title">Меню Google Sheets</div>
          <div class="gs-problem-picker-menu-subtitle">Горячая клавиша: F2</div>
        </div>
        <button type="button" class="gs-problem-picker-menu-close" aria-label="Закрыть">×</button>
      </header>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">Поиск новых заявок, классификация, новые ответы</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-problem-picker-combined-start">Старт</button>
          <button type="button" class="gs-problem-picker-combined-stop" disabled>Стоп</button>
          <button type="button" class="gs-problem-picker-new-response-history" disabled>Непрочитанные (0)</button>
          <button type="button" class="gs-wait-settings-toggle" aria-expanded="false">Настройки ожидания</button>
          <button type="button" class="gs-problem-picker-manual-toggle" aria-expanded="false" aria-label="Показать ручные действия">▼</button>
          <button type="button" class="gs-problem-picker-url">URL bridge</button>
        </div>
        ${getWaitSettingsMarkup()}
        <dl class="gs-problem-picker-combined-grid">
          <dt>Собрано строк</dt>
          <dd class="gs-problem-picker-combined-collected">0</dd>
          <dt>Обработано</dt>
          <dd class="gs-problem-picker-combined-progress">0/0</dd>
          <dt>Сейчас</dt>
          <dd class="gs-problem-picker-combined-current">нет</dd>
          <dt>Статус</dt>
          <dd class="gs-problem-picker-combined-status" aria-live="polite">Ожидание запуска.</dd>
        </dl>
        <div class="gs-problem-picker-status" aria-live="polite"></div>
        <div class="gs-problem-picker-manual-panel" hidden>
          <div class="gs-problem-picker-manual-title">Ручные действия</div>

          <div class="gs-problem-picker-manual-section">
            <div class="gs-problem-picker-manual-section-title">Классификация</div>
            <div class="gs-problem-picker-menu-actions">
              <button type="button" class="gs-problem-picker-open">Классификация</button>
            </div>
          </div>

          <div class="gs-problem-picker-manual-section">
            <div class="gs-problem-picker-manual-section-title">ITIL: заполнить текст заявок</div>
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
          </div>

          <div class="gs-problem-picker-manual-section">
            <div class="gs-problem-picker-manual-section-title">СУПП: заполнить текст заявок</div>
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
          </div>

          <div class="gs-problem-picker-manual-section">
          <div class="gs-problem-picker-manual-section-title">Пришел новый ответ</div>
          <div class="gs-problem-picker-menu-actions">
            <button type="button" class="gs-problem-picker-new-response-start">Старт</button>
            <button type="button" class="gs-problem-picker-new-response-stop" disabled>Стоп</button>
          </div>
            <dl class="gs-problem-picker-new-response-grid">
              <dt>Собрано строк</dt>
              <dd class="gs-problem-picker-new-response-collected">0</dd>
              <dt>Обработано</dt>
              <dd class="gs-problem-picker-new-response-progress">0/0</dd>
              <dt>Сейчас</dt>
              <dd class="gs-problem-picker-new-response-current">нет</dd>
              <dt>Статус</dt>
              <dd class="gs-problem-picker-new-response-status" aria-live="polite">Ожидание запуска.</dd>
            </dl>
          </div>
        </div>
      </section>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">Заявки ITIL</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-itil-import-open">Загрузить таблицу</button>
        </div>
        <div class="gs-itil-import-menu-status" aria-live="polite">Вставьте таблицу из буфера обмена.</div>
      </section>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">Заявки WSS</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-wss-import-open">Загрузить архив</button>
          <button type="button" class="gs-wss-chatgpt-search-open">Поиск заявки</button>
        </div>
        <div class="gs-wss-import-menu-status" aria-live="polite">Ожидание запуска.</div>
      </section>

      <section class="gs-problem-picker-menu-section">
        <div class="gs-problem-picker-menu-section-title">ChatGPT по заявкам</div>
        <div class="gs-problem-picker-menu-actions">
          <button type="button" class="gs-problem-picker-chatgpt-search-open">Поиск заявки</button>
          <button type="button" class="gs-problem-picker-chatgpt-question-open">Задать вопрос по заявкам</button>
        </div>
        <div class="gs-problem-picker-chatgpt-note"><code>Поиск заявки</code> запишет найденные строки на лист «${CHATGPT_RESULT_SHEET_NAME}». <code>Задать вопрос по заявкам</code> просто откроет временный чат ChatGPT с приложенным CSV и готовым исследовательским промптом.</div>
      </section>
    `;
  }

  function bindMenuInteractions(menu, overlay) {
    if (overlay instanceof HTMLElement && !overlay[MENU_OVERLAY_BOUND_FLAG]) {
      overlay[MENU_OVERLAY_BOUND_FLAG] = true;
    }

    if (!(menu instanceof HTMLElement) || menu[MENU_BOUND_FLAG]) return;

    menu.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest('button');
      if (!(button instanceof HTMLButtonElement) || !menu.contains(button)) return;

      if (button.classList.contains('gs-problem-picker-menu-close')) {
        closeMenu();
        return;
      }
      if (button.classList.contains('gs-problem-picker-combined-start')) {
        void startCombinedFlow();
        return;
      }
      if (button.classList.contains('gs-problem-picker-combined-stop')) {
        stopCombinedFlow();
        return;
      }
      if (button.classList.contains('gs-wait-settings-toggle')) {
        void openWaitSettings();
        return;
      }
      if (button.classList.contains('gs-wait-settings-save')) {
        void saveWaitSettings(false);
        return;
      }
      if (button.classList.contains('gs-wait-settings-defaults')) {
        void saveWaitSettings(true);
        return;
      }
      if (button.classList.contains('gs-problem-picker-manual-toggle')) {
        combinedFlowState = {
          ...combinedFlowState,
          manualDropdownOpen: !combinedFlowState.manualDropdownOpen
        };
        renderCombinedFlowStatus();
        return;
      }
      if (button.classList.contains('gs-problem-picker-open')) {
        void openClassificationPicker({ useExistingQueue: isCombinedFlowClassificationStage() });
        return;
      }
      if (button.classList.contains('gs-problem-picker-url')) {
        void promptBridgeUrl();
        return;
      }
      if (button.classList.contains('gs-problem-picker-chatgpt-search-open')) {
        openChatGptSearchModal(CHATGPT_MODE_SEARCH);
        return;
      }
      if (button.classList.contains('gs-problem-picker-chatgpt-question-open')) {
        openChatGptSearchModal(CHATGPT_MODE_QUESTION);
        return;
      }
      if (button.classList.contains('gs-itil-import-open')) {
        openItilImportModal();
        return;
      }
      if (button.classList.contains('gs-wss-import-open')) {
        openWssImportModal();
        return;
      }
      if (button.classList.contains('gs-wss-chatgpt-search-open')) {
        openChatGptSearchModal(CHATGPT_MODE_WSS_SEARCH);
        return;
      }
      if (button.classList.contains('gs-problem-picker-itil-start')) {
        void startItilFill();
        return;
      }
      if (button.classList.contains('gs-problem-picker-itil-stop')) {
        stopItilFill();
        return;
      }
      if (button.classList.contains('gs-problem-picker-supp-start')) {
        void startSuppFill(0);
        return;
      }
      if (button.classList.contains('gs-problem-picker-supp-test')) {
        void startSuppFill(1);
        return;
      }
      if (button.classList.contains('gs-problem-picker-supp-stop')) {
        stopSuppFill();
        return;
      }
      if (button.classList.contains('gs-problem-picker-new-response-start')) {
        void startNewResponseRefresh();
        return;
      }
      if (button.classList.contains('gs-problem-picker-new-response-history')) {
        void openLastNewResponseReviewHistory();
        return;
      }
      if (button.classList.contains('gs-problem-picker-new-response-stop')) {
        stopNewResponseRefresh();
      }
    }, { capture: true });

    menu[MENU_BOUND_FLAG] = true;
  }

  function ensureMenu() {
    ensureStyle();

    let overlay = document.getElementById(MENU_OVERLAY_ID);
    let menu = document.getElementById(MENU_ID);
    const host = document.body || document.documentElement;
    if (!(host instanceof HTMLElement)) return null;

    if (!(overlay instanceof HTMLElement)) {
      overlay = document.createElement('div');
      overlay.id = MENU_OVERLAY_ID;
      overlay.hidden = true;
    }
    if (!(menu instanceof HTMLElement)) {
      menu = document.createElement('section');
      menu.id = MENU_ID;
      menu.hidden = true;
    }

    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Меню Google Sheets');

    const needsMenuRefresh = menu.dataset.layoutVersion !== MENU_LAYOUT_VERSION
      || !$('.gs-wait-settings-toggle', menu)
      || !$('.gs-wait-settings-panel', menu)
      || !$('.gs-problem-picker-manual-toggle', menu)
      || !$('.gs-problem-picker-manual-panel', menu)
      || !$('.gs-itil-import-open', menu)
      || !$('.gs-wss-import-open', menu)
      || !$('.gs-wss-chatgpt-search-open', menu);
    if (needsMenuRefresh) {
      menu.innerHTML = getMenuMarkup();
      menu.dataset.layoutVersion = MENU_LAYOUT_VERSION;
    }

    if (!overlay.isConnected) host.appendChild(overlay);
    if (!menu.isConnected) host.appendChild(menu);

    bindMenuInteractions(menu, overlay);
    updateLauncherStatus(menuStatusText, menuStatusIsError);
    renderCombinedFlowStatus();
    renderWaitSettingsPanel();
    renderItilStatus();
    renderSuppStatus();
    renderNewResponseStatus();
    renderItilImportStatus();
    renderWssImportStatus();
    return menu;
  }

  function openMenu() {
    const menu = ensureMenu();
    const overlay = document.getElementById(MENU_OVERLAY_ID);
    if (!(menu instanceof HTMLElement)) return false;
    if (overlay instanceof HTMLElement) overlay.hidden = false;
    menu.hidden = false;
    renderWaitSettingsPanel();
    renderItilStatus();
    renderSuppStatus();
    renderNewResponseStatus();
    renderItilImportStatus();
    renderWssImportStatus();
    updateLauncherStatus(menuStatusText, menuStatusIsError);
    void refreshNewResponseInboxSummary();
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
    const newResponseReviewModal = document.getElementById(NEW_RESPONSE_REVIEW_MODAL_ID);
    const chatGptSearchModal = document.getElementById(CHATGPT_SEARCH_MODAL_ID);
    const itilImportModal = document.getElementById(ITIL_IMPORT_MODAL_ID);
    const wssImportModal = document.getElementById(WSS_IMPORT_MODAL_ID);
    const wssImportReviewModal = document.getElementById(WSS_IMPORT_REVIEW_MODAL_ID);
    if (menu instanceof HTMLElement && !menu.hidden) {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (chatGptSearchModal instanceof HTMLElement && !chatGptSearchModal.hidden) {
      event.preventDefault();
      closeChatGptSearchModal();
      return;
    }
    if (newResponseReviewModal instanceof HTMLElement && !newResponseReviewModal.hidden) {
      event.preventDefault();
      closeNewResponseReviewModal();
      return;
    }
    if (itilImportModal instanceof HTMLElement && !itilImportModal.hidden) {
      event.preventDefault();
      closeItilImportModal();
      return;
    }
    if (wssImportModal instanceof HTMLElement && !wssImportModal.hidden) {
      event.preventDefault();
      closeWssImportModal();
      return;
    }
    if (wssImportReviewModal instanceof HTMLElement && !wssImportReviewModal.hidden) {
      event.preventDefault();
      closeWssImportReviewModal();
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

  function closeItilImportModal() {
    const modal = document.getElementById(ITIL_IMPORT_MODAL_ID);
    if (modal instanceof HTMLElement) modal.hidden = true;
  }

  function cancelItilImportParse() {
    if (itilImportParseTimer) {
      clearTimeout(itilImportParseTimer);
      itilImportParseTimer = 0;
    }
  }

  function resetItilImportState(overrides) {
    cancelItilImportParse();
    itilImportParseRunId += 1;
    itilImportState = {
      rawText: '',
      headers: [],
      tableRows: [],
      isParsing: false,
      isImporting: false,
      currentBatch: 0,
      totalBatches: 0,
      insertedRowsCount: 0,
      nextRowOffset: 0,
      statusText: 'Вставьте таблицу из буфера обмена.',
      lastError: '',
      ...(overrides || {})
    };
  }

  function normalizeItilImportTableText(text) {
    return String(text || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
  }

  function getItilImportHeaderMismatchText(headers) {
    const mismatches = [];

    for (let index = 0; index < ITIL_IMPORT_HEADERS.length; index++) {
      const expected = ITIL_IMPORT_HEADERS[index];
      const actual = String(headers[index] || '').trim();
      if (actual === expected) continue;
      mismatches.push(`${index + 1}. ожидалось «${expected}», получено «${actual || 'пусто'}»`);
    }

    return mismatches.join('\n');
  }

  async function parseItilImportTableText(text) {
    const normalized = normalizeItilImportTableText(text);
    const tableRows = [];
    const encoder = new TextEncoder();
    let offset = 0;
    let index = 0;
    while (offset < normalized.length) {
      const end = normalized.indexOf('\n', offset);
      const line = normalized.slice(offset, end < 0 ? normalized.length : end);
      offset = end < 0 ? normalized.length : end + 1;
      index += 1;
      if (index % ITIL_IMPORT_BATCH_ROWS === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      const cells = String(line || '').split('\t');
      const hasValues = cells.some((cell) => String(cell || '').trim() !== '');
      if (!hasValues) continue;
      if (cells.length > ITIL_IMPORT_COLUMN_COUNT) {
        throw new Error(`Строка ${index} содержит ${cells.length} столбцов вместо ${ITIL_IMPORT_COLUMN_COUNT}.`);
      }
      while (cells.length < ITIL_IMPORT_COLUMN_COUNT) cells.push('');
      if (encoder.encode(JSON.stringify(cells)).length > ITIL_IMPORT_BATCH_BYTES - 4096) {
        throw new Error(`Строка ${index} слишком большая для отправки. Проверьте содержимое её ячеек.`);
      }
      tableRows.push(cells.map((cell) => String(cell == null ? '' : cell).replace(/\r/g, '')));
    }

    if (!tableRows.length) {
      return {
        headers: [],
        tableRows: []
      };
    }

    const headers = tableRows[0].map((cell) => String(cell || '').trim());
    if (headers.length !== ITIL_IMPORT_COLUMN_COUNT) {
      throw new Error(`Ожидалось ${ITIL_IMPORT_COLUMN_COUNT} заголовка, получено ${headers.length}.`);
    }

    const mismatchText = getItilImportHeaderMismatchText(headers);
    if (mismatchText) {
      throw new Error('Вставлена не та таблица или изменился порядок колонок.\n' + mismatchText);
    }

    if (tableRows.length < 2) {
      throw new Error('После строки заголовков нет данных для загрузки.');
    }

    tableRows[0] = headers;

    return {
      headers,
      tableRows
    };
  }

  function buildItilImportDetailsText() {
    if (!itilImportState.tableRows.length) {
      return [
        'Лист назначения: ITIL',
        `Старт вставки: A${ITIL_IMPORT_START_ROW}`,
        `Ожидается: ${ITIL_IMPORT_COLUMN_COUNT} столбца`,
        '',
        'Вставьте таблицу целиком, вместе с первой строкой заголовков.'
      ].join('\n');
    }

    return [
      `Лист назначения: ${ITIL_IMPORT_SHEET_NAME}`,
      `Старт вставки: A${ITIL_IMPORT_START_ROW}`,
      `Строк всего с заголовком: ${itilImportState.tableRows.length}`,
      `Строк данных: ${getItilImportDataRowsCount()}`,
      `Столбцов: ${itilImportState.headers.length}`,
      'Отправка: одним запросом',
      '',
      'Заголовки:',
      ...itilImportState.headers.map((header, index) => `${index + 1}. ${header}`)
    ].join('\n');
  }

  function renderItilImportModal() {
    const modal = document.getElementById(ITIL_IMPORT_MODAL_ID);
    if (!(modal instanceof HTMLElement)) return;

    const input = $('.gs-itil-import-input', modal);
    const progress = $('.gs-itil-import-progress', modal);
    const details = $('.gs-itil-import-details', modal);
    const status = $('.gs-itil-import-status', modal);
    const clearButton = $('.gs-itil-import-clear', modal);
    const startButton = $('.gs-itil-import-start', modal);
    const clipboardButton = $('.gs-itil-import-clipboard', modal);
    if (clipboardButton instanceof HTMLButtonElement) {
      clipboardButton.disabled = itilImportState.isParsing || itilImportState.isImporting;
    }

    if (input instanceof HTMLTextAreaElement) {
      if (input.value !== itilImportState.rawText) input.value = itilImportState.rawText;
      input.disabled = itilImportState.isParsing || itilImportState.isImporting;
    }

    if (progress instanceof HTMLElement) {
      progress.textContent = itilImportState.isParsing
        ? 'Разбираю таблицу...'
        : (itilImportState.isImporting
          ? `Загружено ${itilImportState.insertedRowsCount} из ${getItilImportDataRowsCount()} строк`
        : (itilImportState.tableRows.length
          ? `Готово к вставке: ${getItilImportDataRowsCount()} строк данных`
          : (itilImportState.insertedRowsCount > 0 ? `Загружено ${itilImportState.insertedRowsCount} строк` : 'Ожидание вставки')));
    }

    if (details instanceof HTMLElement) {
      details.textContent = buildItilImportDetailsText();
    }

    if (status instanceof HTMLElement) {
      status.textContent = itilImportState.lastError || itilImportState.statusText || '';
      status.classList.toggle('is-error', !!itilImportState.lastError);
    }

    if (clearButton instanceof HTMLButtonElement) {
      clearButton.disabled = (itilImportState.isParsing || itilImportState.isImporting)
        || (!itilImportState.rawText && !itilImportState.tableRows.length);
    }

    if (startButton instanceof HTMLButtonElement) {
      startButton.disabled = itilImportState.isParsing || itilImportState.isImporting || itilImportState.tableRows.length < 2;
      startButton.textContent = itilImportState.nextRowOffset > 0 ? 'Продолжить загрузку' : 'Загрузить';
    }

    renderItilImportStatus();
  }

  function ensureItilImportModal() {
    ensureStyle();

    const existing = document.getElementById(ITIL_IMPORT_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = ITIL_IMPORT_MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <section class="gs-itil-import-card" role="dialog" aria-modal="true" aria-label="Импорт таблицы ITIL">
        <header class="gs-itil-import-header">
          <div>
            <div class="gs-itil-import-title">Заявки ITIL</div>
            <div class="gs-itil-import-subtitle">Скопируйте таблицу в 1С и нажмите «Загрузить из буфера». Запись на лист «${ITIL_IMPORT_SHEET_NAME}» с A${ITIL_IMPORT_START_ROW}. До завершения не запускайте поиск новых заявок.</div>
          </div>
          <button type="button" class="gs-itil-import-close-x" aria-label="Закрыть">×</button>
        </header>
        <div class="gs-itil-import-progress" aria-live="polite">Ожидание вставки</div>
        <textarea class="gs-itil-import-input" spellcheck="false" placeholder="Основной способ — кнопка «Загрузить из буфера» внизу. Запасной способ — вставить таблицу сюда через Ctrl+V."></textarea>
        <pre class="gs-itil-import-details"></pre>
        <footer class="gs-itil-import-footer">
          <div class="gs-itil-import-status" aria-live="polite"></div>
          <div class="gs-itil-import-buttons">
            <button type="button" class="gs-itil-import-clipboard">Загрузить из буфера</button>
            <button type="button" class="gs-itil-import-close">Закрыть</button>
            <button type="button" class="gs-itil-import-clear">Очистить</button>
            <button type="button" class="gs-itil-import-start" disabled>Загрузить</button>
          </div>
        </footer>
      </section>
    `;

    const close = () => closeItilImportModal();
    $('.gs-itil-import-close-x', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-itil-import-close', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-itil-import-input', modal)?.addEventListener('paste', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      const text = event.clipboardData && typeof event.clipboardData.getData === 'function'
        ? event.clipboardData.getData('text/plain')
        : '';
      if (!text) return;
      event.preventDefault();
      target.value = text;
      scheduleItilImportParse(text);
    });
    $('.gs-itil-import-input', modal)?.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      scheduleItilImportParse(target.value);
    });
    $('.gs-itil-import-clear', modal)?.addEventListener('click', () => {
      resetItilImportState({
        insertedRowsCount: Number(itilImportState.insertedRowsCount || 0),
        statusText: 'Вставьте таблицу из буфера обмена.'
      });
      renderItilImportModal();
      const input = $('.gs-itil-import-input', modal);
      if (input instanceof HTMLTextAreaElement) input.focus();
    }, { capture: true });
    $('.gs-itil-import-start', modal)?.addEventListener('click', () => {
      void startItilImport();
    }, { capture: true });
    $('.gs-itil-import-clipboard', modal)?.addEventListener('click', () => {
      void loadItilImportFromClipboard();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openItilImportModal() {
    closeMenu();
    const modal = ensureItilImportModal();
    renderItilImportModal();
    modal.hidden = false;
    requestAnimationFrame(() => {
      const input = $('.gs-itil-import-input', modal);
      if (input instanceof HTMLTextAreaElement) input.focus();
    });
  }

  function scheduleItilImportParse(text) {
    const rawText = String(text || '');
    cancelItilImportParse();
    const runId = ++itilImportParseRunId;

    if (!normalizeItilImportTableText(rawText).replace(/\t/g, '').trim()) {
      itilImportState = {
        ...itilImportState,
        rawText: '',
        headers: [],
        tableRows: [],
        isParsing: false,
        lastError: '',
        statusText: 'Вставьте таблицу из буфера обмена.'
      };
      renderItilImportModal();
      return;
    }

    itilImportState = {
      ...itilImportState,
      rawText,
      headers: [],
      tableRows: [],
      isParsing: true,
      lastError: '',
      statusText: 'Разбираю вставленную таблицу...'
    };
    renderItilImportModal();

    itilImportParseTimer = setTimeout(async () => {
      itilImportParseTimer = 0;
      if (runId !== itilImportParseRunId) return;

      try {
        const parsed = await parseItilImportTableText(rawText);
        if (runId !== itilImportParseRunId) return;
        itilImportState = {
          ...itilImportState,
          rawText,
          headers: parsed.headers,
          tableRows: parsed.tableRows,
          nextRowOffset: 0,
          insertedRowsCount: 0,
          isParsing: false,
          lastError: '',
          statusText: `Готово к вставке: ${Math.max(0, parsed.tableRows.length - 1)} строк данных.`
        };
      } catch (error) {
        if (runId !== itilImportParseRunId) return;
        itilImportState = {
          ...itilImportState,
          rawText,
          headers: [],
          tableRows: [],
          isParsing: false,
          statusText: '',
          lastError: error && error.message ? error.message : 'Не удалось разобрать вставленную таблицу.'
        };
      }

      renderItilImportModal();
    }, 30);
  }

  async function itilClipboardHtmlToText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return '';
    const lines = [];
    let count = 0;
    for (const row of table.rows) {
      const cells = Array.from(row.cells);
      if (cells.some((cell) => cell.colSpan > 1 || cell.rowSpan > 1)) {
        throw new Error('В HTML-таблице из буфера есть объединённые ячейки. Нужна обычная таблица из 22 столбцов.');
      }
      lines.push(cells.map((cell) => String(cell.textContent || '').replace(/[\t\r\n]+/g, ' ').trim()).join('\t'));
      count += 1;
      if (count % ITIL_IMPORT_BATCH_ROWS === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return lines.join('\n');
  }

  function readItilClipboardByPaste(diagnostics) {
    const modal = document.getElementById(ITIL_IMPORT_MODAL_ID);
    if (!modal) return '';
    const previousFocus = document.activeElement;
    const input = document.createElement('textarea');
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    let pastedText = '';
    input.addEventListener('paste', (event) => {
      const data = event.clipboardData;
      if (data) {
        diagnostics.push(`paste: ${Array.from(data.types || []).join(', ') || 'нет форматов'}`);
        pastedText = data.getData('text/plain');
      }
      // Do not put the entire export into the DOM when the event exposes text.
      if (pastedText) event.preventDefault();
      event.stopPropagation();
    });
    modal.appendChild(input);
    try {
      input.focus({ preventScroll: true });
      const accepted = document.execCommand('paste');
      const text = pastedText || input.value;
      diagnostics.push(`paste: ${accepted ? 'выполнено' : 'не поддержано'}, ${text.length} символов`);
      return text;
    } catch (error) {
      diagnostics.push(`paste: ${error.name || 'ошибка'}`);
      return '';
    } finally {
      input.value = '';
      input.remove();
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
    }
  }

  async function readItilClipboardTable() {
    const diagnostics = [];
    const clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.readText === 'function') {
      try {
        const text = await clipboard.readText();
        diagnostics.push(`readText: ${text.length} символов`);
        if (text.trim()) return text;
      } catch (error) {
        diagnostics.push(`readText: ${error.name || 'ошибка'}`);
      }
    }
    if (clipboard && typeof clipboard.read === 'function') {
      try {
        const items = await clipboard.read();
        diagnostics.push(`read: ${items.length} объектов`);
        for (const item of items) {
          diagnostics.push(`форматы: ${item.types.join(', ') || 'нет'}`);
          for (const type of item.types.filter((type) => type === 'text/plain' || type === 'text/tab-separated-values')) {
            const text = await (await item.getType(type)).text();
            if (text.trim()) return text;
          }
          if (item.types.includes('text/html')) {
            const html = await (await item.getType('text/html')).text();
            const text = await itilClipboardHtmlToText(html);
            if (text.trim()) return text;
          }
        }
      } catch (error) {
        diagnostics.push(`read: ${error.message || error.name || 'ошибка'}`);
      }
    }
    const text = readItilClipboardByPaste(diagnostics);
    if (text.trim()) return text;
    throw new Error(`Браузер не смог прочитать таблицу из системного буфера. Это не означает, что буфер пуст. Диагностика: ${diagnostics.join('; ') || 'методы чтения недоступны'}.`);
  }

  async function loadItilImportFromClipboard() {
    if (itilImportState.isParsing || itilImportState.isImporting) return;
    resetItilImportState({ isParsing: true, statusText: 'Читаю буфер обмена...' });
    renderItilImportModal();
    try {
      // Read inside the click gesture, before any other asynchronous operation.
      const text = await readItilClipboardTable();
      itilImportState.statusText = 'Проверяю таблицу из буфера...';
      renderItilImportModal();
      const parsed = await parseItilImportTableText(text);
      if (parsed.tableRows.length < 2) throw new Error('В буфере нет строк таблицы для загрузки.');
      itilImportState = { ...itilImportState, ...parsed, rawText: '', isParsing: false };
      renderItilImportModal();
      await startItilImport();
    } catch (error) {
      itilImportState.isParsing = false;
      itilImportState.lastError = error && error.name === 'NotAllowedError'
        ? 'Edge запретил чтение буфера. Оставьте вкладку активной и попробуйте ещё раз; разрешите чтение, если браузер запросит его.'
        : (error && error.message ? error.message : 'Не удалось прочитать таблицу из буфера.');
      renderItilImportModal();
    }
  }

  function getItilImportBatch(tableRows, offset) {
    const encoder = new TextEncoder();
    const rows = [];
    let bytes = 4096;
    for (let i = offset; i < tableRows.length && rows.length < ITIL_IMPORT_BATCH_ROWS; i++) {
      const rowBytes = encoder.encode(JSON.stringify(tableRows[i])).length + 1;
      if (rowBytes + 4096 > ITIL_IMPORT_BATCH_BYTES) throw new Error(`Строка ${i + 1} слишком большая для отправки.`);
      if (bytes + rowBytes > ITIL_IMPORT_BATCH_BYTES) break;
      rows.push(tableRows[i]);
      bytes += rowBytes;
    }
    return rows;
  }

  async function startItilImport() {
    if (itilImportState.isParsing || itilImportState.isImporting || itilImportState.tableRows.length < 2) return;

    itilImportState.isImporting = true;
    renderItilImportModal();
    try {
      await loadBridgeUrl();
      if (!state.bridgeUrl) {
        throw new Error('URL bridge не задан. Нажми F2, затем «URL bridge».');
      }

      const tableRows = itilImportState.tableRows;

      itilImportState = {
        ...itilImportState,
        isParsing: false,
        isImporting: true,
        currentBatch: 0,
        totalBatches: Math.ceil(tableRows.length / ITIL_IMPORT_BATCH_ROWS),
        statusText: 'Отправляю таблицу в bridge...',
        lastError: ''
      };
      renderItilImportModal();

      while (itilImportState.nextRowOffset < tableRows.length) {
        const offset = itilImportState.nextRowOffset;
        const batchRows = getItilImportBatch(tableRows, offset);
        const response = await sendRuntimeMessage({
          action: SAVE_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            payload: {
              action: 'importItilTableRows',
              spreadsheetId: CONFIG.spreadsheetId,
              sheetName: ITIL_IMPORT_SHEET_NAME,
              startRow: ITIL_IMPORT_START_ROW + offset,
              rows: batchRows
            }
          }
        });

        if (!response || response.success !== true) {
          throw new Error(getRuntimeResponseError(response, 'bridge не вставил таблицу ITIL'));
        }
        const written = getBridgeActionResult(response);
        if (!written || Number(written.writtenRows) !== batchRows.length || Number(written.startRow) !== ITIL_IMPORT_START_ROW + offset) {
          throw new Error('Сервер не подтвердил запись всей порции ITIL.');
        }
        itilImportState.nextRowOffset = offset + batchRows.length;
        itilImportState.insertedRowsCount = Math.max(0, itilImportState.nextRowOffset - 1);
        itilImportState.currentBatch += 1;
        itilImportState.statusText = `Загружено ${itilImportState.insertedRowsCount} из ${tableRows.length - 1} строк. До завершения не запускайте поиск новых заявок.`;
        renderItilImportModal();
      }

      const insertedRowsCount = Math.max(0, tableRows.length - 1);
      resetItilImportState({
        insertedRowsCount,
        statusText: `Таблица ITIL загружена: ${insertedRowsCount} строк данных.`
      });
      renderItilImportModal();
      activateSheetTabByName(ITIL_IMPORT_SHEET_NAME);
    } catch (error) {
      itilImportState = {
        ...itilImportState,
        isImporting: false,
        statusText: '',
        lastError: `${error && error.message ? error.message : 'Не удалось загрузить таблицу ITIL.'} Подтверждено ${itilImportState.insertedRowsCount} строк. Нажмите «${itilImportState.nextRowOffset > 0 ? 'Продолжить загрузку' : 'Загрузить'}», чтобы повторить неподтверждённую порцию. До завершения не запускайте поиск новых заявок.`
      };
      renderItilImportModal();
    }
  }

  function closeWssImportModal() {
    const modal = document.getElementById(WSS_IMPORT_MODAL_ID);
    if (modal instanceof HTMLElement) modal.hidden = true;
  }

  function resetWssImportState(overrides) {
    wssImportState = {
      fileName: '',
      rows: [],
      stats: null,
      preview: null,
      isParsing: false,
      isImporting: false,
      currentBatch: 0,
      totalBatches: 0,
      imported: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        newResponses: 0
      },
      statusText: 'Выберите zip-архив выгрузки WSS.',
      lastError: '',
      ...(overrides || {})
    };
  }

  function resetWssImportReviewState(overrides) {
    wssImportReviewState = {
      queue: [],
      currentIndex: 0,
      totalExpected: 0,
      statusText: 'Новых или обновленных заявок WSS для просмотра нет.',
      errorText: '',
      ...(overrides || {})
    };
  }

  function getWssImportReviewCurrentItem() {
    return wssImportReviewState.queue[wssImportReviewState.currentIndex] || null;
  }

  function canGoBackInWssImportReview() {
    return wssImportReviewState.currentIndex > 0;
  }

  function getWssReviewValue(item, header) {
    const values = item && item.values && typeof item.values === 'object' ? item.values : {};
    return String(values[header] || '').trim();
  }

  function formatWssReviewHistory(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const date = normalizeWssText(entry && entry.date);
        const user = normalizeWssText(entry && entry.user);
        const notified = normalizeWssText(entry && entry.notified);
        const solution = normalizeWssText(entry && entry.solution);
        const comment = normalizeWssText(entry && entry.comment) || 'комментария нет';
        const headerBase = [date, user].filter(Boolean).join(' / ');
        const header = notified
          ? (headerBase ? headerBase + ' → ' + notified : '→ ' + notified)
          : headerBase;
        return [header, solution, comment].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
  }

  function formatWssReviewAttachments(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const title = normalizeWssText(entry && entry.title);
        const text = normalizeWssText(entry && entry.text);
        return [title, text].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
  }

  function buildWssReviewMainText(item) {
    if (!item) return '';

    const title = getWssReviewValue(item, 'Краткое описание задачи');
    const content = getWssReviewValue(item, 'Содержание');
    const comment = getWssReviewValue(item, 'Комментарий');
    return [
      title ? 'Краткое описание задачи:\n' + title : '',
      content ? 'Содержание:\n' + content : '',
      comment ? 'Комментарий:\n' + comment : ''
    ].filter(Boolean).join('\n\n') || 'Основной текст заявки пустой.';
  }

  function buildWssReviewSideText(item) {
    if (!item) return '';

    const history = formatWssReviewHistory(item.historyEntries);
    const attachments = formatWssReviewAttachments(item.attachmentEntries);
    return [
      history ? 'Расширенная история решений:\n' + history : '',
      attachments ? 'Доп. файлы:\n' + attachments : ''
    ].filter(Boolean).join('\n\n') || 'История решений и извлеченные тексты файлов отсутствуют.';
  }

  function buildWssImportReviewItem(sourceRow, changeInfo, type) {
    const values = sourceRow && sourceRow.values && typeof sourceRow.values === 'object'
      ? sourceRow.values
      : {};
    return {
      type,
      row: Number(changeInfo && changeInfo.row || 0),
      wssId: String(changeInfo && changeInfo.wssId || sourceRow && sourceRow.wssId || '').trim(),
      lastParsedAt: String(changeInfo && changeInfo.lastParsedAt || sourceRow && sourceRow.lastParsedAt || '').trim(),
      newResponse: !!(changeInfo && changeInfo.newResponse),
      values,
      historyEntries: Array.isArray(sourceRow && sourceRow.historyEntries) ? sourceRow.historyEntries : [],
      attachmentEntries: Array.isArray(sourceRow && sourceRow.attachmentEntries) ? sourceRow.attachmentEntries : []
    };
  }

  function collectWssImportReviewRows(result, batch) {
    const sourceByWssId = new Map();
    (Array.isArray(batch) ? batch : []).forEach((row) => {
      const wssId = String(row && row.wssId || '').trim();
      if (wssId) sourceByWssId.set(wssId, row);
    });

    const items = [];
    [
      { rows: result && result.createdRows, type: 'created' },
      { rows: result && result.updatedRows, type: 'updated' }
    ].forEach((group) => {
      (Array.isArray(group.rows) ? group.rows : []).forEach((changeInfo) => {
        const wssId = String(changeInfo && changeInfo.wssId || '').trim();
        const sourceRow = sourceByWssId.get(wssId);
        if (!sourceRow) return;
        items.push(buildWssImportReviewItem(sourceRow, changeInfo, group.type));
      });
    });

    if (!items.length) return;

    wssImportReviewState = {
      ...wssImportReviewState,
      queue: wssImportReviewState.queue.concat(items),
      totalExpected: wssImportReviewState.totalExpected + items.length,
      statusText: 'Показываю созданные и обновленные заявки WSS.',
      errorText: ''
    };
  }

  function normalizeWssTimestampForCompare(value) {
    const text = String(value || '').trim();
    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return [
        match[1],
        match[2],
        match[3],
        String(match[4]).padStart(2, '0'),
        match[5],
        match[6] || '00'
      ].join('');
    }

    match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return [
        match[3],
        match[2],
        match[1],
        String(match[4]).padStart(2, '0'),
        match[5],
        match[6] || '00'
      ].join('');
    }

    return text;
  }

  function compareWssParsedAt(left, right) {
    const a = normalizeWssTimestampForCompare(left);
    const b = normalizeWssTimestampForCompare(right);
    if (!a && !b) return 0;
    if (a && !b) return 1;
    if (!a && b) return -1;
    return a > b ? 1 : (a < b ? -1 : 0);
  }

  function getLatestWssHistoryAt(entries) {
    return (Array.isArray(entries) ? entries : []).reduce((latest, entry) => {
      const match = String(entry && entry.date || '').trim().match(
        /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
      );
      if (!match) return latest;
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6] || 0);
      const date = new Date(year, month - 1, day, hour, minute, second);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
      ) {
        return latest;
      }
      const key = [year, month, day, hour, minute, second]
        .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
        .join('');
      return key > latest ? key : latest;
    }, '');
  }

  async function loadWssImportPreview(rows) {
    await loadBridgeUrl();
    if (!state.bridgeUrl) {
      return {
        newCount: 0,
        updateCount: 0,
        skipCount: 0,
        existingCount: 0,
        note: 'URL bridge не задан. Перед импортом задай его через кнопку «URL bridge».'
      };
    }

    const response = await sendRuntimeMessage({
      action: SAVE_ACTION,
      data: {
        bridgeUrl: state.bridgeUrl,
        payload: {
          action: 'getWssImportState',
          spreadsheetId: CONFIG.spreadsheetId,
          sheetName: WSS_SHEET_NAME
        }
      }
    });

    if (!response || response.success !== true) {
      throw new Error(getRuntimeResponseError(response, 'bridge не вернул состояние листа WSS'));
    }

    const result = getBridgeActionResult(response) || {};
    const existingByWssId = new Map();
    (Array.isArray(result.rows) ? result.rows : []).forEach((item) => {
      const wssId = String(item && item.wssId || '').trim();
      if (!wssId) return;
      existingByWssId.set(wssId, {
        row: Number(item.row),
        lastParsedAt: String(item.lastParsedAt || '').trim(),
        latestHistoryAt: String(item.latestHistoryAt || '').trim()
      });
    });

    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    (rows || []).forEach((row) => {
      const existing = existingByWssId.get(String(row && row.wssId || '').trim());
      if (!existing) {
        newCount += 1;
        return;
      }
      const incomingLatestHistoryAt = getLatestWssHistoryAt(row && row.historyEntries);
      if (
        compareWssParsedAt(row.lastParsedAt, existing.lastParsedAt) > 0 ||
        (incomingLatestHistoryAt && incomingLatestHistoryAt > existing.latestHistoryAt)
      ) {
        updateCount += 1;
      } else {
        skipCount += 1;
      }
    });

    return {
      newCount,
      updateCount,
      skipCount,
      existingCount: existingByWssId.size,
      sheetId: Number.isInteger(Number(result.sheetId)) ? Number(result.sheetId) : null,
      note: ''
    };
  }

  function renderWssImportModal() {
    const modal = document.getElementById(WSS_IMPORT_MODAL_ID);
    if (!(modal instanceof HTMLElement)) return;

    const stats = wssImportState.stats || {};
    const preview = wssImportState.preview || {};
    const imported = wssImportState.imported || {};
    const fileName = $('.gs-wss-import-file-name', modal);
    const status = $('.gs-wss-import-status', modal);
    const details = $('.gs-wss-import-details', modal);
    const chooseButton = $('.gs-wss-import-choose', modal);
    const startButton = $('.gs-wss-import-start', modal);
    const progress = $('.gs-wss-import-progress', modal);

    if (fileName instanceof HTMLElement) {
      fileName.textContent = wssImportState.fileName || 'Файл не выбран';
    }

    if (status instanceof HTMLElement) {
      status.textContent = wssImportState.lastError || wssImportState.statusText || '';
      status.classList.toggle('is-error', !!wssImportState.lastError);
    }

    if (progress instanceof HTMLElement) {
      progress.textContent = wssImportState.isImporting
        ? `Пакет ${wssImportState.currentBatch}/${wssImportState.totalBatches}`
        : (wssImportState.rows.length ? `Готово к отправке: ${wssImportState.rows.length}` : 'Ожидание архива');
    }

    if (details instanceof HTMLElement) {
      const errorLines = Array.isArray(stats.errors) && stats.errors.length
        ? '\nОшибки разбора:\n' + stats.errors.map((line) => '• ' + line).join('\n')
        : '';
      details.textContent = [
        `MD-файлов: ${Number(stats.mdCount || 0)}`,
        `Строк в status_index.xlsx: ${Number(stats.statusIndexCount || 0)}`,
        `Готово к импорту: ${Number(stats.readyCount || 0)}`,
        `Записей истории: ${Number(stats.historyEntriesCount || 0)}`,
        `Вложений с текстом: ${Number(stats.attachmentsCount || 0)}`,
        `Длинных блоков под сокращение: ${Number(stats.longFieldsCount || 0)}`,
        `Нет записи в status_index: ${Number(stats.skippedMissingIndex || 0)}`,
        `Есть в индексе, нет md: ${Number(stats.indexMissingMarkdownCount || 0)}`,
        `Новых строк: ${Number(preview.newCount || 0)}`,
        `Будет обновлено: ${Number(preview.updateCount || 0)}`,
        `Будет пропущено как не свежее: ${Number(preview.skipCount || 0)}`,
        `Создано: ${Number(imported.created || 0)}`,
        `Обновлено: ${Number(imported.updated || 0)}`,
        `Новых ответов: ${Number(imported.newResponses || 0)}`,
        `Пропущено: ${Number(imported.skipped || 0)}`,
        `Ошибок записи: ${Number(imported.failed || 0)}`
      ].join('\n') + (preview.note ? '\n\n' + preview.note : '') + errorLines;
    }

    if (chooseButton instanceof HTMLButtonElement) {
      chooseButton.disabled = wssImportState.isParsing || wssImportState.isImporting;
    }

    if (startButton instanceof HTMLButtonElement) {
      startButton.disabled = wssImportState.isParsing
        || wssImportState.isImporting
        || !wssImportState.rows.length;
    }

    renderWssImportStatus();
  }

  function ensureWssImportModal() {
    ensureStyle();

    const existing = document.getElementById(WSS_IMPORT_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = WSS_IMPORT_MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <section class="gs-wss-import-card" role="dialog" aria-modal="true" aria-label="Импорт заявок WSS">
        <header class="gs-wss-import-header">
          <div>
            <div class="gs-wss-import-title">Заявки WSS</div>
            <div class="gs-wss-import-subtitle">Загрузка архива на лист «${WSS_SHEET_NAME}»</div>
          </div>
          <button type="button" class="gs-wss-import-close-x" aria-label="Закрыть">×</button>
        </header>
        <div class="gs-wss-import-file">
          <div class="gs-wss-import-file-name">Файл не выбран</div>
          <input class="gs-wss-import-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden>
          <button type="button" class="gs-wss-import-choose">Выбрать zip</button>
        </div>
        <div class="gs-wss-import-progress" aria-live="polite">Ожидание архива</div>
        <pre class="gs-wss-import-details"></pre>
        <footer class="gs-wss-import-footer">
          <div class="gs-wss-import-status" aria-live="polite"></div>
          <div class="gs-wss-import-buttons">
            <button type="button" class="gs-wss-import-close">Закрыть</button>
            <button type="button" class="gs-wss-import-start" disabled>Импортировать</button>
          </div>
        </footer>
      </section>
    `;

    const close = () => closeWssImportModal();
    $('.gs-wss-import-close-x', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-wss-import-close', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-wss-import-choose', modal)?.addEventListener('click', () => {
      const input = $('.gs-wss-import-input', modal);
      if (input instanceof HTMLInputElement) input.click();
    }, { capture: true });
    $('.gs-wss-import-input', modal)?.addEventListener('change', (event) => {
      const input = event.target;
      const file = input instanceof HTMLInputElement && input.files && input.files.length
        ? input.files[0]
        : null;
      if (input instanceof HTMLInputElement) input.value = '';
      if (file) void handleWssArchiveFile(file);
    });
    $('.gs-wss-import-start', modal)?.addEventListener('click', () => {
      void startWssImport();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openWssImportModal() {
    closeMenu();
    const modal = ensureWssImportModal();
    renderWssImportModal();
    modal.hidden = false;
  }

  async function handleWssArchiveFile(file) {
    const name = String(file && file.name || '').trim();
    if (!/\.zip$/i.test(name)) {
      resetWssImportState({
        fileName: name || '',
        lastError: 'Выберите файл .zip.'
      });
      renderWssImportModal();
      return;
    }

    resetWssImportState({
      fileName: name,
      isParsing: true,
      statusText: 'Разбираю архив...'
    });
    renderWssImportModal();

    try {
      const parsed = await buildWssArchiveRows(file);
      let preview;
      try {
        preview = await loadWssImportPreview(parsed.rows);
      } catch (previewError) {
        preview = {
          newCount: 0,
          updateCount: 0,
          skipCount: 0,
          existingCount: 0,
          note: 'Предпросмотр листа WSS не получен: ' + (previewError && previewError.message ? previewError.message : String(previewError))
        };
      }
      wssImportState = {
        ...wssImportState,
        rows: parsed.rows,
        stats: parsed.stats,
        preview,
        isParsing: false,
        statusText: parsed.stats.errorsCount
          ? `Архив разобран. Есть предупреждения: ${parsed.stats.errorsCount}.`
          : 'Архив разобран. Можно импортировать.',
        lastError: ''
      };
    } catch (error) {
      wssImportState = {
        ...wssImportState,
        rows: [],
        stats: null,
        preview: null,
        isParsing: false,
        statusText: '',
        lastError: error && error.message ? error.message : 'Не удалось разобрать архив WSS.'
      };
    }

    renderWssImportModal();
  }

  function closeWssImportReviewModal() {
    const modal = document.getElementById(WSS_IMPORT_REVIEW_MODAL_ID);
    if (modal instanceof HTMLElement) modal.hidden = true;
  }

  function ensureWssImportReviewModal() {
    ensureStyle();

    const existing = document.getElementById(WSS_IMPORT_REVIEW_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = WSS_IMPORT_REVIEW_MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <section class="gs-wss-review-panel" role="dialog" aria-modal="true" aria-label="Просмотр изменений WSS">
        <header class="gs-wss-review-header">
          <div>
            <div class="gs-wss-review-title">Изменения WSS</div>
            <div class="gs-wss-review-meta"></div>
          </div>
          <button type="button" class="gs-wss-review-close-x" aria-label="Закрыть">×</button>
        </header>
        <div class="gs-wss-review-progress"></div>
        <div class="gs-wss-review-summary"></div>
        <div class="gs-wss-review-grid">
          <div class="gs-wss-review-wrap">
            <div class="gs-wss-review-label">Карточка заявки</div>
            <div class="gs-wss-review-text gs-wss-review-main"></div>
          </div>
          <div class="gs-wss-review-wrap">
            <div class="gs-wss-review-label">История и файлы</div>
            <div class="gs-wss-review-text gs-wss-review-side"></div>
          </div>
        </div>
        <footer class="gs-wss-review-footer">
          <div class="gs-wss-review-message" aria-live="polite"></div>
          <div class="gs-wss-review-buttons">
            <button type="button" class="gs-wss-review-close">Закрыть</button>
            <button type="button" class="gs-wss-review-prev">Назад</button>
            <button type="button" class="gs-wss-review-next">Дальше</button>
          </div>
        </footer>
      </section>
    `;

    const close = () => closeWssImportReviewModal();
    $('.gs-wss-review-close-x', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-wss-review-close', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-wss-review-prev', modal)?.addEventListener('click', () => {
      if (!canGoBackInWssImportReview()) return;
      wssImportReviewState = {
        ...wssImportReviewState,
        currentIndex: Math.max(0, wssImportReviewState.currentIndex - 1)
      };
      renderWssImportReviewModal();
    }, { capture: true });
    $('.gs-wss-review-next', modal)?.addEventListener('click', () => {
      const total = wssImportReviewState.queue.length;
      if (!total) return;
      if (wssImportReviewState.currentIndex >= total - 1) {
        close();
        return;
      }
      wssImportReviewState = {
        ...wssImportReviewState,
        currentIndex: wssImportReviewState.currentIndex + 1
      };
      renderWssImportReviewModal();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function appendWssReviewPill(container, text, className) {
    if (!(container instanceof HTMLElement) || !text) return;
    const pill = document.createElement('span');
    pill.className = 'gs-wss-review-pill' + (className ? ' ' + className : '');
    pill.textContent = text;
    container.appendChild(pill);
  }

  function renderWssImportReviewModal() {
    const modal = document.getElementById(WSS_IMPORT_REVIEW_MODAL_ID);
    if (!(modal instanceof HTMLElement)) return;

    const item = getWssImportReviewCurrentItem();
    const meta = $('.gs-wss-review-meta', modal);
    const progress = $('.gs-wss-review-progress', modal);
    const summary = $('.gs-wss-review-summary', modal);
    const main = $('.gs-wss-review-main', modal);
    const side = $('.gs-wss-review-side', modal);
    const message = $('.gs-wss-review-message', modal);
    const prevButton = $('.gs-wss-review-prev', modal);
    const nextButton = $('.gs-wss-review-next', modal);

    if (meta instanceof HTMLElement) {
      meta.textContent = `Лист: ${WSS_SHEET_NAME} · к просмотру: ${wssImportReviewState.totalExpected}`;
    }
    if (progress instanceof HTMLElement) {
      progress.textContent = item
        ? `Очередь просмотра: ${wssImportReviewState.currentIndex + 1}/${wssImportReviewState.queue.length}`
        : 'Очередь просмотра: 0/0';
    }
    if (summary instanceof HTMLElement) {
      summary.replaceChildren();
      if (item) {
        appendWssReviewPill(summary, item.type === 'created' ? 'Новая заявка' : 'Обновлена', item.type === 'created' ? 'is-created' : 'is-updated');
        appendWssReviewPill(summary, item.newResponse ? 'Пришел новый ответ' : '', item.newResponse ? 'is-created' : '');
        appendWssReviewPill(summary, item.wssId ? 'WSS ID ' + item.wssId : '');
        appendWssReviewPill(summary, getWssReviewValue(item, 'Рег. номер'));
        appendWssReviewPill(summary, getWssReviewValue(item, 'Статус'));
        appendWssReviewPill(summary, getWssReviewValue(item, 'Этап'));
        appendWssReviewPill(summary, item.row ? 'строка ' + item.row : '');
        appendWssReviewPill(summary, item.lastParsedAt ? 'parsed ' + item.lastParsedAt : '');
      }
    }
    if (main instanceof HTMLElement) {
      main.textContent = item ? buildWssReviewMainText(item) : 'Созданных или обновленных WSS-заявок для просмотра нет.';
    }
    if (side instanceof HTMLElement) {
      side.textContent = item ? buildWssReviewSideText(item) : '';
    }
    if (message instanceof HTMLElement) {
      message.textContent = wssImportReviewState.errorText || wssImportReviewState.statusText || '';
      message.classList.toggle('is-error', !!wssImportReviewState.errorText);
    }
    if (prevButton instanceof HTMLButtonElement) {
      prevButton.disabled = !item || !canGoBackInWssImportReview();
    }
    if (nextButton instanceof HTMLButtonElement) {
      nextButton.disabled = !item;
      nextButton.textContent = item && wssImportReviewState.currentIndex >= wssImportReviewState.queue.length - 1
        ? 'Закрыть'
        : 'Дальше';
    }
  }

  function openWssImportReviewModal() {
    const modal = ensureWssImportReviewModal();
    renderWssImportReviewModal();
    modal.hidden = false;
  }

  function mergeWssImportResult(result, batch) {
    const imported = wssImportState.imported || {};
    wssImportState.imported = {
      created: Number(imported.created || 0) + Number(result && result.created || 0),
      updated: Number(imported.updated || 0) + Number(result && result.updated || 0),
      skipped: Number(imported.skipped || 0) + Number(result && result.skipped || 0),
      failed: Number(imported.failed || 0) + Number(result && result.failed || 0),
      newResponses: Number(imported.newResponses || 0) + Number(result && result.newResponses || 0)
    };
    collectWssImportReviewRows(result, batch);
  }

  async function startWssImport() {
    if (wssImportState.isParsing || wssImportState.isImporting || !wssImportState.rows.length) return;

    await loadBridgeUrl();
    if (!state.bridgeUrl) {
      wssImportState = {
        ...wssImportState,
        lastError: 'URL bridge не задан. Нажми F2, затем «URL bridge».'
      };
      renderWssImportModal();
      return;
    }

    const totalBatches = Math.ceil(wssImportState.rows.length / WSS_IMPORT_BATCH_SIZE);
    resetWssImportReviewState({
      statusText: 'Жду завершения импорта WSS...'
    });
    wssImportState = {
      ...wssImportState,
      isImporting: true,
      currentBatch: 0,
      totalBatches,
      imported: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        newResponses: 0
      },
      statusText: 'Отправляю заявки в bridge...',
      lastError: ''
    };
    renderWssImportModal();

    try {
      for (let index = 0; index < totalBatches; index++) {
        const batch = wssImportState.rows.slice(index * WSS_IMPORT_BATCH_SIZE, (index + 1) * WSS_IMPORT_BATCH_SIZE);
        wssImportState = {
          ...wssImportState,
          currentBatch: index + 1,
          statusText: `Отправляю пакет ${index + 1}/${totalBatches}...`
        };
        renderWssImportModal();

        const response = await sendRuntimeMessage({
          action: SAVE_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            payload: {
              action: 'importWssArchiveRows',
              spreadsheetId: CONFIG.spreadsheetId,
              sheetName: WSS_SHEET_NAME,
              rows: batch,
              textLimit: WSS_IMPORT_TEXT_LIMIT
            }
          }
        });

        if (!response || response.success !== true) {
          throw new Error(getRuntimeResponseError(response, 'bridge не импортировал пакет WSS'));
        }

        mergeWssImportResult(getBridgeActionResult(response) || {}, batch);
      }

      const imported = wssImportState.imported || {};
      wssImportState = {
        ...wssImportState,
        isImporting: false,
        statusText: `Импорт завершен. Создано: ${Number(imported.created || 0)}, обновлено: ${Number(imported.updated || 0)}, новых ответов: ${Number(imported.newResponses || 0)}, пропущено: ${Number(imported.skipped || 0)}.`,
        lastError: ''
      };
      activateSheetTabByName(WSS_SHEET_NAME);
      if (wssImportReviewState.queue.length) {
        closeWssImportModal();
        openWssImportReviewModal();
      }
    } catch (error) {
      wssImportState = {
        ...wssImportState,
        isImporting: false,
        statusText: '',
        lastError: error && error.message ? error.message : 'Не удалось импортировать архив WSS.'
      };
    }

    renderWssImportModal();
  }

  async function startChatGptSearch() {
    if (chatGptSearchState.isRunning) return;

    const mode = normalizeChatGptMode(chatGptSearchState.mode);
    const modeConfig = getChatGptModeConfig(mode);
    const modal = ensureChatGptSearchModal();
    const queryInput = $('.gs-chatgpt-search-input', modal);
    const query = queryInput instanceof HTMLTextAreaElement
      ? String(queryInput.value || '').trim()
      : String(getChatGptModeDraft(mode) || '').trim();

    if (!query) {
      setChatGptModeDraft(mode, '');
      setChatGptSearchStatus(modeConfig.emptyQueryError, true);
      if (queryInput instanceof HTMLTextAreaElement) queryInput.focus();
      return;
    }

    setChatGptModeDraft(mode, query);

    chatGptSearchState = {
      ...chatGptSearchState,
      mode,
      isRunning: true,
      statusText: modeConfig.collectStatus,
      lastError: '',
      compactRowsCount: 0,
      foundCount: 0,
      chatTabId: null,
      sentPrompt: modeConfig.promptBuilder(query),
      resultSheetId: null
    };
    renderChatGptSearchModal();

    try {
      const csv = await loadChatGptSearchCsv(modeConfig);
      chatGptSearchState.compactRowsCount = csv.rowsCount;
      chatGptSearchState.statusText = modeConfig.openingStatus;
      renderChatGptSearchModal();

      if (modeConfig.openInChat) {
        const response = await sendRuntimeMessage({
          action: CHATGPT_QUESTION_ACTION,
          data: {
            payload: {
              fileName: modeConfig.fileName,
              csvText: csv.csvText,
              promptText: chatGptSearchState.sentPrompt
            }
          }
        });

        if (!response || response.success === false) {
          throw new Error(response && response.error ? response.error : modeConfig.errorFallback);
        }

        const result = response.result && typeof response.result === 'object' ? response.result : {};
        chatGptSearchState = {
          ...chatGptSearchState,
          chatTabId: Number.isInteger(result.tabId) ? result.tabId : null,
          statusText: modeConfig.successStatus,
          lastError: '',
          foundCount: 0,
          resultSheetId: null
        };
        updateLauncherStatus(modeConfig.launcherSuccessStatus || modeConfig.successStatus, false);
        closeChatGptSearchModal();
        return;
      }

      await loadBridgeUrl();
      if (!state.bridgeUrl) {
        throw new Error('URL bridge не задан. Нажми F2, затем «URL bridge».');
      }

      const response = await sendRuntimeMessage({
        action: CHATGPT_SEARCH_ACTION,
        data: {
          payload: {
            fileName: modeConfig.fileName,
            csvText: csv.csvText,
            promptText: chatGptSearchState.sentPrompt
          }
        }
      });

      if (!response || response.success === false) {
        throw new Error(response && response.error ? response.error : 'Не удалось выполнить поиск через ChatGPT.');
      }

      const result = response.result && typeof response.result === 'object' ? response.result : {};
      chatGptSearchState.statusText = 'Ответ ChatGPT получен. Обрабатываю найденные строки...';
      renderChatGptSearchModal();
      const matches = parseChatGptSearchMatches(result.answerText);
      const resultTable = buildChatGptSearchResultTable(csv, matches);

      chatGptSearchState.statusText = `Отправляю результат через bridge на лист «${CHATGPT_RESULT_SHEET_NAME}»...`;
      renderChatGptSearchModal();
      const bridgeResponse = await sendRuntimeMessage({
        action: SAVE_ACTION,
        data: {
          bridgeUrl: state.bridgeUrl,
          payload: {
            action: 'saveAiSearchResults',
            spreadsheetId: CONFIG.spreadsheetId,
            sheetName: CHATGPT_RESULT_SHEET_NAME,
            headers: resultTable.headers,
            rows: resultTable.rows
          }
        }
      });

      let bridgeResult = null;
      if (!bridgeResponse || bridgeResponse.success !== true) {
        chatGptSearchState.statusText = `Bridge не вернул подтверждение. Проверяю лист «${CHATGPT_RESULT_SHEET_NAME}»...`;
        renderChatGptSearchModal();

        const writeVerified = await verifyChatGptResultSheetWrite(resultTable);
        if (!writeVerified) {
          throw new Error(getRuntimeResponseError(bridgeResponse, 'bridge не записал результаты поиска'));
        }
      } else {
        bridgeResult = getBridgeActionResult(bridgeResponse);
      }

      chatGptSearchState = {
        ...chatGptSearchState,
        foundCount: resultTable.rows.length,
        chatTabId: null,
        statusText: resultTable.rows.length
          ? `Найдено заявок: ${resultTable.rows.length}. Результат записан на лист «${CHATGPT_RESULT_SHEET_NAME}».`
          : `Подходящие заявки не найдены. Лист «${CHATGPT_RESULT_SHEET_NAME}» очищен.`,
        lastError: '',
        resultSheetId: Number.isInteger(bridgeResult && bridgeResult.sheetId) ? bridgeResult.sheetId : null
      };

      if (Number.isInteger(chatGptSearchState.resultSheetId)) {
        location.hash = `gid=${chatGptSearchState.resultSheetId}`;
      } else {
        activateSheetTabByName(CHATGPT_RESULT_SHEET_NAME);
      }

    } catch (error) {
      chatGptSearchState = {
        ...chatGptSearchState,
        statusText: '',
        lastError: error && error.message ? error.message : modeConfig.errorFallback
      };
    } finally {
      chatGptSearchState.isRunning = false;
      renderChatGptSearchModal();
    }
  }

  async function openChatGptSearchTab() {
    if (!Number.isInteger(chatGptSearchState.chatTabId)) return;

    const response = await sendRuntimeMessage({
      action: CHATGPT_OPEN_TAB_ACTION,
      data: {
        tabId: chatGptSearchState.chatTabId
      }
    });

    if (!response || response.success === false) {
      setChatGptSearchStatus(response && response.error ? response.error : 'Не удалось открыть вкладку ChatGPT.', true);
    }
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
            <div class="gs-modal-header-actions">
              <button type="button" class="gs-favorite-toggle gs-problem-picker-favorite" aria-label="Добавить заявку в избранное" aria-pressed="false" title="Добавить в избранное">☆</button>
              <button type="button" class="gs-problem-picker-close-x" aria-label="Закрыть">×</button>
            </div>
          </header>
          <div class="gs-problem-picker-progress"></div>
          <div class="gs-request-summary"></div>
          <div class="gs-problem-picker-text-grid">
            <div class="gs-problem-picker-text-wrap">
              <div class="gs-problem-picker-label gs-problem-picker-text-label"></div>
              <div class="gs-problem-picker-text"></div>
            </div>
            <div class="gs-problem-picker-text-wrap">
              <div class="gs-problem-picker-label gs-problem-picker-info-label"></div>
              <div class="gs-problem-picker-text gs-problem-picker-info"></div>
            </div>
          </div>
          <footer class="gs-problem-picker-footer">
            <div class="gs-problem-picker-message" aria-live="polite"></div>
            <div class="gs-problem-picker-buttons">
              <button type="button" class="gs-problem-picker-back">Назад</button>
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
      resetClassificationView();
      modal.hidden = true;
    };

    $('.gs-problem-picker-back', modal)?.addEventListener('click', goToPreviousClassificationItem, { capture: true });
    $('.gs-problem-picker-favorite', modal)?.addEventListener('click', () => {
      void toggleCurrentClassificationFavorite();
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

  function renderCategoryRecommendation(buttons, item) {
    const prediction = item?.text ? globalThis.predictItilCategory?.(item.text, item.info) : null;
    const list = buttons[0]?.parentElement;
    if (!list) return;

    const previous = buttons.find((button) => button.dataset.predictionLevel);
    const next = buttons.find((button) => button.dataset.value === prediction?.category);
    if (previous === next && previous?.dataset.predictionLevel === prediction?.level) return;
    list.classList.toggle('has-prediction', !!next);

    if (previous) {
      if (previous.dataset.predictionLevel === 'high') {
        const followingOption = OPTIONS[OPTIONS.indexOf(previous.dataset.value) + 1];
        const following = buttons.find((button) => button.dataset.value === followingOption) || null;
        if (previous.nextElementSibling !== following) list.insertBefore(previous, following);
      }
      delete previous.dataset.predictionLevel;
      previous.removeAttribute('aria-description');
    }
    if (next) {
      const descriptions = {
        high: 'Уверенная рекомендация',
        medium: 'Возможная категория, требуется проверка',
        low: 'Предположение с низкой уверенностью'
      };
      next.dataset.predictionLevel = prediction.level;
      next.setAttribute('aria-description', descriptions[prediction.level]);
      if (prediction.level === 'high' && list.firstElementChild !== next) {
        list.insertBefore(next, list.firstElementChild);
      }
    }
  }

  function focusDefaultCategoryButton(modal, item) {
    const buttons = getCategoryButtons(modal);
    const selectedValue = item ? getSavedSelectionForRow(item.row) : '';
    const button = buttons.find((entry) => entry.dataset.value === selectedValue && !entry.disabled)
      || buttons.find((entry) => entry.dataset.value === DEFAULT_VALUE && !entry.disabled)
      || buttons.find((entry) => !entry.disabled);
    if (button instanceof HTMLButtonElement) button.focus();
  }

  function renderModal() {
    const modal = ensureModal();
    const item = getCurrentItem();
    const pendingItem = getCurrentPendingClassificationItem();
    const meta = $('.gs-problem-picker-meta', modal);
    const progress = $('.gs-problem-picker-progress', modal);
    const summary = $('.gs-request-summary', modal);
    const textLabel = $('.gs-problem-picker-text-label', modal);
    const text = $('.gs-problem-picker-text', modal);
    const infoLabel = $('.gs-problem-picker-info-label', modal);
    const info = $('.gs-problem-picker-info', modal);
    const backButton = $('.gs-problem-picker-back', modal);
    const categoryButtons = getCategoryButtons(modal);
    renderCategoryRecommendation(categoryButtons, item);

    renderFavoriteControl(modal, item, '.gs-problem-picker-favorite', '.gs-problem-picker-layout');

    const pending = state.pendingSaveCount ? ` · в фоне: ${state.pendingSaveCount}` : '';
    const failed = state.failedSaveCount ? ` · ошибок: ${state.failedSaveCount}` : '';

    if (meta instanceof HTMLElement) {
      meta.textContent = `Лист: ${state.sheetName || 'не выбран'} · строк в экспорте: ${Math.max(0, state.rowsCount - 1)}`;
    }

    if (!item) {
      if (progress instanceof HTMLElement) progress.textContent = `Отправлено: ${state.sentCount}/${state.queue.length}${pending}${failed}`;
      renderRequestSummary(summary, null);
      if (textLabel instanceof HTMLElement) textLabel.textContent = 'Неклассифицированных заявок нет';
      if (text instanceof HTMLElement) text.textContent = 'Очередь завершена.';
      if (infoLabel instanceof HTMLElement) infoLabel.textContent = 'Информация из СУПП/ITIL';
      if (info instanceof HTMLElement) info.textContent = '';
      categoryButtons.forEach((button) => {
        button.disabled = true;
        button.title = '';
        button.classList.remove('is-selected');
      });
    } else {
      if (progress instanceof HTMLElement) {
        if (isViewingPastClassificationItem()) {
          const currentQueueText = pendingItem
            ? `текущая: ${state.currentIndex + 1}/${state.queue.length}`
            : 'очередь завершена';
          progress.textContent = `Просмотр: ${state.viewIndex + 1}/${state.queue.length} · ${currentQueueText} · отправлено: ${state.sentCount}${pending}${failed}`;
        } else {
          progress.textContent = `Очередь: ${state.currentIndex + 1}/${state.queue.length} · отправлено: ${state.sentCount}${pending}${failed}`;
        }
      }
      renderRequestSummary(summary, item);
      if (textLabel instanceof HTMLElement) textLabel.textContent = `Текст заявки (строка ${item.row}):`;
      if (text instanceof HTMLElement) text.textContent = item.text || '';
      if (infoLabel instanceof HTMLElement) infoLabel.textContent = 'Информация из СУПП/ITIL:';
      if (info instanceof HTMLElement) renderInfoBlocks(info, buildDefaultInfoBlocks(item.info));
      const selectedValue = getSavedSelectionForRow(item.row);
      categoryButtons.forEach((button) => {
        button.disabled = !state.bridgeUrl;
        button.title = state.bridgeUrl ? '' : 'Нажми F2, затем «URL bridge» и задай Apps Script bridge.';
        button.classList.toggle('is-selected', !!selectedValue && button.dataset.value === selectedValue);
      });
    }

    if (backButton instanceof HTMLButtonElement) {
      backButton.disabled = !canGoBackInClassification();
    }

    if (item && item.favoriteError) {
      setModalMessage(item.favoriteError, true);
    } else if (item && item.favoriteSaving) {
      setModalMessage(item.favorite ? 'Убираю заявку из избранного...' : 'Добавляю заявку в избранное...', false);
    } else if (!state.bridgeUrl) {
      setModalMessage('URL bridge не задан. Нажми F2, затем «URL bridge».', true);
    } else if (state.failedSaveCount) {
      setModalMessage(state.lastBackgroundError || `Есть ошибки фонового сохранения: ${state.failedSaveCount}.`, true);
    } else if (state.pendingSaveCount) {
      setModalMessage(item
        ? `Сохранение идёт в фоне: ${state.pendingSaveCount}. Можно классифицировать дальше.`
        : `Очередь завершена. Дожидаюсь фонового сохранения: ${state.pendingSaveCount}.`, false);
    } else if (item && isViewingPastClassificationItem()) {
      const selectedValue = getSavedSelectionForRow(item.row);
      const selectedPart = selectedValue ? `Ранее выбрано: «${selectedValue}». ` : '';
      const returnPart = pendingItem
        ? `Выбери категорию или закрой окно, чтобы вернуться к строке ${pendingItem.row}.`
        : 'Выбери категорию или закрой окно, чтобы вернуться к завершённой очереди.';
      setModalMessage(`${selectedPart}${returnPart}`, false);
    } else {
      setModalMessage(item ? '' : 'Классификация завершена.', false);
    }
  }

  function closeNewResponseReviewModal() {
    const modal = document.getElementById(NEW_RESPONSE_REVIEW_MODAL_ID);
    if (modal instanceof HTMLElement) modal.hidden = true;
  }

  async function deleteNewResponseReviewItemInBackground(item, eventId) {
    try {
      await loadBridgeUrl();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан.');
      const response = await sendRuntimeMessage({
        action: SAVE_ACTION,
        data: {
          bridgeUrl: state.bridgeUrl,
          payload: {
            action: 'deleteNewResponseInboxItem',
            spreadsheetId: CONFIG.spreadsheetId,
            eventId
          }
        }
      });
      if (!response || response.success !== true) {
        throw new Error(getRuntimeResponseError(response, 'bridge не удалил прочитанную карточку'));
      }

      newResponseInboxState = {
        ...newResponseInboxState,
        unreadCount: Math.max(newResponseReviewState.queue.length, newResponseInboxState.unreadCount),
        lastError: ''
      };
      newResponseReviewState = {
        ...newResponseReviewState,
        pendingAcknowledgeCount: Math.max(0, newResponseReviewState.pendingAcknowledgeCount - 1),
        statusText: newResponseReviewState.queue.length
          ? 'Прочитанная карточка удалена в фоне.'
          : (newResponseReviewState.isProcessing ? 'Жду следующие новые ответы...' : 'Непрочитанных новых ответов нет.')
      };
    } catch (error) {
      const dismissedEventIds = { ...(newResponseReviewState.dismissedEventIds || {}) };
      delete dismissedEventIds[eventId];
      const alreadyQueued = newResponseReviewState.queue.some((entry) => String(entry && entry.eventId || '') === eventId);
      const queue = alreadyQueued ? newResponseReviewState.queue : [...newResponseReviewState.queue, item];
      newResponseInboxState = {
        ...newResponseInboxState,
        unreadCount: Math.max(newResponseInboxState.unreadCount + 1, queue.length),
        lastError: error && error.message ? error.message : 'Не удалось удалить прочитанную карточку.'
      };
      newResponseReviewState = {
        ...newResponseReviewState,
        queue,
        currentIndex: queue.length ? Math.min(newResponseReviewState.currentIndex, queue.length - 1) : 0,
        pendingAcknowledgeCount: Math.max(0, newResponseReviewState.pendingAcknowledgeCount - 1),
        failedAcknowledgeCount: newResponseReviewState.failedAcknowledgeCount + 1,
        dismissedEventIds,
        errorText: `${error && error.message ? error.message : 'Не удалось удалить прочитанную карточку.'} Карточка возвращена в очередь.`
      };
    }

    renderNewResponseReviewModal();
    renderNewResponseStatus();
    if (!newResponseReviewState.queue.length && !newResponseReviewState.isProcessing) {
      closeNewResponseReviewModal();
    }
  }

  function acknowledgeCurrentNewResponseReviewItem() {
    const item = getNewResponseReviewCurrentItem();
    if (!item) return;

    const eventId = String(item.eventId || '').trim();
    if (!eventId) {
      newResponseReviewState = {
        ...newResponseReviewState,
        errorText: 'У карточки нет постоянного идентификатора. Обновите Apps Script bridge и повторите поиск.'
      };
      renderNewResponseReviewModal();
      return;
    }

    const queue = newResponseReviewState.queue.filter((entry) => String(entry && entry.eventId || '') !== eventId);
    const dismissedEventIds = {
      ...(newResponseReviewState.dismissedEventIds || {}),
      [eventId]: true
    };
    newResponseInboxState = {
      ...newResponseInboxState,
      unreadCount: Math.max(0, newResponseInboxState.unreadCount - 1)
    };
    newResponseReviewState = {
      ...newResponseReviewState,
      queue,
      currentIndex: queue.length ? Math.min(newResponseReviewState.currentIndex, queue.length - 1) : 0,
      pendingAcknowledgeCount: newResponseReviewState.pendingAcknowledgeCount + 1,
      dismissedEventIds,
      errorText: '',
      statusText: queue.length
        ? 'Показываю следующий ответ. Прочитанная карточка удаляется в фоне.'
        : (newResponseReviewState.isProcessing ? 'Прочитано. Жду следующие новые ответы...' : 'Прочитано. Карточка удаляется в фоне.')
    };
    renderNewResponseReviewModal();
    renderNewResponseStatus();
    if (!queue.length && !newResponseReviewState.isProcessing) closeNewResponseReviewModal();

    void deleteNewResponseReviewItemInBackground(item, eventId);
  }

  function ensureNewResponseReviewModal() {
    ensureStyle();

    const existing = document.getElementById(NEW_RESPONSE_REVIEW_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = NEW_RESPONSE_REVIEW_MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <div class="gs-new-response-review-layout" role="dialog" aria-modal="true" aria-label="Просмотр новых ответов">
        <section class="gs-new-response-review-panel">
          <header class="gs-new-response-review-header">
            <div>
              <div class="gs-new-response-review-title">Новые ответы</div>
              <div class="gs-new-response-review-meta"></div>
            </div>
            <div class="gs-modal-header-actions">
              <button type="button" class="gs-favorite-toggle gs-new-response-review-favorite" aria-label="Добавить заявку в избранное" aria-pressed="false" title="Добавить в избранное">☆</button>
              <button type="button" class="gs-new-response-review-close-x" aria-label="Закрыть">×</button>
            </div>
          </header>
          <div class="gs-new-response-review-progress"></div>
          <div class="gs-request-summary"></div>
          <div class="gs-problem-picker-text-grid">
            <div class="gs-problem-picker-text-wrap">
              <div class="gs-problem-picker-label gs-new-response-review-text-label">Текст заявки:</div>
              <div class="gs-problem-picker-text gs-new-response-review-text"></div>
            </div>
            <div class="gs-problem-picker-text-wrap">
              <div class="gs-problem-picker-label gs-new-response-review-info-label">Информация из СУПП/ITIL:</div>
              <div class="gs-problem-picker-text gs-problem-picker-info gs-new-response-review-info"></div>
            </div>
          </div>
          <footer class="gs-new-response-review-footer">
            <div class="gs-new-response-review-message" aria-live="polite"></div>
            <div class="gs-new-response-review-buttons">
              <button type="button" class="gs-new-response-review-close">Закрыть</button>
              <button type="button" class="gs-new-response-review-next">Прочитано и дальше</button>
            </div>
          </footer>
        </section>
      </div>
    `;

    const close = () => {
      closeNewResponseReviewModal();
    };

    $('.gs-new-response-review-close-x', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-new-response-review-close', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-new-response-review-favorite', modal)?.addEventListener('click', () => {
      void toggleCurrentNewResponseFavorite();
    }, { capture: true });
    $('.gs-new-response-review-next', modal)?.addEventListener('click', () => {
      void acknowledgeCurrentNewResponseReviewItem();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function renderNewResponseReviewModal() {
    const modal = document.getElementById(NEW_RESPONSE_REVIEW_MODAL_ID);
    if (!(modal instanceof HTMLElement)) return;

    const item = getNewResponseReviewCurrentItem();
    const meta = $('.gs-new-response-review-meta', modal);
    const progress = $('.gs-new-response-review-progress', modal);
    const summary = $('.gs-request-summary', modal);
    const text = $('.gs-new-response-review-text', modal);
    const info = $('.gs-new-response-review-info', modal);
    const message = $('.gs-new-response-review-message', modal);
    const nextButton = $('.gs-new-response-review-next', modal);

    renderFavoriteControl(modal, item, '.gs-new-response-review-favorite', '.gs-new-response-review-layout');

    if (meta instanceof HTMLElement) {
      meta.textContent = `Лист: ${item && item.sourceSheetName ? item.sourceSheetName : (newResponseReviewState.sourceSheetName || newResponseState.sheetName || 'не выбран')} · непрочитано: ${newResponseReviewState.queue.length}`;
    }

    if (progress instanceof HTMLElement) {
      const pendingAcknowledge = newResponseReviewState.pendingAcknowledgeCount
        ? ` · удаляется в фоне: ${newResponseReviewState.pendingAcknowledgeCount}`
        : '';
      if (newResponseReviewState.isProcessing) {
        const processed = Math.min(
          newResponseReviewState.totalExpected,
          newResponseState.successCount + newResponseState.skippedCount + newResponseState.failedCount
        );
        progress.textContent = `Обработка: ${processed}/${newResponseReviewState.totalExpected} · готово к просмотру: ${newResponseReviewState.queue.length}${pendingAcknowledge}`;
      } else if (item) {
        progress.textContent = `Очередь просмотра: ${newResponseReviewState.currentIndex + 1}/${newResponseReviewState.queue.length}${pendingAcknowledge}`;
      } else {
        progress.textContent = `Очередь просмотра: 0/0${pendingAcknowledge}`;
      }
    }

    renderRequestSummary(summary, item);

    if (text instanceof HTMLElement) {
      text.textContent = item
        ? (item.text || '')
        : (newResponseReviewState.isProcessing ? 'Жду завершения обработки...' : 'Новых сохранённых ответов для просмотра нет.');
    }

    if (info instanceof HTMLElement) {
      if (item) renderInfoBlocks(info, item.infoBlocks);
      else info.textContent = '';
    }

    if (message instanceof HTMLElement) {
      message.textContent = (item && item.favoriteError)
        || (item && item.favoriteSaving
          ? (item.favorite ? 'Убираю заявку из избранного...' : 'Добавляю заявку в избранное...')
          : '')
        || newResponseReviewState.errorText
        || (newResponseReviewState.isProcessing ? (newResponseState.statusText || newResponseReviewState.statusText) : newResponseReviewState.statusText)
        || '';
      message.classList.toggle('is-error', !!(item && item.favoriteError) || !!newResponseReviewState.errorText);
    }

    if (nextButton instanceof HTMLButtonElement) {
      nextButton.disabled = !item;
      nextButton.textContent = item
        && !newResponseReviewState.isProcessing
        && newResponseReviewState.currentIndex >= newResponseReviewState.queue.length - 1
        ? 'Прочитано и закрыть'
        : 'Прочитано и дальше';
    }
  }

  function openNewResponseReviewModal() {
    const modal = ensureNewResponseReviewModal();
    renderNewResponseReviewModal();
    modal.hidden = false;
  }

  function showClassificationModal() {
    closeMenu();
    const modal = ensureModal();
    renderModal();
    modal.hidden = false;
    focusDefaultCategoryButton(modal, getCurrentItem());
  }

  async function openClassificationPicker(options) {
    const settings = options && typeof options === 'object' ? options : {};
    if (settings.useExistingQueue) {
      showClassificationModal();
      void refreshClassificationDetails();
      return;
    }

    if (state.isLoading) return;

    state.isLoading = true;
    updateLauncherStatus('Загружаю очередь...', false);

    try {
      await loadBridgeUrl();
      await loadQueue();
      showClassificationModal();

      updateLauncherStatus(`В очереди строк: ${state.queue.length}.`, false);
    } catch (error) {
      updateLauncherStatus(error && error.message ? error.message : 'Не удалось загрузить очередь.', true);
    } finally {
      state.isLoading = false;
      renderCombinedFlowStatus();
    }
  }

  function refreshVisibleModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal instanceof HTMLElement && !modal.hidden) renderModal();
  }

  async function refreshClassificationDetails() {
    const item = getCurrentItem();
    const { gid, columns } = state;
    if (!item?.itilNumber || !columns?.itil || !columns.text || !columns.info || !gid) return;

    const first = Math.min(columns.itil, columns.text, columns.info);
    const last = Math.max(columns.itil, columns.text, columns.info);
    const range = `R${item.row}C${first}:R${item.row}C${last}`;
    classificationDetailsRefresh?.abort();
    const controller = new AbortController();
    classificationDetailsRefresh = controller;
    try {
      const response = await fetch(getCsvUrl(gid, range), {
        credentials: 'omit', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) return;
      const rows = parseCsv(await response.text());
      if (controller.signal.aborted || state.gid !== gid || getCurrentItem() !== item
        || rows.length !== 1 || rows[0][columns.itil - first]?.trim() !== item.itilNumber) return;
      const text = (rows[0][columns.text - first] || '').trim();
      const info = (rows[0][columns.info - first] || '').trim();
      if (text === item.text && info === item.info) return;
      item.text = text;
      item.info = info;
      refreshVisibleModal();
    } catch {
      // При недоступности экспорта используются уже загруженные данные.
    } finally {
      if (classificationDetailsRefresh === controller) classificationDetailsRefresh = null;
    }
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
    const rowKey = String(item.row || '');
    const alreadySaved = !!getSavedSelectionForRow(item.row);
    const wasViewingPastItem = isViewingPastClassificationItem();
    const nextCurrentIndex = wasViewingPastItem
      ? state.currentIndex
      : Math.min(state.queue.length, state.currentIndex + 1);

    if (!selectedValue) {
      setModalMessage('Выберите проблему.', true);
      return;
    }

    if (!state.bridgeUrl) {
      setModalMessage('URL bridge не задан. Нажми F2, затем «URL bridge».', true);
      return;
    }

    state = {
      ...state,
      sentCount: alreadySaved ? state.sentCount : state.sentCount + 1,
      currentIndex: nextCurrentIndex,
      viewIndex: nextCurrentIndex,
      savedSelections: {
        ...(state.savedSelections || {}),
        [rowKey]: selectedValue
      }
    };

    enqueueBackgroundSave({ ...item }, selectedValue, state.bridgeUrl, state.sheetName);
    renderCombinedFlowStatus();
    renderModal();

    if (!getCurrentPendingClassificationItem()) {
      transitionCombinedFlowToNewResponseReview();
      return;
    }

    focusDefaultCategoryButton(modal, getCurrentItem());
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
        row: targetRow,
        bridgeResult: getBridgeActionResult(response)
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
    const label = `строка ${row}, ${formatSuppRequestLabel(item)}`;
    const tracked = createBridgeSaveTracker(result && result.bridgePayload, row, label);
    suppState = {
      ...suppState,
      pendingBridgeSaves: [...(suppState.pendingBridgeSaves || []), tracked]
    };
  }

  function queueNewResponseBridgeSave(result, item) {
    const row = Number(item && item.row);
    const label = item && item.mode === 'supp'
      ? `строка ${row}, ${formatSuppRequestLabel(item)}`
      : `строка ${row}, ITIL ${item && item.itilNumber ? item.itilNumber : ''}`;
    const reviewItem = buildNewResponseReviewItem(item, result);
    const bridgePayload = result && result.bridgePayload && typeof result.bridgePayload === 'object'
      ? {
        ...result.bridgePayload,
        reviewSnapshot: buildNewResponseReviewSnapshot(reviewItem)
      }
      : null;
    const tracked = createBridgeSaveTracker(bridgePayload, row, label)
      .then((saveResult) => {
        const bridgeResult = saveResult && saveResult.bridgeResult && typeof saveResult.bridgeResult === 'object'
          ? saveResult.bridgeResult
          : {};
        const completedResult = {
          ...saveResult,
          reviewItem: {
            ...reviewItem,
            eventId: String(bridgeResult.reviewEventId || '').trim()
          }
        };
        if (completedResult.success === true) publishNewResponseReviewItem(completedResult.reviewItem);
        return completedResult;
      });
    newResponseState = {
      ...newResponseState,
      pendingBridgeSaves: [...(newResponseState.pendingBridgeSaves || []), tracked]
    };
  }

  function publishNewResponseReviewItem(item) {
    const eventId = String(item && item.eventId || '').trim();
    if (!eventId || (newResponseReviewState.dismissedEventIds || {})[eventId]) return;
    if (newResponseReviewState.queue.some((entry) => String(entry && entry.eventId || '') === eventId)) return;

    newResponseReviewState = {
      ...newResponseReviewState,
      queue: [...newResponseReviewState.queue, item],
      statusText: 'Новый ответ готов к просмотру. Проверка остальных строк продолжается.'
    };
    newResponseInboxState = {
      ...newResponseInboxState,
      unreadCount: newResponseInboxState.unreadCount + 1,
      lastError: ''
    };
    renderNewResponseReviewModal();
    renderNewResponseStatus();
  }

  function queueCombinedBridgeSave(result, item) {
    const row = Number(item && item.row);
    const label = item && item.mode === 'supp'
      ? `строка ${row}, ${formatSuppRequestLabel(item)}`
      : `строка ${row}, ITIL ${item && item.itilNumber ? item.itilNumber : ''}`;
    const tracked = createBridgeSaveTracker(result && result.bridgePayload, row, label);
    combinedFlowState = {
      ...combinedFlowState,
      pendingBridgeSaves: [...(combinedFlowState.pendingBridgeSaves || []), tracked]
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

  function buildNewResponseReviewQueue(results) {
    const dismissedEventIds = newResponseReviewState.dismissedEventIds || {};
    return (results || [])
      .filter((item) => item && item.success === true && item.reviewItem)
      .map((item) => item.reviewItem)
      .filter((item) => !dismissedEventIds[String(item && item.eventId || '').trim()]);
  }

  function finishNewResponseReview(results, totalExpected, statusText, errorText) {
    const queue = buildNewResponseReviewQueue(results);
    newResponseInboxState = {
      ...newResponseInboxState,
      unreadCount: Math.max(newResponseInboxState.unreadCount, queue.length)
    };
    const currentEventId = String(getNewResponseReviewCurrentItem() && getNewResponseReviewCurrentItem().eventId || '');
    const currentIndex = currentEventId
      ? Math.max(0, queue.findIndex((item) => String(item && item.eventId || '') === currentEventId))
      : 0;
    newResponseReviewState = {
      ...newResponseReviewState,
      queue,
      currentIndex,
      totalExpected: Number(totalExpected || 0),
      isProcessing: false,
      statusText: queue.length
        ? (statusText || 'Показываю только сохранённые изменения.')
        : 'Сохранённых новых ответов для просмотра нет.',
      errorText: String(errorText || ''),
      sourceSheetName: newResponseState.sheetName || ''
    };
    renderNewResponseReviewModal();
    void loadNewResponseInbox({ summaryOnly: false });
  }

  function shouldAutoOpenNewResponseReview() {
    return !!(
      newResponseState.isRunning
      || newResponseState.lastError
      || newResponseInboxState.unreadCount > 0
      || newResponseReviewState.totalExpected > 0
      || newResponseReviewState.queue.length > 0
    );
  }

  function finishCombinedFlow(statusText, lastError) {
    combinedFlowState = {
      ...combinedFlowState,
      isRunning: false,
      stopRequested: false,
      stage: 'idle',
      currentItem: null,
      statusText: String(statusText || ''),
      lastError: String(lastError || '')
    };
    renderCombinedFlowStatus();
  }

  function transitionCombinedFlowToNewResponseReview() {
    if (!isCombinedFlowClassificationStage()) return;

    const modal = document.getElementById(MODAL_ID);
    if (modal instanceof HTMLElement) modal.hidden = true;

    const shouldOpenReview = shouldAutoOpenNewResponseReview();
    if (shouldOpenReview) openNewResponseReviewModal();

    finishCombinedFlow(
      shouldOpenReview
        ? 'Классификация завершена. Переход к новым ответам.'
        : 'Классификация завершена. Новых ответов не найдено.',
      ''
    );
  }

  function stopCombinedFlow() {
    if (!combinedFlowState.isRunning || combinedFlowState.stage !== 'search') return;

    combinedFlowState = {
      ...combinedFlowState,
      stopRequested: true,
      statusText: 'Останавливаю общий поиск после текущей строки...',
      lastError: ''
    };
    renderCombinedFlowStatus();
  }

  async function startCombinedFlow() {
    if (isCombinedFlowClassificationStage()) {
      showClassificationModal();
      return;
    }
    if (combinedFlowState.isRunning || itilState.isRunning || suppState.isRunning || newResponseState.isRunning || state.isLoading) return;

    const runId = combinedFlowRunId + 1;
    combinedFlowRunId = runId;

    combinedFlowState = {
      ...combinedFlowState,
      queue: [],
      currentIndex: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName: '',
      gid: '',
      rowsCount: 0,
      columns: null,
      pendingBridgeSaves: [],
      isRunning: true,
      stopRequested: false,
      stage: 'search',
      statusText: 'Собираю общую очередь новых заявок...',
      lastError: '',
      classificationQueueCount: 0
    };
    renderCombinedFlowStatus();

    try {
      await loadBridgeUrl();
      await loadWaitTimeoutSettings();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан. Нажми «URL bridge» и задай Apps Script bridge.');

      await loadCombinedSearchQueue();
      if (runId !== combinedFlowRunId) return;
      renderCombinedFlowStatus();

      for (let index = 0; index < combinedFlowState.queue.length; index++) {
        if (runId !== combinedFlowRunId) return;
        if (combinedFlowState.stopRequested) break;

        const item = combinedFlowState.queue[index];
        combinedFlowState = {
          ...combinedFlowState,
          currentIndex: index,
          currentItem: item,
          statusText: item.mode === 'supp'
            ? `Ищу ${formatSuppRequestLabel(item)} для строки ${item.row}...`
            : `Ищу ITIL ${item.itilNumber} для строки ${item.row}...`,
          lastError: ''
        };
        renderCombinedFlowStatus();
        focusSheetRow(item.row, combinedFlowState.gid);

        const response = await sendRuntimeMessage({
          action: item.mode === 'supp' ? SUPP_FILL_ACTION : ITIL_FILL_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            waitTimeouts: getEffectiveWaitTimeouts(),
            payload: item.mode === 'supp'
              ? {
                spreadsheetId: CONFIG.spreadsheetId,
                sheetName: combinedFlowState.sheetName,
                row: item.row,
                suppNumber: item.suppNumber,
                suppNumbers: getItemSuppNumbers(item),
                itilNumber: item.itilNumber,
                columns: combinedFlowState.columns
              }
              : {
                spreadsheetId: CONFIG.spreadsheetId,
                sheetName: combinedFlowState.sheetName,
                row: item.row,
                itilNumber: item.itilNumber,
                columns: combinedFlowState.columns
              }
          }
        });

        if (runId !== combinedFlowRunId) return;

        if (!response || response.success !== true) {
          const errorText = response && response.error ? response.error : 'неизвестная ошибка';
          combinedFlowState = {
            ...combinedFlowState,
            currentItem: null,
            statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
            lastError: ''
          };
          renderCombinedFlowStatus();
          const bridgeFinalize = await waitBridgeSaves(combinedFlowState.pendingBridgeSaves);
          if (runId !== combinedFlowRunId) return;
          finishCombinedFlow(
            '',
            [bridgeFinalize.errorText, `Строка ${item.row}: ${errorText}`].filter(Boolean).join(' ')
          );
          return;
        }

        const result = response.result || {};
        if (result.skipped === true) {
          combinedFlowState = {
            ...combinedFlowState,
            currentIndex: index + 1,
            skippedCount: combinedFlowState.skippedCount + 1,
            currentItem: null,
            statusText: `Строка ${item.row} пропущена: ${result.skipMessage || 'не дождался результата поиска.'}`,
            lastError: ''
          };
          renderCombinedFlowStatus();
          continue;
        }

        queueCombinedBridgeSave(result, item);
        const combinedSuppSummaryText = item.mode === 'supp' && Number(result.totalSuppCount || 0) > 1
          ? `. Заявок СУПП: ${Number(result.updatedSuppCount || 0)}/${Number(result.totalSuppCount || 0)}`
            + (Number(result.warningSuppCount || 0) > 0 ? `, предупреждений: ${Number(result.warningSuppCount || 0)}` : '')
          : '';
        combinedFlowState = {
          ...combinedFlowState,
          currentIndex: index + 1,
          successCount: combinedFlowState.successCount + 1,
          currentItem: null,
          statusText: item.mode === 'supp'
            ? `Строка ${item.row} подготовлена. Сохранение в bridge поставлено в очередь. Текст: ${Number(result.requestTextLength || 0)} симв., информация: ${Number(result.infoTextLength || 0)} симв.${combinedSuppSummaryText}`
            : `Строка ${item.row} подготовлена. Сохранение в bridge поставлено в очередь. Текст: ${Number(result.requestTextLength || 0)} симв., информация: ${Number(result.solutionTextLength || 0)} симв.`,
          lastError: ''
        };
        renderCombinedFlowStatus();
      }

      if (runId !== combinedFlowRunId) return;
      const wasStopped = !!combinedFlowState.stopRequested;

      combinedFlowState = {
        ...combinedFlowState,
        currentItem: null,
        statusText: 'Дожидаюсь отправки найденных заявок в bridge...',
        lastError: ''
      };
      renderCombinedFlowStatus();

      const bridgeFinalize = await waitBridgeSaves(combinedFlowState.pendingBridgeSaves);
      if (runId !== combinedFlowRunId) return;

      if (wasStopped) {
        finishCombinedFlow(
          `Общий поиск остановлен. Подготовлено строк: ${combinedFlowState.successCount}/${combinedFlowState.queue.length}. Пропущено: ${combinedFlowState.skippedCount}.`,
          bridgeFinalize.errorText
        );
        return;
      }

      combinedFlowState = {
        ...combinedFlowState,
        currentItem: null,
        stage: 'classification',
        classificationQueueCount: 0,
        statusText: 'Поиск новых заявок завершён. Открываю классификацию и запускаю обработку новых ответов...',
        lastError: bridgeFinalize.errorText || ''
      };
      renderCombinedFlowStatus();

      void startNewResponseRefresh({ openReviewOnStart: false, closeMenuOnStart: false });

      state = {
        ...state,
        queue: [],
        currentIndex: 0,
        sentCount: 0,
        pendingSaveCount: 0,
        failedSaveCount: 0,
        lastBackgroundError: '',
        isLoading: true
      };
      renderCombinedFlowStatus();

      await loadQueue();
      if (runId !== combinedFlowRunId) return;

      combinedFlowState = {
        ...combinedFlowState,
        classificationQueueCount: state.queue.length,
        statusText: state.queue.length
          ? `Поиск завершён. В классификации строк: ${state.queue.length}.`
          : 'Новых заявок для классификации нет. Перехожу к новым ответам.'
      };

      if (state.queue.length) {
        closeMenu();
        showClassificationModal();
        renderCombinedFlowStatus();
        return;
      }

      closeMenu();
      if (shouldAutoOpenNewResponseReview()) openNewResponseReviewModal();
      finishCombinedFlow(
        shouldAutoOpenNewResponseReview()
          ? 'Новых заявок для классификации нет. Открыты новые ответы.'
          : 'Новых заявок для классификации и новых ответов нет.',
        combinedFlowState.lastError
      );
    } catch (error) {
      if (runId !== combinedFlowRunId) return;
      const message = error && error.message ? error.message : 'Не удалось запустить единый сценарий.';
      if (state.isLoading) {
        state = {
          ...state,
          isLoading: false
        };
      }
      let bridgeFinalize = { errorText: '' };
      if (combinedFlowState.pendingBridgeSaves && combinedFlowState.pendingBridgeSaves.length) {
        combinedFlowState = {
          ...combinedFlowState,
          currentItem: null,
          statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
          lastError: ''
        };
        renderCombinedFlowStatus();
        bridgeFinalize = await waitBridgeSaves(combinedFlowState.pendingBridgeSaves);
        if (runId !== combinedFlowRunId) return;
      }
      finishCombinedFlow('', [message, bridgeFinalize.errorText].filter(Boolean).join(' '));
    }
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
    if (itilState.isRunning || suppState.isRunning || newResponseState.isRunning) return;

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
      await loadWaitTimeoutSettings();
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
        focusSheetRow(item.row, itilState.gid);

        const response = await sendRuntimeMessage({
          action: ITIL_FILL_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            waitTimeouts: getEffectiveWaitTimeouts(),
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
          statusText: `Строка ${item.row} подготовлена. Сохранение в bridge поставлено в очередь. Текст: ${textLength} симв., информация: ${solutionLength} симв.`,
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
      skippedCount: 0,
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
    if (suppState.isRunning || itilState.isRunning || newResponseState.isRunning) return;

    const maxRows = Math.max(0, Number(limit || 0));
    const isTestRun = maxRows === 1;
    const runId = suppRunId + 1;
    suppRunId = runId;

    suppState = {
      ...suppState,
      queue: [],
      currentIndex: 0,
      successCount: 0,
      skippedCount: 0,
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
      await loadWaitTimeoutSettings();
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
          statusText: `Ищу ${formatSuppRequestLabel(item)} для строки ${item.row}...`,
          lastError: ''
        };
        renderSuppStatus();
        focusSheetRow(item.row, suppState.gid);

        const response = await sendRuntimeMessage({
          action: SUPP_FILL_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            waitTimeouts: getEffectiveWaitTimeouts(),
            payload: {
              spreadsheetId: CONFIG.spreadsheetId,
              sheetName: suppState.sheetName,
              row: item.row,
              suppNumber: item.suppNumber,
              suppNumbers: getItemSuppNumbers(item),
              itilNumber: item.itilNumber,
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
          const finalError = [bridgeFinalize.errorText, `Строка ${item.row}, ${formatSuppRequestLabel(item)}: ${errorText}`]
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
        if (result.skipped === true) {
          suppState = {
            ...suppState,
            currentIndex: index + 1,
            skippedCount: suppState.skippedCount + 1,
            currentItem: null,
            statusText: `Строка ${item.row} пропущена: ${result.skipMessage || 'не дождался результата поиска СУПП.'}`,
            lastError: ''
          };
          renderSuppStatus();
          continue;
        }

        queueSuppBridgeSave(result, item);
        const textLength = Number(result.requestTextLength || 0);
        const infoLength = Number(result.infoTextLength || 0);
        const requestSourceText = result.requestTextSource === 'ITIL'
          ? `, текст через ITIL ${result.itilNumber || item.itilNumber || ''}`
          : '';
        const suppSummaryText = Number(result.totalSuppCount || 0) > 1
          ? `. Заявок СУПП: ${Number(result.updatedSuppCount || 0)}/${Number(result.totalSuppCount || 0)}`
            + (Number(result.warningSuppCount || 0) > 0 ? `, предупреждений: ${Number(result.warningSuppCount || 0)}` : '')
          : '';
        suppState = {
          ...suppState,
          currentIndex: index + 1,
          successCount: suppState.successCount + 1,
          currentItem: null,
          statusText: `Строка ${item.row} подготовлена${requestSourceText}. Сохранение в bridge поставлено в очередь. Текст: ${textLength} симв., информация: ${infoLength} симв.${suppSummaryText}`,
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
          ? `Остановлено. Подготовлено строк: ${suppState.successCount}/${rowsToProcess}. Пропущено: ${suppState.skippedCount}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`
          : isTestRun
            ? `Тестовый запуск завершён. Подготовлено строк: ${suppState.successCount}/${rowsToProcess}. Пропущено: ${suppState.skippedCount}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`
            : `Готово. Подготовлено строк: ${suppState.successCount}/${suppState.queue.length}. Пропущено: ${suppState.skippedCount}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`,
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

  function stopNewResponseRefresh() {
    if (newResponseState.isRunning) {
      newResponseState = {
        ...newResponseState,
        stopRequested: true,
        statusText: 'Останавливаю после текущей строки...',
        lastError: ''
      };
      renderNewResponseStatus();
      renderItilStatus();
      renderSuppStatus();
      renderNewResponseReviewModal();
      return;
    }

    newResponseRunId += 1;
    newResponseState = {
      queue: [],
      currentIndex: 0,
      successCount: 0,
      skippedCount: 0,
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
    renderNewResponseStatus();
    renderItilStatus();
    renderSuppStatus();
    renderNewResponseReviewModal();
  }

  function getNewResponseInvalidModeError(item) {
    const suppValue = String(item && item.suppValue || '').trim();
    if (!suppValue) {
      return `Строка ${item.row}: «Номер СУПП (последний)» пустой. Ожидался номер СУПП или «–».`;
    }
    return `Строка ${item.row}: не удалось определить ветку по «Номер СУПП (последний)» = ${suppValue}.`;
  }

  async function startNewResponseRefresh(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const openReviewOnStart = settings.openReviewOnStart !== false;
    const closeMenuOnStart = settings.closeMenuOnStart !== false;

    if (newResponseState.isRunning || itilState.isRunning || suppState.isRunning) return;

    const runId = newResponseRunId + 1;
    newResponseRunId = runId;

    newResponseState = {
      ...newResponseState,
      queue: [],
      currentIndex: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      currentItem: null,
      sheetName: '',
      gid: '',
      rowsCount: 0,
      columns: null,
      isRunning: true,
      stopRequested: false,
      pendingBridgeSaves: [],
      statusText: 'Собираю строки для проверки новых ответов...',
      lastError: ''
    };
    newResponseReviewState = createNewResponseReviewState({
      isProcessing: true,
      pendingAcknowledgeCount: newResponseReviewState.pendingAcknowledgeCount,
      failedAcknowledgeCount: newResponseReviewState.failedAcknowledgeCount,
      dismissedEventIds: newResponseReviewState.dismissedEventIds,
      statusText: 'Собираю строки для проверки новых ответов...'
    });
    if (closeMenuOnStart) closeMenu();
    if (openReviewOnStart) openNewResponseReviewModal();
    renderNewResponseStatus();
    renderItilStatus();
    renderSuppStatus();
    if (openReviewOnStart) renderNewResponseReviewModal();

    try {
      await loadBridgeUrl();
      await loadWaitTimeoutSettings();
      if (!state.bridgeUrl) throw new Error('URL bridge не задан. Нажми «URL bridge» и задай Apps Script bridge.');

      await loadNewResponseQueue();
      if (runId !== newResponseRunId) return;

      newResponseReviewState = {
        ...newResponseReviewState,
        totalExpected: newResponseState.queue.length,
        sourceSheetName: newResponseState.sheetName || '',
        statusText: newResponseState.queue.length
          ? 'Обновляю заявки и собираю очередь просмотра.'
          : 'Строк для проверки новых ответов не найдено.'
      };
      renderNewResponseReviewModal();

      if (!newResponseState.queue.length) {
        newResponseState = {
          ...newResponseState,
          isRunning: false,
          stopRequested: false,
          pendingBridgeSaves: [],
          currentItem: null,
          statusText: 'Строк для проверки новых ответов не найдено.',
          lastError: ''
        };
        renderNewResponseStatus();
        renderItilStatus();
        renderSuppStatus();
        newResponseReviewState = {
          ...newResponseReviewState,
          isProcessing: false,
          sourceSheetName: newResponseState.sheetName || newResponseReviewState.sourceSheetName
        };
        await loadNewResponseInbox({ summaryOnly: false });
        if (runId !== newResponseRunId) return;
        if (openReviewOnStart) renderNewResponseReviewModal();
        return;
      }

      newResponseState = {
        ...newResponseState,
        isRunning: true,
        statusText: `В очереди новых ответов строк: ${newResponseState.queue.length}.`,
        lastError: ''
      };
      renderNewResponseStatus();
      if (openReviewOnStart) renderNewResponseReviewModal();

      for (let index = 0; index < newResponseState.queue.length; index++) {
        if (runId !== newResponseRunId) return;
        if (newResponseState.stopRequested) break;

        const item = newResponseState.queue[index];
        if (item.mode === 'invalid') {
          throw new Error(getNewResponseInvalidModeError(item));
        }
        if (item.mode === 'itil' && !item.itilNumber) {
          throw new Error(`Строка ${item.row}: для ветки ITIL не найден «Номер ITIL».`);
        }

        newResponseState = {
          ...newResponseState,
          currentIndex: index,
          currentItem: item,
          statusText: item.mode === 'supp'
            ? `Ищу ${formatSuppRequestLabel(item)} для обновления INFO строки ${item.row}...`
            : `Ищу ITIL ${item.itilNumber} для обновления INFO строки ${item.row}...`,
          lastError: ''
        };
        renderNewResponseStatus();
        if (openReviewOnStart) renderNewResponseReviewModal();
        focusSheetRow(item.row, newResponseState.gid);

        const response = await sendRuntimeMessage({
          action: item.mode === 'supp' ? SUPP_INFO_REFRESH_ACTION : ITIL_INFO_REFRESH_ACTION,
          data: {
            bridgeUrl: state.bridgeUrl,
            waitTimeouts: getEffectiveWaitTimeouts(),
            payload: {
              spreadsheetId: CONFIG.spreadsheetId,
              sheetName: newResponseState.sheetName,
              row: item.row,
              suppNumber: item.suppNumber,
              suppNumbers: getItemSuppNumbers(item),
              itilNumber: item.itilNumber,
              forceEmptyInfoPlaceholder: !!item.forceEmptyInfoPlaceholder,
              currentInfoText: String(item && item.info || ''),
              columns: newResponseState.columns
            }
          }
        });

        if (runId !== newResponseRunId) return;

        if (!response || response.success !== true) {
          const errorText = response && response.error ? response.error : 'неизвестная ошибка';
          newResponseState = {
            ...newResponseState,
            currentItem: null,
            statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
            lastError: ''
          };
          renderNewResponseStatus();
          const bridgeFinalize = await waitBridgeSaves(newResponseState.pendingBridgeSaves);
          if (runId !== newResponseRunId) return;
          const label = item.mode === 'supp'
            ? `Строка ${item.row}, ${formatSuppRequestLabel(item)}`
            : `Строка ${item.row}, ITIL ${item.itilNumber}`;
          const finalError = [bridgeFinalize.errorText, `${label}: ${errorText}`]
            .filter(Boolean)
            .join(' ');
          finishNewResponseReview(
            bridgeFinalize.results,
            newResponseState.queue.length,
            'Процесс остановлен из-за ошибки. Ниже — уже сохранённые изменения.',
            finalError
          );
          newResponseState = {
            ...newResponseState,
            failedCount: newResponseState.failedCount + 1,
            isRunning: false,
            stopRequested: false,
            statusText: '',
            lastError: finalError
          };
          renderNewResponseStatus();
          renderItilStatus();
          renderSuppStatus();
          if (openReviewOnStart) renderNewResponseReviewModal();
          return;
        }

        const result = response.result || {};
        if (result.skipped === true) {
          newResponseState = {
            ...newResponseState,
            currentIndex: index + 1,
            skippedCount: newResponseState.skippedCount + 1,
            currentItem: null,
            statusText: `Строка ${item.row} пропущена: ${result.skipMessage || 'не дождался результата поиска СУПП.'}`,
            lastError: ''
          };
          renderNewResponseStatus();
          if (openReviewOnStart) renderNewResponseReviewModal();
          continue;
        }

        queueNewResponseBridgeSave(result, item);
        const infoLength = Number(result.infoTextLength || result.solutionTextLength || 0);
        const suppSummaryText = item.mode === 'supp' && Number(result.totalSuppCount || 0) > 1
          ? ` Обновлено заявок СУПП: ${Number(result.updatedSuppCount || 0)}/${Number(result.totalSuppCount || 0)}.`
            + (Number(result.warningSuppCount || 0) > 0 ? ` Предупреждений: ${Number(result.warningSuppCount || 0)}.` : '')
          : '';
        newResponseState = {
          ...newResponseState,
          currentIndex: index + 1,
          successCount: newResponseState.successCount + 1,
          currentItem: null,
          statusText: `Строка ${item.row} подготовлена. Сохранение в bridge поставлено в очередь. Информация: ${infoLength} симв.${suppSummaryText}`,
          lastError: ''
        };
        renderNewResponseStatus();
        if (openReviewOnStart) renderNewResponseReviewModal();
      }

      if (runId !== newResponseRunId) return;
      const wasStopped = !!newResponseState.stopRequested;

      newResponseState = {
        ...newResponseState,
        currentItem: null,
        statusText: 'Дожидаюсь отправки в bridge...',
        lastError: ''
      };
      renderNewResponseStatus();

      const bridgeFinalize = await waitBridgeSaves(newResponseState.pendingBridgeSaves);
      if (runId !== newResponseRunId) return;
      finishNewResponseReview(
        bridgeFinalize.results,
        newResponseState.queue.length,
        wasStopped
          ? 'Процесс остановлен. Ниже — сохранённые изменения, которые успели попасть в таблицу.'
          : 'Показываю только сохранённые изменения.',
        bridgeFinalize.errorText
      );

      newResponseState = {
        ...newResponseState,
        isRunning: false,
        stopRequested: false,
        currentItem: null,
        statusText: wasStopped
          ? `Остановлено. Подготовлено строк: ${newResponseState.successCount}/${newResponseState.queue.length}. Пропущено: ${newResponseState.skippedCount}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`
          : `Готово. Подготовлено строк: ${newResponseState.successCount}/${newResponseState.queue.length}. Пропущено: ${newResponseState.skippedCount}. Цвет сброшен: ${bridgeFinalize.resetRowsCount}.`,
        lastError: bridgeFinalize.errorText
      };
      renderNewResponseStatus();
      renderItilStatus();
      renderSuppStatus();
      if (openReviewOnStart) renderNewResponseReviewModal();
    } catch (error) {
      if (runId !== newResponseRunId) return;
      const message = error && error.message ? error.message : 'Не удалось обновить строки с новыми ответами.';
      let bridgeFinalize = { errorText: '' };
      if (newResponseState.pendingBridgeSaves && newResponseState.pendingBridgeSaves.length) {
        newResponseState = {
          ...newResponseState,
          currentItem: null,
          statusText: 'Дожидаюсь уже поставленных отправок в bridge...',
          lastError: ''
        };
        renderNewResponseStatus();
        bridgeFinalize = await waitBridgeSaves(newResponseState.pendingBridgeSaves);
        if (runId !== newResponseRunId) return;
      }
      finishNewResponseReview(
        bridgeFinalize.results,
        newResponseState.queue.length,
        'Процесс завершился с ошибкой. Ниже — уже сохранённые изменения.',
        [message, bridgeFinalize.errorText].filter(Boolean).join(' ')
      );
      newResponseState = {
        ...newResponseState,
        isRunning: false,
        stopRequested: false,
        currentItem: null,
        statusText: '',
        lastError: [message, bridgeFinalize.errorText].filter(Boolean).join(' ')
      };
      renderNewResponseStatus();
      renderItilStatus();
      renderSuppStatus();
      if (openReviewOnStart) renderNewResponseReviewModal();
    }
  }

  function isInsideProblemPickerUi(target) {
    if (!(target instanceof Node)) return false;

    const root = document.getElementById(ROOT_ID);
    const modal = document.getElementById(MODAL_ID);
    const newResponseReviewModal = document.getElementById(NEW_RESPONSE_REVIEW_MODAL_ID);
    const chatGptSearchModal = document.getElementById(CHATGPT_SEARCH_MODAL_ID);
    const itilImportModal = document.getElementById(ITIL_IMPORT_MODAL_ID);
    const wssImportModal = document.getElementById(WSS_IMPORT_MODAL_ID);
    const wssImportReviewModal = document.getElementById(WSS_IMPORT_REVIEW_MODAL_ID);
    const menu = document.getElementById(MENU_ID);
    const menuOverlay = document.getElementById(MENU_OVERLAY_ID);

    return !!(
      (root && root.contains(target))
      || (modal && modal.contains(target))
      || (newResponseReviewModal && newResponseReviewModal.contains(target))
      || (chatGptSearchModal && chatGptSearchModal.contains(target))
      || (itilImportModal && itilImportModal.contains(target))
      || (wssImportModal && wssImportModal.contains(target))
      || (wssImportReviewModal && wssImportReviewModal.contains(target))
      || (menu && menu.contains(target))
      || (menuOverlay && menuOverlay.contains(target))
    );
  }

  async function openPickerIfQueueHasRows(source) {
    const now = Date.now();

    if (autoOpenInProgress || state.isLoading) return;
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal instanceof HTMLElement && !existingModal.hidden) {
      void refreshClassificationDetails();
      return;
    }
    if (now - lastAutoOpenAtMs < AUTO_OPEN_AFTER_EDIT_COOLDOWN_MS) return;

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
    void Promise.all([loadBridgeUrl(), loadWaitTimeoutSettings()]).then(() => refreshNewResponseInboxSummary());
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (!request || request.action !== CHATGPT_PROGRESS_ACTION) return false;
    if (!chatGptSearchState.isRunning) return false;

    const statusText = String(request.data && request.data.statusText || '').trim();
    if (!statusText) return false;

    chatGptSearchState.statusText = statusText;
    chatGptSearchState.lastError = '';
    renderChatGptSearchModal();
    return false;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
