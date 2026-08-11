// StageTimer/timer_content.js

(function() {
    // 1. Определение базы
    function getBaseDescriptor(hostname) {
        const h = String(hostname || "").toLowerCase();
        if (h.startsWith("kgn.")) return { name: "Курган", host: "kgn.pyramid.vostok-electra.ru" };
        if (h.startsWith("yuric.")) return { name: "ЮРИЦ", host: "yuric.pyramid.vostok-electra.ru" };
        if (h.startsWith("81.")) return { name: "ЧЭС", host: "81.pyramid.vostok-electra.ru" };
        if (h === "pyramid.vostok-electra.ru") return { name: "Основная", host: "pyramid.vostok-electra.ru" };
        if (h === "pyramid.nesko-nv.ru" || h.endsWith(".pyramid.nesko-nv.ru")) {
            return { name: "Основная", host: h };
        }
        return { name: "Основная", host: h };
    }

    function getBaseName() {
        const h = window.location.hostname.toLowerCase();
        if (h.startsWith("kgn.")) return "Курган";
        if (h.startsWith("yuric.")) return "ЮРИЦ";
        if (h.startsWith("81.")) return "ЧЭС";
        if (h.includes("pyramid.vostok-electra.ru")) return "Основная";
        if (h === "pyramid.nesko-nv.ru" || h.endsWith(".pyramid.nesko-nv.ru")) return "Основная";
        return "Основная";
    }

    const DEPARTMENT_BASE_BY_DEPID = Object.freeze({
        "39": { name: "Курган", host: "kgn.pyramid.vostok-electra.ru" },
        "66": { name: "Основная", host: "pyramid.vostok-electra.ru" },
        "70": { name: "ЮРИЦ", host: "yuric.pyramid.vostok-electra.ru" },
        "81": { name: "ЧЭС", host: "81.pyramid.vostok-electra.ru" }
    });

    const baseName = getBaseName();
    const manifest = chrome.runtime.getManifest();
    const extVersion = manifest.version;
    const isStandaloneStageTimerBuild = !!(
        manifest &&
        manifest.background &&
        manifest.background.service_worker === "StageTimer/timer_background.js"
    );

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
    const DEPARTMENT_STATE_HEARTBEAT_MS = 3000;
    let lastTickWallClockMs = 0;
    let lastStableElapsedSec = 0;
    let hiddenSinceEpochMs = 0;
    let currentTimerHost = null;
    const TIMER_HOST_SYNC_INTERVAL_MS = 250;
    let lastTimerHostSyncMs = 0;
    let incidentScanTimeout = null;
    let lastGridAbortSignalAtMs = 0;
    let lastVisibleGridIncidentSignature = "";
    const epguIncidentSignatureBySource = new Map();
    const TIMER_BUTTON_SYNC_INTERVAL_MS = 1000;
    const LEGACY_TIMER_VISIBILITY_STORAGE_KEY = "pyramid_stage_timer_ui_visible";
    const TIMER_VISIBILITY_STORAGE_KEY = "dup_ui_show_stage_timer";
    const TIMER_TOGGLE_VISIBILITY_STORAGE_KEY = "dup_ui_show_stage_timer_toggle";
    const TIMER_ABORT_VISIBILITY_STORAGE_KEY = "dup_ui_show_stage_timer_abort";
    const DEPARTMENT_CONFLICT_VISIBILITY_STORAGE_KEY = "dup_ui_show_stage_timer_department_conflict";
    const SCREENSHOT_MODE_CLASS = "dup-ext-screenshot-mode";
    const SCREENSHOT_HIDE_EVENT = "dup-ext-screenshot-visibility-change";
    const SCREENSHOT_FRAME_BRIDGE_MESSAGE = "dup-screenshot-hotkey-frame-bridge";
    const SCREENSHOT_HIDE_DURATION_MS = 2500;
    const SCREENSHOT_HIDE_ON_BLUR_DURATION_MS = 2500;
    const SCREENSHOT_HIDE_PRINT_SCREEN_DURATION_MS = 5000;
    const SCREENSHOT_HIDE_PRINT_SCREEN_ON_BLUR_DURATION_MS = 5000;
    const SCREENSHOT_THROTTLE_MS = 150;
    const INCIDENT_SCAN_INTERVAL_MS = 2000;
    const INCIDENT_SCAN_DEBOUNCE_MS = 150;
    const GRID_ABORT_SUPPRESSION_WINDOW_MS = 6000;
    const INCIDENT_SUMMARY_TEXT_LIMIT = 160;
    const GRID_INCIDENT_TYPE = "GRID";
    const EPGU_INCIDENT_TYPE = "EPGU";
    const EPGU_PATH_REGEX = /\/ovzid\/fullcard\/(\d+)\/epgu(?:[/?#]|$)/i;
    const KEY_CODE_F1 = 112;
    const KEY_CODE_F2 = 113;
    const KEY_CODE_PRINT_SCREEN = 44;
    const KEY_CODE_F8 = 119;
    const SCREENSHOT_MANUAL_KEY = "S";
    const GRID_ABORT_REWRITE_EVENT = "dup-grid-abort-message";
    const GRID_ABORT_REWRITE_TEXT = "Загрузка/Фильтрация была прервана пользователем вручную. Повторите действие заново.";
    const ROWS10000_INCIDENT_EVENT_TYPE = "rows10000_incident";
    const ROWS10000_INCIDENT_TYPE = "ROWS10000";
    const ROWS10000_TRACE_EVENT = "dup-rows10000-trace-event";
    const ROWS10000_TRACE_REQUEST_SNAPSHOT_EVENT = "dup-rows10000-request-snapshot";
    const ROWS10000_TRACE_RETENTION_MS = 60 * 60 * 1000;
    const ROWS10000_TRACE_MAX_EVENTS = 4000;
    const ROWS10000_INCIDENT_COOLDOWN_MS = 15000;
    const ROWS10000_SHOW_SELECTED_WINDOW_MS = 5000;
    const ROWS10000_STACK_TEXT_LIMIT = 3000;
    const ROWS10000_TEXT_LIMIT = 2000;
    const ROWS10000_TRACE_SUMMARY_LIMIT = 220;
    const ROWS10000_PATH_REGEX = /^\/ovzid\/status\/[^/?#]+/i;
    const EXTENSION_UI_SETTINGS_OVERLAY_ID = "dup-extension-ui-settings-overlay";
    const EXTENSION_UI_SETTINGS_PANEL_ID = "dup-extension-ui-settings-panel";
    const EXTENSION_UI_SETTINGS_OVERLAY_CLASS = "dup-extension-ui-settings-overlay";
    const EXTENSION_UI_SETTINGS_PANEL_CLASS = "dup-extension-ui-settings-panel";
    const EXTENSION_UI_SETTINGS_ITEM_CLASS = "dup-extension-ui-settings-item";
    const EXTENSION_UI_SETTINGS_TITLE_CLASS = "dup-extension-ui-settings-title";
    const EXTENSION_UI_SETTINGS_DESCRIPTION_CLASS = "dup-extension-ui-settings-description";
    const EXTENSION_UI_SETTINGS_INPUT_ATTR = "data-dup-ui-setting";
    const EXTENSION_UI_SETTINGS_HINT_TEXT = "Состояние сохраняется для доменов Пирамиды.";
    const EXTENSION_UI_GLOBAL_CONFIG = (() => {
        const rawConfig = window.PYRAMID_EXTENSION_UI_CONFIG && typeof window.PYRAMID_EXTENSION_UI_CONFIG === "object"
            ? window.PYRAMID_EXTENSION_UI_CONFIG
            : {};
        const rawForcedVisibility = rawConfig.forcedVisibility && typeof rawConfig.forcedVisibility === "object"
            ? rawConfig.forcedVisibility
            : {};
        return {
            globalEnabled: rawConfig.globalEnabled !== false,
            forcedVisibility: rawForcedVisibility
        };
    })();
    const TIMER_UI_SETTING_DEFS = Object.freeze([
        {
            key: "stageTimer",
            storageKey: TIMER_VISIBILITY_STORAGE_KEY,
            label: "Таймер загрузки/фильтрации",
            description: "Плашка StageTimer над диалогами."
        },
        {
            key: "stageTimerToggle",
            storageKey: TIMER_TOGGLE_VISIBILITY_STORAGE_KEY,
            label: "Кнопка скрытия таймера",
            description: "Кнопка с глазом рядом с таймером."
        },
        {
            key: "stageTimerAbort",
            storageKey: TIMER_ABORT_VISIBILITY_STORAGE_KEY,
            label: "Кнопка прерывания загрузки",
            description: "Кнопка × для аварийной остановки."
        },
        {
            key: "stageTimerDepartmentConflict",
            storageKey: DEPARTMENT_CONFLICT_VISIBILITY_STORAGE_KEY,
            label: "Предупреждение о разных департаментах",
            description: "Показывает конфликт департаментов между открытыми вкладками Пирамиды."
        }
    ]);
    const TIMER_UI_SETTINGS_STORAGE_KEYS = Object.freeze(
        TIMER_UI_SETTING_DEFS.map((definition) => definition.storageKey)
    );
    const TIMER_UI_SETTING_DEF_BY_KEY = Object.freeze(
        TIMER_UI_SETTING_DEFS.reduce((map, definition) => {
            map[definition.key] = definition;
            return map;
        }, Object.create(null))
    );
    const TIMER_UI_SETTING_DEF_BY_STORAGE_KEY = Object.freeze(
        TIMER_UI_SETTING_DEFS.reduce((map, definition) => {
            map[definition.storageKey] = definition;
            return map;
        }, Object.create(null))
    );
    const TIMER_UI_SETTINGS_DEFAULTS = Object.freeze(
        TIMER_UI_SETTING_DEFS.reduce((map, definition) => {
            const forcedVisibility = EXTENSION_UI_GLOBAL_CONFIG.forcedVisibility[definition.key];
            map[definition.key] = typeof forcedVisibility === "boolean"
                ? forcedVisibility
                : EXTENSION_UI_GLOBAL_CONFIG.globalEnabled !== false;
            return map;
        }, Object.create(null))
    );

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
    const departmentConflictAlert = document.createElement("div");
    departmentConflictAlert.id = "pyramid-stage-department-conflict";
    departmentConflictAlert.setAttribute("role", "alert");
    departmentConflictAlert.setAttribute("aria-live", "assertive");
    departmentConflictAlert.innerHTML = `
        <span class="pyramid-stage-department-conflict-icon" aria-hidden="true">⚠</span>
        <span class="pyramid-stage-department-conflict-text"></span>
    `;
    const departmentConflictTextEl = departmentConflictAlert.querySelector(".pyramid-stage-department-conflict-text");
    const timerToggleButton = document.createElement("button");
    timerToggleButton.id = "pyramid-stage-timer-toggle";
    timerToggleButton.type = "button";
    timerToggleButton.innerHTML = `<span class="pyramid-stage-timer-toggle-mark fa fa-eye" aria-hidden="true"></span>`;
    const timerAbortButton = document.createElement("button");
    timerAbortButton.id = "pyramid-stage-timer-abort";
    timerAbortButton.type = "button";
    timerAbortButton.innerHTML = `<span class="pyramid-stage-timer-abort-mark" aria-hidden="true">×</span>`;
    let isTimerUiVisible = true;
    let hasTimerSnapshot = false;
    let isScreenshotModeActive = false;
    let screenshotManualModeIsActive = false;
    let screenshotHideTimer = null;
    let screenshotHideDurationMs = SCREENSHOT_HIDE_DURATION_MS;
    let lastScreenshotTriggerAtMs = 0;
    let timerUiElementSettings = { ...TIMER_UI_SETTINGS_DEFAULTS };
    let timerUiSettingsOverlayEl = null;
    let timerUiSettingsPanelEl = null;
    let departmentConflictEntries = [];
    let hasDepartmentConflictAlert = false;
    const rows10000TraceEnabled = (
        (
            window.location.hostname.indexOf("pyramid.vostok-electra.ru") !== -1
            || window.location.hostname === "pyramid.nesko-nv.ru"
            || window.location.hostname.endsWith(".pyramid.nesko-nv.ru")
        )
        && ROWS10000_PATH_REGEX.test(window.location.pathname)
    );
    let rows10000TraceSeq = 0;
    let rows10000LastIncidentAtMs = 0;
    let rows10000LastIncidentSignature = "";
    let rows10000LastShowSelectedClickAtMs = 0;
    let rows10000TraceBuffer = [];

    function isElementVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function trimRows10000Text(value, limit = ROWS10000_TEXT_LIMIT) {
        const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
        if (!text) return "";
        return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1))}…` : text;
    }

    function safeRows10000Number(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function safeRows10000Integer(value) {
        const num = parseInt(String(value == null ? "" : value).trim(), 10);
        return Number.isFinite(num) ? num : null;
    }

    function cloneRows10000Payload(payload) {
        if (payload == null) return {};
        try {
            return JSON.parse(JSON.stringify(payload));
        } catch (error) {
            return { value: trimRows10000Text(payload) };
        }
    }

    function pruneRows10000TraceBuffer(nowMs = Date.now()) {
        const minAtMs = nowMs - ROWS10000_TRACE_RETENTION_MS;
        rows10000TraceBuffer = rows10000TraceBuffer.filter((entry) => (
            entry && Number.isFinite(entry.atMs) && entry.atMs >= minAtMs
        ));
        if (rows10000TraceBuffer.length > ROWS10000_TRACE_MAX_EVENTS) {
            rows10000TraceBuffer = rows10000TraceBuffer.slice(rows10000TraceBuffer.length - ROWS10000_TRACE_MAX_EVENTS);
        }
    }

    function pushRows10000TraceEvent(kind, payload, options = {}) {
        if (!rows10000TraceEnabled) return null;
        const atMs = Number.isFinite(options.atMs) ? options.atMs : Date.now();
        pruneRows10000TraceBuffer(atMs);
        const entry = {
            seq: ++rows10000TraceSeq,
            at: new Date(atMs).toISOString(),
            atMs,
            kind: String(kind || "trace"),
            source: String(options.source || "content"),
            pageUrl: window.location.href,
            payload: cloneRows10000Payload(payload)
        };
        rows10000TraceBuffer.push(entry);
        if (rows10000TraceBuffer.length > ROWS10000_TRACE_MAX_EVENTS) {
            rows10000TraceBuffer.shift();
        }
        return entry;
    }

    function buildRows10000ElementLabel(element) {
        if (!(element instanceof Element)) return "";
        const parts = [element.tagName.toLowerCase()];
        if (element.id) parts.push(`#${element.id}`);
        if (element.classList && element.classList.length) {
            parts.push(`.${Array.from(element.classList).slice(0, 4).join(".")}`);
        }
        return parts.join("");
    }

    function buildRows10000ElementSnapshot(element) {
        if (!(element instanceof Element)) return {};
        return {
            label: buildRows10000ElementLabel(element),
            text: trimRows10000Text(
                element.getAttribute("aria-label")
                || element.innerText
                || element.textContent
                || element.value
                || "",
                180
            ),
            name: trimRows10000Text(element.getAttribute("name") || "", 80),
            value: trimRows10000Text(
                element.value != null ? element.value : element.getAttribute("value") || "",
                180
            )
        };
    }

    function buildRows10000DomSnapshot(reason = "") {
        const counterEl = document.querySelector("#selected_rows .rows-counter");
        const selectedRowsEl = document.getElementById("selected_rows");
        const rowsSelect = document.querySelector(".ui-pg-selbox");
        const checkedBoxes = document.querySelectorAll("#list tr.jqgrow input.cbox:checked").length;
        const highlightedRows = document.querySelectorAll("#list tr.jqgrow.ui-state-highlight").length;
        const counterText = trimRows10000Text(counterEl ? counterEl.textContent : "", 40);
        return {
            reason: trimRows10000Text(reason, 80),
            href: window.location.href,
            buttonCounterText: counterText,
            buttonCounterNumber: safeRows10000Integer(counterText),
            buttonVisible: !!(selectedRowsEl && isElementVisible(selectedRowsEl)),
            rowsSelectValue: rowsSelect ? trimRows10000Text(rowsSelect.value, 20) : "",
            visibleCheckedCount: checkedBoxes,
            highlightedRowCount: highlightedRows,
            activeElement: buildRows10000ElementSnapshot(document.activeElement)
        };
    }

    function buildRows10000TraceId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }
        return `rows10000_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function buildRows10000Summary(candidateRequest, stateSnapshot) {
        const parts = ["Пойман запрос rows=10000"];
        if (candidateRequest && candidateRequest.filtersSummary && candidateRequest.filtersSummary.hasEmptyEdocInRule) {
            parts.push("пустой фильтр EDocID in");
        }
        if (stateSnapshot) {
            const counterNumber = safeRows10000Number(stateSnapshot.buttonCounterNumber);
            const selarrrowLen = safeRows10000Number(stateSnapshot.selarrrowLen);
            if (counterNumber !== null) {
                parts.push(`counter=${counterNumber}`);
            }
            if (selarrrowLen !== null) {
                parts.push(`selarrrow=${selarrrowLen}`);
            }
        }
        return trimRows10000Text(parts.join("; "), ROWS10000_TRACE_SUMMARY_LIMIT);
    }

    function sendRows10000Incident(payload) {
        if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function")) return;
        try {
            chrome.runtime.sendMessage({
                action: "LOG_ROWS10000_INCIDENT",
                data: payload
            });
        } catch (error) {
            console.warn("[StageTimer] Не удалось отправить rows=10000 инцидент.", error);
        }
    }

    function freezeRows10000Incident(candidatePayload, atMs = Date.now()) {
        if (!rows10000TraceEnabled) return;
        const requestInfo = candidatePayload && candidatePayload.request ? candidatePayload.request : {};
        const stateSnapshot = candidatePayload && candidatePayload.state ? candidatePayload.state : {};
        const requestUrl = trimRows10000Text(requestInfo.href || requestInfo.url || "", ROWS10000_TEXT_LIMIT);
        const incidentSignature = [
            requestUrl,
            String(requestInfo.requestId || ""),
            String(stateSnapshot.buttonCounterNumber || ""),
            String(stateSnapshot.selarrrowLen || "")
        ].join("|");
        if (
            incidentSignature
            && incidentSignature === rows10000LastIncidentSignature
            && (atMs - rows10000LastIncidentAtMs) < ROWS10000_INCIDENT_COOLDOWN_MS
        ) {
            return;
        }

        rows10000LastIncidentAtMs = atMs;
        rows10000LastIncidentSignature = incidentSignature;

        const traceId = buildRows10000TraceId();
        const sessionData = normalizeSessionData(scrapeData());
        const summaryText = buildRows10000Summary(requestInfo, stateSnapshot);
        const localSnapshot = buildRows10000DomSnapshot("incident-freeze");
        pushRows10000TraceEvent("incident-freeze", {
            traceId,
            summaryText,
            localSnapshot,
            candidate: candidatePayload || {}
        }, { source: "content", atMs });
        pruneRows10000TraceBuffer(atMs);

        sendRows10000Incident({
            eventType: ROWS10000_INCIDENT_EVENT_TYPE,
            incidentType: ROWS10000_INCIDENT_TYPE,
            traceId,
            timestamp: new Date(atMs).toISOString(),
            baseName: baseName,
            stageName: sessionData.stageName,
            userName: sessionData.userName,
            departmentName: sessionData.departmentName,
            pageUrl: window.location.href,
            requestUrl,
            requestMethod: trimRows10000Text(requestInfo.method || "GET", 16),
            rows: safeRows10000Integer(requestInfo.rowsNumber != null ? requestInfo.rowsNumber : requestInfo.rowsRaw),
            buttonCounter: trimRows10000Text(stateSnapshot.buttonCounterText || localSnapshot.buttonCounterText || "", 40),
            buttonCounterNumber: safeRows10000Integer(
                stateSnapshot.buttonCounterNumber != null ? stateSnapshot.buttonCounterNumber : localSnapshot.buttonCounterNumber
            ),
            selarrrowLen: safeRows10000Integer(stateSnapshot.selarrrowLen),
            visibleCheckedCount: safeRows10000Integer(
                stateSnapshot.visibleCheckedCount != null ? stateSnapshot.visibleCheckedCount : localSnapshot.visibleCheckedCount
            ),
            summaryText,
            fullText: trimRows10000Text(JSON.stringify({
                triggerReason: candidatePayload && candidatePayload.triggerReason ? candidatePayload.triggerReason : "",
                request: requestInfo,
                state: stateSnapshot
            }), ROWS10000_TEXT_LIMIT),
            triggerReason: trimRows10000Text(candidatePayload && candidatePayload.triggerReason ? candidatePayload.triggerReason : "", 120),
            requestData: cloneRows10000Payload(requestInfo),
            stateSnapshot: cloneRows10000Payload(stateSnapshot),
            trace: cloneRows10000Payload(rows10000TraceBuffer),
            version: extVersion
        });
    }

    function requestRows10000MainWorldSnapshot(reason) {
        if (!rows10000TraceEnabled) return;
        try {
            window.dispatchEvent(new CustomEvent(ROWS10000_TRACE_REQUEST_SNAPSHOT_EVENT, {
                detail: trimRows10000Text(reason, 80)
            }));
        } catch (error) {
            // ignore
        }
    }

    function handleRows10000MainWorldEvent(event) {
        if (!rows10000TraceEnabled) return;
        const detail = event && event.detail ? event.detail : {};
        const type = trimRows10000Text(detail.type || "main-world", 80);
        const atMs = Number.isFinite(detail.atMs) ? detail.atMs : Date.now();
        const payload = cloneRows10000Payload(detail.payload || {});
        pushRows10000TraceEvent(type, payload, { source: "main-world", atMs });
        if (type === "ui-show-selected-click") {
            rows10000LastShowSelectedClickAtMs = atMs;
        }
        if (type === "rows10000-candidate") {
            freezeRows10000Incident(payload, atMs);
        }
    }

    function buildRows10000ControlInfo(target) {
        const control = target.closest('button, a, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], .ui-pg-button');
        if (!control) return null;
        const title = trimRows10000Text(
            control.getAttribute("title")
            || control.getAttribute("aria-label")
            || control.textContent
            || control.value
            || "",
            160
        );
        if (!title) return null;
        return {
            title,
            label: buildRows10000ElementLabel(control),
            href: trimRows10000Text(control.getAttribute("href") || "", 300)
        };
    }

    function handleRows10000UiClick(event) {
        if (!rows10000TraceEnabled) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const showSelectedButton = target.closest("#selected_rows .showSelectedRow");
        if (showSelectedButton) {
            rows10000LastShowSelectedClickAtMs = Date.now();
            pushRows10000TraceEvent("ui-click-show-selected", {
                target: buildRows10000ElementSnapshot(showSelectedButton),
                domSnapshot: buildRows10000DomSnapshot("ui-click-show-selected")
            }, { source: "ui" });
            requestRows10000MainWorldSnapshot("ui-click-show-selected");
            return;
        }

        const resetButton = target.closest("#selected_rows .resetFilter");
        if (resetButton) {
            pushRows10000TraceEvent("ui-click-reset-selected-filter", {
                target: buildRows10000ElementSnapshot(resetButton),
                domSnapshot: buildRows10000DomSnapshot("ui-click-reset-selected-filter")
            }, { source: "ui" });
            requestRows10000MainWorldSnapshot("ui-click-reset-selected-filter");
            return;
        }

        const checkbox = target.closest("#list input.cbox");
        if (checkbox) {
            const row = checkbox.closest("tr");
            pushRows10000TraceEvent("ui-click-grid-checkbox", {
                checked: !!checkbox.checked,
                rowId: trimRows10000Text(row ? (row.id || row.getAttribute("id") || "") : "", 80),
                isHeaderCheckbox: checkbox.id === "cb_list",
                domSnapshot: buildRows10000DomSnapshot("ui-click-grid-checkbox")
            }, { source: "ui" });
            return;
        }

        const header = target.closest('th[id^="jqgh_list_"], th[id^="list_"]');
        if (header) {
            pushRows10000TraceEvent("ui-click-grid-header", {
                headerId: trimRows10000Text(header.id || "", 120),
                text: trimRows10000Text(header.textContent || "", 160),
                domSnapshot: buildRows10000DomSnapshot("ui-click-grid-header")
            }, { source: "ui" });
            requestRows10000MainWorldSnapshot("ui-click-grid-header");
            return;
        }

        const controlInfo = buildRows10000ControlInfo(target);
        if (controlInfo) {
            pushRows10000TraceEvent("ui-click-control", {
                control: controlInfo,
                domSnapshot: buildRows10000DomSnapshot("ui-click-control")
            }, { source: "ui" });
            requestRows10000MainWorldSnapshot("ui-click-control");
        }
    }

    function handleRows10000UiChange(event) {
        if (!rows10000TraceEnabled) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.matches(".ui-pg-selbox")) {
            pushRows10000TraceEvent("ui-change-rownum", {
                value: trimRows10000Text(target.value || "", 20),
                domSnapshot: buildRows10000DomSnapshot("ui-change-rownum")
            }, { source: "ui" });
            requestRows10000MainWorldSnapshot("ui-change-rownum");
            return;
        }

        if (target.closest(".ui-search-toolbar")) {
            pushRows10000TraceEvent("ui-change-filter", {
                target: buildRows10000ElementSnapshot(target),
                domSnapshot: buildRows10000DomSnapshot("ui-change-filter")
            }, { source: "ui" });
            return;
        }

        if (target.matches('select, input[type="checkbox"], input[type="radio"]')) {
            pushRows10000TraceEvent("ui-change-control", {
                target: buildRows10000ElementSnapshot(target),
                checked: typeof target.checked === "boolean" ? target.checked : undefined,
                domSnapshot: buildRows10000DomSnapshot("ui-change-control")
            }, { source: "ui" });
        }
    }

    function handleRows10000UiKeydown(event) {
        if (!rows10000TraceEnabled || event.key !== "Enter") return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || !target.closest(".ui-search-toolbar")) return;
        pushRows10000TraceEvent("ui-enter-filter", {
            target: buildRows10000ElementSnapshot(target),
            domSnapshot: buildRows10000DomSnapshot("ui-enter-filter")
        }, { source: "ui" });
        requestRows10000MainWorldSnapshot("ui-enter-filter");
    }

    function installRows10000MainWorldHooks() {
        if (!rows10000TraceEnabled) return;
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.textContent = `;(${function rows10000MainWorldBootstrap(config) {
            if (window.__dupRows10000TraceInstalled) return;
            window.__dupRows10000TraceInstalled = true;

            const EVENT_NAME = config.eventName;
            const SNAPSHOT_EVENT = config.snapshotEventName;
            const SHOW_SELECTED_WINDOW_MS = config.showSelectedWindowMs;
            const STACK_LIMIT = config.stackLimit;
            let lastShowSelectedAtMs = 0;
            let tracerDepth = 0;
            let jqGridInstalled = false;
            let xhrInstalled = false;

            function withGuard(fn) {
                tracerDepth += 1;
                try {
                    return fn();
                } finally {
                    tracerDepth = Math.max(0, tracerDepth - 1);
                }
            }

            function trimText(value, limit) {
                const text = String(value == null ? "" : value).replace(/\\s+/g, " ").trim();
                if (!text) return "";
                const max = Number.isFinite(limit) && limit > 0 ? limit : 2000;
                return text.length > max ? text.slice(0, Math.max(0, max - 1)) + "…" : text;
            }

            function safeInteger(value) {
                const num = parseInt(String(value == null ? "" : value).trim(), 10);
                return Number.isFinite(num) ? num : null;
            }

            function normalizeFilters(filtersRaw) {
                const raw = String(filtersRaw || "").trim();
                if (!raw) {
                    return {
                        raw: "",
                        parsed: null,
                        ruleCount: 0,
                        hasEmptyEdocInRule: false,
                        firstRules: []
                    };
                }

                let parsed = null;
                const candidates = [raw];
                try {
                    const decoded = decodeURIComponent(raw);
                    if (decoded !== raw) {
                        candidates.push(decoded);
                    }
                } catch (error) {
                    // ignore
                }

                for (let i = 0; i < candidates.length; i += 1) {
                    try {
                        parsed = JSON.parse(candidates[i]);
                        break;
                    } catch (error) {
                        // ignore
                    }
                }

                const rules = parsed && Array.isArray(parsed.rules) ? parsed.rules : [];
                const firstRules = rules.slice(0, 5).map((rule) => ({
                    field: trimText(rule && rule.field ? rule.field : "", 120),
                    op: trimText(rule && rule.op ? rule.op : "", 40),
                    data: trimText(rule && rule.data ? rule.data : "", 300)
                }));
                const hasEmptyEdocInRule = rules.some((rule) => (
                    trimText(rule && rule.field ? rule.field : "", 120) === "V_OVZID.EDocID"
                    && trimText(rule && rule.op ? rule.op : "", 40) === "in"
                    && trimText(rule && rule.data ? rule.data : "", 10) === ""
                ));

                return {
                    raw: trimText(raw, 2000),
                    parsed: parsed ? { groupOp: trimText(parsed.groupOp || "", 30) } : null,
                    ruleCount: rules.length,
                    hasEmptyEdocInRule: hasEmptyEdocInRule,
                    firstRules: firstRules
                };
            }

            function buildStack() {
                try {
                    throw new Error();
                } catch (error) {
                    const stack = String(error && error.stack ? error.stack : "");
                    if (!stack) return "";
                    const lines = stack.split("\\n").slice(2, 10);
                    return trimText(lines.join("\\n"), STACK_LIMIT);
                }
            }

            function getSelectedRowsCounterState() {
                const selectedRowsEl = document.getElementById("selected_rows");
                const counterEl = selectedRowsEl ? selectedRowsEl.querySelector(".rows-counter") : null;
                const text = trimText(counterEl ? counterEl.textContent : "", 40);
                return {
                    buttonCounterText: text,
                    buttonCounterNumber: safeInteger(text),
                    buttonVisible: !!(selectedRowsEl && selectedRowsEl.offsetParent !== null)
                };
            }

            function buildActiveElementState() {
                const el = document.activeElement;
                if (!(el instanceof Element)) return {};
                return {
                    label: trimText(el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""), 120),
                    text: trimText(el.getAttribute("aria-label") || el.value || el.textContent || "", 160)
                };
            }

            function getGridState() {
                return withGuard(function() {
                    const state = Object.assign({
                        href: window.location.href,
                        title: trimText(document.title, 160),
                        visibleCheckedCount: document.querySelectorAll("#list tr.jqgrow input.cbox:checked").length,
                        highlightedRowCount: document.querySelectorAll("#list tr.jqgrow.ui-state-highlight").length,
                        activeElement: buildActiveElementState()
                    }, getSelectedRowsCounterState());

                    const $ = window.jQuery;
                    const gridEl = document.getElementById("list");
                    if (!($ && $.fn && $.fn.jqGrid && gridEl)) {
                        return state;
                    }

                    try {
                        const grid = $("#list");
                        const selarrrow = grid.jqGrid("getGridParam", "selarrrow") || [];
                        const postData = grid.jqGrid("getGridParam", "postData") || {};
                        state.selarrrowLen = Array.isArray(selarrrow) ? selarrrow.length : 0;
                        state.selarrrowPreview = Array.isArray(selarrrow) ? selarrrow.slice(0, 10) : [];
                        state.rowNum = safeInteger(grid.jqGrid("getGridParam", "rowNum"));
                        state.page = safeInteger(grid.jqGrid("getGridParam", "page"));
                        state.sortname = trimText(grid.jqGrid("getGridParam", "sortname") || "", 160);
                        state.sortorder = trimText(grid.jqGrid("getGridParam", "sortorder") || "", 40);
                        state.records = safeInteger(grid.jqGrid("getGridParam", "records"));
                        state.reccount = safeInteger(grid.jqGrid("getGridParam", "reccount"));
                        state.postDataRows = safeInteger(postData.rows);
                        state.postDataSearch = trimText(postData._search || "", 16);
                        state.postDataFilters = trimText(postData.filters || "", 2000);
                        state.filtersSummary = normalizeFilters(postData.filters || "");
                    } catch (error) {
                        state.stateReadError = trimText(error && error.message ? error.message : error, 200);
                    }

                    return state;
                });
            }

            function dispatch(type, payload) {
                try {
                    window.dispatchEvent(new CustomEvent(EVENT_NAME, {
                        detail: {
                            type: type,
                            atMs: Date.now(),
                            payload: payload || {}
                        }
                    }));
                } catch (error) {
                    // ignore
                }
            }

            function summarizeArg(value) {
                if (value == null) return value;
                if (Array.isArray(value)) {
                    return value.slice(0, 10).map(summarizeArg);
                }
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                    return trimText(value, 400);
                }
                if (value instanceof Element) {
                    return trimText(value.tagName.toLowerCase() + (value.id ? "#" + value.id : ""), 120);
                }
                if (typeof value === "object") {
                    const result = {};
                    Object.keys(value).slice(0, 12).forEach(function(key) {
                        const current = value[key];
                        if (current == null || typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
                            result[key] = trimText(current, 400);
                        } else if (Array.isArray(current)) {
                            result[key] = current.slice(0, 10).map(function(item) {
                                return trimText(item, 120);
                            });
                        }
                    });
                    return result;
                }
                return trimText(String(value), 200);
            }

            function installJqGridHooks($) {
                if (jqGridInstalled || !($ && $.fn && $.fn.jqGrid)) return;
                jqGridInstalled = true;
                const originalJqGrid = $.fn.jqGrid;
                const originalTrigger = $.fn.trigger;

                function copyFunctionProperties(sourceFn, targetFn) {
                    if (
                        typeof sourceFn !== "function"
                        || typeof targetFn !== "function"
                        || sourceFn === targetFn
                    ) {
                        return targetFn;
                    }

                    const skipKeys = new Set(["length", "name", "prototype", "arguments", "caller"]);
                    const sourcePrototype = Object.getPrototypeOf(sourceFn);
                    if (sourcePrototype && Object.getPrototypeOf(targetFn) !== sourcePrototype) {
                        try {
                            Object.setPrototypeOf(targetFn, sourcePrototype);
                        } catch (error) {
                            // ignore
                        }
                    }

                    Reflect.ownKeys(sourceFn).forEach(function(key) {
                        if (skipKeys.has(String(key))) return;
                        try {
                            const descriptor = Object.getOwnPropertyDescriptor(sourceFn, key);
                            if (!descriptor) return;
                            Object.defineProperty(targetFn, key, descriptor);
                        } catch (error) {
                            // ignore
                        }
                    });

                    return targetFn;
                }

                const wrappedJqGrid = function() {
                    if (tracerDepth > 0) {
                        return originalJqGrid.apply(this, arguments);
                    }
                    const args = Array.prototype.slice.call(arguments);
                    const method = typeof args[0] === "string" ? args[0] : "";
                    const isGrid = !!(this && this[0] && this[0].id === "list");
                    const shouldTrace = isGrid && (method === "resetSelection" || method === "setGridParam");
                    const before = shouldTrace ? getGridState() : null;
                    const stack = shouldTrace ? buildStack() : "";
                    try {
                        return originalJqGrid.apply(this, arguments);
                    } finally {
                        if (shouldTrace) {
                            dispatch("jqgrid-call", {
                                method: method,
                                args: args.slice(1).map(summarizeArg),
                                before: before,
                                after: getGridState(),
                                stack: stack
                            });
                        }
                    }
                };
                $.fn.jqGrid = copyFunctionProperties(originalJqGrid, wrappedJqGrid);

                $.fn.trigger = function() {
                    if (tracerDepth > 0) {
                        return originalTrigger.apply(this, arguments);
                    }
                    const args = Array.prototype.slice.call(arguments);
                    const firstArg = args[0];
                    const eventName = typeof firstArg === "string"
                        ? firstArg
                        : (firstArg && firstArg.type ? firstArg.type : "");
                    const isGrid = !!(this && this[0] && this[0].id === "list");
                    const shouldTrace = isGrid && eventName === "reloadGrid";
                    const before = shouldTrace ? getGridState() : null;
                    const stack = shouldTrace ? buildStack() : "";
                    try {
                        return originalTrigger.apply(this, arguments);
                    } finally {
                        if (shouldTrace) {
                            dispatch("jqgrid-trigger", {
                                eventName: eventName,
                                args: args.slice(1).map(summarizeArg),
                                before: before,
                                after: getGridState(),
                                stack: stack
                            });
                        }
                    }
                };

                $(document).on("jqGridSelectRow dupRows10000Trace jqGridSelectAll jqGridLoadComplete", "#list", function(event, rowId) {
                    dispatch("jqgrid-event", {
                        eventName: trimText(event && event.type ? event.type : "", 60),
                        rowId: trimText(rowId || "", 80),
                        state: getGridState()
                    });
                });
            }

            function parseGridRequest(rawUrl, method) {
                let url = null;
                try {
                    url = new URL(String(rawUrl || ""), window.location.href);
                } catch (error) {
                    return { isRelevant: false, parseError: trimText(error && error.message ? error.message : error, 160) };
                }
                const pathname = String(url.pathname || "");
                if (!new RegExp("^/ovzid/status/[^/]+/data$", "i").test(pathname)) {
                    return { isRelevant: false, href: url.href, pathname: pathname };
                }

                const rowsRaw = trimText(url.searchParams.get("rows") || "", 20);
                const rowsNumber = safeInteger(rowsRaw);
                const filtersRaw = url.searchParams.get("filters") || "";
                const filtersSummary = normalizeFilters(filtersRaw);
                const searchFlag = trimText(url.searchParams.get("_search") || "", 16);
                const recentShowSelectedDeltaMs = Date.now() - lastShowSelectedAtMs;
                const state = getGridState();
                const hasStateMismatch = (
                    safeInteger(state.buttonCounterNumber) !== null
                    && safeInteger(state.buttonCounterNumber) > 0
                    && safeInteger(state.selarrrowLen) === 0
                );

                return {
                    isRelevant: true,
                    href: url.href,
                    pathname: pathname,
                    method: trimText(method || "GET", 16),
                    rowsRaw: rowsRaw,
                    rowsNumber: rowsNumber,
                    page: safeInteger(url.searchParams.get("page")),
                    searchFlag: searchFlag,
                    sidx: trimText(url.searchParams.get("sidx") || "", 160),
                    sord: trimText(url.searchParams.get("sord") || "", 40),
                    filtersRaw: trimText(filtersRaw, 2000),
                    filtersSummary: filtersSummary,
                    recentShowSelectedDeltaMs: recentShowSelectedDeltaMs,
                    hasStateMismatch: hasStateMismatch,
                    isSuspicious: (
                        searchFlag === "true"
                        && rowsNumber === 10000
                        && (
                            filtersSummary.hasEmptyEdocInRule
                            || recentShowSelectedDeltaMs <= SHOW_SELECTED_WINDOW_MS
                            || hasStateMismatch
                        )
                    )
                };
            }

            function installXhrHooks() {
                if (xhrInstalled || !window.XMLHttpRequest) return;
                xhrInstalled = true;
                const originalOpen = XMLHttpRequest.prototype.open;
                const originalSend = XMLHttpRequest.prototype.send;

                XMLHttpRequest.prototype.open = function(method, url) {
                    this.__dupRows10000Meta = {
                        method: trimText(method || "GET", 16),
                        url: trimText(url || "", 2000)
                    };
                    return originalOpen.apply(this, arguments);
                };

                XMLHttpRequest.prototype.send = function(body) {
                    const meta = this.__dupRows10000Meta || {
                        method: "GET",
                        url: ""
                    };
                    meta.requestId = meta.requestId || (Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8));
                    meta.sendAtMs = Date.now();
                    const requestInfo = parseGridRequest(meta.url, meta.method);
                    if (requestInfo.isRelevant) {
                        dispatch("network-request", {
                            phase: "send",
                            requestId: meta.requestId,
                            request: requestInfo,
                            state: getGridState(),
                            stack: buildStack()
                        });
                        if (requestInfo.isSuspicious) {
                            dispatch("rows10000-candidate", {
                                requestId: meta.requestId,
                                triggerReason: requestInfo.filtersSummary.hasEmptyEdocInRule
                                    ? "empty_edocid_in_filter"
                                    : (requestInfo.hasStateMismatch ? "ui_counter_selarrrow_mismatch" : "rows10000_after_show_selected"),
                                request: requestInfo,
                                state: getGridState()
                            });
                        }
                    }

                    this.addEventListener("loadend", function onLoadEnd() {
                        if (!requestInfo.isRelevant) return;
                        dispatch("network-request", {
                            phase: "complete",
                            requestId: meta.requestId,
                            request: requestInfo,
                            response: {
                                status: this.status,
                                durationMs: Math.max(0, Date.now() - meta.sendAtMs)
                            },
                            state: getGridState()
                        });
                    }, { once: true });

                    return originalSend.apply(this, arguments);
                };
            }

            function installShowSelectedHooks() {
                document.addEventListener("click", function(event) {
                    const target = event.target instanceof Element ? event.target : null;
                    const button = target && target.closest ? target.closest("#selected_rows .showSelectedRow") : null;
                    if (!button) return;
                    lastShowSelectedAtMs = Date.now();
                    dispatch("ui-show-selected-click", {
                        buttonText: trimText(button.textContent || "", 160),
                        state: getGridState(),
                        stack: buildStack()
                    });
                }, true);
            }

            function installSnapshotBridge() {
                window.addEventListener(SNAPSHOT_EVENT, function(event) {
                    const rawReason = typeof (event && event.detail) === "string"
                        ? event.detail
                        : "";
                    dispatch("grid-snapshot", {
                        reason: trimText(rawReason, 80),
                        state: getGridState()
                    });
                });
            }

            function tryInstall() {
                const $ = window.jQuery;
                if ($ && $.fn && $.fn.jqGrid) {
                    installJqGridHooks($);
                }
                installXhrHooks();
                installShowSelectedHooks();
                installSnapshotBridge();
            }

            tryInstall();
            let attempts = 0;
            const timer = window.setInterval(function() {
                attempts += 1;
                tryInstall();
                if ((jqGridInstalled && xhrInstalled) || attempts >= 60) {
                    window.clearInterval(timer);
                }
            }, 500);
        }})(${JSON.stringify({
            eventName: ROWS10000_TRACE_EVENT,
            snapshotEventName: ROWS10000_TRACE_REQUEST_SNAPSHOT_EVENT,
            showSelectedWindowMs: ROWS10000_SHOW_SELECTED_WINDOW_MS,
            stackLimit: ROWS10000_STACK_TEXT_LIMIT
        })});`;
        (document.documentElement || document.head || document.body).appendChild(script);
        script.remove();
    }

    function initRows10000Trace() {
        if (!rows10000TraceEnabled) return;
        pushRows10000TraceEvent("trace-init", {
            baseName: baseName,
            stageName: trimRows10000Text(document.title, 160),
            domSnapshot: buildRows10000DomSnapshot("trace-init")
        }, { source: "content" });
        window.addEventListener(ROWS10000_TRACE_EVENT, handleRows10000MainWorldEvent, { capture: true });
        document.addEventListener("click", handleRows10000UiClick, { capture: true });
        document.addEventListener("change", handleRows10000UiChange, { capture: true });
        document.addEventListener("keydown", handleRows10000UiKeydown, { capture: true });
        installRows10000MainWorldHooks();
        requestRows10000MainWorldSnapshot("trace-init");
    }

    function readLegacyTimerUiVisibilityPreference() {
        try {
            const rawValue = window.localStorage.getItem(LEGACY_TIMER_VISIBILITY_STORAGE_KEY);
            if (rawValue === "0") return false;
            if (rawValue === "1") return true;
        } catch (e) {
            // ignore
        }
        return true;
    }

    function saveTimerUiVisibilityPreference(isVisible) {
        chrome.storage.local.set({ [TIMER_VISIBILITY_STORAGE_KEY]: !!isVisible });
        try {
            window.localStorage.setItem(LEGACY_TIMER_VISIBILITY_STORAGE_KEY, isVisible ? "1" : "0");
        } catch (e) {
            // ignore
        }
    }

    function isTimerUiSettingEnabled(key) {
        if (EXTENSION_UI_GLOBAL_CONFIG.globalEnabled === false) return false;
        const forcedVisibility = EXTENSION_UI_GLOBAL_CONFIG.forcedVisibility[key];
        if (typeof forcedVisibility === "boolean") return forcedVisibility;
        return timerUiElementSettings[key] !== false;
    }

    function isTimerUiSettingLocked(key) {
        return EXTENSION_UI_GLOBAL_CONFIG.globalEnabled === false
            || typeof EXTENSION_UI_GLOBAL_CONFIG.forcedVisibility[key] === "boolean";
    }

    function getExtensionVersionText() {
        const version = typeof extVersion === "string"
            ? extVersion.trim()
            : "";
        return `Версия: ${version || "неизвестна"}`;
    }

    function syncTimerUiSettingsPanelState() {
        if (!(timerUiSettingsPanelEl instanceof HTMLElement)) return;

        TIMER_UI_SETTING_DEFS.forEach((definition) => {
            const input = timerUiSettingsPanelEl.querySelector(`input[${EXTENSION_UI_SETTINGS_INPUT_ATTR}="${definition.key}"]`);
            if (input instanceof HTMLInputElement) {
                input.checked = isTimerUiSettingEnabled(definition.key);
                input.disabled = isTimerUiSettingLocked(definition.key);
                input.title = isTimerUiSettingLocked(definition.key)
                    ? "Состояние зафиксировано в extension_ui_config.js"
                    : "";
            }

            const settingItem = input instanceof HTMLElement
                ? input.closest(`.${EXTENSION_UI_SETTINGS_ITEM_CLASS}`)
                : null;
            if (settingItem instanceof HTMLElement) {
                settingItem.classList.toggle("is-locked", isTimerUiSettingLocked(definition.key));
            }
        });
    }

    function loadTimerUiElementSettings() {
        chrome.storage.local.get(TIMER_UI_SETTINGS_STORAGE_KEYS, (storedSettings) => {
            const nextSettings = { ...TIMER_UI_SETTINGS_DEFAULTS };

            TIMER_UI_SETTING_DEFS.forEach((definition) => {
                if (typeof storedSettings[definition.storageKey] === "boolean") {
                    nextSettings[definition.key] = storedSettings[definition.storageKey];
                }
            });

            if (typeof storedSettings[TIMER_VISIBILITY_STORAGE_KEY] !== "boolean") {
                const legacyValue = readLegacyTimerUiVisibilityPreference();
                nextSettings.stageTimer = legacyValue;
                if (legacyValue !== TIMER_UI_SETTINGS_DEFAULTS.stageTimer) {
                    chrome.storage.local.set({ [TIMER_VISIBILITY_STORAGE_KEY]: legacyValue });
                }
            }

            timerUiElementSettings = nextSettings;
            setTimerUiVisibility(nextSettings.stageTimer, false);
            applyControlButtonsVisibility();
            syncTimerUiSettingsPanelState();
        });
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

    function updateTimerAbortButtonState() {
        const buttonTitle = "Прервать загрузку/фильтрацию (debug)";
        timerAbortButton.setAttribute("title", buttonTitle);
        timerAbortButton.setAttribute("aria-label", buttonTitle);
    }

    function applyControlButtonsVisibility() {
        const toggleDisplayValue = (
            isScreenshotModeActive || !isTimerUiSettingEnabled("stageTimerToggle")
        ) ? "none" : "inline-flex";
        const abortDisplayValue = (
            isScreenshotModeActive || !isTimerUiSettingEnabled("stageTimerAbort")
        ) ? "none" : "inline-flex";
        timerToggleButton.style.display = toggleDisplayValue;
        timerAbortButton.style.display = abortDisplayValue;
        applyDepartmentConflictAlertVisibility();
    }

    function applyDepartmentConflictAlertVisibility() {
        const shouldShow = (
            !isScreenshotModeActive
            && isTimerUiSettingEnabled("stageTimerDepartmentConflict")
            && hasDepartmentConflictAlert
        );
        departmentConflictAlert.style.display = shouldShow ? "inline-flex" : "none";
    }

    function applyTimerUiVisibility() {
        if (isScreenshotModeActive || !isTimerUiSettingEnabled("stageTimer") || !isTimerUiVisible || !hasTimerSnapshot) {
            toast.style.display = "none";
            return;
        }
        toast.style.display = "inline-flex";
    }

    function setTimerUiVisibility(isVisible, shouldPersist = true) {
        isTimerUiVisible = !!isVisible;
        timerUiElementSettings = {
            ...timerUiElementSettings,
            stageTimer: isTimerUiVisible
        };
        if (shouldPersist) {
            saveTimerUiVisibilityPreference(isTimerUiVisible);
        }
        updateTimerToggleButtonState();
        applyControlButtonsVisibility();
        applyTimerUiVisibility();
        syncTimerUiSettingsPanelState();
    }

    function getExternalExtensionUiSettingsController() {
        const controller = window.__dupExtensionUiSettingsController;
        if (!controller || typeof controller.togglePanel !== "function") return null;
        return controller;
    }

    function closeTimerUiSettingsPanel() {
        if (timerUiSettingsOverlayEl instanceof HTMLElement) {
            timerUiSettingsOverlayEl.hidden = true;
        }
        if (timerUiSettingsPanelEl instanceof HTMLElement) {
            timerUiSettingsPanelEl.hidden = true;
        }
    }

    function ensureTimerUiSettingsPanel() {
        if (timerUiSettingsOverlayEl instanceof HTMLElement && timerUiSettingsPanelEl instanceof HTMLElement) {
            syncTimerUiSettingsPanelState();
            return timerUiSettingsPanelEl;
        }

        const host = document.body || document.documentElement;
        if (!(host instanceof HTMLElement)) return null;

        const existingOverlay = document.getElementById(EXTENSION_UI_SETTINGS_OVERLAY_ID);
        if (existingOverlay instanceof HTMLElement) {
            timerUiSettingsOverlayEl = existingOverlay;
        }

        const existingPanel = document.getElementById(EXTENSION_UI_SETTINGS_PANEL_ID);
        if (existingPanel instanceof HTMLElement) {
            timerUiSettingsPanelEl = existingPanel;
            syncTimerUiSettingsPanelState();
            return existingPanel;
        }

        const overlay = document.createElement("div");
        overlay.id = EXTENSION_UI_SETTINGS_OVERLAY_ID;
        overlay.className = EXTENSION_UI_SETTINGS_OVERLAY_CLASS;
        overlay.hidden = true;
        overlay.addEventListener("click", () => closeTimerUiSettingsPanel(), { capture: true });

        const panel = document.createElement("section");
        panel.id = EXTENSION_UI_SETTINGS_PANEL_ID;
        panel.className = EXTENSION_UI_SETTINGS_PANEL_CLASS;
        panel.hidden = true;
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", "Настройки элементов расширения");

        const header = document.createElement("div");
        header.className = "dup-extension-ui-settings-header";
        header.innerHTML = `
            <div class="dup-extension-ui-settings-heading">
                <div class="dup-extension-ui-settings-heading-title">Настройки элементов расширения</div>
                <div class="dup-extension-ui-settings-heading-hint">${EXTENSION_UI_SETTINGS_HINT_TEXT}</div>
            </div>
        `;

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "dup-extension-ui-settings-close";
        closeButton.setAttribute("aria-label", "Закрыть настройки элементов расширения");
        closeButton.textContent = "×";
        closeButton.addEventListener("click", () => closeTimerUiSettingsPanel(), { capture: true });
        header.appendChild(closeButton);

        const list = document.createElement("div");
        list.className = "dup-extension-ui-settings-list";

        TIMER_UI_SETTING_DEFS.forEach((definition) => {
            const label = document.createElement("label");
            label.className = EXTENSION_UI_SETTINGS_ITEM_CLASS;

            const textBlock = document.createElement("span");
            textBlock.className = "dup-extension-ui-settings-text";

            const title = document.createElement("span");
            title.className = EXTENSION_UI_SETTINGS_TITLE_CLASS;
            title.textContent = definition.label;

            const description = document.createElement("span");
            description.className = EXTENSION_UI_SETTINGS_DESCRIPTION_CLASS;
            description.textContent = definition.description;

            textBlock.append(title, description);

            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = isTimerUiSettingEnabled(definition.key);
            input.setAttribute(EXTENSION_UI_SETTINGS_INPUT_ATTR, definition.key);
            input.setAttribute("aria-label", definition.label);

            label.append(textBlock, input);
            list.appendChild(label);
        });

        list.addEventListener("change", (event) => {
            const input = event.target instanceof HTMLInputElement
                ? event.target
                : null;
            if (!input) return;

            const settingKey = String(input.getAttribute(EXTENSION_UI_SETTINGS_INPUT_ATTR) || "").trim();
            const definition = TIMER_UI_SETTING_DEF_BY_KEY[settingKey];
            if (!definition) return;
            if (isTimerUiSettingLocked(definition.key)) {
                syncTimerUiSettingsPanelState();
                return;
            }

            if (definition.key === "stageTimer") {
                setTimerUiVisibility(input.checked, false);
            } else {
                timerUiElementSettings = {
                    ...timerUiElementSettings,
                    [definition.key]: input.checked
                };
                applyControlButtonsVisibility();
                syncTimerUiSettingsPanelState();
            }

            chrome.storage.local.set({ [definition.storageKey]: input.checked });
        }, { capture: true });

        const footer = document.createElement("div");
        footer.className = "dup-extension-ui-settings-footer";
        const versionNote = document.createElement("span");
        versionNote.className = "dup-extension-ui-settings-version";
        versionNote.textContent = getExtensionVersionText();
        const hotkeyNote = document.createElement("span");
        hotkeyNote.className = "dup-extension-ui-settings-hotkey";
        hotkeyNote.textContent = "Горячая клавиша: F2";
        footer.append(versionNote, hotkeyNote);

        panel.append(header, list, footer);
        host.append(overlay, panel);

        timerUiSettingsOverlayEl = overlay;
        timerUiSettingsPanelEl = panel;
        syncTimerUiSettingsPanelState();
        return panel;
    }

    function toggleTimerUiSettingsPanel() {
        const panel = ensureTimerUiSettingsPanel();
        if (!(panel instanceof HTMLElement)) return false;

        if (panel.hidden) {
            if (timerUiSettingsOverlayEl instanceof HTMLElement) {
                timerUiSettingsOverlayEl.hidden = false;
            }
            panel.hidden = false;
            syncTimerUiSettingsPanelState();
            return true;
        }

        closeTimerUiSettingsPanel();
        return false;
    }

    function isExtensionUiSettingsHotkey(event) {
        if (!event) return false;
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;

        const key = String(event.key || "");
        const code = String(event.code || "");
        const keyCode = Number(event.keyCode || event.which || 0);
        return key === "F2" || code === "F2" || keyCode === KEY_CODE_F2;
    }

    function readScreenshotModeFromDom() {
        const root = document.documentElement;
        return !!(root && root.classList.contains(SCREENSHOT_MODE_CLASS));
    }

    function getExternalScreenshotModeController() {
        const controller = window.__dupScreenshotModeController;
        if (!controller || typeof controller.toggleManualMode !== "function") return null;
        return controller;
    }

    function setScreenshotModeActive(nextValue) {
        const normalizedNextValue = !!nextValue;
        if (isScreenshotModeActive === normalizedNextValue) return;
        isScreenshotModeActive = normalizedNextValue;
        applyControlButtonsVisibility();
        applyTimerUiVisibility();
    }

    function syncScreenshotModeState() {
        const localManualModeIsEffective = !getExternalScreenshotModeController() && screenshotManualModeIsActive;
        if (localManualModeIsEffective || screenshotHideTimer) {
            setScreenshotModeActive(true);
            return;
        }
        setScreenshotModeActive(readScreenshotModeFromDom());
    }

    function finalizeScreenshotAutohide() {
        const localManualModeIsEffective = !getExternalScreenshotModeController() && screenshotManualModeIsActive;
        if (localManualModeIsEffective || readScreenshotModeFromDom()) {
            setScreenshotModeActive(true);
            return;
        }
        screenshotHideDurationMs = SCREENSHOT_HIDE_DURATION_MS;
        setScreenshotModeActive(false);
    }

    function setLocalManualScreenshotMode(nextValue) {
        const normalizedNextValue = !!nextValue;
        if (screenshotManualModeIsActive === normalizedNextValue) return;
        screenshotManualModeIsActive = normalizedNextValue;

        try {
            window.__dupPendingScreenshotManualMode = normalizedNextValue;
        } catch (e) {
            // ignore
        }

        syncScreenshotModeState();
    }

    function resolveScreenshotHideDurationMs(triggerKey) {
        return triggerKey === "PrintScreen"
            ? SCREENSHOT_HIDE_PRINT_SCREEN_DURATION_MS
            : SCREENSHOT_HIDE_DURATION_MS;
    }

    function resolveScreenshotHideOnBlurDurationMs() {
        return Math.max(
            screenshotHideDurationMs,
            screenshotHideDurationMs >= SCREENSHOT_HIDE_PRINT_SCREEN_DURATION_MS
                ? SCREENSHOT_HIDE_PRINT_SCREEN_ON_BLUR_DURATION_MS
                : SCREENSHOT_HIDE_ON_BLUR_DURATION_MS
        );
    }

    function scheduleScreenshotAutohide(_source, triggerKey = "") {
        screenshotHideDurationMs = resolveScreenshotHideDurationMs(triggerKey);
        setScreenshotModeActive(true);
        if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
        screenshotHideTimer = setTimeout(() => {
            screenshotHideTimer = null;
            finalizeScreenshotAutohide();
        }, screenshotHideDurationMs);
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

    function isScreenshotToggleHotkey(event) {
        if (!event) return false;
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;

        const key = String(event.key || "");
        const code = String(event.code || "");
        const keyCode = Number(event.keyCode || event.which || 0);
        return key === "F1" || code === "F1" || keyCode === KEY_CODE_F1;
    }

    function suppressHotkeyEvent(event) {
        if (!event) return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    function handleExtensionUiSettingsHotkey(event) {
        if (!isExtensionUiSettingsHotkey(event)) return;

        suppressHotkeyEvent(event);
        if (event.type !== "keydown" || event.repeat) return;

        const externalController = getExternalExtensionUiSettingsController();
        if (externalController) {
            externalController.togglePanel();
            return;
        }

        if (!isStandaloneStageTimerBuild) return;
        toggleTimerUiSettingsPanel();
    }

    function handleExtensionUiSettingsEscape(event) {
        if (!(timerUiSettingsPanelEl instanceof HTMLElement) || timerUiSettingsPanelEl.hidden) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        const key = String(event.key || "");
        const code = String(event.code || "");
        const keyCode = Number(event.keyCode || event.which || 0);
        if (key !== "Escape" && code !== "Escape" && keyCode !== 27) return;

        suppressHotkeyEvent(event);
        if (event.type !== "keydown" || event.repeat) return;
        closeTimerUiSettingsPanel();
    }

    function initExtensionUiSettingsHotkeys() {
        document.addEventListener("keydown", handleExtensionUiSettingsHotkey, true);
        document.addEventListener("keyup", handleExtensionUiSettingsHotkey, true);
        document.addEventListener("keydown", handleExtensionUiSettingsEscape, true);
        document.addEventListener("keyup", handleExtensionUiSettingsEscape, true);
    }

    function handleScreenshotToggleHotkey(event) {
        if (!isScreenshotToggleHotkey(event)) return;

        suppressHotkeyEvent(event);
        if (event.type !== "keydown" || event.repeat) return;

        const controller = getExternalScreenshotModeController();
        if (controller) {
            try {
                controller.toggleManualMode("hotkey:F1");
                return;
            } catch (e) {
                // ignore and fallback to local state
            }
        }

        setLocalManualScreenshotMode(!screenshotManualModeIsActive);
    }

    function handleScreenshotHotkey(event) {
        const triggerKey = resolveScreenshotTriggerKey(event);
        if (!triggerKey) return;
        if (event.type === "keydown" && event.repeat) return;

        const nowMs = Date.now();
        if ((nowMs - lastScreenshotTriggerAtMs) < SCREENSHOT_THROTTLE_MS) return;
        lastScreenshotTriggerAtMs = nowMs;
        scheduleScreenshotAutohide(`hotkey:${triggerKey}:${event.type}`, triggerKey);
    }

    function handleScreenshotFrameBridgeMessage(event) {
        const data = event && event.data && typeof event.data === "object"
            ? event.data
            : null;
        if (!data || data.type !== SCREENSHOT_FRAME_BRIDGE_MESSAGE) return;
        if (event.source === window) return;
        if (getExternalScreenshotModeController()) return;

        const source = typeof data.source === "string" && data.source
            ? data.source
            : "iframe-hotkey";
        const command = String(data.command || "");
        const triggerKey = typeof data.triggerKey === "string"
            ? data.triggerKey
            : "";

        if (command === "toggle-ui-settings") {
            const externalController = getExternalExtensionUiSettingsController();
            if (externalController) {
                externalController.togglePanel();
                return;
            }
            if (isStandaloneStageTimerBuild) {
                toggleTimerUiSettingsPanel();
            }
            return;
        }

        if (command === "toggle-manual") {
            setLocalManualScreenshotMode(!screenshotManualModeIsActive);
            return;
        }

        if (command !== "schedule-autohide") return;

        const nowMs = Date.now();
        if ((nowMs - lastScreenshotTriggerAtMs) < SCREENSHOT_THROTTLE_MS) return;
        lastScreenshotTriggerAtMs = nowMs;
        scheduleScreenshotAutohide(source, triggerKey);
    }

    function initScreenshotAutohideMode() {
        document.addEventListener("keydown", handleScreenshotToggleHotkey, true);
        document.addEventListener("keyup", handleScreenshotToggleHotkey, true);
        document.addEventListener("keydown", handleScreenshotHotkey, true);
        document.addEventListener("keyup", handleScreenshotHotkey, true);
        window.addEventListener("message", handleScreenshotFrameBridgeMessage, true);
        window.addEventListener("blur", () => {
            if (!screenshotHideTimer) return;
            if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
            screenshotHideTimer = setTimeout(() => {
                screenshotHideTimer = null;
                finalizeScreenshotAutohide();
            }, resolveScreenshotHideOnBlurDurationMs());
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

    function syncAbortButtonLook(closeButton) {
        timerAbortButton.className = "pyramid-stage-timer-abort-btn";
        const classesToApply = getToggleButtonClassesByCloseButton(closeButton);
        classesToApply.forEach((className) => timerAbortButton.classList.add(className));
        updateTimerAbortButtonState();
    }

    function getGridCandidatesForAbort() {
        const candidates = [];
        const byId = document.getElementById("list");
        if (byId) candidates.push(byId);

        const bySelector = Array.from(document.querySelectorAll("table.ui-jqgrid-btable"));
        bySelector.forEach((el) => candidates.push(el));

        if (window.jQuery) {
            try {
                const jqById = window.jQuery("#list")[0];
                if (jqById) candidates.push(jqById);
            } catch (e) {
                // ignore
            }
            try {
                window.jQuery("table.ui-jqgrid-btable").each((_, el) => {
                    if (el) candidates.push(el);
                });
            } catch (e) {
                // ignore
            }
        }

        const unique = [];
        const seen = new Set();
        candidates.forEach((el) => {
            if (!el || typeof el !== "object") return;
            if (seen.has(el)) return;
            seen.add(el);
            unique.push(el);
        });
        return unique;
    }

    function isGridRequestBusy(jqXhr) {
        if (!jqXhr) return false;
        const readyState = Number(jqXhr.readyState || 0);
        return readyState > 0 && readyState < 4;
    }

    function getAbortableGridRequest() {
        const grids = getGridCandidatesForAbort();
        let fallbackRequest = null;

        for (const gridEl of grids) {
            const jqXhr = gridEl && gridEl.p ? gridEl.p.jqXhr : null;
            if (!jqXhr || typeof jqXhr.abort !== "function") continue;

            if (isGridRequestBusy(jqXhr)) {
                return { gridEl, jqXhr, isBusy: true };
            }

            if (!fallbackRequest) {
                fallbackRequest = { gridEl, jqXhr, isBusy: false };
            }
        }

        return fallbackRequest;
    }

    function abortActiveStageLoadForDebug() {
        const activeRequest = getAbortableGridRequest();
        if (activeRequest) {
            try {
                activeRequest.jqXhr.abort();
                return "jqxhr";
            } catch (e) {
                // ignore and try hard fallback below
            }
        }

        // Жесткий fallback для отладки: останавливаем сетевую активность страницы.
        // Нужен для кейсов, где jqXhr не пробрасывается в content-world.
        try {
            window.stop();
            return "window-stop";
        } catch (e) {
            return "";
        }
    }

    function rewriteGridAbortErrorMessage(messageText) {
        const finalMessage = String(messageText || GRID_ABORT_REWRITE_TEXT).trim() || GRID_ABORT_REWRITE_TEXT;

        const srOnlyErrors = Array.from(document.querySelectorAll("span.sr-only.ui-jqgrid-error"));
        srOnlyErrors.forEach((el) => {
            const currentText = String(el.textContent || "").trim().toLowerCase();
            if (!currentText || currentText === "error" || currentText === "ошибка" || currentText.includes("error")) {
                el.textContent = finalMessage;
            }
        });

        const errorBars = Array.from(document.querySelectorAll(".ui-jqgrid-errorbar"));
        errorBars.forEach((bar) => {
            if (!(bar instanceof HTMLElement)) return;
            const textNodes = Array.from(bar.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
            textNodes.forEach((node) => {
                const text = String(node.textContent || "").trim().toLowerCase();
                if (!text || text === "error" || text.includes("error")) {
                    node.textContent = ` ${finalMessage} `;
                }
            });
            bar.setAttribute("aria-label", finalMessage);
        });
    }

    function scheduleGridAbortErrorMessageRewrite(messageText) {
        const retries = [0, 60, 180, 420, 900];
        retries.forEach((delayMs) => {
            setTimeout(() => {
                rewriteGridAbortErrorMessage(messageText);
            }, delayMs);
        });
    }

    function notifyGridAbortMessageRewrite(source, messageText) {
        const finalMessage = String(messageText || GRID_ABORT_REWRITE_TEXT).trim() || GRID_ABORT_REWRITE_TEXT;
        scheduleGridAbortErrorMessageRewrite(finalMessage);

        try {
            window.dispatchEvent(new CustomEvent(GRID_ABORT_REWRITE_EVENT, {
                detail: {
                    source: source || "timer-debug-abort",
                    message: finalMessage
                }
            }));
        } catch (e) {
            // ignore
        }
    }

    function normalizeIncidentText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function truncateIncidentText(value, limit = INCIDENT_SUMMARY_TEXT_LIMIT) {
        const normalized = normalizeIncidentText(value);
        if (!normalized || normalized.length <= limit) return normalized;
        return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
    }

    function noteGridAbortSignal(messageText) {
        lastGridAbortSignalAtMs = Date.now();
        const normalizedMessage = normalizeIncidentText(messageText || GRID_ABORT_REWRITE_TEXT);
        lastVisibleGridIncidentSignature = normalizedMessage ? `abort:${normalizedMessage}` : "abort:";
    }

    function isGridAbortSuppressed() {
        return lastGridAbortSignalAtMs > 0
            && (Date.now() - lastGridAbortSignalAtMs) <= GRID_ABORT_SUPPRESSION_WINDOW_MS;
    }

    function isElementVisible(element) {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getVisibleGridErrorDetails() {
        const errorBars = Array.from(document.querySelectorAll(".alert.alert-danger.ui-jqgrid-errorbar, .ui-jqgrid-errorbar"));
        for (const bar of errorBars) {
            if (!(bar instanceof HTMLElement) || !isElementVisible(bar)) continue;
            const srOnly = bar.querySelector("span.sr-only.ui-jqgrid-error");
            const text = normalizeIncidentText(
                (srOnly && srOnly.textContent)
                || bar.getAttribute("aria-label")
                || bar.textContent
            );
            if (!text) continue;
            return {
                text,
                fullText: text,
                pageUrl: window.location.href
            };
        }
        return null;
    }

    function buildStageIncidentCommonData() {
        const sessionData = normalizeSessionData(scrapeData());
        return {
            baseName: baseName,
            departmentName: sessionData.departmentName || "Не определен",
            userName: sessionData.userName || "Не определен",
            stageName: sessionData.stageName || "ПК Пирамида"
        };
    }

    function reportStageIncident(data) {
        if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function")) return;
        try {
            chrome.runtime.sendMessage({
                action: "LOG_STAGE_INCIDENT",
                data: {
                    eventType: "stage_incident",
                    version: extVersion,
                    timestamp: new Date().toISOString(),
                    ...data
                }
            });
        } catch (error) {
            console.warn("[StageTimer] Не удалось отправить инцидент.", error);
        }
    }

    function scanVisibleGridIncident() {
        const details = getVisibleGridErrorDetails();
        if (!details) {
            lastVisibleGridIncidentSignature = "";
            return;
        }

        const normalizedText = normalizeIncidentText(details.text);
        if (!normalizedText) {
            lastVisibleGridIncidentSignature = "";
            return;
        }

        const normalizedAbortText = normalizeIncidentText(GRID_ABORT_REWRITE_TEXT);
        if (normalizedText === normalizedAbortText || isGridAbortSuppressed()) {
            lastVisibleGridIncidentSignature = `ignored:${normalizedText}`;
            return;
        }

        const common = buildStageIncidentCommonData();
        const pageUrl = String(details.pageUrl || window.location.href || "").trim();
        const signature = [
            common.baseName,
            common.departmentName,
            common.userName,
            pageUrl,
            normalizedText
        ].map(normalizeIncidentText).join(" | ");

        if (signature === lastVisibleGridIncidentSignature) return;
        lastVisibleGridIncidentSignature = signature;

        reportStageIncident({
            incidentType: GRID_INCIDENT_TYPE,
            baseName: common.baseName,
            departmentName: common.departmentName,
            userName: common.userName,
            stageName: common.stageName,
            pageUrl: pageUrl,
            context: normalizeIncidentText(activeLoadType || common.stageName || window.location.pathname || "GRID"),
            summaryText: truncateIncidentText(normalizedText),
            fullText: normalizedText,
            signature: signature,
            edocId: "",
            debtId: "",
            epguSentAt: "",
            epguRequestType: ""
        });
    }

    function getEpguMatch(rawUrl) {
        if (!rawUrl) return null;
        try {
            const url = new URL(String(rawUrl), window.location.href);
            const match = url.pathname.match(EPGU_PATH_REGEX);
            if (!match) return null;
            return {
                href: url.href,
                pathname: url.pathname,
                edocId: match[1] || ""
            };
        } catch (error) {
            return null;
        }
    }

    function isDocumentLike(value) {
        return !!value
            && value.nodeType === 9
            && typeof value.querySelectorAll === "function";
    }

    function getEpguDocumentSources() {
        const sources = [];
        const currentMatch = getEpguMatch(window.location.href);
        if (currentMatch) {
            sources.push({
                key: `top:${currentMatch.href}`,
                doc: document,
                href: currentMatch.href,
                edocId: currentMatch.edocId
            });
        }

        const frames = Array.from(document.querySelectorAll("iframe"));
        frames.forEach((frame, index) => {
            if (!(frame instanceof HTMLIFrameElement)) return;
            let doc = null;
            let href = "";
            try {
                doc = frame.contentDocument;
                href = frame.contentWindow && frame.contentWindow.location
                    ? frame.contentWindow.location.href
                    : (frame.getAttribute("src") || "");
            } catch (error) {
                return;
            }
            if (!isDocumentLike(doc)) return;
            const match = getEpguMatch(href || frame.getAttribute("src") || "");
            if (!match) return;
            sources.push({
                key: `iframe:${index}:${match.href}`,
                doc,
                href: match.href,
                edocId: match.edocId
            });
        });

        return sources;
    }

    function findEpguRequestsTable(doc) {
        const tables = Array.from(doc.querySelectorAll("table"));
        for (const table of tables) {
            const headerTexts = Array.from(table.querySelectorAll("thead th, tr:first-child th, tr:first-child td"))
                .map((cell) => normalizeIncidentText(cell.textContent).toLowerCase())
                .filter(Boolean);
            if (headerTexts.some((text) => text.includes("статус отправки"))) {
                return table;
            }
        }
        return null;
    }

    function extractLatestEpguError(source) {
        if (!source || !isDocumentLike(source.doc)) return null;
        const table = findEpguRequestsTable(source.doc);
        if (!table) return null;

        let rows = Array.from(table.querySelectorAll("tbody tr"))
            .filter((row) => row.querySelectorAll("td").length >= 5);
        if (!rows.length) {
            rows = Array.from(table.querySelectorAll("tr"))
                .slice(1)
                .filter((row) => row.querySelectorAll("td").length >= 5);
        }
        if (!rows.length) return null;

        const latestRow = rows[0];
        const cells = Array.from(latestRow.querySelectorAll("td")).map((cell) => normalizeIncidentText(cell.textContent));
        const sentAt = cells[1] || "";
        const requestType = cells[2] || "";
        const statusText = cells[4] || "";
        if (!/^ошибка:/i.test(statusText)) return null;

        return {
            edocId: source.edocId || "",
            sourceUrl: source.href,
            sentAt,
            requestType,
            statusText
        };
    }

    function scanEpguIncidents() {
        const common = buildStageIncidentCommonData();
        const activeSourceKeys = new Set();
        const sources = getEpguDocumentSources();

        sources.forEach((source) => {
            activeSourceKeys.add(source.key);
            const latestError = extractLatestEpguError(source);
            if (!latestError) {
                epguIncidentSignatureBySource.delete(source.key);
                return;
            }

            const signature = [
                common.baseName,
                common.departmentName,
                common.userName,
                latestError.edocId,
                latestError.sentAt,
                latestError.statusText
            ].map(normalizeIncidentText).join(" | ");

            if (epguIncidentSignatureBySource.get(source.key) === signature) return;
            epguIncidentSignatureBySource.set(source.key, signature);

            reportStageIncident({
                incidentType: EPGU_INCIDENT_TYPE,
                baseName: common.baseName,
                departmentName: common.departmentName,
                userName: common.userName,
                stageName: common.stageName,
                pageUrl: latestError.sourceUrl,
                context: "ЕПГУ",
                summaryText: truncateIncidentText(latestError.statusText),
                fullText: latestError.statusText,
                signature: signature,
                edocId: latestError.edocId || "",
                debtId: "",
                epguSentAt: latestError.sentAt,
                epguRequestType: latestError.requestType
            });
        });

        Array.from(epguIncidentSignatureBySource.keys()).forEach((key) => {
            if (!activeSourceKeys.has(key)) {
                epguIncidentSignatureBySource.delete(key);
            }
        });
    }

    function performIncidentScan() {
        incidentScanTimeout = null;
        scanVisibleGridIncident();
        scanEpguIncidents();
    }

    function scheduleIncidentScan(delayMs = INCIDENT_SCAN_DEBOUNCE_MS) {
        if (incidentScanTimeout) {
            clearTimeout(incidentScanTimeout);
        }
        incidentScanTimeout = setTimeout(() => {
            performIncidentScan();
        }, Math.max(0, Number(delayMs) || 0));
    }

    timerToggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTimerUiVisibility(!isTimerUiVisible);
    }, { capture: true });

    timerAbortButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const mode = abortActiveStageLoadForDebug();
        if (mode === "jqxhr") {
            notifyGridAbortMessageRewrite("timer-debug-abort-jqxhr");
            console.info("[StageTimer] Debug abort: jqXhr aborted.");
        } else if (mode === "window-stop") {
            notifyGridAbortMessageRewrite("timer-debug-abort-window-stop");
            console.info("[StageTimer] Debug abort: fallback window.stop() applied.");
        } else {
            console.info("[StageTimer] Debug abort: active grid request not found.");
        }
    }, { capture: true });

    window.addEventListener(GRID_ABORT_REWRITE_EVENT, (event) => {
        const detail = event && event.detail ? event.detail : {};
        const message = detail && typeof detail.message === "string"
            ? detail.message
            : GRID_ABORT_REWRITE_TEXT;
        noteGridAbortSignal(message);
        scheduleGridAbortErrorMessageRewrite(message);
        scheduleIncidentScan(0);
    }, { capture: true });

    if (document.documentElement) {
        const incidentObserver = new MutationObserver(() => {
            scheduleIncidentScan();
        });
        incidentObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class", "aria-label", "src"]
        });
    }

    setInterval(() => {
        scheduleIncidentScan();
    }, INCIDENT_SCAN_INTERVAL_MS);

    scheduleIncidentScan(INCIDENT_SCAN_INTERVAL_MS);
    initRows10000Trace();

    window.addEventListener(SCREENSHOT_HIDE_EVENT, (event) => {
        if (event && event.detail && typeof event.detail.hidden === "boolean") {
            if (!event.detail.hidden && screenshotHideTimer) {
                clearTimeout(screenshotHideTimer);
                screenshotHideTimer = null;
            }
            syncScreenshotModeState();
            return;
        }
        syncScreenshotModeState();
    }, { capture: true });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        let shouldSyncControls = false;

        Object.keys(changes).forEach((storageKey) => {
            const definition = TIMER_UI_SETTING_DEF_BY_STORAGE_KEY[storageKey];
            if (!definition) return;

            const nextValue = typeof changes[storageKey].newValue === "boolean"
                ? changes[storageKey].newValue
                : TIMER_UI_SETTINGS_DEFAULTS[definition.key];

            if (definition.key === "stageTimer") {
                setTimerUiVisibility(nextValue, false);
                return;
            }

            timerUiElementSettings = {
                ...timerUiElementSettings,
                [definition.key]: nextValue
            };
            shouldSyncControls = true;
        });

        if (shouldSyncControls) {
            applyControlButtonsVisibility();
            syncTimerUiSettingsPanelState();
        }
    });

    loadTimerUiElementSettings();
    syncScreenshotModeState();
    initScreenshotAutohideMode();
    initExtensionUiSettingsHotkeys();
    initDepartmentConflictMonitor();
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

    function getActiveDepartmentState() {
        const activeLink = document.querySelector("a.department-switch.active, .department-switch.active");
        if (!(activeLink instanceof Element)) return null;

        let depid = String(
            activeLink.getAttribute("data-depid")
            || activeLink.getAttribute("depid")
            || ""
        ).trim();

        if (!depid) {
            try {
                const href = activeLink.getAttribute("href") || "";
                const match = new URL(href, window.location.origin).pathname.match(/\/login\/department\/(\d+)(?:\/|$)/i);
                depid = match ? match[1] : "";
            } catch (e) {
                depid = "";
            }
        }

        if (!depid) return null;
        const label = normalizeDepartmentName(activeLink.textContent || scrapeDepartmentName());
        const currentBase = getBaseDescriptor(window.location.hostname);
        let expectedBase = DEPARTMENT_BASE_BY_DEPID[depid] || null;
        if (!expectedBase) {
            try {
                const linkHost = new URL(activeLink.getAttribute("href") || "", window.location.origin).hostname;
                expectedBase = getBaseDescriptor(linkHost);
            } catch (e) {
                expectedBase = null;
            }
        }
        return {
            depid,
            label,
            host: window.location.hostname,
            pageUrl: window.location.href,
            currentBaseName: currentBase.name,
            expectedBaseName: expectedBase ? expectedBase.name : "",
            baseMismatch: !!(
                expectedBase
                && expectedBase.host
                && expectedBase.host !== currentBase.host
            )
        };
    }

    function reportActiveDepartmentState() {
        const state = getActiveDepartmentState();
        if (!state) return;
        try {
            chrome.runtime.sendMessage({
                action: "STAGE_TIMER_DEPARTMENT_STATE",
                data: state
            });
        } catch (e) {
            // ignore
        }
    }

    function updateDepartmentConflictAlert(data) {
        const rawEntries = data && Array.isArray(data.entries) ? data.entries : [];
        const unique = new Map();
        rawEntries.forEach((entry) => {
            const depid = String(entry && entry.depid || "").trim();
            if (!depid || unique.has(depid)) return;
            unique.set(depid, {
                depid,
                label: normalizeDepartmentName(entry && entry.label),
                host: String(entry && entry.host || "").trim()
            });
        });
        departmentConflictEntries = Array.from(unique.values());
        const currentState = getActiveDepartmentState();
        const messages = [];

        if (departmentConflictEntries.length > 1) {
            const shortList = departmentConflictEntries
                .map((entry) => `${entry.label} (${entry.depid})`)
                .join(" · ");
            messages.push(`Во вкладках браузера открыты разные департаменты: ${shortList}`);
        }

        if (currentState && currentState.baseMismatch) {
            messages.push(
                `В текущей вкладке открыта база «${currentState.currentBaseName}», `
                + `а департамент «${currentState.label} (${currentState.depid})» относится к базе «${currentState.expectedBaseName}»`
            );
        }

        hasDepartmentConflictAlert = messages.length > 0;
        if (hasDepartmentConflictAlert) {
            const message = messages.join(" • ");
            if (departmentConflictTextEl) departmentConflictTextEl.textContent = message;
            departmentConflictAlert.title = `${message}. Приведите департаменты и базы во вкладках в соответствие.`;
        } else {
            if (departmentConflictTextEl) departmentConflictTextEl.textContent = "";
            departmentConflictAlert.removeAttribute("title");
        }

        applyDepartmentConflictAlertVisibility();
        syncTimerHost(true);
    }

    function initDepartmentConflictMonitor() {
        reportActiveDepartmentState();
        window.setTimeout(reportActiveDepartmentState, 1000);
        window.setInterval(reportActiveDepartmentState, DEPARTMENT_STATE_HEARTBEAT_MS);
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target.closest(".department-switch") : null;
            if (target) window.setTimeout(reportActiveDepartmentState, 500);
        }, { capture: true });
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
            timerAbortButton.remove();
            departmentConflictAlert.remove();
            currentTimerHost.style.removeProperty("--pyramid-stage-timer-right-offset");
            currentTimerHost.style.removeProperty("--pyramid-stage-department-conflict-right-offset");
            currentTimerHost.style.removeProperty("--pyramid-stage-department-conflict-max-width");
            currentTimerHost.style.removeProperty("--pyramid-stage-toggle-right-offset");
            currentTimerHost.style.removeProperty("--pyramid-stage-abort-right-offset");
        }

        const closeButton = host.querySelector(".ui-jqgrid-titlebar-close, .ui-dialog-titlebar-close");
        syncToggleButtonLook(closeButton);
        syncAbortButtonLook(closeButton);

        if (timerAbortButton.parentElement !== host) {
            timerAbortButton.remove();
            if (closeButton && closeButton.parentElement === host) {
                host.insertBefore(timerAbortButton, closeButton);
            } else {
                host.appendChild(timerAbortButton);
            }
        }

        if (timerToggleButton.parentElement !== host) {
            timerToggleButton.remove();
            if (closeButton && closeButton.parentElement === host) {
                host.insertBefore(timerToggleButton, timerAbortButton);
            } else {
                host.appendChild(timerToggleButton);
            }
        }
        applyControlButtonsVisibility();

        const closeButtonWidth = closeButton && isElementVisible(closeButton)
            ? closeButton.getBoundingClientRect().width
            : 0;

        const abortButtonWidth = isElementVisible(timerAbortButton)
            ? timerAbortButton.getBoundingClientRect().width
            : 22;

        const toggleButtonWidth = isElementVisible(timerToggleButton)
            ? timerToggleButton.getBoundingClientRect().width
            : 24;

        const closeOffsetPx = Math.max(0, Math.ceil(closeButtonWidth));
        const abortOffsetPx = closeOffsetPx + 6;
        const toggleOffsetPx = abortOffsetPx + Math.ceil(abortButtonWidth) + 4;
        const timerRightOffsetPx = toggleOffsetPx + Math.ceil(toggleButtonWidth) + 8;

        host.style.setProperty("--pyramid-stage-abort-right-offset", `${abortOffsetPx}px`);
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

        if (departmentConflictAlert.parentElement !== host) {
            departmentConflictAlert.remove();
            host.insertBefore(departmentConflictAlert, toast);
        }

        applyDepartmentConflictAlertVisibility();
        const timerWidth = isElementVisible(toast) ? Math.ceil(toast.getBoundingClientRect().width) : 0;
        const conflictRightOffsetPx = timerRightOffsetPx + timerWidth + (timerWidth > 0 ? 6 : 0);
        host.style.setProperty(
            "--pyramid-stage-department-conflict-right-offset",
            `${conflictRightOffsetPx}px`
        );

        const gridTitle = host.querySelector(".ui-jqgrid-title");
        const fileExcelIcon = gridTitle && gridTitle.querySelector(
            ".fa-file-excel-o, .fa-file-excel, [class*='fa-file-excel']"
        );
        const fileExcelControlCandidate = fileExcelIcon
            ? (fileExcelIcon.closest("a, button") || fileExcelIcon)
            : null;
        const fileExcelControl = isElementVisible(fileExcelControlCandidate)
            ? fileExcelControlCandidate
            : null;
        const leftBoundary = fileExcelControl || gridTitle;
        const hostRect = host.getBoundingClientRect();
        const boundaryRect = leftBoundary && leftBoundary.getBoundingClientRect();
        const boundaryRightPx = boundaryRect ? boundaryRect.right : hostRect.left;
        const conflictRightPx = hostRect.right - conflictRightOffsetPx;
        const conflictMaxWidthPx = Math.max(0, Math.floor(conflictRightPx - boundaryRightPx - 8));
        host.style.setProperty(
            "--pyramid-stage-department-conflict-max-width",
            `${conflictMaxWidthPx}px`
        );

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
        departmentConflictAlert.remove();
        if (removeToggleButton) {
            timerToggleButton.remove();
            timerAbortButton.remove();
        }
        if (currentTimerHost) {
            currentTimerHost.classList.remove("pyramid-stage-timer-host");
            currentTimerHost.style.removeProperty("--pyramid-stage-timer-right-offset");
            currentTimerHost.style.removeProperty("--pyramid-stage-department-conflict-right-offset");
            currentTimerHost.style.removeProperty("--pyramid-stage-department-conflict-max-width");
            if (removeToggleButton) {
                currentTimerHost.style.removeProperty("--pyramid-stage-toggle-right-offset");
                currentTimerHost.style.removeProperty("--pyramid-stage-abort-right-offset");
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
        } else if (request.action === 'STAGE_TIMER_DEPARTMENT_CONFLICT') {
            updateDepartmentConflictAlert(request.data);
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
        scheduleIncidentScan(0);
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
        toast.title = "Таймер показывает время ожидания ответа на сетевой запрос.";
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
            toast.title = "Запрос успешно завершен.";
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

        const elapsedSec = Number.isFinite(data && data.duration)
            ? Math.max(0, data.duration / 1000)
            : getSafeElapsedSec();
        const networkError = String(data && data.error || "").trim();
        const normalizedError = networkError.toUpperCase();
        let label = "Ошибка сети";
        if (normalizedError.includes("INTERNET_DISCONNECTED") || navigator.onLine === false) {
            label = "Нет подключения";
        } else if (normalizedError.includes("TIMED_OUT") || normalizedError.includes("TIMEOUT")) {
            label = "Сервер не отвечает";
        } else if (normalizedError.includes("ABORTED")) {
            label = "Запрос прерван";
        }

        isTimerActive = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        lastTickWallClockMs = 0;
        lastStableElapsedSec = 0;
        hiddenSinceEpochMs = 0;
        setTimerLabel(label);
        setTimerValue(formatUiDuration(elapsedSec));
        setTimerState("error");
        toast.title = networkError
            ? `${label}: ${networkError}`
            : `${label}. Браузер завершил запрос с ошибкой.`;
        const gridMessage = label === "Нет подключения"
            ? "Интернет-соединение прервано. Восстановите связь и повторите загрузку/фильтрацию."
            : (label === "Сервер не отвечает"
                ? "Сервер не ответил вовремя. Повторите загрузку/фильтрацию."
                : `${label}. Повторите загрузку/фильтрацию.`);
        scheduleGridAbortErrorMessageRewrite(gridMessage);
        const sessionData = getResolvedSessionData(scrapeData());
        const status = normalizedError.includes("ABORTED") ? "ОТМЕНА" : "ОШИБКА СЕТИ";
        sendToBackground(status, elapsedSec.toFixed(2), sessionData, activeLoadType, activeRequestUrl);
        scheduleTimerHide(2000);
    }

    window.addEventListener("offline", () => {
        if (!isTimerActive) return;
        handleError({
            error: "net::ERR_INTERNET_DISCONNECTED",
            duration: Math.max(0, performance.now() - startTime)
        });
    }, { capture: true });

    window.addEventListener("resize", () => {
        syncTimerHost(true);
    }, { passive: true });

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
