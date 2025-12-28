// StageTimer/timer_content.js

(function() {
    // 1. Определение базы
    const hostname = window.location.hostname;
    let baseName = "Основная";
    if (hostname.includes("kgn.pyramid")) baseName = "Курган";
    else if (hostname.includes("yuric.pyramid")) baseName = "ЮРИЦ";
    else if (hostname.startsWith("81.pyramid")) baseName = "ЧЭС";

    if (window.location.pathname.includes("/login")) return;

    // --- НОВОЕ: Генерируем ID сессии (чтобы обновлять одну и ту же строку в таблице) ---
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // 2. Инициализация переменных
    let isFinished = false;
    const startTime = performance.now();
    let timerInterval = null;
    let hasLoaderAppeared = false; 
    
    // Флаги для периодической отправки
    let hasSentInitialReport = false;
    let lastReportTime = 0;

    // 3. Создаем UI Таймера (Toast)
    const toast = document.createElement("div");
    toast.id = "pyramid-stage-timer";
    toast.innerHTML = `<div class="timer-spinner"></div><span id="timer-val">Ожидание...</span>`;
    
    function injectToast() {
        if (document.body) {
            document.body.appendChild(toast);
        } else {
            requestAnimationFrame(injectToast);
        }
    }
    injectToast();

    // Вспомогательная: Сбор данных
    function scrapeData() {
        let userName = "Не определен";
        const fioElem = document.querySelector(".fio"); 
        if (fioElem && fioElem.innerText.trim().length > 0) {
            userName = fioElem.innerText.trim();
        }

        let stageName = "Неизвестная стадия";
        const stageElem = document.querySelector(".ui-jqgrid-title");
        if (stageElem) {
            stageName = Array.from(stageElem.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .filter(text => text.length > 0)
                .join(" ");
            
            if (!stageName) {
                stageName = stageElem.innerText.split('\n')[0].trim();
            }
        } else {
            stageName = document.title.replace(" - Пирамида 2.0", "").trim();
        }
        return { userName, stageName };
    }

    // Вспомогательная: Валидация данных
    function isDataValid(data) {
        if (!data.userName || data.userName === "Не определен") return false;
        const s = data.stageName;
        if (!s || s === "ПК Пирамида" || s === "Пирамида 2.0" || s === "Неизвестная стадия") return false;
        return true;
    }

    // 4. Основной цикл проверки (каждые 100мс)
    timerInterval = setInterval(() => {
        if (isFinished) return;

        const now = performance.now();
        const elapsed = ((now - startTime) / 1000).toFixed(2);
        
        // Обновляем цифры на экране
        const valSpan = document.getElementById("timer-val");
        if (valSpan) valSpan.innerText = elapsed + "s";

        // --- ПРОВЕРКА ЛОАДЕРА ---
        const loader = document.getElementById("load_list");
        let isLoaderVisible = false;
        
        if (loader) {
            const style = window.getComputedStyle(loader);
            isLoaderVisible = (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
        }

        // Если лоадер виден прямо сейчас — запоминаем
        if (isLoaderVisible) {
            hasLoaderAppeared = true;
            toast.style.borderColor = "#f1c40f"; // Желтый (грузится)
        }

        const currentData = scrapeData();
        const dataReady = isDataValid(currentData);

        // --- ЛОГИКА ОТПРАВКИ ПРОМЕЖУТОЧНЫХ ОТЧЕТОВ ---
        
        // 1. Быстрая отправка "ОЖИДАНИЕ" (если прошло > 1 сек и данные валидны)
        if (!hasSentInitialReport && elapsed > 1.0 && dataReady) {
            sendToBackground("ОЖИДАНИЕ", elapsed, currentData);
            hasSentInitialReport = true;
            lastReportTime = parseFloat(elapsed);
        }

        // 2. Периодическое обновление каждые 30 сек
        if (hasSentInitialReport && (elapsed - lastReportTime) >= 30) {
            sendToBackground("ОЖИДАНИЕ", elapsed, currentData);
            lastReportTime = parseFloat(elapsed);
            // Если долго грузится - красим в оранжевый
            toast.style.borderColor = "#e67e22"; 
        }

        // --- УСЛОВИЯ ЗАВЕРШЕНИЯ (Твоя оригинальная логика) ---

        if (loader) {
            // Если элемент лоадера СУЩЕСТВУЕТ на странице
            // Завершаем ТОЛЬКО если он появлялся И теперь исчез И данные готовы
            if (hasLoaderAppeared && !isLoaderVisible && dataReady) {
                finishTiming("УСПЕШНО", elapsed, currentData);
            }
        } else {
            // Редкий случай: элемента #load_list вообще нет
            // Фолбек: если ничего нет 3 сек, то завершаем
            if (now > 3000 && dataReady) {
                finishTiming("УСПЕШНО", elapsed, currentData);
            }
        }

    }, 100);

    // 5. Обработка ухода со страницы (ПРЕРВАНО)
    window.addEventListener("beforeunload", () => {
        if (!isFinished) {
            const now = performance.now();
            const elapsed = ((now - startTime) / 1000).toFixed(2);
            
            // Отправляем ОТМЕНУ только если мы уже успели отправить "ОЖИДАНИЕ"
            // или если прошло достаточно времени (> 1.5 сек)
            if (hasSentInitialReport || elapsed > 1.5) {
                sendToBackground("ОТМЕНА", elapsed, scrapeData());
            }
        }
    });

    // 6. Функция финиша
    function finishTiming(status, finalTime, data) {
        if (isFinished) return; 
        isFinished = true;
        clearInterval(timerInterval);

        // Финальная отправка (обновит статус в таблице)
        sendToBackground(status, finalTime, data);

        // UI
        if (status === "УСПЕШНО") {
            toast.classList.add("finished");
            toast.style.borderColor = "#2ecc71"; // Зеленый
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = `Готово: ${finalTime}s`;
            
            // Скрываем тост через 4 секунды
            setTimeout(() => {
                toast.style.opacity = "0";
                setTimeout(() => toast.remove(), 1000);
            }, 4000);
        }
    }

    // Универсальная функция отправки
    function sendToBackground(status, time, data) {
        const timestamp = new Date().toLocaleString("ru-RU");
        
        const payload = {
            baseName: baseName,
            stageName: data.stageName,
            userName: data.userName,
            duration: time,
            timestamp: timestamp,
            status: status,
            sessionId: sessionId, // <-- Уникальный ID для связки
            logLine: `[${timestamp}] [${status}] [${data.userName}] ${data.stageName} — ${time}s`
        };

        // console.log(`[PyramidTimer] Sending ${status}:`, payload);

        try {
            chrome.runtime.sendMessage({
                action: "LOG_STAGE_TIME",
                data: payload
            });
        } catch (e) {
            // Игнор ошибок при закрытии вкладки
        }
    }
})();