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
  const STAGE_JUMP_BUTTON_TEXT = 'Быстрые действия по ИД';
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
  const STAGE_JUMP_MENU_ACTION_ALL_RECORDS = 'to_all_records';
  const STAGE_JUMP_MENU_ACTION_COPY_INFO = 'copy_info';
  const STAGE_JUMP_MENU_ACTION_VERIFY_IDENTITY = 'verify_identity';
  const STAGE_JUMP_IDENTITY_VERIFICATION_START_EVENT = 'dup-pyramid-identity-verification-start';
  const STAGE_JUMP_REESTR_RETURN_TO_PU_TM_LABEL = 'Реестр возврата ИД в ОРДЗ/ПУ';
  const STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT = 'Переход в Глобальный поиск';
  const STAGE_JUMP_MENU_ITEM_ALL_RECORDS_TEXT = 'Переход в ОВЗИД: все доступные записи';
  const STAGE_JUMP_MENU_ITEM_COPY_INFO_TEXT = 'Скопировать инфо об ИД';
  const STAGE_JUMP_MENU_ITEM_VERIFY_IDENTITY_TEXT = 'Проверить паспорт / ИНН / смерть';
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
  const ID_CARD_CHECK_HELPER_IFRAME_ID = 'dup-id-card-check-helper-frame';
  const ID_CARD_CHECK_RETURN_PREVIOUS_TM_ACTION = 'return-previous-tm';
  const ID_CARD_CHECK_RETURN_PREVIOUS_TM_ALL_ACTION = 'return-previous-tm-all';
  const ID_CARD_CHECK_SESSION_CACHE_KEY = 'dup_id_card_check_nav_state_v1';
  const ID_CARD_CHECK_AUTO_RETURN_SESSION_KEY = 'dup_id_card_check_auto_return_v1';
  const ID_CARD_CHECK_HISTORY_TRANSITION_PREFIX = 'Документ пришел с ';
  const ID_CARD_CHECK_HELPER_TIMEOUT_MS = 15000;
  const ID_CARD_CHECK_NAV_TOAST_DURATION_MS = 8000;
  const ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS = 20000;
  const ID_CARD_CHECK_TAB_REBIND_TTL_MS = 10 * 60 * 1000;
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
  const DEPARTMENT_CONTAINER_MODE_STORAGE_KEY = 'setting_department_containers';
  const DEPARTMENT_CONTAINER_HOST_COLORS = Object.freeze({
    'kgn.pyramid.vostok-electra.ru': 'green',
    'pyramid.vostok-electra.ru': 'blue',
    'yuric.pyramid.vostok-electra.ru': 'yellow',
    '81.pyramid.vostok-electra.ru': 'red'
  });
  const DEPARTMENT_CONTAINER_CONFIG = Object.freeze({
    '6': { title: 'Ноябрьск', host: 'pyramid.vostok-electra.ru' },
    '11': { title: 'Тюмень', host: 'pyramid.vostok-electra.ru' },
    '12': { title: 'Ялуторовск', host: 'pyramid.vostok-electra.ru' },
    '14': { title: 'Заводоуковск', host: 'pyramid.vostok-electra.ru' },
    '16': { title: 'Ишим', host: 'pyramid.vostok-electra.ru' },
    '19': { title: 'Тобольск', host: 'pyramid.vostok-electra.ru' },
    '24': { title: 'Демьянка', host: 'pyramid.vostok-electra.ru' },
    '26': { title: 'Тюменьремстрой', host: 'pyramid.vostok-electra.ru' },
    '27': { title: 'Надым', host: 'pyramid.vostok-electra.ru' },
    '28': { title: 'Муравленко', host: 'pyramid.vostok-electra.ru' },
    '29': { title: 'Салехард', host: 'pyramid.vostok-electra.ru' },
    '30': { title: 'Приуральский', host: 'pyramid.vostok-electra.ru' },
    '31': { title: 'Пуровский', host: 'pyramid.vostok-electra.ru' },
    '32': { title: 'Лабытнанги', host: 'pyramid.vostok-electra.ru' },
    '33': { title: 'Шурышкарский', host: 'pyramid.vostok-electra.ru' },
    '34': { title: 'Губкинский', host: 'pyramid.vostok-electra.ru' },
    '35': { title: 'Тазовский', host: 'pyramid.vostok-electra.ru' },
    '36': { title: 'Газ-Сале', host: 'pyramid.vostok-electra.ru' },
    '37': { title: 'Харп', host: 'pyramid.vostok-electra.ru' },
    '38': { title: 'Яр-Сале', host: 'pyramid.vostok-electra.ru' },
    '39': { title: 'Курган', host: 'kgn.pyramid.vostok-electra.ru' },
    '40': { title: 'Шадринск', host: 'kgn.pyramid.vostok-electra.ru' },
    '41': { title: 'РИЦ', host: 'pyramid.vostok-electra.ru' },
    '43': { title: 'Курган-Восточный', host: 'kgn.pyramid.vostok-electra.ru' },
    '44': { title: 'УК Юг', host: 'pyramid.vostok-electra.ru' },
    '45': { title: 'УК Север', host: 'pyramid.vostok-electra.ru' },
    '46': { title: 'Уют', host: 'pyramid.vostok-electra.ru' },
    '47': { title: 'ЗапСибУК', host: 'pyramid.vostok-electra.ru' },
    '50': { title: 'УК Запад', host: 'pyramid.vostok-electra.ru' },
    '51': { title: 'ЖилсервисУют', host: 'pyramid.vostok-electra.ru' },
    '52': { title: 'Комфортный дом', host: 'pyramid.vostok-electra.ru' },
    '53': { title: 'Шанс', host: 'pyramid.vostok-electra.ru' },
    '54': { title: 'Утешево', host: 'pyramid.vostok-electra.ru' },
    '55': { title: 'Тюменьремстрой 2', host: 'pyramid.vostok-electra.ru' },
    '56': { title: 'Красноселькуп', host: 'pyramid.vostok-electra.ru' },
    '57': { title: 'Гармония', host: 'pyramid.vostok-electra.ru' },
    '58': { title: 'ЖЭУ 9', host: 'pyramid.vostok-electra.ru' },
    '59': { title: 'Ялуторовск (СУЭНКО)', host: 'pyramid.vostok-electra.ru' },
    '60': { title: 'Заводоуковск (СУЭНКО)', host: 'pyramid.vostok-electra.ru' },
    '61': { title: 'Ишим (СУЭНКО)', host: 'pyramid.vostok-electra.ru' },
    '62': { title: 'Дударева', host: 'pyramid.vostok-electra.ru' },
    '63': { title: 'ЖСК 32', host: 'pyramid.vostok-electra.ru' },
    '64': { title: 'УК ЖКХ', host: 'pyramid.vostok-electra.ru' },
    '66': { title: 'Тюм. и Тюм. уч. АСРН', host: 'pyramid.vostok-electra.ru' },
    '67': { title: 'Оренбург', host: 'pyramid.vostok-electra.ru' },
    '68': { title: 'ТЭО (ТРИЦ)', host: 'pyramid.vostok-electra.ru' },
    '69': { title: 'РИФЕЙ', host: 'pyramid.vostok-electra.ru' },
    '70': { title: 'ЮРИЦ', host: 'yuric.pyramid.vostok-electra.ru' },
    '71': { title: 'МКП Водоканал', host: 'kgn.pyramid.vostok-electra.ru' },
    '72': { title: 'ТЭО', host: 'pyramid.vostok-electra.ru' },
    '77': { title: 'Югра-Экология', host: 'yuric.pyramid.vostok-electra.ru' },
    '81': { title: 'ЧЭС', host: '81.pyramid.vostok-electra.ru' },
    '82': { title: 'ТКС', host: 'pyramid.vostok-electra.ru' },
    '83': { title: 'Новый Уренгой', host: 'pyramid.vostok-electra.ru' },
    '84': { title: 'Фонд капит. ремонта', host: 'pyramid.vostok-electra.ru' },
    '86': { title: 'Объед. ЕРИЦ', host: 'pyramid.vostok-electra.ru' },
    '87': { title: 'Объед. РИЦ', host: 'pyramid.vostok-electra.ru' },
    '88': { title: 'Объед. Восток', host: 'pyramid.vostok-electra.ru' },
    '89': { title: 'Объед. Курган', host: 'pyramid.vostok-electra.ru' },
    '92': { title: 'ЗАСК', host: 'yuric.pyramid.vostok-electra.ru' }
  });
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
    'проведен (нет данных)': '#E6F8E8',
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
  const EPGU_REQUESTS_SUMMARY_BUTTON_ID = 'dup-epgu-summary-btn';
  const EPGU_REQUESTS_SUMMARY_MODAL_ID = 'dup-epgu-summary-modal';
  const EPGU_REQUESTS_RETRY_MODAL_ID = 'dup-epgu-retry-modal';
  const EPGU_REQUESTS_RETRY_EXCLUSIONS_STORAGE_KEY = 'dup_epgu_retry_excluded_claimants_v1';
  const EPGU_REQUESTS_SUMMARY_REOPEN_STORAGE_KEY = 'dup_epgu_summary_reopen_once_v1';
  const EPGU_REGISTRY_CHECK_CACHE_STORAGE_KEY = 'dup_epgu_registry_check_cache_v1';
  const EPGU_REQUESTS_SUMMARY_REOPEN_TTL_MS = 2 * 60 * 1000;
  const EPGU_REQUESTS_SUMMARY_DAYS_BACK = 7;
  const EPGU_REQUESTS_DATABASES = Object.freeze([
    { depid: '39', label: 'Курган', host: 'kgn.pyramid.vostok-electra.ru' },
    { depid: '66', label: 'Основная', host: 'pyramid.vostok-electra.ru' },
    { depid: '70', label: 'ЮРИЦ', host: 'yuric.pyramid.vostok-electra.ru' }
  ]);
  const EPGU_REQUESTS_FORM_PATH_PART = '/ovzid/epgurequests/form';
  const EPGU_REQUESTS_CREATE_BUTTON_ID = 'fromsbrfbutton';
  const EPGU_REQUESTS_RETRY_SUCCESS_TEXT = 'запрос успешно создан';
  const EPGU_REQUESTS_RETRY_FORM_TIMEOUT_MS = 20000;
  const EPGU_REQUESTS_RETRY_RESULT_TIMEOUT_MS = 90000;
  const EPGU_REQUESTS_COLOR_RED = '#FFC9C9';
  const EPGU_REQUESTS_COLOR_GREEN = '#C8F2CC';
  const EPGU_REQUESTS_COLOR_YELLOW = '#FFF3B8';
  const EPGU_REQUESTS_COLOR_TRANSITION = '#FFDEC1';
  const REESTR_DZ_PRINCIPAL_PATH = '/ovzid/ReestrDz';
  const REESTR_DZ_PRINCIPAL_BUTTON_ID = 'dup-reestr-dz-principal-button';
  const REESTR_DZ_PRINCIPAL_SEPARATOR_ID = 'dup-reestr-dz-principal-separator';
  const REESTR_DZ_PRINCIPAL_OVERLAY_ID = 'dup-reestr-dz-principal-overlay';
  const REESTR_DZ_PRINCIPAL_PERIOD_DIALOG_ID = 'dup-reestr-dz-principal-period-dialog';
  const REESTR_DZ_PRINCIPAL_STYLE_ID = 'dup-reestr-dz-principal-style';
  const REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS = 'dup-reestr-dz-principal-current-row';
  const REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS = 'dup-reestr-dz-principal-attention-row';
  const REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS = 'dup-reestr-dz-principal-success-row';
  const REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS = 'dup-reestr-dz-principal-error-row';
  const REESTR_DZ_PRINCIPAL_DAILY_STORAGE_KEY = 'dup_reestr_dz_principal_daily_runs';
  const REESTR_DZ_PARALLEL_WORKERS_STORAGE_KEY = 'dup_reestr_dz_parallel_workers_v1';
  const REESTR_DZ_WRITE_OFF_COMMENT_SKIP_RULES_STORAGE_KEY = 'dup_reestr_dz_write_off_comment_skip_rules_v1';
  const REESTR_DZ_PARALLEL_WORKERS_DEFAULT = 5;
  const REESTR_DZ_PRINCIPAL_DAILY_STORAGE_VERSION = 2;
  const REESTR_DZ_CHECK_MENU_ID = 'dup-reestr-dz-check-menu';
  const REESTR_DZ_WRITE_OFF_OVERLAY_ID = 'dup-reestr-dz-write-off-overlay';
  const REESTR_DZ_WRITE_OFF_COMMENT_CONFIRM_ID = 'dup-reestr-dz-write-off-comment-confirm';
  const REESTR_DZ_WRITE_OFF_DAILY_STORAGE_KEY = 'dup_reestr_dz_write_off_daily_runs';
  const REESTR_DZ_WRITE_OFF_DAILY_STORAGE_VERSION = 1;
  const REESTR_DZ_WRITE_OFF_DRAFT_STORAGE_KEY = 'dup_reestr_dz_write_off_review_draft';
  const REESTR_DZ_WRITE_OFF_HIGHLIGHT_CLASS = 'dup-reestr-dz-write-off-highlight';
  const REESTR_DZ_WRITE_OFF_DECISIONS = Object.freeze([
    'Задолженность списана',
    'Отказ в списании',
    'Задолженность списана частично'
  ]);
  const REESTR_DZ_PRINCIPAL_REPORT_HEADERS = Object.freeze([
    ['ReestrDzID', '№'],
    ['Status', 'Статус'],
    ['CreateDate', 'Дата создания реестра'],
    ['ClaimantName', 'Взыскатель'],
    ['EDocsCount', 'Количество ИД без учета солидарных ответчиков'],
    ['EmployeeFullName', 'Исполнитель ОВЗИД'],
    ['RequestDate', 'Дата запуска поручения на списание'],
    ['RequestNumber', 'Номер поручения'],
    ['SendDate', 'Дата отправки принципалу'],
    ['PrincipalNumber', 'Номер исходящего'],
    ['PrincipalAttachmentDate', 'Фактическая дата прикрепления исходящего'],
    ['OrderDate', 'Дата приказа о списании'],
    ['OrderNumber', 'Номер приказа о списании'],
    ['Structure', 'Состав реестра'],
    ['ResolutionsDirname', 'Путь к папке с постановлениями'],
    ['Note', 'Комментарий']
  ]);
  const EXTENSION_UI_SETTINGS_STYLE_ID = 'dup-extension-ui-settings-style';
  const EXTENSION_UI_SETTINGS_OVERLAY_ID = 'dup-extension-ui-settings-overlay';
  const EXTENSION_UI_SETTINGS_PANEL_ID = 'dup-extension-ui-settings-panel';
  const EXTENSION_UI_SETTINGS_OVERLAY_CLASS = 'dup-extension-ui-settings-overlay';
  const EXTENSION_UI_SETTINGS_PANEL_CLASS = 'dup-extension-ui-settings-panel';
  const EXTENSION_UI_SETTINGS_ITEM_CLASS = 'dup-extension-ui-settings-item';
  const EXTENSION_UI_SETTINGS_TITLE_CLASS = 'dup-extension-ui-settings-title';
  const EXTENSION_UI_SETTINGS_DESCRIPTION_CLASS = 'dup-extension-ui-settings-description';
  const EXTENSION_UI_SETTINGS_INPUT_ATTR = 'data-dup-ui-setting';
  const EXTENSION_UI_SETTINGS_HINT_TEXT = 'Состояние сохраняется для поддерживаемых доменов Пирамиды и их поддоменов.';
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
      key: 'epguSummaryTools',
      storageKey: 'dup_ui_show_epgu_summary_tools',
      label: 'Сводка и повторы ЕПГУ',
      description: 'Сводка за выбранную дату, проверка реестров, переключение баз и повторные запросы.',
      hideClass: 'dup-ui-hide-epgu-summary-tools',
      hideCss: `
        html.dup-ui-hide-epgu-summary-tools #${EPGU_REQUESTS_SUMMARY_BUTTON_ID},
        html.dup-ui-hide-epgu-summary-tools #${EPGU_REQUESTS_SUMMARY_MODAL_ID},
        html.dup-ui-hide-epgu-summary-tools #${EPGU_REQUESTS_RETRY_MODAL_ID} {
          display: none !important;
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
      key: 'stageTimerDepartmentConflict',
      storageKey: 'dup_ui_show_stage_timer_department_conflict',
      label: 'Предупреждение о разных департаментах',
      description: 'Сообщает, если во вкладках Пирамиды открыты разные департаменты.',
      hideClass: 'dup-ui-hide-stage-timer-department-conflict',
      hideCss: `
        html.dup-ui-hide-stage-timer-department-conflict #pyramid-stage-department-conflict {
          display: none !important;
        }
      `
    },
    {
      key: 'stageJumpButtons',
      storageKey: 'dup_ui_show_stage_jump_buttons',
      label: 'Кнопки StageJump',
      description: 'Кнопки и меню переходов/копирования StageJump в списках и реестре возврата ИД.',
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
      key: 'fsspRegistrySearch',
      storageKey: 'dup_ui_show_fssp_registry_search',
      label: 'Поиск ИД в реестрах ФССП',
      description: 'Кнопка пакетного поиска должников и окно результатов.',
      hideClass: 'dup-ui-hide-fssp-registry-search',
      hideCss: `
        html.dup-ui-hide-fssp-registry-search .dup-fssp-registry-search-ui {
          display: none !important;
        }
      `
    },
    {
      key: 'reestrDzPrincipalAutofill',
      storageKey: 'dup_ui_show_reestr_dz_principal_autofill',
      label: 'Проверки реестров списания ДЗ',
      description: 'Меню проверки исходящих и приказов, оверлеи и подсветка текущей строки.',
      hideClass: 'dup-ui-hide-reestr-dz-principal-autofill',
      hideCss: `
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_PRINCIPAL_BUTTON_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_PRINCIPAL_SEPARATOR_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_PRINCIPAL_OVERLAY_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_PRINCIPAL_PERIOD_DIALOG_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_CHECK_MENU_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_WRITE_OFF_OVERLAY_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill #${REESTR_DZ_WRITE_OFF_COMMENT_CONFIRM_ID},
        html.dup-ui-hide-reestr-dz-principal-autofill .pdf-status,
        html.dup-ui-hide-reestr-dz-principal-autofill .${REESTR_DZ_WRITE_OFF_HIGHLIGHT_CLASS},
        html.dup-ui-hide-reestr-dz-principal-autofill .${REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS},
        html.dup-ui-hide-reestr-dz-principal-autofill .${REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS},
        html.dup-ui-hide-reestr-dz-principal-autofill .${REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS},
        html.dup-ui-hide-reestr-dz-principal-autofill .${REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS} {
          display: none !important;
        }
      `
    },
    {
      key: 'callCenterRegistrySearch',
      storageKey: 'dup_ui_show_call_center_registry_search',
      label: 'Поиск в реестрах взыскания',
      description: 'Кнопка поиска абонентов в реестрах колл-центра и окно результатов.',
      hideClass: 'dup-ui-hide-call-center-registry-search',
      hideCss: `
        html.dup-ui-hide-call-center-registry-search .dup-call-center-registry-search-ui {
          display: none !important;
        }
      `
    },
    {
      key: 'identityVerificationTools',
      storageKey: 'dup_ui_show_identity_verification_tools',
      label: 'Проверка паспорта / ИНН / смерти',
      description: 'Команда StageJump и окно перекрёстной проверки данных.',
      hideClass: 'dup-ui-hide-identity-verification-tools',
      hideCss: `
        html.dup-ui-hide-identity-verification-tools .${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_VERIFY_IDENTITY}"],
        html.dup-ui-hide-identity-verification-tools .dup-identity-verification-ui {
          display: none !important;
        }
      `
    },
    {
      key: 'chatgptChatTools',
      storageKey: 'dup_ui_show_chatgpt_chat_tools',
      label: 'Управление чатами ChatGPT',
      description: 'Быстрые кнопки архива/удаления и окно массового управления чатами.',
      hideClass: 'dup-ui-hide-chatgpt-chat-tools',
      hideCss: `
        html.dup-ui-hide-chatgpt-chat-tools .dup-chatgpt-extension-ui {
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
  let reestrDzPrincipalRun = null;
  let reestrDzPrincipalObserver = null;
  let reestrDzPrincipalDailyWriteChain = Promise.resolve();
  let reestrDzWriteOffRun = null;
  let reestrDzWriteOffDailyWriteChain = Promise.resolve();
  let reestrDzWriteOffReviewState = null;
  const reestrDzBoundCheckButtons = new WeakSet();
  let stageJumpCachedMenuIndex = null;
  let stageJumpActionMenuEl = null;
  let stageJumpActionMenuAnchor = null;
  let fsspReestrGroupingCurrentHost = null;
  let fsspReestrGroupingPreference = null;
  let stageJumpLastStageLoadStartAtMs = 0;
  let stageJumpLastStageLoadType = '';
  let stageJumpLastStageLoadRequestUrl = '';
  let stageJumpLastEditDocStartAtMs = 0;
  let stageJumpLastEditDocStopAtMs = 0;
  let stageJumpLastStageTimerErrorAtMs = 0;
  let departmentDropdownShowHidden = false;
  let departmentDropdownInteractionLockUntilMs = 0;
  let departmentContainerModeEnabled = true;
  let departmentContainersSupported = false;
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
  const idCardCheckNavToastState = new WeakMap();
  let idCardCheckAutoReturnResumePending = false;
  let idCardCheckFailedReturnEntries = [];
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

  async function writePlainTextToClipboard(text) {
    const normalizedText = String(text || '');
    if (!normalizedText.trim()) {
      throw new Error('EMPTY_COPY_TEXT');
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(normalizedText);
        return;
      } catch (error) {
        // fallback to execCommand below
      }
    }

    await writeStageJumpPlainTextToClipboardFallback(normalizedText);
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
      hostname === 'pyramid.nesko-nv.ru' ||
      hostname === 'pyramid-vostok.electra.ru' ||
      hostname.endsWith('.pyramid.vostok-electra.ru') ||
      hostname.endsWith('.pyramid.nesko-nv.ru') ||
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

  function getExtensionVersionText() {
    try {
      const runtime = typeof chrome !== 'undefined' && chrome.runtime
        ? chrome.runtime
        : null;
      const manifest = runtime && typeof runtime.getManifest === 'function'
        ? runtime.getManifest()
        : null;
      const version = manifest && typeof manifest.version === 'string'
        ? manifest.version.trim()
        : '';
      return `Версия: ${version || 'неизвестна'}`;
    } catch (error) {
      return 'Версия: неизвестна';
    }
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
    return sendRuntimeMessage({
      action: 'DUP_SYNC_SET',
      data: {
        values,
        options: { reason: 'content-storage-set' }
      }
    }).then((response) => {
      if (response && response.success !== false) return true;
      return false;
    });
  }

  function chromeStorageRemove(keys) {
    return sendRuntimeMessage({
      action: 'DUP_SYNC_REMOVE',
      data: {
        keys,
        options: { reason: 'content-storage-remove' }
      }
    }).then((response) => {
      if (response && response.success !== false) return true;
      return false;
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

  function isReestrDzPrincipalPage() {
    return String(window.location.pathname || '').replace(/\/+$/, '') === REESTR_DZ_PRINCIPAL_PATH;
  }

  function normalizeReestrDzText(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  const REESTR_DZ_WRITE_OFF_EXCLUDED_CLAIMANTS = Object.freeze(new Set([
    'акционерное общество энергосбытовая компания восток',
    'ао эк восток',
    'ао эк восток г оренбург',
    'ао эк восток ноябрьск',
    'ао эк восток сургут'
  ]));

  function normalizeReestrDzClaimant(value) {
    return normalizeReestrDzText(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[«»„“”"'`()]/g, ' ')
      .replace(/[.,;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isReestrDzWriteOffExcludedClaimant(cell) {
    const value = cell && (cell.ClaimantName || cell.Claimant || cell.ClaimantFullName);
    return REESTR_DZ_WRITE_OFF_EXCLUDED_CLAIMANTS.has(normalizeReestrDzClaimant(value));
  }

  function buildReestrDzExcludedClaimantResult(candidate) {
    return {
      cell: candidate && candidate.cell && typeof candidate.cell === 'object' ? { ...candidate.cell } : {},
      result: 'Пропущено',
      description: 'Взыскатель относится к АО «ЭК «Восток»: поручение создаётся без фактического списания.',
      found: false,
      saved: false,
      skipped: true,
      informationWritten: false,
      error: false
    };
  }

  function hasReestrDzExactNoteLine(note, expectedLine) {
    const expected = normalizeReestrDzText(expectedLine);
    return String(note || '').split(/\r?\n/).some((line) => normalizeReestrDzText(line) === expected);
  }

  function getReestrDzCancellationComments(documentData) {
    const unique = new Map();
    const decisions = documentData && Array.isArray(documentData.cancellationDecisions)
      ? documentData.cancellationDecisions
      : [];
    decisions.forEach((item) => {
      const date = normalizeReestrDzText(item && item.date);
      const text = normalizeReestrDzText(item && item.text);
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return;
      const comment = `${date} поручение к реестру аннулировано.${text ? ` ${text}` : ''}`;
      unique.set(normalizeReestrDzText(comment), comment);
    });
    return Array.from(unique.values());
  }

  async function applyReestrDzCancellationComments(run, candidate, cell, documentData, saveComment) {
    let updatedCell = cell && typeof cell === 'object' ? { ...cell } : {};
    for (const comment of getReestrDzCancellationComments(documentData)) {
      if (hasReestrDzExactNoteLine(updatedCell.Note, comment)) continue;
      updatedCell = await saveComment(run, candidate, updatedCell, comment);
    }
    return updatedCell;
  }

  function parseReestrDzDate(value) {
    const match = normalizeReestrDzText(value).match(/(?:^|\D)(\d{2})\.(\d{2})\.(\d{4})(?:\D|$)/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return timestamp;
  }

  function formatReestrDzPeriodMask(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 16);
    const formatDateDigits = (part) => [part.slice(0, 2), part.slice(2, 4), part.slice(4, 8)].filter(Boolean).join('.');
    const first = formatDateDigits(digits.slice(0, 8));
    const secondDigits = digits.slice(8);
    return secondDigits ? `${first}-${formatDateDigits(secondDigits)}` : first;
  }

  function parseReestrDzPeriod(value) {
    const text = normalizeReestrDzText(value);
    if (!text) return null;
    const match = text.match(/^(\d{2}\.\d{2}\.\d{4})-(\d{2}\.\d{2}\.\d{4})$/);
    if (!match) throw new Error('Введите обе даты по маске дд.мм.гггг-дд.мм.гггг.');
    const from = parseReestrDzDate(match[1]);
    const to = parseReestrDzDate(match[2]);
    if (from === null || to === null) throw new Error('Проверьте календарные даты периода.');
    if (from > to) throw new Error('Начало периода не может быть позже его окончания.');
    return { from, to, text };
  }

  function getReestrDzPrincipalLocalDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function cloneReestrDzPrincipalStorageValue(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function readReestrDzPrincipalLocalStorage() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([REESTR_DZ_PRINCIPAL_DAILY_STORAGE_KEY], (result) => {
          void (chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '');
          resolve(result && result[REESTR_DZ_PRINCIPAL_DAILY_STORAGE_KEY] || null);
        });
      } catch (error) {
        resolve(null);
      }
    });
  }

  function writeReestrDzPrincipalLocalStorage(store) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [REESTR_DZ_PRINCIPAL_DAILY_STORAGE_KEY]: store }, () => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
          resolve(!runtimeError);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function normalizeReestrDzPrincipalDailyStore(rawStore) {
    const dateKey = getReestrDzPrincipalLocalDateKey();
    const raw = rawStore && typeof rawStore === 'object' ? rawStore : {};
    if (raw.dateKey !== dateKey || raw.version !== REESTR_DZ_PRINCIPAL_DAILY_STORAGE_VERSION) {
      return {
        version: REESTR_DZ_PRINCIPAL_DAILY_STORAGE_VERSION,
        dateKey,
        departments: {}
      };
    }
    return {
      version: REESTR_DZ_PRINCIPAL_DAILY_STORAGE_VERSION,
      dateKey,
      departments: raw.departments && typeof raw.departments === 'object' ? { ...raw.departments } : {}
    };
  }

  async function updateReestrDzPrincipalDailyStore(mutator) {
    reestrDzPrincipalDailyWriteChain = reestrDzPrincipalDailyWriteChain.catch(() => null).then(async () => {
      const store = normalizeReestrDzPrincipalDailyStore(await readReestrDzPrincipalLocalStorage());
      const nextStore = typeof mutator === 'function' ? mutator(store) || store : store;
      const saved = await writeReestrDzPrincipalLocalStorage(nextStore);
      return { store: nextStore, saved };
    });
    return reestrDzPrincipalDailyWriteChain;
  }

  async function getReestrDzPrincipalDailyDepartment(depid) {
    await reestrDzPrincipalDailyWriteChain.catch(() => null);
    const store = normalizeReestrDzPrincipalDailyStore(await readReestrDzPrincipalLocalStorage());
    const department = store.departments[String(depid || '')];
    return department && typeof department === 'object'
      ? cloneReestrDzPrincipalStorageValue(department, { processed: {}, activeRun: null })
      : { processed: {}, activeRun: null };
  }

  function serializeReestrDzPrincipalRun(run) {
    return cloneReestrDzPrincipalStorageValue({
      status: run.status,
      gridState: run.gridState,
      candidates: run.candidates,
      results: run.results,
      nextIndex: Number.isInteger(run.nextIndex) ? run.nextIndex : 0,
      currentIndex: Number.isInteger(run.currentIndex) ? run.currentIndex : 0,
      department: run.department,
      period: run.period,
      metaText: run.metaText,
      stage: run.stage,
      warning: run.warning,
      parallelWorkers: normalizeReestrDzParallelWorkers(run.parallelWorkers),
      preparedResults: run.preparedResults,
      preparedThroughIndex: Number.isInteger(run.preparedThroughIndex) ? run.preparedThroughIndex : 0,
      recoverableError: run.recoverableError === true,
      updatedAt: Date.now()
    }, null);
  }

  async function persistReestrDzPrincipalDailyRun(run) {
    if (!run || !run.department || !run.department.depid) return false;
    const depid = String(run.department.depid);
    const snapshot = serializeReestrDzPrincipalRun(run);
    const completed = run.status === 'completed';
    const result = await updateReestrDzPrincipalDailyStore((store) => {
      const previous = store.departments[depid] && typeof store.departments[depid] === 'object'
        ? store.departments[depid]
        : {};
      const processed = previous.processed && typeof previous.processed === 'object'
        ? { ...previous.processed }
        : {};
      (Array.isArray(run.results) ? run.results : []).forEach((item) => {
        if (!item || item.error === true || !item.id) return;
        processed[String(item.id)] = {
          id: String(item.id),
          result: normalizeReestrDzText(item.result),
          description: normalizeReestrDzText(item.description),
          updatedAt: Date.now()
        };
      });
      store.departments[depid] = {
        department: cloneReestrDzPrincipalStorageValue(run.department, {}),
        processed,
        activeRun: completed ? null : snapshot,
        updatedAt: Date.now()
      };
      return store;
    });
    const saved = !!(result && result.saved);
    run.storageWarning = saved ? '' : 'Не удалось сохранить дневную точку продолжения в памяти Chrome.';
    syncReestrDzPrincipalOverlay(run);
    return saved;
  }

  async function discardReestrDzPrincipalActiveRun(depid) {
    return updateReestrDzPrincipalDailyStore((store) => {
      const key = String(depid || '');
      const previous = store.departments[key] && typeof store.departments[key] === 'object'
        ? store.departments[key]
        : {};
      store.departments[key] = {
        ...previous,
        activeRun: null,
        updatedAt: Date.now()
      };
      return store;
    });
  }

  function restoreReestrDzPrincipalRun(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.candidates) || !snapshot.candidates.length) return null;
    const nextIndex = Math.max(0, Number.parseInt(String(snapshot.nextIndex || 0), 10) || 0);
    if (nextIndex >= snapshot.candidates.length) return null;
    const wasError = snapshot.status === 'error';
    const candidates = cloneReestrDzPrincipalStorageValue(snapshot.candidates, []);
    return {
      status: wasError ? 'error' : 'running',
      paused: !wasError,
      pauseReason: wasError ? '' : 'manual',
      resumeWaiters: [],
      controller: new AbortController(),
      gridState: cloneReestrDzPrincipalStorageValue(snapshot.gridState, { lastpage: 1 }),
      candidates,
      results: cloneReestrDzPrincipalStorageValue(snapshot.results, []),
      nextIndex,
      currentIndex: nextIndex,
      current: candidates[nextIndex] || null,
      department: cloneReestrDzPrincipalStorageValue(snapshot.department, getReestrDzCurrentDepartment()),
      period: cloneReestrDzPrincipalStorageValue(snapshot.period, null),
      parallelWorkers: normalizeReestrDzParallelWorkers(snapshot.parallelWorkers),
      preparedResults: cloneReestrDzPrincipalStorageValue(snapshot.preparedResults, {}),
      preparedThroughIndex: Math.max(nextIndex, Number.parseInt(String(snapshot.preparedThroughIndex || nextIndex), 10) || nextIndex),
      overlayDismissed: false,
      reportDownloaded: false,
      recoverableError: wasError,
      canContinue: true,
      stage: wasError
        ? `Восстановлена ошибка на строке № ${candidates[nextIndex] && candidates[nextIndex].id || '—'}. Нажмите «Продолжить».`
        : `Восстановлена дневная сессия. Следующая строка № ${candidates[nextIndex] && candidates[nextIndex].id || '—'}.`,
      warning: wasError ? normalizeReestrDzText(snapshot.warning) : '',
      metaText: normalizeReestrDzText(snapshot.metaText) || 'Восстановленная дневная сессия'
    };
  }

  function isReestrDzRowInPeriod(cell, period) {
    if (!period) return true;
    const timestamp = parseReestrDzDate(cell && cell.RequestDate);
    return timestamp !== null && timestamp >= period.from && timestamp <= period.to;
  }

  function normalizeReestrDzParallelWorkers(value) {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(parsed) ? Math.min(5, Math.max(1, parsed)) : REESTR_DZ_PARALLEL_WORKERS_DEFAULT;
  }

  async function getReestrDzParallelWorkersPreference() {
    const stored = await chromeStorageGet([REESTR_DZ_PARALLEL_WORKERS_STORAGE_KEY]).catch(() => ({}));
    return normalizeReestrDzParallelWorkers(stored && stored[REESTR_DZ_PARALLEL_WORKERS_STORAGE_KEY]);
  }

  async function saveReestrDzParallelWorkersPreference(value) {
    const parallelWorkers = normalizeReestrDzParallelWorkers(value);
    const saved = await chromeStorageSet({ [REESTR_DZ_PARALLEL_WORKERS_STORAGE_KEY]: parallelWorkers }).catch(() => false);
    if (!saved) {
      await new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [REESTR_DZ_PARALLEL_WORKERS_STORAGE_KEY]: parallelWorkers }, () => resolve());
        } catch (error) {
          resolve();
        }
      });
    }
    return parallelWorkers;
  }

  function normalizeReestrDzWriteOffCommentRule(value) {
    return normalizeReestrDzText(value).toLocaleLowerCase('ru-RU');
  }

  function normalizeReestrDzWriteOffCommentSkipRules(value) {
    const rules = Array.isArray(value) ? value : [];
    const unique = new Map();
    rules.forEach((rule) => {
      const text = normalizeReestrDzText(rule);
      const normalized = normalizeReestrDzWriteOffCommentRule(text);
      if (normalized.length < 3 || unique.has(normalized)) return;
      unique.set(normalized, text);
    });
    return Array.from(unique.values());
  }

  async function getReestrDzWriteOffCommentSkipRules() {
    const stored = await chromeStorageGet([REESTR_DZ_WRITE_OFF_COMMENT_SKIP_RULES_STORAGE_KEY]).catch(() => ({}));
    return normalizeReestrDzWriteOffCommentSkipRules(
      stored && stored[REESTR_DZ_WRITE_OFF_COMMENT_SKIP_RULES_STORAGE_KEY]
    );
  }

  async function saveReestrDzWriteOffCommentSkipRules(value) {
    const rules = normalizeReestrDzWriteOffCommentSkipRules(value);
    const saved = await chromeStorageSet({ [REESTR_DZ_WRITE_OFF_COMMENT_SKIP_RULES_STORAGE_KEY]: rules }).catch(() => false);
    if (saved) return rules;
    const fallbackSaved = await new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [REESTR_DZ_WRITE_OFF_COMMENT_SKIP_RULES_STORAGE_KEY]: rules }, () => {
          resolve(!(chrome.runtime && chrome.runtime.lastError));
        });
      } catch (error) {
        resolve(false);
      }
    });
    if (!fallbackSaved) throw new Error('Не удалось сохранить словарь автопропуска.');
    return rules;
  }

  function findReestrDzWriteOffCommentSkipRule(comment, rules) {
    const normalizedComment = normalizeReestrDzWriteOffCommentRule(comment);
    if (!normalizedComment) return '';
    return normalizeReestrDzWriteOffCommentSkipRules(rules).find((rule) =>
      normalizedComment.includes(normalizeReestrDzWriteOffCommentRule(rule))
    ) || '';
  }

  async function askReestrDzPrincipalPeriod() {
    ensureReestrDzPrincipalStyle();
    document.getElementById(REESTR_DZ_PRINCIPAL_PERIOD_DIALOG_ID)?.remove();
    const savedParallelWorkers = await getReestrDzParallelWorkersPreference();
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.id = REESTR_DZ_PRINCIPAL_PERIOD_DIALOG_ID;
      dialog.className = 'dup-reestr-dz-principal-ui';
      dialog.innerHTML = `
        <form class="dup-rdz-period-card">
          <h2 class="dup-rdz-period-title">Период проверки</h2>
          <p class="dup-rdz-period-help">Отбор по полю «Дата запуска поручения на списание». Оставьте поле пустым, чтобы проверить все строки.</p>
          <label class="dup-rdz-period-label" for="dup-rdz-period-input">Период</label>
          <input id="dup-rdz-period-input" class="dup-rdz-period-input" type="text" inputmode="numeric" maxlength="21" autocomplete="off" placeholder="дд.мм.гггг-дд.мм.гггг" aria-describedby="dup-rdz-period-error">
          <label class="dup-rdz-period-label" for="dup-rdz-workers-input">Параллельных проверок WSS</label>
          <select id="dup-rdz-workers-input" class="dup-rdz-period-input" aria-describedby="dup-rdz-period-error">
            ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}"${value === savedParallelWorkers ? ' selected' : ''}>${value}</option>`).join('')}
          </select>
          <div id="dup-rdz-period-error" class="dup-rdz-period-error" aria-live="polite"></div>
          <div class="dup-rdz-period-actions">
            <button type="button" class="btn btn-default btn-sm" data-action="cancel">Отмена</button>
            <button type="submit" class="btn btn-primary btn-sm">Продолжить</button>
          </div>
        </form>`;
      const form = dialog.querySelector('form');
      const input = dialog.querySelector('#dup-rdz-period-input');
      const workersInput = dialog.querySelector('#dup-rdz-workers-input');
      const error = dialog.querySelector('.dup-rdz-period-error');
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown, true);
        dialog.remove();
        resolve(result);
      };
      const onKeydown = (event) => {
        if (event.key === 'Escape') finish({ cancelled: true, period: null });
      };
      input.addEventListener('input', () => {
        input.value = formatReestrDzPeriodMask(input.value);
        error.textContent = '';
      });
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Backspace' || input.selectionStart !== input.selectionEnd || !input.selectionStart) return;
        const cursor = input.selectionStart;
        if (!/[.\-]/.test(input.value.charAt(cursor - 1))) return;
        event.preventDefault();
        const digits = input.value.replace(/\D/g, '').split('');
        const digitIndex = input.value.slice(0, cursor - 1).replace(/\D/g, '').length - 1;
        if (digitIndex >= 0) digits.splice(digitIndex, 1);
        input.value = formatReestrDzPeriodMask(digits.join(''));
        input.setSelectionRange(input.value.length, input.value.length);
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          const period = parseReestrDzPeriod(input.value);
          const parallelWorkers = await saveReestrDzParallelWorkersPreference(workersInput && workersInput.value);
          finish({ cancelled: false, period, parallelWorkers });
        } catch (validationError) {
          error.textContent = validationError && validationError.message ? validationError.message : String(validationError);
          input.focus();
        }
      });
      dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => finish({ cancelled: true, period: null }));
      document.addEventListener('keydown', onKeydown, true);
      (document.body || document.documentElement).appendChild(dialog);
      input.focus();
    });
  }

  function ensureReestrDzPrincipalStyle() {
    if (document.getElementById(REESTR_DZ_PRINCIPAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = REESTR_DZ_PRINCIPAL_STYLE_ID;
    style.textContent = `
      #${REESTR_DZ_PRINCIPAL_PERIOD_DIALOG_ID} {
        position: fixed;
        z-index: 2147483001;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(20, 31, 43, .48);
        font-family: Arial, sans-serif;
      }
      .dup-rdz-period-card {
        width: min(470px, calc(100vw - 32px));
        padding: 18px 20px 16px;
        border: 1px solid #b9c2cb;
        border-radius: 4px;
        background: #fff;
        color: #333;
        box-shadow: 0 16px 46px rgba(15, 33, 52, .28);
      }
      .dup-rdz-period-title { margin: 0 0 7px; color: #333; font-size: 17px; font-weight: 600; }
      .dup-rdz-period-help { margin: 0 0 13px; color: #68727d; font-size: 12px; line-height: 1.45; }
      .dup-rdz-period-label { display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600; }
      .dup-rdz-period-input {
        box-sizing: border-box;
        width: 100%;
        height: 34px;
        padding: 6px 9px;
        border: 1px solid #aaa;
        border-radius: 3px;
        color: #333;
        font: 14px/1.2 Consolas, monospace;
      }
      .dup-rdz-period-input:focus { border-color: #337ab7; outline: 0; box-shadow: 0 0 0 2px rgba(51,122,183,.14); }
      .dup-rdz-period-input + .dup-rdz-period-label { margin-top: 12px; }
      .dup-rdz-period-error { min-height: 17px; margin-top: 5px; color: #c9302c; font-size: 12px; }
      .dup-rdz-period-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 10px; }
      #${REESTR_DZ_CHECK_MENU_ID} {
        position: fixed;
        z-index: 2147483002;
        width: 268px;
        padding: 5px;
        border: 1px solid #aeb8c1;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 12px 32px rgba(20, 35, 50, .22);
        font-family: "Segoe UI", sans-serif;
      }
      #${REESTR_DZ_CHECK_MENU_ID} button {
        display: grid;
        grid-template-columns: 24px 1fr;
        gap: 8px;
        width: 100%;
        padding: 9px 10px;
        border: 0;
        border-radius: 3px;
        background: transparent;
        color: #293846;
        text-align: left;
        cursor: pointer;
      }
      #${REESTR_DZ_CHECK_MENU_ID} button:hover,
      #${REESTR_DZ_CHECK_MENU_ID} button:focus { background: #edf3f8; outline: 0; }
      #${REESTR_DZ_CHECK_MENU_ID} .fa { margin-top: 2px; color: #337ab7; font-size: 16px; text-align: center; }
      #${REESTR_DZ_CHECK_MENU_ID} strong { display: block; font-size: 12px; font-weight: 600; }
      #${REESTR_DZ_CHECK_MENU_ID} small { display: block; margin-top: 2px; color: #71808d; font-size: 10px; line-height: 1.3; }
      #${REESTR_DZ_PRINCIPAL_OVERLAY_ID} {
        --dup-rdz-accent: #ffb400;
        --dup-rdz-panel: #0f2134;
        position: fixed;
        z-index: 2147483000;
        top: 82px;
        right: 22px;
        width: min(390px, calc(100vw - 32px));
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, .16);
        border-left: 6px solid var(--dup-rdz-accent);
        border-radius: 7px;
        background:
          linear-gradient(135deg, rgba(255,255,255,.055), transparent 44%),
          repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0, rgba(255,255,255,.018) 1px, transparent 1px, transparent 5px),
          var(--dup-rdz-panel);
        color: #f6f2e8;
        font-family: Bahnschrift, "Segoe UI Variable", sans-serif;
        box-shadow: 0 18px 48px rgba(3, 15, 28, .36);
      }
      #${REESTR_DZ_PRINCIPAL_OVERLAY_ID}[data-state="paused"] { --dup-rdz-accent: #55b7d2; }
      #${REESTR_DZ_PRINCIPAL_OVERLAY_ID}[data-state="attention"],
      #${REESTR_DZ_PRINCIPAL_OVERLAY_ID}[data-state="error"] {
        --dup-rdz-accent: #ff3f34;
        --dup-rdz-panel: #321719;
        animation: dup-rdz-attention-pulse 1.3s ease-in-out 2;
      }
      #${REESTR_DZ_PRINCIPAL_OVERLAY_ID}[data-state="completed"] { --dup-rdz-accent: #58c78c; }
      @keyframes dup-rdz-attention-pulse {
        50% { box-shadow: 0 18px 52px rgba(255, 63, 52, .46); }
      }
      .dup-rdz-principal-head {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 9px;
        padding: 16px 17px 12px;
        border-bottom: 1px solid rgba(255,255,255,.12);
      }
      .dup-rdz-principal-kicker {
        color: var(--dup-rdz-accent);
        font: 700 10px/1 Bahnschrift, sans-serif;
        letter-spacing: .18em;
        text-transform: uppercase;
      }
      .dup-rdz-principal-title {
        margin-top: 5px;
        font: 650 18px/1.15 Bahnschrift, sans-serif;
      }
      .dup-rdz-principal-badge {
        align-self: start;
        padding: 5px 8px;
        border: 1px solid color-mix(in srgb, var(--dup-rdz-accent) 65%, transparent);
        border-radius: 3px;
        color: var(--dup-rdz-accent);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .dup-rdz-principal-close {
        align-self: start;
        display: grid;
        place-items: center;
        width: 25px;
        height: 25px;
        padding: 0;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 3px;
        background: transparent;
        color: #dbe4ec;
        font: 700 18px/1 "Segoe UI", sans-serif;
        cursor: pointer;
      }
      .dup-rdz-principal-close:hover { border-color: var(--dup-rdz-accent); color: var(--dup-rdz-accent); }
      .dup-rdz-principal-body { padding: 14px 17px 16px; }
      .dup-rdz-principal-current {
        display: grid;
        grid-template-columns: 76px 1fr;
        gap: 12px;
        align-items: center;
        min-height: 58px;
      }
      .dup-rdz-principal-number {
        color: #fff;
        font: 700 27px/1 Bahnschrift, sans-serif;
        letter-spacing: -.03em;
      }
      .dup-rdz-principal-meta {
        color: #b9c8d6;
        font-size: 11px;
        line-height: 1.45;
      }
      .dup-rdz-principal-stage {
        margin-top: 11px;
        color: #fff;
        font-size: 13px;
        line-height: 1.35;
      }
      .dup-rdz-principal-progress {
        height: 6px;
        margin: 12px 0 13px;
        overflow: hidden;
        border-radius: 1px;
        background: rgba(255,255,255,.12);
      }
      .dup-rdz-principal-progress > span {
        display: block;
        width: 0;
        height: 100%;
        background: var(--dup-rdz-accent);
        transition: width .28s ease;
      }
      .dup-rdz-principal-stats {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
      }
      .dup-rdz-principal-stat {
        padding: 8px 6px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.035);
        text-align: center;
      }
      .dup-rdz-principal-stat strong {
        display: block;
        color: #fff;
        font-size: 17px;
        line-height: 1;
      }
      .dup-rdz-principal-stat span {
        display: block;
        margin-top: 5px;
        color: #91a6b8;
        font-size: 9px;
        letter-spacing: .05em;
        text-transform: uppercase;
      }
      .dup-rdz-principal-warning {
        margin-top: 11px;
        padding: 9px 10px;
        border: 1px solid rgba(255, 63, 52, .55);
        background: rgba(255, 63, 52, .12);
        color: #ffd7d3;
        font-size: 12px;
        line-height: 1.4;
      }
      .dup-rdz-principal-warning:empty { display: none; }
      .dup-rdz-principal-actions {
        display: flex;
        gap: 8px;
        margin-top: 13px;
      }
      .dup-rdz-principal-action {
        min-height: 32px;
        padding: 6px 12px;
        border: 1px solid rgba(255,255,255,.24);
        border-radius: 3px;
        background: transparent;
        color: #f6f2e8;
        font: 650 11px/1 Bahnschrift, sans-serif;
        letter-spacing: .03em;
        cursor: pointer;
      }
      .dup-rdz-principal-action:hover:not([disabled]) { border-color: var(--dup-rdz-accent); color: var(--dup-rdz-accent); }
      .dup-rdz-principal-action[disabled] { opacity: .34; cursor: default; }
      .dup-rdz-principal-action[data-action="report"] {
        margin-left: auto;
        min-width: 38px;
        padding-inline: 8px;
        font-size: 17px;
      }
      .dup-rdz-principal-action[hidden] { display: none; }
      #${REESTR_DZ_WRITE_OFF_OVERLAY_ID} {
        --dup-wo-accent: #e59b20;
        position: fixed;
        z-index: 2147483003;
        top: 70px;
        right: 18px;
        width: min(350px, calc(100vw - 24px));
        overflow: hidden;
        border: 1px solid #aeb8c1;
        border-top: 4px solid var(--dup-wo-accent);
        border-radius: 5px;
        background: #f8fafb;
        color: #273746;
        font-family: Bahnschrift, "Segoe UI", sans-serif;
        box-shadow: 0 15px 42px rgba(20, 35, 50, .28);
      }
      #${REESTR_DZ_WRITE_OFF_OVERLAY_ID}[data-state="error"] { --dup-wo-accent: #d43f3a; }
      #${REESTR_DZ_WRITE_OFF_OVERLAY_ID}[data-state="completed"] { --dup-wo-accent: #3d9b67; }
      .dup-wo-head {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: start;
        padding: 10px 12px 9px;
        border-bottom: 1px solid #d7dde2;
        background: #233646;
        color: #fff;
        cursor: move;
        user-select: none;
      }
      .dup-wo-head strong { display: block; font-size: 14px; font-weight: 650; }
      .dup-wo-head small { display: block; margin-top: 3px; color: #b9c7d2; font-size: 10px; }
      .dup-wo-close { width: 24px; height: 24px; padding: 0; border: 1px solid #607586; border-radius: 3px; background: transparent; color: #fff; font-size: 17px; cursor: pointer; }
      .dup-wo-body { max-height: calc(100vh - 130px); padding: 10px 12px 12px; overflow: auto; }
      .dup-wo-stage { margin-bottom: 9px; padding: 7px 8px; border-left: 3px solid var(--dup-wo-accent); background: #eef2f5; font-size: 11px; line-height: 1.35; }
      .dup-wo-grid { display: grid; grid-template-columns: 104px 1fr; gap: 5px 8px; align-items: baseline; font-size: 11px; }
      .dup-wo-grid dt { color: #73818c; }
      .dup-wo-grid dd { min-width: 0; margin: 0; color: #1f2f3c; font-weight: 600; overflow-wrap: anywhere; }
      .dup-wo-decision { color: #8b5a09 !important; }
      .dup-wo-reference { margin-top: 9px; padding: 8px 9px; border: 1px solid #d5dde2; border-radius: 3px; background: #f4f7f8; }
      .dup-wo-reference-title { margin-bottom: 6px; color: #526776; font: 650 9px/1 Bahnschrift, "Segoe UI", sans-serif; letter-spacing: .045em; text-transform: uppercase; }
      .dup-wo-amounts { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 9px; }
      .dup-wo-amount { display: flex; justify-content: space-between; gap: 7px; min-width: 0; font-size: 10px; }
      .dup-wo-amount[data-amount-info="total"] { grid-column: 1 / -1; padding-bottom: 5px; border-bottom: 1px solid #d5dde2; }
      .dup-wo-amount span { color: #71808a; }
      .dup-wo-amount strong { color: #243947; font-weight: 650; white-space: nowrap; }
      .dup-wo-docs, .dup-wo-files { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
      .dup-wo-files { max-height: 104px; padding-right: 2px; overflow: auto; }
      .dup-wo-docs button, .dup-wo-files button {
        min-height: 27px;
        padding: 4px 8px;
        border: 1px solid #b9c4cc;
        border-radius: 3px;
        background: #fff;
        color: #315b78;
        font: 600 10px/1.2 Bahnschrift, "Segoe UI", sans-serif;
        cursor: pointer;
      }
      .dup-wo-docs button[aria-current="page"] { border-color: #d38c18; background: #fff4d9; color: #6f4807; }
      .dup-wo-form { display: grid; gap: 8px; margin-top: 11px; padding-top: 10px; border-top: 1px solid #d7dde2; }
      .dup-wo-field label { display: block; margin-bottom: 4px; color: #536571; font-size: 10px; font-weight: 600; }
      .dup-wo-field input { box-sizing: border-box; width: 100%; height: 31px; padding: 5px 8px; border: 1px solid #aeb8c1; border-radius: 3px; background: #fff; color: #1f2f3c; font: 12px/1 Consolas, monospace; }
      .dup-wo-field input:focus { border-color: #337ab7; outline: 0; box-shadow: 0 0 0 2px rgba(51,122,183,.13); }
      .dup-wo-comment-mode { margin-top: 11px; padding-top: 10px; border-top: 1px solid #d7dde2; animation: dupWoCommentReveal .18s ease-out both; }
      .dup-wo-comment-mode label { display: block; margin-bottom: 5px; color: #536571; font-size: 10px; font-weight: 650; }
      .dup-wo-comment-mode textarea { box-sizing: border-box; width: 100%; min-height: 94px; padding: 8px 9px; resize: vertical; border: 1px solid #aeb8c1; border-radius: 3px; background: #fffdf6; color: #283b48; font: 11px/1.45 "Segoe UI", sans-serif; }
      .dup-wo-comment-mode textarea:focus { border-color: #c58218; outline: 0; box-shadow: 0 0 0 2px rgba(197,130,24,.15); }
      .dup-wo-comment-hint { margin-top: 5px; color: #7c6a4a; font-size: 9px; line-height: 1.35; }
      .dup-wo-mismatch { margin-bottom: 10px; padding: 8px 9px; border-left: 3px solid #d9534f; background: #fff0ef; color: #8c2925; font-size: 10px; line-height: 1.4; }
      .dup-wo-substitute { margin-top: 10px; padding: 8px 9px; border: 1px solid #e2c685; border-radius: 3px; background: #fffaf0; color: #5f481a; font-size: 10px; line-height: 1.4; }
      .dup-wo-actions button[data-action="confirm-decision"] { margin-left: auto; border-color: #2b7d46; background: #36975a; color: #fff; }
      .dup-wo-actions button[data-action="finish-decision-skip"] { border-color: #2b7d46; background: #36975a; color: #fff; }
      .dup-wo-error { min-height: 15px; color: #bd302c; font-size: 10px; line-height: 1.35; }
      .dup-wo-actions { display: flex; gap: 6px; margin-top: 9px; }
      .dup-wo-actions button { min-height: 30px; padding: 5px 10px; border: 1px solid #aeb8c1; border-radius: 3px; background: #fff; color: #344b5d; font: 600 11px/1 Bahnschrift, "Segoe UI", sans-serif; cursor: pointer; }
      .dup-wo-actions button[data-action="done"] { margin-left: auto; border-color: #286090; background: #337ab7; color: #fff; }
      .dup-wo-actions button[data-action="skip-order"] { border-color: #c58218; background: #fff5dc; color: #79500c; }
      .dup-wo-actions button[data-action="verify-decision"] { margin-left: auto; border-color: #b13a34; background: #d9534f; color: #fff; }
      .dup-wo-actions button[data-action="cancel-skip"] { margin-left: auto; border-color: #286090; background: #337ab7; color: #fff; }
      .dup-wo-actions button[data-action="save-comment"] { border-color: #2b7d46; background: #36975a; color: #fff; }
      @keyframes dupWoCommentReveal { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      .dup-wo-actions button[data-action="report"] { margin-left: auto; border-color: #3c763d; background: #4f8a52; color: #fff; }
      .dup-wo-actions button[disabled] { opacity: .45; cursor: default; }
      #${REESTR_DZ_WRITE_OFF_COMMENT_CONFIRM_ID} {
        position: fixed;
        z-index: 2147483006;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(19, 31, 42, .56);
        font-family: Bahnschrift, "Segoe UI", sans-serif;
      }
      .dup-wo-confirm-card { box-sizing: border-box; width: min(500px, calc(100vw - 28px)); max-height: calc(100vh - 36px); overflow: auto; border: 1px solid #aeb8c1; border-top: 4px solid #e59b20; border-radius: 6px; background: #f8fafb; color: #273746; box-shadow: 0 18px 52px rgba(15, 27, 38, .38); }
      .dup-wo-confirm-head { padding: 12px 14px 10px; background: #233646; color: #fff; }
      .dup-wo-confirm-head strong { display: block; font-size: 15px; }
      .dup-wo-confirm-head small { display: block; margin-top: 4px; color: #c1ccd5; font-size: 10px; }
      .dup-wo-confirm-body { padding: 12px 14px 14px; }
      .dup-wo-confirm-grid { display: grid; grid-template-columns: 120px 1fr; gap: 6px 10px; margin: 0; font-size: 11px; }
      .dup-wo-confirm-grid dt { color: #73818c; }
      .dup-wo-confirm-grid dd { min-width: 0; margin: 0; font-weight: 600; overflow-wrap: anywhere; }
      .dup-wo-confirm-note { margin-top: 11px; padding: 9px 10px; border: 1px solid #d3dbe1; border-radius: 4px; background: #fff; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.45 "Segoe UI", sans-serif; }
      .dup-wo-confirm-question { margin: 12px 0 8px; font-size: 12px; font-weight: 650; }
      .dup-wo-confirm-actions { display: flex; justify-content: flex-end; gap: 7px; }
      .dup-wo-confirm-actions button { min-width: 78px; min-height: 32px; border: 1px solid #aeb8c1; border-radius: 4px; background: #fff; color: #344b5d; font: 650 11px/1 Bahnschrift, "Segoe UI", sans-serif; cursor: pointer; }
      .dup-wo-confirm-actions button[aria-pressed="true"] { border-color: #286090; outline: 2px solid rgba(51, 122, 183, .2); background: #337ab7; color: #fff; }
      .dup-wo-confirm-overlay .dup-wo-confirm-card { animation: dupWoConfirmEnter .24s cubic-bezier(.2,.8,.2,1) both; }
      .dup-wo-confirm-overlay .dup-wo-confirm-card.is-leaving { pointer-events: none; animation: dupWoConfirmLeave .18s ease-in both; }
      .dup-wo-confirm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .dup-wo-confirm-position { flex: 0 0 auto; padding: 5px 8px; border: 1px solid rgba(255,255,255,.22); border-radius: 999px; background: rgba(255,255,255,.08); color: #e8f0f5; font: 650 10px/1 Bahnschrift, "Segoe UI", sans-serif; white-space: nowrap; }
      .dup-wo-confirm-note-input { box-sizing: border-box; width: 100%; min-height: 88px; margin-top: 11px; padding: 9px 10px; resize: vertical; border: 1px solid #6f8798; border-radius: 4px; outline: 0; background: #fff; color: #1f3443; font: 11px/1.45 "Segoe UI", sans-serif; }
      .dup-wo-confirm-note-input:focus { border-color: #286090; box-shadow: 0 0 0 3px rgba(51,122,183,.16); }
      .dup-wo-confirm-validation { min-height: 16px; margin: 5px 0 0; color: #b7352d; font: 650 10px/1.35 "Segoe UI", sans-serif; }
      .dup-wo-confirm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
      .dup-wo-confirm-dictionary { border: 0; background: transparent; color: #286090; font: 650 10px/1 Bahnschrift, "Segoe UI", sans-serif; cursor: pointer; }
      .dup-wo-confirm-actions button[data-action="learn"] { border-color: #c88620; background: #fff8e8; color: #7d4b05; }
      .dup-wo-confirm-actions button[data-action="learn-cancel"], .dup-wo-dictionary-back { border-color: #286090; background: #337ab7; color: #fff; }
      .dup-wo-confirm-actions button[data-action="learn-save"] { border-color: #2b7d46; background: #36975a; color: #fff; }
      .dup-wo-dictionary-panel[hidden], .dup-wo-decision-panel[hidden] { display: none !important; }
      .dup-wo-dictionary-title { margin: 0; color: #233646; font: 700 13px/1.25 Bahnschrift, "Segoe UI", sans-serif; }
      .dup-wo-dictionary-help { margin: 5px 0 10px; color: #6f7f8a; font: 10px/1.4 "Segoe UI", sans-serif; }
      .dup-wo-dictionary-list { display: grid; gap: 6px; max-height: 255px; overflow: auto; }
      .dup-wo-dictionary-empty { padding: 18px 10px; border: 1px dashed #c8d1d8; border-radius: 4px; color: #7c8992; text-align: center; font-size: 11px; }
      .dup-wo-dictionary-row { display: grid; grid-template-columns: minmax(0,1fr) 30px 30px; gap: 5px; align-items: center; padding: 7px 8px; border: 1px solid #d5dde2; border-radius: 4px; background: #fff; }
      .dup-wo-dictionary-rule { min-width: 0; color: #263d4c; font: 600 11px/1.35 "Segoe UI", sans-serif; overflow-wrap: anywhere; }
      .dup-wo-dictionary-row button { width: 30px; height: 28px; padding: 0; border: 1px solid #c7d0d6; border-radius: 4px; background: #f7f9fa; cursor: pointer; }
      .dup-wo-dictionary-editor { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 6px; align-items: center; }
      .dup-wo-dictionary-editor input { min-width: 0; height: 30px; box-sizing: border-box; border: 1px solid #6f8798; border-radius: 4px; padding: 0 8px; font: 11px "Segoe UI", sans-serif; }
      .dup-wo-dictionary-editor button { min-width: 68px; height: 30px; border: 1px solid #aeb8c1; border-radius: 4px; font: 650 10px Bahnschrift, "Segoe UI", sans-serif; cursor: pointer; }
      .dup-wo-dictionary-editor [data-action="dictionary-edit-cancel"] { border-color: #286090; background: #337ab7; color: #fff; }
      .dup-wo-dictionary-editor [data-action="dictionary-edit-save"] { border-color: #2b7d46; background: #36975a; color: #fff; }
      .dup-wo-dictionary-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
      .dup-wo-dictionary-back { min-width: 86px; min-height: 32px; border-radius: 4px; cursor: pointer; font: 650 11px Bahnschrift, "Segoe UI", sans-serif; }
      @keyframes dupWoConfirmEnter { from { opacity: 0; transform: translate3d(34px,0,0) scale(.985); } to { opacity: 1; transform: translate3d(0,0,0) scale(1); } }
      @keyframes dupWoConfirmLeave { from { opacity: 1; transform: translate3d(0,0,0); } to { opacity: 0; transform: translate3d(-34px,0,0); } }
      @media (prefers-reduced-motion: reduce) { .dup-wo-comment-mode, .dup-wo-confirm-overlay .dup-wo-confirm-card, .dup-wo-confirm-overlay .dup-wo-confirm-card.is-leaving { animation-duration: .01ms; } }
      .${REESTR_DZ_WRITE_OFF_HIGHLIGHT_CLASS} { padding: 0 1px; border-radius: 2px; background: #ffe066 !important; color: #241b00 !important; box-shadow: 0 0 0 1px rgba(190,130,0,.25); }
      #list tr.${REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS} > td {
        background: #fff0a6 !important;
        color: #182531 !important;
        transition: background-color .18s ease;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS} > td:first-child {
        box-shadow: inset 6px 0 #f08b22;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS} > td {
        background: #ffd2cf !important;
        color: #381314 !important;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS} > td:first-child {
        box-shadow: inset 6px 0 #e9342b;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS} > td {
        background: #d9f2df !important;
        color: #173321 !important;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS} > td:first-child {
        box-shadow: inset 6px 0 #329957;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS} > td {
        background: #ffd2cf !important;
        color: #381314 !important;
      }
      #list tr.${REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS} > td:first-child {
        box-shadow: inset 6px 0 #e9342b;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createReestrDzPrincipalOverlay() {
    ensureReestrDzPrincipalStyle();
    const existing = document.getElementById(REESTR_DZ_PRINCIPAL_OVERLAY_ID);
    if (existing instanceof HTMLElement) return existing;
    const overlay = document.createElement('section');
    overlay.id = REESTR_DZ_PRINCIPAL_OVERLAY_ID;
    overlay.className = 'dup-reestr-dz-principal-ui';
    overlay.dataset.state = 'running';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="dup-rdz-principal-head">
        <div>
          <div class="dup-rdz-principal-kicker">ОВЗИД · контроль</div>
          <div class="dup-rdz-principal-title">Исходящие принципалу</div>
        </div>
        <div class="dup-rdz-principal-badge" data-role="badge">Подготовка</div>
        <button type="button" class="dup-rdz-principal-close" data-action="close" title="Закрыть" aria-label="Закрыть оверлей">×</button>
      </div>
      <div class="dup-rdz-principal-body">
        <div class="dup-rdz-principal-current">
          <div class="dup-rdz-principal-number" data-role="number">—</div>
          <div class="dup-rdz-principal-meta" data-role="meta">Собираю строки грида</div>
        </div>
        <div class="dup-rdz-principal-stage" data-role="stage">Подготовка запуска…</div>
        <div class="dup-rdz-principal-progress"><span data-role="progress"></span></div>
        <div class="dup-rdz-principal-stats">
          <div class="dup-rdz-principal-stat"><strong data-role="processed">0</strong><span>обработано</span></div>
          <div class="dup-rdz-principal-stat"><strong data-role="found">0</strong><span>найдено</span></div>
          <div class="dup-rdz-principal-stat"><strong data-role="saved">0</strong><span>сохранено</span></div>
          <div class="dup-rdz-principal-stat"><strong data-role="not-found">0</strong><span>не найдено</span></div>
          <div class="dup-rdz-principal-stat"><strong data-role="problems">0</strong><span>проблемы</span></div>
        </div>
        <div class="dup-rdz-principal-warning" data-role="warning"></div>
        <div class="dup-rdz-principal-actions">
          <button type="button" class="dup-rdz-principal-action" data-action="pause">Пауза</button>
          <button type="button" class="dup-rdz-principal-action" data-action="start" disabled>Продолжить</button>
          <button type="button" class="dup-rdz-principal-action" data-action="report" title="Сохранить отчёт в Excel" hidden>📊</button>
        </div>
      </div>`;
    overlay.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!(button instanceof HTMLButtonElement) || !reestrDzPrincipalRun) return;
      const action = String(button.dataset.action || '');
      if (action === 'pause') pauseReestrDzPrincipalRun(reestrDzPrincipalRun);
      if (action === 'start') {
        if (reestrDzPrincipalRun.status === 'error') continueReestrDzPrincipalAfterError(reestrDzPrincipalRun);
        else resumeReestrDzPrincipalRun(reestrDzPrincipalRun);
      }
      if (action === 'report') downloadReestrDzPrincipalReport(reestrDzPrincipalRun);
      if (action === 'close') {
        if (reestrDzPrincipalRun.status === 'completed') {
          reestrDzPrincipalRun = null;
        } else {
          reestrDzPrincipalRun.overlayDismissed = true;
        }
        overlay.remove();
      }
    });
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function getReestrDzPrincipalStats(run) {
    const results = run && Array.isArray(run.results) ? run.results : [];
    return {
      processed: results.length,
      found: results.filter((item) => item.found === true).length,
      saved: results.filter((item) => item.saved === true).length,
      notFound: results.filter((item) => item.result === 'Исходящий не найден').length,
      problems: results.filter((item) => item.error === true).length
    };
  }

  function syncReestrDzPrincipalOverlay(run) {
    if (!run) return;
    if (run.overlayDismissed) {
      document.getElementById(REESTR_DZ_PRINCIPAL_OVERLAY_ID)?.remove();
      return;
    }
    const overlay = createReestrDzPrincipalOverlay();
    const stats = getReestrDzPrincipalStats(run);
    const total = Array.isArray(run.candidates) ? run.candidates.length : 0;
    const current = run.current || null;
    const activeBatch = getReestrDzActiveBatchCandidates(run);
    const activeBatchLabel = activeBatch.map((candidate) => `№ ${candidate.id}`).join(', ');
    const progress = total ? Math.min(100, Math.round((stats.processed / total) * 100)) : 0;
    let state = 'running';
    let badge = 'Работа';
    if (run.status === 'completed') { state = 'completed'; badge = 'Готово'; }
    else if (run.status === 'error') { state = 'error'; badge = 'Ошибка'; }
    else if (run.pauseReason === 'attention') { state = 'attention'; badge = 'Проверить'; }
    else if (run.paused) { state = 'paused'; badge = 'Пауза'; }
    else if (run.status === 'preparing') { badge = 'Подготовка'; }
    overlay.dataset.state = state;
    const setText = (role, value) => {
      const element = overlay.querySelector(`[data-role="${role}"]`);
      if (element instanceof HTMLElement) element.textContent = String(value);
    };
    setText('badge', badge);
    setText('number', current ? `№ ${current.id}` : activeBatch.length ? activeBatchLabel : '—');
    setText('meta', current
      ? `${current.cell.RequestNumber || 'Поручение не указано'} · страница ${current.page} из ${run.gridState.lastpage || 1} · WSS ×${normalizeReestrDzParallelWorkers(run.parallelWorkers)}`
      : activeBatch.length
        ? `Активная группа · страница ${run.activeBatchPage || '—'} из ${run.gridState.lastpage || 1} · WSS ×${normalizeReestrDzParallelWorkers(run.parallelWorkers)}`
        : `${run.metaText || 'Собираю строки грида'} · WSS ×${normalizeReestrDzParallelWorkers(run.parallelWorkers)}`);
    setText('stage', run.stage || 'Подготовка запуска…');
    setText('processed', `${stats.processed}/${total}`);
    setText('found', stats.found);
    setText('saved', stats.saved);
    setText('not-found', stats.notFound);
    setText('problems', stats.problems);
    setText('warning', run.warning || run.storageWarning || '');
    const progressEl = overlay.querySelector('[data-role="progress"]');
    if (progressEl instanceof HTMLElement) progressEl.style.width = `${progress}%`;
    const pauseButton = overlay.querySelector('[data-action="pause"]');
    const startButton = overlay.querySelector('[data-action="start"]');
    const reportButton = overlay.querySelector('[data-action="report"]');
    if (pauseButton instanceof HTMLButtonElement) pauseButton.disabled = run.paused || ['completed', 'error'].includes(run.status);
    if (startButton instanceof HTMLButtonElement) {
      const canResumePause = run.paused && !['completed', 'error'].includes(run.status);
      const canRetryError = run.status === 'error' && run.recoverableError === true && run.canContinue !== false;
      startButton.textContent = 'Продолжить';
      startButton.disabled = !(canResumePause || canRetryError);
    }
    if (reportButton instanceof HTMLButtonElement) reportButton.hidden = run.status !== 'completed' || !run.results.length;
  }

  function updateReestrDzPrincipalStage(run, stage, warning = '') {
    if (!run) return;
    run.stage = String(stage || '');
    run.warning = String(warning || '');
    syncReestrDzPrincipalOverlay(run);
  }

  function pauseReestrDzPrincipalRun(run, options = {}) {
    if (!run || ['completed', 'error'].includes(run.status)) return;
    run.paused = true;
    run.pauseReason = options.attention ? 'attention' : 'manual';
    if (options.message) run.warning = String(options.message);
    if (!options.message && !options.attention) run.stage = 'Обработка приостановлена пользователем.';
    syncReestrDzPrincipalOverlay(run);
    void persistReestrDzPrincipalDailyRun(run);
  }

  function resumeReestrDzPrincipalRun(run) {
    if (!run || !run.paused || ['completed', 'error'].includes(run.status)) return;
    run.paused = false;
    run.pauseReason = '';
    run.warning = '';
    run.stage = run.current ? 'Возобновляю проверку текущей строки…' : 'Возобновляю обработку…';
    const waiters = Array.isArray(run.resumeWaiters) ? run.resumeWaiters.splice(0) : [];
    waiters.forEach((resolve) => resolve());
    syncReestrDzPrincipalOverlay(run);
  }

  function continueReestrDzPrincipalAfterError(run) {
    if (!run || run.status !== 'error' || run.recoverableError !== true || run.canContinue === false) return;
    const failedIndex = Number.isInteger(run.nextIndex) ? run.nextIndex : run.currentIndex;
    const failedCandidate = Number.isInteger(failedIndex) ? run.candidates[failedIndex] : run.current;
    for (let index = run.results.length - 1; index >= 0; index -= 1) {
      const item = run.results[index];
      if (item && item.error === true && (!failedCandidate || String(item.id) === String(failedCandidate.id))) {
        if (item.discoveryError === true && failedCandidate && run.preparedResults) {
          delete run.preparedResults[String(failedCandidate.id)];
        }
        run.results.splice(index, 1);
        break;
      }
    }
    run.status = 'running';
    run.paused = false;
    run.pauseReason = '';
    run.warning = '';
    run.recoverableError = false;
    run.canContinue = false;
    run.stage = failedCandidate
      ? `Повторяю строку № ${failedCandidate.id}; ранее обработанные строки пропущены…`
      : 'Продолжаю обработку с места остановки…';
    syncReestrDzPrincipalOverlay(run);
    setReestrDzPrincipalLaunchButtonDisabled(true);
    void runReestrDzPrincipalAutofill(run);
  }

  async function waitForReestrDzPrincipalResume(run) {
    while (run && run.paused) {
      await new Promise((resolve) => run.resumeWaiters.push(resolve));
    }
  }

  function clearReestrDzPrincipalRowHighlight() {
    document.querySelectorAll(`.${REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS}, .${REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS}, .${REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS}, .${REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS}`).forEach((row) => {
      row.classList.remove(
        REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS,
        REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS,
        REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS,
        REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS
      );
    });
  }

  function applyReestrDzBatchRowHighlights(run) {
    const states = run && run.activeBatchRowStates && typeof run.activeBatchRowStates === 'object'
      ? run.activeBatchRowStates
      : {};
    Object.entries(states).forEach(([rowId, state]) => {
      const row = findReestrDzPrincipalRow(rowId);
      if (!(row instanceof HTMLElement)) return;
      row.classList.add(REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS);
      row.classList.toggle(REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS, state === 'success');
      row.classList.toggle(REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS, state === 'error');
    });
  }

  function setReestrDzBatchRowResult(run, rowId, error = false) {
    if (!run || !rowId) return;
    if (!run.activeBatchRowStates || typeof run.activeBatchRowStates !== 'object' ||
      !Object.prototype.hasOwnProperty.call(run.activeBatchRowStates, String(rowId))) return;
    run.activeBatchRowStates[String(rowId)] = error ? 'error' : 'success';
    applyReestrDzBatchRowHighlights(run);
  }

  function getReestrDzActiveBatchCandidates(run) {
    return run && Array.isArray(run.activeBatchCandidates) ? run.activeBatchCandidates : [];
  }

  async function waitForReestrDzActiveBatchRows(page, candidates, timeoutMs = 20000) {
    const rowIds = (Array.isArray(candidates) ? candidates : []).map((candidate) => String(candidate && candidate.id || ''));
    const startedAt = Date.now();
    let stableChecks = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const pageInput = document.querySelector('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input');
      const currentPage = Math.max(1, Number.parseInt(pageInput && pageInput.value || '1', 10) || 1);
      const rows = rowIds.map((rowId) => findReestrDzPrincipalRow(rowId));
      const ready = currentPage === page && !isReestrDzGridLoading() &&
        rows.length === rowIds.length && rows.every((row) => row instanceof HTMLElement && row.isConnected);
      stableChecks = ready ? stableChecks + 1 : 0;
      if (stableChecks >= 3) return rows;
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    return null;
  }

  async function showReestrDzActiveBatch(run, candidates, waitForResume, sync, label) {
    const activeCandidates = (Array.isArray(candidates) ? candidates : [])
      .filter((candidate) => candidate && candidate.id && !isReestrDzWriteOffExcludedClaimant(candidate.cell));
    clearReestrDzPrincipalRowHighlight();
    run.activeBatchRowStates = Object.fromEntries(activeCandidates.map((candidate) => [String(candidate.id), 'pending']));
    run.activeBatchCandidates = activeCandidates;
    run.activeBatchPage = null;
    sync(run);
    if (!activeCandidates.length) return;

    const byPage = new Map();
    activeCandidates.forEach((candidate) => {
      const page = Math.max(1, Number.parseInt(String(candidate.page || 1), 10) || 1);
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page).push(candidate);
    });

    for (const [page, pageCandidates] of byPage.entries()) {
      await waitForResume(run);
      run.current = null;
      run.activeBatchPage = page;
      run.stage = `${label}: показываю строки № ${pageCandidates.map((candidate) => candidate.id).join(', ')} на странице ${page}…`;
      sync(run);
      const pageInput = document.querySelector('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input');
      const currentPage = Math.max(1, Number.parseInt(pageInput && pageInput.value || '1', 10) || 1);
      if (currentPage !== page) await setReestrDzGridPage(page);
      let visibleRows = await waitForReestrDzActiveBatchRows(page, pageCandidates, currentPage === page ? 3500 : 20000);
      if (!visibleRows) {
        run.stage = `${label}: повторно загружаю страницу ${page} и жду строки группы…`;
        sync(run);
        await setReestrDzGridPage(page, true);
        visibleRows = await waitForReestrDzActiveBatchRows(page, pageCandidates, 25000);
      }
      if (!visibleRows) {
        throw new Error(`Не удалось показать все активные строки группы на странице ${page}.`);
      }
      applyReestrDzBatchRowHighlights(run);
      const firstRow = visibleRows[0];
      firstRow.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
  }

  async function selectReestrDzPrincipalGridRow(row, candidate) {
    const startedAt = Date.now();
    let currentRow = row;
    while (Date.now() - startedAt < 10000) {
      if (!isReestrDzGridLoading()) {
        currentRow = findReestrDzPrincipalRow(candidate.id);
        const targetCheckbox = currentRow && currentRow.querySelector('input.cbox[type="checkbox"]');
        if (currentRow instanceof HTMLElement && targetCheckbox instanceof HTMLInputElement) {
          const response = await sendRuntimeMessage({
            action: 'REESTR_DZ_SELECT_GRID_ROW',
            data: { rowId: candidate.id }
          });
          await new Promise((resolve) => window.setTimeout(resolve, 120));
          const selectedIds = response && Array.isArray(response.selected) ? response.selected.map(String) : [];
          const checkedRows = Array.from(document.querySelectorAll('#list tr.jqgrow input.cbox[type="checkbox"]:checked'));
          if (response && response.success === true &&
              selectedIds.length === 1 && selectedIds[0] === String(candidate.id) &&
              checkedRows.length === 1 && checkedRows[0] === targetCheckbox &&
              targetCheckbox.checked && currentRow.isConnected) {
            return currentRow;
          }
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    throw new Error(`Пирамида не подтвердила выбор строки № ${candidate.id}.`);
  }

  function findReestrDzPrincipalRow(rowId) {
    const safeId = String(rowId || '').replace(/[^0-9]/g, '');
    return safeId ? document.querySelector(`#list tr[id="${safeId}"]`) : null;
  }

  async function getReestrDzGridState() {
    const response = await sendRuntimeMessage({ action: 'REESTR_DZ_GET_GRID_STATE' });
    if (response && response.success) return response;
    const pageInput = document.querySelector('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input');
    const rowSelect = document.querySelector('#pager .ui-pg-selbox, .ui-jqgrid-pager .ui-pg-selbox');
    const recordsText = normalizeReestrDzText(document.querySelector('#pager_right, .ui-paging-info')?.textContent);
    const recordsMatch = recordsText.match(/из\s+(\d+)/i);
    return {
      success: true,
      page: Math.max(1, Number.parseInt(pageInput && pageInput.value || '1', 10) || 1),
      rowNum: Math.max(1, Number.parseInt(rowSelect && rowSelect.value || '30', 10) || 30),
      records: recordsMatch ? Number.parseInt(recordsMatch[1], 10) : 0,
      lastpage: 1,
      sortname: 'CreateDate',
      sortorder: 'desc',
      postData: { _search: 'false' }
    };
  }

  function buildReestrDzGridDataUrl(gridState, options = {}) {
    const url = new URL('/ovzid/ReestrDz/data', window.location.origin);
    const postData = gridState && gridState.postData && typeof gridState.postData === 'object'
      ? gridState.postData
      : {};
    Object.entries(postData).forEach(([key, value]) => {
      if (value === undefined || value === null || typeof value === 'object') return;
      if (['rows', 'page', 'sidx', 'sord', 'nd'].includes(key)) return;
      url.searchParams.set(key, String(value));
    });
    url.searchParams.set('_search', String(options.search !== undefined ? options.search : postData._search || 'false'));
    url.searchParams.set('nd', String(Date.now()));
    url.searchParams.set('rows', String(options.rows || 2000));
    url.searchParams.set('page', String(options.page || 1));
    url.searchParams.set('sidx', String(options.sortname || gridState.sortname || 'CreateDate'));
    url.searchParams.set('sord', String(options.sortorder || gridState.sortorder || 'desc'));
    if (options.filters) url.searchParams.set('filters', JSON.stringify(options.filters));
    return url;
  }

  async function fetchReestrDzGridPage(url, signal) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Пирамида вернула HTTP ${response.status} при чтении грида.`);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Пирамида вернула некорректный список реестров.');
    }
  }

  async function loadAllReestrDzRows(gridState, signal) {
    const first = await fetchReestrDzGridPage(buildReestrDzGridDataUrl(gridState, { rows: 2000, page: 1 }), signal);
    const rows = Array.isArray(first.rows) ? [...first.rows] : [];
    const totalPages = Math.max(1, Number.parseInt(String(first.total || 1), 10) || 1);
    for (let page = 2; page <= totalPages; page += 1) {
      const part = await fetchReestrDzGridPage(buildReestrDzGridDataUrl(gridState, { rows: 2000, page }), signal);
      if (Array.isArray(part.rows)) rows.push(...part.rows);
    }
    return rows;
  }

  async function loadReestrDzRowById(gridState, rowId, signal) {
    const filters = {
      groupOp: 'AND',
      rules: [{ field: 'ReestrDzID', op: 'eq', data: String(rowId) }]
    };
    const data = await fetchReestrDzGridPage(buildReestrDzGridDataUrl(gridState, {
      search: 'true',
      rows: 10,
      page: 1,
      filters
    }), signal);
    return Array.isArray(data.rows)
      ? data.rows.find((item) => String(item.id || item.cell && item.cell.ReestrDzID || '') === String(rowId)) || null
      : null;
  }

  async function setReestrDzGridPage(page, forcePager = false) {
    const response = await sendRuntimeMessage({ action: 'REESTR_DZ_SET_GRID_PAGE', data: { page, forcePager } });
    if (response && response.success) return true;
    const input = document.querySelector('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input');
    if (!(input instanceof HTMLInputElement)) return false;
    input.value = String(page);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return true;
  }

  function isReestrDzGridLoading() {
    return Array.from(document.querySelectorAll('#load_list, .ui-jqgrid-loading')).some((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  async function waitForReestrDzGridReady(rowId = '', timeoutMs = 20000) {
    const startedAt = Date.now();
    let stableChecks = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const row = rowId ? findReestrDzPrincipalRow(rowId) : null;
      const hasRows = !!document.querySelector('#list tr.jqgrow');
      const ready = !isReestrDzGridLoading() && hasRows && (!rowId || row instanceof HTMLElement);
      stableChecks = ready ? stableChecks + 1 : 0;
      if (stableChecks >= 3) return rowId ? findReestrDzPrincipalRow(rowId) : true;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    return rowId ? null : false;
  }

  async function showReestrDzPrincipalCandidate(run, candidate, attention = false) {
    await waitForReestrDzPrincipalResume(run);
    run.current = candidate;
    syncReestrDzPrincipalOverlay(run);
    const pageInput = document.querySelector('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input');
    const currentPage = Math.max(1, Number.parseInt(pageInput && pageInput.value || '1', 10) || 1);
    if (currentPage !== candidate.page) {
      updateReestrDzPrincipalStage(run, `Переключаю грид на страницу ${candidate.page}…`);
      await setReestrDzGridPage(candidate.page);
    }
    const row = await waitForReestrDzGridReady(candidate.id);
    if (row instanceof HTMLElement) {
      const selectedRow = await selectReestrDzPrincipalGridRow(row, candidate);
      selectedRow.classList.add(REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS);
      selectedRow.classList.toggle(REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS, attention);
      applyReestrDzBatchRowHighlights(run);
      selectedRow.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      return true;
    }
    throw new Error(`Строка № ${candidate.id} не появилась после загрузки страницы ${candidate.page}.`);
  }

  async function loadReestrDzWssDocument(url, kind, expectedNumber, workerKey = 'default') {
    const response = await sendRuntimeMessage({
      action: 'REESTR_DZ_LOAD_WSS_DOCUMENT',
      data: {
        url: String(url || ''),
        kind: String(kind || ''),
        expectedNumber: normalizeReestrDzText(expectedNumber),
        workerKey: String(workerKey || 'default')
      }
    });
    if (!response || response.success === false) {
      throw new Error(`Не удалось открыть WSS Docs: ${response && response.error ? response.error : 'нет ответа'}.`);
    }
    return response;
  }

  function parseReestrDzOutgoingLinks(documentData) {
    const unique = new Map();
    const links = documentData && Array.isArray(documentData.links) ? documentData.links : [];
    links.forEach((item) => {
      const text = normalizeReestrDzText(item && item.text);
      const rawHref = String(item && item.href || '').trim();
      if (!text || !rawHref) return;
      try {
        const href = new URL(rawHref).toString();
        unique.set(`${text}\n${href}`, { text, href });
      } catch (error) {
        // ignore malformed WSS link
      }
    });
    return Array.from(unique.values());
  }

  function parseReestrDzOutgoingHeader(documentData, expectedNumber) {
    const expected = normalizeReestrDzText(expectedNumber);
    const candidates = documentData && Array.isArray(documentData.headers)
      ? documentData.headers.map((value) => normalizeReestrDzText(value)).filter(Boolean)
      : [];
    for (const text of candidates) {
      const match = text.match(/^(.+?)\s*\((\d{2}\.\d{2}\.\d{4})\)$/);
      const number = match ? normalizeReestrDzText(match[1]) : '';
      if (match && number === expected) return { number, date: match[2], raw: text };
    }
    throw new Error(`Карточка исходящего не подтвердила ожидаемый номер ${expected || '—'} в подписи «номер (дата создания)».`);
  }

  function parseReestrDzPrincipalAttachment(documentData) {
    const responsibleName = normalizeReestrDzText(documentData && documentData.responsibleName);
    if (!responsibleName) {
      throw new Error('В поручении не найдено поле «Ответственный за отражение списания в биллинговом ПК».');
    }
    const matchingDecisions = (documentData && Array.isArray(documentData.completedDecisions)
      ? documentData.completedDecisions
      : []).filter((item) => normalizeReestrDzText(item && item.user)
        .localeCompare(responsibleName, 'ru', { sensitivity: 'base' }) === 0);
    if (!matchingDecisions.length) {
      throw new Error(`В истории решений не найдено решение «Исполнено» ответственного ${responsibleName}.`);
    }
    if (matchingDecisions.length > 1) {
      throw new Error(`В истории решений найдено несколько решений «Исполнено» ответственного ${responsibleName}; требуется ручная проверка.`);
    }
    const date = normalizeReestrDzText(matchingDecisions[0].date);
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date) || parseReestrDzDate(date) === null) {
      throw new Error(`Не удалось определить дату решения «Исполнено» ответственного ${responsibleName}.`);
    }
    return { date, responsibleName };
  }

  function buildReestrDzAttachmentComment(sendDate, attachmentDate) {
    const sendMatch = normalizeReestrDzText(sendDate).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const attachmentMatch = normalizeReestrDzText(attachmentDate).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!sendMatch || !attachmentMatch || parseReestrDzDate(sendDate) === null || parseReestrDzDate(attachmentDate) === null) {
      throw new Error('Не удалось сравнить дату отправки принципалу и фактическую дату прикрепления исходящего.');
    }
    if (sendMatch[2] === attachmentMatch[2] && sendMatch[3] === attachmentMatch[3]) return '';
    const monthIndex = Number(sendMatch[2]) - 1;
    const nominativeMonths = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const instrumentalMonths = ['январём', 'февралём', 'мартом', 'апрелем', 'маем', 'июнем', 'июлем', 'августом', 'сентябрём', 'октябрём', 'ноябрём', 'декабрём'];
    return `Исходящий прикрепили ${attachmentDate} ${instrumentalMonths[monthIndex]}, т.к. дата отправки принципалу ${sendDate} (${nominativeMonths[monthIndex]})`;
  }

  function findReestrDzNativeButton(title) {
    const expected = normalizeReestrDzText(title);
    return Array.from(document.querySelectorAll('#pager_left .ui-pg-button, .ui-jqgrid-pager .ui-pg-button'))
      .find((element) => normalizeReestrDzText(element.textContent) === expected || normalizeReestrDzText(element.getAttribute('title')) === expected) || null;
  }

  async function waitForReestrDzNativeForm(candidate, path, timeoutMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const frames = Array.from(document.querySelectorAll(`iframe[src*="${path}"]`));
      for (const frame of frames) {
        try {
          const frameUrl = new URL(frame.src, window.location.origin);
          if (frameUrl.searchParams.get('ReestrDzID') !== String(candidate.id)) continue;
          return { frame };
        } catch (error) {
          // iframe ещё загружается
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    throw new Error(`Не открылась штатная форма для строки № ${candidate.id}.`);
  }

  function closeReestrDzPrincipalNativeDialog(frame) {
    const dialog = frame instanceof HTMLElement ? frame.closest('.ui-dialog') : null;
    const closeButton = dialog && dialog.querySelector('.ui-dialog-titlebar-close');
    if (closeButton instanceof HTMLElement) closeButton.click();
  }

  async function saveReestrDzPrincipalInfo(run, candidate, outgoing) {
    await waitForReestrDzPrincipalResume(run);
    updateReestrDzPrincipalStage(run, `Нажимаю штатную кнопку для строки № ${candidate.id}…`);
    const nativeButton = findReestrDzNativeButton('Заполнить сведения о направлении инфо принципалу');
    if (!(nativeButton instanceof HTMLElement)) throw new Error('Не найдена штатная кнопка «Заполнить сведения о направлении инфо принципалу».');
    nativeButton.click();
    const nativeForm = await waitForReestrDzNativeForm(candidate, '/ovzid/ReestrDz/Send');
    await waitForReestrDzPrincipalResume(run);
    updateReestrDzPrincipalStage(run, `Заполняю штатное окно строки № ${candidate.id}: ${outgoing.date}, ${outgoing.number}…`);
    const fillResponse = await sendRuntimeMessage({
      action: 'REESTR_DZ_FILL_NATIVE_FORM',
      data: {
        rowId: candidate.id,
        depid: run.department && run.department.depid || '',
        sendDate: outgoing.date,
        principalNumber: outgoing.number
      }
    });
    if (!fillResponse || fillResponse.success === false) {
      throw new Error(`Не удалось заполнить штатную форму для строки № ${candidate.id}: ${fillResponse && fillResponse.error ? fillResponse.error : 'нет ответа'}.`);
    }
    updateReestrDzPrincipalStage(run, `Штатная форма заполнена, нажато «Сохранить» для строки № ${candidate.id}…`);

    updateReestrDzPrincipalStage(run, `Проверяю сохранённые значения строки № ${candidate.id}…`);
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 1 ? 250 : 500));
      const verified = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
      const cell = verified && verified.cell ? verified.cell : null;
      if (cell && normalizeReestrDzText(cell.SendDate) === outgoing.date && normalizeReestrDzText(cell.PrincipalNumber) === outgoing.number) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        const gridReady = await waitForReestrDzGridReady('', 20000);
        if (!gridReady) throw new Error(`Грид не завершил загрузку после сохранения строки № ${candidate.id}.`);
        closeReestrDzPrincipalNativeDialog(nativeForm.frame);
        updateReestrDzPrincipalStage(run, `Сохранение строки № ${candidate.id} подтверждено: ${outgoing.number} от ${outgoing.date}.`);
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        return { ...candidate.cell, ...cell };
      }
    }
    throw new Error(`Контрольное чтение строки № ${candidate.id} не подтвердило сохранение.`);
  }

  async function saveReestrDzPrincipalComment(run, candidate, cell, generatedComment) {
    const expectedComment = normalizeReestrDzText(generatedComment);
    if (!expectedComment) return cell;
    const currentNote = String(cell && cell.Note || '').trim();
    if (normalizeReestrDzText(currentNote).includes(expectedComment)) return cell;
    const updatedNote = currentNote ? `${currentNote}\n${generatedComment}` : generatedComment;

    await waitForReestrDzPrincipalResume(run);
    updateReestrDzPrincipalStage(run, `Повторно выбираю строку № ${candidate.id} для комментария…`);
    await showReestrDzPrincipalCandidate(run, candidate, false);
    const nativeButton = findReestrDzNativeButton('Комментарий к реестру');
    if (!(nativeButton instanceof HTMLElement)) throw new Error('Не найдена штатная кнопка «Комментарий к реестру».');
    nativeButton.click();
    const nativeForm = await waitForReestrDzNativeForm(candidate, '/ovzid/ReestrDz/SetNote');
    await waitForReestrDzPrincipalResume(run);
    updateReestrDzPrincipalStage(run, `Вставляю комментарий в штатное окно строки № ${candidate.id}…`);
    const fillResponse = await sendRuntimeMessage({
      action: 'REESTR_DZ_FILL_NOTE_FORM',
      data: { rowId: candidate.id, note: updatedNote }
    });
    if (!fillResponse || fillResponse.success === false) {
      throw new Error(`Не удалось заполнить комментарий строки № ${candidate.id}: ${fillResponse && fillResponse.error ? fillResponse.error : 'нет ответа'}.`);
    }
    updateReestrDzPrincipalStage(run, `Комментарий вставлен, нажато «Сохранить» для строки № ${candidate.id}…`);

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 1 ? 250 : 500));
      const verified = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
      const verifiedCell = verified && verified.cell ? verified.cell : null;
      if (verifiedCell && normalizeReestrDzText(verifiedCell.Note).includes(expectedComment)) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        const gridReady = await waitForReestrDzGridReady('', 20000);
        if (!gridReady) throw new Error(`Грид не завершил загрузку после комментария строки № ${candidate.id}.`);
        closeReestrDzPrincipalNativeDialog(nativeForm.frame);
        updateReestrDzPrincipalStage(run, `Комментарий строки № ${candidate.id} подтверждён.`);
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        return { ...cell, ...verifiedCell };
      }
    }
    throw new Error(`Контрольное чтение строки № ${candidate.id} не подтвердило комментарий.`);
  }

  async function applyReestrDzPrincipalAttachment(run, candidate, cell, sendDate, attachment) {
    const enrichedCell = { ...cell, PrincipalAttachmentDate: attachment.date };
    const generatedComment = buildReestrDzAttachmentComment(sendDate, attachment.date);
    if (!generatedComment) return enrichedCell;
    return saveReestrDzPrincipalComment(run, candidate, enrichedCell, generatedComment);
  }

  function ensureReestrDzPreparedResults(run) {
    if (!run.preparedResults || typeof run.preparedResults !== 'object' || Array.isArray(run.preparedResults)) {
      run.preparedResults = {};
    }
    return run.preparedResults;
  }

  async function prepareReestrDzParallelBatch(run, candidates, inspector, persist, sync, label) {
    const preparedResults = ensureReestrDzPreparedResults(run);
    candidates.forEach((candidate) => {
      const key = String(candidate.id);
      if (!Object.prototype.hasOwnProperty.call(preparedResults, key) && isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
        preparedResults[key] = { success: true, value: { kind: 'excluded', actionable: false } };
      }
    });
    const missing = candidates
      .filter((candidate) => !Object.prototype.hasOwnProperty.call(preparedResults, String(candidate.id)))
      .map((candidate, slot) => ({ candidate, slot }));
    run.parallelProgress = { completed: 0, total: missing.length };
    run.stage = `${label}: ${run.parallelProgress.completed} из ${run.parallelProgress.total}…`;
    sync(run);
    await Promise.all(missing.map(async ({ candidate, slot }) => {
      let prepared;
      try {
        prepared = { success: true, value: await inspector(run, candidate, `slot-${slot + 1}`) };
      } catch (error) {
        prepared = { success: false, error: error && error.message ? error.message : String(error) };
      }
      preparedResults[String(candidate.id)] = prepared;
      run.parallelProgress.completed += 1;
      run.stage = `${label}: ${run.parallelProgress.completed} из ${run.parallelProgress.total}…`;
      sync(run);
    }));
    if (run.controller && run.controller.signal && run.controller.signal.aborted) {
      throw new DOMException('Проверка остановлена', 'AbortError');
    }
    await persist(run);
    return candidates.map((candidate) => preparedResults[String(candidate.id)]);
  }

  function getReestrDzParallelBatchEnd(run, batchStart) {
    const candidates = run && Array.isArray(run.candidates) ? run.candidates : [];
    if (batchStart >= candidates.length) return candidates.length;
    const workerLimit = normalizeReestrDzParallelWorkers(run.parallelWorkers);
    const page = Math.max(1, Number.parseInt(String(candidates[batchStart] && candidates[batchStart].page || 1), 10) || 1);
    let batchEnd = batchStart;
    let activeCount = 0;
    while (batchEnd < candidates.length && activeCount < workerLimit) {
      const candidatePage = Math.max(1, Number.parseInt(String(candidates[batchEnd] && candidates[batchEnd].page || 1), 10) || 1);
      if (candidatePage !== page) break;
      if (!isReestrDzWriteOffExcludedClaimant(candidates[batchEnd].cell)) activeCount += 1;
      batchEnd += 1;
    }
    return Math.max(batchStart + 1, batchEnd);
  }

  async function inspectReestrDzPrincipalCandidate(run, candidate, workerKey) {
    if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
      return { kind: 'excluded', workerKey, actionable: false };
    }
    const requestUrl = new URL('/api/wss/doclink/redirect', window.location.origin);
    requestUrl.searchParams.set('RegNumber', candidate.cell.RequestNumber);
    const requestDocument = await loadReestrDzWssDocument(
      requestUrl.toString(), 'request', candidate.cell.RequestNumber, workerKey
    );
    const links = parseReestrDzOutgoingLinks(requestDocument);
    const cancellationComments = getReestrDzCancellationComments(requestDocument);
    if (!links.length) {
      return { kind: 'not_found', workerKey, requestDocument, links, cancellationComments, actionable: cancellationComments.length > 0 };
    }
    if (links.length > 1) {
      return { kind: 'attention', workerKey, requestDocument, links, cancellationComments, actionable: true };
    }
    const attachment = parseReestrDzPrincipalAttachment(requestDocument);
    const outgoingDocument = await loadReestrDzWssDocument(links[0].href, 'outgoing', links[0].text, workerKey);
    const outgoing = parseReestrDzOutgoingHeader(outgoingDocument, links[0].text);
    if (normalizeReestrDzText(outgoing.number) === normalizeReestrDzText(candidate.cell.RequestNumber)) {
      throw new Error(`Полученный номер исходящего совпал с номером поручения ${candidate.cell.RequestNumber}; сохранение остановлено для ручной проверки.`);
    }
    return { kind: 'found', workerKey, requestDocument, links, cancellationComments, attachment, outgoing, actionable: true };
  }

  async function processReestrDzPrincipalCandidate(run, candidate, preparedInspection = null) {
    if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
      return buildReestrDzExcludedClaimantResult(candidate);
    }
    let inspection = preparedInspection;
    while (true) {
      await waitForReestrDzPrincipalResume(run);
      await showReestrDzPrincipalCandidate(run, candidate, false);
      updateReestrDzPrincipalStage(run, `Проверяю текущее состояние строки № ${candidate.id}…`);
      const liveRow = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
      const liveCell = liveRow && liveRow.cell ? liveRow.cell : candidate.cell;
      const hasDate = !!normalizeReestrDzText(liveCell.SendDate);
      const hasNumber = !!normalizeReestrDzText(liveCell.PrincipalNumber);
      if (hasDate && hasNumber) {
        updateReestrDzPrincipalStage(run, `Читаю историю поручения ${candidate.cell.RequestNumber}…`);
        inspection = inspection || await inspectReestrDzPrincipalCandidate(run, candidate, 'default');
        const requestDocument = inspection.requestDocument;
        const attachment = parseReestrDzPrincipalAttachment(requestDocument);
        let enrichedCell = await applyReestrDzPrincipalAttachment(run, candidate, { ...candidate.cell, ...liveCell }, liveCell.SendDate, attachment);
        enrichedCell = await applyReestrDzCancellationComments(
          run, candidate, enrichedCell, requestDocument, saveReestrDzPrincipalComment
        );
        return {
          cell: enrichedCell,
          result: 'Проверено вручную',
          description: `Дата и номер заполнены вручную; исходящий фактически прикреплён ${attachment.date}.`,
          found: true,
          saved: false,
          skipped: false,
          error: false
        };
      }
      if (hasDate !== hasNumber) {
        await showReestrDzPrincipalCandidate(run, candidate, true);
        pauseReestrDzPrincipalRun(run, {
          attention: true,
          message: `Строка № ${candidate.id} заполнена частично. Проверьте её вручную и нажмите «Старт».`
        });
        await waitForReestrDzPrincipalResume(run);
        continue;
      }

      updateReestrDzPrincipalStage(run, `Открываю поручение ${candidate.cell.RequestNumber}…`);
      inspection = inspection || await inspectReestrDzPrincipalCandidate(run, candidate, 'default');
      const requestDocument = inspection.requestDocument;
      const links = inspection.links || [];
      if (!links.length) {
        if (!getReestrDzCancellationComments(requestDocument).length) {
          return {
            cell: { ...candidate.cell, ...liveCell },
            result: 'Исходящий не найден',
            description: 'Поле «Ссылка на исходящий документ» не заполнено.',
            found: false,
            saved: false,
            skipped: true,
            error: false
          };
        }
        const commentedCell = await applyReestrDzCancellationComments(
          run, candidate, { ...candidate.cell, ...liveCell }, requestDocument, saveReestrDzPrincipalComment
        );
        return {
          cell: commentedCell,
          result: 'Исходящий не найден',
          description: 'Поле «Ссылка на исходящий документ» не заполнено.',
          found: false,
          saved: false,
          skipped: true,
          error: false
        };
      }
      if (links.length > 1) {
        await showReestrDzPrincipalCandidate(run, candidate, true);
        pauseReestrDzPrincipalRun(run, {
          attention: true,
          message: `В поручении ${candidate.cell.RequestNumber} найдено ${links.length} исходящих. Проверьте строку № ${candidate.id} вручную и нажмите «Старт».`
        });
        await waitForReestrDzPrincipalResume(run);
        inspection = await inspectReestrDzPrincipalCandidate(run, candidate, inspection.workerKey || 'slot-1');
        continue;
      }

      const attachment = inspection.attachment || parseReestrDzPrincipalAttachment(requestDocument);
      const outgoing = inspection.outgoing;
      if (!outgoing) throw new Error(`Не подготовлены сведения исходящего для строки № ${candidate.id}.`);
      const savedCell = await saveReestrDzPrincipalInfo(run, candidate, outgoing);
      let enrichedCell = await applyReestrDzPrincipalAttachment(run, candidate, savedCell, outgoing.date, attachment);
      enrichedCell = await applyReestrDzCancellationComments(
        run, candidate, enrichedCell, requestDocument, saveReestrDzPrincipalComment
      );
      return {
        cell: enrichedCell,
        result: 'Сохранено',
        description: `${outgoing.number} от ${outgoing.date}; фактически прикреплён ${attachment.date}`,
        found: true,
        saved: true,
        skipped: false,
        error: false
      };
    }
  }

  function getSortedReestrDzReportResults(run) {
    const parseSendDate = (value) => {
      const match = normalizeReestrDzText(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : Number.NEGATIVE_INFINITY;
    };
    return (run && Array.isArray(run.results) ? run.results : [])
      .map((item, sourceIndex) => ({ item, sourceIndex }))
      .sort((left, right) => {
        const dateDifference = parseSendDate(right.item.cell && right.item.cell.SendDate) - parseSendDate(left.item.cell && left.item.cell.SendDate);
        if (dateDifference) return dateDifference;
        const claimantDifference = normalizeReestrDzText(left.item.cell && left.item.cell.ClaimantName)
          .localeCompare(normalizeReestrDzText(right.item.cell && right.item.cell.ClaimantName), 'ru', { sensitivity: 'base' });
        return claimantDifference || left.sourceIndex - right.sourceIndex;
      })
      .map(({ item }) => item);
  }

  function buildReestrDzPrincipalReportRows(run, sortedResults = getSortedReestrDzReportResults(run)) {
    const headers = [...REESTR_DZ_PRINCIPAL_REPORT_HEADERS.map((item) => item[1]), 'Результат обработки', 'Описание'];
    const rows = sortedResults.map((item) => [
      ...REESTR_DZ_PRINCIPAL_REPORT_HEADERS.map(([key]) => normalizeReestrDzText(item.cell && item.cell[key])),
      normalizeReestrDzText(item.result),
      normalizeReestrDzText(item.description)
    ]);
    return [headers, ...rows];
  }

  function buildReestrDzPrincipalXlsxBlob(run, options = {}) {
    const sortedResults = getSortedReestrDzReportResults(run);
    const rows = buildReestrDzPrincipalReportRows(run, sortedResults);
    const highlightInformationWritten = options.highlightInformationWritten === true;
    const sheetName = normalizeReestrDzText(options.sheetName) || 'Обработка';
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
    const countColumnIndex = REESTR_DZ_PRINCIPAL_REPORT_HEADERS.findIndex(([key]) => key === 'EDocsCount');
    const centeredColumnIndexes = new Set(['ReestrDzID', 'CreateDate', 'SendDate', 'PrincipalAttachmentDate', 'OrderDate']
      .map((key) => REESTR_DZ_PRINCIPAL_REPORT_HEADERS.findIndex(([columnKey]) => columnKey === key))
      .filter((index) => index >= 0));
    const wrappedColumnIndexes = new Set([
      REESTR_DZ_PRINCIPAL_REPORT_HEADERS.findIndex(([columnKey]) => columnKey === 'EmployeeFullName'),
      REESTR_DZ_PRINCIPAL_REPORT_HEADERS.findIndex(([columnKey]) => columnKey === 'RequestNumber'),
      REESTR_DZ_PRINCIPAL_REPORT_HEADERS.findIndex(([columnKey]) => columnKey === 'Note'),
      rows[0].length - 1
    ]);
    const sheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const highlightRow = rowIndex > 0 && highlightInformationWritten && sortedResults[rowIndex - 1] && sortedResults[rowIndex - 1].informationWritten === true;
      const cells = row.map((value, colIndex) => {
        const ref = `${columnIndexToName(colIndex)}${rowNumber}`;
        if (rowIndex > 0 && colIndex === countColumnIndex) {
          const count = Number.parseInt(String(value).replace(/\s+/g, ''), 10);
          if (Number.isFinite(count)) return `<c r="${ref}" s="${highlightRow ? 7 : 3}"><v>${count}</v></c>`;
        }
        const baseStyle = rowIndex === 0 ? 1 : (centeredColumnIndexes.has(colIndex) ? 2 : (wrappedColumnIndexes.has(colIndex) ? 4 : 0));
        const style = highlightRow ? ({ 0: 5, 2: 6, 4: 8 }[baseStyle] || 5) : baseStyle;
        if (value === '' || value === undefined || value === null) return `<c r="${ref}" s="${style}"/>`;
        return `<c r="${ref}" t="s" s="${style}"><v>${getSharedIndex(value)}</v></c>`;
      }).join('');
      const hasLongWrappedValue = rowIndex > 0 && Array.from(wrappedColumnIndexes).some((index) => String(row[index] || '').length > 45);
      return `<row r="${rowNumber}" ht="${rowIndex === 0 ? 32 : (hasLongWrappedValue ? 45 : 17)}" customHeight="1">${cells}</row>`;
    }).join('');
    const columnWidths = [8, 15, 12, 27, 16, 20, 16, 22, 14, 23, 16, 14, 22, 17, 28, 25, 17, 38];
    const widths = rows[0].map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="${columnWidths[index] || 16}" customWidth="1"/>`).join('');
    const lastColumn = columnIndexToName(rows[0].length - 1);
    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings.map((value) => `<si><t>${escapeExecutionAnalysisXml(value)}</t></si>`).join('')}</sst>`;
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeExecutionAnalysisXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="9"/><color rgb="FF334155"/><name val="Aptos"/></font><font><b/><sz val="9"/><color rgb="FF1E293B"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFF2E3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Обычный" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
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

  function getReestrDzCurrentDepartment() {
    const activeLink = document.querySelector('a.department-switch.active, a.department-switch[aria-current="page"]');
    const headerButton = document.querySelector('button.btn-cities.dropdown-toggle, .btn-cities.dropdown-toggle');
    const meta = document.querySelector('meta[name="pyramid-active-department-id"]');
    let depid = normalizeReestrDzText(
      activeLink && (activeLink.getAttribute('data-depid') || activeLink.getAttribute('depid')) ||
      meta && meta.getAttribute('content') || ''
    );
    if (!depid && activeLink instanceof HTMLAnchorElement) {
      const match = String(activeLink.href || '').match(/\/login\/department\/(\d+)/i);
      if (match) depid = match[1];
    }
    const label = normalizeReestrDzText(
      activeLink && activeLink.textContent ||
      headerButton && headerButton.textContent ||
      'Департамент'
    );
    return { depid: depid || 'без-depid', label: label || 'Департамент' };
  }

  function sanitizeReestrDzFileNamePart(value) {
    return normalizeReestrDzText(value)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'без-названия';
  }

  function downloadReestrDzXlsxReport(run, blob, fileNameSuffix) {
    if (!run || !Array.isArray(run.results) || !run.results.length) return false;
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const department = run.department || getReestrDzCurrentDepartment();
    link.href = objectUrl;
    link.download = [
      stamp,
      sanitizeReestrDzFileNamePart(department.label),
      sanitizeReestrDzFileNamePart(department.depid),
      fileNameSuffix
    ].join('_');
    link.style.display = 'none';
    (document.body || document.documentElement).appendChild(link);
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      link.remove();
    }, 1000);
    return true;
  }

  function downloadReestrDzPrincipalReport(run) {
    if (!run || !Array.isArray(run.results) || !run.results.length) return false;
    return downloadReestrDzXlsxReport(run, buildReestrDzPrincipalXlsxBlob(run), 'проверка_исходящих_реестров_ДЗ.xlsx');
  }

  function downloadReestrDzWriteOffReport(run) {
    if (!run || !Array.isArray(run.results) || !run.results.length) return false;
    const blob = buildReestrDzPrincipalXlsxBlob(run, {
      highlightInformationWritten: true,
      sheetName: 'Проверка списания'
    });
    return downloadReestrDzXlsxReport(run, blob, 'проверка_списания_реестров_ДЗ.xlsx');
  }

  async function runReestrDzPrincipalAutofill(run) {
    try {
      while (run.nextIndex < run.candidates.length) {
        await waitForReestrDzPrincipalResume(run);
        const batchStart = run.nextIndex;
        const configuredEnd = getReestrDzParallelBatchEnd(run, batchStart);
        const rememberedEnd = Math.min(configuredEnd, Number(run.preparedThroughIndex) || 0);
        const batchEnd = rememberedEnd > batchStart ? rememberedEnd : configuredEnd;
        const batchCandidates = run.candidates.slice(batchStart, batchEnd);
        run.preparedThroughIndex = batchEnd;
        run.current = null;
        const preparationPromise = prepareReestrDzParallelBatch(
          run,
          batchCandidates,
          inspectReestrDzPrincipalCandidate,
          persistReestrDzPrincipalDailyRun,
          syncReestrDzPrincipalOverlay,
          'Параллельно проверяю WSS'
        );
        const activeBatchCandidates = batchCandidates.filter((candidate) => !isReestrDzWriteOffExcludedClaimant(candidate.cell));
        const [preparationResult, visualizationResult] = await Promise.allSettled([
          preparationPromise,
          showReestrDzActiveBatch(
            run,
            activeBatchCandidates,
            waitForReestrDzPrincipalResume,
            syncReestrDzPrincipalOverlay,
            'Активная группа'
          )
        ]);
        if (preparationResult.status === 'rejected') throw preparationResult.reason;
        if (visualizationResult.status === 'rejected') throw visualizationResult.reason;
        const preparedBatch = preparationResult.value;
        await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION', data: { workersOnly: true } }).catch(() => null);
        run.parallelProgress = null;
        run.activeBatchCandidates = [];
        run.activeBatchPage = null;
        run.stage = `Проверка группы завершена. Обрабатываю ${batchCandidates.length} строк по порядку грида…`;
        syncReestrDzPrincipalOverlay(run);

        for (let offset = 0; offset < batchCandidates.length; offset += 1) {
          const index = batchStart + offset;
          const candidate = batchCandidates[offset];
          const prepared = preparedBatch[offset];
          run.currentIndex = index;
          run.nextIndex = index;
          if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
            run.results.push({ id: candidate.id, ...buildReestrDzExcludedClaimantResult(candidate) });
            delete run.preparedResults[String(candidate.id)];
            run.nextIndex = index + 1;
            await persistReestrDzPrincipalDailyRun(run);
            continue;
          }
          run.current = candidate;
          run.stage = `Обрабатываю подготовленную строку № ${candidate.id}…`;
          syncReestrDzPrincipalOverlay(run);
          await waitForReestrDzPrincipalResume(run);
          try {
            if (!prepared || prepared.success !== true) {
              const discoveryError = new Error(prepared && prepared.error || `Не удалось проверить WSS для строки № ${candidate.id}.`);
              discoveryError.discoveryError = true;
              throw discoveryError;
            }
            const result = await processReestrDzPrincipalCandidate(run, candidate, prepared.value);
            run.results.push({ id: candidate.id, ...result });
            setReestrDzBatchRowResult(run, candidate.id, false);
            delete run.preparedResults[String(candidate.id)];
            run.nextIndex = index + 1;
            await persistReestrDzPrincipalDailyRun(run);
          } catch (error) {
            const message = error && error.message ? error.message : String(error);
            run.results.push({
              id: candidate.id,
              cell: { ...candidate.cell },
              result: 'Ошибка',
              description: message,
              found: false,
              saved: false,
              skipped: false,
              discoveryError: error && error.discoveryError === true,
              error: true
            });
            setReestrDzBatchRowResult(run, candidate.id, true);
            run.status = 'error';
            run.recoverableError = true;
            run.canContinue = false;
            run.stage = `Обработка остановлена на строке № ${candidate.id}. После проверки ошибки нажмите «Продолжить».`;
            run.warning = message;
            syncReestrDzPrincipalOverlay(run);
            await persistReestrDzPrincipalDailyRun(run);
            throw error;
          }
          syncReestrDzPrincipalOverlay(run);
        }
        run.preparedThroughIndex = run.nextIndex;
      }
      run.status = 'completed';
      run.nextIndex = run.candidates.length;
      run.recoverableError = false;
      run.current = null;
      run.stage = 'Обработка завершена. Итоговый отчёт скачан.';
      run.warning = '';
      downloadReestrDzPrincipalReport(run);
      run.reportDownloaded = true;
      await persistReestrDzPrincipalDailyRun(run);
    } catch (error) {
      if (run.status !== 'error') {
        run.status = 'error';
        run.stage = 'Обработка остановлена из-за критической ошибки.';
        run.warning = error && error.message ? error.message : String(error);
      }
    } finally {
      if (run.status === 'error') {
        const row = run.current && findReestrDzPrincipalRow(run.current.id);
        if (row instanceof HTMLElement) row.classList.add(REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS, REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS);
      } else if (run.status !== 'completed') {
        clearReestrDzPrincipalRowHighlight();
      }
      try {
        await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION' });
      } catch (error) {
        // Сбой закрытия служебной вкладки не должен блокировать повторный запуск.
      }
      if (run.status === 'error' && run.recoverableError === true) run.canContinue = true;
      syncReestrDzPrincipalOverlay(run);
      setReestrDzPrincipalLaunchButtonDisabled(false);
    }
  }

  async function startReestrDzPrincipalAutofill() {
    if (!isReestrDzPrincipalPage() || !isExtensionUiSettingEnabled('reestrDzPrincipalAutofill')) return;
    if (reestrDzPrincipalRun && reestrDzPrincipalRun.overlayDismissed) {
      reestrDzPrincipalRun.overlayDismissed = false;
      syncReestrDzPrincipalOverlay(reestrDzPrincipalRun);
      document.getElementById(REESTR_DZ_PRINCIPAL_OVERLAY_ID)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (reestrDzPrincipalRun && reestrDzPrincipalRun.status !== 'completed') {
      createReestrDzPrincipalOverlay().scrollIntoView({ block: 'nearest' });
      return;
    }
    setReestrDzPrincipalLaunchButtonDisabled(true);
    const currentDepartment = getReestrDzCurrentDepartment();
    let dailyDepartment = await getReestrDzPrincipalDailyDepartment(currentDepartment.depid);
    if (dailyDepartment.activeRun) {
      const savedRun = dailyDepartment.activeRun;
      const savedNextIndex = Math.max(0, Number.parseInt(String(savedRun.nextIndex || 0), 10) || 0);
      const savedTotal = Array.isArray(savedRun.candidates) ? savedRun.candidates.length : 0;
      const restoreConfirmed = window.confirm(
        `Найдена незавершённая проверка за сегодня для департамента ${currentDepartment.label} (${currentDepartment.depid}).\n` +
        `Готово строк: ${Math.min(savedNextIndex, savedTotal)} из ${savedTotal}.\n\n` +
        'Восстановить её и продолжить с места остановки?\n' +
        '«Отмена» удалит незавершённую очередь и позволит начать новую проверку.'
      );
      if (restoreConfirmed) {
        const restoredRun = restoreReestrDzPrincipalRun(savedRun);
        if (restoredRun) {
          reestrDzPrincipalRun = restoredRun;
          syncReestrDzPrincipalOverlay(restoredRun);
          setReestrDzPrincipalLaunchButtonDisabled(false);
          return;
        }
      }
      await discardReestrDzPrincipalActiveRun(currentDepartment.depid);
      dailyDepartment = await getReestrDzPrincipalDailyDepartment(currentDepartment.depid);
    }
    const processedTodayIds = new Set(Object.keys(
      dailyDepartment.processed && typeof dailyDepartment.processed === 'object'
        ? dailyDepartment.processed
        : {}
    ).map(String));
    const periodChoice = await askReestrDzPrincipalPeriod();
    if (periodChoice.cancelled) {
      setReestrDzPrincipalLaunchButtonDisabled(false);
      return;
    }
    const selectedPeriod = periodChoice.period;
    const preparingRun = {
      status: 'preparing',
      paused: false,
      pauseReason: '',
      resumeWaiters: [],
      controller: new AbortController(),
      gridState: { lastpage: 1 },
      candidates: [],
      results: [],
      nextIndex: 0,
      current: null,
      department: currentDepartment,
      period: selectedPeriod,
      parallelWorkers: normalizeReestrDzParallelWorkers(periodChoice.parallelWorkers),
      preparedResults: {},
      preparedThroughIndex: 0,
      overlayDismissed: false,
      reportDownloaded: false,
      recoverableError: false,
      canContinue: false,
      stage: 'Собираю строки текущего грида…',
      warning: '',
      metaText: selectedPeriod ? `Период: ${selectedPeriod.text}` : 'Все даты запуска поручений'
    };
    reestrDzPrincipalRun = preparingRun;
    syncReestrDzPrincipalOverlay(preparingRun);
    try {
      const gridState = await getReestrDzGridState();
      preparingRun.gridState = gridState;
      const rows = await loadAllReestrDzRows(gridState, preparingRun.controller.signal);
      const candidates = rows
        .map((row, index) => ({
          id: String(row.id || row.cell && row.cell.ReestrDzID || ''),
          cell: row && row.cell && typeof row.cell === 'object' ? { ...row.cell } : {},
          sourceIndex: index,
          page: Math.floor(index / Math.max(1, gridState.rowNum || 30)) + 1
        }))
        .filter((row) => row.id && row.cell.RequestNumber &&
          !normalizeReestrDzText(row.cell.SendDate) &&
          !normalizeReestrDzText(row.cell.PrincipalNumber) &&
          !processedTodayIds.has(String(row.id)) &&
          isReestrDzRowInPeriod(row.cell, selectedPeriod));
      preparingRun.candidates = candidates;
      preparingRun.metaText = selectedPeriod
        ? `В гриде ${rows.length} строк · период ${selectedPeriod.text}`
        : `В гриде ${rows.length} строк · без ограничения по дате`;
      syncReestrDzPrincipalOverlay(preparingRun);
      if (!candidates.length) {
        preparingRun.status = 'completed';
        preparingRun.stage = processedTodayIds.size
          ? 'Новых строк не найдено: уже обработанные сегодня записи пропущены.'
          : 'Строк без даты и номера исходящего не найдено.';
        syncReestrDzPrincipalOverlay(preparingRun);
        await persistReestrDzPrincipalDailyRun(preparingRun);
        return;
      }
      if (candidates.every((candidate) => isReestrDzWriteOffExcludedClaimant(candidate.cell))) {
        preparingRun.results = candidates.map((candidate) => ({
          id: candidate.id,
          ...buildReestrDzExcludedClaimantResult(candidate)
        }));
        preparingRun.status = 'completed';
        preparingRun.nextIndex = candidates.length;
        preparingRun.current = null;
        preparingRun.stage = 'Все найденные строки относятся к исключённым взыскателям. Итоговый отчёт скачан.';
        preparingRun.warning = '';
        downloadReestrDzPrincipalReport(preparingRun);
        preparingRun.reportDownloaded = true;
        await persistReestrDzPrincipalDailyRun(preparingRun);
        syncReestrDzPrincipalOverlay(preparingRun);
        return;
      }
      const confirmed = window.confirm(
        `Найдено строк для проверки: ${candidates.length}.\n` +
        `Период: ${selectedPeriod ? selectedPeriod.text : 'все даты'}.\n\n` +
        `Параллельных проверок WSS: ${preparingRun.parallelWorkers}.\n\n` +
        'Поручения будут проверяться параллельно группами, а найденные сведения сохраняться строго по порядку грида. Начать обработку?'
      );
      if (!confirmed) {
        preparingRun.status = 'completed';
        preparingRun.stage = 'Запуск отменён пользователем.';
        preparingRun.warning = '';
        reestrDzPrincipalRun = null;
        document.getElementById(REESTR_DZ_PRINCIPAL_OVERLAY_ID)?.remove();
        return;
      }
      preparingRun.status = 'running';
      preparingRun.stage = `Начинаю проверку группами по ${preparingRun.parallelWorkers}…`;
      syncReestrDzPrincipalOverlay(preparingRun);
      await persistReestrDzPrincipalDailyRun(preparingRun);
      setReestrDzPrincipalLaunchButtonDisabled(false);
      await runReestrDzPrincipalAutofill(preparingRun);
    } catch (error) {
      preparingRun.status = 'error';
      preparingRun.recoverableError = false;
      preparingRun.canContinue = false;
      preparingRun.stage = 'Не удалось начать обработку.';
      preparingRun.warning = error && error.message ? error.message : String(error);
      syncReestrDzPrincipalOverlay(preparingRun);
    } finally {
      setReestrDzPrincipalLaunchButtonDisabled(false);
    }
  }

  function setReestrDzPrincipalLaunchButtonDisabled(disabled) {
    const button = document.getElementById(REESTR_DZ_PRINCIPAL_BUTTON_ID);
    if (!(button instanceof HTMLElement)) return;
    const isDisabled = !!disabled;
    button.classList.toggle('disabled', isDisabled);
    button.classList.toggle('ui-jqgrid-disablePointerEvents', isDisabled);
    button.setAttribute('aria-disabled', String(isDisabled));
    button.tabIndex = isDisabled ? -1 : 0;
  }

  function closeReestrDzCheckMenu() {
    document.getElementById(REESTR_DZ_CHECK_MENU_ID)?.remove();
    document.getElementById(REESTR_DZ_PRINCIPAL_BUTTON_ID)?.setAttribute('aria-expanded', 'false');
  }

  function toggleReestrDzCheckMenu(button) {
    const existing = document.getElementById(REESTR_DZ_CHECK_MENU_ID);
    if (existing instanceof HTMLElement) {
      closeReestrDzCheckMenu();
      return;
    }
    const rect = button.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = REESTR_DZ_CHECK_MENU_ID;
    menu.className = 'dup-reestr-dz-principal-ui';
    menu.setAttribute('role', 'menu');
    menu.style.top = `${Math.round(rect.bottom + 5)}px`;
    menu.style.left = `${Math.max(8, Math.round(rect.left))}px`;
    menu.innerHTML = `
      <button type="button" role="menuitem" data-action="principal">
        <span class="fa fa-envelope-o" aria-hidden="true"></span>
        <span><strong>Проверить исходящие</strong><small>Заполнить сведения принципалу</small></span>
      </button>
      <button type="button" role="menuitem" data-action="write-off">
        <span class="fa fa-check-square-o" aria-hidden="true"></span>
        <span><strong>Проверка списания</strong><small>Проверить приказ и сохранить решение</small></span>
      </button>`;
    menu.addEventListener('click', (event) => {
      const actionButton = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!(actionButton instanceof HTMLButtonElement)) return;
      const action = actionButton.dataset.action;
      closeReestrDzCheckMenu();
      if (action === 'principal') void startReestrDzPrincipalAutofill();
      if (action === 'write-off') void startReestrDzWriteOffCheck();
    });
    (document.body || document.documentElement).appendChild(menu);
    const menuWidth = menu.offsetWidth || 268;
    const menuHeight = menu.offsetHeight || 112;
    const hasRoomBelow = rect.bottom + 5 + menuHeight <= window.innerHeight - 8;
    const top = hasRoomBelow ? rect.bottom + 5 : rect.top - menuHeight - 5;
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.left));
    menu.style.top = `${Math.max(8, Math.round(top))}px`;
    menu.style.left = `${Math.max(8, Math.round(left))}px`;
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector('button')?.focus();
    window.setTimeout(() => {
      document.addEventListener('pointerdown', (event) => {
        if (menu.contains(event.target) || button.contains(event.target)) return;
        closeReestrDzCheckMenu();
      }, { capture: true, once: true });
    }, 0);
  }

  function ensureReestrDzPrincipalButton() {
    if (!isReestrDzPrincipalPage()) return null;
    ensureReestrDzPrincipalStyle();
    const existing = document.getElementById(REESTR_DZ_PRINCIPAL_BUTTON_ID);
    if (existing instanceof HTMLElement && reestrDzBoundCheckButtons.has(existing)) return existing;
    if (existing instanceof HTMLElement) existing.remove();
    const host = document.querySelector('#pager_left .ui-pg-table.navtable, .ui-jqgrid-pager .ui-pg-table.navtable') || document.querySelector('#pager_left, #pager');
    if (!(host instanceof HTMLElement)) return null;
    document.getElementById(REESTR_DZ_PRINCIPAL_SEPARATOR_ID)?.remove();
    const separator = document.createElement('div');
    separator.id = REESTR_DZ_PRINCIPAL_SEPARATOR_ID;
    separator.className = 'btn btn-xs ui-pg-button disabled ui-jqgrid-disablePointerEvents dup-reestr-dz-principal-ui';
    separator.setAttribute('aria-hidden', 'true');
    separator.innerHTML = '<span class="ui-separator"></span>';
    const button = document.createElement('div');
    button.id = REESTR_DZ_PRINCIPAL_BUTTON_ID;
    button.className = 'btn btn-xs ui-pg-button dup-reestr-dz-principal-ui';
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.setAttribute('aria-disabled', 'false');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<div class="ui-pg-div"><span class="fa fa-lg fa-fw fa-search"></span><span class="ui-pg-button-text">Проверка</span><span class="fa fa-caret-down" aria-hidden="true" style="margin-left:4px"></span></div>';
    button.title = 'Открыть варианты проверки реестров списания';
    const activate = () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      toggleReestrDzCheckMenu(button);
    };
    button.addEventListener('click', activate);
    button.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      activate();
    });
    reestrDzBoundCheckButtons.add(button);
    const exportButton = Array.from(host.querySelectorAll('.ui-pg-button'))
      .find((element) => normalizeReestrDzText(element.textContent) === 'Выгрузить в Excel');
    if (exportButton instanceof HTMLElement) exportButton.after(separator, button);
    else host.append(separator, button);
    return button;
  }

  function initReestrDzPrincipalAutofill() {
    if (!isReestrDzPrincipalPage()) return;
    ensureReestrDzPrincipalButton();
    if (!reestrDzPrincipalObserver) {
      reestrDzPrincipalObserver = new MutationObserver(() => ensureReestrDzPrincipalButton());
      observeWithRetry(
        reestrDzPrincipalObserver,
        () => document.querySelector('#pager') || document.body || document.documentElement,
        { childList: true, subtree: true },
        120,
        100
      );
    }
  }

  function readReestrDzWriteOffStore() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([REESTR_DZ_WRITE_OFF_DAILY_STORAGE_KEY], (result) => {
          void (chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '');
          resolve(result && result[REESTR_DZ_WRITE_OFF_DAILY_STORAGE_KEY] || null);
        });
      } catch (error) {
        resolve(null);
      }
    });
  }

  function writeReestrDzWriteOffStore(store) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [REESTR_DZ_WRITE_OFF_DAILY_STORAGE_KEY]: store }, () => {
          resolve(!(chrome.runtime && chrome.runtime.lastError));
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function normalizeReestrDzWriteOffStore(rawStore) {
    const dateKey = getReestrDzPrincipalLocalDateKey();
    const raw = rawStore && typeof rawStore === 'object' ? rawStore : {};
    if (raw.dateKey !== dateKey || raw.version !== REESTR_DZ_WRITE_OFF_DAILY_STORAGE_VERSION) {
      return { version: REESTR_DZ_WRITE_OFF_DAILY_STORAGE_VERSION, dateKey, departments: {} };
    }
    return {
      version: REESTR_DZ_WRITE_OFF_DAILY_STORAGE_VERSION,
      dateKey,
      departments: raw.departments && typeof raw.departments === 'object' ? { ...raw.departments } : {}
    };
  }

  async function updateReestrDzWriteOffStore(mutator) {
    reestrDzWriteOffDailyWriteChain = reestrDzWriteOffDailyWriteChain.catch(() => null).then(async () => {
      const store = normalizeReestrDzWriteOffStore(await readReestrDzWriteOffStore());
      const nextStore = typeof mutator === 'function' ? mutator(store) || store : store;
      return { store: nextStore, saved: await writeReestrDzWriteOffStore(nextStore) };
    });
    return reestrDzWriteOffDailyWriteChain;
  }

  async function getReestrDzWriteOffDepartment(depid) {
    await reestrDzWriteOffDailyWriteChain.catch(() => null);
    const store = normalizeReestrDzWriteOffStore(await readReestrDzWriteOffStore());
    const value = store.departments[String(depid || '')];
    return value && typeof value === 'object'
      ? cloneReestrDzPrincipalStorageValue(value, { processed: {}, activeRun: null })
      : { processed: {}, activeRun: null };
  }

  function serializeReestrDzWriteOffRun(run) {
    return cloneReestrDzPrincipalStorageValue({
      status: run.status,
      gridState: run.gridState,
      candidates: run.candidates,
      results: run.results,
      nextIndex: run.nextIndex,
      currentIndex: run.currentIndex,
      department: run.department,
      period: run.period,
      stage: run.stage,
      warning: run.warning,
      currentReview: run.currentReview || null,
      parallelWorkers: normalizeReestrDzParallelWorkers(run.parallelWorkers),
      preparedResults: run.preparedResults,
      preparedThroughIndex: Number.isInteger(run.preparedThroughIndex) ? run.preparedThroughIndex : 0,
      recoverableError: run.recoverableError === true,
      updatedAt: Date.now()
    }, null);
  }

  async function persistReestrDzWriteOffRun(run) {
    if (!run || !run.department || !run.department.depid) return false;
    const depid = String(run.department.depid);
    const snapshot = serializeReestrDzWriteOffRun(run);
    const completed = run.status === 'completed';
    const result = await updateReestrDzWriteOffStore((store) => {
      const previous = store.departments[depid] && typeof store.departments[depid] === 'object' ? store.departments[depid] : {};
      const processed = previous.processed && typeof previous.processed === 'object' ? { ...previous.processed } : {};
      (Array.isArray(run.results) ? run.results : []).forEach((item) => {
        if (!item || item.error === true || !item.id) return;
        processed[String(item.id)] = { id: String(item.id), result: normalizeReestrDzText(item.result), updatedAt: Date.now() };
      });
      store.departments[depid] = {
        department: cloneReestrDzPrincipalStorageValue(run.department, {}),
        processed,
        activeRun: completed ? null : snapshot,
        updatedAt: Date.now()
      };
      return store;
    });
    run.storageWarning = result && result.saved ? '' : 'Не удалось сохранить дневной прогресс в памяти Chrome.';
    syncReestrDzWriteOffProgressOverlay(run);
    return !!(result && result.saved);
  }

  async function discardReestrDzWriteOffRun(depid) {
    return updateReestrDzWriteOffStore((store) => {
      const key = String(depid || '');
      const previous = store.departments[key] && typeof store.departments[key] === 'object' ? store.departments[key] : {};
      store.departments[key] = { ...previous, activeRun: null, updatedAt: Date.now() };
      return store;
    });
  }

  function restoreReestrDzWriteOffRun(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.candidates) || !snapshot.candidates.length) return null;
    const nextIndex = Math.max(0, Number.parseInt(String(snapshot.nextIndex || 0), 10) || 0);
    if (nextIndex >= snapshot.candidates.length) return null;
    const candidates = cloneReestrDzPrincipalStorageValue(snapshot.candidates, []);
    const wasError = snapshot.status === 'error';
    return {
      status: wasError ? 'error' : 'running',
      paused: !wasError,
      pauseReason: wasError ? '' : 'manual',
      resumeWaiters: [],
      controller: new AbortController(),
      gridState: cloneReestrDzPrincipalStorageValue(snapshot.gridState, { lastpage: 1 }),
      candidates,
      results: cloneReestrDzPrincipalStorageValue(snapshot.results, []),
      nextIndex,
      currentIndex: nextIndex,
      current: candidates[nextIndex] || null,
      currentReview: cloneReestrDzPrincipalStorageValue(snapshot.currentReview, null),
      parallelWorkers: normalizeReestrDzParallelWorkers(snapshot.parallelWorkers),
      preparedResults: cloneReestrDzPrincipalStorageValue(snapshot.preparedResults, {}),
      preparedThroughIndex: Math.max(nextIndex, Number.parseInt(String(snapshot.preparedThroughIndex || nextIndex), 10) || nextIndex),
      department: cloneReestrDzPrincipalStorageValue(snapshot.department, getReestrDzCurrentDepartment()),
      period: cloneReestrDzPrincipalStorageValue(snapshot.period, null),
      recoverableError: wasError,
      canContinue: true,
      stage: wasError ? 'Восстановлена ошибка. Нажмите «Продолжить», чтобы повторить строку.' : 'Дневная проверка восстановлена на паузе.',
      warning: wasError ? normalizeReestrDzText(snapshot.warning) : '',
      overlayDismissed: false
    };
  }

  function createReestrDzWriteOffProgressOverlay() {
    ensureReestrDzPrincipalStyle();
    const existing = document.getElementById(REESTR_DZ_WRITE_OFF_OVERLAY_ID);
    if (existing instanceof HTMLElement) return existing;
    const overlay = document.createElement('section');
    overlay.id = REESTR_DZ_WRITE_OFF_OVERLAY_ID;
    overlay.className = 'dup-reestr-dz-principal-ui';
    overlay.innerHTML = `
      <div class="dup-wo-head"><div><strong>Проверка списания</strong><small data-role="meta">Подготовка</small></div><button type="button" class="dup-wo-close" data-action="close" aria-label="Закрыть">×</button></div>
      <div class="dup-wo-body">
        <div class="dup-wo-stage" data-role="stage">Подготовка запуска…</div>
        <dl class="dup-wo-grid">
          <dt>Текущая строка</dt><dd data-role="row">—</dd>
          <dt>Обработано</dt><dd data-role="progress">0 / 0</dd>
          <dt>Успешно</dt><dd data-role="saved">0</dd>
          <dt>Проблемы</dt><dd data-role="problems">0</dd>
        </dl>
        <div class="dup-wo-error" data-role="warning"></div>
        <div class="dup-wo-actions">
          <button type="button" data-action="pause">Пауза</button>
          <button type="button" data-action="resume" disabled>Продолжить</button>
          <button type="button" data-action="verify-decision" hidden>Проверить</button>
          <button type="button" data-action="report" hidden>📥 Excel</button>
        </div>
      </div>`;
    overlay.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!(button instanceof HTMLButtonElement) || !reestrDzWriteOffRun) return;
      if (button.dataset.action === 'pause') pauseReestrDzWriteOffRun(reestrDzWriteOffRun);
      if (button.dataset.action === 'resume') {
        if (reestrDzWriteOffRun.status === 'error') continueReestrDzWriteOffRun(reestrDzWriteOffRun);
        else resumeReestrDzWriteOffRun(reestrDzWriteOffRun);
      }
      if (button.dataset.action === 'report') downloadReestrDzWriteOffReport(reestrDzWriteOffRun);
      if (button.dataset.action === 'verify-decision' && typeof reestrDzWriteOffRun.decisionMismatchResolve === 'function') {
        button.disabled = true;
        reestrDzWriteOffRun.decisionMismatchResolve();
      }
      if (button.dataset.action === 'close') {
        if (reestrDzWriteOffRun.status === 'completed') {
          reestrDzWriteOffRun = null;
          overlay.remove();
        } else if (window.confirm('Остановить текущую проверку списания? Продолжить её после закрытия будет нельзя.')) {
          reestrDzWriteOffRun.controller.abort();
          void sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_CANCEL_REVIEW' });
          void discardReestrDzWriteOffRun(reestrDzWriteOffRun.department.depid);
          reestrDzWriteOffRun = null;
          overlay.remove();
          setReestrDzPrincipalLaunchButtonDisabled(false);
        }
      }
    });
    makeReestrDzWriteOffOverlayDraggable(overlay);
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function syncReestrDzWriteOffProgressOverlay(run) {
    if (!run || !isReestrDzPrincipalPage()) return;
    const overlay = createReestrDzWriteOffProgressOverlay();
    overlay.dataset.state = run.status === 'error' ? 'error' : run.status === 'completed' ? 'completed' : 'running';
    const results = Array.isArray(run.results) ? run.results : [];
    const total = Array.isArray(run.candidates) ? run.candidates.length : 0;
    const activeBatch = getReestrDzActiveBatchCandidates(run);
    const set = (role, value) => {
      const element = overlay.querySelector(`[data-role="${role}"]`);
      if (element instanceof HTMLElement) element.textContent = String(value);
    };
    set('meta', run.paused
      ? `Пауза · WSS ×${normalizeReestrDzParallelWorkers(run.parallelWorkers)}`
      : run.status === 'completed'
        ? 'Завершено'
        : `Департамент ${run.department && run.department.depid || '—'} · WSS ×${normalizeReestrDzParallelWorkers(run.parallelWorkers)}`);
    set('stage', run.stage || 'Подготовка…');
    set('row', run.current
      ? `№ ${run.current.id} · ${run.current.cell.RequestNumber || 'без поручения'}`
      : activeBatch.length
        ? `${activeBatch.map((candidate) => `№ ${candidate.id}`).join(', ')} · страница ${run.activeBatchPage || '—'}`
        : '—');
    set('progress', `${results.length} / ${total}`);
    set('saved', results.filter((item) => item && !item.error).length);
    set('problems', results.filter((item) => item && item.error).length);
    set('warning', run.warning || run.storageWarning || '');
    const pauseButton = overlay.querySelector('[data-action="pause"]');
    const resumeButton = overlay.querySelector('[data-action="resume"]');
    const reportButton = overlay.querySelector('[data-action="report"]');
    const verifyDecisionButton = overlay.querySelector('[data-action="verify-decision"]');
    if (pauseButton instanceof HTMLButtonElement) pauseButton.disabled = run.decisionMismatchPending === true || run.paused || ['error', 'completed'].includes(run.status);
    if (resumeButton instanceof HTMLButtonElement) resumeButton.disabled = run.decisionMismatchPending === true || !(run.paused || (run.status === 'error' && run.recoverableError));
    if (reportButton instanceof HTMLButtonElement) reportButton.hidden = run.status !== 'completed' || !results.length;
    if (verifyDecisionButton instanceof HTMLButtonElement) {
      verifyDecisionButton.hidden = run.decisionMismatchPending !== true;
      verifyDecisionButton.disabled = run.decisionMismatchPending !== true;
    }
  }

  async function waitForReestrDzWriteOffDecisionVerification(run, review) {
    run.decisionMismatchPending = true;
    run.stage = `Нужно проверить решение в поручении строки № ${run.current && run.current.id || '—'}.`;
    run.warning = normalizeReestrDzText(review && review.decisionMismatchMessage);
    syncReestrDzWriteOffProgressOverlay(run);
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        run.controller.signal.removeEventListener('abort', abort);
        run.decisionMismatchResolve = null;
        run.decisionMismatchPending = false;
        if (error) reject(error);
        else resolve();
      };
      const abort = () => finish(new DOMException('Проверка остановлена', 'AbortError'));
      run.decisionMismatchResolve = () => finish();
      run.controller.signal.addEventListener('abort', abort, { once: true });
      if (run.controller.signal.aborted) abort();
    });
    run.warning = '';
    syncReestrDzWriteOffProgressOverlay(run);
  }

  function updateReestrDzWriteOffStage(run, stage, warning = '') {
    run.stage = String(stage || '');
    run.warning = String(warning || '');
    syncReestrDzWriteOffProgressOverlay(run);
  }

  function pauseReestrDzWriteOffRun(run) {
    if (!run || ['error', 'completed'].includes(run.status)) return;
    run.paused = true;
    run.stage = 'Проверка приостановлена пользователем.';
    syncReestrDzWriteOffProgressOverlay(run);
    void persistReestrDzWriteOffRun(run);
  }

  function resumeReestrDzWriteOffRun(run) {
    if (!run || !run.paused) return;
    run.paused = false;
    run.warning = '';
    run.stage = 'Продолжаю проверку…';
    const waiters = run.resumeWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
    syncReestrDzWriteOffProgressOverlay(run);
  }

  async function waitForReestrDzWriteOffResume(run) {
    while (run && run.paused) await new Promise((resolve) => run.resumeWaiters.push(resolve));
    if (run && run.controller.signal.aborted) throw new DOMException('Проверка остановлена', 'AbortError');
  }

  function continueReestrDzWriteOffRun(run) {
    if (!run || run.status !== 'error' || !run.recoverableError) return;
    const failed = run.candidates[run.nextIndex] || run.current;
    for (let index = run.results.length - 1; index >= 0; index -= 1) {
      if (run.results[index] && run.results[index].error && (!failed || String(run.results[index].id) === String(failed.id))) {
        if (failed && run.results[index].informationWritten === true) failed._informationWritten = true;
        if (run.results[index].discoveryError === true && failed && run.preparedResults) {
          delete run.preparedResults[String(failed.id)];
        }
        run.results.splice(index, 1);
        break;
      }
    }
    run.status = 'running';
    run.paused = false;
    run.warning = '';
    run.recoverableError = false;
    run.stage = failed ? `Повторяю строку № ${failed.id}…` : 'Продолжаю проверку…';
    syncReestrDzWriteOffProgressOverlay(run);
    void runReestrDzWriteOffCheck(run);
  }

  async function showReestrDzWriteOffCandidate(run, candidate, attention = false) {
    await waitForReestrDzWriteOffResume(run);
    run.current = candidate;
    syncReestrDzWriteOffProgressOverlay(run);
    const pageInput = document.querySelector('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input');
    const currentPage = Math.max(1, Number.parseInt(pageInput && pageInput.value || '1', 10) || 1);
    if (currentPage !== candidate.page) {
      updateReestrDzWriteOffStage(run, `Переключаю грид на страницу ${candidate.page}…`);
      await setReestrDzGridPage(candidate.page);
    }
    const row = await waitForReestrDzGridReady(candidate.id);
    if (!(row instanceof HTMLElement)) throw new Error(`Строка № ${candidate.id} не появилась после загрузки страницы ${candidate.page}.`);
    const selected = await selectReestrDzPrincipalGridRow(row, candidate);
    selected.classList.add(REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS);
    selected.classList.toggle(REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS, attention);
    applyReestrDzBatchRowHighlights(run);
    selected.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    return selected;
  }

  function parseReestrDzWriteOffRequest(documentData, candidate) {
    const outgoingLinks = parseReestrDzOutgoingLinks({ links: documentData && documentData.outgoingLinks });
    if (outgoingLinks.length !== 1) {
      throw new Error(outgoingLinks.length ? 'В поручении найдено несколько исходящих; требуется ручная проверка.' : 'В поручении не найдена ссылка на исходящий документ.');
    }
    const outgoingNumber = normalizeReestrDzText(outgoingLinks[0].text);
    const gridOutgoing = normalizeReestrDzText(candidate && candidate.cell && candidate.cell.PrincipalNumber);
    if (gridOutgoing && outgoingNumber !== gridOutgoing) {
      throw new Error(`Исходящий в поручении (${outgoingNumber}) не совпадает со строкой грида (${gridOutgoing}).`);
    }
    const setsCount = normalizeReestrDzText(documentData && documentData.setsCount);
    const writeOffAmount = normalizeReestrDzText(documentData && documentData.writeOffAmount);
    if (!setsCount) throw new Error('В поручении не найдено значение «Количество комплектов».');
    if (!writeOffAmount) throw new Error('В поручении не найдена «Сумма списания задолженности».');
    const requestDetails = {
      basicDebtAmount: normalizeReestrDzText(documentData && documentData.basicDebtAmount),
      stateFeeAmount: normalizeReestrDzText(documentData && documentData.stateFeeAmount),
      penaltyAmount: normalizeReestrDzText(documentData && documentData.penaltyAmount),
      additionalExpensesAmount: normalizeReestrDzText(documentData && documentData.additionalExpensesAmount),
      requestOrderNumber: normalizeReestrDzText(documentData && documentData.requestOrderNumber),
      requestOrderDate: normalizeReestrDzText(documentData && documentData.requestOrderDate)
    };
    const responsibleName = normalizeReestrDzText(documentData && documentData.responsibleName);
    if (!responsibleName) throw new Error('Не найден ответственный за отражение списания в биллинговом ПК.');
    const documents = [];
    const appendDocuments = (items, type, label) => {
      (Array.isArray(items) ? items : []).forEach((item, index) => {
        const text = normalizeReestrDzText(item && item.text);
        const href = String(item && item.href || '').trim();
        if (!text || !href) return;
        documents.push({ type, label: `${label}${index ? ` ${index + 1}` : ''}`, text, href });
      });
    };
    appendDocuments(documentData && documentData.incomingLinks, 'incoming', 'Входящий');
    appendDocuments(documentData && documentData.otherLinks, 'other', 'Другой документ');
    const allDecisions = (documentData && Array.isArray(documentData.writeOffDecisions) ? documentData.writeOffDecisions : [])
      .filter((item) => REESTR_DZ_WRITE_OFF_DECISIONS.includes(normalizeReestrDzText(item && item.decision)));
    const decisions = allDecisions
      .filter((item) => normalizeReestrDzText(item && item.user).localeCompare(responsibleName, 'ru', { sensitivity: 'base' }) === 0);
    if (decisions.length > 1) throw new Error(`Найдено несколько решений о списании ответственного ${responsibleName}; требуется ручная проверка.`);
    if (!decisions.length && !documents.length && !allDecisions.length) {
      return {
        outgoingNumber,
        setsCount,
        writeOffAmount,
        ...requestDetails,
        responsibleName,
        decision: '',
        decisionDate: '',
        documents,
        notFound: true
      };
    }
    if (!decisions.length) {
      if (!documents.length) {
        throw new Error(`Найдено решение о списании другого сотрудника, но не найдены входящие или другие документы.`);
      }
      const decisionTimestamp = (item) => {
        const dateMatch = normalizeReestrDzText(item && item.date).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const timeMatch = normalizeReestrDzText(item && item.time).match(/^(\d{2}):(\d{2})$/);
        if (!dateMatch) return 0;
        return Date.UTC(
          Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]),
          timeMatch ? Number(timeMatch[1]) : 0, timeMatch ? Number(timeMatch[2]) : 0
        );
      };
      const substituteDecisions = allDecisions.slice().sort((left, right) => decisionTimestamp(right) - decisionTimestamp(left));
      const suggested = substituteDecisions[0] || null;
      return {
        outgoingNumber,
        setsCount,
        writeOffAmount,
        ...requestDetails,
        responsibleName,
        decision: suggested ? normalizeReestrDzText(suggested.decision) : '',
        decisionText: suggested ? normalizeReestrDzText(suggested.text || suggested.decision) : '',
        decisionDate: suggested ? normalizeReestrDzText(suggested.date) : '',
        decisionUser: suggested ? normalizeReestrDzText(suggested.user) : '',
        substituteDecisions,
        documents,
        notFound: false,
        requiresDecisionConfirmation: true,
        decisionMismatchMessage: `Найдены входящие или другие документы, но не найдено решение о списании ответственного ${responsibleName}.`
      };
    }
    if (!documents.length) {
      throw new Error(`Найдено решение «${normalizeReestrDzText(decisions[0].decision)}» ответственного ${responsibleName}, но не найдены входящие или другие документы.`);
    }
    return {
      outgoingNumber,
      setsCount,
      writeOffAmount,
      ...requestDetails,
      responsibleName,
      decision: normalizeReestrDzText(decisions[0].decision),
      decisionText: normalizeReestrDzText(decisions[0].text || decisions[0].decision),
      decisionDate: normalizeReestrDzText(decisions[0].date),
      decisionUser: normalizeReestrDzText(decisions[0].user),
      documents,
      notFound: false
    };
  }

  async function saveReestrDzWriteOffComment(run, candidate, cell, decision, options = {}) {
    const expected = normalizeReestrDzText(decision);
    const currentNote = String(cell && cell.Note || '').trim();
    const useBlockMatch = options && options.matchMode === 'block';
    const normalizeBlock = (value) => String(value || '')
      .split(/\r?\n/)
      .map((line) => normalizeReestrDzText(line))
      .filter(Boolean)
      .join('\n');
    const expectedBlock = normalizeBlock(decision);
    const hasExpectedComment = (note) => {
      if (!useBlockMatch) return hasReestrDzExactNoteLine(note, expected);
      const noteBlock = normalizeBlock(note);
      return noteBlock === expectedBlock || noteBlock.startsWith(`${expectedBlock}\n`) ||
        noteBlock.endsWith(`\n${expectedBlock}`) || noteBlock.includes(`\n${expectedBlock}\n`);
    };
    if (hasExpectedComment(currentNote)) return cell;
    const updatedNote = currentNote ? `${currentNote}\n${decision}` : decision;
    await showReestrDzWriteOffCandidate(run, candidate, false);
    updateReestrDzWriteOffStage(run, `Открываю штатный комментарий строки № ${candidate.id}…`);
    const nativeButton = findReestrDzNativeButton('Комментарий к реестру');
    if (!(nativeButton instanceof HTMLElement)) throw new Error('Не найдена штатная кнопка «Комментарий к реестру».');
    nativeButton.click();
    const nativeForm = await waitForReestrDzNativeForm(candidate, '/ovzid/ReestrDz/SetNote');
    const response = await sendRuntimeMessage({ action: 'REESTR_DZ_FILL_NOTE_FORM', data: { rowId: candidate.id, note: updatedNote } });
    if (!response || response.success === false) throw new Error(`Не удалось заполнить комментарий: ${response && response.error || 'нет ответа'}.`);
    updateReestrDzWriteOffStage(run, `Проверяю сохранение комментария строки № ${candidate.id}…`);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt ? 500 : 250));
      const verified = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
      const verifiedCell = verified && verified.cell;
      if (verifiedCell && hasExpectedComment(verifiedCell.Note)) {
        await waitForReestrDzGridReady('', 20000);
        closeReestrDzPrincipalNativeDialog(nativeForm.frame);
        return { ...cell, ...verifiedCell };
      }
    }
    throw new Error(`Пирамида не подтвердила комментарий строки № ${candidate.id}.`);
  }

  async function saveReestrDzWriteOffOrder(run, candidate, cell, fields) {
    await showReestrDzWriteOffCandidate(run, candidate, false);
    updateReestrDzWriteOffStage(run, `Открываю штатную форму приказа строки № ${candidate.id}…`);
    const nativeButton = findReestrDzNativeButton('Заполнить сведения о приказе по списанию');
    if (!(nativeButton instanceof HTMLElement)) throw new Error('Не найдена штатная кнопка «Заполнить сведения о приказе по списанию».');
    nativeButton.click();
    const nativeForm = await waitForReestrDzNativeForm(candidate, '/ovzid/ReestrDz/Order');
    const response = await sendRuntimeMessage({
      action: 'REESTR_DZ_FILL_ORDER_FORM',
      data: { rowId: candidate.id, orderDate: fields.orderDate, orderNumber: fields.orderNumber }
    });
    if (!response || response.success === false) throw new Error(`Не удалось заполнить сведения о приказе: ${response && response.error || 'нет ответа'}.`);
    updateReestrDzWriteOffStage(run, `Проверяю сохранение приказа строки № ${candidate.id}…`);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt ? 500 : 250));
      const verified = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
      const verifiedCell = verified && verified.cell;
      if (verifiedCell && normalizeReestrDzText(verifiedCell.OrderDate) === fields.orderDate && normalizeReestrDzText(verifiedCell.OrderNumber) === fields.orderNumber) {
        await waitForReestrDzGridReady('', 20000);
        closeReestrDzPrincipalNativeDialog(nativeForm.frame);
        return { ...cell, ...verifiedCell };
      }
    }
    throw new Error(`Пирамида не подтвердила приказ строки № ${candidate.id}.`);
  }

  async function waitForReestrDzWriteOffReview(run) {
    while (true) {
      await waitForReestrDzWriteOffResume(run);
      const response = await sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_POLL_REVIEW' });
      if (response && response.success && response.status === 'done') {
        const mode = ['comment', 'decision_confirm', 'decision_skip'].includes(response.mode) ? response.mode : 'order';
        return { mode, ...(response.fields || {}) };
      }
      if (response && response.success && response.status === 'cancelled') {
        const error = new Error('Проверка остановлена пользователем.');
        error.code = 'WRITE_OFF_CANCELLED';
        throw error;
      }
      if (!response || response.success === false) throw new Error('Вкладка ручной проверки была закрыта или потеряла связь с Пирамидой.');
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  }

  function didReestrDzWriteOffInformationChange(beforeCell, afterCell) {
    return ['Note', 'OrderDate', 'OrderNumber'].some((key) =>
      normalizeReestrDzText(beforeCell && beforeCell[key]) !== normalizeReestrDzText(afterCell && afterCell[key])
    );
  }

  async function inspectReestrDzWriteOffCandidate(run, candidate, workerKey) {
    if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
      return { kind: 'excluded', workerKey, actionable: false };
    }
    const requestUrl = new URL('/api/wss/doclink/redirect', window.location.origin);
    requestUrl.searchParams.set('RegNumber', candidate.cell.RequestNumber);
    const requestDocument = await loadReestrDzWssDocument(
      requestUrl.toString(), 'writeoff_request', candidate.cell.RequestNumber, workerKey
    );
    const review = parseReestrDzWriteOffRequest(requestDocument, candidate);
    const cancellationComments = getReestrDzCancellationComments(requestDocument);
    return {
      kind: review.notFound ? 'not_found' : 'review',
      workerKey,
      requestDocument,
      review,
      cancellationComments,
      actionable: !review.notFound || cancellationComments.length > 0
    };
  }

  async function processReestrDzWriteOffCandidate(run, candidate, preparedInspection = null) {
    if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
      return {
        ...buildReestrDzExcludedClaimantResult(candidate),
        review: null
      };
    }
    updateReestrDzWriteOffStage(run, `Открываю поручение ${candidate.cell.RequestNumber}…`);
    await showReestrDzWriteOffCandidate(run, candidate, false);
    const inspection = preparedInspection || await inspectReestrDzWriteOffCandidate(run, candidate, 'default');
    const requestDocument = inspection.requestDocument;
    const review = inspection.review;
    run.currentReview = review;
    await persistReestrDzWriteOffRun(run);
    if (review.requiresDecisionConfirmation) {
      await waitForReestrDzWriteOffDecisionVerification(run, review);
      updateReestrDzWriteOffStage(run, `Открываю поручение ${candidate.cell.RequestNumber} для ручной проверки решения…`);
      const opened = await sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_OPEN_REVIEW',
        data: {
          reviewType: 'decision_mismatch',
          rowId: candidate.id,
          depid: run.department && run.department.depid || '',
          progressText: `${run.currentIndex + 1} / ${run.candidates.length}`,
          requestNumber: candidate.cell.RequestNumber,
          responsibleName: review.responsibleName,
          errorMessage: review.decisionMismatchMessage,
          decision: review.decision,
          suggestedDecisionText: review.decisionText,
          decisionUser: review.decisionUser,
          decisionDate: review.decisionDate,
          documents: [{
            type: 'request',
            label: 'Поручение',
            text: candidate.cell.RequestNumber,
            href: requestDocument.url
          }]
        }
      });
      if (!opened || opened.success === false) {
        throw new Error(`Не удалось открыть поручение для проверки решения: ${opened && opened.error || 'нет ответа'}.`);
      }
      const verification = await waitForReestrDzWriteOffReview(run);
      if (verification.mode === 'decision_skip') {
        let live = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
        let cell = live && live.cell ? { ...candidate.cell, ...live.cell } : { ...candidate.cell };
        const originalCell = { ...cell };
        candidate._writeOffBaselineCell = originalCell;
        const comment = String(verification.comment || '').trim();
        if (normalizeReestrDzText(comment)) {
          updateReestrDzWriteOffStage(run, `Сохраняю комментарий ручной проверки строки № ${candidate.id}…`);
          cell = await saveReestrDzWriteOffComment(run, candidate, cell, comment, { matchMode: 'block' });
        }
        const commentWritten = didReestrDzWriteOffInformationChange(originalCell, cell);
        candidate._informationWritten = candidate._informationWritten === true || commentWritten;
        return {
          cell,
          review,
          fields: { orderDate: '', orderNumber: '' },
          result: commentWritten
            ? 'Пропущено, комментарий сохранён'
            : normalizeReestrDzText(comment) ? 'Пропущено, комментарий уже был' : 'Пропущено вручную',
          description: commentWritten
            ? 'Решение другого сотрудника не подтверждено; сохранён комментарий ручной проверки.'
            : normalizeReestrDzText(comment)
              ? 'Решение другого сотрудника не подтверждено; такой комментарий уже содержался в строке.'
            : 'Решение другого сотрудника не подтверждено; данные Пирамиды не изменялись.',
          skipped: true,
          informationWritten: candidate._informationWritten === true
        };
      }
      if (verification.mode !== 'decision_confirm' || !normalizeReestrDzText(review.decision)) {
        throw new Error('Замещающее решение не было подтверждено.');
      }
      review.requiresDecisionConfirmation = false;
    }
    if (review.notFound && !getReestrDzCancellationComments(requestDocument).length) {
      updateReestrDzWriteOffStage(run, `По строке № ${candidate.id} решение и документы не найдены. Перехожу дальше…`);
      return {
        cell: { ...candidate.cell },
        review,
        result: 'Не найдено',
        description: 'Решение о списании, входящий и другие документы отсутствуют.',
        informationWritten: candidate._informationWritten === true
      };
    }
    let live = await loadReestrDzRowById(run.gridState, candidate.id, run.controller.signal);
    let cell = live && live.cell ? { ...candidate.cell, ...live.cell } : { ...candidate.cell };
    const originalCell = { ...cell };
    candidate._writeOffBaselineCell = originalCell;
    if (review.notFound) {
      updateReestrDzWriteOffStage(run, `По строке № ${candidate.id} решение и документы не найдены. Перехожу дальше…`);
      const beforeCancellation = cell;
      cell = await applyReestrDzCancellationComments(
        run, candidate, cell, requestDocument, saveReestrDzWriteOffComment
      );
      candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeCancellation, cell);
      return {
        cell,
        review,
        result: 'Не найдено',
        description: 'Решение о списании, входящий и другие документы отсутствуют.',
        informationWritten: candidate._informationWritten === true || didReestrDzWriteOffInformationChange(originalCell, cell)
      };
    }
    if (review.decision === 'Отказ в списании') {
      updateReestrDzWriteOffStage(run, `Сохраняю отказ в комментарии строки № ${candidate.id}…`);
      const beforeDecision = cell;
      cell = await saveReestrDzWriteOffComment(run, candidate, cell, review.decision);
      candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeDecision, cell);
      const beforeCancellation = cell;
      cell = await applyReestrDzCancellationComments(
        run, candidate, cell, requestDocument, saveReestrDzWriteOffComment
      );
      candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeCancellation, cell);
      return {
        cell,
        review,
        result: 'Отказ сохранён',
        informationWritten: candidate._informationWritten === true || didReestrDzWriteOffInformationChange(originalCell, cell)
      };
    }
    updateReestrDzWriteOffStage(run, `Открываю ручную проверку документов строки № ${candidate.id}…`);
    const opened = await sendRuntimeMessage({
      action: 'REESTR_DZ_WRITE_OFF_OPEN_REVIEW',
      data: {
        rowId: candidate.id,
        depid: run.department && run.department.depid || '',
        progressText: `${run.currentIndex + 1} / ${run.candidates.length}`,
        outgoingNumber: review.outgoingNumber,
        setsCount: review.setsCount,
        writeOffAmount: review.writeOffAmount,
        basicDebtAmount: review.basicDebtAmount,
        stateFeeAmount: review.stateFeeAmount,
        penaltyAmount: review.penaltyAmount,
        additionalExpensesAmount: review.additionalExpensesAmount,
        requestOrderNumber: review.requestOrderNumber,
        requestOrderDate: review.requestOrderDate,
        decision: review.decision,
        documents: review.documents
      }
    });
    if (!opened || opened.success === false) throw new Error(`Не удалось открыть документы: ${opened && opened.error || 'нет ответа'}.`);
    const fields = await waitForReestrDzWriteOffReview(run);
    if (fields.mode === 'comment') {
      const comment = String(fields.comment || '').trim();
      if (!normalizeReestrDzText(comment)) throw new Error('Ручная проверка вернула пустой комментарий.');
      updateReestrDzWriteOffStage(run, `Сохраняю комментарий без реквизитов приказа для строки № ${candidate.id}…`);
      const beforeComment = cell;
      cell = await saveReestrDzWriteOffComment(run, candidate, cell, comment, { matchMode: 'block' });
      candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeComment, cell);
      const beforeCancellation = cell;
      cell = await applyReestrDzCancellationComments(
        run, candidate, cell, requestDocument, saveReestrDzWriteOffComment
      );
      candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeCancellation, cell);
      return {
        cell,
        review,
        fields: { orderDate: '', orderNumber: '' },
        result: 'Комментарий сохранён',
        description: 'Реквизиты приказа пропущены пользователем; сохранён комментарий ручной проверки.',
        informationWritten: candidate._informationWritten === true || didReestrDzWriteOffInformationChange(originalCell, cell)
      };
    }
    const orderDate = normalizeReestrDzText(fields.orderDate);
    const orderNumber = normalizeReestrDzText(fields.orderNumber);
    if (parseReestrDzDate(orderDate) === null || !/^\d{2}\.\d{2}\.\d{4}$/.test(orderDate) || !orderNumber) {
      throw new Error('Ручная проверка вернула некорректные реквизиты приказа.');
    }
    updateReestrDzWriteOffStage(run, `Сохраняю решение строки № ${candidate.id}…`);
    const beforeDecision = cell;
    cell = await saveReestrDzWriteOffComment(run, candidate, cell, review.decision);
    candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeDecision, cell);
    const beforeOrder = cell;
    cell = await saveReestrDzWriteOffOrder(run, candidate, cell, { orderDate, orderNumber });
    candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeOrder, cell);
    const beforeCancellation = cell;
    cell = await applyReestrDzCancellationComments(
      run, candidate, cell, requestDocument, saveReestrDzWriteOffComment
    );
    candidate._informationWritten = candidate._informationWritten === true || didReestrDzWriteOffInformationChange(beforeCancellation, cell);
    return {
      cell,
      review,
      fields: { orderDate, orderNumber },
      result: 'Приказ сохранён',
      informationWritten: candidate._informationWritten === true || didReestrDzWriteOffInformationChange(originalCell, cell)
    };
  }

  async function confirmReestrDzWriteOffCommentedCandidate(candidate, context = {}) {
    document.getElementById(REESTR_DZ_WRITE_OFF_COMMENT_CONFIRM_ID)?.remove();
    let rules = await getReestrDzWriteOffCommentSkipRules();
    return new Promise((resolve) => {
      const cell = candidate && candidate.cell && typeof candidate.cell === 'object' ? candidate.cell : {};
      const overlay = document.createElement('section');
      overlay.id = REESTR_DZ_WRITE_OFF_COMMENT_CONFIRM_ID;
      overlay.className = 'dup-reestr-dz-principal-ui dup-wo-confirm-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', `Повторная обработка реестра № ${candidate && candidate.id || '—'}`);

      const card = document.createElement('div');
      card.className = 'dup-wo-confirm-card';
      card.innerHTML = `
        <div class="dup-wo-confirm-head">
          <div><strong>В строке уже есть комментарий</strong><small data-field="subtitle"></small></div>
          <span class="dup-wo-confirm-position" data-field="position"></span>
        </div>
        <div class="dup-wo-confirm-body">
          <div class="dup-wo-decision-panel" data-panel="decision">
            <dl class="dup-wo-confirm-grid">
              <dt>Реестр</dt><dd data-field="id"></dd>
              <dt>Взыскатель</dt><dd data-field="claimant"></dd>
              <dt>Поручение</dt><dd data-field="request"></dd>
              <dt>Исходящий</dt><dd data-field="outgoing"></dd>
              <dt>Дата запуска</dt><dd data-field="request-date"></dd>
            </dl>
            <div class="dup-wo-confirm-note" data-field="note"></div>
            <textarea class="dup-wo-confirm-note-input" data-field="rule-input" hidden aria-label="Правило автопропуска"></textarea>
            <div class="dup-wo-confirm-validation" data-field="validation"></div>
            <div class="dup-wo-confirm-toolbar">
              <button type="button" class="dup-wo-confirm-dictionary" data-action="dictionary"></button>
            </div>
            <div class="dup-wo-confirm-question" data-field="question">Обрабатывать эту строку?</div>
            <div class="dup-wo-confirm-actions" data-field="actions"></div>
          </div>
          <div class="dup-wo-dictionary-panel" data-panel="dictionary" hidden>
            <h3 class="dup-wo-dictionary-title">Словарь автопропуска</h3>
            <p class="dup-wo-dictionary-help">Совпадение ищется внутри комментария без учёта регистра и лишних пробелов.</p>
            <div class="dup-wo-confirm-validation" data-field="dictionary-validation"></div>
            <div class="dup-wo-dictionary-list" data-field="dictionary-list"></div>
            <div class="dup-wo-dictionary-footer">
              <button type="button" class="dup-wo-dictionary-back" data-action="dictionary-back">Назад</button>
            </div>
          </div>
        </div>`;
      overlay.appendChild(card);

      const setText = (field, value) => {
        const target = overlay.querySelector(`[data-field="${field}"]`);
        if (target) target.textContent = normalizeReestrDzText(value) || '—';
      };
      setText('id', `№ ${candidate && candidate.id || '—'}`);
      setText('claimant', cell.ClaimantName || cell.Claimant || cell.ClaimantFullName);
      setText('request', cell.RequestNumber);
      setText('outgoing', cell.PrincipalNumber);
      setText('request-date', cell.RequestDate);
      setText('note', cell.Note);
      setText('subtitle', `Реестр № ${candidate && candidate.id || '—'}`);
      const position = Math.max(1, Number.parseInt(String(context.position || 1), 10) || 1);
      const total = Math.max(position, Number.parseInt(String(context.total || position), 10) || position);
      setText('position', `${position} / ${total}`);

      const decisionPanel = overlay.querySelector('[data-panel="decision"]');
      const dictionaryPanel = overlay.querySelector('[data-panel="dictionary"]');
      const noteElement = overlay.querySelector('[data-field="note"]');
      const ruleInput = overlay.querySelector('[data-field="rule-input"]');
      const validation = overlay.querySelector('[data-field="validation"]');
      const actions = overlay.querySelector('[data-field="actions"]');
      const question = overlay.querySelector('[data-field="question"]');
      const dictionaryButton = overlay.querySelector('[data-action="dictionary"]');
      const dictionaryList = overlay.querySelector('[data-field="dictionary-list"]');
      const dictionaryValidation = overlay.querySelector('[data-field="dictionary-validation"]');
      let selected = 'no';
      let settled = false;
      let mode = 'decision';
      let editingRuleIndex = -1;
      const updateDictionaryCount = () => {
        if (dictionaryButton instanceof HTMLButtonElement) dictionaryButton.textContent = `Словарь (${rules.length})`;
      };
      const select = (choice, focus = true) => {
        selected = choice === 'yes' ? 'yes' : 'no';
        const noButton = overlay.querySelector('[data-choice="no"]');
        const yesButton = overlay.querySelector('[data-choice="yes"]');
        noButton?.setAttribute('aria-pressed', String(selected === 'no'));
        yesButton?.setAttribute('aria-pressed', String(selected === 'yes'));
        if (focus) (selected === 'yes' ? yesButton : noButton)?.focus();
      };
      const finish = (result) => {
        if (settled) return;
        settled = true;
        card.classList.add('is-leaving');
        window.setTimeout(() => {
          overlay.remove();
          resolve(result);
        }, 180);
      };
      const renderDecisionActions = () => {
        if (!(actions instanceof HTMLElement)) return;
        if (mode === 'learn') {
          actions.innerHTML = `
            <button type="button" data-action="learn-cancel">Отмена</button>
            <button type="button" data-action="learn-save">Сохранить</button>`;
          return;
        }
        actions.innerHTML = `
          <button type="button" data-choice="no" aria-pressed="true">Нет</button>
          <button type="button" data-choice="yes" aria-pressed="false">Да</button>
          <button type="button" data-action="learn">Пропустить</button>`;
        select(selected, false);
      };
      const setDecisionMode = (nextMode) => {
        mode = nextMode === 'learn' ? 'learn' : 'decision';
        if (noteElement instanceof HTMLElement) noteElement.hidden = mode === 'learn';
        if (ruleInput instanceof HTMLTextAreaElement) ruleInput.hidden = mode !== 'learn';
        if (validation instanceof HTMLElement) validation.textContent = '';
        if (question instanceof HTMLElement) question.textContent = mode === 'learn'
          ? 'Сохранить этот фрагмент как правило автопропуска?'
          : 'Обрабатывать эту строку?';
        renderDecisionActions();
        if (mode === 'learn' && ruleInput instanceof HTMLTextAreaElement) {
          ruleInput.value = normalizeReestrDzText(cell.Note);
          window.setTimeout(() => {
            ruleInput.focus();
            ruleInput.select();
          }, 0);
        }
      };
      const renderDictionary = () => {
        updateDictionaryCount();
        if (!(dictionaryList instanceof HTMLElement)) return;
        dictionaryList.replaceChildren();
        if (!rules.length) {
          const empty = document.createElement('div');
          empty.className = 'dup-wo-dictionary-empty';
          empty.textContent = 'Сохранённых правил пока нет.';
          dictionaryList.appendChild(empty);
          return;
        }
        rules.forEach((rule, index) => {
          if (editingRuleIndex === index) {
            const editor = document.createElement('div');
            editor.className = 'dup-wo-dictionary-editor';
            editor.dataset.ruleIndex = String(index);
            const input = document.createElement('input');
            input.type = 'text';
            input.value = rule;
            input.dataset.field = 'dictionary-edit-input';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.dataset.action = 'dictionary-edit-cancel';
            cancel.textContent = 'Отмена';
            const save = document.createElement('button');
            save.type = 'button';
            save.dataset.action = 'dictionary-edit-save';
            save.textContent = 'Сохранить';
            editor.append(input, cancel, save);
            dictionaryList.appendChild(editor);
            window.setTimeout(() => { input.focus(); input.select(); }, 0);
            return;
          }
          const row = document.createElement('div');
          row.className = 'dup-wo-dictionary-row';
          row.dataset.ruleIndex = String(index);
          const text = document.createElement('div');
          text.className = 'dup-wo-dictionary-rule';
          text.textContent = rule;
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.dataset.action = 'dictionary-edit';
          edit.title = 'Редактировать правило';
          edit.setAttribute('aria-label', `Редактировать правило ${rule}`);
          edit.textContent = '✏️';
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.dataset.action = 'dictionary-delete';
          remove.title = 'Удалить правило';
          remove.setAttribute('aria-label', `Удалить правило ${rule}`);
          remove.textContent = '❌';
          row.append(text, edit, remove);
          dictionaryList.appendChild(row);
        });
      };
      const showDictionary = () => {
        mode = 'dictionary';
        editingRuleIndex = -1;
        if (decisionPanel instanceof HTMLElement) decisionPanel.hidden = true;
        if (dictionaryPanel instanceof HTMLElement) dictionaryPanel.hidden = false;
        if (dictionaryValidation instanceof HTMLElement) dictionaryValidation.textContent = '';
        renderDictionary();
      };
      const showDecision = () => {
        mode = 'decision';
        if (dictionaryPanel instanceof HTMLElement) dictionaryPanel.hidden = true;
        if (decisionPanel instanceof HTMLElement) decisionPanel.hidden = false;
        setDecisionMode('decision');
        window.setTimeout(() => select('no'), 0);
      };
      overlay.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-choice]') : null;
        if (button instanceof HTMLButtonElement) {
          finish({ action: button.dataset.choice === 'yes' ? 'process' : 'skip' });
          return;
        }
        const actionButton = event.target instanceof Element ? event.target.closest('[data-action]') : null;
        if (!(actionButton instanceof HTMLButtonElement)) return;
        const action = String(actionButton.dataset.action || '');
        if (action === 'learn') {
          setDecisionMode('learn');
          return;
        }
        if (action === 'learn-cancel') {
          setDecisionMode('decision');
          window.setTimeout(() => select('no'), 0);
          return;
        }
        if (action === 'dictionary') {
          showDictionary();
          return;
        }
        if (action === 'dictionary-back') {
          showDecision();
          return;
        }
        void (async () => {
          try {
            if (action === 'learn-save') {
              const rule = normalizeReestrDzText(ruleInput instanceof HTMLTextAreaElement ? ruleInput.value : '');
              if (normalizeReestrDzWriteOffCommentRule(rule).length < 3) {
                if (validation instanceof HTMLElement) validation.textContent = 'Введите не менее трёх символов.';
                ruleInput?.focus();
                return;
              }
              rules = await saveReestrDzWriteOffCommentSkipRules([...rules, rule]);
              finish({ action: 'rule', rule });
              return;
            }
            const holder = actionButton.closest('[data-rule-index]');
            const index = Number.parseInt(String(holder && holder.dataset.ruleIndex || '-1'), 10);
            if (!Number.isInteger(index) || index < 0 || index >= rules.length) return;
            if (action === 'dictionary-edit') {
              editingRuleIndex = index;
              renderDictionary();
              return;
            }
            if (action === 'dictionary-edit-cancel') {
              editingRuleIndex = -1;
              renderDictionary();
              return;
            }
            if (action === 'dictionary-delete') {
              rules = await saveReestrDzWriteOffCommentSkipRules(rules.filter((_, ruleIndex) => ruleIndex !== index));
              editingRuleIndex = -1;
              renderDictionary();
              return;
            }
            if (action === 'dictionary-edit-save') {
              const input = holder && holder.querySelector('[data-field="dictionary-edit-input"]');
              const nextRule = normalizeReestrDzText(input instanceof HTMLInputElement ? input.value : '');
              if (normalizeReestrDzWriteOffCommentRule(nextRule).length < 3) {
                if (dictionaryValidation instanceof HTMLElement) dictionaryValidation.textContent = 'Введите не менее трёх символов.';
                input?.focus();
                return;
              }
              const nextRules = [...rules];
              nextRules[index] = nextRule;
              rules = await saveReestrDzWriteOffCommentSkipRules(nextRules);
              editingRuleIndex = -1;
              if (dictionaryValidation instanceof HTMLElement) dictionaryValidation.textContent = '';
              renderDictionary();
            }
          } catch (error) {
            const target = mode === 'dictionary' ? dictionaryValidation : validation;
            if (target instanceof HTMLElement) target.textContent = error && error.message ? error.message : String(error);
          }
        })();
      });
      overlay.addEventListener('keydown', (event) => {
        if (mode === 'learn') {
          if (event.key === 'Escape') {
            event.preventDefault();
            setDecisionMode('decision');
            window.setTimeout(() => select('no'), 0);
          } else if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            overlay.querySelector('[data-action="learn-save"]')?.click();
          }
          return;
        }
        if (mode === 'dictionary') {
          if (event.key === 'Escape') {
            event.preventDefault();
            showDecision();
          } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            event.target.closest('[data-rule-index]')?.querySelector('[data-action="dictionary-edit-save"]')?.click();
          }
          return;
        }
        if (event.target instanceof HTMLButtonElement && event.target.dataset.action) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          select('yes');
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          select('no');
        } else if (event.key === 'Enter') {
          event.preventDefault();
          finish({ action: selected === 'yes' ? 'process' : 'skip' });
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish({ action: 'skip' });
        }
      });
      (document.body || document.documentElement).appendChild(overlay);
      updateDictionaryCount();
      renderDecisionActions();
      window.setTimeout(() => select('no'), 0);
    });
  }

  async function collectReestrDzWriteOffBatch(run) {
    const candidates = Array.isArray(run && run.candidates) ? run.candidates : [];
    const batchStart = Math.max(0, Number.parseInt(String(run && run.nextIndex || 0), 10) || 0);
    if (batchStart >= candidates.length) return [];
    const page = Math.max(1, Number.parseInt(String(candidates[batchStart].page || 1), 10) || 1);
    const workerLimit = normalizeReestrDzParallelWorkers(run.parallelWorkers);
    const preparedResults = ensureReestrDzPreparedResults(run);
    let rules = await getReestrDzWriteOffCommentSkipRules();
    const batchCandidates = [];
    let activeCount = 0;
    let index = batchStart;

    while (index < candidates.length && activeCount < workerLimit) {
      await waitForReestrDzWriteOffResume(run);
      const candidate = candidates[index];
      const candidatePage = Math.max(1, Number.parseInt(String(candidate && candidate.page || 1), 10) || 1);
      if (candidatePage !== page) break;
      batchCandidates.push(candidate);
      const key = String(candidate.id);
      const prepared = preparedResults[key];
      if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
        index += 1;
        continue;
      }
      if (prepared && prepared.success === true && prepared.value && prepared.value.kind === 'skip_comment') {
        index += 1;
        continue;
      }
      const note = normalizeReestrDzText(candidate.cell && candidate.cell.Note);
      const matchedRule = note ? findReestrDzWriteOffCommentSkipRule(note, rules) : '';
      if (matchedRule) {
        preparedResults[key] = {
          success: true,
          value: { kind: 'skip_comment', actionable: false, skipReason: 'dictionary', rule: matchedRule }
        };
        run.current = candidate;
        run.stage = `Строка № ${candidate.id} пропущена по правилу «${matchedRule}». Добираю группу…`;
        syncReestrDzWriteOffProgressOverlay(run);
        index += 1;
        continue;
      }
      if (prepared) {
        activeCount += 1;
        index += 1;
        continue;
      }
      if (!note) {
        activeCount += 1;
        index += 1;
        continue;
      }

      await showReestrDzWriteOffCandidate(run, candidate, false);
      run.stage = `Строка № ${candidate.id} уже содержит комментарий. Ожидаю решение до открытия WSS…`;
      syncReestrDzWriteOffProgressOverlay(run);
      const decision = await confirmReestrDzWriteOffCommentedCandidate(candidate, {
        position: index + 1,
        total: candidates.length
      });
      rules = await getReestrDzWriteOffCommentSkipRules();
      if (!decision || decision.action !== 'process') {
        preparedResults[key] = {
          success: true,
          value: {
            kind: 'skip_comment',
            actionable: false,
            skipReason: decision && decision.action === 'rule' ? 'rule_saved' : 'manual',
            rule: decision && decision.rule || ''
          }
        };
        index += 1;
        continue;
      }
      activeCount += 1;
      index += 1;
    }
    return batchCandidates;
  }

  async function runReestrDzWriteOffCheck(run) {
    if (!run || run.workerActive) return;
    run.workerActive = true;
    try {
      while (run.nextIndex < run.candidates.length) {
        await waitForReestrDzWriteOffResume(run);
        const batchStart = run.nextIndex;
        const batchCandidates = await collectReestrDzWriteOffBatch(run);
        const batchEnd = batchStart + batchCandidates.length;
        run.preparedThroughIndex = batchEnd;
        const preparedResults = ensureReestrDzPreparedResults(run);

        run.current = null;
        run.currentReview = null;
        const preparationPromise = prepareReestrDzParallelBatch(
          run,
          batchCandidates,
          inspectReestrDzWriteOffCandidate,
          persistReestrDzWriteOffRun,
          syncReestrDzWriteOffProgressOverlay,
          'Параллельно проверяю поручения WSS'
        );
        const activeBatchCandidates = batchCandidates.filter((candidate) => {
          if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) return false;
          const prepared = preparedResults[String(candidate.id)];
          return !(prepared && prepared.success === true && prepared.value && prepared.value.kind === 'skip_comment');
        });
        const [preparationResult, visualizationResult] = await Promise.allSettled([
          preparationPromise,
          showReestrDzActiveBatch(
            run,
            activeBatchCandidates,
            waitForReestrDzWriteOffResume,
            syncReestrDzWriteOffProgressOverlay,
            'Активная группа'
          )
        ]);
        if (preparationResult.status === 'rejected') throw preparationResult.reason;
        if (visualizationResult.status === 'rejected') throw visualizationResult.reason;
        const preparedBatch = preparationResult.value;
        await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION', data: { workersOnly: true } }).catch(() => null);
        run.parallelProgress = null;
        run.activeBatchCandidates = [];
        run.activeBatchPage = null;
        run.stage = `Проверка группы завершена. Обрабатываю ${batchCandidates.length} строк по порядку грида…`;
        syncReestrDzWriteOffProgressOverlay(run);

        for (let offset = 0; offset < batchCandidates.length; offset += 1) {
          const index = batchStart + offset;
          const candidate = batchCandidates[offset];
          const prepared = preparedBatch[offset];
          run.currentIndex = index;
          run.nextIndex = index;
          run.current = candidate;
          await waitForReestrDzWriteOffResume(run);
          if (isReestrDzWriteOffExcludedClaimant(candidate.cell)) {
            run.current = null;
            run.results.push({ id: candidate.id, ...buildReestrDzExcludedClaimantResult(candidate), review: null });
            delete run.preparedResults[String(candidate.id)];
            run.nextIndex = index + 1;
            run.currentReview = null;
            await persistReestrDzWriteOffRun(run);
            continue;
          }
          if (prepared && prepared.success === true && prepared.value && prepared.value.kind === 'skip_comment') {
            const skipReason = normalizeReestrDzText(prepared.value.skipReason);
            const rule = normalizeReestrDzText(prepared.value.rule);
            run.results.push({
              id: candidate.id,
              cell: { ...candidate.cell },
              review: null,
              result: skipReason === 'dictionary' ? 'Пропущено по словарю' : 'Пропущено по комментарию',
              description: skipReason === 'dictionary'
                ? `Комментарий содержит правило автопропуска «${rule}».`
                : skipReason === 'rule_saved'
                  ? `Строка пропущена; сохранено правило автопропуска «${rule}».`
                  : 'Пользователь отказался от повторной обработки строки с заполненным комментарием.',
              skipped: true,
              informationWritten: false,
              error: false
            });
            setReestrDzBatchRowResult(run, candidate.id, false);
            delete run.preparedResults[String(candidate.id)];
            run.nextIndex = index + 1;
            run.currentReview = null;
            await persistReestrDzWriteOffRun(run);
            continue;
          }
          try {
            if (!prepared || prepared.success !== true) {
              const discoveryError = new Error(prepared && prepared.error || `Не удалось проверить WSS для строки № ${candidate.id}.`);
              discoveryError.discoveryError = true;
              throw discoveryError;
            }
            const result = await processReestrDzWriteOffCandidate(run, run.current, prepared.value);
            delete run.current._writeOffBaselineCell;
            delete run.current._informationWritten;
            run.results.push({ id: run.current.id, ...result, error: false });
            setReestrDzBatchRowResult(run, run.current.id, false);
            delete run.preparedResults[String(candidate.id)];
            run.nextIndex = index + 1;
            run.currentReview = null;
            await persistReestrDzWriteOffRun(run);
          } catch (error) {
            if (error && (error.name === 'AbortError' || error.code === 'WRITE_OFF_CANCELLED')) {
              clearReestrDzWriteOffDraft();
              await discardReestrDzWriteOffRun(run.department.depid);
              await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION' }).catch(() => null);
              reestrDzWriteOffRun = null;
              document.getElementById(REESTR_DZ_WRITE_OFF_OVERLAY_ID)?.remove();
              return;
            }
            const baselineCell = run.current._writeOffBaselineCell || run.current.cell;
            let errorCell = { ...baselineCell };
            try {
              const latest = await loadReestrDzRowById(run.gridState, run.current.id, run.controller.signal);
              if (latest && latest.cell) errorCell = { ...errorCell, ...latest.cell };
            } catch (readError) {
              // Если грид недоступен, сохраняем исходный снимок; после продолжения строка будет проверена повторно.
            }
            run.results.push({
              id: run.current.id,
              cell: errorCell,
              result: 'Проблема',
              description: error && error.message ? error.message : String(error),
              informationWritten: run.current._informationWritten === true || didReestrDzWriteOffInformationChange(baselineCell, errorCell),
              discoveryError: error && error.discoveryError === true,
              error: true
            });
            setReestrDzBatchRowResult(run, run.current.id, true);
            delete run.current._writeOffBaselineCell;
            run.status = 'error';
            run.recoverableError = true;
            run.warning = error && error.message ? error.message : String(error);
            run.stage = `Проверка остановлена на строке № ${run.current.id}.`;
            await sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_CANCEL_REVIEW' }).catch(() => null);
            await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION' }).catch(() => null);
            await showReestrDzWriteOffCandidate(run, run.current, true).catch(() => null);
            await persistReestrDzWriteOffRun(run);
            return;
          }
        }
        run.preparedThroughIndex = run.nextIndex;
      }
      run.status = 'completed';
      run.current = null;
      run.currentReview = null;
      run.reportDownloaded = downloadReestrDzWriteOffReport(run);
      run.stage = `Проверка завершена. Обработано строк: ${run.results.length}.${run.reportDownloaded ? ' Итоговый отчёт скачан.' : ''}`;
      run.warning = '';
      clearReestrDzWriteOffDraft();
      await persistReestrDzWriteOffRun(run);
      await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION' }).catch(() => null);
      syncReestrDzWriteOffProgressOverlay(run);
    } catch (error) {
      if (error && (error.name === 'AbortError' || error.code === 'WRITE_OFF_CANCELLED')) {
        clearReestrDzWriteOffDraft();
        await discardReestrDzWriteOffRun(run.department.depid);
        await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION' }).catch(() => null);
        reestrDzWriteOffRun = null;
        document.getElementById(REESTR_DZ_WRITE_OFF_OVERLAY_ID)?.remove();
        return;
      }
      run.status = 'error';
      run.recoverableError = false;
      run.warning = error && error.message ? error.message : String(error);
      run.stage = 'Проверка остановлена из-за ошибки параллельной обработки.';
      await sendRuntimeMessage({ action: 'REESTR_DZ_CLOSE_WSS_SESSION' }).catch(() => null);
      await persistReestrDzWriteOffRun(run);
      syncReestrDzWriteOffProgressOverlay(run);
    } finally {
      run.workerActive = false;
      setReestrDzPrincipalLaunchButtonDisabled(false);
    }
  }

  async function startReestrDzWriteOffCheck() {
    if (!isReestrDzPrincipalPage() || !isExtensionUiSettingEnabled('reestrDzPrincipalAutofill')) return;
    if (reestrDzPrincipalRun && reestrDzPrincipalRun.status !== 'completed') {
      window.alert('Сначала завершите текущую проверку исходящих.');
      return;
    }
    if (reestrDzWriteOffRun && reestrDzWriteOffRun.status !== 'completed') {
      syncReestrDzWriteOffProgressOverlay(reestrDzWriteOffRun);
      return;
    }
    setReestrDzPrincipalLaunchButtonDisabled(true);
    const department = getReestrDzCurrentDepartment();
    let daily = await getReestrDzWriteOffDepartment(department.depid);
    if (daily.activeRun) {
      const saved = daily.activeRun;
      const restore = window.confirm(
        `Найдена незавершённая проверка списания за сегодня для ${department.label} (${department.depid}).\n` +
        `Обработано: ${Math.max(0, Number(saved.nextIndex) || 0)} из ${Array.isArray(saved.candidates) ? saved.candidates.length : 0}.\n\n` +
        'Восстановить её на паузе? «Отмена» удалит незавершённую очередь.'
      );
      if (restore) {
        const restored = restoreReestrDzWriteOffRun(saved);
        if (restored) {
          reestrDzWriteOffRun = restored;
          syncReestrDzWriteOffProgressOverlay(restored);
          setReestrDzPrincipalLaunchButtonDisabled(false);
          return;
        }
      }
      await discardReestrDzWriteOffRun(department.depid);
      daily = await getReestrDzWriteOffDepartment(department.depid);
    }
    const periodChoice = await askReestrDzPrincipalPeriod();
    if (periodChoice.cancelled) {
      setReestrDzPrincipalLaunchButtonDisabled(false);
      return;
    }
    const processed = new Set(Object.keys(daily.processed && typeof daily.processed === 'object' ? daily.processed : {}));
    const run = {
      status: 'preparing', paused: false, pauseReason: '', resumeWaiters: [], controller: new AbortController(),
      gridState: { lastpage: 1 }, candidates: [], results: [], nextIndex: 0, currentIndex: 0, current: null,
      currentReview: null, department, period: periodChoice.period, recoverableError: false, canContinue: false,
      parallelWorkers: normalizeReestrDzParallelWorkers(periodChoice.parallelWorkers), preparedResults: {}, preparedThroughIndex: 0,
      stage: 'Собираю строки текущего грида…', warning: '', overlayDismissed: false, workerActive: false
    };
    reestrDzWriteOffRun = run;
    syncReestrDzWriteOffProgressOverlay(run);
    try {
      run.gridState = await getReestrDzGridState();
      const rows = await loadAllReestrDzRows(run.gridState, run.controller.signal);
      run.candidates = rows.map((row, index) => ({
        id: String(row.id || row.cell && row.cell.ReestrDzID || ''),
        cell: row && row.cell && typeof row.cell === 'object' ? { ...row.cell } : {},
        sourceIndex: index,
        page: Math.floor(index / Math.max(1, run.gridState.rowNum || 30)) + 1
      })).filter((row) => row.id && row.cell.RequestNumber && (normalizeReestrDzText(row.cell.PrincipalNumber) || isReestrDzWriteOffExcludedClaimant(row.cell)) &&
        (!normalizeReestrDzText(row.cell.OrderDate) || !normalizeReestrDzText(row.cell.OrderNumber)) &&
        !processed.has(row.id) && isReestrDzRowInPeriod(row.cell, run.period));
      if (!run.candidates.length) {
        run.status = 'completed';
        run.stage = 'Строк с исходящим и незаполненными сведениями о приказе не найдено.';
        await persistReestrDzWriteOffRun(run);
        syncReestrDzWriteOffProgressOverlay(run);
        return;
      }
      if (run.candidates.every((candidate) => isReestrDzWriteOffExcludedClaimant(candidate.cell))) {
        run.results = run.candidates.map((candidate) => ({
          id: candidate.id,
          ...buildReestrDzExcludedClaimantResult(candidate),
          review: null
        }));
        run.nextIndex = run.candidates.length;
        run.status = 'completed';
        run.current = null;
        run.reportDownloaded = downloadReestrDzWriteOffReport(run);
        run.stage = `Проверка завершена. Исключённых строк пропущено: ${run.results.length}.${run.reportDownloaded ? ' Итоговый отчёт скачан.' : ''}`;
        run.warning = '';
        await persistReestrDzWriteOffRun(run);
        syncReestrDzWriteOffProgressOverlay(run);
        return;
      }
      const confirmed = window.confirm(
        `Найдено строк для проверки списания: ${run.candidates.length}.\n` +
        `Период: ${run.period ? run.period.text : 'все даты'}.\n` +
        `Параллельных проверок WSS: ${run.parallelWorkers}.\n\n` +
        'Поручения будут подготавливаться параллельно группами, а ручная проверка и сохранение выполняться строго по порядку грида. Начать?'
      );
      if (!confirmed) {
        reestrDzWriteOffRun = null;
        document.getElementById(REESTR_DZ_WRITE_OFF_OVERLAY_ID)?.remove();
        return;
      }
      run.status = 'running';
      run.stage = `Начинаю проверку группами по ${run.parallelWorkers}…`;
      await persistReestrDzWriteOffRun(run);
      await runReestrDzWriteOffCheck(run);
    } catch (error) {
      run.status = 'error';
      run.recoverableError = false;
      run.stage = 'Не удалось начать проверку.';
      run.warning = error && error.message ? error.message : String(error);
      syncReestrDzWriteOffProgressOverlay(run);
    } finally {
      setReestrDzPrincipalLaunchButtonDisabled(false);
    }
  }

  function formatReestrDzSingleDateMask(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');
  }

  function readReestrDzWriteOffDraft() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([REESTR_DZ_WRITE_OFF_DRAFT_STORAGE_KEY], (result) => {
          void (chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '');
          resolve(result && result[REESTR_DZ_WRITE_OFF_DRAFT_STORAGE_KEY] || null);
        });
      } catch (error) {
        resolve(null);
      }
    });
  }

  function persistReestrDzWriteOffDraft(session, fields) {
    if (!session || !session.data) return;
    const draft = {
      dateKey: getReestrDzPrincipalLocalDateKey(),
      depid: String(session.data.depid || ''),
      rowId: String(session.data.rowId || ''),
      mode: ['comment', 'decision_confirm', 'decision_skip'].includes(session.mode) ? session.mode : 'order',
      fields: {
        orderDate: String(fields.orderDate || ''),
        orderNumber: String(fields.orderNumber || ''),
        comment: String(fields.comment || '')
      },
      position: session.position && typeof session.position === 'object' ? { ...session.position } : null,
      updatedAt: Date.now()
    };
    try {
      chrome.storage.local.set({ [REESTR_DZ_WRITE_OFF_DRAFT_STORAGE_KEY]: draft });
    } catch (error) {
      // draft persistence is best effort; the main run remains recoverable
    }
  }

  function clearReestrDzWriteOffDraft() {
    try {
      chrome.storage.local.remove(REESTR_DZ_WRITE_OFF_DRAFT_STORAGE_KEY);
    } catch (error) {
      // ignore storage cleanup errors
    }
  }

  function makeReestrDzWriteOffOverlayDraggable(overlay, onMoved) {
    const head = overlay && overlay.querySelector('.dup-wo-head');
    if (!(head instanceof HTMLElement) || head.dataset.dragReady === 'true') return;
    head.dataset.dragReady = 'true';
    head.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Element && event.target.closest('button, input')) return;
      const rect = overlay.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;
      head.setPointerCapture(event.pointerId);
      const move = (moveEvent) => {
        const left = Math.min(window.innerWidth - overlay.offsetWidth - 8, Math.max(8, startLeft + moveEvent.clientX - startX));
        const top = Math.min(window.innerHeight - 48, Math.max(8, startTop + moveEvent.clientY - startY));
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.right = 'auto';
      };
      const stop = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', stop);
        head.removeEventListener('pointercancel', stop);
        if (typeof onMoved === 'function') onMoved({
          left: Number.parseFloat(overlay.style.left) || overlay.getBoundingClientRect().left,
          top: Number.parseFloat(overlay.style.top) || overlay.getBoundingClientRect().top
        });
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', stop);
      head.addEventListener('pointercancel', stop);
    });
  }

  function collectReestrDzWriteOffAttachments() {
    const unique = new Map();
    const fileNamePattern = /\.pdf$/i;
    const fileUrlPattern = /\.pdf(?:$|[?#])/i;
    document.querySelectorAll('a[href]').forEach((anchor) => {
      if (anchor.closest(`#${REESTR_DZ_WRITE_OFF_OVERLAY_ID}`)) return;
      const href = String(anchor.href || '').trim();
      if (!href || !/^https?:/i.test(href)) return;
      const containerText = normalizeReestrDzText(
        anchor.closest('.files-fileAndCommentDiv')?.querySelector('.files-filespan')?.textContent
      );
      let fallbackText = 'Документ';
      try {
        fallbackText = decodeURIComponent(href.split('/').pop() || fallbackText);
      } catch (error) {
        // malformed escaping in a WSS URL must not hide other attachments
      }
      const text = normalizeReestrDzText(anchor.textContent) || containerText || normalizeReestrDzText(fallbackText);
      if (!fileNamePattern.test(text) && !fileUrlPattern.test(href)) return;
      const previous = unique.get(href);
      if (!previous || (previous.text === 'Документ' && text !== 'Документ')) unique.set(href, { text, href });
    });
    return Array.from(unique.values());
  }

  function highlightReestrDzWriteOffText(outgoingNumber, amount, extraTexts = []) {
    document.querySelectorAll(`.${REESTR_DZ_WRITE_OFF_HIGHLIGHT_CLASS}`).forEach((element) => element.replaceWith(document.createTextNode(element.textContent || '')));
    const outgoing = normalizeReestrDzText(outgoingNumber);
    const integerDigits = String(amount || '').split(/[.,]/)[0].replace(/\D/g, '');
    const patterns = [];
    if (outgoing) patterns.push(outgoing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (integerDigits) patterns.push(`(?<!\\d)${integerDigits.split('').join('[\\s\\u00a0.,]*')}(?:[.,]\\d{1,2})?(?!\\d)`);
    Array.from(new Set((Array.isArray(extraTexts) ? extraTexts : [])
      .map((value) => normalizeReestrDzText(value))
      .filter(Boolean)))
      .sort((left, right) => right.length - left.length)
      .forEach((value) => patterns.push(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (!patterns.length) return;
    const regex = new RegExp(patterns.join('|'), 'giu');
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue || !regex.test(node.nodeValue)) { regex.lastIndex = 0; return NodeFilter.FILTER_REJECT; }
        regex.lastIndex = 0;
        if (parent.closest(`#${REESTR_DZ_WRITE_OFF_OVERLAY_ID}, script, style, textarea, input, select, option, [contenteditable="true"]`)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue || '';
      regex.lastIndex = 0;
      let match;
      let offset = 0;
      const fragment = document.createDocumentFragment();
      while ((match = regex.exec(text))) {
        fragment.appendChild(document.createTextNode(text.slice(offset, match.index)));
        const mark = document.createElement('mark');
        mark.className = REESTR_DZ_WRITE_OFF_HIGHLIGHT_CLASS;
        mark.textContent = match[0];
        fragment.appendChild(mark);
        offset = match.index + match[0].length;
        if (!match[0].length) regex.lastIndex += 1;
      }
      fragment.appendChild(document.createTextNode(text.slice(offset)));
      node.replaceWith(fragment);
    });
  }

  async function navigateReestrDzWriteOffReview(url, documentIndex, options = {}) {
    const dateInput = document.querySelector(`#${REESTR_DZ_WRITE_OFF_OVERLAY_ID} [name="orderDate"]`);
    const numberInput = document.querySelector(`#${REESTR_DZ_WRITE_OFF_OVERLAY_ID} [name="orderNumber"]`);
    const commentInput = document.querySelector(`#${REESTR_DZ_WRITE_OFF_OVERLAY_ID} [name="skipComment"]`);
    await sendRuntimeMessage({
      action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
      data: {
        mode: reestrDzWriteOffReviewState && reestrDzWriteOffReviewState.mode === 'comment' ? 'comment' : 'order',
        fields: {
          orderDate: dateInput && dateInput.value || '',
          orderNumber: numberInput && numberInput.value || '',
          comment: commentInput && commentInput.value || ''
        }
      }
    });
    const navigationResponse = await sendRuntimeMessage({
      action: 'REESTR_DZ_WRITE_OFF_NAVIGATE_REVIEW',
      data: {
        url,
        documentIndex,
        pdfAttachment: options.pdfAttachment === true,
        fileName: normalizeReestrDzText(options.fileName)
      }
    });
    if (!navigationResponse || navigationResponse.success === false) {
      window.alert(`Не удалось открыть документ проверки: ${navigationResponse && navigationResponse.error || 'нет ответа расширения'}.`);
    }
  }

  function renderReestrDzWriteOffDecisionMismatchOverlay(session) {
    const data = session.data || {};
    const overlay = document.createElement('section');
    overlay.id = REESTR_DZ_WRITE_OFF_OVERLAY_ID;
    overlay.className = 'dup-reestr-dz-principal-ui';
    overlay.dataset.state = 'error';
    if (session.position && Number.isFinite(Number(session.position.left)) && Number.isFinite(Number(session.position.top))) {
      overlay.style.left = `${Number(session.position.left)}px`;
      overlay.style.top = `${Number(session.position.top)}px`;
      overlay.style.right = 'auto';
    }
    overlay.innerHTML = `
      <div class="dup-wo-head"><div><strong>Проверка решения</strong><small>Реестр № <span data-role="row-id">—</span> · <span data-role="progress">—</span></small></div><button type="button" class="dup-wo-close" data-action="close" aria-label="Остановить проверку">×</button></div>
      <div class="dup-wo-body">
        <div class="dup-wo-mismatch" data-role="mismatch"></div>
        <dl class="dup-wo-grid">
          <dt>Поручение</dt><dd data-role="request">—</dd>
          <dt>Ответственный</dt><dd data-role="responsible">—</dd>
          <dt>Решение нашёл</dt><dd data-role="decision-user">—</dd>
          <dt>Дата решения</dt><dd data-role="decision-date">—</dd>
        </dl>
        <div class="dup-wo-substitute" data-panel="candidate"><strong>Предлагаемое решение:</strong><br><span data-role="decision-text">Не найдено</span></div>
        <div class="dup-wo-comment-mode" data-panel="skip" hidden>
          <label for="dup-wo-mismatch-comment">Комментарий к реестру</label>
          <textarea id="dup-wo-mismatch-comment" name="skipComment"></textarea>
          <div class="dup-wo-comment-hint">Поле можно очистить — тогда в Пирамиде ничего не изменится. Ctrl+Enter — перейти дальше.</div>
        </div>
        <div class="dup-wo-error" data-role="error"></div>
        <div class="dup-wo-actions">
          <button type="button" data-action="pause">${session.paused ? 'Продолжить' : 'Пауза'}</button>
          <button type="button" data-action="skip-decision" ${session.paused ? 'disabled' : ''}>Пропустить</button>
          <button type="button" data-action="confirm-decision" ${session.paused || !normalizeReestrDzText(data.decision) ? 'disabled' : ''}>Подтвердить</button>
          <button type="button" data-action="cancel-decision-skip" hidden>Отмена</button>
          <button type="button" data-action="finish-decision-skip" hidden ${session.paused ? 'disabled' : ''}>Перейти дальше</button>
        </div>
      </div>`;
    const set = (role, value) => {
      const element = overlay.querySelector(`[data-role="${role}"]`);
      if (element instanceof HTMLElement) element.textContent = normalizeReestrDzText(value) || '—';
    };
    set('row-id', data.rowId);
    set('progress', data.progressText);
    set('mismatch', data.errorMessage);
    set('request', data.requestNumber);
    set('responsible', data.responsibleName);
    set('decision-user', data.decisionUser);
    set('decision-date', data.decisionDate);
    set('decision-text', data.suggestedDecisionText || data.decision || 'Не найдено');
    const candidatePanel = overlay.querySelector('[data-panel="candidate"]');
    const skipPanel = overlay.querySelector('[data-panel="skip"]');
    const commentInput = overlay.querySelector('[name="skipComment"]');
    const errorElement = overlay.querySelector('[data-role="error"]');
    if (commentInput instanceof HTMLTextAreaElement) commentInput.value = String(session.fields && session.fields.comment || '');
    const persist = () => {
      const fields = { orderDate: '', orderNumber: '', comment: commentInput instanceof HTMLTextAreaElement ? commentInput.value : '' };
      persistReestrDzWriteOffDraft(session, fields);
      return sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW', data: { mode: session.mode, fields } });
    };
    const setMode = (mode, shouldPersist = true) => {
      session.mode = mode === 'decision_skip' ? 'decision_skip' : 'decision_confirm';
      reestrDzWriteOffReviewState.mode = session.mode;
      const skipMode = session.mode === 'decision_skip';
      if (candidatePanel instanceof HTMLElement) candidatePanel.hidden = skipMode;
      if (skipPanel instanceof HTMLElement) skipPanel.hidden = !skipMode;
      ['skip-decision', 'confirm-decision'].forEach((action) => {
        const button = overlay.querySelector(`[data-action="${action}"]`);
        if (button instanceof HTMLButtonElement) button.hidden = skipMode;
      });
      ['cancel-decision-skip', 'finish-decision-skip'].forEach((action) => {
        const button = overlay.querySelector(`[data-action="${action}"]`);
        if (button instanceof HTMLButtonElement) button.hidden = !skipMode;
      });
      if (errorElement instanceof HTMLElement) errorElement.textContent = '';
      if (shouldPersist) void persist();
      if (skipMode && commentInput instanceof HTMLTextAreaElement) {
        window.setTimeout(() => {
          commentInput.focus();
          commentInput.setSelectionRange(commentInput.value.length, commentInput.value.length);
        }, 0);
      }
    };
    const finish = async (mode) => {
      const comment = mode === 'decision_skip' && commentInput instanceof HTMLTextAreaElement ? commentInput.value.trim() : '';
      const response = await sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_FINISH_REVIEW',
        data: { mode, fields: { orderDate: '', orderNumber: '', comment } }
      });
      if (!response || response.success === false) {
        if (errorElement instanceof HTMLElement) errorElement.textContent = 'Не удалось передать результат проверки в Пирамиду.';
      } else {
        clearReestrDzWriteOffDraft();
      }
    };
    commentInput?.addEventListener('input', () => { if (errorElement instanceof HTMLElement) errorElement.textContent = ''; void persist(); });
    commentInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMode('decision_confirm');
      } else if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        void finish('decision_skip');
      }
    });
    overlay.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.action === 'confirm-decision') void finish('decision_confirm');
      if (button.dataset.action === 'skip-decision') setMode('decision_skip');
      if (button.dataset.action === 'cancel-decision-skip') setMode('decision_confirm');
      if (button.dataset.action === 'finish-decision-skip') void finish('decision_skip');
      if (button.dataset.action === 'pause') {
        const paused = !reestrDzWriteOffReviewState.paused;
        reestrDzWriteOffReviewState.paused = paused;
        button.textContent = paused ? 'Продолжить' : 'Пауза';
        ['skip-decision', 'confirm-decision', 'finish-decision-skip'].forEach((action) => {
          const actionButton = overlay.querySelector(`[data-action="${action}"]`);
          if (actionButton instanceof HTMLButtonElement) actionButton.disabled = paused || (action === 'confirm-decision' && !normalizeReestrDzText(data.decision));
        });
        void sendRuntimeMessage({
          action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
          data: { paused, mode: session.mode, fields: { orderDate: '', orderNumber: '', comment: commentInput && commentInput.value || '' } }
        });
      }
      if (button.dataset.action === 'close' && window.confirm('Остановить проверку списания и вернуться в Пирамиду?')) {
        clearReestrDzWriteOffDraft();
        void sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_STOP_REVIEW' });
      }
    });
    makeReestrDzWriteOffOverlayDraggable(overlay, (position) => {
      session.position = position;
      reestrDzWriteOffReviewState.position = position;
      persistReestrDzWriteOffDraft(session, { orderDate: '', orderNumber: '', comment: commentInput && commentInput.value || '' });
      void sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW', data: { position } });
    });
    (document.body || document.documentElement).appendChild(overlay);
    setMode(session.mode, false);
    highlightReestrDzWriteOffText('', '', [data.responsibleName, data.decisionUser, ...REESTR_DZ_WRITE_OFF_DECISIONS]);
  }

  function renderReestrDzWriteOffReviewOverlay(session) {
    ensureReestrDzPrincipalStyle();
    document.getElementById(REESTR_DZ_WRITE_OFF_OVERLAY_ID)?.remove();
    reestrDzWriteOffReviewState = session;
    const data = session.data || {};
    if (data.reviewType === 'decision_mismatch') {
      renderReestrDzWriteOffDecisionMismatchOverlay(session);
      return;
    }
    const documents = Array.isArray(data.documents) ? data.documents : [];
    const currentDocumentIndex = Math.max(0, Number(session.currentDocumentIndex) || 0);
    const currentDocument = documents[currentDocumentIndex] || null;
    const initialMode = session.mode === 'comment' ? 'comment' : 'order';
    const knownAttachments = Object.values(session.attachmentsByUrl || {}).flat().filter((item) => {
      if (!item || !item.href) return false;
      return /\.pdf$/i.test(normalizeReestrDzText(item.text)) || /\.pdf(?:$|[?#])/i.test(String(item.href));
    });
    const fileMap = new Map(knownAttachments.map((item) => [item.href, item]));
    const overlay = document.createElement('section');
    overlay.id = REESTR_DZ_WRITE_OFF_OVERLAY_ID;
    overlay.className = 'dup-reestr-dz-principal-ui';
    if (session.position && Number.isFinite(Number(session.position.left)) && Number.isFinite(Number(session.position.top))) {
      overlay.style.left = `${Number(session.position.left)}px`;
      overlay.style.top = `${Number(session.position.top)}px`;
      overlay.style.right = 'auto';
    }
    overlay.innerHTML = `
      <div class="dup-wo-head"><div><strong>Проверка списания</strong><small>Реестр № ${data.rowId || '—'} · ${data.progressText || '—'}</small></div><button type="button" class="dup-wo-close" data-action="close" aria-label="Остановить проверку">×</button></div>
      <div class="dup-wo-body">
        <div class="dup-wo-stage" data-role="stage"></div>
        <dl class="dup-wo-grid">
          <dt>Исходящий</dt><dd>${data.outgoingNumber || '—'}</dd>
          <dt>Комплектов</dt><dd>${data.setsCount || '—'}</dd>
          <dt>Сумма</dt><dd>${data.writeOffAmount || '—'}</dd>
          <dt data-order-info="date" hidden>Дата приказа в СДЗ</dt><dd data-order-info="date" data-role="request-order-date" hidden></dd>
          <dt data-order-info="number" hidden>Номер приказа в СДЗ</dt><dd data-order-info="number" data-role="request-order-number" hidden></dd>
          <dt>Решение</dt><dd class="dup-wo-decision">${data.decision || '—'}</dd>
          <dt>Документ</dt><dd>${currentDocument ? `${currentDocument.label}: ${currentDocument.text}` : document.title}</dd>
        </dl>
        <div class="dup-wo-reference" data-role="amount-reference" hidden>
          <div class="dup-wo-reference-title">Состав суммы списания</div>
          <div class="dup-wo-amounts">
            <div class="dup-wo-amount" data-amount-info="total" hidden><span>Общая сумма</span><strong data-role="total-amount"></strong></div>
            <div class="dup-wo-amount" data-amount-info="basic" hidden><span>Основной долг</span><strong data-role="basic-debt"></strong></div>
            <div class="dup-wo-amount" data-amount-info="fee" hidden><span>Госпошлина</span><strong data-role="state-fee"></strong></div>
            <div class="dup-wo-amount" data-amount-info="penalty" hidden><span>Пени</span><strong data-role="penalty"></strong></div>
            <div class="dup-wo-amount" data-amount-info="expenses" hidden><span>Доп. расходы</span><strong data-role="additional-expenses"></strong></div>
          </div>
        </div>
        <div class="dup-wo-docs" data-role="documents"></div>
        <div class="dup-wo-files" data-role="files"></div>
        <div class="dup-wo-form" data-panel="order">
          <div class="dup-wo-field"><label for="dup-wo-order-date">Дата приказа о списании</label><input id="dup-wo-order-date" name="orderDate" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="дд.мм.гггг" value="${String(session.fields && session.fields.orderDate || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div>
          <div class="dup-wo-field"><label for="dup-wo-order-number">Номер приказа о списании</label><input id="dup-wo-order-number" name="orderNumber" autocomplete="off" value="${String(session.fields && session.fields.orderNumber || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div>
        </div>
        <div class="dup-wo-comment-mode" data-panel="comment" hidden>
          <label for="dup-wo-skip-comment">Комментарий к реестру</label>
          <textarea id="dup-wo-skip-comment" name="skipComment"></textarea>
          <div class="dup-wo-comment-hint">Реквизиты приказа сохраняться не будут. Ctrl+Enter — сохранить комментарий.</div>
        </div>
        <div class="dup-wo-error" data-role="error"></div>
        <div class="dup-wo-actions">
          <button type="button" data-action="pause">${session.paused ? 'Продолжить' : 'Пауза'}</button>
          <button type="button" data-action="skip-order" ${session.paused ? 'disabled' : ''}>Пропустить</button>
          <button type="button" data-action="done" ${session.paused ? 'disabled' : ''}>Готово</button>
          <button type="button" data-action="cancel-skip" hidden>Отмена</button>
          <button type="button" data-action="save-comment" hidden ${session.paused ? 'disabled' : ''}>Сохранить комментарий</button>
        </div>
      </div>`;
    const showReferenceValue = (selector, value) => {
      const normalized = normalizeReestrDzText(value);
      if (!normalized) return false;
      overlay.querySelectorAll(selector).forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        element.hidden = false;
        if (element.matches('[data-role]')) element.textContent = normalized;
      });
      return true;
    };
    showReferenceValue('[data-order-info="date"]', data.requestOrderDate);
    showReferenceValue('[data-order-info="number"]', data.requestOrderNumber);
    const hasAmountDetails = [
      ['total', 'total-amount', data.writeOffAmount],
      ['basic', 'basic-debt', data.basicDebtAmount],
      ['fee', 'state-fee', data.stateFeeAmount],
      ['penalty', 'penalty', data.penaltyAmount],
      ['expenses', 'additional-expenses', data.additionalExpensesAmount]
    ].reduce((shown, [key, role, value]) => {
      const normalized = normalizeReestrDzText(value);
      if (!normalized) return shown;
      const item = overlay.querySelector(`[data-amount-info="${key}"]`);
      const target = overlay.querySelector(`[data-role="${role}"]`);
      if (item instanceof HTMLElement) item.hidden = false;
      if (target instanceof HTMLElement) target.textContent = normalized;
      return true;
    }, false);
    const amountReference = overlay.querySelector('[data-role="amount-reference"]');
    if (amountReference instanceof HTMLElement) amountReference.hidden = !hasAmountDetails;
    const docsHost = overlay.querySelector('[data-role="documents"]');
    documents.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label || item.text || `Документ ${index + 1}`;
      button.setAttribute('aria-current', index === currentDocumentIndex ? 'page' : 'false');
      button.addEventListener('click', () => void navigateReestrDzWriteOffReview(item.href, index));
      docsHost.appendChild(button);
    });
    const filesHost = overlay.querySelector('[data-role="files"]');
    let attachmentSignature = null;
    const refreshAttachmentButtons = () => {
      const pageAttachments = collectReestrDzWriteOffAttachments();
      pageAttachments.forEach((item) => fileMap.set(item.href, item));
      const signature = Array.from(fileMap.values()).map((item) => `${item.href}\n${item.text}`).sort().join('\n---\n');
      if (signature === attachmentSignature) return;
      attachmentSignature = signature;
      if (filesHost instanceof HTMLElement) {
        filesHost.replaceChildren();
        Array.from(fileMap.values()).forEach((item) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `📎 ${item.text || 'Файл'}`;
          button.addEventListener('click', () => void navigateReestrDzWriteOffReview(item.href, currentDocumentIndex, {
            pdfAttachment: true,
            fileName: item.text
          }));
          filesHost.appendChild(button);
        });
        filesHost.hidden = !fileMap.size;
      }
      void sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
        data: { attachments: pageAttachments, pageUrl: window.location.href }
      });
    };
    refreshAttachmentButtons();
    const dateInput = overlay.querySelector('[name="orderDate"]');
    const numberInput = overlay.querySelector('[name="orderNumber"]');
    const commentInput = overlay.querySelector('[name="skipComment"]');
    if (commentInput instanceof HTMLTextAreaElement) {
      commentInput.value = String(session.fields && session.fields.comment || data.decision || '').trim();
    }
    const orderPanel = overlay.querySelector('[data-panel="order"]');
    const commentPanel = overlay.querySelector('[data-panel="comment"]');
    const stageElement = overlay.querySelector('[data-role="stage"]');
    const errorElement = overlay.querySelector('[data-role="error"]');
    const persistFields = () => {
      const fields = {
        orderDate: dateInput.value,
        orderNumber: numberInput.value,
        comment: commentInput instanceof HTMLTextAreaElement ? commentInput.value : ''
      };
      persistReestrDzWriteOffDraft(session, fields);
      return sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
        data: { mode: session.mode === 'comment' ? 'comment' : 'order', fields }
      });
    };
    const setReviewMode = (mode, persist = true) => {
      session.mode = mode === 'comment' ? 'comment' : 'order';
      reestrDzWriteOffReviewState.mode = session.mode;
      const commentMode = session.mode === 'comment';
      if (orderPanel instanceof HTMLElement) orderPanel.hidden = commentMode;
      if (commentPanel instanceof HTMLElement) commentPanel.hidden = !commentMode;
      if (stageElement instanceof HTMLElement) stageElement.textContent = commentMode
        ? 'Дополните решение комментарием. Дата и номер приказа заполняться не будут.'
        : 'Проверьте документ и заполните реквизиты приказа.';
      const skipButton = overlay.querySelector('[data-action="skip-order"]');
      const doneButton = overlay.querySelector('[data-action="done"]');
      const cancelButton = overlay.querySelector('[data-action="cancel-skip"]');
      const saveButton = overlay.querySelector('[data-action="save-comment"]');
      if (skipButton instanceof HTMLButtonElement) skipButton.hidden = commentMode;
      if (doneButton instanceof HTMLButtonElement) doneButton.hidden = commentMode;
      if (cancelButton instanceof HTMLButtonElement) cancelButton.hidden = !commentMode;
      if (saveButton instanceof HTMLButtonElement) saveButton.hidden = !commentMode;
      errorElement.textContent = '';
      if (persist) void persistFields();
      if (commentMode && commentInput instanceof HTMLTextAreaElement) {
        window.setTimeout(() => {
          commentInput.focus();
          commentInput.setSelectionRange(commentInput.value.length, commentInput.value.length);
        }, 0);
      }
    };
    const finishOrder = async () => {
      const date = normalizeReestrDzText(dateInput.value);
      const number = normalizeReestrDzText(numberInput.value);
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date) || parseReestrDzDate(date) === null) {
        errorElement.textContent = 'Введите корректную дату приказа в формате дд.мм.гггг.';
        dateInput.focus();
        return;
      }
      if (!number) {
        errorElement.textContent = 'Введите номер приказа о списании.';
        numberInput.focus();
        return;
      }
      errorElement.textContent = '';
      const response = await sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_FINISH_REVIEW',
        data: { mode: 'order', fields: { orderDate: date, orderNumber: number, comment: commentInput && commentInput.value || '' } }
      });
      if (!response || response.success === false) errorElement.textContent = 'Не удалось передать реквизиты в Пирамиду.';
      else clearReestrDzWriteOffDraft();
    };
    const finishComment = async () => {
      const comment = String(commentInput instanceof HTMLTextAreaElement ? commentInput.value : '').trim();
      if (!normalizeReestrDzText(comment)) {
        errorElement.textContent = 'Комментарий не может быть пустым.';
        commentInput?.focus();
        return;
      }
      errorElement.textContent = '';
      const response = await sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_FINISH_REVIEW',
        data: { mode: 'comment', fields: { orderDate: '', orderNumber: '', comment } }
      });
      if (!response || response.success === false) errorElement.textContent = 'Не удалось передать комментарий в Пирамиду.';
      else clearReestrDzWriteOffDraft();
    };
    dateInput.addEventListener('input', () => { dateInput.value = formatReestrDzSingleDateMask(dateInput.value); errorElement.textContent = ''; void persistFields(); });
    numberInput.addEventListener('input', () => { errorElement.textContent = ''; void persistFields(); });
    [dateInput, numberInput].forEach((input) => input.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !event.shiftKey) {
        if (input === dateInput) {
          event.preventDefault();
          numberInput.focus();
        } else {
          const done = overlay.querySelector('[data-action="done"]');
          if (done instanceof HTMLButtonElement) {
            event.preventDefault();
            done.focus();
          }
        }
        return;
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      void finishOrder();
    }));
    commentInput?.addEventListener('input', () => { errorElement.textContent = ''; void persistFields(); });
    commentInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setReviewMode('order');
      } else if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        void finishComment();
      }
    });
    overlay.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.action === 'done') void finishOrder();
      if (button.dataset.action === 'skip-order') setReviewMode('comment');
      if (button.dataset.action === 'cancel-skip') setReviewMode('order');
      if (button.dataset.action === 'save-comment') void finishComment();
      if (button.dataset.action === 'pause') {
        const paused = !reestrDzWriteOffReviewState.paused;
        reestrDzWriteOffReviewState.paused = paused;
        button.textContent = paused ? 'Продолжить' : 'Пауза';
        ['done', 'skip-order', 'save-comment'].forEach((action) => {
          const actionButton = overlay.querySelector(`[data-action="${action}"]`);
          if (actionButton instanceof HTMLButtonElement) actionButton.disabled = paused;
        });
        void sendRuntimeMessage({
          action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
          data: {
            paused,
            mode: session.mode,
            fields: { orderDate: dateInput.value, orderNumber: numberInput.value, comment: commentInput && commentInput.value || '' }
          }
        });
      }
      if (button.dataset.action === 'close' && window.confirm('Остановить проверку списания и вернуться в Пирамиду?')) {
        clearReestrDzWriteOffDraft();
        void sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_STOP_REVIEW' });
      }
    });
    makeReestrDzWriteOffOverlayDraggable(overlay, (position) => {
      session.position = position;
      reestrDzWriteOffReviewState.position = position;
      persistReestrDzWriteOffDraft(session, {
        orderDate: dateInput.value,
        orderNumber: numberInput.value,
        comment: commentInput && commentInput.value || ''
      });
      void sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW', data: { position } });
    });
    (document.body || document.documentElement).appendChild(overlay);
    const attachmentObserver = new MutationObserver(() => {
      if (!overlay.isConnected) {
        attachmentObserver.disconnect();
        return;
      }
      refreshAttachmentButtons();
    });
    attachmentObserver.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
    setReviewMode(initialMode, false);
    highlightReestrDzWriteOffText(data.outgoingNumber, data.writeOffAmount);
  }

  async function initReestrDzWriteOffReviewOverlay() {
    if (!isExtensionUiSettingEnabled('reestrDzPrincipalAutofill')) return;
    const response = await sendRuntimeMessage({ action: 'REESTR_DZ_WRITE_OFF_GET_REVIEW_STATE' });
    if (!response || response.success === false || !response.session || response.session.status !== 'reviewing') return;
    const draft = await readReestrDzWriteOffDraft();
    if (draft && draft.dateKey !== getReestrDzPrincipalLocalDateKey()) clearReestrDzWriteOffDraft();
    if (draft && draft.dateKey === getReestrDzPrincipalLocalDateKey() &&
      String(draft.depid || '') === String(response.session.data && response.session.data.depid || '') &&
      String(draft.rowId || '') === String(response.session.data && response.session.data.rowId || '')) {
      response.session.fields = cloneReestrDzPrincipalStorageValue(draft.fields, response.session.fields || {});
      response.session.mode = response.session.data && response.session.data.reviewType === 'decision_mismatch'
        ? (draft.mode === 'decision_skip' ? 'decision_skip' : 'decision_confirm')
        : (draft.mode === 'comment' ? 'comment' : 'order');
      if (draft.position && typeof draft.position === 'object') response.session.position = cloneReestrDzPrincipalStorageValue(draft.position, null);
      void sendRuntimeMessage({
        action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
        data: { mode: response.session.mode, fields: response.session.fields, position: response.session.position }
      });
    }
    renderReestrDzWriteOffReviewOverlay(response.session);
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

  function chromeLocalStorageSet(values) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(values, () => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError;
          resolve(!runtimeError);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function loadIdCardCheckSessionCache() {
    try {
      const raw = window.sessionStorage.getItem(ID_CARD_CHECK_SESSION_CACHE_KEY);
      if (!raw) return createEmptyIdCardCheckState();
      return normalizeIdCardCheckState(JSON.parse(raw));
    } catch (error) {
      try {
        window.sessionStorage.removeItem(ID_CARD_CHECK_SESSION_CACHE_KEY);
      } catch (removeError) {
        // ignore session storage cleanup failures
      }
      return createEmptyIdCardCheckState();
    }
  }

  function persistIdCardCheckSessionCache(nextState) {
    const normalized = normalizeIdCardCheckState(nextState);
    try {
      if (!normalized.edocIds.length) {
        window.sessionStorage.removeItem(ID_CARD_CHECK_SESSION_CACHE_KEY);
      } else {
        window.sessionStorage.setItem(ID_CARD_CHECK_SESSION_CACHE_KEY, JSON.stringify(normalized));
      }
    } catch (error) {
      // ignore session storage write failures
    }
    return normalized;
  }

  function hydrateIdCardCheckStateFromSessionCache() {
    const cached = loadIdCardCheckSessionCache();
    if (!cached.edocIds.length) return false;
    if (!isIdCardCheckFullcardPath()) return false;

    const currentEdocId = getIdCardCheckEdocIdFromPath();
    if (!currentEdocId) return false;
    const currentIndex = cached.edocIds.indexOf(currentEdocId);

    idCardCheckState = {
      ...cached,
      currentIndex: currentIndex >= 0 ? currentIndex : cached.currentIndex
    };
    return true;
  }

  async function persistIdCardCheckState(nextState) {
    const normalized = normalizeIdCardCheckState({
      ...nextState,
      updatedAt: Date.now()
    });
    idCardCheckState = normalized;
    persistIdCardCheckSessionCache(normalized);
    await chromeStorageSet({ [ID_CARD_CHECK_STORAGE_KEY]: normalized });
    syncIdCardCheckNavigation();
    return normalized;
  }

  async function loadIdCardCheckState() {
    const stored = await chromeStorageGet(ID_CARD_CHECK_STORAGE_KEY);
    idCardCheckState = normalizeIdCardCheckState(stored[ID_CARD_CHECK_STORAGE_KEY]);
    await syncIdCardCheckStateWithCurrentUrl();
    persistIdCardCheckSessionCache(idCardCheckState);
    syncIdCardCheckNavigation();
    void maybeResumeIdCardCheckAutoReturn();
    return idCardCheckState;
  }

  function createEmptyIdCardCheckAutoReturnState() {
    return {
      version: 1,
      active: false,
      mode: '',
      navKind: '',
      totalCount: 0,
      processedCount: 0,
      failedCount: 0,
      lastStartedEdocId: '',
      startedAt: 0
    };
  }

  function normalizeIdCardCheckAutoReturnState(rawState) {
    const raw = rawState && typeof rawState === 'object' ? rawState : {};
    const mode = String(raw.mode || '').trim();
    const navKind = String(raw.navKind || '').trim();
    const totalCount = Math.max(0, Number.parseInt(String(raw.totalCount || 0), 10) || 0);
    const processedCount = Math.max(0, Number.parseInt(String(raw.processedCount || 0), 10) || 0);
    const failedCount = Math.max(0, Number.parseInt(String(raw.failedCount || 0), 10) || 0);
    return {
      version: 1,
      active: raw.active === true && mode === 'all' && navKind === 'fullcard',
      mode: mode === 'all' ? mode : '',
      navKind: navKind === 'fullcard' ? navKind : '',
      totalCount: totalCount,
      processedCount: Math.min(processedCount, totalCount || processedCount),
      failedCount: Math.min(failedCount, totalCount || failedCount),
      lastStartedEdocId: normalizeExecutionAnalysisText(raw.lastStartedEdocId),
      startedAt: Number(raw.startedAt || 0) || 0
    };
  }

  function loadIdCardCheckAutoReturnState() {
    try {
      const raw = window.sessionStorage.getItem(ID_CARD_CHECK_AUTO_RETURN_SESSION_KEY);
      if (!raw) return createEmptyIdCardCheckAutoReturnState();
      return normalizeIdCardCheckAutoReturnState(JSON.parse(raw));
    } catch (error) {
      return createEmptyIdCardCheckAutoReturnState();
    }
  }

  function persistIdCardCheckAutoReturnState(nextState) {
    const normalized = normalizeIdCardCheckAutoReturnState(nextState);
    try {
      if (!normalized.active) {
        window.sessionStorage.removeItem(ID_CARD_CHECK_AUTO_RETURN_SESSION_KEY);
      } else {
        window.sessionStorage.setItem(ID_CARD_CHECK_AUTO_RETURN_SESSION_KEY, JSON.stringify(normalized));
      }
    } catch (error) {
      // ignore session storage write failures
    }
    return normalized;
  }

  function clearIdCardCheckAutoReturnState() {
    return persistIdCardCheckAutoReturnState(createEmptyIdCardCheckAutoReturnState());
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

  function buildIdCardCheckHistoryUrl(edocId, origin = window.location.origin) {
    const url = new URL(`/ovzid/fullcard/${encodeURIComponent(String(edocId || '').trim())}/action_history`, origin);
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
    return openIdCardCheckUrlInTab(targetUrl);
  }

  async function openIdCardCheckUrlInTabDetailed(targetUrl, options = {}) {
    const normalizedUrl = String(targetUrl || '').trim();
    if (!normalizedUrl) return { success: false, error: 'EMPTY_URL' };

    const response = await sendRuntimeMessage({
      action: 'ID_CARD_CHECK_OPEN_TAB',
      data: {
        url: normalizedUrl,
        active: options && options.active === true
      }
    });

    if (response && response.success === true && Number.isInteger(response.tabId)) {
      return {
        success: true,
        tabId: response.tabId
      };
    }

    return {
      success: false,
      error: response && response.error ? response.error : 'OPEN_TAB_FAILED'
    };
  }

  async function openIdCardCheckUrlInTab(targetUrl) {
    const normalizedUrl = String(targetUrl || '').trim();
    if (!normalizedUrl) return false;

    const response = await openIdCardCheckUrlInTabDetailed(normalizedUrl, { active: true });
    if (response && response.success === true) return true;

    const opened = window.open(normalizedUrl, '_blank', 'noopener');
    return !!opened;
  }

  async function sendIdCardCheckTabMessage(tabId, data, timeoutMs = ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS, options = {}) {
    const targetTabId = Number(tabId);
    if (!Number.isInteger(targetTabId) || targetTabId <= 0) {
      throw new Error('Не удалось определить вкладку для действия по EdocID.');
    }

    const response = await sendRuntimeMessage({
      action: 'ID_CARD_CHECK_SEND_TAB_MESSAGE',
      data: {
        tabId: targetTabId,
        timeoutMs: Math.max(1000, Number(timeoutMs) || ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS),
        retryOnNoReceiver: options.retryOnNoReceiver !== false,
        retryOnClosedChannel: options.retryOnClosedChannel === true,
        message: {
          action: 'ID_CARD_CHECK_TAB_ACTION',
          data: data && typeof data === 'object' ? data : {}
        }
      }
    });

    if (!response || response.success !== true) {
      throw new Error(response && response.error ? response.error : 'Не удалось связаться со служебной вкладкой EdocID.');
    }

    const tabResponse = response.response && typeof response.response === 'object'
      ? response.response
      : null;
    if (!tabResponse || tabResponse.success !== true) {
      throw new Error(tabResponse && tabResponse.error ? tabResponse.error : 'Служебная вкладка EdocID не вернула результат.');
    }

    return tabResponse;
  }

  async function closeIdCardCheckAuxTab(tabId) {
    const targetTabId = Number(tabId);
    if (!Number.isInteger(targetTabId) || targetTabId <= 0) return false;

    const response = await sendRuntimeMessage({
      action: 'EXECUTION_ANALYSIS_CLOSE_TAB',
      data: { tabId: targetTabId }
    });
    return !!(response && response.success === true);
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
          <button type="button" class="dup-id-card-check-action-item" data-action="open-card-tab" disabled>Открыть карточку в отдельной вкладке</button>
          <button type="button" class="dup-id-card-check-action-item" data-action="return-previous-tm">Вернуть на предыдущую ТМ</button>
          <button type="button" class="dup-id-card-check-action-item" data-action="return-previous-tm-all">Вернуть на предыдущую ТМ все EdocID</button>
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
      if (actionKey === ID_CARD_CHECK_RETURN_PREVIOUS_TM_ACTION) {
        void returnIdCardCheckToPreviousTm(edocId, {
          toastNav: resolveIdCardCheckActionToastNav(modal)
        });
        return;
      }
      if (actionKey === ID_CARD_CHECK_RETURN_PREVIOUS_TM_ALL_ACTION) {
        void returnIdCardCheckToPreviousTmForAllEdocIds(
          edocId,
          getIdCardCheckActionNavKind(modal),
          resolveIdCardCheckActionToastNav(modal)
        );
        return;
      }
      if (actionKey === 'open-card-tab') {
        const cardUrl = normalizeExecutionAnalysisText(modal.dataset.iframeCardUrl);
        if (!cardUrl) return;
        void openIdCardCheckUrlInTab(cardUrl).then((success) => {
          if (!success) window.alert('Не удалось открыть карточку ИД в отдельной вкладке.');
        });
        return;
      }
      void openIdCardCheckActionTab(actionKey, edocId).then((success) => {
        if (!success) window.alert('Не удалось открыть вкладку действия.');
      });
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function resolveIdCardCheckIframeCardUrl(anchorEl, edocId) {
    const anchor = anchorEl instanceof HTMLElement
      ? anchorEl.closest('.dup-grid-card-check-nav')
      : null;
    if (!(anchor instanceof HTMLElement)) return '';

    const iframe = getGridCardCheckIframe();
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!(iframe instanceof HTMLIFrameElement) || !normalizedEdocId) return '';

    const iframeUrl = getGridCardCheckIframeUrl(iframe);
    const iframeEdocId = getEdocIdFromFullcardUrl(iframeUrl) ||
      normalizeExecutionAnalysisText(iframe.dataset.dupGridCardEdocId) ||
      getEdocIdFromFullcardUrl(iframe.src);
    if (iframeEdocId && iframeEdocId !== normalizedEdocId) return '';

    return iframeUrl || buildIdCardCheckFullcardUrl(normalizedEdocId);
  }

  function syncIdCardCheckOpenCardTabAction(modal, cardUrl) {
    const button = modal instanceof HTMLElement
      ? modal.querySelector('.dup-id-card-check-action-item[data-action="open-card-tab"]')
      : null;
    if (!(button instanceof HTMLButtonElement)) return;

    const normalizedUrl = normalizeExecutionAnalysisText(cardUrl);
    modal.dataset.iframeCardUrl = normalizedUrl;
    button.disabled = !normalizedUrl;
    button.title = normalizedUrl
      ? 'Открыть текущую iframe-карточку ИД в отдельной вкладке'
      : 'Доступно только для карточки ИД, открытой в iframe';
  }

  function resetIdCardCheckAnchoredDialog(modal) {
    if (!(modal instanceof HTMLElement)) return;
    modal.classList.remove('dup-id-card-check-anchored-modal');
    const panel = modal.querySelector('.dup-execution-analysis-modal-panel');
    if (!(panel instanceof HTMLElement)) return;
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    panel.style.removeProperty('max-height');
    panel.style.removeProperty('max-width');
  }

  function getIdCardCheckAnchoredDialogHost(anchorEl = null) {
    const anchorHost = anchorEl instanceof HTMLElement
      ? anchorEl.closest('.ui-dialog')
      : null;
    if (anchorHost instanceof HTMLElement) return anchorHost;
    return document.body || document.documentElement;
  }

  function attachIdCardCheckAnchoredDialog(modal, anchorEl = null) {
    if (!(modal instanceof HTMLElement)) return;
    const host = getIdCardCheckAnchoredDialogHost(anchorEl);
    if (host instanceof HTMLElement && modal.parentElement !== host) {
      host.appendChild(modal);
    }
  }

  function focusIdCardCheckSearchInput(input) {
    if (!(input instanceof HTMLInputElement)) return;
    const tryFocus = () => {
      input.focus({ preventScroll: true });
      input.select();
    };
    tryFocus();
    window.requestAnimationFrame(tryFocus);
    window.setTimeout(tryFocus, 0);
  }

  function positionIdCardCheckAnchoredDialog(modal, anchorEl) {
    resetIdCardCheckAnchoredDialog(modal);
    if (!(modal instanceof HTMLElement) || !(anchorEl instanceof HTMLElement)) return;

    const panel = modal.querySelector('.dup-execution-analysis-modal-panel');
    if (!(panel instanceof HTMLElement)) return;

    const anchor = anchorEl.closest('.dup-id-card-check-nav, .dup-grid-card-check-nav');
    if (!(anchor instanceof HTMLElement)) return;

    const gap = 8;
    const viewportPadding = 12;
    const docEl = document.documentElement;
    const viewportWidth = Math.max(docEl ? docEl.clientWidth : 0, window.innerWidth || 0);
    const viewportHeight = Math.max(docEl ? docEl.clientHeight : 0, window.innerHeight || 0);
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const availableWidth = Math.max(160, viewportWidth - viewportPadding * 2);
    const panelWidth = Math.min(
      Math.max(260, panelRect.width || panel.offsetWidth || 360),
      availableWidth
    );
    const panelHeight = panelRect.height || panel.offsetHeight || 320;
    const maxLeft = Math.max(viewportPadding, viewportWidth - panelWidth - viewportPadding);
    const maxTop = Math.max(viewportPadding, viewportHeight - panelHeight - viewportPadding);
    const left = Math.min(Math.max(Math.round(anchorRect.left), viewportPadding), maxLeft);
    const top = Math.min(Math.max(Math.round(anchorRect.bottom + gap), viewportPadding), maxTop);
    const maxHeight = Math.max(180, viewportHeight - top - viewportPadding);
    const maxWidth = availableWidth;

    modal.classList.add('dup-id-card-check-anchored-modal');
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.maxWidth = `${maxWidth}px`;
  }

  function openIdCardCheckActionDialog(edocId, anchorEl = null) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!normalizedEdocId) {
      window.alert('Не удалось определить текущий EdocID.');
      return;
    }
    const modal = createIdCardCheckActionDialog();
    attachIdCardCheckAnchoredDialog(modal, anchorEl);
    modal.dataset.edocId = normalizedEdocId;
    modal.dataset.toastNavKind = getIdCardCheckActionToastNavKind(anchorEl);
    syncIdCardCheckOpenCardTabAction(modal, resolveIdCardCheckIframeCardUrl(anchorEl, normalizedEdocId));
    const current = modal.querySelector('.dup-id-card-check-action-current');
    if (current instanceof HTMLElement) {
      current.textContent = `Текущий EdocID: ${normalizedEdocId}`;
    }
    modal.hidden = false;
    positionIdCardCheckAnchoredDialog(modal, anchorEl);
  }

  function getIdCardCheckActionToastNavKind(anchorEl = null) {
    const nav = anchorEl instanceof HTMLElement
      ? anchorEl.closest(`#${ID_CARD_CHECK_NAV_ID}, #${GRID_CARD_CHECK_NAV_ID}`)
      : null;
    if (!(nav instanceof HTMLElement)) return '';
    if (nav.id === GRID_CARD_CHECK_NAV_ID) return 'grid';
    if (nav.id === ID_CARD_CHECK_NAV_ID) return 'fullcard';
    return '';
  }

  function getIdCardCheckActionNavKind(modal) {
    const storedKind = modal instanceof HTMLElement
      ? normalizeExecutionAnalysisText(modal.dataset.toastNavKind)
      : '';
    if (storedKind === 'grid' || storedKind === 'fullcard') return storedKind;
    return isIdCardCheckFullcardPath() ? 'fullcard' : '';
  }

  function resolveIdCardCheckActionToastNav(modal) {
    if (!(modal instanceof HTMLElement)) return null;
    const kind = String(modal.dataset.toastNavKind || '').trim();
    if (kind === 'grid') return gridCardCheckNavEl instanceof HTMLElement ? gridCardCheckNavEl : null;
    if (kind === 'fullcard') return idCardCheckNavEl instanceof HTMLElement ? idCardCheckNavEl : null;
    return null;
  }

  function getIdCardCheckNavStatusElement(nav) {
    return nav instanceof HTMLElement
      ? nav.querySelector('.dup-id-card-check-status')
      : null;
  }

  function getIdCardCheckNavToastElement(nav) {
    return nav instanceof HTMLElement
      ? nav.querySelector('.dup-id-card-check-toast')
      : null;
  }

  function getActiveIdCardCheckNavToast(nav) {
    if (!(nav instanceof HTMLElement)) return null;
    const state = idCardCheckNavToastState.get(nav);
    if (!state) return null;
    if (Number(state.expiresAt || 0) > Date.now()) return state;
    if (state.timerId) clearTimeout(state.timerId);
    idCardCheckNavToastState.delete(nav);
    return null;
  }

  function renderIdCardCheckNavStatus(nav, fallbackText) {
    const status = getIdCardCheckNavStatusElement(nav);
    const toast = getIdCardCheckNavToastElement(nav);
    if (status instanceof HTMLElement) {
      status.textContent = String(fallbackText || '').trim();
    }
    if (!(toast instanceof HTMLElement)) return;

    const toastState = getActiveIdCardCheckNavToast(nav);
    if (!toastState) {
      toast.textContent = '';
      toast.style.removeProperty('padding');
      toast.style.removeProperty('border-radius');
      toast.style.removeProperty('background');
      toast.style.removeProperty('color');
      toast.style.removeProperty('font-weight');
      toast.style.removeProperty('box-shadow');
      return;
    }

    const palette = toastState.tone === 'success'
      ? {
          background: 'rgba(46, 125, 50, 0.14)',
          color: '#1b5e20',
          boxShadow: 'inset 0 0 0 1px rgba(46, 125, 50, 0.24)'
        }
      : toastState.tone === 'error'
        ? {
            background: 'rgba(198, 40, 40, 0.14)',
            color: '#b71c1c',
            boxShadow: 'inset 0 0 0 1px rgba(198, 40, 40, 0.22)'
          }
        : {
            background: 'rgba(30, 136, 229, 0.12)',
            color: '#0d47a1',
            boxShadow: 'inset 0 0 0 1px rgba(30, 136, 229, 0.2)'
          };

    toast.textContent = toastState.message;
    toast.style.setProperty('padding', '4px 8px');
    toast.style.setProperty('border-radius', '8px');
    toast.style.setProperty('background', palette.background);
    toast.style.setProperty('color', palette.color);
    toast.style.setProperty('font-weight', '600');
    toast.style.setProperty('box-shadow', palette.boxShadow);
  }

  function setIdCardCheckNavToast(nav, message, tone = 'info', timeoutMs = ID_CARD_CHECK_NAV_TOAST_DURATION_MS) {
    if (!(nav instanceof HTMLElement)) return;
    const previous = idCardCheckNavToastState.get(nav);
    if (previous && previous.timerId) clearTimeout(previous.timerId);

    const safeTimeoutMs = Math.max(600, Number(timeoutMs) || ID_CARD_CHECK_NAV_TOAST_DURATION_MS);
    const timerId = window.setTimeout(() => {
      idCardCheckNavToastState.delete(nav);
      if (nav === idCardCheckNavEl) {
        updateIdCardCheckNavigationButtons();
      } else if (nav === gridCardCheckNavEl) {
        updateGridCardCheckNavigationButtons();
      } else {
        renderIdCardCheckNavStatus(nav, '');
      }
    }, safeTimeoutMs);

    idCardCheckNavToastState.set(nav, {
      message: String(message || '').trim(),
      tone: tone === 'success' || tone === 'error' ? tone : 'info',
      expiresAt: Date.now() + safeTimeoutMs,
      timerId
    });

    renderIdCardCheckNavStatus(nav, '');
  }

  function createIdCardCheckHelperFrame() {
    const existing = document.getElementById(ID_CARD_CHECK_HELPER_IFRAME_ID);
    if (existing instanceof HTMLIFrameElement) {
      existing.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = ID_CARD_CHECK_HELPER_IFRAME_ID;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    (document.body || document.documentElement).appendChild(iframe);
    return iframe;
  }

  function isIdCardCheckHelperLoginDocument(doc) {
    if (!(doc instanceof Document)) return false;
    const pathname = String(doc.location && doc.location.pathname ? doc.location.pathname : '').toLowerCase();
    return pathname.includes('/login/');
  }

  function getIdCardCheckHelperDocumentSummary(doc, limit = 240) {
    if (!(doc instanceof Document)) return '';
    const text = normalizeExecutionAnalysisText(doc.body ? doc.body.textContent || '' : '');
    return text.slice(0, Math.max(80, Number(limit) || 240));
  }

  function getIdCardCheckHelperFrameDocument(frame) {
    if (!(frame instanceof HTMLIFrameElement)) return null;
    try {
      const doc = frame.contentDocument;
      return doc instanceof Document ? doc : null;
    } catch (error) {
      return null;
    }
  }

  function isIdCardCheckHelperDocumentReady(doc, targetUrl) {
    if (!(doc instanceof Document)) return false;

    const href = String(doc.location && doc.location.href ? doc.location.href : '').trim();
    const readyState = String(doc.readyState || '').toLowerCase();
    if (!href || href === 'about:blank') return false;
    if (readyState === 'loading') return false;
    if (isIdCardCheckHelperLoginDocument(doc)) return true;

    try {
      const expectedUrl = new URL(String(targetUrl || ''), window.location.href);
      const actualUrl = new URL(href, window.location.href);
      return actualUrl.origin === expectedUrl.origin && actualUrl.pathname === expectedUrl.pathname;
    } catch (error) {
      return true;
    }
  }

  async function waitForIdCardCheckHelperFrameLoad(frame, targetUrl, timeoutMs = ID_CARD_CHECK_HELPER_TIMEOUT_MS, intervalMs = 120) {
    if (!(frame instanceof HTMLIFrameElement)) {
      throw new Error('Не удалось создать helper iframe.');
    }

    const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || ID_CARD_CHECK_HELPER_TIMEOUT_MS);
    const startedAt = Date.now();
    let lastHref = '';
    let lastReadyState = '';

    while (Date.now() - startedAt <= safeTimeoutMs) {
      const doc = getIdCardCheckHelperFrameDocument(frame);
      if (doc instanceof Document) {
        lastHref = String(doc.location && doc.location.href ? doc.location.href : '').trim() || lastHref;
        lastReadyState = String(doc.readyState || '').toLowerCase() || lastReadyState;
        if (isIdCardCheckHelperDocumentReady(doc, targetUrl)) {
          return doc;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    const details = [lastHref ? `URL: ${lastHref}` : '', lastReadyState ? `readyState: ${lastReadyState}` : '']
      .filter(Boolean)
      .join(', ');
    throw new Error(`Истек таймаут загрузки helper iframe${details ? ` (${details})` : ''}.`);
  }

  async function loadIdCardCheckHelperFrameDocument(frame, url, timeoutMs = ID_CARD_CHECK_HELPER_TIMEOUT_MS) {
    const targetUrl = String(url || '').trim();
    if (!(frame instanceof HTMLIFrameElement) || !targetUrl) {
      throw new Error('Не удалось подготовить helper iframe.');
    }
    frame.src = targetUrl;
    const doc = await waitForIdCardCheckHelperFrameLoad(frame, targetUrl, timeoutMs);
    if (isIdCardCheckHelperLoginDocument(doc)) {
      throw new Error('Сайт вернул страницу логина вместо целевой формы.');
    }
    return doc;
  }

  async function waitForIdCardCheckHelperFrameCondition(frame, predicate, timeoutMs = ID_CARD_CHECK_HELPER_TIMEOUT_MS, intervalMs = 120) {
    const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || ID_CARD_CHECK_HELPER_TIMEOUT_MS);
    const startedAt = Date.now();

    while (Date.now() - startedAt <= safeTimeoutMs) {
      const doc = getIdCardCheckHelperFrameDocument(frame);
      if (doc instanceof Document && predicate(doc)) return doc;
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    throw new Error('Истек таймаут ожидания результата helper iframe.');
  }

  function splitIdCardCheckTmValue(tmText) {
    const normalizedText = String(tmText || '').trim();
    const separatorIndex = normalizedText.indexOf('\\');
    if (separatorIndex < 0) {
      return {
        tmText: normalizedText,
        stage: normalizedText,
        status: ''
      };
    }
    return {
      tmText: normalizedText,
      stage: normalizedText.slice(0, separatorIndex).trim(),
      status: normalizedText.slice(separatorIndex + 1).trim()
    };
  }

  function formatIdCardCheckTm(stage, status) {
    const normalizedStage = String(stage || '').trim();
    const normalizedStatus = String(status || '').trim();
    if (normalizedStage && normalizedStatus) return `${normalizedStage}\\${normalizedStatus}`;
    return normalizedStage || normalizedStatus;
  }

  function collectIdCardCheckHistoryTransitionCandidates(actionText) {
    const text = String(actionText || '').trim();
    if (!text.startsWith(ID_CARD_CHECK_HISTORY_TRANSITION_PREFIX)) return [];

    const body = text.slice(ID_CARD_CHECK_HISTORY_TRANSITION_PREFIX.length).trim();
    const candidates = [];
    const seen = new Set();
    let searchIndex = 0;

    while (searchIndex >= 0 && searchIndex < body.length) {
      const separatorIndex = body.indexOf(' на ', searchIndex);
      if (separatorIndex < 0) break;

      const previousTm = body.slice(0, separatorIndex).trim();
      const currentTm = body.slice(separatorIndex + 4).trim();
      const previous = splitIdCardCheckTmValue(previousTm);
      const current = splitIdCardCheckTmValue(currentTm);

      if (previous.stage && previous.status && current.stage && current.status) {
        const key = `${previous.tmText}|||${current.tmText}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push({
            previousTm: previous.tmText,
            previousStage: previous.stage,
            previousStatus: previous.status,
            currentTm: current.tmText,
            currentStage: current.stage,
            currentStatus: current.status
          });
        }
      }

      searchIndex = separatorIndex + 4;
    }

    return candidates;
  }

  function getLatestIdCardCheckHistoryTransitionText(doc) {
    if (!(doc instanceof Document)) return '';
    const rows = Array.from(doc.querySelectorAll('table tbody tr'));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => normalizeExecutionAnalysisText(cell.textContent || ''));
      const rowKind = normalizeStageJumpText(cells[0] || '');
      const actionText = String(cells[1] || '').trim();
      if (rowKind !== normalizeStageJumpText('ИД')) continue;
      if (!actionText.startsWith(ID_CARD_CHECK_HISTORY_TRANSITION_PREFIX)) continue;
      return actionText;
    }
    return '';
  }

  function parseIdCardCheckEditedocStatusOptionText(text) {
    const normalizedText = String(text || '').trim();
    const separatorIndex = normalizedText.indexOf(' / ');
    if (separatorIndex < 0) {
      return {
        text: normalizedText,
        stage: normalizedText,
        status: ''
      };
    }
    return {
      text: normalizedText,
      stage: normalizedText.slice(0, separatorIndex).trim(),
      status: normalizedText.slice(separatorIndex + 3).trim()
    };
  }

  function collectIdCardCheckEditedocStatusOptions(doc) {
    if (!(doc instanceof Document)) return [];
    const select = doc.querySelector('select[name="StatusID"]');
    if (!(select instanceof HTMLSelectElement)) return [];

    return Array.from(select.options).map((option) => {
      const parsed = parseIdCardCheckEditedocStatusOptionText(option.textContent || '');
      return {
        value: String(option.value || '').trim(),
        text: parsed.text,
        stage: parsed.stage,
        status: parsed.status,
        normalizedStage: normalizeStageJumpText(parsed.stage),
        normalizedStatus: normalizeStageJumpText(parsed.status),
        selected: option.selected === true
      };
    });
  }

  function isIdCardCheckEditedocStatusOptionMatch(option, stage, status) {
    return !!(
      option &&
      option.value &&
      option.normalizedStage === normalizeStageJumpText(stage) &&
      option.normalizedStatus === normalizeStageJumpText(status)
    );
  }

  function findIdCardCheckEditedocStatusOption(options, stage, status) {
    return (Array.isArray(options) ? options : []).find((option) => (
      isIdCardCheckEditedocStatusOptionMatch(option, stage, status)
    )) || null;
  }

  function getSelectedIdCardCheckEditedocStatusOption(options) {
    return (Array.isArray(options) ? options : []).find((option) => option && option.selected) || null;
  }

  function resolveIdCardCheckPreviousTm(actionText, statusOptions) {
    const candidates = collectIdCardCheckHistoryTransitionCandidates(actionText);
    if (!candidates.length) return null;

    const selectedCurrentOption = getSelectedIdCardCheckEditedocStatusOption(statusOptions);
    const resolvedCandidates = candidates.map((candidate) => ({
      ...candidate,
      matchedOption: findIdCardCheckEditedocStatusOption(
        statusOptions,
        candidate.previousStage,
        candidate.previousStatus
      ),
      currentMatchesSelected: !!selectedCurrentOption && isIdCardCheckEditedocStatusOptionMatch(
        selectedCurrentOption,
        candidate.currentStage,
        candidate.currentStatus
      )
    }));

    const selectedMatchedCandidate = resolvedCandidates.find((candidate) => (
      candidate.currentMatchesSelected && candidate.matchedOption
    ));
    if (selectedMatchedCandidate) return selectedMatchedCandidate;

    const selectedFallbackCandidate = resolvedCandidates.find((candidate) => candidate.currentMatchesSelected);
    if (selectedFallbackCandidate) return selectedFallbackCandidate;

    const matchedCandidate = resolvedCandidates.find((candidate) => candidate.matchedOption);
    if (matchedCandidate) return matchedCandidate;

    return resolvedCandidates[0] || null;
  }

  function getIdCardCheckEditedocStatusSelect(doc) {
    const select = doc instanceof Document
      ? doc.querySelector('select[name="StatusID"]')
      : null;
    return select instanceof HTMLSelectElement ? select : null;
  }

  function getIdCardCheckEditedocSubmitButton(doc) {
    if (!(doc instanceof Document)) return null;
    return Array.from(doc.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]')).find((element) => {
      if (!(element instanceof HTMLButtonElement) && !(element instanceof HTMLInputElement)) return false;
      const text = normalizeStageJumpText(element.textContent || element.getAttribute('value') || '');
      return text.includes(normalizeStageJumpText('Сохранить'));
    }) || null;
  }

  function hasIdCardCheckEditedocSuccessMessage(doc) {
    const text = normalizeStageJumpText(doc instanceof Document && doc.body ? doc.body.textContent || '' : '');
    return text.includes(normalizeStageJumpText('Информация успешно обновлена')) &&
      text.includes(normalizeStageJumpText('Вы можете закрыть это окно'));
  }

  function hasIdCardCheckEditedocTerminalError(doc) {
    if (!(doc instanceof Document)) return false;
    if (isIdCardCheckHelperLoginDocument(doc)) return true;
    const text = normalizeExecutionAnalysisText(doc.body ? doc.body.textContent || '' : '');
    return text.includes('ERROR EXCEPTION') || text.includes('No query results for model');
  }

  function isIdCardCheckHistoryUrl(urlValue, edocId = '') {
    try {
      const url = new URL(String(urlValue || ''), window.location.origin);
      const pathname = String(url.pathname || '').toLowerCase();
      if (!pathname.includes('/action_history')) return false;
      const currentEdocId = normalizeExecutionAnalysisText(getIdCardCheckEdocIdFromPath(url.pathname));
      if (!currentEdocId) return false;
      const expectedEdocId = normalizeExecutionAnalysisText(edocId);
      return !expectedEdocId || currentEdocId === expectedEdocId;
    } catch (error) {
      return false;
    }
  }

  function getIdCardCheckCurrentHistoryDocument(edocId) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (isIdCardCheckHistoryUrl(window.location.href, normalizedEdocId)) {
      return document;
    }

    const iframe = getGridCardCheckIframe();
    if (!(iframe instanceof HTMLIFrameElement)) return null;
    if (!isIdCardCheckHistoryUrl(getGridCardCheckIframeUrl(iframe), normalizedEdocId)) return null;

    try {
      const doc = iframe.contentDocument;
      return doc instanceof Document ? doc : null;
    } catch (error) {
      return null;
    }
  }

  async function waitForIdCardCheckDocumentCondition(predicate, timeoutMs = ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS, intervalMs = 120) {
    const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS);
    const startedAt = Date.now();

    while (Date.now() - startedAt <= safeTimeoutMs) {
      if (predicate(document)) return document;
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    throw new Error('Истек таймаут ожидания результата вкладки EdocID.');
  }

  function triggerIdCardCheckEditedocReturn(doc, statusOptionValue) {
    const select = getIdCardCheckEditedocStatusSelect(doc);
    const submitButton = getIdCardCheckEditedocSubmitButton(doc);
    const form = select instanceof HTMLSelectElement ? select.closest('form') : null;

    if (!(select instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) {
      throw new Error('На форме editedoc не найдены нужные элементы.');
    }

    select.value = String(statusOptionValue || '').trim();
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit(
        submitButton instanceof HTMLButtonElement || submitButton instanceof HTMLInputElement
          ? submitButton
          : undefined
      );
    } else if (submitButton instanceof HTMLElement) {
      submitButton.click();
    } else {
      form.submit();
    }
  }

  function normalizeIdCardCheckFailedReturnLine(edocId, previousTmText) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    const normalizedTm = normalizeExecutionAnalysisText(previousTmText);
    return normalizedEdocId && normalizedTm ? `${normalizedEdocId} – ${normalizedTm}` : '';
  }

  async function getIdCardCheckFailedReturnBufferTabId() {
    const currentTabId = await getCurrentTabIdForExecutionAnalysis();
    if (Number.isInteger(currentTabId) && currentTabId > 0) return currentTabId;
    const state = normalizeIdCardCheckState(idCardCheckState);
    return Number.isInteger(state.tabId) && state.tabId > 0 ? state.tabId : 0;
  }

  async function accumulateIdCardCheckFailedReturn(edocId, previousTmText) {
    const line = normalizeIdCardCheckFailedReturnLine(edocId, previousTmText);
    let entries = Array.isArray(idCardCheckFailedReturnEntries) ? [...idCardCheckFailedReturnEntries] : [];

    if (!line) {
      return {
        line: '',
        count: entries.length,
        text: entries.join('\n')
      };
    }

    try {
      const bufferTabId = await getIdCardCheckFailedReturnBufferTabId();
      if (bufferTabId > 0) {
        const response = await sendRuntimeMessage({
          action: 'ID_CARD_CHECK_ACCUMULATE_FAILED_RETURN',
          data: {
            tabId: bufferTabId,
            line
          }
        });
        if (response && response.success === true) {
          entries = Array.isArray(response.entries)
            ? response.entries.map((value) => normalizeExecutionAnalysisText(value)).filter(Boolean)
            : entries;
        }
      }
    } catch (error) {
      // fall back to the current document buffer if session storage is unavailable
    }

    if (!entries.includes(line)) {
      entries.push(line);
    }
    idCardCheckFailedReturnEntries = entries;

    const joinedText = entries.join('\n');
    try {
      await writePlainTextToClipboard(joinedText);
    } catch (error) {
      // keep accumulated buffer even if clipboard is unavailable
    }

    return {
      line,
      count: entries.length,
      text: joinedText
    };
  }

  async function resolveIdCardCheckHistoryTransitionText(edocId) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!normalizedEdocId) {
      throw new Error('Не удалось определить EdocID для поиска предыдущей ТМ.');
    }

    const currentHistoryDoc = getIdCardCheckCurrentHistoryDocument(normalizedEdocId);
    if (currentHistoryDoc instanceof Document) {
      const transitionText = getLatestIdCardCheckHistoryTransitionText(currentHistoryDoc);
      if (!transitionText) {
        throw new Error(`Для EdocID ${normalizedEdocId} не найдена история перехода по ТМ.`);
      }
      return transitionText;
    }

    const historyTab = await openIdCardCheckUrlInTabDetailed(
      buildIdCardCheckHistoryUrl(normalizedEdocId),
      { active: false }
    );
    if (!historyTab.success || !Number.isInteger(historyTab.tabId)) {
      throw new Error(historyTab.error || `Не удалось открыть Историю для EdocID ${normalizedEdocId}.`);
    }

    try {
      const response = await sendRuntimeMessage({
        action: 'ID_CARD_CHECK_EXTRACT_HISTORY_TRANSITION',
        data: {
          tabId: historyTab.tabId,
          edocId: normalizedEdocId,
          timeoutMs: ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS
        }
      });
      if (!response || response.success !== true) {
        throw new Error(response && response.error ? response.error : `Для EdocID ${normalizedEdocId} не удалось прочитать Историю.`);
      }
      const transitionText = normalizeExecutionAnalysisText(response.transitionText);
      if (!transitionText) {
        throw new Error(`Для EdocID ${normalizedEdocId} не найдена история перехода по ТМ.`);
      }
      return transitionText;
    } finally {
      await closeIdCardCheckAuxTab(historyTab.tabId);
    }
  }

  async function returnIdCardCheckToPreviousTm(edocId, options = {}) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    if (!normalizedEdocId) return false;
    const toastNav = options && options.toastNav instanceof HTMLElement ? options.toastNav : null;
    const keepEditTabOpenOnError = options && options.keepEditTabOpenOnError !== false;

    if (toastNav instanceof HTMLElement) {
      setIdCardCheckNavToast(toastNav, `Возвращаю EdocID ${normalizedEdocId} на предыдущую ТМ...`, 'info', 20000);
    }

    try {
      const transitionText = await resolveIdCardCheckHistoryTransitionText(normalizedEdocId);
      const editTab = await openIdCardCheckUrlInTabDetailed(
        buildIdCardCheckActionUrl('edit-info', normalizedEdocId),
        { active: false }
      );
      if (!editTab.success || !Number.isInteger(editTab.tabId)) {
        throw new Error(editTab.error || `Не удалось открыть форму editedoc для EdocID ${normalizedEdocId}.`);
      }

      let shouldCloseEditTab = true;

      try {
        const prepareResult = await sendRuntimeMessage({
          action: 'ID_CARD_CHECK_PREPARE_EDITEDOC_RETURN',
          data: {
            tabId: editTab.tabId,
            edocId: normalizedEdocId,
            transitionText,
            timeoutMs: ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS
          }
        });
        if (!prepareResult || prepareResult.success !== true) {
          throw new Error(prepareResult && prepareResult.error ? prepareResult.error : `Не удалось подготовить editedoc для EdocID ${normalizedEdocId}.`);
        }
        const previousTmText = normalizeExecutionAnalysisText(prepareResult.previousTmText);

        if (prepareResult.submitted !== true) {
          await accumulateIdCardCheckFailedReturn(normalizedEdocId, previousTmText);
          if (toastNav instanceof HTMLElement) {
            setIdCardCheckNavToast(
              toastNav,
              `Не удалось вернуть EdocID ${normalizedEdocId} на предыдущую ТМ ${previousTmText}. Накопленный список скопирован в буфер обмена.`,
              'error'
            );
          }
          return false;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 200));
        const confirmResult = await sendRuntimeMessage({
          action: 'ID_CARD_CHECK_CONFIRM_EDITEDOC_RETURN',
          data: {
            tabId: editTab.tabId,
            edocId: normalizedEdocId,
            timeoutMs: ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS + 10000
          }
        });
        if (!confirmResult || confirmResult.success !== true) {
          throw new Error(confirmResult && confirmResult.error ? confirmResult.error : `Форма editedoc не подтвердила сохранение для EdocID ${normalizedEdocId}.`);
        }

        if (toastNav instanceof HTMLElement) {
          setIdCardCheckNavToast(
            toastNav,
            `EdocID ${normalizedEdocId} был возвращен на ТМ ${previousTmText}.`,
            'success'
          );
        }
        return true;
      } catch (error) {
        shouldCloseEditTab = !keepEditTabOpenOnError;
        throw error;
      } finally {
        if (shouldCloseEditTab) {
          await closeIdCardCheckAuxTab(editTab.tabId);
        }
      }
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (toastNav instanceof HTMLElement) {
        setIdCardCheckNavToast(
          toastNav,
          `Не удалось вернуть EdocID ${normalizedEdocId}: ${message}`,
          'error',
          12000
        );
      } else {
        window.alert(`Не удалось вернуть EdocID ${normalizedEdocId}: ${message}`);
      }
      return false;
    }
  }

  function buildIdCardCheckAutoReturnSummary(processedCount, failedCount, totalCount) {
    const processed = Math.max(0, Number(processedCount) || 0);
    const failed = Math.max(0, Number(failedCount) || 0);
    const total = Math.max(processed, Number(totalCount) || 0);
    if (failed > 0) {
      return `Возврат по списку завершен: обработано ${processed} из ${total}, не удалось ${failed}.`;
    }
    return `Возврат по списку завершен: обработано ${processed} из ${total}.`;
  }

  async function processIdCardCheckAutoReturnAllStep(toastNav = null) {
    const autoState = loadIdCardCheckAutoReturnState();
    if (!autoState.active || autoState.mode !== 'all' || autoState.navKind !== 'fullcard') return false;

    const state = normalizeIdCardCheckState(idCardCheckState);
    if (!state.edocIds.length) {
      clearIdCardCheckAutoReturnState();
      return false;
    }

    const currentEdocId = normalizeExecutionAnalysisText(state.edocIds[state.currentIndex]);
    const pageEdocId = getIdCardCheckCurrentEdocId();
    if (!currentEdocId || pageEdocId !== currentEdocId) return false;

    persistIdCardCheckAutoReturnState({
      ...autoState,
      lastStartedEdocId: currentEdocId
    });

    const success = await returnIdCardCheckToPreviousTm(currentEdocId, {
      toastNav
    });
    const nextProcessedCount = autoState.processedCount + 1;
    const nextFailedCount = autoState.failedCount + (success ? 0 : 1);
    const hasNext = state.currentIndex < state.edocIds.length - 1;

    if (!hasNext) {
      clearIdCardCheckAutoReturnState();
      if (toastNav instanceof HTMLElement) {
        setIdCardCheckNavToast(
          toastNav,
          buildIdCardCheckAutoReturnSummary(nextProcessedCount, nextFailedCount, autoState.totalCount),
          nextFailedCount > 0 ? 'error' : 'success',
          12000
        );
      }
      return success;
    }

    persistIdCardCheckAutoReturnState({
      ...autoState,
      active: true,
      mode: 'all',
      navKind: 'fullcard',
      totalCount: autoState.totalCount,
      processedCount: nextProcessedCount,
      failedCount: nextFailedCount,
      lastStartedEdocId: currentEdocId,
      startedAt: autoState.startedAt || Date.now()
    });
    await navigateIdCardCheckToIndex(state.currentIndex + 1);
    return success;
  }

  async function maybeResumeIdCardCheckAutoReturn() {
    if (idCardCheckAutoReturnResumePending) return false;
    const autoState = loadIdCardCheckAutoReturnState();
    if (!autoState.active || autoState.mode !== 'all' || autoState.navKind !== 'fullcard') return false;
    if (!isIdCardCheckFullcardPath()) return false;

    const state = normalizeIdCardCheckState(idCardCheckState);
    const currentEdocId = getIdCardCheckCurrentEdocId();
    const expectedEdocId = normalizeExecutionAnalysisText(state.edocIds[state.currentIndex]);
    if (!currentEdocId || !expectedEdocId || currentEdocId !== expectedEdocId) return false;
    if (autoState.lastStartedEdocId === currentEdocId) return false;

    idCardCheckAutoReturnResumePending = true;
    try {
      await processIdCardCheckAutoReturnAllStep(idCardCheckNavEl instanceof HTMLElement ? idCardCheckNavEl : null);
      return true;
    } finally {
      idCardCheckAutoReturnResumePending = false;
    }
  }

  async function returnIdCardCheckToPreviousTmForAllGridEdocIds(toastNav = null) {
    const state = normalizeGridCardCheckState(gridCardCheckState);
    if (!state.edocIds.length) return false;

    let processedCount = 0;
    let failedCount = 0;
    for (let index = state.currentIndex; index < state.edocIds.length; index++) {
      const edocId = normalizeExecutionAnalysisText(state.edocIds[index]);
      if (!edocId) continue;
      if (index !== state.currentIndex) {
        navigateGridCardCheckToIndex(index);
        await new Promise((resolve) => window.setTimeout(resolve, 60));
      }
      const success = await returnIdCardCheckToPreviousTm(edocId, {
        toastNav
      });
      processedCount += 1;
      if (!success) failedCount += 1;
    }

    if (toastNav instanceof HTMLElement) {
      setIdCardCheckNavToast(
        toastNav,
        buildIdCardCheckAutoReturnSummary(processedCount, failedCount, state.edocIds.length - state.currentIndex),
        failedCount > 0 ? 'error' : 'success',
        12000
      );
    }
    return failedCount === 0;
  }

  async function returnIdCardCheckToPreviousTmForAllEdocIds(edocId, navKind, toastNav = null) {
    const normalizedEdocId = normalizeExecutionAnalysisText(edocId);
    const normalizedKind = navKind === 'grid' || navKind === 'fullcard' ? navKind : '';
    if (!normalizedEdocId || !normalizedKind) return false;

    if (normalizedKind === 'grid') {
      return returnIdCardCheckToPreviousTmForAllGridEdocIds(toastNav);
    }

    const state = normalizeIdCardCheckState(idCardCheckState);
    if (!state.edocIds.length) return false;
    const totalCount = Math.max(0, state.edocIds.length - state.currentIndex);
    persistIdCardCheckAutoReturnState({
      active: true,
      mode: 'all',
      navKind: 'fullcard',
      totalCount,
      processedCount: 0,
      failedCount: 0,
      lastStartedEdocId: '',
      startedAt: Date.now()
    });
    return processIdCardCheckAutoReturnAllStep(toastNav);
  }

  async function isCurrentIdCardCheckManagedTab() {
    const tabId = await getCurrentTabIdForExecutionAnalysis();
    return tabId > 0 && idCardCheckState.tabId > 0 && tabId === idCardCheckState.tabId;
  }

  function canKeepIdCardCheckUnboundNavigation(state) {
    const normalized = normalizeIdCardCheckState(state);
    if (normalized.tabId > 0) return false;
    const currentEdocId = getIdCardCheckEdocIdFromPath();
    return !!currentEdocId && normalized.edocIds.includes(currentEdocId);
  }

  async function syncIdCardCheckStateWithCurrentUrl() {
    const state = normalizeIdCardCheckState(idCardCheckState);
    if (!state.edocIds.length || !isIdCardCheckFullcardPath()) return state;

    const currentEdocId = getIdCardCheckEdocIdFromPath();
    const currentIndex = state.edocIds.indexOf(currentEdocId);
    if (currentIndex < 0) return state;

    const tabId = await getCurrentTabIdForExecutionAnalysis();
    if (tabId <= 0) {
      if (currentIndex === state.currentIndex) return state;
      const nextState = normalizeIdCardCheckState({
        ...state,
        currentIndex
      });
      idCardCheckState = nextState;
      persistIdCardCheckSessionCache(nextState);
      return nextState;
    }

    if (state.tabId <= 0) {
      return persistIdCardCheckState({
        ...state,
        tabId,
        currentIndex
      });
    }

    const isManagedTab = state.tabId > 0 && tabId === state.tabId;
    if (!isManagedTab) {
      const expectedEdocId = state.edocIds[state.currentIndex] || '';
      const ageMs = Date.now() - (Number(state.updatedAt || 0) || 0);
      const canRebindTab = currentEdocId === expectedEdocId &&
        ageMs >= 0 &&
        ageMs <= ID_CARD_CHECK_TAB_REBIND_TTL_MS;

      if (!canRebindTab) return state;
    }

    if (isManagedTab && currentIndex === state.currentIndex) return state;
    return persistIdCardCheckState({
      ...state,
      tabId,
      currentIndex
    });
  }

  function removeIdCardCheckNavigation() {
    if (idCardCheckNavEl instanceof HTMLElement) {
      idCardCheckNavEl.remove();
    }
    idCardCheckNavEl = null;
  }

  function getIdCardCheckNavigationMountPoint() {
    const tabsHeader = document.querySelector('.custom-ui-tab.ui-tabs-nav, .ui-tabs-nav');
    if (tabsHeader instanceof HTMLElement) {
      return {
        target: tabsHeader,
        position: 'afterend'
      };
    }

    const hostRoot = document.body || document.documentElement;
    if (!(hostRoot instanceof HTMLElement)) return null;

    const firstVisibleBlock = Array.from(hostRoot.children).find((child) => {
      if (!(child instanceof HTMLElement)) return false;
      if (child === idCardCheckNavEl) return false;
      if (child.id === ID_CARD_CHECK_NAV_ID) return false;
      return !child.hidden;
    });
    if (firstVisibleBlock instanceof HTMLElement) {
      return {
        target: firstVisibleBlock,
        position: 'beforebegin'
      };
    }

    return {
      target: hostRoot,
      position: 'afterbegin'
    };
  }

  function ensureIdCardCheckNavigationAttached(nav) {
    if (!(nav instanceof HTMLElement)) return false;
    const mountPoint = getIdCardCheckNavigationMountPoint();
    if (!(mountPoint && mountPoint.target instanceof HTMLElement)) return false;

    const { target, position } = mountPoint;
    if (position === 'afterend') {
      if (nav.parentElement !== target.parentElement || nav.previousElementSibling !== target) {
        target.insertAdjacentElement('afterend', nav);
      }
      return true;
    }

    if (position === 'beforebegin') {
      if (nav.parentElement !== target.parentElement || nav.nextElementSibling !== target) {
        target.insertAdjacentElement('beforebegin', nav);
      }
      return true;
    }

    if (nav.parentElement !== target || target.firstElementChild !== nav) {
      target.insertAdjacentElement('afterbegin', nav);
    }
    return true;
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
      const fallbackText = pathEdocId && !state.edocIds.includes(pathEdocId)
        ? `Вне списка: ${pathEdocId}`
        : currentEdocId
          ? `${state.currentIndex + 1}/${state.edocIds.length}: ${currentEdocId}`
          : 'Список не загружен';
      renderIdCardCheckNavStatus(idCardCheckNavEl, fallbackText);
    }
    syncIdCardCheckCurrentActionButton(idCardCheckNavEl, getIdCardCheckCurrentEdocId());
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
      const pendingState = await persistIdCardCheckState({
        version: 1,
        tabId: 0,
        edocIds: ids,
        currentIndex: 0
      });
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
        ...pendingState,
        tabId: response.tabId,
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
        <button type="button" class="dup-id-card-check-open-external" hidden>Открыть карточку ИД</button>
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

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openIdCardCheckChoiceDialog(anchorEl = null) {
    const modal = createIdCardCheckChoiceDialog();
    const list = modal.querySelector('.dup-id-card-check-choice-list');
    const search = modal.querySelector('.dup-id-card-check-choice-search');
    const state = normalizeIdCardCheckState(idCardCheckState);
    attachIdCardCheckAnchoredDialog(modal, anchorEl);
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
    positionIdCardCheckAnchoredDialog(modal, anchorEl);
    syncIdCardCheckChoiceSearch(modal);
    focusIdCardCheckSearchInput(search);
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

  function wireIdCardCheckNavigationEvents(nav) {
    if (!(nav instanceof HTMLElement)) return;
    if (nav.dataset.dupIdCardCheckContentReady === '1') return;
    nav.querySelector('.dup-id-card-check-prev')?.addEventListener('click', () => {
      void navigateIdCardCheckToIndex(normalizeIdCardCheckState(idCardCheckState).currentIndex - 1);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-choice')?.addEventListener('click', (event) => {
      openIdCardCheckChoiceDialog(event.currentTarget);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-current-actions')?.addEventListener('click', (event) => {
      openIdCardCheckActionDialog(getIdCardCheckCurrentEdocId(), event.currentTarget);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-next')?.addEventListener('click', () => {
      void navigateIdCardCheckToIndex(normalizeIdCardCheckState(idCardCheckState).currentIndex + 1);
    }, { capture: true });
    nav.dataset.dupIdCardCheckContentReady = '1';
  }

  async function syncIdCardCheckNavigation(options = {}) {
    const verifyManagedTab = !options || options.verifyManagedTab !== false;
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

    if (
      verifyManagedTab &&
      !(await isCurrentIdCardCheckManagedTab()) &&
      !canKeepIdCardCheckUnboundNavigation(state)
    ) {
      removeIdCardCheckNavigation();
      return;
    }

    if (!(idCardCheckNavEl instanceof HTMLElement)) {
      const existingNav = document.getElementById(ID_CARD_CHECK_NAV_ID);
      const nav = existingNav instanceof HTMLElement ? existingNav : document.createElement('div');
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
        <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-current-actions" hidden aria-label="Действия по текущему EdocID" title="Действия по текущему EdocID">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M13 2 4 14h6l-1 8 11-14h-7l1-6z"></path>
          </svg>
        </button>
        <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-next" aria-label="Вперед" title="Вперед">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9.3 18.7a1 1 0 0 1 0-1.4l4.3-4.3H5a1 1 0 1 1 0-2h8.6L9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0z"></path>
          </svg>
        </button>
        <span class="dup-id-card-check-status"></span>
        <span class="dup-id-card-check-toast" aria-live="polite"></span>
      `;
      idCardCheckNavEl = nav;
    }

    wireIdCardCheckNavigationEvents(idCardCheckNavEl);
    if (!ensureIdCardCheckNavigationAttached(idCardCheckNavEl)) return;
    updateIdCardCheckNavigationButtons();
  }

  const debouncedSyncIdCardCheckNavigation = debounce(() => {
    void syncIdCardCheckNavigation();
  }, 120);

  function initIdCardCheckNavigation() {
    if (!isPyramidExtensionPage()) return;
    if (hydrateIdCardCheckStateFromSessionCache()) {
      void syncIdCardCheckNavigation({ verifyManagedTab: false });
    }
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
      const fallbackText = iframeEdocId && !state.edocIds.includes(iframeEdocId)
        ? `Вне списка: ${iframeEdocId}`
        : currentEdocId
          ? `${state.currentIndex + 1}/${state.edocIds.length}: ${currentEdocId}`
          : 'Список пуст';
      renderIdCardCheckNavStatus(gridCardCheckNavEl, fallbackText);
    }
    syncIdCardCheckCurrentActionButton(gridCardCheckNavEl, getGridCardCheckCurrentEdocId());
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
        <button type="button" class="dup-id-card-check-open-external" hidden>Открыть карточку ИД</button>
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

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openGridCardCheckChoiceDialog(anchorEl = null) {
    const modal = createGridCardCheckChoiceDialog();
    const list = modal.querySelector('.dup-id-card-check-choice-list');
    const search = modal.querySelector('.dup-id-card-check-choice-search');
    const state = normalizeGridCardCheckState(gridCardCheckState);
    attachIdCardCheckAnchoredDialog(modal, anchorEl);
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
    positionIdCardCheckAnchoredDialog(modal, anchorEl);
    syncIdCardCheckChoiceSearch(modal);
    focusIdCardCheckSearchInput(search);
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
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-current-actions" hidden aria-label="Действия по текущему EdocID" title="Действия по текущему EdocID">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13 2 4 14h6l-1 8 11-14h-7l1-6z"></path>
        </svg>
      </button>
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-next" aria-label="Вперед" title="Вперед">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.3 18.7a1 1 0 0 1 0-1.4l4.3-4.3H5a1 1 0 1 1 0-2h8.6L9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0z"></path>
        </svg>
      </button>
      <span class="dup-id-card-check-status"></span>
      <span class="dup-id-card-check-toast" aria-live="polite"></span>
    `;
    nav.querySelector('.dup-id-card-check-prev')?.addEventListener('click', () => {
      navigateGridCardCheckToIndex(normalizeGridCardCheckState(gridCardCheckState).currentIndex - 1);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-choice')?.addEventListener('click', (event) => {
      openGridCardCheckChoiceDialog(event.currentTarget);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-current-actions')?.addEventListener('click', (event) => {
      openIdCardCheckActionDialog(getGridCardCheckCurrentEdocId(), event.currentTarget);
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
      void chromeStorageSet({ [definition.storageKey]: input.checked });
    }, { capture: true });

    const footer = document.createElement('div');
    footer.className = 'dup-extension-ui-settings-footer';
    const versionNote = document.createElement('span');
    versionNote.className = 'dup-extension-ui-settings-version';
    versionNote.textContent = getExtensionVersionText();
    const hotkeyNote = document.createElement('span');
    hotkeyNote.className = 'dup-extension-ui-settings-hotkey';
    hotkeyNote.textContent = 'Горячая клавиша: F2';
    footer.append(versionNote, hotkeyNote);

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

  function normalizeDepartmentContainerHost(hostname) {
    return String(hostname || '').trim().toLowerCase();
  }

  function getDepartmentContainerColor(hostname) {
    const normalizedHost = normalizeDepartmentContainerHost(hostname);
    return DEPARTMENT_CONTAINER_HOST_COLORS[normalizedHost] || 'blue';
  }

  function getDepartmentLinkDepid(targetLink) {
    if (!(targetLink instanceof HTMLAnchorElement)) return '';

    const attrDepid = String(
      targetLink.getAttribute('data-depid') ||
      targetLink.getAttribute('depid') ||
      ''
    ).trim();
    if (attrDepid) return attrDepid;

    try {
      const targetUrl = new URL(targetLink.href || targetLink.getAttribute('href') || '', window.location.origin);
      const match = String(targetUrl.pathname || '').match(/\/login\/department\/(\d+)(?:\/|$)/i);
      return match ? match[1] : '';
    } catch (error) {
      return '';
    }
  }

  function getDepartmentContainerTarget(targetLink, targetUrlValue = '') {
    if (!(targetLink instanceof HTMLAnchorElement)) return null;

    const depid = getDepartmentLinkDepid(targetLink);
    const config = DEPARTMENT_CONTAINER_CONFIG[depid];
    if (!depid || !config) return null;

    const targetUrlText = String(targetUrlValue || buildDepartmentNavigationUrl(targetLink) || '').trim();
    if (!targetUrlText) return null;

    let targetUrl = null;
    try {
      targetUrl = new URL(targetUrlText, window.location.origin);
    } catch (error) {
      return null;
    }

    const targetHost = normalizeDepartmentContainerHost(targetUrl.hostname || config.host);
    const expectedHost = normalizeDepartmentContainerHost(config.host || targetHost);
    const colorHost = DEPARTMENT_CONTAINER_HOST_COLORS[targetHost] ? targetHost : expectedHost;

    return {
      depid,
      url: targetUrl.toString(),
      title: String(config.title || '').trim(),
      host: expectedHost || targetHost,
      color: getDepartmentContainerColor(colorHost)
    };
  }

  async function refreshDepartmentContainersSupport() {
    const response = await sendRuntimeMessage({ action: 'DEPARTMENT_CONTAINER_GET_SUPPORT' });
    departmentContainersSupported = !!(response && response.success === true && response.supported === true);
    return departmentContainersSupported;
  }

  function getActiveDepartmentContainerTarget() {
    const activeLink = document.querySelector(`${SLOWSEARCH_CITIES_LINK_SELECTOR}.active`);
    if (activeLink instanceof HTMLAnchorElement) {
      const target = getDepartmentContainerTarget(activeLink);
      if (target) return target;
    }

    const currentUrl = new URL(window.location.href);
    const host = normalizeDepartmentContainerHost(currentUrl.hostname);
    const candidates = Object.entries(DEPARTMENT_CONTAINER_CONFIG)
      .filter(([, config]) => normalizeDepartmentContainerHost(config.host) === host);
    return candidates.length === 1
      ? {
          depid: candidates[0][0],
          url: window.location.href,
          title: candidates[0][1].title,
          host,
          color: getDepartmentContainerColor(host)
        }
      : null;
  }

  function syncDepartmentContainerPageTitle() {
    if (!departmentContainerModeEnabled || !departmentContainersSupported || !isPyramidExtensionPage()) return;
    const target = getActiveDepartmentContainerTarget();
    if (!target || !target.title) return;
    if (document.title !== target.title) {
      document.title = target.title;
    }
  }

  function scheduleDepartmentContainerTitleSync() {
    window.setTimeout(syncDepartmentContainerPageTitle, 0);
    window.setTimeout(syncDepartmentContainerPageTitle, 500);
    window.setTimeout(syncDepartmentContainerPageTitle, 1500);
    window.setTimeout(syncDepartmentContainerPageTitle, 4000);
  }

  async function openDepartmentContainerTab(targetLink, targetUrlValue = '') {
    if (!departmentContainerModeEnabled || !departmentContainersSupported) return false;

    const target = getDepartmentContainerTarget(targetLink, targetUrlValue);
    if (!target) return false;

    const response = await sendRuntimeMessage({
      action: 'DEPARTMENT_CONTAINER_OPEN_TAB',
      data: target
    });
    return !!(response && response.success === true);
  }

  function isDepartmentContainerClickEvent(event) {
    if (!event || event.defaultPrevented) return false;
    if (event.type !== 'click') return false;
    if (event.button !== 0) return false;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    if (event.isTrusted === false) return false;
    return true;
  }

  function handleDepartmentContainerClick(event) {
    if (!departmentContainerModeEnabled || !departmentContainersSupported) return;
    if (!isPyramidExtensionPage()) return;
    if (!isDepartmentContainerClickEvent(event)) return;

    const targetLink = event.target instanceof Element
      ? event.target.closest(SLOWSEARCH_CITIES_LINK_SELECTOR)
      : null;
    if (!(targetLink instanceof HTMLAnchorElement)) return;

    const targetUrl = buildDepartmentNavigationUrl(targetLink);
    if (!targetUrl || !getDepartmentContainerTarget(targetLink, targetUrl)) return;

    suppressHotkeyEvent(event);
    void openDepartmentContainerTab(targetLink, targetUrl).then((opened) => {
      if (!opened) {
        window.location.assign(targetUrl);
      }
    });
  }

  function initDepartmentContainerMode() {
    if (!isPyramidExtensionPage()) return;

    document.addEventListener('click', handleDepartmentContainerClick, true);
    chrome.storage.local.get([DEPARTMENT_CONTAINER_MODE_STORAGE_KEY], (settings) => {
      departmentContainerModeEnabled = settings[DEPARTMENT_CONTAINER_MODE_STORAGE_KEY] !== false;
      void refreshDepartmentContainersSupport().then(() => {
        scheduleDepartmentContainerTitleSync();
      });
    });
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

  async function navigateToDepartmentByHotkey(targetLink) {
    if (!(targetLink instanceof HTMLAnchorElement)) return false;
    const targetUrl = buildDepartmentNavigationUrl(targetLink);
    if (!targetUrl) return false;
    if (await openDepartmentContainerTab(targetLink, targetUrl)) return true;
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
    void navigateToDepartmentByHotkey(targetEntry.link);
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
      html.${SCREENSHOT_MODE_CLASS} #support-reminder-dialog-overlay,
      html.${SCREENSHOT_MODE_CLASS} #support-reminder-copy-feedback,
      html.${SCREENSHOT_MODE_CLASS} .support-reminder-action-header,
      html.${SCREENSHOT_MODE_CLASS} .support-reminder-action-cell,
      html.${SCREENSHOT_MODE_CLASS} .support-reminder-note-header,
      html.${SCREENSHOT_MODE_CLASS} .support-reminder-note-cell,
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
      html.${SCREENSHOT_MODE_CLASS} .dup-id-card-check-modal,
      html.${SCREENSHOT_MODE_CLASS} .dup-grid-card-check-modal,
      html.${SCREENSHOT_MODE_CLASS} #${ID_CARD_CHECK_NAV_ID},
      html.${SCREENSHOT_MODE_CLASS} #${GRID_CARD_CHECK_NAV_ID},
      html.${SCREENSHOT_MODE_CLASS} .dup-identity-verification-ui,
      html.${SCREENSHOT_MODE_CLASS} .dup-chatgpt-extension-ui,
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_PRINCIPAL_BUTTON_ID},
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_PRINCIPAL_SEPARATOR_ID},
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_PRINCIPAL_OVERLAY_ID},
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_PRINCIPAL_PERIOD_DIALOG_ID},
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_CHECK_MENU_ID},
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_WRITE_OFF_OVERLAY_ID},
      html.${SCREENSHOT_MODE_CLASS} #${REESTR_DZ_WRITE_OFF_COMMENT_CONFIRM_ID},
      html.${SCREENSHOT_MODE_CLASS} .pdf-status,
      html.${SCREENSHOT_MODE_CLASS} .${REESTR_DZ_WRITE_OFF_HIGHLIGHT_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${REESTR_DZ_PRINCIPAL_CURRENT_ROW_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${REESTR_DZ_PRINCIPAL_ATTENTION_ROW_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${REESTR_DZ_PRINCIPAL_SUCCESS_ROW_CLASS},
      html.${SCREENSHOT_MODE_CLASS} .${REESTR_DZ_PRINCIPAL_ERROR_ROW_CLASS},
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
    if (typeof fsspReestrGroupingPreference === 'boolean') {
      return fsspReestrGroupingPreference;
    }
    try {
      const rawValue = window.localStorage.getItem(FSSP_REESTR_GROUPING_STORAGE_KEY);
      if (rawValue === '0' || rawValue === 'false') return false;
      if (rawValue === '1' || rawValue === 'true') return true;
    } catch (error) {
      // ignore
    }
    return true;
  }

  function applyFsspReestrGroupingPreference(isEnabled, options = {}) {
    const enabled = !!isEnabled;
    fsspReestrGroupingPreference = enabled;
    try {
      window.localStorage.setItem(FSSP_REESTR_GROUPING_STORAGE_KEY, enabled ? '1' : '0');
    } catch (error) {
      // ignore
    }
    if (options.persist !== false) {
      void chromeStorageSet({ [FSSP_REESTR_GROUPING_STORAGE_KEY]: enabled });
    }
  }

  function saveFsspReestrGroupingPreference(isEnabled) {
    applyFsspReestrGroupingPreference(isEnabled, { persist: true });
  }

  function loadFsspReestrGroupingPreference() {
    chrome.storage.local.get([FSSP_REESTR_GROUPING_STORAGE_KEY], (result) => {
      const storedValue = result[FSSP_REESTR_GROUPING_STORAGE_KEY];
      if (typeof storedValue === 'boolean') {
        applyFsspReestrGroupingPreference(storedValue, { persist: false });
        if (isFsspReestrPage()) {
          ensureFsspReestrGroupingToggle();
          runCheck();
        }
        return;
      }

      const localValue = isFsspReestrGroupingEnabled();
      applyFsspReestrGroupingPreference(localValue, { persist: true });
    });
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
    if (!statusText) return;

    const statusColor = FSSP_REESTR_STATUS_COLOR_BY_TEXT[statusText] || EPGU_REQUESTS_COLOR_YELLOW;

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

  function normalizeEpguComparisonKey(value) {
    return normalizeEpguRequestsCellText(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е');
  }

  function isEpguElementTag(element, tagName) {
    return !!element && element.nodeType === 1 &&
      String(element.tagName || '').toUpperCase() === String(tagName || '').toUpperCase();
  }

  function parseEpguClaimantIdentity(value) {
    const fullText = normalizeEpguRequestsCellText(value);
    const match = fullText.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const claimantKey = normalizeEpguRequestsCellText(match ? match[1] : fullText);
    const personName = normalizeEpguRequestsCellText(match ? match[2] : '');
    const claimantComparisonKey = normalizeEpguComparisonKey(claimantKey);
    const personComparisonKey = normalizeEpguComparisonKey(personName);

    return {
      fullText,
      claimantKey,
      claimantComparisonKey,
      personName,
      personComparisonKey,
      pairComparisonKey: claimantComparisonKey && personComparisonKey
        ? `${claimantComparisonKey}\u241f${personComparisonKey}`
        : ''
    };
  }

  const epguRequestsDuplicateColorMap = new Map();
  let epguRequestsDuplicateColorIndex = 0;
  let epguRetryBatchRunning = false;
  let epguSummaryReopenCheckStarted = false;
  let epguRegistryCheckRunning = false;
  let epguRegistryConductingKey = '';
  let epguRegistryCheckProgress = null;
  let epguRegistryCheckNotice = '';
  let epguRegistryCheckNoticeIsError = false;
  let epguRegistryCheckCache = null;
  let epguRegistryCheckCachePromise = null;
  let epguSummarySelectedDateKey = '';
  let epguSummaryRowsByDate = new Map();
  let epguSummaryCompleteDateKeys = new Set();
  let epguSummaryRowsLoadPromise = null;
  let epguSummaryRowsLoadHost = '';
  let epguSummaryRowsLoadRangeKey = '';
  let epguSummaryRowsLoadError = '';
  let epguSummaryRowsLoaded = false;

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

  function normalizeEpguClaimantKey(value) {
    return parseEpguClaimantIdentity(value).claimantKey;
  }

  function parseEpguCreateDateInfo(rawValue) {
    const normalized = normalizeEpguRequestsCellText(rawValue);
    const dayKey = normalizeCreateDateForDuplicate(normalized);
    const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);

    if (!match) {
      return {
        rawText: normalized,
        dayKey,
        sortKey: '',
        shortDateLabel: dayKey ? dayKey.slice(0, 5).replace('-', '.') : ''
      };
    }

    const day = match[1];
    const month = match[2];
    const year = match[3];
    const hour = match[4] || '00';
    const minute = match[5] || '00';
    const second = match[6] || '00';

    return {
      rawText: normalized,
      dayKey: `${day}-${month}-${year}`,
      sortKey: `${year}${month}${day}${hour}${minute}${second}`,
      shortDateLabel: `${day}.${month}`
    };
  }

  function getEpguTodayDateKey() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    return `${day}-${month}-${year}`;
  }

  function parseEpguDateKey(dateKey) {
    const match = String(dateKey || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12, 0, 0, 0);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== Number(match[3]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[1])
    ) {
      return null;
    }
    return date;
  }

  function formatEpguDateToKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
  }

  function shiftEpguDateKey(dateKey, dayDelta) {
    const date = parseEpguDateKey(dateKey);
    if (!date) return '';
    date.setDate(date.getDate() + Number(dayDelta || 0));
    return formatEpguDateToKey(date);
  }

  function getEpguSummaryDateRange() {
    const maxDateKey = getEpguTodayDateKey();
    return {
      minDateKey: shiftEpguDateKey(maxDateKey, -EPGU_REQUESTS_SUMMARY_DAYS_BACK),
      maxDateKey
    };
  }

  function getEpguDateComparableKey(dateKey) {
    const match = String(dateKey || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return match ? `${match[3]}${match[2]}${match[1]}` : '';
  }

  function normalizeEpguSummarySelectedDateKey(dateKey) {
    const range = getEpguSummaryDateRange();
    const candidate = getEpguDateComparableKey(dateKey);
    const minimum = getEpguDateComparableKey(range.minDateKey);
    const maximum = getEpguDateComparableKey(range.maxDateKey);
    if (!candidate || candidate < minimum || candidate > maximum) return range.maxDateKey;
    return String(dateKey || '').trim();
  }

  function getEpguSummarySelectedDateKey() {
    epguSummarySelectedDateKey = normalizeEpguSummarySelectedDateKey(
      epguSummarySelectedDateKey || getEpguTodayDateKey()
    );
    return epguSummarySelectedDateKey;
  }

  function formatEpguSummaryDateLabel(dateKey) {
    const date = parseEpguDateKey(dateKey);
    if (!date) return formatEpguDateKeyForDisplay(dateKey);
    const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
      .format(date)
      .replace('.', '');
    const weekdayLabel = weekday ? `${weekday.charAt(0).toLocaleUpperCase('ru-RU')}${weekday.slice(1)}` : '';
    return `${weekdayLabel} ${formatEpguDateKeyForDisplay(dateKey)}`.trim();
  }

  function getEpguSummaryRowsRangeKey() {
    const range = getEpguSummaryDateRange();
    return `${range.minDateKey}|${range.maxDateKey}`;
  }

  function isEpguSummaryDateComplete(dateKey) {
    return epguSummaryRowsLoaded || epguSummaryCompleteDateKeys.has(normalizeEpguSummarySelectedDateKey(dateKey));
  }

  function isEpguSummaryDateAvailable(dateKey) {
    const normalized = normalizeEpguSummarySelectedDateKey(dateKey);
    return normalized === getEpguTodayDateKey() || isEpguSummaryDateComplete(normalized);
  }

  function readEpguGridCell(row, columnName) {
    const cell = row.querySelector(`td[aria-describedby="list_${columnName}"]`);
    if (!(cell instanceof HTMLElement)) return '';
    return normalizeEpguRequestsCellText(cell.getAttribute('title') || cell.textContent || '');
  }

  function prepareEpguSummaryRowsForCurrentBase() {
    const baseHost = String(window.location.hostname || '').trim().toLowerCase();
    const rangeKey = getEpguSummaryRowsRangeKey();
    if (epguSummaryRowsLoadHost !== baseHost || epguSummaryRowsLoadRangeKey !== rangeKey) {
      epguSummaryRowsLoadHost = baseHost;
      epguSummaryRowsLoadRangeKey = rangeKey;
      epguSummaryRowsLoadError = '';
      epguSummaryRowsLoaded = false;
      epguSummaryRowsByDate = new Map();
      epguSummaryCompleteDateKeys = new Set();
    }
    if (epguSummaryRowsLoaded) return;

    const todayKey = getEpguTodayDateKey();
    const previousKey = shiftEpguDateKey(todayKey, -1);
    const visibleRows = Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'))
      .filter((row) => row instanceof HTMLTableRowElement);
    const rowsByDate = new Map();
    const visibleDateKeys = [];
    visibleRows.forEach((row) => {
      const item = {
        id: readEpguGridCell(row, 'Id'),
        orderId: readEpguGridCell(row, 'OrderId'),
        claimant: readEpguGridCell(row, 'Claimant'),
        statusName: readEpguGridCell(row, 'StatusName'),
        message: readEpguGridCell(row, 'Message'),
        createDate: readEpguGridCell(row, 'CreateDate')
      };
      const dateKey = parseEpguCreateDateInfo(item.createDate).dayKey;
      if (!dateKey) return;
      visibleDateKeys.push(dateKey);
      if (dateKey !== todayKey && dateKey !== previousKey) return;
      if (!rowsByDate.has(dateKey)) rowsByDate.set(dateKey, []);
      rowsByDate.get(dateKey).push(item);
    });
    rowsByDate.forEach((rows, dateKey) => epguSummaryRowsByDate.set(dateKey, rows));

    const pageInput = document.querySelector('#pager .ui-pg-input, #pager_center .ui-pg-input, input.ui-pg-input');
    const isFirstPage = !(pageInput instanceof HTMLInputElement) || Number(pageInput.value || 1) === 1;
    const pagingInfo = normalizeEpguRequestsCellText(
      document.querySelector('#pager .ui-paging-info, #pager_right .ui-paging-info, .ui-paging-info')?.textContent || ''
    );
    const pagingMatch = pagingInfo.match(/(\d[\d\s]*)\s*-\s*(\d[\d\s]*)\s+из\s+(\d[\d\s]*)/i);
    const parsePagingNumber = (value) => Number(String(value || '').replace(/\s+/g, ''));
    const isLastPage = !!pagingMatch && parsePagingNumber(pagingMatch[2]) >= parsePagingNumber(pagingMatch[3]);
    const hasDateOlderThan = (dateKey) => {
      const boundary = getEpguDateComparableKey(dateKey);
      return visibleDateKeys.some((visibleKey) => getEpguDateComparableKey(visibleKey) < boundary);
    };
    if (isFirstPage && (isLastPage || hasDateOlderThan(todayKey))) {
      epguSummaryCompleteDateKeys.add(todayKey);
    }
    if (isFirstPage && rowsByDate.has(previousKey) && (isLastPage || hasDateOlderThan(previousKey))) {
      epguSummaryCompleteDateKeys.add(previousKey);
    }
  }

  async function loadEpguSummaryRowsForCurrentBase() {
    const baseHost = String(window.location.hostname || '').trim().toLowerCase();
    const range = getEpguSummaryDateRange();
    const rangeKey = getEpguSummaryRowsRangeKey();
    if (
      epguSummaryRowsLoaded &&
      epguSummaryRowsLoadHost === baseHost &&
      epguSummaryRowsLoadRangeKey === rangeKey
    ) {
      return epguSummaryRowsByDate;
    }
    if (epguSummaryRowsLoadPromise) return epguSummaryRowsLoadPromise;

    epguSummaryRowsLoadError = '';
    epguSummaryRowsLoaded = false;
    epguSummaryRowsLoadPromise = (async () => {
      const response = await sendRuntimeMessage({
        action: 'EPGU_REQUESTS_WEEK_LOAD',
        data: {
          baseHost,
          minDateKey: range.minDateKey,
          maxDateKey: range.maxDateKey
        }
      });
      if (!response || response.success !== true || !Array.isArray(response.rows)) {
        throw new Error(response && response.error ? response.error : 'Не удалось получить строки журнала ЕПГУ.');
      }

      const rowsByDate = new Map();
      response.rows.forEach((row) => {
        const dateInfo = parseEpguCreateDateInfo(row && row.createDate);
        const dateKey = dateInfo.dayKey;
        if (!dateKey) return;
        if (!rowsByDate.has(dateKey)) rowsByDate.set(dateKey, []);
        rowsByDate.get(dateKey).push(row);
      });
      epguSummaryRowsByDate = rowsByDate;
      epguSummaryCompleteDateKeys = new Set(
        Array.from({ length: EPGU_REQUESTS_SUMMARY_DAYS_BACK + 1 }, (_, index) => (
          shiftEpguDateKey(range.maxDateKey, -index)
        ))
      );
      epguSummaryRowsLoaded = true;
      return rowsByDate;
    })();

    try {
      return await epguSummaryRowsLoadPromise;
    } catch (error) {
      epguSummaryRowsLoadError = error && error.message
        ? error.message
        : 'Не удалось загрузить полную сводку ЕПГУ.';
      epguSummaryRowsLoaded = false;
      throw error;
    } finally {
      epguSummaryRowsLoadPromise = null;
    }
  }

  function formatEpguDateKeyForDisplay(dateKey) {
    const normalized = String(dateKey || '').trim();
    const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return normalized;
    return `${match[1]}.${match[2]}.${match[3]}`;
  }

  function resolveEpguStatusMeta(statusText) {
    const normalized = normalizeEpguRequestsCellText(statusText);
    const lower = normalized.toLowerCase();

    if (lower === 'услуга оказана') {
      return { color: EPGU_REQUESTS_COLOR_GREEN, rank: 4, label: normalized || 'Услуга оказана' };
    }
    if (lower === 'заявление получено ведомством') {
      return { color: EPGU_REQUESTS_COLOR_TRANSITION, rank: 3, label: normalized || 'Заявление получено ведомством' };
    }
    if (lower === 'ошибка') {
      return { color: EPGU_REQUESTS_COLOR_RED, rank: 1, label: normalized || 'Ошибка' };
    }

    return {
      color: EPGU_REQUESTS_COLOR_YELLOW,
      rank: normalized ? 2 : 0,
      label: normalized || 'Нет статуса'
    };
  }

  function isEpguEntryBetter(candidate, current) {
    if (!current) return true;
    if ((candidate.statusMeta.rank || 0) !== (current.statusMeta.rank || 0)) {
      return (candidate.statusMeta.rank || 0) > (current.statusMeta.rank || 0);
    }
    if ((candidate.dateInfo.sortKey || '') !== (current.dateInfo.sortKey || '')) {
      return (candidate.dateInfo.sortKey || '') > (current.dateInfo.sortKey || '');
    }
    return (candidate.rowIndex || 0) < (current.rowIndex || 0);
  }

  function formatEpguDateTimeForDisplay(rawValue) {
    const normalized = normalizeEpguRequestsCellText(rawValue);
    if (!normalized) return '';
    const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
    if (!match) return normalized;
    return `${match[1]}.${match[2]}.${match[3]}${match[4] || ''}`.trim();
  }

  function createEpguSummaryBadge(text, className, backgroundColor) {
    const badge = document.createElement('span');
    badge.className = className;
    badge.textContent = text;
    if (backgroundColor) {
      badge.style.backgroundColor = backgroundColor;
      badge.style.borderColor = backgroundColor;
    }
    return badge;
  }

  const EPGU_REGISTRY_CLAIMANT_ALIASES = Object.freeze([
    ['КГК', ['кгк', 'курганская генерирующая компания']],
    ['Водный союз', ['водный союз']],
    ['Чистый город', ['чистый город']],
    ['Восток', ['восток']],
    ['Ямалкоммунэнерго', ['ямалкоммунэнерго']],
    ['Рифей', ['рифей', 'компания рифей']],
    ['СЕВЭНКО', ['севэнко', 'северная энергетическая компания']],
    ['ВТВК', ['втвк', 'вынгапуровский тепловодоканал']],
    ['СУЭНКО', ['суэнко']],
    ['ТЭО', ['тэо', 'тюменское экологическое объединение']],
    ['ХЭГ', ['хэг', 'харп-энерго-газ', 'хэг харп']],
    ['Ямал Экология', ['ямал экология', 'ямалэкология']],
    ['ЕРИЦ ЯНАО', ['объединенный ериц']],
    ['ЮГРА', ['югра-экология', 'югра экология', 'югра']],
    ['ГТС', ['гтс']],
    ['СГЭС', ['сгэс']]
  ]);

  function normalizeEpguRegistryText(value) {
    return normalizeEpguRequestsCellText(value)
      .replace(/\u00a0/g, ' ')
      .replace(/ё/g, 'е')
      .replace(/Ё/g, 'Е')
      .replace(/[«»]/g, '"');
  }

  function normalizeEpguRegistryStatusKey(value) {
    return normalizeEpguRegistryText(value).toLocaleLowerCase('ru-RU').replace(/"/g, '');
  }

  function canonicalizeEpguRegistryClaimant(value) {
    const cleaned = normalizeEpguRegistryText(value);
    if (!cleaned) return '';
    const lookup = cleaned.toLocaleLowerCase('ru-RU').replace(/"/g, '');
    for (const [canonicalName, aliases] of EPGU_REGISTRY_CLAIMANT_ALIASES) {
      if (aliases.some((alias) => lookup.includes(alias))) return canonicalName;
    }
    return cleaned;
  }

  function parseEpguRegistryFileClaimant(fileName) {
    const match = normalizeEpguRegistryText(fileName).match(/^Реестр_ЕПГУ_(.+)_(\d+)_(\d+)\.xml$/i);
    return match ? normalizeEpguRegistryText(match[1]) : '';
  }

  function createEmptyEpguRegistryCheckCache() {
    return { dates: {} };
  }

  function normalizeEpguRegistryCheckCache(raw) {
    const normalized = createEmptyEpguRegistryCheckCache();
    const range = getEpguSummaryDateRange();
    const minimum = getEpguDateComparableKey(range.minDateKey);
    const maximum = getEpguDateComparableKey(range.maxDateKey);
    const rawDates = raw && typeof raw === 'object' && raw.dates && typeof raw.dates === 'object'
      ? { ...raw.dates }
      : {};

    if (
      raw && typeof raw === 'object' &&
      /^\d{2}-\d{2}-\d{4}$/.test(String(raw.dateKey || '')) &&
      raw.bases && typeof raw.bases === 'object' &&
      !rawDates[raw.dateKey]
    ) {
      rawDates[raw.dateKey] = { bases: raw.bases };
    }

    Object.entries(rawDates).forEach(([dateKey, dayValue]) => {
      const comparable = getEpguDateComparableKey(dateKey);
      if (!comparable || comparable < minimum || comparable > maximum) return;
      const bases = dayValue && typeof dayValue === 'object' && dayValue.bases && typeof dayValue.bases === 'object'
        ? dayValue.bases
        : {};
      normalized.dates[dateKey] = { bases };
    });
    return normalized;
  }

  async function loadEpguRegistryCheckCache() {
    if (epguRegistryCheckCache) return epguRegistryCheckCache;
    if (epguRegistryCheckCachePromise) return epguRegistryCheckCachePromise;

    epguRegistryCheckCachePromise = (async () => {
      const stored = await chromeStorageGet([EPGU_REGISTRY_CHECK_CACHE_STORAGE_KEY]);
      const raw = stored && stored[EPGU_REGISTRY_CHECK_CACHE_STORAGE_KEY];
      epguRegistryCheckCache = normalizeEpguRegistryCheckCache(raw);
      await chromeLocalStorageSet({ [EPGU_REGISTRY_CHECK_CACHE_STORAGE_KEY]: epguRegistryCheckCache });
      return epguRegistryCheckCache;
    })();

    try {
      return await epguRegistryCheckCachePromise;
    } finally {
      epguRegistryCheckCachePromise = null;
    }
  }

  function getEpguRegistryCheckResultForCurrentBase(dateKey = getEpguSummarySelectedDateKey()) {
    const normalizedDateKey = normalizeEpguSummarySelectedDateKey(dateKey);
    if (!epguRegistryCheckCache || !epguRegistryCheckCache.dates) return null;
    const host = normalizeDepartmentContainerHost(window.location.hostname);
    const dayCache = epguRegistryCheckCache.dates[normalizedDateKey];
    const result = dayCache && dayCache.bases && dayCache.bases[host];
    return result && typeof result === 'object' ? result : null;
  }

  async function saveEpguRegistryCheckResultForCurrentBase(result, dateKey = getEpguSummarySelectedDateKey()) {
    const normalizedDateKey = normalizeEpguSummarySelectedDateKey(dateKey);
    const currentCache = await loadEpguRegistryCheckCache();
    const host = normalizeDepartmentContainerHost(window.location.hostname);
    const nextCache = normalizeEpguRegistryCheckCache(currentCache);
    const currentDay = nextCache.dates[normalizedDateKey];
    nextCache.dates[normalizedDateKey] = {
      bases: {
        ...(currentDay && currentDay.bases || {}),
        [host]: result
      }
    };
    const saved = await chromeLocalStorageSet({ [EPGU_REGISTRY_CHECK_CACHE_STORAGE_KEY]: nextCache });
    if (saved) epguRegistryCheckCache = nextCache;
    return saved;
  }

  function aggregateEpguRegistryScanRows(rows, departmentCount) {
    const grouped = new Map();
    (Array.isArray(rows) ? rows : []).forEach((raw, rowIndex) => {
      const registryId = normalizeEpguRegistryText(raw && raw.registryId);
      const fileName = normalizeEpguRegistryText(raw && raw.fileName);
      const typeName = normalizeEpguRegistryText(raw && raw.typeName);
      const groupKey = registryId || `file:${fileName}|${typeName}|${rowIndex}`;
      const fileClaimant = parseEpguRegistryFileClaimant(fileName);
      const claimantKeys = [fileClaimant, raw && raw.claimantName]
        .map(canonicalizeEpguRegistryClaimant)
        .filter(Boolean);

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          registryId,
          fileName,
          typeName,
          claimantKeys: new Set(),
          statusNames: new Set(),
          departmentNames: new Set(),
          departmentEntries: new Map()
        });
      }

      const item = grouped.get(groupKey);
      if (!item.fileName && fileName) item.fileName = fileName;
      if (!item.typeName && typeName) item.typeName = typeName;
      claimantKeys.forEach((key) => item.claimantKeys.add(key));
      const statusName = normalizeEpguRegistryText(raw && raw.statusName);
      if (statusName) item.statusNames.add(statusName);
      const departmentName = normalizeEpguRegistryText(raw && raw.department);
      if (departmentName) item.departmentNames.add(departmentName);
      const departmentDepid = normalizeEpguRegistryText(raw && raw.depid);
      if (departmentDepid) {
        if (!item.departmentEntries.has(departmentDepid)) {
          item.departmentEntries.set(departmentDepid, {
            depid: departmentDepid,
            name: departmentName,
            statusNames: new Set()
          });
        }
        const departmentEntry = item.departmentEntries.get(departmentDepid);
        if (!departmentEntry.name && departmentName) departmentEntry.name = departmentName;
        if (statusName) departmentEntry.statusNames.add(statusName);
      }
    });

    const registries = Array.from(grouped.values()).map((item) => ({
      registryId: item.registryId,
      fileName: item.fileName,
      typeName: item.typeName,
      claimantKeys: Array.from(item.claimantKeys).sort((left, right) => left.localeCompare(right, 'ru')),
      statusNames: Array.from(item.statusNames).sort((left, right) => left.localeCompare(right, 'ru')),
      departmentNames: Array.from(item.departmentNames).sort((left, right) => left.localeCompare(right, 'ru')),
      departmentEntries: Array.from(item.departmentEntries.values()).map((entry) => ({
        depid: entry.depid,
        name: entry.name,
        statusNames: Array.from(entry.statusNames).sort((left, right) => left.localeCompare(right, 'ru'))
      }))
    })).sort((left, right) => {
      const leftClaimant = left.claimantKeys[0] || '';
      const rightClaimant = right.claimantKeys[0] || '';
      return leftClaimant.localeCompare(rightClaimant, 'ru') ||
        left.typeName.localeCompare(right.typeName, 'ru') ||
        left.fileName.localeCompare(right.fileName, 'ru');
    });

    return {
      checkedAt: Date.now(),
      departmentCount: Math.max(0, Number(departmentCount) || 0),
      registries
    };
  }

  function getEpguClaimantRegistries(cacheResult, claimantName) {
    const claimantKey = normalizeEpguRegistryStatusKey(canonicalizeEpguRegistryClaimant(claimantName));
    const registries = cacheResult && Array.isArray(cacheResult.registries)
      ? cacheResult.registries
      : [];
    return registries.filter((registry) => {
      const keys = Array.isArray(registry && registry.claimantKeys) ? registry.claimantKeys : [];
      return claimantKey && keys.some((key) => (
        normalizeEpguRegistryStatusKey(canonicalizeEpguRegistryClaimant(key)) === claimantKey
      ));
    });
  }

  function resolveEpguRegistrySummaryMeta(registries, hasCheckResult) {
    if (!hasCheckResult) {
      return { label: 'Реестры не проверены', color: '#E7E6E6', count: 0, checked: false };
    }
    const source = Array.isArray(registries) ? registries : [];
    if (!source.length) {
      return { label: 'Реестры не созданы', color: EPGU_REQUESTS_COLOR_RED, count: 0, checked: true };
    }

    const positiveStatuses = new Set([
      'проведен',
      'проведено',
      'проведен (нет данных)',
      'проведено (нет данных)'
    ]);
    const pendingStatuses = new Set(['не проведен', 'не проведено']);
    let hasPending = false;
    let hasError = false;

    source.forEach((registry) => {
      const statuses = Array.isArray(registry && registry.statusNames) && registry.statusNames.length
        ? registry.statusNames
        : [''];
      statuses.forEach((statusName) => {
        const key = normalizeEpguRegistryStatusKey(statusName);
        if (pendingStatuses.has(key)) hasPending = true;
        else if (!positiveStatuses.has(key)) hasError = true;
      });
    });

    if (hasPending && hasError) {
      return { label: 'Идет проведение, есть ошибки', color: EPGU_REQUESTS_COLOR_YELLOW, count: source.length, checked: true };
    }
    if (hasPending) {
      return { label: 'Идет проведение', color: EPGU_REQUESTS_COLOR_YELLOW, count: source.length, checked: true };
    }
    if (hasError) {
      return { label: 'Ошибки при проведении', color: EPGU_REQUESTS_COLOR_RED, count: source.length, checked: true };
    }
    return { label: 'Реестры проведены', color: EPGU_REQUESTS_COLOR_GREEN, count: source.length, checked: true };
  }

  function formatEpguRegistryCount(count) {
    const value = Math.max(0, Number(count) || 0);
    const mod100 = value % 100;
    const mod10 = value % 10;
    const noun = mod100 >= 11 && mod100 <= 14
      ? 'реестров'
      : mod10 === 1
        ? 'реестр'
        : mod10 >= 2 && mod10 <= 4
          ? 'реестра'
          : 'реестров';
    return `${value} ${noun}`;
  }

  function resolveEpguRegistryRowStatusMeta(statusName) {
    const key = normalizeEpguRegistryStatusKey(statusName);
    if (isPositiveEpguRegistryStatusName(key)) {
      return { className: 'is-positive', color: EPGU_REQUESTS_COLOR_GREEN };
    }
    if (key === 'не проведен' || key === 'не проведено') {
      return { className: 'is-pending', color: EPGU_REQUESTS_COLOR_YELLOW };
    }
    return { className: 'is-error', color: EPGU_REQUESTS_COLOR_RED };
  }

  function isPositiveEpguRegistryStatusName(statusName) {
    const key = normalizeEpguRegistryStatusKey(statusName);
    return [
      'проведен',
      'проведено',
      'проведен (нет данных)',
      'проведено (нет данных)'
    ].includes(key);
  }

  function getEpguRegistryDepartmentsForRecheck(scanContext, cacheResult, claimantNames = []) {
    const registries = cacheResult && Array.isArray(cacheResult.registries)
      ? cacheResult.registries
      : [];
    if (!registries.length) return scanContext.departments.slice();

    const currentClaimants = Array.from(new Set(
      (Array.isArray(claimantNames) ? claimantNames : [])
        .map((claimantName) => normalizeEpguRegistryText(claimantName))
        .filter(Boolean)
    ));
    if (currentClaimants.some((claimantName) => (
      getEpguClaimantRegistries(cacheResult, claimantName).length < 1
    ))) {
      return scanContext.departments.slice();
    }

    return scanContext.departments.filter((department) => {
      const depid = normalizeEpguRegistryText(department && department.depid);
      const departmentEntries = registries.flatMap((registry) => (
        Array.isArray(registry && registry.departmentEntries)
          ? registry.departmentEntries.filter((entry) => normalizeEpguRegistryText(entry && entry.depid) === depid)
          : []
      ));
      if (!departmentEntries.length) return true;
      const statuses = departmentEntries.flatMap((entry) => (
        Array.isArray(entry && entry.statusNames) ? entry.statusNames : []
      ));
      return !statuses.length || statuses.some((statusName) => !isPositiveEpguRegistryStatusName(statusName));
    });
  }

  function mergeEpguRegistryScanRows(previousResult, refreshedRows, scannedDepids, departmentCount) {
    const scanned = new Set((Array.isArray(scannedDepids) ? scannedDepids : []).map((value) => String(value || '')));
    const preservedRows = [];
    const previousRegistries = previousResult && Array.isArray(previousResult.registries)
      ? previousResult.registries
      : [];

    previousRegistries.forEach((registry) => {
      const claimantKeys = Array.isArray(registry && registry.claimantKeys) && registry.claimantKeys.length
        ? registry.claimantKeys
        : [''];
      const departmentEntries = Array.isArray(registry && registry.departmentEntries)
        ? registry.departmentEntries
        : [];
      departmentEntries.forEach((entry) => {
        const depid = normalizeEpguRegistryText(entry && entry.depid);
        if (!depid || scanned.has(depid)) return;
        const statuses = Array.isArray(entry.statusNames) && entry.statusNames.length
          ? entry.statusNames
          : [''];
        claimantKeys.forEach((claimantName) => {
          statuses.forEach((statusName) => {
            preservedRows.push({
              registryId: registry.registryId || '',
              fileName: registry.fileName || '',
              typeName: registry.typeName || '',
              claimantName,
              statusName,
              department: entry.name || '',
              depid
            });
          });
        });
      });
    });

    return aggregateEpguRegistryScanRows(
      [...preservedRows, ...(Array.isArray(refreshedRows) ? refreshedRows : [])],
      departmentCount
    );
  }

  function buildEpguRegistryConductPageUrl(switchUrl) {
    try {
      const target = new URL(String(switchUrl || ''), window.location.origin);
      const match = String(target.pathname || '').match(/^(.*?\/login\/department\/\d+)(?:\/.*)?$/i);
      if (!match) return '';
      target.pathname = `${match[1]}/ovzid/fsspreestr`;
      target.search = '';
      target.hash = '';
      return target.toString();
    } catch (error) {
      return '';
    }
  }

  function resolveEpguRegistryConductTarget(registry) {
    const scanContext = collectEpguRegistryScanContext(getEpguSummarySelectedDateKey());
    if (!scanContext) return null;

    const visibleDepartments = new Map(
      scanContext.departments.map((department) => [String(department.depid || ''), department])
    );
    const registryEntries = Array.isArray(registry && registry.departmentEntries)
      ? registry.departmentEntries
      : [];

    for (const entry of registryEntries) {
      const department = visibleDepartments.get(String(entry && entry.depid || ''));
      if (!department) continue;
      const targetUrl = buildEpguRegistryConductPageUrl(department.switchUrl);
      if (!targetUrl) continue;
      return {
        scanContext,
        department,
        targetUrl,
        expectedStatusNames: Array.isArray(entry.statusNames) ? entry.statusNames.slice() : []
      };
    }

    const departmentNames = Array.isArray(registry && registry.departmentNames)
      ? registry.departmentNames.map(normalizeEpguRegistryText)
      : [];
    for (const departmentName of departmentNames) {
      const department = scanContext.departments.find((item) => (
        normalizeEpguRegistryStatusKey(item.label) === normalizeEpguRegistryStatusKey(departmentName)
      ));
      if (!department) continue;
      const targetUrl = buildEpguRegistryConductPageUrl(department.switchUrl);
      if (!targetUrl) continue;
      return {
        scanContext,
        department,
        targetUrl,
        expectedStatusNames: Array.isArray(registry && registry.statusNames)
          ? registry.statusNames.slice()
          : []
      };
    }
    return null;
  }

  async function updateEpguRegistryStatusAfterConduct(registry, response, dateKey) {
    const cacheResult = getEpguRegistryCheckResultForCurrentBase(dateKey);
    const registries = cacheResult && Array.isArray(cacheResult.registries)
      ? cacheResult.registries
      : [];
    const registryId = normalizeEpguRegistryText(registry && registry.registryId);
    const fileName = normalizeEpguRegistryText(registry && registry.fileName);
    const typeName = normalizeEpguRegistryText(registry && registry.typeName);
    const targetRegistry = registries.find((item) => (
      (registryId && normalizeEpguRegistryText(item && item.registryId) === registryId) ||
      (!registryId &&
        normalizeEpguRegistryText(item && item.fileName) === fileName &&
        normalizeEpguRegistryText(item && item.typeName) === typeName)
    ));
    if (!targetRegistry) throw new Error('Проведённый реестр не найден в сохранённой проверке. Запустите проверку ещё раз.');

    const statusName = normalizeEpguRegistryText(response && response.statusName);
    const departmentDepid = normalizeEpguRegistryText(response && response.depid);
    const departmentName = normalizeEpguRegistryText(response && response.department);
    if (!statusName) throw new Error('Пирамида не вернула новый статус реестра.');

    const departmentEntries = Array.isArray(targetRegistry.departmentEntries)
      ? targetRegistry.departmentEntries.map((entry) => ({
          depid: normalizeEpguRegistryText(entry && entry.depid),
          name: normalizeEpguRegistryText(entry && entry.name),
          statusNames: Array.isArray(entry && entry.statusNames)
            ? entry.statusNames.map(normalizeEpguRegistryText).filter(Boolean)
            : []
        }))
      : [];
    const departmentEntry = departmentEntries.find((entry) => entry.depid === departmentDepid);
    if (departmentEntry) {
      departmentEntry.statusNames = [statusName];
      if (!departmentEntry.name && departmentName) departmentEntry.name = departmentName;
    } else if (departmentDepid) {
      departmentEntries.push({ depid: departmentDepid, name: departmentName, statusNames: [statusName] });
    }

    targetRegistry.departmentEntries = departmentEntries;
    targetRegistry.statusNames = departmentEntries.length
      ? Array.from(new Set(departmentEntries.flatMap((entry) => entry.statusNames))).sort((left, right) => left.localeCompare(right, 'ru'))
      : [statusName];
    if (departmentName) {
      targetRegistry.departmentNames = Array.from(new Set([
        ...(Array.isArray(targetRegistry.departmentNames) ? targetRegistry.departmentNames : []),
        departmentName
      ])).sort((left, right) => left.localeCompare(right, 'ru'));
    }
    cacheResult.updatedAt = Date.now();
    if (!await saveEpguRegistryCheckResultForCurrentBase(cacheResult, dateKey)) {
      throw new Error('Не удалось сохранить новый статус реестра в браузере.');
    }
  }

  async function startEpguRegistryConduct(modal, registry) {
    if (!(modal instanceof HTMLElement) || epguRegistryCheckRunning || epguRegistryConductingKey) return;
    const conductTarget = resolveEpguRegistryConductTarget(registry);
    if (!conductTarget) {
      epguRegistryCheckNotice = 'Не удалось выбрать нескрытый департамент реестра. Запустите проверку формирования ещё раз.';
      epguRegistryCheckNoticeIsError = true;
      renderEpguRegistryCheckControls(modal);
      return;
    }

    const registryId = normalizeEpguRegistryText(registry && registry.registryId);
    epguRegistryConductingKey = registryId || `${registry.fileName || ''}|${registry.typeName || ''}`;
    epguRegistryCheckNotice = `Проводим реестр ${registryId || registry.fileName || ''} в департаменте «${conductTarget.department.label}»…`;
    epguRegistryCheckNoticeIsError = false;
    renderEpguDatabaseSwitcher(modal);
    renderEpguRegistryCheckControls(modal);

    try {
      const response = await sendRuntimeMessage({
        action: 'EPGU_REGISTRY_CONDUCT_START',
        data: {
          baseHost: conductTarget.scanContext.baseHost,
          checkDate: conductTarget.scanContext.checkDate,
          restoreDepid: conductTarget.scanContext.restoreDepid,
          restoreUrl: conductTarget.scanContext.restoreUrl,
          targetDepid: conductTarget.department.depid,
          targetDepartment: conductTarget.department.label,
          targetUrl: conductTarget.targetUrl,
          registryId,
          fileName: registry.fileName || '',
          typeName: registry.typeName || '',
          expectedStatusNames: conductTarget.expectedStatusNames
        }
      });
      if (!response || response.success !== true) {
        throw new Error(response && response.error ? response.error : 'Не удалось провести реестр.');
      }
      if (getEpguSummarySelectedDateKey() !== conductTarget.scanContext.checkDateKey) {
        throw new Error('Во время проведения изменилась выбранная дата. Запустите проверку формирования ещё раз.');
      }

      await updateEpguRegistryStatusAfterConduct(registry, {
        ...response,
        depid: conductTarget.department.depid,
        department: conductTarget.department.label
      }, conductTarget.scanContext.checkDateKey);
      epguRegistryCheckNotice = `${response.message || `Реестр ${registryId} проведён`}. Новый статус: ${response.statusName}.`;
      epguRegistryCheckNoticeIsError = false;
    } catch (error) {
      epguRegistryCheckNotice = error && error.message ? error.message : 'Не удалось провести реестр.';
      epguRegistryCheckNoticeIsError = true;
    } finally {
      epguRegistryConductingKey = '';
      renderEpguDatabaseSwitcher(modal);
      renderEpguSummaryModal(modal);
    }
  }

  function createEpguRegistryDetails(registries, claimantName) {
    const details = document.createElement('div');
    details.className = 'dup-epgu-registry-details';
    details.hidden = true;

    const source = Array.isArray(registries) ? registries : [];
    if (!source.length) {
      const empty = document.createElement('div');
      empty.className = 'dup-epgu-registry-empty';
      empty.textContent = `За сегодня реестры взыскателя «${claimantName}» не найдены.`;
      details.appendChild(empty);
      return details;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'dup-epgu-registry-table-wrap';
    const table = document.createElement('table');
    table.className = 'dup-epgu-registry-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Статус', 'Департамент', 'Тип реестра', 'Имя файла', ''].forEach((label, index) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      if (index === 1) cell.className = 'dup-epgu-registry-department';
      if (index === 4) {
        cell.className = 'dup-epgu-registry-action-cell';
        cell.setAttribute('aria-label', 'Проведение реестра');
      }
      headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement('tbody');
    source.forEach((registry) => {
      const row = document.createElement('tr');
      const statusCell = document.createElement('td');
      statusCell.className = 'dup-epgu-registry-status-cell';
      const statuses = Array.isArray(registry.statusNames) && registry.statusNames.length
        ? registry.statusNames
        : ['Статус не указан'];
      statuses.forEach((statusName) => {
        const statusMeta = resolveEpguRegistryRowStatusMeta(statusName);
        const badge = createEpguSummaryBadge(
          statusName,
          `dup-epgu-registry-status-chip ${statusMeta.className}`,
          statusMeta.color
        );
        statusCell.appendChild(badge);
      });

      const departmentCell = document.createElement('td');
      const departmentNames = Array.isArray(registry.departmentNames)
        ? registry.departmentNames.filter(Boolean)
        : [];
      departmentCell.className = 'dup-epgu-registry-department';
      departmentCell.textContent = departmentNames.join(', ');
      departmentCell.title = departmentNames.join('\n');

      const typeCell = document.createElement('td');
      typeCell.textContent = registry.typeName || '';

      const fileCell = document.createElement('td');
      fileCell.className = 'dup-epgu-registry-file-name';
      fileCell.textContent = registry.fileName || '';
      fileCell.title = registry.fileName
        ? 'Нажмите правой кнопкой мыши, чтобы скопировать имя файла'
        : '';
      fileCell.addEventListener('contextmenu', (event) => {
        if (!registry.fileName) return;
        event.preventDefault();
        event.stopPropagation();
        void writeStageJumpPlainTextToClipboardFallback(registry.fileName).catch(() => (
          writePlainTextToClipboard(registry.fileName)
        )).then(() => {
          showSuccessFeedback(fileCell);
        }).catch(() => {});
      });

      const actionCell = document.createElement('td');
      actionCell.className = 'dup-epgu-registry-action-cell';
      const conductButton = document.createElement('button');
      conductButton.type = 'button';
      conductButton.className = 'dup-epgu-registry-conduct-button';
      conductButton.title = 'Провести реестр';
      conductButton.setAttribute('aria-label', `Провести реестр ${registry.registryId || registry.fileName || ''}`);
      conductButton.dataset.registryKey = normalizeEpguRegistryText(registry.registryId) || `${registry.fileName || ''}|${registry.typeName || ''}`;
      conductButton.disabled = epguRegistryCheckRunning || !!epguRegistryConductingKey;
      const icon = document.createElement('span');
      icon.className = 'fa fa-play';
      icon.setAttribute('aria-hidden', 'true');
      conductButton.appendChild(icon);
      conductButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const modal = document.getElementById(EPGU_REQUESTS_SUMMARY_MODAL_ID);
        if (modal instanceof HTMLElement) void startEpguRegistryConduct(modal, registry);
      });
      actionCell.appendChild(conductButton);

      row.append(statusCell, departmentCell, typeCell, fileCell, actionCell);
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    details.appendChild(tableWrap);
    return details;
  }

  function collectEpguSummaryItems(dateKey = getEpguSummarySelectedDateKey()) {
    const selectedDateKey = normalizeEpguSummarySelectedDateKey(dateKey);
    const rows = epguSummaryRowsByDate.get(selectedDateKey) || [];
    const groups = new Map();

    rows.forEach((row, rowIndex) => {
      const claimantIdentity = parseEpguClaimantIdentity(row && row.claimant);
      const claimantKey = claimantIdentity.claimantKey;
      const dateInfo = parseEpguCreateDateInfo(row && row.createDate);
      if (!claimantKey || !claimantIdentity.claimantComparisonKey || dateInfo.dayKey !== selectedDateKey) return;

      const statusText = normalizeEpguRequestsCellText(row && row.statusName);
      const messageText = normalizeEpguRequestsCellText(row && row.message);
      const entry = {
        rowIndex,
        claimantKey,
        claimantComparisonKey: claimantIdentity.claimantComparisonKey,
        claimantText: claimantIdentity.fullText,
        personName: claimantIdentity.personName,
        personComparisonKey: claimantIdentity.personComparisonKey,
        pairComparisonKey: claimantIdentity.pairComparisonKey,
        dateInfo,
        statusMeta: resolveEpguStatusMeta(statusText),
        messageText
      };

      if (!groups.has(claimantIdentity.claimantComparisonKey)) {
        groups.set(claimantIdentity.claimantComparisonKey, {
          claimantKey,
          claimantComparisonKey: claimantIdentity.claimantComparisonKey,
          count: 0,
          bestEntry: null,
          entries: [],
          usedPersonNames: [],
          usedPairKeys: new Set()
        });
      }

      const group = groups.get(claimantIdentity.claimantComparisonKey);
      group.count += 1;
      group.entries.push(entry);
      if (entry.personName && entry.pairComparisonKey && !group.usedPairKeys.has(entry.pairComparisonKey)) {
        group.usedPairKeys.add(entry.pairComparisonKey);
        group.usedPersonNames.push(entry.personName);
      }
      if (isEpguEntryBetter(entry, group.bestEntry)) {
        group.bestEntry = entry;
      }
    });

    const items = Array.from(groups.values()).filter((item) => item && item.bestEntry);
    items.forEach((item) => {
      item.entries.sort((left, right) => {
        if ((right.dateInfo.sortKey || '') !== (left.dateInfo.sortKey || '')) {
          return String(right.dateInfo.sortKey || '').localeCompare(String(left.dateInfo.sortKey || ''));
        }
        return (left.rowIndex || 0) - (right.rowIndex || 0);
      });
    });
    items.sort((left, right) => {
      const rightRank = right.bestEntry && right.bestEntry.statusMeta ? Number(right.bestEntry.statusMeta.rank || 0) : 0;
      const leftRank = left.bestEntry && left.bestEntry.statusMeta ? Number(left.bestEntry.statusMeta.rank || 0) : 0;
      if (rightRank !== leftRank) return rightRank - leftRank;
      return String(left.claimantKey || '').localeCompare(String(right.claimantKey || ''), 'ru');
    });

    return {
      todayDateKey: selectedDateKey,
      selectedDateKey,
      items
    };
  }

  function collectEpguRetryTargets(summary) {
    const sourceItems = summary && Array.isArray(summary.items) ? summary.items : [];
    return sourceItems.filter((item) => {
      return item && item.bestEntry && item.bestEntry.statusMeta && item.bestEntry.statusMeta.rank !== 4;
    }).map((item) => ({
      claimantKey: item.claimantKey,
      claimantComparisonKey: item.claimantComparisonKey,
      count: item.count,
      statusLabel: item.bestEntry.statusMeta.label,
      statusColor: item.bestEntry.statusMeta.color,
      messageText: item.bestEntry.messageText,
      usedPersonNames: Array.isArray(item.usedPersonNames) ? item.usedPersonNames.slice() : [],
      usedPairKeys: item.usedPairKeys instanceof Set ? new Set(item.usedPairKeys) : new Set(),
      requestPairSequence: Array.isArray(item.entries)
        ? item.entries.slice().sort((left, right) => {
            const leftSortKey = String(left && left.dateInfo && left.dateInfo.sortKey || '');
            const rightSortKey = String(right && right.dateInfo && right.dateInfo.sortKey || '');
            if (leftSortKey !== rightSortKey) return leftSortKey.localeCompare(rightSortKey);
            return Number(right && right.rowIndex || 0) - Number(left && left.rowIndex || 0);
          }).map((entry) => String(entry && entry.pairComparisonKey || '')).filter(Boolean)
        : []
    }));
  }

  function normalizeEpguRetryExcludedClaimants(value) {
    const source = Array.isArray(value) ? value : [];
    return Array.from(new Set(source
      .map((item) => normalizeEpguComparisonKey(item))
      .filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, 'ru'));
  }

  async function readEpguRetryExcludedClaimants() {
    const stored = await chromeStorageGet([EPGU_REQUESTS_RETRY_EXCLUSIONS_STORAGE_KEY]);
    return new Set(normalizeEpguRetryExcludedClaimants(
      stored && stored[EPGU_REQUESTS_RETRY_EXCLUSIONS_STORAGE_KEY]
    ));
  }

  function waitEpguRetryDelay(delayMs) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(delayMs) || 0)));
  }

  function createEpguRetryError(code, message) {
    const error = new Error(String(message || code || 'Ошибка отправки ЕПГУ.'));
    error.code = String(code || 'EPGU_RETRY_ERROR');
    return error;
  }

  async function waitForEpguRetryCondition(predicate, timeoutMs, timeoutMessage) {
    const startedAt = Date.now();
    const timeout = Math.max(1000, Number(timeoutMs) || 1000);

    while (Date.now() - startedAt < timeout) {
      try {
        const result = predicate();
        if (result) return result;
      } catch (error) {
        // Системный iframe может кратковременно менять document во время навигации.
      }
      await waitEpguRetryDelay(180);
    }

    throw createEpguRetryError('EPGU_RETRY_TIMEOUT', timeoutMessage);
  }

  function getEpguCreateRequestFrames() {
    return Array.from(document.querySelectorAll('iframe')).filter((frame) => {
      if (!(frame instanceof HTMLIFrameElement)) return false;
      const source = String(frame.getAttribute('src') || frame.src || '').toLowerCase();
      return source.includes(EPGU_REQUESTS_FORM_PATH_PART);
    });
  }

  function isEpguCreateRequestFrameVisible(frame) {
    if (!(frame instanceof HTMLIFrameElement) || !frame.isConnected) return false;
    const dialog = frame.closest('.ui-dialog');
    if (!(dialog instanceof HTMLElement)) return true;
    const style = window.getComputedStyle(dialog);
    return !dialog.hidden && dialog.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function getEpguCreateRequestFrame() {
    const frames = getEpguCreateRequestFrames();
    return frames.slice().reverse().find(isEpguCreateRequestFrameVisible) || frames[frames.length - 1] || null;
  }

  function getEpguCreateRequestFormElements() {
    const frames = getEpguCreateRequestFrames().slice().reverse();

    for (const frame of frames) {
      if (!isEpguCreateRequestFrameVisible(frame)) continue;

      let frameDocument = null;
      try {
        frameDocument = frame.contentDocument;
      } catch (error) {
        continue;
      }
      if (!frameDocument || frameDocument.readyState !== 'complete') continue;

      const select = frameDocument.querySelector('#LegalPerson');
      const form = isEpguElementTag(select, 'select') ? select.closest('form') : null;
      const submitButton = form
        ? Array.from(form.querySelectorAll('button')).find((button) => {
            return normalizeEpguComparisonKey(button.textContent).includes('отправить запрос');
          })
        : null;

      if (!isEpguElementTag(select, 'select') || !isEpguElementTag(form, 'form') || !isEpguElementTag(submitButton, 'button')) {
        continue;
      }

      return {
        frame,
        document: frameDocument,
        form,
        select,
        submitButton
      };
    }

    return null;
  }

  function closeEpguCreateRequestDialog(targetFrame) {
    const frame = targetFrame instanceof HTMLIFrameElement ? targetFrame : getEpguCreateRequestFrame();
    if (!(frame instanceof HTMLIFrameElement)) return false;

    const dialog = frame.closest('.ui-dialog');
    if (!(dialog instanceof HTMLElement)) return false;

    const buttons = Array.from(dialog.querySelectorAll('button'));
    const closeButton = buttons.find((button) => {
      const text = normalizeEpguComparisonKey(button.textContent);
      const ariaLabel = normalizeEpguComparisonKey(button.getAttribute('aria-label'));
      return text === 'готово' || text === 'close' || ariaLabel === 'close' || ariaLabel === 'закрыть';
    });
    if (!(closeButton instanceof HTMLButtonElement)) return false;
    closeButton.click();
    return true;
  }

  async function openEpguCreateRequestForm() {
    const existing = getEpguCreateRequestFormElements();
    if (existing) return existing;

    const response = await sendRuntimeMessage({
      action: 'EPGU_OPEN_CREATE_REQUEST_FORM',
      data: { buttonId: EPGU_REQUESTS_CREATE_BUTTON_ID }
    });
    if (!response || response.success === false) {
      throw createEpguRetryError(
        'EPGU_CREATE_DIALOG_FAILED',
        `Не удалось открыть «Создать запрос»: ${response && response.error ? response.error : 'нет ответа фонового модуля'}.`
      );
    }

    return waitForEpguRetryCondition(
      getEpguCreateRequestFormElements,
      EPGU_REQUESTS_RETRY_FORM_TIMEOUT_MS,
      'Не дождались системной формы «Создать запрос».'
    );
  }

  function collectEpguRequestOptionsForTarget(select, target) {
    if (!isEpguElementTag(select, 'select') || !target) return [];
    return Array.from(select.options).map((option) => {
      const identity = parseEpguClaimantIdentity(option.textContent);
      if (
        !identity.claimantComparisonKey ||
        identity.claimantComparisonKey !== target.claimantComparisonKey ||
        !identity.personName ||
        !identity.pairComparisonKey
      ) {
        return null;
      }
      return {
        option,
        value: option.value,
        claimantKey: identity.claimantKey,
        claimantComparisonKey: identity.claimantComparisonKey,
        personName: identity.personName,
        pairComparisonKey: identity.pairComparisonKey,
        fullText: identity.fullText
      };
    }).filter(Boolean);
  }

  function resolveEpguCurrentCycleUsedPairKeys(target, candidates, usedPairKeys) {
    const availablePairKeys = new Set((Array.isArray(candidates) ? candidates : [])
      .map((candidate) => String(candidate && candidate.pairComparisonKey || ''))
      .filter(Boolean));
    if (!target || !target.claimantComparisonKey || !availablePairKeys.size) return new Set();

    const pairPrefix = `${target.claimantComparisonKey}\u241f`;
    const runtimeUsed = usedPairKeys instanceof Set ? usedPairKeys : new Set();
    const originalGridUsed = target.usedPairKeys instanceof Set ? target.usedPairKeys : new Set();
    const runtimeTargetPairs = new Set(Array.from(runtimeUsed).filter((pairKey) => (
      String(pairKey || '').startsWith(pairPrefix) && availablePairKeys.has(pairKey)
    )));
    const wasExplicitlyReset = originalGridUsed.size > 0 &&
      !Array.from(originalGridUsed).some((pairKey) => runtimeUsed.has(pairKey));

    if (wasExplicitlyReset) return runtimeTargetPairs;

    const currentCycleUsed = new Set();
    const sequence = Array.isArray(target.requestPairSequence) ? target.requestPairSequence : [];
    sequence.forEach((pairKey) => {
      if (!availablePairKeys.has(pairKey)) return;
      if (currentCycleUsed.size >= availablePairKeys.size) currentCycleUsed.clear();
      currentCycleUsed.add(pairKey);
    });

    runtimeTargetPairs.forEach((pairKey) => {
      if (!originalGridUsed.has(pairKey)) currentCycleUsed.add(pairKey);
    });
    return currentCycleUsed;
  }

  function findEpguUnusedRequestOption(select, target, usedPairKeys) {
    const candidates = collectEpguRequestOptionsForTarget(select, target);
    const used = resolveEpguCurrentCycleUsedPairKeys(target, candidates, usedPairKeys);

    for (const candidate of candidates) {
      if (used.has(candidate.pairComparisonKey)) continue;
      return candidate;
    }

    return null;
  }

  function getEpguRetryResponseText(frameDocument, selector) {
    if (!frameDocument) return '';
    const element = frameDocument.querySelector(selector);
    return element ? normalizeEpguRequestsCellText(element.textContent) : '';
  }

  async function waitForEpguRetryRequestResult(frame) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < EPGU_REQUESTS_RETRY_RESULT_TIMEOUT_MS) {
      if (!(frame instanceof HTMLIFrameElement) || !frame.isConnected) {
        throw createEpguRetryError('EPGU_FORM_CLOSED', 'Системная форма закрылась до подтверждения результата.');
      }

      try {
        const frameDocument = frame.contentDocument;
        if (frameDocument) {
          const successText = getEpguRetryResponseText(frameDocument, '.alert-success');
          const bodyText = frameDocument.body
            ? normalizeEpguComparisonKey(frameDocument.body.textContent)
            : '';
          if (
            normalizeEpguComparisonKey(successText).includes(EPGU_REQUESTS_RETRY_SUCCESS_TEXT) ||
            bodyText.includes(EPGU_REQUESTS_RETRY_SUCCESS_TEXT)
          ) {
            return successText || 'Запрос успешно создан';
          }

          const errorText = getEpguRetryResponseText(
            frameDocument,
            '.alert-danger, .alert-warning, .validation-summary-errors, .field-validation-error'
          );
          if (errorText) {
            throw createEpguRetryError('EPGU_REQUEST_REJECTED', errorText);
          }
        }
      } catch (error) {
        if (error && error.code) throw error;
      }

      await waitEpguRetryDelay(220);
    }

    throw createEpguRetryError('EPGU_RESULT_TIMEOUT', 'Не дождались сообщения «Запрос успешно создан».');
  }

  async function sendEpguRetryRequestForTarget(target, usedPairKeys) {
    let formElements = null;
    try {
      formElements = await openEpguCreateRequestForm();
      const candidate = findEpguUnusedRequestOption(formElements.select, target, usedPairKeys);
      if (!candidate) {
        throw createEpguRetryError(
          'EPGU_NO_UNUSED_PERSON',
          `Для взыскателя «${target.claimantKey}» не осталось ФИО, которых ещё нет в сегодняшнем гриде.`
        );
      }

      formElements.document.querySelectorAll('.alert-success, .alert-danger, .alert-warning')
        .forEach((element) => element.remove());
      formElements.select.value = candidate.value;
      formElements.select.dispatchEvent(new Event('input', { bubbles: true }));
      formElements.select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitEpguRetryDelay(140);

      if (formElements.select.value !== candidate.value) {
        throw createEpguRetryError(
          'EPGU_OPTION_NOT_SELECTED',
          `Системный список не принял выбор «${candidate.fullText}».`
        );
      }

      formElements.submitButton.click();
      await waitForEpguRetryRequestResult(formElements.frame);
      return candidate;
    } finally {
      closeEpguCreateRequestDialog(formElements && formElements.frame);
    }
  }

  function getEpguRetryModalState(modal) {
    return modal && modal.__dupEpguRetryState && typeof modal.__dupEpguRetryState === 'object'
      ? modal.__dupEpguRetryState
      : null;
  }

  function getEpguRetryTargetRow(modal, claimantComparisonKey) {
    return Array.from(modal.querySelectorAll('.dup-epgu-retry-item')).find((row) => {
      return row instanceof HTMLElement && row.dataset.claimantKey === claimantComparisonKey;
    }) || null;
  }

  function updateEpguRetrySelectionCount(modal) {
    const state = getEpguRetryModalState(modal);
    if (!state) return;
    const checkboxes = Array.from(modal.querySelectorAll('.dup-epgu-retry-checkbox'));
    const selectedCount = checkboxes.filter((checkbox) => checkbox instanceof HTMLInputElement && checkbox.checked).length;
    const startButton = modal.querySelector('.dup-epgu-retry-start');
    const selectionMeta = modal.querySelector('.dup-epgu-retry-selection-meta');

    if (startButton instanceof HTMLButtonElement && !state.running) {
      startButton.disabled = selectedCount < 1;
      startButton.textContent = selectedCount
        ? `Отправить запросы (${selectedCount})`
        : 'Выберите взыскателей';
    }
    if (selectionMeta instanceof HTMLElement && !state.running) {
      selectionMeta.textContent = `Выбрано: ${selectedCount} из ${checkboxes.length}. Снятые галочки сохраняются.`;
    }
  }

  async function persistEpguRetrySelection(modal) {
    const state = getEpguRetryModalState(modal);
    if (!state) return false;

    const excluded = new Set(state.excludedClaimants);
    Array.from(modal.querySelectorAll('.dup-epgu-retry-checkbox')).forEach((checkbox) => {
      if (!(checkbox instanceof HTMLInputElement)) return;
      const key = normalizeEpguComparisonKey(checkbox.dataset.claimantKey);
      if (!key) return;
      if (checkbox.checked) excluded.delete(key);
      else excluded.add(key);
    });
    state.excludedClaimants = excluded;

    const saved = await chromeStorageSet({
      [EPGU_REQUESTS_RETRY_EXCLUSIONS_STORAGE_KEY]: Array.from(excluded)
        .sort((left, right) => left.localeCompare(right, 'ru'))
    });
    const notice = modal.querySelector('.dup-epgu-retry-notice');
    if (notice instanceof HTMLElement && !state.running) {
      notice.textContent = saved ? '' : 'Не удалось сохранить выбор. Проверьте состояние расширения.';
      notice.classList.toggle('is-error', !saved);
    }
    return saved;
  }

  function setEpguRetryTargetProgress(modal, target, status, message) {
    const row = getEpguRetryTargetRow(modal, target.claimantComparisonKey);
    if (!(row instanceof HTMLElement)) return;
    row.dataset.status = String(status || 'pending');
    const progress = row.querySelector('.dup-epgu-retry-progress');
    if (progress instanceof HTMLElement) {
      progress.hidden = false;
      progress.textContent = String(message || '');
    }
  }

  function resetEpguUsedPairKeysForTarget(usedPairKeys, target) {
    if (!(usedPairKeys instanceof Set) || !target || !target.claimantComparisonKey) return;
    const prefix = `${target.claimantComparisonKey}\u241f`;
    Array.from(usedPairKeys).forEach((pairKey) => {
      if (String(pairKey || '').startsWith(prefix)) usedPairKeys.delete(pairKey);
    });
  }

  function askEpguRestartClaimantNames(modal, target) {
    const prompt = modal instanceof HTMLElement
      ? modal.querySelector('.dup-epgu-retry-exhausted')
      : null;
    const message = prompt instanceof HTMLElement
      ? prompt.querySelector('.dup-epgu-retry-exhausted-message')
      : null;
    const yesButton = prompt instanceof HTMLElement
      ? prompt.querySelector('.dup-epgu-retry-exhausted-yes')
      : null;
    const noButton = prompt instanceof HTMLElement
      ? prompt.querySelector('.dup-epgu-retry-exhausted-no')
      : null;
    if (
      !(prompt instanceof HTMLElement) ||
      !(message instanceof HTMLElement) ||
      !(yesButton instanceof HTMLButtonElement) ||
      !(noButton instanceof HTMLButtonElement)
    ) {
      return Promise.resolve(false);
    }

    message.textContent = `Для взыскателя «${target.claimantKey}» ФИО закончились. Хотите начать заново с первого ФИО?`;
    prompt.hidden = false;
    yesButton.disabled = false;
    noButton.disabled = false;

    return new Promise((resolve) => {
      const finish = (restart) => {
        yesButton.removeEventListener('click', handleYes, true);
        noButton.removeEventListener('click', handleNo, true);
        prompt.hidden = true;
        resolve(restart);
      };
      const handleYes = () => finish(true);
      const handleNo = () => finish(false);
      yesButton.addEventListener('click', handleYes, { capture: true, once: true });
      noButton.addEventListener('click', handleNo, { capture: true, once: true });
      noButton.focus();
    });
  }

  function isEpguRequestsGridLoading() {
    const loading = document.getElementById('load_list');
    if (!(loading instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(loading);
    return !loading.hidden && style.display !== 'none' && style.visibility !== 'hidden';
  }

  async function refreshEpguRequestsGrid() {
    const refreshButton = document.getElementById('refresh_list');
    if (!(refreshButton instanceof HTMLElement)) return false;

    refreshButton.click();
    const startedAt = Date.now();
    const timeoutMs = 20000;
    let sawLoading = isEpguRequestsGridLoading();

    while (Date.now() - startedAt < timeoutMs) {
      await waitEpguRetryDelay(160);
      const isLoading = isEpguRequestsGridLoading();
      if (isLoading) sawLoading = true;
      if (!isLoading && (sawLoading || Date.now() - startedAt >= 900)) return true;
    }

    return false;
  }

  async function reloadEpguRequestsPageWithSummary() {
    const activeDatabase = getActiveEpguDatabase();
    if (activeDatabase) {
      await setEpguSummaryReopenPending({
        targetDepid: activeDatabase.depid,
        targetHost: activeDatabase.host,
        selectedDateKey: getEpguSummarySelectedDateKey(),
        createdAt: Date.now()
      });
    }
    window.location.reload();
  }

  async function returnEpguRetryToSummary(modal, reloadPage) {
    if (!(modal instanceof HTMLElement)) return;
    modal.hidden = true;

    if (reloadPage) {
      await reloadEpguRequestsPageWithSummary();
      return;
    }

    const summaryModal = createEpguSummaryModal();
    renderEpguSummaryModal(summaryModal);
    summaryModal.hidden = false;
  }

  function renderEpguRetrySelection(modal) {
    const state = getEpguRetryModalState(modal);
    if (!state) return;
    const list = modal.querySelector('.dup-epgu-retry-list');
    if (!(list instanceof HTMLElement)) return;
    list.textContent = '';

    state.targets.forEach((target, index) => {
      const row = document.createElement('label');
      row.className = 'dup-epgu-retry-item';
      row.dataset.claimantKey = target.claimantComparisonKey;
      row.dataset.status = 'pending';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'dup-epgu-retry-checkbox';
      checkbox.dataset.claimantKey = target.claimantComparisonKey;
      checkbox.checked = !state.excludedClaimants.has(target.claimantComparisonKey);

      const main = document.createElement('span');
      main.className = 'dup-epgu-retry-item-main';

      const headline = document.createElement('span');
      headline.className = 'dup-epgu-retry-headline';
      headline.textContent = `${index + 1}. ${target.claimantKey}`;

      const status = createEpguSummaryBadge(
        target.statusLabel,
        'dup-epgu-summary-status dup-epgu-retry-status',
        target.statusColor
      );
      headline.appendChild(status);
      main.appendChild(headline);

      const details = document.createElement('span');
      details.className = 'dup-epgu-retry-details';
      details.textContent = target.usedPersonNames.length
        ? `Сегодня использованы: ${target.usedPersonNames.join(', ')}`
        : 'За сегодня ФИО в гриде не определены.';
      main.appendChild(details);

      const progress = document.createElement('span');
      progress.className = 'dup-epgu-retry-progress';
      progress.hidden = true;
      main.appendChild(progress);

      row.append(checkbox, main);
      list.appendChild(row);
    });

    updateEpguRetrySelectionCount(modal);
  }

  async function startEpguRetryBatch(modal) {
    const state = getEpguRetryModalState(modal);
    if (!state || state.running || epguRetryBatchRunning) return;

    await persistEpguRetrySelection(modal);
    const selectedKeys = new Set(Array.from(modal.querySelectorAll('.dup-epgu-retry-checkbox'))
      .filter((checkbox) => checkbox instanceof HTMLInputElement && checkbox.checked)
      .map((checkbox) => checkbox.dataset.claimantKey));
    const selectedTargets = state.targets.filter((target) => selectedKeys.has(target.claimantComparisonKey));
    if (!selectedTargets.length) {
      updateEpguRetrySelectionCount(modal);
      return;
    }

    state.running = true;
    epguRetryBatchRunning = true;
    modal.dataset.running = 'true';
    modal.querySelectorAll('button, input').forEach((element) => {
      if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) element.disabled = true;
    });

    const title = modal.querySelector('.dup-execution-analysis-modal-title');
    const selectionMeta = modal.querySelector('.dup-epgu-retry-selection-meta');
    const notice = modal.querySelector('.dup-epgu-retry-notice');
    const exhaustedPrompt = modal.querySelector('.dup-epgu-retry-exhausted');
    const cancelButton = modal.querySelector('.dup-epgu-retry-cancel');
    const startButton = modal.querySelector('.dup-epgu-retry-start');
    const closeButton = modal.querySelector('.dup-execution-analysis-modal-close');
    if (title instanceof HTMLElement) title.textContent = 'Отправка запросов ЕПГУ';
    if (notice instanceof HTMLElement) {
      notice.textContent = 'Не закрывайте страницу: запросы отправляются строго по одному.';
      notice.classList.remove('is-error');
    }
    if (exhaustedPrompt instanceof HTMLElement) exhaustedPrompt.hidden = true;

    const usedPairKeys = new Set();
    state.summary.items.forEach((item) => {
      if (!(item && item.usedPairKeys instanceof Set)) return;
      item.usedPairKeys.forEach((key) => usedPairKeys.add(key));
    });

    const restartedClaimants = new Set();
    let successCount = 0;
    let skippedCount = 0;
    let failedTarget = null;
    let stoppedByChoice = false;

    for (let index = 0; index < selectedTargets.length; index += 1) {
      const target = selectedTargets[index];
      if (selectionMeta instanceof HTMLElement) {
        selectionMeta.textContent = `Шаг ${index + 1} из ${selectedTargets.length}: ${target.claimantKey}.`;
      }
      setEpguRetryTargetProgress(modal, target, 'running', 'Открываем системную форму и подбираем новое ФИО…');

      let targetFinished = false;
      while (!targetFinished) {
        try {
          const candidate = await sendEpguRetryRequestForTarget(target, usedPairKeys);
          usedPairKeys.add(candidate.pairComparisonKey);
          successCount += 1;
          setEpguRetryTargetProgress(modal, target, 'success', `Запрос создан: ${candidate.fullText}.`);
          targetFinished = true;
        } catch (error) {
          if (
            error &&
            error.code === 'EPGU_NO_UNUSED_PERSON' &&
            !restartedClaimants.has(target.claimantComparisonKey)
          ) {
            const restartNames = await askEpguRestartClaimantNames(modal, target);
            if (!restartNames) {
              skippedCount += 1;
              stoppedByChoice = true;
              setEpguRetryTargetProgress(
                modal,
                target,
                'skipped',
                'ФИО закончились. Повторный цикл не запущен.'
              );
              targetFinished = true;
              break;
            }

            restartedClaimants.add(target.claimantComparisonKey);
            resetEpguUsedPairKeysForTarget(usedPairKeys, target);
            setEpguRetryTargetProgress(
              modal,
              target,
              'running',
              'Учёт ФИО сброшен. Начинаем заново с первого ФИО…'
            );
            continue;
          }

          failedTarget = target;
          setEpguRetryTargetProgress(
            modal,
            target,
            'error',
            error && error.message ? error.message : 'Неизвестная ошибка отправки.'
          );
          targetFinished = true;
        }
      }

      if (failedTarget || stoppedByChoice) break;
    }

    state.running = false;
    epguRetryBatchRunning = false;
    modal.dataset.running = 'false';

    if (!failedTarget) {
      if (selectionMeta instanceof HTMLElement) {
        selectionMeta.textContent = stoppedByChoice
          ? `Остановлено пользователем. Успешно: ${successCount}, пропущено: ${skippedCount}.`
          : `Готово. Успешно: ${successCount}, пропущено: ${skippedCount}.`;
      }
      await returnEpguRetryToSummary(modal, successCount > 0);
      return;
    }

    if (successCount > 0) await refreshEpguRequestsGrid();
    if (selectionMeta instanceof HTMLElement) {
      selectionMeta.textContent = `Пакет остановлен на взыскателе «${failedTarget.claimantKey}». Успешно: ${successCount}, пропущено: ${skippedCount}.`;
    }
    if (notice instanceof HTMLElement) {
      notice.textContent = 'Следующие взыскатели не обрабатывались. Закройте окно, проверьте причину и запустите повторно.';
      notice.classList.add('is-error');
    }
    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.disabled = false;
      cancelButton.textContent = 'Закрыть';
    }
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.disabled = false;
    }
    if (startButton instanceof HTMLButtonElement) {
      startButton.hidden = true;
    }
  }

  function createEpguRetryModal() {
    const existing = document.getElementById(EPGU_REQUESTS_RETRY_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = EPGU_REQUESTS_RETRY_MODAL_ID;
    modal.className = 'dup-execution-analysis-modal dup-epgu-retry-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel dup-epgu-retry-panel" role="dialog" aria-modal="true" aria-label="Отправка запросов по неуспешным взыскателям">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Повторные запросы ЕПГУ</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <div class="dup-epgu-retry-intro">Оставьте отмеченными взыскателей, по которым нужно создать новый запрос. Для каждого будет выбрано первое ФИО, которого ещё нет в сегодняшнем гриде.</div>
        <div class="dup-epgu-retry-toolbar">
          <button type="button" class="dup-epgu-retry-select-all">Выбрать всех</button>
          <button type="button" class="dup-epgu-retry-select-none">Снять все</button>
        </div>
        <div class="dup-epgu-retry-selection-meta"></div>
        <div class="dup-epgu-retry-list" role="group" aria-label="Неуспешные взыскатели"></div>
        <div class="dup-epgu-retry-notice" aria-live="polite"></div>
        <div class="dup-epgu-retry-exhausted" role="alertdialog" aria-labelledby="dup-epgu-retry-exhausted-title" hidden>
          <div class="dup-epgu-retry-exhausted-mark" aria-hidden="true">↻</div>
          <div class="dup-epgu-retry-exhausted-content">
            <div id="dup-epgu-retry-exhausted-title" class="dup-epgu-retry-exhausted-title">ФИО закончились</div>
            <div class="dup-epgu-retry-exhausted-message"></div>
          </div>
          <div class="dup-epgu-retry-exhausted-actions">
            <button type="button" class="dup-epgu-retry-exhausted-no">Нет</button>
            <button type="button" class="dup-epgu-retry-exhausted-yes">Да</button>
          </div>
        </div>
        <div class="dup-execution-analysis-modal-actions dup-epgu-retry-actions">
          <button type="button" class="dup-epgu-retry-cancel">Отмена</button>
          <button type="button" class="dup-epgu-retry-start">Отправить запросы</button>
        </div>
      </div>
    `;

    const close = () => {
      const state = getEpguRetryModalState(modal);
      if (state && state.running) return;
      modal.hidden = true;
      const summaryModal = document.getElementById(EPGU_REQUESTS_SUMMARY_MODAL_ID);
      if (isEpguRequestsPage() && summaryModal instanceof HTMLElement) {
        renderEpguSummaryModal(summaryModal);
        summaryModal.hidden = false;
      }
    };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-epgu-retry-cancel')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-epgu-retry-select-all')?.addEventListener('click', () => {
      modal.querySelectorAll('.dup-epgu-retry-checkbox').forEach((checkbox) => {
        if (checkbox instanceof HTMLInputElement) checkbox.checked = true;
      });
      updateEpguRetrySelectionCount(modal);
      void persistEpguRetrySelection(modal);
    }, { capture: true });
    modal.querySelector('.dup-epgu-retry-select-none')?.addEventListener('click', () => {
      modal.querySelectorAll('.dup-epgu-retry-checkbox').forEach((checkbox) => {
        if (checkbox instanceof HTMLInputElement) checkbox.checked = false;
      });
      updateEpguRetrySelectionCount(modal);
      void persistEpguRetrySelection(modal);
    }, { capture: true });
    modal.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement) || !event.target.classList.contains('dup-epgu-retry-checkbox')) return;
      updateEpguRetrySelectionCount(modal);
      void persistEpguRetrySelection(modal);
    }, { capture: true });
    modal.querySelector('.dup-epgu-retry-start')?.addEventListener('click', () => {
      void startEpguRetryBatch(modal);
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  async function openEpguRetrySelectionModal() {
    if (!isEpguRequestsPage() || epguRetryBatchRunning) return;
    if (getEpguSummarySelectedDateKey() !== getEpguTodayDateKey() || !epguSummaryRowsLoaded) return;
    const summary = collectEpguSummaryItems();
    const targets = collectEpguRetryTargets(summary);
    if (!targets.length) return;

    const excludedClaimants = await readEpguRetryExcludedClaimants();
    const modal = createEpguRetryModal();
    modal.__dupEpguRetryState = {
      summary,
      targets,
      excludedClaimants,
      running: false
    };
    modal.dataset.running = 'false';

    const title = modal.querySelector('.dup-execution-analysis-modal-title');
    const notice = modal.querySelector('.dup-epgu-retry-notice');
    const exhaustedPrompt = modal.querySelector('.dup-epgu-retry-exhausted');
    const cancelButton = modal.querySelector('.dup-epgu-retry-cancel');
    const startButton = modal.querySelector('.dup-epgu-retry-start');
    modal.querySelectorAll('button, input').forEach((element) => {
      if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) element.disabled = false;
    });
    if (title instanceof HTMLElement) title.textContent = 'Повторные запросы ЕПГУ';
    if (notice instanceof HTMLElement) {
      notice.textContent = '';
      notice.classList.remove('is-error');
    }
    if (exhaustedPrompt instanceof HTMLElement) exhaustedPrompt.hidden = true;
    if (cancelButton instanceof HTMLButtonElement) cancelButton.textContent = 'Отмена';
    if (startButton instanceof HTMLButtonElement) startButton.hidden = false;

    renderEpguRetrySelection(modal);
    document.getElementById(EPGU_REQUESTS_SUMMARY_MODAL_ID)?.setAttribute('hidden', '');
    modal.hidden = false;
  }

  function getEpguDatabaseConfig(depid) {
    const normalizedDepid = String(depid || '').trim();
    return EPGU_REQUESTS_DATABASES.find((database) => database.depid === normalizedDepid) || null;
  }

  function findEpguDatabaseDepartmentLink(depid) {
    const normalizedDepid = String(depid || '').trim();
    return Array.from(document.querySelectorAll(SLOWSEARCH_CITIES_LINK_SELECTOR)).find((link) => (
      link instanceof HTMLAnchorElement && getDepartmentLinkDepid(link) === normalizedDepid
    )) || null;
  }

  function collectEpguRegistryScanContext(dateKey = getEpguSummarySelectedDateKey()) {
    const baseHost = normalizeDepartmentContainerHost(window.location.hostname);
    const entries = getDepartmentNavigationItems();
    const departments = [];
    const usedDepids = new Set();
    let restoreDepid = '';
    let restoreUrl = '';

    entries.forEach((entry) => {
      const link = entry && entry.link;
      if (!(link instanceof HTMLAnchorElement)) return;
      const depid = getDepartmentLinkDepid(link);
      const switchUrl = buildDepartmentNavigationUrl(link);
      const label = normalizeEpguRegistryText(getSmartValue(link));
      if (!depid || !switchUrl || !label || usedDepids.has(depid)) return;

      try {
        const targetUrl = new URL(switchUrl, window.location.origin);
        if (normalizeDepartmentContainerHost(targetUrl.hostname) !== baseHost) return;
      } catch (error) {
        return;
      }

      if (link.classList.contains('active')) {
        restoreDepid = depid;
        restoreUrl = switchUrl;
      }
      if (!isDepartmentNavigationItemVisible(entry, false)) return;

      usedDepids.add(depid);
      departments.push({ depid, label, switchUrl });
    });

    if (!restoreDepid || !restoreUrl || !departments.length) return null;
    const normalizedDateKey = normalizeEpguSummarySelectedDateKey(dateKey);
    return {
      baseHost,
      restoreDepid,
      restoreUrl,
      departments,
      checkDateKey: normalizedDateKey,
      checkDate: normalizedDateKey.replace(/-/g, '.')
    };
  }

  function getActiveEpguDatabase() {
    const currentHost = normalizeDepartmentContainerHost(window.location.hostname);
    return EPGU_REQUESTS_DATABASES.find((database) => database.host === currentHost) || null;
  }

  function setEpguSummaryReopenPending(value) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [EPGU_REQUESTS_SUMMARY_REOPEN_STORAGE_KEY]: value }, () => {
          const runtimeError = chrome.runtime.lastError;
          resolve(!runtimeError);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function clearEpguSummaryReopenPending() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(EPGU_REQUESTS_SUMMARY_REOPEN_STORAGE_KEY, () => {
          const runtimeError = chrome.runtime.lastError;
          resolve(!runtimeError);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function renderEpguDatabaseSwitcher(modal) {
    if (!(modal instanceof HTMLElement)) return;
    const switcher = modal.querySelector('.dup-epgu-database-switcher');
    const status = modal.querySelector('.dup-epgu-database-status');
    if (!(switcher instanceof HTMLElement)) return;

    const activeDatabase = getActiveEpguDatabase();
    const isSwitching = modal.dataset.databaseSwitching === 'true' || epguRegistryCheckRunning || !!epguRegistryConductingKey;

    switcher.querySelectorAll('.dup-epgu-database-button').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = !!activeDatabase && button.dataset.depid === activeDatabase.depid;
      button.classList.toggle('is-active', isActive);
      button.disabled = isSwitching || isActive;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (!isSwitching && status instanceof HTMLElement) {
      status.textContent = '';
      status.hidden = true;
      status.classList.remove('is-error');
    }
  }

  function renderEpguSummaryDateNavigator(modal) {
    if (!(modal instanceof HTMLElement)) return;
    const label = modal.querySelector('.dup-epgu-summary-date-label');
    const previousButton = modal.querySelector('.dup-epgu-summary-date-button.is-previous');
    const nextButton = modal.querySelector('.dup-epgu-summary-date-button.is-next');
    const selectedDateKey = getEpguSummarySelectedDateKey();
    const range = getEpguSummaryDateRange();
    const operationBusy = epguRegistryCheckRunning ||
      !!epguRegistryConductingKey ||
      modal.dataset.databaseSwitching === 'true';

    const renderButton = (button, dayDelta, boundaryDateKey) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const targetDateKey = shiftEpguDateKey(selectedDateKey, dayDelta);
      const atBoundary = selectedDateKey === boundaryDateKey;
      const targetAvailable = !atBoundary && isEpguSummaryDateAvailable(targetDateKey);
      const targetLoading = !operationBusy && !atBoundary && !targetAvailable && !!epguSummaryRowsLoadPromise;
      button.disabled = operationBusy || atBoundary || !targetAvailable;
      button.classList.toggle('is-loading', targetLoading);
      button.setAttribute('aria-busy', targetLoading ? 'true' : 'false');
      button.title = targetLoading ? 'Дата загружается' : '';
    };

    if (label instanceof HTMLElement) {
      label.textContent = formatEpguSummaryDateLabel(selectedDateKey);
      label.setAttribute('datetime', selectedDateKey.split('-').reverse().join('-'));
    }
    renderButton(previousButton, -1, range.minDateKey);
    renderButton(nextButton, 1, range.maxDateKey);
  }

  function renderEpguRegistryCheckControls(modal) {
    if (!(modal instanceof HTMLElement)) return;
    const status = modal.querySelector('.dup-epgu-registry-check-status');
    const scanButton = modal.querySelector('.dup-epgu-registry-check-button');
    const retryButton = modal.querySelector('.dup-epgu-summary-retry-button');
    const closeButton = modal.querySelector('.dup-execution-analysis-modal-close');
    const selectedDateKey = getEpguSummarySelectedDateKey();
    const cacheResult = getEpguRegistryCheckResultForCurrentBase(selectedDateKey);
    const operationBusy = epguRegistryCheckRunning || !!epguRegistryConductingKey;

    modal.dataset.registryScanning = epguRegistryCheckRunning ? 'true' : 'false';
    modal.dataset.registryConducting = epguRegistryConductingKey ? 'true' : 'false';
    modal.setAttribute('aria-busy', operationBusy ? 'true' : 'false');
    if (scanButton instanceof HTMLButtonElement) {
      scanButton.disabled = operationBusy || modal.dataset.databaseSwitching === 'true' || !isEpguSummaryDateComplete(selectedDateKey);
      if (epguRegistryCheckRunning && epguRegistryCheckProgress) {
        const current = Math.max(0, Number(epguRegistryCheckProgress.current) || 0);
        const total = Math.max(0, Number(epguRegistryCheckProgress.total) || 0);
        scanButton.textContent = epguRegistryCheckProgress.restoring
          ? 'Возвращаем департамент…'
          : `Проверка ${current}/${total}`;
      } else {
        scanButton.textContent = 'Проверить формирование реестров';
      }
    }
    if (retryButton instanceof HTMLButtonElement && operationBusy) retryButton.disabled = true;
    if (closeButton instanceof HTMLButtonElement) closeButton.disabled = operationBusy;

    modal.querySelectorAll('.dup-epgu-database-button').forEach((button) => {
      if (button instanceof HTMLButtonElement && operationBusy) button.disabled = true;
    });
    modal.querySelectorAll('.dup-epgu-summary-date-button').forEach((button) => {
      if (button instanceof HTMLButtonElement && operationBusy) button.disabled = true;
    });
    modal.querySelectorAll('.dup-epgu-registry-conduct-button').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = operationBusy;
      button.classList.toggle('is-running', !!epguRegistryConductingKey && button.dataset.registryKey === epguRegistryConductingKey);
    });

    if (!(status instanceof HTMLElement)) return;
    status.classList.toggle('is-error', epguRegistryCheckNoticeIsError);
    if (epguRegistryCheckRunning && epguRegistryCheckProgress) {
      const progress = epguRegistryCheckProgress;
      status.textContent = progress.restoring
        ? 'Проверка завершена. Возвращаем исходный департамент…'
        : `Проверено ${Math.max(0, Number(progress.current) || 0)} из ${Math.max(0, Number(progress.total) || 0)}. Сейчас: ${progress.department || 'подготовка'}.`;
      return;
    }
    if (epguRegistryCheckNotice) {
      status.textContent = epguRegistryCheckNotice;
      return;
    }
    if (cacheResult) {
      const checkedAt = Number(cacheResult.checkedAt || 0);
      const checkedLabel = checkedAt
        ? new Date(checkedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
        : formatEpguDateKeyForDisplay(selectedDateKey);
      status.textContent = `Реестры проверены ${checkedLabel}. Департаментов: ${Number(cacheResult.departmentCount || 0)}.`;
      return;
    }
    status.textContent = `Реестры за ${formatEpguDateKeyForDisplay(selectedDateKey)} ещё не проверялись.`;
  }

  async function startEpguRegistryCheck(modal) {
    if (!(modal instanceof HTMLElement) || epguRegistryCheckRunning || epguRegistryConductingKey) return;
    const scanContext = collectEpguRegistryScanContext();
    if (!scanContext) {
      epguRegistryCheckNotice = 'Не удалось определить полный список департаментов и исходный департамент.';
      epguRegistryCheckNoticeIsError = true;
      renderEpguRegistryCheckControls(modal);
      return;
    }
    if (!isEpguSummaryDateComplete(scanContext.checkDateKey)) return;
    const previousResult = getEpguRegistryCheckResultForCurrentBase(scanContext.checkDateKey);
    const currentSummary = collectEpguSummaryItems(scanContext.checkDateKey);
    const departmentsToCheck = getEpguRegistryDepartmentsForRecheck(
      scanContext,
      previousResult,
      currentSummary.items.map((item) => item.claimantKey)
    );
    if (!departmentsToCheck.length) {
      epguRegistryCheckNotice = 'Все ранее найденные реестры имеют положительные статусы. Повторная проверка не требуется.';
      epguRegistryCheckNoticeIsError = false;
      renderEpguRegistryCheckControls(modal);
      return;
    }

    epguRegistryCheckRunning = true;
    epguRegistryCheckNotice = '';
    epguRegistryCheckNoticeIsError = false;
    epguRegistryCheckProgress = {
      current: 0,
      total: departmentsToCheck.length,
      department: 'подготовка служебной вкладки'
    };
    renderEpguDatabaseSwitcher(modal);
    renderEpguRegistryCheckControls(modal);

    try {
      const response = await sendRuntimeMessage({
        action: 'EPGU_REGISTRY_SCAN_START',
        data: {
          baseHost: scanContext.baseHost,
          checkDate: scanContext.checkDate,
          restoreDepid: scanContext.restoreDepid,
          restoreUrl: scanContext.restoreUrl,
          departments: departmentsToCheck
        }
      });
      if (!response || response.success !== true || !Array.isArray(response.rows)) {
        throw new Error(response && response.error ? response.error : 'Проверка реестров не завершена.');
      }
      if (getEpguSummarySelectedDateKey() !== scanContext.checkDateKey) {
        throw new Error('Во время проверки изменилась выбранная дата. Запустите проверку ещё раз.');
      }

      const cacheResult = mergeEpguRegistryScanRows(
        previousResult,
        response.rows,
        departmentsToCheck.map((department) => department.depid),
        scanContext.departments.length
      );
      const saved = await saveEpguRegistryCheckResultForCurrentBase(cacheResult, scanContext.checkDateKey);
      if (!saved) throw new Error('Не удалось сохранить результат проверки в браузере.');
    } catch (error) {
      epguRegistryCheckNotice = error && error.message
        ? error.message
        : 'Не удалось проверить формирование реестров.';
      epguRegistryCheckNoticeIsError = true;
    } finally {
      epguRegistryCheckRunning = false;
      epguRegistryCheckProgress = null;
      renderEpguDatabaseSwitcher(modal);
      renderEpguSummaryModal(modal);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.action !== 'EPGU_REGISTRY_SCAN_PROGRESS') return false;
    epguRegistryCheckProgress = message.data && typeof message.data === 'object'
      ? message.data
      : null;
    const modal = document.getElementById(EPGU_REQUESTS_SUMMARY_MODAL_ID);
    if (modal instanceof HTMLElement) renderEpguRegistryCheckControls(modal);
    return false;
  });

  async function switchEpguRequestsDatabase(modal, depid) {
    if (!(modal instanceof HTMLElement) || modal.dataset.databaseSwitching === 'true') return false;
    const database = getEpguDatabaseConfig(depid);
    if (!database) return false;
    if (getActiveEpguDatabase() === database) return true;

    const status = modal.querySelector('.dup-epgu-database-status');
    const targetLink = findEpguDatabaseDepartmentLink(database.depid);
    const targetUrl = targetLink ? buildDepartmentNavigationUrl(targetLink) : '';
    if (!(targetLink instanceof HTMLAnchorElement) || !targetUrl) {
      if (status instanceof HTMLElement) {
        status.textContent = `Не найден штатный пункт базы «${database.label}». Откройте dropdown департаментов и повторите.`;
        status.hidden = false;
        status.classList.add('is-error');
      }
      return false;
    }

    let targetHost = '';
    try {
      targetHost = normalizeDepartmentContainerHost(new URL(targetUrl, window.location.origin).hostname);
    } catch (error) {
      targetHost = '';
    }
    if (!targetHost || targetHost !== database.host) {
      if (status instanceof HTMLElement) {
        status.textContent = `У базы «${database.label}» некорректная ссылка перехода.`;
        status.hidden = false;
        status.classList.add('is-error');
      }
      return false;
    }

    modal.dataset.databaseSwitching = 'true';
    modal.querySelectorAll('.dup-epgu-database-button').forEach((button) => {
      if (button instanceof HTMLButtonElement) button.disabled = true;
    });
    if (status instanceof HTMLElement) {
      status.textContent = `Переходим в базу «${database.label}»…`;
      status.hidden = false;
      status.classList.remove('is-error');
    }

    const markerSaved = await setEpguSummaryReopenPending({
      targetDepid: database.depid,
      targetHost,
      selectedDateKey: getEpguSummarySelectedDateKey(),
      createdAt: Date.now()
    });
    if (!markerSaved) {
      modal.dataset.databaseSwitching = 'false';
      renderEpguDatabaseSwitcher(modal);
      if (status instanceof HTMLElement) {
        status.textContent = 'Не удалось подготовить автоматическое открытие сводки после перехода.';
        status.hidden = false;
        status.classList.add('is-error');
      }
      return false;
    }

    try {
      const navigationStarted = await navigateToDepartmentByHotkey(targetLink);
      if (!navigationStarted) throw new Error('NAVIGATION_NOT_STARTED');

      window.setTimeout(() => {
        if (!modal.isConnected || modal.dataset.databaseSwitching !== 'true') return;
        modal.dataset.databaseSwitching = 'false';
        renderEpguDatabaseSwitcher(modal);
        if (status instanceof HTMLElement) {
          status.textContent = `База «${database.label}» открыта в отдельной вкладке.`;
          status.hidden = false;
          status.classList.remove('is-error');
        }
      }, 2500);
      return true;
    } catch (error) {
      await clearEpguSummaryReopenPending();
      modal.dataset.databaseSwitching = 'false';
      renderEpguDatabaseSwitcher(modal);
      if (status instanceof HTMLElement) {
        status.textContent = `Не удалось перейти в базу «${database.label}».`;
        status.hidden = false;
        status.classList.add('is-error');
      }
      return false;
    }
  }

  function scheduleEpguSummaryReopenAfterDepartmentSwitch() {
    if (epguSummaryReopenCheckStarted || !isEpguRequestsPage()) return;
    epguSummaryReopenCheckStarted = true;

    void chromeStorageGet([EPGU_REQUESTS_SUMMARY_REOPEN_STORAGE_KEY]).then((stored) => {
      const pending = stored && stored[EPGU_REQUESTS_SUMMARY_REOPEN_STORAGE_KEY];
      const targetDepid = String(pending && pending.targetDepid || '').trim();
      const targetHost = normalizeDepartmentContainerHost(pending && pending.targetHost);
      const selectedDateKey = normalizeEpguSummarySelectedDateKey(pending && pending.selectedDateKey);
      const createdAt = Number(pending && pending.createdAt || 0);
      const expiresAt = createdAt + EPGU_REQUESTS_SUMMARY_REOPEN_TTL_MS;
      if (!getEpguDatabaseConfig(targetDepid) || !targetHost || !createdAt || Date.now() > expiresAt) {
        if (pending) void clearEpguSummaryReopenPending();
        return;
      }

      const attemptOpen = () => {
        if (!isEpguRequestsPage() || Date.now() > expiresAt) {
          void clearEpguSummaryReopenPending();
          return;
        }

        const currentHost = normalizeDepartmentContainerHost(window.location.hostname);
        const summaryButton = ensureEpguSummaryButton();
        const grid = document.querySelector('#list');
        const loading = document.getElementById('load_list');
        const gridIsLoading = loading instanceof HTMLElement &&
          window.getComputedStyle(loading).display !== 'none' &&
          window.getComputedStyle(loading).visibility !== 'hidden';

        if (
          currentHost === targetHost &&
          summaryButton instanceof HTMLElement &&
          grid instanceof HTMLElement &&
          !gridIsLoading
        ) {
          void clearEpguSummaryReopenPending().then(() => {
            if (isEpguRequestsPage() && normalizeDepartmentContainerHost(window.location.hostname) === targetHost) {
              openEpguSummaryModal({ selectedDateKey });
            }
          });
          return;
        }

        window.setTimeout(attemptOpen, 250);
      };

      attemptOpen();
    });
  }

  function renderEpguSummaryModal(modal) {
    if (!(modal instanceof HTMLElement)) return;

    renderEpguDatabaseSwitcher(modal);
    renderEpguSummaryDateNavigator(modal);
    const meta = modal.querySelector('.dup-epgu-summary-meta');
    const list = modal.querySelector('.dup-epgu-summary-list');
    const retryButton = modal.querySelector('.dup-epgu-summary-retry-button');
    const retryHint = modal.querySelector('.dup-epgu-summary-retry-hint');
    if (!(meta instanceof HTMLElement) || !(list instanceof HTMLElement)) return;

    const selectedDateKey = getEpguSummarySelectedDateKey();
    const isTodaySelected = selectedDateKey === getEpguTodayDateKey();
    const selectedDateComplete = isEpguSummaryDateComplete(selectedDateKey);
    const selectedDateAvailable = isEpguSummaryDateAvailable(selectedDateKey);
    const displayDate = formatEpguDateKeyForDisplay(selectedDateKey);
    list.textContent = '';

    if (!selectedDateAvailable && (epguSummaryRowsLoadPromise || (!epguSummaryRowsLoaded && !epguSummaryRowsLoadError))) {
      meta.textContent = `Загружаем сводку за ${displayDate}…`;
      const loading = document.createElement('div');
      loading.className = 'dup-epgu-summary-empty';
      loading.textContent = 'Эта дата станет доступна сразу после загрузки строк журнала.';
      list.appendChild(loading);
      if (retryButton instanceof HTMLButtonElement) {
        retryButton.disabled = true;
        retryButton.textContent = 'Загрузка сводки…';
      }
      if (retryHint instanceof HTMLElement) retryHint.textContent = '';
      renderEpguRegistryCheckControls(modal);
      return;
    }

    if (!selectedDateAvailable && epguSummaryRowsLoadError) {
      meta.textContent = 'Не удалось загрузить полную сводку ЕПГУ.';
      const error = document.createElement('div');
      error.className = 'dup-epgu-summary-empty is-error';
      error.textContent = epguSummaryRowsLoadError;
      list.appendChild(error);
      if (retryButton instanceof HTMLButtonElement) {
        retryButton.disabled = true;
        retryButton.textContent = 'Сводка недоступна';
      }
      if (retryHint instanceof HTMLElement) retryHint.textContent = 'Доступные даты остались в сводке. Закройте и повторно откройте окно, чтобы повторить загрузку остальных.';
      renderEpguRegistryCheckControls(modal);
      return;
    }

    const summary = collectEpguSummaryItems(selectedDateKey);
    const retryTargets = collectEpguRetryTargets(summary);
    const registryCheckResult = getEpguRegistryCheckResultForCurrentBase(selectedDateKey);
    const loadingSuffix = epguSummaryRowsLoadPromise && !epguSummaryRowsLoaded
      ? selectedDateComplete
        ? ' Остальные даты загружаются.'
        : ' Предварительные данные из открытого грида; полная сводка загружается.'
      : epguSummaryRowsLoadError && !epguSummaryRowsLoaded
        ? ' Остальные даты загрузить не удалось.'
        : '';
    meta.textContent = (summary.items.length
      ? `За ${displayDate}. Уникальных взыскателей: ${summary.items.length}.`
      : `За ${displayDate} запросов не найдено.`) + loadingSuffix;
    if (retryButton instanceof HTMLButtonElement) {
      retryButton.disabled = !selectedDateComplete || !isTodaySelected || retryTargets.length < 1 || epguRetryBatchRunning;
      retryButton.textContent = !selectedDateComplete
        ? 'Догружаем полную сводку…'
        : !isTodaySelected
        ? 'Повторные запросы — только сегодня'
        : retryTargets.length
          ? `Отправить запросы по неуспешным (${retryTargets.length})`
          : 'Все взыскатели успешны';
    }
    if (retryHint instanceof HTMLElement) {
      retryHint.textContent = !selectedDateComplete
        ? 'Просмотр доступен сразу, а действия появятся после полной загрузки выбранного дня.'
        : !isTodaySelected
        ? 'Для прошлой даты доступен просмотр и проверка реестров. Новые запросы можно отправить только по сегодняшней сводке.'
        : retryTargets.length
          ? 'Перед запуском можно исключить отдельных взыскателей. Выбор сохранится.'
          : 'За сегодня нет взыскателей, которым нужен повторный запрос.';
    }

    if (!summary.items.length) {
      const empty = document.createElement('div');
      empty.className = 'dup-epgu-summary-empty';
      empty.textContent = `За ${displayDate} записей не найдено.`;
      list.appendChild(empty);
      renderEpguRegistryCheckControls(modal);
      return;
    }

    summary.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'dup-epgu-summary-item';
      row.title = [
        item.claimantKey,
        `Лучший статус за ${displayDate}: ${item.bestEntry.statusMeta.label}`,
        `Запросов за ${displayDate}: ${item.count}`,
        item.bestEntry.dateInfo.rawText ? `Последний учтенный запрос: ${item.bestEntry.dateInfo.rawText}` : '',
        item.bestEntry.messageText ? `Сообщение: ${item.bestEntry.messageText}` : ''
      ].filter(Boolean).join('\n');

      const main = document.createElement('div');
      main.className = 'dup-epgu-summary-main';

      const claimantLine = document.createElement('div');
      claimantLine.className = 'dup-epgu-summary-claimant';
      const claimantLabel = document.createElement('span');
      claimantLabel.textContent = `${index + 1}. ${item.claimantKey}`;
      claimantLine.appendChild(claimantLabel);

      const count = document.createElement('span');
      count.className = 'dup-epgu-summary-count';
      count.textContent = `${item.count} шт.`;
      claimantLine.appendChild(count);
      main.appendChild(claimantLine);

      const lastRequest = document.createElement('div');
      lastRequest.className = 'dup-epgu-summary-subline';
      lastRequest.textContent = item.entries[0] && item.entries[0].dateInfo && item.entries[0].dateInfo.rawText
        ? `Последний запрос: ${formatEpguDateTimeForDisplay(item.entries[0].dateInfo.rawText)}`
        : 'Дата запроса не указана';
      main.appendChild(lastRequest);

      if (item.bestEntry.messageText) {
        const messageLine = document.createElement('div');
        messageLine.className = 'dup-epgu-summary-summary-message';
        messageLine.textContent = `Сообщение: ${item.bestEntry.messageText}`;
        messageLine.title = item.bestEntry.messageText;
        main.appendChild(messageLine);
      }

      const side = document.createElement('div');
      side.className = 'dup-epgu-summary-side';

      const status = createEpguSummaryBadge(
        item.bestEntry.statusMeta.label,
        'dup-epgu-summary-status',
        item.bestEntry.statusMeta.color
      );

      const claimantRegistries = getEpguClaimantRegistries(registryCheckResult, item.claimantKey);
      const registryMeta = resolveEpguRegistrySummaryMeta(claimantRegistries, !!registryCheckResult);
      const registryStatusText = registryMeta.checked
        ? `${registryMeta.label} · ${formatEpguRegistryCount(registryMeta.count)}`
        : registryMeta.label;
      const registryStatus = createEpguSummaryBadge(
        registryStatusText,
        'dup-epgu-summary-status dup-epgu-registry-summary-status',
        registryMeta.color
      );

      side.append(status, registryStatus);
      row.append(main, side);
      if (registryCheckResult) {
        const details = createEpguRegistryDetails(claimantRegistries, item.claimantKey);
        const toggle = document.createElement('span');
        toggle.className = 'dup-epgu-registry-toggle';
        toggle.textContent = '▸';
        toggle.setAttribute('aria-hidden', 'true');
        claimantLine.prepend(toggle);
        claimantLine.classList.add('is-expandable');
        claimantLine.tabIndex = 0;
        claimantLine.setAttribute('role', 'button');
        claimantLine.setAttribute('aria-expanded', 'false');
        const toggleDetails = () => {
          const expanded = details.hidden;
          details.hidden = !expanded;
          claimantLine.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          toggle.textContent = expanded ? '▾' : '▸';
          row.classList.toggle('is-expanded', expanded);
        };
        claimantLine.addEventListener('click', toggleDetails, { capture: true });
        claimantLine.addEventListener('keydown', (event) => {
          if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          toggleDetails();
        }, { capture: true });
        row.appendChild(details);
      }
      list.appendChild(row);
    });
    renderEpguRegistryCheckControls(modal);
  }

  function createEpguSummaryModal() {
    const existing = document.getElementById(EPGU_REQUESTS_SUMMARY_MODAL_ID);
    if (existing instanceof HTMLElement) return existing;

    const modal = document.createElement('div');
    modal.id = EPGU_REQUESTS_SUMMARY_MODAL_ID;
    modal.className = 'dup-execution-analysis-modal dup-epgu-summary-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dup-execution-analysis-modal-panel dup-epgu-summary-panel" role="dialog" aria-modal="true" aria-label="Сводка ЕПГУ по выбранной дате">
        <div class="dup-execution-analysis-modal-header">
          <div class="dup-execution-analysis-modal-title">Сводка ЕПГУ</div>
          <button type="button" class="dup-execution-analysis-modal-close" aria-label="Закрыть">×</button>
        </div>
        <div class="dup-epgu-database-card">
          <div class="dup-epgu-database-heading">База запросов</div>
          <div class="dup-epgu-database-switcher" role="group" aria-label="Переключение базы ЕПГУ">
            <button type="button" class="dup-epgu-database-button" data-depid="39">Курган</button>
            <button type="button" class="dup-epgu-database-button" data-depid="66">Основная</button>
            <button type="button" class="dup-epgu-database-button" data-depid="70">ЮРИЦ</button>
          </div>
          <div class="dup-epgu-database-status" aria-live="polite" hidden></div>
        </div>
        <div class="dup-epgu-summary-date-nav" role="group" aria-label="Выбор даты сводки ЕПГУ">
          <button type="button" class="dup-epgu-summary-date-button is-previous" data-day-delta="-1" aria-label="Предыдущая дата"><span class="dup-epgu-summary-date-arrow" aria-hidden="true">‹</span><span class="dup-epgu-summary-date-loader" aria-hidden="true"></span></button>
          <time class="dup-epgu-summary-date-label"></time>
          <button type="button" class="dup-epgu-summary-date-button is-next" data-day-delta="1" aria-label="Следующая дата"><span class="dup-epgu-summary-date-arrow" aria-hidden="true">›</span><span class="dup-epgu-summary-date-loader" aria-hidden="true"></span></button>
        </div>
        <div class="dup-epgu-summary-meta"></div>
        <div class="dup-epgu-summary-list" role="list"></div>
        <div class="dup-epgu-registry-check-status" aria-live="polite"></div>
        <div class="dup-epgu-summary-actions">
          <div class="dup-epgu-summary-retry-hint"></div>
          <div class="dup-epgu-summary-action-buttons">
            <button type="button" class="dup-epgu-registry-check-button">Проверить формирование реестров</button>
            <button type="button" class="dup-epgu-summary-retry-button">Отправить запросы по неуспешным</button>
          </div>
        </div>
      </div>
    `;

    const close = () => {
      if (epguRegistryCheckRunning || epguRegistryConductingKey) return;
      modal.hidden = true;
    };
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { capture: true });
    modal.querySelector('.dup-execution-analysis-modal-close')?.addEventListener('click', close, { capture: true });
    modal.querySelector('.dup-epgu-summary-retry-button')?.addEventListener('click', () => {
      void openEpguRetrySelectionModal();
    }, { capture: true });
    modal.querySelector('.dup-epgu-registry-check-button')?.addEventListener('click', () => {
      void startEpguRegistryCheck(modal);
    }, { capture: true });
    modal.querySelector('.dup-epgu-summary-date-nav')?.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('.dup-epgu-summary-date-button')
        : null;
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      const dayDelta = Number(button.dataset.dayDelta || 0);
      const nextDateKey = normalizeEpguSummarySelectedDateKey(
        shiftEpguDateKey(getEpguSummarySelectedDateKey(), dayDelta)
      );
      if (!nextDateKey || nextDateKey === getEpguSummarySelectedDateKey()) return;
      epguSummarySelectedDateKey = nextDateKey;
      epguRegistryCheckNotice = '';
      epguRegistryCheckNoticeIsError = false;
      renderEpguSummaryModal(modal);
    }, { capture: true });
    modal.querySelector('.dup-epgu-database-switcher')?.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('.dup-epgu-database-button')
        : null;
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      event.preventDefault();
      void switchEpguRequestsDatabase(modal, button.dataset.depid);
    }, { capture: true });

    (document.body || document.documentElement).appendChild(modal);
    return modal;
  }

  function openEpguSummaryModal(options = {}) {
    if (!isEpguRequestsPage()) return;
    epguSummarySelectedDateKey = normalizeEpguSummarySelectedDateKey(
      options && options.selectedDateKey ? options.selectedDateKey : getEpguTodayDateKey()
    );
    epguRegistryCheckNotice = '';
    epguRegistryCheckNoticeIsError = false;
    const modal = createEpguSummaryModal();
    prepareEpguSummaryRowsForCurrentBase();
    const registryCachePromise = loadEpguRegistryCheckCache();
    const summaryRowsPromise = loadEpguSummaryRowsForCurrentBase();
    renderEpguSummaryModal(modal);
    modal.hidden = false;
    void Promise.allSettled([
      registryCachePromise,
      summaryRowsPromise
    ]).then(() => {
      if (modal.isConnected && !modal.hidden && !epguRegistryCheckRunning) {
        renderEpguSummaryModal(modal);
      }
    });
  }

  function ensureEpguSummaryButton() {
    const host = document.querySelector('#pager_left .navtable');
    if (!(host instanceof HTMLElement)) return null;

    const existing = document.getElementById(EPGU_REQUESTS_SUMMARY_BUTTON_ID);
    if (existing instanceof HTMLElement) {
      if (existing.parentElement !== host) host.appendChild(existing);
      return existing;
    }

    const button = document.createElement('div');
    button.id = EPGU_REQUESTS_SUMMARY_BUTTON_ID;
    button.className = 'btn btn-xs ui-pg-button';
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.setAttribute('title', 'Сводка взыскателей по выбранной дате');
    button.innerHTML = `
      <div class="ui-pg-div">
        <span class="fa fa-lg fa-fw fa-list-alt"></span>
        <span class="ui-pg-button-text">ЕПГУ</span>
      </div>
    `;
    button.addEventListener('click', () => {
      openEpguSummaryModal();
    }, { capture: true });
    button.addEventListener('keydown', (event) => {
      if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      openEpguSummaryModal();
    }, { capture: true });

    host.appendChild(button);
    return button;
  }

  function removeEpguSummaryUi() {
    document.getElementById(EPGU_REQUESTS_SUMMARY_BUTTON_ID)?.remove();
    document.getElementById(EPGU_REQUESTS_SUMMARY_MODAL_ID)?.remove();
    document.getElementById(EPGU_REQUESTS_RETRY_MODAL_ID)?.remove();
  }

  function syncEpguSummaryUi() {
    if (!isEpguRequestsPage()) {
      removeEpguSummaryUi();
      return;
    }

    ensureEpguSummaryButton();
    scheduleEpguSummaryReopenAfterDepartmentSwitch();
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
    if (normalizedStatus === 'заявление получено ведомством') return EPGU_REQUESTS_COLOR_TRANSITION;
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
      removeEpguSummaryUi();
      return;
    }

    clearEpguRequestsHighlights();
    syncEpguSummaryUi();

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

      if (key === FSSP_REESTR_GROUPING_STORAGE_KEY) {
        applyFsspReestrGroupingPreference(changes[key].newValue !== false, { persist: false });
        if (isFsspReestrPage()) {
          dispatchFsspReestrGroupingChange(isFsspReestrGroupingEnabled());
        }
      }

      if (key === DEPARTMENT_CONTAINER_MODE_STORAGE_KEY) {
        departmentContainerModeEnabled = changes[key].newValue !== false;
        scheduleDepartmentContainerTitleSync();
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
        persistIdCardCheckSessionCache(idCardCheckState);
        void syncIdCardCheckStateWithCurrentUrl().then(() => {
          persistIdCardCheckSessionCache(idCardCheckState);
          return syncIdCardCheckNavigation();
        });
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
      const headerValue = e.shiftKey
        ? getManualGridHeaderCaption(targetHeader)
        : ensureManualGridColumnCodeTooltip(targetHeader);
      if (headerValue) {
        e.preventDefault();
        navigator.clipboard.writeText(headerValue).then(() => showSuccessFeedback(targetHeader));
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

    if (e && e.button === 2 && e.shiftKey) {
      const targetHeader = getManualGridHeaderTrigger(e.target);
      if (targetHeader) {
        const headerCaption = getManualGridHeaderCaption(targetHeader);
        if (!headerCaption) return;

        e.preventDefault();
        e.stopPropagation();

        navigator.clipboard.writeText(headerCaption).then(() => showSuccessFeedback(targetHeader));
        return;
      }
    }

    if (!e || e.button !== 1) return;

    const targetHeader = getManualGridHeaderTrigger(e.target);
    if (targetHeader) {
      const headerEntries = collectManualGridHeaderCopyEntries(targetHeader, e.shiftKey ? 'caption' : 'code');
      if (!headerEntries.length) return;

      e.preventDefault();
      return;
    }

    const targetCell = getGridBulkCopyTargetCell(e.target);
    if (!targetCell) return;
    if (!String(targetCell.getAttribute('aria-describedby') || '').trim()) return;
    if (!getGridTableFromCell(targetCell)) return;

    e.preventDefault();
  }, true);

  document.addEventListener('auxclick', function(e) {
    if (!isCopyModeEnabled) return;
    if (!e || e.button !== 1) return;

    const targetHeader = getManualGridHeaderTrigger(e.target);
    if (targetHeader) {
      const headerEntries = collectManualGridHeaderCopyEntries(targetHeader, e.shiftKey ? 'caption' : 'code');
      if (!headerEntries.length) return;

      const values = headerEntries.map((entry) => entry.value);
      const feedbackElements = getManualGridHeaderCopyFeedbackElements(headerEntries);

      e.preventDefault();
      e.stopPropagation();

      navigator.clipboard.writeText(values.join('\t')).then(() => {
        showSuccessFeedbackBatch(feedbackElements);
      });
      return;
    }

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

  function getManualGridHeaderCell(header) {
    if (!(header instanceof HTMLElement)) return null;

    const headerCell = header.closest('th');
    if (!(headerCell instanceof HTMLTableCellElement)) return null;
    if (!headerCell.closest('.ui-jqgrid-hdiv')) return null;

    return headerCell;
  }

  function getManualGridHeaderTrigger(target) {
    if (!(target instanceof Element)) return null;

    const byJqghId = target.closest('div[id^="jqgh_"]');
    const byRole = target.closest('div[role="columnheader"]');
    const header = byJqghId instanceof HTMLElement ? byJqghId : byRole;
    if (!(header instanceof HTMLElement)) return null;

    if (!getManualGridHeaderCell(header)) return null;

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

  function getManualGridHeaderCaption(header) {
    if (!(header instanceof HTMLElement)) return '';

    const headerClone = header.cloneNode(true);
    if (!(headerClone instanceof HTMLElement)) return '';

    headerClone.querySelectorAll('.s-ico, .ui-grid-ico-sort, .ui-jqgrid-resize').forEach((element) => {
      element.remove();
    });

    return normalizeGridBulkCopyValue(headerClone.textContent);
  }

  function getManualGridHeaderFromCell(headerCell) {
    if (!(headerCell instanceof HTMLTableCellElement)) return null;

    const header = headerCell.querySelector('div[id^="jqgh_"], div[role="columnheader"]');
    return header instanceof HTMLElement ? header : null;
  }

  function collectManualGridHeaderCopyEntries(startHeader, valueMode) {
    const headerCell = getManualGridHeaderCell(startHeader);
    if (!headerCell) return [];

    const headerRow = headerCell.closest('tr');
    if (!(headerRow instanceof HTMLTableRowElement)) return [];

    const entries = [];
    Array.from(headerRow.children).forEach((cell) => {
      if (!(cell instanceof HTMLTableCellElement)) return;
      if (!isStageJumpElementVisible(cell)) return;

      const header = getManualGridHeaderFromCell(cell);
      if (!(header instanceof HTMLElement)) return;

      const headerCaption = getManualGridHeaderCaption(header);
      const value = valueMode === 'caption'
        ? headerCaption
        : ensureManualGridColumnCodeTooltip(header);
      if (!value) return;
      if (valueMode !== 'caption' && !headerCaption && (value === 'cb' || value === 'rn')) return;

      entries.push({ cell, header, value });
    });

    return entries;
  }

  function getManualGridHeaderCopyFeedbackElements(entries) {
    const uniqueElements = [];
    const seen = new Set();

    entries.forEach((entry) => {
      if (!entry || !(entry.header instanceof HTMLElement) || seen.has(entry.header)) return;
      seen.add(entry.header);
      uniqueElements.push(entry.header);
    });

    return uniqueElements;
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.action !== 'ID_CARD_CHECK_TAB_ACTION') {
      return false;
    }

    (async () => {
      try {
        const data = message && message.data && typeof message.data === 'object'
          ? message.data
          : {};
        const kind = String(data.kind || '').trim();
        const normalizedEdocId = normalizeExecutionAnalysisText(data.edocId);

        if (kind === 'extract-history-transition') {
          if (!isIdCardCheckHistoryUrl(window.location.href, normalizedEdocId)) {
            throw new Error(`Во вкладке EdocID ${normalizedEdocId} не открыта История.`);
          }

          const transitionText = getLatestIdCardCheckHistoryTransitionText(document);
          if (!transitionText) {
            throw new Error(`Для EdocID ${normalizedEdocId} не найдена история перехода по ТМ.`);
          }

          sendResponse({
            success: true,
            transitionText
          });
          return;
        }

        if (kind === 'prepare-editedoc-return') {
          const transitionText = normalizeExecutionAnalysisText(data.transitionText);
          const statusOptions = collectIdCardCheckEditedocStatusOptions(document);
          if (!statusOptions.length) {
            throw new Error('На форме editedoc не найден dropdown со стадиями/статусами.');
          }

          const previousTm = resolveIdCardCheckPreviousTm(transitionText, statusOptions);
          if (!previousTm) {
            throw new Error(`Не удалось разобрать предыдущую ТМ из action_history: ${transitionText}`);
          }

          const previousTmText = formatIdCardCheckTm(previousTm.previousStage, previousTm.previousStatus);
          if (!previousTm.matchedOption) {
            sendResponse({
              success: true,
              submitted: false,
              previousTmText
            });
            return;
          }

          sendResponse({
            success: true,
            submitted: true,
            previousTmText
          });
          window.setTimeout(() => {
            try {
              triggerIdCardCheckEditedocReturn(document, previousTm.matchedOption.value);
            } catch (error) {
              console.error('Не удалось отправить форму editedoc для возврата на предыдущую ТМ.', error);
            }
          }, 0);
          return;
        }

        if (kind === 'confirm-editedoc-return') {
          const resultDoc = await waitForIdCardCheckDocumentCondition(
            (currentDoc) => hasIdCardCheckEditedocSuccessMessage(currentDoc) || hasIdCardCheckEditedocTerminalError(currentDoc),
            ID_CARD_CHECK_TAB_MESSAGE_TIMEOUT_MS + 10000
          );

          if (isIdCardCheckHelperLoginDocument(resultDoc)) {
            throw new Error('Сайт вернул страницу логина вместо подтверждения сохранения.');
          }
          if (!hasIdCardCheckEditedocSuccessMessage(resultDoc)) {
            throw new Error(`Форма editedoc не подтвердила сохранение: ${getIdCardCheckHelperDocumentSummary(resultDoc)}`);
          }

          sendResponse({ success: true });
          return;
        }

        throw new Error(`Неизвестное действие вкладки EdocID: ${kind || 'empty'}`);
      } catch (error) {
        sendResponse({
          success: false,
          error: error && error.message ? error.message : String(error)
        });
      }
    })();

    return true;
  });

  function isStageJumpSourcePage() {
    const pathname = String(window.location.pathname || '');
    return (
      pathname.includes('/ovzid/status/') ||
      pathname.includes('/ovzid/stage/') ||
      pathname.includes('/ovzid/ReestrReturnToPU')
    );
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
        void chromeStorageSet({ [DEPARTMENT_DROPDOWN_STATE_STORAGE_KEY]: departmentDropdownShowHidden });
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

    loadFsspReestrGroupingPreference();

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
      console.warn('Не удалось открыть страницу для действия StageJump.', error);
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
      const edocId = (
        getRowCellTextByAria(row, 'list_EDocID') ||
        getRowCellTextByAria(row, 'list_EdocID') ||
        String(row.id || '').trim()
      );
      const accountNumber = getRowCellTextByAria(row, 'list_AccAddress_AccountNumber');
      const edNumber = getRowCellTextByAria(row, 'list_EDNumber');
      const fullName = getRowCellTextByAria(row, 'list_Individual_FullName');
      const departmentName = (
        getRowCellTextByAria(row, 'list_DepartmentName') ||
        getRowCellTextByAria(row, 'list_Departmentname') ||
        getRowCellTextByAria(row, 'list_Territory') ||
        currentDepartmentName
      );
      const stageName = (
        getRowCellTextByAria(row, 'list_CaseStageName') ||
        (window.location.pathname.includes('/ovzid/ReestrReturnToPU')
          ? STAGE_JUMP_REESTR_RETURN_TO_PU_TM_LABEL
          : '')
      );
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
        departmentName
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

    if (action === STAGE_JUMP_MENU_ACTION_VERIFY_IDENTITY) {
      const verificationSummary = collectStageJumpCopyInfoTargets(anchorButton);
      if (!verificationSummary.targets.length) {
        window.alert('Нет строк для проверки паспорта, ИНН и даты смерти.');
        return;
      }
      window.dispatchEvent(new CustomEvent(STAGE_JUMP_IDENTITY_VERIFICATION_START_EVENT, {
        detail: { targets: verificationSummary.targets }
      }));
      return;
    }

    if (!debtId) return;

    if (action === STAGE_JUMP_MENU_ACTION_SLOWSEARCH) {
      openStageJumpTarget(STAGE_JUMP_SLOWSEARCH_PATH, debtId);
      return;
    }

    if (action === STAGE_JUMP_MENU_ACTION_ALL_RECORDS) {
      openStageJumpTarget(SLOWSEARCH_TARGET_PATH, debtId);
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
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_VERIFY_IDENTITY}">${STAGE_JUMP_MENU_ITEM_VERIFY_IDENTITY_TEXT} (0)</button>`,
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_SLOWSEARCH}">${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}</button>`,
      `<button type="button" class="${STAGE_JUMP_MENU_ITEM_CLASS}" ${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_ALL_RECORDS}">${STAGE_JUMP_MENU_ITEM_ALL_RECORDS_TEXT}</button>`
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

    const slowsearchItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_SLOWSEARCH}"]`);
    const allRecordsItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_ALL_RECORDS}"]`);
    const copyInfoItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_COPY_INFO}"]`);
    const identityVerificationItem = menu.querySelector(`.${STAGE_JUMP_MENU_ITEM_CLASS}[${STAGE_JUMP_MENU_ACTION_ATTR}="${STAGE_JUMP_MENU_ACTION_VERIFY_IDENTITY}"]`);
    const copyInfoSummary = collectStageJumpCopyInfoTargets(anchorButton);
    const hasDebtId = String(anchorButton.dataset.debtId || '').trim().length > 0;
    [slowsearchItem, allRecordsItem].forEach((item) => {
      if (!(item instanceof HTMLButtonElement)) return;
      item.disabled = !hasDebtId;
      if (!hasDebtId) {
        item.title = 'Не удалось определить DebtID строки.';
      } else {
        item.removeAttribute('title');
      }
    });
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
    if (identityVerificationItem instanceof HTMLButtonElement) {
      const verificationCount = copyInfoSummary.targets.filter((target) => String(target.edocId || '').trim()).length;
      identityVerificationItem.textContent = `${STAGE_JUMP_MENU_ITEM_VERIFY_IDENTITY_TEXT} (${verificationCount})`;
      identityVerificationItem.disabled = verificationCount < 1;
      if (verificationCount < 1) {
        identityVerificationItem.title = 'Не удалось определить EDocID строк.';
      } else if (copyInfoSummary.selectedRowsCount > 0) {
        identityVerificationItem.title = `Будет проверено выделенных загруженных строк: ${verificationCount}`;
      } else {
        identityVerificationItem.title = 'Будет проверена строка, из которой открыто меню.';
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

      toggleStageJumpActionMenu(button);
    });
    return button;
  }

  function updateStageJumpButtons() {
    if (!isStageJumpSourcePage()) return;

    ensureStageJumpStyle();
    cleanupLegacyStageJumpColumn();

    const openButtons = Array.from(
      document.querySelectorAll('.ui-inline-open, [title="Открыть карточку"], [data-original-title="Открыть карточку"]')
    ).filter((btn, index, arr) => btn.offsetParent !== null && arr.indexOf(btn) === index);

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
      jumpButton.classList.remove('is-disabled');

      if (debtId) {
        jumpButton.dataset.debtId = debtId;
        if (edocId) {
          jumpButton.dataset.edocId = edocId;
        } else {
          delete jumpButton.dataset.edocId;
        }
        jumpButton.title = [
          `DebtID: ${debtId}`,
          'Выберите действие:',
          `1) ${STAGE_JUMP_MENU_ITEM_COPY_INFO_TEXT}`,
          `2) ${STAGE_JUMP_MENU_ITEM_VERIFY_IDENTITY_TEXT}`,
          `3) ${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT}`,
          `4) ${STAGE_JUMP_MENU_ITEM_ALL_RECORDS_TEXT}`
        ].join('\n');
      } else {
        delete jumpButton.dataset.debtId;
        if (edocId) jumpButton.dataset.edocId = edocId;
        else delete jumpButton.dataset.edocId;
        jumpButton.title = [
          'DebtID не найден. Доступно копирование информации об ИД.',
          'Выберите действие:',
          `1) ${STAGE_JUMP_MENU_ITEM_COPY_INFO_TEXT}`,
          `2) ${STAGE_JUMP_MENU_ITEM_VERIFY_IDENTITY_TEXT}${edocId ? '' : ' (недоступен: EDocID не найден)'}`,
          `3) ${STAGE_JUMP_MENU_ITEM_SLOWSEARCH_TEXT} (недоступен: DebtID не найден)`,
          `4) ${STAGE_JUMP_MENU_ITEM_ALL_RECORDS_TEXT} (недоступен: DebtID не найден)`
        ].join('\n');
      }

    });
  }

  const debouncedUpdateStageJumpButtons = debounce(updateStageJumpButtons, 250);

  function initStageJumpButtons() {
    if (!isStageJumpSourcePage()) return;

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

  function initGridLinksOpenInNewTabs() {
    const gridLinkSelector = [
      '[role="grid"] [role="row"] [role="gridcell"] a[href]',
      'table.ui-jqgrid-btable tbody tr.jqgrow td[role="gridcell"] a[href]'
    ].join(', ');

    const prepareGridLink = (anchor) => {
      if (!(anchor instanceof HTMLAnchorElement)) return;

      let targetUrl;
      try {
        targetUrl = new URL(anchor.href, window.location.href);
      } catch (_) {
        return;
      }
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return;

      anchor.target = '_blank';
      const relTokens = new Set(String(anchor.rel || '').split(/\s+/).filter(Boolean));
      relTokens.add('noopener');
      anchor.rel = Array.from(relTokens).join(' ');
    };

    const prepareGridLinks = (root) => {
      if (!(root instanceof Element) && !(root instanceof Document)) return;
      if (root instanceof Element && root.matches(gridLinkSelector)) {
        prepareGridLink(root);
      }
      root.querySelectorAll(gridLinkSelector).forEach(prepareGridLink);
    };

    prepareGridLinks(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => prepareGridLinks(node));
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('click', (event) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      prepareGridLink(event.target.closest(gridLinkSelector));
    }, true);
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
  initDepartmentContainerMode();
  initDepartmentNavigationHotkeys();
  initDepartmentDropdownFilter();
  initStageJumpButtons();
  initSlowsearchJumpButtons();
  initReestrDzPrincipalAutofill();
  void initReestrDzWriteOffReviewOverlay();
  initGridLinksOpenInNewTabs();
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
