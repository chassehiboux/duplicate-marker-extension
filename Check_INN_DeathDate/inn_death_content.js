// --- СТИЛИ ---
const style = document.createElement('style');
style.textContent = `
  .inn-check-toast {
    position: fixed; top: 15px; right: 15px; z-index: 2147483647;
    padding: 15px 35px 15px 15px; /* справа место под крестик */
    border-radius: 8px; color: white; 
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.5;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    min-width: 320px; max-width: 450px;
    animation: slideIn 0.3s ease-out forwards;
    border-left: 5px solid rgba(0,0,0,0.2);
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .inn-close-btn {
    position: absolute; top: 5px; right: 10px;
    color: rgba(255,255,255,0.6); cursor: pointer;
    font-size: 20px; font-weight: bold; line-height: 1;
    transition: color 0.2s;
  }
  .inn-close-btn:hover { color: #fff; }
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
    font-weight: 700; font-size: 15px; margin-bottom: 8px; 
    border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px; 
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .toast-row { margin-bottom: 5px; }
  
  /* Подсветка */
  .badge-success {
    background-color: #43a047; color: white;
    padding: 2px 6px; border-radius: 4px; font-weight: bold;
    border: 1px solid #2e7d32;
  }
  .badge-warn {
    background-color: #fdd835; color: #333;
    padding: 2px 6px; border-radius: 4px; font-weight: bold;
  }
  .badge-neutral {
    background-color: rgba(255,255,255,0.2);
    padding: 2px 6px; border-radius: 4px;
  }

  .dead-alert {
    margin-top: 10px; padding: 10px;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,0,0,0.3);
    border-radius: 5px; font-size: 14px;
  }
`;
document.head.appendChild(style);

// --- TOAST ---
function showToast(html, type) {
    const d = document.createElement('div');
    d.className = 'inn-check-toast';
    
    // Цветовая схема
    if (type === 'death') d.style.backgroundColor = '#d32f2f'; // Красный
    else if (type === 'success') d.style.backgroundColor = '#2e7d32'; // Зеленый
    else if (type === 'warning') d.style.backgroundColor = '#f57c00'; // Оранжевый
    else d.style.backgroundColor = '#1565c0'; // Синий

    const closeBtn = document.createElement('span');
    closeBtn.className = 'inn-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => { d.remove(); };

    d.innerHTML = html;
    d.appendChild(closeBtn);
    document.body.appendChild(d);
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

// --- BUTTON INJECTION ---
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
                    showToast('Ошибка: Не удалось считать ФИО или ДР.', 'death');
                    return;
                }

                btn.innerText = 'Запрос...';
                btn.disabled = true;

                chrome.runtime.sendMessage({ action: "start_check", data: data }, (resp) => {
                    btn.innerText = 'ПРОВЕРИТЬ ИНН/СМЕРТЬ';
                    btn.disabled = false;
                    
                    if (!resp || !resp.success) {
                        showToast(`Ошибка: ${resp ? resp.error : 'Нет связи'}`, 'death');
                        return;
                    }

                    const { foundInn, foundDeath, existingInn, existingDeath } = resp;
                    
                    let html = `<div class="toast-header">Результат проверки</div>`;
                    let type = 'success';

                    // 1. ЛОГИКА ИНН
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

                    // 2. ЛОГИКА СМЕРТИ
                    // Собираем всё в кучу, чтобы понять умер или нет
                    let isDead = false;
                    let deadInfo = '';

                    if (foundDeath) {
                        isDead = true;
                        deadInfo += `<div style="font-weight:bold; color:#ff8a80">💀 По найденному ИНН: ${foundDeath}</div>`;
                    }
                    if (existingDeath) {
                        isDead = true;
                        // Если уже вывели инфу по найденному, и она совпадает с базой - не дублируем
                        if (!foundDeath || (foundDeath && existingDeath !== foundDeath)) {
                            deadInfo += `<div style="font-weight:bold; color:#ff8a80">💀 По ИНН из базы: ${existingDeath}</div>`;
                        }
                    }

                    if (isDead) {
                        html += `<div class="dead-alert">${deadInfo}</div>`;
                        type = 'death';
                    } else {
                        html += `<div class="toast-row" style="margin-top:8px; opacity:0.9">ℹ️ Информация о смерти не найдена (Статус: Действителен)</div>`;
                    }

                    showToast(html, type);
                });
            };
            h4.appendChild(btn);
        }
    });
}
setInterval(checkAndInject, 1000);