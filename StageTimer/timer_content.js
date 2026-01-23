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
    let toastTimeout = null;
    let timerInterval = null;
    let heartbeatInterval = null;
    let startTime = 0;
    let toast = null;

    // --- UI ИНИЦИАЛИЗАЦИЯ ---
    function initUI() {
        if (toast) return; // Уже создан
        
        toast = document.createElement('div');
        toast.id = 'pyramid-stage-timer';
        toast.style.opacity = "0"; // Скрыт по умолчанию
        toast.innerHTML = `
            <div class="timer-spinner"></div>
            <span id="timer-type">Загрузка</span>
            <span id="timer-val" style="font-weight:bold; margin-left:5px;">0.00s</span>
        `;
        
        // Безопасное добавление в body
        if (document.body) {
            document.body.appendChild(toast);
        } else {
            // Если body еще нет (скрипт запущен в document_start), ждем
            document.addEventListener('DOMContentLoaded', () => {
                if (!document.getElementById('pyramid-stage-timer')) {
                    document.body.appendChild(toast);
                }
            });
        }
    }

    // Запускаем инициализацию UI при загрузке скрипта (попытка)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

    // --- ФУНКЦИЯ СБОРА ДАННЫХ (SCRAPE) ---
    function scrapeData() {
        let user = "Guest";
        let stage = document.title || "Unknown Stage";

        // Попытка найти имя пользователя (Generic)
        const userEl = document.querySelector('.user-name') || 
                       document.querySelector('#userName') || 
                       document.querySelector('.navbar-user') ||
                       document.querySelector('a[href*="/user/profile"]');
        if (userEl) user = userEl.innerText.trim();

        // Попытка найти заголовок страницы
        const headerEl = document.querySelector('h1') || document.querySelector('.page-header');
        if (headerEl) stage = headerEl.innerText.trim();

        return {
            userName: user,
            stageName: stage
        };
    }

    // Слушатель сообщений от Background (Network Events)
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
        // Убедимся, что UI существует
        if (!toast) initUI();
        if (!toast || !toast.parentNode) {
            // Если все еще нет (очень ранний старт), пробуем отложить
             if (document.body) {
                 if (!toast) initUI();
             } else {
                 // Критический случай: запрос пришел до body
                 console.warn("[StageTimer] Start request received before DOM ready");
                 return;
             }
        }

        // Сброс и показ UI
        sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        toast.style.opacity = "1";
        toast.style.borderColor = "#f1c40f"; 
        
        const typeSpan = toast.querySelector("#timer-type");
        if (typeSpan) typeSpan.innerText = data.loadType || "Загрузка";

        const valSpan = toast.querySelector("#timer-val");
        if (valSpan) valSpan.innerText = "0.00s";
        
        toast.classList.remove("finished");
        
        if (toastTimeout) clearTimeout(toastTimeout);
        if (timerInterval) clearInterval(timerInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        startTime = performance.now();
        
        // ОТПРАВКА СТАТУСА ОЖИДАНИЯ (первичная)
        const scraped = scrapeData();
        sendToBackground("ОЖИДАНИЕ", 0, scraped, data.loadType);

        // Запускаем тиканье таймера (UI)
        timerInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = ((now - startTime) / 1000).toFixed(2);
            if (valSpan) valSpan.innerText = elapsed + "s";
        }, 50);

        // ОТПРАВКА СТАТУСА ОЖИДАНИЯ (каждые 30 сек для мониторинга)
        heartbeatInterval = setInterval(() => {
            const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
            const currentScraped = scrapeData();
            sendToBackground("ОЖИДАНИЕ", elapsedSec, currentScraped, data.loadType);
        }, 30000);
    }

    function handleStop(data) {
        if (timerInterval) clearInterval(timerInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        
        if (!toast) return;

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
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        if (!toast) return;

        const valSpan = document.getElementById("timer-val");
        if (valSpan) valSpan.innerText = `Ошибка`;
        toast.style.borderColor = "#e74c3c";
        
        // Скрыть быстрее
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
            loadType: loadType, // Новое поле
            logLine: `[${timestamp}] [${status}] [${baseName}] [${data.userName}] ${data.stageName} — ${time}s (${loadType})`
        };

        try {
            chrome.runtime.sendMessage({
                action: "LOG_STAGE_TIME",
                data: payload
            });
        } catch (e) {
            console.error("[StageTimer] Ошибка отправки сообщения фоновому скрипту:", e);
        }
    }

})();