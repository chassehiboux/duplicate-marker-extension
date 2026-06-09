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
  const NOTE_HEADER_CLASS = 'support-reminder-note-header';
  const NOTE_CELL_CLASS = 'support-reminder-note-cell';
  const ACTION_MENU_ID = 'support-reminder-action-menu';
  const DIALOG_OVERLAY_ID = 'support-reminder-dialog-overlay';
  const COPY_FEEDBACK_ID = 'support-reminder-copy-feedback';
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

  function normalizeReminderMessageTarget(rawTarget) {
    if (!rawTarget || typeof rawTarget !== 'object') return null;

    const rawKind = String(rawTarget.kind || rawTarget.type || '').trim().toLowerCase();
    if (rawKind === 'url') {
      const url = String(rawTarget.url || '').trim();
      if (!url) return null;
      return {
        kind: 'url',
        url
      };
    }

    return null;
  }

  function cloneMessageTarget(target) {
    const normalized = normalizeReminderMessageTarget(target);
    return normalized ? { ...normalized } : null;
  }

  function shortenText(value, limit) {
    const text = String(value || '').trim();
    if (!text || text.length <= limit) return text;
    return `${text.slice(0, limit - 1)}…`;
  }

  function buildMessageTargetCaption(target) {
    const normalized = normalizeReminderMessageTarget(target);
    if (!normalized) return '';
    return `Ссылка: ${shortenText(normalized.url, 80)}`;
  }

  function isLikelyUrl(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    try {
      new URL(text);
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeUrlOrThrow(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      return new URL(text).toString();
    } catch (error) {
      throw new Error('Введите корректный URL сообщения.');
    }
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
        width: 56px;
        min-width: 56px;
      }

      .${NOTE_HEADER_CLASS} {
        min-width: 220px;
        width: 220px;
        max-width: 220px;
      }

      td.${ACTION_CELL_CLASS} {
        width: 56px;
        min-width: 56px;
        text-align: center;
        vertical-align: top;
        padding-top: 2px;
      }

      td.${NOTE_CELL_CLASS} {
        min-width: 220px;
        width: 220px;
        max-width: 220px;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.25;
        font-size: 12px;
        color: #344556;
        vertical-align: top;
        cursor: copy;
      }

      td.${NOTE_CELL_CLASS}.is-empty {
        color: #8d9aab;
        font-style: italic;
      }

      #${REQUESTS_TABLE_ID} [data-support-column-role="createdAt"] {
        min-width: 92px;
        width: 92px;
        max-width: 92px;
        white-space: normal;
        word-break: break-word;
        line-height: 1.2;
      }

      #${REQUESTS_TABLE_ID} [data-support-column-role="subject"] {
        min-width: 180px;
        width: 180px;
        max-width: 180px;
        white-space: normal;
        word-break: break-word;
        line-height: 1.2;
      }

      #${REQUESTS_TABLE_ID} [data-support-column-role="assignee"],
      #${REQUESTS_TABLE_ID} [data-support-column-role="initiator"] {
        min-width: 140px;
        width: 140px;
        max-width: 140px;
        white-space: normal;
        word-break: break-word;
        line-height: 1.2;
      }

      .${ACTION_BUTTON_CLASS} {
        min-width: 38px;
        width: auto;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 0 4px;
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

      .support-reminder-action-menu-link {
        font-size: 11px;
        color: #5f6f80;
        margin: -2px 0 8px 0;
        line-height: 1.35;
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

      .support-reminder-action-menu-btn:disabled {
        background: #f3f5f7;
        color: #7d8997;
        border-color: #d5dde6;
        cursor: default;
      }

      .support-reminder-action-menu-btn:disabled:hover {
        background: #f3f5f7;
      }

      .support-reminder-action-menu-btn.danger {
        border-color: #e6c1c1;
        background: #fff5f5;
        color: #8b2e2e;
      }

      .support-reminder-action-menu-btn.danger:hover {
        background: #ffecec;
      }

      #${DIALOG_OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.32);
      }

      #${DIALOG_OVERLAY_ID}[hidden] {
        display: none;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog {
        width: min(520px, calc(100vw - 32px));
        max-height: calc(100vh - 40px);
        overflow: auto;
        border-radius: 12px;
        border: 1px solid #ccd6e1;
        background: #fff;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.25);
        padding: 18px;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-title {
        margin: 0;
        font-size: 16px;
        color: #223244;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-request {
        margin: 6px 0 0 0;
        font-size: 12px;
        color: #607080;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-step-title {
        margin: 16px 0 8px 0;
        font-size: 13px;
        font-weight: 600;
        color: #223244;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-hint {
        margin: 0 0 10px 0;
        font-size: 12px;
        line-height: 1.35;
        color: #607080;
      }

      #${DIALOG_OVERLAY_ID} textarea,
      #${DIALOG_OVERLAY_ID} input[type="text"],
      #${DIALOG_OVERLAY_ID} input[type="url"] {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #c7d3df;
        border-radius: 8px;
        padding: 8px 10px;
        font: inherit;
        color: #223244;
        background: #fff;
      }

      #${DIALOG_OVERLAY_ID} textarea {
        min-height: 120px;
        resize: vertical;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-target {
        margin-top: 10px;
        border: 1px solid #d8e2ec;
        border-radius: 8px;
        background: #f7fafc;
        padding: 10px;
        font-size: 12px;
        line-height: 1.35;
        color: #425466;
        word-break: break-word;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-target.is-empty {
        color: #7b8997;
        font-style: italic;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-error {
        margin-top: 12px;
        border: 1px solid #f1c2c2;
        border-radius: 8px;
        background: #fff1f1;
        color: #8b2e2e;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.35;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      #${DIALOG_OVERLAY_ID} .support-reminder-dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }

      #${DIALOG_OVERLAY_ID} button {
        border: 1px solid #c6d3e0;
        border-radius: 8px;
        background: #f6f9fc;
        color: #1f3d5a;
        padding: 7px 10px;
        font-size: 12px;
        cursor: pointer;
      }

      #${DIALOG_OVERLAY_ID} button.primary {
        border-color: #3270d5;
        background: #3270d5;
        color: #fff;
      }

      #${DIALOG_OVERLAY_ID} button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      #${COPY_FEEDBACK_ID} {
        position: fixed;
        z-index: 2147483647;
        border-radius: 999px;
        background: rgba(24, 104, 56, 0.96);
        color: #fff;
        font-size: 11px;
        line-height: 1;
        padding: 6px 8px;
        box-shadow: 0 10px 20px rgba(15, 23, 42, 0.18);
        pointer-events: none;
      }

      #${COPY_FEEDBACK_ID}[hidden] {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function clearHighlights() {
    document.querySelectorAll(`tr.${HIGHLIGHT_CLASS}`).forEach((row) => {
      row.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  function ensureCopyFeedbackNode() {
    let node = document.getElementById(COPY_FEEDBACK_ID);
    if (node) return node;

    node = document.createElement('div');
    node.id = COPY_FEEDBACK_ID;
    node.textContent = 'Скопировано';
    node.hidden = true;
    document.body.appendChild(node);
    return node;
  }

  function showCopyFeedback(target) {
    const node = ensureCopyFeedbackNode();
    const rect = target.getBoundingClientRect();
    node.hidden = false;
    node.style.left = `${Math.min(window.innerWidth - 110, Math.max(8, rect.left))}px`;
    node.style.top = `${Math.max(8, rect.top - 34)}px`;
    clearTimeout(showCopyFeedback.timerId);
    showCopyFeedback.timerId = setTimeout(() => {
      node.hidden = true;
    }, 1200);
  }

  function getCellText(row, index) {
    const cell = row && row.cells && row.cells[index];
    return cell ? String(cell.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function applyCompactColumnRoles(table) {
    if (!table) return;

    const columns = detectColumnIndexes(table);
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    const bodyRows = Array.from((table.tBodies[0] || document.getElementById(REQUESTS_BODY_ID) || {}).rows || []);

    const applyRole = (cellIndex, role) => {
      if (headerRow && headerRow.cells[cellIndex]) {
        headerRow.cells[cellIndex].dataset.supportColumnRole = role;
      }
      bodyRows.forEach((row) => {
        if (row.cells[cellIndex]) {
          row.cells[cellIndex].dataset.supportColumnRole = role;
        }
      });
    };

    applyRole(columns.createdAt, 'createdAt');
    applyRole(columns.subject, 'subject');
    applyRole(columns.assignee, 'assignee');
    applyRole(columns.initiator, 'initiator');
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

  function ensureNoteHeader() {
    const table = document.getElementById(REQUESTS_TABLE_ID);
    if (!table) return;

    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) return;
    if (headerRow.querySelector(`.${NOTE_HEADER_CLASS}`)) return;

    const actionHeader = headerRow.querySelector(`.${ACTION_HEADER_CLASS}`);
    if (!actionHeader) return;

    const cell = document.createElement(headerRow.querySelector('th') ? 'th' : 'td');
    cell.className = NOTE_HEADER_CLASS;
    cell.textContent = 'Напоминание';
    headerRow.insertBefore(cell, actionHeader.nextElementSibling || null);
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

  function ensureNoteCell(row) {
    let noteCell = row.querySelector(`td.${NOTE_CELL_CLASS}`);
    if (!noteCell) {
      noteCell = document.createElement('td');
      noteCell.className = NOTE_CELL_CLASS;
      const actionCell = ensureActionCell(row);
      row.insertBefore(noteCell, actionCell.nextElementSibling || null);
    }
    return noteCell;
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
    const hasMessageTarget = !!(reminder && normalizeReminderMessageTarget(reminder.messageTarget));
    button.dataset.requestId = request.requestId;
    button.classList.toggle('has-reminder', !!reminder);
    button.classList.toggle('is-archived-reminder', archivedReminder);
    button.textContent = reminder
      ? (archivedReminder ? (hasMessageTarget ? '🗂📎' : '🗂') : (hasMessageTarget ? '🔔📎' : '🔔'))
      : '➕';
    button.title = reminder
      ? (
        note
          ? `${archivedReminder ? 'Архивное напоминание' : 'Напоминание'}${hasMessageTarget ? ' со связанным сообщением' : ''}: ${note}`
          : archivedReminder
            ? `Архивное напоминание${hasMessageTarget ? ' со связанным сообщением' : ''} без текста`
            : `Напоминание${hasMessageTarget ? ' со связанным сообщением' : ''} без текста`
      )
      : 'Создать напоминание';

    if (note) {
      row.setAttribute('title', `${archivedReminder ? 'Архивное напоминание' : 'Напоминание'}: ${note}`);
    } else {
      row.removeAttribute('title');
    }
  }

  function renderRowNoteCell(row, request) {
    const reminder = getTrackedReminder(request.requestId);
    const noteCell = ensureNoteCell(row);
    const note = reminder && reminder.note ? String(reminder.note).trim() : '';

    noteCell.textContent = note || '—';
    noteCell.title = note || 'Напоминание отсутствует';
    noteCell.classList.toggle('is-empty', !note);
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
        } else if (action === 'open-message') {
          await openReminderMessage(requestId);
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

  function appendMenuButton(menu, actionName, label, isDanger, disabled, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `support-reminder-action-menu-btn${isDanger ? ' danger' : ''}`;
    button.dataset.supportMenuAction = actionName;
    button.textContent = label;
    button.disabled = !!disabled;
    if (title) button.title = title;
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

    const messageCaption = reminder ? buildMessageTargetCaption(reminder.messageTarget) : '';
    if (messageCaption) {
      const linkNote = document.createElement('div');
      linkNote.className = 'support-reminder-action-menu-link';
      linkNote.textContent = messageCaption;
      menu.appendChild(linkNote);
    }

    const hasMessageTarget = !!messageCaption;

    if (!reminder) {
      appendMenuButton(menu, 'create', 'Создать', false);
    } else if (archivedReminder) {
      appendMenuButton(
        menu,
        'open-message',
        'Перейти к сообщению',
        false,
        !hasMessageTarget,
        hasMessageTarget ? '' : 'Сначала сохраните URL для этого напоминания.'
      );
      appendMenuButton(menu, 'delete-archive', 'Удалить из архива', true);
    } else {
      appendMenuButton(
        menu,
        'open-message',
        'Перейти к сообщению',
        false,
        !hasMessageTarget,
        hasMessageTarget ? '' : 'Сначала сохраните URL для этого напоминания.'
      );
      appendMenuButton(menu, 'edit', 'Редактировать', false);
      appendMenuButton(menu, 'delete', 'Удалить', true);
    }

    menu.hidden = false;
    positionActionMenu(menu, anchorButton);
  }

  async function openReminderMessage(requestId) {
    await sendRuntimeMessage('SUPPORT_OPEN_REMINDER_MESSAGE', { requestId });
  }

  function showReminderDialog(request, existingReminder) {
    const initialReminder = existingReminder || null;
    const overlay = document.createElement('div');
    overlay.id = DIALOG_OVERLAY_ID;
    overlay.innerHTML = `
      <div class="support-reminder-dialog" role="dialog" aria-modal="true">
        <h3 class="support-reminder-dialog-title">Напоминание по заявке</h3>
        <p class="support-reminder-dialog-request"></p>
        <div class="support-reminder-dialog-step support-reminder-dialog-step-1">
          <div class="support-reminder-dialog-step-title">Шаг 1. Текст напоминания</div>
          <p class="support-reminder-dialog-hint">Введите текст, который нужно видеть рядом с заявкой в списке.</p>
          <textarea class="support-reminder-dialog-note-input"></textarea>
        </div>
        <div class="support-reminder-dialog-step support-reminder-dialog-step-2" hidden>
          <div class="support-reminder-dialog-step-title">Шаг 2. Связанное сообщение</div>
          <p class="support-reminder-dialog-hint">Можно оставить поле пустым или указать URL на связанное сообщение.</p>
          <input class="support-reminder-dialog-url-input" type="url" placeholder="https://...">
          <div class="support-reminder-dialog-actions">
            <button type="button" data-dialog-action="paste-url">Вставить URL из буфера</button>
            <button type="button" data-dialog-action="clear-target">Очистить</button>
          </div>
          <div class="support-reminder-dialog-target is-empty">Связанное сообщение не выбрано.</div>
        </div>
        <div class="support-reminder-dialog-error" hidden></div>
        <div class="support-reminder-dialog-footer">
          <button type="button" data-dialog-action="cancel">Отмена</button>
          <button type="button" data-dialog-action="back" hidden>Назад</button>
          <button type="button" class="primary" data-dialog-action="next">Далее</button>
          <button type="button" class="primary" data-dialog-action="save" hidden>Сохранить</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const requestNode = overlay.querySelector('.support-reminder-dialog-request');
    const stepOne = overlay.querySelector('.support-reminder-dialog-step-1');
    const stepTwo = overlay.querySelector('.support-reminder-dialog-step-2');
    const noteInput = overlay.querySelector('.support-reminder-dialog-note-input');
    const urlInput = overlay.querySelector('.support-reminder-dialog-url-input');
    const targetNode = overlay.querySelector('.support-reminder-dialog-target');
    const errorNode = overlay.querySelector('.support-reminder-dialog-error');
    const cancelButton = overlay.querySelector('[data-dialog-action="cancel"]');
    const backButton = overlay.querySelector('[data-dialog-action="back"]');
    const nextButton = overlay.querySelector('[data-dialog-action="next"]');
    const saveButton = overlay.querySelector('[data-dialog-action="save"]');
    const pasteUrlButton = overlay.querySelector('[data-dialog-action="paste-url"]');
    const clearTargetButton = overlay.querySelector('[data-dialog-action="clear-target"]');

    requestNode.textContent = request && request.requestNumber
      ? `Заявка № ${request.requestNumber}`
      : `Заявка ${request && request.requestId ? request.requestId : ''}`;
    noteInput.value = initialReminder && initialReminder.note ? String(initialReminder.note) : '';

    let currentStep = 1;
    let currentMessageTarget = cloneMessageTarget(initialReminder && initialReminder.messageTarget);
    if (currentMessageTarget && currentMessageTarget.kind === 'url') {
      urlInput.value = currentMessageTarget.url;
    }

    const allButtons = [
      cancelButton,
      backButton,
      nextButton,
      saveButton,
      pasteUrlButton,
      clearTargetButton
    ];

    const setError = (message) => {
      const text = String(message || '').trim();
      errorNode.hidden = !text;
      errorNode.textContent = text;
    };

    const setBusy = (busy) => {
      allButtons.forEach((button) => {
        button.disabled = !!busy;
      });
      noteInput.disabled = !!busy;
      urlInput.disabled = !!busy;
    };

    const updateTargetView = () => {
      const caption = buildMessageTargetCaption(currentMessageTarget);
      targetNode.textContent = caption || 'Связанное сообщение не выбрано.';
      targetNode.classList.toggle('is-empty', !caption);
    };

    const syncTargetFromUrl = () => {
      const rawUrl = String(urlInput.value || '').trim();
      if (!rawUrl) {
        if (currentMessageTarget && currentMessageTarget.kind === 'url') {
          currentMessageTarget = null;
        }
        updateTargetView();
        return;
      }

      currentMessageTarget = {
        kind: 'url',
        url: rawUrl
      };
      updateTargetView();
    };

    const updateStep = () => {
      const isSecondStep = currentStep === 2;
      stepOne.hidden = isSecondStep;
      stepTwo.hidden = !isSecondStep;
      backButton.hidden = !isSecondStep;
      nextButton.hidden = isSecondStep;
      saveButton.hidden = !isSecondStep;
      if (isSecondStep) {
        urlInput.focus();
      } else {
        noteInput.focus();
      }
    };

    updateTargetView();
    updateStep();

    return new Promise((resolve) => {
      const cleanup = (result) => {
        document.removeEventListener('keydown', handleKeyDown, true);
        overlay.remove();
        resolve(result);
      };

      const handleKeyDown = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      };

      const saveReminder = () => {
        const note = String(noteInput.value || '').trim();
        if (!note) {
          setError('Текст напоминания не может быть пустым.');
          currentStep = 1;
          updateStep();
          return;
        }

        const normalizedUrl = normalizeUrlOrThrow(urlInput.value);
        if (normalizedUrl) {
          currentMessageTarget = {
            kind: 'url',
            url: normalizedUrl
          };
        } else if (currentMessageTarget && currentMessageTarget.kind === 'url') {
          currentMessageTarget = null;
        }

        cleanup({
          note,
          messageTarget: cloneMessageTarget(currentMessageTarget)
        });
      };

      const activatePrimaryAction = () => {
        if (currentStep === 1) {
          nextButton.click();
          return;
        }
        saveButton.click();
      };

      document.addEventListener('keydown', handleKeyDown, true);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          cleanup(null);
        }
      });
      urlInput.addEventListener('input', () => {
        setError('');
        syncTargetFromUrl();
      });
      noteInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        activatePrimaryAction();
      });
      urlInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        activatePrimaryAction();
      });
      cancelButton.addEventListener('click', () => cleanup(null));
      backButton.addEventListener('click', () => {
        setError('');
        currentStep = 1;
        updateStep();
      });
      nextButton.addEventListener('click', () => {
        const note = String(noteInput.value || '').trim();
        if (!note) {
          setError('Текст напоминания не может быть пустым.');
          return;
        }
        setError('');
        currentStep = 2;
        updateStep();
      });
      saveButton.addEventListener('click', () => {
        try {
          setError('');
          saveReminder();
        } catch (error) {
          setError(error.message);
        }
      });
      pasteUrlButton.addEventListener('click', async () => {
        try {
          setBusy(true);
          setError('');
          const clipboardText = String(await navigator.clipboard.readText() || '').trim();
          if (!clipboardText) {
            throw new Error('Буфер обмена пуст.');
          }
          if (!isLikelyUrl(clipboardText)) {
            throw new Error('В буфере обмена нет корректного URL.');
          }
          urlInput.value = clipboardText;
          syncTargetFromUrl();
        } catch (error) {
          setError(error.message);
        } finally {
          setBusy(false);
        }
      });
      clearTargetButton.addEventListener('click', () => {
        currentMessageTarget = null;
        urlInput.value = '';
        setError('');
        updateTargetView();
      });
    });
  }

  async function upsertReminder(requestId) {
    const existing = remindersById[requestId] || archiveById[requestId] || null;
    const sourceRequest = latestRequestsById.get(requestId)
      || (existing && existing.lastKnown)
      || null;

    if (!sourceRequest) {
      alert('Не удалось найти данные заявки для сохранения напоминания.');
      return;
    }

    const dialogResult = await showReminderDialog(sourceRequest, existing);
    if (!dialogResult) return;

    const response = await sendRuntimeMessage('SUPPORT_UPSERT_REMINDER', {
      request: sourceRequest,
      note: dialogResult.note,
      messageTarget: dialogResult.messageTarget
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
    ensureNoteHeader();
    latestRequestsById = new Map();
    applyCompactColumnRoles(document.getElementById(REQUESTS_TABLE_ID));

    snapshot.requests.forEach((request) => {
      latestRequestsById.set(request.requestId, request);
      const row = snapshot.rowById.get(request.requestId);
      if (!row) return;

      renderRowActionButton(row, request);
      renderRowNoteCell(row, request);

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

  async function handleTableContextMenu(event) {
    if (document.getElementById(DIALOG_OVERLAY_ID)) return;
    const cell = event.target.closest(`#${REQUESTS_TABLE_ID} td`);
    if (!cell) return;
    if (cell.classList.contains(ACTION_CELL_CLASS)) return;
    if (cell.querySelector('button, input, textarea, select, a')) return;

    const text = String(cell.innerText || cell.textContent || '').trim();
    if (!text) return;

    event.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(cell);
    } catch (error) {
      console.warn('Не удалось скопировать текст ячейки support:', error);
    }
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
    document.addEventListener('contextmenu', handleTableContextMenu, true);
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
