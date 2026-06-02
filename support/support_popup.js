(function () {
  const STORAGE_KEY = 'support_reminders_state_v1';
  const SUPPORT_HOST = 'support.vostok-electra.ru';
  const DEFAULT_STAGE_LABEL = '2.4 Подтверждение решения и закрытие Запроса';
  const AUTO_REFRESH_MS = 5000;
  const SUPPORTED_FILTER_HINT = 'Открытые обращения, Мои задачи, Список обращений или Закрытые обращения';
  const MAX_MSG_FILE_BYTES = 3 * 1024 * 1024;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toDateString(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    return date.toLocaleString('ru-RU');
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

    if (rawKind !== 'msg_file' && rawKind !== 'msg-file' && rawKind !== 'msg') {
      return null;
    }

    const dataBase64 = String(rawTarget.dataBase64 || rawTarget.base64 || '').trim();
    if (!dataBase64) return null;

    const fileName = String(rawTarget.fileName || '').trim() || 'support-message.msg';
    const mimeType = String(rawTarget.mimeType || '').trim() || 'application/vnd.ms-outlook';
    const sizeBytesRaw = Number(rawTarget.sizeBytes);
    const sizeBytes = Number.isFinite(sizeBytesRaw) && sizeBytesRaw > 0
      ? Math.floor(sizeBytesRaw)
      : Math.floor((dataBase64.length * 3) / 4);

    return {
      kind: 'msg_file',
      fileName,
      mimeType,
      sizeBytes,
      dataBase64
    };
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
    if (normalized.kind === 'url') {
      return `Связанное сообщение: ${shortenText(normalized.url, 72)}`;
    }
    const sizeKb = normalized.sizeBytes > 0 ? `, ${Math.max(1, Math.round(normalized.sizeBytes / 1024))} КБ` : '';
    return `Связанное сообщение: ${normalized.fileName}${sizeKb}`;
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
      throw new Error('Введите корректный URL сообщения или вставьте .msg из буфера обмена.');
    }
  }

  function buildMsgFileName(request) {
    const base = String(request && (request.requestNumber || request.requestId) || 'support-message')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .trim();
    return `${base || 'support-message'}.msg`;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => {
        reject(new Error('Не удалось подготовить файл .msg для сохранения.'));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function readMsgFileFromClipboard(request) {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      throw new Error('Браузер не позволяет читать файлы из буфера обмена.');
    }

    const items = await navigator.clipboard.read();
    const hasOnlyTextTypes = items.length > 0 && items.every((item) => (
      Array.from(item.types || []).every((type) => (
        type === 'text/plain' || type === 'text/html' || type === 'text/uri-list'
      ))
    ));

    for (const item of items) {
      const types = Array.from(item.types || []);
      for (const type of types) {
        if (type === 'text/plain' || type === 'text/html' || type === 'text/uri-list') continue;

        let blob = null;
        try {
          blob = await item.getType(type);
        } catch (error) {
          blob = null;
        }
        if (!blob || !blob.size) continue;

        if (blob.size > MAX_MSG_FILE_BYTES) {
          throw new Error('Файл .msg слишком большой. Разрешено не более 3 МБ.');
        }

        return {
          kind: 'msg_file',
          fileName: buildMsgFileName(request),
          mimeType: String(blob.type || type || 'application/vnd.ms-outlook').trim() || 'application/vnd.ms-outlook',
          sizeBytes: blob.size,
          dataBase64: await blobToBase64(blob)
        };
      }
    }

    if (hasOnlyTextTypes) {
      throw new Error('Chrome получает из буфера Outlook только текст, а не сам .msg. Вставьте URL или выберите сохраненный .msg файлом.');
    }

    throw new Error('В буфере обмена не найден файл .msg.');
  }

  async function buildMessageTargetFromFile(file, request) {
    if (!file) {
      throw new Error('Файл .msg не выбран.');
    }
    if (file.size > MAX_MSG_FILE_BYTES) {
      throw new Error('Файл .msg слишком большой. Разрешено не более 3 МБ.');
    }

    return {
      kind: 'msg_file',
      fileName: String(file.name || '').trim() || buildMsgFileName(request),
      mimeType: String(file.type || 'application/vnd.ms-outlook').trim() || 'application/vnd.ms-outlook',
      sizeBytes: file.size,
      dataBase64: await blobToBase64(file)
    };
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

  function sendTabMessage(tabId, action, data) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('Нет ответа от content-скрипта вкладки.'));
          return;
        }
        if (response.success === false) {
          reject(new Error(response.error || 'Неизвестная ошибка вкладки.'));
          return;
        }
        resolve(response);
      });
    });
  }

  function ensurePanelStyles() {
    if (document.getElementById('support-popup-style')) return;

    const style = document.createElement('style');
    style.id = 'support-popup-style';
    style.textContent = `
      #support-reminder-root {
        font-family: Arial, sans-serif;
      }

      .support-root {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .support-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .support-title {
        margin: 0;
        font-size: 14px;
        line-height: 1.2;
      }

      .support-btn {
        border: 1px solid #c7d1dc;
        border-radius: 6px;
        background: #f5f8fb;
        padding: 5px 8px;
        font-size: 12px;
        cursor: pointer;
      }

      .support-btn:hover {
        background: #eaf1f8;
      }

      .support-btn:disabled {
        opacity: 0.6;
        cursor: default;
        background: #f3f5f7;
      }

      .support-btn.danger {
        border-color: #e3b5b5;
        background: #fff2f2;
      }

      .support-status {
        font-size: 12px;
        padding: 6px 8px;
        border-radius: 6px;
        background: #f3f5f7;
        color: #3b4552;
      }

      .support-status.error {
        background: #ffe7e7;
        color: #8f2d2d;
      }

      .support-status.ok {
        background: #e8f6ec;
        color: #216738;
      }

      .support-section {
        border: 1px solid #dde5ed;
        border-radius: 8px;
        overflow: hidden;
      }

      .support-section.open-requests {
        border-color: #b8ddc6;
        background: #f2fcf5;
      }

      .support-section.open-requests .support-section-title {
        background: #dff4e7;
        color: #215f39;
      }

      .support-section.reminder-panel {
        border-color: #bfd0ea;
        background: #f5f8ff;
      }

      .support-section.reminder-panel .support-section-title {
        background: #e5ecfb;
        color: #24456f;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .support-section-title {
        font-size: 12px;
        font-weight: bold;
        padding: 6px 8px;
      }

      .support-tabs {
        display: flex;
        gap: 6px;
      }

      .support-tab {
        border: 1px solid #b8c9de;
        background: #f5f8ff;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        cursor: pointer;
      }

      .support-tab.active {
        border-color: #2e6bd9;
        background: #2e6bd9;
        color: #fff;
      }

      .support-list {
        max-height: 260px;
        overflow-y: auto;
      }

      .support-item {
        border-top: 1px solid #edf1f5;
        padding: 8px;
      }

      .support-item:first-child {
        border-top: none;
      }

      .support-item-title {
        font-size: 12px;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .support-item-text {
        font-size: 12px;
        margin-bottom: 3px;
        color: #2f3b47;
      }

      .support-item-meta {
        font-size: 11px;
        color: #5c6a77;
        margin-bottom: 6px;
      }

      .support-item-note {
        background: #fff8e5;
        border: 1px solid #f0dfab;
        border-radius: 6px;
        padding: 5px 6px;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .support-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .support-empty {
        padding: 8px;
        font-size: 12px;
        color: #6a7785;
      }

      .support-message-meta {
        font-size: 11px;
        color: #5f6f80;
        margin-bottom: 6px;
        word-break: break-word;
      }

      .support-dialog-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15, 23, 42, 0.32);
      }

      .support-dialog-overlay[hidden] {
        display: none;
      }

      .support-dialog {
        width: min(520px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        overflow: auto;
        border-radius: 12px;
        border: 1px solid #ccd6e1;
        background: #fff;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.25);
        padding: 18px;
      }

      .support-dialog-title {
        margin: 0;
        font-size: 16px;
        color: #223244;
      }

      .support-dialog-request {
        margin: 6px 0 0 0;
        font-size: 12px;
        color: #607080;
      }

      .support-dialog-step-title {
        margin: 16px 0 8px 0;
        font-size: 13px;
        font-weight: 600;
        color: #223244;
      }

      .support-dialog-hint {
        margin: 0 0 10px 0;
        font-size: 12px;
        line-height: 1.35;
        color: #607080;
      }

      .support-dialog textarea,
      .support-dialog input[type="url"] {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #c7d3df;
        border-radius: 8px;
        padding: 8px 10px;
        font: inherit;
        color: #223244;
        background: #fff;
      }

      .support-dialog textarea {
        min-height: 120px;
        resize: vertical;
      }

      .support-dialog-target {
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

      .support-dialog-target.is-empty {
        color: #7b8997;
        font-style: italic;
      }

      .support-dialog-error {
        margin-top: 12px;
        border: 1px solid #f1c2c2;
        border-radius: 8px;
        background: #fff1f1;
        color: #8b2e2e;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.35;
      }

      .support-dialog-inline-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .support-dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }

      .support-dialog .primary {
        border-color: #3270d5;
        background: #3270d5;
        color: #fff;
      }

      .support-dialog button:disabled {
        opacity: 0.6;
        cursor: default;
      }
    `;

    document.head.appendChild(style);
  }

  window.initSupportSidePanel = function initSupportSidePanel(config) {
    const root = config && config.root;
    const activeTab = config && config.activeTab;

    if (!root) return;

    ensurePanelStyles();
    root.innerHTML = `
      <div class="support-root">
        <div class="support-header">
          <h2 class="support-title">Напоминания для support.vostok-electra.ru</h2>
          <button class="support-btn" id="support-refresh-btn">Обновить</button>
        </div>
        <div class="support-status" id="support-status">Загрузка...</div>

        <div class="support-section open-requests">
          <div class="support-section-title" id="support-current-list-title">Текущий список</div>
          <div class="support-list" id="support-open-list"></div>
        </div>

        <div class="support-section reminder-panel">
          <div class="support-section-title">
            <span id="support-reminder-title">Активные напоминания</span>
            <div class="support-tabs">
              <button class="support-tab active" data-switch-tab="active">Активные</button>
              <button class="support-tab" data-switch-tab="archive">Архив</button>
            </div>
          </div>
          <div class="support-list" id="support-reminder-list"></div>
        </div>

        <div class="support-dialog-overlay" id="support-reminder-dialog-overlay" hidden></div>
      </div>
    `;

    const statusNode = root.querySelector('#support-status');
    const openListNode = root.querySelector('#support-open-list');
    const currentListTitleNode = root.querySelector('#support-current-list-title');
    const reminderTitleNode = root.querySelector('#support-reminder-title');
    const reminderListNode = root.querySelector('#support-reminder-list');
    const refreshButton = root.querySelector('#support-refresh-btn');
    const reminderDialogOverlay = root.querySelector('#support-reminder-dialog-overlay');

    const state = {
      tabId: activeTab && typeof activeTab.id === 'number' ? activeTab.id : null,
      isSupportTab: false,
      targetStage: DEFAULT_STAGE_LABEL,
      trackedFilterActive: false,
      activeFilterType: '',
      activeFilterLabel: '',
      snapshotReady: false,
      currentRequests: [],
      activeReminders: [],
      archivedReminders: [],
      remindersById: {},
      archiveById: {},
      reminderTab: 'active'
    };

    let isLoading = false;
    let queuedReload = false;
    let queuedShowSuccess = false;

    function setStatus(text, mode) {
      statusNode.textContent = text;
      statusNode.classList.remove('error', 'ok');
      if (mode === 'error') statusNode.classList.add('error');
      if (mode === 'ok') statusNode.classList.add('ok');
    }

    function statusSummary() {
      return `Активных: ${state.activeReminders.length}, в архиве: ${state.archivedReminders.length}. Целевой этап: ${state.targetStage}.`;
    }

    function currentListTitle() {
      return state.activeFilterLabel || 'Текущий список';
    }

    function buildRequestMeta(request) {
      const parts = [];
      if (request.status) parts.push(`Статус: ${escapeHtml(request.status)}`);
      if (request.stage) parts.push(`Этап: ${escapeHtml(request.stage)}`);
      return parts.length ? parts.join(' | ') : 'Статус и этап не определены.';
    }

    function getRequestsWithoutReminders() {
      return state.currentRequests.filter((request) => {
        if (state.remindersById[request.requestId]) return false;
        if (state.archiveById[request.requestId]) return false;
        return true;
      });
    }

    function switchReminderTab(tabName) {
      state.reminderTab = tabName === 'archive' ? 'archive' : 'active';
      root.querySelectorAll('button[data-switch-tab]').forEach((button) => {
        const isActive = button.dataset.switchTab === state.reminderTab;
        button.classList.toggle('active', isActive);
      });
      reminderTitleNode.textContent = state.reminderTab === 'archive' ? 'Архивные напоминания' : 'Активные напоминания';
      renderReminderList();
    }

    function renderCurrentRequests() {
      currentListTitleNode.textContent = currentListTitle();

      if (!state.tabId) {
        openListNode.innerHTML = '<div class="support-empty">Активная вкладка недоступна.</div>';
        return;
      }

      if (!state.trackedFilterActive) {
        openListNode.innerHTML = `<div class="support-empty">Выберите на ${SUPPORT_HOST} одну из вкладок: ${SUPPORTED_FILTER_HINT}.</div>`;
        return;
      }

      if (!state.snapshotReady) {
        openListNode.innerHTML = `<div class="support-empty">Список "${escapeHtml(currentListTitle())}" загружается...</div>`;
        return;
      }

      if (!state.currentRequests.length) {
        openListNode.innerHTML = `<div class="support-empty">Список "${escapeHtml(currentListTitle())}" пуст.</div>`;
        return;
      }

      const visibleRequests = getRequestsWithoutReminders();
      if (!visibleRequests.length) {
        openListNode.innerHTML = `<div class="support-empty">В списке "${escapeHtml(currentListTitle())}" нет заявок без напоминаний.</div>`;
        return;
      }

      openListNode.innerHTML = visibleRequests.map((request) => {
        const primaryButton = `<button class="support-btn" data-action="add-current" data-request-id="${escapeHtml(request.requestId)}">Добавить</button>`;

        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(request.requestNumber || request.requestId)}</div>
            <div class="support-item-text">${escapeHtml(request.subject || '(без темы)')}</div>
            <div class="support-item-meta">${buildRequestMeta(request)}</div>
            <div class="support-actions">
              ${primaryButton}
            </div>
          </div>
        `;
      }).join('');
    }

    function renderActiveReminders() {
      if (!state.activeReminders.length) {
        return '<div class="support-empty">Активных напоминаний пока нет.</div>';
      }

      return state.activeReminders.map((reminder) => {
        const known = reminder.lastKnown || {};
        const messageCaption = buildMessageTargetCaption(reminder.messageTarget);
        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(known.requestNumber || reminder.requestId)}</div>
            <div class="support-item-text">${escapeHtml(known.subject || '(без темы)')}</div>
            <div class="support-item-meta">Этап: ${escapeHtml(known.stage || '—')}</div>
            <div class="support-item-note">${escapeHtml(reminder.note || '')}</div>
            ${messageCaption ? `<div class="support-message-meta">${escapeHtml(messageCaption)}</div>` : ''}
            <div class="support-actions">
              <button class="support-btn" data-action="open-message" data-request-id="${escapeHtml(reminder.requestId)}"${messageCaption ? '' : ' disabled title="Сначала сохраните URL или .msg для этого напоминания."'}>Ответить на сообщение</button>
              <button class="support-btn" data-action="edit-active" data-request-id="${escapeHtml(reminder.requestId)}">Изменить</button>
              <button class="support-btn danger" data-action="delete-active" data-request-id="${escapeHtml(reminder.requestId)}">Удалить</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderArchiveReminders() {
      if (!state.archivedReminders.length) {
        return '<div class="support-empty">Архив пуст.</div>';
      }

      return state.archivedReminders.map((archive) => {
        const known = archive.lastKnown || {};
        const messageCaption = buildMessageTargetCaption(archive.messageTarget);
        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(known.requestNumber || archive.requestId)}</div>
            <div class="support-item-text">${escapeHtml(known.subject || '(без темы)')}</div>
            <div class="support-item-meta">В архиве: ${escapeHtml(toDateString(archive.archivedAt))}</div>
            <div class="support-item-note">${escapeHtml(archive.note || '')}</div>
            ${messageCaption ? `<div class="support-message-meta">${escapeHtml(messageCaption)}</div>` : ''}
            <div class="support-actions">
              <button class="support-btn" data-action="open-message" data-request-id="${escapeHtml(archive.requestId)}"${messageCaption ? '' : ' disabled title="Сначала сохраните URL или .msg для этого напоминания."'}>Ответить на сообщение</button>
              <button class="support-btn" data-action="restore-archive" data-request-id="${escapeHtml(archive.requestId)}">Вернуть</button>
              <button class="support-btn danger" data-action="delete-archive" data-request-id="${escapeHtml(archive.requestId)}">Удалить</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderReminderList() {
      reminderListNode.innerHTML = state.reminderTab === 'archive'
        ? renderArchiveReminders()
        : renderActiveReminders();
    }

    function renderAll() {
      renderCurrentRequests();
      renderReminderList();
    }

    function applyBackgroundState(response) {
      state.targetStage = response.targetStage || DEFAULT_STAGE_LABEL;
      state.activeReminders = Array.isArray(response.activeReminders) ? response.activeReminders : [];
      state.archivedReminders = Array.isArray(response.archivedReminders) ? response.archivedReminders : [];
      state.remindersById = response.remindersById || {};
      state.archiveById = response.archiveById || {};
    }

    function findCurrentRequest(requestId) {
      return state.currentRequests.find((item) => item.requestId === requestId) || null;
    }

    function findReminderRequestFallback(requestId) {
      const reminder = state.remindersById[requestId];
      if (reminder && reminder.lastKnown) return reminder.lastKnown;
      const archive = state.archiveById[requestId];
      if (archive && archive.lastKnown) return archive.lastKnown;
      return null;
    }

    function showReminderDialog(request, existingReminder) {
      reminderDialogOverlay.hidden = false;
      reminderDialogOverlay.innerHTML = `
        <div class="support-dialog" role="dialog" aria-modal="true">
          <h3 class="support-dialog-title">Напоминание по заявке</h3>
          <p class="support-dialog-request"></p>
          <div class="support-dialog-step support-dialog-step-1">
            <div class="support-dialog-step-title">Шаг 1. Текст напоминания</div>
            <p class="support-dialog-hint">Введите текст, который нужно видеть рядом с заявкой в списке.</p>
            <textarea class="support-dialog-note-input"></textarea>
          </div>
          <div class="support-dialog-step support-dialog-step-2" hidden>
            <div class="support-dialog-step-title">Шаг 2. Связанное сообщение</div>
            <p class="support-dialog-hint">Можно оставить поле пустым, вставить URL на сообщение или сохранить .msg из буфера обмена.</p>
            <p class="support-dialog-hint">Если сообщение скопировано прямо из Outlook, Chrome часто получает только текст. В таком случае сохраните письмо в файл .msg и выберите его вручную.</p>
            <input class="support-dialog-url-input" type="url" placeholder="https://...">
            <div class="support-dialog-inline-actions">
              <button type="button" data-dialog-action="paste-url">Вставить URL из буфера</button>
              <button type="button" data-dialog-action="paste-msg">Вставить .msg из буфера</button>
              <button type="button" data-dialog-action="pick-msg">Выбрать .msg файл</button>
              <button type="button" data-dialog-action="clear-target">Очистить</button>
            </div>
            <div class="support-dialog-target is-empty">Связанное сообщение не выбрано.</div>
            <input class="support-dialog-file-input" type="file" accept=".msg,application/vnd.ms-outlook,application/octet-stream" hidden>
          </div>
          <div class="support-dialog-error" hidden></div>
          <div class="support-dialog-footer">
            <button type="button" data-dialog-action="cancel">Отмена</button>
            <button type="button" data-dialog-action="back" hidden>Назад</button>
            <button type="button" class="primary" data-dialog-action="next">Далее</button>
            <button type="button" class="primary" data-dialog-action="save" hidden>Сохранить</button>
          </div>
        </div>
      `;

      const requestNode = reminderDialogOverlay.querySelector('.support-dialog-request');
      const stepOne = reminderDialogOverlay.querySelector('.support-dialog-step-1');
      const stepTwo = reminderDialogOverlay.querySelector('.support-dialog-step-2');
      const noteInput = reminderDialogOverlay.querySelector('.support-dialog-note-input');
      const urlInput = reminderDialogOverlay.querySelector('.support-dialog-url-input');
      const targetNode = reminderDialogOverlay.querySelector('.support-dialog-target');
      const errorNode = reminderDialogOverlay.querySelector('.support-dialog-error');
      const cancelButton = reminderDialogOverlay.querySelector('[data-dialog-action="cancel"]');
      const backButton = reminderDialogOverlay.querySelector('[data-dialog-action="back"]');
      const nextButton = reminderDialogOverlay.querySelector('[data-dialog-action="next"]');
      const saveButton = reminderDialogOverlay.querySelector('[data-dialog-action="save"]');
      const pasteUrlButton = reminderDialogOverlay.querySelector('[data-dialog-action="paste-url"]');
      const pasteMsgButton = reminderDialogOverlay.querySelector('[data-dialog-action="paste-msg"]');
      const pickMsgButton = reminderDialogOverlay.querySelector('[data-dialog-action="pick-msg"]');
      const clearTargetButton = reminderDialogOverlay.querySelector('[data-dialog-action="clear-target"]');
      const fileInput = reminderDialogOverlay.querySelector('.support-dialog-file-input');

      requestNode.textContent = request && request.requestNumber
        ? `Заявка № ${request.requestNumber}`
        : `Заявка ${request && request.requestId ? request.requestId : ''}`;
      noteInput.value = existingReminder && existingReminder.note ? String(existingReminder.note) : '';

      let currentStep = 1;
      let currentMessageTarget = cloneMessageTarget(existingReminder && existingReminder.messageTarget);
      if (currentMessageTarget && currentMessageTarget.kind === 'url') {
        urlInput.value = currentMessageTarget.url;
      }

      const allButtons = [
        cancelButton,
        backButton,
        nextButton,
        saveButton,
        pasteUrlButton,
        pasteMsgButton,
        pickMsgButton,
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
          reminderDialogOverlay.hidden = true;
          reminderDialogOverlay.innerHTML = '';
          resolve(result);
        };

        const handleKeyDown = (event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          cleanup(null);
        };

        document.addEventListener('keydown', handleKeyDown, true);
        reminderDialogOverlay.addEventListener('click', (event) => {
          if (event.target === reminderDialogOverlay) {
            cleanup(null);
          }
        });
        urlInput.addEventListener('input', () => {
          setError('');
          syncTargetFromUrl();
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
        pasteMsgButton.addEventListener('click', async () => {
          try {
            setBusy(true);
            setError('');
            currentMessageTarget = await readMsgFileFromClipboard(request);
            urlInput.value = '';
            updateTargetView();
          } catch (error) {
            setError(error.message);
          } finally {
            setBusy(false);
          }
        });
        pickMsgButton.addEventListener('click', () => {
          fileInput.click();
        });
        fileInput.addEventListener('change', async () => {
          const [file] = Array.from(fileInput.files || []);
          if (!file) return;
          try {
            setBusy(true);
            setError('');
            currentMessageTarget = await buildMessageTargetFromFile(file, request);
            urlInput.value = '';
            updateTargetView();
          } catch (error) {
            setError(error.message);
          } finally {
            fileInput.value = '';
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

    async function openReminderMessage(requestId) {
      const response = await sendRuntimeMessage('SUPPORT_OPEN_REMINDER_MESSAGE', { requestId });
      if (response.kind === 'msg_file' && !response.opened) {
        const extra = response.error ? ` ${response.error}` : '';
        setStatus(`Файл .msg сохранен в загрузки. Если Outlook не открыл его автоматически, откройте файл вручную.${extra}`, 'ok');
      }
    }

    async function upsertReminder(requestId) {
      const existing = state.remindersById[requestId] || state.archiveById[requestId] || null;
      const sourceRequest = findCurrentRequest(requestId) || findReminderRequestFallback(requestId);
      if (!sourceRequest) {
        alert('Не удалось найти данные заявки для создания напоминания.');
        return;
      }

      const dialogResult = await showReminderDialog(sourceRequest, existing);
      if (!dialogResult) return;

      await sendRuntimeMessage('SUPPORT_UPSERT_REMINDER', {
        request: sourceRequest,
        note: dialogResult.note,
        messageTarget: dialogResult.messageTarget
      });
    }

    async function deleteReminder(requestId) {
      if (!confirm('Удалить напоминание?')) return;
      await sendRuntimeMessage('SUPPORT_DELETE_REMINDER', { requestId });
    }

    async function deleteArchive(requestId) {
      if (!confirm('Удалить запись из архива?')) return;
      await sendRuntimeMessage('SUPPORT_DELETE_ARCHIVE', { requestId });
    }

    async function restoreArchive(requestId) {
      await sendRuntimeMessage('SUPPORT_RESTORE_ARCHIVE', { requestId });
    }

    async function syncFromActiveTab() {
      if (!state.tabId || !state.isSupportTab) {
        state.trackedFilterActive = false;
        state.activeFilterType = '';
        state.activeFilterLabel = '';
        state.snapshotReady = false;
        state.currentRequests = [];
        return null;
      }

      const tabResponse = await sendTabMessage(state.tabId, 'SUPPORT_GET_REQUEST_SNAPSHOT');
      state.trackedFilterActive = !!tabResponse.trackedFilterActive;
      state.activeFilterType = String(tabResponse.activeFilterType || '').trim();
      state.activeFilterLabel = String(tabResponse.activeFilterLabel || '').trim();
      state.snapshotReady = !!tabResponse.snapshotReady;
      state.currentRequests = Array.isArray(tabResponse.requests) ? tabResponse.requests : [];

      await sendRuntimeMessage('SUPPORT_SYNC_REQUESTS', {
        activeFilterType: state.activeFilterType,
        activeFilterLabel: state.activeFilterLabel,
        trackedFilterActive: state.trackedFilterActive,
        requests: state.currentRequests,
        snapshotReady: state.snapshotReady
      });

      return null;
    }

    async function loadAll(showSuccessStatus) {
      if (isLoading) {
        queuedReload = true;
        queuedShowSuccess = queuedShowSuccess || !!showSuccessStatus;
        return;
      }

      isLoading = true;
      try {
        let tabSyncError = null;
        try {
          await syncFromActiveTab();
        } catch (error) {
          tabSyncError = error;
          state.trackedFilterActive = false;
          state.activeFilterType = '';
          state.activeFilterLabel = '';
          state.snapshotReady = false;
          state.currentRequests = [];
        }

        const stateResponse = await sendRuntimeMessage('SUPPORT_GET_STATE');
        applyBackgroundState(stateResponse);

        renderAll();

        if (!state.isSupportTab) {
          setStatus(`Откройте ${SUPPORT_HOST} и выберите одну из вкладок: ${SUPPORTED_FILTER_HINT}. ${statusSummary()}`, 'error');
        } else if (tabSyncError) {
          setStatus(`Не удалось получить список заявок из вкладки: ${tabSyncError.message}. ${statusSummary()}`, 'error');
        } else if (!state.snapshotReady) {
          setStatus(`Ожидаем загрузку списка "${currentListTitle()}". ${statusSummary()}`);
        } else if (!state.trackedFilterActive) {
          setStatus(`Выберите для синхронизации одну из вкладок: ${SUPPORTED_FILTER_HINT}. ${statusSummary()}`);
        } else {
          setStatus(`Текущая вкладка: ${currentListTitle()}. ${statusSummary()}`, showSuccessStatus ? 'ok' : null);
        }
      } catch (error) {
        setStatus(`Ошибка загрузки данных: ${error.message}`, 'error');
      } finally {
        isLoading = false;
        if (queuedReload) {
          const reloadWithSuccess = queuedShowSuccess;
          queuedReload = false;
          queuedShowSuccess = false;
          loadAll(reloadWithSuccess);
        }
      }
    }

    async function handleAction(event) {
      const tabButton = event.target.closest('button[data-switch-tab]');
      if (tabButton) {
        switchReminderTab(tabButton.dataset.switchTab || 'active');
        return;
      }

      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const requestId = button.dataset.requestId;
      if (!action || !requestId) return;

      try {
        if (action === 'add-current' || action === 'edit-active') {
          await upsertReminder(requestId);
        } else if (action === 'open-message') {
          await openReminderMessage(requestId);
        } else if (action === 'delete-active') {
          await deleteReminder(requestId);
        } else if (action === 'restore-archive') {
          await restoreArchive(requestId);
        } else if (action === 'delete-archive') {
          await deleteArchive(requestId);
        }
        await loadAll(true);
      } catch (error) {
        setStatus(`Ошибка операции: ${error.message}`, 'error');
      }
    }

    refreshButton.addEventListener('click', () => {
      loadAll(true);
    });

    root.addEventListener('click', handleAction);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (!changes[STORAGE_KEY]) return;
      loadAll(false);
    });

    const tabUrl = activeTab && activeTab.url ? String(activeTab.url) : '';
    state.isSupportTab = /^https?:\/\/support\.vostok-electra\.ru\//i.test(tabUrl);

    switchReminderTab('active');
    loadAll(true);
    setInterval(() => {
      loadAll(false);
    }, AUTO_REFRESH_MS);
  };
})();
