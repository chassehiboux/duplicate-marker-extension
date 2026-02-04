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

    // UI
    const toast = document.createElement("div");
    toast.id = "pyramid-stage-timer";
    toast.innerHTML = `<div class="timer-spinner"></div><span id="timer-type" style="margin-right:8px; font-weight:normal; font-size: 13px; opacity: 0.9;"></span><span id="timer-val">0.00s</span>`;
    
    function injectToast() {
        if (document.body) document.body.appendChild(toast);
        else requestAnimationFrame(injectToast);
    }
    injectToast();

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

        return { userName, stageName };
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
        if (timerInterval) clearInterval(timerInterval);

        startTime = performance.now();
        
        let lastReportTime = 0;
        let hasSentInitial = false;

        // Запускаем тиканье таймера
        timerInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = parseFloat(((now - startTime) / 1000).toFixed(2));
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = elapsed + "s";

            // 1. Попытка отправить "ОЖИДАНИЕ" через 1 сек
            if (!hasSentInitial && elapsed > 1.0) {
                const currentData = scrapeData();
                if (currentData.userName !== "Не определен" && currentData.stageName !== "ПК Пирамида") {
                    sendToBackground("ОЖИДАНИЕ", elapsed.toString(), currentData, data.loadType);
                    hasSentInitial = true;
                    lastReportTime = elapsed;
                }
            }

            // 2. Периодический "ПУЛЬС" каждые 30 секунд
            if (hasSentInitial && (elapsed - lastReportTime) >= 30) {
                const currentData = scrapeData();
                sendToBackground("ОЖИДАНИЕ", elapsed.toString(), currentData, data.loadType);
                lastReportTime = elapsed;
                toast.style.borderColor = "#e67e22"; 
            }

        }, 50); 
    }

    function handleStop(data) {
        // --- ЗАЩИТА ОТ ДУБЛЕЙ И "ПРИЗРАЧНЫХ" ЗАПРОСОВ ---
        // Если сетевой запрос длился дольше, чем работает наш таймер (+ зазор 5с),
        // значит это хвост от предыдущей активности. Игнорируем.
        const localElapsedMs = performance.now() - startTime;
        if (data.duration > (localElapsedMs + 5000)) {
            // console.warn(`[StageTimer] Ignored stale request. Network: ${data.duration}, Local: ${localElapsedMs}`);
            return;
        }

        if (timerInterval) clearInterval(timerInterval);

        if (!sessionId) {
            sessionId = "rec" + Date.now().toString(36);
        }

        setTimeout(() => {
            const scraped = scrapeData();
            const durationSec = (data.duration / 1000).toFixed(2);
            
            // UI Update
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = `Готово: ${durationSec}s`;
            toast.classList.add("finished");
            toast.style.borderColor = "#2ecc71"; 

            // Отправка лога
            sendToBackground("УСПЕШНО", durationSec, scraped, data.loadType);

            // Скрыть через 4 сек
            toastTimeout = setTimeout(() => {
                toast.style.opacity = "0";
            }, 4000);

        }, 100); 
    }

    function handleError(data) {
        if (timerInterval) clearInterval(timerInterval);
        const valSpan = document.getElementById("timer-val");
        if (valSpan) valSpan.innerText = `Ошибка`;
        toast.style.borderColor = "#e74c3c";
        toastTimeout = setTimeout(() => {
            toast.style.opacity = "0";
        }, 2000);
    }

    function sendToBackground(status, time, data, loadType) {
        const timestamp = new Date().toLocaleString("ru-RU");
        
        const payload = {
            baseName: baseName, 
            stageName: data.stageName,
            userName: data.userName,
            duration: time,
            timestamp: timestamp,
            status: status,
            sessionId: sessionId,
            loadType: loadType,
            version: extVersion, // <-- Передаем версию
            logLine: `[${timestamp}] [${status}] [${baseName}] [${data.userName}] ${data.stageName} — ${time}s (${loadType})`
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