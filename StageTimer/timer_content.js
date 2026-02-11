// StageTimer/timer_content.js

(function() {
    // 1. Определение базы
    function getBaseName() {
        const h = window.location.hostname.toLowerCase();
        if (h.startsWith("kgn.")) return "Курган";
        if (h.startsWith("yuric.")) return "ЮРИЦ";
        if (h.startsWith("81.")) return "ЧЭС";
        if (h.includes("pyramid.vostok-electra.ru")) return "Основная";
        return "Основная";
    }

    const baseName = getBaseName();
    // Получаем версию расширения
    const extVersion = chrome.runtime.getManifest().version;

    if (window.location.pathname.includes("/login")) return;

    let sessionId = null;
    let toastTimeout = null;
    let timerInterval = null;
    let startTime = 0;
    let isTimerActive = false;
    let activeLoadType = "Загрузка";
    let activeRequestUrl = "";
    let sessionStartEpochMs = 0;
    let sessionStartData = null;
    let sessionStableData = null;
    const MAX_WAITING_DURATION_SEC = 2 * 60 * 60; // Жесткий лимит ожидания: 2 часа.
    const SLEEP_GAP_THRESHOLD_MS = 5 * 60 * 1000; // Если JS "замолчал" > 5 минут — считаем, что был сон/заморозка.
    const UNATTENDED_HIDDEN_TIMEOUT_SEC = 2 * 60 * 60; // Скрытая вкладка без внимания > 2 часов.
    const MAX_PULSE_CATCHUP_PER_TICK = 20; // Защита от лавины pulse-сообщений после долгой паузы.
    let lastTickWallClockMs = 0;
    let lastStableElapsedSec = 0;
    let hiddenSinceEpochMs = 0;

    // UI
    const toast = document.createElement("div");
    toast.id = "pyramid-stage-timer";
    toast.innerHTML = `<div class="timer-spinner"></div><span id="timer-type" style="margin-right:8px; font-weight:normal; font-size: 13px; opacity: 0.9;"></span><span id="timer-val">0.00s</span>`;
    
    function injectToast() {
        if (document.body) document.body.appendChild(toast);
        else requestAnimationFrame(injectToast);
    }
    injectToast();

    function normalizeDepartmentName(value) {
        const normalized = String(value || "").replace(/\s+/g, " ").trim();
        return normalized || "Не определен";
    }

    function scrapeDepartmentName() {
        const buttonTitleElem = document.querySelector(".btn-cities .title");
        if (buttonTitleElem && buttonTitleElem.textContent) {
            const buttonDepartment = normalizeDepartmentName(buttonTitleElem.textContent);
            if (buttonDepartment !== "Не определен") return buttonDepartment;
        }

        const activeDepartmentElem = document.querySelector(".department-switch.active");
        if (activeDepartmentElem && activeDepartmentElem.textContent) {
            return normalizeDepartmentName(activeDepartmentElem.textContent);
        }

        return "Не определен";
    }

    // Сбор данных
    function scrapeData() {
        let userName = "Не определен";
        const fioElem = document.querySelector(".fio"); 
        if (fioElem && fioElem.innerText.trim().length > 0) {
            userName = fioElem.innerText.trim();
        }

        let stageName = "ПК Пирамида"; 
        const stageElem = document.querySelector(".ui-jqgrid-title");
        
        if (stageElem) {
            let text = stageElem.innerText.trim();
            if (text) stageName = text.replace(/\s+/g, ' ');
        } else {
            let title = document.title.replace(" - Пирамида 2.0", "").trim();
            if (title) stageName = title;
        }

        // --- Пост-обработка названия стадии ---
        if (stageName.includes("Крупные должники:")) {
            stageName = stageName.replace("Крупные должники:", "КЛС/").trim();
        }
        if (stageName.startsWith("/") || stageName.startsWith(" /")) {
            stageName = stageName.replace(/^[\s\/]+/, "").trim();
        }

        const departmentName = scrapeDepartmentName();

        return { userName, stageName, departmentName };
    }

    function isValidSessionData(data) {
        return data && data.userName !== "Не определен" && data.stageName !== "ПК Пирамида";
    }

    function isKnownDepartmentName(departmentName) {
        return departmentName && departmentName !== "Не определен";
    }

    function normalizeSessionData(data) {
        const src = data || {};
        return {
            userName: src.userName || "Не определен",
            stageName: src.stageName || "ПК Пирамида",
            departmentName: src.departmentName || "Не определен"
        };
    }

    function sendSessionEvent(action, explicitData) {
        if (!sessionId) return;
        const current = explicitData || getResolvedSessionData();
        try {
            chrome.runtime.sendMessage({
                action: action,
                data: {
                    sessionId: sessionId,
                    baseName: baseName,
                    userName: current.userName,
                    stageName: current.stageName,
                    departmentName: current.departmentName,
                    loadType: activeLoadType,
                    requestUrl: activeRequestUrl,
                    version: extVersion,
                    startEpochMs: sessionStartEpochMs
                }
            });
        } catch (e) {
            // ignore
        }
    }

    function getResolvedSessionData(fallbackData) {
        const normalizedFallback = normalizeSessionData(fallbackData || scrapeData());

        if (!sessionStartData) {
            sessionStartData = normalizedFallback;
        }

        let shouldSendSessionUpdate = false;

        if (isKnownDepartmentName(normalizedFallback.departmentName)) {
            if (sessionStartData.departmentName === "Не определен") {
                sessionStartData = { ...sessionStartData, departmentName: normalizedFallback.departmentName };
                shouldSendSessionUpdate = true;
            }

            if (sessionStableData && sessionStableData.departmentName === "Не определен") {
                sessionStableData = { ...sessionStableData, departmentName: normalizedFallback.departmentName };
                shouldSendSessionUpdate = true;
            }
        }

        if (!sessionStableData && isValidSessionData(normalizedFallback)) {
            sessionStableData = {
                ...normalizedFallback,
                departmentName: isKnownDepartmentName(normalizedFallback.departmentName)
                    ? normalizedFallback.departmentName
                    : (sessionStartData.departmentName || "Не определен")
            };
            shouldSendSessionUpdate = true;
        }

        const resolved = sessionStableData || (isValidSessionData(sessionStartData) ? sessionStartData : normalizedFallback);

        if (shouldSendSessionUpdate && sessionId) {
            sendSessionEvent("STAGE_TIMER_SESSION_UPDATE", resolved);
        }

        return resolved;
    }

    // Слушатель сообщений от Background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'STAGE_TIMER_START') {
            handleStart(request.data);
        } else if (request.action === 'STAGE_TIMER_STOP') {
            handleStop(request.data);
        } else if (request.action === 'STAGE_TIMER_ERROR') {
            handleError(request.data);
        }
    });

    function hasVisibleGridError() {
        const errorBars = document.querySelectorAll(".alert.alert-danger.ui-jqgrid-errorbar");
        for (const errorBar of errorBars) {
            const style = window.getComputedStyle(errorBar);
            if (style.display === "none" || style.visibility === "hidden") continue;
            if (!errorBar.textContent || errorBar.textContent.trim().length === 0) continue;
            return true;
        }
        return false;
    }

    function notifyStageTimerCanceled() {
        try {
            chrome.runtime.sendMessage({ action: "STAGE_TIMER_CANCEL" });
        } catch (e) {
            // ignore
        }
    }

    function getSafeElapsedSec() {
        return Number.isFinite(lastStableElapsedSec) && lastStableElapsedSec >= 0 ? lastStableElapsedSec : 0;
    }

    function finalizeCanceledSession(uiText, hideDelayMs, forcedDurationSec) {
        if (!isTimerActive) return;

        isTimerActive = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        notifyStageTimerCanceled();

        if (toastTimeout) clearTimeout(toastTimeout);

        const measuredDurationSec = (performance.now() - startTime) / 1000;
        const finalDurationSec = Number.isFinite(forcedDurationSec)
            ? Math.max(0, forcedDurationSec)
            : Math.max(0, measuredDurationSec);
        const durationSec = finalDurationSec.toFixed(2);
        const sessionData = getResolvedSessionData(scrapeData());

        if (uiText) {
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = uiText;
            toast.classList.remove("finished");
            toast.style.borderColor = "#e74c3c";
        }

        lastTickWallClockMs = 0;
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = 0;

        sendToBackground("ОТМЕНА", durationSec, sessionData, activeLoadType, activeRequestUrl);

        if (hideDelayMs > 0) {
            toastTimeout = setTimeout(() => {
                toast.style.opacity = "0";
            }, hideDelayMs);
        }
    }

    function cancelByPageError() {
        finalizeCanceledSession("Отмена: ошибка", 4000);
    }

    function cancelByPageClose() {
        finalizeCanceledSession("", 0, getSafeElapsedSec());
    }

    function cancelByTimeout() {
        finalizeCanceledSession("Отмена: лимит ожидания 2ч", 4000, MAX_WAITING_DURATION_SEC);
    }

    function cancelBySleepGap() {
        finalizeCanceledSession("Отмена: обнаружен сон ПК", 4000, getSafeElapsedSec());
    }

    function cancelByHiddenTimeout() {
        finalizeCanceledSession("Отмена: вкладка без внимания >2ч", 4000, getSafeElapsedSec());
    }

    function handleStart(data) {
        if (window.location.pathname.includes("/bus/slowsearch/") || window.location.pathname.includes("/bus/globalsearch/")) {
            if (data.loadType !== "Фильтрация стадии") {
                return;
            }
        }

        // Сброс и показ UI
        sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        toast.style.opacity = "1";
        toast.style.borderColor = "#f1c40f"; 
        
        const typeSpan = toast.querySelector("#timer-type");
        if (typeSpan) typeSpan.innerText = data.loadType || "Загрузка";

        toast.querySelector("#timer-val").innerText = "0.00s";
        toast.classList.remove("finished");
        
        if (toastTimeout) clearTimeout(toastTimeout);
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        startTime = performance.now();
        isTimerActive = true;
        activeLoadType = data.loadType || "Загрузка";
        activeRequestUrl = data.requestUrl || "";
        sessionStartEpochMs = Date.now();
        sessionStartData = normalizeSessionData(scrapeData());
        sessionStableData = isValidSessionData(sessionStartData) ? sessionStartData : null;
        lastTickWallClockMs = Date.now();
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = document.hidden ? Date.now() : 0;
        sendSessionEvent("STAGE_TIMER_SESSION_START");

        if (hasVisibleGridError()) {
            cancelByPageError();
            return;
        }
        
        const pulseIntervalSec = 30;
        let lastReportTime = 0;
        let hasSentInitial = false;

        // Запускаем тиканье таймера
        timerInterval = setInterval(() => {
            if (!isTimerActive) return;

            if (hasVisibleGridError()) {
                cancelByPageError();
                return;
            }

            const wallNowMs = Date.now();
            const tickGapMs = lastTickWallClockMs > 0 ? (wallNowMs - lastTickWallClockMs) : 0;
            lastTickWallClockMs = wallNowMs;

            if (tickGapMs > SLEEP_GAP_THRESHOLD_MS) {
                cancelBySleepGap();
                return;
            }

            if (document.hidden) {
                if (!hiddenSinceEpochMs) hiddenSinceEpochMs = wallNowMs;
                const hiddenSec = (wallNowMs - hiddenSinceEpochMs) / 1000;
                if (hiddenSec >= UNATTENDED_HIDDEN_TIMEOUT_SEC) {
                    cancelByHiddenTimeout();
                    return;
                }
            } else {
                hiddenSinceEpochMs = 0;
            }

            const now = performance.now();
            const elapsed = parseFloat(((now - startTime) / 1000).toFixed(2));
            if (!Number.isFinite(elapsed) || elapsed < 0) return;

            if (elapsed >= MAX_WAITING_DURATION_SEC) {
                cancelByTimeout();
                return;
            }

            lastStableElapsedSec = elapsed;
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = elapsed + "s";

            // 1. Попытка отправить "ОЖИДАНИЕ" через 1 сек
            if (!hasSentInitial && elapsed > 1.0) {
                const currentData = scrapeData();
                const sessionData = getResolvedSessionData(currentData);
                if (isValidSessionData(sessionData)) {
                    const initialTimestampMs = sessionStartEpochMs + Math.round(elapsed * 1000);
                    sendToBackground("ОЖИДАНИЕ", elapsed.toString(), sessionData, data.loadType, undefined, initialTimestampMs);
                    hasSentInitial = true;
                    lastReportTime = elapsed;
                }
            }

            // 2. Периодический "ПУЛЬС" каждые 30 секунд
            if (hasSentInitial && (elapsed - lastReportTime) >= pulseIntervalSec) {
                const currentData = scrapeData();
                const sessionData = getResolvedSessionData(currentData);
                let pulseCatchupCount = 0;
                while ((elapsed - lastReportTime) >= pulseIntervalSec) {
                    if (pulseCatchupCount >= MAX_PULSE_CATCHUP_PER_TICK) {
                        lastReportTime = elapsed;
                        break;
                    }
                    const pulseElapsed = parseFloat((lastReportTime + pulseIntervalSec).toFixed(2));
                    const pulseTimestampMs = sessionStartEpochMs + Math.round(pulseElapsed * 1000);
                    sendToBackground("ОЖИДАНИЕ", pulseElapsed.toString(), sessionData, data.loadType, undefined, pulseTimestampMs);
                    lastReportTime = pulseElapsed;
                    pulseCatchupCount++;
                }
                toast.style.borderColor = "#e67e22"; 
            }

        }, 50); 
    }

    function handleStop(data) {
        if (!isTimerActive) return;

        // --- ЗАЩИТА ОТ ДУБЛЕЙ И "ПРИЗРАЧНЫХ" ЗАПРОСОВ ---
        // Если сетевой запрос длился дольше, чем работает наш таймер (+ зазор 5с),
        // значит это хвост от предыдущей активности. Игнорируем.
        const localElapsedMs = performance.now() - startTime;
        if (data.duration > (localElapsedMs + 5000)) {
            // console.warn(`[StageTimer] Ignored stale request. Network: ${data.duration}, Local: ${localElapsedMs}`);
            return;
        }

        isTimerActive = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        lastTickWallClockMs = 0;
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = 0;

        if (!sessionId) {
            sessionId = "rec" + Date.now().toString(36);
        }

        setTimeout(() => {
            const sessionData = getResolvedSessionData(scrapeData());
            const durationSec = (data.duration / 1000).toFixed(2);
            
            // UI Update
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = `Готово: ${durationSec}s`;
            toast.classList.add("finished");
            toast.style.borderColor = "#2ecc71"; 

            // Отправка лога
            const finalRequestUrl = data.requestUrl || activeRequestUrl;
            sendToBackground("УСПЕШНО", durationSec, sessionData, data.loadType, finalRequestUrl);

            // Скрыть через 4 сек
            toastTimeout = setTimeout(() => {
                toast.style.opacity = "0";
            }, 4000);

        }, 100); 
    }

    function handleError(data) {
        if (!isTimerActive) return;

        isTimerActive = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        lastTickWallClockMs = 0;
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = 0;
        const valSpan = document.getElementById("timer-val");
        if (valSpan) valSpan.innerText = `Ошибка`;
        toast.style.borderColor = "#e74c3c";
        toastTimeout = setTimeout(() => {
            toast.style.opacity = "0";
        }, 2000);
    }

    document.addEventListener("visibilitychange", () => {
        if (!isTimerActive) return;
        if (document.hidden) {
            if (!hiddenSinceEpochMs) hiddenSinceEpochMs = Date.now();
            return;
        }

        if (hiddenSinceEpochMs) {
            const hiddenSec = (Date.now() - hiddenSinceEpochMs) / 1000;
            if (hiddenSec >= UNATTENDED_HIDDEN_TIMEOUT_SEC) {
                cancelByHiddenTimeout();
                return;
            }
        }

        hiddenSinceEpochMs = 0;
        lastTickWallClockMs = Date.now();
    }, { capture: true });

    window.addEventListener("pagehide", () => {
        if (!isTimerActive) return;
        cancelByPageClose();
    }, { capture: true });

    function sendToBackground(status, time, data, loadType, requestUrl, eventTimestampMs) {
        const eventDate = Number.isFinite(eventTimestampMs) ? new Date(eventTimestampMs) : new Date();
        const timestamp = eventDate.toLocaleString("ru-RU");
        const finalLoadType = loadType || activeLoadType;
        const finalRequestUrl = requestUrl || activeRequestUrl || "";
        
        const payload = {
            baseName: baseName, 
            stageName: data.stageName,
            userName: data.userName,
            departmentName: data.departmentName || "Не определен",
            duration: time,
            timestamp: timestamp,
            status: status,
            sessionId: sessionId,
            loadType: finalLoadType,
            requestUrl: finalRequestUrl,
            version: extVersion, // <-- Передаем версию
            logLine: `[${timestamp}] [${status}] [${baseName}] [${data.departmentName || "Не определен"}] [${data.userName}] ${data.stageName} — ${time}s (${finalLoadType})`
        };

        try {
            chrome.runtime.sendMessage({
                action: "LOG_STAGE_TIME",
                data: payload
            });
        } catch (e) {
            console.error("[StageTimer] Ошибка отправки:", e);
        }
    }

})();
