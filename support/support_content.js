(function () {
  if (window.__supportReminderContentInjected) return;
  window.__supportReminderContentInjected = true;

  const STORAGE_KEY = 'support_reminders_state_v1';
  const TARGET_STAGE = '2.4 Подтверждение решения и закрытие Запроса';
  const TARGET_STAGE_NORMALIZED = normalizeText(TARGET_STAGE);
  const REQUESTS_TABLE_ID = 'СписокОбращенийТаблица';
  const REQUESTS_BODY_ID = 'СписокОбращенийТелоТаблицы';
  const HIGHLIGHT_CLASS = 'support-reminder-highlight';
  const ACTION_HEADER_CLASS = 'support-reminder-action-header';
  const ACTION_CELL_CLASS = 'support-reminder-action-cell';
  const ACTION_BUTTON_CLASS = 'support-reminder-action-button';
  const ACTION_MENU_ID = 'support-reminder-action-menu';
  const SNAPSHOT_READY_DELAY_MS = 20000;
  const RATING_ARCHIVE_POLL_MS = 500;
  const RATING_ARCHIVE_TIMEOUT_MS = 30000;
  const FINAL_STATUS_TOKENS = ['завершен', 'закрыт', 'закрыто', 'отменен', 'отменено'];
  const TRACKED_FILTERS = {
    requestFilter1: { type: 'open', label: 'Открытые обращения' },
    requestFilter4: { type: 'my_tasks', label: 'Мои задачи' },
    requestFilter3: { type: 'list', label: 'Список обращений' },
    requestFilter2: { type: 'closed', label: 'Закрытые обращения' }
  };

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
  let remindersById = {};
  let archiveById = {};
  let latestSnapshot = {
    activeFilterType: '',
    activeFilterLabel: '',
    trackedFilterActive: false,
    requests: [],
    rowById: new Map(),
    snapshotReady: false
  };
  let latestRequestsById = new Map();
  const scriptStartedAt = Date.now();
  let refreshTimer = null;
  let periodicSyncTimer = null;
  let acceptedRatingArchiveTimer = null;
  let pendingAcceptedRating = null;
  let lastSyncHash = '';

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizeSupportRequestNumber(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const match = text.match(/(\d{4})-(\d+)/);
    if (!match) return text;

    const significant = match[2].replace(/^0+/, '') || '0';
    return `${match[1]}-${significant.padStart(6, '0')}`;
  }

  function getCurrentRequestDialogId() {
    const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, .modal-title'))
      .find((node) => /Запрос\s*№/i.test(String(node.textContent || '')));
    return heading ? normalizeSupportRequestNumber(heading.textContent) : '';
  }

  function getAcceptedRatingButton(target) {
    const button = target && target.closest
      ? target.closest('button.ratetask')
      : null;
    if (!button) return null;
    if (String(button.getAttribute('objectrate') || '').trim() !== '1') return null;
    if (!String(button.getAttribute('onclick') || '').includes('rateTaskButtonSelect')) return null;
    return button;
  }

  function isFinalStatus(status) {
    const normalizedStatus = normalizeText(status);
    if (!normalizedStatus) return false;
    return FINAL_STATUS_TOKENS.some((token) => (
      normalizedStatus === token || normalizedStatus.startsWith(`${token} `)
    ));
  }

  function isFinalRequest(request) {
    const normalizedStage = normalizeText(request && request.stage);
    if (normalizedStage === 'завершено' || normalizedStage === 'закрыто') return true;
    return isFinalStatus(request && request.status);
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

      .${ACTION_HEADER_CLASS} {
        width: 42px;
        min-width: 42px;
      }

      td.${ACTION_CELL_CLASS} {
        width: 42px;
        min-width: 42px;
        text-align: center;
        vertical-align: top;
        padding-top: 2px;
      }

      .${ACTION_BUTTON_CLASS} {
        width: 26px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 0;
        border: 1px solid #c5d0db;
        border-radius: 6px;
        background: #f4f7fa;
        color: #304255;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
      }

      .${ACTION_BUTTON_CLASS}:hover {
        background: #e9f0f7;
      }

      .${ACTION_BUTTON_CLASS}.has-reminder {
        border-color: #77a6d6;
        background: #e7f2ff;
        color: #114a80;
      }

      .${ACTION_BUTTON_CLASS}.is-archived-reminder {
        border-color: #d2b48c;
        background: #fff6e8;
        color: #8b5a2b;
      }

      #${ACTION_MENU_ID} {
        position: fixed;
        z-index: 2147483647;
        min-width: 180px;
        max-width: 280px;
        border: 1px solid #c7d2dd;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 12px 24px rgba(16, 24, 40, 0.18);
        padding: 8px;
      }

      #${ACTION_MENU_ID}[hidden] {
        display: none;
      }

      .support-reminder-action-menu-title {
        font-size: 12px;
        font-weight: 600;
        color: #2d3c4a;
        margin: 0 0 6px 0;
      }

      .support-reminder-action-menu-note {
        font-size: 12px;
        color: #556676;
        margin: 0 0 8px 0;
        padding: 6px;
        border-radius: 6px;
        border: 1px solid #e0e6ec;
        background: #f8fafc;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .support-reminder-action-menu-btn {
        width: 100%;
        border: 1px solid #c6d3e0;
        border-radius: 6px;
        background: #f6f9fc;
        color: #1f3d5a;
        padding: 6px 8px;
        font-size: 12px;
        line-height: 1.2;
        cursor: pointer;
        text-align: left;
        margin-top: 6px;
      }

      .support-reminder-action-menu-btn:first-of-type {
        margin-top: 0;
      }

      .support-reminder-action-menu-btn:hover {
        background: #eaf2fb;
      }

      .support-reminder-action-menu-btn.danger {
        border-color: #e6c1c1;
        background: #fff5f5;
        color: #8b2e2e;
      }

      .support-reminder-action-menu-btn.danger:hover {
        background: #ffecec;
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

  function getStatusText(row, columns) {
    const statusIndex = Math.max(0, (columns?.createdAt ?? 1) - 1);
    const statusCell = row && row.cells ? row.cells[statusIndex] : null;
    if (!statusCell) return '';

    const image = statusCell.querySelector('img');
    if (image) {
      const imageTitle = String(image.getAttribute('title') || image.getAttribute('alt') || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (imageTitle) return imageTitle;
    }

    return String(statusCell.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getActiveFilterInfo() {
    const match = Object.entries(TRACKED_FILTERS).find(([filterId]) => {
      const filterNode = document.getElementById(filterId);
      return !!(filterNode && filterNode.classList.contains('selected'));
    });

    if (!match) {
      return { id: '', type: '', label: '' };
    }

    return { id: match[0], ...match[1] };
  }

  function getTrackedReminder(requestId) {
    return remindersById[requestId] || archiveById[requestId] || null;
  }

  function isArchivedReminder(requestId) {
    return !remindersById[requestId] && !!archiveById[requestId];
  }

  function extractSnapshot() {
    const activeFilter = getActiveFilterInfo();
    const trackedFilterActive = !!activeFilter.type;
    const table = document.getElementById(REQUESTS_TABLE_ID);
    const body = document.getElementById(REQUESTS_BODY_ID);

    if (!table || !body) {
      const elapsed = Date.now() - scriptStartedAt;
      return {
        activeFilterType: activeFilter.type,
        activeFilterLabel: activeFilter.label,
        trackedFilterActive,
        requests: [],
        rowById: new Map(),
        snapshotReady: !trackedFilterActive || elapsed > SNAPSHOT_READY_DELAY_MS
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
        status: getStatusText(row, columns),
        supportNumber: getCellText(row, columns.supportNumber),
        assignee: getCellText(row, columns.assignee),
        initiator: getCellText(row, columns.initiator),
        createdAt: getCellText(row, columns.createdAt),
        filterType: activeFilter.type,
        filterLabel: activeFilter.label
      };

      requests.push(request);
      rowById.set(requestId, row);
    });

    const snapshotReady = !trackedFilterActive || !!(table && body);

    return {
      activeFilterType: activeFilter.type,
      activeFilterLabel: activeFilter.label,
      trackedFilterActive,
      requests,
      rowById,
      snapshotReady
    };
  }

  function getSnapshotHash(snapshot) {
    const requestParts = snapshot.requests
      .map((item) => `${item.requestId}:${item.stage}:${item.status}`)
      .join('|');
    return `${snapshot.activeFilterType || 'none'}|${snapshot.snapshotReady ? 'ready' : 'loading'}|${requestParts}`;
  }

  function sendRuntimeMessage(action, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('Нет ответа от background-скрипта.'));
          return;
        }
        if (response.success === false) {
          reject(new Error(response.error || 'Неизвестная ошибка background-скрипта.'));
          return;
        }
        resolve(response);
      });
    });
  }

  function applyReminderCache(rawState) {
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    const reminders = state.reminders && typeof state.reminders === 'object' ? state.reminders : {};
    const archive = state.archive && typeof state.archive === 'object' ? state.archive : {};
    remindersById = reminders;
    archiveById = archive;
    reminderIds = new Set(Object.keys(reminders));
  }

  function applyReminderCacheFromResponse(response) {
    const reminders = response && response.remindersById && typeof response.remindersById === 'object'
      ? response.remindersById
      : null;
    const archive = response && response.archiveById && typeof response.archiveById === 'object'
      ? response.archiveById
      : null;
    if (!reminders && !archive) return;
    remindersById = reminders || {};
    archiveById = archive || {};
    reminderIds = new Set(Object.keys(remindersById));
  }

  function ensureActionHeader() {
    const table = document.getElementById(REQUESTS_TABLE_ID);
    if (!table) return;

    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) return;
    if (headerRow.querySelector(`.${ACTION_HEADER_CLASS}`)) return;

    const cell = document.createElement(headerRow.querySelector('th') ? 'th' : 'td');
    cell.className = ACTION_HEADER_CLASS;
    cell.title = 'Действия по напоминаниям';
    headerRow.insertBefore(cell, headerRow.firstElementChild || null);
  }

  function ensureActionCell(row) {
    let actionCell = row.querySelector(`td.${ACTION_CELL_CLASS}`);
    if (!actionCell) {
      actionCell = document.createElement('td');
      actionCell.className = ACTION_CELL_CLASS;
      row.insertBefore(actionCell, row.firstElementChild || null);
    }
    return actionCell;
  }

  function renderRowActionButton(row, request) {
    const reminder = getTrackedReminder(request.requestId);
    const archivedReminder = isArchivedReminder(request.requestId);
    const actionCell = ensureActionCell(row);
    let button = actionCell.querySelector(`button.${ACTION_BUTTON_CLASS}`);

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = ACTION_BUTTON_CLASS;
      actionCell.appendChild(button);
    }

    const note = reminder && reminder.note ? String(reminder.note).trim() : '';
    button.dataset.requestId = request.requestId;
    button.classList.toggle('has-reminder', !!reminder);
    button.classList.toggle('is-archived-reminder', archivedReminder);
    button.textContent = reminder ? (archivedReminder ? '🗂' : '🔔') : '➕';
    button.title = reminder
      ? (
        note
          ? `${archivedReminder ? 'Архивное напоминание' : 'Напоминание'}: ${note}`
          : archivedReminder
            ? 'Архивное напоминание без текста'
            : 'Напоминание без текста'
      )
      : 'Создать напоминание';

    if (note) {
      row.setAttribute('title', `${archivedReminder ? 'Архивное напоминание' : 'Напоминание'}: ${note}`);
    } else {
      row.removeAttribute('title');
    }
  }

  function ensureActionMenu() {
    let menu = document.getElementById(ACTION_MENU_ID);
    if (menu) return menu;

    menu = document.createElement('div');
    menu.id = ACTION_MENU_ID;
    menu.hidden = true;
    document.body.appendChild(menu);

    menu.addEventListener('click', async (event) => {
      const actionButton = event.target.closest('button[data-support-menu-action]');
      if (!actionButton) return;

      event.preventDefault();
      event.stopPropagation();

      const action = String(actionButton.dataset.supportMenuAction || '');
      const requestId = String(menu.dataset.requestId || '');
      hideActionMenu();

      if (!action || !requestId) return;

      try {
        if (action === 'create' || action === 'edit') {
          await upsertReminder(requestId);
        } else if (action === 'delete-archive') {
          await removeArchiveEntry(requestId);
        } else if (action === 'delete') {
          await removeReminder(requestId);
        }
      } catch (error) {
        alert(`Ошибка действия: ${error.message}`);
      }
    });

    return menu;
  }

  function hideActionMenu() {
    const menu = document.getElementById(ACTION_MENU_ID);
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = '';
    delete menu.dataset.requestId;
  }

  function positionActionMenu(menu, anchor) {
    const anchorRect = anchor.getBoundingClientRect();
    const viewportPadding = 8;

    let left = anchorRect.left;
    let top = anchorRect.bottom + 6;

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuWidth - viewportPadding;
    }
    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = anchorRect.top - menuHeight - 6;
    }

    menu.style.left = `${Math.max(viewportPadding, left)}px`;
    menu.style.top = `${Math.max(viewportPadding, top)}px`;
  }

  function appendMenuButton(menu, actionName, label, isDanger) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `support-reminder-action-menu-btn${isDanger ? ' danger' : ''}`;
    button.dataset.supportMenuAction = actionName;
    button.textContent = label;
    menu.appendChild(button);
  }

  function showActionMenu(requestId, anchorButton) {
    const menu = ensureActionMenu();
    const activeReminder = remindersById[requestId] || null;
    const archivedReminder = !activeReminder ? (archiveById[requestId] || null) : null;
    const reminder = activeReminder || archivedReminder;
    const request = latestRequestsById.get(requestId) || (reminder && reminder.lastKnown) || null;

    menu.innerHTML = '';
    menu.dataset.requestId = requestId;

    const title = document.createElement('div');
    title.className = 'support-reminder-action-menu-title';
    title.textContent = request && request.requestNumber
      ? `Заявка № ${request.requestNumber}`
      : `Заявка ${requestId}`;
    menu.appendChild(title);

    if (reminder && reminder.note) {
      const note = document.createElement('div');
      note.className = 'support-reminder-action-menu-note';
      note.textContent = reminder.note;
      menu.appendChild(note);
    }

    if (!reminder) {
      appendMenuButton(menu, 'create', 'Создать', false);
    } else if (archivedReminder) {
      appendMenuButton(menu, 'delete-archive', 'Удалить из архива', true);
    } else {
      appendMenuButton(menu, 'edit', 'Редактировать', false);
      appendMenuButton(menu, 'delete', 'Удалить', true);
    }

    menu.hidden = false;
    positionActionMenu(menu, anchorButton);
  }

  async function upsertReminder(requestId) {
    const existing = remindersById[requestId];
    const sourceRequest = latestRequestsById.get(requestId)
      || (existing && existing.lastKnown)
      || null;

    if (!sourceRequest) {
      alert('Не удалось найти данные заявки для сохранения напоминания.');
      return;
    }

    const defaultText = existing && existing.note ? String(existing.note) : '';
    const promptText = existing
      ? 'Измените текст напоминания:'
      : 'Введите текст напоминания:';
    const note = prompt(promptText, defaultText);
    if (note === null) return;

    const normalized = note.trim();
    if (!normalized) {
      alert('Текст напоминания не может быть пустым.');
      return;
    }

    const response = await sendRuntimeMessage('SUPPORT_UPSERT_REMINDER', {
      request: sourceRequest,
      note: normalized
    });
    applyReminderCacheFromResponse(response);
    refresh(true);
  }

  async function removeReminder(requestId) {
    if (!confirm('Удалить напоминание по этой заявке?')) return;
    const response = await sendRuntimeMessage('SUPPORT_DELETE_REMINDER', { requestId });
    applyReminderCacheFromResponse(response);
    refresh(true);
  }

  async function removeArchiveEntry(requestId) {
    if (!confirm('Удалить запись из архива по этой заявке?')) return;
    const response = await sendRuntimeMessage('SUPPORT_DELETE_ARCHIVE', { requestId });
    applyReminderCacheFromResponse(response);
    refresh(true);
  }

  function findRequestInSnapshot(snapshot, requestId) {
    const normalizedRequestId = normalizeSupportRequestNumber(requestId);
    return snapshot.requests.find((request) => (
      request.requestId === normalizedRequestId
      || normalizeSupportRequestNumber(request.requestNumber) === normalizedRequestId
    )) || null;
  }

  async function archiveAcceptedRatingReminder(requestId, request) {
    const response = await sendRuntimeMessage('SUPPORT_ARCHIVE_AFTER_ACCEPTED_RATING', {
      requestId,
      request
    });
    applyReminderCacheFromResponse(response);
    refresh(true);
  }

  function scheduleAcceptedRatingArchiveCheck(delay) {
    if (acceptedRatingArchiveTimer) {
      clearTimeout(acceptedRatingArchiveTimer);
    }

    acceptedRatingArchiveTimer = setTimeout(() => {
      acceptedRatingArchiveTimer = null;
      checkAcceptedRatingArchive();
    }, delay);
  }

  async function checkAcceptedRatingArchive() {
    if (!pendingAcceptedRating) return;

    const pending = pendingAcceptedRating;
    const snapshot = extractSnapshot();
    latestSnapshot = snapshot;
    applyRowDecorations(snapshot);

    const request = findRequestInSnapshot(snapshot, pending.requestId);
    if (request && isFinalRequest(request)) {
      pendingAcceptedRating = null;
      try {
        await archiveAcceptedRatingReminder(pending.requestId, request);
      } catch (error) {
        console.error('Не удалось перенести напоминание support в архив после оценки:', error);
      }
      return;
    }

    if (Date.now() - pending.startedAt >= RATING_ARCHIVE_TIMEOUT_MS) {
      pendingAcceptedRating = null;
      return;
    }

    scheduleAcceptedRatingArchiveCheck(RATING_ARCHIVE_POLL_MS);
  }

  function trackAcceptedRatingClick(event) {
    if (!getAcceptedRatingButton(event.target)) return;

    const requestId = getCurrentRequestDialogId();
    if (!requestId) return;

    pendingAcceptedRating = {
      requestId,
      startedAt: Date.now()
    };
    scheduleAcceptedRatingArchiveCheck(RATING_ARCHIVE_POLL_MS);
  }

  function applyRowDecorations(snapshot) {
    clearHighlights();
    ensureActionHeader();
    latestRequestsById = new Map();

    snapshot.requests.forEach((request) => {
      latestRequestsById.set(request.requestId, request);
      const row = snapshot.rowById.get(request.requestId);
      if (!row) return;

      renderRowActionButton(row, request);

      if (!reminderIds.has(request.requestId)) return;
      if (normalizeText(request.stage) !== TARGET_STAGE_NORMALIZED) return;

      row.classList.add(HIGHLIGHT_CLASS);
    });
  }

  function sendSync(snapshot) {
    chrome.runtime.sendMessage({
      action: 'SUPPORT_SYNC_REQUESTS',
      data: {
        activeFilterType: snapshot.activeFilterType,
        activeFilterLabel: snapshot.activeFilterLabel,
        trackedFilterActive: snapshot.trackedFilterActive,
        requests: snapshot.requests,
        snapshotReady: snapshot.snapshotReady
      }
    });
  }

  function refresh(forceSync) {
    const snapshot = extractSnapshot();
    latestSnapshot = snapshot;
    applyRowDecorations(snapshot);

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

  function loadReminderState() {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      applyReminderCache(data[STORAGE_KEY]);
      applyRowDecorations(latestSnapshot);
    });
  }

  async function handleDocumentClick(event) {
    trackAcceptedRatingClick(event);

    const actionButton = event.target.closest(`button.${ACTION_BUTTON_CLASS}`);
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      const requestId = String(actionButton.dataset.requestId || '').trim();
      if (!requestId) return;

      const reminder = getTrackedReminder(requestId);
      if (!reminder) {
        hideActionMenu();
        try {
          await upsertReminder(requestId);
        } catch (error) {
          alert(`Ошибка действия: ${error.message}`);
        }
        return;
      }

      showActionMenu(requestId, actionButton);
      return;
    }

    const menu = document.getElementById(ACTION_MENU_ID);
    if (!menu || menu.hidden) return;
    if (event.target.closest(`#${ACTION_MENU_ID}`)) return;
    hideActionMenu();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    applyReminderCache(changes[STORAGE_KEY].newValue);
    applyRowDecorations(latestSnapshot);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return false;
    if (message.action !== 'SUPPORT_GET_REQUEST_SNAPSHOT' && message.action !== 'SUPPORT_GET_OPEN_REQUESTS') {
      return false;
    }

    const snapshot = extractSnapshot();
    latestSnapshot = snapshot;
    applyRowDecorations(snapshot);

    sendResponse({
      success: true,
      openFilterActive: snapshot.activeFilterType === 'open',
      activeFilterType: snapshot.activeFilterType,
      activeFilterLabel: snapshot.activeFilterLabel,
      trackedFilterActive: snapshot.trackedFilterActive,
      requests: snapshot.requests,
      snapshotReady: snapshot.snapshotReady
    });
    return true;
  });

  function init() {
    ensureStyles();
    ensureActionMenu();
    loadReminderState();
    refresh(true);

    const observer = new MutationObserver(() => {
      scheduleRefresh();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideActionMenu();
    });
    document.addEventListener('scroll', hideActionMenu, true);
    window.addEventListener('resize', hideActionMenu);

    periodicSyncTimer = setInterval(() => {
      refresh(true);
    }, 5000);
  }

  init();
})();
