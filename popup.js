document.addEventListener('DOMContentLoaded', () => {
  // --- ОБЩИЕ ПЕРЕМЕННЫЕ ---
  const todayDate = new Date().toLocaleDateString('ru-RU');
  const todayISO = new Date().toISOString().split('T')[0];

  // --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК ---
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  let columnManagerInitialized = false;

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      tabContents.forEach(content => {
        content.style.display = (content.id === tabId) ? 'block' : 'none';
      });
      if (tabId === 'tab-content-columns' && !columnManagerInitialized) {
        initColumnManager();
        columnManagerInitialized = true;
      }
    });
  });

  // =============================================================
  // === ВКЛАДКА 2: УПРАВЛЕНИЕ СТОЛБЦАМИ ========================
  // =============================================================
  const columnsListDiv = document.getElementById('columns-list');
  const COL_STORAGE_KEY = 'hidden_columns';

  let currentColumns = [];
  let hiddenColumns = [];
  let targetTabForColumns = null;

  function renderColumns() {
    if (!columnsListDiv) return;
    if (currentColumns.length === 0) {
      columnsListDiv.innerHTML = '<p>Не удалось найти столбцы на целевой вкладке. Убедитесь, что страница (*.vostok-electra.ru) с таблицей открыта.</p>';
      return;
    }
    columnsListDiv.innerHTML = '';
    currentColumns.forEach(column => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `col-toggle-${column.id}`;
      checkbox.value = column.id;
      checkbox.checked = !hiddenColumns.includes(column.id);
      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${column.name}`));
      checkbox.addEventListener('change', handleCheckboxChange);
      columnsListDiv.appendChild(label);
    });
  }

  async function handleCheckboxChange(event) {
    if (!targetTabForColumns) return;
    const columnId = event.target.value;
    const isVisible = event.target.checked;

    // Обновляем наш локальный массив состояний
    if (isVisible) {
      hiddenColumns = hiddenColumns.filter(id => id !== columnId);
    } else {
      if (!hiddenColumns.includes(columnId)) {
        hiddenColumns.push(columnId);
      }
    }
    
    // Сохраняем в хранилище. content.js отреагирует на это изменение.
    await chrome.storage.local.set({ [COL_STORAGE_KEY]: hiddenColumns });
  }

  async function initColumnManager() {
    if (!columnsListDiv) return;
    columnsListDiv.innerHTML = '<p>Поиск вкладки vostok-electra.ru...</p>';
    
    const tabs = await chrome.tabs.query({ url: '*://*.vostok-electra.ru/*' });
    if (tabs.length === 0) {
      columnsListDiv.innerHTML = '<p>Не найдено открытых вкладок сайта vostok-electra.ru.</p>';
      return;
    }

    targetTabForColumns = tabs.find(t => t.active) || tabs[0];
    columnsListDiv.innerHTML = `<p>Загрузка столбцов с вкладки: ${targetTabForColumns.title.substr(0, 30)}...</p>`;

    try {
      const columnsFromPage = await chrome.tabs.sendMessage(targetTabForColumns.id, { action: 'getColumns' });
      currentColumns = columnsFromPage;
      const data = await chrome.storage.local.get(COL_STORAGE_KEY);
      if (typeof data[COL_STORAGE_KEY] === 'undefined') {
        hiddenColumns = currentColumns.filter(c => !c.isVisible).map(c => c.id);
        await chrome.storage.local.set({ [COL_STORAGE_KEY]: hiddenColumns });
      } else {
        hiddenColumns = data[COL_STORAGE_KEY];
      }
      renderColumns();
    } catch (error) {
      console.error("Error getting columns:", error);
      columnsListDiv.innerHTML = `<p>Не удалось получить столбцы с вкладки. Ошибка: ${error.message}</p>`;
    }
  }

  // =============================================================
  // === ВКЛАДКА 1: СЧЕТЧИКИ И НАСТРОЙКИ ========================
  // =============================================================

  const todayCountEl = document.getElementById('today-count');
  if(todayCountEl) {
    const historyBtn = document.getElementById('btn-show-history');
    const historyContainer = document.getElementById('history-container');
    const btnPlus = document.getElementById('btn-plus');
    const btnMinus = document.getElementById('btn-minus');
    
    function updateCounterUI() {
      chrome.storage.local.get(['stats_history'], (result) => {
        const history = result.stats_history || {};
        todayCountEl.textContent = history[todayDate] || 0;
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
      if (e.shiftKey) { modifyCounter(-Infinity); } else { modifyCounter(-1); }
    });
    historyBtn.addEventListener('click', () => { /* ... */ });
    
    const editingCountEl = document.getElementById('editing-count');
    // ... остальная логика для счетчиков ...
  }

  // --- ОБЩИЕ СЛУШАТЕЛИ И ИНИЦИАЛИЗАЦИЯ ---
  
  const allSettings = ['setting_copy_mode', 'setting_highlight_mode', 'setting_notify_execution', 'setting_notify_editing', 'list_DebtID', 'list_AccAddress_AccountNumber', 'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber', 'strict_CaseNumber', 'strict_EDNumber'];

  // Загружаем все настройки при запуске
  chrome.storage.local.get(allSettings, (items) => {
    allSettings.forEach(settingId => {
        const element = document.getElementById(settingId);
        if (element && element.type === 'checkbox') {
            // Устанавливаем значение из хранилища, или false если не определено
            element.checked = items[settingId] || false;
        }
    });
  });

  // Создаем слушателей для всех настроек
  allSettings.forEach(settingId => {
    const element = document.getElementById(settingId);
    if (element) {
      element.addEventListener('change', (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        chrome.storage.local.set({ [settingId]: value });
      });
    }
  });
  
  // Загрузка логов и прочего
  const logContainer = document.getElementById('log-container');
  const btnClearLog = document.getElementById('btn-clear-log');
  const LOG_KEY = 'extension_logs';

  function loadLogs() {
      if (!logContainer) return;
      chrome.storage.local.get(LOG_KEY, (data) => {
        logContainer.innerHTML = '';
        if (data[LOG_KEY] && data[LOG_KEY].length > 0) {
          data[LOG_KEY].forEach(logMsg => {
            const logItem = document.createElement('div');
            logItem.className = 'log-entry';
            logItem.textContent = logMsg;
            logContainer.appendChild(logItem);
          });
        } else {
          logContainer.textContent = 'Журнал пуст.';
        }
      });
  }
  if(btnClearLog) btnClearLog.addEventListener('click', () => { chrome.storage.local.remove(LOG_KEY, loadLogs); });
  loadLogs();

  chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[LOG_KEY]) { loadLogs(); }
      // Обновление счетчиков, если они изменились
      if (changes.stats_history && todayCountEl) {
        todayCountEl.textContent = changes.stats_history.newValue[todayDate] || 0;
      }
  });
});
