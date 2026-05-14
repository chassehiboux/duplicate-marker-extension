document.addEventListener('DOMContentLoaded', async () => {
  const defaultRoot = document.getElementById('default-popup-root');
  const supportRoot = document.getElementById('support-reminder-root');

  let activeTab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs && tabs.length ? tabs[0] : null;
  } catch (error) {
    console.error('Failed to read active tab for sidepanel mode switch:', error);
  }

  const activeUrl = activeTab && activeTab.url ? String(activeTab.url) : '';
  const isSupportTab = /^https?:\/\/support\.vostok-electra\.ru\//i.test(activeUrl);

  if (isSupportTab && supportRoot && typeof window.initSupportSidePanel === 'function') {
    if (defaultRoot) defaultRoot.style.display = 'none';
    supportRoot.style.display = 'block';
    window.initSupportSidePanel({ root: supportRoot, activeTab });
    return;
  }

  const todayDate = new Date().toLocaleDateString('ru-RU');
  const todayISO = new Date().toISOString().split('T')[0];

  function sendDupSyncMessage(action, data = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action, data }, (response) => {
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

  function syncSetValues(values, options = {}) {
    return sendDupSyncMessage('DUP_SYNC_SET', { values, options });
  }

  function syncCounterIncrement(counterKey, dateKey, delta, options = {}) {
    return sendDupSyncMessage('DUP_SYNC_COUNTER_INCREMENT', { counterKey, dateKey, delta, options });
  }

  function syncCounterSet(counterKey, dateKey, value, options = {}) {
    return sendDupSyncMessage('DUP_SYNC_COUNTER_SET', { counterKey, dateKey, value, options });
  }

  function syncProcessedEditSet(dateIso, path, item, options = {}) {
    return sendDupSyncMessage('DUP_SYNC_PROCESSED_EDIT_SET', { dateIso, path, item, options });
  }

  function syncProcessedEditDelete(dateIso, path, options = {}) {
    return sendDupSyncMessage('DUP_SYNC_PROCESSED_EDIT_DELETE', { dateIso, path, options });
  }

  function syncActionTag(path, tag, options = {}) {
    return sendDupSyncMessage('DUP_SYNC_ACTION_TAG_SET', { path, tag, options });
  }

  // === БЛОК СЧЕТЧИКА "АНАЛИЗ ИСПОЛНЕНИЯ" ===
  const todayCountEl = document.getElementById('today-count');
  const historyBtn = document.getElementById('btn-show-history');
  const historyContainer = document.getElementById('history-container');
  const btnPlus = document.getElementById('btn-plus');
  const btnMinus = document.getElementById('btn-minus');

  function updateCounterUI() {
    chrome.storage.local.get(['stats_history'], (result) => {
      const history = result.stats_history || {};
      todayCountEl.textContent = history[todayDate] || 0;
      renderHistory(history, historyContainer, todayDate);
    });
  }

  function modifyCounter(amount) {
    void syncCounterIncrement('stats_history', todayDate, amount, { reason: 'popup-counter' });
  }

  btnPlus.addEventListener('click', () => modifyCounter(1));
  btnMinus.addEventListener('click', (e) => {
    if (e.shiftKey) {
        void syncCounterSet('stats_history', todayDate, 0, { reason: 'popup-counter-reset' });
    } else {
        modifyCounter(-1);
    }
  });
  historyBtn.addEventListener('click', () => {
    historyContainer.style.display = (historyContainer.style.display === 'block') ? 'none' : 'block';
  });

  // === БЛОК СЧЕТЧIKA "РЕДАКТИРОВАНИЕ/МАРКИРОВКА" ===
  const editingCountEl = document.getElementById('editing-count');
  const editingHistoryBtn = document.getElementById('btn-show-editing-history');
  const editingHistoryContainer = document.getElementById('editing-history-container');
  const editingDetailsBtn = document.getElementById('btn-show-editing-details');
  const editingDetailsContainer = document.getElementById('editing-details-container');
  const btnEditingPlus = document.getElementById('btn-editing-plus');
  const btnEditingMinus = document.getElementById('btn-editing-minus');
  // Новые элементы для списка всех действий
  const allActionsContainer = document.getElementById('all-actions-container');
  const btnShowActionsList = document.getElementById('btn-show-actions-list');
  
  const MANUAL_KEY = '_manual';
  
  const EDITING_STATS_KEY = 'editing_stats';
  const PROCESSED_EDITS_KEY = 'processed_edits';
  const TAGS_KEY = 'action_tags';
  const APPROVED_ACTIONS_KEY = 'approved_actions';
  const BLOCKED_ACTIONS_KEY = 'blocked_actions';

  // --- Функция для отображения модального окна в активной вкладке ---
  async function showConfirmationModal(path, edocid) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'show_confirmation_modal_in_tab',
          data: { path, edocid }
        });
      } else {
        console.error("Не удалось найти активную вкладку для отображения модального окна.");
      }
    } catch (error) {
      console.error("Ошибка при отправке сообщения в content.js:", error);
    }
  }

  function updateEditingCounterUI() {
    chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY, TAGS_KEY], (result) => {
      const history = result[EDITING_STATS_KEY] || {};
      const processed = result[PROCESSED_EDITS_KEY] || {};
      const tags = result[TAGS_KEY] || {};
      
      const todayCount = history[todayDate] || 0;
      editingCountEl.textContent = todayCount;

      const todayProcessed = processed[todayISO] || {};
      
      let todayTotalFromDetails = 0;
      Object.keys(todayProcessed).forEach(path => {
          const item = todayProcessed[path];
          // Use base_count from the new structure, or fallback for old formats
          if (typeof item === 'object' && item !== null && 'base_count' in item) {
              todayTotalFromDetails += item.base_count;
          } else {
              todayTotalFromDetails += typeof item === 'number' ? item : (Array.isArray(item) ? item.length : 0);
          }
      });
      
      if (todayCount !== todayTotalFromDetails) {
        history[todayDate] = todayTotalFromDetails;
        void syncCounterSet(EDITING_STATS_KEY, todayDate, todayTotalFromDetails, { reason: 'popup-editing-total-repair' });
        editingCountEl.textContent = todayTotalFromDetails;
      }

      renderEditingHistory(history, processed, tags, editingHistoryContainer);
      renderDetails(todayProcessed, editingDetailsContainer, tags, todayISO);
    });
  }
  
  function renderDetails(processedData, container, tags, dateISO) {
      container.innerHTML = '';
      if (!processedData || Object.keys(processedData).length === 0) {
          container.innerHTML = '<div class="history-item" style="justify-content: center; opacity: 0.7;">Нет данных</div>';
          return;
      }

      const paths = Object.keys(processedData).sort();
      let hasVisibleItems = false;

      paths.forEach(path => {
          const item = processedData[path];
          // Use base_count from the new structure, or fallback for old formats
          const count = (typeof item === 'object' && item !== null && 'base_count' in item) ? 
                         item.base_count : 
                         (typeof item === 'number' ? item : (Array.isArray(item) ? item.length : 0));
          
          if (count > 0) {
              hasVisibleItems = true;
              const name = tags[path] || (path === MANUAL_KEY ? 'Ручные правки' : path);
              
              const div = document.createElement('div');
              div.className = 'details-item';
              div.innerHTML = `
                  <span class="details-item-name" title="${path}">${name}</span>
                  <strong id="count-${dateISO}-${path}">${count}</strong>
                  <button class="ctrl-btn edit-btn" data-date="${dateISO}" data-path="${path}" title="Изменить">✏️</button>
                  <button class="ctrl-btn delete-btn" data-date="${dateISO}" data-path="${path}" title="Удалить">🗑️</button>
                  ${path !== MANUAL_KEY ? `<button class="tag-btn" data-path="${path}" title="Назначить тег">Тег</button>` : ''}
              `;
              container.appendChild(div);
          }
      });

      if (!hasVisibleItems) {
          container.innerHTML = '<div class="history-item" style="justify-content: center; opacity: 0.7;">Нет данных</div>';
      }
  }

  function renderEditingHistory(history, processed, tags, container) {
      container.innerHTML = '';
      const dates = Object.keys(history).sort((a, b) => {
        const [d1, m1, y1] = a.split('.'); const [d2, m2, y2] = b.split('.');
        return new Date(`${y2}-${m2}-${d2}`) - new Date(`${y1}-${m1}-${d1}`);
      });

      let hasHistory = false;
      dates.forEach(date => {
        if (date === todayDate) return;

        if (history[date] > 0) {
          hasHistory = true;
          const dateISO = convertDateToISO(date);
          const dayData = processed[dateISO] || {};

          const historyGroup = document.createElement('div');
          historyGroup.className = 'history-day-group';

          const summary = document.createElement('div');
          summary.className = 'history-item summary';
          summary.innerHTML = `<span>${date}</span> <strong>${history[date]} шт.</strong>`;
          
          const details = document.createElement('div');
          details.className = 'history-details';
          details.style.display = 'none';
          
          renderDetails(dayData, details, tags, dateISO);

          summary.addEventListener('click', () => {
            details.style.display = details.style.display === 'none' ? 'block' : 'none';
          });
          
          historyGroup.appendChild(summary);
          historyGroup.appendChild(details);
          container.appendChild(historyGroup);
        }
      });
      
      if (!hasHistory) {
          container.innerHTML = '<div class="history-item" style="justify-content: center; opacity: 0.7;">История пуста</div>';
      }
  }

  function renderAllActions() {
    chrome.storage.local.get([APPROVED_ACTIONS_KEY, BLOCKED_ACTIONS_KEY, TAGS_KEY], (result) => {
      const approved = result[APPROVED_ACTIONS_KEY] || [];
      const blocked = result[BLOCKED_ACTIONS_KEY] || [];
      const tags = result[TAGS_KEY] || {};

      allActionsContainer.innerHTML = '';
      const allActions = [
        ...approved.map(path => ({ path, status: 'approved' })),
        ...blocked.map(path => ({ path, status: 'blocked' }))
      ];

      if (allActions.length === 0) {
        allActionsContainer.innerHTML = '<div class="history-item" style="justify-content: center; opacity: 0.7;">Нет сохраненных действий</div>';
        return;
      }
      
      // Сортировка по имени тега или пути
      allActions.sort((a, b) => (tags[a.path] || a.path).localeCompare(tags[b.path] || b.path));

      allActions.forEach(({ path, status }) => {
        const name = tags[path] || path;
        const div = document.createElement('div');
        div.className = 'action-item';
        div.innerHTML = `
          <span class="action-item-name" title="${path}">${name}</span>
          <span class="action-status" data-path="${path}" data-status="${status}" title="Изменить статус">${status === 'approved' ? '✔️' : '❌'}</span>
        `;
        allActionsContainer.appendChild(div);
      });
    });
  }

  function convertDateToISO(dateString) {
      const [day, month, year] = dateString.split('.');
      return `${year}-${month}-${day}`;
  }

  function modifyEditingCounter(amount) {
      chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY], (result) => {
          let history = result[EDITING_STATS_KEY] || {};
          let processed = result[PROCESSED_EDITS_KEY] || {};
          
          if (!processed[todayISO]) processed[todayISO] = {};
          if (typeof processed[todayISO][MANUAL_KEY] !== 'number') processed[todayISO][MANUAL_KEY] = 0;

          processed[todayISO][MANUAL_KEY] += amount;
          if (processed[todayISO][MANUAL_KEY] < 0) processed[todayISO][MANUAL_KEY] = 0;

          recalculateTotals(processed, history, todayISO);
          
          void syncProcessedEditSet(todayISO, MANUAL_KEY, {
              base_count: processed[todayISO][MANUAL_KEY],
              unique_edocids: []
          }, {
              counterDateKey: todayDate,
              counterValue: history[todayDate],
              reason: 'popup-manual-editing-counter'
          });
      });
  }

  function recalculateTotals(processed, history, dateISO) {
      const dateKey = dateISO.split('-').reverse().join('.');
      let dayTotal = 0;
      if (processed[dateISO]) {
          Object.keys(processed[dateISO]).forEach(path => {
              const item = processed[dateISO][path];
              // Use base_count from the new structure, or fallback for old formats
              if (typeof item === 'object' && item !== null && 'base_count' in item) {
                  dayTotal += item.base_count;
              } else {
                  dayTotal += typeof item === 'number' ? item : (Array.isArray(item) ? item.length : 0);
              }
          });
      }
      history[dateKey] = dayTotal;
  }

  function handleEditingActions(e) {
      const target = e.target;
      const path = target.dataset.path;
      const dateISO = target.dataset.date;

      if (!path || !dateISO) return;

      if (target.classList.contains('tag-btn')) {
          chrome.storage.local.get(TAGS_KEY, (result) => {
              const tags = result[TAGS_KEY] || {};
              const currentTag = tags[path] || '';
              const newTag = prompt(`Введите тег для действия:\n${path}`, currentTag);

              if (newTag !== null) {
                  tags[path] = newTag.trim();
                  void syncActionTag(path, newTag.trim(), { reason: 'popup-action-tag' });
              }
          });
          return;
      }

      if (target.classList.contains('delete-btn')) {
          if (confirm(`Удалить запись "${path}" за ${dateISO}?`)) {
              chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY], (result) => {
                  let history = result[EDITING_STATS_KEY] || {};
                  let processed = result[PROCESSED_EDITS_KEY] || {};
                  if (processed[dateISO] && processed[dateISO][path] !== undefined) {
                      delete processed[dateISO][path];
                      recalculateTotals(processed, history, dateISO);
                      void syncProcessedEditDelete(dateISO, path, {
                          counterDateKey: dateISO.split('-').reverse().join('.'),
                          reason: 'popup-processed-edit-delete'
                      });
                  }
              });
          }
          return;
      }

      if (target.classList.contains('edit-btn')) {
          const countSpan = document.getElementById(`count-${dateISO}-${path}`);
          if (!countSpan) return;
          
          const currentCount = parseInt(countSpan.textContent, 10);
          const editBtn = target;

          const input = document.createElement('input');
          input.type = 'number';
          input.value = currentCount;
          input.className = 'edit-input';
          input.style.width = '50px';

          const saveBtn = document.createElement('button');
          saveBtn.textContent = '✔️';
          saveBtn.className = 'ctrl-btn save-btn';

          const container = countSpan.parentElement;
          container.replaceChild(input, countSpan);
          container.replaceChild(saveBtn, editBtn);
          input.focus();
          input.select();

          const saveChanges = () => {
              const newCount = parseInt(input.value, 10);
              if (!isNaN(newCount) && newCount >= 0) {
                  chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY], (result) => {
                      let history = result[EDITING_STATS_KEY] || {};
                      let processed = result[PROCESSED_EDITS_KEY] || {};
                      if (processed[dateISO]) {
                          // Update to the new hybrid object format for manual edits
                          processed[dateISO][path] = { base_count: newCount, unique_edocids: [] };
                          recalculateTotals(processed, history, dateISO);
                          void syncProcessedEditSet(dateISO, path, processed[dateISO][path], {
                              counterDateKey: dateISO.split('-').reverse().join('.'),
                              counterValue: history[dateISO.split('-').reverse().join('.')],
                              reason: 'popup-processed-edit-update'
                          });
                      }
                  });
              } else {
                 container.replaceChild(countSpan, input);
                 container.replaceChild(editBtn, saveBtn);
              }
          };

          saveBtn.addEventListener('click', saveChanges);
          input.addEventListener('blur', saveChanges, { once: true });
          input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') saveChanges(); });
      }
  }

  btnEditingPlus.addEventListener('click', () => modifyEditingCounter(1));
  btnEditingMinus.addEventListener('click', (e) => {
      if (e.shiftKey) {
          chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY], (result) => {
              const processed = result[PROCESSED_EDITS_KEY] || {};
              const todayPaths = processed[todayISO] ? Object.keys(processed[todayISO]) : [];
              if (!todayPaths.length) {
                  void syncCounterSet(EDITING_STATS_KEY, todayDate, 0, { reason: 'popup-editing-reset-empty' });
                  return;
              }
              todayPaths.forEach((path) => {
                  void syncProcessedEditDelete(todayISO, path, {
                      counterDateKey: todayDate,
                      reason: 'popup-editing-reset'
                  });
              });
          });
      } else {
          modifyEditingCounter(-1);
      }
  });

  editingHistoryBtn.addEventListener('click', () => {
    editingDetailsContainer.style.display = 'none';
    allActionsContainer.style.display = 'none';
    editingHistoryContainer.style.display = (editingHistoryContainer.style.display === 'block') ? 'none' : 'block';
  });

  editingDetailsBtn.addEventListener('click', () => {
    editingHistoryContainer.style.display = 'none';
    allActionsContainer.style.display = 'none';
    editingDetailsContainer.style.display = (editingDetailsContainer.style.display === 'block') ? 'none' : 'block';
  });

  btnShowActionsList.addEventListener('click', () => {
    editingHistoryContainer.style.display = 'none';
    editingDetailsContainer.style.display = 'none';
    allActionsContainer.style.display = (allActionsContainer.style.display === 'block') ? 'none' : 'block';
  });

  editingDetailsContainer.addEventListener('click', handleEditingActions);
  editingHistoryContainer.addEventListener('click', handleEditingActions);
  
  allActionsContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.action-status');
    if (!target) return;
    
    const { path, status } = target.dataset;
    if (!path || !status) return;

    chrome.runtime.sendMessage({
      action: 'toggle_action_status',
      data: { path, currentStatus: status }
    });
  });

  // === ОБЩИЕ ФУНКЦИИ И СЛУШАТЕЛИ ===
  
  function renderHistory(history, container, today) {
      const dates = Object.keys(history).sort((a, b) => {
        const [d1, m1, y1] = a.split('.'); const [d2, m2, y2] = b.split('.');
        return new Date(`${y2}-${m2}-${d2}`) - new Date(`${y1}-${m1}-${d1}`);
      });

      container.innerHTML = '';
      let hasHistory = false;
      dates.forEach(date => {
        if (date !== today && history[date] > 0) {
          hasHistory = true;
          const div = document.createElement('div');
          div.className = 'history-item';
          div.innerHTML = `<span>${date}</span> <span>${history[date]} шт.</span>`;
          container.appendChild(div);
        }
      });
      if (!hasHistory) {
        container.innerHTML = '<div class="history-item" style="justify-content: center; opacity: 0.7;">История пуста</div>';
      }
  }

  // === БЛОК НАСТРОЕК И ПОИСКА ДУБЛИКАТОВ ===
  // (Код этого блока оставлен без изменений)
  const notifyExecutionToggle = document.getElementById('setting_notify_execution');
  const notifyEditingToggle = document.getElementById('setting_notify_editing');
  const inputsSearch = ['list_DebtID', 'list_AccAddress_AccountNumber', 'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber'];
  const inputsStrict = ['strict_CaseNumber', 'strict_EDNumber'];
  const copyModeToggle = document.getElementById('setting_copy_mode');
  const highlightModeToggle = document.getElementById('setting_highlight_mode');
  const departmentContainersToggle = document.getElementById('setting_department_containers');
  
  const allSettings = [
    ...inputsSearch, 
    ...inputsStrict, 
    'setting_copy_mode', 
    'setting_highlight_mode', 
    'setting_department_containers',
    'setting_notify_execution', 
    'setting_notify_editing'
  ];

  chrome.storage.local.get(allSettings, (items) => {
    // Установка значений по умолчанию, если они не определены
    if (items['setting_copy_mode'] === undefined) {
      items['setting_copy_mode'] = true;
      void syncSetValues({ 'setting_copy_mode': true }, { reason: 'popup-default-setting' });
    }
    if (items['setting_notify_execution'] === undefined) {
      items['setting_notify_execution'] = true;
      void syncSetValues({ 'setting_notify_execution': true }, { reason: 'popup-default-setting' });
    }
    if (items['setting_notify_editing'] === undefined) {
      items['setting_notify_editing'] = true;
      void syncSetValues({ 'setting_notify_editing': true }, { reason: 'popup-default-setting' });
    }
    if (items['setting_department_containers'] === undefined) {
      items['setting_department_containers'] = true;
      void syncSetValues({ 'setting_department_containers': true }, { reason: 'popup-default-setting' });
    }
    inputsSearch.forEach(id => {
      if (items[id] === undefined) {
        items[id] = true; // По умолчанию включены
        void syncSetValues({ [id]: true }, { reason: 'popup-default-setting' });
      }
    });

    // Применение загруженных или установленных по умолчанию значений
    if (copyModeToggle) copyModeToggle.checked = items['setting_copy_mode'];
    if (highlightModeToggle) highlightModeToggle.checked = items['setting_highlight_mode'] || false;
    if (departmentContainersToggle) departmentContainersToggle.checked = items['setting_department_containers'] !== false;
    if (notifyExecutionToggle) notifyExecutionToggle.checked = items['setting_notify_execution'];
    if (notifyEditingToggle) notifyEditingToggle.checked = items['setting_notify_editing'];
    
    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = items[id];
    });
    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = items[id] || false;
    });
  });

  // Helper для создания слушателя
  function createSettingChangeListener(settingId) {
    const element = document.getElementById(settingId);
    if (element) {
      element.addEventListener('change', (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        void syncSetValues({ [settingId]: value }, { reason: 'popup-setting-change' });
      });
    }
  }

  // Применение слушателей
  createSettingChangeListener('setting_copy_mode');
  createSettingChangeListener('setting_highlight_mode');
  createSettingChangeListener('setting_department_containers');
  createSettingChangeListener('setting_notify_execution');
  createSettingChangeListener('setting_notify_editing');

  if (highlightModeToggle) {
    highlightModeToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      // 'setting_highlight_mode' уже сохраняется через createSettingChangeListener
      runSearch(isEnabled ? 'highlight' : 'clear');
    });
  }
  
  [...inputsSearch, ...inputsStrict].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
          el.addEventListener('change', (e) => {
              void syncSetValues({ [id]: e.target.checked }, { reason: 'popup-search-setting-change' });
              if (highlightModeToggle && highlightModeToggle.checked) {
                  runSearch('highlight');
              }
          });
      }
  });

  async function runSearch(action) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    const settings = {};
    const activeFields = [];
    const strictOptions = {};
    
    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        settings[id] = el.checked;
        if (el.checked) activeFields.push(id);
      }
    });
    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        settings[id] = el.checked;
        strictOptions[id.replace('strict_', 'list_')] = el.checked;
      }
    });
    
    chrome.tabs.sendMessage(tab.id, {
      action: action, fields: activeFields, strictMode: strictOptions
    }).catch(() => {});
  }
  
  // === БЛОК ЖУРНАЛА ДЕЙСТВИЙ ===
  const logContainer = document.getElementById('log-container');
  const btnClearLog = document.getElementById('btn-clear-log');
  const LOG_KEY = 'extension_logs';

  function updateLogsUI(logs) {
    if (!logContainer) return;
    logContainer.innerHTML = '';
    if (logs && logs.length > 0) {
      logs.forEach(logMsg => {
        const logItem = document.createElement('div');
        logItem.className = 'log-entry';
        logItem.textContent = logMsg;
        logContainer.appendChild(logItem);
      });
    } else {
      logContainer.textContent = 'Журнал пуст.';
    }
  }

  function loadLogs() {
    chrome.storage.local.get(LOG_KEY, (data) => {
      updateLogsUI(data[LOG_KEY]);
    });
  }

  if (btnClearLog) {
    btnClearLog.addEventListener('click', () => {
      chrome.storage.local.remove(LOG_KEY, () => { loadLogs(); });
    });
  }
  
  // === БЛОК УПРАВЛЕНИЯ ДАННЫМИ ===
  const btnExport = document.getElementById('btn-export-data');
  const btnImport = document.getElementById('btn-import-data');
  const protectedExportKeys = new Set([
    'dup_supabase_auth_session_v1',
    'dup_supabase_sync_meta_v1',
    'dup_supabase_pre_login_backup_v1',
    'extension_logs',
    'pending_actions',
    'pendingEditingActions',
    'dup_department_container_cookie_stores_v1',
    'dup_stage_jump_pending',
    'pyramid_christmas_enabled_cache_v1',
    'pyramid_spring_enabled_cache_v1',
    'pyramid_theme_feature_settings_cache_v1'
  ]);

  function isProtectedStorageKey(key) {
    const normalizedKey = String(key || '');
    return protectedExportKeys.has(normalizedKey)
      || normalizedKey.startsWith('dup_supabase_')
      || normalizedKey.startsWith('logs_');
  }

  function removeProtectedStorageKeys(data) {
    Object.keys(data || {}).forEach((key) => {
      if (isProtectedStorageKey(key)) {
        delete data[key];
      }
    });
    return data;
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      chrome.storage.local.get(null, (data) => {
        removeProtectedStorageKeys(data);

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `extension-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  }

  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedData = JSON.parse(event.target.result);
            removeProtectedStorageKeys(importedData);
            
            if (confirm("Вы уверены, что хотите импортировать данные? Все текущие настройки и история счетчиков будут ПЕРЕЗАПИСАНЫ. Это действие необратимо.")) {
              sendDupSyncMessage('DUP_SYNC_IMPORT_JSON', { importedData }).then((response) => {
                const result = response && response.result ? response.result : {};
                if (!response || response.success === false || result.success === false) {
                  alert(`Импорт не выполнен: ${(response && (response.error || result.error)) || 'неизвестная ошибка'}`);
                  return;
                }
                alert('Импорт успешно завершен!');
              });
            }
          } catch (error) {
            alert('Ошибка! Не удалось прочитать или обработать файл. Убедитесь, что это корректный JSON файл, созданный этим расширением.');
            console.error("Ошибка импорта:", error);
          }
        };
        reader.readAsText(file);
      };
      
      input.click();
    });
  }

  // === ПЕРВИЧНАЯ ЗАГРУЗКА И СЛУШАТЕЛИ ===
  updateCounterUI();
  updateEditingCounterUI();
  renderAllActions();
  loadLogs();
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.stats_history) updateCounterUI();
    if (changes[EDITING_STATS_KEY] || changes[PROCESSED_EDITS_KEY] || changes[TAGS_KEY] || changes[APPROVED_ACTIONS_KEY] || changes[BLOCKED_ACTIONS_KEY]) {
        updateEditingCounterUI();
        renderAllActions();
    }
    if (changes[LOG_KEY]) updateLogsUI(changes[LOG_KEY].newValue);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateEditingCounter") {
        updateEditingCounterUI();
    }
  });
});
