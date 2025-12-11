document.addEventListener('DOMContentLoaded', () => {
  const todayDate = new Date().toLocaleDateString('ru-RU');
  const todayISO = new Date().toISOString().split('T')[0];

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
    chrome.storage.local.get(['stats_history'], (result) => {
      let history = result.stats_history || {};
      let current = history[todayDate] || 0;
      let newVal = current + amount;
      if (newVal < 0) newVal = 0;
      history[todayDate] = newVal;
      chrome.storage.local.set({ 'stats_history': history });
    });
  }

  btnPlus.addEventListener('click', () => modifyCounter(1));
  btnMinus.addEventListener('click', (e) => {
    if (e.shiftKey) {
        chrome.storage.local.get(['stats_history'], (result) => {
            let history = result.stats_history || {};
            history[todayDate] = 0;
            chrome.storage.local.set({ 'stats_history': history });
        });
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
  
  // Новые элементы для ожидающих действий
  const pendingActionsContainer = document.getElementById('pending-actions-container');
  const pendingActionsTitle = document.getElementById('pending-actions-title');

  const MANUAL_KEY = '_manual';
  
  const EDITING_STATS_KEY = 'editing_stats';
  const PROCESSED_EDITS_KEY = 'processed_edits';
  const TAGS_KEY = 'action_tags';
  const PENDING_ACTIONS_KEY = 'pending_actions';

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
        chrome.storage.local.set({[EDITING_STATS_KEY]: history});
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

  function renderPendingActions() {
    chrome.storage.local.get([PENDING_ACTIONS_KEY, TAGS_KEY], (result) => {
        const pending = result[PENDING_ACTIONS_KEY] || [];
        const tags = result[TAGS_KEY] || {};

        pendingActionsContainer.innerHTML = '';

        if (pending.length === 0) {
            pendingActionsTitle.style.display = 'none';
            return;
        }

        pendingActionsTitle.style.display = 'block';

        pending.forEach(action => {
            const { path, edocid } = action;
            const name = tags[path] || path;
            const uniqueId = `pending-${path.replace(/[^a-zA-Z0-9]/g, '')}-${edocid}`;
            
            const div = document.createElement('div');
            div.className = 'details-item';
            div.id = uniqueId;
            div.innerHTML = `
                <span class="details-item-name" title="${path}">${name}</span>
                <strong title="ID документа: ${edocid}">...${String(edocid).slice(-4)}</strong>
                <button class="ctrl-btn approve-btn" data-path="${path}" data-edocid="${edocid}" title="Сохранить">✔️</button>
                <button class="ctrl-btn block-btn" data-path="${path}" data-edocid="${edocid}" title="Заблокировать">❌</button>
            `;
            pendingActionsContainer.appendChild(div);
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
          
          chrome.storage.local.set({
              [EDITING_STATS_KEY]: history,
              [PROCESSED_EDITS_KEY]: processed 
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
                  chrome.storage.local.set({ [TAGS_KEY]: tags });
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
                      chrome.storage.local.set({ [EDITING_STATS_KEY]: history, [PROCESSED_EDITS_KEY]: processed });
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
                          chrome.storage.local.set({ [EDITING_STATS_KEY]: history, [PROCESSED_EDITS_KEY]: processed });
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

  pendingActionsContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.ctrl-btn');
    if (!target) return;

    const { path, edocid } = target.dataset;
    if (!path || !edocid) return;

    if (target.classList.contains('approve-btn')) {
        const newTag = prompt(`Введите тег для нового действия:\n${path}`, '');
        // Если пользователь нажал "Отмена", newTag будет null. Пустая строка - это валидный ввод.
        if (newTag !== null) {
            chrome.runtime.sendMessage({ 
                action: 'approve_action', 
                data: { path, edocid, tag: newTag.trim() } 
            });
        }
    }

    if (target.classList.contains('block-btn')) {
        chrome.runtime.sendMessage({ action: 'block_action', data: { path, edocid } });
    }
  });

  btnEditingPlus.addEventListener('click', () => modifyEditingCounter(1));
  btnEditingMinus.addEventListener('click', (e) => {
      if (e.shiftKey) {
          chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY], (result) => {
              let history = result[EDITING_STATS_KEY] || {};
              let processed = result[PROCESSED_EDITS_KEY] || {};
              history[todayDate] = 0;
              if (processed[todayISO]) processed[todayISO] = {};
              chrome.storage.local.set({ [EDITING_STATS_KEY]: history, [PROCESSED_EDITS_KEY]: processed });
          });
      } else {
          modifyEditingCounter(-1);
      }
  });

  editingHistoryBtn.addEventListener('click', () => {
      editingDetailsContainer.style.display = 'none';
      editingHistoryContainer.style.display = (editingHistoryContainer.style.display === 'block') ? 'none' : 'block';
  });
  editingDetailsBtn.addEventListener('click', () => {
      editingHistoryContainer.style.display = 'none';
      editingDetailsContainer.style.display = (editingDetailsContainer.style.display === 'block') ? 'none' : 'block';
  });

  editingDetailsContainer.addEventListener('click', handleEditingActions);
  editingHistoryContainer.addEventListener('click', handleEditingActions);

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
  
  const allSettings = [
    ...inputsSearch, 
    ...inputsStrict, 
    'setting_copy_mode', 
    'setting_highlight_mode', 
    'setting_notify_execution', 
    'setting_notify_editing'
  ];

  chrome.storage.local.get(allSettings, (items) => {
    // Установка значений по умолчанию, если они не определены
    if (items['setting_copy_mode'] === undefined) {
      items['setting_copy_mode'] = true;
      chrome.storage.local.set({ 'setting_copy_mode': true });
    }
    if (items['setting_notify_execution'] === undefined) {
      items['setting_notify_execution'] = true;
      chrome.storage.local.set({ 'setting_notify_execution': true });
    }
    if (items['setting_notify_editing'] === undefined) {
      items['setting_notify_editing'] = true;
      chrome.storage.local.set({ 'setting_notify_editing': true });
    }
    inputsSearch.forEach(id => {
      if (items[id] === undefined) {
        items[id] = true; // По умолчанию включены
        chrome.storage.local.set({ [id]: true });
      }
    });

    // Применение загруженных или установленных по умолчанию значений
    if (copyModeToggle) copyModeToggle.checked = items['setting_copy_mode'];
    if (highlightModeToggle) highlightModeToggle.checked = items['setting_highlight_mode'] || false;
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
        chrome.storage.local.set({ [settingId]: value });
      });
    }
  }

  // Применение слушателей
  createSettingChangeListener('setting_copy_mode');
  createSettingChangeListener('setting_highlight_mode');
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
              chrome.storage.local.set({ [id]: e.target.checked });
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
  
  // === ПЕРВИЧНАЯ ЗАГРУЗКА И СЛУШАТЕЛИ ===
  updateCounterUI();
  updateEditingCounterUI();
  renderPendingActions();
  loadLogs();
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.stats_history) updateCounterUI();
    if (changes[EDITING_STATS_KEY] || changes[PROCESSED_EDITS_KEY] || changes[TAGS_KEY] || changes[PENDING_ACTIONS_KEY]) {
        updateEditingCounterUI();
        renderPendingActions();
    }
    if (changes[LOG_KEY]) updateLogsUI(changes[LOG_KEY].newValue);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateEditingCounter" || message.action === "pendingActionsUpdated") {
        updateEditingCounterUI();
        renderPendingActions();
    }
  });
});