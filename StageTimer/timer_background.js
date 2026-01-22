// StageTimer/timer_background.js
// Этот скрипт обрабатывает только логику отправки данных для StageTimer.

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


// --- Основной обработчик сообщений ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'LOG_STAGE_TIME') {
        const d = request.data;
        
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
            sessionId: d.sessionId
        };

        // Запускаем отправку (не ждем завершения, так как это fire-and-forget)
        sendWithRetry(GOOGLE_SCRIPT_URL, payload);

        return true; 
    }
    return false;
});

console.log("Фоновый скрипт StageTimer (v2 POST) запущен.");