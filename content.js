(function() {
  // Этот скрипт отвечает за поиск дубликатов и "Турбо-режим".
  if (window.hasDuplicateCheckerRun) return;
  window.hasDuplicateCheckerRun = true;

  const HIGHLIGHT_CLASS = 'dupe-highlight-active';
  const LS_SELECTOR = '[aria-describedby="list_AccAddress_AccountNumber"]';
  const SCREENSHOT_MODE_CLASS = 'dup-ext-screenshot-mode';
  const SCREENSHOT_HIDE_STYLE_ID = 'dup-ext-screenshot-style';
  const SCREENSHOT_HIDE_EVENT = 'dup-ext-screenshot-visibility-change';
  const SCREENSHOT_HIDE_DURATION_MS = 2500;
  const SCREENSHOT_HIDE_ON_BLUR_DURATION_MS = 2500;
  const KEY_CODE_PAGE_DOWN = 34;
  const KEY_CODE_PRINT_SCREEN = 44;
  const KEY_CODE_F8 = 119;
  const SCREENSHOT_MANUAL_KEY = 'S';
  
  let isCopyModeEnabled = false;
  let currentHighlightSettings = {};
  let screenshotHideTimer = null;
  let screenshotModeIsActive = false;
  let screenshotNewYearWasActive = false;
  let lastScreenshotTriggerAtMs = 0;
  const allDuplicateSettingKeys = [
    'setting_highlight_mode', 'list_DebtID', 'list_AccAddress_AccountNumber',
    'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber',
    'strict_CaseNumber', 'strict_EDNumber'
  ];

  // --- Утилиты ---
  
  // "Умное" получение значения из элемента.
  function getSmartValue(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el.value.trim();
    const childInput = el.querySelector('input, textarea, select');
    if (childInput) return childInput.value.trim();
    return el.textContent.trim();
  }
  
  // Визуальный отклик для Турбо-режима.
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

  function ensureScreenshotHideStyle() {
    if (document.getElementById(SCREENSHOT_HIDE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = SCREENSHOT_HIDE_STYLE_ID;
    style.textContent = `
      html.${SCREENSHOT_MODE_CLASS} .${HIGHLIGHT_CLASS} {
        background-color: transparent !important;
        outline: none !important;
      }

      html.${SCREENSHOT_MODE_CLASS} #extension-confirmation-overlay,
      html.${SCREENSHOT_MODE_CLASS} #extension-confirmation-modal-container,
      html.${SCREENSHOT_MODE_CLASS} #jqgrid-manager-btn,
      html.${SCREENSHOT_MODE_CLASS} .jq-ext-modal-overlay,
      html.${SCREENSHOT_MODE_CLASS} #support-reminder-action-menu,
      html.${SCREENSHOT_MODE_CLASS} .support-reminder-action-header,
      html.${SCREENSHOT_MODE_CLASS} .support-reminder-action-cell,
      html.${SCREENSHOT_MODE_CLASS} .ny-header-item,
      html.${SCREENSHOT_MODE_CLASS} #nySwicher,
      html.${SCREENSHOT_MODE_CLASS} .material-switch-newYear,
      html.${SCREENSHOT_MODE_CLASS} .my-super-btn,
      html.${SCREENSHOT_MODE_CLASS} #batch-inn-check-btn,
      html.${SCREENSHOT_MODE_CLASS} #inn-toast-container,
      html.${SCREENSHOT_MODE_CLASS} #inn-batch-modal-overlay,
      html.${SCREENSHOT_MODE_CLASS} .ny-snow-container,
      html.${SCREENSHOT_MODE_CLASS} .ny-garland-container,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer {
        display: none !important;
      }

      html.${SCREENSHOT_MODE_CLASS} tr.support-reminder-highlight,
      html.${SCREENSHOT_MODE_CLASS} tr.support-reminder-highlight > td {
        background-color: transparent !important;
      }

      html.${SCREENSHOT_MODE_CLASS} .ny-element,
      html.${SCREENSHOT_MODE_CLASS} .snowflake {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function broadcastScreenshotMode(hidden, source) {
    try {
      window.dispatchEvent(new CustomEvent(SCREENSHOT_HIDE_EVENT, {
        detail: { hidden: !!hidden, source: source || 'unknown' }
      }));
    } catch (err) {
      // ignore
    }
  }

  function toggleNewYearThemeForScreenshot(hidden) {
    const body = document.body;
    if (!body) return;

    if (hidden) {
      screenshotNewYearWasActive = body.classList.contains('ny-active');
      if (screenshotNewYearWasActive) {
        body.classList.remove('ny-active');
      }
      return;
    }

    if (screenshotNewYearWasActive) {
      body.classList.add('ny-active');
    }
    screenshotNewYearWasActive = false;
  }

  function setScreenshotMode(hidden, source) {
    const root = document.documentElement;
    if (!root) return;

    const nextState = !!hidden;
    if (nextState === screenshotModeIsActive) return;

    screenshotModeIsActive = nextState;
    toggleNewYearThemeForScreenshot(nextState);
    root.classList.toggle(SCREENSHOT_MODE_CLASS, nextState);
    broadcastScreenshotMode(nextState, source);
  }

  function scheduleScreenshotHide(source) {
    ensureScreenshotHideStyle();
    setScreenshotMode(true, source);

    if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
    screenshotHideTimer = setTimeout(() => {
      screenshotHideTimer = null;
      setScreenshotMode(false, 'timeout');
    }, SCREENSHOT_HIDE_DURATION_MS);
  }

  function resolveScreenshotTriggerKey(event) {
    const key = String(event.key || '');
    const code = String(event.code || '');
    const upperKey = key.toUpperCase();
    const keyCode = Number(event.keyCode || event.which || 0);

    if (event.ctrlKey && event.shiftKey && (upperKey === SCREENSHOT_MANUAL_KEY || code === 'KeyS')) {
      return 'ManualHide';
    }

    if (
      key === 'PageDown' || code === 'PageDown' ||
      key === 'PgDown' || code === 'PgDown' ||
      key === 'Next' || code === 'Next' ||
      keyCode === KEY_CODE_PAGE_DOWN
    ) {
      return 'PageDown';
    }

    if (
      key === 'PrintScreen' || code === 'PrintScreen' ||
      key === 'PrtSc' || code === 'PrtSc' ||
      key === 'Print' || code === 'Print' ||
      key === 'PrintScrn' || code === 'PrintScrn' ||
      key === 'Snapshot' || code === 'Snapshot' ||
      key === 'SysRq' || code === 'SysRq' ||
      key === 'ScreenCapture' || code === 'ScreenCapture' ||
      keyCode === KEY_CODE_PRINT_SCREEN ||
      key === 'F8' || code === 'F8' || keyCode === KEY_CODE_F8
    ) {
      return 'PrintScreen';
    }

    return '';
  }

  function handleScreenshotHotkey(event) {
    const triggerKey = resolveScreenshotTriggerKey(event);
    if (!triggerKey) return;
    if (event.type === 'keydown' && event.repeat) return;

    const nowMs = Date.now();
    if ((nowMs - lastScreenshotTriggerAtMs) < 150) return;
    lastScreenshotTriggerAtMs = nowMs;
    scheduleScreenshotHide(`hotkey:${triggerKey}:${event.type}`);
  }

  function initScreenshotHideMode() {
    ensureScreenshotHideStyle();
    document.addEventListener('keydown', handleScreenshotHotkey, true);
    document.addEventListener('keyup', handleScreenshotHotkey, true);
    window.addEventListener('blur', () => {
      if (!screenshotModeIsActive) return;
      if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
      screenshotHideTimer = setTimeout(() => {
        screenshotHideTimer = null;
        setScreenshotMode(false, 'blur-timeout');
      }, SCREENSHOT_HIDE_ON_BLUR_DURATION_MS);
    });
  }

  // --- Логика подсветки дублей ---

  const colorPalette = [
    '#FDDFDF', '#DEFDE0', '#FCF7DE', '#DEF3FD', '#F0DEFD',
    '#FFC8C8', '#C8FFC8', '#FFF2C8', '#C8E7FF', '#E2C8FF',
  ];
  // Brighter versions for the outline, chosen to stand out more.
  const outlinePalette = [
    '#FF8888', '#88FF88', '#FFFF88', '#88DDFF', '#DD88FF',
    '#FF8888', '#88FF88', '#FFFF88', '#88DDFF', '#DD88FF',
  ];
  let colorIndex = 0;
  const colorMap = new Map();

  function clearHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.style.backgroundColor = ''; 
      el.style.outline = ''; // Clear the outline style
      if (el.dataset.originalTitle) { el.title = el.dataset.originalTitle; delete el.dataset.originalTitle; }
      else if (el.title && el.title.includes('⚠️')) el.removeAttribute('title');
      el.classList.remove(HIGHLIGHT_CLASS);
    });
    colorMap.clear();
    colorIndex = 0;
  }

  function getColorForText(str) {
    if (!colorMap.has(str)) {
      colorMap.set(str, {
        background: colorPalette[colorIndex],
        outline: outlinePalette[colorIndex]
      });
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
    // Если режим подсветки выключен, просто очищаем и выходим.
    if (!currentHighlightSettings.setting_highlight_mode) {
      clearHighlights();
      return;
    }

    const fieldIds = Object.keys(currentHighlightSettings).filter(k => k.startsWith('list_') && currentHighlightSettings[k]);
    const strictModeOptions = {};
    Object.keys(currentHighlightSettings)
      .filter(k => k.startsWith('strict_') && currentHighlightSettings[k])
      .forEach(k => { strictModeOptions[k.replace('strict_', 'list_')] = true; });

    clearHighlights(); // Очищаем перед новым поиском
    
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

  // --- Инициализация и слушатели ---
  
  // Загружаем все настройки при старте
  function init() {
    chrome.storage.local.get(['setting_copy_mode', ...allDuplicateSettingKeys], (settings) => {
      isCopyModeEnabled = settings.setting_copy_mode !== false; // Включен по умолчанию
      currentHighlightSettings = settings;
      runCheck(); // Первый запуск при загрузке страницы
    });
  }

  // Слушаем изменения в хранилище (от popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let highlightSettingsChanged = false;
    for (let key in changes) {
      if (key === 'setting_copy_mode') {
        isCopyModeEnabled = !!changes[key].newValue;
      }
      if (allDuplicateSettingKeys.includes(key)) {
        currentHighlightSettings[key] = changes[key].newValue;
        highlightSettingsChanged = true;
      }
    }
    if (highlightSettingsChanged) {
      // Немедленно запускаем проверку, если изменились настройки
      runCheck();
    }
  });

  // Запускаем проверку при изменениях на странице (динамический контент)
  const observer = new MutationObserver(() => {
    if (currentHighlightSettings.setting_highlight_mode) {
      debouncedRunCheck();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });


  // --- Турбо-режим (без изменений) ---
  document.addEventListener('contextmenu', async function(e) {
    if (!isCopyModeEnabled) return;
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
    const targetCell = e.target.closest('td[role="gridcell"]');
    if (targetCell) {
      e.preventDefault();
      const val = getSmartValue(targetCell);
      if (val) navigator.clipboard.writeText(val).then(() => showSuccessFeedback(targetCell));
    }
  }, true);

  document.addEventListener('click', function(e) {
    if (!isCopyModeEnabled) return;
    const searchInput = e.target.closest('input[role="search"]');
    if (searchInput) searchInput.select();
  }, true);
  
  // --- Подсветка строк/колонок в Google Sheets (без изменений) ---
  if (window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/')) {
    // ... (код без изменений)
  }

  // Запуск
  initScreenshotHideMode();
  init();

  // --- Логика модального окна для подтверждения действий ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'show_confirmation_modal_in_tab') {
          // Удаляем старые модалки, если они есть
          const existingModal = document.getElementById('extension-confirmation-modal-container');
          if (existingModal) {
              existingModal.remove();
          }
          const existingOverlay = document.getElementById('extension-confirmation-overlay');
          if (existingOverlay) {
              existingOverlay.remove();
          }

          const { path, edocid } = message.data;

          // Создаем элементы модального окна
          const modalOverlay = document.createElement('div');
          modalOverlay.id = 'extension-confirmation-overlay';
          modalOverlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background-color: rgba(0, 0, 0, 0.5);
              z-index: 2147483646 !important;
          `;

          const modalContainer = document.createElement('div');
          modalContainer.id = 'extension-confirmation-modal-container';
          modalContainer.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 2147483647 !important;
              background-color: #fff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.2);
              width: 400px;
              max-width: 90%;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          `;

          const modalText = document.createElement('p');
          modalText.textContent = `Вы хотите разрешить счётчику учитывать действие данной кнопки?\nДействие: ${path}`;
          modalText.style.margin = '0 0 15px 0';
          modalText.style.wordBreak = 'break-word';

          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px;';

          const createButton = (text, type = 'primary') => {
              const button = document.createElement('button');
              button.textContent = text;
              button.style.cssText = `
                  padding: 8px 15px;
                  border: 1px solid #ccc;
                  border-radius: 5px;
                  cursor: pointer;
                  background-color: ${type === 'primary' ? '#007bff' : (type === 'danger' ? '#dc3545' : '#f8f9fa')};
                  color: ${type === 'primary' || type === 'danger' ? '#fff' : '#212529'};
                  border-color: ${type === 'primary' ? '#007bff' : (type === 'danger' ? '#dc3545' : '#ccc')};
              `;
              return button;
          };
          
          const removeModals = () => {
              modalOverlay.remove();
              modalContainer.remove();
          }

          const saveButton = createButton('Сохранить', 'primary');
          const blockButton = createButton('Заблокировать', 'danger');
          const cancelButton = createButton('Пропустить', 'secondary');

          // Обработчики кнопок
          saveButton.addEventListener('click', () => {
              removeModals(); // Сначала убираем нашу модалку
              const tag = prompt('Придумайте понятное название для этого действия (например, "Сохранить отчет"):', '');
              // Если пользователь нажал "ОК" (даже с пустым полем), а не "Отмена"
              if (tag !== null) {
                  chrome.runtime.sendMessage({
                      action: 'approve_action',
                      data: { path, edocid, tag: tag.trim() }
                  });
              }
          });

          blockButton.addEventListener('click', () => {
              removeModals(); // Сначала убираем нашу модалку
              const tag = prompt('Придумайте название для этого заблокированного действия (необязательно):', '');
               // Если пользователь нажал "ОК", а не "Отмена"
              if (tag !== null) {
                  chrome.runtime.sendMessage({ 
                      action: 'block_action', 
                      data: { path, edocid, tag: tag.trim() } 
                  });
              }
          });

          cancelButton.addEventListener('click', () => {
              chrome.runtime.sendMessage({
                  action: 'cancel_pending_action',
                  data: { path, edocid }
              });
              removeModals();
          });

          // Собираем модальное окно
          buttonContainer.append(cancelButton, blockButton, saveButton);
          modalContainer.append(modalText, buttonContainer);
          
          document.body.appendChild(modalOverlay);
          document.body.appendChild(modalContainer);

          sendResponse({ success: true });
      }
      return true; // Keep the message channel open for async response
  });
})();
