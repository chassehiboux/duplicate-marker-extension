(function() {
  if (window.hasDuplicateCheckerRun) return;
  window.hasDuplicateCheckerRun = true;

  const HIGHLIGHT_CLASS = 'dupe-highlight-active';
  const LS_SELECTOR = '[aria-describedby="list_AccAddress_AccountNumber"]';

  let isCopyModeEnabled = false;

  // --- 1. НАСТРОЙКИ ---
  chrome.storage.local.get(['setting_copy_mode'], (result) => {
    if (result.setting_copy_mode) isCopyModeEnabled = true;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.setting_copy_mode) {
      isCopyModeEnabled = changes.setting_copy_mode.newValue;
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clear') {
      clearHighlights();
    } else if (request.action === 'highlight') {
      clearHighlights();
      setTimeout(() => {
        runCheck(request.fields, request.strictMode || {});
      }, 50);
    }
  });

  // --- 2. ЛОГИКА "ТУРБО" (ОБРАБОТЧИКИ КЛИКОВ) ---

  // А) Правая кнопка мыши (ПКМ) - Умный обработчик
  document.addEventListener('contextmenu', async function(e) {
    if (!isCopyModeEnabled) return;

    // СЦЕНАРИЙ 1: Нажатие ПКМ по ПОЛЮ ПОИСКА (Вставка)
    const searchInput = e.target.closest('input[role="search"]');
    if (searchInput) {
      e.preventDefault(); // Блокируем стандартное меню

      try {
        // Читаем из буфера
        const text = await navigator.clipboard.readText();
        
        // Вставляем значение
        searchInput.value = text;
        
        // Обязательно сообщаем странице, что значение изменилось (чтобы сработали фильтры)
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Визуально подтверждаем
        showSuccessFeedback(searchInput);
      } catch (err) {
        console.error('Ошибка вставки из буфера:', err);
        // Если прав нет, попробуем просто сфокусироваться, чтобы пользователь мог нажать Ctrl+V
        searchInput.focus(); 
      }
      return; // Выходим, чтобы не сработал код для ячейки
    }

    // СЦЕНАРИЙ 2: Нажатие ПКМ по ЯЧЕЙКЕ ТАБЛИЦЫ (Копирование)
    const targetCell = e.target.closest('td[role="gridcell"]');
    if (targetCell) {
      e.preventDefault();
      const val = getSmartValue(targetCell);
      if (val) {
        navigator.clipboard.writeText(val).then(() => {
          showSuccessFeedback(targetCell);
        });
      }
    }
  }, true);

  // Б) Левая кнопка мыши (ЛКМ) - Выделение текста в поиске
  document.addEventListener('click', function(e) {
    if (!isCopyModeEnabled) return;

    const searchInput = e.target.closest('input[role="search"]');
    if (searchInput) {
      searchInput.select();
    }
  }, true);


  // --- 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  
  function showSuccessFeedback(element) {
    const originalBg = element.style.backgroundColor;
    const originalTrans = element.style.transition;
    
    element.style.transition = 'background-color 0.1s ease';
    element.style.backgroundColor = '#66bb6a'; // Зеленый
    // Если это input, можно еще цвет текста сделать белым для контраста
    if (element.tagName === 'INPUT') element.style.color = 'white';

    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      if (element.tagName === 'INPUT') element.style.color = '';
      setTimeout(() => { element.style.transition = originalTrans; }, 200);
    }, 200);
  }

  function getSmartValue(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      return el.value.trim();
    }
    const childInput = el.querySelector('input, textarea, select');
    if (childInput) {
      return childInput.value.trim();
    }
    return el.textContent.trim();
  }

  function clearHighlights() {
    const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    highlighted.forEach(el => {
      el.style.backgroundColor = '';
      el.style.outline = '';
      if (el.dataset.originalTitle !== undefined) {
         el.title = el.dataset.originalTitle;
         delete el.dataset.originalTitle;
      } else if (el.title && el.title.includes('⚠️')) {
         el.removeAttribute('title');
      }
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  function getColorForText(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 85%, 80%)`;
  }

  function getLinkedLS(element) {
    const row = element.closest('tr');
    if (!row) return 'NO_ROW';
    const lsCell = row.querySelector(LS_SELECTOR);
    if (!lsCell) return 'NO_LS_CELL';
    return getSmartValue(lsCell);
  }

  function parseSpecialValue(rawVal, fieldId) {
    if (fieldId === 'list_CaseNumber' || fieldId === 'list_EDNumber') {
      const match = rawVal.match(/#(.*?)#/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return rawVal;
  }

  // --- 4. ПОИСК ДУБЛИКАТОВ ---
  function runCheck(fieldIds, strictModeOptions) {
    console.clear();
    console.log('--- ЗАПУСК ПОИСКА ДУБЛИКАТОВ ---');
    let totalDuplicates = 0;
    let foundGroups = [];

    fieldIds.forEach(ariaId => {
      const selector = `[aria-describedby="${ariaId}"]`;
      const elements = document.querySelectorAll(selector);
      const counts = {};
      const useStrictLS = strictModeOptions[ariaId] === true;
      const fieldName = ariaId.replace('list_', '');

      elements.forEach(el => {
        let val = getSmartValue(el);
        val = parseSpecialValue(val, ariaId);
        if (val.length > 0) {
          let key = val;
          if (useStrictLS) {
            const lsVal = getLinkedLS(el);
            key = val + '___' + lsVal; 
          }
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      let groupHasDupes = false;
      elements.forEach(el => {
        let rawVal = getSmartValue(el);
        let val = parseSpecialValue(rawVal, ariaId);
        if (val.length === 0) return;

        let key = val;
        let lsVal = '';
        if (useStrictLS) {
          lsVal = getLinkedLS(el);
          key = val + '___' + lsVal;
        }

        if (counts[key] > 1) {
          el.classList.add(HIGHLIGHT_CLASS);
          el.style.backgroundColor = getColorForText(key);
          el.style.outline = '2px solid red';
          
          if (el.dataset.originalTitle === undefined) {
            el.dataset.originalTitle = el.title || '';
          }
          
          let msg = `⚠️ ДУБЛИКАТ (${counts[key]} шт.)\nПоле: ${fieldName}\nЗначение: ${val}`;
          if (rawVal !== val) msg += `\n(Оригинал: ${rawVal})`;
          if (useStrictLS) msg += `\n🔗 ЛС: ${lsVal}`;

          el.title = msg;
          totalDuplicates++;
          groupHasDupes = true;
        }
      });
      if (groupHasDupes) foundGroups.push(fieldName);
    });

    if (totalDuplicates === 0) {
      alert('Дубликатов не найдено.');
    } else {
      console.log(`Найдено ${totalDuplicates} дубликатов.`);
    }
  }
})();