(function () {
  if (window.__supportReminderContentInjected) return;
  window.__supportReminderContentInjected = true;

  const STORAGE_KEY = 'support_reminders_state_v1';
  const TARGET_STAGE = '2.4 Подтверждение решения и закрытие Запроса';
  const TARGET_STAGE_NORMALIZED = normalizeText(TARGET_STAGE);
  const OPEN_FILTER_ID = 'requestFilter1';
  const REQUESTS_TABLE_ID = 'СписокОбращенийТаблица';
  const REQUESTS_BODY_ID = 'СписокОбращенийТелоТаблицы';
  const HIGHLIGHT_CLASS = 'support-reminder-highlight';
  const DEFAULT_COLUMNS = {
    createdAt: 1,
    requestNumber: 2,
    subject: 3,
    supportNumber: 4,
    stage: 5,
    assignee: 6,
    initiator: 7
  };

  let reminderIds = new Set();
  let latestSnapshot = {
    openFilterActive: false,
    requests: [],
    rowById: new Map()
  };
  let refreshTimer = null;
  let periodicSyncTimer = null;
  let lastSyncHash = '';

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function ensureStyles() {
    if (document.getElementById('support-reminder-style')) return;
    const style = document.createElement('style');
    style.id = 'support-reminder-style';
    style.textContent = `
      tr.${HIGHLIGHT_CLASS},
      tr.${HIGHLIGHT_CLASS} > td {
        background-color: #ffe3e3 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function clearHighlights() {
    document.querySelectorAll(`tr.${HIGHLIGHT_CLASS}`).forEach((row) => {
      row.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  function getCellText(row, index) {
    const cell = row && row.cells && row.cells[index];
    return cell ? String(cell.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function detectColumnIndexes(table) {
    const fallback = { ...DEFAULT_COLUMNS };
    if (!table) return fallback;

    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) return fallback;

    const headers = Array.from(headerRow.querySelectorAll('th, td'))
      .map((cell) => normalizeText(cell.textContent));

    headers.forEach((header, index) => {
      if (!header) return;
      if (header.startsWith('дата')) fallback.createdAt = index;
      if (header === 'номер' || (header.startsWith('номер') && !header.includes('супп'))) {
        fallback.requestNumber = index;
      }
      if (header.includes('номер заявки') && header.includes('супп')) fallback.supportNumber = index;
      if (header.startsWith('тема')) fallback.subject = index;
      if (header.startsWith('этап')) fallback.stage = index;
      if (header.startsWith('исполнитель')) fallback.assignee = index;
      if (header.startsWith('инициатор')) fallback.initiator = index;
    });

    return fallback;
  }

  function buildRequestId(row, columns) {
    const primary = getCellText(row, columns.requestNumber);
    if (primary) return primary;

    const supportNumber = getCellText(row, columns.supportNumber);
    if (supportNumber) return `SUPP:${supportNumber}`;

    const rowRef = String(row.getAttribute('ref') || '').trim();
    return rowRef || '';
  }

  function isOpenFilterActive() {
    const openFilter = document.getElementById(OPEN_FILTER_ID);
    return !!(openFilter && openFilter.classList.contains('selected'));
  }

  function extractSnapshot() {
    const openFilterActive = isOpenFilterActive();
    const table = document.getElementById(REQUESTS_TABLE_ID);
    const body = document.getElementById(REQUESTS_BODY_ID);

    if (!table || !body) {
      return {
        openFilterActive,
        requests: [],
        rowById: new Map()
      };
    }

    const columns = detectColumnIndexes(table);
    const rows = Array.from(body.querySelectorAll('tr'));
    const rowById = new Map();
    const requests = [];

    rows.forEach((row) => {
      const requestId = buildRequestId(row, columns);
      if (!requestId) return;

      const request = {
        requestId,
        requestNumber: getCellText(row, columns.requestNumber),
        subject: getCellText(row, columns.subject),
        stage: getCellText(row, columns.stage),
        supportNumber: getCellText(row, columns.supportNumber),
        assignee: getCellText(row, columns.assignee),
        initiator: getCellText(row, columns.initiator),
        createdAt: getCellText(row, columns.createdAt)
      };

      requests.push(request);
      rowById.set(requestId, row);
    });

    return { openFilterActive, requests, rowById };
  }

  function getSnapshotHash(snapshot) {
    const requestParts = snapshot.requests.map((item) => `${item.requestId}:${item.stage}`).join('|');
    return `${snapshot.openFilterActive ? 'open' : 'closed'}|${requestParts}`;
  }

  function applyHighlights(snapshot) {
    clearHighlights();
    if (!snapshot.openFilterActive) return;

    snapshot.requests.forEach((request) => {
      if (!reminderIds.has(request.requestId)) return;
      if (normalizeText(request.stage) !== TARGET_STAGE_NORMALIZED) return;

      const row = snapshot.rowById.get(request.requestId);
      if (row) row.classList.add(HIGHLIGHT_CLASS);
    });
  }

  function sendSync(snapshot) {
    chrome.runtime.sendMessage({
      action: 'SUPPORT_SYNC_OPEN_REQUESTS',
      data: {
        openFilterActive: snapshot.openFilterActive,
        requests: snapshot.requests
      }
    });
  }

  function refresh(forceSync) {
    const snapshot = extractSnapshot();
    latestSnapshot = snapshot;
    applyHighlights(snapshot);

    const hash = getSnapshotHash(snapshot);
    if (forceSync || hash !== lastSyncHash) {
      lastSyncHash = hash;
      sendSync(snapshot);
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh(false), 350);
  }

  function loadReminderIds() {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      const state = data[STORAGE_KEY] || {};
      const reminders = state.reminders && typeof state.reminders === 'object' ? state.reminders : {};
      reminderIds = new Set(Object.keys(reminders));
      applyHighlights(latestSnapshot);
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    loadReminderIds();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.action !== 'SUPPORT_GET_OPEN_REQUESTS') return false;

    const snapshot = extractSnapshot();
    latestSnapshot = snapshot;
    applyHighlights(snapshot);

    sendResponse({
      success: true,
      openFilterActive: snapshot.openFilterActive,
      requests: snapshot.requests
    });
    return true;
  });

  function init() {
    ensureStyles();
    loadReminderIds();
    refresh(true);

    const observer = new MutationObserver(() => {
      scheduleRefresh();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    periodicSyncTimer = setInterval(() => {
      refresh(true);
    }, 15000);
  }

  init();
})();
