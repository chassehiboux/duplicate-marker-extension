(function() {
  // Защита от повторного запуска, если скрипт будет внедрен дважды
  if (window.hasColumnManagerRun) return;
  window.hasColumnManagerRun = true;

  // --- КОНФИГУРАЦИЯ ---
  
  // Ключ уникален для каждой страницы (по пути URL)
  const PAGE_ID = window.location.pathname; 
  const STORAGE_KEY = `jqgrid_settings_${PAGE_ID}`;

  const HIDDEN_CLASS = 'jqgrid-ext-force-hidden';
  const VISIBLE_CLASS = 'jqgrid-ext-force-visible';

  // Столбцы, которые ВСЕГДА в списке (даже если скрыты сайтом)
  const FORCE_INCLUDE_IDS = [
    'list_DebtID', 
    'list_EDocID', 
    'list_CaseNumber', 
    'list_EDNumber'
  ]; 
  
  // Столбцы-исключения (никогда не трогать и не показывать)
  const SIMPLE_BLACKLIST = [
    'list_cb', 'list_rn', 'list_subgrid', 'list_undefined',
    'list_DebtorIsDead', 'list_BigDebtAccounts', 'list_Mobilized',
    'list_FireVictim', 'list_DebtExcludePayment_ActiveDebt',
    'list_V_OVZIDMarkers_HopelessnessAccount', 'list_IsAlive'
  ];

  // Состояние (локальное для этой вкладки/страницы)
  let state = {
    isEnabled: false,
    hiddenColumns: []
  };

  // --- 1. CSS СТИЛИ (UI + ЛОГИКА) ---
  const style = document.createElement('style');
  style.textContent = `
    /* --- Логика скрытия/показа --- */
    .${HIDDEN_CLASS} { display: none !important; }
    .${VISIBLE_CLASS} { display: table-cell !important; }

    /* --- Стили UI (Кнопка и Модалка) --- */
    #jqgrid-manager-btn {
      margin-left: 5px;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    
    /* Затемнение фона */
    .jq-ext-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 10000;
      display: none; align-items: center; justify-content: center;
    }
    .jq-ext-modal-overlay.open { display: flex; }

    /* Само окно */
    .jq-ext-modal {
      background: #fff; width: 350px; max-height: 80vh;
      border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: sans-serif; font-size: 14px; text-align: left; color: #333;
    }

    /* Шапка */
    .jq-ext-header {
      padding: 15px; border-bottom: 1px solid #eee;
      display: flex; justify-content: space-between; align-items: center;
      background: #f8f9fa;
    }
    .jq-ext-title { font-weight: bold; font-size: 16px; color: #333; margin: 0; }
    .jq-ext-close { cursor: pointer; font-size: 20px; color: #999; border: none; background: none; }
    .jq-ext-close:hover { color: #333; }

    /* Тело */
    .jq-ext-body { padding: 15px; overflow-y: auto; flex-grow: 1; }

    /* Переключатель */
    .jq-ext-switch-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 15px; padding: 10px; background: #eef2f5; border-radius: 6px;
    }
    .jq-ext-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
    .jq-ext-switch input { opacity: 0; width: 0; height: 0; }
    .jq-ext-slider {
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background-color: #ccc; transition: .4s; border-radius: 22px;
    }
    .jq-ext-slider:before {
      position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
      background-color: white; transition: .4s; border-radius: 50%;
    }
    input:checked + .jq-ext-slider { background-color: #2196F3; }
    input:checked + .jq-ext-slider:before { transform: translateX(18px); }

    /* Список столбцов */
    .jq-ext-list { display: flex; flex-direction: column; gap: 5px; }
    .jq-ext-list label {
      display: flex; align-items: center; padding: 6px 8px;
      background: #f9f9f9; border-radius: 4px; cursor: pointer; user-select: none;
    }
    .jq-ext-list label:hover { background: #eefbff; }
    .jq-ext-list input { margin-right: 10px; }
    .jq-ext-list label.disabled-look { color: #999; text-decoration: line-through; }
  `;
  document.head.appendChild(style);


  // --- 2. ЛОГИКА РАБОТЫ С ТАБЛИЦЕЙ (CORE) ---

  function isColumnBlacklisted(th) {
    const id = th.id;
    if (!id) return true;
    if (SIMPLE_BLACKLIST.includes(id)) return true;
    if (id === 'list_V_OVZIDMarkers_Inappropriate') {
        const name = getColumnName(th);
        if (name === 'V_OVZIDMarkers_Inappropriate') return true;
    }
    return false;
  }

  function getColumnName(th) {
    const id = th.id;
    const nameDiv = th.querySelector(`div[id="jqgh_${id}"]`);
    if (nameDiv) {
        const nameNode = Array.from(nameDiv.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (nameNode && nameNode.textContent.trim()) {
            return nameNode.textContent.trim();
        }
    }
    return id;
  }

  function applyColumnState() {
    const allColumnThs = document.querySelectorAll('.ui-jqgrid-htable .ui-th-column[id^="list_"]');
    
    allColumnThs.forEach(th => {
      const columnId = th.id;
      if (isColumnBlacklisted(th)) return;

      if (!state.isEnabled) {
        cleanAllClassesForColumn(columnId, th);
        return;
      }

      const shouldBeHidden = state.hiddenColumns.includes(columnId);
      applyClassesForColumn(columnId, th, shouldBeHidden);
    });
  }

  function cleanAllClassesForColumn(columnId, thElement) {
    removeClasses(thElement);
    handleFirstRow(thElement.cellIndex, false, false);
    document.querySelectorAll(`[aria-describedby="${columnId}"]`).forEach(el => removeClasses(el));
  }

  function applyClassesForColumn(columnId, thElement, shouldBeHidden) {
    setClasses(thElement, shouldBeHidden);
    handleFirstRow(thElement.cellIndex, true, shouldBeHidden);
    document.querySelectorAll(`[aria-describedby="${columnId}"]`).forEach(el => setClasses(el, shouldBeHidden));
  }

  function setClasses(el, hidden) {
    if (!el) return;
    if (hidden) {
      el.classList.add(HIDDEN_CLASS);
      el.classList.remove(VISIBLE_CLASS);
    } else {
      el.classList.remove(HIDDEN_CLASS);
      el.classList.add(VISIBLE_CLASS);
    }
  }

  function removeClasses(el) {
    if (!el) return;
    el.classList.remove(HIDDEN_CLASS);
    el.classList.remove(VISIBLE_CLASS);
  }

  function handleFirstRow(headerIndex, active, shouldHide) {
    if (headerIndex === -1) return;
    const firstRowCell = document.querySelector(`.ui-jqgrid-btable tr.jqgfirstrow > td:nth-child(${headerIndex + 1})`);
    if (firstRowCell) {
        if (!active) removeClasses(firstRowCell);
        else setClasses(firstRowCell, shouldHide);
    }
  }


  // --- 3. ИНТЕРФЕЙС (КНОПКА И МОДАЛКА) ---

  function createUI() {
    // 1. Ищем место для кнопки (после .LogoutLink)
    const logoutLink = document.querySelector('.LogoutLink');
    if (!logoutLink) {
        // Если кнопки выхода нет (еще не загрузилась), попробуем позже
        setTimeout(createUI, 1000);
        return;
    }

    if (document.getElementById('jqgrid-manager-btn')) return; // Уже создана

    // Создаем кнопку
    const btn = document.createElement('a');
    btn.id = 'jqgrid-manager-btn';
    btn.className = 'btn btn-default btn-sm'; // Используем стили сайта
    btn.style.marginLeft = '.5em';
    btn.title = 'Настройка столбцов';
    btn.innerHTML = '<i class="fa fa-columns fa-1x" aria-hidden="true"></i>'; // Иконка колонок
    
    // Вставляем после кнопки выхода
    logoutLink.parentNode.insertBefore(btn, logoutLink.nextSibling);

    // Создаем Модалку (скрытую)
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'jq-ext-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="jq-ext-modal">
        <div class="jq-ext-header">
            <h3 class="jq-ext-title">Управление столбцами</h3>
            <button class="jq-ext-close">×</button>
        </div>
        <div class="jq-ext-body">
            <div class="jq-ext-switch-row">
                <span>Включить управление</span>
                <label class="jq-ext-switch">
                    <input type="checkbox" id="jq-ext-master-toggle">
                    <span class="jq-ext-slider"></span>
                </label>
            </div>
            <div id="jq-ext-columns-list" class="jq-ext-list">
                <!-- Список будет здесь -->
                <div style="text-align:center; color:#999;">Загрузка...</div>
            </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    // --- ОБРАБОТЧИКИ СОБЫТИЙ UI ---
    
    // Открытие
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        modalOverlay.classList.add('open');
        renderModalContent(); // Генерируем список при открытии
    });

    // Закрытие
    modalOverlay.querySelector('.jq-ext-close').addEventListener('click', () => {
        modalOverlay.classList.remove('open');
    });
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('open');
    });

    // Главный переключатель
    const masterToggle = document.getElementById('jq-ext-master-toggle');
    masterToggle.addEventListener('change', async (e) => {
        state.isEnabled = e.target.checked;
        
        if (state.isEnabled) {
             // Синхронизация при включении (если первый раз)
             syncInitialStateFromDOM();
             renderModalContent(); // Перерисовать список
        }

        saveState();
        applyColumnState();
    });
  }

  // Генерация списка столбцов в модалке
  function renderModalContent() {
    const listContainer = document.getElementById('jq-ext-columns-list');
    const masterToggle = document.getElementById('jq-ext-master-toggle');
    
    masterToggle.checked = state.isEnabled;
    listContainer.innerHTML = '';

    if (!state.isEnabled) {
        listContainer.innerHTML = '<div style="text-align:center; color:#999;">Включите управление, чтобы настроить столбцы.</div>';
        return;
    }

    // Собираем данные о столбцах
    const allColumnThs = document.querySelectorAll('.ui-jqgrid-htable .ui-th-column[id^="list_"]');
    const columns = [];

    allColumnThs.forEach(th => {
        if (isColumnBlacklisted(th)) return;
        
        const id = th.id;
        const name = getColumnName(th);
        const computedStyle = window.getComputedStyle(th);
        const isVisibleOnScreen = computedStyle.display !== 'none';

        // Фильтр списка
        let shouldShow = false;
        if (FORCE_INCLUDE_IDS.includes(id)) shouldShow = true;
        else if (state.hiddenColumns.includes(id)) shouldShow = true;
        else if (isVisibleOnScreen) shouldShow = true;

        if (shouldShow) {
            columns.push({ id, name });
        }
    });

    if (columns.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:#999;">Нет доступных столбцов</div>';
        return;
    }

    // Рисуем чекбоксы
    columns.forEach(col => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        
        // Галочка стоит, если НЕ скрыт
        const isHidden = state.hiddenColumns.includes(col.id);
        checkbox.checked = !isHidden;

        if (isHidden) label.classList.add('disabled-look');

        checkbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            if (isChecked) {
                // Убрать из скрытых
                state.hiddenColumns = state.hiddenColumns.filter(id => id !== col.id);
                label.classList.remove('disabled-look');
            } else {
                // Добавить в скрытые
                if (!state.hiddenColumns.includes(col.id)) state.hiddenColumns.push(col.id);
                label.classList.add('disabled-look');
            }
            saveState();
            applyColumnState();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(col.name));
        listContainer.appendChild(label);
    });
  }

  // Синхронизация при первом включении
  function syncInitialStateFromDOM() {
    if (state.hiddenColumns.length > 0) return; // Уже есть настройки

    const allColumnThs = document.querySelectorAll('.ui-jqgrid-htable .ui-th-column[id^="list_"]');
    const newHidden = [];

    allColumnThs.forEach(th => {
        if (isColumnBlacklisted(th)) return;
        
        const computedStyle = window.getComputedStyle(th);
        const isVisibleOnScreen = computedStyle.display !== 'none';
        
        // Если столбец невидим на экране -> добавляем его в скрытые по умолчанию
        if (!isVisibleOnScreen) {
            newHidden.push(th.id);
        }
    });

    if (newHidden.length > 0) {
        state.hiddenColumns = newHidden;
        saveState();
    }
  }


  // --- 4. ХРАНИЛИЩЕ ДАННЫХ ---

  async function loadState() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) {
        state = data[STORAGE_KEY];
    } else {
        // Дефолт
        state = { isEnabled: false, hiddenColumns: [] };
    }
    
    // Применяем загруженное состояние
    if (state.isEnabled) {
        applyColumnState();
    }
  }

  function sendSyncSet(values) {
    try {
      chrome.runtime.sendMessage({
        action: 'DUP_SYNC_SET',
        data: {
          values,
          options: { reason: 'column-manager-state' }
        }
      }, () => {});
    } catch (error) {
      // background недоступен
    }
  }

  function saveState() {
    sendSyncSet({ [STORAGE_KEY]: state });
  }


  // --- 5. ИНИЦИАЛИЗАЦИЯ ---

  // Запуск при старте
  loadState();
  createUI();

  // Следим за изменениями DOM (чтобы держать таблицу в узде)
  const observer = new MutationObserver(() => {
    if (state.isEnabled) applyColumnState();
    
    // Повторная проверка кнопки, если сайт перерисовал шапку (SPA)
    if (!document.getElementById('jqgrid-manager-btn')) createUI();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
