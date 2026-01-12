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

    if (window.location.pathname.includes("/login")) return;

    let sessionId = null;
    let isTracking = false;      
    let isStopping = false; // <--- НОВЫЙ ФЛАГ: защита от повторного завершения
    let startTime = 0;           
    let timerInterval = null;
    let lastReportTime = 0;      
    let hasSentInitial = false;  

    // UI
    const toast = document.createElement("div");
    toast.id = "pyramid-stage-timer";
    toast.innerHTML = `<div class="timer-spinner"></div><span id="timer-val">0.00s</span>`;
    
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
            let text = Array.from(stageElem.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE)
                .map(n => n.textContent.trim())
                .join(" ");
            
            if (!text) text = stageElem.innerText.split('\n')[0].trim();
            if (text) stageName = text;
        } else {
            let title = document.title.replace(" - Пирамида 2.0", "").trim();
            if (title) stageName = title;
        }
        return { userName, stageName };
    }

    function isDataValid(data) {
        if (!data.userName || data.userName === "Не определен") return false;
        if (!data.stageName || data.stageName === "ПК Пирамида" || data.stageName === "Пирамида 2.0") return false;
        return true;
    }

    // === ГЛАВНЫЙ ЦИКЛ ПРОВЕРКИ (50мс) ===
    timerInterval = setInterval(() => {
        const loader = document.getElementById("load_list");
        let isVisible = false;

        if (loader) {
            const style = window.getComputedStyle(loader);
            // Строгая проверка видимости
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                isVisible = true;
            }
        }

        const now = performance.now();

        // 1. СТАРТ (Лоадер появился, мы еще не следим и не завершаем предыдущее)
        if (isVisible && !isTracking && !isStopping) {
            startTracking(now);
        }

        // 2. ПРОЦЕСС
        if (isTracking && isVisible) {
            updateTracking(now);
        }

        // 3. СТОП (Лоадер исчез, мы следили и еще не начали процесс остановки)
        if (!isVisible && isTracking && !isStopping) {
            // МГНОВЕННО ставим флаг остановки, чтобы следующий тик таймера сюда не зашел
            isStopping = true; 
            stopTracking(now);
        }

    }, 50);

    function startTracking(now) {
        isTracking = true;
        isStopping = false; // Сброс флага
        startTime = now;
        sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        hasSentInitial = false;
        lastReportTime = 0;

        toast.style.opacity = "1";
        toast.style.borderColor = "#f1c40f"; 
        toast.querySelector("#timer-val").innerText = "0.00s";
        toast.classList.remove("finished");
    }

    function updateTracking(now) {
        const elapsed = ((now - startTime) / 1000).toFixed(2);
        const valSpan = document.getElementById("timer-val");
        if (valSpan) valSpan.innerText = elapsed + "s";

        const currentData = scrapeData();
        const dataReady = isDataValid(currentData);

        // Быстрая фиксация "ОЖИДАНИЕ" (через 1 сек)
        if (!hasSentInitial && elapsed > 1.0 && dataReady) {
            sendToBackground("ОЖИДАНИЕ", elapsed, currentData);
            hasSentInitial = true;
            lastReportTime = parseFloat(elapsed);
        }

        // Периодическое обновление (каждые 30 сек)
        if (hasSentInitial && (elapsed - lastReportTime) >= 30) {
            sendToBackground("ОЖИДАНИЕ", elapsed, currentData);
            lastReportTime = parseFloat(elapsed);
            toast.style.borderColor = "#e67e22"; 
        }
    }

    function stopTracking(now) {
        // Мы уже выставили isStopping=true снаружи, поэтому этот код выполнится ровно 1 раз.
        
        // Ждем 200мс, чтобы DOM обновился (сменился заголовок)
        setTimeout(() => {
            const finalTime = ((now - startTime) / 1000).toFixed(2);
            const data = scrapeData();

            // ФИЛЬТР: Данные мусорные?
            if (!isDataValid(data)) {
                // Если мы уже "засветились" в таблице, надо закрыть сессию
                if (hasSentInitial) {
                    sendToBackground("ОТМЕНА", finalTime, data);
                }
                // Полный сброс
                isTracking = false;
                isStopping = false;
                resetUI();
                return;
            }

            // УСПЕХ - Отправляем ОДИН раз
            sendToBackground("УСПЕШНО", finalTime, data);
            
            // UI
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = `Готово: ${finalTime}s`;
            toast.classList.add("finished");
            toast.style.borderColor = "#2ecc71"; 

            // Сброс флагов
            isTracking = false;
            isStopping = false;

            // Прячем тост
            setTimeout(() => {
                // Проверяем, не началась ли уже новая загрузка
                if (!isTracking) toast.style.opacity = "0";
            }, 4000);

        }, 200);
    }

    function resetUI() {
        toast.style.opacity = "0";
        setTimeout(() => toast.classList.remove("finished"), 500);
    }

    window.addEventListener("beforeunload", () => {
        if (isTracking) {
            const now = performance.now();
            const elapsed = ((now - startTime) / 1000).toFixed(2);
            
            if (hasSentInitial || elapsed > 1.5) {
                const data = scrapeData();
                sendToBackground("ОТМЕНА", elapsed, data);
            }
        }
    });

    function sendToBackground(status, time, data) {
        const timestamp = new Date().toLocaleString("ru-RU");
        
        const payload = {
            baseName: baseName, 
            stageName: data.stageName,
            userName: data.userName,
            duration: time,
            timestamp: timestamp,
            status: status,
            sessionId: sessionId,
            logLine: `[${timestamp}] [${status}] [${baseName}] [${data.userName}] ${data.stageName} — ${time}s`
        };

        try {
            chrome.runtime.sendMessage({
                action: "LOG_STAGE_TIME",
                data: payload
            });
        } catch (e) {}
    }

})();