(function () {
  const STORAGE_KEY = 'support_reminders_state_v1';
  const SUPPORT_HOST = 'support.vostok-electra.ru';
  const DEFAULT_STAGE_LABEL = '2.4 Подтверждение решения и закрытие Запроса';

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
          reject(new Error('No response from background.'));
          return;
        }
        if (response.success === false) {
          reject(new Error(response.error || 'Unknown background error.'));
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
          reject(new Error('No response from tab content script.'));
          return;
        }
        if (response.success === false) {
          reject(new Error(response.error || 'Unknown tab error.'));
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

      .support-section-title {
        background: #f4f8fc;
        font-size: 12px;
        font-weight: bold;
        padding: 6px 8px;
      }

      .support-list {
        max-height: 220px;
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

        <div class="support-section">
          <div class="support-section-title">Открытые обращения</div>
          <div class="support-list" id="support-open-list"></div>
        </div>

        <div class="support-section">
          <div class="support-section-title">Активные напоминания</div>
          <div class="support-list" id="support-active-list"></div>
        </div>

        <div class="support-section">
          <div class="support-section-title">Архив</div>
          <div class="support-list" id="support-archive-list"></div>
        </div>
      </div>
    `;

    const statusNode = root.querySelector('#support-status');
    const openListNode = root.querySelector('#support-open-list');
    const activeListNode = root.querySelector('#support-active-list');
    const archiveListNode = root.querySelector('#support-archive-list');
    const refreshButton = root.querySelector('#support-refresh-btn');

    const state = {
      tabId: activeTab && typeof activeTab.id === 'number' ? activeTab.id : null,
      targetStage: DEFAULT_STAGE_LABEL,
      openFilterActive: false,
      openRequests: [],
      activeReminders: [],
      archivedReminders: [],
      remindersById: {},
      archiveById: {}
    };

    function setStatus(text, mode) {
      statusNode.textContent = text;
      statusNode.classList.remove('error', 'ok');
      if (mode === 'error') statusNode.classList.add('error');
      if (mode === 'ok') statusNode.classList.add('ok');
    }

    function renderOpenRequests() {
      if (!state.tabId) {
        openListNode.innerHTML = '<div class="support-empty">Активная вкладка не найдена.</div>';
        return;
      }

      if (!state.openFilterActive) {
        openListNode.innerHTML = '<div class="support-empty">Откройте вкладку "Открытые обращения" на сайте support.vostok-electra.ru.</div>';
        return;
      }

      if (!state.openRequests.length) {
        openListNode.innerHTML = '<div class="support-empty">Список открытых обращений пуст.</div>';
        return;
      }

      openListNode.innerHTML = state.openRequests.map((request) => {
        const reminder = state.remindersById[request.requestId];
        const reminderBlock = reminder
          ? `<div class="support-item-note">${escapeHtml(reminder.note)}</div>`
          : '';
        const addOrEditAction = reminder ? 'edit-open' : 'add-open';
        const addOrEditLabel = reminder ? 'Изменить' : 'Добавить';
        const deleteButton = reminder
          ? `<button class="support-btn danger" data-action="delete-open" data-request-id="${escapeHtml(request.requestId)}">Удалить</button>`
          : '';

        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(request.requestNumber || request.requestId)}</div>
            <div class="support-item-text">${escapeHtml(request.subject || '(без темы)')}</div>
            <div class="support-item-meta">Этап: ${escapeHtml(request.stage || '—')}</div>
            ${reminderBlock}
            <div class="support-actions">
              <button class="support-btn" data-action="${addOrEditAction}" data-request-id="${escapeHtml(request.requestId)}">${addOrEditLabel}</button>
              ${deleteButton}
            </div>
          </div>
        `;
      }).join('');
    }

    function renderActiveReminders() {
      if (!state.activeReminders.length) {
        activeListNode.innerHTML = '<div class="support-empty">Активных напоминаний пока нет.</div>';
        return;
      }

      activeListNode.innerHTML = state.activeReminders.map((reminder) => {
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
        archiveListNode.innerHTML = '<div class="support-empty">Архив пуст.</div>';
        return;
      }

      archiveListNode.innerHTML = state.archivedReminders.map((archive) => {
        const known = archive.lastKnown || {};
        return `
          <div class="support-item">
            <div class="support-item-title">${escapeHtml(known.requestNumber || archive.requestId)}</div>
            <div class="support-item-text">${escapeHtml(known.subject || '(без темы)')}</div>
            <div class="support-item-meta">В архиве: ${escapeHtml(toDateString(archive.archivedAt))}</div>
            <div class="support-item-note">${escapeHtml(archive.note || '')}</div>
            <div class="support-actions">
              <button class="support-btn danger" data-action="delete-archive" data-request-id="${escapeHtml(archive.requestId)}">Удалить</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderAll() {
      renderOpenRequests();
      renderActiveReminders();
      renderArchiveReminders();
    }

    function findOpenRequest(requestId) {
      return state.openRequests.find((item) => item.requestId === requestId) || null;
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
      const sourceRequest = findOpenRequest(requestId) || findReminderRequestFallback(requestId);
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

    async function loadAll(showSuccessStatus) {
      try {
        const stateResponse = await sendRuntimeMessage('SUPPORT_GET_STATE');
        state.targetStage = stateResponse.targetStage || DEFAULT_STAGE_LABEL;
        state.activeReminders = Array.isArray(stateResponse.activeReminders) ? stateResponse.activeReminders : [];
        state.archivedReminders = Array.isArray(stateResponse.archivedReminders) ? stateResponse.archivedReminders : [];
        state.remindersById = stateResponse.remindersById || {};
        state.archiveById = stateResponse.archiveById || {};

        if (state.tabId) {
          try {
            const tabResponse = await sendTabMessage(state.tabId, 'SUPPORT_GET_OPEN_REQUESTS');
            state.openFilterActive = !!tabResponse.openFilterActive;
            state.openRequests = Array.isArray(tabResponse.requests) ? tabResponse.requests : [];
          } catch (tabError) {
            state.openFilterActive = false;
            state.openRequests = [];
            setStatus(`Не удалось получить список заявок из вкладки: ${tabError.message}`, 'error');
          }
        } else {
          state.openFilterActive = false;
          state.openRequests = [];
        }

        renderAll();

        if (showSuccessStatus) {
          setStatus(
            `Активных: ${state.activeReminders.length}, в архиве: ${state.archivedReminders.length}. Целевой этап: ${state.targetStage}.`,
            'ok'
          );
        }
      } catch (error) {
        setStatus(`Ошибка загрузки данных: ${error.message}`, 'error');
      }
    }

    async function handleAction(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const requestId = button.dataset.requestId;
      if (!action || !requestId) return;

      try {
        if (action === 'add-open' || action === 'edit-open' || action === 'edit-active') {
          await upsertReminder(requestId);
        } else if (action === 'delete-open' || action === 'delete-active') {
          await deleteReminder(requestId);
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

    setInterval(() => {
      loadAll(false);
    }, 15000);

    const tabUrl = activeTab && activeTab.url ? String(activeTab.url) : '';
    if (!tabUrl.includes(SUPPORT_HOST)) {
      setStatus(`Откройте вкладку ${SUPPORT_HOST}, затем выберите "Открытые обращения".`, 'error');
    }

    loadAll(true);
  };
})();
