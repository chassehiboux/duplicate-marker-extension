// StageTimer/timer_content.js

(function() {
    // 1. Определение базы
    const hostname = window.location.hostname;
    let baseName = "Основная";
    if (hostname.includes("kgn.pyramid")) baseName = "Курган";
    else if (hostname.includes("yuric.pyramid")) baseName = "ЮРИЦ";
    else if (hostname.startsWith("81.pyramid")) baseName = "ЧЭС";

    if (window.location.pathname.includes("/login")) return;

    // 2. Инициализация
    let isFinished = false;
    const startTime = performance.now();
    let timerInterval = null;
    let hasLoaderAppeared = false; 

    // 3. UI (Тост)
    const toast = document.createElement("div");
    toast.id = "pyramid-stage-timer";
    toast.innerHTML = `<div class="timer-spinner"></div><span id="timer-val">Ожидание...</span>`;
    
    function injectToast() {
        if (document.body) document.body.appendChild(toast);
        else requestAnimationFrame(injectToast);
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
            if (!stageName) stageName = stageElem.innerText.split('\n')[0].trim();
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

    // 4. Основной цикл (100ms)
    timerInterval = setInterval(() => {
        if (isFinished) return;

        const now = performance.now();
        const elapsed = ((now - startTime) / 1000).toFixed(2);
        
        const valSpan = document.getElementById("timer-val");
        if (valSpan) valSpan.innerText = elapsed + "s";

        // --- ПРОВЕРКА ЛОАДЕРА ---
        const loader = document.getElementById("load_list");
        let isLoaderVisible = false;
        
        if (loader) {
            // Проверяем честно через ComputedStyle
            const style = window.getComputedStyle(loader);
            isLoaderVisible = (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
        }

        // Если лоадер виден прямо сейчас — запоминаем
        if (isLoaderVisible) {
            hasLoaderAppeared = true;
            toast.style.borderColor = "#f1c40f"; // Желтый (грузится)
        }

        // Собираем данные
        const currentData = scrapeData();
        const dataReady = isDataValid(currentData);

        // --- УСЛОВИЯ ЗАВЕРШЕНИЯ ---

        if (loader) {
            // Если элемент лоадера СУЩЕСТВУЕТ на странице (обычный случай для Пирамиды):
            
            // Завершаем ТОЛЬКО если он появлялся И теперь исчез
            if (hasLoaderAppeared && !isLoaderVisible) {
                // И ждем, пока подтянутся данные (ФИО/Заголовок)
                if (dataReady) {
                    finishTiming("SUCCESS", elapsed, currentData);
                }
                // Если лоадер исчез, но данные еще "Не определен", мы продолжаем ждать (цикл крутится)
            }
            // ВАЖНО: Мы НЕ используем тайм-аут, пока элемент существует. 
            // Будем ждать "Загрузка..." хоть 100 секунд, пока он не появится и не исчезнет.
        } else {
            // Редкий случай: элемента #load_list вообще нет в HTML (другая страница?)
            // Тут оставляем старый фолбек: если ничего нет 3 сек, то завершаем.
            if (now > 3000 && dataReady) {
                finishTiming("SUCCESS", elapsed, currentData);
            }
        }

    }, 100);

    // 5. Обработка ухода со страницы (ПРЕРВАНО)
    window.addEventListener("beforeunload", () => {
        if (!isFinished) {
            const now = performance.now();
            const elapsed = ((now - startTime) / 1000).toFixed(2);
            const currentData = scrapeData();
            
            // Отправляем синхронно или "на прощание"
            finishTiming("CANCELED", elapsed, currentData);
        }
    });

    // 6. Функция финиша
    function finishTiming(status, finalTime, data) {
        if (isFinished) return; // Чтобы не сработать дважды (таймер + unload)
        isFinished = true;
        clearInterval(timerInterval);

        // UI (только если мы остались на странице)
        if (status === "SUCCESS") {
            toast.classList.add("finished");
            toast.style.borderColor = "#2ecc71"; // Зеленый
            const valSpan = document.getElementById("timer-val");
            if (valSpan) valSpan.innerText = `Готово: ${finalTime}s`;
        } else {
            // Если canceled, тост скорее всего исчезнет вместе со страницей, но на всякий случай
            toast.style.borderColor = "#e74c3c"; // Красный
        }

        const timestamp = new Date().toLocaleString("ru-RU");
        const statusText = status === "SUCCESS" ? "УСПЕШНО" : "ПРЕРВАНО";
        
        // Формируем сообщение
        const payload = {
            baseName: baseName,
            stageName: data.stageName,
            userName: data.userName,
            duration: finalTime,
            timestamp: timestamp,
            status: statusText, // <-- Новый параметр
            logLine: `[${timestamp}] [${statusText}] [${data.userName}] ${data.stageName} — ${finalTime}s`
        };

        console.log(`[PyramidTimer] Завершено (${status}):`, payload);

        // Отправка
        try {
            chrome.runtime.sendMessage({
                action: "LOG_STAGE_TIME",
                data: payload
            });
        } catch (e) {
            // Игнорируем ошибки extension context invalidated при закрытии вкладки
        }

        // Скрываем тост
        if (status === "SUCCESS") {
            setTimeout(() => {
                toast.style.opacity = "0";
                setTimeout(() => toast.remove(), 1000);
            }, 4000);
        }
    }
})();