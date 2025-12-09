// Этот скрипт обрабатывает фоновые операции расширения.

// --- Утилита для логирования ---
const LOG_KEY = 'extension_logs'; // Ключ для хранения логов в chrome.storage
const MAX_LOG_ENTRIES = 100; // Максимальное количество записей в логе

const addLog = (message) => {
  try {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = `${timestamp}: ${message}`;
    
    chrome.storage.local.get(LOG_KEY, (data) => {
      let logs = data[LOG_KEY] || [];
      logs.unshift(logEntry);
      if (logs.length > MAX_LOG_ENTRIES) {
        logs.length = MAX_LOG_ENTRIES;
      }
      chrome.storage.local.set({ [LOG_KEY]: logs });
    });
  } catch(e) {
    console.error("Не удалось записать в лог расширения:", e);
  }
};


// --- Логика боковой панели ---
chrome.runtime.onInstalled.addListener(() => {
  addLog("Расширение установлено/обновлено.");
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => addLog(`Ошибка настройки панели: ${error}`));
});

chrome.action.onClicked.addListener((tab) => {
  addLog("Иконка нажата (запасной вариант).");
  chrome.sidePanel.open({ windowId: tab.windowId });
});


// --- Логика счетчика "Анализа исполнения" ---

// Временное хранилище для edocid, которые были открыты, но еще не сохранены.
let pendingEdocids = {};

// Очищаем временное хранилище при закрытии вкладки.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (pendingEdocids[tabId]) {
    addLog(`Вкладка ${tabId} закрыта, удаляю ожидающий edocid: ${pendingEdocids[tabId]}`);
    delete pendingEdocids[tabId];
  }
});

// --- ЭТАП 1: Слушаем ОТКРЫТИЕ формы (событие onCompleted) ---
// Срабатывает, когда успешно загрузилась страница с параметром ?edocid=...
chrome.webRequest.onCompleted.addListener((details) => {
    if (details.statusCode >= 200 && details.statusCode < 300) {
        try {
            const url = new URL(details.url);
            const edocid = url.searchParams.get('edocid');
            // Убеждаемся, что edocid действительно есть в параметрах
            if (edocid) {
                pendingEdocids[details.tabId] = edocid;
                addLog(`Открытие формы. Запомнил edocid: ${edocid} для вкл. ${details.tabId}`);
            }
        } catch(e) {
            addLog(`Ошибка на этапе 1: ${e.message}`);
        }
    }
}, {
    urls: ["*://*/ovzid/actions/execution-analysis?*"], // Фильтр только для URL с параметрами
    types: ["xmlhttprequest", "main_frame", "sub_frame"]
});


// --- ЭТАП 2: Слушаем СОХРАНЕНИЕ формы (событие onBeforeRedirect) ---
// Срабатывает, когда от URL без параметров происходит перенаправление.
chrome.webRequest.onBeforeRedirect.addListener((details) => {
    try {
        const url = new URL(details.url);
        // Убеждаемся, что это наш URL сохранения (без параметров)
        if (url.pathname.includes("/ovzid/actions/execution-analysis") && url.search === '') {
            addLog(`Сохранение (редирект). Ищу edocid для вкл. ${details.tabId}`);
            const edocidToProcess = pendingEdocids[details.tabId];

            if (edocidToProcess) {
                // Запускаем основную логику счетчика
                processCounterLogic(edocidToProcess, details.tabId);
            } else {
                addLog(`-> Для вкл. ${details.tabId} нет ожидающего edocid. Пропущено.`);
            }
        }
    } catch(e) {
        addLog(`Ошибка на этапе 2: ${e.message}`);
    }
}, {
    urls: ["*://*/ovzid/actions/execution-analysis"] // Фильтр только для URL БЕЗ параметров
});

// Основная функция, которая проверяет дубликаты за день и увеличивает счетчик.
function processCounterLogic(edocid, tabId) {
    addLog(`-> Обработка edocid: ${edocid}`);
    // Сразу удаляем из ожидания, чтобы избежать двойного срабатывания.
    delete pendingEdocids[tabId];

    const todayForHistory = new Date().toLocaleDateString('ru-RU');
    const todayForProcessed = new Date().toISOString().split('T')[0];

    chrome.storage.local.get(['stats_history', 'processed_edocids'], (result) => {
        let history = result.stats_history || {};
        let processed = result.processed_edocids || {};

        if (!processed[todayForProcessed]) {
            processed[todayForProcessed] = [];
        }

        addLog(`-> Проверка в списке [${todayForProcessed}]: [${processed[todayForProcessed].join(', ')}]`);

        if (processed[todayForProcessed].includes(edocid)) {
            addLog(`-> УЖЕ ЕСТЬ. Счетчик НЕ увеличен.`);
            return;
        }
        
        history[todayForHistory] = (history[todayForHistory] || 0) + 1;
        processed[todayForProcessed].push(edocid);

        chrome.storage.local.set({ 
            'stats_history': history,
            'processed_edocids': processed 
        }, () => {
            const newCount = history[todayForHistory];
            addLog(`-> ДОБАВЛЕН. Счетчик: ${newCount}.`);

            // Показываем уведомление
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Счетчик обновлен',
                message: `Анализ исполнения засчитан! Сегодня: ${newCount} шт.`,
                silent: true
            });
        });
    });
}

addLog("Background скрипт запущен.");