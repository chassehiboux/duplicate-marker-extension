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
  
  // Инициализация хранилища для нового счетчика
  chrome.storage.local.get(['approved_actions', 'blocked_actions', 'pending_actions'], (result) => {
    if (!result.approved_actions) {
      chrome.storage.local.set({ 'approved_actions': [] });
    }
    if (!result.blocked_actions) {
      chrome.storage.local.set({ 'blocked_actions': [] });
    }
    if (!result.pending_actions) {
      chrome.storage.local.set({ 'pending_actions': [] });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'approve_action': {
            const { path, edocid, tag } = request.data;
            addLog(`Получено утверждение для '${path}' с тегом '${tag || ''}'`);
            
            chrome.storage.local.get(['approved_actions', 'pending_actions', 'action_tags'], (result) => {
                let approved = result.approved_actions || [];
                let pending = result.pending_actions || [];
                let tags = result.action_tags || {};

                if (!approved.includes(path)) {
                    approved.push(path);
                }
                
                if (tag) {
                    tags[path] = tag;
                }

                const newPending = pending.filter(p => !(p.path === path && p.edocid === edocid));

                chrome.storage.local.set({ 
                    'approved_actions': approved, 
                    'pending_actions': newPending,
                    'action_tags': tags
                }, () => {
                    // Счетчик НЕ увеличивается здесь, только при сохранении (POST)
                    sendResponse({ success: true });
                    chrome.runtime.sendMessage({ action: "pendingActionsUpdated" }); // Уведомить UI об изменениях
                });
            });
            return true; // для асинхронного ответа
        }
        
        case 'block_action': {
            const { path, edocid } = request.data;
            addLog(`Получена блокировка для '${path}'`);
            chrome.storage.local.get(['blocked_actions', 'pending_actions'], (result) => {
                let blocked = result.blocked_actions || [];
                let pending = result.pending_actions || [];

                if (!blocked.includes(path)) {
                    blocked.push(path);
                }

                // Удаляем все ожидающие действия с этим путем
                const newPending = pending.filter(p => p.path !== path);

                chrome.storage.local.set({ 'blocked_actions': blocked, 'pending_actions': newPending }, () => {
                    sendResponse({ success: true });
                    chrome.runtime.sendMessage({ action: "pendingActionsUpdated" }); // Уведомить об изменении
                });
            });
            return true; // для асинхронного ответа
        }
    }
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
  // Также очищаем для нового счетчика
  if (pendingEditingActions[tabId]) {
    addLog(`Вкладка ${tabId} закрыта, удаляю ожидающее действие: ${JSON.stringify(pendingEditingActions[tabId])}`);
    delete pendingEditingActions[tabId];
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
                addLog(`Анализ. Открытие формы. Запомнил edocid: ${edocid} для вкл. ${details.tabId}`);
            }
        } catch(e) {
            addLog(`Анализ. Ошибка на этапе 1: ${e.message}`);
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
            addLog(`Анализ. Сохранение (редирект). Ищу edocid для вкл. ${details.tabId}`);
            const edocidToProcess = pendingEdocids[details.tabId];

            if (edocidToProcess) {
                // Запускаем основную логику счетчика
                processCounterLogic(edocidToProcess, details.tabId);
            } else {
                addLog(`Анализ. -> Для вкл. ${details.tabId} нет ожидающего edocid. Пропущено.`);
            }
        }
    } catch(e) {
        addLog(`Анализ. Ошибка на этапе 2: ${e.message}`);
    }
}, {
    urls: ["*://*/ovzid/actions/execution-analysis"] // Фильтр только для URL БЕЗ параметров
});

// Основная функция, которая проверяет дубликаты за день и увеличивает счетчик.
function processCounterLogic(edocid, tabId) {
    addLog(`Анализ. -> Обработка edocid: ${edocid}`);
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

        addLog(`Анализ. -> Проверка в списке [${todayForProcessed}]: [${processed[todayForProcessed].join(', ')}]`);

        if (processed[todayForProcessed].includes(edocid)) {
            addLog(`Анализ. -> УЖЕ ЕСТЬ. Счетчик НЕ увеличен.`);
            return;
        }
        
        history[todayForHistory] = (history[todayForHistory] || 0) + 1;
        processed[todayForProcessed].push(edocid);

        chrome.storage.local.set({ 
            'stats_history': history,
            'processed_edocids': processed 
        }, () => {
            const newCount = history[todayForHistory];
            addLog(`Анализ. -> ДОБАВЛЕН. Счетчик: ${newCount}.`);

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

// --- Логика счетчика "Редактирование/Маркировка" ---

let pendingEditingActions = {};

// Паттерны для URL, которые мы отслеживаем.
// 1. Все, что внутри /ovzid/actions/, кроме /markers_ovzid
// 2. Все, что внутри /ordz/
// 3. Добавлен updateWorkPlaceForm/manual для специфичного случая
const editingUrlPatterns = [
    /ovzid\/actions\/(?!markers_ovzid).*/,
    /ordz\/.*/,
    /ovzid\/updateWorkPlaceForm\/manual.*/
];

// Гибкая функция для извлечения ID документа из URL.
// Ищет любой ключ, начинающийся с "edoc" (без учета регистра) и возвращает его значение.
function getEdocIdFromUrl(url) {
    for (const [key, value] of url.searchParams.entries()) {
        if (key.toLowerCase().startsWith('edoc')) {
            return value;
        }
    }
    return null;
}


// ЭТАП 1: Слушаем открытие формы (GET-запрос с edocId)
// Это "взводит" механизм и решает, является ли действие новым.
chrome.webRequest.onCompleted.addListener((details) => {
    if (details.method !== "GET" || details.statusCode < 200 || details.statusCode >= 300) return;

    try {
        const url = new URL(details.url);
        const path = url.pathname;

        const isMatch = editingUrlPatterns.some(pattern => pattern.test(path));
        if (!isMatch) return;

        const edocid = getEdocIdFromUrl(url);

        if (edocid) {
            chrome.storage.local.get(['approved_actions', 'blocked_actions', 'pending_actions'], (result) => {
                const approved = result.approved_actions || [];
                const blocked = result.blocked_actions || [];
                let pending = result.pending_actions || [];

                if (blocked.includes(path)) {
                    addLog(`Редакт. Открытие. Путь ${path} заблокирован. Игнор.`);
                    return; 
                }

                // Всегда запоминаем действие, чтобы поймать POST-запрос на сохранение.
                pendingEditingActions[details.tabId] = { id: edocid, path: path };
                addLog(`Редакт. Открытие. Запомнил: ${JSON.stringify(pendingEditingActions[details.tabId])} для вкл. ${details.tabId}`);
                
                // Если действие не утверждено, проверяем, не ожидает ли оно уже подтверждения.
                if (!approved.includes(path)) {
                    const isAlreadyPending = pending.some(p => p.path === path && p.edocid === edocid);
                    if (!isAlreadyPending) {
                        addLog(`Редакт. Открытие (новое). Действие '${path}' добавлено в ожидание.`);
                        pending.push({ path: path, edocid: edocid });
                        
                        chrome.storage.local.set({ 'pending_actions': pending }, () => {
                            chrome.runtime.sendMessage({ action: "pendingActionsUpdated" });
                        });
                    }
                }
            });
        }
    } catch (e) {
        addLog(`Редакт. Ошибка на этапе 1 (GET): ${e.message}`);
    }
}, {
    urls: ["<all_urls>"],
    types: ["main_frame", "sub_frame", "xmlhttprequest"]
});


// ЭТАП 2: Слушаем сохранение (POST-запрос, который вызывает редирект)
// Это "спускает курок" и засчитывает действие, ЕСЛИ оно было утверждено.
chrome.webRequest.onBeforeRedirect.addListener((details) => {
    // Убедимся, что это успешный POST-запрос.
    if (details.method !== 'POST' || details.statusCode < 300 || details.statusCode >= 400) return;
    
    try {
        const postUrl = new URL(details.url);
        const path = postUrl.pathname;
        
        // Проверяем, что URL сохранения также соответствует паттернам.
        const isMatch = editingUrlPatterns.some(pattern => pattern.test(path));
        if (!isMatch) return;
        
        addLog(`Редакт. Сохранение (POST редирект в ${path}). Ищу действие для вкл. ${details.tabId}`);
        const actionToProcess = pendingEditingActions[details.tabId];

        // Если для этой вкладки есть "взведенное" действие, засчитываем его.
        if (actionToProcess) {
            // Используем ID и путь, сохраненные на этапе 1.
            processEditingCounterLogic(actionToProcess.id, actionToProcess.path, details.tabId);
        } else {
            addLog(`Редакт. -> Для вкл. ${details.tabId} нет ожидающего действия. Пропущено.`);
        }
    } catch (e) {
        addLog(`Редакт. Ошибка на этапе 2 (POST): ${e.message}`);
    }
}, {
    urls: ["<all_urls>"] // Слушаем все и фильтруем внутри
});


// Упрощенная функция, которая срабатывает при сохранении.
// Основная логика по добавлению в "pending" уже отработала на этапе GET.
function processEditingCounterLogic(edocid, path, tabId) {
    addLog(`Редакт. -> Сохранение для: path=${path}, edocid=${edocid}`);
    if (pendingEditingActions[tabId]) {
        delete pendingEditingActions[tabId];
    }

    chrome.storage.local.get(['approved_actions'], (result) => {
        const approved = result.approved_actions || [];

        if (approved.includes(path)) {
            addLog(`Редакт. -> Действие '${path}' утверждено. Засчитываем.`);
            _incrementEditingCounter(edocid, path);
        } else {
            addLog(`Редакт. -> Действие '${path}' еще не утверждено. Сохранение проигнорировано (ожидает подтверждения в UI).`);
        }
    });
}

// Старая логика, переименованная в "приватную" функцию
function _incrementEditingCounter(edocid, path) {
    addLog(`Редакт. -> Инкремент счетчика для: path=${path}, edocid=${edocid}`);

    const todayForHistory = new Date().toLocaleDateString('ru-RU');
    const todayForProcessed = new Date().toISOString().split('T')[0];
    
    const historyKey = 'editing_stats';
    const processedKey = 'processed_edits';
    const tagsKey = 'action_tags';

    chrome.storage.local.get([historyKey, processedKey, tagsKey], (result) => {
        let history = result[historyKey] || {};
        let processed = result[processedKey] || {};
        let tags = result[tagsKey] || {};

        if (!processed[todayForProcessed]) {
            processed[todayForProcessed] = {};
        }
        if (!Array.isArray(processed[todayForProcessed][path])) {
            if (!processed[todayForProcessed][path]) {
                processed[todayForProcessed][path] = [];
            } else {
                addLog(`Редакт. -> Попытка добавить edocid в поле, которое было отредактировано вручную. Пропущено.`);
                return;
            }
        }

        if (processed[todayForProcessed][path].includes(edocid)) {
            addLog(`Редакт. -> УЖЕ ЕСТЬ (${path} - ${edocid}). Счетчик НЕ увеличен.`);
            return;
        }
        
        processed[todayForProcessed][path].push(edocid);

        let dayTotal = 0;
        Object.keys(processed[todayForProcessed]).forEach(p => {
            const item = processed[todayForProcessed][p];
            dayTotal += typeof item === 'number' ? item : (Array.isArray(item) ? item.length : 0);
        });
        
        history[todayForHistory] = dayTotal;
        
        const actionCount = processed[todayForProcessed][path].length;
        const actionName = tags[path] || path;

        let dataToSet = {};
        dataToSet[historyKey] = history;
        dataToSet[processedKey] = processed;

        chrome.storage.local.set(dataToSet, () => {
            addLog(`Редакт. -> ДОБАВЛЕН. Общий счетчик: ${dayTotal}.`);
            chrome.runtime.sendMessage({ action: "updateEditingCounter" });

            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Счетчик обновлен',
                message: `Действие: ${actionName}\nКол-во: ${actionCount} (Всего за день: ${dayTotal})`,
                silent: true
            });
        });
    });
}


addLog("Background скрипт запущен.");