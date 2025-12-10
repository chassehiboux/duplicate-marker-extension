(function() {
  // Этот скрипт отвечает за поиск дубликатов и "Турбо-режим".
  // Он выполняется только в основном (верхнем) фрейме страницы.
  if (window.hasDuplicateCheckerRun) return;
  window.hasDuplicateCheckerRun = true;

  const HIGHLIGHT_CLASS = 'dupe-highlight-active';
  const LS_SELECTOR = '[aria-describedby="list_AccAddress_AccountNumber"]';
  let isCopyModeEnabled = false;

  // Получаем настройку "Турбо-режима" из хранилища.
  chrome.storage.local.get(['setting_copy_mode'], (result) => {
    if (result.setting_copy_mode) isCopyModeEnabled = true;
  });
  // Слушаем изменения этой настройки.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.setting_copy_mode) isCopyModeEnabled = changes.setting_copy_mode.newValue;
  });

  // Слушаем сообщения от других частей расширения (например, от popup).
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clear') {
      clearHighlights();
    } else if (request.action === 'highlight') {
      clearHighlights();
      setTimeout(() => runCheck(request.fields, request.strictMode || {}), 50);
    }
  });

  // "Турбо-режим": обработка клика правой кнопкой мыши.
  document.addEventListener('contextmenu', async function(e) {
    if (!isCopyModeEnabled) return;
    // Вставка из буфера обмена в поле поиска.
    const searchInput = e.target.closest('input[role="search"]');
    if (searchInput) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        searchInput.value = text;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        showSuccessFeedback(searchInput);
      } catch (err) { searchInput.focus(); }
      return;
    }
    // Копирование значения ячейки таблицы в буфер обмена.
    const targetCell = e.target.closest('td[role="gridcell"]');
    if (targetCell) {
      e.preventDefault();
      const val = getSmartValue(targetCell);
      if (val) navigator.clipboard.writeText(val).then(() => showSuccessFeedback(targetCell));
    }
  }, true);

  // "Турбо-режим": выделение текста в поле поиска по клику.
  document.addEventListener('click', function(e) {
    if (!isCopyModeEnabled) return;
    const searchInput = e.target.closest('input[role="search"]');
    if (searchInput) searchInput.select();
  }, true);

  // Визуальный отклик при успешном копировании/вставке.
  function showSuccessFeedback(element) {
    const originalBg = element.style.backgroundColor;
    element.style.transition = 'background-color 0.1s ease';
    element.style.backgroundColor = '#66bb6a'; 
    if (element.tagName === 'INPUT') element.style.color = 'white';
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      if (element.tagName === 'INPUT') element.style.color = '';
    }, 200);
  }

  // "Умное" получение значения из элемента (ячейки, инпута и т.д.).
  function getSmartValue(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el.value.trim();
    const childInput = el.querySelector('input, textarea, select');
    if (childInput) return childInput.value.trim();
    return el.textContent.trim();
  }
  
  // Очистка всех подсвеченных дубликатов.
  function clearHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.style.backgroundColor = ''; el.style.outline = '';
      if (el.dataset.originalTitle) { el.title = el.dataset.originalTitle; delete el.dataset.originalTitle; }
      else if (el.title && el.title.includes('⚠️')) el.removeAttribute('title');
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  // Генерация цвета на основе текстовой строки для подсветки групп дубликатов.
  function getColorForText(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 85%, 80%)`;
  }

  // Получение связанного ЛС (лицевого счета) для элемента.
  function getLinkedLS(element) {
    const row = element.closest('tr');
    if (!row) return 'NO_ROW';
    const lsCell = row.querySelector(LS_SELECTOR);
    if (!lsCell) return 'NO_LS_CELL';
    return getSmartValue(lsCell);
  }

  // Извлечение специальных значений (например, из формата #значение#).
  function parseSpecialValue(rawVal, fieldId) {
    if (fieldId === 'list_CaseNumber' || fieldId === 'list_EDNumber') {
      const match = rawVal.match(/#(.*?)#/);
      if (match && match[1]) return match[1].trim();
    }
    return rawVal;
  }

  // Основная функция поиска дубликатов.
  function runCheck(fieldIds, strictModeOptions) {
    console.clear();
    let totalDuplicates = 0;
    let foundGroups = [];
    fieldIds.forEach(ariaId => {
      const selector = `td[role="gridcell"][aria-describedby="${ariaId}"]`;
      const elements = document.querySelectorAll(selector);
      const counts = {};
      const useStrictLS = strictModeOptions[ariaId] === true;
      const fieldName = ariaId.replace('list_', '');

      // Считаем количество вхождений каждого значения.
      elements.forEach(el => {
        let val = parseSpecialValue(getSmartValue(el), ariaId);
        if (val.length > 0) {
          let key = val;
          if (useStrictLS) key += '___' + getLinkedLS(el); // В строгом режиме ключ включает ЛС.
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      // Подсвечиваем дубликаты.
      let groupHasDupes = false;
      elements.forEach(el => {
        let rawVal = getSmartValue(el);
        let val = parseSpecialValue(rawVal, ariaId);
        if (val.length === 0) return;
        let key = val;
        let lsVal = '';
        if (useStrictLS) { lsVal = getLinkedLS(el); key += '___' + lsVal; }

        if (counts[key] > 1) {
          el.classList.add(HIGHLIGHT_CLASS);
          el.style.backgroundColor = getColorForText(key);
          el.style.outline = '2px solid red';
          if (!el.dataset.originalTitle) el.dataset.originalTitle = el.title || '';
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
    if (totalDuplicates === 0) alert('Дубликатов не найдено.');
    else console.log(`Найдено ${totalDuplicates} дубликатов.`);
  }
})();
