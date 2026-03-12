(function () {
  const STORAGE_KEY = 'support_reminders_state_v1';
  const SUPPORT_HOST = 'support.vostok-electra.ru';
  const DEFAULT_STAGE_LABEL = '2.4 Подтверждение решения и закрытие Запроса';
  const AUTO_REFRESH_MS = 5000;
  const SUPPORTED_FILTER_HINT = 'Открытые обращения, Мои задачи, Список обращений или Закрытые обращения';

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
      </div>
    `;

    const statusNode = root.querySelector('#support-status');
    const openListNode = root.querySelector('#support-open-list');
    const currentListTitleNode = root.querySelector('#support-current-list-title');
    const reminderTitleNode = root.querySelector('#support-reminder-title');
    const reminderListNode = root.querySelector('#support-reminder-list');
    const refreshButton = root.querySelector('#support-refresh-btn');

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
        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(known.requestNumber || reminder.requestId)}</div>
            <div class="support-item-text">${escapeHtml(known.subject || '(без темы)')}</div>
            <div class="support-item-meta">Этап: ${escapeHtml(known.stage || '—')}</div>
            <div class="support-item-note">${escapeHtml(reminder.note || '')}</div>
            <div class="support-actions">
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
        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(known.requestNumber || archive.requestId)}</div>
            <div class="support-item-text">${escapeHtml(known.subject || '(без темы)')}</div>
            <div class="support-item-meta">В архиве: ${escapeHtml(toDateString(archive.archivedAt))}</div>
            <div class="support-item-note">${escapeHtml(archive.note || '')}</div>
            <div class="support-actions">
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

    async function upsertReminder(requestId) {
      const existing = state.remindersById[requestId];
      const sourceRequest = findCurrentRequest(requestId) || findReminderRequestFallback(requestId);
      if (!sourceRequest) {
        alert('Не удалось найти данные заявки для создания напоминания.');
        return;
      }

      const defaultText = existing ? existing.note : '';
      const promptText = existing ? 'Измените текст напоминания:' : 'Введите текст напоминания:';
      const note = prompt(promptText, defaultText);
      if (note === null) return;

      const normalizedNote = note.trim();
      if (!normalizedNote) {
        alert('Текст напоминания не может быть пустым.');
        return;
      }

      await sendRuntimeMessage('SUPPORT_UPSERT_REMINDER', {
        request: sourceRequest,
        note: normalizedNote
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
