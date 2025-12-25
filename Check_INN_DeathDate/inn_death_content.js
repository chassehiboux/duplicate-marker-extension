// --- СТИЛИ ---
const style = document.createElement('style');
style.textContent = `
  /* --- TOAST STYLES (Одиночные проверки) --- */
  #inn-toast-container {
    position: fixed; top: 15px; right: 15px; z-index: 2147483647;
    display: flex; flex-direction: column; align-items: flex-end;
    gap: 10px; pointer-events: none;
  }
  
  .inn-close-all-btn {
    pointer-events: auto;
    background: #333; color: white; border: 1px solid #555;
    padding: 5px 15px; border-radius: 4px; cursor: pointer;
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    margin-bottom: 5px; transition: background 0.2s;
    display: none;
  }
  .inn-close-all-btn:hover { background: #555; }

  .inn-check-toast {
    pointer-events: auto;
    position: relative;
    width: 380px;
    padding: 15px 35px 15px 15px; 
    border-radius: 8px; color: white; 
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.5;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    animation: slideIn 0.3s ease-out forwards;
    border-left: 5px solid rgba(0,0,0,0.2);
    background-color: #1565c0;
  }
  
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fadeOut {
    to { opacity: 0; transform: translateX(100%); }
  }

  .inn-toast-closing {
    animation: fadeOut 0.3s ease-in forwards !important;
  }

  .inn-close-btn {
    position: absolute; top: 5px; right: 10px;
    color: rgba(255,255,255,0.6); cursor: pointer;
    font-size: 20px; font-weight: bold; line-height: 1;
    transition: color 0.2s;
  }
  .inn-close-btn:hover { color: #fff; }

  /* --- MODAL STYLES (Массовая проверка) --- */
  .inn-modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 2147483647;
    display: flex; justify-content: center; align-items: center;
    backdrop-filter: blur(2px);
  }
  .inn-modal {
    background: white; width: 800px; max-width: 95%; height: 85vh;
    border-radius: 8px; display: flex; flex-direction: column;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    font-family: 'Segoe UI', Arial, sans-serif;
    animation: popIn 0.2s ease-out;
  }
  @keyframes popIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .inn-modal-header {
    padding: 15px 20px; border-bottom: 1px solid #ddd;
    background: #f5f5f5; border-radius: 8px 8px 0 0;
    display: flex; justify-content: space-between; align-items: center;
  }
  .inn-modal-title { font-size: 18px; font-weight: 600; color: #333; }
  .inn-modal-progress { font-size: 14px; color: #666; font-weight: 500; }
  .inn-modal-close {
    font-size: 24px; color: #999; cursor: pointer; line-height: 1;
  }
  .inn-modal-close:hover { color: #333; }
  
  .inn-modal-body {
    flex: 1; overflow-y: auto; padding: 0;
    background: #2c3e50;
  }

  .inn-modal-item {
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: #eee; font-size: 13px;
    transition: background 0.1s;
  }
  .inn-modal-item:hover { background: rgba(255,255,255,0.05); }
  
  .status-success { border-left: 4px solid #43a047; }
  .status-warning { border-left: 4px solid #fdd835; }
  .status-death { border-left: 4px solid #d32f2f; background: rgba(211, 47, 47, 0.15); }

  /* --- SHARED CONTENT STYLES --- */
  .my-super-btn {
    background: #d9534f !important; color: white !important;
    border: 1px solid #d43f3a !important; padding: 3px 10px !important;
    margin-left: 10px !important; font-size: 12px !important;
    cursor: pointer !important; border-radius: 4px !important;
    font-weight: 600 !important;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
  .my-super-btn:hover { background: #c9302c !important; transform: translateY(-1px); }
  
  .toast-header { 
    font-weight: 700; font-size: 14px; margin-bottom: 5px; 
    text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9;
  }
  .toast-row { margin-bottom: 3px; }
  
  .badge-success {
    background-color: #43a047; color: white;
    padding: 1px 5px; border-radius: 3px; font-weight: bold;
    border: 1px solid #2e7d32; font-size: 12px;
  }
  .badge-warn {
    background-color: #fdd835; color: #333;
    padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 12px;
  }
  .badge-neutral {
    background-color: rgba(255,255,255,0.2);
    padding: 1px 5px; border-radius: 3px; font-size: 12px;
  }

  .dead-alert {
    margin-top: 5px; padding: 8px;
    background: rgba(255,0,0,0.15);
    border: 1px solid rgba(255,0,0,0.3);
    border-radius: 4px; font-size: 13px;
  }
  .edoc-id-row {
      font-size: 12px; color: #bbb; margin-bottom: 4px;
  }
  .edoc-id-val { color: #fff; font-weight: bold; }
`;
document.head.appendChild(style);

// --- TOAST SYSTEM ---
function getToastContainer() {
    let container = document.getElementById('inn-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'inn-toast-container';
        const closeAllBtn = document.createElement('button');
        closeAllBtn.className = 'inn-close-all-btn';
        closeAllBtn.innerText = 'ЗАКРЫТЬ ВСЕ';
        closeAllBtn.onclick = () => {
            document.querySelectorAll('.inn-check-toast').forEach(t => t.remove());
            checkCloseAllVisibility();
        };
        container.appendChild(closeAllBtn);
        document.body.appendChild(container);
    }
    return container;
}

function checkCloseAllVisibility() {
    const container = document.getElementById('inn-toast-container');
    if (!container) return;
    const btn = container.querySelector('.inn-close-all-btn');
    const count = container.querySelectorAll('.inn-check-toast').length;
    if (btn) btn.style.display = count > 0 ? 'block' : 'none';
}

function showToast(html, type, autoClose = false) {
    const container = getToastContainer();
    const d = document.createElement('div');
    d.className = 'inn-check-toast';
    if (type === 'death') d.style.backgroundColor = '#d32f2f';
    else if (type === 'success') d.style.backgroundColor = '#2e7d32';
    else if (type === 'warning') d.style.backgroundColor = '#f57c00';
    else d.style.backgroundColor = '#1565c0';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'inn-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => { 
        d.classList.add('inn-toast-closing');
        setTimeout(() => { d.remove(); checkCloseAllVisibility(); }, 300);
    };

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = html;

    d.appendChild(closeBtn);
    d.appendChild(contentDiv);
    container.appendChild(d);
    checkCloseAllVisibility();

    if (autoClose) {
        setTimeout(() => {
            if (document.body.contains(d)) {
                d.classList.add('inn-toast-closing');
                setTimeout(() => { d.remove(); checkCloseAllVisibility(); }, 300);
            }
        }, 5000); 
    }
}

// --- MODAL SYSTEM ---
function getModal() {
    let overlay = document.getElementById('inn-batch-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'inn-batch-modal-overlay';
        overlay.className = 'inn-modal-overlay';
        overlay.innerHTML = `
            <div class="inn-modal" id="inn-batch-modal">
                <div class="inn-modal-header">
                    <div>
                        <div class="inn-modal-title">Результаты проверки</div>
                        <div class="inn-modal-progress" id="inn-modal-progress-text">Подготовка...</div>
                    </div>
                    <div class="inn-modal-close" id="inn-modal-close-btn">×</div>
                </div>
                <div class="inn-modal-body" id="inn-modal-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        const closeFunc = () => {
            overlay.style.display = 'none';
            document.getElementById('inn-modal-body').innerHTML = ''; 
            chrome.runtime.sendMessage({ action: "cancel_batch_check" });
        };
        document.getElementById('inn-modal-close-btn').onclick = closeFunc;
    }
    overlay.style.display = 'flex';
    return overlay;
}

function updateModalProgress(current, total) {
    const txt = document.getElementById('inn-modal-progress-text');
    if(txt) txt.innerText = current === total ? `Проверка завершена (${total} шт.)` : `Обработано: ${current} из ${total}`;
}

function appendModalResult(html, type) {
    const body = document.getElementById('inn-modal-body');
    if(!body) return;
    const item = document.createElement('div');
    item.className = 'inn-modal-item';
    if (type === 'death') item.classList.add('status-death');
    else if (type === 'warning') item.classList.add('status-warning');
    else item.classList.add('status-success');
    item.innerHTML = html;
    body.appendChild(item);
    body.scrollTop = body.scrollHeight;
}

// --- HTML GENERATOR ---
function generateResultHtml(res, edocId = null) {
    const { foundInn, foundDeath, existingInn, existingDeath, probateCaseDeath, error } = res;
    
    // Формируем ФИО с отчеством (если есть)
    const fullName = `${res.surname} ${res.name} ${res.patronymic || ''}`.trim();

    let html = ``;
    if (edocId) {
        html += `<div class="edoc-id-row">EdocID: <span class="edoc-id-val">${edocId}</span> (${fullName})</div>`;
    } else {
        html += `<div class="toast-header">Результат (${fullName})</div>`;
    }

    if (error) {
        html += `<div class="toast-row" style="color: #ffcc80;">Ошибка: ${error}</div>`;
        return { html, type: 'warning' };
    }

    let type = 'success';
    let isDead = false;

    // --- 1. БЛОК ИНН ---
    if (foundInn && existingInn) {
        if (foundInn === existingInn) {
            html += `<div class="toast-row">ИНН совпадает: <span class="badge-success">${foundInn}</span></div>`;
        } else {
            html += `<div class="toast-row" style="color:#ffcc80">⚠️ КОНФЛИКТ ИНН!</div>`;
            html += `<div class="toast-row">В базе: <span class="badge-neutral">${existingInn}</span></div>`;
            html += `<div class="toast-row">По паспорту: <span class="badge-success">${foundInn}</span> (ВЕРНЫЙ)</div>`;
            type = 'warning';
        }
    } else if (foundInn && !existingInn) {
        html += `<div class="toast-row">Найден ИНН: <span class="badge-success">${foundInn}</span></div>`;
    } else if (!foundInn && existingInn) {
        html += `<div class="toast-row" style="color:#ffcc80">⚠️ По паспорту ИНН не найден!</div>`;
        html += `<div class="toast-row">В базе: <span class="badge-neutral">${existingInn}</span></div>`;
        type = 'warning';
    } else {
        html += `<div class="toast-row">⛔️ ИНН не найден.</div>`;
        type = 'death'; 
    }
    
    // --- 2. БЛОК СМЕРТИ (ВЫВОДИМ ВСЕ ИСТОЧНИКИ) ---
    let deadInfo = '';

    // Источник 1: По имеющемуся ИНН (из базы)
    if (existingDeath) {
        isDead = true;
        deadInfo += `<div style="font-weight:bold; color:#ff8a80; margin-top:2px;">💀 ФНС (по ИНН из базы): ${existingDeath}</div>`;
    }

    // Источник 2: По найденному ИНН (ФНС)
    // Выводим если нашли дату, и (это новый ИНН ИЛИ это тот же ИНН, но мы хотим подтвердить источник)
    // Чтобы не дублировать визуально 1-в-1, проверим:
    if (foundDeath) {
        isDead = true;
        // Если это тот же самый инн и та же дата, что уже вывели - не дублируем, иначе выводим
        if (!(existingInn === foundInn && existingDeath === foundDeath)) {
            deadInfo += `<div style="font-weight:bold; color:#ff8a80; margin-top:2px;">💀 ФНС (по найденному ИНН): ${foundDeath}</div>`;
        } else if (!deadInfo.includes("ФНС")) { 
            // Если existingDeath не было (например нет инн в базе), то выводим
            deadInfo += `<div style="font-weight:bold; color:#ff8a80; margin-top:2px;">💀 ФНС (по найденному ИНН): ${foundDeath}</div>`;
        }
    }

    // Источник 3: Реестр наследственных дел
    if (probateCaseDeath) {
        isDead = true;
        deadInfo += `<div style="font-weight:bold; color:#ff8a80; margin-top:2px;">💀 Реестр наслед. дел: ${probateCaseDeath}</div>`;
    }

    if (isDead) {
        html += `<div class="dead-alert">${deadInfo}</div>`;
        type = 'death';
    } else {
        html += `<div class="toast-row" style="margin-top:5px; opacity:0.6; font-size:11px;">ℹ️ Информация о смерти не найдена</div>`;
    }

    // Предупреждение о странности (есть дело, но ИНН живой)
    if (foundInn && probateCaseDeath && !foundDeath && !existingDeath) {
         html += `<div style="color:#ffcc80; font-size: 11px; margin-top:3px;">(⚠️ Есть дело, но ИНН числится живым!)</div>`;
         if (type !== 'death') type = 'warning';
    }

    return { html, type };
}


// --- PARSER ---
function getDataFromTable(headerNode) {
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

// --- BUTTONS ---
function checkAndInject() {
    const headers = document.querySelectorAll('h4');
    headers.forEach(h4 => {
        if (h4.innerText.includes('Реквизиты ИД') && !h4.querySelector('.my-super-btn')) {
            const btn = document.createElement('button');
            btn.innerText = 'ПРОВЕРИТЬ ИНН/СМЕРТЬ';
            btn.className = 'my-super-btn';
            btn.type = "button";
            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const data = getDataFromTable(h4);
                if (!data || !data.surname || !data.birthDate) {
                    showToast('Ошибка: Не удалось считать ФИО или ДР.', 'death', true);
                    return;
                }
                btn.innerText = 'Запрос...';
                btn.disabled = true;
                chrome.runtime.sendMessage({ action: "start_check", data: data }, (resp) => {
                    btn.innerText = 'ПРОВЕРИТЬ ИНН/СМЕРТЬ';
                    btn.disabled = false;
                    if (!resp || !resp.success) {
                        showToast(`Ошибка: ${resp ? resp.error : 'Нет связи'}`, 'death', true);
                        return;
                    }
                    const resultData = generateResultHtml(resp);
                    showToast(resultData.html, resultData.type, false);
                });
            };
            h4.appendChild(btn);
        }
    });
}

function injectToolbarButton() {
    const toolbar = document.querySelector('.ui-pg-table.navtable');
    if (toolbar && !toolbar.querySelector('#batch-inn-check-btn')) {
        const btn = document.createElement('div');
        btn.className = 'btn btn-xs ui-pg-button';
        btn.id = 'batch-inn-check-btn';
        btn.title = 'Проверить ИНН/Смерть для выбранных';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `<div class="ui-pg-div"><span class="fa fa-lg fa-fw fa-user-secret"></span><span class="ui-pg-button-text">Проверить ИНН/Смерть</span></div>`;
        btn.onclick = () => {
            if (btn.classList.contains('ui-jqgrid-disablePointerEvents')) return;
            const selectedRows = document.querySelectorAll('#list tr.jqgrow[aria-selected="true"]');
            if (selectedRows.length === 0) {
                showToast('Пожалуйста, выберите хотя бы одну строку для проверки.', 'warning', true);
                return;
            }
            const ids = Array.from(selectedRows).map(row => row.id);
            getModal(); 
            updateModalProgress(0, ids.length);
            btn.classList.add('ui-jqgrid-disablePointerEvents');
            const btnText = btn.querySelector('.ui-pg-button-text');
            if(btnText) btnText.textContent = 'Проверка...';
            chrome.runtime.sendMessage({ 
                action: "start_batch_check", 
                ids: ids,
                origin: window.location.origin 
            });
        };
        const refreshBtn = toolbar.querySelector('#refresh_list');
        if (refreshBtn) refreshBtn.insertAdjacentElement('afterend', btn);
        else toolbar.appendChild(btn);
    }
}

// --- MESSAGING ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "batch_progress") {
        updateModalProgress(request.current, request.total);
    }
    else if (request.action === "batch_item_result") {
        const res = request.result;
        const resultData = generateResultHtml(res, res.id); 
        appendModalResult(resultData.html, resultData.type);
    }
    else if (request.action === "batch_complete") {
        const btn = document.querySelector('#batch-inn-check-btn');
        if(btn) {
            btn.classList.remove('ui-jqgrid-disablePointerEvents');
            const btnText = btn.querySelector('.ui-pg-button-text');
            if(btnText) btnText.textContent = 'Проверить ИНН/Смерть';
        }
        const body = document.getElementById('inn-modal-body');
        if(body) {
            const div = document.createElement('div');
            div.style.padding = '10px'; div.style.textAlign = 'center'; div.style.color = '#81c784'; div.style.fontWeight = 'bold';
            div.innerText = '--- ПРОВЕРКА ЗАВЕРШЕНА ---';
            body.appendChild(div);
            body.scrollTop = body.scrollHeight;
        }
    }
});

setInterval(() => {
    checkAndInject();
    injectToolbarButton();
}, 1000);