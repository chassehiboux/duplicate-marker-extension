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
  const MANUAL_KEY = '_manual';
  
  // Ключи для нового счетчика
  const EDITING_STATS_KEY = 'editing_stats';
  const PROCESSED_EDITS_KEY = 'processed_edits';
  const TAGS_KEY = 'action_tags';

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
          if (path === MANUAL_KEY) {
              todayTotalFromDetails += todayProcessed[path] || 0;
          } else {
              todayTotalFromDetails += Array.isArray(todayProcessed[path]) ? todayProcessed[path].length : 0;
          }
      });
      
      // Синхронизация, если общий счетчик разошелся с детальным
      if (todayCount !== todayTotalFromDetails) {
        history[todayDate] = todayTotalFromDetails;
        chrome.storage.local.set({[EDITING_STATS_KEY]: history});
        editingCountEl.textContent = todayTotalFromDetails;
      }

      renderHistory(history, editingHistoryContainer, todayDate);
      renderDetails(todayProcessed, editingDetailsContainer, tags);
    });
  }
  
  function renderDetails(processedToday, container, tags) {
      container.innerHTML = '';
      const paths = Object.keys(processedToday).sort(); // Сортируем для порядка

      if (paths.length === 0) {
          container.innerHTML = '<div class="history-item" style="justify-content: center; opacity: 0.7;">Нет данных за сегодня</div>';
          return;
      }

      paths.forEach(path => {
          const count = path === MANUAL_KEY ? processedToday[path] : processedToday[path].length;
          if (count === 0) return;

          const name = tags[path] || (path === MANUAL_KEY ? 'Ручные правки' : path);
          
          const div = document.createElement('div');
          div.className = 'details-item';
          div.innerHTML = `
              <span class="details-item-name" title="${path}">${name}</span>
              <strong>${count}</strong>
              ${path !== MANUAL_KEY ? `<button class="tag-btn" data-path="${path}">Тег</button>` : ''}
          `;
          container.appendChild(div);
      });
  }

  function modifyEditingCounter(amount) {
      chrome.storage.local.get([EDITING_STATS_KEY, PROCESSED_EDITS_KEY], (result) => {
          let history = result[EDITING_STATS_KEY] || {};
          let processed = result[PROCESSED_EDITS_KEY] || {};
          
          if (!processed[todayISO]) processed[todayISO] = {};
          if (typeof processed[todayISO][MANUAL_KEY] !== 'number') processed[todayISO][MANUAL_KEY] = 0;

          processed[todayISO][MANUAL_KEY] += amount;

          let todayTotal = 0;
          Object.keys(processed[todayISO]).forEach(path => {
              todayTotal += path === MANUAL_KEY ? processed[todayISO][path] : (processed[todayISO][path].length || 0);
          });
          
          if (todayTotal < 0) {
            processed[todayISO][MANUAL_KEY] -= todayTotal; // Корректируем ручные, чтобы не уйти в минус
            todayTotal = 0;
          }
          
          history[todayDate] = todayTotal;
          
          chrome.storage.local.set({
              [EDITING_STATS_KEY]: history,
              [PROCESSED_EDITS_KEY]: processed 
          });
      });
  }

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

  editingDetailsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-btn')) {
          const path = e.target.dataset.path;
          chrome.storage.local.get(TAGS_KEY, (result) => {
              const tags = result[TAGS_KEY] || {};
              const currentTag = tags[path] || '';
              const newTag = prompt(`Введите тег для действия:\n${path}`, currentTag);

              if (newTag !== null) {
                  tags[path] = newTag.trim();
                  chrome.storage.local.set({ [TAGS_KEY]: tags });
              }
          });
      }
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

  const inputsSearch = ['list_DebtID', 'list_EDocID', 'list_AccAddress_AccountNumber', 'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber'];
  const inputsStrict = ['strict_CaseNumber', 'strict_EDNumber'];
  const copyModeToggle = document.getElementById('setting_copy_mode');
  const highlightModeToggle = document.getElementById('setting_highlight_mode');
  
  chrome.storage.local.get(null, (items) => {
    // 1. Настройка режима копирования (включен по умолчанию)
    if (copyModeToggle) {
      if (items['setting_copy_mode'] === undefined) {
        copyModeToggle.checked = true; // Включаем по умолчанию
        chrome.storage.local.set({ 'setting_copy_mode': true });
      } else {
        copyModeToggle.checked = items['setting_copy_mode'];
      }
    }

    // 2. Настройка режима подсветки дублей
    if (highlightModeToggle) {
        highlightModeToggle.checked = items['setting_highlight_mode'] || false;
    }

    // 3. Настройка чекбоксов для полей поиска (сохраняем состояние)
    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (items[id] === undefined) el.checked = true; // По умолчанию включены
        else el.checked = items[id];
      }
    });
    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = items[id] || false;
    });
  });

  // Сохранение настроек при их изменении
  if (copyModeToggle) {
    copyModeToggle.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'setting_copy_mode': e.target.checked });
    });
  }

  if (highlightModeToggle) {
    highlightModeToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.local.set({ 'setting_highlight_mode': isEnabled });
      runSearch(isEnabled ? 'highlight' : 'clear');
    });
  }
  
  // Сохраняем состояние чекбоксов полей при их изменении
  [...inputsSearch, ...inputsStrict].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
          el.addEventListener('change', (e) => {
              chrome.storage.local.set({ [id]: e.target.checked });
              // Если режим подсветки уже включен, сразу пере-подсвечиваем с новыми параметрами
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
    
    logContainer.innerHTML = ''; // Очищаем контейнер

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
  loadLogs();
  
  // Слушатель изменений в хранилище для обновления UI
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.stats_history) updateCounterUI();
    // Реагируем на изменения новых ключей
    if (changes[EDITING_STATS_KEY] || changes[PROCESSED_EDITS_KEY] || changes[TAGS_KEY]) {
        updateEditingCounterUI();
    }
    if (changes[LOG_KEY]) updateLogsUI(changes[LOG_KEY].newValue);
  });

  // Слушатель сообщений от background скрипта
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateEditingCounter") {
        updateEditingCounterUI();
    }
  });
});