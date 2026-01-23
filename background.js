// Этот скрипт обрабатывает фоновые операции расширения.

// --- Подключение модулей ---
try {
    importScripts('Check_INN_DeathDate/inn_death_background.js');
    // importScripts('StageTimer/telemetry_background.js'); // Логика интегрирована внутрь
} catch (e) {
    console.error("Ошибка импорта скриптов в background.js:", e);
}

// === КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦЫ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkP1L4n2Qc_GR1RigdEnX1kiG4Hw4eE5V3cDNrm3VV4ZYT8db8yTUUKLng1Pvj4Cp7/exec';

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

// --- Функция надежной отправки (POST + Retry) ---
async function sendWithRetry(url, payload, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload),
                keepalive: true, 
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            
            if (text.includes("Busy")) {
                console.warn(`[TELEMETRY] Server busy. Retry ${i + 1}/${retries}`);
                await new Promise(r => setTimeout(r, 2000 * (i + 1))); 
                continue;
            }

            console.log(`[TELEMETRY] Success: ${payload.stageName}`);
            return;

        } catch (err) {
            console.error(`[TELEMETRY] Attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    console.error(`[TELEMETRY] Failed to send data after ${retries} attempts.`);
}


// === STAGE TIMER LOGIC (NETWORK BASED) ===
// Отслеживаем загрузку данных (GET) для таймера стадий
const STAGE_URL_PATTERNS = [
    "*://*/ovzid/*/data*", 
    "*://*/ovzid/actions/editedoc*", 
    "*://*/ovzid/claims/execution*",
    "*://*/pu/ReestrSendToOVZID*",
    "*://*/datagrids/slowsearch*"
]; 

const EXECUTION_MAP = {
    "execution-fssp": "Формирование заявление (ФССП)",
    "execution-fsspd": "Формирование заявление (ФССП умершие)",
    "execution-fsspb": "Формирование заявление (ФССП банкроты)",
    "execution-pf": "Формирование заявление (ПФ)",
    "execution-ku": "Формирование заявление (Заявление в банк)",
    "execution-buh": "Формирование заявление (Бухгалтерия)",
    "execution-zpbank": "Формирование заявление (ЗП в банк)",
    "execution-bo": "Формирование заявление (Бюджетные организации)",
    "execution-ozon": "Формирование заявление (OZON)",
    "execution-tinkoff": "Формирование заявление (Заявление в ТБанк)"
};

let stageRequests = {}; // requestId -> { startTime, tabId, loadType }

chrome.webRequest.onBeforeRequest.addListener((details) => {
    const url = new URL(details.url);
    // console.log("[StageTimer] Intercepted:", details.method, url.pathname); // Debug log

    let loadType = "Загрузка стадии";
    let isTargetRequest = false;

    if (url.pathname.includes("/actions/editedoc")) {
        // Редактирование (POST)
        if (details.method === "POST") {
            loadType = "Редактирование информации";
            isTargetRequest = true;
        }
    } 
    else if (url.pathname.includes("/claims/execution")) {
        // Формирование заявлений (POST)
        if (details.method === "POST") {
            // Пытаемся найти точное совпадение по суффиксу
            const pathParts = url.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1]; 
            
            if (EXECUTION_MAP[lastPart]) {
                loadType = EXECUTION_MAP[lastPart];
            } else {
                loadType = "Формирование заявления (Прочее)";
            }
            isTargetRequest = true;
        }
    }
    else if (url.pathname.includes("/data")) {
        // Загрузка грида (обычно GET, но *data* паттерн ловит)
        const searchParam = url.searchParams.get("_search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
        }
        isTargetRequest = true;
    }
    else if (url.pathname.includes("/pu/ReestrSendToOVZID")) {
        // Загрузка реестра для ОВЗИД
        const searchParam = url.searchParams.get("search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
        } else {
             loadType = "Загрузка стадии";
        }
        isTargetRequest = true;
    }
    else if (url.pathname.includes("/datagrids/slowsearch")) {
        // Медленный поиск/загрузка в гридах
        const searchParam = url.searchParams.get("search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
        } else {
             loadType = "Загрузка стадии";
        }
        isTargetRequest = true;
    }

    if (isTargetRequest) {
        stageRequests[details.requestId] = {
            startTime: performance.now(),
            tabId: details.tabId,
            loadType: loadType
        };
        
        // Сообщаем контент скрипту: "Покажи спиннер"
        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_START",
            data: { loadType: loadType }
        }).catch(() => {}); 
    }
    
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onCompleted.addListener((details) => {
    const req = stageRequests[details.requestId];
    if (req) {
        const duration = performance.now() - req.startTime;
        
        // Сообщаем контент скрипту: "Готово, вот время"
        chrome.tabs.sendMessage(req.tabId, {
            action: "STAGE_TIMER_STOP",
            data: { 
                duration: duration,
                loadType: req.loadType
            }
        }).catch(() => {});
        
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onErrorOccurred.addListener((details) => {
    if (stageRequests[details.requestId]) {
        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_ERROR"
        }).catch(() => {});
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });


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
        
        // === ТЕЛЕМЕТРИЯ (ОБНОВЛЕННАЯ ВЕРСИЯ) ===
        case 'LOG_STAGE_TIME': {
            const d = request.data;
            
            if (GOOGLE_SCRIPT_URL) {
                const payload = {
                    baseName: d.baseName,
                    stageName: d.stageName,
                    userName: d.userName,
                    duration: d.duration.toString(),
                    timestamp: d.timestamp,
                    status: d.status,
                    sessionId: d.sessionId,
                    loadType: d.loadType
                };

                // Используем новую надежную функцию отправки
                sendWithRetry(GOOGLE_SCRIPT_URL, payload);
            }

            // Локальный лог
            if (d.status !== "ОЖИДАНИЕ") {
                const storageKey = `logs_${d.baseName}`;
                chrome.storage.local.get([storageKey], (res) => {
                    let logs = res[storageKey] || "";
                    let logEntry = d.logLine;
                    if (d.status !== "УСПЕШНО") logEntry += ` [${d.status}]`;
                    logs += logEntry + "\n";
                    chrome.storage.local.set({ [storageKey]: logs });
                });
            }

            return true; 
        }

        // === ДЕЙСТВИЯ ПАНЕЛИ УПРАВЛЕНИЯ ===
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
            const { path, edocid, tag } = request.data;
            addLog(`Получена блокировка для '${path}' с тегом '${tag || ''}'`);
            chrome.storage.local.get(['blocked_actions', 'pending_actions', 'action_tags'], (result) => {
                let blocked = result.blocked_actions || [];
                let pending = result.pending_actions || [];
                let tags = result.action_tags || {};

                if (!blocked.includes(path)) {
                    blocked.push(path);
                }
                
                if (tag) {
                    tags[path] = tag;
                }

                // Удаляем все ожидающие действия с этим путем
                const newPending = pending.filter(p => p.path !== path);

                chrome.storage.local.set({ 
                    'blocked_actions': blocked, 
                    'pending_actions': newPending,
                    'action_tags': tags
                }, () => {
                    sendResponse({ success: true });
                    chrome.runtime.sendMessage({ action: "pendingActionsUpdated" }); // Уведомить об изменении
                });
            });
            return true; // для асинхронного ответа
        }

        case 'toggle_action_status': {
            const { path, currentStatus } = request.data;
            addLog(`Получен запрос на смену статуса для '${path}' с '${currentStatus}'`);

            chrome.storage.local.get(['approved_actions', 'blocked_actions'], (result) => {
                let approved = result.approved_actions || [];
                let blocked = result.blocked_actions || [];

                if (currentStatus === 'approved') {
                    // Убираем из одобренных, добавляем в заблокированные
                    approved = approved.filter(p => p !== path);
                    if (!blocked.includes(path)) {
                        blocked.push(path);
                    }
                } else { // currentStatus === 'blocked'
                    // Убираем из заблокированных, добавляем в одобренные
                    blocked = blocked.filter(p => p !== path);
                    if (!approved.includes(path)) {
                        approved.push(path);
                    }
                }
                
                chrome.storage.local.set({ 
                    'approved_actions': approved, 
                    'blocked_actions': blocked 
                }, () => {
                    addLog(`Статус для '${path}' изменен.`);
                    // UI обновится автоматически через `storage.onChanged`
                });
            });
            return true;
        }

        case 'cancel_pending_action': {
            const { path, edocid } = request.data;
            addLog(`Получена отмена для '${path}' edocid: ${edocid}`);
            chrome.storage.local.get(['pending_actions'], (result) => {
                let pending = result.pending_actions || [];
                const newPending = pending.filter(p => !(p.path === path && p.edocid === edocid));

                if (pending.length !== newPending.length) {
                    chrome.storage.local.set({ 'pending_actions': newPending }, () => {
                        addLog(`Ожидающее действие для '${path}' edocid: ${edocid} удалено.`);
                        sendResponse({ success: true });
                        chrome.runtime.sendMessage({ action: "pendingActionsUpdated" });
                    });
                } else {
                    addLog(`Ожидающее действие для '${path}' edocid: ${edocid} не найдено.`);
                    sendResponse({ success: false, message: "Action not found" });
                }
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
  chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
    let currentPendingEditingActions = sessionResult.pendingEditingActions || {};
    if (currentPendingEditingActions[tabId]) {
      addLog(`Вкладка ${tabId} закрыта, удаляю ожидающее действие: ${JSON.stringify(currentPendingEditingActions[tabId])} из session storage.`);
      delete currentPendingEditingActions[tabId];
      chrome.storage.session.set({ 'pendingEditingActions': currentPendingEditingActions });
    }
  });
});

// --- ЭТАП 1: Слушаем ОТКРЫТИЕ формы (событие onCompleted) ---
// Срабатывает, когда успешно загрузилась страница с параметром ?edocid=...
chrome.webRequest.onCompleted.addListener((details) => {
    if (details.statusCode >= 200 && details.statusCode < 300) {
        try {
            const url = new URL(details.url);
            const edocids = getEdocIdFromUrl(url);
            // Убеждаемся, что edocids действительно есть в параметрах
            if (edocids.length > 0) {
                pendingEdocids[details.tabId] = edocids;
                addLog(`Анализ. Открытие формы. Запомнил edocids: ${JSON.stringify(edocids)} для вкл. ${details.tabId}`);
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
function processCounterLogic(edocids, tabId) { // Change parameter name
    addLog(`Анализ. -> Обработка edocids: ${JSON.stringify(edocids)}`); // Log array
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

        let newlyProcessedCount = 0; // New variable to track how many were actually added
        const processedToday = processed[todayForProcessed]; // Reference to the array for today

        edocids.forEach(edocid => { // Iterate over the array
            if (!processedToday.includes(edocid)) {
                processedToday.push(edocid);
                newlyProcessedCount++;
            } else {
                addLog(`Анализ. -> edocid ${edocid} УЖЕ ЕСТЬ. Пропущено.`);
            }
        });

        if (newlyProcessedCount === 0) {
            addLog(`Анализ. -> Все edocids уже были. Счетчик НЕ увеличен.`);
            return;
        }
        
        history[todayForHistory] = (history[todayForHistory] || 0) + newlyProcessedCount; // Increment by newlyProcessedCount
        
        chrome.storage.local.set({ 
            'stats_history': history,
            'processed_edocids': processed 
        }, () => {
            const newCount = history[todayForHistory];
            addLog(`Анализ. -> ДОБАВЛЕНО ${newlyProcessedCount}. Счетчик: ${newCount}.`);

            // Проверяем настройку перед отправкой уведомления
            chrome.storage.local.get('setting_notify_execution', (settings) => {
                if (settings.setting_notify_execution !== false) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon.png',
                        title: 'Счетчик обновлен',
                        message: `Анализ исполнения засчитан! Сегодня: ${newCount} шт. (Новых: ${newlyProcessedCount})`,
                        silent: true
                    });
                }
            });
        });
    });
}

// --- Логика счетчика "Редактирование/Маркировка" ---



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
            return value.split(',').map(id => id.trim()).filter(id => id); // Split by comma, trim, and filter empty strings
        }
    }
    return []; // Return an empty array if no edocid is found
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

        const edocids = getEdocIdFromUrl(url); // This now returns an array

        if (edocids.length > 0) { // Check if array is not empty
            chrome.storage.local.get(['approved_actions', 'blocked_actions', 'pending_actions'], (result) => {
                const approved = result.approved_actions || [];
                const blocked = result.blocked_actions || [];
                let pending = result.pending_actions || [];

                chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
                    let currentPendingEditingActions = sessionResult.pendingEditingActions || {};
                    currentPendingEditingActions[details.tabId] = { id: edocids, path: path };
                    chrome.storage.session.set({ 'pendingEditingActions': currentPendingEditingActions }, () => {
                        addLog(`Редакт. Открытие. Запомнил: ${JSON.stringify(currentPendingEditingActions[details.tabId])} для вкл. ${details.tabId}`);
                    });
                });

                edocids.forEach(singleEdocid => { // Iterate over each edocid
                    if (blocked.includes(path)) {
                        addLog(`Редакт. Открытие. Путь ${path} заблокирован. Игнор для edocid ${singleEdocid}.`);
                        return; // Skip this edocid if path is blocked
                    }

                    if (!approved.includes(path)) { // Only if the path is not yet approved
                        addLog(`Редакт. Открытие (новое). Принудительный вызов модалки для '${path}' edocid ${singleEdocid}.`);
                        // Immediately trigger the modal in the content script
                        chrome.tabs.sendMessage(details.tabId, {
                            action: 'show_confirmation_modal_in_tab',
                            data: { path: path, edocid: singleEdocid }
                        });
                    }
                });
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
        chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
            const currentPendingEditingActions = sessionResult.pendingEditingActions || {};
            const actionToProcess = currentPendingEditingActions[details.tabId];

            if (actionToProcess) {
                processEditingCounterLogic(actionToProcess.id, actionToProcess.path, details.tabId);
            } else {
                addLog(`Редакт. -> Для вкл. ${details.tabId} нет ожидающего действия. Пропущено.`);
            }
        });
    } catch (e) {
        addLog(`Редакт. Ошибка на этапе 2 (POST): ${e.message}`);
    }
}, {
    urls: ["<all_urls>"] // Слушаем все и фильтруем внутри
});


// Упрощенная функция, которая срабатывает при сохранении.
// Основная логика по добавлению в "pending" уже отработала на этапе GET.
function processEditingCounterLogic(edocids, path, tabId) { // Change parameter name to edocids
    addLog(`Редакт. -> Сохранение для: path=${path}, edocids=${JSON.stringify(edocids)}`); // Log array

    chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
        let currentPendingEditingActions = sessionResult.pendingEditingActions || {};
        if (currentPendingEditingActions[tabId]) {
            delete currentPendingEditingActions[tabId];
            chrome.storage.session.set({ 'pendingEditingActions': currentPendingEditingActions });
        }
    });

    chrome.storage.local.get(['approved_actions'], (result) => {
        const approved = result.approved_actions || [];

        if (approved.includes(path)) {
            addLog(`Редакт. -> Действие '${path}' утверждено. Засчитываем.`);
            edocids.forEach(singleEdocid => { // Iterate over edocids
                _incrementEditingCounter(singleEdocid, path); // Call for each single edocid
            });
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

        let pathData = processed[todayForProcessed][path];

        // --- Миграция / Инициализация pathData к новой структуре ---
        // Новая структура: { base_count: number, unique_edocids: string[] }
        if (!pathData) { // Если данных нет, инициализируем
            pathData = { base_count: 0, unique_edocids: [] };
            processed[todayForProcessed][path] = pathData;
        } else if (Array.isArray(pathData)) { // Если старый формат (массив edocid), мигрируем
            pathData = { base_count: pathData.length, unique_edocids: pathData };
            processed[todayForProcessed][path] = pathData;
            addLog(`Редакт. -> Миграция массива для ${path} в новую структуру.`);
        } else if (typeof pathData === 'number') { // Если старый формат (число от ручной правки), мигрируем
            pathData = { base_count: pathData, unique_edocids: [] }; // Сброс unique_edocids при ручной правке
            processed[todayForProcessed][path] = pathData;
            addLog(`Редакт. -> Миграция числа для ${path} в новую структуру.`);
        }
        // --- Конец Миграции ---


        if (pathData.unique_edocids.includes(edocid)) {
            addLog(`Редакт. -> УЖЕ ЕСТЬ (${path} - ${edocid}). Счетчик НЕ увеличен.`);
            return;
        }
        
        pathData.unique_edocids.push(edocid);
        pathData.base_count++; // Увеличиваем общий счетчик для этого пути


        // Пересчитываем общее количество за день
        let dayTotal = 0;
        Object.keys(processed[todayForProcessed]).forEach(p => {
            const item = processed[todayForProcessed][p];
            if (typeof item === 'object' && item !== null && 'base_count' in item) {
                dayTotal += item.base_count;
            } else { // Fallback для старых форматов, которые еще не были мигрированы
                 dayTotal += typeof item === 'number' ? item : (Array.isArray(item) ? item.length : 0);
            }
        });
        
        history[todayForHistory] = dayTotal;
        
        const actionCount = pathData.base_count; // Это общее количество для данного пути
        const actionName = tags[path] || path;


        let dataToSet = {};
        dataToSet[historyKey] = history;
        dataToSet[processedKey] = processed;

        chrome.storage.local.set(dataToSet, () => {
            addLog(`Редакт. -> ДОБАВЛЕН. Общий счетчик: ${dayTotal}.`);
            chrome.runtime.sendMessage({ action: "updateEditingCounter" });

            // Проверяем настройку перед отправкой уведомления
            chrome.storage.local.get('setting_notify_editing', (settings) => {
                if (settings.setting_notify_editing !== false) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon.png',
                        title: 'Счетчик обновлен',
                        message: `Действие: ${actionName}\nВсего за день: ${dayTotal} (Новых для ${actionName}: ${actionCount})`,
                        silent: true
                    });
                }
            });
        });
    });
}


addLog("Background скрипт запущен.");