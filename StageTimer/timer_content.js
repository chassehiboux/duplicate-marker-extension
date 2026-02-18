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
    let currentTimerHost = null;
    const TIMER_HOST_SYNC_INTERVAL_MS = 250;
    let lastTimerHostSyncMs = 0;
    const TIMER_BUTTON_SYNC_INTERVAL_MS = 1000;
    const TIMER_VISIBILITY_STORAGE_KEY = "pyramid_stage_timer_ui_visible";
    const SCREENSHOT_MODE_CLASS = "dup-ext-screenshot-mode";
    const SCREENSHOT_HIDE_EVENT = "dup-ext-screenshot-visibility-change";
    const SCREENSHOT_HIDE_DURATION_MS = 2500;
    const SCREENSHOT_HIDE_ON_BLUR_DURATION_MS = 2500;
    const SCREENSHOT_THROTTLE_MS = 150;
    const KEY_CODE_PRINT_SCREEN = 44;
    const KEY_CODE_F8 = 119;
    const SCREENSHOT_MANUAL_KEY = "S";

    // UI
    const toast = document.createElement("div");
    toast.id = "pyramid-stage-timer";
    toast.innerHTML = `
        <div class="timer-spinner"></div>
        <span class="pyramid-stage-timer-type"></span>
        <span class="pyramid-stage-timer-val">0,0с</span>
    `;

    const timerTypeEl = toast.querySelector(".pyramid-stage-timer-type");
    const timerValueEl = toast.querySelector(".pyramid-stage-timer-val");
    const timerToggleButton = document.createElement("button");
    timerToggleButton.id = "pyramid-stage-timer-toggle";
    timerToggleButton.type = "button";
    timerToggleButton.innerHTML = `<span class="pyramid-stage-timer-toggle-mark fa fa-eye" aria-hidden="true"></span>`;
    let isTimerUiVisible = true;
    let hasTimerSnapshot = false;
    let isScreenshotModeActive = false;
    let screenshotHideTimer = null;
    let lastScreenshotTriggerAtMs = 0;

    function isElementVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function readTimerUiVisibilityPreference() {
        try {
            const rawValue = window.localStorage.getItem(TIMER_VISIBILITY_STORAGE_KEY);
            if (rawValue === "0") return false;
            if (rawValue === "1") return true;
        } catch (e) {
            // ignore
        }
        return true;
    }

    function saveTimerUiVisibilityPreference(isVisible) {
        try {
            window.localStorage.setItem(TIMER_VISIBILITY_STORAGE_KEY, isVisible ? "1" : "0");
        } catch (e) {
            // ignore
        }
    }

    function updateTimerToggleButtonState() {
        const buttonTitle = isTimerUiVisible ? "Скрыть таймер" : "Показать таймер";
        const iconEl = timerToggleButton.querySelector(".pyramid-stage-timer-toggle-mark");
        if (iconEl) {
            iconEl.className = isTimerUiVisible
                ? "pyramid-stage-timer-toggle-mark fa fa-eye"
                : "pyramid-stage-timer-toggle-mark fa fa-eye-slash";
        }
        timerToggleButton.classList.toggle("is-disabled", !isTimerUiVisible);
        timerToggleButton.setAttribute("title", buttonTitle);
        timerToggleButton.setAttribute("aria-label", buttonTitle);
    }

    function applyToggleButtonVisibility() {
        timerToggleButton.style.display = isScreenshotModeActive ? "none" : "inline-flex";
    }

    function applyTimerUiVisibility() {
        if (isScreenshotModeActive || !isTimerUiVisible || !hasTimerSnapshot) {
            toast.style.display = "none";
            return;
        }
        toast.style.display = "inline-flex";
    }

    function setTimerUiVisibility(isVisible, shouldPersist = true) {
        isTimerUiVisible = !!isVisible;
        if (shouldPersist) {
            saveTimerUiVisibilityPreference(isTimerUiVisible);
        }
        updateTimerToggleButtonState();
        applyToggleButtonVisibility();
        applyTimerUiVisibility();
    }

    function readScreenshotModeFromDom() {
        const root = document.documentElement;
        return !!(root && root.classList.contains(SCREENSHOT_MODE_CLASS));
    }

    function setScreenshotModeActive(nextValue) {
        const normalizedNextValue = !!nextValue;
        if (isScreenshotModeActive === normalizedNextValue) return;
        isScreenshotModeActive = normalizedNextValue;
        applyToggleButtonVisibility();
        applyTimerUiVisibility();
    }

    function syncScreenshotModeState() {
        setScreenshotModeActive(readScreenshotModeFromDom());
    }

    function finalizeScreenshotAutohide() {
        if (readScreenshotModeFromDom()) {
            setScreenshotModeActive(true);
            return;
        }
        setScreenshotModeActive(false);
    }

    function scheduleScreenshotAutohide(_source) {
        setScreenshotModeActive(true);
        if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
        screenshotHideTimer = setTimeout(() => {
            screenshotHideTimer = null;
            finalizeScreenshotAutohide();
        }, SCREENSHOT_HIDE_DURATION_MS);
    }

    function resolveScreenshotTriggerKey(event) {
        const key = String(event.key || "");
        const code = String(event.code || "");
        const upperKey = key.toUpperCase();
        const keyCode = Number(event.keyCode || event.which || 0);

        if (event.ctrlKey && event.shiftKey && (upperKey === SCREENSHOT_MANUAL_KEY || code === "KeyS")) {
            return "ManualHide";
        }

        if (
            key === "PrintScreen" || code === "PrintScreen" ||
            key === "PrtSc" || code === "PrtSc" ||
            key === "Print" || code === "Print" ||
            key === "PrintScrn" || code === "PrintScrn" ||
            key === "Snapshot" || code === "Snapshot" ||
            key === "SysRq" || code === "SysRq" ||
            key === "ScreenCapture" || code === "ScreenCapture" ||
            keyCode === KEY_CODE_PRINT_SCREEN ||
            key === "F8" || code === "F8" || keyCode === KEY_CODE_F8
        ) {
            return "PrintScreen";
        }

        return "";
    }

    function handleScreenshotHotkey(event) {
        const triggerKey = resolveScreenshotTriggerKey(event);
        if (!triggerKey) return;
        if (event.type === "keydown" && event.repeat) return;

        const nowMs = Date.now();
        if ((nowMs - lastScreenshotTriggerAtMs) < SCREENSHOT_THROTTLE_MS) return;
        lastScreenshotTriggerAtMs = nowMs;
        scheduleScreenshotAutohide(`hotkey:${triggerKey}:${event.type}`);
    }

    function initScreenshotAutohideMode() {
        document.addEventListener("keydown", handleScreenshotHotkey, true);
        document.addEventListener("keyup", handleScreenshotHotkey, true);
        window.addEventListener("blur", () => {
            if (!isScreenshotModeActive) return;
            if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
            screenshotHideTimer = setTimeout(() => {
                screenshotHideTimer = null;
                finalizeScreenshotAutohide();
            }, SCREENSHOT_HIDE_ON_BLUR_DURATION_MS);
        });
    }

    function getToggleButtonClassesByCloseButton(closeButton) {
        if (!closeButton) return ["btn", "btn-xs", "btn-default"];
        const sourceClasses = Array.from(closeButton.classList);
        const filteredClasses = sourceClasses.filter((className) => (
            className !== "ui-jqgrid-titlebar-close" &&
            className !== "ui-dialog-titlebar-close"
        ));
        return filteredClasses.length > 0 ? filteredClasses : ["btn", "btn-xs", "btn-default"];
    }

    function syncToggleButtonLook(closeButton) {
        timerToggleButton.className = "pyramid-stage-timer-toggle-btn";
        const classesToApply = getToggleButtonClassesByCloseButton(closeButton);
        classesToApply.forEach((className) => timerToggleButton.classList.add(className));
        updateTimerToggleButtonState();
    }

    timerToggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTimerUiVisibility(!isTimerUiVisible);
    }, { capture: true });

    window.addEventListener(SCREENSHOT_HIDE_EVENT, (event) => {
        if (event && event.detail && typeof event.detail.hidden === "boolean") {
            setScreenshotModeActive(event.detail.hidden);
            if (!event.detail.hidden && screenshotHideTimer) {
                clearTimeout(screenshotHideTimer);
                screenshotHideTimer = null;
            }
            return;
        }
        syncScreenshotModeState();
    }, { capture: true });

    setTimerUiVisibility(readTimerUiVisibilityPreference(), false);
    syncScreenshotModeState();
    initScreenshotAutohideMode();
    setInterval(() => {
        syncTimerHost();
    }, TIMER_BUTTON_SYNC_INTERVAL_MS);

    function isDialogLoadType(loadType, requestUrl) {
        const normalizedLoadType = String(loadType || "").toLowerCase();
        const normalizedRequestUrl = String(requestUrl || "").toLowerCase();

        if (normalizedRequestUrl.includes("/claims/execution")) return true;
        if (!normalizedLoadType) return false;

        const hasFormingWord = normalizedLoadType.includes("формирован");
        const hasNotificationOrClaimWord =
            normalizedLoadType.includes("уведомлен") ||
            normalizedLoadType.includes("заявлен");

        return hasFormingWord && hasNotificationOrClaimWord;
    }

    function getCompactLoadTypeLabel(loadType) {
        const raw = String(loadType || "Загрузка").trim();
        const normalized = raw.toLowerCase();

        if (normalized.includes("фильтрац")) return "Фильтрация";
        if (normalized.includes("загрузка")) return "Загрузка";
        if (normalized.includes("формирован")) return "Формирование";
        if (normalized.includes("редактирован")) return "Редактирование";

        return raw;
    }

    function getVisibleGridTitlebar() {
        const gridTitlebars = Array.from(document.querySelectorAll(".ui-jqgrid-titlebar"));
        return gridTitlebars.find(isElementVisible) || null;
    }

    function parseZIndex(value) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getVisibleDialogTitlebar() {
        const dialogTitlebars = Array.from(document.querySelectorAll(".ui-dialog .ui-dialog-titlebar, .ui-dialog-titlebar"));
        const visible = dialogTitlebars.filter(isElementVisible);

        if (visible.length === 0) return null;
        if (visible.length === 1) return visible[0];

        visible.sort((a, b) => {
            const aContainer = a.closest(".ui-dialog") || a;
            const bContainer = b.closest(".ui-dialog") || b;
            return parseZIndex(window.getComputedStyle(aContainer).zIndex) - parseZIndex(window.getComputedStyle(bContainer).zIndex);
        });

        return visible[visible.length - 1];
    }

    function resolveTimerHost(_loadType, _requestUrl) {
        return getVisibleGridTitlebar();
    }

    function resolvePreferredIdleHost() {
        return getVisibleGridTitlebar();
    }

    function mountTimerToHost(host) {
        if (!host) return false;

        if (currentTimerHost && currentTimerHost !== host) {
            currentTimerHost.classList.remove("pyramid-stage-timer-host");
            timerToggleButton.remove();
            currentTimerHost.style.removeProperty("--pyramid-stage-timer-right-offset");
            currentTimerHost.style.removeProperty("--pyramid-stage-toggle-right-offset");
        }

        const closeButton = host.querySelector(".ui-jqgrid-titlebar-close, .ui-dialog-titlebar-close");
        syncToggleButtonLook(closeButton);

        if (timerToggleButton.parentElement !== host) {
            timerToggleButton.remove();
            if (closeButton && closeButton.parentElement === host) {
                host.insertBefore(timerToggleButton, closeButton);
            } else {
                host.appendChild(timerToggleButton);
            }
        }
        applyToggleButtonVisibility();

        const closeButtonWidth = closeButton && isElementVisible(closeButton)
            ? closeButton.getBoundingClientRect().width
            : 0;

        const toggleButtonWidth = isElementVisible(timerToggleButton)
            ? timerToggleButton.getBoundingClientRect().width
            : 24;

        const closeOffsetPx = Math.max(0, Math.ceil(closeButtonWidth));
        const toggleOffsetPx = closeOffsetPx + 6;
        const timerRightOffsetPx = toggleOffsetPx + Math.ceil(toggleButtonWidth) + 8;

        host.style.setProperty("--pyramid-stage-toggle-right-offset", `${toggleOffsetPx}px`);
        host.style.setProperty("--pyramid-stage-timer-right-offset", `${timerRightOffsetPx}px`);

        if (toast.parentElement !== host) {
            toast.remove();
            if (closeButton && closeButton.parentElement === host) {
                host.insertBefore(toast, closeButton);
            } else {
                host.appendChild(toast);
            }
        }

        host.classList.add("pyramid-stage-timer-host");
        currentTimerHost = host;
        return true;
    }

    function syncTimerHost(force = false) {
        syncScreenshotModeState();
        const nowMs = Date.now();
        if (!force && (nowMs - lastTimerHostSyncMs) < TIMER_HOST_SYNC_INTERVAL_MS) return;
        lastTimerHostSyncMs = nowMs;

        const host = isTimerActive
            ? resolveTimerHost(activeLoadType, activeRequestUrl)
            : resolvePreferredIdleHost();
        if (host) {
            mountTimerToHost(host);
        }
    }

    function clearTimerHost(removeToggleButton = true) {
        toast.remove();
        if (removeToggleButton) {
            timerToggleButton.remove();
        }
        if (currentTimerHost) {
            currentTimerHost.classList.remove("pyramid-stage-timer-host");
            currentTimerHost.style.removeProperty("--pyramid-stage-timer-right-offset");
            if (removeToggleButton) {
                currentTimerHost.style.removeProperty("--pyramid-stage-toggle-right-offset");
            }
            currentTimerHost = null;
        }
    }

    function setTimerState(state) {
        toast.classList.remove("is-loading", "is-warning", "finished", "is-error");
        if (state === "success") {
            toast.classList.add("finished");
            return;
        }
        if (state === "error") {
            toast.classList.add("is-error");
            return;
        }
        if (state === "warning") {
            toast.classList.add("is-warning");
            return;
        }
        toast.classList.add("is-loading");
    }

    function setTimerLabel(loadType) {
        if (timerTypeEl) {
            timerTypeEl.textContent = getCompactLoadTypeLabel(loadType);
        }
    }

    function setTimerValue(text) {
        if (timerValueEl) {
            timerValueEl.textContent = text;
        }
    }

    function formatUiDuration(secondsValue) {
        const normalizedSeconds = Number.isFinite(secondsValue) ? Math.max(0, secondsValue) : 0;
        return `${normalizedSeconds.toFixed(1).replace(".", ",")}с`;
    }

    function showTimer() {
        hasTimerSnapshot = true;
        syncTimerHost(true);
        applyTimerUiVisibility();
    }

    function hideTimer() {
        toast.style.display = "none";
        syncTimerHost(true);
    }

    function scheduleTimerHide(_delayMs) {
        if (toastTimeout) clearTimeout(toastTimeout);
        applyTimerUiVisibility();
    }

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

    function finalizeCanceledSession(_uiText, hideDelayMs, forcedDurationSec) {
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

        setTimerValue(formatUiDuration(finalDurationSec));
        setTimerState("error");

        lastTickWallClockMs = 0;
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = 0;

        sendToBackground("ОТМЕНА", durationSec, sessionData, activeLoadType, activeRequestUrl);

        scheduleTimerHide(hideDelayMs);
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
        lastTimerHostSyncMs = 0;
        lastTickWallClockMs = Date.now();
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = document.hidden ? Date.now() : 0;
        setTimerLabel(activeLoadType);
        setTimerValue(formatUiDuration(0));
        setTimerState("loading");
        showTimer();
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
            syncTimerHost();

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
            setTimerValue(formatUiDuration(elapsed));

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
                setTimerState("warning");
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
            const durationSecNumber = data.duration / 1000;
            
            // UI Update
            setTimerValue(formatUiDuration(durationSecNumber));
            setTimerState("success");
            syncTimerHost(true);

            // Отправка лога
            const finalRequestUrl = data.requestUrl || activeRequestUrl;
            sendToBackground("УСПЕШНО", durationSec, sessionData, data.loadType, finalRequestUrl);

            // Скрыть через 4 сек
            scheduleTimerHide(4000);

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
        setTimerValue(formatUiDuration(getSafeElapsedSec()));
        setTimerState("error");
        scheduleTimerHide(2000);
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
