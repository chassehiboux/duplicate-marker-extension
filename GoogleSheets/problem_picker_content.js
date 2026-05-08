(function() {
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
  const SCREENSHOT_MODE_CLASS = 'dup-ext-screenshot-mode';
  const ROOT_ID = 'dup-google-sheets-problem-picker-root';
  const MODAL_ID = 'dup-google-sheets-problem-picker-modal';
  const STYLE_ID = 'dup-google-sheets-problem-picker-style';
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
    savedCount: 0,
    sheetName: '',
    gid: '',
    rowsCount: 0,
    isLoading: false,
    isSaving: false
  };

  function isTargetSpreadsheet() {
    return window.location.hostname === 'docs.google.com'
      && String(window.location.pathname || '').includes(`/spreadsheets/d/${CONFIG.spreadsheetId}/`);
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
          if (runtimeError) {
            resolve({ success: false, error: runtimeError });
            return;
          }
          resolve(response || { success: false, error: 'NO_RESPONSE' });
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
    const activeTab = document.querySelector('.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name')
      || document.querySelector('.docs-sheet-active-tab');
    return activeTab instanceof HTMLElement ? String(activeTab.textContent || '').trim() : '';
  }

  function getActiveGid() {
    const searchGid = new URLSearchParams(window.location.search || '').get('gid');
    if (searchGid) return String(searchGid).trim();
    const hashMatch = String(window.location.hash || '').match(/gid=([^&]+)/);
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
      savedCount: 0,
      sheetName,
      gid,
      rowsCount: rows.length,
      isLoading: false,
      isSaving: false
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
      #${ROOT_ID} {
        position: fixed;
        right: 18px;
        bottom: 58px;
        z-index: 2147483640;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }

      #${ROOT_ID} .gs-problem-picker-actions {
        display: flex;
        gap: 6px;
      }

      #${ROOT_ID} button,
      #${MODAL_ID} button {
        border: 1px solid #b7c2d3;
        border-radius: 7px;
        background: #fff;
        color: #162033;
        cursor: pointer;
        font: 600 13px/1.2 "Segoe UI", Tahoma, sans-serif;
        padding: 8px 12px;
      }

      #${ROOT_ID} .gs-problem-picker-open,
      #${MODAL_ID} .gs-problem-picker-save {
        border-color: #1155cc;
        background: #1155cc;
        color: #fff;
        box-shadow: 0 8px 22px rgba(17, 85, 204, 0.24);
      }

      #${ROOT_ID} .gs-problem-picker-url {
        min-width: 44px;
      }

      #${ROOT_ID} .gs-problem-picker-status {
        max-width: 320px;
        min-height: 18px;
        padding: 5px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.94);
        color: #24513a;
        font-size: 12px;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
      }

      #${ROOT_ID} .gs-problem-picker-status.is-error,
      #${MODAL_ID} .gs-problem-picker-message.is-error {
        color: #b3261e;
      }

      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 24, 39, 0.42);
        font-family: "Segoe UI", Tahoma, sans-serif;
      }

      #${MODAL_ID}[hidden] {
        display: none !important;
      }

      #${MODAL_ID} .gs-problem-picker-panel {
        width: min(980px, calc(100vw - 32px));
        height: min(680px, calc(100vh - 32px));
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr) auto auto;
        gap: 14px;
        box-sizing: border-box;
        padding: 22px;
        border: 1px solid #d6dce8;
        border-radius: 8px;
        background: #fbfcfe;
        color: #172033;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.26);
      }

      #${MODAL_ID} .gs-problem-picker-header,
      #${MODAL_ID} .gs-problem-picker-footer {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
      }

      #${MODAL_ID} .gs-problem-picker-title {
        font-size: 22px;
        line-height: 1.2;
        font-weight: 700;
      }

      #${MODAL_ID} .gs-problem-picker-meta,
      #${MODAL_ID} .gs-problem-picker-message {
        color: #566176;
        font-size: 13px;
      }

      #${MODAL_ID} .gs-problem-picker-close-x {
        width: 34px;
        height: 34px;
        padding: 0;
        font-size: 22px;
        line-height: 1;
      }

      #${MODAL_ID} .gs-problem-picker-progress {
        width: fit-content;
        padding: 5px 10px;
        border-radius: 999px;
        background: #e8f3ee;
        color: #14532d;
        font-size: 13px;
        font-weight: 700;
      }

      #${MODAL_ID} .gs-problem-picker-text-wrap {
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 8px;
      }

      #${MODAL_ID} .gs-problem-picker-label {
        color: #4b5563;
        font-size: 13px;
        font-weight: 700;
      }

      #${MODAL_ID} .gs-problem-picker-text {
        min-height: 0;
        overflow: auto;
        white-space: pre-wrap;
        border: 1px solid #d7dce6;
        border-left: 6px solid #2d6cdf;
        border-radius: 8px;
        background: #fff;
        padding: 14px;
        color: #1f2937;
        font-size: 15px;
        line-height: 1.55;
      }

      #${MODAL_ID} .gs-problem-picker-field {
        display: grid;
        gap: 8px;
      }

      #${MODAL_ID} .gs-problem-picker-select {
        width: 100%;
        min-height: 44px;
        border: 1px solid #9ca8ba;
        border-radius: 6px;
        background: #fff;
        color: #111827;
        padding: 0 10px;
        font-size: 15px;
      }

      #${MODAL_ID} .gs-problem-picker-footer {
        align-items: center;
        border-top: 1px solid #e3e8f0;
        padding-top: 14px;
      }

      #${MODAL_ID} .gs-problem-picker-buttons {
        display: flex;
        flex-shrink: 0;
        gap: 10px;
      }

      html.${SCREENSHOT_MODE_CLASS} #${ROOT_ID},
      html.${SCREENSHOT_MODE_CLASS} #${MODAL_ID} {
        display: none !important;
      }

      @media (max-width: 760px) {
        #${ROOT_ID} {
          right: 10px;
          bottom: 48px;
        }

        #${MODAL_ID} .gs-problem-picker-panel {
          width: 100vw;
          height: 100vh;
          border-radius: 0;
        }

        #${MODAL_ID} .gs-problem-picker-footer {
          align-items: stretch;
          flex-direction: column;
        }

        #${MODAL_ID} .gs-problem-picker-buttons {
          justify-content: flex-end;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function updateLauncherStatus(text, isError) {
    const root = document.getElementById(ROOT_ID);
    const status = root ? root.querySelector('.gs-problem-picker-status') : null;
    if (!(status instanceof HTMLElement)) return;
    status.textContent = String(text || '');
    status.classList.toggle('is-error', !!isError);
  }

  function setModalMessage(text, isError) {
    const modal = document.getElementById(MODAL_ID);
    const message = modal ? modal.querySelector('.gs-problem-picker-message') : null;
    if (!(message instanceof HTMLElement)) return;
    message.textContent = String(text || '');
    message.classList.toggle('is-error', !!isError);
  }

  function ensureLauncher() {
    ensureStyle();
    const existing = document.getElementById(ROOT_ID);
    if (existing instanceof HTMLElement) return existing;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="gs-problem-picker-actions">
        <button type="button" class="gs-problem-picker-open">Классификация</button>
        <button type="button" class="gs-problem-picker-url" title="Настроить URL bridge">URL</button>
      </div>
      <div class="gs-problem-picker-status" aria-live="polite"></div>
    `;

    root.querySelector('.gs-problem-picker-open')?.addEventListener('click', () => {
      void openPicker();
    }, { capture: true });
    root.querySelector('.gs-problem-picker-url')?.addEventListener('click', () => {
      void promptBridgeUrl();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  async function promptBridgeUrl() {
    const current = state.bridgeUrl || await loadBridgeUrl();
    const next = window.prompt('Вставь URL Apps Script bridge:', current);
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
      <section class="gs-problem-picker-panel" role="dialog" aria-modal="true" aria-label="Классификация проблемы">
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
        <label class="gs-problem-picker-field">
          <span class="gs-problem-picker-label">Выберите новую категорию:</span>
          <select class="gs-problem-picker-select"></select>
        </label>
        <footer class="gs-problem-picker-footer">
          <div class="gs-problem-picker-message" aria-live="polite"></div>
          <div class="gs-problem-picker-buttons">
            <button type="button" class="gs-problem-picker-save">Сохранить и далее</button>
            <button type="button" class="gs-problem-picker-close">Закрыть</button>
          </div>
        </footer>
      </section>
    `;

    const select = modal.querySelector('.gs-problem-picker-select');
    if (select instanceof HTMLSelectElement) {
      OPTIONS.forEach((option) => {
        const item = document.createElement('option');
        item.value = option;
        item.textContent = option;
        select.appendChild(item);
      });
    }

    const close = () => {
      modal.hidden = true;
    };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.gs-problem-picker-close-x')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.gs-problem-picker-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.gs-problem-picker-save')?.addEventListener('click', () => {
      void saveCurrentItem();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function renderModal() {
    const modal = ensureModal();
    const item = getCurrentItem();
    const meta = modal.querySelector('.gs-problem-picker-meta');
    const progress = modal.querySelector('.gs-problem-picker-progress');
    const textLabel = modal.querySelector('.gs-problem-picker-text-label');
    const text = modal.querySelector('.gs-problem-picker-text');
    const select = modal.querySelector('.gs-problem-picker-select');
    const saveButton = modal.querySelector('.gs-problem-picker-save');

    if (meta instanceof HTMLElement) {
      meta.textContent = `Лист: ${state.sheetName || 'не выбран'} · строк в экспорте: ${Math.max(0, state.rowsCount - 1)}`;
    }

    if (!item) {
      if (progress instanceof HTMLElement) progress.textContent = `Готово: ${state.savedCount}/${state.queue.length}`;
      if (textLabel instanceof HTMLElement) textLabel.textContent = 'Неклассифицированных заявок нет';
      if (text instanceof HTMLElement) text.textContent = 'Очередь завершена.';
      if (select instanceof HTMLSelectElement) select.disabled = true;
      if (saveButton instanceof HTMLButtonElement) saveButton.disabled = true;
      setModalMessage('Классификация завершена.', false);
      return;
    }

    if (progress instanceof HTMLElement) progress.textContent = `Очередь: ${state.currentIndex + 1}/${state.queue.length}`;
    if (textLabel instanceof HTMLElement) textLabel.textContent = `Текст заявки (строка ${item.row}):`;
    if (text instanceof HTMLElement) text.textContent = item.text || '';
    if (select instanceof HTMLSelectElement) {
      select.disabled = !!state.isSaving;
      select.value = DEFAULT_VALUE;
    }
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = !!state.isSaving || !state.bridgeUrl;
      saveButton.textContent = state.isSaving ? 'Сохранение...' : 'Сохранить и далее';
      saveButton.title = state.bridgeUrl ? '' : 'Нажми кнопку URL на странице и задай Apps Script bridge.';
    }
    setModalMessage(state.bridgeUrl ? '' : 'URL bridge не задан. Нажми кнопку URL на странице.', !state.bridgeUrl);
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
      const saveButton = modal.querySelector('.gs-problem-picker-save');
      if (saveButton instanceof HTMLButtonElement && !saveButton.disabled) saveButton.focus();
      updateLauncherStatus(`В очереди строк: ${state.queue.length}.`, false);
    } catch (error) {
      updateLauncherStatus(error && error.message ? error.message : 'Не удалось загрузить очередь.', true);
    } finally {
      state.isLoading = false;
    }
  }

  async function saveCurrentItem() {
    const item = getCurrentItem();
    if (!item || state.isSaving) return;

    const modal = ensureModal();
    const select = modal.querySelector('.gs-problem-picker-select');
    const value = select instanceof HTMLSelectElement ? String(select.value || '').trim() : '';
    if (!value) {
      setModalMessage('Выберите проблему.', true);
      return;
    }
    if (!state.bridgeUrl) {
      setModalMessage('URL bridge не задан. Нажми кнопку URL на странице.', true);
      return;
    }

    state.isSaving = true;
    renderModal();

    const response = await sendRuntimeMessage({
      action: SAVE_ACTION,
      data: {
        bridgeUrl: state.bridgeUrl,
        payload: {
          action: 'saveProblem',
          spreadsheetId: CONFIG.spreadsheetId,
          sheetName: state.sheetName,
          row: item.row,
          value
        }
      }
    });

    state.isSaving = false;
    if (!response || response.success !== true) {
      setModalMessage(response && response.error ? response.error : 'Не удалось сохранить значение.', true);
      renderModal();
      return;
    }

    state.savedCount += 1;
    state.currentIndex += 1;
    renderModal();
    const nextSelect = modal.querySelector('.gs-problem-picker-select');
    if (nextSelect instanceof HTMLSelectElement && !nextSelect.disabled) nextSelect.focus();
  }

  function init() {
    if (!isTargetSpreadsheet()) return;
    ensureLauncher();
    void loadBridgeUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
