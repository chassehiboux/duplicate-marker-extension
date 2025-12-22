chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_check") {
        processFullCheck(request.data, sendResponse);
        return true; 
    }
});

async function processFullCheck(data, sendResponse) {
    try {
        const existingInn = data.existingInn; 
        let foundInn = null;
        
        // 1. Поиск ИНН (Фоновый режим)
        foundInn = await findInn(data);

        let foundDeath = null;
        let existingDeath = null;

        // 2. Проверка смерти (по найденному)
        if (foundInn) {
            foundDeath = await checkDeathDate(foundInn);
        }

        // 3. Проверка смерти (по существующему), если отличается
        if (existingInn && existingInn !== foundInn) {
            existingDeath = await checkDeathDate(existingInn);
        } else if (existingInn && existingInn === foundInn) {
            existingDeath = foundDeath;
        }

        sendResponse({ 
            success: true, 
            foundInn: foundInn,
            existingInn: existingInn,
            foundDeath: foundDeath,
            existingDeath: existingDeath
        });

    } catch (err) {
        console.error("BG Error:", err);
        sendResponse({ success: false, error: err.message });
    }
}

// --- УПРАВЛЕНИЕ ВКЛАДКАМИ (active: false) ---
async function findInn(personData) {
    const tab = await chrome.tabs.create({ url: "https://service.nalog.ru/inn.do", active: false });
    const result = await executeScriptInTab(tab.id, injectInnSearchLogic, [personData]);
    chrome.tabs.remove(tab.id);
    return result;
}

async function checkDeathDate(inn) {
    const tab = await chrome.tabs.create({ url: "https://service.nalog.ru/invalid-inn-fl.html", active: false });
    const result = await executeScriptInTab(tab.id, injectDeathCheckLogic, [inn]);
    chrome.tabs.remove(tab.id);
    return result;
}

function executeScriptInTab(tabId, func, args) {
    return new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tid, changeInfo) {
            if (tid === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: func,
                    args: args
                }, (results) => {
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(results && results[0] ? results[0].result : null);
                });
            }
        });
    });
}

// === СКРИПТ: ПОИСК ИНН ===
async function injectInnSearchLogic(data) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitLoader = async () => {
        for (let i=0; i<80; i++) { // Увеличенный таймаут для фона
            if (!document.querySelector('#uniPreloader') && 
                !document.querySelector('.loading') && 
                document.readyState === 'complete') return true;
            await sleep(200);
        }
        return false;
    };

    try {
        await waitLoader();
        const chk = document.querySelector('a.checkbox') || document.querySelector('#unichk_0');
        if (chk && !chk.classList.contains('checkbox-on')) { chk.click(); await sleep(300); }
        
        const btnNext = document.querySelector('#btnContinue');
        if (btnNext) { btnNext.click(); await sleep(500); await waitLoader(); await sleep(500); }

        if (!document.querySelector('#fam')) return null;

        const fill = (sel, val) => {
            const el = document.querySelector(sel);
            if(el) {
                el.value = val;
                el.dispatchEvent(new Event('input', {bubbles:true}));
                el.dispatchEvent(new Event('change', {bubbles:true}));
            }
        };

        fill('#fam', data.surname);
        fill('#nam', data.name);
        if (data.patronymic) fill('#otch', data.patronymic);
        else { const o = document.querySelector('#opt_otch'); if(o) o.click(); }

        fill('#bdate', data.birthDate);
        fill('#docno', data.docNumber);

        await sleep(500);
        const btnSend = document.querySelector('#btn_send');
        if (btnSend) { btnSend.click(); await sleep(1000); }

        for (let i = 0; i < 50; i++) { 
            await waitLoader();
            const resEl = document.querySelector('#resultInn');
            if (resEl && resEl.innerText.trim()) return resEl.innerText.trim();

            const noDataEl = document.querySelector('.msg-no-data');
            if (noDataEl && noDataEl.offsetParent !== null) return null;

            const pnlHeader = document.querySelector('.pane-header');
            if (pnlHeader && pnlHeader.innerText.includes('Результаты поиска') && !resEl) {
                 if (document.body.innerText.includes('не найдена')) return null;
            }
            await sleep(300);
        }
        return null;
    } catch (e) { return null; }
}

// === СКРИПТ: ПРОВЕРКА СМЕРТИ (С новой проверкой msg-no-data) ===
async function injectDeathCheckLogic(inn) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    
    const forceInput = async (selector, value) => {
        const el = document.querySelector(selector);
        if(!el) return;
        el.value = ''; await sleep(50);
        el.value = value + ' '; 
        el.dispatchEvent(new Event('input', {bubbles:true}));
        await sleep(150);
        el.value = value;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        await sleep(150);
    };

    try {
        await forceInput('#inn', inn);
        
        const btn = document.querySelector('button.btn-search');
        if (btn && btn.disabled) {
            await sleep(500);
            await forceInput('#inn', inn);
        }

        if (btn && !btn.disabled) btn.click();
        else { const f = document.querySelector('form'); if(f) f.submit(); }

        for (let i=0; i<30; i++) {
            await sleep(500);
            
            // 1. Успех: Найдена дата
            const txtDate = document.querySelector('#txtDate');
            if (txtDate && txtDate.innerText.trim().length > 5) return txtDate.innerText.trim();
            const cells = document.querySelectorAll('#pnlResult td');
            for (let c of cells) { if (c.innerText.match(/^\d{2}\.\d{2}\.\d{4}$/)) return c.innerText; }

            // 2. Статус: Действителен (значит жив)
            if (document.body.innerText.includes('является действительным')) return null; 

            // 3. Статус: Информация не найдена (Новое требование)
            const noResPanel = document.querySelector('#pnlNoResult');
            // Проверяем, виден ли он (style.display != none) или есть ли класс msg-no-data
            if ((noResPanel && noResPanel.style.display !== 'none') || document.querySelector('.msg-no-data')) {
                return null; // Информация не найдена = смерти нет в базе
            }
            
            // Закрываем диалоги если мешают
            const dBtn = document.querySelector('div[role="dialog"] button'); if(dBtn) dBtn.click();
        }
        return null;
    } catch (e) { return null; }
}