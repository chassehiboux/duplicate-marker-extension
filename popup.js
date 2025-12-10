document.addEventListener('DOMContentLoaded', () => {
  // === БЛОК СЧЕТЧИКА И ИСТОРИИ ===
  const todayCountEl = document.getElementById('today-count');
  const historyBtn = document.getElementById('btn-show-history');
  const historyContainer = document.getElementById('history-container');
  const btnPlus = document.getElementById('btn-plus');
  const btnMinus = document.getElementById('btn-minus');

  const todayDate = new Date().toLocaleDateString('ru-RU');

  // Функция обновления UI счетчика и истории
  function updateCounterUI() {
    chrome.storage.local.get(['stats_history'], (result) => {
      const history = result.stats_history || {};
      const todayVal = history[todayDate] || 0;
      todayCountEl.textContent = todayVal;

      // Отрисовка блока истории
      const dates = Object.keys(history).sort((a, b) => {
        const [d1, m1, y1] = a.split('.');
        const [d2, m2, y2] = b.split('.');
        return new Date(`${y2}-${m2}-${d2}`) - new Date(`${y1}-${m1}-${d1}`);
      });

      historyContainer.innerHTML = '';
      let hasHistory = false;
      dates.forEach(date => {
        if (date !== todayDate) {
          hasHistory = true;
          const div = document.createElement('div');
          div.className = 'history-item';
          div.innerHTML = `<span>${date}</span> <span>${history[date]} шт.</span>`;
          historyContainer.appendChild(div);
        }
      });
      if (!hasHistory) {
        historyContainer.innerHTML = '<div style="text-align:center;font-size:11px;opacity:0.7;">История пуста</div>';
      }
    });
  }

  // Функция для ручного изменения счетчика
  function modifyCounter(amount) {
    chrome.storage.local.get(['stats_history'], (result) => {
      let history = result.stats_history || {};
      let current = history[todayDate] || 0;
      
      let newVal = current + amount;
      if (newVal < 0) newVal = 0; // Счетчик не может быть отрицательным
      
      history[todayDate] = newVal;
      
      chrome.storage.local.set({ 'stats_history': history }, () => {
        updateCounterUI();
      });
    });
  }

  btnPlus.addEventListener('click', () => modifyCounter(1));
  btnMinus.addEventListener('click', () => modifyCounter(-1));
  historyBtn.addEventListener('click', () => {
    historyContainer.style.display = (historyContainer.style.display === 'block') ? 'none' : 'block';
  });

  // Первоначальное обновление UI при открытии
  updateCounterUI();
  // Слушатель для обновления UI при изменении данных в хранилище
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.stats_history) updateCounterUI();
  });


  // === БЛОК ПОИСКА ДУБЛИКАТОВ И НАСТРОЕК ===
  const inputsSearch = ['list_DebtID', 'list_EDocID', 'list_AccAddress_AccountNumber', 'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber'];
  const inputsStrict = ['strict_CaseNumber', 'strict_EDNumber'];
  const inputCopyMode = document.getElementById('setting_copy_mode');
  const btnCheck = document.getElementById('btn-check');
  const btnClear = document.getElementById('btn-clear');

  // Загрузка сохраненных настроек чекбоксов
  chrome.storage.local.get(null, (items) => {
    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      if (items[id] === undefined) el.checked = true; else el.checked = items[id];
    });
    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      if (items[id] !== undefined) el.checked = items[id];
    });
    if (items['setting_copy_mode'] !== undefined) inputCopyMode.checked = items['setting_copy_mode'];
  });

  // Сохранение настройки "Турбо-режима"
  inputCopyMode.addEventListener('change', () => {
    chrome.storage.local.set({ 'setting_copy_mode': inputCopyMode.checked });
  });

  // Запуск поиска или очистки дубликатов на активной вкладке
  async function runSearch(action) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    const settings = {};
    const activeFields = [];
    const strictOptions = {};
    
    // Собираем текущие настройки из UI
    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      settings[id] = el.checked;
      if (el.checked) activeFields.push(id);
    });
    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      settings[id] = el.checked;
      strictOptions[id.replace('strict_', 'list_')] = el.checked;
    });

    chrome.storage.local.set(settings); // Сохраняем настройки
    // Отправляем команду в content.js
    chrome.tabs.sendMessage(tab.id, {
      action: action, fields: activeFields, strictMode: strictOptions
    }).catch(() => {});
  }
  btnCheck.addEventListener('click', () => runSearch('highlight'));
  btnClear.addEventListener('click', () => runSearch('clear'));

  // === БЛОК ЖУРНАЛА ДЕЙСТВИЙ ===
  const logContainer = document.getElementById('log-container');
  const btnClearLog = document.getElementById('btn-clear-log');
  const LOG_KEY = 'extension_logs';

  // Функция обновления UI журнала
  function updateLogsUI(logs) {
    if (logContainer) {
      if (logs && logs.length > 0) {
        logContainer.textContent = logs.join('\n');
      } else {
        logContainer.textContent = 'Журнал пуст.';
      }
    }
  }

  // Функция загрузки логов из хранилища
  function loadLogs() {
    chrome.storage.local.get(LOG_KEY, (data) => {
      updateLogsUI(data[LOG_KEY]);
    });
  }

  btnClearLog.addEventListener('click', () => {
    // Очищаем логи в хранилище и обновляем UI.
    chrome.storage.local.set({ [LOG_KEY]: [] }, () => {
      loadLogs();
    });
  });

  // Обновляем логи, если они изменились в хранилище (например, фоновым скриптом).
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[LOG_KEY]) {
      updateLogsUI(changes[LOG_KEY].newValue);
    }
  });

  // Первоначальная загрузка логов при открытии панели.
  loadLogs();
});
