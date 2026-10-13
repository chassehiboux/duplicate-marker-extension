/* Дополнение служебной информации карточки ИД, включая iframe. */
(() => {
  'use strict';
  if (globalThis.__dupIdCardServiceInfo) return;
  const CACHE_KEY = 'dup_status_names_cache_v1';
  const VISIBILITY_KEY = 'dup_ui_show_id_card_check_tools';
  const ROW_CLASS = 'dup-id-card-tm';
  const attempted = new Set();
  let cache = {};
  let visible = true;
  let scheduled = false;

  function getInfo(doc, expectedEdocId = '') {
    if (!doc?.querySelectorAll) return null;
    for (const heading of doc.querySelectorAll('.panel-heading')) {
      if (heading.textContent.replace(/\s+/g, ' ').trim() !== 'Служебная информация') continue;
      const body = heading.parentElement?.querySelector('.panel-body');
      if (!body) continue;
      const content = body.cloneNode(true);
      content.querySelectorAll(`.${ROW_CLASS}`).forEach((row) => row.remove());
      const text = content.textContent;
      const edocId = text.match(/\bEDocID:\s*(\d+)\b/i)?.[1] || '';
      const debtId = text.match(/\bDebtID:\s*(\d+)\b/i)?.[1] || '';
      const statusId = text.match(/\bStatusID:\s*(\d+)\b/i)?.[1] || '';
      if (edocId && debtId && statusId && (!expectedEdocId || edocId === String(expectedEdocId))) {
        return { body, edocId, debtId, statusId };
      }
    }
    return null;
  }

  globalThis.__dupIdCardServiceInfo = { getInfo };

  if (!/^\/ovzid\/fullcard\/\d+(?:\/.*)?$/i.test(location.pathname)) return;
  const expectedEdocId = location.pathname.split('/')[3];

  function enabled() {
    const config = globalThis.PYRAMID_EXTENSION_UI_CONFIG || {};
    if (config.globalEnabled === false) return false;
    const forced = config.forcedVisibility?.idCardCheckTools;
    return typeof forced === 'boolean' ? forced : visible;
  }

  function nameFor(statusId) {
    return globalThis.PYRAMID_STATUS_NAMES?.[statusId] || cache?.[location.hostname]?.[statusId] || '';
  }

  function fingerprint(info) { return `${info.edocId}:${info.debtId}:${info.statusId}`; }

  function setText(row, text) {
    if (row.lastChild?.textContent !== text) row.lastChild.textContent = text;
  }

  function render() {
    scheduled = false;
    const info = getInfo(document, expectedEdocId);
    if (!info) {
      document.querySelectorAll(`.${ROW_CLASS}`).forEach((row) => row.remove());
      return;
    }
    let row = info.body.querySelector(`.${ROW_CLASS}`);
    if (!row) {
      row = document.createElement('div');
      row.className = ROW_CLASS;
      const label = document.createElement('b');
      label.textContent = 'ТМ: ';
      row.append(label, document.createTextNode(''));
      info.body.appendChild(row);
    }
    row.hidden = !enabled();
    const name = nameFor(info.statusId);
    if (name) {
      setText(row, name);
      row.title = `StatusID: ${info.statusId}`;
      return;
    }
    const key = fingerprint(info);
    if (attempted.has(key)) {
      if (row.dataset.infoKey !== key) {
        setText(row, `Неизвестный статус (StatusID: ${info.statusId})`);
        row.title = 'Для повторной попытки откройте карточку заново.';
        row.dataset.infoKey = key;
      }
      return;
    }
    row.dataset.infoKey = key;
    setText(row, `Определяется название (StatusID: ${info.statusId})…`);
    row.title = 'Название будет найдено в фоновом глобальном поиске.';
    attempted.add(key);
    try {
      chrome.runtime.sendMessage({
        action: 'ID_CARD_LOOKUP_STATUS_NAME',
        data: { edocId: info.edocId, debtId: info.debtId, statusId: info.statusId }
      }, (response) => {
        const error = chrome.runtime.lastError;
        const current = getInfo(document, expectedEdocId);
        if (!current || fingerprint(current) !== key) return;
        const currentRow = current.body.querySelector(`.${ROW_CLASS}`);
        if (!currentRow) return;
        const found = !error && response?.success && typeof response.statusName === 'string'
          ? response.statusName.trim() : '';
        if (found) {
          cache = { ...cache, [location.hostname]: { ...cache[location.hostname], [info.statusId]: found } };
          setText(currentRow, found);
          currentRow.title = `StatusID: ${info.statusId}; название найдено в глобальном поиске.`;
        } else {
          setText(currentRow, `Неизвестный статус (StatusID: ${info.statusId})`);
          currentRow.title = error?.message || response?.error || 'Не удалось определить название статуса.';
        }
      });
    } catch (error) {
      setText(row, `Неизвестный статус (StatusID: ${info.statusId})`);
      row.title = error.message;
    }
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(render);
  }

  function start() {
    if (!document.getElementById('dup-id-card-tm-style')) {
      const style = document.createElement('style');
      style.id = 'dup-id-card-tm-style';
      style.textContent = `
        .${ROW_CLASS} { display: block; }
        .${ROW_CLASS}[hidden],
        html.dup-ui-hide-id-card-check-tools .${ROW_CLASS},
        html.dup-ext-screenshot-mode .${ROW_CLASS} { display: none !important; }
      `;
      (document.head || document.documentElement).appendChild(style);
    }
    // Собственные записи в поле не запускают бесконечное обновление.
    new MutationObserver((changes) => {
      if (changes.some((change) => {
        const element = change.target.nodeType === 1 ? change.target : change.target.parentElement;
        return !element?.closest(`.${ROW_CLASS}`);
      })) scheduleRender();
    }).observe(document.body, { childList: true, characterData: true, subtree: true });
    chrome.storage.local.get([CACHE_KEY, VISIBILITY_KEY], (stored) => {
      cache = stored[CACHE_KEY] || {};
      visible = stored[VISIBILITY_KEY] !== false;
      render();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[CACHE_KEY]) cache = changes[CACHE_KEY].newValue || {};
      if (changes[VISIBILITY_KEY]) visible = changes[VISIBILITY_KEY].newValue !== false;
      if (changes[CACHE_KEY] || changes[VISIBILITY_KEY]) scheduleRender();
    });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
