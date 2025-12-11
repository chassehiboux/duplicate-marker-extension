(function() {
  if (window.hasDuplicateCheckerRun) return;
  window.hasDuplicateCheckerRun = true;

  const HIGHLIGHT_CLASS = 'dupe-highlight-active';
  const LS_SELECTOR = '[aria-describedby="list_AccAddress_AccountNumber"]';
  
  let isCopyModeEnabled = false;
  let currentHighlightSettings = {};
  const allDuplicateSettingKeys = [
    'setting_highlight_mode', 'list_DebtID', 'list_AccAddress_AccountNumber',
    'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber',
    'strict_CaseNumber', 'strict_EDNumber'
  ];

  function getSmartValue(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el.value.trim();
    const childInput = el.querySelector('input, textarea, select');
    if (childInput) return childInput.value.trim();
    return el.textContent.trim();
  }
  
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

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const colorPalette = ['#FDDFDF', '#DEFDE0', '#FCF7DE', '#DEF3FD', '#F0DEFD', '#FFC8C8', '#C8FFC8', '#FFF2C8', '#C8E7FF', '#E2C8FF'];
  const outlinePalette = ['#FF8888', '#88FF88', '#FFFF88', '#88DDFF', '#DD88FF', '#FF8888', '#88FF88', '#FFFF88', '#88DDFF', '#DD88FF'];
  let colorIndex = 0;
  const colorMap = new Map();

  function clearHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.style.backgroundColor = ''; 
      el.style.outline = '';
      if (el.dataset.originalTitle) { el.title = el.dataset.originalTitle; delete el.dataset.originalTitle; }
      else if (el.title && el.title.includes('⚠️')) el.removeAttribute('title');
      el.classList.remove(HIGHLIGHT_CLASS);
    });
    colorMap.clear();
    colorIndex = 0;
  }

  function getColorForText(str) {
    if (!colorMap.has(str)) {
      colorMap.set(str, { background: colorPalette[colorIndex], outline: outlinePalette[colorIndex] });
      colorIndex = (colorIndex + 1) % colorPalette.length;
    }
    return colorMap.get(str);
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
      if (match && match[1]) return match[1].trim();
    }
    return rawVal;
  }

  function runCheck() {
    if (!currentHighlightSettings.setting_highlight_mode) { clearHighlights(); return; }
    const fieldIds = Object.keys(currentHighlightSettings).filter(k => k.startsWith('list_') && currentHighlightSettings[k]);
    const strictModeOptions = {};
    Object.keys(currentHighlightSettings).filter(k => k.startsWith('strict_') && currentHighlightSettings[k]).forEach(k => { strictModeOptions[k.replace('strict_', 'list_')] = true; });
    clearHighlights();
    fieldIds.forEach(ariaId => {
      const selector = `td[role="gridcell"][aria-describedby="${ariaId}"]`;
      const elements = document.querySelectorAll(selector);
      const counts = {};
      const useStrictLS = strictModeOptions[ariaId] === true;
      elements.forEach(el => {
        let val = parseSpecialValue(getSmartValue(el), ariaId);
        if (val.length > 0) {
          let key = val;
          if (useStrictLS) key += '___' + getLinkedLS(el);
          counts[key] = (counts[key] || 0) + 1;
        }
      });
      elements.forEach(el => {
        let rawVal = getSmartValue(el);
        let val = parseSpecialValue(rawVal, ariaId);
        if (val.length === 0) return;
        let key = val;
        let lsVal = '';
        if (useStrictLS) { lsVal = getLinkedLS(el); key += '___' + lsVal; }
        if (counts[key] > 1) {
          el.classList.add(HIGHLIGHT_CLASS);
          const colors = getColorForText(key);
          el.style.backgroundColor = colors.background;
          el.style.outline = `2px solid ${colors.outline}`;
        }
      });
    });
  }

  const debouncedRunCheck = debounce(runCheck, 500);
  
  function init() {
    chrome.storage.local.get(['setting_copy_mode', ...allDuplicateSettingKeys], (settings) => {
      isCopyModeEnabled = settings.setting_copy_mode !== false;
      currentHighlightSettings = settings;
      runCheck();
    });
  }

  // --- Логика для управления столбцами ---

  const COLUMN_STORAGE_KEY = 'hidden_columns';
  let hiddenColumns = [];

  function applyColumnState() {
    const allColumnThs = document.querySelectorAll('.ui-jqgrid-htable .ui-th-column[id^="list_"]');

    allColumnThs.forEach(th => {
      const columnId = th.id;
      if (!columnId || columnId === 'list_cb' || columnId === 'list_rn') return;

      const shouldBeHidden = hiddenColumns.includes(columnId);
      const newDisplay = shouldBeHidden ? 'none' : '';

      // 1. Применяем видимость к основному заголовку
      th.style.display = newDisplay;

      // 2. Находим ячейку в служебной строке (jqgfirstrow) для получения правильной ширины
      const headerIndex = th.cellIndex;
      let firstRowCell = null;
      let correctWidth = '';
      if (headerIndex !== -1) {
          firstRowCell = document.querySelector(`.ui-jqgrid-btable tr.jqgfirstrow > td:nth-child(${headerIndex + 1})`);
          if (firstRowCell) {
              correctWidth = firstRowCell.style.width; // Читаем каноническую ширину
              firstRowCell.style.display = newDisplay; // Также применяем видимость к этой ячейке
          }
      }
    
      // 3. Применяем видимость и ширину к заголовку фильтра
      const filterHeader = document.querySelector(`.ui-jqgrid-ftable th[aria-describedby="${columnId}"]`);
      if (filterHeader) {
        filterHeader.style.display = newDisplay;
        if (correctWidth) filterHeader.style.width = correctWidth;
      }
      
      // 4. Применяем видимость и ширину ко всем ячейкам данных
      const dataCells = document.querySelectorAll(`.ui-jqgrid-btable td[aria-describedby="${columnId}"]`);
      dataCells.forEach(cell => {
        cell.style.display = newDisplay;
        if (correctWidth) cell.style.width = correctWidth;
      });
    });
  }
  
  async function initColumnVisibility() {
    const data = await chrome.storage.local.get([COLUMN_STORAGE_KEY]);
    hiddenColumns = data[COLUMN_STORAGE_KEY] || [];
    applyColumnState();
  }

  // --- Слушатели ---

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    
    if (changes[COLUMN_STORAGE_KEY]) {
      hiddenColumns = changes[COLUMN_STORAGE_KEY].newValue || [];
      applyColumnState();
    }

    let highlightSettingsChanged = false;
    for (let key in changes) {
      if (key === 'setting_copy_mode') { isCopyModeEnabled = !!changes[key].newValue; }
      if (allDuplicateSettingKeys.includes(key)) { currentHighlightSettings[key] = changes[key].newValue; highlightSettingsChanged = true; }
    }
    if (highlightSettingsChanged) { runCheck(); }
  });

  const observer = new MutationObserver(() => {
    if (currentHighlightSettings.setting_highlight_mode) { debouncedRunCheck(); }
    applyColumnState();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // --- Турбо-режим ---
  document.addEventListener('contextmenu', async function(e) { /* ... */ });
  document.addEventListener('click', function(e) { /* ... */ });
  
  // --- Общий слушатель сообщений ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getColumns') {
      const columnThs = document.querySelectorAll('th[id^="list_"]');
      const columns = Array.from(columnThs).map(th => {
        const id = th.id;
        const isVisible = th.style.display !== 'none';
        const nameDiv = th.querySelector(`div[id="jqgh_${id}"]`);
        let name = id;
        if (nameDiv) {
            const nameNode = Array.from(nameDiv.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (nameNode && nameNode.textContent.trim()) { name = nameNode.textContent.trim(); }
        }
        return { id, name, isVisible };
      }).filter(col => col.id !== 'list_cb' && col.id !== 'list_rn' && col.id !== 'list_undefined');
      sendResponse(columns);
      return true;
    }
  });
  
  // --- Финальный запуск ---
  init();
  initColumnVisibility();

})();