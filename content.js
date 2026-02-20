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
  const STAGE_JUMP_HASH_KEY = 'dup_stage_jump_debtid';
  const STAGE_JUMP_BUTTON_CLASS = 'dup-stage-jump-btn';
  const STAGE_JUMP_BUTTON_LABEL = '↔';
  const STAGE_JUMP_BUTTON_TEXT = 'Перейти на стадию ИД';
  const STAGE_JUMP_BUTTON_MARK_ATTR = 'data-dup-stage-jump-btn';
  const STAGE_JUMP_STYLE_ID = 'dup-stage-jump-style';
  const STAGE_JUMP_COLUMN_ARIA = 'list_dupStageJump';
  const STAGE_JUMP_COLUMN_HEADER_ID = 'jqgh_list_dupStageJump';
  const STAGE_JUMP_COLUMN_WIDTH_PX = '30px';
  const STAGE_JUMP_COLUMN_MARK_ATTR = 'data-dup-stage-jump-col';
  const STAGE_JUMP_STORAGE_KEY = 'dup_stage_jump_pending';
  const STAGE_JUMP_STORAGE_TTL_MS = 2 * 60 * 1000;
  const STAGE_JUMP_SLOWSEARCH_PATH = '/bus/slowsearch';
  const STAGE_JUMP_MENU_CLASS = 'dup-stage-jump-menu';
  const STAGE_JUMP_MENU_ITEM_CLASS = 'dup-stage-jump-menu-item';
  const STAGE_JUMP_MENU_ACTION_ATTR = 'data-dup-stage-jump-action';
  const STAGE_JUMP_MENU_ACTION_SLOWSEARCH = 'to_slowsearch';
  const STAGE_JUMP_MENU_ACTION_STAGE = 'to_stage';
  const STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT = 'Переход в Глобальный поиск';
  const STAGE_JUMP_MENU_ITEM_STAGE_TEXT = 'Переход к ИД на стадии';
  const SLOWSEARCH_TARGET_PATH = '/ovzid/status/all';
  const SLOWSEARCH_JUMP_BUTTON_TEXT = 'Перейти в ОВЗИД (status/all)';
  const SLOWSEARCH_JUMP_MARK_ATTR = 'data-dup-slowsearch-jump';
  const SLOWSEARCH_CITIES_TOGGLE_SELECTOR = 'button.btn-cities.dropdown-toggle';
  const SLOWSEARCH_CITIES_LINK_SELECTOR = 'a.department-switch';
  // Статическая карта стадий/статусов ВЗИД, зафиксированная по меню блока ВЗИД.
  const STAGE_JUMP_STATIC_MENU_LINKS = [
    { path: ['ИД принятые в работу из ПУ (новые)'], href: '/ovzid/status/32' },
    { path: ['Подлежат повторному предъявлению'], href: '/ovzid/stage/100000' },
    { path: ['Подлежат повторному предъявлению', 'ИД, возвращенные из ПФ'], href: '/ovzid/status/100053' },
    { path: ['Подлежат повторному предъявлению', 'ИД, возвращенные из СБ'], href: '/ovzid/status/100064' },
    { path: ['Подлежат повторному предъявлению', 'ИД, оконченные БИ'], href: '/ovzid/status/100065' },
    { path: ['Подлежат повторному предъявлению', 'ИД, возвращенные из ФССП (иные основания)'], href: '/ovzid/status/100066' },
    { path: ['Подлежат повторному предъявлению', 'Солидарщики без РС и ДР'], href: '/ovzid/status/100072' },
    { path: ['Подлежат повторному предъявлению', 'Солидарники в ОВЗИД (др. на прин. исп.)'], href: '/ovzid/status/100142' },
    { path: ['Подлежат повторному предъявлению', 'Возвращенные из иных органов ПИ'], href: '/ovzid/status/100097' },
    { path: ['ОВЗИД', 'Пенсионеры 65+'], href: '/ovzid/status/100143' },
    { path: ['ЭДО Сбербанк', 'Ожидают ответа из СБ'], href: '/ovzid/status/100071' },
    { path: ['ЭДО Сбербанк', 'Проверено СБ'], href: '/ovzid/status/100073' },
    { path: ['ЭДО ПФ', 'Направлен запрос'], href: '/ovzid/status/100257' },
    { path: ['ЭДО ПФ', 'Подготовка ИД к отправке'], href: '/ovzid/status/100258' },
    { path: ['ЭДО ПФ', 'Проверено ПФ'], href: '/ovzid/status/100259' },
    { path: ['Пенсионный фонд'], href: '/ovzid/status/100056' },
    { path: ['Сбербанк'], href: '/ovzid/status/100074' },
    { path: ['ФССП'], href: '/ovzid/stage/21' },
    { path: ['ФССП', 'Направлены на исполнение (нет возбуждения)'], href: '/ovzid/status/33' },
    { path: ['ФССП', 'В исполнении (возбуждены ИП)'], href: '/ovzid/status/100057' },
    { path: ['ФССП', 'ИП окончено БИ (ждем возврата ИД)'], href: '/ovzid/status/100058' },
    { path: ['Иные органы ПИ'], href: '/ovzid/status/100095' },
    { path: ['Ошибки ПК после прин. исполнения', 'Исполнено ПФ'], href: '/ovzid/status/100059' },
    { path: ['Ошибки ПК после прин. исполнения', 'Исполнено СБ'], href: '/ovzid/status/100060' },
    { path: ['Ошибки ПК после прин. исполнения', 'Исполнено иными органами ПИ'], href: '/ovzid/status/100096' },
    { path: ['Ошибки ПК после прин. исполнения', 'Окончено фактом ФССП'], href: '/ovzid/status/100061' },
    { path: ['Ошибки ПК после прин. исполнения', 'В работе ЦОП'], href: '/ovzid/status/100170' },
    { path: ['Ошибки ПК после прин. исполнения', 'ТП АСРН'], href: '/ovzid/status/100171' },
    { path: ['Ошибки ПК после прин. исполнения', 'ТП Пирамида'], href: '/ovzid/status/100172' },
    { path: ['Ошибки ПК после прин. исполнения', 'Возобновление ИП (ожидаем ответ от ФССП)'], href: '/ovzid/status/100175' },
    { path: ['Ошибки ПК после прин. исполнения', 'ИП Прекращено ФССП'], href: '/ovzid/status/100062' },
    { path: ['Рассрочка/отсрочка'], href: '/ovzid/status/100010' },
    { path: ['Архив', 'Условно оплаченные'], href: '/ovzid/status/100119' },
    { path: ['Архив', 'Оплачено, ожидают подтверждения'], href: '/ovzid/status/100252' },
    { path: ['Архив', 'Дело закрыто'], href: '/ovzid/status/100048' },
    { path: ['Архив', 'Отмена ИД'], href: '/ovzid/status/100049' },
    { path: ['Архив', 'Невыясненные'], href: '/ovzid/status/100051' },
    { path: ['Архив', 'ТЭЦ Курган'], href: '/ovzid/status/100052' },
    { path: ['Архив', 'Прекращено'], href: '/ovzid/status/100091' },
    { path: ['Архив', 'Дело закрыто (ИД из БФЛ)'], href: '/ovzid/status/100137' },
    { path: ['Архив', 'Банкроты'], href: '/ovzid/status/100210' },
    { path: ['Архив', 'Повторное просуживание'], href: '/ovzid/status/100212' },
    { path: ['Архив', 'Солидарники умершие и ненадлежащие'], href: '/ovzid/status/100211' },
    { path: ['Архив', 'Дольщики ненадлежащие'], href: '/ovzid/status/100267' },
    { path: ['Архив', 'Мобилизованные'], href: '/ovzid/status/100260' },
    { path: ['Архив', 'Погорельцы'], href: '/ovzid/status/100274' },
    { path: ['Архив', 'Сторнирование'], href: '/ovzid/status/100303' },
    { path: ['Архив', 'Пострадавшие от паводка'], href: '/ovzid/status/100293' },
    { path: ['ОВЗИД', 'Корзина'], href: '/ovzid/status/100063' }
  ];
  
  let isCopyModeEnabled = false;
  let currentHighlightSettings = {};
  let screenshotHideTimer = null;
  let screenshotModeIsActive = false;
  let screenshotNewYearWasActive = false;
  let lastScreenshotTriggerAtMs = 0;
  let stageJumpCachedMenuIndex = null;
  let stageJumpActionMenuEl = null;
  let stageJumpActionMenuAnchor = null;
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

  function isDomNode(target) {
    return !!target && typeof target === 'object' && typeof target.nodeType === 'number';
  }

  function observeWithRetry(observer, getTarget, options, maxAttempts, intervalMs) {
    if (!observer || typeof observer.observe !== 'function') return;
    if (typeof getTarget !== 'function') return;

    const safeMaxAttempts = Number(maxAttempts) > 0 ? Number(maxAttempts) : 80;
    const safeIntervalMs = Number(intervalMs) > 0 ? Number(intervalMs) : 120;
    let isAttached = false;

    const tryAttach = () => {
      if (isAttached) return true;
      let target = null;
      try {
        target = getTarget();
      } catch (error) {
        target = null;
      }
      if (!isDomNode(target)) return false;

      try {
        observer.observe(target, options);
        isAttached = true;
        return true;
      } catch (error) {
        return false;
      }
    };

    if (tryAttach()) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (tryAttach() || attempts >= safeMaxAttempts) {
        clearInterval(timer);
      }
    }, safeIntervalMs);
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
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer-toggle,
      html.${SCREENSHOT_MODE_CLASS} .pyramid-stage-timer-toggle-btn,
      html.${SCREENSHOT_MODE_CLASS} .${STAGE_JUMP_BUTTON_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${STAGE_JUMP_MENU_CLASS},
      html.${SCREENSHOT_MODE_CLASS} [${STAGE_JUMP_BUTTON_MARK_ATTR}="1"],
      html.${SCREENSHOT_MODE_CLASS} [title="Скрыть таймер"],
      html.${SCREENSHOT_MODE_CLASS} [aria-label="Скрыть таймер"],
      html.${SCREENSHOT_MODE_CLASS} [title="Показать таймер"],
      html.${SCREENSHOT_MODE_CLASS} [aria-label="Показать таймер"] {
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
  observeWithRetry(
    observer,
    () => document.body || document.documentElement,
    { childList: true, subtree: true },
    120,
    100
  );


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

  // --- Переход на стадию ИД ---
  function normalizeStageJumpText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[,.;:!?()"`'«»\[\]{}]/g, ' ')
      .replace(/\bоконченые\b/g, 'оконченные')
      .replace(/\bвовзращенн/g, 'возвращенн')
      .replace(/\bвозвращеные\b/g, 'возвращенные')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isStageJumpSourcePage() {
    const pathname = String(window.location.pathname || '');
    return pathname.includes('/ovzid/status/all');
  }

  function isSlowsearchSourcePage() {
    const pathname = String(window.location.pathname || '');
    return pathname.includes('/bus/slowsearch') || pathname.includes('/datagrids/slowsearch');
  }

  function getSlowsearchDepartmentSwitchLinks() {
    return Array.from(document.querySelectorAll(SLOWSEARCH_CITIES_LINK_SELECTOR))
      .filter((link) => link instanceof HTMLAnchorElement);
  }

  function getSlowsearchDepartmentCurrentName() {
    const activeLink = document.querySelector(`${SLOWSEARCH_CITIES_LINK_SELECTOR}.active`);
    if (activeLink) {
      const activeText = String(activeLink.textContent || '').replace(/\s+/g, ' ').trim();
      if (activeText) return activeText;
    }

    const citiesToggle = document.querySelector(SLOWSEARCH_CITIES_TOGGLE_SELECTOR);
    if (!citiesToggle) return '';

    return String(citiesToggle.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/[▼▾]\s*$/, '')
      .trim();
  }

  function buildSlowsearchTargetUrlFromDepartment(rowDepartmentName) {
    const normalizedTargetDepartment = normalizeStageJumpText(rowDepartmentName);
    if (!normalizedTargetDepartment) return SLOWSEARCH_TARGET_PATH;

    const links = getSlowsearchDepartmentSwitchLinks();
    if (links.length === 0) {
      console.warn('[SlowSearchJump] Не найдены пункты департаментов в btn-cities.');
      return SLOWSEARCH_TARGET_PATH;
    }

    const targetLink = links.find((link) => (
      normalizeStageJumpText(String(link.textContent || '')) === normalizedTargetDepartment
    ));
    if (!targetLink) {
      console.warn('[SlowSearchJump] Не найден департамент в btn-cities: ' + rowDepartmentName);
      return '';
    }

    const href = String(targetLink.getAttribute('href') || '').trim();
    if (!href) {
      console.warn('[SlowSearchJump] Пустой href у департамента: ' + rowDepartmentName);
      return '';
    }

    try {
      const targetUrl = new URL(href, window.location.origin);
      const departmentPathMatch = String(targetUrl.pathname || '').match(/^(.*?\/login\/department\/\d+)(?:\/.*)?$/);
      if (departmentPathMatch) {
        targetUrl.pathname = `${departmentPathMatch[1]}${SLOWSEARCH_TARGET_PATH}`;
      } else {
        targetUrl.pathname = SLOWSEARCH_TARGET_PATH;
      }
      return targetUrl.toString();
    } catch (error) {
      console.warn('[SlowSearchJump] Некорректный URL департамента: ' + href, error);
      return '';
    }
  }

  function ensureSlowsearchDepartmentMatch(rowDepartmentName) {
    const normalizedTargetDepartment = normalizeStageJumpText(rowDepartmentName);
    if (!normalizedTargetDepartment) return SLOWSEARCH_TARGET_PATH;

    const currentDepartmentName = getSlowsearchDepartmentCurrentName();
    const normalizedCurrentDepartment = normalizeStageJumpText(currentDepartmentName);
    if (normalizedCurrentDepartment && normalizedCurrentDepartment !== normalizedTargetDepartment) {
      console.info(
        '[SlowSearchJump] Используем департамент из btn-cities: "' +
        currentDepartmentName +
        '" -> "' +
        rowDepartmentName +
        '".'
      );
    }

    return buildSlowsearchTargetUrlFromDepartment(rowDepartmentName);
  }

  function getStageJumpTokens(value) {
    const normalized = normalizeStageJumpText(value);
    if (!normalized) return [];
    return normalized.split(' ').filter(token => token.length > 1);
  }

  function getRowCellTextByAria(row, ariaId) {
    if (!row || !ariaId) return '';
    const cell = row.querySelector(`td[aria-describedby="${ariaId}"]`);
    return cell ? String(cell.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function setFixedWidthStyle(element, widthPx) {
    if (!element || !widthPx) return;
    element.style.setProperty('min-width', widthPx, 'important');
    element.style.setProperty('width', widthPx, 'important');
    element.style.setProperty('max-width', widthPx, 'important');
  }

  function getStageJumpHeaderTable() {
    return document.querySelector('#gview_list .ui-jqgrid-hdiv table.ui-jqgrid-htable');
  }

  function getStageJumpBodyTable() {
    return document.getElementById('list');
  }

  function setStageJumpCellDisplayLikeReference(cell, referenceCell) {
    if (!cell) return;
    if (!referenceCell || !referenceCell.style) {
      cell.style.removeProperty('display');
      return;
    }
    const displayValue = String(referenceCell.style.display || '');
    if (!displayValue) {
      cell.style.removeProperty('display');
      return;
    }
    cell.style.setProperty('display', displayValue, 'important');
  }

  function createStageJumpHeaderCell(templateCell) {
    const th = document.createElement('th');
    th.id = STAGE_JUMP_COLUMN_ARIA;
    th.className = templateCell ? String(templateCell.className || '') : 'ui-th-column ui-th-ltr';
    th.style.cssText = templateCell ? String(templateCell.getAttribute('style') || '') : '';
    setFixedWidthStyle(th, STAGE_JUMP_COLUMN_WIDTH_PX);
    th.setAttribute('width', '30');
    th.style.setProperty('text-align', 'center', 'important');

    const titleDiv = document.createElement('div');
    titleDiv.id = STAGE_JUMP_COLUMN_HEADER_ID;
    titleDiv.setAttribute('role', 'columnheader');
    th.appendChild(titleDiv);
    return th;
  }

  function createStageJumpSearchCell(templateCell) {
    const th = document.createElement('th');
    th.setAttribute('role', 'gridcell');
    th.setAttribute('aria-describedby', STAGE_JUMP_COLUMN_ARIA);
    th.className = templateCell ? String(templateCell.className || '') : 'ui-th-column ui-th-ltr';
    th.style.cssText = templateCell ? String(templateCell.getAttribute('style') || '') : '';
    setFixedWidthStyle(th, STAGE_JUMP_COLUMN_WIDTH_PX);
    th.setAttribute('width', '30');
    th.style.setProperty('text-align', 'center', 'important');

    const wrapperDiv = document.createElement('div');
    th.appendChild(wrapperDiv);
    return th;
  }

  function getStageJumpDebtColumnIndex() {
    const headerTable = getStageJumpHeaderTable();
    if (!headerTable) return -1;

    const labelsRow = headerTable.querySelector('thead tr.ui-jqgrid-labels');
    if (!labelsRow) return -1;

    const debtHeaderCell = labelsRow.querySelector('th#list_DebtID');
    if (!debtHeaderCell) return -1;

    return Array.from(labelsRow.children).indexOf(debtHeaderCell);
  }

  function ensureStageJumpCellForBodyRow(row, debtColumnIndex) {
    if (!row) return null;

    const debtCell = row.querySelector('td[aria-describedby="list_DebtID"]');
    const fallbackBeforeCell = (!debtCell && debtColumnIndex >= 0 && row.children.length > debtColumnIndex)
      ? row.children[debtColumnIndex]
      : null;
    const beforeCell = debtCell || fallbackBeforeCell;

    let stageCell = row.querySelector(`td[${STAGE_JUMP_COLUMN_MARK_ATTR}="1"]`) ||
      row.querySelector(`td[aria-describedby="${STAGE_JUMP_COLUMN_ARIA}"]`);

    if (!stageCell) {
      stageCell = document.createElement('td');
      if (beforeCell) {
        row.insertBefore(stageCell, beforeCell);
      } else {
        row.appendChild(stageCell);
      }
    } else if (beforeCell && stageCell.nextElementSibling !== beforeCell) {
      row.insertBefore(stageCell, beforeCell);
    }

    const isFirstRow = row.classList.contains('jqgfirstrow');
    stageCell.setAttribute(STAGE_JUMP_COLUMN_MARK_ATTR, '1');
    if (isFirstRow) {
      stageCell.removeAttribute('aria-describedby');
      stageCell.style.setProperty('height', '0', 'important');
    } else {
      stageCell.setAttribute('aria-describedby', STAGE_JUMP_COLUMN_ARIA);
    }

    if (!stageCell.className && beforeCell && beforeCell.className) {
      stageCell.className = beforeCell.className;
    }

    setFixedWidthStyle(stageCell, STAGE_JUMP_COLUMN_WIDTH_PX);
    stageCell.setAttribute('width', '30');
    stageCell.style.setProperty('text-align', 'center', 'important');
    stageCell.style.setProperty('white-space', 'nowrap', 'important');
    stageCell.style.setProperty('overflow', 'visible', 'important');
    setStageJumpCellDisplayLikeReference(stageCell, beforeCell);

    return stageCell;
  }

  function ensureStageJumpDedicatedColumn() {
    const headerTable = getStageJumpHeaderTable();
    const bodyTable = getStageJumpBodyTable();
    if (!headerTable || !bodyTable) return null;

    const labelsRow = headerTable.querySelector('thead tr.ui-jqgrid-labels');
    const searchRow = headerTable.querySelector('thead tr.ui-search-toolbar');
    if (!labelsRow || !searchRow) return null;

    const debtHeaderCell = labelsRow.querySelector('th#list_DebtID');
    const debtSearchCell = searchRow.querySelector('th[aria-describedby="list_DebtID"]');
    if (!debtHeaderCell || !debtSearchCell) return null;

    let stageHeaderCell = labelsRow.querySelector(`th#${STAGE_JUMP_COLUMN_ARIA}`);
    if (!stageHeaderCell) {
      stageHeaderCell = createStageJumpHeaderCell(debtHeaderCell);
      labelsRow.insertBefore(stageHeaderCell, debtHeaderCell);
    } else if (stageHeaderCell.nextElementSibling !== debtHeaderCell) {
      labelsRow.insertBefore(stageHeaderCell, debtHeaderCell);
    }
    setFixedWidthStyle(stageHeaderCell, STAGE_JUMP_COLUMN_WIDTH_PX);
    stageHeaderCell.setAttribute('width', '30');
    stageHeaderCell.style.setProperty('text-align', 'center', 'important');
    setStageJumpCellDisplayLikeReference(stageHeaderCell, debtHeaderCell);

    let stageHeaderCaption = stageHeaderCell.querySelector('div');
    if (!stageHeaderCaption) {
      stageHeaderCaption = document.createElement('div');
      stageHeaderCell.appendChild(stageHeaderCaption);
    }
    stageHeaderCaption.id = STAGE_JUMP_COLUMN_HEADER_ID;
    stageHeaderCaption.setAttribute('role', 'columnheader');
    stageHeaderCaption.textContent = '';
    setFixedWidthStyle(stageHeaderCaption, STAGE_JUMP_COLUMN_WIDTH_PX);

    let stageSearchCell = searchRow.querySelector(`th[aria-describedby="${STAGE_JUMP_COLUMN_ARIA}"]`);
    if (!stageSearchCell) {
      stageSearchCell = createStageJumpSearchCell(debtSearchCell);
      searchRow.insertBefore(stageSearchCell, debtSearchCell);
    } else if (stageSearchCell.nextElementSibling !== debtSearchCell) {
      searchRow.insertBefore(stageSearchCell, debtSearchCell);
    }
    setFixedWidthStyle(stageSearchCell, STAGE_JUMP_COLUMN_WIDTH_PX);
    stageSearchCell.setAttribute('width', '30');
    stageSearchCell.style.setProperty('text-align', 'center', 'important');
    setStageJumpCellDisplayLikeReference(stageSearchCell, debtSearchCell);

    let stageSearchWrapper = stageSearchCell.querySelector(':scope > div');
    if (!stageSearchWrapper) {
      stageSearchWrapper = document.createElement('div');
      stageSearchCell.appendChild(stageSearchWrapper);
    } else {
      stageSearchWrapper.textContent = '';
    }

    const debtColumnIndex = getStageJumpDebtColumnIndex();
    const bodyRows = Array.from(bodyTable.querySelectorAll('tbody > tr'));
    bodyRows.forEach((row) => ensureStageJumpCellForBodyRow(row, debtColumnIndex));

    return { debtColumnIndex };
  }

  function cleanupLegacyStageJumpColumn() {
    const headerTable = getStageJumpHeaderTable();
    if (headerTable) {
      const labelsRow = headerTable.querySelector('thead tr.ui-jqgrid-labels');
      const searchRow = headerTable.querySelector('thead tr.ui-search-toolbar');

      if (labelsRow) {
        const stageHeader = labelsRow.querySelector(`th#${STAGE_JUMP_COLUMN_ARIA}`);
        if (stageHeader) stageHeader.remove();
      }

      if (searchRow) {
        const stageSearch = searchRow.querySelector(`th[aria-describedby="${STAGE_JUMP_COLUMN_ARIA}"]`);
        if (stageSearch) stageSearch.remove();
      }
    }

    const bodyTable = getStageJumpBodyTable();
    if (bodyTable) {
      const legacyCells = bodyTable.querySelectorAll(
        `td[aria-describedby="${STAGE_JUMP_COLUMN_ARIA}"], td[${STAGE_JUMP_COLUMN_MARK_ATTR}="1"]`
      );
      legacyCells.forEach((cell) => cell.remove());
    }
  }

  function buildStageJumpMenuIndex(items) {
    if (!Array.isArray(items) || items.length === 0) return null;

    const pairExact = new Map();
    const pairNormalized = new Map();
    const stageExact = new Map();
    const stageNormalized = new Map();
    const statusByStageNormalized = new Map();

    items.forEach((item) => {
      const path = Array.isArray(item.path) ? item.path : [];
      if (path.length === 0 || !item.href) return;

      if (path.length === 1) {
        const stageName = path[0];
        const normalizedStage = normalizeStageJumpText(stageName);
        if (!stageExact.has(stageName)) stageExact.set(stageName, item);
        if (!stageNormalized.has(normalizedStage)) stageNormalized.set(normalizedStage, item);
        return;
      }

      const stageName = path[path.length - 2];
      const statusName = path[path.length - 1];
      const normalizedStage = normalizeStageJumpText(stageName);
      const normalizedStatus = normalizeStageJumpText(statusName);

      const enrichedItem = {
        ...item,
        stageName,
        statusName,
        normalizedStage,
        normalizedStatus,
        pathText: path.join(' > ')
      };

      const exactKey = `${stageName}|||${statusName}`;
      if (!pairExact.has(exactKey)) pairExact.set(exactKey, enrichedItem);

      const normalizedKey = `${normalizedStage}|||${normalizedStatus}`;
      if (!pairNormalized.has(normalizedKey)) pairNormalized.set(normalizedKey, enrichedItem);

      if (!statusByStageNormalized.has(normalizedStage)) {
        statusByStageNormalized.set(normalizedStage, []);
      }
      statusByStageNormalized.get(normalizedStage).push(enrichedItem);
    });

    return {
      pairExact,
      pairNormalized,
      stageExact,
      stageNormalized,
      statusByStageNormalized
    };
  }

  function getStageJumpMenuIndex() {
    if (stageJumpCachedMenuIndex) return stageJumpCachedMenuIndex;
    stageJumpCachedMenuIndex = buildStageJumpMenuIndex(STAGE_JUMP_STATIC_MENU_LINKS);
    return stageJumpCachedMenuIndex;
  }

  function getStageJumpStatusSimilarityScore(left, right) {
    const leftNormalized = normalizeStageJumpText(left);
    const rightNormalized = normalizeStageJumpText(right);
    if (!leftNormalized || !rightNormalized) return 0;
    if (leftNormalized === rightNormalized) return 1;
    if (leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized)) return 0.92;

    const leftTokens = getStageJumpTokens(leftNormalized);
    const rightTokens = getStageJumpTokens(rightNormalized);
    if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

    let score = 0;
    leftTokens.forEach((leftToken) => {
      if (rightTokens.includes(leftToken)) {
        score += 1;
        return;
      }
      const hasPrefixMatch = rightTokens.some(rightToken => (
        rightToken.startsWith(leftToken) || leftToken.startsWith(rightToken)
      ));
      if (hasPrefixMatch) score += 0.7;
    });

    return score / Math.max(leftTokens.length, rightTokens.length);
  }

  function resolveStageJumpTarget(stageName, statusName, menuIndex) {
    if (!menuIndex) return null;

    const stage = String(stageName || '').trim();
    const status = String(statusName || '').trim();
    const normalizedStage = normalizeStageJumpText(stage);
    const normalizedStatus = normalizeStageJumpText(status);

    if (stage && status) {
      const exact = menuIndex.pairExact.get(`${stage}|||${status}`);
      if (exact) return exact;

      const normalized = menuIndex.pairNormalized.get(`${normalizedStage}|||${normalizedStatus}`);
      if (normalized) return normalized;

      const sameStageItems = menuIndex.statusByStageNormalized.get(normalizedStage) || [];
      let bestMatch = null;
      let bestScore = 0;

      sameStageItems.forEach((item) => {
        const currentScore = getStageJumpStatusSimilarityScore(normalizedStatus, item.normalizedStatus);
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestMatch = item;
        }
      });

      if (bestMatch && bestScore >= 0.45) {
        return bestMatch;
      }
    }

    if (stage) {
      const exactStage = menuIndex.stageExact.get(stage);
      if (exactStage) return exactStage;

      const normalizedStageItem = menuIndex.stageNormalized.get(normalizedStage);
      if (normalizedStageItem) return normalizedStageItem;
    }

    return null;
  }

  function ensureStageJumpStyle() {
    if (document.getElementById(STAGE_JUMP_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STAGE_JUMP_STYLE_ID;
    style.textContent = `
      .${STAGE_JUMP_BUTTON_CLASS} {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        margin: 0 !important;
        min-width: 20px;
        width: 20px;
        max-width: 20px;
        height: 18px;
        padding: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        font-size: 10px !important;
        font-weight: 700;
        line-height: 16px;
        border-color: #d4a017 !important;
        background: #ffe082 !important;
        color: #1f1f1f !important;
      }

      td[aria-describedby="list_cb"][data-dup-stage-jump-cbox="1"] {
        text-align: center !important;
        white-space: nowrap !important;
        overflow: visible !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      td[aria-describedby="list_cb"][data-dup-stage-jump-cbox="1"] > .${STAGE_JUMP_BUTTON_CLASS} {
        margin: 0 auto !important;
      }

      .${STAGE_JUMP_BUTTON_CLASS}.is-disabled {
        opacity: 0.5;
        pointer-events: none;
        cursor: not-allowed !important;
      }

      .${STAGE_JUMP_MENU_CLASS} {
        position: fixed;
        z-index: 2147483646;
        min-width: 220px;
        background: #fffdf4;
        border: 1px solid #d4a017;
        border-radius: 6px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        padding: 4px;
      }

      .${STAGE_JUMP_MENU_CLASS}[hidden] {
        display: none !important;
      }

      .${STAGE_JUMP_MENU_ITEM_CLASS} {
        width: 100%;
        border: 0;
        background: transparent;
        color: #222;
        font-size: 12px;
        line-height: 16px;
        text-align: left;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
      }

      .${STAGE_JUMP_MENU_ITEM_CLASS}:hover {
        background: #f7e7b0;
      }

      .${STAGE_JUMP_MENU_ITEM_CLASS}[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
        pointer-events: none;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function openStageJumpTarget(targetUrl, debtId) {
    if (!targetUrl || !debtId) return;
    try {
      const nextUrl = new URL(targetUrl, window.location.origin);
      const normalizedDebtId = String(debtId || '').trim();

      if (!normalizedDebtId) return;

      nextUrl.searchParams.set(STAGE_JUMP_HASH_KEY, normalizedDebtId);
      const hashParams = new URLSearchParams(nextUrl.hash.replace(/^#/, ''));
      hashParams.set(STAGE_JUMP_HASH_KEY, normalizedDebtId);
      nextUrl.hash = hashParams.toString();

      try {
        const pendingPayload = {
          debtId: normalizedDebtId,
          path: nextUrl.pathname,
          createdAt: Date.now()
        };
        window.localStorage.setItem(STAGE_JUMP_STORAGE_KEY, JSON.stringify(pendingPayload));
      } catch (error) {
        // ignore
      }

      window.open(nextUrl.toString(), '_blank', 'noopener');
    } catch (error) {
      console.warn('Не удалось открыть страницу для перехода на стадию ИД.', error);
    }
  }

  function closeStageJumpActionMenu() {
    if (!stageJumpActionMenuEl) return;
    stageJumpActionMenuEl.hidden = true;
    stageJumpActionMenuAnchor = null;
  }

  function executeStageJumpMenuAction(action, anchorButton) {
    if (!anchorButton) return;
    const debtId = String(anchorButton.dataset.debtId || '').trim();
    if (!debtId) return;

    if (action === STAGE_JUMP_MENU_ACTION_SLOWSEARCH) {
      openStageJumpTarget(STAGE_JUMP_SLOWSEARCH_PATH, debtId);
      return;
    }

    if (action === STAGE_JUMP_MENU_ACTION_STAGE) {
      const targetUrl = String(anchorButton.dataset.targetUrl || '').trim();
      if (!targetUrl) return;
      openStageJumpTarget(targetUrl, debtId);
    }
  }

  function positionStageJumpActionMenu(anchorButton) {
    if (!stageJumpActionMenuEl || !anchorButton) return;

    const anchorRect = anchorButton.getBoundingClientRect();
    const menuRect = stageJumpActionMenuEl.getBoundingClientRect();
    const margin = 6;

    let left = anchorRect.left;
    let top = anchorRect.bottom + margin;

    if ((left + menuRect.width) > window.innerWidth) {
      left = Math.max(8, window.innerWidth - menuRect.width - 8);
    }
    if ((top + menuRect.height) > window.innerHeight) {
      top = Math.max(8, anchorRect.top - menuRect.height - margin);
    }

    stageJumpActionMenuEl.style.left = `${Math.max(8, left)}px`;
    stageJumpActionMenuEl.style.top = `${Math.max(8, top)}px`;
  }

  function ensureStageJumpActionMenu() {
    if (stageJumpActionMenuEl) return stageJumpActionMenuEl;

    const menu = document.createElement('div');
    menu.className = STAGE_JUMP_MENU_CLASS;
    menu.hidden = true;
    menu.innerHTML = [
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_SLOWSEARCH}">${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}</button>`,
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_STAGE}">${STAGE_JUMP_MENU_ITEM_STAGE_TEXT}</button>`
    ].join('');

    menu.addEventListener('click', (event) => {
      const item = event.target instanceof Element
        ? event.target.closest(`.${STAGE_JUMP_MENU_ITEM_CLASS}`)
        : null;
      if (!item) return;

      const action = String(item.getAttribute(STAGE_JUMP_MENU_ACTION_ATTR) || '').trim();
      const anchorButton = stageJumpActionMenuAnchor;
      closeStageJumpActionMenu();
      executeStageJumpMenuAction(action, anchorButton);
    });

    document.addEventListener('mousedown', (event) => {
      if (!stageJumpActionMenuEl || stageJumpActionMenuEl.hidden) return;
      const target = event.target;
      if (!(target instanceof Node)) {
        closeStageJumpActionMenu();
        return;
      }
      if (stageJumpActionMenuEl.contains(target)) return;
      if (stageJumpActionMenuAnchor && stageJumpActionMenuAnchor.contains(target)) return;
      closeStageJumpActionMenu();
    }, true);

    window.addEventListener('scroll', () => closeStageJumpActionMenu(), true);
    window.addEventListener('resize', () => closeStageJumpActionMenu(), true);

    (document.body || document.documentElement).appendChild(menu);
    stageJumpActionMenuEl = menu;
    return menu;
  }

  function toggleStageJumpActionMenu(anchorButton) {
    const menu = ensureStageJumpActionMenu();
    if (!menu || !anchorButton) return;

    const stageItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_STAGE}"]`);
    const hasStageTarget = String(anchorButton.dataset.targetUrl || '').trim().length > 0;
    if (stageItem instanceof HTMLButtonElement) {
      stageItem.disabled = !hasStageTarget;
      if (!hasStageTarget) {
        stageItem.title = 'Маршрут стадии/статуса не найден в статической карте ВЗИД.';
      } else {
        stageItem.removeAttribute('title');
      }
    }

    if (!menu.hidden && stageJumpActionMenuAnchor === anchorButton) {
      closeStageJumpActionMenu();
      return;
    }

    stageJumpActionMenuAnchor = anchorButton;
    menu.hidden = false;
    positionStageJumpActionMenu(anchorButton);
  }

  function createStageJumpButton() {
    const button = document.createElement('div');
    button.className = `btn btn-xs btn-default ui-pg-div ${STAGE_JUMP_BUTTON_CLASS}`;
    button.setAttribute(STAGE_JUMP_BUTTON_MARK_ATTR, '1');
    button.textContent = STAGE_JUMP_BUTTON_LABEL;
    button.title = STAGE_JUMP_BUTTON_TEXT;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const debtId = String(button.dataset.debtId || '');
      if (!debtId) return;
      toggleStageJumpActionMenu(button);
    });
    return button;
  }

  function updateStageJumpButtons() {
    if (!isStageJumpSourcePage()) return;

    ensureStageJumpStyle();
    cleanupLegacyStageJumpColumn();
    const menuIndex = getStageJumpMenuIndex();

    const openButtons = Array.from(
      document.querySelectorAll('.ui-inline-open, [title="Открыть карточку"], [data-original-title="Открыть карточку"]')
    ).filter((btn, index, arr) => btn.offsetParent !== null && arr.indexOf(btn) === index);
    const resolvedTargetCache = new Map();

    openButtons.forEach((openButton) => {
      const row = openButton.closest('tr');
      if (!row) return;

      const jumpCell = row.querySelector('td[aria-describedby="list_cb"]');
      if (!jumpCell) return;
      jumpCell.setAttribute('data-dup-stage-jump-cbox', '1');

      const cboxControls = Array.from(jumpCell.querySelectorAll('input.cbox, .cbox, label[for^="jqg_list_"]'));
      cboxControls.forEach((node) => node.remove());

      let jumpButton = row.querySelector(`.${STAGE_JUMP_BUTTON_CLASS}`);
      if (!jumpButton) {
        jumpButton = createStageJumpButton();
      }

      if (jumpButton.parentElement !== jumpCell) {
        Array.from(jumpCell.childNodes).forEach((node) => {
          if (node !== jumpButton) node.remove();
        });
        jumpCell.appendChild(jumpButton);
      }

      const debtId = getRowCellTextByAria(row, 'list_DebtID');
      const stageName = getRowCellTextByAria(row, 'list_CaseStageName');
      const statusName = getRowCellTextByAria(row, 'list_CaseStatusName');
      const cacheKey = `${stageName}|||${statusName}`;

      let target = resolvedTargetCache.get(cacheKey);
      if (target === undefined) {
        target = menuIndex ? resolveStageJumpTarget(stageName, statusName, menuIndex) : null;
        resolvedTargetCache.set(cacheKey, target || null);
      }

      if (debtId) {
        jumpButton.classList.remove('is-disabled');
        jumpButton.dataset.debtId = debtId;
        if (target) {
          jumpButton.dataset.targetUrl = target.href;
          jumpButton.title = [
            `DebtID: ${debtId}`,
            'Выберите действие:',
            `1) ${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}`,
            `2) ${STAGE_JUMP_MENU_ITEM_STAGE_TEXT}`,
            `Маршрут: ${target.pathText || target.path.join(' > ')}`
          ].join('\n');
        } else {
          delete jumpButton.dataset.targetUrl;
          jumpButton.title = [
            `DebtID: ${debtId}`,
            'Выберите действие:',
            `1) ${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}`,
            `2) ${STAGE_JUMP_MENU_ITEM_STAGE_TEXT} (недоступен: маршрут не найден)`
          ].join('\n');
        }
      } else {
        jumpButton.classList.add('is-disabled');
        delete jumpButton.dataset.targetUrl;
        delete jumpButton.dataset.debtId;
        jumpButton.title = 'Не удалось определить DebtID строки.';
      }
    });
  }

  const debouncedUpdateStageJumpButtons = debounce(updateStageJumpButtons, 250);

  function initStageJumpButtons() {
    if (!isStageJumpSourcePage()) return;

    stageJumpCachedMenuIndex = buildStageJumpMenuIndex(STAGE_JUMP_STATIC_MENU_LINKS);

    updateStageJumpButtons();
    const gridRoot = document.getElementById('gview_list') || document.body;
    const stageJumpObserver = new MutationObserver(() => {
      debouncedUpdateStageJumpButtons();
    });
    observeWithRetry(
      stageJumpObserver,
      () => document.getElementById('gview_list') || gridRoot || document.body || document.documentElement,
      { childList: true, subtree: true },
      120,
      100
    );

    // На части экранов jqGrid дорисовывает кнопки асинхронно без заметной мутации строки.
    let retries = 0;
    const retryTimer = setInterval(() => {
      retries += 1;
      updateStageJumpButtons();
      if (retries >= 20) clearInterval(retryTimer);
    }, 500);
  }

  function createSlowsearchJumpButton() {
    const button = document.createElement('div');
    button.className = `btn btn-xs btn-default ui-pg-div ${STAGE_JUMP_BUTTON_CLASS}`;
    button.setAttribute(STAGE_JUMP_BUTTON_MARK_ATTR, '1');
    button.setAttribute(SLOWSEARCH_JUMP_MARK_ATTR, '1');
    button.textContent = STAGE_JUMP_BUTTON_LABEL;
    button.title = SLOWSEARCH_JUMP_BUTTON_TEXT;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button.dataset.inFlight === '1') return;

      const debtId = String(button.dataset.debtId || '').trim();
      const departmentName = String(button.dataset.departmentName || '').trim();
      if (!debtId) return;

      button.dataset.inFlight = '1';
      try {
        const targetUrl = ensureSlowsearchDepartmentMatch(departmentName);
        if (!targetUrl) return;
        openStageJumpTarget(targetUrl, debtId);
      } finally {
        delete button.dataset.inFlight;
      }
    });
    return button;
  }

  function updateSlowsearchJumpButtons() {
    if (!isSlowsearchSourcePage()) return;

    ensureStageJumpStyle();

    const rows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
    rows.forEach((row) => {
      const jumpCell = row.querySelector('td[aria-describedby="list_cb"]');
      if (!jumpCell) return;

      jumpCell.setAttribute('data-dup-stage-jump-cbox', '1');
      const cboxControls = Array.from(jumpCell.querySelectorAll('input.cbox, .cbox, label[for^="jqg_list_"]'));
      cboxControls.forEach((node) => node.remove());

      let jumpButton = jumpCell.querySelector(`.${STAGE_JUMP_BUTTON_CLASS}[${SLOWSEARCH_JUMP_MARK_ATTR}="1"]`);
      if (!jumpButton) {
        jumpButton = createSlowsearchJumpButton();
      }

      if (jumpButton.parentElement !== jumpCell) {
        Array.from(jumpCell.childNodes).forEach((node) => {
          if (node !== jumpButton) node.remove();
        });
        jumpCell.appendChild(jumpButton);
      }

      const debtId = getRowCellTextByAria(row, 'list_DebtID');
      const departmentName = getRowCellTextByAria(row, 'list_Departmentname');

      if (debtId) {
        jumpButton.classList.remove('is-disabled');
        jumpButton.dataset.debtId = debtId;
        jumpButton.dataset.departmentName = departmentName;
        jumpButton.title = `${SLOWSEARCH_JUMP_BUTTON_TEXT}\nDebtID: ${debtId}\nУправление: ${departmentName || '(не указано)'}`;
      } else {
        jumpButton.classList.add('is-disabled');
        delete jumpButton.dataset.debtId;
        delete jumpButton.dataset.departmentName;
        jumpButton.title = 'Не удалось определить DebtID строки.';
      }
    });
  }

  const debouncedUpdateSlowsearchJumpButtons = debounce(updateSlowsearchJumpButtons, 250);

  function initSlowsearchJumpButtons() {
    if (!isSlowsearchSourcePage()) return;

    updateSlowsearchJumpButtons();
    const gridRoot = document.getElementById('gview_list') || document.body;
    const slowsearchJumpObserver = new MutationObserver(() => {
      debouncedUpdateSlowsearchJumpButtons();
    });
    observeWithRetry(
      slowsearchJumpObserver,
      () => document.getElementById('gview_list') || gridRoot || document.body || document.documentElement,
      { childList: true, subtree: true },
      120,
      100
    );

    let retries = 0;
    const retryTimer = setInterval(() => {
      retries += 1;
      updateSlowsearchJumpButtons();
      if (retries >= 20) clearInterval(retryTimer);
    }, 500);
  }

  function getStageJumpDebtIdFromStorage() {
    try {
      const raw = window.localStorage.getItem(STAGE_JUMP_STORAGE_KEY);
      if (!raw) return '';

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return '';

      const debtId = String(parsed.debtId || '').trim();
      const createdAt = Number(parsed.createdAt || 0);
      const path = String(parsed.path || '').trim();

      if (!debtId || !createdAt) return '';
      if ((Date.now() - createdAt) > STAGE_JUMP_STORAGE_TTL_MS) return '';
      if (path && path !== window.location.pathname) return '';

      return debtId;
    } catch (error) {
      return '';
    }
  }

  function clearStageJumpDebtIdStorage() {
    try {
      window.localStorage.removeItem(STAGE_JUMP_STORAGE_KEY);
    } catch (error) {
      // ignore
    }
  }

  function getStageJumpDebtIdFromHash() {
    const searchParams = new URLSearchParams(String(window.location.search || '').replace(/^\?/, ''));
    const fromSearch = String(searchParams.get(STAGE_JUMP_HASH_KEY) || '').trim();
    if (fromSearch) return fromSearch;

    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const fromHash = String(hashParams.get(STAGE_JUMP_HASH_KEY) || '').trim();
      if (fromHash) return fromHash;
    }

    return getStageJumpDebtIdFromStorage();
  }

  function clearStageJumpDebtIdFromHash() {
    let isChanged = false;
    const url = new URL(window.location.href);

    if (url.searchParams.has(STAGE_JUMP_HASH_KEY)) {
      url.searchParams.delete(STAGE_JUMP_HASH_KEY);
      isChanged = true;
    }

    const hash = String(url.hash || '').replace(/^#/, '');
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      if (hashParams.has(STAGE_JUMP_HASH_KEY)) {
        hashParams.delete(STAGE_JUMP_HASH_KEY);
        url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
        isChanged = true;
      }
    }

    clearStageJumpDebtIdStorage();

    if (!isChanged) return;
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function getStageJumpGridElement() {
    const byId = document.getElementById('list');
    if (byId) return byId;

    if (window.jQuery) {
      const jqGrid = window.jQuery('#list')[0];
      if (jqGrid) return jqGrid;
    }

    return null;
  }

  function hasStageJumpGridRendered() {
    const grid = getStageJumpGridElement();
    if (!grid) return false;

    const rows = grid.querySelectorAll('tbody > tr');
    for (const row of rows) {
      if (!(row instanceof HTMLElement)) continue;
      if (!row.classList.contains('jqgfirstrow')) {
        return true;
      }
    }
    return false;
  }

  function isStageJumpGridBusy(grid) {
    if (!grid) return false;

    const jqXhr = grid.p ? grid.p.jqXhr : null;
    if (jqXhr && typeof jqXhr.abort === 'function') {
      const readyState = Number(jqXhr.readyState || 0);
      if (readyState > 0 && readyState < 4) return true;
    }

    return false;
  }

  function abortStageJumpGridLoad(grid) {
    if (!grid || !grid.p || !grid.p.jqXhr) return false;

    const jqXhr = grid.p.jqXhr;
    if (typeof jqXhr.abort !== 'function') return false;

    const readyState = Number(jqXhr.readyState || 0);
    if (readyState <= 0 || readyState >= 4) return false;

    try {
      jqXhr.abort();
      return true;
    } catch (error) {
      return false;
    }
  }

  function hasStageJumpDebtIdInPostData(postData, debtId) {
    if (!postData || !debtId) return false;

    const rawFilters = String(postData.filters || '');
    if (!rawFilters) return false;

    try {
      const parsed = JSON.parse(rawFilters);
      const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
      return rules.some((rule) => (
        normalizeStageJumpText(rule.field) === 'debtid' &&
        String(rule.data || '').trim() === debtId
      ));
    } catch (error) {
      return false;
    }
  }

  function hasStageJumpDebtIdInRawPostData(postData, debtId) {
    if (!postData || !debtId) return false;
    const rawFilters = String(postData.filters || '');
    if (!rawFilters) return false;
    return rawFilters.indexOf(String(debtId)) !== -1;
  }

  function hasStageJumpDebtIdInVisibleRows(grid, debtId) {
    if (!grid || !debtId) return false;

    const rows = Array.from(grid.querySelectorAll('tbody > tr'));
    const dataRows = rows.filter((row) => {
      if (!(row instanceof HTMLElement)) return false;
      if (row.classList.contains('jqgfirstrow')) return false;
      if (row.style && row.style.display === 'none') return false;
      return true;
    });

    if (dataRows.length === 0) return false;

    let hasDebtCells = false;
    for (const row of dataRows) {
      const debtCell = row.querySelector('td[aria-describedby="list_DebtID"]');
      if (!debtCell) continue;
      hasDebtCells = true;
      const cellValue = String(debtCell.textContent || '').trim();
      if (cellValue !== debtId) return false;
    }

    return hasDebtCells;
  }

  function hasStageJumpDebtIdInFilterInput(debtId) {
    const input = getStageJumpDebtIdFilterInput();
    if (!input || !debtId) return false;
    return String(input.value || '').trim() === String(debtId).trim();
  }

  function isStageJumpDebtIdResultConfirmed(grid, debtId) {
    if (!grid || !debtId) return false;

    // Приоритетная проверка: фактические строки грида уже соответствуют DebtID.
    if (hasStageJumpDebtIdInVisibleRows(grid, debtId)) return true;

    const postData = grid.p && grid.p.postData ? grid.p.postData : null;
    const hasDebtFilterInPostData = (
      hasStageJumpDebtIdInPostData(postData, debtId) ||
      hasStageJumpDebtIdInRawPostData(postData, debtId)
    );
    const hasDebtFilterInInput = hasStageJumpDebtIdInFilterInput(debtId);
    if (!hasDebtFilterInPostData && !hasDebtFilterInInput) return false;

    const recordCountRaw = grid.p ? grid.p.reccount : null;
    const recordCount = Number(recordCountRaw);
    if (Number.isFinite(recordCount) && recordCount === 0) return true;

    const pagingInfo = document.querySelector('#sp_1_list, .ui-paging-info');
    if (pagingInfo && /Нет записей/i.test(String(pagingInfo.textContent || ''))) {
      return true;
    }

    return false;
  }

  function isStageJumpDebtIdApplied(grid, debtId) {
    if (!grid || !debtId) return false;
    const postData = grid.p && grid.p.postData ? grid.p.postData : null;
    if (hasStageJumpDebtIdInPostData(postData, debtId)) return true;
    if (hasStageJumpDebtIdInRawPostData(postData, debtId)) return true;
    return hasStageJumpDebtIdInVisibleRows(grid, debtId);
  }

  function buildStageJumpDebtIdFilters(debtId) {
    return JSON.stringify({
      groupOp: 'AND',
      rules: [{ field: 'DebtID', op: 'eq', data: String(debtId || '') }]
    });
  }

  function getStageJumpDebtIdFilterInputs() {
    const byIdCandidates = [
      document.getElementById('gs_DebtID'),
      document.getElementById('gs_DebtId'),
      document.getElementById('gs_debtid'),
      document.getElementById('gs_list_DebtID'),
      document.getElementById('gs_list_DebtId'),
      document.getElementById('gs_list_debtid'),
      document.getElementById('gs_list_DepID'),
      document.getElementById('gs_list_DepId'),
      document.getElementById('gs_list_depid')
    ].filter(Boolean);

    const bySelectorCandidates = Array.from(document.querySelectorAll(
      'input[name="DebtID"], input[name="DebtId"], input[name="DepID"], input[name="DepId"], input[id^="gs_list_Debt"], input[id^="gs_list_Dep"]'
    ));

    const all = [...byIdCandidates, ...bySelectorCandidates].filter((el) => el instanceof HTMLInputElement);
    const unique = [];
    const seen = new Set();
    all.forEach((input) => {
      if (!seen.has(input)) {
        seen.add(input);
        unique.push(input);
      }
    });
    return unique;
  }

  function getStageJumpDebtIdFilterInput() {
    const inputs = getStageJumpDebtIdFilterInputs();
    return inputs.length > 0 ? inputs[0] : null;
  }

  function setNativeInputValue(input, value) {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(input, value);
      return;
    }
    input.value = value;
  }

  function clearStageJumpDebtIdFilterInput() {
    const inputs = getStageJumpDebtIdFilterInputs();
    if (!inputs.length) return;

    inputs.forEach((filterInput) => {
      setNativeInputValue(filterInput, '');
      filterInput.removeAttribute('value');
    });
  }

  function triggerStageJumpDebtIdFilterByInput(filterInput) {
    if (!filterInput) return false;

    try {
      filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      filterInput.dispatchEvent(new Event('change', { bubbles: true }));

      const enterKey = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      };
      filterInput.dispatchEvent(new KeyboardEvent('keydown', enterKey));
      filterInput.dispatchEvent(new KeyboardEvent('keypress', enterKey));
      filterInput.dispatchEvent(new KeyboardEvent('keyup', enterKey));
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyStageJumpDebtIdFilterViaPageBridge(debtId) {
    const normalizedDebtId = String(debtId || '').trim();
    if (!normalizedDebtId) return false;

    if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function')) {
      return false;
    }

    try {
      chrome.runtime.sendMessage(
        {
          action: 'STAGEJUMP_APPLY_DEBTID_MAIN_WORLD',
          data: { debtId: normalizedDebtId }
        },
        (response) => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : '';

          if (runtimeError) {
            console.warn('[StageJump] Ошибка MAIN-world bridge: ' + runtimeError);
            return;
          }

          if (!response || response.success !== true) {
            const errorCode = response && response.error ? response.error : 'UNKNOWN_ERROR';
            console.warn('[StageJump] MAIN-world bridge не применил DebtID: ' + errorCode);
            return;
          }

          console.info('[StageJump] DebtID отправлен через MAIN-world bridge (eq).');
        }
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyStageJumpDebtIdFilterOnce(debtId) {
    const grid = getStageJumpGridElement();
    const normalizedDebtId = String(debtId || '').trim();
    if (!grid || !normalizedDebtId) return false;

    const filterInput = getStageJumpDebtIdFilterInput();
    if (filterInput) {
      setNativeInputValue(filterInput, normalizedDebtId);
      filterInput.setAttribute('value', normalizedDebtId);
    }

    const hasDebtFilter = isStageJumpDebtIdApplied(grid, normalizedDebtId);
    if (hasDebtFilter) return true;

    if (applyStageJumpDebtIdFilterViaPageBridge(normalizedDebtId)) return true;

    // Основной путь: имитируем ввод и Enter в фильтре DebtID.
    // Это стабильно работает в content-script и не зависит от доступа к page-world jQuery.
    if (filterInput && triggerStageJumpDebtIdFilterByInput(filterInput)) {
      return true;
    }

    // Фолбэк для окружений, где jQuery доступен напрямую.
    if (!(window.jQuery && window.jQuery.fn && window.jQuery.fn.jqGrid)) {
      return false;
    }

    const filters = buildStageJumpDebtIdFilters(normalizedDebtId);
    const jqGrid = window.jQuery('#list');
    if (!(jqGrid && jqGrid.length)) return false;

    try {
      jqGrid.jqGrid('setGridParam', {
        search: true,
        page: 1,
        postData: {
          ...(grid.p && grid.p.postData ? grid.p.postData : {}),
          _search: true,
          filters
        }
      });
      jqGrid.trigger('reloadGrid', [{ page: 1, current: true }]);
      return true;
    } catch (error) {
      return false;
    }
  }

  function initStageJumpDebtIdFilterFromHash() {
    if (!window.location.pathname.includes('/ovzid/')) return;

    const debtId = getStageJumpDebtIdFromHash();
    if (!debtId) return;

    let abortPerformed = false;
    let abortWindowFinished = false;
    let applyDispatched = false;
    let applyDispatchedAtMs = 0;
    let loggedAbortWait = false;
    let timer = null;

    const startedAt = Date.now();
    const maxDurationMs = 60 * 1000;
    const intervalMs = 300;
    const abortWindowMs = 1500;
    const postApplyConfirmMs = 12000;

    console.info('[StageJump] DebtID param detected: ' + debtId);

    const finishSuccess = () => {
      clearInterval(timer);
      clearStageJumpDebtIdFilterInput();
      clearStageJumpDebtIdFromHash();
      console.info('[StageJump] DebtID applied once.');
    };

    const finishFail = () => {
      clearInterval(timer);
      console.warn('[StageJump] Failed to apply DebtID within timeout.');
    };

    const runAttempt = () => {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= maxDurationMs) {
        finishFail();
        return;
      }

      const grid = getStageJumpGridElement();
      if (!grid) return;

      if (isStageJumpDebtIdResultConfirmed(grid, debtId)) {
        finishSuccess();
        return;
      }

      const isBusy = isStageJumpGridBusy(grid);

      if (!abortPerformed && !abortWindowFinished) {
        if (isBusy) {
          const aborted = abortStageJumpGridLoad(grid);
          if (aborted) {
            abortPerformed = true;
            console.info('[StageJump] Main load aborted, applying DebtID filter.');
            return;
          }
        } else if (!loggedAbortWait) {
          loggedAbortWait = true;
          console.info('[StageJump] Waiting briefly for active load to abort before filtering.');
        }

        if (elapsedMs < abortWindowMs) return;
        abortWindowFinished = true;
      }

      if (applyDispatched) {
        if ((Date.now() - applyDispatchedAtMs) >= postApplyConfirmMs) {
          finishFail();
        }
        return;
      }

      if (isBusy) {
        if (!abortPerformed) {
          const abortedLate = abortStageJumpGridLoad(grid);
          if (abortedLate) {
            abortPerformed = true;
            console.info('[StageJump] Main load aborted, applying DebtID filter.');
          }
        }
        return;
      }

      const isApplied = applyStageJumpDebtIdFilterOnce(debtId);
      if (!isApplied) return;

      applyDispatched = true;
      applyDispatchedAtMs = Date.now();
      console.info('[StageJump] DebtID filter dispatched (one-shot).');
    };

    runAttempt();
    timer = setInterval(runAttempt, intervalMs);
  }

  function initSlowsearchDebtIdFilterFromHash() {
    if (!isSlowsearchSourcePage()) return;

    const debtId = getStageJumpDebtIdFromHash();
    if (!debtId) return;
    console.info('[SlowSearchJump] Найден параметр DebtID для автофильтра: ' + debtId);

    const startedAt = Date.now();
    const maxDurationMs = 60 * 1000;
    const intervalMs = 300;
    let timer = null;
    let loggedWait = false;
    let applyDispatched = false;

    const finishSuccess = () => {
      clearInterval(timer);
      clearStageJumpDebtIdFilterInput();
      clearStageJumpDebtIdFromHash();
      console.info('[SlowSearchJump] DebtID применен один раз.');
    };

    const finishFail = () => {
      clearInterval(timer);
      console.warn('[SlowSearchJump] Не удалось применить DebtID в течение 60 секунд.');
    };

    const runAttempt = () => {
      if ((Date.now() - startedAt) >= maxDurationMs) {
        finishFail();
        return;
      }

      const grid = getStageJumpGridElement();
      if (!grid) return;

      const hasDebtFilterAlready = isStageJumpDebtIdApplied(grid, debtId);
      if (hasDebtFilterAlready) {
        finishSuccess();
        return;
      }

      if (applyDispatched) {
        return;
      }

      const isBusy = isStageJumpGridBusy(grid);
      if (isBusy) {
        if (!loggedWait) {
          loggedWait = true;
          console.info('[SlowSearchJump] Ожидаем завершения штатной загрузки грида перед вводом DebtID...');
        }
        return;
      }

      const isApplied = applyStageJumpDebtIdFilterOnce(debtId);
      if (!isApplied) return;

      applyDispatched = true;
      console.info('[SlowSearchJump] DebtID отправлен в фильтр (однократно).');
      finishSuccess();
    };

    runAttempt();
    timer = setInterval(runAttempt, intervalMs);
  }


  // --- Подсветка строк/колонок в Google Sheets (без изменений) ---
  if (window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/')) {
    // ... (код без изменений)
  }

  // Запуск
  initStageJumpDebtIdFilterFromHash();
  initSlowsearchDebtIdFilterFromHash();
  initStageJumpButtons();
  initSlowsearchJumpButtons();
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
