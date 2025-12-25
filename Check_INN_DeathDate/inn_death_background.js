let isBatchCheckCancelled = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_check") {
        processFullCheck(request.data, sendResponse);
        return true; 
    }
    if (request.action === "start_batch_check") {
        processBatchCheck(request, sender.tab.id);
        return true;
    }
    if (request.action === "cancel_batch_check") {
        isBatchCheckCancelled = true;
        console.log("Batch check cancellation received.");
        return true;
    }
});

// ========= SINGLE CHECK =========
async function processFullCheck(data, sendResponse) {
    try {
        const results = await getCheckResults(data);
        sendResponse({ success: true, ...results });
    } catch (err) {
        console.error("BG Error in processFullCheck:", err);
        sendResponse({ success: false, error: err.message });
    }
}

// ========= BATCH CHECK =========
async function processBatchCheck(request, senderTabId) {
    isBatchCheckCancelled = false; // Reset flag on new batch start
    const { ids, origin } = request;
    const total = ids.length;

    chrome.tabs.sendMessage(senderTabId, { action: "batch_progress", current: 0, total: total });

    for (let i = 0; i < total; i++) {
        if (isBatchCheckCancelled) {
            console.log("Batch check cancelled by user.");
            break; // Exit the loop if cancelled
        }

        const id = ids[i];
        chrome.tabs.sendMessage(senderTabId, { action: "batch_progress", current: i + 1, total: total });

        let personData;
        const url = `${origin}/ovzid/fullcard/${id}`;
        let tab;

        try {
            tab = await chrome.tabs.create({ url, active: false });
            
            const scriptResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: getPersonDataFromCard,
            });

            personData = scriptResults && scriptResults[0] ? scriptResults[0].result : null;
            
            let resultPayload;
            if (personData && personData.surname && personData.birthDate) {
                // Параллельная проверка
                const checkResult = await getCheckResults(personData);
                resultPayload = { id, ...checkResult };
            } else {
                resultPayload = { id, error: 'Не удалось получить данные со страницы' };
            }
            
            // Check again in case cancellation happened during the async check
            if (isBatchCheckCancelled) break;

            chrome.tabs.sendMessage(senderTabId, { 
                action: "batch_item_result", 
                result: resultPayload 
            });

        } catch (e) {
            console.error(`Error processing ID ${id}:`, e);
            if (isBatchCheckCancelled) break;
            chrome.tabs.sendMessage(senderTabId, { 
                action: "batch_item_result", 
                result: { id, error: e.message } 
            });
        } finally {
            if (tab) await chrome.tabs.remove(tab.id);
        }
    }

    chrome.tabs.sendMessage(senderTabId, { action: "batch_complete" });
}

// ========= PARALLEL CHECKING LOGIC =========
async function getCheckResults(data) {
    try {
        const existingInn = data.existingInn; 
        
        // 1. Запускаем поиск ИНН и проверку Наследства параллельно
        // Используем Promise.allSettled, чтобы ошибка в одном не убивала остальные
        const [pFindInn, pProbate, pExistDeath] = await Promise.allSettled([
            findInn(data),
            checkProbateCase(data),
            existingInn ? checkDeathDate(existingInn) : Promise.resolve(null)
        ]);

        const foundInn = pFindInn.status === 'fulfilled' ? pFindInn.value : null;
        const probateCaseDeath = pProbate.status === 'fulfilled' ? pProbate.value : null;
        const existingDeath = pExistDeath.status === 'fulfilled' ? pExistDeath.value : null;

        let foundDeath = null;

        // 2. Если нашли новый ИНН, проверяем его статус
        if (foundInn) {
            if (foundInn === existingInn) {
                foundDeath = existingDeath;
            } else {
                foundDeath = await checkDeathDate(foundInn);
            }
        }

        return { 
            surname: data.surname,
            name: data.name,
            patronymic: data.patronymic,
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

// --- TAB HELPERS ---
async function findInn(personData) {
    if (!personData || !personData.surname || !personData.birthDate || !personData.docNumber) return null;
    const tab = await chrome.tabs.create({ url: "https://service.nalog.ru/inn.do", active: false });
    try {
        return await executeScriptInTab(tab.id, injectInnSearchLogic, [personData]);
    } catch(e) { return null; } finally { await chrome.tabs.remove(tab.id); }
}

async function checkDeathDate(inn) {
    if (!inn) return null;
    const tab = await chrome.tabs.create({ url: "https://service.nalog.ru/invalid-inn-fl.html", active: false });
    try {
        return await executeScriptInTab(tab.id, injectDeathCheckLogic, [inn]);
    } catch(e) { return null; } finally { await chrome.tabs.remove(tab.id); }
}

async function checkProbateCase(personData) {
    if (!personData || !personData.surname || !personData.birthDate) return null;
    const tab = await chrome.tabs.create({ url: "https://notariat.ru/ru-ru/help/probate-cases/", active: false });
    try {
        return await executeScriptInTab(tab.id, injectProbateCaseLogic, [personData]);
    } catch(e) { return null; } finally { await chrome.tabs.remove(tab.id); }
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
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(results && results[0] ? results[0].result : null);
                }), 500); 
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => {
            if (!fulfilled) {
                fulfilled = true;
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error(`Tab ${tabId} timed out`));
            }
        }, 60000); // 1 мин таймаут на случай медленного интернета
    });
}

// --- INJECTED SCRIPTS ---

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

// УЛУЧШЕННЫЙ ПОИСК ИНН
async function injectInnSearchLogic(data) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitLoader = async () => {
        // Увеличенные паузы для фоновой вкладки
        for (let i=0; i<60; i++) { 
            if (!document.querySelector('#uniPreloader') && 
                !document.querySelector('.loading') && 
                document.readyState === 'complete') return true;
            await sleep(400);
        }
        return false;
    };
    try {
        await waitLoader();
        const chk = document.querySelector('a.checkbox') || document.querySelector('#unichk_0');
        if (chk && !chk.classList.contains('checkbox-on')) { chk.click(); await sleep(400); }
        const btnNext = document.querySelector('#btnContinue');
        if (btnNext) { btnNext.click(); await sleep(800); await waitLoader(); await sleep(500); }
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

        await sleep(600);
        const btnSend = document.querySelector('#btn_send');
        if (btnSend) { btnSend.click(); await sleep(1500); }

        // Долгое ожидание результатов
        for (let i = 0; i < 40; i++) { 
            await waitLoader();
            
            // 1. Поиск по ID (стандарт)
            const resEl = document.querySelector('#resultInn');
            if (resEl && resEl.innerText.trim()) return resEl.innerText.trim();

            // 2. Поиск по тексту (если ID нет или верстка сменилась)
            const content = document.body.innerText;
            if (content.includes('ИНН:')) {
                // Ищем 10-12 цифр подряд
                const match = content.match(/ИНН:?\s*(\d{10,12})/);
                if (match && match[1]) return match[1];
            }
            
            // 3. Проверка на "не найдено"
            if (content.includes('Информация об ИНН не найдена')) return null;

            await sleep(500);
        }
        return null;
    } catch (e) { return null; }
}

// УЛУЧШЕННАЯ ПРОВЕРКА СМЕРТИ
async function injectDeathCheckLogic(inn) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const forceInput = async (selector, value) => {
        const el = document.querySelector(selector);
        if(!el) return;
        el.value = ''; await sleep(100);
        el.value = value;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        await sleep(200);
    };
    try {
        await forceInput('#inn', inn);
        const btn = document.querySelector('button.btn-search');
        if (btn && btn.disabled) {
            await sleep(600);
            await forceInput('#inn', inn);
        }
        if (btn && !btn.disabled) btn.click();
        else { const f = document.querySelector('form'); if(f) f.submit(); }

        await sleep(1500); // Даем больше времени на отработку в фоне

        for (let i=0; i<40; i++) {
            await sleep(600);
            
            // 1. Стандартный ID
            const txtDate = document.querySelector('#txtDate');
            if (txtDate && txtDate.innerText.trim().length > 5) return txtDate.innerText.trim();
            
            // 2. Поиск любой даты в таблице результатов
            const cells = document.querySelectorAll('#pnlResult td');
            for (let c of cells) { if (c.innerText.match(/^\d{2}\.\d{2}\.\d{4}$/)) return c.innerText; }
            
            // 3. Поиск по тексту "Дата смерти" или "Дата признания недействительным"
            const bodyText = document.body.innerText;
            const dateMatch = bodyText.match(/(?:Дата смерти|Дата признания недействительным).*?(\d{2}\.\d{2}\.\d{4})/);
            if (dateMatch && dateMatch[1]) return dateMatch[1];

            // 4. Отрицательный результат
            if (bodyText.includes('является действительным')) return null; 
            
            const noResPanel = document.querySelector('#pnlNoResult');
            if ((noResPanel && noResPanel.style.display !== 'none') || document.querySelector('.msg-no-data')) {
                return null;
            }
            
            const dBtn = document.querySelector('div[role="dialog"] button'); if(dBtn) dBtn.click();
        }
        return null;
    } catch (e) { return null; }
}

async function injectProbateCaseLogic(data) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitReady = async () => {
        for (let i=0; i<60; i++) { 
            if (document.readyState === 'complete') return true;
            await sleep(300);
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
        await sleep(600);
        const btn = document.querySelector('.js-probate-cases__submit');
        if (btn) btn.click();
        for (let i = 0; i < 50; i++) {
            await sleep(400);
            const resultBlock = document.querySelector('.probate-cases__result');
            if (resultBlock && resultBlock.style.display !== 'none') {
                const header = resultBlock.querySelector('.probate-cases__result-header');
                if (header && header.innerHTML.includes('<b>0</b>')) return null;
                if (resultBlock.innerText.includes('К сожалению, по вашему запросу ничего не найдено')) return null;
                const resultItem = resultBlock.querySelector('.probate-cases__result-item');
                if (resultItem) {
                    const text = resultItem.innerText;
                    const match = text.match(/Дата смерти: (\d{2}\.\d{2}\.\d{4})/);
                    if (match && match[1]) return match[1];
                }
            }
            if (document.body.innerText.includes('К сожалению, по вашему запросу ничего не найдено')) return null;
        }
        return null;
    } catch (e) { return null; }
}