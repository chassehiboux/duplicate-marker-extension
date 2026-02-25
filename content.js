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
  const STAGE_JUMP_MENU_ACTION_EXECUTION_ANALYSIS = 'to_execution_analysis';
  const STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT = 'Переход в Глобальный поиск';
  const STAGE_JUMP_MENU_ITEM_STAGE_TEXT = 'Переход к ИД на стадии';
  const STAGE_JUMP_MENU_ITEM_EXECUTION_ANALYSIS_TEXT = 'Анализ исполнения';
  const STAGE_JUMP_PENDING_MODE_EXECUTION_ANALYSIS = 'execution_analysis';
  const STAGE_JUMP_ANALYSIS_DRAFT_STORAGE_KEY = 'dup_stage_jump_analysis_draft';
  const SLOWSEARCH_TARGET_PATH = '/ovzid/status/all';
  const SLOWSEARCH_JUMP_BUTTON_TEXT = 'Перейти в ОВЗИД (status/all)';
  const SLOWSEARCH_JUMP_MARK_ATTR = 'data-dup-slowsearch-jump';
  const SLOWSEARCH_CITIES_TOGGLE_SELECTOR = 'button.btn-cities.dropdown-toggle';
  const SLOWSEARCH_CITIES_LINK_SELECTOR = 'a.department-switch';
  const GRID_ABORT_REWRITE_EVENT = 'dup-grid-abort-message';
  const GRID_ABORT_REWRITE_TEXT = 'Загрузка/Фильтрация была прервана пользователем вручную. Повторите действие заново.';
  // Статическая карта стадий/статусов ВЗИД, зафиксированная по меню блока ВЗИД.
  const STAGE_JUMP_STATIC_MENU_LINKS = [
    { path: ['ОВЗИД','ИД принятые в работу из ПУ (новые)'], href: '/ovzid/status/32' },
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
  let stageJumpLastStageLoadStartAtMs = 0;
  let stageJumpLastStageLoadType = '';
  let stageJumpLastStageLoadRequestUrl = '';
  let stageJumpLastEditDocStartAtMs = 0;
  let stageJumpLastEditDocStopAtMs = 0;
  let stageJumpLastStageTimerErrorAtMs = 0;
  const stageJumpExecutionRequestStates = new Map();
  const stageJumpExecutionButtonStates = new Map();
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

  function rewriteGridAbortErrorMessage(messageText) {
    const finalMessage = String(messageText || GRID_ABORT_REWRITE_TEXT).trim() || GRID_ABORT_REWRITE_TEXT;
    let changed = false;

    const srOnlyErrors = Array.from(document.querySelectorAll('span.sr-only.ui-jqgrid-error'));
    srOnlyErrors.forEach((el) => {
      const currentText = String(el.textContent || '').trim().toLowerCase();
      if (!currentText || currentText === 'error' || currentText === 'ошибка' || currentText.indexOf('error') !== -1) {
        el.textContent = finalMessage;
        changed = true;
      }
    });

    const errorBars = Array.from(document.querySelectorAll('.ui-jqgrid-errorbar'));
    errorBars.forEach((bar) => {
      if (!(bar instanceof HTMLElement)) return;
      const textNodes = Array.from(bar.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
      textNodes.forEach((node) => {
        const text = String(node.textContent || '').trim().toLowerCase();
        if (!text || text === 'error' || text.indexOf('error') !== -1) {
          node.textContent = ` ${finalMessage} `;
          changed = true;
        }
      });
      bar.setAttribute('aria-label', finalMessage);
    });

    return changed;
  }

  function scheduleGridAbortErrorMessageRewrite(messageText) {
    const retries = [0, 60, 180, 420, 900];
    retries.forEach((delayMs) => {
      setTimeout(() => {
        rewriteGridAbortErrorMessage(messageText);
      }, delayMs);
    });
  }

  function notifyGridAbortMessageRewrite(source, messageText) {
    const finalMessage = String(messageText || GRID_ABORT_REWRITE_TEXT).trim() || GRID_ABORT_REWRITE_TEXT;
    scheduleGridAbortErrorMessageRewrite(finalMessage);
    try {
      window.dispatchEvent(new CustomEvent(GRID_ABORT_REWRITE_EVENT, {
        detail: {
          source: source || 'manual-abort',
          message: finalMessage
        }
      }));
    } catch (error) {
      // ignore
    }
  }

  window.addEventListener(GRID_ABORT_REWRITE_EVENT, function(event) {
    const detail = event && event.detail ? event.detail : {};
    const message = detail && typeof detail.message === 'string'
      ? detail.message
      : GRID_ABORT_REWRITE_TEXT;
    scheduleGridAbortErrorMessageRewrite(message);
  }, { capture: true });

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
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer-abort,
      html.${SCREENSHOT_MODE_CLASS} .pyramid-stage-timer-abort-btn,
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

  function tryAbortBeforeManualGridSearch(searchInput, triggerName) {
    if (!(searchInput instanceof HTMLInputElement)) return;
    const abortMode = abortStageJumpBusyGridRequest(searchInput);
    if (!abortMode) return '';
    notifyGridAbortMessageRewrite('manual-search-' + String(triggerName || 'unknown'));

    if (abortMode === 'jqxhr') {
      console.info('[StageJump] Manual search pre-abort via jqXhr (' + triggerName + ').');
    } else if (abortMode === 'window-stop') {
      console.info('[StageJump] Manual search pre-abort via window.stop() (' + triggerName + ').');
    }
    return abortMode;
  }

  function dispatchManualGridSearchEnter(searchInput) {
    if (!(searchInput instanceof HTMLInputElement)) return false;
    if (!document.contains(searchInput)) return false;

    try {
      searchInput.focus({ preventScroll: true });
    } catch (error) {
      searchInput.focus();
    }

    const enterKey = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    };

    try {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', enterKey));
      searchInput.dispatchEvent(new KeyboardEvent('keypress', enterKey));
      searchInput.dispatchEvent(new KeyboardEvent('keyup', enterKey));
      return true;
    } catch (error) {
      return false;
    }
  }

  function replayManualGridSearchEnterAfterAbort(searchInput, abortMode) {
    if (!(searchInput instanceof HTMLInputElement)) return;
    const delayMs = abortMode === 'window-stop' ? 220 : 90;
    window.setTimeout(() => {
      const ok = dispatchManualGridSearchEnter(searchInput);
      if (ok) {
        console.info('[StageJump] Manual search enter replayed after pre-abort.');
      }
    }, delayMs);
  }

  function getManualGridSortTrigger(target) {
    if (!(target instanceof Element)) return null;
    const sortable = target.closest('.ui-jqgrid-sortable');
    if (!(sortable instanceof HTMLElement)) return null;

    const headerCell = sortable.closest('th');
    if (!(headerCell instanceof HTMLTableCellElement)) return null;
    if (!headerCell.closest('.ui-jqgrid-hdiv')) return null;

    return sortable;
  }

  function dispatchManualGridSortClick(sortableEl) {
    if (!(sortableEl instanceof HTMLElement)) return false;
    if (!document.contains(sortableEl)) return false;

    try {
      sortableEl.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function replayManualGridSortClickAfterAbort(sortableEl, abortMode) {
    if (!(sortableEl instanceof HTMLElement)) return;
    const delayMs = abortMode === 'window-stop' ? 220 : 90;
    window.setTimeout(() => {
      const ok = dispatchManualGridSortClick(sortableEl);
      if (ok) {
        console.info('[StageJump] Manual sort click replayed after pre-abort.');
      }
    }, delayMs);
  }

  document.addEventListener('keydown', function(e) {
    if (!e || !e.isTrusted) return;
    if (e.repeat) return;
    if (e.key !== 'Enter' && e.keyCode !== 13) return;
    const searchInput = e.target && e.target.closest
      ? e.target.closest('input[role="search"]')
      : null;
    if (!searchInput) return;
    const abortMode = tryAbortBeforeManualGridSearch(searchInput, 'enter');
    if (!abortMode) return;

    // Первый Enter тратится на abort: перехватываем его и переотправляем один раз сами.
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    replayManualGridSearchEnterAfterAbort(searchInput, abortMode);
  }, true);

  document.addEventListener('click', function(e) {
    if (!e || !e.isTrusted) return;
    if (typeof e.button === 'number' && e.button !== 0) return;

    const sortTrigger = getManualGridSortTrigger(e.target);
    if (!sortTrigger) return;

    const abortMode = abortStageJumpBusyGridRequest(null);
    if (!abortMode) return;

    notifyGridAbortMessageRewrite('manual-sort-click');
    if (abortMode === 'jqxhr') {
      console.info('[StageJump] Manual sort pre-abort via jqXhr.');
    } else if (abortMode === 'window-stop') {
      console.info('[StageJump] Manual sort pre-abort via window.stop().');
    }

    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    replayManualGridSortClickAfterAbort(sortTrigger, abortMode);
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

  function getStageTimerLoadKind(loadType) {
    const normalized = String(loadType || '').toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('фильтрац')) return 'filter';
    if (normalized.includes('загруз')) return 'load';
    return '';
  }

  function rememberStageTimerStart(data) {
    const loadType = data && data.loadType ? String(data.loadType) : '';
    if (getStageTimerLoadKind(loadType) !== 'load') return;

    stageJumpLastStageLoadStartAtMs = Date.now();
    stageJumpLastStageLoadType = loadType;
    stageJumpLastStageLoadRequestUrl = data && data.requestUrl ? String(data.requestUrl) : '';
  }

  function hasStageLoadStartSince(timestampMs) {
    const fromTs = Number(timestampMs || 0);
    return stageJumpLastStageLoadStartAtMs > 0 && stageJumpLastStageLoadStartAtMs >= fromTs;
  }

  function isStageJumpEditDocRequestData(data) {
    if (!data || typeof data !== 'object') return false;
    const requestUrl = String(data.requestUrl || '').toLowerCase();
    return requestUrl.includes('/actions/editedoc');
  }

  function rememberStageTimerMessage(action, data) {
    const normalizedAction = String(action || '').trim().toUpperCase();
    if (!normalizedAction) return;

    if (normalizedAction === 'STAGE_TIMER_START') {
      rememberStageTimerStart(data || {});
      if (isStageJumpEditDocRequestData(data)) {
        stageJumpLastEditDocStartAtMs = Date.now();
      }
      return;
    }

    if (normalizedAction === 'STAGE_TIMER_STOP') {
      if (isStageJumpEditDocRequestData(data)) {
        stageJumpLastEditDocStopAtMs = Date.now();
      }
      return;
    }

    if (normalizedAction === 'STAGE_TIMER_ERROR') {
      stageJumpLastStageTimerErrorAtMs = Date.now();
    }
  }

  // Слежение за StageTimer: фиксируем старт/стоп/ошибку запросов, в т.ч. POST editedoc.
  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return false;
    const action = String(message.action || '').trim();
    if (action !== 'STAGE_TIMER_START' && action !== 'STAGE_TIMER_STOP' && action !== 'STAGE_TIMER_ERROR') {
      return false;
    }
    rememberStageTimerMessage(action, message.data || {});
    return false;
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.action !== 'STAGEJUMP_EXECUTION_ANALYSIS_STATUS') return false;
    const data = message.data || {};
    const requestId = String(data.requestId || '').trim();
    const status = String(data.status || '').trim().toLowerCase();
    if (!requestId) return false;

    const stateKey = stageJumpExecutionRequestStates.get(requestId);
    if (!stateKey) return false;

    if (status === 'running') {
      setStageJumpExecutionButtonState(stateKey, 'loading');
      updateStageJumpButtons();
      return false;
    }

    stageJumpExecutionRequestStates.delete(requestId);

    if (status === 'success') {
      setStageJumpExecutionButtonState(stateKey, 'success', 1000);
      updateStageJumpButtons();
      return false;
    }

    setStageJumpExecutionButtonState(stateKey, '');
    updateStageJumpButtons();
    const error = data && data.error ? String(data.error) : 'UNKNOWN_ERROR';
    console.warn('[StageJump] Фоновый анализ исполнения завершился с ошибкой: ' + error);
    return false;
  });

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

  function getStageJumpExecutionButtonStateKey(debtId, edocId) {
    const normalizedDebtId = String(debtId || '').trim();
    const normalizedEdocId = String(edocId || '').trim();
    if (!normalizedDebtId || !normalizedEdocId) return '';
    return `${normalizedDebtId}::${normalizedEdocId}`;
  }

  function setStageJumpExecutionButtonState(stateKey, state, ttlMs = 0) {
    if (!stateKey) return;
    const normalizedState = String(state || '').trim();
    if (!normalizedState) {
      stageJumpExecutionButtonStates.delete(stateKey);
      return;
    }

    const safeTtlMs = Number(ttlMs) > 0 ? Number(ttlMs) : 0;
    const expiresAt = safeTtlMs > 0 ? Date.now() + safeTtlMs : 0;
    stageJumpExecutionButtonStates.set(stateKey, { state: normalizedState, expiresAt });

    if (safeTtlMs > 0) {
      window.setTimeout(() => {
        const current = stageJumpExecutionButtonStates.get(stateKey);
        if (!current) return;
        if (current.expiresAt !== expiresAt) return;
        stageJumpExecutionButtonStates.delete(stateKey);
        updateStageJumpButtons();
      }, safeTtlMs + 60);
    }
  }

  function getStageJumpExecutionButtonState(stateKey) {
    if (!stateKey) return '';
    const current = stageJumpExecutionButtonStates.get(stateKey);
    if (!current) return '';

    if (current.expiresAt > 0 && current.expiresAt <= Date.now()) {
      stageJumpExecutionButtonStates.delete(stateKey);
      return '';
    }

    return String(current.state || '').trim();
  }

  function applyStageJumpExecutionButtonVisualState(button, debtId, edocId) {
    if (!(button instanceof HTMLElement)) return;
    const stateKey = getStageJumpExecutionButtonStateKey(debtId, edocId);
    const state = getStageJumpExecutionButtonState(stateKey);

    button.classList.remove('is-processing', 'is-success');
    if (!state) return;

    if (state === 'loading') {
      button.classList.add('is-processing');
      return;
    }

    if (state === 'success') {
      button.classList.add('is-success');
    }
  }

  function createStageJumpExecutionRequestId() {
    return `sj_exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

      .${STAGE_JUMP_BUTTON_CLASS}.is-processing {
        color: transparent !important;
        pointer-events: none !important;
        position: relative;
      }

      .${STAGE_JUMP_BUTTON_CLASS}.is-processing::after {
        content: '';
        position: absolute;
        width: 11px;
        height: 11px;
        border: 2px solid #8a6d00;
        border-top-color: transparent;
        border-radius: 50%;
        animation: dupStageJumpSpin 0.7s linear infinite;
      }

      .${STAGE_JUMP_BUTTON_CLASS}.is-success {
        background: #43a047 !important;
        border-color: #2e7d32 !important;
        color: #ffffff !important;
      }

      @keyframes dupStageJumpSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
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

  function openStageJumpTarget(targetUrl, debtId, options = null) {
    if (!targetUrl || !debtId) return;
    try {
      const nextUrl = new URL(targetUrl, window.location.origin);
      const normalizedDebtId = String(debtId || '').trim();

      if (!normalizedDebtId) return;

      nextUrl.searchParams.set(STAGE_JUMP_HASH_KEY, normalizedDebtId);
      const hashParams = new URLSearchParams(nextUrl.hash.replace(/^#/, ''));
      hashParams.set(STAGE_JUMP_HASH_KEY, normalizedDebtId);
      nextUrl.hash = hashParams.toString();

      const pendingPayload = {
        debtId: normalizedDebtId,
        path: nextUrl.pathname,
        createdAt: Date.now()
      };
      const mode = String(options && options.mode ? options.mode : '').trim();
      const edocId = String(options && options.edocId ? options.edocId : '').trim();
      const analysisText = String(options && options.analysisText ? options.analysisText : '').trim();
      const requestId = String(options && options.requestId ? options.requestId : '').trim();
      const openInBackground = !!(options && options.openInBackground === true);
      const onResult = options && typeof options.onResult === 'function'
        ? options.onResult
        : null;
      const isExecutionAnalysisBackground = (
        openInBackground &&
        mode === STAGE_JUMP_PENDING_MODE_EXECUTION_ANALYSIS
      );

      if (mode) pendingPayload.mode = mode;
      if (edocId) pendingPayload.edocId = edocId;
      if (analysisText) pendingPayload.analysisText = analysisText;
      if (requestId) pendingPayload.requestId = requestId;
      if (!isExecutionAnalysisBackground) {
        saveStageJumpPendingPayloadToStorage(pendingPayload);
      }

      if (openInBackground) {
        if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function')) {
          if (onResult) onResult({ success: false, error: 'NO_RUNTIME' });
          return;
        }

        const backgroundRequestData = {
          url: nextUrl.toString(),
          requestId
        };
        if (isExecutionAnalysisBackground) {
          backgroundRequestData.payload = {
            mode: STAGE_JUMP_PENDING_MODE_EXECUTION_ANALYSIS,
            path: nextUrl.pathname,
            debtId: normalizedDebtId,
            edocId,
            analysisText
          };
        }

        chrome.runtime.sendMessage({
          action: 'STAGEJUMP_OPEN_BACKGROUND_TAB',
          data: backgroundRequestData
        }, (response) => {
          if (!onResult) return;
          const runtimeError = chrome.runtime && chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : '';
          if (runtimeError) {
            onResult({ success: false, error: runtimeError });
            return;
          }
          onResult(response || { success: false, error: 'NO_RESPONSE' });
        });
        return;
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

  function startStageJumpExecutionAnalysisInBackground(targetUrl, debtId, edocId, analysisText) {
    const stateKey = getStageJumpExecutionButtonStateKey(debtId, edocId);
    if (!stateKey) return;

    const requestId = createStageJumpExecutionRequestId();
    stageJumpExecutionRequestStates.set(requestId, stateKey);
    setStageJumpExecutionButtonState(stateKey, 'loading');
    updateStageJumpButtons();

    openStageJumpTarget(targetUrl, debtId, {
      mode: STAGE_JUMP_PENDING_MODE_EXECUTION_ANALYSIS,
      edocId,
      analysisText,
      requestId,
      openInBackground: true,
      onResult: (response) => {
        const isSuccess = !!(response && response.success === true);
        if (isSuccess) return;

        stageJumpExecutionRequestStates.delete(requestId);
        setStageJumpExecutionButtonState(stateKey, '');
        updateStageJumpButtons();

        const reason = response && response.error
          ? String(response.error)
          : 'UNKNOWN_ERROR';
        console.warn('[StageJump] Не удалось запустить фоновый анализ исполнения: ' + reason);
      }
    });
  }

  function getStageJumpExecutionTargetFromButton(button) {
    if (!(button instanceof HTMLElement)) return null;

    const debtId = String(button.dataset.debtId || '').trim();
    if (!debtId) return null;

    const targetUrl = String(button.dataset.targetUrl || '').trim();
    const edocId = String(button.dataset.edocId || '').trim();
    return {
      button,
      debtId,
      targetUrl,
      edocId
    };
  }

  function getStageJumpSelectedExecutionButtons() {
    const rows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
    return rows
      .map((row) => {
        const isSelected = (
          row.getAttribute('aria-selected') === 'true' ||
          row.classList.contains('ui-state-highlight')
        );
        if (!isSelected) return null;

        const jumpButton = row.querySelector(
          `.${STAGE_JUMP_BUTTON_CLASS}[${STAGE_JUMP_BUTTON_MARK_ATTR}="1"]:not([${SLOWSEARCH_JUMP_MARK_ATTR}="1"])`
        );
        return jumpButton instanceof HTMLElement ? jumpButton : null;
      })
      .filter((button) => button instanceof HTMLElement);
  }

  function collectStageJumpExecutionTargets(anchorButton) {
    const summary = {
      selectedButtonsCount: 0,
      missingTargetCount: 0,
      missingEdocCount: 0,
      targets: []
    };

    const dedupeKeys = new Set();
    const addTargetFromButton = (button) => {
      const candidate = getStageJumpExecutionTargetFromButton(button);
      if (!candidate) return;

      if (!candidate.targetUrl) {
        summary.missingTargetCount += 1;
        return;
      }

      if (!candidate.edocId) {
        summary.missingEdocCount += 1;
        return;
      }

      const stateKey = getStageJumpExecutionButtonStateKey(candidate.debtId, candidate.edocId);
      const dedupeKey = stateKey || `${candidate.debtId}::${candidate.edocId}`;
      if (dedupeKeys.has(dedupeKey)) return;

      dedupeKeys.add(dedupeKey);
      summary.targets.push(candidate);
    };

    const selectedButtons = getStageJumpSelectedExecutionButtons();
    summary.selectedButtonsCount = selectedButtons.length;
    if (selectedButtons.length > 0) {
      selectedButtons.forEach(addTargetFromButton);
    } else {
      addTargetFromButton(anchorButton);
    }

    return summary;
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
      return;
    }

    if (action === STAGE_JUMP_MENU_ACTION_EXECUTION_ANALYSIS) {
      const executionTargetsSummary = collectStageJumpExecutionTargets(anchorButton);
      const executionTargets = executionTargetsSummary.targets;
      if (!executionTargets.length) {
        if (executionTargetsSummary.selectedButtonsCount > 0) {
          window.alert('Нет подходящих выбранных строк для "Анализ исполнения". Проверьте маршрут стадии и EDocID.');
        }
        return;
      }

      const inputText = askStageJumpExecutionAnalysisText(getStageJumpAnalysisDraftText());
      if (inputText === null) return;

      const normalizedText = String(inputText || '').trim();
      if (!normalizedText) {
        window.alert('Текст для "Анализ исполнения" не введен.');
        return;
      }

      setStageJumpAnalysisDraftText(normalizedText);
      executionTargets.forEach((target) => {
        startStageJumpExecutionAnalysisInBackground(
          target.targetUrl,
          target.debtId,
          target.edocId,
          normalizedText
        );
      });
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
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_STAGE}">${STAGE_JUMP_MENU_ITEM_STAGE_TEXT}</button>`,
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_EXECUTION_ANALYSIS}">${STAGE_JUMP_MENU_ITEM_EXECUTION_ANALYSIS_TEXT}</button>`
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
    const executionAnalysisItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_EXECUTION_ANALYSIS}"]`);
    const executionTargetsSummary = collectStageJumpExecutionTargets(anchorButton);
    const hasStageTarget = String(anchorButton.dataset.targetUrl || '').trim().length > 0;
    if (stageItem instanceof HTMLButtonElement) {
      stageItem.disabled = !hasStageTarget;
      if (!hasStageTarget) {
        stageItem.title = 'Маршрут стадии/статуса не найден в статической карте ВЗИД.';
      } else {
        stageItem.removeAttribute('title');
      }
    }
    if (executionAnalysisItem instanceof HTMLButtonElement) {
      const selectedCount = executionTargetsSummary.selectedButtonsCount;
      const readyCount = executionTargetsSummary.targets.length;
      const labelSuffix = selectedCount > 1
        ? (readyCount === selectedCount ? ` (${selectedCount})` : ` (${readyCount}/${selectedCount})`)
        : '';
      executionAnalysisItem.textContent = `${STAGE_JUMP_MENU_ITEM_EXECUTION_ANALYSIS_TEXT}${labelSuffix}`;

      const isEnabled = readyCount > 0;
      executionAnalysisItem.disabled = !isEnabled;
      if (!isEnabled) {
        if (selectedCount > 0) {
          if (executionTargetsSummary.missingTargetCount > 0) {
            executionAnalysisItem.title = 'Для выбранных строк не найден маршрут стадии.';
          } else if (executionTargetsSummary.missingEdocCount > 0) {
            executionAnalysisItem.title = 'Для выбранных строк нужен EDocID.';
          } else {
            executionAnalysisItem.title = 'Нет доступных выбранных строк.';
          }
        } else {
          executionAnalysisItem.title = hasStageTarget
            ? 'Для действия нужен EDocID в строке.'
            : 'Маршрут стадии/статуса не найден в статической карте ВЗИД.';
        }
      } else if (selectedCount > 1) {
        executionAnalysisItem.title = `Будет запущено: ${readyCount}`;
      } else {
        executionAnalysisItem.removeAttribute('title');
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
      const edocId = getRowCellTextByAria(row, 'list_EDocID') || getRowCellTextByAria(row, 'list_EdocID');
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
        if (edocId) {
          jumpButton.dataset.edocId = edocId;
        } else {
          delete jumpButton.dataset.edocId;
        }
        if (target) {
          jumpButton.dataset.targetUrl = target.href;
          jumpButton.title = [
            `DebtID: ${debtId}`,
            'Выберите действие:',
            `1) ${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}`,
            `2) ${STAGE_JUMP_MENU_ITEM_STAGE_TEXT}`,
            `3) ${STAGE_JUMP_MENU_ITEM_EXECUTION_ANALYSIS_TEXT}${edocId ? '' : ' (недоступен: нет EDocID)'}`,
            `Маршрут: ${target.pathText || target.path.join(' > ')}`
          ].join('\n');
        } else {
          delete jumpButton.dataset.targetUrl;
          jumpButton.title = [
            `DebtID: ${debtId}`,
            'Выберите действие:',
            `1) ${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}`,
            `2) ${STAGE_JUMP_MENU_ITEM_STAGE_TEXT} (недоступен: маршрут не найден)`,
            `3) ${STAGE_JUMP_MENU_ITEM_EXECUTION_ANALYSIS_TEXT} (недоступен: нет маршрута стадии)`
          ].join('\n');
        }
      } else {
        jumpButton.classList.add('is-disabled');
        delete jumpButton.dataset.targetUrl;
        delete jumpButton.dataset.debtId;
        delete jumpButton.dataset.edocId;
        jumpButton.title = 'Не удалось определить DebtID строки.';
      }

      applyStageJumpExecutionButtonVisualState(jumpButton, debtId, edocId);
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

  function readStageJumpPendingPayloadFromStorage() {
    try {
      const raw = window.localStorage.getItem(STAGE_JUMP_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const createdAt = Number(parsed.createdAt || 0);
      const path = String(parsed.path || '').trim();

      if (!createdAt) return null;
      if ((Date.now() - createdAt) > STAGE_JUMP_STORAGE_TTL_MS) return null;
      if (path && path !== window.location.pathname) return null;

      return parsed;
    } catch (error) {
      return null;
    }
  }

  function saveStageJumpPendingPayloadToStorage(payload) {
    if (!payload || typeof payload !== 'object') return;
    try {
      window.localStorage.setItem(STAGE_JUMP_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // ignore
    }
  }

  function normalizeStageJumpExecutionAnalysisPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const modeRaw = String(payload.mode || '').trim();
    if (modeRaw && modeRaw !== STAGE_JUMP_PENDING_MODE_EXECUTION_ANALYSIS) return null;

    const edocId = String(payload.edocId || '').trim();
    const analysisText = String(payload.analysisText || '').trim();
    if (!edocId || !analysisText) return null;

    return {
      ...payload,
      mode: STAGE_JUMP_PENDING_MODE_EXECUTION_ANALYSIS,
      edocId,
      analysisText
    };
  }

  function getStageJumpExecutionAnalysisPayloadFromStorage() {
    const payload = readStageJumpPendingPayloadFromStorage();
    return normalizeStageJumpExecutionAnalysisPayload(payload);
  }

  function requestStageJumpExecutionAnalysisPayloadFromBackground() {
    return new Promise((resolve) => {
      if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function')) {
        resolve(null);
        return;
      }

      try {
        chrome.runtime.sendMessage(
          { action: 'STAGEJUMP_GET_EXECUTION_ANALYSIS_PAYLOAD' },
          (response) => {
            const runtimeError = chrome.runtime && chrome.runtime.lastError
              ? chrome.runtime.lastError.message
              : '';
            if (runtimeError) {
              resolve(null);
              return;
            }

            if (!response || response.success !== true) {
              resolve(null);
              return;
            }

            resolve(normalizeStageJumpExecutionAnalysisPayload(response.data || null));
          }
        );
      } catch (error) {
        resolve(null);
      }
    });
  }

  function getStageJumpAnalysisDraftText() {
    try {
      return String(window.localStorage.getItem(STAGE_JUMP_ANALYSIS_DRAFT_STORAGE_KEY) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function setStageJumpAnalysisDraftText(text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;
    try {
      window.localStorage.setItem(STAGE_JUMP_ANALYSIS_DRAFT_STORAGE_KEY, normalizedText);
    } catch (error) {
      // ignore
    }
  }

  function askStageJumpExecutionAnalysisText(defaultValue) {
    const initialValue = String(defaultValue || '').trim();
    const message = 'Введите текст для "Анализ исполнения":';
    return window.prompt(message, initialValue);
  }

  function getStageJumpDebtIdFromStorage() {
    const payload = readStageJumpPendingPayloadFromStorage();
    if (!payload) return '';
    return String(payload.debtId || '').trim();
  }

  function clearStageJumpDebtIdStorage(options = null) {
    const preserveExecution = !!(
      options &&
      typeof options === 'object' &&
      options.preserveExecution === true
    );

    if (!preserveExecution) {
      try {
        window.localStorage.removeItem(STAGE_JUMP_STORAGE_KEY);
      } catch (error) {
        // ignore
      }
      return;
    }

    const payload = getStageJumpExecutionAnalysisPayloadFromStorage();
    if (!payload) {
      try {
        window.localStorage.removeItem(STAGE_JUMP_STORAGE_KEY);
      } catch (error) {
        // ignore
      }
      return;
    }

    const nextPayload = {
      ...payload,
      createdAt: Date.now()
    };
    delete nextPayload.debtId;
    saveStageJumpPendingPayloadToStorage(nextPayload);
  }

  function getStageJumpActionPayloadForPath(pathname) {
    const payload = readStageJumpPendingPayloadFromStorage();
    if (!payload) return null;
    const path = String(payload.path || '').trim();
    if (!path) return null;
    if (path !== String(pathname || '').trim()) return null;
    return payload;
  }

  function clearStageJumpPendingPayloadForCurrentPath() {
    const payload = getStageJumpActionPayloadForPath(window.location.pathname);
    if (!payload) return;
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

  function clearStageJumpDebtIdFromHash(options = null) {
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

    clearStageJumpDebtIdStorage(options);

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

  function getStageJumpGridElementFromSearchInput(searchInput) {
    if (!(searchInput instanceof HTMLElement)) return null;

    const jqGridRoot = searchInput.closest('.ui-jqgrid');
    if (jqGridRoot) {
      const rootGrid = jqGridRoot.querySelector('table.ui-jqgrid-btable');
      if (rootGrid) return rootGrid;
    }

    const searchTable = searchInput.closest('table[id]');
    if (searchTable && /^gs_/.test(String(searchTable.id || ''))) {
      const linkedGridId = String(searchTable.id).slice(3);
      if (linkedGridId) {
        const linkedGrid = document.getElementById(linkedGridId);
        if (linkedGrid) return linkedGrid;
      }
    }

    return null;
  }

  function getStageJumpGridCandidates(searchInput) {
    const candidates = [];
    const seen = new Set();
    const pushUnique = (el) => {
      if (!el || typeof el !== 'object') return;
      if (seen.has(el)) return;
      seen.add(el);
      candidates.push(el);
    };

    pushUnique(getStageJumpGridElementFromSearchInput(searchInput));
    pushUnique(getStageJumpGridElement());

    const bySelector = Array.from(document.querySelectorAll('table.ui-jqgrid-btable'));
    bySelector.forEach(pushUnique);

    if (window.jQuery) {
      try {
        const jqById = window.jQuery('#list')[0];
        pushUnique(jqById);
      } catch (error) {
        // ignore
      }
      try {
        window.jQuery('table.ui-jqgrid-btable').each((_, el) => pushUnique(el));
      } catch (error) {
        // ignore
      }
    }

    return candidates;
  }

  function getStageJumpBusyGrid(searchInput) {
    const candidates = getStageJumpGridCandidates(searchInput);
    for (const grid of candidates) {
      if (isStageJumpGridBusy(grid)) return grid;
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

    try {
      jqXhr.abort();
      return true;
    } catch (error) {
      return false;
    }
  }

  function abortStageJumpLoadWithFallback(grid) {
    if (abortStageJumpGridLoad(grid)) return 'jqxhr';

    // Жесткий fallback: останавливаем текущую сетевую загрузку страницы.
    // Нужен для случаев, когда jqXhr не пробрасывается в content-world.
    try {
      window.stop();
      return 'window-stop';
    } catch (error) {
      return '';
    }
  }

  function getStageJumpTimerTypeText() {
    const el = document.querySelector('#pyramid-stage-timer .pyramid-stage-timer-type');
    return String(el && el.textContent ? el.textContent : '').trim().toLowerCase();
  }

  function hasStageJumpLoadingOverlay(searchInput) {
    const candidates = getStageJumpGridCandidates(searchInput);
    for (const grid of candidates) {
      if (!(grid instanceof HTMLElement)) continue;

      const gridId = String(grid.id || '').trim();
      if (!gridId) continue;

      const overlay = document.getElementById('load_' + gridId);
      if (!overlay) continue;

      const text = String(overlay.textContent || '').trim();
      if (!text) continue;

      const style = window.getComputedStyle(overlay);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
      if (isVisible) return true;
    }

    return false;
  }

  function shouldForceStopForManualSearchAbort(searchInput) {
    const timerType = getStageJumpTimerTypeText();
    if (timerType.includes('загруз') || timerType.includes('фильтрац')) return true;
    return hasStageJumpLoadingOverlay(searchInput);
  }

  function abortStageJumpBusyGridRequest(searchInput) {
    const busyGrid = getStageJumpBusyGrid(searchInput);
    if (busyGrid) {
      const mode = abortStageJumpLoadWithFallback(busyGrid);
      if (mode) return mode;
    }

    // Фолбэк: иногда readyState не читается стабильно, но jqXhr.abort доступен.
    const candidates = getStageJumpGridCandidates(searchInput);
    for (const grid of candidates) {
      if (abortStageJumpGridLoad(grid)) return 'jqxhr';
    }

    // Если по UI явно идёт загрузка/фильтрация, используем принудительный stop.
    if (shouldForceStopForManualSearchAbort(searchInput)) {
      return abortStageJumpLoadWithFallback(null);
    }

    return '';
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
    const ownerWindow = input.ownerDocument && input.ownerDocument.defaultView
      ? input.ownerDocument.defaultView
      : window;
    const isTextArea = ownerWindow.HTMLTextAreaElement && input instanceof ownerWindow.HTMLTextAreaElement;
    const proto = isTextArea
      ? ownerWindow.HTMLTextAreaElement.prototype
      : ownerWindow.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
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

    const STATE_WAIT_LOAD_START = 'WAIT_LOAD_START';
    const STATE_ABORT_LOAD = 'ABORT_LOAD';
    const STATE_WAIT_FILTER_DELAY = 'WAIT_FILTER_DELAY';
    const STATE_APPLY_FILTER = 'APPLY_FILTER';
    const STATE_CONFIRM_RESULT = 'CONFIRM_RESULT';

    let state = STATE_WAIT_LOAD_START;
    let abortPerformed = false;
    let filterDispatched = false;
    let abortAtMs = 0;
    let filterDispatchedAtMs = 0;
    let loggedLoadWait = false;
    let loggedLoadFallback = false;
    let timer = null;

    const startedAt = Date.now();
    const maxDurationMs = 60 * 1000;
    const intervalMs = 120;
    const waitLoadStartTimeoutMs = 20 * 1000;
    const filterDelayAfterAbortMs = 1;
    const postApplyConfirmMs = 12 * 1000;

    console.info('[StageJump] DebtID param detected: ' + debtId);
    console.info('[StageJump] Rule active: load start -> abort -> 500ms -> DebtID filter.');

    const finishSuccess = () => {
      clearInterval(timer);
      clearStageJumpDebtIdFilterInput();
      const preserveExecution = !!getStageJumpExecutionAnalysisPayloadFromStorage();
      clearStageJumpDebtIdFromHash({ preserveExecution });
      console.info('[StageJump] DebtID applied once.');
    };

    const finishFail = () => {
      clearInterval(timer);
      console.warn('[StageJump] Failed to apply DebtID within timeout. State: ' + state + ', aborted=' + String(abortPerformed));
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

      if (state === STATE_WAIT_LOAD_START) {
        const hasLoadSignal = hasStageLoadStartSince(startedAt);
        const gridBusyNow = isStageJumpGridBusy(grid);

        if (hasLoadSignal) {
          state = STATE_ABORT_LOAD;
          console.info('[StageJump] StageTimer reported load start: ' + (stageJumpLastStageLoadType || 'n/a'));
          return;
        }

        // Фолбэк: если сообщение StageTimer пропущено, но jqXhr уже активен, считаем это стартом загрузки.
        if (gridBusyNow) {
          state = STATE_ABORT_LOAD;
          if (!loggedLoadFallback) {
            loggedLoadFallback = true;
            console.info('[StageJump] Load start inferred from active jqXhr (fallback).');
          }
          return;
        }

        if (!loggedLoadWait) {
          loggedLoadWait = true;
          console.info('[StageJump] Waiting for real stage load start (ignoring filter starts).');
        }

        if (elapsedMs >= waitLoadStartTimeoutMs) {
          state = STATE_ABORT_LOAD;
          console.warn('[StageJump] No load start signal in time, switching to abort fallback.');
        }
        return;
      }

      if (state === STATE_ABORT_LOAD) {
        const abortMode = abortStageJumpLoadWithFallback(grid);
        const aborted = !!abortMode;
        abortPerformed = abortPerformed || aborted;
        abortAtMs = Date.now();
        state = STATE_WAIT_FILTER_DELAY;

        if (abortMode === 'jqxhr') {
          console.info('[StageJump] Stage load aborted via jqXhr.');
        } else if (abortMode === 'window-stop') {
          console.info('[StageJump] Stage load aborted via window.stop() fallback.');
        } else {
          console.info('[StageJump] Abort did not report success, continuing to delayed filter.');
        }
        return;
      }

      if (state === STATE_WAIT_FILTER_DELAY) {
        if ((Date.now() - abortAtMs) < filterDelayAfterAbortMs) return;
        state = STATE_APPLY_FILTER;
        return;
      }

      if (state === STATE_APPLY_FILTER) {
        if (filterDispatched) {
          state = STATE_CONFIRM_RESULT;
          return;
        }

        const isApplied = applyStageJumpDebtIdFilterOnce(debtId);
        if (!isApplied) return;

        filterDispatched = true;
        filterDispatchedAtMs = Date.now();
        state = STATE_CONFIRM_RESULT;

        console.info('[StageJump] DebtID filter dispatched once after abort delay.');
        return;
      }

      if (state === STATE_CONFIRM_RESULT) {
        if ((Date.now() - filterDispatchedAtMs) >= postApplyConfirmMs) {
          finishFail();
        }
        return;
      }
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


  function isStageJumpElementVisible(element) {
    if (!element || typeof element !== 'object') return false;
    if (Number(element.nodeType) !== 1) return false;
    const ownerWindow = element.ownerDocument && element.ownerDocument.defaultView
      ? element.ownerDocument.defaultView
      : window;
    const style = ownerWindow.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findStageJumpRowByEdocId(edocId) {
    const normalizedEdocId = String(edocId || '').trim();
    if (!normalizedEdocId) return null;

    const byId = document.getElementById(normalizedEdocId);
    if (byId && byId.classList && byId.classList.contains('jqgrow')) return byId;

    const rows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
    for (const row of rows) {
      const cell = row.querySelector('td[aria-describedby="list_EDocID"], td[aria-describedby="list_EdocID"], td[aria-describedby$="_EDocID"], td[aria-describedby$="_EdocID"]');
      if (!cell) continue;
      const value = String(cell.textContent || '').trim();
      if (value === normalizedEdocId) return row;
    }
    return null;
  }

  function selectStageJumpRowByEdocId(edocId) {
    const row = findStageJumpRowByEdocId(edocId);
    if (!(row instanceof HTMLElement)) return false;

    const rowId = String(row.id || '').trim();
    if (rowId && window.jQuery && window.jQuery.fn && window.jQuery.fn.jqGrid) {
      try {
        window.jQuery('#list').jqGrid('setSelection', rowId, true);
      } catch (error) {
        // ignore
      }
    }

    const checkbox = row.querySelector('input.cbox[type="checkbox"]');
    if (checkbox instanceof HTMLInputElement && !checkbox.checked) {
      checkbox.click();
    }

    if (row.getAttribute('aria-selected') !== 'true' && !row.classList.contains('ui-state-highlight')) {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    return row.getAttribute('aria-selected') === 'true' ||
      row.classList.contains('ui-state-highlight') ||
      (checkbox instanceof HTMLInputElement && checkbox.checked);
  }

  function clickStageJumpToolbarButtonByText(buttonText) {
    const targetText = normalizeStageJumpText(buttonText);
    if (!targetText) return false;

    const labels = Array.from(document.querySelectorAll('.ui-pg-button .ui-pg-button-text, .ui-pg-button-text'));
    for (const label of labels) {
      if (!isStageJumpElementVisible(label)) continue;
      const labelText = normalizeStageJumpText(label.textContent || '');
      if (labelText !== targetText) continue;

      const clickable = label.closest('.ui-pg-button, button, a');
      if (clickable instanceof HTMLElement) {
        if (clickable.matches('.ui-state-disabled, [disabled]')) return false;
        clickable.click();
        return true;
      }

      if (label instanceof HTMLElement) {
        label.click();
        return true;
      }
    }

    return false;
  }

  function getStageJumpExecutionAnalysisDocuments() {
    const docs = [document];
    const iframeCandidates = Array.from(document.querySelectorAll('.ui-dialog iframe, iframe'));
    iframeCandidates.forEach((iframe) => {
      if (!(iframe instanceof HTMLIFrameElement)) return;
      try {
        if (iframe.contentDocument) docs.push(iframe.contentDocument);
      } catch (error) {
        // ignore cross-origin if any
      }
    });
    return docs;
  }

  function getStageJumpExecutionAnalysisSuccessAlertCandidates() {
    const alerts = [];
    const docs = getStageJumpExecutionAnalysisDocuments();
    docs.forEach((doc) => {
      if (!doc) return;
      const candidates = doc.querySelectorAll('.alert.alert-success.alert-dismissible[role="alert"], .alert.alert-success[role="alert"]');
      candidates.forEach((candidate) => {
        if (candidate && candidate.nodeType === 1) {
          alerts.push(candidate);
        }
      });
    });
    return alerts;
  }

  function captureStageJumpExecutionAnalysisSuccessAlertState() {
    const state = new Map();
    const alerts = getStageJumpExecutionAnalysisSuccessAlertCandidates();
    alerts.forEach((alert) => {
      state.set(alert, {
        visible: isStageJumpElementVisible(alert),
        text: normalizeStageJumpText(alert.textContent || '')
      });
    });
    return state;
  }

  function hasStageJumpExecutionAnalysisSaveSuccessAlert(previousState) {
    const successText = normalizeStageJumpText('Анализ исполнения успешно занес');
    if (!successText) return false;

    const alerts = getStageJumpExecutionAnalysisSuccessAlertCandidates();
    for (const alert of alerts) {
      if (!isStageJumpElementVisible(alert)) continue;
      const currentText = normalizeStageJumpText(alert.textContent || '');
      if (!currentText.includes(successText)) continue;

      if (!(previousState instanceof Map)) return true;
      const previous = previousState.get(alert);
      if (!previous) return true;
      if (!previous.visible) return true;
      if (!String(previous.text || '').includes(successText)) return true;
    }

    return false;
  }

  function getStageJumpExecutionAnalysisFormContext() {
    const docs = getStageJumpExecutionAnalysisDocuments();

    for (const doc of docs) {
      if (!doc) continue;

      const saveButton = Array.from(doc.querySelectorAll('button, input[type="submit"], input[type="button"], a.ui-button'))
        .find((el) => {
          if (!isStageJumpElementVisible(el)) return false;
          const text = normalizeStageJumpText(el.textContent || el.value || '');
          return text.includes(normalizeStageJumpText('Сохранить информацию'));
        });
      if (!saveButton) continue;

      const inputCandidates = Array.from(doc.querySelectorAll('textarea, input[type="text"], input:not([type])'))
        .filter((el) => isStageJumpElementVisible(el));
      if (!inputCandidates.length) continue;

      const preferredInput = inputCandidates.find((el) => {
        const marker = normalizeStageJumpText([
          el.id || '',
          el.name || '',
          el.className || '',
          el.getAttribute('placeholder') || ''
        ].join(' '));
        return marker.includes('примеч') || marker.includes('коммент') || marker.includes('анализ');
      }) || inputCandidates[0];
      if (!preferredInput) continue;

      return { input: preferredInput, saveButton };
    }

    return null;
  }

  function notifyStageJumpExecutionAnalysisResult(success, errorMessage) {
    if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function')) return;
    try {
      chrome.runtime.sendMessage({
        action: 'STAGEJUMP_EXECUTION_ANALYSIS_FINISH',
        data: {
          success: !!success,
          error: String(errorMessage || '')
        }
      });
    } catch (error) {
      // ignore
    }
  }

  function runStageJumpExecutionAnalysisFlow(payload, options = null) {
    const normalizedPayload = normalizeStageJumpExecutionAnalysisPayload(payload);
    if (!normalizedPayload) return false;

    const clearStorageOnFinish = !!(
      options &&
      typeof options === 'object' &&
      options.clearStorageOnFinish === true
    );
    const edocId = String(normalizedPayload.edocId || '').trim();
    const analysisText = String(normalizedPayload.analysisText || '').trim();
    if (!edocId || !analysisText) {
      if (clearStorageOnFinish) {
        clearStageJumpPendingPayloadForCurrentPath();
      }
      notifyStageJumpExecutionAnalysisResult(false, 'EMPTY_PAYLOAD');
      return false;
    }

    const startedAt = Date.now();
    const timeoutMs = 90 * 1000;
    const intervalMs = 180;
    const saveStartTimeoutMs = 20 * 1000;
    const saveCompleteTimeoutMs = 45 * 1000;
    let timer = null;
    let rowSelected = false;
    let analysisOpened = false;
    let saveClicked = false;
    let saveClickAtMs = 0;
    let saveRequestStarted = false;
    let saveRequestStartAtMs = 0;
    let saveSuccessAlertStateBeforeClick = null;

    const finishSuccess = () => {
      clearInterval(timer);
      if (clearStorageOnFinish) {
        clearStageJumpPendingPayloadForCurrentPath();
      }
      notifyStageJumpExecutionAnalysisResult(true, '');
      console.info('[StageJump] Execution analysis completed in background for EDocID=' + edocId);
    };

    const finishFail = (reason) => {
      clearInterval(timer);
      if (clearStorageOnFinish) {
        clearStageJumpPendingPayloadForCurrentPath();
      }
      notifyStageJumpExecutionAnalysisResult(false, reason);
      console.warn('[StageJump] Execution analysis failed in background: ' + reason);
    };

    const runAttempt = () => {
      if ((Date.now() - startedAt) >= timeoutMs) {
        finishFail('TIMEOUT');
        return;
      }

      if (!rowSelected) {
        rowSelected = selectStageJumpRowByEdocId(edocId);
        return;
      }

      if (!analysisOpened) {
        analysisOpened = clickStageJumpToolbarButtonByText('Анализ исполнения');
        return;
      }

      if (saveClicked) {
        if (hasStageJumpExecutionAnalysisSaveSuccessAlert(saveSuccessAlertStateBeforeClick)) {
          finishSuccess();
          return;
        }

        const saveErrorDetected = stageJumpLastStageTimerErrorAtMs >= saveClickAtMs;
        if (saveErrorDetected) {
          finishFail('SAVE_REQUEST_ERROR');
          return;
        }

        if (!saveRequestStarted) {
          if (stageJumpLastEditDocStopAtMs >= saveClickAtMs) {
            finishSuccess();
            return;
          }

          if (stageJumpLastEditDocStartAtMs >= saveClickAtMs) {
            saveRequestStarted = true;
            saveRequestStartAtMs = stageJumpLastEditDocStartAtMs;
            return;
          }

          if ((Date.now() - saveClickAtMs) >= saveStartTimeoutMs) {
            finishFail('SAVE_REQUEST_NOT_STARTED');
          }
          return;
        }

        if (stageJumpLastEditDocStopAtMs >= saveRequestStartAtMs) {
          finishSuccess();
          return;
        }

        if ((Date.now() - saveRequestStartAtMs) >= saveCompleteTimeoutMs) {
          finishFail('SAVE_REQUEST_TIMEOUT');
        }
        return;
      }

      const formContext = getStageJumpExecutionAnalysisFormContext();
      if (!formContext) return;

      const input = formContext.input;
      const saveButton = formContext.saveButton;
      if (!input || !saveButton) return;

      setNativeInputValue(input, analysisText);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      saveSuccessAlertStateBeforeClick = captureStageJumpExecutionAnalysisSuccessAlertState();
      saveButton.click();
      saveClicked = true;
      saveClickAtMs = Date.now();
    };

    runAttempt();
    timer = setInterval(runAttempt, intervalMs);
    return true;
  }

  function initStageJumpExecutionAnalysisFromStorage() {
    if (!window.location.pathname.includes('/ovzid/')) return;

    requestStageJumpExecutionAnalysisPayloadFromBackground()
      .then((payloadFromBackground) => {
        const payload = payloadFromBackground || getStageJumpExecutionAnalysisPayloadFromStorage();
        if (!payload) return;

        runStageJumpExecutionAnalysisFlow(payload, {
          clearStorageOnFinish: !payloadFromBackground
        });
      })
      .catch(() => {
        const payload = getStageJumpExecutionAnalysisPayloadFromStorage();
        if (!payload) return;
        runStageJumpExecutionAnalysisFlow(payload, {
          clearStorageOnFinish: true
        });
      });
  }

  // --- Подсветка строк/колонок в Google Sheets (без изменений) ---
  if (window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/')) {
    // ... (код без изменений)
  }

  // Запуск
  initStageJumpDebtIdFilterFromHash();
  initStageJumpExecutionAnalysisFromStorage();
  initSlowsearchDebtIdFilterFromHash();
  initStageJumpButtons();
  initSlowsearchJumpButtons();
  initScreenshotHideMode();
  init();

  // --- Логика модального окна для подтверждения действий ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.action !== 'show_confirmation_modal_in_tab') {
          return false;
      }

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
      return true; // Keep the message channel open for async response
  });
})();
