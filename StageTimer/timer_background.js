// StageTimer/timer_background.js
// Этот скрипт обрабатывает только логику отправки данных для StageTimer.
// НЕОБХОДИМО ОБЯЗАТЕЛЬНО ОБНОВЛЯТЬ ОБЫЧНЫЙ ФАЙЛ background.js в корне проекта
// НЕОБХОДИМО ОБЯЗАТЕЛЬНО ОБНОВЛЯТЬ deploy_VZID.js
// === КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦЫ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkP1L4n2Qc_GR1RigdEnX1kiG4Hw4eE5V3cDNrm3VV4ZYT8db8yTUUKLng1Pvj4Cp7/exec';

// Функция отправки с повторами
async function sendWithRetry(url, payload, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8' // text/plain чтобы избежать CORS preflight
                },
                body: JSON.stringify(payload),
                keepalive: true, // Критично: позволяет запросу жить после закрытия вкладки
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();

            // Если сервер говорит "Busy" (мы настроили это в GAS), пробуем снова
            if (text.includes("Busy")) {
                console.warn(`[StageTimer] Server busy. Retry ${i + 1}/${retries}`);
                await new Promise(r => setTimeout(r, 2000 * (i + 1))); // Ждем 2, 4, 6 сек
                continue;
            }

            // Успех
            console.log(`[StageTimer] Success: ${payload.stageName} [${payload.status}]`);
            return;

        } catch (err) {
            console.error(`[StageTimer] Attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    console.error(`[StageTimer] Failed to send data after ${retries} attempts.`);
}

// === STAGE TIMER LOGIC (NETWORK BASED) ===
// Отслеживаем загрузку данных (GET) для таймера стадий
const STAGE_URL_PATTERNS = [
    "*://*/ovzid/*/data*", 
    "*://*/ovzid/actions/editedoc*", 
    "*://*/ovzid/claims/execution*",
    "*://*/pu/ReestrSendToOVZID*",
    "*://*/datagrids/slowsearch*",
    "*://*/grid-data*",
    "*://*/big-debtors/grid-data*"
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

const BIG_DEBTORS_MAP = {
    "search": "Поиск",
    "queue": "ЛС в очереди",
    "work": "ЛС в работе",
    "category_approved": "ЛС с категорией",
    "archive": "ЛС в Архиве",
    "early_execution": "На досрочную проверку",
    "category_approval_wait": "Ожидание присвоения категории",
    "expired_employee": "Пропущен срок сотрудника",
    "expired_boss": "Пропущен срок руководителя"
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
            // url.pathname может быть ".../ovzid/claims/execution-fssp"
            const pathParts = url.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1]; // "execution-fssp"
            
            if (EXECUTION_MAP[lastPart]) {
                loadType = EXECUTION_MAP[lastPart];
            } else {
                loadType = "Формирование заявления (Прочее)";
            }
            isTargetRequest = true;
        }
    }
    else if (url.pathname.includes("/data") && !url.pathname.includes("grid-data")) { // Исключаем grid-data здесь, он обработан отдельно
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
        // Срабатывает ТОЛЬКО если есть _search=true
        const searchParam = url.searchParams.get("_search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
            isTargetRequest = true;
        } else {
             // Игнорируем обычный slowsearch (чтобы не вешать таймер на пустых страницах)
             isTargetRequest = false;
        }
    }
    else if (url.pathname.includes("grid-data")) {
        // Фильтрация (Крупные должники и др.)
        const searchVal = url.searchParams.get("_search") || url.searchParams.get("search");

        if (url.pathname.includes("big-debtors")) {
             // Для крупных должников таймер включаем ТОЛЬКО если есть параметры поиска (true или false)
             if (!searchVal) {
                 isTargetRequest = false;
             } else {
                 if (searchVal === "true") {
                     loadType = "Фильтрация стадии";
                 } else {
                     loadType = "Загрузка стадии";
                 }
                 isTargetRequest = true;
             }
        } else {
            // Обычный грид
            if (searchVal) { // Есть search или _search (неважно true/false)
                loadType = "Фильтрация стадии";
            } else {
                loadType = "Загрузка стадии";
            }
            isTargetRequest = true;
        }
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


// --- Основной обработчик сообщений ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'LOG_STAGE_TIME') {
        const d = request.data;

        // Игнорируем отправку, если пользователь не определен
        if (d.userName === "Не определен") {
            console.log("[StageTimer] Запись пропущена: Пользователь не определен.");
            return false;
        }

        if (!GOOGLE_SCRIPT_URL) {
            console.error("[StageTimer] URL для отправки данных не задан.");
            return false;
        }

        // Формируем payload для POST
        const payload = {
            baseName: d.baseName,
            stageName: d.stageName,
            userName: d.userName,
            duration: d.duration.toString(),
            timestamp: d.timestamp,
            status: d.status,
            sessionId: d.sessionId,
            loadType: d.loadType,
            version: d.version // <-- ДОБАВЛЕНО
        };

        // Запускаем отправку (не ждем завершения, так как это fire-and-forget)
        sendWithRetry(GOOGLE_SCRIPT_URL, payload);

        return true;
    }
    return false;
});

console.log("Фоновый скрипт StageTimer (v2 POST + Network Monitor) запущен.");

// === ЛОГИКА АВТО-ОБНОВЛЕНИЯ (RELOAD) ===
async function checkForLocalUpdate() {
    try {
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;

        const response = await fetch(chrome.runtime.getURL('version.json') + '?t=' + Date.now());
        const data = await response.json();
        const folderVersion = data.version;

        if (folderVersion !== currentVersion) {
            console.log(`[UPDATE] Обнаружена новая версия в папке: ${folderVersion}. Перезагрузка...`);
            setTimeout(() => {
                chrome.runtime.reload();
            }, 1000);
        }
    } catch (e) {
        // Файл может отсутствовать при первой установке
    }
}

// Проверка раз в 15 минут
chrome.alarms.create("CheckFolderUpdate", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "CheckFolderUpdate") checkForLocalUpdate();
});

// Проверка при запуске
setTimeout(checkForLocalUpdate, 5000);