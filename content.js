(function() {
  // Этот скрипт отвечает за поиск дубликатов и "Турбо-режим".
  if (window.hasDuplicateCheckerRun) return;
  window.hasDuplicateCheckerRun = true;

  const HIGHLIGHT_CLASS = 'dupe-highlight-active';
  const LS_SELECTOR = '[aria-describedby="list_AccAddress_AccountNumber"]';
  const SCREENSHOT_MODE_CLASS = 'dup-ext-screenshot-mode';
  const SCREENSHOT_HIDE_STYLE_ID = 'dup-ext-screenshot-style';
  const SCREENSHOT_HIDE_EVENT = 'dup-ext-screenshot-visibility-change';
  const SCREENSHOT_FRAME_BRIDGE_MESSAGE = 'dup-screenshot-hotkey-frame-bridge';
  const SCREENSHOT_HIDE_DURATION_MS = 2500;
  const SCREENSHOT_HIDE_ON_BLUR_DURATION_MS = 2500;
  const SCREENSHOT_HIDE_PRINT_SCREEN_DURATION_MS = 5000;
  const SCREENSHOT_HIDE_PRINT_SCREEN_ON_BLUR_DURATION_MS = 5000;
  const SCREENSHOT_THROTTLE_MS = 150;
  const KEY_CODE_PAGE_DOWN = 34;
  const KEY_CODE_PRINT_SCREEN = 44;
  const KEY_CODE_F1 = 112;
  const KEY_CODE_F2 = 113;
  const KEY_CODE_F3 = 114;
  const KEY_CODE_F4 = 115;
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
  const STAGE_JUMP_MENU_ACTION_COPY_INFO = 'copy_info';
  const STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT = 'Переход в Глобальный поиск';
  const STAGE_JUMP_MENU_ITEM_STAGE_TEXT = 'Переход к ИД на стадии';
  const STAGE_JUMP_MENU_ITEM_COPY_INFO_TEXT = 'Скопировать инфо об ИД';
  const EXECUTION_ANALYSIS_PATH = '/ovzid/actions/execution-analysis';
  const EXECUTION_ANALYSIS_BLANK_PATH = '/pages/blank';
  const EXECUTION_ANALYSIS_STATE_STORAGE_KEY = 'dup_execution_analysis_state_v1';
  const EXECUTION_ANALYSIS_PARAMS_STORAGE_KEY = 'dup_execution_analysis_params_v1';
  const EXECUTION_ANALYSIS_BATCH_SIZE_DEFAULT = 10;
  const EXECUTION_ANALYSIS_INTERVAL_DEFAULT_MS = 0;
  const EXECUTION_ANALYSIS_PROCESSED_TEXT = 'Да';
  const EXECUTION_ANALYSIS_MANUAL_DIALOG_ID = 'dup-execution-analysis-manual-dialog';
  const EXECUTION_ANALYSIS_FILE_INPUT_ID = 'dup-execution-analysis-file-input';
  const ID_CARD_CHECK_STORAGE_KEY = 'dup_id_card_check_state_v1';
  const ID_CARD_CHECK_INPUT_DIALOG_ID = 'dup-id-card-check-input-dialog';
  const ID_CARD_CHECK_CHOICE_DIALOG_ID = 'dup-id-card-check-choice-dialog';
  const ID_CARD_CHECK_ACTION_DIALOG_ID = 'dup-id-card-check-action-dialog';
  const ID_CARD_CHECK_NAV_ID = 'dup-id-card-check-nav';
  const GRID_CARD_CHECK_NAV_ID = 'dup-grid-card-check-nav';
  const GRID_CARD_CHECK_CHOICE_DIALOG_ID = 'dup-grid-card-check-choice-dialog';
  const EXECUTION_ANALYSIS_STATUS_IDLE = 'idle';
  const EXECUTION_ANALYSIS_STATUS_READY = 'ready';
  const EXECUTION_ANALYSIS_STATUS_RUNNING = 'running';
  const EXECUTION_ANALYSIS_STATUS_PAUSED = 'paused';
  const EXECUTION_ANALYSIS_STATUS_COMPLETED = 'completed';
  const EXECUTION_ANALYSIS_STATUS_STOPPED = 'stopped';
  const EXECUTION_ANALYSIS_INTERVAL_OPTIONS = Object.freeze([
    { label: '0', value: 0 },
    { label: '5 сек', value: 5000 },
    { label: '10 сек', value: 10000 },
    { label: '30 сек', value: 30000 }
  ]);
  const SLOWSEARCH_TARGET_PATH = '/ovzid/status/all';
  const SLOWSEARCH_JUMP_BUTTON_TEXT = 'Перейти в ОВЗИД (status/all)';
  const SLOWSEARCH_JUMP_MARK_ATTR = 'data-dup-slowsearch-jump';
  const SLOWSEARCH_CITIES_TOGGLE_SELECTOR = 'button.btn-cities.dropdown-toggle';
  const SLOWSEARCH_CITIES_LINK_SELECTOR = 'a.department-switch';
  const DEPARTMENT_DROPDOWN_STATE_STORAGE_KEY = 'dup_show_hidden_departments';
  const DEPARTMENT_DROPDOWN_SEARCH_INPUT_SELECTOR = 'input#search-department-field';
  const DEPARTMENT_DROPDOWN_MENU_SELECTOR = '.dropdown-menu-sub.show-depid';
  const DEPARTMENT_DROPDOWN_TOGGLE_STYLE_ID = 'dup-show-hidden-departments-style';
  const DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS = 'dup-show-hidden-departments-toggle-row';
  const DEPARTMENT_DROPDOWN_TOGGLE_LABEL_CLASS = 'dup-show-hidden-departments-toggle-label';
  const DEPARTMENT_DROPDOWN_TOGGLE_CHECKBOX_CLASS = 'dup-show-hidden-departments-toggle-checkbox';
  const DEPARTMENT_DROPDOWN_SHOW_HIDDEN_CLASS = 'dup-show-hidden-departments';
  const DEPARTMENT_DROPDOWN_HIDDEN_ATTR = 'data-dup-hidden-department';
  const DEPARTMENT_DROPDOWN_ORIGINAL_ORDER_ATTR = 'data-dup-original-order';
  const DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_ATTR = 'data-dup-original-max-height';
  const DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_PX_ATTR = 'data-dup-original-max-height-px';
  const DEPARTMENT_DROPDOWN_TOGGLE_TEXT = 'Показать скрытые департаменты';
  const DEPARTMENT_ALLOWED_DEPIDS_ORDER = [
    '39',
    '43',
    '40',
    '61',
    '16',
    '62',
    '24',
    '14',
    '60',
    '82',
    '72',
    '68',
    '19',
    '11',
    '66',
    '59',
    '12',
    '67',
    '69',
    '41',
    '83',
    '6',
    '36',
    '34',
    '32',
    '28',
    '29',
    '56',
    '27',
    '30',
    '31',
    '35',
    '37',
    '33',
    '38',
    '70',
    '81',
    '89',
    '88',
    '87',
    '86'
  ];
  const DEPARTMENT_ALLOWED_DEPIDS = new Set(DEPARTMENT_ALLOWED_DEPIDS_ORDER);
  const DEPARTMENT_ALLOWED_DEPID_ORDER_INDEX = new Map(
    DEPARTMENT_ALLOWED_DEPIDS_ORDER.map((depid, index) => [depid, index])
  );
  const GRID_ABORT_REWRITE_EVENT = 'dup-grid-abort-message';
  const GRID_ABORT_REWRITE_TEXT = 'Загрузка/Фильтрация была прервана пользователем вручную. Повторите действие заново.';
  const FSSP_REESTR_PATH_PART = '/ovzid/fsspreestr';
  const FSSP_REESTR_GROUPING_STORAGE_KEY = 'dup_fsspreestr_group_duplicates';
  const FSSP_REESTR_GROUPING_CHANGE_EVENT = 'dup-fsspreestr-grouping-toggle';
  const FSSP_REESTR_GROUPING_TOGGLE_ID = 'dup-fsspreestr-grouping-toggle';
  const FSSP_REESTR_GROUPING_TOGGLE_INPUT_ID = 'dup-fsspreestr-grouping-toggle-input';
  const FSSP_REESTR_GROUPING_STYLE_ID = 'dup-fsspreestr-grouping-style';
  const FSSP_REESTR_GROUPING_HOST_CLASS = 'dup-fsspreestr-grouping-host';
  const FSSP_REESTR_GROUPING_HOST_LEFT_VAR = '--dup-fsspreestr-grouping-left-offset';
  const FSSP_REESTR_ORIGINAL_INDEX_ATTR = 'data-dup-fsspreestr-original-index';
  const FSSP_REESTR_DUPLICATE_CLASS = 'dup-fsspreestr-duplicate';
  const FSSP_REESTR_STATUS_CLASS = 'dup-fsspreestr-status';
  const FSSP_REESTR_DUPLICATE_COLOR_PALETTE = [
    { background: '#A9D2FF' },
    { background: '#C6B6FF' },
    { background: '#9FDDE8' },
    { background: '#FFD6AE' },
    { background: '#E7B6D7' },
    { background: '#BCC7D2' },
    { background: '#AFC4FF' },
    { background: '#D5B7E8' },
    { background: '#F4BECA' },
    { background: '#B8C1E6' }
  ];
  const FSSP_REESTR_STATUS_COLOR_BY_TEXT = {
    'проведен': '#C8F2CC',
    'проведен (нет данных)': '#FFF3B8',
    'не проведен': '#FFC9C9'
  };
  const EPGU_REQUESTS_PATH_PART = '/ovzid/epgurequests';
  const EPGU_REQUESTS_DUPLICATE_CLASS = 'dup-epgu-duplicate';
  const EPGU_REQUESTS_FILL_CLASS = 'dup-epgu-fill';
  const EPGU_REQUESTS_DUPLICATE_COLOR_PALETTE = [
    { background: '#A9D2FF' },
    { background: '#C6B6FF' },
    { background: '#9FDDE8' },
    { background: '#FFD6AE' },
    { background: '#E7B6D7' },
    { background: '#BCC7D2' },
    { background: '#AFC4FF' },
    { background: '#D5B7E8' },
    { background: '#F4BECA' },
    { background: '#B8C1E6' }
  ];
  const EPGU_REQUESTS_COLOR_RED = '#FFC9C9';
  const EPGU_REQUESTS_COLOR_GREEN = '#C8F2CC';
  const EPGU_REQUESTS_COLOR_YELLOW = '#FFF3B8';
  const EXTENSION_UI_SETTINGS_STYLE_ID = 'dup-extension-ui-settings-style';
  const EXTENSION_UI_SETTINGS_OVERLAY_ID = 'dup-extension-ui-settings-overlay';
  const EXTENSION_UI_SETTINGS_PANEL_ID = 'dup-extension-ui-settings-panel';
  const EXTENSION_UI_SETTINGS_OVERLAY_CLASS = 'dup-extension-ui-settings-overlay';
  const EXTENSION_UI_SETTINGS_PANEL_CLASS = 'dup-extension-ui-settings-panel';
  const EXTENSION_UI_SETTINGS_ITEM_CLASS = 'dup-extension-ui-settings-item';
  const EXTENSION_UI_SETTINGS_TITLE_CLASS = 'dup-extension-ui-settings-title';
  const EXTENSION_UI_SETTINGS_DESCRIPTION_CLASS = 'dup-extension-ui-settings-description';
  const EXTENSION_UI_SETTINGS_INPUT_ATTR = 'data-dup-ui-setting';
  const EXTENSION_UI_SETTINGS_HINT_TEXT = 'Состояние сохраняется для pyramid.vostok-electra.ru и всех его поддоменов.';
  const LEGACY_SEASONAL_THEME_STORAGE_KEYS = Object.freeze([
    'dup_ui_show_new_year_theme',
    'dup_ui_show_spring_theme'
  ]);
  const EXTENSION_UI_GLOBAL_CONFIG = (() => {
    const rawConfig = window.PYRAMID_EXTENSION_UI_CONFIG && typeof window.PYRAMID_EXTENSION_UI_CONFIG === 'object'
      ? window.PYRAMID_EXTENSION_UI_CONFIG
      : {};
    const rawForcedVisibility = rawConfig.forcedVisibility && typeof rawConfig.forcedVisibility === 'object'
      ? rawConfig.forcedVisibility
      : {};
    return {
      globalEnabled: rawConfig.globalEnabled !== false,
      forcedVisibility: rawForcedVisibility
    };
  })();
  const EXTENSION_UI_SETTING_DEFS = Object.freeze([
    {
      key: 'duplicateHighlights',
      storageKey: 'dup_ui_show_duplicate_highlights',
      label: 'Подсветка дублей',
      description: 'Обычные совпадения в таблицах.',
      hideClass: 'dup-ui-hide-duplicate-highlights',
      hideCss: `
        html.dup-ui-hide-duplicate-highlights .${HIGHLIGHT_CLASS} {
          background-color: transparent !important;
          outline: none !important;
        }
      `
    },
    {
      key: 'fsspDuplicateHighlights',
      storageKey: 'dup_ui_show_fssp_duplicate_highlights',
      label: 'Подсветка дублей ФССП',
      description: 'Цветовая маркировка дублей в реестре ФССП.',
      hideClass: 'dup-ui-hide-fssp-duplicate-highlights',
      hideCss: `
        html.dup-ui-hide-fssp-duplicate-highlights .${FSSP_REESTR_DUPLICATE_CLASS} {
          background-color: transparent !important;
          outline: none !important;
        }
      `
    },
    {
      key: 'fsspStatusHighlights',
      storageKey: 'dup_ui_show_fssp_status_highlights',
      label: 'Подсветка статусов ФССП',
      description: 'Подсветка колонок со статусом в реестре ФССП.',
      hideClass: 'dup-ui-hide-fssp-status-highlights',
      hideCss: `
        html.dup-ui-hide-fssp-status-highlights .${FSSP_REESTR_STATUS_CLASS} {
          background-color: transparent !important;
          outline: none !important;
        }
      `
    },
    {
      key: 'epguDuplicateHighlights',
      storageKey: 'dup_ui_show_epgu_duplicate_highlights',
      label: 'Подсветка дублей ЕПГУ',
      description: 'Совпадения в журнале запросов ЕПГУ.',
      hideClass: 'dup-ui-hide-epgu-duplicate-highlights',
      hideCss: `
        html.dup-ui-hide-epgu-duplicate-highlights .${EPGU_REQUESTS_DUPLICATE_CLASS} {
          background-color: transparent !important;
          outline: none !important;
        }
      `
    },
    {
      key: 'epguFillHighlights',
      storageKey: 'dup_ui_show_epgu_fill_highlights',
      label: 'Подсветка заполненности ЕПГУ',
      description: 'Цветовые отметки заполнения и статуса полей ЕПГУ.',
      hideClass: 'dup-ui-hide-epgu-fill-highlights',
      hideCss: `
        html.dup-ui-hide-epgu-fill-highlights .${EPGU_REQUESTS_FILL_CLASS} {
          background-color: transparent !important;
          outline: none !important;
        }
      `
    },
    {
      key: 'stageTimer',
      storageKey: 'dup_ui_show_stage_timer',
      label: 'Таймер загрузки/фильтрации',
      description: 'Плашка StageTimer над диалогами.',
      hideClass: 'dup-ui-hide-stage-timer',
      hideCss: `
        html.dup-ui-hide-stage-timer #pyramid-stage-timer {
          display: none !important;
        }
      `
    },
    {
      key: 'stageTimerToggle',
      storageKey: 'dup_ui_show_stage_timer_toggle',
      label: 'Кнопка скрытия таймера',
      description: 'Кнопка с глазом рядом с таймером.',
      hideClass: 'dup-ui-hide-stage-timer-toggle',
      hideCss: `
        html.dup-ui-hide-stage-timer-toggle #pyramid-stage-timer-toggle,
        html.dup-ui-hide-stage-timer-toggle .pyramid-stage-timer-toggle-btn,
        html.dup-ui-hide-stage-timer-toggle [title="Скрыть таймер"],
        html.dup-ui-hide-stage-timer-toggle [aria-label="Скрыть таймер"],
        html.dup-ui-hide-stage-timer-toggle [title="Показать таймер"],
        html.dup-ui-hide-stage-timer-toggle [aria-label="Показать таймер"] {
          display: none !important;
        }
      `
    },
    {
      key: 'stageTimerAbort',
      storageKey: 'dup_ui_show_stage_timer_abort',
      label: 'Кнопка прерывания загрузки',
      description: 'Кнопка × для аварийной остановки StageTimer.',
      hideClass: 'dup-ui-hide-stage-timer-abort',
      hideCss: `
        html.dup-ui-hide-stage-timer-abort #pyramid-stage-timer-abort,
        html.dup-ui-hide-stage-timer-abort .pyramid-stage-timer-abort-btn {
          display: none !important;
        }
      `
    },
    {
      key: 'stageJumpButtons',
      storageKey: 'dup_ui_show_stage_jump_buttons',
      label: 'Кнопки StageJump',
      description: 'Кнопки и меню переходов/копирования StageJump в списках.',
      hideClass: 'dup-ui-hide-stage-jump-buttons',
      hideCss: `
        html.dup-ui-hide-stage-jump-buttons .${STAGE_JUMP_BUTTON_CLASS},
        html.dup-ui-hide-stage-jump-buttons .${STAGE_JUMP_MENU_CLASS},
        html.dup-ui-hide-stage-jump-buttons [${STAGE_JUMP_BUTTON_MARK_ATTR}="1"] {
          display: none !important;
        }
      `
    },
    {
      key: 'executionAnalysisTools',
      storageKey: 'dup_ui_show_execution_analysis_tools',
      label: 'Занесение анализа исполнения',
      description: 'Блок загрузки реестра и ручного открытия формы анализа.',
      hideClass: 'dup-ui-hide-execution-analysis-tools',
      hideCss: `
        html.dup-ui-hide-execution-analysis-tools .dup-execution-analysis-block,
        html.dup-ui-hide-execution-analysis-tools .dup-execution-analysis-modal {
          display: none !important;
        }
      `
    },
    {
      key: 'idCardCheckTools',
      storageKey: 'dup_ui_show_id_card_check_tools',
      label: 'Проверка карточек ИД',
      description: 'Загрузка списка EdocID и навигация по карточкам ИД.',
      hideClass: 'dup-ui-hide-id-card-check-tools',
      hideCss: `
        html.dup-ui-hide-id-card-check-tools .dup-id-card-check-block,
        html.dup-ui-hide-id-card-check-tools .dup-id-card-check-modal,
        html.dup-ui-hide-id-card-check-tools .dup-grid-card-check-modal,
        html.dup-ui-hide-id-card-check-tools #${ID_CARD_CHECK_NAV_ID},
        html.dup-ui-hide-id-card-check-tools #${GRID_CARD_CHECK_NAV_ID} {
          display: none !important;
        }
      `
    },
    {
      key: 'departmentDropdownFilter',
      storageKey: 'dup_ui_show_department_dropdown_filter',
      label: 'Фильтр depid',
      description: 'Скрытие лишних департаментов и переключатель их показа в dropdown.',
      hideClass: 'dup-ui-hide-department-dropdown-filter',
      hideCss: `
        html.dup-ui-hide-department-dropdown-filter .${DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS} {
          display: none !important;
        }
      `
    },
    {
      key: 'fsspGroupingToggle',
      storageKey: 'dup_ui_show_fssp_grouping_toggle',
      label: 'Переключатель группировки дублей ФССП',
      description: 'Чекбокс "Сгруппировать дубликаты" в реестре ФССП.',
      hideClass: 'dup-ui-hide-fssp-grouping-toggle',
      hideCss: `
        html.dup-ui-hide-fssp-grouping-toggle #${FSSP_REESTR_GROUPING_TOGGLE_ID} {
          display: none !important;
        }
      `
    },
    {
      key: 'innBatchTools',
      storageKey: 'dup_ui_show_inn_batch_tools',
      label: 'Проверка ИНН/смерти',
      description: 'Кнопка пакетной проверки и её окна.',
      hideClass: 'dup-ui-hide-inn-batch-tools',
      hideCss: `
        html.dup-ui-hide-inn-batch-tools .my-super-btn,
        html.dup-ui-hide-inn-batch-tools #batch-inn-check-btn,
        html.dup-ui-hide-inn-batch-tools #inn-toast-container,
        html.dup-ui-hide-inn-batch-tools #inn-batch-modal-overlay {
          display: none !important;
        }
      `
    },
    {
      key: 'seasonalTheme',
      storageKey: 'dup_ui_show_seasonal_theme',
      label: 'Сезонное оформление',
      description: 'Новогодние и весенние декоративные элементы вместе.',
      hideClass: 'dup-ui-hide-seasonal-theme',
      hideCss: `
        html.dup-ui-hide-seasonal-theme .ny-header-item,
        html.dup-ui-hide-seasonal-theme #nySwicher,
        html.dup-ui-hide-seasonal-theme .material-switch-newYear,
        html.dup-ui-hide-seasonal-theme .spring-header-item,
        html.dup-ui-hide-seasonal-theme #springSwitcher,
        html.dup-ui-hide-seasonal-theme .material-switch-spring,
        html.dup-ui-hide-seasonal-theme .ny-snow-container,
        html.dup-ui-hide-seasonal-theme .ny-garland-container,
        html.dup-ui-hide-seasonal-theme .spring-petal-layer,
        html.dup-ui-hide-seasonal-theme .spring-petal,
        html.dup-ui-hide-seasonal-theme .ny-element,
        html.dup-ui-hide-seasonal-theme .snowflake,
        html.dup-ui-hide-seasonal-theme .spring-element {
          display: none !important;
        }
      `
    },
    {
      key: 'seasonalThemeSettings',
      storageKey: 'dup_ui_show_seasonal_theme_settings',
      label: 'Настройки сезонного оформления',
      description: 'Кнопка открытия и окно сезонных настроек.',
      hideClass: 'dup-ui-hide-seasonal-theme-settings',
      hideCss: `
        html.dup-ui-hide-seasonal-theme-settings #pyramid-seasonal-theme-settings-launcher,
        html.dup-ui-hide-seasonal-theme-settings .seasonal-theme-settings-header-item,
        html.dup-ui-hide-seasonal-theme-settings .seasonal-theme-settings-launcher,
        html.dup-ui-hide-seasonal-theme-settings #pyramid-seasonal-theme-settings-overlay,
        html.dup-ui-hide-seasonal-theme-settings .seasonal-theme-settings-overlay,
        html.dup-ui-hide-seasonal-theme-settings .seasonal-theme-settings-panel,
        html.dup-ui-hide-seasonal-theme-settings .seasonal-theme-settings-element {
          display: none !important;
        }
      `
    },
    {
      key: 'columnManager',
      storageKey: 'dup_ui_show_column_manager',
      label: 'Настройка столбцов',
      description: 'Кнопка настройки столбцов и её модальное окно.',
      hideClass: 'dup-ui-hide-column-manager',
      hideCss: `
        html.dup-ui-hide-column-manager #jqgrid-manager-btn,
        html.dup-ui-hide-column-manager .jq-ext-modal-overlay {
          display: none !important;
        }
      `
    }
  ]);
  const EXTENSION_UI_SETTINGS_STORAGE_KEYS = Object.freeze(
    EXTENSION_UI_SETTING_DEFS.map((definition) => definition.storageKey)
  );
  const EXTENSION_UI_SETTING_DEF_BY_KEY = Object.freeze(
    EXTENSION_UI_SETTING_DEFS.reduce((map, definition) => {
      map[definition.key] = definition;
      return map;
    }, Object.create(null))
  );
  const EXTENSION_UI_SETTING_DEF_BY_STORAGE_KEY = Object.freeze(
    EXTENSION_UI_SETTING_DEFS.reduce((map, definition) => {
      map[definition.storageKey] = definition;
      return map;
    }, Object.create(null))
  );
  const EXTENSION_UI_SETTINGS_DEFAULTS = Object.freeze(
    EXTENSION_UI_SETTING_DEFS.reduce((map, definition) => {
      const forcedVisibility = EXTENSION_UI_GLOBAL_CONFIG.forcedVisibility[definition.key];
      map[definition.key] = typeof forcedVisibility === 'boolean'
        ? forcedVisibility
        : EXTENSION_UI_GLOBAL_CONFIG.globalEnabled !== false;
      return map;
    }, Object.create(null))
  );
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
  let screenshotAutoHideIsActive = false;
  let screenshotManualModeIsActive = false;
  let screenshotModeIsActive = false;
  let screenshotAutoHideDurationMs = SCREENSHOT_HIDE_DURATION_MS;
  const screenshotThemeStateByDocument = new WeakMap();
  let lastScreenshotTriggerAtMs = 0;
  let extensionUiVisibilitySettings = { ...EXTENSION_UI_SETTINGS_DEFAULTS };
  let extensionUiSettingsOverlayEl = null;
  let extensionUiSettingsPanelEl = null;
  let stageJumpCachedMenuIndex = null;
  let stageJumpActionMenuEl = null;
  let stageJumpActionMenuAnchor = null;
  let fsspReestrGroupingCurrentHost = null;
  let stageJumpLastStageLoadStartAtMs = 0;
  let stageJumpLastStageLoadType = '';
  let stageJumpLastStageLoadRequestUrl = '';
  let stageJumpLastEditDocStartAtMs = 0;
  let stageJumpLastEditDocStopAtMs = 0;
  let stageJumpLastStageTimerErrorAtMs = 0;
  let departmentDropdownShowHidden = false;
  let departmentDropdownInteractionLockUntilMs = 0;
  const executionAnalysisPageId = createExecutionAnalysisPageId();
  let executionAnalysisState = createEmptyExecutionAnalysisState();
  let executionAnalysisParams = normalizeExecutionAnalysisParams(null);
  let executionAnalysisElements = null;
  let executionAnalysisLaunchTimer = null;
  let executionAnalysisDownloadDoneForRunId = '';
  let executionAnalysisProcessingTimer = null;
  let idCardCheckState = createEmptyIdCardCheckState();
  let idCardCheckElements = null;
  let idCardCheckNavEl = null;
  let idCardCheckNavObserver = null;
  let gridCardCheckState = createEmptyGridCardCheckState();
  let gridCardCheckNavEl = null;
  let gridCardCheckNavObserver = null;
  const allDuplicateSettingKeys = [
    'setting_highlight_mode', 'list_DebtID', 'list_AccAddress_AccountNumber',
    'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber',
    'strict_CaseNumber', 'strict_EDNumber'
  ];
  const successFeedbackState = new WeakMap();
  const successFeedbackStyleProps = Object.freeze([
    'transition',
    'background-color',
    'background-image',
    'box-shadow',
    'color'
  ]);

  // --- Утилиты ---
  
  // "Умное" получение значения из элемента.
  function getSmartValue(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el.value.trim();
    const childInput = el.querySelector('input, textarea, select');
    if (childInput) return childInput.value.trim();
    return el.textContent.trim();
  }

  function normalizeGridBulkCopyValue(rawValue) {
    return String(rawValue || '')
      .replace(/\r?\n+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function getGridBulkCopyTargetCell(target) {
    const baseTarget = target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
    if (!(baseTarget instanceof Element)) return null;
    const cell = baseTarget.closest('td[role="gridcell"], td[aria-describedby]');
    return cell instanceof HTMLTableCellElement ? cell : null;
  }

  function getGridTableFromCell(cell) {
    if (!(cell instanceof HTMLTableCellElement)) return null;

    const directTable = cell.closest('table.ui-jqgrid-btable');
    if (directTable instanceof HTMLTableElement) return directTable;

    const jqGridRoot = cell.closest('.ui-jqgrid');
    if (jqGridRoot) {
      const rootTable = jqGridRoot.querySelector('table.ui-jqgrid-btable');
      if (rootTable instanceof HTMLTableElement) return rootTable;
    }

    const fallbackTable = cell.closest('table');
    return fallbackTable instanceof HTMLTableElement ? fallbackTable : null;
  }

  function findGridRowCellByAriaId(row, ariaId) {
    if (!(row instanceof HTMLTableRowElement)) return null;
    const normalizedAriaId = String(ariaId || '').trim();
    if (!normalizedAriaId) return null;

    const cells = row.querySelectorAll('td[aria-describedby]');
    for (const cell of cells) {
      if (!(cell instanceof HTMLTableCellElement)) continue;
      if (String(cell.getAttribute('aria-describedby') || '').trim() === normalizedAriaId) {
        return cell;
      }
    }

    return null;
  }

  function getGridDataRows(gridTable) {
    if (!(gridTable instanceof HTMLTableElement)) return [];

    return Array.from(gridTable.querySelectorAll('tbody > tr')).filter((row) => {
      if (!(row instanceof HTMLTableRowElement)) return false;
      if (row.classList.contains('jqgfirstrow')) return false;
      if (!row.querySelector('td[aria-describedby]')) return false;
      return isStageJumpElementVisible(row);
    });
  }

  function isEditableInteractionTarget(target) {
    const element = target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
    if (!(element instanceof Element)) return false;

    if (element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]')) {
      return true;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    if (activeElement.isContentEditable) return true;
    return activeElement.matches('input, textarea, select, [role="textbox"]');
  }

  function collectGridColumnValues(targetCell) {
    if (!(targetCell instanceof HTMLTableCellElement)) return [];

    const ariaId = String(targetCell.getAttribute('aria-describedby') || '').trim();
    if (!ariaId) return [];

    const gridTable = getGridTableFromCell(targetCell);
    if (!(gridTable instanceof HTMLTableElement)) return [];

    const values = [];
    getGridDataRows(gridTable).forEach((row) => {
      const cell = findGridRowCellByAriaId(row, ariaId);
      if (!cell) return;
      values.push(normalizeGridBulkCopyValue(getSmartValue(cell)));
    });

    return values;
  }

  function collectGridColumnCopyEntries(targetCell) {
    if (!(targetCell instanceof HTMLTableCellElement)) return [];

    const ariaId = String(targetCell.getAttribute('aria-describedby') || '').trim();
    if (!ariaId) return [];

    const gridTable = getGridTableFromCell(targetCell);
    if (!(gridTable instanceof HTMLTableElement)) return [];

    const entries = [];
    getGridDataRows(gridTable).forEach((row) => {
      const cell = findGridRowCellByAriaId(row, ariaId);
      if (!cell) return;
      entries.push({
        row,
        cell,
        value: normalizeGridBulkCopyValue(getSmartValue(cell))
      });
    });

    return entries;
  }

  function getGridBulkCopyFeedbackElements(entries) {
    const uniqueElements = [];
    const seen = new Set();

    entries.forEach((entry) => {
      if (!entry || !(entry.cell instanceof HTMLElement) || seen.has(entry.cell)) return;
      seen.add(entry.cell);
      uniqueElements.push(entry.cell);
    });

    return uniqueElements;
  }

  function captureInlineStyleSnapshot(element) {
    const snapshot = {};
    const style = element && element.style;
    if (!style) return snapshot;

    successFeedbackStyleProps.forEach((propertyName) => {
      snapshot[propertyName] = {
        value: style.getPropertyValue(propertyName),
        priority: style.getPropertyPriority(propertyName)
      };
    });

    return snapshot;
  }

  function restoreInlineStyleSnapshot(element, snapshot) {
    const style = element && element.style;
    if (!style) return;

    successFeedbackStyleProps.forEach((propertyName) => {
      const entry = snapshot && snapshot[propertyName];
      if (entry && entry.value) {
        style.setProperty(propertyName, entry.value, entry.priority || '');
      } else {
        style.removeProperty(propertyName);
      }
    });
  }
  
  // Визуальный отклик для Турбо-режима.
  function showSuccessFeedback(element) {
    if (!(element instanceof HTMLElement)) return;

    const existingState = successFeedbackState.get(element);
    if (existingState && existingState.timerId) {
      clearTimeout(existingState.timerId);
    }

    const snapshot = existingState && existingState.snapshot
      ? existingState.snapshot
      : captureInlineStyleSnapshot(element);

    element.style.setProperty('transition', 'background-color 0.1s ease, box-shadow 0.1s ease', 'important');
    element.style.setProperty('background-image', 'none', 'important');
    element.style.setProperty('background-color', '#66bb6a', 'important');
    element.style.setProperty('box-shadow', 'inset 0 0 0 999px rgba(102, 187, 106, 0.92)', 'important');

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      element.style.setProperty('color', '#ffffff', 'important');
    }

    const timerId = window.setTimeout(() => {
      restoreInlineStyleSnapshot(element, snapshot);
      successFeedbackState.delete(element);
    }, 220);

    successFeedbackState.set(element, {
      snapshot,
      timerId
    });
  }

  function showSuccessFeedbackBatch(elements) {
    if (!Array.isArray(elements) || !elements.length) return;
    elements.forEach((element) => {
      showSuccessFeedback(element);
    });
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

  function isPyramidExtensionPage() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    return (
      hostname === 'pyramid.vostok-electra.ru' ||
      hostname === 'pyramid-vostok.electra.ru' ||
      hostname.endsWith('.pyramid.vostok-electra.ru') ||
      hostname.endsWith('.pyramid-vostok.electra.ru')
    );
  }

  function normalizeExtensionUiVisibilitySettings(rawSettings) {
    const normalized = { ...EXTENSION_UI_SETTINGS_DEFAULTS };
    if (!rawSettings || typeof rawSettings !== 'object') return normalized;

    EXTENSION_UI_SETTING_DEFS.forEach((definition) => {
      if (typeof rawSettings[definition.storageKey] === 'boolean') {
        normalized[definition.key] = rawSettings[definition.storageKey];
      }
    });

    if (typeof rawSettings.dup_ui_show_seasonal_theme !== 'boolean') {
      const legacySeasonalValues = LEGACY_SEASONAL_THEME_STORAGE_KEYS
        .map((storageKey) => rawSettings[storageKey])
        .filter((value) => typeof value === 'boolean');
      if (legacySeasonalValues.length > 0) {
        normalized.seasonalTheme = legacySeasonalValues.every((value) => value !== false);
      }
    }

    return normalized;
  }

  function getExtensionUiForcedVisibility(key) {
    const forcedVisibility = EXTENSION_UI_GLOBAL_CONFIG.forcedVisibility[key];
    return typeof forcedVisibility === 'boolean'
      ? forcedVisibility
      : null;
  }

  function isExtensionUiSettingLocked(key) {
    return EXTENSION_UI_GLOBAL_CONFIG.globalEnabled === false || getExtensionUiForcedVisibility(key) !== null;
  }

  function isExtensionUiSettingEnabled(key) {
    if (EXTENSION_UI_GLOBAL_CONFIG.globalEnabled === false) return false;
    const forcedVisibility = getExtensionUiForcedVisibility(key);
    if (forcedVisibility !== null) return forcedVisibility;
    return extensionUiVisibilitySettings[key] !== false;
  }

  function ensureExtensionUiSettingsStyle(targetDocument) {
    const doc = targetDocument && typeof targetDocument.getElementById === 'function'
      ? targetDocument
      : document;
    if (doc.getElementById(EXTENSION_UI_SETTINGS_STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = EXTENSION_UI_SETTINGS_STYLE_ID;
    style.textContent = EXTENSION_UI_SETTING_DEFS.map((definition) => definition.hideCss).join('\n');
    (doc.head || doc.documentElement).appendChild(style);
  }

  function syncExtensionUiVisibilityForDocument(targetDocument) {
    const doc = targetDocument && targetDocument.documentElement
      ? targetDocument
      : document;
    const root = doc.documentElement;
    if (!root) return;

    ensureExtensionUiSettingsStyle(doc);
    EXTENSION_UI_SETTING_DEFS.forEach((definition) => {
      root.classList.toggle(definition.hideClass, !isExtensionUiSettingEnabled(definition.key));
    });
  }

  function createExecutionAnalysisPageId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeExecutionAnalysisParams(rawParams) {
    const raw = rawParams && typeof rawParams === 'object' ? rawParams : {};
    const parsedBatchSize = Number.parseInt(String(raw.batchSize || ''), 10);
    const batchSize = Number.isFinite(parsedBatchSize) && parsedBatchSize > 0
      ? Math.min(500, parsedBatchSize)
      : EXECUTION_ANALYSIS_BATCH_SIZE_DEFAULT;
    const intervalMsRaw = Number(raw.intervalMs);
    const allowedIntervals = new Set(EXECUTION_ANALYSIS_INTERVAL_OPTIONS.map((item) => item.value));
    const intervalMs = allowedIntervals.has(intervalMsRaw)
      ? intervalMsRaw
      : EXECUTION_ANALYSIS_INTERVAL_DEFAULT_MS;
    return { batchSize, intervalMs };
  }

  function createEmptyExecutionAnalysisState() {
    return {
      version: 1,
      status: EXECUTION_ANALYSIS_STATUS_IDLE,
      sourcePageId: '',
      sourceOrigin: '',
      runId: '',
      fileName: '',
      fileType: '',
      headers: [],
      rows: [],
      processedColumnName: 'Обработано',
      params: normalizeExecutionAnalysisParams(null),
      currentBatch: null,
      nextLaunchAt: 0,
      lastError: '',
      updatedAt: Date.now()
    };
  }

  function normalizeExecutionAnalysisStatus(status) {
    const normalized = String(status || '').trim();
    const allowed = new Set([
      EXECUTION_ANALYSIS_STATUS_IDLE,
      EXECUTION_ANALYSIS_STATUS_READY,
      EXECUTION_ANALYSIS_STATUS_RUNNING,
      EXECUTION_ANALYSIS_STATUS_PAUSED,
      EXECUTION_ANALYSIS_STATUS_COMPLETED,
      EXECUTION_ANALYSIS_STATUS_STOPPED
    ]);
    return allowed.has(normalized) ? normalized : EXECUTION_ANALYSIS_STATUS_IDLE;
  }

  function normalizeExecutionAnalysisText(value) {
    return String(value === undefined || value === null ? '' : value).trim();
  }

  function normalizeExecutionAnalysisProcessed(value) {
    return normalizeExecutionAnalysisText(value).toLowerCase() === EXECUTION_ANALYSIS_PROCESSED_TEXT.toLowerCase()
      ? EXECUTION_ANALYSIS_PROCESSED_TEXT
      : '';
  }

  function normalizeExecutionAnalysisRow(row, index) {
    const raw = row && typeof row === 'object' ? row : {};
    const values = Array.isArray(raw.values)
      ? raw.values.map((value) => String(value === undefined || value === null ? '' : value))
      : [];
    const id = normalizeExecutionAnalysisText(raw.id) || `row_${index + 1}`;
    return {
      id,
      values,
      edocId: normalizeExecutionAnalysisText(raw.edocId),
      analysisText: normalizeExecutionAnalysisText(raw.analysisText),
      processed: normalizeExecutionAnalysisProcessed(raw.processed)
    };
  }

  function normalizeExecutionAnalysisState(rawState) {
    const base = createEmptyExecutionAnalysisState();
    const raw = rawState && typeof rawState === 'object' ? rawState : {};
    const headers = Array.isArray(raw.headers)
      ? raw.headers.map((header) => String(header === undefined || header === null ? '' : header))
      : [];
    const rows = Array.isArray(raw.rows)
      ? raw.rows.map((row, index) => normalizeExecutionAnalysisRow(row, index))
      : [];
    const currentBatch = raw.currentBatch && typeof raw.currentBatch === 'object'
      ? {
          runId: normalizeExecutionAnalysisText(raw.currentBatch.runId),
          rowIds: Array.isArray(raw.currentBatch.rowIds)
            ? raw.currentBatch.rowIds.map((id) => normalizeExecutionAnalysisText(id)).filter(Boolean)
            : [],
          edocIds: Array.isArray(raw.currentBatch.edocIds)
            ? raw.currentBatch.edocIds.map((id) => normalizeExecutionAnalysisText(id)).filter(Boolean)
            : [],
          analysisText: normalizeExecutionAnalysisText(raw.currentBatch.analysisText),
          tabId: Number.isInteger(raw.currentBatch.tabId) ? raw.currentBatch.tabId : 0,
          startedAt: Number(raw.currentBatch.startedAt || 0)
        }
      : null;

    return {
      ...base,
      ...raw,
      status: normalizeExecutionAnalysisStatus(raw.status),
      sourcePageId: normalizeExecutionAnalysisText(raw.sourcePageId),
      sourceOrigin: normalizeExecutionAnalysisText(raw.sourceOrigin),
      runId: normalizeExecutionAnalysisText(raw.runId),
      fileName: normalizeExecutionAnalysisText(raw.fileName),
      fileType: normalizeExecutionAnalysisText(raw.fileType),
      headers,
      rows,
      processedColumnName: normalizeExecutionAnalysisText(raw.processedColumnName) || 'Обработано',
      params: normalizeExecutionAnalysisParams(raw.params),
      currentBatch,
      nextLaunchAt: Number(raw.nextLaunchAt || 0),
      lastError: normalizeExecutionAnalysisText(raw.lastError),
      updatedAt: Number(raw.updatedAt || 0) || Date.now()
    };
  }

  function chromeStorageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      } catch (error) {
        resolve({});
      }
    });
  }

  function chromeStorageSet(values) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(values, () => resolve(true));
      } catch (error) {
        resolve(false);
      }
    });
  }

  function chromeStorageRemove(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(keys, () => resolve(true));
      } catch (error) {
        resolve(false);
      }
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (!(chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function')) {
        resolve({ success: false, error: 'NO_RUNTIME' });
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : '';
          if (runtimeError) {
            resolve({ success: false, error: runtimeError });
            return;
          }
          resolve(response || { success: false, error: 'NO_RESPONSE' });
        });
      } catch (error) {
        resolve({ success: false, error: error && error.message ? error.message : 'SEND_FAILED' });
      }
    });
  }

  async function getCurrentTabIdForExecutionAnalysis() {
    const response = await sendRuntimeMessage({ action: 'EXECUTION_ANALYSIS_GET_TAB_ID' });
    return response && response.success === true && Number.isInteger(response.tabId)
      ? response.tabId
      : 0;
  }

  async function persistExecutionAnalysisState(nextState) {
    const normalized = normalizeExecutionAnalysisState({
      ...nextState,
      updatedAt: Date.now()
    });
    executionAnalysisState = normalized;
    syncExecutionAnalysisControls();
    await chromeStorageSet({ [EXECUTION_ANALYSIS_STATE_STORAGE_KEY]: normalized });
    return normalized;
  }

  async function persistExecutionAnalysisParams(nextParams) {
    const normalized = normalizeExecutionAnalysisParams(nextParams);
    executionAnalysisParams = normalized;
    const nextState = normalizeExecutionAnalysisState({
      ...executionAnalysisState,
      params: normalized
    });
    executionAnalysisState = nextState;
    syncExecutionAnalysisControls();
    await chromeStorageSet({
      [EXECUTION_ANALYSIS_PARAMS_STORAGE_KEY]: normalized,
      [EXECUTION_ANALYSIS_STATE_STORAGE_KEY]: nextState
    });
    return normalized;
  }

  async function loadExecutionAnalysisStateAndParams() {
    if (!isPyramidExtensionPage()) return;
    const result = await chromeStorageGet([
      EXECUTION_ANALYSIS_STATE_STORAGE_KEY,
      EXECUTION_ANALYSIS_PARAMS_STORAGE_KEY
    ]);
    executionAnalysisParams = normalizeExecutionAnalysisParams(result[EXECUTION_ANALYSIS_PARAMS_STORAGE_KEY]);
    executionAnalysisState = normalizeExecutionAnalysisState({
      ...(result[EXECUTION_ANALYSIS_STATE_STORAGE_KEY] || {}),
      params: executionAnalysisParams
    });
    syncExecutionAnalysisControls();
    maybeScheduleExecutionAnalysisNextBatch('storage-init');
  }

  function splitExecutionAnalysisEdocIds(value) {
    return String(value || '')
      .split(/[\s,;]+/g)
      .map((item) => normalizeExecutionAnalysisText(item))
      .filter(Boolean);
  }

  function buildExecutionAnalysisUrl(edocIds, origin = window.location.origin) {
    const ids = Array.isArray(edocIds)
      ? edocIds.map((id) => normalizeExecutionAnalysisText(id)).filter(Boolean)
      : splitExecutionAnalysisEdocIds(edocIds);
    const url = new URL(EXECUTION_ANALYSIS_PATH, origin || window.location.origin);
    url.searchParams.set('edocid', ids.join(','));
    return url.toString();
  }

  function getExecutionAnalysisProcessedCount(state = executionAnalysisState) {
    return normalizeExecutionAnalysisState(state).rows
      .filter((row) => normalizeExecutionAnalysisProcessed(row.processed) === EXECUTION_ANALYSIS_PROCESSED_TEXT)
      .length;
  }

  function getExecutionAnalysisPendingRows(state = executionAnalysisState) {
    return normalizeExecutionAnalysisState(state).rows.filter((row) => (
      normalizeExecutionAnalysisProcessed(row.processed) !== EXECUTION_ANALYSIS_PROCESSED_TEXT &&
      normalizeExecutionAnalysisText(row.edocId) &&
      normalizeExecutionAnalysisText(row.analysisText)
    ));
  }

  function buildNextExecutionAnalysisBatch(state = executionAnalysisState) {
    const normalized = normalizeExecutionAnalysisState(state);
    const pendingRows = getExecutionAnalysisPendingRows(normalized);
    if (!pendingRows.length) return null;

    const batchSize = normalizeExecutionAnalysisParams(normalized.params).batchSize;
    const targetText = pendingRows[0].analysisText;
    const selectedRows = [];
    const edocIdSet = new Set();
    pendingRows.forEach((row) => {
      if (row.analysisText !== targetText) return;
      const edocId = normalizeExecutionAnalysisText(row.edocId);
      if (!edocId) return;
      if (!edocIdSet.has(edocId) && edocIdSet.size >= batchSize) return;
      selectedRows.push(row);
      edocIdSet.add(edocId);
    });

    if (!selectedRows.length || !edocIdSet.size) return null;
    return {
      runId: normalized.runId,
      rowIds: selectedRows.map((row) => row.id),
      edocIds: Array.from(edocIdSet),
      analysisText: targetText,
      tabId: 0,
      startedAt: Date.now()
    };
  }

  function setExecutionAnalysisStatusText(text, isError = false) {
    if (!executionAnalysisElements || !(executionAnalysisElements.statusText instanceof HTMLElement)) return;
    executionAnalysisElements.statusText.textContent = String(text || '');
    executionAnalysisElements.statusText.classList.toggle('is-error', !!isError);
  }

  function getExecutionAnalysisStatusLabel(status) {
    switch (normalizeExecutionAnalysisStatus(status)) {
      case EXECUTION_ANALYSIS_STATUS_READY: return 'Файл готов';
      case EXECUTION_ANALYSIS_STATUS_RUNNING: return 'В работе';
      case EXECUTION_ANALYSIS_STATUS_PAUSED: return 'Пауза';
      case EXECUTION_ANALYSIS_STATUS_COMPLETED: return 'Завершено';
      case EXECUTION_ANALYSIS_STATUS_STOPPED: return 'Остановлено';
      default: return 'Файл не выбран';
    }
  }

  function syncExecutionAnalysisControls() {
    if (!executionAnalysisElements) return;
    const state = normalizeExecutionAnalysisState(executionAnalysisState);
    const params = normalizeExecutionAnalysisParams(executionAnalysisParams);
    const hasRows = state.rows.length > 0;
    const pendingRows = getExecutionAnalysisPendingRows(state);
    const processedCount = getExecutionAnalysisProcessedCount(state);
    const currentBatch = state.currentBatch;
    const isRunning = state.status === EXECUTION_ANALYSIS_STATUS_RUNNING;

    if (executionAnalysisElements.fileName instanceof HTMLElement) {
      executionAnalysisElements.fileName.textContent = hasRows
        ? `${state.fileName || 'Файл'}: строк ${state.rows.length}`
        : 'Файл не выбран';
    }
    if (executionAnalysisElements.paramsPanel instanceof HTMLElement) {
      executionAnalysisElements.paramsPanel.hidden = !hasRows;
    }
    if (executionAnalysisElements.batchInput instanceof HTMLInputElement && document.activeElement !== executionAnalysisElements.batchInput) {
      executionAnalysisElements.batchInput.value = String(params.batchSize);
    }
    if (executionAnalysisElements.intervalSelect instanceof HTMLSelectElement) {
      executionAnalysisElements.intervalSelect.value = String(params.intervalMs);
    }
    if (executionAnalysisElements.startButton instanceof HTMLButtonElement) {
      executionAnalysisElements.startButton.textContent = isRunning ? 'Пауза' : 'Старт';
      executionAnalysisElements.startButton.disabled = !hasRows || (!isRunning && pendingRows.length < 1);
    }
    if (executionAnalysisElements.finishButton instanceof HTMLButtonElement) {
      executionAnalysisElements.finishButton.disabled = !hasRows;
    }
    if (executionAnalysisElements.statusBar instanceof HTMLElement) {
      executionAnalysisElements.statusBar.hidden = !hasRows;
    }
    if (executionAnalysisElements.counter instanceof HTMLElement) {
      executionAnalysisElements.counter.textContent = `Обработано: ${processedCount}/${state.rows.length}. Осталось: ${pendingRows.length}.`;
    }
    if (executionAnalysisElements.batchInfo instanceof HTMLElement) {
      executionAnalysisElements.batchInfo.textContent = currentBatch && currentBatch.edocIds && currentBatch.edocIds.length
        ? `Текущий пакет: ${currentBatch.edocIds.join(', ')}`
        : 'Текущий пакет: нет';
    }

    const errorText = state.lastError ? ` Ошибка: ${state.lastError}` : '';
    setExecutionAnalysisStatusText(`${getExecutionAnalysisStatusLabel(state.status)}.${errorText}`, !!state.lastError);
  }

  function readExecutionAnalysisParamsFromControls() {
    const batchInput = executionAnalysisElements && executionAnalysisElements.batchInput;
    const intervalSelect = executionAnalysisElements && executionAnalysisElements.intervalSelect;
    return normalizeExecutionAnalysisParams({
      batchSize: batchInput instanceof HTMLInputElement ? batchInput.value : executionAnalysisParams.batchSize,
      intervalMs: intervalSelect instanceof HTMLSelectElement ? Number(intervalSelect.value) : executionAnalysisParams.intervalMs
    });
  }

  function normalizeExecutionAnalysisHeaderKey(value) {
    return normalizeExecutionAnalysisText(value).toLowerCase().replace(/\s+/g, '');
  }

  function findExecutionAnalysisColumnIndex(headers, names) {
    const wanted = new Set(names.map((name) => normalizeExecutionAnalysisHeaderKey(name)));
    return headers.findIndex((header) => wanted.has(normalizeExecutionAnalysisHeaderKey(header)));
  }

  function buildExecutionAnalysisRowsFromTable(tableRows, fileName, fileType) {
    const nonEmptyRows = tableRows
      .map((row) => Array.isArray(row) ? row.map((value) => String(value === undefined || value === null ? '' : value)) : [])
      .filter((row) => row.some((value) => normalizeExecutionAnalysisText(value)));
    if (!nonEmptyRows.length) throw new Error('Файл не содержит строк.');

    const headers = nonEmptyRows[0].map((header, index) => normalizeExecutionAnalysisText(header) || `Колонка ${index + 1}`);
    const edocIndex = findExecutionAnalysisColumnIndex(headers, ['EdocID', 'EDocID', 'EdocId']);
    const analysisIndex = findExecutionAnalysisColumnIndex(headers, ['Анализ исполнения']);
    let processedIndex = findExecutionAnalysisColumnIndex(headers, ['Обработано']);
    if (edocIndex < 0 || analysisIndex < 0) {
      throw new Error('В файле должны быть столбцы EdocID и Анализ исполнения.');
    }
    if (processedIndex < 0) {
      processedIndex = headers.length;
      headers.push('Обработано');
    }

    const rows = nonEmptyRows.slice(1).map((sourceRow, index) => {
      const values = headers.map((_, valueIndex) => String(sourceRow[valueIndex] === undefined || sourceRow[valueIndex] === null ? '' : sourceRow[valueIndex]));
      const processed = normalizeExecutionAnalysisProcessed(values[processedIndex]);
      values[processedIndex] = processed;
      return {
        id: `row_${Date.now()}_${index + 1}`,
        values,
        edocId: normalizeExecutionAnalysisText(values[edocIndex]),
        analysisText: normalizeExecutionAnalysisText(values[analysisIndex]),
        processed
      };
    }).filter((row) => row.values.some((value) => normalizeExecutionAnalysisText(value)));

    if (!rows.length) throw new Error('В файле нет строк для обработки.');
    return normalizeExecutionAnalysisState({
      ...createEmptyExecutionAnalysisState(),
      status: EXECUTION_ANALYSIS_STATUS_READY,
      sourcePageId: executionAnalysisPageId,
      sourceOrigin: window.location.origin,
      runId: createExecutionAnalysisPageId(),
      fileName,
      fileType,
      headers,
      rows,
      params: executionAnalysisParams,
      updatedAt: Date.now()
    });
  }

  function parseExecutionAnalysisDelimitedText(text, delimiter) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      const nextChar = source[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && char === delimiter) {
        row.push(value);
        value = '';
        continue;
      }
      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && nextChar === '\n') i += 1;
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        continue;
      }
      value += char;
    }
    row.push(value);
    rows.push(row);
    return rows;
  }

  function readZipUInt16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readZipUInt32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function decodeZipText(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  async function inflateZipEntry(bytes) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Браузер не поддерживает распаковку XLSX.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readExecutionAnalysisZipEntries(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let eocdOffset = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
      if (readZipUInt32(bytes, offset) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }
    if (eocdOffset < 0) throw new Error('Не удалось прочитать XLSX: не найден ZIP-каталог.');

    const entryCount = readZipUInt16(bytes, eocdOffset + 10);
    const centralOffset = readZipUInt32(bytes, eocdOffset + 16);
    const entries = {};
    let offset = centralOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (readZipUInt32(bytes, offset) !== 0x02014b50) break;
      const method = readZipUInt16(bytes, offset + 10);
      const compressedSize = readZipUInt32(bytes, offset + 20);
      const uncompressedSize = readZipUInt32(bytes, offset + 24);
      const fileNameLength = readZipUInt16(bytes, offset + 28);
      const extraLength = readZipUInt16(bytes, offset + 30);
      const commentLength = readZipUInt16(bytes, offset + 32);
      const localOffset = readZipUInt32(bytes, offset + 42);
      const nameStart = offset + 46;
      const name = decodeZipText(bytes.slice(nameStart, nameStart + fileNameLength));
      entries[name] = { method, compressedSize, uncompressedSize, localOffset };
      offset = nameStart + fileNameLength + extraLength + commentLength;
    }

    const extracted = {};
    for (const [name, entry] of Object.entries(entries)) {
      if (readZipUInt32(bytes, entry.localOffset) !== 0x04034b50) continue;
      const localNameLength = readZipUInt16(bytes, entry.localOffset + 26);
      const localExtraLength = readZipUInt16(bytes, entry.localOffset + 28);
      const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
      if (entry.method === 0) {
        extracted[name] = compressed;
      } else if (entry.method === 8) {
        extracted[name] = await inflateZipEntry(compressed);
      }
    }
    return extracted;
  }

  function parseExecutionAnalysisXml(text) {
    return new DOMParser().parseFromString(String(text || ''), 'application/xml');
  }

  function getExecutionAnalysisXmlText(node) {
    return Array.from(node.querySelectorAll('t')).map((item) => item.textContent || '').join('');
  }

  function columnNameToIndex(columnName) {
    let index = 0;
    const letters = String(columnName || '').toUpperCase();
    for (let i = 0; i < letters.length; i += 1) {
      const code = letters.charCodeAt(i);
      if (code < 65 || code > 90) continue;
      index = index * 26 + (code - 64);
    }
    return Math.max(0, index - 1);
  }

  function columnIndexToName(index) {
    let value = Number(index) + 1;
    let name = '';
    while (value > 0) {
      const modulo = (value - 1) % 26;
      name = String.fromCharCode(65 + modulo) + name;
      value = Math.floor((value - modulo) / 26);
    }
    return name || 'A';
  }

  function getXlsxCellValue(cell, sharedStrings) {
    const type = cell.getAttribute('t') || '';
    if (type === 'inlineStr') return getExecutionAnalysisXmlText(cell);
    const valueNode = cell.querySelector('v');
    const rawValue = valueNode ? String(valueNode.textContent || '') : '';
    if (type === 's') {
      const stringIndex = Number.parseInt(rawValue, 10);
      return Number.isFinite(stringIndex) ? String(sharedStrings[stringIndex] || '') : '';
    }
    if (type === 'b') return rawValue === '1' ? 'TRUE' : 'FALSE';
    return rawValue;
  }

  async function parseExecutionAnalysisXlsx(arrayBuffer) {
    const entries = await readExecutionAnalysisZipEntries(arrayBuffer);
    const readText = (name) => entries[name] ? decodeZipText(entries[name]) : '';
    const workbookXml = readText('xl/workbook.xml');
    if (!workbookXml) throw new Error('Не удалось найти книгу в XLSX.');

    const sharedStringsXml = readText('xl/sharedStrings.xml');
    const sharedStrings = sharedStringsXml
      ? Array.from(parseExecutionAnalysisXml(sharedStringsXml).querySelectorAll('si')).map((si) => getExecutionAnalysisXmlText(si))
      : [];
    const workbookDoc = parseExecutionAnalysisXml(workbookXml);
    const firstSheet = workbookDoc.querySelector('sheet');
    const relId = firstSheet ? (firstSheet.getAttribute('r:id') || firstSheet.getAttribute('id') || '') : '';
    const relsDoc = parseExecutionAnalysisXml(readText('xl/_rels/workbook.xml.rels'));
    const rel = Array.from(relsDoc.querySelectorAll('Relationship')).find((item) => item.getAttribute('Id') === relId);
    const relTarget = rel ? String(rel.getAttribute('Target') || '') : 'worksheets/sheet1.xml';
    const sheetPath = relTarget.startsWith('/') ? relTarget.replace(/^\//, '') : `xl/${relTarget}`;
    const sheetXml = readText(sheetPath) || readText('xl/worksheets/sheet1.xml');
    if (!sheetXml) throw new Error('Не удалось найти первый лист XLSX.');

    const sheetDoc = parseExecutionAnalysisXml(sheetXml);
    return Array.from(sheetDoc.querySelectorAll('sheetData row')).map((rowNode) => {
      const row = [];
      Array.from(rowNode.querySelectorAll('c')).forEach((cell) => {
        const ref = String(cell.getAttribute('r') || '');
        const columnName = ref.replace(/[0-9]/g, '');
        const columnIndex = columnName ? columnNameToIndex(columnName) : row.length;
        row[columnIndex] = getXlsxCellValue(cell, sharedStrings);
      });
      return row.map((value) => String(value === undefined || value === null ? '' : value));
    });
  }

  async function parseExecutionAnalysisFile(file) {
    if (!(file instanceof File)) throw new Error('Файл не выбран.');
    const fileName = file.name || 'registry';
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.xlsx')) {
      const rows = await parseExecutionAnalysisXlsx(await file.arrayBuffer());
      return buildExecutionAnalysisRowsFromTable(rows, fileName, 'xlsx');
    }
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt') || lowerName.endsWith('.tsv')) {
      const arrayBuffer = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(arrayBuffer);
      if (text.includes('\uFFFD')) {
        try {
          text = new TextDecoder('windows-1251').decode(arrayBuffer);
        } catch (error) {
          // keep UTF-8 text
        }
      }
      const delimiter = lowerName.endsWith('.tsv') ? '\t' : (text.includes(';') ? ';' : ',');
      return buildExecutionAnalysisRowsFromTable(parseExecutionAnalysisDelimitedText(text, delimiter), fileName, lowerName.endsWith('.tsv') ? 'tsv' : 'csv');
    }
    throw new Error('Поддерживаются файлы .xlsx, .csv и .tsv.');
  }

  function escapeExecutionAnalysisXml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function buildExecutionAnalysisOutputRows(state = executionAnalysisState) {
    const normalized = normalizeExecutionAnalysisState(state);
    const headers = normalized.headers.length ? normalized.headers : ['EdocID', 'Анализ исполнения', 'Обработано'];
    return [
      headers,
      ...normalized.rows.map((row) => headers.map((_, index) => String(row.values[index] === undefined || row.values[index] === null ? '' : row.values[index])))
    ];
  }

  function buildExecutionAnalysisDelimitedOutput(state, delimiter) {
    return buildExecutionAnalysisOutputRows(state).map((row) => row.map((value) => {
      const text = String(value === undefined || value === null ? '' : value);
      if (text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(delimiter)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    }).join(delimiter)).join('\r\n');
  }

  function createCrc32Table() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  const executionAnalysisCrc32Table = createCrc32Table();

  function calculateCrc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = executionAnalysisCrc32Table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function pushZipUInt16(target, value) {
    target.push(value & 0xff, (value >>> 8) & 0xff);
  }

  function pushZipUInt32(target, value) {
    target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }

  function buildStoredZip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const centralRecords = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = typeof file.content === 'string'
        ? encoder.encode(file.content)
        : new Uint8Array(file.content || []);
      const crc = calculateCrc32(dataBytes);
      const local = [];
      pushZipUInt32(local, 0x04034b50);
      pushZipUInt16(local, 20);
      pushZipUInt16(local, 0x0800);
      pushZipUInt16(local, 0);
      pushZipUInt16(local, 0);
      pushZipUInt16(local, 0);
      pushZipUInt32(local, crc);
      pushZipUInt32(local, dataBytes.length);
      pushZipUInt32(local, dataBytes.length);
      pushZipUInt16(local, nameBytes.length);
      pushZipUInt16(local, 0);
      chunks.push(new Uint8Array(local), nameBytes, dataBytes);

      const central = [];
      pushZipUInt32(central, 0x02014b50);
      pushZipUInt16(central, 20);
      pushZipUInt16(central, 20);
      pushZipUInt16(central, 0x0800);
      pushZipUInt16(central, 0);
      pushZipUInt16(central, 0);
      pushZipUInt16(central, 0);
      pushZipUInt32(central, crc);
      pushZipUInt32(central, dataBytes.length);
      pushZipUInt32(central, dataBytes.length);
      pushZipUInt16(central, nameBytes.length);
      pushZipUInt16(central, 0);
      pushZipUInt16(central, 0);
      pushZipUInt16(central, 0);
      pushZipUInt16(central, 0);
      pushZipUInt32(central, 0);
      pushZipUInt32(central, offset);
      centralRecords.push({ header: new Uint8Array(central), nameBytes });
      offset += local.length + nameBytes.length + dataBytes.length;
    });

    const centralOffset = offset;
    centralRecords.forEach((record) => {
      chunks.push(record.header, record.nameBytes);
      offset += record.header.length + record.nameBytes.length;
    });
    const centralSize = offset - centralOffset;
    const eocd = [];
    pushZipUInt32(eocd, 0x06054b50);
    pushZipUInt16(eocd, 0);
    pushZipUInt16(eocd, 0);
    pushZipUInt16(eocd, files.length);
    pushZipUInt16(eocd, files.length);
    pushZipUInt32(eocd, centralSize);
    pushZipUInt32(eocd, centralOffset);
    pushZipUInt16(eocd, 0);
    chunks.push(new Uint8Array(eocd));
    return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function buildExecutionAnalysisXlsxBlob(state = executionAnalysisState) {
    const rows = buildExecutionAnalysisOutputRows(state);
    const sharedStrings = [];
    const sharedStringIndex = new Map();
    const getSharedIndex = (value) => {
      const text = String(value === undefined || value === null ? '' : value);
      if (sharedStringIndex.has(text)) return sharedStringIndex.get(text);
      const index = sharedStrings.length;
      sharedStrings.push(text);
      sharedStringIndex.set(text, index);
      return index;
    };
    const sheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((value, colIndex) => {
        const ref = `${columnIndexToName(colIndex)}${rowNumber}`;
        return `<c r="${ref}" t="s"><v>${getSharedIndex(value)}</v></c>`;
      }).join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join('');

    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings.map((value) => `<si><t>${escapeExecutionAnalysisXml(value)}</t></si>`).join('')}</sst>`;
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
    const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Лист1" sheetId="1" r:id="rId1"/></sheets></workbook>';
    const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>';
    return buildStoredZip([
      { name: '[Content_Types].xml', content: contentTypes },
      { name: '_rels/.rels', content: rootRels },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
      { name: 'xl/sharedStrings.xml', content: sharedStringsXml },
      { name: 'xl/styles.xml', content: styles }
    ]);
  }

  function buildExecutionAnalysisOutputFileName(state = executionAnalysisState) {
    const fileName = normalizeExecutionAnalysisState(state).fileName || 'execution-analysis.xlsx';
    const dotIndex = fileName.lastIndexOf('.');
    const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const extension = dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : '.xlsx';
    if (extension === '.csv' || extension === '.tsv') return `${baseName}_обработано${extension}`;
    return `${baseName}_обработано.xlsx`;
  }

  function downloadExecutionAnalysisResultFile(state = executionAnalysisState) {
    const normalized = normalizeExecutionAnalysisState(state);
    if (!normalized.rows.length) return false;
    const extension = (normalized.fileType || '').toLowerCase();
    let blob;
    if (extension === 'csv' || extension === 'tsv') {
      const delimiter = extension === 'tsv' ? '\t' : ';';
      blob = new Blob([`\uFEFF${buildExecutionAnalysisDelimitedOutput(normalized, delimiter)}`], {
        type: extension === 'tsv' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8'
      });
    } else {
      blob = buildExecutionAnalysisXlsxBlob(normalized);
    }
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = buildExecutionAnalysisOutputFileName(normalized);
    link.style.display = 'none';
    (document.body || document.documentElement).appendChild(link);
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      link.remove();
    }, 1000);
    return true;
  }

  async function openExecutionAnalysisTab(url, active) {
    return sendRuntimeMessage({
      action: 'EXECUTION_ANALYSIS_OPEN_TAB',
      data: {
        url: String(url || ''),
        active: active === true
      }
    });
  }

  async function handleExecutionAnalysisFileSelected(file) {
    try {
      setExecutionAnalysisStatusText('Читаю файл...');
      const parsedState = await parseExecutionAnalysisFile(file);
      executionAnalysisDownloadDoneForRunId = '';
      await persistExecutionAnalysisState(parsedState);
      setExecutionAnalysisStatusText('Файл загружен.');
    } catch (error) {
      const message = error && error.message ? error.message : 'Не удалось прочитать файл.';
      window.alert(message);
      setExecutionAnalysisStatusText(message, true);
    }
  }

  async function saveExecutionAnalysisParamsFromUi() {
    await persistExecutionAnalysisParams(readExecutionAnalysisParamsFromControls());
    setExecutionAnalysisStatusText('Параметры сохранены.');
  }

  async function startOrPauseExecutionAnalysis() {
    const state = normalizeExecutionAnalysisState(executionAnalysisState);
    if (state.status === EXECUTION_ANALYSIS_STATUS_RUNNING) {
      if (executionAnalysisLaunchTimer) {
        clearTimeout(executionAnalysisLaunchTimer);
        executionAnalysisLaunchTimer = null;
      }
      await persistExecutionAnalysisState({
        ...state,
        status: EXECUTION_ANALYSIS_STATUS_PAUSED,
        lastError: ''
      });
      return;
    }

    const pendingRows = getExecutionAnalysisPendingRows(state);
    if (!pendingRows.length) {
      window.alert('Нет необработанных строк с EdocID и текстом анализа.');
      return;
    }

    const params = readExecutionAnalysisParamsFromControls();
    await persistExecutionAnalysisParams(params);
    await persistExecutionAnalysisState({
      ...executionAnalysisState,
      status: EXECUTION_ANALYSIS_STATUS_RUNNING,
      sourcePageId: executionAnalysisPageId,
      sourceOrigin: window.location.origin,
      runId: executionAnalysisState.runId || createExecutionAnalysisPageId(),
      nextLaunchAt: Date.now(),
      lastError: ''
    });
    maybeScheduleExecutionAnalysisNextBatch('start');
  }

  async function finishExecutionAnalysisProcess() {
    const state = normalizeExecutionAnalysisState(executionAnalysisState);
    if (!state.rows.length) return;
    if (state.currentBatch && Number.isInteger(state.currentBatch.tabId) && state.currentBatch.tabId > 0) {
      await sendRuntimeMessage({
        action: 'EXECUTION_ANALYSIS_CLOSE_TAB',
        data: { tabId: state.currentBatch.tabId }
      });
    }
    downloadExecutionAnalysisResultFile(state);
    executionAnalysisDownloadDoneForRunId = '';
    executionAnalysisState = createEmptyExecutionAnalysisState();
    syncExecutionAnalysisControls();
    await chromeStorageRemove(EXECUTION_ANALYSIS_STATE_STORAGE_KEY);
    if (executionAnalysisElements && executionAnalysisElements.fileInput instanceof HTMLInputElement) {
      executionAnalysisElements.fileInput.value = '';
    }
  }

  function maybeScheduleExecutionAnalysisNextBatch(_source) {
    const state = normalizeExecutionAnalysisState(executionAnalysisState);
    if (executionAnalysisLaunchTimer) {
      clearTimeout(executionAnalysisLaunchTimer);
      executionAnalysisLaunchTimer = null;
    }
    if (state.status !== EXECUTION_ANALYSIS_STATUS_RUNNING) return;
    if (state.sourcePageId !== executionAnalysisPageId) return;
    if (state.currentBatch) return;

    const delayMs = Math.max(0, Number(state.nextLaunchAt || 0) - Date.now());
    executionAnalysisLaunchTimer = window.setTimeout(() => {
      executionAnalysisLaunchTimer = null;
      void launchExecutionAnalysisNextBatch();
    }, delayMs);
  }

  async function launchExecutionAnalysisNextBatch() {
    let state = normalizeExecutionAnalysisState(executionAnalysisState);
    if (state.status !== EXECUTION_ANALYSIS_STATUS_RUNNING) return;
    if (state.sourcePageId !== executionAnalysisPageId) return;
    if (state.currentBatch) return;

    const batch = buildNextExecutionAnalysisBatch(state);
    if (!batch) {
      const completedState = await persistExecutionAnalysisState({
        ...state,
        status: EXECUTION_ANALYSIS_STATUS_COMPLETED,
        currentBatch: null,
        nextLaunchAt: 0,
        lastError: ''
      });
      if (executionAnalysisDownloadDoneForRunId !== completedState.runId) {
        executionAnalysisDownloadDoneForRunId = completedState.runId;
        downloadExecutionAnalysisResultFile(completedState);
      }
      return;
    }

    state = await persistExecutionAnalysisState({
      ...state,
      currentBatch: batch,
      nextLaunchAt: 0,
      lastError: ''
    });

    const response = await openExecutionAnalysisTab(
      buildExecutionAnalysisUrl(batch.edocIds, state.sourceOrigin || window.location.origin),
      false
    );
    if (!response || response.success !== true || !Number.isInteger(response.tabId)) {
      await persistExecutionAnalysisState({
        ...state,
        status: EXECUTION_ANALYSIS_STATUS_PAUSED,
        currentBatch: null,
        lastError: response && response.error ? String(response.error) : 'Не удалось открыть вкладку анализа.'
      });
      return;
    }

    await persistExecutionAnalysisState({
      ...state,
      currentBatch: {
        ...batch,
        tabId: response.tabId
      }
    });
  }

  async function markExecutionAnalysisBatchResult(success, errorMessage) {
    const stored = await chromeStorageGet(EXECUTION_ANALYSIS_STATE_STORAGE_KEY);
    const state = normalizeExecutionAnalysisState(stored[EXECUTION_ANALYSIS_STATE_STORAGE_KEY]);
    const batch = state.currentBatch;
    if (!batch) return false;

    if (success) {
      const rowIdSet = new Set(batch.rowIds || []);
      const processedIndex = findExecutionAnalysisColumnIndex(state.headers, ['Обработано']);
      const rows = state.rows.map((row) => {
        if (!rowIdSet.has(row.id)) return row;
        const values = [...row.values];
        if (processedIndex >= 0) values[processedIndex] = EXECUTION_ANALYSIS_PROCESSED_TEXT;
        return {
          ...row,
          values,
          processed: EXECUTION_ANALYSIS_PROCESSED_TEXT
        };
      });
      const nextStatus = state.status === EXECUTION_ANALYSIS_STATUS_PAUSED
        ? EXECUTION_ANALYSIS_STATUS_PAUSED
        : EXECUTION_ANALYSIS_STATUS_RUNNING;
      await persistExecutionAnalysisState({
        ...state,
        rows,
        status: nextStatus,
        currentBatch: null,
        nextLaunchAt: nextStatus === EXECUTION_ANALYSIS_STATUS_RUNNING
          ? Date.now() + normalizeExecutionAnalysisParams(state.params).intervalMs
          : 0,
        lastError: ''
      });
      return true;
    }

    await persistExecutionAnalysisState({
      ...state,
      status: EXECUTION_ANALYSIS_STATUS_PAUSED,
      currentBatch: null,
      nextLaunchAt: 0,
      lastError: normalizeExecutionAnalysisText(errorMessage) || 'Пакет не обработан.'
    });
    return false;
  }

  function getExecutionAnalysisFormContext() {
    const input = document.querySelector('textarea[name="Note"], textarea.form-control, textarea');
    const saveButton = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'))
      .find((el) => {
        if (!isStageJumpElementVisible(el)) return false;
        const text = normalizeStageJumpText(el.textContent || el.value || '');
        return text.includes(normalizeStageJumpText('Сохранить информацию'));
      });
    if (!(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement)) return null;
    if (!(saveButton instanceof HTMLElement)) return null;
    return { input, saveButton };
  }

  function hasExecutionAnalysisSuccessMessage() {
    const text = normalizeStageJumpText(document.body ? document.body.textContent || '' : '');
    return text.includes(normalizeStageJumpText('Анализ исполнения успешно занес')) ||
      text.includes(normalizeStageJumpText('Вы можете закрыть это окно'));
  }

  function getExecutionAnalysisServerErrorText() {
    const text = normalizeExecutionAnalysisText(document.body ? document.body.textContent || '' : '');
    if (!text) return '';
    if (text.includes('ERROR EXCEPTION')) return text.slice(0, 500);
    if (text.includes('No query results for model')) return text.slice(0, 500);
    return '';
  }

  async function shouldProcessExecutionAnalysisPage(tabId) {
    const stored = await chromeStorageGet(EXECUTION_ANALYSIS_STATE_STORAGE_KEY);
    const state = normalizeExecutionAnalysisState(stored[EXECUTION_ANALYSIS_STATE_STORAGE_KEY]);
    const batch = state.currentBatch;
    if (!batch) return null;
    if (batch.tabId > 0 && tabId > 0 && batch.tabId !== tabId) return null;
    return { state, batch };
  }

  async function initExecutionAnalysisWorkerPage() {
    if (!isPyramidExtensionPage()) return;
    const pathname = String(window.location.pathname || '');
    const isFormPath = pathname === EXECUTION_ANALYSIS_PATH;
    const isBlankPath = pathname === EXECUTION_ANALYSIS_BLANK_PATH;
    if (!isFormPath && !isBlankPath) return;

    const tabId = await getCurrentTabIdForExecutionAnalysis();
    const context = await shouldProcessExecutionAnalysisPage(tabId);
    if (!context) return;

    const { batch } = context;
    if (isBlankPath && hasExecutionAnalysisSuccessMessage()) {
      const ok = await markExecutionAnalysisBatchResult(true, '');
      if (ok) {
        await sendRuntimeMessage({
          action: 'EXECUTION_ANALYSIS_CLOSE_TAB',
          data: { tabId }
        });
      }
      return;
    }

    const serverError = getExecutionAnalysisServerErrorText();
    if (serverError) {
      await markExecutionAnalysisBatchResult(false, serverError);
      return;
    }

    if (!isFormPath || !window.location.search.includes('edocid=')) return;
    const idsFromUrl = splitExecutionAnalysisEdocIds(new URL(window.location.href).searchParams.get('edocid') || '');
    const expected = new Set(batch.edocIds || []);
    if (!idsFromUrl.length || idsFromUrl.some((id) => !expected.has(id))) return;

    const startedAt = Date.now();
    const timeoutMs = 45 * 1000;
    if (executionAnalysisProcessingTimer) clearInterval(executionAnalysisProcessingTimer);
    executionAnalysisProcessingTimer = window.setInterval(async () => {
      if ((Date.now() - startedAt) > timeoutMs) {
        clearInterval(executionAnalysisProcessingTimer);
        executionAnalysisProcessingTimer = null;
        await markExecutionAnalysisBatchResult(false, 'Не найдена форма анализа исполнения.');
        return;
      }

      const formContext = getExecutionAnalysisFormContext();
      if (!formContext) return;

      clearInterval(executionAnalysisProcessingTimer);
      executionAnalysisProcessingTimer = null;
      setNativeInputValue(formContext.input, batch.analysisText);
      formContext.input.dispatchEvent(new Event('input', { bubbles: true }));
      formContext.input.dispatchEvent(new Event('change', { bubbles: true }));
      formContext.saveButton.click();
    }, 200);
  }

  function createExecutionAnalysisManualDialog() {
    const existing = document.getElementById(EXECUTION_ANALYSIS_MANUAL_DIALOG_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = EXECUTION_ANALYSIS_MANUAL_DIALOG_ID;
    modal.className = 'dup-execution-analysis-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel" role="dialog" aria-modal="true" aria-label="Ручное занесение анализа исполнения">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Вручную</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <label class="dup-execution-analysis-field">
          <span>EdocID построчно</span>
          <textarea class="dup-execution-analysis-manual-input" rows="9" placeholder="13461137&#10;13461138"></textarea>
        </label>
        <div class="dup-execution-analysis-modal-actions">
          <button type="button" class="dup-execution-analysis-open-manual">Открыть</button>
          <button type="button" class="dup-execution-analysis-cancel-manual">Отмена</button>
        </div>
      </div>
    `;

    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-execution-analysis-cancel-manual')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-execution-analysis-open-manual')?.addEventListener('click', () => {
      const textarea = modal.querySelector('.dup-execution-analysis-manual-input');
      const ids = textarea instanceof HTMLTextAreaElement ? splitExecutionAnalysisEdocIds(textarea.value) : [];
      if (!ids.length) {
        window.alert('Введите хотя бы один EdocID.');
        return;
      }
      void openExecutionAnalysisTab(buildExecutionAnalysisUrl(ids), true);
      close();
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openExecutionAnalysisManualDialog() {
    const modal = createExecutionAnalysisManualDialog();
    modal.hidden = false;
    const input = modal.querySelector('.dup-execution-analysis-manual-input');
    if (input instanceof HTMLTextAreaElement) input.focus();
  }

  function createEmptyIdCardCheckState() {
    return {
      version: 1,
      tabId: 0,
      edocIds: [],
      currentIndex: 0,
      updatedAt: Date.now()
    };
  }

  function normalizeIdCardCheckState(rawState) {
    const raw = rawState && typeof rawState === 'object' ? rawState : {};
    const edocIds = Array.isArray(raw.edocIds)
      ? raw.edocIds.map((id) => normalizeExecutionAnalysisText(id)).filter(Boolean)
      : [];
    const uniqueEdocIds = [];
    const seen = new Set();
    edocIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      uniqueEdocIds.push(id);
    });
    const rawIndex = Number.parseInt(String(raw.currentIndex || 0), 10);
    const currentIndex = uniqueEdocIds.length
      ? Math.min(Math.max(Number.isFinite(rawIndex) ? rawIndex : 0, 0), uniqueEdocIds.length - 1)
      : 0;
    const rawTabId = Number(raw.tabId || 0);
    return {
      version: 1,
      tabId: Number.isInteger(rawTabId) && rawTabId > 0 ? rawTabId : 0,
      edocIds: uniqueEdocIds,
      currentIndex,
      updatedAt: Number(raw.updatedAt || 0) || Date.now()
    };
  }

  async function persistIdCardCheckState(nextState) {
    const normalized = normalizeIdCardCheckState({
      ...nextState,
      updatedAt: Date.now()
    });
    idCardCheckState = normalized;
    await chromeStorageSet({ [ID_CARD_CHECK_STORAGE_KEY]: normalized });
    syncIdCardCheckNavigation();
    return normalized;
  }

  async function loadIdCardCheckState() {
    const stored = await chromeStorageGet(ID_CARD_CHECK_STORAGE_KEY);
    idCardCheckState = normalizeIdCardCheckState(stored[ID_CARD_CHECK_STORAGE_KEY]);
    await syncIdCardCheckStateWithCurrentUrl();
    syncIdCardCheckNavigation();
    return idCardCheckState;
  }

  function isIdCardCheckFullcardPath(pathname = window.location.pathname) {
    return /^\/ovzid\/fullcard\/[^/]+(?:\/.*)?$/i.test(String(pathname || ''));
  }

  function getIdCardCheckEdocIdFromPath(pathname = window.location.pathname) {
    const match = String(pathname || '').match(/^\/ovzid\/fullcard\/([^/]+)(?:\/.*)?$/i);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function buildIdCardCheckFullcardUrl(edocId, origin = window.location.origin) {
    const url = new URL(`/ovzid/fullcard/${encodeURIComponent(String(edocId || '').trim())}`, origin);
    return url.toString();
  }

  function buildIdCardCheckNavigationUrl(edocId) {
    const url = new URL(window.location.href);
    const targetId = encodeURIComponent(String(edocId || '').trim());
    const match = url.pathname.match(/^(\/ovzid\/fullcard\/)([^/]+)(.*)$/i);
    url.pathname = match
      ? `${match[1]}${targetId}${match[3] || ''}`
      : `/ovzid/fullcard/${targetId}`;
    return url.toString();
  }

  function getIdCardCheckCurrentEdocId() {
    const state = normalizeIdCardCheckState(idCardCheckState);
    return normalizeExecutionAnalysisText(getIdCardCheckEdocIdFromPath()) ||
      normalizeExecutionAnalysisText(state.edocIds[state.currentIndex]);
  }

  function buildIdCardCheckActionUrl(actionKey, edocId, origin = window.location.origin) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!normalizedEdocId) return '';
    const url = new URL('/ovzid/actions/', origin || window.location.origin);
    switch (String(actionKey || '')) {
      case 'edit-info':
        url.pathname = '/ovzid/actions/editedoc';
        url.searchParams.set('edocid', normalizedEdocId);
        url.searchParams.set('StatusID', 'all');
        break;
      case 'execution-analysis':
        url.pathname = '/ovzid/actions/execution-analysis';
        url.searchParams.set('edocid', normalizedEdocId);
        break;
      case 'solidarity-type':
        url.pathname = '/ovzid/actions/setSolidarityType';
        url.searchParams.set('EDocID', normalizedEdocId);
        break;
      case 'markers-ovzid':
        url.pathname = '/ovzid/actions/markers_ovzid';
        url.searchParams.set('EDocIDs', normalizedEdocId);
        break;
      default:
        return '';
    }
    return url.toString();
  }

  async function openIdCardCheckActionTab(actionKey, edocId) {
    const targetUrl = buildIdCardCheckActionUrl(actionKey, edocId);
    if (!targetUrl) return false;
    const response = await sendRuntimeMessage({
      action: 'ID_CARD_CHECK_OPEN_TAB',
      data: {
        url: targetUrl,
        active: true
      }
    });
    if (response && response.success === true) return true;

    const opened = window.open(targetUrl, '_blank', 'noopener');
    return !!opened;
  }

  function syncIdCardCheckCurrentActionButton(modal, edocId) {
    const button = modal instanceof HTMLElement
      ? modal.querySelector('.dup-id-card-check-current-actions')
      : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    button.hidden = !normalizedEdocId;
    button.dataset.edocId = normalizedEdocId;
    button.title = normalizedEdocId
      ? `Действия по текущему EdocID ${normalizedEdocId}`
      : 'Действия по текущему EdocID';
  }

  function createIdCardCheckActionDialog() {
    const existing = document.getElementById(ID_CARD_CHECK_ACTION_DIALOG_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = ID_CARD_CHECK_ACTION_DIALOG_ID;
    modal.className = 'dup-execution-analysis-modal dup-id-card-check-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel dup-id-card-check-action-panel" role="dialog" aria-modal="true" aria-label="Действия по EdocID">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Действия по EdocID</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <div class="dup-id-card-check-action-current"></div>
        <div class="dup-id-card-check-action-list">
          <button type="button" class="dup-id-card-check-action-item" data-action="edit-info">Редактирование информации</button>
          <button type="button" class="dup-id-card-check-action-item" data-action="execution-analysis">Анализ исполнения</button>
          <button type="button" class="dup-id-card-check-action-item" data-action="solidarity-type">Установить вид солидарности</button>
          <button type="button" class="dup-id-card-check-action-item" data-action="markers-ovzid">Маркировка ВЗИД</button>
        </div>
      </div>
    `;

    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-id-card-check-action-list')?.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('.dup-id-card-check-action-item')
        : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const actionKey = normalizeExecutionAnalysisText(button.dataset.action);
      const edocId = normalizeExecutionAnalysisText(modal.dataset.edocId);
      if (!actionKey || !edocId) return;
      close();
      void openIdCardCheckActionTab(actionKey, edocId).then((success) => {
        if (!success) window.alert('Не удалось открыть вкладку действия.');
      });
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openIdCardCheckActionDialog(edocId) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!normalizedEdocId) {
      window.alert('Не удалось определить текущий EdocID.');
      return;
    }
    const modal = createIdCardCheckActionDialog();
    modal.dataset.edocId = normalizedEdocId;
    const current = modal.querySelector('.dup-id-card-check-action-current');
    if (current instanceof HTMLElement) {
      current.textContent = `Текущий EdocID: ${normalizedEdocId}`;
    }
    modal.hidden = false;
  }

  async function isCurrentIdCardCheckManagedTab() {
    const tabId = await getCurrentTabIdForExecutionAnalysis();
    return tabId > 0 && idCardCheckState.tabId > 0 && tabId === idCardCheckState.tabId;
  }

  async function syncIdCardCheckStateWithCurrentUrl() {
    const state = normalizeIdCardCheckState(idCardCheckState);
    if (!state.edocIds.length || !isIdCardCheckFullcardPath()) return state;
    if (!(await isCurrentIdCardCheckManagedTab())) return state;

    const currentEdocId = getIdCardCheckEdocIdFromPath();
    const currentIndex = state.edocIds.indexOf(currentEdocId);
    if (currentIndex < 0 || currentIndex === state.currentIndex) return state;
    return persistIdCardCheckState({
      ...state,
      currentIndex
    });
  }

  function removeIdCardCheckNavigation() {
    if (idCardCheckNavEl instanceof HTMLElement) {
      idCardCheckNavEl.remove();
    }
    idCardCheckNavEl = null;
  }

  function updateIdCardCheckNavigationButtons() {
    if (!(idCardCheckNavEl instanceof HTMLElement)) return;
    const state = normalizeIdCardCheckState(idCardCheckState);
    const previousButton = idCardCheckNavEl.querySelector('.dup-id-card-check-prev');
    const nextButton = idCardCheckNavEl.querySelector('.dup-id-card-check-next');
    const status = idCardCheckNavEl.querySelector('.dup-id-card-check-status');
    if (previousButton instanceof HTMLButtonElement) previousButton.disabled = state.currentIndex <= 0;
    if (nextButton instanceof HTMLButtonElement) nextButton.disabled = state.currentIndex >= state.edocIds.length - 1;
    if (status instanceof HTMLElement) {
      const currentEdocId = state.edocIds[state.currentIndex] || '';
      const pathEdocId = getIdCardCheckEdocIdFromPath();
      status.textContent = pathEdocId && !state.edocIds.includes(pathEdocId)
        ? `Вне списка: ${pathEdocId}`
        : currentEdocId
          ? `${state.currentIndex + 1}/${state.edocIds.length}: ${currentEdocId}`
          : 'Список не загружен';
    }
  }

  async function navigateIdCardCheckToIndex(index) {
    const state = normalizeIdCardCheckState(idCardCheckState);
    if (!state.edocIds.length) return;
    const nextIndex = Math.min(Math.max(index, 0), state.edocIds.length - 1);
    const targetEdocId = state.edocIds[nextIndex];
    if (!targetEdocId) return;
    await persistIdCardCheckState({
      ...state,
      currentIndex: nextIndex
    });
    window.location.assign(buildIdCardCheckNavigationUrl(targetEdocId));
  }

  function getIdCardCheckChoiceSearchQuery(modal) {
    const input = modal instanceof HTMLElement
      ? modal.querySelector('.dup-id-card-check-choice-search')
      : null;
    return input instanceof HTMLInputElement
      ? normalizeExecutionAnalysisText(input.value)
      : '';
  }

  function syncIdCardCheckChoiceSearch(modal) {
    if (!(modal instanceof HTMLElement)) return '';
    const query = getIdCardCheckChoiceSearchQuery(modal);
    const queryLower = query.toLowerCase();
    let exactMatch = false;
    modal.querySelectorAll('.dup-id-card-check-choice-item').forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const edocId = normalizeExecutionAnalysisText(item.dataset.edocId);
      const edocIdLower = edocId.toLowerCase();
      if (edocIdLower === queryLower && queryLower) exactMatch = true;
      item.hidden = !!queryLower && !edocIdLower.includes(queryLower);
    });

    const openButton = modal.querySelector('.dup-id-card-check-open-external');
    if (openButton instanceof HTMLButtonElement) {
      const canOpenExternal = /^\d+$/.test(query) && !exactMatch;
      openButton.hidden = !canOpenExternal;
      openButton.dataset.edocId = canOpenExternal ? query : '';
    }
    return query;
  }

  async function navigateIdCardCheckToExternalEdocId(edocId) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!normalizedEdocId) return;
    await persistIdCardCheckState(normalizeIdCardCheckState(idCardCheckState));
    window.location.assign(buildIdCardCheckNavigationUrl(normalizedEdocId));
  }

  function createIdCardCheckInputDialog() {
    const existing = document.getElementById(ID_CARD_CHECK_INPUT_DIALOG_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = ID_CARD_CHECK_INPUT_DIALOG_ID;
    modal.className = 'dup-execution-analysis-modal dup-id-card-check-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel" role="dialog" aria-modal="true" aria-label="Загрузка списка EdocID для проверки карточек">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Проверка карточек ИД</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <label class="dup-execution-analysis-field">
          <span>EdocID построчно</span>
          <textarea class="dup-id-card-check-input" rows="9" placeholder="47685198&#10;46748397&#10;45811490"></textarea>
        </label>
        <div class="dup-execution-analysis-modal-actions">
          <button type="button" class="dup-id-card-check-save">Сохранить</button>
          <button type="button" class="dup-id-card-check-cancel">Отмена</button>
        </div>
      </div>
    `;

    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-id-card-check-cancel')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-id-card-check-save')?.addEventListener('click', async () => {
      const textarea = modal.querySelector('.dup-id-card-check-input');
      const ids = textarea instanceof HTMLTextAreaElement ? splitExecutionAnalysisEdocIds(textarea.value) : [];
      if (!ids.length) {
        window.alert('Введите хотя бы один EdocID.');
        return;
      }

      if (textarea instanceof HTMLTextAreaElement) textarea.value = '';
      close();
      const response = await sendRuntimeMessage({
        action: 'ID_CARD_CHECK_OPEN_TAB',
        data: {
          url: buildIdCardCheckFullcardUrl(ids[0]),
          active: true
        }
      });
      if (!response || response.success !== true || !Number.isInteger(response.tabId)) {
        window.alert('Не удалось открыть вкладку карточки ИД.');
        return;
      }

      await persistIdCardCheckState({
        version: 1,
        tabId: response.tabId,
        edocIds: ids,
        currentIndex: 0
      });
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openIdCardCheckInputDialog() {
    const modal = createIdCardCheckInputDialog();
    modal.hidden = false;
    const input = modal.querySelector('.dup-id-card-check-input');
    if (input instanceof HTMLTextAreaElement) input.focus();
  }

  function createIdCardCheckChoiceDialog() {
    const existing = document.getElementById(ID_CARD_CHECK_CHOICE_DIALOG_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = ID_CARD_CHECK_CHOICE_DIALOG_ID;
    modal.className = 'dup-execution-analysis-modal dup-id-card-check-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel dup-id-card-check-choice-panel" role="dialog" aria-modal="true" aria-label="Выбор EdocID">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Выбор EdocID</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <label class="dup-execution-analysis-field">
          <span>Поиск</span>
          <input class="dup-id-card-check-choice-search" type="search" placeholder="Введите EdocID">
        </label>
        <div class="dup-id-card-check-choice-tools">
          <button type="button" class="dup-id-card-check-open-external" hidden>Открыть карточку ИД</button>
          <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-current-actions" hidden aria-label="Действия по текущему EdocID" title="Действия по текущему EdocID">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M13 2 4 14h6l-1 8 11-14h-7l1-6z"></path>
            </svg>
          </button>
        </div>
        <div class="dup-id-card-check-choice-hint">Нажмите на нужный EdocID.</div>
        <div class="dup-id-card-check-choice-list" role="listbox"></div>
      </div>
    `;

    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-id-card-check-choice-list')?.addEventListener('click', (event) => {
      const item = event.target instanceof Element
        ? event.target.closest('.dup-id-card-check-choice-item')
        : null;
      if (!(item instanceof HTMLElement)) return;
      const index = Number.parseInt(String(item.dataset.index || ''), 10);
      if (!Number.isInteger(index)) return;
      close();
      void navigateIdCardCheckToIndex(index);
    }, { capture: true });
    modal.querySelector('.dup-id-card-check-choice-search')?.addEventListener('input', (event) => {
      syncIdCardCheckChoiceSearch(modal);
    }, { capture: true });
    modal.querySelector('.dup-id-card-check-open-external')?.addEventListener('click', () => {
      const button = modal.querySelector('.dup-id-card-check-open-external');
      const edocId = button instanceof HTMLButtonElement
        ? normalizeExecutionAnalysisText(button.dataset.edocId)
        : '';
      if (!edocId) return;
      close();
      void navigateIdCardCheckToExternalEdocId(edocId);
    }, { capture: true });
    modal.querySelector('.dup-id-card-check-current-actions')?.addEventListener('click', () => {
      const button = modal.querySelector('.dup-id-card-check-current-actions');
      const edocId = button instanceof HTMLButtonElement
        ? normalizeExecutionAnalysisText(button.dataset.edocId)
        : '';
      if (!edocId) return;
      close();
      openIdCardCheckActionDialog(edocId);
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openIdCardCheckChoiceDialog() {
    const modal = createIdCardCheckChoiceDialog();
    const list = modal.querySelector('.dup-id-card-check-choice-list');
    const search = modal.querySelector('.dup-id-card-check-choice-search');
    const state = normalizeIdCardCheckState(idCardCheckState);
    if (search instanceof HTMLInputElement) search.value = '';
    if (list instanceof HTMLElement) {
      list.textContent = '';
      state.edocIds.forEach((edocId, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dup-id-card-check-choice-item';
        item.dataset.index = String(index);
        item.dataset.edocId = edocId;
        item.textContent = `${index + 1}. ${edocId}`;
        item.classList.toggle('is-active', index === state.currentIndex);
        list.appendChild(item);
      });
    }
    modal.hidden = false;
    syncIdCardCheckChoiceSearch(modal);
    syncIdCardCheckCurrentActionButton(modal, getIdCardCheckCurrentEdocId());
    if (search instanceof HTMLInputElement) search.focus();
  }

  function createIdCardCheckFunctionBlock() {
    const block = document.createElement('section');
    block.className = 'dup-execution-analysis-block dup-id-card-check-block';
    block.innerHTML = `
      <div class="dup-execution-analysis-block-title">Проверка карточек ИД</div>
      <div class="dup-execution-analysis-actions">
        <button type="button" class="dup-id-card-check-load">Загрузить список EdocID</button>
      </div>
    `;

    idCardCheckElements = {
      block,
      loadButton: block.querySelector('.dup-id-card-check-load')
    };
    idCardCheckElements.loadButton?.addEventListener('click', () => {
      openIdCardCheckInputDialog();
    }, { capture: true });
    return block;
  }

  async function syncIdCardCheckNavigation() {
    const state = normalizeIdCardCheckState(idCardCheckState);
    if (
      !isPyramidExtensionPage() ||
      !isIdCardCheckFullcardPath() ||
      !state.edocIds.length ||
      !isExtensionUiSettingEnabled('idCardCheckTools')
    ) {
      removeIdCardCheckNavigation();
      return;
    }

    if (!(await isCurrentIdCardCheckManagedTab())) {
      removeIdCardCheckNavigation();
      return;
    }

    const tabsHeader = document.querySelector('.custom-ui-tab.ui-tabs-nav, .ui-tabs-nav');
    if (!(tabsHeader instanceof HTMLElement)) return;

    if (!(idCardCheckNavEl instanceof HTMLElement)) {
      const nav = document.createElement('div');
      nav.id = ID_CARD_CHECK_NAV_ID;
      nav.className = 'dup-id-card-check-nav';
      nav.innerHTML = `
        <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-prev" aria-label="Назад" title="Назад">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.4 11H19a1 1 0 1 1 0 2h-8.6l4.3 4.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0z"></path>
          </svg>
        </button>
        <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-choice" aria-label="Выбор" title="Выбор">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zM4 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm0 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm0 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"></path>
          </svg>
        </button>
        <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-next" aria-label="Вперед" title="Вперед">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9.3 18.7a1 1 0 0 1 0-1.4l4.3-4.3H5a1 1 0 1 1 0-2h8.6L9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0z"></path>
          </svg>
        </button>
        <span class="dup-id-card-check-status"></span>
      `;
      nav.querySelector('.dup-id-card-check-prev')?.addEventListener('click', () => {
        void navigateIdCardCheckToIndex(normalizeIdCardCheckState(idCardCheckState).currentIndex - 1);
      }, { capture: true });
      nav.querySelector('.dup-id-card-check-choice')?.addEventListener('click', () => {
        openIdCardCheckChoiceDialog();
      }, { capture: true });
      nav.querySelector('.dup-id-card-check-next')?.addEventListener('click', () => {
        void navigateIdCardCheckToIndex(normalizeIdCardCheckState(idCardCheckState).currentIndex + 1);
      }, { capture: true });
      idCardCheckNavEl = nav;
    }

    if (idCardCheckNavEl.parentElement !== tabsHeader.parentElement || idCardCheckNavEl.previousElementSibling !== tabsHeader) {
      tabsHeader.insertAdjacentElement('afterend', idCardCheckNavEl);
    }
    updateIdCardCheckNavigationButtons();
  }

  const debouncedSyncIdCardCheckNavigation = debounce(() => {
    void syncIdCardCheckNavigation();
  }, 120);

  function initIdCardCheckNavigation() {
    if (!isPyramidExtensionPage()) return;
    void loadIdCardCheckState();

    if (!idCardCheckNavObserver) {
      idCardCheckNavObserver = new MutationObserver(() => {
        debouncedSyncIdCardCheckNavigation();
      });
      observeWithRetry(
        idCardCheckNavObserver,
        () => document.body || document.documentElement,
        { childList: true, subtree: true },
        120,
        100
      );
    }
  }

  function createEmptyGridCardCheckState() {
    return {
      edocIds: [],
      currentIndex: 0
    };
  }

  function normalizeGridCardCheckState(rawState) {
    const raw = rawState && typeof rawState === 'object' ? rawState : {};
    const edocIds = Array.isArray(raw.edocIds)
      ? raw.edocIds.map((id) => normalizeExecutionAnalysisText(id)).filter(Boolean)
      : [];
    const uniqueEdocIds = [];
    const seen = new Set();
    edocIds.forEach((edocId) => {
      if (seen.has(edocId)) return;
      seen.add(edocId);
      uniqueEdocIds.push(edocId);
    });
    const rawIndex = Number.parseInt(String(raw.currentIndex || 0), 10);
    const currentIndex = uniqueEdocIds.length
      ? Math.min(Math.max(Number.isFinite(rawIndex) ? rawIndex : 0, 0), uniqueEdocIds.length - 1)
      : 0;
    return { edocIds: uniqueEdocIds, currentIndex };
  }

  function getGridCardCheckVisibleRows() {
    return Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'))
      .filter((row) => row instanceof HTMLTableRowElement && isStageJumpElementVisible(row));
  }

  function collectGridCardCheckEdocIdsFromGrid() {
    const ids = [];
    const seen = new Set();
    getGridCardCheckVisibleRows().forEach((row) => {
      const cell = row.querySelector('[aria-describedby="list_EDocID"]');
      const edocId = normalizeExecutionAnalysisText(cell ? cell.textContent : row.id);
      if (!edocId || seen.has(edocId)) return;
      seen.add(edocId);
      ids.push(edocId);
    });
    return ids;
  }

  function getEdocIdFromFullcardUrl(urlValue) {
    try {
      const url = new URL(String(urlValue || ''), window.location.origin);
      return getIdCardCheckEdocIdFromPath(url.pathname);
    } catch (error) {
      return '';
    }
  }

  function getGridCardCheckIframeUrl(iframe) {
    if (!(iframe instanceof HTMLIFrameElement)) return '';
    try {
      const liveUrl = iframe.contentWindow && iframe.contentWindow.location
        ? iframe.contentWindow.location.href
        : '';
      return getEdocIdFromFullcardUrl(liveUrl) ? liveUrl : iframe.src;
    } catch (error) {
      return iframe.src;
    }
  }

  function getGridCardCheckCurrentEdocId() {
    const iframe = getGridCardCheckIframe();
    const state = normalizeGridCardCheckState(gridCardCheckState);
    return getEdocIdFromFullcardUrl(getGridCardCheckIframeUrl(iframe)) ||
      normalizeExecutionAnalysisText(iframe && iframe.dataset ? iframe.dataset.dupGridCardEdocId : '') ||
      normalizeExecutionAnalysisText(state.edocIds[state.currentIndex]);
  }

  function buildFullcardUrlWithEdocId(sourceUrl, edocId) {
    const targetId = encodeURIComponent(String(edocId || '').trim());
    const url = new URL(String(sourceUrl || window.location.href), window.location.origin);
    const match = url.pathname.match(/^(\/ovzid\/fullcard\/)([^/]+)(.*)$/i);
    url.pathname = match
      ? `${match[1]}${targetId}${match[3] || ''}`
      : `/ovzid/fullcard/${targetId}`;
    return url.toString();
  }

  function getGridCardCheckIframe() {
    const iframe = Array.from(document.querySelectorAll('iframe'))
      .find((frame) => {
        if (!(frame instanceof HTMLIFrameElement)) return false;
        if (!getEdocIdFromFullcardUrl(frame.src)) return false;
        const dialog = frame.closest('.ui-dialog');
        if (!(dialog instanceof HTMLElement)) return false;
        return isStageJumpElementVisible(dialog);
      }) || null;
    if (iframe instanceof HTMLIFrameElement && iframe.dataset.dupGridCardLoadBound !== '1') {
      iframe.dataset.dupGridCardLoadBound = '1';
      iframe.addEventListener('load', () => {
        const edocId = getEdocIdFromFullcardUrl(getGridCardCheckIframeUrl(iframe)) ||
          getEdocIdFromFullcardUrl(iframe.src);
        if (edocId) iframe.dataset.dupGridCardEdocId = edocId;
        debouncedSyncGridCardCheckNavigation();
      }, { capture: true });
    }
    return iframe;
  }

  function getGridCardCheckDialog() {
    const iframe = getGridCardCheckIframe();
    return iframe ? iframe.closest('.ui-dialog') : null;
  }

  function syncGridCardCheckStateFromModal() {
    const iframe = getGridCardCheckIframe();
    if (!(iframe instanceof HTMLIFrameElement)) {
      gridCardCheckState = createEmptyGridCardCheckState();
      return gridCardCheckState;
    }

    const currentEdocId = getEdocIdFromFullcardUrl(getGridCardCheckIframeUrl(iframe)) ||
      normalizeExecutionAnalysisText(iframe.dataset.dupGridCardEdocId) ||
      getEdocIdFromFullcardUrl(iframe.src);
    const gridIds = collectGridCardCheckEdocIdsFromGrid();
    const previousState = normalizeGridCardCheckState(gridCardCheckState);
    const edocIds = gridIds;
    const currentIndexInGrid = currentEdocId ? edocIds.indexOf(currentEdocId) : -1;
    const currentIndex = currentIndexInGrid >= 0
      ? currentIndexInGrid
      : Math.min(previousState.currentIndex, Math.max(edocIds.length - 1, 0));
    gridCardCheckState = normalizeGridCardCheckState({
      edocIds,
      currentIndex
    });
    return gridCardCheckState;
  }

  function removeGridCardCheckNavigation() {
    if (gridCardCheckNavEl instanceof HTMLElement) {
      gridCardCheckNavEl.remove();
    }
    gridCardCheckNavEl = null;
  }

  function updateGridCardCheckDialogTitle(edocId) {
    const dialog = getGridCardCheckDialog();
    const title = dialog instanceof HTMLElement ? dialog.querySelector('.ui-dialog-title') : null;
    if (title instanceof HTMLElement && edocId) {
      title.textContent = `Карточка ИД #${edocId}`;
    }
  }

  function updateGridCardCheckNavigationButtons() {
    if (!(gridCardCheckNavEl instanceof HTMLElement)) return;
    const state = normalizeGridCardCheckState(gridCardCheckState);
    const previousButton = gridCardCheckNavEl.querySelector('.dup-id-card-check-prev');
    const nextButton = gridCardCheckNavEl.querySelector('.dup-id-card-check-next');
    const status = gridCardCheckNavEl.querySelector('.dup-id-card-check-status');
    if (previousButton instanceof HTMLButtonElement) previousButton.disabled = state.currentIndex <= 0;
    if (nextButton instanceof HTMLButtonElement) nextButton.disabled = state.currentIndex >= state.edocIds.length - 1;
    if (status instanceof HTMLElement) {
      const currentEdocId = state.edocIds[state.currentIndex] || '';
      const iframe = getGridCardCheckIframe();
      const iframeEdocId = getEdocIdFromFullcardUrl(getGridCardCheckIframeUrl(iframe)) ||
        normalizeExecutionAnalysisText(iframe && iframe.dataset ? iframe.dataset.dupGridCardEdocId : '');
      status.textContent = iframeEdocId && !state.edocIds.includes(iframeEdocId)
        ? `Вне списка: ${iframeEdocId}`
        : currentEdocId
          ? `${state.currentIndex + 1}/${state.edocIds.length}: ${currentEdocId}`
          : 'Список пуст';
    }
  }

  function navigateGridCardCheckToIndex(index) {
    const iframe = getGridCardCheckIframe();
    if (!(iframe instanceof HTMLIFrameElement)) return;
    const state = normalizeGridCardCheckState(gridCardCheckState);
    if (!state.edocIds.length) return;
    const nextIndex = Math.min(Math.max(index, 0), state.edocIds.length - 1);
    const targetEdocId = state.edocIds[nextIndex];
    if (!targetEdocId) return;
    gridCardCheckState = {
      ...state,
      currentIndex: nextIndex
    };
    iframe.dataset.dupGridCardEdocId = targetEdocId;
    updateGridCardCheckDialogTitle(targetEdocId);
    updateGridCardCheckNavigationButtons();
    iframe.src = buildFullcardUrlWithEdocId(getGridCardCheckIframeUrl(iframe), targetEdocId);
  }

  function navigateGridCardCheckToExternalEdocId(edocId) {
    const iframe = getGridCardCheckIframe();
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!(iframe instanceof HTMLIFrameElement) || !normalizedEdocId) return;
    iframe.dataset.dupGridCardEdocId = normalizedEdocId;
    updateGridCardCheckDialogTitle(normalizedEdocId);
    updateGridCardCheckNavigationButtons();
    iframe.src = buildFullcardUrlWithEdocId(getGridCardCheckIframeUrl(iframe), normalizedEdocId);
  }

  function createGridCardCheckChoiceDialog() {
    const existing = document.getElementById(GRID_CARD_CHECK_CHOICE_DIALOG_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = GRID_CARD_CHECK_CHOICE_DIALOG_ID;
    modal.className = 'dup-execution-analysis-modal dup-grid-card-check-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel dup-id-card-check-choice-panel" role="dialog" aria-modal="true" aria-label="Выбор EdocID из грида">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Выбор EdocID</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <label class="dup-execution-analysis-field">
          <span>Поиск</span>
          <input class="dup-id-card-check-choice-search" type="search" placeholder="Введите EdocID">
        </label>
        <div class="dup-id-card-check-choice-tools">
          <button type="button" class="dup-id-card-check-open-external" hidden>Открыть карточку ИД</button>
          <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-current-actions" hidden aria-label="Действия по текущему EdocID" title="Действия по текущему EdocID">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M13 2 4 14h6l-1 8 11-14h-7l1-6z"></path>
            </svg>
          </button>
        </div>
        <div class="dup-id-card-check-choice-hint">Нажмите на нужный EdocID.</div>
        <div class="dup-id-card-check-choice-list" role="listbox"></div>
      </div>
    `;

    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-id-card-check-choice-list')?.addEventListener('click', (event) => {
      const item = event.target instanceof Element
        ? event.target.closest('.dup-id-card-check-choice-item')
        : null;
      if (!(item instanceof HTMLElement)) return;
      const index = Number.parseInt(String(item.dataset.index || ''), 10);
      if (!Number.isInteger(index)) return;
      close();
      navigateGridCardCheckToIndex(index);
    }, { capture: true });
    modal.querySelector('.dup-id-card-check-choice-search')?.addEventListener('input', (event) => {
      syncIdCardCheckChoiceSearch(modal);
    }, { capture: true });
    modal.querySelector('.dup-id-card-check-open-external')?.addEventListener('click', () => {
      const button = modal.querySelector('.dup-id-card-check-open-external');
      const edocId = button instanceof HTMLButtonElement
        ? normalizeExecutionAnalysisText(button.dataset.edocId)
        : '';
      if (!edocId) return;
      close();
      navigateGridCardCheckToExternalEdocId(edocId);
    }, { capture: true });
    modal.querySelector('.dup-id-card-check-current-actions')?.addEventListener('click', () => {
      const button = modal.querySelector('.dup-id-card-check-current-actions');
      const edocId = button instanceof HTMLButtonElement
        ? normalizeExecutionAnalysisText(button.dataset.edocId)
        : '';
      if (!edocId) return;
      close();
      openIdCardCheckActionDialog(edocId);
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openGridCardCheckChoiceDialog() {
    const modal = createGridCardCheckChoiceDialog();
    const list = modal.querySelector('.dup-id-card-check-choice-list');
    const search = modal.querySelector('.dup-id-card-check-choice-search');
    const state = normalizeGridCardCheckState(gridCardCheckState);
    if (search instanceof HTMLInputElement) search.value = '';
    if (list instanceof HTMLElement) {
      list.textContent = '';
      state.edocIds.forEach((edocId, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dup-id-card-check-choice-item';
        item.dataset.index = String(index);
        item.dataset.edocId = edocId;
        item.textContent = `${index + 1}. ${edocId}`;
        item.classList.toggle('is-active', index === state.currentIndex);
        list.appendChild(item);
      });
    }
    modal.hidden = false;
    syncIdCardCheckChoiceSearch(modal);
    syncIdCardCheckCurrentActionButton(modal, getGridCardCheckCurrentEdocId());
    if (search instanceof HTMLInputElement) search.focus();
  }

  function ensureGridCardCheckNavigationElement() {
    if (gridCardCheckNavEl instanceof HTMLElement) return gridCardCheckNavEl;

    const nav = document.createElement('div');
    nav.id = GRID_CARD_CHECK_NAV_ID;
    nav.className = 'dup-id-card-check-nav dup-grid-card-check-nav';
    nav.innerHTML = `
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-prev" aria-label="Назад" title="Назад">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.4 11H19a1 1 0 1 1 0 2h-8.6l4.3 4.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0z"></path>
        </svg>
      </button>
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-choice" aria-label="Выбор" title="Выбор">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zM4 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm0 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm0 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"></path>
        </svg>
      </button>
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-next" aria-label="Вперед" title="Вперед">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.3 18.7a1 1 0 0 1 0-1.4l4.3-4.3H5a1 1 0 1 1 0-2h8.6L9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0z"></path>
        </svg>
      </button>
      <span class="dup-id-card-check-status"></span>
    `;
    nav.querySelector('.dup-id-card-check-prev')?.addEventListener('click', () => {
      navigateGridCardCheckToIndex(normalizeGridCardCheckState(gridCardCheckState).currentIndex - 1);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-choice')?.addEventListener('click', () => {
      openGridCardCheckChoiceDialog();
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-next')?.addEventListener('click', () => {
      navigateGridCardCheckToIndex(normalizeGridCardCheckState(gridCardCheckState).currentIndex + 1);
    }, { capture: true });
    gridCardCheckNavEl = nav;
    return nav;
  }

  function syncGridCardCheckNavigation() {
    if (!isPyramidExtensionPage() || !isExtensionUiSettingEnabled('idCardCheckTools')) {
      removeGridCardCheckNavigation();
      return;
    }
    const iframe = getGridCardCheckIframe();
    const dialog = iframe instanceof HTMLIFrameElement ? iframe.closest('.ui-dialog') : null;
    if (!(iframe instanceof HTMLIFrameElement) || !(dialog instanceof HTMLElement)) {
      removeGridCardCheckNavigation();
      return;
    }

    const state = syncGridCardCheckStateFromModal();
    if (!state.edocIds.length) {
      removeGridCardCheckNavigation();
      return;
    }

    const nav = ensureGridCardCheckNavigationElement();
    const titlebar = dialog.querySelector('.ui-dialog-titlebar');
    const content = iframe.closest('.ui-dialog-content');
    if (titlebar instanceof HTMLElement && nav.previousElementSibling !== titlebar) {
      titlebar.insertAdjacentElement('afterend', nav);
    } else if (!(titlebar instanceof HTMLElement) && content instanceof HTMLElement && nav.nextElementSibling !== content) {
      content.insertAdjacentElement('beforebegin', nav);
    }
    updateGridCardCheckNavigationButtons();
  }

  const debouncedSyncGridCardCheckNavigation = debounce(syncGridCardCheckNavigation, 120);

  function initGridCardCheckNavigation() {
    if (!isPyramidExtensionPage()) return;
    syncGridCardCheckNavigation();

    if (!gridCardCheckNavObserver) {
      gridCardCheckNavObserver = new MutationObserver(() => {
        debouncedSyncGridCardCheckNavigation();
      });
      observeWithRetry(
        gridCardCheckNavObserver,
        () => document.body || document.documentElement,
        { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src'] },
        120,
        100
      );
    }
  }

  function createExecutionAnalysisFunctionBlock() {
    const block = document.createElement('section');
    block.className = 'dup-execution-analysis-block';
    block.innerHTML = `
      <div class="dup-execution-analysis-block-title">Занести анализ исполнения</div>
      <div class="dup-execution-analysis-file-row">
        <input id="${EXECUTION_ANALYSIS_FILE_INPUT_ID}" class="dup-execution-analysis-file-input" type="file" accept=".xlsx,.csv,.tsv,.txt" hidden>
        <button type="button" class="dup-execution-analysis-select-file">Выбрать файл</button>
        <span class="dup-execution-analysis-file-name">Файл не выбран</span>
      </div>
      <div class="dup-execution-analysis-params" hidden>
        <label class="dup-execution-analysis-param">
          <span>Количество EdocID за раз</span>
          <input type="number" min="1" max="500" step="1" class="dup-execution-analysis-batch-size">
        </label>
        <label class="dup-execution-analysis-param">
          <span>Интервал проставления</span>
          <select class="dup-execution-analysis-interval"></select>
        </label>
        <button type="button" class="dup-execution-analysis-save-params">Сохранить параметры</button>
      </div>
      <div class="dup-execution-analysis-actions">
        <button type="button" class="dup-execution-analysis-start">Старт</button>
        <button type="button" class="dup-execution-analysis-finish">Завершить</button>
        <button type="button" class="dup-execution-analysis-manual">Вручную</button>
      </div>
      <div class="dup-execution-analysis-statusbar" hidden>
        <div class="dup-execution-analysis-status-text"></div>
        <div class="dup-execution-analysis-counter"></div>
        <div class="dup-execution-analysis-batch-info"></div>
      </div>
    `;

    const intervalSelect = block.querySelector('.dup-execution-analysis-interval');
    if (intervalSelect instanceof HTMLSelectElement) {
      EXECUTION_ANALYSIS_INTERVAL_OPTIONS.forEach((option) => {
        const optionEl = document.createElement('option');
        optionEl.value = String(option.value);
        optionEl.textContent = option.label;
        intervalSelect.appendChild(optionEl);
      });
    }

    executionAnalysisElements = {
      block,
      fileInput: block.querySelector(`#${EXECUTION_ANALYSIS_FILE_INPUT_ID}`),
      fileName: block.querySelector('.dup-execution-analysis-file-name'),
      paramsPanel: block.querySelector('.dup-execution-analysis-params'),
      batchInput: block.querySelector('.dup-execution-analysis-batch-size'),
      intervalSelect,
      startButton: block.querySelector('.dup-execution-analysis-start'),
      finishButton: block.querySelector('.dup-execution-analysis-finish'),
      manualButton: block.querySelector('.dup-execution-analysis-manual'),
      statusBar: block.querySelector('.dup-execution-analysis-statusbar'),
      statusText: block.querySelector('.dup-execution-analysis-status-text'),
      counter: block.querySelector('.dup-execution-analysis-counter'),
      batchInfo: block.querySelector('.dup-execution-analysis-batch-info')
    };

    const selectFileButton = block.querySelector('.dup-execution-analysis-select-file');
    selectFileButton?.addEventListener('click', () => {
      if (executionAnalysisElements.fileInput instanceof HTMLInputElement) {
        executionAnalysisElements.fileInput.click();
      }
    }, { capture: true });
    executionAnalysisElements.fileInput?.addEventListener('change', (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      const file = input && input.files && input.files[0] ? input.files[0] : null;
      if (file) void handleExecutionAnalysisFileSelected(file);
    }, { capture: true });
    executionAnalysisElements.startButton?.addEventListener('click', () => {
      void startOrPauseExecutionAnalysis();
    }, { capture: true });
    executionAnalysisElements.finishButton?.addEventListener('click', () => {
      void finishExecutionAnalysisProcess();
    }, { capture: true });
    executionAnalysisElements.manualButton?.addEventListener('click', () => {
      openExecutionAnalysisManualDialog();
    }, { capture: true });
    block.querySelector('.dup-execution-analysis-save-params')?.addEventListener('click', () => {
      void saveExecutionAnalysisParamsFromUi();
    }, { capture: true });

    syncExecutionAnalysisControls();
    return block;
  }

  function syncExtensionUiSettingsPanelState() {
    if (!(extensionUiSettingsPanelEl instanceof HTMLElement)) return;

    EXTENSION_UI_SETTING_DEFS.forEach((definition) => {
      const input = extensionUiSettingsPanelEl.querySelector(`input[${EXTENSION_UI_SETTINGS_INPUT_ATTR}="${definition.key}"]`);
      if (input instanceof HTMLInputElement) {
        input.checked = isExtensionUiSettingEnabled(definition.key);
        input.disabled = isExtensionUiSettingLocked(definition.key);
        input.title = isExtensionUiSettingLocked(definition.key)
          ? 'Состояние зафиксировано в extension_ui_config.js'
          : '';
      }

      const settingItem = input instanceof HTMLElement
        ? input.closest(`.${EXTENSION_UI_SETTINGS_ITEM_CLASS}`)
        : null;
      if (settingItem instanceof HTMLElement) {
        settingItem.classList.toggle('is-locked', isExtensionUiSettingLocked(definition.key));
      }
    });
  }

  function closeExtensionUiSettingsPanel() {
    if (extensionUiSettingsOverlayEl instanceof HTMLElement) {
      extensionUiSettingsOverlayEl.hidden = true;
    }
    if (extensionUiSettingsPanelEl instanceof HTMLElement) {
      extensionUiSettingsPanelEl.hidden = true;
    }
  }

  function ensureExtensionUiSettingsPanel() {
    if (extensionUiSettingsOverlayEl instanceof HTMLElement && extensionUiSettingsPanelEl instanceof HTMLElement) {
      syncExtensionUiSettingsPanelState();
      return extensionUiSettingsPanelEl;
    }

    const host = document.body || document.documentElement;
    if (!(host instanceof HTMLElement)) return null;

    const existingOverlay = document.getElementById(EXTENSION_UI_SETTINGS_OVERLAY_ID);
    if (existingOverlay instanceof HTMLElement) {
      extensionUiSettingsOverlayEl = existingOverlay;
    }

    const existingPanel = document.getElementById(EXTENSION_UI_SETTINGS_PANEL_ID);
    if (existingPanel instanceof HTMLElement) {
      extensionUiSettingsPanelEl = existingPanel;
      syncExtensionUiSettingsPanelState();
      return existingPanel;
    }

    ensureExtensionUiSettingsStyle(document);

    const overlay = document.createElement('div');
    overlay.id = EXTENSION_UI_SETTINGS_OVERLAY_ID;
    overlay.className = EXTENSION_UI_SETTINGS_OVERLAY_CLASS;
    overlay.hidden = true;
    overlay.addEventListener('click', () => closeExtensionUiSettingsPanel(), { capture: true });

    const panel = document.createElement('section');
    panel.id = EXTENSION_UI_SETTINGS_PANEL_ID;
    panel.className = EXTENSION_UI_SETTINGS_PANEL_CLASS;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Меню расширения');

    const header = document.createElement('div');
    header.className = 'dup-extension-ui-settings-header';
    header.innerHTML = `
      <div class="dup-extension-ui-settings-heading">
        <div class="dup-extension-ui-settings-heading-title">Меню расширения</div>
        <div class="dup-extension-ui-settings-heading-hint">${EXTENSION_UI_SETTINGS_HINT_TEXT}</div>
      </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'dup-extension-ui-settings-close';
    closeButton.setAttribute('aria-label', 'Закрыть настройки элементов расширения');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => closeExtensionUiSettingsPanel(), { capture: true });
    header.appendChild(closeButton);

    const tabs = document.createElement('div');
    tabs.className = 'dup-extension-ui-settings-tabs';
    const functionsTab = document.createElement('button');
    functionsTab.type = 'button';
    functionsTab.className = 'dup-extension-ui-settings-tab is-active';
    functionsTab.dataset.tab = 'functions';
    functionsTab.textContent = 'Функции';
    const settingsTab = document.createElement('button');
    settingsTab.type = 'button';
    settingsTab.className = 'dup-extension-ui-settings-tab';
    settingsTab.dataset.tab = 'settings';
    settingsTab.textContent = 'Настройки';
    tabs.append(functionsTab, settingsTab);

    const functionsPane = document.createElement('div');
    functionsPane.className = 'dup-extension-ui-settings-pane is-active';
    functionsPane.dataset.pane = 'functions';
    functionsPane.appendChild(createIdCardCheckFunctionBlock());
    functionsPane.appendChild(createExecutionAnalysisFunctionBlock());

    const settingsPane = document.createElement('div');
    settingsPane.className = 'dup-extension-ui-settings-pane';
    settingsPane.dataset.pane = 'settings';

    const list = document.createElement('div');
    list.className = 'dup-extension-ui-settings-list';

    EXTENSION_UI_SETTING_DEFS.forEach((definition) => {
      const label = document.createElement('label');
      label.className = EXTENSION_UI_SETTINGS_ITEM_CLASS;

      const textBlock = document.createElement('span');
      textBlock.className = 'dup-extension-ui-settings-text';

      const title = document.createElement('span');
      title.className = EXTENSION_UI_SETTINGS_TITLE_CLASS;
      title.textContent = definition.label;

      const description = document.createElement('span');
      description.className = EXTENSION_UI_SETTINGS_DESCRIPTION_CLASS;
      description.textContent = definition.description;

      textBlock.append(title, description);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = isExtensionUiSettingEnabled(definition.key);
      input.setAttribute(EXTENSION_UI_SETTINGS_INPUT_ATTR, definition.key);
      input.setAttribute('aria-label', definition.label);

      label.append(textBlock, input);
      list.appendChild(label);
    });

    settingsPane.appendChild(list);

    list.addEventListener('change', (event) => {
      const input = event.target instanceof HTMLInputElement
        ? event.target
        : null;
      if (!input) return;

      const settingKey = String(input.getAttribute(EXTENSION_UI_SETTINGS_INPUT_ATTR) || '').trim();
      const definition = EXTENSION_UI_SETTING_DEF_BY_KEY[settingKey];
      if (!definition) return;
      if (isExtensionUiSettingLocked(definition.key)) {
        syncExtensionUiSettingsPanelState();
        return;
      }

      extensionUiVisibilitySettings = {
        ...extensionUiVisibilitySettings,
        [definition.key]: input.checked
      };
      applyExtensionUiVisibilitySettings('panel-change');
      chrome.storage.local.set({ [definition.storageKey]: input.checked });
    }, { capture: true });

    const footer = document.createElement('div');
    footer.className = 'dup-extension-ui-settings-footer';
    footer.textContent = 'Горячая клавиша: F2';

    tabs.addEventListener('click', (event) => {
      const tab = event.target instanceof HTMLElement
        ? event.target.closest('.dup-extension-ui-settings-tab')
        : null;
      if (!(tab instanceof HTMLButtonElement)) return;
      const tabName = String(tab.dataset.tab || '').trim();
      if (!tabName) return;
      Array.from(tabs.querySelectorAll('.dup-extension-ui-settings-tab')).forEach((item) => {
        item.classList.toggle('is-active', item === tab);
      });
      Array.from(panel.querySelectorAll('.dup-extension-ui-settings-pane')).forEach((pane) => {
        pane.classList.toggle('is-active', pane instanceof HTMLElement && pane.dataset.pane === tabName);
      });
    }, { capture: true });

    panel.append(header, tabs, functionsPane, settingsPane, footer);
    host.append(overlay, panel);

    extensionUiSettingsOverlayEl = overlay;
    extensionUiSettingsPanelEl = panel;
    syncExtensionUiSettingsPanelState();
    return panel;
  }

  function openExtensionUiSettingsPanel() {
    const panel = ensureExtensionUiSettingsPanel();
    if (!(panel instanceof HTMLElement)) return false;

    if (extensionUiSettingsOverlayEl instanceof HTMLElement) {
      extensionUiSettingsOverlayEl.hidden = false;
    }
    panel.hidden = false;
    syncExtensionUiSettingsPanelState();
    return true;
  }

  function toggleExtensionUiSettingsPanel() {
    const panel = ensureExtensionUiSettingsPanel();
    if (!(panel instanceof HTMLElement)) return false;

    if (panel.hidden) {
      return openExtensionUiSettingsPanel();
    }

    closeExtensionUiSettingsPanel();
    return false;
  }

  function installExtensionUiSettingsController() {
    try {
      window.__dupExtensionUiSettingsController = {
        openPanel() {
          return openExtensionUiSettingsPanel();
        },
        closePanel() {
          closeExtensionUiSettingsPanel();
          return false;
        },
        togglePanel() {
          return toggleExtensionUiSettingsPanel();
        },
        isPanelOpen() {
          return !!(extensionUiSettingsPanelEl instanceof HTMLElement && !extensionUiSettingsPanelEl.hidden);
        }
      };
    } catch (error) {
      // ignore
    }
  }

  function applyExtensionUiVisibilitySettings(_source) {
    collectAccessibleScreenshotDocuments().forEach((targetDocument) => {
      syncExtensionUiVisibilityForDocument(targetDocument);
    });

    if (!isExtensionUiSettingEnabled('stageJumpButtons')) {
      closeStageJumpActionMenu();
    }

    if (!isExtensionUiSettingEnabled('fsspGroupingToggle')) {
      detachFsspReestrGroupingToggle();
    } else if (isFsspReestrPage()) {
      ensureFsspReestrGroupingToggle();
    }

    syncDepartmentDropdownVisibility();

    syncExtensionUiSettingsPanelState();
  }

  function loadExtensionUiVisibilitySettings() {
    if (!isPyramidExtensionPage()) return;

    chrome.storage.local.get(EXTENSION_UI_SETTINGS_STORAGE_KEYS, (rawSettings) => {
      extensionUiVisibilitySettings = normalizeExtensionUiVisibilitySettings(rawSettings);
      applyExtensionUiVisibilitySettings('storage-init');
    });
  }

  function isExtensionUiSettingsHotkey(event) {
    if (!event) return false;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;

    const key = String(event.key || '');
    const code = String(event.code || '');
    const keyCode = Number(event.keyCode || event.which || 0);
    return key === 'F2' || code === 'F2' || keyCode === KEY_CODE_F2;
  }

  function handleExtensionUiSettingsHotkey(event) {
    if (!isPyramidExtensionPage()) return;
    if (!isExtensionUiSettingsHotkey(event)) return;

    suppressHotkeyEvent(event);
    if (event.type !== 'keydown' || event.repeat) return;
    toggleExtensionUiSettingsPanel();
  }

  function handleExtensionUiSettingsEscape(event) {
    if (!(extensionUiSettingsPanelEl instanceof HTMLElement) || extensionUiSettingsPanelEl.hidden) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const key = String(event.key || '');
    const code = String(event.code || '');
    const keyCode = Number(event.keyCode || event.which || 0);
    if (key !== 'Escape' && code !== 'Escape' && keyCode !== 27) return;

    suppressHotkeyEvent(event);
    if (event.type !== 'keydown' || event.repeat) return;
    closeExtensionUiSettingsPanel();
  }

  function initExtensionUiSettings() {
    if (!isPyramidExtensionPage()) return;
    installExtensionUiSettingsController();
    loadExtensionUiVisibilitySettings();
    void loadExecutionAnalysisStateAndParams();
    document.addEventListener('keydown', handleExtensionUiSettingsHotkey, true);
    document.addEventListener('keyup', handleExtensionUiSettingsHotkey, true);
    document.addEventListener('keydown', handleExtensionUiSettingsEscape, true);
    document.addEventListener('keyup', handleExtensionUiSettingsEscape, true);
  }

  function resolveDepartmentNavigationDirection(event) {
    if (!event) return 0;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return 0;

    const key = String(event.key || '');
    const code = String(event.code || '');
    const keyCode = Number(event.keyCode || event.which || 0);
    if (key === 'F3' || code === 'F3' || keyCode === KEY_CODE_F3) return -1;
    if (key === 'F4' || code === 'F4' || keyCode === KEY_CODE_F4) return 1;
    return 0;
  }

  function getDepartmentNavigationItems() {
    const dropdownContent = getDepartmentDropdownContents().find((content) => {
      return !!content.querySelector(`${SLOWSEARCH_CITIES_LINK_SELECTOR}.active`);
    }) || getDepartmentDropdownContents()[0] || null;
    if (!(dropdownContent instanceof HTMLElement)) return [];

    const departmentsMenu = dropdownContent.querySelector(DEPARTMENT_DROPDOWN_MENU_SELECTOR);
    if (!(departmentsMenu instanceof HTMLElement)) return [];

    return Array.from(departmentsMenu.children)
      .filter((item) => item instanceof HTMLLIElement)
      .map((item) => {
        const link = item.querySelector(SLOWSEARCH_CITIES_LINK_SELECTOR);
        if (!(link instanceof HTMLAnchorElement)) return null;
        return { item, link };
      })
      .filter((entry) => !!entry);
  }

  function isDepartmentNavigationItemVisible(entry, includeHidden) {
    if (!entry || !(entry.item instanceof HTMLElement)) return false;
    if (includeHidden) return true;
    return entry.item.getAttribute(DEPARTMENT_DROPDOWN_HIDDEN_ATTR) !== '1';
  }

  function buildDepartmentNavigationUrl(targetLink) {
    if (!(targetLink instanceof HTMLAnchorElement)) return '';
    const href = String(targetLink.getAttribute('href') || '').trim();
    if (!href) return '';

    try {
      const targetUrl = new URL(href, window.location.origin);
      const currentUrl = new URL(window.location.href);
      const depid = String(targetLink.getAttribute('data-depid') || '').trim();
      const currentMatch = String(currentUrl.pathname || '').match(/^(.*?\/login\/department\/)\d+(\/.*)?$/);
      const targetMatch = String(targetUrl.pathname || '').match(/^(.*?\/login\/department\/)\d+(\/.*)?$/);

      if (depid && currentMatch && targetMatch) {
        const currentSuffix = currentMatch[2] || '';
        targetUrl.pathname = `${targetMatch[1]}${depid}${currentSuffix}`;
      }

      if (!targetUrl.hash && currentUrl.hash) {
        targetUrl.hash = currentUrl.hash;
      }

      return targetUrl.toString();
    } catch (error) {
      return href;
    }
  }

  function navigateToDepartmentByHotkey(targetLink) {
    if (!(targetLink instanceof HTMLAnchorElement)) return false;
    const targetUrl = buildDepartmentNavigationUrl(targetLink);
    if (!targetUrl) return false;
    window.location.assign(targetUrl);
    return true;
  }

  function handleDepartmentNavigationHotkey(event) {
    const direction = resolveDepartmentNavigationDirection(event);
    if (!direction) return;
    if (event.defaultPrevented) return;
    if (event.type !== 'keydown' || event.repeat) return;
    if (!isPyramidExtensionPage()) return;
    if (isEditableInteractionTarget(event.target)) return;

    const items = getDepartmentNavigationItems();
    if (items.length === 0) return;

    const includeHidden = departmentDropdownShowHidden === true || !isDepartmentDropdownFilterEnabled();
    const currentIndex = items.findIndex((entry) => entry.link.classList.contains('active'));
    if (currentIndex < 0) return;

    let targetEntry = null;
    for (
      let nextIndex = currentIndex + direction;
      nextIndex >= 0 && nextIndex < items.length;
      nextIndex += direction
    ) {
      const candidate = items[nextIndex];
      if (isDepartmentNavigationItemVisible(candidate, includeHidden)) {
        targetEntry = candidate;
        break;
      }
    }
    if (!targetEntry) return;

    suppressHotkeyEvent(event);
    navigateToDepartmentByHotkey(targetEntry.link);
  }

  function initDepartmentNavigationHotkeys() {
    if (!isPyramidExtensionPage()) return;
    document.addEventListener('keydown', handleDepartmentNavigationHotkey, true);
  }

  function ensureScreenshotHideStyle(targetDocument) {
    const doc = targetDocument && typeof targetDocument.getElementById === 'function'
      ? targetDocument
      : document;
    if (doc.getElementById(SCREENSHOT_HIDE_STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = SCREENSHOT_HIDE_STYLE_ID;
    style.textContent = `
      html.${SCREENSHOT_MODE_CLASS} .${HIGHLIGHT_CLASS} {
        background-color: transparent !important;
        outline: none !important;
      }

      html.${SCREENSHOT_MODE_CLASS} .${FSSP_REESTR_DUPLICATE_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${FSSP_REESTR_STATUS_CLASS} {
        background-color: transparent !important;
        outline: none !important;
      }

      html.${SCREENSHOT_MODE_CLASS} .${EPGU_REQUESTS_DUPLICATE_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${EPGU_REQUESTS_FILL_CLASS} {
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
      html.${SCREENSHOT_MODE_CLASS} .spring-header-item,
      html.${SCREENSHOT_MODE_CLASS} #springSwitcher,
      html.${SCREENSHOT_MODE_CLASS} .material-switch-spring,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-seasonal-theme-settings-launcher,
      html.${SCREENSHOT_MODE_CLASS} .seasonal-theme-settings-header-item,
      html.${SCREENSHOT_MODE_CLASS} .seasonal-theme-settings-launcher,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-seasonal-theme-settings-overlay,
      html.${SCREENSHOT_MODE_CLASS} .seasonal-theme-settings-overlay,
      html.${SCREENSHOT_MODE_CLASS} .seasonal-theme-settings-panel,
      html.${SCREENSHOT_MODE_CLASS} .seasonal-theme-settings-element,
      html.${SCREENSHOT_MODE_CLASS} .my-super-btn,
      html.${SCREENSHOT_MODE_CLASS} #batch-inn-check-btn,
      html.${SCREENSHOT_MODE_CLASS} #inn-toast-container,
      html.${SCREENSHOT_MODE_CLASS} #inn-batch-modal-overlay,
      html.${SCREENSHOT_MODE_CLASS} .ny-snow-container,
      html.${SCREENSHOT_MODE_CLASS} .ny-garland-container,
      html.${SCREENSHOT_MODE_CLASS} .spring-petal-layer,
      html.${SCREENSHOT_MODE_CLASS} .spring-petal,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer-toggle,
      html.${SCREENSHOT_MODE_CLASS} .pyramid-stage-timer-toggle-btn,
      html.${SCREENSHOT_MODE_CLASS} #pyramid-stage-timer-abort,
      html.${SCREENSHOT_MODE_CLASS} .pyramid-stage-timer-abort-btn,
      html.${SCREENSHOT_MODE_CLASS} #dup-fsspreestr-grouping-toggle,
      html.${SCREENSHOT_MODE_CLASS} .${DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS},
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
      html.${SCREENSHOT_MODE_CLASS} .snowflake,
      html.${SCREENSHOT_MODE_CLASS} .spring-element,
      html.${SCREENSHOT_MODE_CLASS} .spring-petal {
        display: none !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function collectAccessibleScreenshotDocuments() {
    const docs = [];
    const seenDocs = new Set();

    function visitDocument(targetDocument) {
      if (!targetDocument || seenDocs.has(targetDocument)) return;
      seenDocs.add(targetDocument);
      docs.push(targetDocument);

      let frameNodes = [];
      try {
        frameNodes = Array.from(targetDocument.querySelectorAll('iframe, frame'));
      } catch (err) {
        frameNodes = [];
      }

      frameNodes.forEach((frameNode) => {
        try {
          const childDocument = frameNode && frameNode.contentDocument;
          if (childDocument) {
            visitDocument(childDocument);
          }
        } catch (err) {
          // ignore cross-origin frames
        }
      });
    }

    visitDocument(document);
    return docs;
  }

  function broadcastScreenshotMode(targetWindow, hidden, source) {
    const eventTarget = targetWindow && typeof targetWindow.dispatchEvent === 'function'
      ? targetWindow
      : window;
    try {
      const CustomEventCtor = typeof eventTarget.CustomEvent === 'function'
        ? eventTarget.CustomEvent
        : CustomEvent;
      eventTarget.dispatchEvent(new CustomEventCtor(SCREENSHOT_HIDE_EVENT, {
        detail: { hidden: !!hidden, source: source || 'unknown' }
      }));
    } catch (err) {
      // ignore
    }
  }

  function toggleSeasonalThemeForScreenshot(targetDocument, hidden) {
    const body = targetDocument && targetDocument.body;
    if (!body) return;

    if (hidden) {
      let themeState = screenshotThemeStateByDocument.get(targetDocument);
      if (!themeState) {
        const springWasActive = body.classList.contains('spring-active');
        const existingVariant = springWasActive
          ? Array.from(body.classList).find((className) =>
              String(className || '').indexOf('spring-variant-') === 0
            )
          : '';
        themeState = {
          newYearWasActive: body.classList.contains('ny-active'),
          springWasActive,
          springVariantClass: existingVariant || ''
        };
        screenshotThemeStateByDocument.set(targetDocument, themeState);
      }

      if (themeState.newYearWasActive) {
        body.classList.remove('ny-active');
      }

      if (themeState.springWasActive) {
        body.classList.remove('spring-active');
        if (themeState.springVariantClass) {
          body.classList.remove(themeState.springVariantClass);
        }
      }
      return;
    }

    const themeState = screenshotThemeStateByDocument.get(targetDocument);
    if (!themeState) return;

    if (themeState.newYearWasActive) {
      body.classList.add('ny-active');
    }

    if (themeState.springWasActive) {
      body.classList.add('spring-active');
      if (themeState.springVariantClass) {
        body.classList.add(themeState.springVariantClass);
      }
    }

    screenshotThemeStateByDocument.delete(targetDocument);
  }

  function syncScreenshotModeForDocument(targetDocument, hidden, source) {
    const doc = targetDocument;
    const root = doc && doc.documentElement;
    if (!root) return;

    ensureScreenshotHideStyle(doc);
    ensureExtensionUiSettingsStyle(doc);

    if (hidden) {
      toggleSeasonalThemeForScreenshot(doc, true);
      root.classList.add(SCREENSHOT_MODE_CLASS);
    } else {
      root.classList.remove(SCREENSHOT_MODE_CLASS);
      toggleSeasonalThemeForScreenshot(doc, false);
    }

    broadcastScreenshotMode(doc.defaultView, hidden, source);
  }

  function applyScreenshotModeState(source) {
    const nextState = screenshotManualModeIsActive || screenshotAutoHideIsActive;
    if (nextState === screenshotModeIsActive && !nextState) return;

    screenshotModeIsActive = nextState;

    collectAccessibleScreenshotDocuments().forEach((targetDocument) => {
      syncScreenshotModeForDocument(targetDocument, nextState, source);
    });
  }

  function setScreenshotAutoHideState(hidden, source) {
    const nextState = !!hidden;
    if (nextState === screenshotAutoHideIsActive) return;
    screenshotAutoHideIsActive = nextState;
    if (!nextState) {
      screenshotAutoHideDurationMs = SCREENSHOT_HIDE_DURATION_MS;
    }
    applyScreenshotModeState(source);
  }

  function setScreenshotManualModeState(hidden, source) {
    const nextState = !!hidden;
    if (nextState === screenshotManualModeIsActive) return;
    screenshotManualModeIsActive = nextState;
    applyScreenshotModeState(source);
  }

  function installScreenshotModeController() {
    try {
      window.__dupScreenshotModeController = {
        toggleManualMode(source) {
          const nextState = !screenshotManualModeIsActive;
          setScreenshotManualModeState(nextState, source || 'manual-toggle');
          return nextState;
        },
        setManualMode(hidden, source) {
          const nextState = !!hidden;
          setScreenshotManualModeState(nextState, source || 'manual-set');
          return nextState;
        },
        isManualModeActive() {
          return screenshotManualModeIsActive;
        },
        isScreenshotModeActive() {
          return screenshotModeIsActive;
        }
      };

      if (typeof window.__dupPendingScreenshotManualMode === 'boolean') {
        const pendingManualMode = window.__dupPendingScreenshotManualMode;
        delete window.__dupPendingScreenshotManualMode;
        setScreenshotManualModeState(pendingManualMode, 'pending-manual-mode');
      }
    } catch (err) {
      // ignore
    }
  }

  function resolveScreenshotHideDurationMs(triggerKey) {
    return triggerKey === 'PrintScreen'
      ? SCREENSHOT_HIDE_PRINT_SCREEN_DURATION_MS
      : SCREENSHOT_HIDE_DURATION_MS;
  }

  function resolveScreenshotHideOnBlurDurationMs() {
    return Math.max(
      screenshotAutoHideDurationMs,
      screenshotAutoHideDurationMs >= SCREENSHOT_HIDE_PRINT_SCREEN_DURATION_MS
        ? SCREENSHOT_HIDE_PRINT_SCREEN_ON_BLUR_DURATION_MS
        : SCREENSHOT_HIDE_ON_BLUR_DURATION_MS
    );
  }

  function scheduleScreenshotHide(source, triggerKey) {
    ensureScreenshotHideStyle();
    screenshotAutoHideDurationMs = resolveScreenshotHideDurationMs(triggerKey);
    setScreenshotAutoHideState(true, source);

    if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
    screenshotHideTimer = setTimeout(() => {
      screenshotHideTimer = null;
      setScreenshotAutoHideState(false, 'timeout');
    }, screenshotAutoHideDurationMs);
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

  function isScreenshotToggleHotkey(event) {
    if (!event) return false;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;

    const key = String(event.key || '');
    const code = String(event.code || '');
    const keyCode = Number(event.keyCode || event.which || 0);
    return key === 'F1' || code === 'F1' || keyCode === KEY_CODE_F1;
  }

  function suppressHotkeyEvent(event) {
    if (!event) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function handleScreenshotToggleHotkey(event) {
    if (!isScreenshotToggleHotkey(event)) return;
    if (event.defaultPrevented) return;

    suppressHotkeyEvent(event);
    if (event.type !== 'keydown' || event.repeat) return;

    setScreenshotManualModeState(!screenshotManualModeIsActive, 'hotkey:F1');
  }

  function handleScreenshotHotkey(event) {
    const triggerKey = resolveScreenshotTriggerKey(event);
    if (!triggerKey) return;
    if (event.type === 'keydown' && event.repeat) return;

    const nowMs = Date.now();
    if ((nowMs - lastScreenshotTriggerAtMs) < SCREENSHOT_THROTTLE_MS) return;
    lastScreenshotTriggerAtMs = nowMs;
    scheduleScreenshotHide(`hotkey:${triggerKey}:${event.type}`, triggerKey);
  }

  function handleScreenshotFrameBridgeMessage(event) {
    const data = event && event.data && typeof event.data === 'object'
      ? event.data
      : null;
    if (!data || data.type !== SCREENSHOT_FRAME_BRIDGE_MESSAGE) return;
    if (event.source === window) return;

    const source = typeof data.source === 'string' && data.source
      ? data.source
      : 'iframe-hotkey';
    const command = String(data.command || '');
    const triggerKey = typeof data.triggerKey === 'string'
      ? data.triggerKey
      : '';

    if (command === 'toggle-ui-settings') {
      toggleExtensionUiSettingsPanel();
      return;
    }

    if (command === 'toggle-manual') {
      setScreenshotManualModeState(!screenshotManualModeIsActive, source);
      return;
    }

    if (command !== 'schedule-autohide') return;

    const nowMs = Date.now();
    if ((nowMs - lastScreenshotTriggerAtMs) < SCREENSHOT_THROTTLE_MS) return;
    lastScreenshotTriggerAtMs = nowMs;
    scheduleScreenshotHide(source, triggerKey);
  }

  function initScreenshotHideMode() {
    ensureScreenshotHideStyle();
    installScreenshotModeController();
    document.addEventListener('keydown', handleScreenshotToggleHotkey, true);
    document.addEventListener('keyup', handleScreenshotToggleHotkey, true);
    document.addEventListener('keydown', handleScreenshotHotkey, true);
    document.addEventListener('keyup', handleScreenshotHotkey, true);
    window.addEventListener('message', handleScreenshotFrameBridgeMessage, true);
    window.addEventListener('blur', () => {
      if (!screenshotAutoHideIsActive) return;
      if (screenshotHideTimer) clearTimeout(screenshotHideTimer);
      screenshotHideTimer = setTimeout(() => {
        screenshotHideTimer = null;
        setScreenshotAutoHideState(false, 'blur-timeout');
      }, resolveScreenshotHideOnBlurDurationMs());
    });
  }

  // --- Логика подсветки дублей ---

  const colorPalette = [
    '#A9D2FF', '#C6B6FF', '#9FDDE8', '#FFD6AE', '#E7B6D7',
    '#BCC7D2', '#AFC4FF', '#D5B7E8', '#F4BECA', '#B8C1E6',
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
        background: colorPalette[colorIndex]
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

  function normalizeCreateDateForDuplicate(rawValue) {
    const normalized = String(rawValue || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const fullMatch = normalized.match(/^(\d{2}-\d{2}-\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/);
    if (fullMatch && fullMatch[1]) {
      return fullMatch[1];
    }

    const datePrefixMatch = normalized.match(/^(\d{2}-\d{2}-\d{4})\b/);
    if (datePrefixMatch && datePrefixMatch[1]) {
      return datePrefixMatch[1];
    }

    return normalized;
  }

  function isFsspReestrPage() {
    const pathname = String(window.location.pathname || '').toLowerCase();
    return pathname.includes(FSSP_REESTR_PATH_PART);
  }

  function normalizeFsspReestrCellText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isFsspReestrGroupingEnabled() {
    try {
      const rawValue = window.localStorage.getItem(FSSP_REESTR_GROUPING_STORAGE_KEY);
      if (rawValue === '0' || rawValue === 'false') return false;
      if (rawValue === '1' || rawValue === 'true') return true;
    } catch (error) {
      // ignore
    }
    return true;
  }

  function saveFsspReestrGroupingPreference(isEnabled) {
    try {
      window.localStorage.setItem(FSSP_REESTR_GROUPING_STORAGE_KEY, isEnabled ? '1' : '0');
    } catch (error) {
      // ignore
    }
  }

  function dispatchFsspReestrGroupingChange(isEnabled) {
    try {
      window.dispatchEvent(new CustomEvent(FSSP_REESTR_GROUPING_CHANGE_EVENT, {
        detail: { enabled: !!isEnabled }
      }));
    } catch (error) {
      // ignore
    }
  }

  function ensureFsspReestrGroupingStyle() {
    if (document.getElementById(FSSP_REESTR_GROUPING_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = FSSP_REESTR_GROUPING_STYLE_ID;
    style.textContent = `
      .ui-jqgrid-titlebar.${FSSP_REESTR_GROUPING_HOST_CLASS} {
        padding-left: calc(var(${FSSP_REESTR_GROUPING_HOST_LEFT_VAR}, 0px) + 0.4em) !important;
      }

      #${FSSP_REESTR_GROUPING_TOGGLE_ID} {
        position: absolute;
        top: 50%;
        left: 6px;
        transform: translateY(-50%);
        z-index: 4;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 1px 2px;
        font-size: 12px;
        line-height: 1.1;
        font-weight: 500;
        white-space: nowrap;
        color: inherit;
        cursor: pointer;
        user-select: none;
        text-indent: 0 !important;
        background: transparent !important;
      }

      #${FSSP_REESTR_GROUPING_TOGGLE_INPUT_ID} {
        width: 13px;
        height: 13px;
        margin: 0;
        cursor: pointer;
      }

      #${FSSP_REESTR_GROUPING_TOGGLE_ID} .dup-fsspreestr-grouping-label {
        white-space: nowrap;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function getFsspReestrGroupingHost() {
    return document.querySelector('#gbox_list .ui-jqgrid-titlebar')
      || document.querySelector('#gview_list .ui-jqgrid-titlebar');
  }

  function clearFsspReestrGroupingHostState(host) {
    if (!(host instanceof HTMLElement)) return;
    host.classList.remove(FSSP_REESTR_GROUPING_HOST_CLASS);
    host.style.removeProperty(FSSP_REESTR_GROUPING_HOST_LEFT_VAR);
  }

  function detachFsspReestrGroupingToggle() {
    const toggle = document.getElementById(FSSP_REESTR_GROUPING_TOGGLE_ID);
    if (toggle instanceof HTMLElement) {
      toggle.remove();
    }
    if (fsspReestrGroupingCurrentHost instanceof HTMLElement) {
      clearFsspReestrGroupingHostState(fsspReestrGroupingCurrentHost);
      fsspReestrGroupingCurrentHost = null;
    }
  }

  function buildFsspReestrGroupingToggleElement() {
    const label = document.createElement('label');
    label.id = FSSP_REESTR_GROUPING_TOGGLE_ID;
    label.innerHTML = `
      <input id="${FSSP_REESTR_GROUPING_TOGGLE_INPUT_ID}" type="checkbox" />
      <span class="dup-fsspreestr-grouping-label">Сгруппировать дубликаты</span>
    `;

    const checkbox = label.querySelector(`#${FSSP_REESTR_GROUPING_TOGGLE_INPUT_ID}`);
    if (checkbox instanceof HTMLInputElement) {
      checkbox.addEventListener('change', function(event) {
        const target = event && event.target ? event.target : null;
        const isChecked = !!(target && target.checked);
        saveFsspReestrGroupingPreference(isChecked);
        dispatchFsspReestrGroupingChange(isChecked);
      }, { capture: true });
    }

    label.addEventListener('click', function(event) {
      if (event) event.stopPropagation();
    }, { capture: true });

    return label;
  }

  function ensureFsspReestrGroupingToggle() {
    if (!isFsspReestrPage() || !isExtensionUiSettingEnabled('fsspGroupingToggle')) {
      detachFsspReestrGroupingToggle();
      return;
    }

    const host = getFsspReestrGroupingHost();
    if (!(host instanceof HTMLElement)) return;

    ensureFsspReestrGroupingStyle();

    let toggle = document.getElementById(FSSP_REESTR_GROUPING_TOGGLE_ID);
    if (!(toggle instanceof HTMLElement)) {
      toggle = buildFsspReestrGroupingToggleElement();
    }

    if (toggle.parentElement !== host) {
      if (host.firstChild) {
        host.insertBefore(toggle, host.firstChild);
      } else {
        host.appendChild(toggle);
      }
    }

    if (fsspReestrGroupingCurrentHost instanceof HTMLElement && fsspReestrGroupingCurrentHost !== host) {
      clearFsspReestrGroupingHostState(fsspReestrGroupingCurrentHost);
    }

    host.classList.add(FSSP_REESTR_GROUPING_HOST_CLASS);
    fsspReestrGroupingCurrentHost = host;

    const checkbox = toggle.querySelector(`#${FSSP_REESTR_GROUPING_TOGGLE_INPUT_ID}`);
    const enabled = isFsspReestrGroupingEnabled();
    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = enabled;
      checkbox.setAttribute('aria-label', 'Сгруппировать дубликаты');
    }

    const tooltipText = enabled
      ? 'Сгруппировать дубликаты (включено)'
      : 'Сгруппировать дубликаты (выключено)';
    toggle.setAttribute('title', tooltipText);
    toggle.setAttribute('aria-label', tooltipText);

    const toggleRect = toggle.getBoundingClientRect();
    const toggleWidth = toggleRect && Number.isFinite(toggleRect.width) && toggleRect.width > 1
      ? Math.ceil(toggleRect.width)
      : 170;
    host.style.setProperty(FSSP_REESTR_GROUPING_HOST_LEFT_VAR, `${toggleWidth + 10}px`);
  }

  function clearFsspReestrHighlights() {
    document.querySelectorAll(`.${FSSP_REESTR_DUPLICATE_CLASS}`).forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.backgroundColor = '';
      cell.style.outline = '';
      cell.classList.remove(FSSP_REESTR_DUPLICATE_CLASS);
    });

    document.querySelectorAll(`.${FSSP_REESTR_STATUS_CLASS}`).forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.backgroundColor = '';
      cell.classList.remove(FSSP_REESTR_STATUS_CLASS);
    });

    fsspReestrDuplicateColorMap.clear();
    fsspReestrDuplicateColorIndex = 0;
  }

  const fsspReestrDuplicateColorMap = new Map();
  let fsspReestrDuplicateColorIndex = 0;

  function getFsspReestrDuplicateColorByKey(key) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return FSSP_REESTR_DUPLICATE_COLOR_PALETTE[0];
    }

    if (!fsspReestrDuplicateColorMap.has(normalizedKey)) {
      const nextColor = FSSP_REESTR_DUPLICATE_COLOR_PALETTE[
        fsspReestrDuplicateColorIndex % FSSP_REESTR_DUPLICATE_COLOR_PALETTE.length
      ];
      fsspReestrDuplicateColorMap.set(normalizedKey, nextColor);
      fsspReestrDuplicateColorIndex += 1;
    }
    return fsspReestrDuplicateColorMap.get(normalizedKey);
  }

  function markFsspReestrDuplicateCell(cell, colorPair) {
    if (!(cell instanceof HTMLElement)) return;
    cell.classList.add(FSSP_REESTR_DUPLICATE_CLASS);
    cell.style.backgroundColor = colorPair && colorPair.background ? colorPair.background : '';
    cell.style.outline = '';
  }

  function normalizeFsspReestrStatusKey(value) {
    const normalized = normalizeFsspReestrCellText(value).toLowerCase();
    if (normalized.startsWith('проведен (нет данных')) {
      return 'проведен (нет данных)';
    }
    return normalized;
  }

  function applyFsspReestrStatusColor(statusCell) {
    if (!(statusCell instanceof HTMLElement)) return;

    const statusText = normalizeFsspReestrStatusKey(getSmartValue(statusCell));
    const statusColor = FSSP_REESTR_STATUS_COLOR_BY_TEXT[statusText];
    if (!statusColor) return;

    statusCell.classList.add(FSSP_REESTR_STATUS_CLASS);
    statusCell.style.backgroundColor = statusColor;
  }

  function shouldSkipFsspReestrDuplicateByClaimant(pairRows) {
    if (!Array.isArray(pairRows) || pairRows.length < 2) return false;

    const claimantValues = pairRows.map((pairRow) => (
      normalizeFsspReestrCellText(pairRow && pairRow.claimantName ? pairRow.claimantName : '')
    ));
    const allFilled = claimantValues.every((value) => value.length > 0);
    if (!allFilled) return false;

    const uniqueClaimants = new Set(claimantValues);
    return uniqueClaimants.size === claimantValues.length;
  }

  function parseFsspReestrSortIdValue(rawId) {
    const normalized = normalizeFsspReestrCellText(rawId);
    if (!normalized) return Number.NEGATIVE_INFINITY;

    const digitsOnly = normalized.replace(/\D+/g, '');
    if (digitsOnly) {
      const parsed = Number.parseInt(digitsOnly, 10);
      if (Number.isFinite(parsed)) return parsed;
    }

    return Number.NEGATIVE_INFINITY;
  }

  function sortFsspReestrPairRowsByIdDesc(pairRows) {
    if (!Array.isArray(pairRows)) return [];
    return pairRows
      .slice()
      .sort((leftPair, rightPair) => {
        const leftSortId = Number.isFinite(leftPair && leftPair.rowIdSortValue)
          ? leftPair.rowIdSortValue
          : Number.NEGATIVE_INFINITY;
        const rightSortId = Number.isFinite(rightPair && rightPair.rowIdSortValue)
          ? rightPair.rowIdSortValue
          : Number.NEGATIVE_INFINITY;
        if (leftSortId !== rightSortId) return rightSortId - leftSortId;

        const leftRowIdText = normalizeFsspReestrCellText(leftPair && leftPair.rowIdText ? leftPair.rowIdText : '');
        const rightRowIdText = normalizeFsspReestrCellText(rightPair && rightPair.rowIdText ? rightPair.rowIdText : '');
        if (leftRowIdText !== rightRowIdText) {
          return rightRowIdText.localeCompare(leftRowIdText, 'ru', { numeric: true, sensitivity: 'base' });
        }

        const leftIndex = Number.isFinite(leftPair && leftPair.originalIndex) ? leftPair.originalIndex : Number.MAX_SAFE_INTEGER;
        const rightIndex = Number.isFinite(rightPair && rightPair.originalIndex) ? rightPair.originalIndex : Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      });
  }

  function getFsspReestrRowOriginalIndex(row, fallbackIndex) {
    if (!(row instanceof HTMLElement)) {
      return Number.isFinite(fallbackIndex) ? fallbackIndex : Number.MAX_SAFE_INTEGER;
    }

    const rawStored = String(row.getAttribute(FSSP_REESTR_ORIGINAL_INDEX_ATTR) || '').trim();
    if (/^\d+$/.test(rawStored)) {
      const parsed = Number.parseInt(rawStored, 10);
      if (Number.isFinite(parsed)) return parsed;
    }

    return Number.isFinite(fallbackIndex) ? fallbackIndex : Number.MAX_SAFE_INTEGER;
  }

  function rememberFsspReestrRowsOriginalOrder(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    rows.forEach((row, index) => {
      if (!(row instanceof HTMLElement)) return;
      if (row.hasAttribute(FSSP_REESTR_ORIGINAL_INDEX_ATTR)) return;
      row.setAttribute(FSSP_REESTR_ORIGINAL_INDEX_ATTR, String(index));
    });
  }

  function clearFsspReestrRowsOriginalOrder(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      row.removeAttribute(FSSP_REESTR_ORIGINAL_INDEX_ATTR);
    });
  }

  function restoreFsspReestrRowsOriginalOrder(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return rows;

    const sortableRows = rows.filter((row) => row instanceof HTMLTableRowElement);
    if (sortableRows.length !== rows.length) return rows;
    if (!sortableRows.every((row) => row.hasAttribute(FSSP_REESTR_ORIGINAL_INDEX_ATTR))) return rows;

    const restoredRows = sortableRows
      .slice()
      .sort((leftRow, rightRow) => {
        const leftIndex = getFsspReestrRowOriginalIndex(leftRow, Number.MAX_SAFE_INTEGER);
        const rightIndex = getFsspReestrRowOriginalIndex(rightRow, Number.MAX_SAFE_INTEGER);
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return 0;
      });

    const hasDifference = sortableRows.some((row, index) => row !== restoredRows[index]);
    if (!hasDifference) return rows;

    const tbody = sortableRows[0] && sortableRows[0].parentElement;
    if (!(tbody instanceof HTMLElement)) return rows;

    const fragment = document.createDocumentFragment();
    restoredRows.forEach((row) => fragment.appendChild(row));
    tbody.appendChild(fragment);
    return restoredRows;
  }

  function reorderFsspReestrRowsByDuplicateGroups(rows, duplicateGroups) {
    if (!Array.isArray(rows) || rows.length < 2) return rows;
    if (!Array.isArray(duplicateGroups) || duplicateGroups.length === 0) return rows;

    const duplicateRowSet = new Set();
    const groupedRowsByFirstIndex = new Map();

    duplicateGroups.forEach((groupRows) => {
      if (!Array.isArray(groupRows) || groupRows.length < 2) return;

      const validPairs = groupRows.filter((pair) => pair && pair.row instanceof HTMLTableRowElement);
      if (validPairs.length < 2) return;

      let firstIndex = Number.POSITIVE_INFINITY;
      validPairs.forEach((pair) => {
        duplicateRowSet.add(pair.row);
        if (Number.isFinite(pair.originalIndex) && pair.originalIndex < firstIndex) {
          firstIndex = pair.originalIndex;
        }
      });

      if (!Number.isFinite(firstIndex)) return;
      groupedRowsByFirstIndex.set(firstIndex, validPairs.map((pair) => pair.row));
    });

    if (!duplicateRowSet.size || !groupedRowsByFirstIndex.size) return rows;

    const reorderedRows = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!(row instanceof HTMLTableRowElement)) continue;

      if (duplicateRowSet.has(row)) {
        if (groupedRowsByFirstIndex.has(index)) {
          reorderedRows.push(...groupedRowsByFirstIndex.get(index));
        }
        continue;
      }

      reorderedRows.push(row);
    }

    if (reorderedRows.length !== rows.length) return rows;

    const hasDifference = rows.some((row, index) => row !== reorderedRows[index]);
    if (!hasDifference) return rows;

    const tbody = rows[0] && rows[0].parentElement;
    if (!(tbody instanceof HTMLElement)) return rows;

    const fragment = document.createDocumentFragment();
    reorderedRows.forEach((row) => fragment.appendChild(row));
    tbody.appendChild(fragment);

    return reorderedRows;
  }

  function updateFsspReestrVisibleRowNumbers(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    rows.forEach((row, index) => {
      if (!(row instanceof HTMLTableRowElement)) return;
      const rowNumberCell = row.querySelector('td[aria-describedby="list_rn"], td.jqgrid-rownum');
      if (!(rowNumberCell instanceof HTMLElement)) return;
      rowNumberCell.textContent = String(index + 1);
    });
  }

  function applyFsspReestrPermanentHighlights() {
    if (!isFsspReestrPage()) {
      detachFsspReestrGroupingToggle();
      clearFsspReestrHighlights();
      return;
    }

    ensureFsspReestrGroupingToggle();
    const groupingEnabled = isFsspReestrGroupingEnabled();
    clearFsspReestrHighlights();

    const rows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
    if (groupingEnabled) {
      rememberFsspReestrRowsOriginalOrder(rows);
    }

    const duplicatePairs = new Map();

    rows.forEach((row, rowIndex) => {
      if (!(row instanceof HTMLElement)) return;

      const fileNameCell = row.querySelector('td[aria-describedby="list_FileName"]');
      const createDateCell = row.querySelector('td[aria-describedby="list_CreateDate"]');
      const typeNameCell = row.querySelector('td[aria-describedby="list_TypeName"]');
      const statusCell = row.querySelector('td[aria-describedby="list_StatusName"]');
      const idCell = row.querySelector('td[aria-describedby="list_Id"]');
      const claimantNameCell = row.querySelector('td[aria-describedby="list_ClaimantName"]');

      if (statusCell) {
        applyFsspReestrStatusColor(statusCell);
      }

      if (
        !(fileNameCell instanceof HTMLElement) ||
        !(createDateCell instanceof HTMLElement) ||
        !(typeNameCell instanceof HTMLElement)
      ) return;

      const fileName = normalizeFsspReestrCellText(getSmartValue(fileNameCell));
      const createDate = normalizeFsspReestrCellText(getSmartValue(createDateCell));
      const typeName = normalizeFsspReestrCellText(getSmartValue(typeNameCell));
      const rowIdText = idCell ? normalizeFsspReestrCellText(getSmartValue(idCell)) : '';
      const rowIdSortValue = parseFsspReestrSortIdValue(rowIdText);
      const claimantName = claimantNameCell ? normalizeFsspReestrCellText(getSmartValue(claimantNameCell)) : '';
      if (!fileName || !createDate || !typeName) return;

      const pairKey = `${fileName}|||${createDate}|||${typeName}`;
      if (!duplicatePairs.has(pairKey)) {
        duplicatePairs.set(pairKey, []);
      }
      duplicatePairs.get(pairKey).push({
        row,
        originalIndex: getFsspReestrRowOriginalIndex(row, rowIndex),
        fileNameCell,
        rowIdText,
        rowIdSortValue,
        claimantName
      });
    });

    const duplicateGroupsForReorder = [];
    duplicatePairs.forEach((pairRows, pairKey) => {
      if (!Array.isArray(pairRows) || pairRows.length < 2) return;
      if (shouldSkipFsspReestrDuplicateByClaimant(pairRows)) return;

      const orderedPairRows = groupingEnabled
        ? sortFsspReestrPairRowsByIdDesc(pairRows)
        : pairRows.slice().sort((leftPair, rightPair) => leftPair.originalIndex - rightPair.originalIndex);

      if (orderedPairRows.length < 2) return;

      if (groupingEnabled) {
        duplicateGroupsForReorder.push(orderedPairRows);
      }

      const colors = getFsspReestrDuplicateColorByKey(pairKey);
      orderedPairRows.forEach((pair) => {
        markFsspReestrDuplicateCell(pair.fileNameCell, colors);
      });
    });

    if (groupingEnabled) {
      const finalRows = reorderFsspReestrRowsByDuplicateGroups(rows, duplicateGroupsForReorder);
      updateFsspReestrVisibleRowNumbers(finalRows);
      return;
    }

    const restoredRows = restoreFsspReestrRowsOriginalOrder(rows);
    updateFsspReestrVisibleRowNumbers(restoredRows);
  }

  function isEpguRequestsPage() {
    const pathname = String(window.location.pathname || '').toLowerCase();
    return pathname.includes(EPGU_REQUESTS_PATH_PART);
  }

  function normalizeEpguRequestsCellText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  const epguRequestsDuplicateColorMap = new Map();
  let epguRequestsDuplicateColorIndex = 0;

  function clearEpguRequestsHighlights() {
    document.querySelectorAll(`.${EPGU_REQUESTS_DUPLICATE_CLASS}`).forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.backgroundColor = '';
      cell.style.outline = '';
      cell.classList.remove(EPGU_REQUESTS_DUPLICATE_CLASS);
    });

    document.querySelectorAll(`.${EPGU_REQUESTS_FILL_CLASS}`).forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.backgroundColor = '';
      cell.style.outline = '';
      cell.classList.remove(EPGU_REQUESTS_FILL_CLASS);
    });

    epguRequestsDuplicateColorMap.clear();
    epguRequestsDuplicateColorIndex = 0;
  }

  function getEpguRequestsDuplicateColorByKey(key) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return EPGU_REQUESTS_DUPLICATE_COLOR_PALETTE[0];
    }

    if (!epguRequestsDuplicateColorMap.has(normalizedKey)) {
      const nextColor = EPGU_REQUESTS_DUPLICATE_COLOR_PALETTE[
        epguRequestsDuplicateColorIndex % EPGU_REQUESTS_DUPLICATE_COLOR_PALETTE.length
      ];
      epguRequestsDuplicateColorMap.set(normalizedKey, nextColor);
      epguRequestsDuplicateColorIndex += 1;
    }

    return epguRequestsDuplicateColorMap.get(normalizedKey);
  }

  function markEpguRequestsDuplicateCell(cell, colorPair) {
    if (!(cell instanceof HTMLElement)) return;
    cell.classList.add(EPGU_REQUESTS_DUPLICATE_CLASS);
    cell.style.backgroundColor = colorPair && colorPair.background ? colorPair.background : '';
    cell.style.outline = '';
  }

  function applyEpguRequestsFillColor(cell, color) {
    if (!(cell instanceof HTMLElement)) return;
    cell.classList.add(EPGU_REQUESTS_FILL_CLASS);
    cell.style.backgroundColor = String(color || '').trim();
    cell.style.outline = '';
  }

  function resolveEpguStatusColor(statusText) {
    const normalizedStatus = normalizeEpguRequestsCellText(statusText).toLowerCase();
    if (normalizedStatus === 'ошибка') return EPGU_REQUESTS_COLOR_RED;
    if (normalizedStatus === 'услуга оказана') return EPGU_REQUESTS_COLOR_GREEN;
    return EPGU_REQUESTS_COLOR_YELLOW;
  }

  function resolveEpguFileRequestColor(fileRequestText) {
    const normalizedValue = normalizeEpguRequestsCellText(fileRequestText).toLowerCase();
    if (!normalizedValue) return EPGU_REQUESTS_COLOR_YELLOW;
    if (normalizedValue === 'файл уже получен') return EPGU_REQUESTS_COLOR_GREEN;
    return EPGU_REQUESTS_COLOR_RED;
  }

  function resolveEpguProcessFileColor(processFileText) {
    const normalizedValue = normalizeEpguRequestsCellText(processFileText).toLowerCase();
    if (normalizedValue === 'файл уже обработан') return EPGU_REQUESTS_COLOR_GREEN;
    if (normalizedValue === 'ошибка при обработке файла') return EPGU_REQUESTS_COLOR_RED;
    return EPGU_REQUESTS_COLOR_YELLOW;
  }

  function applyEpguRequestsPermanentHighlights() {
    if (!isEpguRequestsPage()) {
      clearEpguRequestsHighlights();
      return;
    }

    clearEpguRequestsHighlights();

    const rows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
    const duplicatePairs = new Map();

    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;

      const claimantCell = row.querySelector('td[aria-describedby="list_Claimant"]');
      const createDateCell = row.querySelector('td[aria-describedby="list_CreateDate"]');
      const statusCell = row.querySelector('td[aria-describedby="list_StatusName"]');
      const fileRequestCell = row.querySelector('td[aria-describedby="list_FileRequest"]');
      const processFileCell = row.querySelector('td[aria-describedby="list_ProcessFile"]');

      if (statusCell instanceof HTMLElement) {
        applyEpguRequestsFillColor(statusCell, resolveEpguStatusColor(getSmartValue(statusCell)));
      }
      if (fileRequestCell instanceof HTMLElement) {
        applyEpguRequestsFillColor(fileRequestCell, resolveEpguFileRequestColor(getSmartValue(fileRequestCell)));
      }
      if (processFileCell instanceof HTMLElement) {
        applyEpguRequestsFillColor(processFileCell, resolveEpguProcessFileColor(getSmartValue(processFileCell)));
      }

      if (!(claimantCell instanceof HTMLElement) || !(createDateCell instanceof HTMLElement)) return;

      const claimant = normalizeEpguRequestsCellText(getSmartValue(claimantCell));
      const createDate = normalizeCreateDateForDuplicate(getSmartValue(createDateCell));
      if (!claimant || !createDate) return;

      const pairKey = `${claimant}|||${createDate}`;
      if (!duplicatePairs.has(pairKey)) {
        duplicatePairs.set(pairKey, []);
      }
      duplicatePairs.get(pairKey).push({ claimantCell });
    });

    duplicatePairs.forEach((groupRows, pairKey) => {
      if (!Array.isArray(groupRows) || groupRows.length < 2) return;
      const colors = getEpguRequestsDuplicateColorByKey(pairKey);
      groupRows.forEach((groupRow) => {
        markEpguRequestsDuplicateCell(groupRow.claimantCell, colors);
      });
    });
  }

  function runCheck() {
    // Если режим подсветки выключен, просто очищаем и выходим.
    if (!currentHighlightSettings.setting_highlight_mode) {
      clearHighlights();
      applyFsspReestrPermanentHighlights();
      applyEpguRequestsPermanentHighlights();
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
          el.style.outline = '';
        }
      });
    });

    applyFsspReestrPermanentHighlights();
    applyEpguRequestsPermanentHighlights();
  }

  const debouncedRunCheck = debounce(runCheck, 500);

  window.addEventListener(FSSP_REESTR_GROUPING_CHANGE_EVENT, function(event) {
    if (!isFsspReestrPage()) return;
    const enabled = !!(event && event.detail && event.detail.enabled);
    if (enabled) {
      const rows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
      clearFsspReestrRowsOriginalOrder(rows);
    }
    ensureFsspReestrGroupingToggle();
    runCheck();
  }, { capture: true });

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
    let extensionUiSettingsChanged = false;
    for (let key in changes) {
      if (key === 'setting_copy_mode') {
        isCopyModeEnabled = !!changes[key].newValue;
      }
      if (allDuplicateSettingKeys.includes(key)) {
        currentHighlightSettings[key] = changes[key].newValue;
        highlightSettingsChanged = true;
      }

      const extensionSetting = EXTENSION_UI_SETTING_DEF_BY_STORAGE_KEY[key];
      if (extensionSetting) {
        extensionUiVisibilitySettings[extensionSetting.key] =
          typeof changes[key].newValue === 'boolean'
            ? changes[key].newValue
            : EXTENSION_UI_SETTINGS_DEFAULTS[extensionSetting.key];
        extensionUiSettingsChanged = true;
      }

      if (key === DEPARTMENT_DROPDOWN_STATE_STORAGE_KEY) {
        departmentDropdownShowHidden = changes[key].newValue === true;
      }

      if (key === EXECUTION_ANALYSIS_PARAMS_STORAGE_KEY) {
        executionAnalysisParams = normalizeExecutionAnalysisParams(changes[key].newValue);
        syncExecutionAnalysisControls();
      }

      if (key === EXECUTION_ANALYSIS_STATE_STORAGE_KEY) {
        executionAnalysisState = normalizeExecutionAnalysisState(changes[key].newValue);
        syncExecutionAnalysisControls();
        maybeScheduleExecutionAnalysisNextBatch('storage-change');
      }

      if (key === ID_CARD_CHECK_STORAGE_KEY) {
        idCardCheckState = normalizeIdCardCheckState(changes[key].newValue);
        void syncIdCardCheckStateWithCurrentUrl();
        void syncIdCardCheckNavigation();
      }
    }
    if (highlightSettingsChanged) {
      // Немедленно запускаем проверку, если изменились настройки
      runCheck();
    }
    if (extensionUiSettingsChanged) {
      applyExtensionUiVisibilitySettings('storage-change');
      return;
    }

    syncDepartmentDropdownVisibility();
  });

  // Запускаем проверку при изменениях на странице (динамический контент)
  const observer = new MutationObserver(() => {
    if (currentHighlightSettings.setting_highlight_mode || isFsspReestrPage() || isEpguRequestsPage()) {
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
    const targetHeader = getManualGridHeaderTrigger(e.target);
    if (targetHeader) {
      const columnCodeName = ensureManualGridColumnCodeTooltip(targetHeader);
      if (columnCodeName) {
        e.preventDefault();
        navigator.clipboard.writeText(columnCodeName).then(() => showSuccessFeedback(targetHeader));
        return;
      }
    }
    const targetCell = e.target.closest('td[role="gridcell"]');
    if (targetCell) {
      e.preventDefault();
      const val = getSmartValue(targetCell);
      if (val) navigator.clipboard.writeText(val).then(() => showSuccessFeedback(targetCell));
    }
  }, true);

  document.addEventListener('mousedown', function(e) {
    if (!isCopyModeEnabled) return;
    if (!e || e.button !== 1) return;

    const targetCell = getGridBulkCopyTargetCell(e.target);
    if (!targetCell) return;
    if (!String(targetCell.getAttribute('aria-describedby') || '').trim()) return;
    if (!getGridTableFromCell(targetCell)) return;

    e.preventDefault();
  }, true);

  document.addEventListener('auxclick', function(e) {
    if (!isCopyModeEnabled) return;
    if (!e || e.button !== 1) return;

    const targetCell = getGridBulkCopyTargetCell(e.target);
    if (!targetCell) return;

    const copyEntries = collectGridColumnCopyEntries(targetCell);
    if (!copyEntries.length) return;

    const values = copyEntries.map((entry) => entry.value);
    const feedbackElements = getGridBulkCopyFeedbackElements(copyEntries);

    e.preventDefault();
    e.stopPropagation();

    navigator.clipboard.writeText(values.join('\n')).then(() => {
      showSuccessFeedbackBatch(feedbackElements);
    });
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

  function tryAbortBeforeManualGridSelectChange(selectEl, triggerName) {
    if (!(selectEl instanceof HTMLSelectElement)) return '';
    const abortMode = abortStageJumpBusyGridRequest(selectEl);
    if (!abortMode) return '';
    notifyGridAbortMessageRewrite('manual-select-' + String(triggerName || 'unknown'));

    if (abortMode === 'jqxhr') {
      console.info('[StageJump] Manual select pre-abort via jqXhr (' + triggerName + ').');
    } else if (abortMode === 'window-stop') {
      console.info('[StageJump] Manual select pre-abort via window.stop() (' + triggerName + ').');
    }
    return abortMode;
  }

  function dispatchManualGridSelectChange(selectEl) {
    if (!(selectEl instanceof HTMLSelectElement)) return false;
    if (!document.contains(selectEl)) return false;

    try {
      selectEl.focus({ preventScroll: true });
    } catch (error) {
      selectEl.focus();
    }

    try {
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
      // ignore
    }

    try {
      selectEl.dispatchEvent(new Event('change', {
        bubbles: true,
        cancelable: true
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function replayManualGridSelectChangeAfterAbort(selectEl, abortMode, triggerName) {
    if (!(selectEl instanceof HTMLSelectElement)) return;
    const delayMs = abortMode === 'window-stop' ? 220 : 90;
    window.setTimeout(() => {
      const ok = dispatchManualGridSelectChange(selectEl);
      if (ok) {
        console.info('[StageJump] Manual select change replayed after pre-abort (' + String(triggerName || 'unknown') + ').');
      }
    }, delayMs);
  }

  function dispatchManualGridMouseClick(targetEl) {
    if (!(targetEl instanceof HTMLElement)) return false;
    if (!document.contains(targetEl)) return false;

    try {
      targetEl.dispatchEvent(new MouseEvent('click', {
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

  function replayManualGridMouseClickAfterAbort(targetEl, abortMode, successMessage) {
    if (!(targetEl instanceof HTMLElement)) return;
    const delayMs = abortMode === 'window-stop' ? 220 : 90;
    window.setTimeout(() => {
      const ok = dispatchManualGridMouseClick(targetEl);
      if (ok && successMessage) {
        console.info(successMessage);
      }
    }, delayMs);
  }

  function getManualGridSelectTrigger(target) {
    if (!(target instanceof HTMLSelectElement)) return null;
    if (target.matches('select[role="search"], select.ui-pg-selbox')) return target;
    return null;
  }

  function getManualGridMultiselectFilterButton() {
    const buttons = Array.from(document.querySelectorAll('button.ui-multiselect.ui-state-active[id$="_ms"]'));
    for (const button of buttons) {
      if (!(button instanceof HTMLButtonElement)) continue;
      const buttonId = String(button.id || '').trim();
      if (!buttonId.endsWith('_ms')) continue;

      const selectId = buttonId.slice(0, -3);
      if (!selectId) continue;

      const sourceSelect = document.getElementById(selectId);
      if (!(sourceSelect instanceof HTMLSelectElement)) continue;
      if (!sourceSelect.matches('select[role="search"][multiple]')) continue;
      return button;
    }
    return null;
  }

  function getManualGridMultiselectAction(target) {
    if (!(target instanceof Element)) return null;

    const actionEl = target.closest('label, input[type="checkbox"], a.ui-multiselect-all, a.ui-multiselect-none');
    if (!(actionEl instanceof HTMLElement)) return null;
    if (!actionEl.closest('.ui-multiselect-menu')) return null;

    const button = getManualGridMultiselectFilterButton();
    if (!(button instanceof HTMLButtonElement)) return null;

    const sourceSelectId = String(button.id || '').slice(0, -3);
    if (!sourceSelectId) return null;

    const sourceSelect = document.getElementById(sourceSelectId);
    if (!(sourceSelect instanceof HTMLSelectElement)) return null;
    if (!sourceSelect.matches('select[role="search"][multiple]')) return null;

    return { actionEl, sourceSelect };
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

  function getManualGridHeaderTrigger(target) {
    if (!(target instanceof Element)) return null;

    const byJqghId = target.closest('div[id^="jqgh_"]');
    const byRole = target.closest('div[role="columnheader"]');
    const header = byJqghId instanceof HTMLElement ? byJqghId : byRole;
    if (!(header instanceof HTMLElement)) return null;

    const headerCell = header.closest('th');
    if (!(headerCell instanceof HTMLTableCellElement)) return null;
    if (!headerCell.closest('.ui-jqgrid-hdiv')) return null;

    return header;
  }

  function extractManualGridColumnCodeName(rawHeaderId) {
    const normalizedHeaderId = String(rawHeaderId || '').trim();
    if (!normalizedHeaderId) return '';

    const withoutJqghPrefix = normalizedHeaderId.startsWith('jqgh_')
      ? normalizedHeaderId.slice('jqgh_'.length)
      : normalizedHeaderId;
    if (!withoutJqghPrefix) return '';

    const firstUnderscoreIndex = withoutJqghPrefix.indexOf('_');
    if (firstUnderscoreIndex < 0) return withoutJqghPrefix;
    if (firstUnderscoreIndex >= withoutJqghPrefix.length - 1) return '';
    return withoutJqghPrefix.slice(firstUnderscoreIndex + 1);
  }

  function getManualGridColumnCodeName(sortableEl) {
    if (!(sortableEl instanceof HTMLElement)) return '';

    const columnCodeName = extractManualGridColumnCodeName(sortableEl.id);
    if (columnCodeName) return columnCodeName;

    const headerCell = sortableEl.closest('th');
    if (!(headerCell instanceof HTMLTableCellElement)) return '';
    return extractManualGridColumnCodeName(headerCell.id);
  }

  function ensureManualGridColumnCodeTooltip(sortableEl) {
    if (!(sortableEl instanceof HTMLElement)) return '';

    const columnCodeName = getManualGridColumnCodeName(sortableEl);
    if (!columnCodeName) return '';

    sortableEl.title = columnCodeName;
    return columnCodeName;
  }

  document.addEventListener('mouseover', function(e) {
    const headerTrigger = getManualGridHeaderTrigger(e.target);
    if (!headerTrigger) return;
    ensureManualGridColumnCodeTooltip(headerTrigger);
  }, true);

  function dispatchManualGridSortClick(sortableEl) {
    return dispatchManualGridMouseClick(sortableEl);
  }

  function replayManualGridSortClickAfterAbort(sortableEl, abortMode) {
    replayManualGridMouseClickAfterAbort(
      sortableEl,
      abortMode,
      '[StageJump] Manual sort click replayed after pre-abort.'
    );
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

    const multiselectAction = getManualGridMultiselectAction(e.target);
    if (multiselectAction) {
      const abortMode = tryAbortBeforeManualGridSelectChange(multiselectAction.sourceSelect, 'filter-multiselect-click');
      if (!abortMode) return;

      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      replayManualGridMouseClickAfterAbort(
        multiselectAction.actionEl,
        abortMode,
        '[StageJump] Manual multiselect click replayed after pre-abort.'
      );
      return;
    }

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

  document.addEventListener('change', function(e) {
    if (!e || !e.isTrusted) return;

    const selectTrigger = getManualGridSelectTrigger(e.target);
    if (!selectTrigger) return;

    const triggerName = selectTrigger.matches('select.ui-pg-selbox')
      ? 'pager-rows'
      : 'filter-select';
    const abortMode = tryAbortBeforeManualGridSelectChange(selectTrigger, triggerName);
    if (!abortMode) return;

    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    replayManualGridSelectChangeAfterAbort(selectTrigger, abortMode, triggerName);
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

  function isDepartmentDropdownFilterEnabled() {
    return isPyramidExtensionPage() && isExtensionUiSettingEnabled('departmentDropdownFilter');
  }

  function ensureDepartmentDropdownToggleStyle() {
    if (document.getElementById(DEPARTMENT_DROPDOWN_TOGGLE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = DEPARTMENT_DROPDOWN_TOGGLE_STYLE_ID;
    style.textContent = `
      .${DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS} {
        list-style: none;
        padding: 2px 12px 1px;
        margin: 0;
      }

      .${DEPARTMENT_DROPDOWN_TOGGLE_LABEL_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        font-size: 10px;
        line-height: 1.05;
        font-weight: 400;
        cursor: pointer;
      }

      .${DEPARTMENT_DROPDOWN_TOGGLE_CHECKBOX_CLASS} {
        width: 11px;
        height: 11px;
        margin: 0;
        flex: 0 0 auto;
      }

      ${DEPARTMENT_DROPDOWN_MENU_SELECTOR}:not(.${DEPARTMENT_DROPDOWN_SHOW_HIDDEN_CLASS}) li[${DEPARTMENT_DROPDOWN_HIDDEN_ATTR}="1"] {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function getDepartmentDropdownContents() {
    return Array.from(document.querySelectorAll('.dropdown-content')).filter((content) => {
      if (!(content instanceof HTMLElement)) return false;
      return !!content.querySelector(DEPARTMENT_DROPDOWN_SEARCH_INPUT_SELECTOR)
        && !!content.querySelector(DEPARTMENT_DROPDOWN_MENU_SELECTOR);
    });
  }

  function removeDepartmentDropdownToggle(dropdownContent) {
    if (!(dropdownContent instanceof HTMLElement)) return;
    const toggleRow = dropdownContent.querySelector(`.${DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS}`);
    if (toggleRow instanceof HTMLElement) {
      toggleRow.remove();
    }
  }

  function rememberDepartmentDropdownMenuMetrics(departmentsMenu) {
    if (!(departmentsMenu instanceof HTMLElement)) return;
    if (!departmentsMenu.hasAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_ATTR)) {
      departmentsMenu.setAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_ATTR, departmentsMenu.style.maxHeight || '');
    }
    if (!departmentsMenu.hasAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_PX_ATTR)) {
      const computedMaxHeight = Number.parseFloat(window.getComputedStyle(departmentsMenu).maxHeight || '');
      if (Number.isFinite(computedMaxHeight) && computedMaxHeight > 0) {
        departmentsMenu.setAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_PX_ATTR, String(computedMaxHeight));
      }
    }
  }

  function restoreDepartmentDropdownMenuMaxHeight(departmentsMenu) {
    if (!(departmentsMenu instanceof HTMLElement)) return;
    const originalInlineMaxHeight = departmentsMenu.getAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_ATTR);
    if (typeof originalInlineMaxHeight === 'string' && originalInlineMaxHeight.length > 0) {
      departmentsMenu.style.maxHeight = originalInlineMaxHeight;
      return;
    }
    departmentsMenu.style.removeProperty('max-height');
  }

  function syncDepartmentDropdownMenuMaxHeight(dropdownContent) {
    if (!(dropdownContent instanceof HTMLElement)) return;

    const departmentsMenu = dropdownContent.querySelector(DEPARTMENT_DROPDOWN_MENU_SELECTOR);
    if (!(departmentsMenu instanceof HTMLElement)) return;

    rememberDepartmentDropdownMenuMetrics(departmentsMenu);

    const outerDropdown = dropdownContent.closest('.dropdown-menu');
    if (!(outerDropdown instanceof HTMLElement)) return;

    const outerRect = outerDropdown.getBoundingClientRect();
    const menuRect = departmentsMenu.getBoundingClientRect();
    const originalMaxHeightPx = Number.parseFloat(
      departmentsMenu.getAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_MAX_HEIGHT_PX_ATTR) || ''
    );
    const availableHeight = Math.floor(outerRect.bottom - menuRect.top - 1);

    if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
      restoreDepartmentDropdownMenuMaxHeight(departmentsMenu);
      return;
    }

    const nextMaxHeight = Number.isFinite(originalMaxHeightPx) && originalMaxHeightPx > 0
      ? Math.min(originalMaxHeightPx, availableHeight)
      : availableHeight;

    departmentsMenu.style.maxHeight = `${Math.max(nextMaxHeight, 48)}px`;
  }

  function ensureDepartmentDropdownToggle(dropdownContent) {
    if (!(dropdownContent instanceof HTMLElement)) return null;

    const headerItem = dropdownContent.querySelector('li.dropdown-menu-header');
    if (!(headerItem instanceof HTMLLIElement)) return null;

    let toggleRow = dropdownContent.querySelector(`.${DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS}`);
    if (!(toggleRow instanceof HTMLLIElement)) {
      toggleRow = document.createElement('li');
      toggleRow.className = DEPARTMENT_DROPDOWN_TOGGLE_ROW_CLASS;

      const toggleLabel = document.createElement('label');
      toggleLabel.className = DEPARTMENT_DROPDOWN_TOGGLE_LABEL_CLASS;

      const toggleCheckbox = document.createElement('input');
      toggleCheckbox.type = 'checkbox';
      toggleCheckbox.className = DEPARTMENT_DROPDOWN_TOGGLE_CHECKBOX_CLASS;
      toggleCheckbox.checked = departmentDropdownShowHidden;
      toggleCheckbox.addEventListener('change', () => {
        departmentDropdownShowHidden = toggleCheckbox.checked;
        syncDepartmentDropdownVisibility();
        chrome.storage.local.set({ [DEPARTMENT_DROPDOWN_STATE_STORAGE_KEY]: departmentDropdownShowHidden });
      });

      const toggleText = document.createElement('span');
      toggleText.textContent = DEPARTMENT_DROPDOWN_TOGGLE_TEXT;

      toggleLabel.append(toggleCheckbox, toggleText);
      toggleRow.appendChild(toggleLabel);
    }

    if (toggleRow.parentElement !== dropdownContent || toggleRow.previousElementSibling !== headerItem) {
      headerItem.insertAdjacentElement('afterend', toggleRow);
    }

    const toggleCheckbox = toggleRow.querySelector(`.${DEPARTMENT_DROPDOWN_TOGGLE_CHECKBOX_CLASS}`);
    if (toggleCheckbox instanceof HTMLInputElement) {
      toggleCheckbox.checked = departmentDropdownShowHidden;
    }

    return toggleRow;
  }

  function captureDepartmentDropdownOriginalOrder(departmentsMenu) {
    if (!(departmentsMenu instanceof HTMLElement)) return [];

    const items = Array.from(departmentsMenu.children)
      .filter((node) => node instanceof HTMLLIElement);
    items.forEach((item, index) => {
      if (!item.hasAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_ORDER_ATTR)) {
        item.setAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_ORDER_ATTR, String(index));
      }
    });
    return items;
  }

  function getDepartmentDropdownOriginalOrder(item, fallbackIndex) {
    const rawValue = String(item.getAttribute(DEPARTMENT_DROPDOWN_ORIGINAL_ORDER_ATTR) || '').trim();
    const parsedValue = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsedValue) ? parsedValue : fallbackIndex;
  }

  function applyDepartmentDropdownItemOrder(departmentsMenu, orderedItems) {
    if (!(departmentsMenu instanceof HTMLElement) || !Array.isArray(orderedItems)) return;

    const currentItems = Array.from(departmentsMenu.children)
      .filter((node) => node instanceof HTMLLIElement);
    if (currentItems.length !== orderedItems.length) {
      orderedItems.forEach((item) => departmentsMenu.appendChild(item));
      return;
    }

    const orderIsSame = orderedItems.every((item, index) => currentItems[index] === item);
    if (orderIsSame) return;

    orderedItems.forEach((item) => departmentsMenu.appendChild(item));
  }

  function restoreDepartmentDropdownOriginalOrder(departmentsMenu) {
    const items = captureDepartmentDropdownOriginalOrder(departmentsMenu);
    const orderedItems = items
      .slice()
      .sort((leftItem, rightItem) => (
        getDepartmentDropdownOriginalOrder(leftItem, Number.MAX_SAFE_INTEGER) -
        getDepartmentDropdownOriginalOrder(rightItem, Number.MAX_SAFE_INTEGER)
      ));
    applyDepartmentDropdownItemOrder(departmentsMenu, orderedItems);
  }

  function compareDepartmentDropdownItems(leftItem, rightItem) {
    const leftLink = leftItem.querySelector(SLOWSEARCH_CITIES_LINK_SELECTOR);
    const rightLink = rightItem.querySelector(SLOWSEARCH_CITIES_LINK_SELECTOR);
    const leftDepid = String(leftLink && leftLink.getAttribute('data-depid') || '').trim();
    const rightDepid = String(rightLink && rightLink.getAttribute('data-depid') || '').trim();
    const leftOrderIndex = DEPARTMENT_ALLOWED_DEPID_ORDER_INDEX.get(leftDepid);
    const rightOrderIndex = DEPARTMENT_ALLOWED_DEPID_ORDER_INDEX.get(rightDepid);
    const hasLeftOrder = Number.isInteger(leftOrderIndex);
    const hasRightOrder = Number.isInteger(rightOrderIndex);

    if (hasLeftOrder && hasRightOrder && leftOrderIndex !== rightOrderIndex) {
      return leftOrderIndex - rightOrderIndex;
    }
    if (hasLeftOrder && !hasRightOrder) return -1;
    if (!hasLeftOrder && hasRightOrder) return 1;

    const leftOriginalOrder = getDepartmentDropdownOriginalOrder(leftItem, Number.MAX_SAFE_INTEGER);
    const rightOriginalOrder = getDepartmentDropdownOriginalOrder(rightItem, Number.MAX_SAFE_INTEGER);
    return leftOriginalOrder - rightOriginalOrder;
  }

  function sortDepartmentDropdownItemsByConfigOrder(departmentsMenu) {
    const items = captureDepartmentDropdownOriginalOrder(departmentsMenu);
    if (items.length < 2) return;

    const orderedItems = items
      .slice()
      .sort(compareDepartmentDropdownItems)
    applyDepartmentDropdownItemOrder(departmentsMenu, orderedItems);
  }

  function lockDepartmentDropdownInteraction(durationMs = 500) {
    const safeDuration = Number.isFinite(Number(durationMs)) ? Number(durationMs) : 500;
    departmentDropdownInteractionLockUntilMs = Date.now() + Math.max(safeDuration, 0);
  }

  function isDepartmentDropdownInteractionLocked() {
    return Date.now() < departmentDropdownInteractionLockUntilMs;
  }

  function handleDepartmentDropdownLinkPointerDown(event) {
    const target = event && event.target instanceof Element
      ? event.target
      : null;
    if (!(target instanceof Element)) return;

    const targetLink = target.closest(SLOWSEARCH_CITIES_LINK_SELECTOR);
    if (!(targetLink instanceof HTMLAnchorElement)) return;

    const dropdownContent = targetLink.closest('.dropdown-content');
    if (!(dropdownContent instanceof HTMLElement)) return;
    if (!dropdownContent.querySelector(DEPARTMENT_DROPDOWN_MENU_SELECTOR)) return;

    lockDepartmentDropdownInteraction(600);
  }

  function updateDepartmentDropdownVisibilityForDropdown(dropdownContent) {
    if (!(dropdownContent instanceof HTMLElement)) return;

    const departmentsMenu = dropdownContent.querySelector(DEPARTMENT_DROPDOWN_MENU_SELECTOR);
    if (!(departmentsMenu instanceof HTMLElement)) return;

    const departmentItems = captureDepartmentDropdownOriginalOrder(departmentsMenu);
    const filterEnabled = isDepartmentDropdownFilterEnabled();
    const showOriginalList = !filterEnabled || departmentDropdownShowHidden;

    departmentItems.forEach((item) => {
      const link = item.querySelector(SLOWSEARCH_CITIES_LINK_SELECTOR);
      if (!(link instanceof HTMLAnchorElement)) return;

      const depid = String(link.getAttribute('data-depid') || '').trim();
      if (!filterEnabled || DEPARTMENT_ALLOWED_DEPIDS.has(depid)) {
        item.removeAttribute(DEPARTMENT_DROPDOWN_HIDDEN_ATTR);
      } else {
        item.setAttribute(DEPARTMENT_DROPDOWN_HIDDEN_ATTR, '1');
      }
    });

    if (showOriginalList) {
      restoreDepartmentDropdownOriginalOrder(departmentsMenu);
      departmentsMenu.classList.add(DEPARTMENT_DROPDOWN_SHOW_HIDDEN_CLASS);
      syncDepartmentDropdownMenuMaxHeight(dropdownContent);
      return;
    }

    sortDepartmentDropdownItemsByConfigOrder(departmentsMenu);
    departmentsMenu.classList.remove(DEPARTMENT_DROPDOWN_SHOW_HIDDEN_CLASS);
    syncDepartmentDropdownMenuMaxHeight(dropdownContent);
  }

  function syncDepartmentDropdownVisibility() {
    if (!isPyramidExtensionPage()) return;
    if (isDepartmentDropdownInteractionLocked()) return;

    ensureDepartmentDropdownToggleStyle();
    const dropdownContents = getDepartmentDropdownContents();
    dropdownContents.forEach((dropdownContent) => {
      if (isDepartmentDropdownFilterEnabled()) {
        ensureDepartmentDropdownToggle(dropdownContent);
      } else {
        removeDepartmentDropdownToggle(dropdownContent);
        const departmentsMenu = dropdownContent.querySelector(DEPARTMENT_DROPDOWN_MENU_SELECTOR);
        if (departmentsMenu instanceof HTMLElement) {
          restoreDepartmentDropdownMenuMaxHeight(departmentsMenu);
        }
      }
      updateDepartmentDropdownVisibilityForDropdown(dropdownContent);
    });
  }

  const debouncedSyncDepartmentDropdownVisibility = debounce(syncDepartmentDropdownVisibility, 120);

  function initDepartmentDropdownFilter() {
    if (!isPyramidExtensionPage()) return;

    chrome.storage.local.get([DEPARTMENT_DROPDOWN_STATE_STORAGE_KEY], (storedValues) => {
      departmentDropdownShowHidden = storedValues[DEPARTMENT_DROPDOWN_STATE_STORAGE_KEY] === true;
      syncDepartmentDropdownVisibility();
    });

    document.addEventListener('mousedown', handleDepartmentDropdownLinkPointerDown, true);

    const observer = new MutationObserver(() => {
      debouncedSyncDepartmentDropdownVisibility();
    });
    observeWithRetry(
      observer,
      () => document.body || document.documentElement,
      { childList: true, subtree: true },
      120,
      100
    );
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
      saveStageJumpPendingPayloadToStorage(pendingPayload);

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

  function getStageJumpRowFromButton(button) {
    if (!(button instanceof HTMLElement)) return null;
    const row = button.closest('tr.jqgrow');
    return row instanceof HTMLTableRowElement ? row : null;
  }

  function getStageJumpSelectedRows() {
    return Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'))
      .filter((row) => (
        row instanceof HTMLTableRowElement &&
        (
          row.getAttribute('aria-selected') === 'true' ||
          row.classList.contains('ui-state-highlight') ||
          row.classList.contains('active') ||
          !!row.querySelector('input.cbox[type="checkbox"]:checked')
        )
      ));
  }

  function buildStageJumpCopyInfoTmValue(stageName, statusName) {
    const stage = String(stageName || '').trim();
    const status = String(statusName || '').trim();
    if (stage && status) return `${stage}/${status}`;
    return stage || status;
  }

  function escapeStageJumpCopyInfoHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildStageJumpCopyInfoLineData(target) {
    const departmentName = String(target && target.departmentName ? target.departmentName : '').trim();
    const accountNumber = String(target && target.accountNumber ? target.accountNumber : '').trim();
    const accountWithDepartment = accountNumber
      ? (departmentName ? `${accountNumber} (${departmentName})` : accountNumber)
      : (departmentName ? `(${departmentName})` : '');

    return {
      accountWithDepartment,
      debtId: String(target && target.debtId ? target.debtId : '').trim(),
      edocId: String(target && target.edocId ? target.edocId : '').trim(),
      edNumber: String(target && target.edNumber ? target.edNumber : '').trim(),
      fullName: String(target && target.fullName ? target.fullName : '').trim(),
      tmValue: buildStageJumpCopyInfoTmValue(
        target && target.stageName ? target.stageName : '',
        target && target.statusName ? target.statusName : ''
      )
    };
  }

  function buildStageJumpCopyInfoPlainText(target) {
    const lineData = buildStageJumpCopyInfoLineData(target);
    return [
      `ЛС: ${lineData.accountWithDepartment}`,
      `DebtID: ${lineData.debtId}`,
      `EDocID: ${lineData.edocId}`,
      `НомерИД: ${lineData.edNumber}`,
      `ФИО: ${lineData.fullName}`,
      `ТМ: ${lineData.tmValue}`
    ].join(' | ');
  }

  function buildStageJumpCopyInfoHtml(target) {
    const lineData = buildStageJumpCopyInfoLineData(target);
    return [
      `<strong>ЛС:</strong> ${escapeStageJumpCopyInfoHtml(lineData.accountWithDepartment)}`,
      `<strong>DebtID:</strong> ${escapeStageJumpCopyInfoHtml(lineData.debtId)}`,
      `<strong>EDocID:</strong> ${escapeStageJumpCopyInfoHtml(lineData.edocId)}`,
      `<strong>НомерИД:</strong> ${escapeStageJumpCopyInfoHtml(lineData.edNumber)}`,
      `<strong>ФИО:</strong> ${escapeStageJumpCopyInfoHtml(lineData.fullName)}`,
      `<strong>ТМ:</strong> ${escapeStageJumpCopyInfoHtml(lineData.tmValue)}`
    ].join(' | ');
  }

  function collectStageJumpCopyInfoTargets(anchorButton) {
    const summary = {
      selectedRowsCount: 0,
      targets: []
    };

    const selectedRows = getStageJumpSelectedRows();
    summary.selectedRowsCount = selectedRows.length;
    const sourceRows = selectedRows.length > 0
      ? selectedRows
      : [getStageJumpRowFromButton(anchorButton)].filter((row) => row instanceof HTMLTableRowElement);

    const currentDepartmentName = getSlowsearchDepartmentCurrentName();
    const seen = new Set();
    sourceRows.forEach((row) => {
      if (!(row instanceof HTMLTableRowElement)) return;

      const debtId = getRowCellTextByAria(row, 'list_DebtID');
      const edocId = getRowCellTextByAria(row, 'list_EDocID') || getRowCellTextByAria(row, 'list_EdocID');
      const accountNumber = getRowCellTextByAria(row, 'list_AccAddress_AccountNumber');
      const edNumber = getRowCellTextByAria(row, 'list_EDNumber');
      const fullName = getRowCellTextByAria(row, 'list_Individual_FullName');
      const stageName = getRowCellTextByAria(row, 'list_CaseStageName');
      const statusName = getRowCellTextByAria(row, 'list_CaseStatusName');
      const dedupeKey = String(row.id || '').trim() || [debtId, edocId, accountNumber, fullName].join('::');
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      if (!dedupeKey.replace(/[:]/g, '').trim()) return;

      summary.targets.push({
        debtId,
        edocId,
        accountNumber,
        edNumber,
        fullName,
        stageName,
        statusName,
        departmentName: currentDepartmentName
      });
    });

    return summary;
  }

  function writeStageJumpPlainTextToClipboardFallback(text) {
    return new Promise((resolve, reject) => {
      const host = document.body || document.documentElement;
      if (!host) {
        reject(new Error('NO_DOCUMENT_HOST'));
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = String(text || '');
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.left = '-1000px';
      textarea.style.opacity = '0';
      host.appendChild(textarea);

      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }

      textarea.remove();

      if (copied) {
        resolve(true);
      } else {
        reject(new Error('COPY_COMMAND_FAILED'));
      }
    });
  }

  async function writeStageJumpInfoTargetsToClipboard(targets) {
    const plainText = targets.map((target) => buildStageJumpCopyInfoPlainText(target)).join('\n');
    const htmlText = `<meta charset="utf-8">${targets.map((target) => `<div>${buildStageJumpCopyInfoHtml(target)}</div>`).join('')}`;

    if (!plainText.trim()) {
      throw new Error('EMPTY_COPY_TEXT');
    }

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof window.ClipboardItem === 'function'
    ) {
      try {
        const clipboardItem = new window.ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain;charset=utf-8' }),
          'text/html': new Blob([htmlText], { type: 'text/html;charset=utf-8' })
        });
        await navigator.clipboard.write([clipboardItem]);
        return;
      } catch (error) {
        // fallback to plain text below
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(plainText);
        return;
      } catch (error) {
        // fallback to execCommand below
      }
    }

    await writeStageJumpPlainTextToClipboardFallback(plainText);
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

    if (action === STAGE_JUMP_MENU_ACTION_COPY_INFO) {
      const copyInfoSummary = collectStageJumpCopyInfoTargets(anchorButton);
      if (!copyInfoSummary.targets.length) {
        window.alert('Нет строк для копирования информации об ИД.');
        return;
      }

      void writeStageJumpInfoTargetsToClipboard(copyInfoSummary.targets)
        .then(() => {
          showSuccessFeedback(anchorButton);
        })
        .catch((error) => {
          console.warn('[StageJump] Не удалось скопировать информацию об ИД.', error);
          window.alert('Не удалось скопировать информацию об ИД в буфер обмена.');
        });
      return;
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
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_COPY_INFO}">${STAGE_JUMP_MENU_ITEM_COPY_INFO_TEXT} (0)</button>`,
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
    if (!isExtensionUiSettingEnabled('stageJumpButtons')) {
      closeStageJumpActionMenu();
      return;
    }

    const menu = ensureStageJumpActionMenu();
    if (!menu || !anchorButton) return;

    const stageItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_STAGE}"]`);
    const copyInfoItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_COPY_INFO}"]`);
    const copyInfoSummary = collectStageJumpCopyInfoTargets(anchorButton);
    const hasStageTarget = String(anchorButton.dataset.targetUrl || '').trim().length > 0;
    if (stageItem instanceof HTMLButtonElement) {
      stageItem.disabled = !hasStageTarget;
      if (!hasStageTarget) {
        stageItem.title = 'Маршрут стадии/статуса не найден в статической карте ВЗИД.';
      } else {
        stageItem.removeAttribute('title');
      }
    }
    if (copyInfoItem instanceof HTMLButtonElement) {
      const copyCount = copyInfoSummary.targets.length;
      copyInfoItem.textContent = `${STAGE_JUMP_MENU_ITEM_COPY_INFO_TEXT} (${copyCount})`;
      copyInfoItem.disabled = copyCount < 1;
      if (copyCount < 1) {
        copyInfoItem.title = 'Нет строк для копирования информации об ИД.';
      } else if (copyInfoSummary.selectedRowsCount > 1) {
        copyInfoItem.title = `Будет скопировано строк: ${copyCount}`;
      } else {
        copyInfoItem.removeAttribute('title');
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
        delete jumpButton.dataset.edocId;
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

  function getStageJumpDebtIdFromStorage() {
    const payload = readStageJumpPendingPayloadFromStorage();
    if (!payload) return '';
    return String(payload.debtId || '').trim();
  }

  function clearStageJumpDebtIdStorage() {
    try {
      window.localStorage.removeItem(STAGE_JUMP_STORAGE_KEY);
    } catch (error) {
      // ignore
    }
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
      clearStageJumpDebtIdFromHash();
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

  // --- Подсветка строк/колонок в Google Sheets (без изменений) ---
  if (window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/')) {
    // ... (код без изменений)
  }

  // Запуск
  initStageJumpDebtIdFilterFromHash();
  initSlowsearchDebtIdFilterFromHash();
  initScreenshotHideMode();
  initExtensionUiSettings();
  initIdCardCheckNavigation();
  initGridCardCheckNavigation();
  void initExecutionAnalysisWorkerPage();
  initDepartmentNavigationHotkeys();
  initDepartmentDropdownFilter();
  initStageJumpButtons();
  initSlowsearchJumpButtons();
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
