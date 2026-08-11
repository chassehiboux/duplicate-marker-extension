// StageTimer/timer_background.js
// Этот скрипт обрабатывает только логику отправки данных для StageTimer.
// НЕОБХОДИМО ОБЯЗАТЕЛЬНО ОБНОВЛЯТЬ ОБЫЧНЫЙ ФАЙЛ background.js в корне проекта
// НЕОБХОДИМО ОБЯЗАТЕЛЬНО ОБНОВЛЯТЬ deploy_VZID.js
// === КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦЫ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkP1L4n2Qc_GR1RigdEnX1kiG4Hw4eE5V3cDNrm3VV4ZYT8db8yTUUKLng1Pvj4Cp7/exec';
const TELEMETRY_RETRIES = 3;
const telemetryQueue = [];
let isTelemetryQueueRunning = false;

// Функция отправки с повторами
async function sendWithRetry(url, payload, retries = TELEMETRY_RETRIES) {
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
            return true;

        } catch (err) {
            console.error(`[StageTimer] Attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    console.error(`[StageTimer] Failed to send data after ${retries} attempts.`);
    return false;
}

function enqueueTelemetry(payload) {
    if (!payload) return;
    if (!GOOGLE_SCRIPT_URL) {
        console.error("[StageTimer] URL для отправки данных не задан.");
        return;
    }
    telemetryQueue.push(payload);
    if (!isTelemetryQueueRunning) {
        processTelemetryQueue().catch((err) => {
            console.error("[StageTimer] Telemetry queue crash:", err);
        });
    }
}

async function processTelemetryQueue() {
    if (isTelemetryQueueRunning) return;
    isTelemetryQueueRunning = true;
    try {
        while (telemetryQueue.length > 0) {
            const payload = telemetryQueue.shift();
            await sendWithRetry(GOOGLE_SCRIPT_URL, payload, TELEMETRY_RETRIES);
        }
    } finally {
        isTelemetryQueueRunning = false;
        if (telemetryQueue.length > 0) {
            processTelemetryQueue().catch((err) => {
                console.error("[StageTimer] Telemetry queue restart error:", err);
            });
        }
    }
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

const STAGE_MAX_WAITING_SEC = 2 * 60 * 60; // Жесткий лимит ожидания стадии: 2 часа.
let stageRequests = {}; // requestId -> { startTime, tabId, loadType, requestUrl }
let stageSessions = {}; // tabId -> { sessionId, baseName, userName, departmentName, stageName, loadType, requestUrl, version, startEpochMs }
const STAGE_DEPARTMENT_STATE_TTL_MS = 10000;
let stageDepartmentStates = {}; // tabId -> { depid, label, host, pageUrl, updatedAt }

function sendStageTabMessageQuiet(tabId, message) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) {
            // Вкладка могла быть закрыта или не содержать content script таймера.
        }
    });
}

function broadcastStageDepartmentConflicts() {
    const now = Date.now();
    Object.keys(stageDepartmentStates).forEach((tabId) => {
        const state = stageDepartmentStates[tabId];
        if (!state || (now - state.updatedAt) > STAGE_DEPARTMENT_STATE_TTL_MS) {
            delete stageDepartmentStates[tabId];
        }
    });

    const states = Object.values(stageDepartmentStates);
    const uniqueDepids = new Set(states.map((state) => state.depid));
    const payload = {
        conflict: uniqueDepids.size > 1,
        entries: states.map((state) => ({
            depid: state.depid,
            label: state.label,
            host: state.host
        }))
    };

    states.forEach((state) => {
        sendStageTabMessageQuiet(state.tabId, {
            action: "STAGE_TIMER_DEPARTMENT_CONFLICT",
            data: payload
        });
    });
}

function updateStageDepartmentState(tabId, data) {
    if (!Number.isInteger(tabId)) return;
    const depid = String(data && data.depid || "").trim();
    if (!depid) return;
    stageDepartmentStates[tabId] = {
        tabId,
        depid,
        label: String(data && data.label || depid).replace(/\s+/g, " ").trim() || depid,
        host: String(data && data.host || "").trim(),
        pageUrl: String(data && data.pageUrl || "").trim(),
        updatedAt: Date.now()
    };
    broadcastStageDepartmentConflicts();
}

function parseStageDurationSec(rawDuration) {
    if (rawDuration === undefined || rawDuration === null || rawDuration === "") return null;
    const parsed = Number(String(rawDuration).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function clampStageDurationSec(durationSec) {
    if (!Number.isFinite(durationSec)) return 0;
    return Math.min(STAGE_MAX_WAITING_SEC, Math.max(0, durationSec));
}

function clearStageRequestsForTab(tabId) {
    if (!Number.isInteger(tabId)) return;
    Object.keys(stageRequests).forEach((requestId) => {
        if (stageRequests[requestId] && stageRequests[requestId].tabId === tabId) {
            delete stageRequests[requestId];
        }
    });
}

function getStageTabId(request, sender) {
    const tabIdFromSender = sender && sender.tab ? sender.tab.id : null;
    const tabIdFromRequest = request.data && Number.isInteger(request.data.tabId) ? request.data.tabId : null;
    return Number.isInteger(tabIdFromRequest) ? tabIdFromRequest : tabIdFromSender;
}

function upsertStageSession(tabId, data) {
    if (!Number.isInteger(tabId) || !data) return;

    const existing = stageSessions[tabId] || {};
    const incomingDurationSec = parseStageDurationSec(data.duration);
    stageSessions[tabId] = {
        ...existing,
        tabId: tabId,
        sessionId: data.sessionId || existing.sessionId || "",
        baseName: data.baseName || existing.baseName || "Основная",
        userName: data.userName || existing.userName || "Не определен",
        departmentName: data.departmentName || existing.departmentName || "Не определен",
        stageName: data.stageName || existing.stageName || "ПК Пирамида",
        loadType: data.loadType || existing.loadType || "Загрузка",
        requestUrl: data.requestUrl || existing.requestUrl || "",
        version: data.version || existing.version || "",
        startEpochMs: Number.isFinite(data.startEpochMs) ? data.startEpochMs : (existing.startEpochMs || Date.now()),
        lastDurationSec: incomingDurationSec !== null
            ? clampStageDurationSec(incomingDurationSec)
            : (Number.isFinite(existing.lastDurationSec) ? existing.lastDurationSec : 0),
        lastEventEpochMs: Date.now()
    };
}

function sendStageCancelForClosedTab(tabId) {
    const session = stageSessions[tabId];
    if (!session || !session.sessionId) return;

    const elapsedByClockSec = Math.max(0, (Date.now() - (session.startEpochMs || Date.now())) / 1000);
    const durationSecNum = Number.isFinite(session.lastDurationSec) && session.lastDurationSec > 0
        ? session.lastDurationSec
        : elapsedByClockSec;
    const durationSec = clampStageDurationSec(durationSecNum).toFixed(2);
    const payload = {
        baseName: session.baseName || "Основная",
        stageName: session.stageName || "ПК Пирамида",
        userName: session.userName || "Не определен",
        departmentName: session.departmentName || "Не определен",
        duration: durationSec,
        timestamp: new Date().toLocaleString("ru-RU"),
        status: "ОТМЕНА",
        sessionId: session.sessionId,
        loadType: session.loadType || "Загрузка",
        requestUrl: session.requestUrl || "",
        version: session.version || ""
    };

    delete stageSessions[tabId];

    enqueueTelemetry(payload);
}

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
            loadType: loadType,
            requestUrl: details.url
        };

        if (Number.isInteger(details.tabId)) {
            upsertStageSession(details.tabId, {
                loadType: loadType,
                requestUrl: details.url
            });
        }
        
        // Сообщаем контент скрипту: "Покажи спиннер"
        sendStageTabMessageQuiet(details.tabId, {
            action: "STAGE_TIMER_START",
            data: { loadType: loadType, requestUrl: details.url }
        });
    }
    
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onCompleted.addListener((details) => {
    const req = stageRequests[details.requestId];
    if (req) {
        const duration = performance.now() - req.startTime;
        
        // Сообщаем контент скрипту: "Готово, вот время"
        sendStageTabMessageQuiet(req.tabId, {
            action: "STAGE_TIMER_STOP",
            data: { 
                duration: duration,
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        });
        
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onErrorOccurred.addListener((details) => {
    const req = stageRequests[details.requestId];
    if (req) {
        sendStageTabMessageQuiet(req.tabId, {
            action: "STAGE_TIMER_ERROR",
            data: {
                duration: performance.now() - req.startTime,
                error: details.error || "",
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        });
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });


// --- Основной обработчик сообщений ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'STAGE_TIMER_DEPARTMENT_STATE') {
        const tabId = getStageTabId(request, sender);
        updateStageDepartmentState(tabId, request.data || {});
        return false;
    }

    if (request.action === 'STAGE_TIMER_SESSION_START') {
        const tabId = getStageTabId(request, sender);
        if (Number.isInteger(tabId)) {
            upsertStageSession(tabId, request.data || {});
        }
        return false;
    }

    if (request.action === 'STAGE_TIMER_SESSION_UPDATE') {
        const tabId = getStageTabId(request, sender);
        if (Number.isInteger(tabId)) {
            upsertStageSession(tabId, request.data || {});
        }
        return false;
    }

    if (request.action === 'STAGE_TIMER_CANCEL') {
        const tabId = getStageTabId(request, sender);
        clearStageRequestsForTab(tabId);
        return false;
    }

    if (request.action === 'LOG_STAGE_INCIDENT') {
        const d = request.data || {};
        const payload = {
            eventType: d.eventType || "stage_incident",
            incidentType: d.incidentType || "",
            baseName: d.baseName || "Основная",
            stageName: d.stageName || "ПК Пирамида",
            userName: d.userName || "Не определен",
            departmentName: d.departmentName || "Не определен",
            timestamp: d.timestamp || new Date().toISOString(),
            pageUrl: d.pageUrl || "",
            context: d.context || "",
            summaryText: d.summaryText || "",
            fullText: d.fullText || "",
            signature: d.signature || "",
            edocId: d.edocId || "",
            debtId: d.debtId || "",
            epguSentAt: d.epguSentAt || "",
            epguRequestType: d.epguRequestType || "",
            version: d.version || ""
        };
        enqueueTelemetry(payload);
        return true;
    }

    if (request.action === 'LOG_ROWS10000_INCIDENT') {
        const d = request.data || {};
        const payload = {
            eventType: d.eventType || "rows10000_incident",
            incidentType: d.incidentType || "ROWS10000",
            traceId: d.traceId || "",
            baseName: d.baseName || "Основная",
            stageName: d.stageName || "ПК Пирамида",
            userName: d.userName || "Не определен",
            departmentName: d.departmentName || "Не определен",
            timestamp: d.timestamp || new Date().toISOString(),
            pageUrl: d.pageUrl || "",
            requestUrl: d.requestUrl || "",
            requestMethod: d.requestMethod || "GET",
            rows: d.rows || "",
            buttonCounter: d.buttonCounter || "",
            buttonCounterNumber: d.buttonCounterNumber || "",
            selarrrowLen: d.selarrrowLen || "",
            visibleCheckedCount: d.visibleCheckedCount || "",
            summaryText: d.summaryText || "",
            fullText: d.fullText || "",
            triggerReason: d.triggerReason || "",
            requestData: d.requestData || {},
            stateSnapshot: d.stateSnapshot || {},
            trace: Array.isArray(d.trace) ? d.trace : [],
            version: d.version || ""
        };
        enqueueTelemetry(payload);
        return true;
    }

    if (request.action === 'LOG_STAGE_TIME') {
        const d = request.data || {};
        const incomingDurationSec = parseStageDurationSec(d.duration);
        let normalizedStatus = d.status;
        let normalizedDurationSec = incomingDurationSec;

        if (normalizedStatus === "ОЖИДАНИЕ" && incomingDurationSec !== null && incomingDurationSec > STAGE_MAX_WAITING_SEC) {
            normalizedStatus = "ОТМЕНА";
            normalizedDurationSec = STAGE_MAX_WAITING_SEC;
        }

        const normalizedDurationStr = (normalizedDurationSec !== null)
            ? clampStageDurationSec(normalizedDurationSec).toFixed(2)
            : String(d.duration || "0");
        const tabId = getStageTabId(request, sender);
        if (Number.isInteger(tabId)) {
            upsertStageSession(tabId, {
                ...d,
                status: normalizedStatus,
                duration: normalizedDurationStr
            });
        }

        // Игнорируем отправку, если пользователь не определен
        if (d.userName === "Не определен" && normalizedStatus !== "ОТМЕНА") {
            console.log("[StageTimer] Запись пропущена: Пользователь не определен.");
            return false;
        }

        const session = Number.isInteger(tabId) ? stageSessions[tabId] : null;
        const requestUrl = d.requestUrl || (session && session.requestUrl) || "";
        const departmentName = d.departmentName || (session && session.departmentName) || "Не определен";

        // Формируем payload для POST
        const payload = {
            baseName: d.baseName,
            stageName: d.stageName,
            userName: d.userName,
            departmentName: departmentName,
            duration: normalizedDurationStr,
            timestamp: d.timestamp,
            status: normalizedStatus,
            sessionId: d.sessionId,
            loadType: d.loadType,
            requestUrl: requestUrl,
            version: d.version // <-- ДОБАВЛЕНО
        };

        // Запускаем отправку (не ждем завершения, так как это fire-and-forget)
        enqueueTelemetry(payload);

        if (normalizedStatus !== "ОЖИДАНИЕ" && Number.isInteger(tabId)) {
            delete stageSessions[tabId];
            clearStageRequestsForTab(tabId);
        }

        return true;
    }
    return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
    sendStageCancelForClosedTab(tabId);
    clearStageRequestsForTab(tabId);
    delete stageDepartmentStates[tabId];
    broadcastStageDepartmentConflicts();
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
