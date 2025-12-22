chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_check") {
        processFullCheck(request.data, sendResponse);
        return true; 
    }
    if (request.action === "start_batch_check") {
        processBatchCheck(request, sender.tab.id);
        return true;
    }
});

// ========= SINGLE CHECK LOGIC =========

async function processFullCheck(data, sendResponse) {
    try {
        const results = await getCheckResults(data);
        sendResponse({ success: true, ...results });
    } catch (err) {
        console.error("BG Error in processFullCheck:", err);
        sendResponse({ success: false, error: err.message });
    }
}

// ========= BATCH CHECK LOGIC =========

async function processBatchCheck(request, senderTabId) {
    const { ids, origin } = request;
    const allResults = [];

    for (const id of ids) {
        let personData;
        const url = `${origin}/ovzid/fullcard/${id}`;
        let tab; // Declare tab here to access it in finally block

        try {
            tab = await chrome.tabs.create({ url, active: false });
            
            // Inject a script to parse the person's data from the full card
            const scriptResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: getPersonDataFromCard,
            });

            personData = scriptResults && scriptResults[0] ? scriptResults[0].result : null;
            
            if (personData && personData.surname && personData.birthDate) {
                const checkResult = await getCheckResults(personData);
                allResults.push({ id, ...checkResult });
            } else {
                allResults.push({ id, error: 'Не удалось получить данные со страницы' });
            }

        } catch (e) {
            console.error(`Error processing ID ${id}:`, e);
            allResults.push({ id, error: e.message });
        } finally {
            if (tab) await chrome.tabs.remove(tab.id);
        }
    }

    // Send the compiled results back to the original tab
    chrome.tabs.sendMessage(senderTabId, {
        action: "batch_check_complete",
        results: allResults
    });
}


// ========= CORE CHECKING LOGIC =========

async function getCheckResults(data) {
    try {
        const existingInn = data.existingInn; 
        let foundInn = null;
        
        foundInn = await findInn(data);

        let foundDeath = null;
        let existingDeath = null;
        let probateCaseDeath = null;

        // Run checks in parallel to speed things up
        const promises = [];
        if (foundInn) {
            promises.push(checkDeathDate(foundInn).then(r => foundDeath = r));
        }
        if (existingInn && existingInn !== foundInn) {
            promises.push(checkDeathDate(existingInn).then(r => existingDeath = r));
        }
        // Always check probate cases
        promises.push(checkProbateCase(data).then(r => probateCaseDeath = r));

        await Promise.all(promises);
        
        if (existingInn && existingInn === foundInn) {
            existingDeath = foundDeath;
        }

        return { 
            surname: data.surname,
            name: data.name,
            foundInn,
            existingInn,
            foundDeath,
            existingDeath,
            probateCaseDeath
        };

    } catch (err) {
        console.error("BG Error in getCheckResults:", err);
        return { error: err.message };
    }
}


// --- УПРАВЛЕНИЕ ВКЛАДКАМИ (active: false) ---
async function findInn(personData) {
    if (!personData || !personData.surname || !personData.birthDate || !personData.docNumber) return null;
    const tab = await chrome.tabs.create({ url: "https://service.nalog.ru/inn.do", active: false });
    try {
        return await executeScriptInTab(tab.id, injectInnSearchLogic, [personData]);
    } finally {
        await chrome.tabs.remove(tab.id);
    }
}

async function checkDeathDate(inn) {
    if (!inn) return null;
    const tab = await chrome.tabs.create({ url: "https://service.nalog.ru/invalid-inn-fl.html", active: false });
    try {
        return await executeScriptInTab(tab.id, injectDeathCheckLogic, [inn]);
    } finally {
        await chrome.tabs.remove(tab.id);
    }
}

async function checkProbateCase(personData) {
    if (!personData || !personData.surname || !personData.birthDate) return null;
    const tab = await chrome.tabs.create({ url: "https://notariat.ru/ru-ru/help/probate-cases/", active: false });
    try {
        return await executeScriptInTab(tab.id, injectProbateCaseLogic, [personData]);
    } finally {
        await chrome.tabs.remove(tab.id);
    }
}

function executeScriptInTab(tabId, func, args) {
    return new Promise((resolve, reject) => {
        let fulfilled = false;
        const listener = (tid, changeInfo, tab) => {
            if (tid === tabId && changeInfo.status === 'complete' && tab.url.startsWith('http')) {
                if (fulfilled) return;
                fulfilled = true;

                chrome.tabs.onUpdated.removeListener(listener);
                
                setTimeout(() => chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: func,
                    args: args
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(results && results[0] ? results[0].result : null);
                    }
                }), 500); // Small delay to ensure scripts on page have run
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Timeout to prevent hanging
        setTimeout(() => {
            if (!fulfilled) {
                fulfilled = true;
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error(`Tab ${tabId} timed out`));
            }
        }, 30000); // 30 second timeout
    });
}


// ========= INJECTABLE SCRIPT LOGIC =========

// === СКРИПТ: ПОЛУЧЕНИЕ ДАННЫХ С КАРТОЧКИ ===
function getPersonDataFromCard() {
    const headerNode = Array.from(document.querySelectorAll('h4')).find(h => h.innerText.includes('Реквизиты ИД'));
    if (!headerNode) return null;
    
    try {
        let container = headerNode.nextElementSibling;
        let table = null;
        for(let i=0; i<3; i++) {
            if(!container) break;
            table = container.querySelector ? container.querySelector('table') : null;
            if(table) break;
            if(container.tagName === 'TABLE') { table = container; break; }
            container = container.nextElementSibling;
        }

        if (!table) return null;
        const tr = table.querySelector('tbody tr');
        if (!tr) return null;
        const tds = tr.querySelectorAll(':scope > td');
        const fio = tds[0].innerText.trim();
        const fioParts = fio.split(/\s+/);
        let bdate = '', passport = '', inn = '';
        
        const allInnerRows = tr.querySelectorAll('table tr');
        allInnerRows.forEach(r => {
            const txt = r.innerText.toLowerCase();
            const cells = r.querySelectorAll('td');
            const val = cells[1] ? cells[1].innerText.trim() : '';
            if (txt.includes('др должника')) bdate = val;
            if (txt.includes('серия документа')) passport += val + ' ';
            if (txt.includes('номер документа')) passport += val;
            if (txt.includes('инн') && /^\d+$/.test(val)) inn = val;
        });

        return {
            surname: fioParts[0],
            name: fioParts[1],
            patronymic: fioParts.slice(2).join(' '),
            birthDate: bdate,
            docNumber: passport.trim(),
            existingInn: inn
        };
    } catch (e) { return null; }
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

            // Улучшенная проверка "не найдено"
            const paneHeaders = document.querySelectorAll('.pane-header');
            for (const header of paneHeaders) {
                if (header.innerText.includes('Информация об ИНН не найдена')) {
                    return null; // Явное сообщение "не найдено"
                }
            }
            
            const noDataEl = document.querySelector('.msg-no-data');
            if (noDataEl && noDataEl.offsetParent !== null) return null;

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

// === СКРИПТ: ПРОВЕРКА РЕЕСТРА НАСЛЕДСТВЕННЫХ ДЕЛ ===
async function injectProbateCaseLogic(data) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitReady = async () => {
        for (let i=0; i<80; i++) { 
            if (document.readyState === 'complete') return true;
            await sleep(200);
        }
        return false;
    };

    try {
        await waitReady();
        
        const fullName = `${data.surname} ${data.name} ${data.patronymic}`.trim();
        const [day, month, year] = data.birthDate.split('.');

        const fill = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        
        const select = (sel, val) => {
             const el = document.querySelector(sel);
             if (el) {
                el.value = val;
                el.dispatchEvent(new Event('change', { bubbles: true }));
             }
        }

        fill('input[name="name"]', fullName);
        select('select[name="b-day"]', day);
        select('select[name="b-month"]', month);
        fill('input[name="b-year"]', year);
        
        await sleep(500);

        const btn = document.querySelector('.js-probate-cases__submit');
        if (btn) {
            btn.click();
        }

        for (let i = 0; i < 50; i++) {
            await sleep(300);
            const resultBlock = document.querySelector('.probate-cases__result');
            if (resultBlock && resultBlock.style.display !== 'none') {
                const header = resultBlock.querySelector('.probate-cases__result-header');
                if (header && header.innerHTML.includes('<b>0</b>')) {
                    return null; // Явное сообщение "0 дел найдено"
                }
                if (resultBlock.innerText.includes('К сожалению, по вашему запросу ничего не найдено')) {
                    return null;
                }
                
                const resultItem = resultBlock.querySelector('.probate-cases__result-item');
                if (resultItem) {
                    const text = resultItem.innerText;
                    const match = text.match(/Дата смерти: (\d{2}\.\d{2}\.\d{4})/);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
            }
            if (document.body.innerText.includes('К сожалению, по вашему запросу ничего не найдено')) {
                return null;
            }
        }
        return null;

    } catch (e) {
        console.error('Probate case script error:', e);
        return null;
    }
}