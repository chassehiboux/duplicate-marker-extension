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
    bridgeUrl: '', queue: [], currentIndex: 0, sentCount: 0,
    pendingSaveCount: 0, failedSaveCount: 0, lastBackgroundError: '',
    sheetName: '', gid: '', rowsCount: 0, isLoading: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function isTargetSpreadsheet() {
    return location.hostname === 'docs.google.com'
      && String(location.pathname || '').includes(`/spreadsheets/d/${CONFIG.spreadsheetId}/`);
  }

  function storageGet(keys) {
    return new Promise(resolve => {
      try { chrome.storage.local.get(keys, result => resolve(result || {})); }
      catch (e) { resolve({}); }
    });
  }

  function storageSet(values) {
    return new Promise(resolve => {
      try { chrome.storage.local.set(values, () => resolve(true)); }
      catch (e) { resolve(false); }
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
          resolve(err ? { success: false, error: err } : (response || { success: false, error: 'NO_RESPONSE' }));
        });
      } catch (e) {
        resolve({ success: false, error: e && e.message ? e.message : 'SEND_FAILED' });
      }
    });
  }

  async function loadBridgeUrl() {
    const stored = await storageGet([CONFIG.storageKey]);
    state.bridgeUrl = String(stored[CONFIG.storageKey] || CONFIG.bridgeUrl || '').trim();
    return state.bridgeUrl;
  }

  async function saveBridgeUrl(url) {
    state.bridgeUrl = String(url || '').trim();
    await storageSet({ [CONFIG.storageKey]: state.bridgeUrl });
    updateLauncherStatus(state.bridgeUrl ? 'URL bridge сохранён.' : 'URL bridge очищен.', false);
    renderModal();
  }

  function getActiveSheetName() {
    const tab = $('.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name') || $('.docs-sheet-active-tab');
    return tab instanceof HTMLElement ? String(tab.textContent || '').trim() : '';
  }

  function getActiveGid() {
    const searchGid = new URLSearchParams(location.search || '').get('gid');
    if (searchGid) return String(searchGid).trim();
    const match = String(location.hash || '').match(/gid=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const src = String(text || '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else quoted = false;
        } else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  async function loadQueue() {
    const sheetName = getActiveSheetName();
    if (!(CONFIG.allowedSheetNames || []).includes(sheetName)) {
      throw new Error('Открой лист «Заявки» или «Заявки (наши)».');
    }
    const gid = getActiveGid();
    if (!gid) throw new Error('Не удалось определить gid активного листа.');

    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`CSV-экспорт вернул HTTP ${response.status}.`);

    const rows = parseCsv(await response.text());
    const headers = rows[0] || [];
    const textIndex = headers.indexOf(TEXT_HEADER);
    const problemIndex = headers.indexOf(PROBLEM_HEADER);
    if (textIndex < 0 || problemIndex < 0) throw new Error('Не найдены колонки «Текст заявки» или «Проблемы».');

    const queue = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const text = String(row[textIndex] || '').trim();
      const problem = String(row[problemIndex] || '').trim();
      if (text && !problem) queue.push({ row: i + 1, text });
    }
    state = { ...state, queue, currentIndex: 0, sentCount: 0, pendingSaveCount: 0, failedSaveCount: 0, lastBackgroundError: '', sheetName, gid, rowsCount: rows.length, isLoading: false };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{position:fixed;right:18px;bottom:58px;z-index:2147483640;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:Segoe UI,Tahoma,sans-serif}
      #${ROOT_ID} .gs-problem-picker-actions{display:flex;gap:6px}
      #${ROOT_ID} button,#${MODAL_ID} button{border:1px solid #b7c2d3;border-radius:7px;background:#fff;color:#162033;cursor:pointer;font:600 13px Segoe UI,Tahoma,sans-serif;padding:8px 12px}
      #${ROOT_ID} .gs-problem-picker-open,#${MODAL_ID} .gs-problem-picker-save{border-color:#1155cc;background:#1155cc;color:#fff}
      #${ROOT_ID} .gs-problem-picker-status{max-width:360px;min-height:18px;padding:5px 8px;border-radius:6px;background:#fff;color:#24513a;font-size:12px;box-shadow:0 6px 18px #0002}
      #${ROOT_ID} .is-error,#${MODAL_ID} .is-error{color:#b3261e!important}
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#1118276b;font-family:Segoe UI,Tahoma,sans-serif}
      #${MODAL_ID}[hidden],html.dup-ext-screenshot-mode #${ROOT_ID},html.dup-ext-screenshot-mode #${MODAL_ID}{display:none!important}
      #${MODAL_ID} .gs-problem-picker-panel{width:min(980px,calc(100vw - 32px));height:min(680px,calc(100vh - 32px));display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;gap:14px;box-sizing:border-box;padding:22px;border-radius:8px;background:#fbfcfe;color:#172033;box-shadow:0 24px 70px #0004}
      #${MODAL_ID} .gs-problem-picker-header,#${MODAL_ID} .gs-problem-picker-footer{display:flex;justify-content:space-between;gap:14px}
      #${MODAL_ID} .gs-problem-picker-title{font-size:22px;font-weight:700}.gs-problem-picker-meta,.gs-problem-picker-message{color:#566176;font-size:13px}
      #${MODAL_ID} .gs-problem-picker-close-x{width:34px;height:34px;padding:0;font-size:22px;line-height:1}
      #${MODAL_ID} .gs-problem-picker-progress{width:fit-content;padding:5px 10px;border-radius:999px;background:#e8f3ee;color:#14532d;font-size:13px;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-text-wrap{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}.gs-problem-picker-label{color:#4b5563;font-size:13px;font-weight:700}
      #${MODAL_ID} .gs-problem-picker-text{min-height:0;overflow:auto;white-space:pre-wrap;border:1px solid #d7dce6;border-left:6px solid #2d6cdf;border-radius:8px;background:#fff;padding:14px;color:#1f2937;font-size:15px;line-height:1.55}
      #${MODAL_ID} .gs-problem-picker-field{display:grid;gap:8px}.gs-problem-picker-select{width:100%;min-height:44px;border:1px solid #9ca8ba;border-radius:6px;padding:0 10px;font-size:15px}
      #${MODAL_ID} .gs-problem-picker-footer{align-items:center;border-top:1px solid #e3e8f0;padding-top:14px}.gs-problem-picker-buttons{display:flex;gap:10px}`;
    (document.head || document.documentElement).appendChild(style);
  }

  function updateLauncherStatus(text, isError) {
    const status = $(`#${ROOT_ID} .gs-problem-picker-status`);
    if (status instanceof HTMLElement) { status.textContent = String(text || ''); status.classList.toggle('is-error', !!isError); }
  }

  function setModalMessage(text, isError) {
    const message = $(`#${MODAL_ID} .gs-problem-picker-message`);
    if (message instanceof HTMLElement) { message.textContent = String(text || ''); message.classList.toggle('is-error', !!isError); }
  }

  function ensureLauncher() {
    ensureStyle();
    let root = document.getElementById(ROOT_ID);
    if (root instanceof HTMLElement) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = '<div class="gs-problem-picker-actions"><button type="button" class="gs-problem-picker-open">Классификация</button><button type="button" class="gs-problem-picker-url" title="Настроить URL bridge">URL</button></div><div class="gs-problem-picker-status" aria-live="polite"></div>';
    $('.gs-problem-picker-open', root)?.addEventListener('click', () => void openPicker(), { capture: true });
    $('.gs-problem-picker-url', root)?.addEventListener('click', () => void promptBridgeUrl(), { capture: true });
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  async function promptBridgeUrl() {
    const current = state.bridgeUrl || await loadBridgeUrl();
    const next = prompt('Вставь URL Apps Script bridge:', current);
    if (next !== null) await saveBridgeUrl(next);
  }

  function ensureModal() {
    ensureStyle();
    let modal = document.getElementById(MODAL_ID);
    if (modal instanceof HTMLElement) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = '<section class="gs-problem-picker-panel" role="dialog" aria-modal="true"><header class="gs-problem-picker-header"><div><div class="gs-problem-picker-title">Классификация проблемы</div><div class="gs-problem-picker-meta"></div></div><button type="button" class="gs-problem-picker-close-x" aria-label="Закрыть">×</button></header><div class="gs-problem-picker-progress"></div><div class="gs-problem-picker-text-wrap"><div class="gs-problem-picker-label gs-problem-picker-text-label"></div><div class="gs-problem-picker-text"></div></div><label class="gs-problem-picker-field"><span class="gs-problem-picker-label">Выберите новую категорию:</span><select class="gs-problem-picker-select"></select></label><footer class="gs-problem-picker-footer"><div class="gs-problem-picker-message" aria-live="polite"></div><div class="gs-problem-picker-buttons"><button type="button" class="gs-problem-picker-save">Сохранить и далее</button><button type="button" class="gs-problem-picker-close">Закрыть</button></div></footer></section>';
    const select = $('.gs-problem-picker-select', modal);
    OPTIONS.forEach(option => {
      const el = document.createElement('option');
      el.value = option; el.textContent = option;
      select.appendChild(el);
    });
    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', e => { if (e.target === modal) close(); }, { capture: true });
    $('.gs-problem-picker-close-x', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-problem-picker-close', modal)?.addEventListener('click', close, { capture: true });
    $('.gs-problem-picker-save', modal)?.addEventListener('click', () => void saveCurrentItem(), { capture: true });
    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function getCurrentItem() { return state.queue[state.currentIndex] || null; }

  function renderModal() {
    const modal = ensureModal();
    const item = getCurrentItem();
    const pending = state.pendingSaveCount ? ` · в фоне: ${state.pendingSaveCount}` : '';
    const failed = state.failedSaveCount ? ` · ошибок: ${state.failedSaveCount}` : '';
    const progressText = item ? `Очередь: ${state.currentIndex + 1}/${state.queue.length} · отправлено: ${state.sentCount}${pending}${failed}` : `Отправлено: ${state.sentCount}/${state.queue.length}${pending}${failed}`;

    $('.gs-problem-picker-meta', modal).textContent = `Лист: ${state.sheetName || 'не выбран'} · строк в экспорте: ${Math.max(0, state.rowsCount - 1)}`;
    $('.gs-problem-picker-progress', modal).textContent = progressText;

    const text = $('.gs-problem-picker-text', modal);
    const label = $('.gs-problem-picker-text-label', modal);
    const select = $('.gs-problem-picker-select', modal);
    const saveButton = $('.gs-problem-picker-save', modal);

    if (!item) {
      label.textContent = 'Неклассифицированных заявок нет';
      text.textContent = 'Очередь завершена.';
      select.disabled = true;
      saveButton.disabled = true;
    } else {
      label.textContent = `Текст заявки (строка ${item.row}):`;
      text.textContent = item.text || '';
      select.disabled = false;
      select.value = DEFAULT_VALUE;
      saveButton.disabled = !state.bridgeUrl;
      saveButton.textContent = 'Сохранить и далее';
      saveButton.title = state.bridgeUrl ? '' : 'Нажми кнопку URL на странице и задай Apps Script bridge.';
    }

    if (!state.bridgeUrl) setModalMessage('URL bridge не задан. Нажми кнопку URL на странице.', true);
    else if (state.failedSaveCount) setModalMessage(state.lastBackgroundError || `Есть ошибки фонового сохранения: ${state.failedSaveCount}.`, true);
    else if (state.pendingSaveCount) setModalMessage(item ? `Сохранение идёт в фоне: ${state.pendingSaveCount}. Можно классифицировать дальше.` : `Очередь завершена. Дожидаюсь фонового сохранения: ${state.pendingSaveCount}.`, false);
    else setModalMessage(item ? '' : 'Классификация завершена.', false);
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
      const saveButton = $('.gs-problem-picker-save', modal);
      if (saveButton instanceof HTMLButtonElement && !saveButton.disabled) saveButton.focus();
      updateLauncherStatus(`В очереди строк: ${state.queue.length}.`, false);
    } catch (e) {
      updateLauncherStatus(e && e.message ? e.message : 'Не удалось загрузить очередь.', true);
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
      data: { bridgeUrl, payload: { action: 'saveProblem', spreadsheetId: CONFIG.spreadsheetId, sheetName, row, value } }
    }).then(response => {
      state.pendingSaveCount = Math.max(0, state.pendingSaveCount - 1);
      if (!response || response.success !== true) {
        state.failedSaveCount += 1;
        state.lastBackgroundError = `Строка ${row} не сохранилась: ${response && response.error ? response.error : 'неизвестная ошибка'}`;
        updateLauncherStatus(`${state.lastBackgroundError}. В обработке: ${state.pendingSaveCount}.`, true);
      } else {
        updateLauncherStatus(`Строка ${row} сохранена. В обработке: ${state.pendingSaveCount}.`, false);
      }
      refreshVisibleModal();
    }).catch(e => {
      state.pendingSaveCount = Math.max(0, state.pendingSaveCount - 1);
      state.failedSaveCount += 1;
      state.lastBackgroundError = `Строка ${row} не сохранилась: ${e && e.message ? e.message : String(e)}`;
      updateLauncherStatus(`${state.lastBackgroundError}. В обработке: ${state.pendingSaveCount}.`, true);
      refreshVisibleModal();
    });
  }

  async function saveCurrentItem() {
    const item = getCurrentItem();
    if (!item) return;
    const modal = ensureModal();
    const select = $('.gs-problem-picker-select', modal);
    const value = select instanceof HTMLSelectElement ? String(select.value || '').trim() : '';
    if (!value) return setModalMessage('Выберите проблему.', true);
    if (!state.bridgeUrl) return setModalMessage('URL bridge не задан. Нажми кнопку URL на странице.', true);

    state.sentCount += 1;
    state.currentIndex += 1;
    enqueueBackgroundSave({ ...item }, value, state.bridgeUrl, state.sheetName);
    renderModal();
    const nextSelect = $('.gs-problem-picker-select', modal);
    if (nextSelect instanceof HTMLSelectElement && !nextSelect.disabled) nextSelect.focus();
  }

  function init() {
    if (!isTargetSpreadsheet()) return;
    ensureLauncher();
    void loadBridgeUrl();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
