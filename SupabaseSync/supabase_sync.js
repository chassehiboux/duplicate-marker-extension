(() => {
  'use strict';

  if (globalThis.__dupSupabaseSyncInitialized) return;
  globalThis.__dupSupabaseSyncInitialized = true;

  const SUPABASE_ORIGINS = [
    'https://sb.jassco.ru',
    'https://odljanxhmjysnduylvxz.supabase.co'
  ];
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2Z6tbzq-QJFyJVmCTbhG4w_ZZAiNu-d';
  const SCHEMA_VERSION = 2;

  const AUTH_SESSION_KEY = 'dup_supabase_auth_session_v1';
  const LEGACY_SYNC_META_KEY = 'dup_supabase_sync_meta_v1';
  const LEGACY_PRE_LOGIN_BACKUP_KEY = 'dup_supabase_pre_login_backup_v1';
  const DEVICE_ID_KEY = 'dup_supabase_device_id_v1';
  const OUTBOX_KEY = 'dup_supabase_outbox_v1';
  const CACHE_REVISION_KEY = 'dup_supabase_cache_revision_v1';
  const SYNC_META_KEY = 'dup_supabase_sync_meta_v2';
  const PRE_LOGIN_BACKUP_KEY = 'dup_supabase_pre_login_backup_v2';
  const SUPPORT_REMINDERS_STORAGE_KEY = 'support_reminders_state_v1';

  const SESSION_REFRESH_MARGIN_MS = 60 * 1000;
  const REQUEST_TIMEOUT_MS = 7000;
  const SUPABASE_FALLBACK_COOLDOWN_MS = 60 * 1000;
  const SYNC_STALL_THRESHOLD_MS = 5000;
  const RETRY_DELAYS_MS = [600, 1500, 3500];
  const FLUSH_DEBOUNCE_MS = 250;
  const REALTIME_WS_URLS = SUPABASE_ORIGINS.map((origin) => `${origin.replace(/^http/i, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_PUBLISHABLE_KEY)}&log_level=warning&vsn=1.0.0`);
  const REALTIME_TOPIC = 'realtime:extension-sync-state';
  const REALTIME_JOIN_TIMEOUT_MS = 10000;
  const REALTIME_HEARTBEAT_MS = 25000;
  const REALTIME_PULL_DEBOUNCE_MS = 800;
  const REALTIME_RECONNECT_DELAYS_MS = [5000, 15000, 60000, 300000, 900000];
  const FALLBACK_PULL_ALARM_NAME = 'dup_supabase_pull_fallback_v2';
  const FALLBACK_PULL_MINUTES = 5;
  const SESSION_REAUTH_REQUIRED_MESSAGE = 'Сессия Supabase истекла или была отозвана. Войди снова, чтобы продолжить синхронизацию.';

  const KV_SYNC_KEYS = new Set([
    'setting_copy_mode',
    'setting_highlight_mode',
    'dup_custom_text_highlight_query_v1',
    'setting_notify_execution',
    'setting_notify_editing',
    'setting_department_containers',
    'list_DebtID',
    'list_AccAddress_AccountNumber',
    'list_Individual_FullName',
    'list_CaseNumber',
    'list_EDNumber',
    'strict_CaseNumber',
    'strict_EDNumber',
    'dup_show_hidden_departments',
    'dup_fsspreestr_group_duplicates',
    'pyramid_christmas_v10_enabled',
    'pyramid_spring_enabled',
    'pyramid_theme_feature_settings_v1',
    'vzid_last_claim_type',
    'vzid_last_claim_type_label',
    'vzid_last_claim_type_updated_at',
    'dup_google_sheets_problem_picker_bridge_url',
    'dup_google_sheets_problem_picker_wait_timeouts_v1',
    SUPPORT_REMINDERS_STORAGE_KEY,
    'dup_execution_analysis_params_v1',
    'dup_execution_analysis_state_v1',
    'dup_epgu_retry_excluded_claimants_v1',
    'dup_reestr_dz_parallel_workers_v1',
    'dup_reestr_dz_write_off_comment_skip_rules_v1'
  ]);

  const SUPPORT_REMINDER_OPERATION_TYPES = new Set([
    'support_reminder_set',
    'support_reminder_archive_set',
    'support_reminder_active_delete',
    'support_reminder_archive_delete'
  ]);

  const LAST_WRITE_WINS_OUTBOX_KEYS = new Set([
    'dup_custom_text_highlight_query_v1',
    'dup_execution_analysis_params_v1',
    'dup_execution_analysis_state_v1',
    'dup_reestr_dz_parallel_workers_v1',
    'dup_reestr_dz_write_off_comment_skip_rules_v1'
  ]);

  const STRUCTURED_SYNC_KEYS = new Set([
    'stats_history',
    'processed_edocids',
    'editing_stats',
    'processed_edits',
    'approved_actions',
    'blocked_actions',
    'action_tags'
  ]);

  const STAGE_TIMER_KEYS = new Set([
    'dup_ui_show_stage_timer',
    'dup_ui_show_stage_timer_toggle',
    'dup_ui_show_stage_timer_abort',
    'pyramid_stage_timer_ui_visible'
  ]);

  const EXACT_EXCLUDED_KEYS = new Set([
    'dup_id_card_check_state_v1', // Старый временный просмотр не переносится в облако.
    AUTH_SESSION_KEY,
    LEGACY_SYNC_META_KEY,
    LEGACY_PRE_LOGIN_BACKUP_KEY,
    DEVICE_ID_KEY,
    OUTBOX_KEY,
    CACHE_REVISION_KEY,
    SYNC_META_KEY,
    PRE_LOGIN_BACKUP_KEY,
    'extension_logs',
    'pending_actions',
    'pendingEditingActions',
    'dup_department_container_cookie_stores_v1',
    'dup_stage_jump_pending',
    'pyramid_christmas_enabled_cache_v1',
    'pyramid_spring_enabled_cache_v1',
    'pyramid_theme_feature_settings_cache_v1',
    'dup_reestr_dz_principal_daily_runs',
    ...STAGE_TIMER_KEYS
  ]);

  const SYNC_PREFIXES = [
    'jqgrid_settings_',
    'dup_ui_show_'
  ];

  const EXCLUDED_PREFIXES = [
    'dup_supabase_',
    'logs_'
  ];

  let currentSession = null;
  let syncMetaLock = Promise.resolve();
  let currentUser = null;
  let bootStarted = false;
  let applyingCanonicalState = false;
  let flushTimer = 0;
  let flushInProgress = false;
  let pullInProgress = false;
  let lastRuntimeMessage = '';
  let lastRuntimeError = '';
  let realtimeWanted = false;
  let realtimeStarting = false;
  let realtimeSocket = null;
  let realtimeUserId = '';
  let realtimeAccessToken = '';
  let realtimeJoinRef = '';
  let realtimeJoined = false;
  let realtimeRefCounter = 0;
  let realtimePendingHeartbeatRef = '';
  let realtimeJoinTimer = 0;
  let realtimeHeartbeatTimer = 0;
  let realtimeReconnectTimer = 0;
  let realtimeReconnectAttempt = 0;
  let realtimePullTimer = 0;
  let realtimeOriginIndex = 0;
  let realtimeCurrentOriginIndex = 0;
  let supabaseFallbackUntil = 0;
  let outboxLock = Promise.resolve();
  let refreshSessionPromise = null;
  let syncIssueActive = false;
  let syncFlowState = {
    kind: '',
    title: '',
    active: false,
    steps: [],
    updatedAt: ''
  };

  function hasChromeStorage() {
    return !!(chrome && chrome.storage && chrome.storage.local);
  }

  function hasChromeAlarms() {
    return !!(chrome && chrome.alarms);
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      if (!hasChromeStorage()) {
        resolve({});
        return;
      }
      try {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      } catch (error) {
        resolve({});
      }
    });
  }

  function storageSet(values) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        resolve(false);
        return;
      }
      try {
        chrome.storage.local.set(values, () => {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) reject(new Error(error.message || 'Не удалось сохранить очередь локально.'));
          else resolve(true);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function storageRemove(keys) {
    return new Promise((resolve) => {
      if (!hasChromeStorage()) {
        resolve(false);
        return;
      }
      try {
        chrome.storage.local.remove(keys, () => resolve(true));
      } catch (error) {
        resolve(false);
      }
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clearTimer(timerId) {
    if (timerId) clearTimeout(timerId);
    return 0;
  }

  function cloneJson(value) {
    if (value === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueStrings(values) {
    const result = [];
    const seen = new Set();
    toArray(values).forEach((value) => {
      const normalized = String(value || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function toNonNegativeInteger(value) {
    const numberValue = Number(value || 0);
    if (!Number.isFinite(numberValue)) return 0;
    return Math.max(0, Math.trunc(numberValue));
  }

  function storageValueEquals(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch (error) {
      return left === right;
    }
  }

  function isSyncableKey(key) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return false;
    if (EXACT_EXCLUDED_KEYS.has(normalizedKey)) return false;
    if (EXCLUDED_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) return false;
    if (STAGE_TIMER_KEYS.has(normalizedKey)) return false;
    if (normalizedKey === SUPPORT_REMINDERS_STORAGE_KEY) return true;
    if (KV_SYNC_KEYS.has(normalizedKey)) return true;
    if (STRUCTURED_SYNC_KEYS.has(normalizedKey)) return true;
    if (normalizedKey.startsWith('dup_ui_show_')) return true;
    if (SYNC_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) return true;
    return false;
  }

  function isKvSyncKey(key) {
    const normalizedKey = String(key || '').trim();
    if (!isSyncableKey(normalizedKey)) return false;
    if (normalizedKey === SUPPORT_REMINDERS_STORAGE_KEY) return false;
    if (STRUCTURED_SYNC_KEYS.has(normalizedKey)) return false;
    if (KV_SYNC_KEYS.has(normalizedKey)) return true;
    return normalizedKey.startsWith('jqgrid_settings_') || normalizedKey.startsWith('dup_ui_show_');
  }

  function sanitizeExecutionAnalysisState(value) {
    if (!isPlainObject(value)) return value;
    const state = cloneJson(value);
    state.currentBatch = null;
    state.nextLaunchAt = 0;
    state.sourcePageId = '';
    if (state.status === 'running' || state.status === 'paused') {
      state.status = 'ready';
    }
    return state;
  }

  function sanitizeValueForCloud(key, value) {
    if (key === 'dup_execution_analysis_state_v1') {
      return sanitizeExecutionAnalysisState(value);
    }
    return cloneJson(value);
  }

  function normalizeSupportRequest(rawRequest) {
    if (!rawRequest || typeof rawRequest !== 'object') return null;

    const requestId = String(rawRequest.requestId || '').trim();
    if (!requestId) return null;

    return {
      requestId,
      requestNumber: String(rawRequest.requestNumber || '').trim(),
      subject: String(rawRequest.subject || '').trim(),
      stage: String(rawRequest.stage || '').trim(),
      status: String(rawRequest.status || '').trim(),
      supportNumber: String(rawRequest.supportNumber || '').trim(),
      assignee: String(rawRequest.assignee || '').trim(),
      initiator: String(rawRequest.initiator || '').trim(),
      createdAt: String(rawRequest.createdAt || '').trim(),
      filterType: String(rawRequest.filterType || '').trim(),
      filterLabel: String(rawRequest.filterLabel || '').trim()
    };
  }

  function normalizeSupportMessageTarget(rawTarget) {
    if (!rawTarget || typeof rawTarget !== 'object') return null;

    const rawKind = String(rawTarget.kind || rawTarget.type || '').trim().toLowerCase();
    if (rawKind === 'url') {
      const url = String(rawTarget.url || '').trim();
      if (!url) return null;
      return {
        kind: 'url',
        url
      };
    }
    return null;
  }

  function normalizeSupportReminder(rawReminder) {
    if (!rawReminder || typeof rawReminder !== 'object') return null;

    const requestId = String(rawReminder.requestId || '').trim();
    if (!requestId) return null;

    return {
      requestId,
      note: String(rawReminder.note || '').trim(),
      createdAt: String(rawReminder.createdAt || ''),
      updatedAt: String(rawReminder.updatedAt || ''),
      lastSeenAt: String(rawReminder.lastSeenAt || ''),
      lastNotifiedStage: String(rawReminder.lastNotifiedStage || ''),
      skipAutoArchive: !!rawReminder.skipAutoArchive,
      messageTarget: normalizeSupportMessageTarget(rawReminder.messageTarget),
      lastKnown: normalizeSupportRequest(rawReminder.lastKnown) || null
    };
  }

  function normalizeSupportArchiveEntry(rawEntry) {
    if (!rawEntry || typeof rawEntry !== 'object') return null;

    const requestId = String(rawEntry.requestId || '').trim();
    if (!requestId) return null;

    return {
      requestId,
      note: String(rawEntry.note || '').trim(),
      createdAt: String(rawEntry.createdAt || ''),
      updatedAt: String(rawEntry.updatedAt || ''),
      archivedAt: String(rawEntry.archivedAt || ''),
      archivedReason: String(rawEntry.archivedReason || ''),
      messageTarget: normalizeSupportMessageTarget(rawEntry.messageTarget),
      lastKnown: normalizeSupportRequest(rawEntry.lastKnown) || null
    };
  }

  function normalizeSupportReminderState(rawState) {
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const rawReminders = source.reminders && typeof source.reminders === 'object' ? source.reminders : {};
    const rawArchive = source.archive && typeof source.archive === 'object' ? source.archive : {};
    const reminders = {};
    const archive = {};

    Object.values(rawReminders).forEach((item) => {
      const normalized = normalizeSupportReminder(item);
      if (normalized) reminders[normalized.requestId] = normalized;
    });

    Object.values(rawArchive).forEach((item) => {
      const normalized = normalizeSupportArchiveEntry(item);
      if (normalized) archive[normalized.requestId] = normalized;
    });

    return { reminders, archive };
  }

  function makeSupportReminderDeleteOperations(rawState) {
    const state = normalizeSupportReminderState(rawState);
    const operations = [];
    Object.keys(state.reminders).forEach((requestId) => {
      operations.push({ type: 'support_reminder_active_delete', request_id: requestId });
    });
    Object.keys(state.archive).forEach((requestId) => {
      operations.push({ type: 'support_reminder_archive_delete', request_id: requestId });
    });
    return operations;
  }

  function makeSupportReminderOperationsFromState(nextRawState, previousRawState) {
    const nextState = normalizeSupportReminderState(nextRawState);
    const hasPrevious = previousRawState !== undefined;
    const previousState = hasPrevious ? normalizeSupportReminderState(previousRawState) : null;
    const operations = [];

    Object.values(nextState.reminders).forEach((reminder) => {
      const previousReminder = previousState ? previousState.reminders[reminder.requestId] : null;
      if (!previousState || !storageValueEquals(previousReminder, reminder)) {
        operations.push({
          type: 'support_reminder_set',
          request_id: reminder.requestId,
          reminder
        });
      }
    });

    Object.values(nextState.archive).forEach((archiveEntry) => {
      const previousArchiveEntry = previousState ? previousState.archive[archiveEntry.requestId] : null;
      if (!previousState || !storageValueEquals(previousArchiveEntry, archiveEntry)) {
        operations.push({
          type: 'support_reminder_archive_set',
          request_id: archiveEntry.requestId,
          archive: archiveEntry
        });
      }
    });

    if (previousState) {
      Object.keys(previousState.reminders).forEach((requestId) => {
        if (!nextState.reminders[requestId] && !nextState.archive[requestId]) {
          operations.push({ type: 'support_reminder_active_delete', request_id: requestId });
        }
      });
      Object.keys(previousState.archive).forEach((requestId) => {
        if (!nextState.archive[requestId] && !nextState.reminders[requestId]) {
          operations.push({ type: 'support_reminder_archive_delete', request_id: requestId });
        }
      });
    }

    return operations;
  }

  function expandSupportReminderOperations(operations, previousValues = {}) {
    const expanded = [];

    toArray(operations).forEach((operation) => {
      if (!operation || typeof operation !== 'object') return;
      const type = String(operation.type || '');
      const key = String(operation.key || '').trim();

      if (type === 'kv_set' && key === SUPPORT_REMINDERS_STORAGE_KEY) {
        expanded.push(...makeSupportReminderOperationsFromState(
          operation.value,
          previousValues[SUPPORT_REMINDERS_STORAGE_KEY]
        ));
        return;
      }

      if (type === 'kv_delete' && key === SUPPORT_REMINDERS_STORAGE_KEY) {
        expanded.push(...makeSupportReminderDeleteOperations(previousValues[SUPPORT_REMINDERS_STORAGE_KEY]));
        return;
      }

      expanded.push(operation);
    });

    return expanded;
  }

  function isSupportReminderOperation(operation) {
    const type = String(operation && operation.type || '');
    return SUPPORT_REMINDER_OPERATION_TYPES.has(type);
  }

  async function collectLocalSyncSnapshot() {
    const allData = await storageGet(null);
    const snapshot = {};
    Object.keys(allData || {}).forEach((key) => {
      if (!isSyncableKey(key)) return;
      const sanitized = sanitizeValueForCloud(key, allData[key]);
      if (sanitized !== undefined) snapshot[key] = sanitized;
    });
    return snapshot;
  }

  function normalizeSession(rawSession, fallbackSession = null) {
    const source = rawSession && rawSession.session ? rawSession.session : rawSession;
    if (!source || typeof source !== 'object') return null;
    const accessToken = String(source.access_token || '').trim();
    const refreshToken = String(
      source.refresh_token
      || (fallbackSession && fallbackSession.refresh_token)
      || ''
    ).trim();
    if (!accessToken || !refreshToken) return null;
    const expiresInMs = Number(source.expires_in || 3600) * 1000;
    const rawExpiresAt = Number(source.expires_at || 0);
    const expiresAt = Number.isFinite(rawExpiresAt) && rawExpiresAt > 0
      ? (rawExpiresAt > 10000000000 ? rawExpiresAt : rawExpiresAt * 1000)
      : Date.now() + expiresInMs;
    const user = source.user && typeof source.user === 'object'
      ? source.user
      : (fallbackSession && fallbackSession.user && typeof fallbackSession.user === 'object'
        ? fallbackSession.user
        : null);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: String(source.token_type || 'bearer'),
      expires_at: expiresAt,
      user
    };
  }

  function getUserFromSession(session) {
    const user = session && session.user && typeof session.user === 'object'
      ? session.user
      : null;
    if (!user || !user.id) return null;
    return user;
  }

  function authHeaders(session = null) {
    const headers = {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json'
    };
    if (session && session.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  function extractSupabaseErrorMessage(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object') {
      const fields = ['message', 'error_description', 'error', 'msg', 'detail', 'hint', 'code'];
      for (const field of fields) {
        const value = error[field];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (value && typeof value === 'object') {
          const nestedMessage = extractSupabaseErrorMessage(value);
          if (nestedMessage) return nestedMessage;
        }
      }
      try {
        return JSON.stringify(error);
      } catch (jsonError) {
        return String(error);
      }
    }
    return String(error);
  }

  function localizeSupabaseError(error) {
    const message = extractSupabaseErrorMessage(error) || 'Неизвестная ошибка Supabase.';
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'Неверная почта или пароль.';
    if (lower.includes('email not confirmed')) return 'Почта еще не подтверждена. Проверь письмо от Supabase и затем войди снова.';
    if (lower.includes('user already registered')) return 'Пользователь с такой почтой уже зарегистрирован.';
    if (lower.includes('password should be at least')) return 'Пароль слишком короткий.';
    if (lower.includes('signup_disabled')) return 'Регистрация отключена в настройках Supabase Auth.';
    if (lower.includes('failed to fetch')) return 'NetworkError: не удалось подключиться к Supabase.';
    if (lower.includes('timeout')) return 'timeout: Supabase не ответил вовремя.';
    if (
      lower.includes('invalid refresh token')
      || lower.includes('refresh token not found')
      || lower.includes('refresh token has been revoked')
      || lower.includes('session not found')
      || lower.includes('invalid grant')
    ) {
      return SESSION_REAUTH_REQUIRED_MESSAGE;
    }
    return message;
  }

  function isTimeoutSyncErrorMessage(message) {
    return String(message || '').toLowerCase().includes('timeout:');
  }

  function isConnectivitySyncErrorMessage(message) {
    const lower = String(message || '').toLowerCase();
    return (
      lower.includes('timeout:')
      || lower.includes('networkerror:')
      || lower.includes('failed to fetch')
      || lower.includes('не удалось подключиться')
    );
  }

  function createSupabaseSyncNotification(message) {
    const notificationMessage = String(message || '').trim();
    if (!notificationMessage) return;

    const options = {
      type: 'basic',
      iconUrl: chrome.runtime && typeof chrome.runtime.getURL === 'function'
        ? chrome.runtime.getURL('icon.png')
        : 'icon.png',
      title: 'Проблемы синхронизации Supabase',
      message: notificationMessage
    };

    if (typeof globalThis.createExtensionNotification === 'function') {
      globalThis.createExtensionNotification(options);
      return;
    }

    if (!chrome.notifications || typeof chrome.notifications.create !== 'function') return;

    try {
      chrome.notifications.create(`dup-supabase-sync-${Date.now()}`, options, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('Supabase sync notification error:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.warn('Supabase sync notification error:', error);
    }
  }

  function buildSyncIssueInfo(code, message, options = {}) {
    const pendingCount = Math.max(0, Math.trunc(Number(options.outboxSize || 0)));
    const hint = 'Проверь доступ к supabase.co / supabase.com и маршрут через прокси.';

    if (String(code || '') === 'queue-stalled') {
      const queueText = pendingCount > 0 ? ` В очереди: ${pendingCount}.` : '';
      return {
        code: 'queue-stalled',
        message: `Очередь изменений не уменьшается дольше 5с.${queueText} ${hint}`.trim()
      };
    }

    const phaseLabel = String(options.phase || '') === 'pull' ? 'REST pull' : 'REST push';
    const problemText = isTimeoutSyncErrorMessage(message)
      ? 'не получил ответ вовремя'
      : 'не смог подключиться к Supabase';

    return {
      code: 'connectivity',
      message: `${phaseLabel} ${problemText}. ${hint}`.trim()
    };
  }

  async function reportSyncIssue(code, message, options = {}) {
    const issue = buildSyncIssueInfo(code, message, options);
    await setSyncMeta({
      syncHealthCode: issue.code,
      syncHealthMessage: issue.message,
      syncHealthAt: new Date().toISOString()
    });
    if (!syncIssueActive) {
      syncIssueActive = true;
      createSupabaseSyncNotification(issue.message);
    }
    return issue;
  }

  async function clearSyncIssue() {
    syncIssueActive = false;
    await setSyncMeta({
      syncHealthCode: '',
      syncHealthMessage: '',
      syncHealthAt: ''
    });
  }

  async function updateSyncTestStatus(status, message) {
    await setSyncMeta({
      lastSyncTestAt: new Date().toISOString(),
      lastSyncTestStatus: String(status || ''),
      lastSyncTestMessage: String(message || '').trim()
    });
  }

  function isRevokedSessionError(error) {
    const message = extractSupabaseErrorMessage(error).toLowerCase();
    if (!message) return false;
    return (
      message.includes('invalid refresh token')
      || message.includes('refresh token not found')
      || message.includes('refresh token has been revoked')
      || message.includes('session not found')
      || message.includes('invalid grant')
    );
  }

  async function parseSupabaseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        const timeoutError = new Error('timeout');
        timeoutError.isTimeout = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchSupabaseWithTimeout(path, options = {}) {
    await assertTransportAvailable();
    let lastError = null;
    const defaultOriginIndexes = SUPABASE_ORIGINS.map((_, index) => index);
    const originIndexes = Date.now() < supabaseFallbackUntil
      ? [...defaultOriginIndexes.slice(1), defaultOriginIndexes[0]]
      : defaultOriginIndexes;

    for (let offset = 0; offset < originIndexes.length; offset += 1) {
      const originIndex = originIndexes[offset];
      const origin = SUPABASE_ORIGINS[originIndex];
      try {
        const response = await fetchWithTimeout(`${origin}${path}`, options);
        if (Number(response.status) === 402) {
          await setSyncMeta({ transportPausedUntil: Date.now() + 6 * 60 * 60 * 1000 });
          stopRealtimeSubscription({ keepWanted: true });
          const error = new Error('Квота Supabase исчерпана. Отправка приостановлена на 6 часов; изменения сохранены локально.');
          error.status = 402;
          throw error;
        }
        const isGatewayFailure = [502, 503, 504].includes(Number(response.status));
        if (isGatewayFailure && offset < originIndexes.length - 1) {
          if (originIndex === 0) {
            supabaseFallbackUntil = Date.now() + SUPABASE_FALLBACK_COOLDOWN_MS;
          }
          continue;
        }
        if (originIndex === 0) supabaseFallbackUntil = 0;
        if ([408, 429, 500, 502, 503, 504].includes(Number(response.status))) {
          const retrySeconds = Number(response.headers && response.headers.get('Retry-After')) || 60;
          const meta = await getSyncMeta();
          const failures = Math.min(5, Number(meta.transportFailures || 0) + 1);
          await setSyncMeta({ transportFailures: failures,
            transportRetryUntil: Date.now() + Math.max(retrySeconds * 1000, Math.min(900000, 60000 * (2 ** (failures - 1)))) });
        }
        return response;
      } catch (error) {
        if (error && error.status === 402) throw error;
        lastError = error;
        if (originIndex === 0) {
          supabaseFallbackUntil = Date.now() + SUPABASE_FALLBACK_COOLDOWN_MS;
        }
        if (offset >= originIndexes.length - 1) {
          const meta = await getSyncMeta();
          const failures = Math.min(5, Number(meta.transportFailures || 0) + 1);
          await setSyncMeta({ transportFailures: failures,
            transportRetryUntil: Date.now() + Math.min(900000, 60000 * (2 ** (failures - 1))) });
          throw error;
        }
      }
    }

    throw lastError || new Error('Supabase transport failed.');
  }

  function isRetryableStatus(status) {
    return [408, 429, 500, 502, 503, 504].includes(Number(status));
  }

  async function assertTransportAvailable() {
    const meta = await getSyncMeta();
    if (Number(meta.transportRetryUntil || 0) > Date.now()) {
      const error = new Error('Supabase временно недоступен. Повтор отложен; изменения сохранены локально.');
      error.status = 503;
      error.isTransportPaused = true;
      throw error;
    }
    if (Number(meta.transportPausedUntil || 0) > Date.now()) {
      const error = new Error('Квота Supabase исчерпана. Синхронизация на паузе; изменения сохранены локально.');
      error.status = 402;
      throw error;
    }
  }

  async function loadStoredSession() {
    const result = await storageGet(AUTH_SESSION_KEY);
    const session = normalizeSession(result[AUTH_SESSION_KEY]);
    currentSession = session;
    currentUser = getUserFromSession(session);
    return session;
  }

  async function persistSession(session) {
    const normalized = normalizeSession(session, currentSession);
    if (!normalized) {
      throw new Error('Supabase не вернул корректную сессию.');
    }
    currentSession = normalized;
    currentUser = getUserFromSession(normalized);
    await storageSet({ [AUTH_SESSION_KEY]: normalized });
  }

  async function clearStoredSession() {
    currentSession = null;
    currentUser = null;
    await storageRemove(AUTH_SESSION_KEY);
  }

  async function invalidateSession(message = SESSION_REAUTH_REQUIRED_MESSAGE) {
    stopRealtimeSubscription();
    clearFallbackPullAlarm();
    await clearStoredSession();
    lastRuntimeError = message;
    lastRuntimeMessage = message;
    await setSyncMeta({
      lastError: message,
      realtimeStatus: '',
      realtimeLastError: ''
    });
    await broadcastStatus(message);
  }

  async function refreshSession() {
    if (refreshSessionPromise) return refreshSessionPromise;

    refreshSessionPromise = (async () => {
      if (!currentSession) await loadStoredSession();
      if (!currentSession || !currentSession.refresh_token) {
        throw new Error('Нет активной Supabase-сессии.');
      }

      const previousSession = currentSession;
      const response = await fetchSupabaseWithTimeout('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: authHeaders(null),
        body: JSON.stringify({ refresh_token: previousSession.refresh_token })
      });
      const data = await parseSupabaseResponse(response);
      if (!response.ok) {
        const localizedMessage = localizeSupabaseError(data || response.statusText);
        const error = new Error(localizedMessage);
        error.status = response.status;
        error.payload = data;
        if (isRevokedSessionError(data || response.statusText)) {
          await invalidateSession(localizedMessage);
        }
        throw error;
      }
      const session = normalizeSession(data, previousSession);
      if (!session) throw new Error('Supabase не вернул новую сессию.');
      await persistSession(session);
      return currentSession;
    })();

    try {
      return await refreshSessionPromise;
    } finally {
      refreshSessionPromise = null;
    }
  }

  async function ensureSession() {
    if (!currentSession) await loadStoredSession();
    let session = currentSession;
    if (!session) throw new Error('Пользователь не авторизован.');
    if (Number(session.expires_at || 0) - Date.now() < SESSION_REFRESH_MARGIN_MS) {
      session = await refreshSession();
    }
    return session;
  }

  async function supabaseFetch(path, options = {}, requireAuth = true, retryOnUnauthorized = true) {
    let attempt = 0;
    let refreshedAfter401 = !retryOnUnauthorized;

    while (true) {
      const session = requireAuth ? await ensureSession() : null;
      let response = null;
      let data = null;
      try {
        response = await fetchSupabaseWithTimeout(path, {
          ...options,
          headers: {
            ...authHeaders(session),
            ...(options.headers || {})
          }
        });
        data = await parseSupabaseResponse(response);

        if (response.status === 401 && requireAuth && !refreshedAfter401) {
          refreshedAfter401 = true;
          await refreshSession();
          continue;
        }

        if (!response.ok) {
          const error = new Error(localizeSupabaseError(data || response.statusText));
          error.status = response.status;
          error.payload = data;
          throw error;
        }

        await setSyncMeta({ transportFailures: 0, transportRetryUntil: 0 });
        return data;
      } catch (error) {
        const retryable = error && !error.isTransportPaused && (
          error.isTimeout ||
          error.status === undefined ||
          isRetryableStatus(error.status)
        );
        if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
          throw error;
        }
        await delay(RETRY_DELAYS_MS[attempt]);
        attempt += 1;
      }
    }
  }

  async function callRpc(name, payload = {}) {
    return supabaseFetch(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, true);
  }

  async function fetchCurrentUser() {
    const data = await supabaseFetch('/auth/v1/user', { method: 'GET' }, true);
    const user = data && data.id ? data : (data && data.user ? data.user : null);
    if (user && currentSession) {
      currentSession = { ...currentSession, user };
      currentUser = user;
      await storageSet({ [AUTH_SESSION_KEY]: currentSession });
    }
    return user || null;
  }

  async function getSyncMeta() {
    const data = await storageGet(SYNC_META_KEY);
    return data[SYNC_META_KEY] && typeof data[SYNC_META_KEY] === 'object'
      ? data[SYNC_META_KEY]
      : {};
  }

  async function setSyncMeta(nextMeta) {
    const run = syncMetaLock.catch(() => {}).then(async () => {
      const previous = await getSyncMeta();
      await storageSet({ [SYNC_META_KEY]: { ...previous, ...nextMeta } });
    });
    syncMetaLock = run.catch(() => {});
    return run;
  }

  async function getCacheRevision() {
    const data = await storageGet(CACHE_REVISION_KEY);
    const revision = Number(data[CACHE_REVISION_KEY] || 0);
    return Number.isFinite(revision) ? Math.max(0, Math.trunc(revision)) : 0;
  }

  async function setCacheRevision(revision) {
    const normalized = Number(revision || 0);
    await storageSet({ [CACHE_REVISION_KEY]: Number.isFinite(normalized) ? Math.max(0, Math.trunc(normalized)) : 0 });
  }

  async function getOutbox() {
    const data = await storageGet(OUTBOX_KEY);
    return Array.isArray(data[OUTBOX_KEY]) ? data[OUTBOX_KEY] : [];
  }

  async function setOutbox(outbox) {
    await storageSet({ [OUTBOX_KEY]: Array.isArray(outbox) ? outbox : [] });
  }

  function withOutboxLock(task) {
    const run = outboxLock.catch(() => {}).then(task);
    outboxLock = run.catch(() => {});
    return run;
  }

  async function updateOutboxLocked(updater) {
    return withOutboxLock(async () => {
      const currentOutbox = await getOutbox();
      const result = await updater(currentOutbox);
      const nextOutbox = Array.isArray(result && result.outbox)
        ? result.outbox
        : currentOutbox;
      if (nextOutbox !== currentOutbox) {
        await setOutbox(nextOutbox);
      }
      return {
        ...(result && typeof result === 'object' ? result : {}),
        outbox: nextOutbox
      };
    });
  }

  async function appendOutboxOperationsUnlocked(operations, reason = 'local-change') {
    const filteredOperations = expandSupportReminderOperations(operations)
      .filter((operation) => operation && typeof operation === 'object');
    if (!filteredOperations.length) return { queued: false };
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return { queued: false, localOnly: true };

    const deviceId = await getDeviceId();
    const outbox = await getOutbox();
    const item = {
      mutationId: makeMutationId(deviceId),
      deviceId,
      baseRevision: await getCacheRevision(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: '',
      reason,
      operations: filteredOperations
    };
    const nextOutbox = [...outbox, item];
    const compactResult = flushInProgress
      ? { outbox: nextOutbox, changed: false, beforeCount: nextOutbox.length, afterCount: nextOutbox.length }
      : compactOutboxItems(nextOutbox);
    const finalOutbox = compactResult.outbox;
    await setOutbox(finalOutbox);
    const meta = {
      outboxSize: finalOutbox.length,
      lastQueuedAt: new Date().toISOString(),
      lastError: ''
    };
    if (compactResult.changed) {
      meta.lastOutboxCompactAt = new Date().toISOString();
      meta.lastOutboxCompactReason = reason;
      meta.lastOutboxCompactBefore = compactResult.beforeCount;
      meta.lastOutboxCompactAfter = compactResult.afterCount;
    }
    await setSyncMeta({
      ...meta
    });
    return {
      queued: true,
      item,
      outboxSize: finalOutbox.length,
      compacted: compactResult.changed === true
    };
  }

  async function claimNextOutboxItemForAttempt() {
    return updateOutboxLocked(async (outbox) => {
      if (!outbox.length) return { item: null, outbox };
      const meta = await getSyncMeta();
      const sequence = Number(outbox[0].sequence || Math.max(Date.now(), Number(meta.lastSequence || 0) + 1));
      await setSyncMeta({ lastSequence: Math.max(sequence, Number(meta.lastSequence || 0)) });
      const item = {
        ...outbox[0],
        sequence,
        attempts: Number(outbox[0].attempts || 0) + 1,
        lastAttemptAt: new Date().toISOString()
      };
      return {
        item,
        outbox: [item, ...outbox.slice(1)]
      };
    });
  }

  async function removeOutboxItemByMutationId(mutationId) {
    const normalizedMutationId = String(mutationId || '');
    return updateOutboxLocked(async (outbox) => {
      const nextOutbox = outbox.filter((item) => String(item && item.mutationId || '') !== normalizedMutationId);
      return {
        removed: nextOutbox.length !== outbox.length,
        outbox: nextOutbox
      };
    });
  }

  async function rebaseOutboxItemByMutationId(sourceItem, baseRevision, errorText) {
    const sourceMutationId = String(sourceItem && sourceItem.mutationId || '');
    return updateOutboxLocked(async (outbox) => {
      const index = outbox.findIndex((item) => String(item && item.mutationId || '') === sourceMutationId);
      if (index < 0) return { rebased: false, item: null, outbox };

      const currentItem = outbox[index] || sourceItem;
      const nextItem = {
        ...currentItem,
        mutationId: makeMutationId(currentItem.deviceId || sourceItem.deviceId),
        baseRevision,
        lastError: String(errorText || 'revision_mismatch'),
        rebasedAt: new Date().toISOString()
      };
      const nextOutbox = [...outbox];
      nextOutbox[index] = nextItem;
      return {
        rebased: true,
        item: nextItem,
        outbox: nextOutbox
      };
    });
  }

  async function markOutboxItemError(mutationId, message, fallbackAttempts = 0) {
    const normalizedMutationId = String(mutationId || '');
    return updateOutboxLocked(async (outbox) => {
      const index = outbox.findIndex((item) => String(item && item.mutationId || '') === normalizedMutationId);
      if (index < 0) return { updated: false, outbox };

      const nextItem = {
        ...outbox[index],
        attempts: Number(outbox[index].attempts || fallbackAttempts || 0),
        lastError: message,
        lastAttemptAt: new Date().toISOString()
      };
      const nextOutbox = [...outbox];
      nextOutbox[index] = nextItem;
      return {
        updated: true,
        outbox: nextOutbox
      };
    });
  }

  function isLastWriteWinsOutboxOperation(operation) {
    if (!operation || typeof operation !== 'object') return false;
    const type = String(operation.type || '');
    const key = String(operation.key || '').trim();
    return ['kv_set', 'kv_delete'].includes(type) && LAST_WRITE_WINS_OUTBOX_KEYS.has(key);
  }

  function isProcessedEdocidsAddOperation(operation) {
    if (!operation || typeof operation !== 'object') return false;
    if (String(operation.type || '') !== 'processed_edocids_add') return false;
    const dateIso = String(operation.date_iso || '').trim();
    return !!dateIso && uniqueStrings(operation.edocids).length > 0;
  }

  function isCounterIncrementOperation(operation) {
    if (!operation || typeof operation !== 'object') return false;
    if (String(operation.type || '') !== 'counter_increment') return false;
    const counterKey = String(operation.counter_key || '').trim();
    const dateKey = String(operation.date_key || '').trim();
    const delta = Math.trunc(Number(operation.delta || 0));
    return !!counterKey && !!dateKey && Number.isFinite(delta) && delta !== 0;
  }

  function isCompactableOutboxOperation(operation) {
    return isLastWriteWinsOutboxOperation(operation)
      || isProcessedEdocidsAddOperation(operation)
      || isCounterIncrementOperation(operation);
  }

  function makeCompactOutboxBlockItem(block) {
    const items = toArray(block).filter((item) => item && typeof item === 'object');
    if (!items.length) return null;

    const snapshotByKey = new Map();
    const edocidsByDate = new Map();
    const counterIncrementsByKey = new Map();
    const originalOperations = [];
    let operationOrder = 0;
    let maxAttempts = 0;
    let baseRevision = 0;

    items.forEach((item) => {
      maxAttempts = Math.max(maxAttempts, Number(item.attempts || 0));
      const itemBaseRevision = Number(item.baseRevision || 0);
      if (Number.isFinite(itemBaseRevision)) {
        baseRevision = Math.max(baseRevision, Math.max(0, Math.trunc(itemBaseRevision)));
      }

      toArray(item.operations).forEach((operation) => {
        if (!isCompactableOutboxOperation(operation)) return;
        const order = operationOrder;
        operationOrder += 1;
        originalOperations.push(operation);

        if (isLastWriteWinsOutboxOperation(operation)) {
          const key = String(operation.key || '').trim();
          const type = String(operation.type || '');
          snapshotByKey.set(key, {
            order,
            operation: type === 'kv_delete'
              ? { type: 'kv_delete', key }
              : { type: 'kv_set', key, value: cloneJson(operation.value) }
          });
          return;
        }

        if (isProcessedEdocidsAddOperation(operation)) {
          const dateIso = String(operation.date_iso || '').trim();
          const dateKey = String(operation.date_key || '').trim() || isoToRuDateKey(dateIso);
          const mapKey = `${dateIso}\n${dateKey}`;
          const existing = edocidsByDate.get(mapKey) || {
            order,
            dateIso,
            dateKey,
            edocids: []
          };

          uniqueStrings(operation.edocids).forEach((edocid) => {
            if (!existing.edocids.includes(edocid)) existing.edocids.push(edocid);
          });
          edocidsByDate.set(mapKey, existing);
          return;
        }

        const counterKey = String(operation.counter_key || '').trim();
        const dateKey = String(operation.date_key || '').trim();
        const mapKey = `${counterKey}\n${dateKey}`;
        const existing = counterIncrementsByKey.get(mapKey) || {
          order,
          counterKey,
          dateKey,
          delta: 0
        };
        existing.delta += Math.trunc(Number(operation.delta || 0));
        counterIncrementsByKey.set(mapKey, existing);
      });
    });

    const entries = [];
    snapshotByKey.forEach((entry) => entries.push(entry));
    edocidsByDate.forEach((entry) => {
      if (!entry.edocids.length) return;
      entries.push({
        order: entry.order,
        operation: {
          type: 'processed_edocids_add',
          date_iso: entry.dateIso,
          date_key: entry.dateKey,
          edocids: entry.edocids
        }
      });
    });
    counterIncrementsByKey.forEach((entry) => {
      if (!entry.delta) return;
      entries.push({
        order: entry.order,
        operation: {
          type: 'counter_increment',
          counter_key: entry.counterKey,
          date_key: entry.dateKey,
          delta: entry.delta
        }
      });
    });

    const operations = entries
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.operation);

    if (!operations.length) return null;

    const originalSignature = JSON.stringify(originalOperations);
    const compactedSignature = JSON.stringify(operations);
    if (items.length === 1 && originalSignature === compactedSignature) {
      return items[0];
    }

    const lastItem = items[items.length - 1] || {};
    const deviceId = String(lastItem.deviceId || items[0].deviceId || '').trim();
    const reason = items
      .map((item) => String(item.reason || '').trim())
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 3)
      .join('+') || 'outbox-compact';

    return {
      ...lastItem,
      mutationId: makeMutationId(deviceId || 'device:compact'),
      deviceId: deviceId || lastItem.deviceId || items[0].deviceId || '',
      baseRevision,
      attempts: maxAttempts,
      lastError: '',
      reason,
      compactedAt: new Date().toISOString(),
      compactedItemsCount: items.length,
      compactedOperationsCount: originalOperations.length,
      operations
    };
  }

  function compactOutboxItems(outbox) {
    const source = toArray(outbox).filter((item) => item && typeof item === 'object');
    const nextOutbox = [];
    let block = [];
    let compactedItemsCount = 0;
    let compactedOperationsCount = 0;

    function flushBlock() {
      if (!block.length) return;
      const item = makeCompactOutboxBlockItem(block);
      if (item) nextOutbox.push(item);
      if (block.length > 1 || item !== block[0]) {
        compactedItemsCount += block.length;
        compactedOperationsCount += block.reduce((sum, blockItem) => sum + toArray(blockItem.operations).length, 0);
      }
      block = [];
    }

    source.forEach((item) => {
      const operations = toArray(item.operations).filter((operation) => operation && typeof operation === 'object');
      if (!item.attempts && !item.sequence && operations.length && operations.every(isCompactableOutboxOperation)) {
        block.push(item);
        return;
      }

      flushBlock();
      nextOutbox.push(item);
    });

    flushBlock();

    const changed = nextOutbox.length !== source.length ||
      nextOutbox.some((item, index) => item !== source[index]);

    return {
      outbox: changed ? nextOutbox : outbox,
      changed,
      beforeCount: source.length,
      afterCount: nextOutbox.length,
      compactedItemsCount,
      compactedOperationsCount
    };
  }

  async function compactOutboxLocked(reason = 'manual') {
    return updateOutboxLocked(async (outbox) => {
      const cleaned = removeIdCardCheckOutboxOperations(outbox);
      const result = compactOutboxItems(cleaned);
      if (cleaned !== outbox) {
        result.changed = true;
        result.beforeCount = outbox.length;
      }
      if (!result.changed) return { ...result, outbox };

      await setSyncMeta({
        outboxSize: result.outbox.length,
        lastOutboxCompactAt: new Date().toISOString(),
        lastOutboxCompactReason: reason,
        lastOutboxCompactBefore: result.beforeCount,
        lastOutboxCompactAfter: result.afterCount
      });

      return result;
    });
  }

  function removeIdCardCheckOutboxOperations(outbox) {
    let changed = false;
    const cleaned = toArray(outbox).flatMap((item) => {
      const operations = toArray(item && item.operations).filter((operation) => !(
        operation && ['kv_set', 'kv_delete'].includes(operation.type) &&
        operation.key === 'dup_id_card_check_state_v1'
      ));
      if (operations.length === toArray(item && item.operations).length) return [item];
      changed = true;
      return operations.length ? [{ ...item, operations }] : [];
    });
    return changed ? cleaned : outbox;
  }

  function createRandomId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  async function getDeviceId() {
    const data = await storageGet(DEVICE_ID_KEY);
    const existing = String(data[DEVICE_ID_KEY] || '').trim();
    if (existing) return existing;
    const next = `device:${createRandomId()}`;
    await storageSet({ [DEVICE_ID_KEY]: next });
    return next;
  }

  function getBrowserName() {
    const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/firefox/i.test(ua)) return 'Firefox';
    if (/edg/i.test(ua)) return 'Edge';
    if (/chrome|chromium/i.test(ua)) return 'Chrome';
    return 'Browser';
  }

  function getDeviceName() {
    return `${getBrowserName()} ${new Date().toLocaleDateString('ru-RU')}`;
  }

  function makeMutationId(deviceId) {
    return `${deviceId}:${Date.now()}:${createRandomId()}`;
  }

  function createSyncFlowSteps(kind) {
    if (kind === 'push') {
      return [
        { id: 'prepare', label: 'Подготовка сессии', status: 'pending', detail: '' },
        { id: 'request', label: 'Запрос отправлен в Supabase', status: 'pending', detail: '' },
        { id: 'write', label: 'Supabase применяет запись', status: 'pending', detail: '' },
        { id: 'response', label: 'Ответ Supabase получен', status: 'pending', detail: '' },
        { id: 'cache', label: 'Локальный кэш обновлен', status: 'pending', detail: '' }
      ];
    }

    return [
      { id: 'prepare', label: 'Подготовка сессии', status: 'pending', detail: '' },
      { id: 'request', label: 'Запрос состояния отправлен', status: 'pending', detail: '' },
      { id: 'response', label: 'Ответ Supabase получен', status: 'pending', detail: '' },
      { id: 'cache', label: 'Локальный кэш обновлен', status: 'pending', detail: '' },
      { id: 'panel', label: 'Панель получила статус', status: 'pending', detail: '' }
    ];
  }

  function startSyncFlow(kind, title) {
    syncFlowState = {
      kind,
      title,
      active: true,
      steps: createSyncFlowSteps(kind),
      updatedAt: new Date().toISOString()
    };
  }

  function setSyncFlowStep(stepId, status, detail = '') {
    if (!syncFlowState || !Array.isArray(syncFlowState.steps)) return;
    syncFlowState.steps = syncFlowState.steps.map((step) => {
      if (!step || step.id !== stepId) return step;
      return {
        ...step,
        status,
        detail: String(detail || '')
      };
    });
    syncFlowState.updatedAt = new Date().toISOString();
  }

  function setSyncFlowError(message) {
    if (!syncFlowState || !Array.isArray(syncFlowState.steps)) return;
    let marked = false;
    syncFlowState.steps = syncFlowState.steps.map((step) => {
      if (marked || !step || step.status === 'done') return step;
      marked = true;
      return {
        ...step,
        status: 'error',
        detail: String(message || '')
      };
    });
    syncFlowState.active = false;
    syncFlowState.updatedAt = new Date().toISOString();
  }

  function finishSyncFlow(success, message = '') {
    if (!syncFlowState || !Array.isArray(syncFlowState.steps)) return;
    syncFlowState.steps = syncFlowState.steps.map((step) => {
      if (!step || step.status === 'done') return step;
      if (success) {
        return { ...step, status: 'done', detail: step.detail || '' };
      }
      if (step.status === 'active') {
        return { ...step, status: 'error', detail: String(message || '') };
      }
      return step;
    });
    syncFlowState.active = false;
    syncFlowState.updatedAt = new Date().toISOString();
  }

  function getPublicSyncFlow() {
    return {
      kind: syncFlowState.kind || '',
      title: syncFlowState.title || '',
      active: syncFlowState.active === true,
      updatedAt: syncFlowState.updatedAt || '',
      steps: toArray(syncFlowState.steps).map((step) => ({
        id: String(step.id || ''),
        label: String(step.label || ''),
        status: String(step.status || 'pending'),
        detail: String(step.detail || '')
      }))
    };
  }

  function normalizeCanonicalState(rawState) {
    if (!rawState || typeof rawState !== 'object') {
      return {
        schema_version: SCHEMA_VERSION,
        revision: 0,
        kv: {},
        counter_days: [],
        processed_edits: [],
        processed_edocids: [],
        action_rules: []
      };
    }
    const normalized = {
      schema_version: Number(rawState.schema_version || SCHEMA_VERSION),
      revision: Number(rawState.revision || 0),
      kv: rawState.kv && typeof rawState.kv === 'object' && !Array.isArray(rawState.kv) ? rawState.kv : {},
      counter_days: Array.isArray(rawState.counter_days) ? rawState.counter_days : [],
      processed_edits: Array.isArray(rawState.processed_edits) ? rawState.processed_edits : [],
      processed_edocids: Array.isArray(rawState.processed_edocids) ? rawState.processed_edocids : [],
      action_rules: Array.isArray(rawState.action_rules) ? rawState.action_rules : [],
      server_time: rawState.server_time || ''
    };
    ['status', 'applied_revision', 'current_revision', 'error', 'unchanged'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(rawState, key)) {
        normalized[key] = rawState[key];
      }
    });
    return normalized;
  }

  function buildLocalCacheFromCanonical(rawState) {
    const state = normalizeCanonicalState(rawState);
    const values = {};

    Object.keys(state.kv || {}).forEach((key) => {
      if (key === SUPPORT_REMINDERS_STORAGE_KEY || isKvSyncKey(key)) {
        values[key] = cloneJson(state.kv[key]);
      }
    });

    const statsHistory = {};
    const editingStats = {};
    state.counter_days.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const counterKey = String(row.counter_key || '').trim();
      const dateKey = String(row.date_key || '').trim();
      if (!dateKey) return;
      if (counterKey === 'stats_history') {
        statsHistory[dateKey] = toNonNegativeInteger(row.value);
      } else if (counterKey === 'editing_stats') {
        editingStats[dateKey] = toNonNegativeInteger(row.value);
      }
    });
    values.stats_history = statsHistory;
    values.editing_stats = editingStats;

    const processedEdits = {};
    state.processed_edits.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const dateIso = String(row.date_iso || '').trim();
      const path = String(row.path || '').trim();
      if (!dateIso || !path) return;
      if (!processedEdits[dateIso]) processedEdits[dateIso] = {};
      processedEdits[dateIso][path] = {
        base_count: toNonNegativeInteger(row.base_count),
        unique_edocids: uniqueStrings(row.unique_edocids)
      };
    });
    values.processed_edits = processedEdits;

    const processedEdocids = {};
    state.processed_edocids.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const dateIso = String(row.date_iso || '').trim();
      const edocid = String(row.edocid || '').trim();
      if (!dateIso || !edocid) return;
      if (!processedEdocids[dateIso]) processedEdocids[dateIso] = [];
      if (!processedEdocids[dateIso].includes(edocid)) {
        processedEdocids[dateIso].push(edocid);
      }
    });
    values.processed_edocids = processedEdocids;

    const approved = [];
    const blocked = [];
    const tags = {};
    state.action_rules.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const path = String(row.path || '').trim();
      const status = String(row.status || '').trim();
      const tag = String(row.tag || '').trim();
      if (!path) return;
      if (status === 'approved' && !approved.includes(path)) approved.push(path);
      if (status === 'blocked' && !blocked.includes(path)) blocked.push(path);
      if (tag) tags[path] = tag;
    });
    values.approved_actions = approved;
    values.blocked_actions = blocked;
    values.action_tags = tags;

    return values;
  }

  async function applyCanonicalState(rawState, options = {}) {
    if (rawState && rawState.unchanged === true) return false;
    return withOutboxLock(async () => {
      const outbox = await getOutbox();
      if (outbox.length) {
        await setSyncMeta({
          serverRevision: Number(rawState && rawState.revision || 0),
          outboxSize: outbox.length,
          lastPullSkippedApplyAt: new Date().toISOString(),
          lastPullSkippedApplyReason: 'outbox-not-empty'
        });
        return false;
      }

      const state = normalizeCanonicalState(rawState);
      const nextValues = buildLocalCacheFromCanonical(state);
      const localData = await storageGet(null);
      const valuesToSet = {};
      const keysToRemove = [];

      Object.keys(nextValues).forEach((key) => {
        if (!storageValueEquals(localData[key], nextValues[key])) {
          valuesToSet[key] = nextValues[key];
        }
      });

      Object.keys(localData || {}).forEach((key) => {
        if (isSyncableKey(key) && !Object.prototype.hasOwnProperty.call(nextValues, key)) {
          keysToRemove.push(key);
        }
      });

      applyingCanonicalState = true;
      try {
        if (keysToRemove.length) await storageRemove(keysToRemove);
        if (Object.keys(valuesToSet).length) await storageSet(valuesToSet);
        await setCacheRevision(state.revision);
      } finally {
        applyingCanonicalState = false;
      }

      return keysToRemove.length > 0 || Object.keys(valuesToSet).length > 0;
    });
  }

  function makeKvOperationsFromValues(values) {
    const operations = [];
    Object.entries(values || {}).forEach(([key, value]) => {
      if (key === SUPPORT_REMINDERS_STORAGE_KEY) return;
      if (!isKvSyncKey(key)) return;
      const sanitized = sanitizeValueForCloud(key, value);
      if (sanitized === undefined) return;
      operations.push({ type: 'kv_set', key, value: sanitized });
    });
    return operations;
  }

  function makeOperationsFromValues(values, previousValues = {}) {
    const operations = makeKvOperationsFromValues(values);
    if (Object.prototype.hasOwnProperty.call(values || {}, SUPPORT_REMINDERS_STORAGE_KEY)) {
      operations.push(...makeSupportReminderOperationsFromState(
        values[SUPPORT_REMINDERS_STORAGE_KEY],
        previousValues[SUPPORT_REMINDERS_STORAGE_KEY]
      ));
    }
    return operations;
  }

  function makeOperationsFromSnapshot(snapshot) {
    const operations = [];

    operations.push(...makeKvOperationsFromValues(snapshot));
    if (Object.prototype.hasOwnProperty.call(snapshot || {}, SUPPORT_REMINDERS_STORAGE_KEY)) {
      operations.push(...makeSupportReminderOperationsFromState(snapshot[SUPPORT_REMINDERS_STORAGE_KEY]));
    }

    ['stats_history', 'editing_stats'].forEach((counterKey) => {
      const history = snapshot && isPlainObject(snapshot[counterKey]) ? snapshot[counterKey] : {};
      Object.entries(history).forEach(([dateKey, value]) => {
        operations.push({
          type: 'counter_set',
          counter_key: counterKey,
          date_key: String(dateKey),
          value: toNonNegativeInteger(value)
        });
      });
    });

    const processedEdocids = snapshot && isPlainObject(snapshot.processed_edocids) ? snapshot.processed_edocids : {};
    Object.entries(processedEdocids).forEach(([dateIso, edocids]) => {
      const uniqueEdocids = uniqueStrings(edocids);
      if (uniqueEdocids.length) {
        operations.push({
          type: 'processed_edocids_add',
          date_iso: String(dateIso),
          date_key: isoToRuDateKey(dateIso),
          edocids: uniqueEdocids
        });
      }
    });

    const processedEdits = snapshot && isPlainObject(snapshot.processed_edits) ? snapshot.processed_edits : {};
    Object.entries(processedEdits).forEach(([dateIso, paths]) => {
      if (!isPlainObject(paths)) return;
      Object.entries(paths).forEach(([path, rawItem]) => {
        const item = normalizeProcessedEditItem(rawItem);
        operations.push({
          type: 'processed_edit_set',
          date_iso: String(dateIso),
          path: String(path),
          base_count: item.base_count,
          unique_edocids: item.unique_edocids
        });
      });
    });

    const approved = new Set(uniqueStrings(snapshot && snapshot.approved_actions));
    const blocked = new Set(uniqueStrings(snapshot && snapshot.blocked_actions));
    const tags = snapshot && isPlainObject(snapshot.action_tags) ? snapshot.action_tags : {};
    const actionPaths = new Set([...approved, ...blocked, ...Object.keys(tags || {})]);
    actionPaths.forEach((path) => {
      const status = blocked.has(path) ? 'blocked' : 'approved';
      operations.push({
        type: 'action_rule_set',
        path,
        status,
        tag: String(tags[path] || '').trim()
      });
    });

    return operations;
  }

  function normalizeProcessedEditItem(rawItem) {
    if (isPlainObject(rawItem)) {
      return {
        base_count: toNonNegativeInteger(rawItem.base_count),
        unique_edocids: uniqueStrings(rawItem.unique_edocids)
      };
    }
    if (Array.isArray(rawItem)) {
      return {
        base_count: rawItem.length,
        unique_edocids: uniqueStrings(rawItem)
      };
    }
    return {
      base_count: toNonNegativeInteger(rawItem),
      unique_edocids: []
    };
  }

  function isoToRuDateKey(dateIso) {
    const parts = String(dateIso || '').split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return String(dateIso || '');
  }

  function ruDateKeyToIso(dateKey) {
    const parts = String(dateKey || '').split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return String(dateKey || '');
  }

  async function registerDevice() {
    const deviceId = await getDeviceId();
    const meta = await getSyncMeta();
    if (meta.deviceId === deviceId && Date.now() - Date.parse(meta.lastDeviceRegisterAt || '') < 60 * 60 * 1000) {
      return { revision: Number(meta.serverRevision || 0) };
    }
    const data = await callRpc('extension_register_device_v3', {
      p_device_id: deviceId,
      p_device_name: getDeviceName(),
      p_browser: getBrowserName()
    });
    const state = data && data.state ? data.state : data;
    await setSyncMeta({
      deviceId,
      lastSequence: Math.max(Number(meta.lastSequence || 0), Number(data.last_sequence || 0)),
      lastDeviceRegisterAt: new Date().toISOString()
    });
    return normalizeCanonicalState(state);
  }

  async function getRemoteCanonicalState(reason = 'pull', force = false) {
    const localRevision = await getCacheRevision();
    const data = await callRpc('extension_get_state_v3', {
      p_since_revision: force ? null : (localRevision || null)
    });
    const state = normalizeCanonicalState(data);
    await setSyncMeta({
      serverRevision: state.revision,
      lastPullCheckAt: new Date().toISOString(),
      lastPullReason: reason
    });
    return state;
  }

  async function appendOutboxOperations(operations, reason = 'local-change') {
    const result = await withOutboxLock(() => appendOutboxOperationsUnlocked(operations, reason));
    if (result && result.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return result;
  }

  function scheduleFlushOutbox(reason = 'queued') {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = 0;
      void flushOutbox(reason);
    }, FLUSH_DEBOUNCE_MS);
  }

  async function applyMutationItem(item) {
    const result = await callRpc('extension_apply_mutation_v3', {
      p_device_id: item.deviceId,
      p_sequence: item.sequence,
      p_mutation_id: item.mutationId,
      p_base_revision: item.baseRevision,
      p_operations: expandSupportReminderOperations(item.operations)
    });
    if (result && result.status === 'rate_limited') {
      await setSyncMeta({ transportRetryUntil: Date.now() + Number(result.retry_after_ms || 300000) });
      const error = new Error('Слишком частая синхронизация. Отправка отложена на 5 минут; очередь сохранена.');
      error.status = 429;
      throw error;
    }
    if (!result || !['applied', 'conflict'].includes(result.status)) {
      throw new Error('Supabase не подтвердил сохранение изменения.');
    }
    return result;
  }

  async function flushOutbox(reason = 'manual') {
    if (flushInProgress) return { success: true, skipped: 'flush-in-progress' };
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return { success: false, error: 'NO_SESSION' };

    flushInProgress = true;
    startSyncFlow('push', 'Отправка изменений в Supabase');
    setSyncFlowStep('prepare', 'active', reason);
    await broadcastStatus('Готовлю отправку изменений в Supabase...');
    try {
      await ensureSession();
      await registerDevice();
      setSyncFlowStep('prepare', 'done');

      const compactResult = await compactOutboxLocked(reason);
      let conflictRetries = 0;
      if (compactResult.changed) {
        setSyncFlowStep(
          'request',
          'active',
          `Очередь сжата: ${compactResult.beforeCount} -> ${compactResult.afterCount}`
        );
        await broadcastStatus(`Очередь изменений сжата: ${compactResult.beforeCount} -> ${compactResult.afterCount}.`);
      }

      while (true) {
        const claim = await claimNextOutboxItemForAttempt();
        if (!claim.item) {
          await setSyncMeta({
            outboxSize: 0,
            lastPushError: '',
            lastError: '',
            lastFlushAt: new Date().toISOString()
          });
          lastRuntimeError = '';
          finishSyncFlow(true);
          await broadcastStatus('Очередь изменений пуста.');
          return { success: true };
        }

        const item = claim.item;
        const pendingBeforeAttempt = claim.outbox.length;
        let stallTimer = 0;

        try {
          setSyncFlowStep('request', 'active', `Операций: ${toArray(item.operations).length}`);
          setSyncFlowStep('write', 'active', 'Ожидаю подтверждение записи');
          setSyncFlowStep('response', 'pending');
          setSyncFlowStep('cache', 'pending');
          await broadcastStatus('Запрос отправлен в Supabase...');
          stallTimer = setTimeout(() => {
            void reportSyncIssue('queue-stalled', 'Очередь изменений не уменьшается дольше 5с.', {
              phase: 'push',
              outboxSize: pendingBeforeAttempt
            });
          }, SYNC_STALL_THRESHOLD_MS);
          await delay(1000);
          const state = await applyMutationItem(item);
          if (stallTimer) clearTimeout(stallTimer);
          setSyncFlowStep('request', 'done');
          setSyncFlowStep('write', state && state.status === 'conflict' ? 'error' : 'done');
          setSyncFlowStep('response', 'done', 'Сервер подтвердил запись');
          if (state && state.status === 'conflict') {
            conflictRetries += 1;
            if (conflictRetries >= 3) throw new Error(state.error || 'Повторный конфликт синхронизации.');
            const metaState = await getRemoteCanonicalState('conflict-rebase');
            const rebasedRevision = Number(metaState.revision || state.current_revision || 0);
            const rebaseResult = await rebaseOutboxItemByMutationId(
              item,
              rebasedRevision,
              String(state.error || 'revision_mismatch')
            );
            if (String(state.error || '').startsWith('unknown_operation')) {
              throw new Error(state.error);
            }
            await setSyncMeta({
              outboxSize: rebaseResult.outbox.length,
              serverRevision: rebasedRevision,
              lastPushError: String(state.error || 'revision_mismatch'),
              lastReason: reason
            });
            setSyncFlowStep('write', 'active', 'Повторяю отправку после обновления состояния сервера');
            continue;
          }

          const removeResult = await removeOutboxItemByMutationId(item.mutationId);
          const pendingAfterRemove = removeResult.outbox.length;
          let applied = false;
          if (pendingAfterRemove === 0) {
            setSyncFlowStep('cache', 'active', 'Применяю ответ локально');
            const canonical = await getRemoteCanonicalState('push-complete');
            applied = await applyCanonicalState(canonical, { force: true });
            setSyncFlowStep('cache', 'done', applied ? 'Кэш обновлен' : 'Кэш уже актуален');
          } else {
            setSyncFlowStep('cache', 'done', 'Есть новые pending изменения, canonical state не применен');
          }
          const latestOutbox = await getOutbox();
          await setSyncMeta({
            outboxSize: latestOutbox.length,
            serverRevision: state.revision,
            localRevision: await getCacheRevision(),
            lastPushAt: new Date().toISOString(),
            lastPushError: '',
            lastError: '',
            lastReason: reason
          });
          await clearSyncIssue();
          lastRuntimeMessage = latestOutbox.length
            ? `Отправлено изменение, осталось в очереди: ${latestOutbox.length}.`
            : 'Все изменения отправлены в Supabase.';
          lastRuntimeError = '';
          if (!latestOutbox.length) finishSyncFlow(true);
          await broadcastStatus(lastRuntimeMessage);
        } catch (error) {
          if (stallTimer) clearTimeout(stallTimer);
          const message = localizeSupabaseError(error);
          const errorResult = await markOutboxItemError(item.mutationId, message, item.attempts);
          lastRuntimeError = message;
          setSyncFlowError(message);
          await setSyncMeta({
            outboxSize: errorResult.outbox.length,
            lastPushError: message,
            lastError: message,
            lastPushAttemptAt: new Date().toISOString()
          });
          if (isConnectivitySyncErrorMessage(message)) {
            await reportSyncIssue('connectivity', message, {
              phase: 'push',
              outboxSize: errorResult.outbox.length
            });
          }
          return { success: false, error: message };
        }
      }
    } finally {
      flushInProgress = false;
      await broadcastStatus();
    }
  }

  async function pullCanonicalState(reason = 'manual', options = {}) {
    if (pullInProgress) return { success: true, skipped: 'pull-in-progress' };
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return { success: false, error: 'NO_SESSION' };

    pullInProgress = true;
    const traceFlow = options.quiet !== true;
    if (traceFlow) {
      startSyncFlow('pull', 'Загрузка состояния из Supabase');
      setSyncFlowStep('prepare', 'active', reason);
      await broadcastStatus('Готовлю загрузку данных из Supabase...');
    }
    try {
      await ensureSession();
      await registerDevice();
      if (traceFlow) setSyncFlowStep('prepare', 'done');
      const outboxBeforeRequest = await getOutbox();
      if (traceFlow) {
        setSyncFlowStep('request', 'active', 'Сверяю локальный кэш с сервером');
        await broadcastStatus('Запрос состояния отправлен в Supabase...');
      }
      const state = await getRemoteCanonicalState(reason, options.forceApply === true);
      if (traceFlow) {
        setSyncFlowStep('request', 'done');
        setSyncFlowStep('response', 'done', 'Состояние сервера получено');
      }
      const localRevision = await getCacheRevision();
      const latestOutbox = await getOutbox();
      const shouldApply = !latestOutbox.length && (options.forceApply === true || state.revision >= localRevision);
      if (traceFlow) setSyncFlowStep('cache', 'active', shouldApply ? 'Применяю canonical state' : 'Локальная очередь не перезаписана');
      const applied = shouldApply ? await applyCanonicalState(state, { force: options.forceApply === true }) : false;
      if (traceFlow) setSyncFlowStep('cache', 'done', applied ? 'Кэш обновлен' : 'Кэш уже актуален');
      await setSyncMeta({
        lastPullAt: new Date().toISOString(),
        lastPullError: '',
        lastError: '',
        serverRevision: state.revision,
        localRevision: await getCacheRevision(),
        outboxSize: latestOutbox.length,
        lastReason: reason
      });
      await clearSyncIssue();
      lastRuntimeMessage = applied
        ? 'Данные Supabase применены локально.'
        : ((latestOutbox.length || outboxBeforeRequest.length)
          ? 'Pull выполнен, локальная очередь сохранена.'
          : 'Локальный кэш уже актуален.');
      lastRuntimeError = '';
      if (traceFlow) {
        setSyncFlowStep('panel', 'done');
        finishSyncFlow(true);
        await broadcastStatus(lastRuntimeMessage);
      }
      return { success: true, state, applied };
    } catch (error) {
      const message = localizeSupabaseError(error);
      lastRuntimeError = message;
      if (traceFlow) setSyncFlowError(message);
      await setSyncMeta({
        lastPullError: message,
        lastError: message,
        lastPullAttemptAt: new Date().toISOString()
      });
      if (isConnectivitySyncErrorMessage(message)) {
        await reportSyncIssue('connectivity', message, { phase: 'pull' });
      }
      return { success: false, error: message };
    } finally {
      pullInProgress = false;
      await broadcastStatus();
    }
  }

  async function bootstrapRemoteFromLocal(localSnapshot) {
    const operations = makeOperationsFromSnapshot(localSnapshot || {});
    if (!operations.length) return { success: true, skipped: 'empty-bootstrap' };
    await appendOutboxOperations(operations, 'bootstrap');
    return flushOutbox('bootstrap');
  }

  async function initializeAuthenticatedSession(reason) {
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return;
    lastRuntimeError = '';
    try {
      await ensureSession();
      if (!currentUser) await fetchCurrentUser();
      const preLoginSnapshot = await collectLocalSyncSnapshot();
      await storageSet({
        [PRE_LOGIN_BACKUP_KEY]: {
          createdAt: new Date().toISOString(),
          reason,
          state: preLoginSnapshot
        }
      });

      await registerDevice();
      const remoteState = await getRemoteCanonicalState(reason || 'auth', reason !== 'startup');
      const pendingOutbox = await getOutbox();

      if (pendingOutbox.length) {
        await setSyncMeta({
          serverRevision: remoteState.revision,
          localRevision: await getCacheRevision(),
          outboxSize: pendingOutbox.length,
          lastError: '',
          lastReason: reason
        });
        lastRuntimeMessage = 'Есть локальная очередь изменений, сначала отправляю ее в Supabase.';
        await ensureBackgroundSyncActive(reason || 'auth');
        await broadcastStatus();
        void flushOutbox(reason || 'auth-pending');
        return;
      }

      if (remoteState.revision > 0) {
        const applied = await applyCanonicalState(remoteState, { force: true });
        await setSyncMeta({
          lastPullAt: new Date().toISOString(),
          lastPullError: '',
          lastError: '',
          serverRevision: remoteState.revision,
          localRevision: await getCacheRevision(),
          lastReason: reason
        });
        lastRuntimeMessage = applied
          ? 'Данные Supabase применены локально.'
          : 'Локальный кэш уже актуален.';
      } else {
        await bootstrapRemoteFromLocal(preLoginSnapshot);
        const stateAfterBootstrap = await getRemoteCanonicalState('bootstrap-confirm');
        await applyCanonicalState(stateAfterBootstrap, { force: true });
        await setSyncMeta({
          lastPullAt: new Date().toISOString(),
          serverRevision: stateAfterBootstrap.revision,
          localRevision: stateAfterBootstrap.revision,
          lastError: '',
          lastReason: reason
        });
        lastRuntimeMessage = 'Локальные данные перенесены в Supabase.';
      }

      await ensureBackgroundSyncActive(reason || 'auth');
      await broadcastStatus();
    } catch (error) {
      lastRuntimeError = localizeSupabaseError(error);
      await setSyncMeta({ lastError: lastRuntimeError });
      await broadcastStatus();
    }
  }

  async function manualSync(reason = 'manual') {
    // A deliberate user action can probe once after upgrading/restoring the quota.
    await setSyncMeta({ transportPausedUntil: 0, transportRetryUntil: 0 });
    await ensureSession();
    await registerDevice();
    const flushResult = await flushOutbox(reason);
    const outbox = await getOutbox();
    const pullResult = await pullCanonicalState(reason, {
      forceApply: outbox.length === 0
    });
    return {
      success: flushResult.success !== false && pullResult.success !== false,
      flush: flushResult,
      pull: pullResult
    };
  }

  async function runSyncHealthTest() {
    const runningMessage = 'Тест синхронизации выполняется...';
    await updateSyncTestStatus('running', runningMessage);
    lastRuntimeMessage = runningMessage;
    await broadcastStatus(runningMessage);

    try {
      const result = await manualSync('manual-test');
      const success = result && result.success !== false;
      const message = success
        ? 'Тест пройден: Supabase отвечает, очередь и локальный кэш синхронны.'
        : `Тест не пройден: ${result && (result.pull && result.pull.error || result.flush && result.flush.error) || 'синхронизация завершилась с ошибкой.'}`;
      await updateSyncTestStatus(success ? 'success' : 'error', message);
      lastRuntimeMessage = message;
      await broadcastStatus(message);
      return { success, message, result };
    } catch (error) {
      const message = `Тест не пройден: ${localizeSupabaseError(error)}`;
      await updateSyncTestStatus('error', message);
      lastRuntimeMessage = message;
      lastRuntimeError = localizeSupabaseError(error);
      await broadcastStatus(message);
      return { success: false, error: message };
    }
  }

  async function syncSet(values, options = {}) {
    const reason = options.reason || 'kv-set';
    const result = await withOutboxLock(async () => {
      const nextValues = values && typeof values === 'object' ? values : {};
      const previousValues = await storageGet(Object.keys(nextValues));
      await storageSet(nextValues);

      const changedValues = Object.fromEntries(Object.entries(nextValues).filter(([key, value]) =>
        !storageValueEquals(sanitizeValueForCloud(key, previousValues[key]), sanitizeValueForCloud(key, value))));
      const operations = makeOperationsFromValues(changedValues, previousValues);
      const enqueueResult = options.queue !== false
        ? await appendOutboxOperationsUnlocked(operations, reason)
        : { queued: false };
      return { success: true, operationsQueued: operations.length, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, operationsQueued: result.operationsQueued };
  }

  async function syncRemove(keys, options = {}) {
    const reason = options.reason || 'kv-delete';
    const result = await withOutboxLock(async () => {
      const normalizedKeys = Array.isArray(keys) ? keys : [keys];
      const hasSupportReminders = normalizedKeys
        .map((key) => String(key || '').trim())
        .includes(SUPPORT_REMINDERS_STORAGE_KEY);
      const previousValues = hasSupportReminders
        ? await storageGet([SUPPORT_REMINDERS_STORAGE_KEY])
        : {};
      await storageRemove(normalizedKeys);
      const operations = normalizedKeys
        .map((key) => String(key || '').trim())
        .filter((key) => isKvSyncKey(key))
        .map((key) => ({ type: 'kv_delete', key }));
      if (hasSupportReminders) {
        operations.push(...makeSupportReminderDeleteOperations(previousValues[SUPPORT_REMINDERS_STORAGE_KEY]));
      }
      const enqueueResult = options.queue !== false
        ? await appendOutboxOperationsUnlocked(operations, reason)
        : { queued: false };
      return { success: true, operationsQueued: operations.length, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, operationsQueued: result.operationsQueued };
  }

  async function incrementCounter(counterKey, dateKey, delta, options = {}) {
    const storageKey = String(counterKey || '');
    const normalizedDate = String(dateKey || '');
    const amount = Number(delta || 0);
    if (!storageKey || !normalizedDate || !Number.isFinite(amount) || amount === 0) {
      return { success: false, error: 'INVALID_COUNTER_INCREMENT' };
    }

    const reason = options.reason || 'counter-increment';
    const result = await withOutboxLock(async () => {
      const data = await storageGet(storageKey);
      const history = isPlainObject(data[storageKey]) ? data[storageKey] : {};
      const nextValue = Math.max(0, toNonNegativeInteger(history[normalizedDate]) + Math.trunc(amount));
      history[normalizedDate] = nextValue;
      await storageSet({ [storageKey]: history });
      const enqueueResult = await appendOutboxOperationsUnlocked([{
        type: 'counter_increment',
        counter_key: storageKey,
        date_key: normalizedDate,
        delta: Math.trunc(amount)
      }], reason);
      return { success: true, value: nextValue, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, value: result.value };
  }

  async function setCounter(counterKey, dateKey, value, options = {}) {
    const storageKey = String(counterKey || '');
    const normalizedDate = String(dateKey || '');
    if (!storageKey || !normalizedDate) return { success: false, error: 'INVALID_COUNTER_SET' };
    const reason = options.reason || 'counter-set';
    const result = await withOutboxLock(async () => {
      const normalizedValue = toNonNegativeInteger(value);
      const data = await storageGet(storageKey);
      const history = isPlainObject(data[storageKey]) ? data[storageKey] : {};
      history[normalizedDate] = normalizedValue;
      await storageSet({ [storageKey]: history });
      const enqueueResult = await appendOutboxOperationsUnlocked([{
        type: 'counter_set',
        counter_key: storageKey,
        date_key: normalizedDate,
        value: normalizedValue
      }], reason);
      return { success: true, value: normalizedValue, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, value: result.value };
  }

  async function addProcessedEdocids(dateIso, dateKey, edocids, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedDateKey = String(dateKey || '').trim() || isoToRuDateKey(normalizedDateIso);
    const uniqueEdocids = uniqueStrings(edocids);
    if (!normalizedDateIso || !uniqueEdocids.length) return { success: false, error: 'INVALID_EDOCIDS' };

    const reason = options.reason || 'processed-edocids-add';
    const result = await withOutboxLock(async () => {
      const data = await storageGet(['processed_edocids', 'stats_history']);
      const processed = isPlainObject(data.processed_edocids) ? data.processed_edocids : {};
      const history = isPlainObject(data.stats_history) ? data.stats_history : {};
      const processedToday = Array.isArray(processed[normalizedDateIso]) ? processed[normalizedDateIso] : [];
      const newlyProcessed = uniqueEdocids.filter((edocid) => !processedToday.includes(edocid));
      if (newlyProcessed.length) {
        processed[normalizedDateIso] = [...processedToday, ...newlyProcessed];
        history[normalizedDateKey] = toNonNegativeInteger(history[normalizedDateKey]) + newlyProcessed.length;
        await storageSet({
          processed_edocids: processed,
          stats_history: history
        });
      }

      const enqueueResult = await appendOutboxOperationsUnlocked([{
        type: 'processed_edocids_add',
        date_iso: normalizedDateIso,
        date_key: normalizedDateKey,
        edocids: uniqueEdocids
      }], reason);

      return {
        success: true,
        addedCount: newlyProcessed.length,
        value: toNonNegativeInteger(history[normalizedDateKey]),
        enqueueResult
      };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return {
      success: true,
      addedCount: result.addedCount,
      value: result.value
    };
  }

  async function addProcessedEditEdocid(dateIso, dateKey, path, edocid, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedDateKey = String(dateKey || '').trim() || isoToRuDateKey(normalizedDateIso);
    const normalizedPath = String(path || '').trim();
    const normalizedEdocid = String(edocid || '').trim();
    if (!normalizedDateIso || !normalizedPath || !normalizedEdocid) {
      return { success: false, error: 'INVALID_PROCESSED_EDIT' };
    }

    const reason = options.reason || 'processed-edit-add-edocid';
    const result = await withOutboxLock(async () => {
      const data = await storageGet(['processed_edits', 'editing_stats']);
      const processed = isPlainObject(data.processed_edits) ? data.processed_edits : {};
      const history = isPlainObject(data.editing_stats) ? data.editing_stats : {};
      if (!isPlainObject(processed[normalizedDateIso])) processed[normalizedDateIso] = {};
      const item = normalizeProcessedEditItem(processed[normalizedDateIso][normalizedPath]);
      const alreadyExists = item.unique_edocids.includes(normalizedEdocid);
      if (!alreadyExists) {
        item.unique_edocids.push(normalizedEdocid);
        item.base_count += 1;
        processed[normalizedDateIso][normalizedPath] = item;
        history[normalizedDateKey] = toNonNegativeInteger(history[normalizedDateKey]) + 1;
        await storageSet({
          processed_edits: processed,
          editing_stats: history
        });
      }

      const enqueueResult = await appendOutboxOperationsUnlocked([{
        type: 'processed_edit_add_edocid',
        date_iso: normalizedDateIso,
        date_key: normalizedDateKey,
        path: normalizedPath,
        edocid: normalizedEdocid
      }], reason);

      return {
        success: true,
        added: !alreadyExists,
        dayTotal: toNonNegativeInteger(history[normalizedDateKey]),
        actionCount: item.base_count,
        enqueueResult
      };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return {
      success: true,
      added: result.added,
      dayTotal: result.dayTotal,
      actionCount: result.actionCount
    };
  }

  async function setProcessedEdit(dateIso, path, item, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedPath = String(path || '').trim();
    if (!normalizedDateIso || !normalizedPath) return { success: false, error: 'INVALID_PROCESSED_EDIT_SET' };
    const reason = options.reason || 'processed-edit-set';
    const result = await withOutboxLock(async () => {
      const normalizedItem = normalizeProcessedEditItem(item);
      const data = await storageGet(['processed_edits', 'editing_stats']);
      const processed = isPlainObject(data.processed_edits) ? data.processed_edits : {};
      const history = isPlainObject(data.editing_stats) ? data.editing_stats : {};
      if (!isPlainObject(processed[normalizedDateIso])) processed[normalizedDateIso] = {};
      processed[normalizedDateIso][normalizedPath] = normalizedItem;
      const counterDateKey = options.counterDateKey || isoToRuDateKey(normalizedDateIso);
      const counterValue = options.counterValue !== undefined
        ? toNonNegativeInteger(options.counterValue)
        : calculateProcessedDayTotal(processed[normalizedDateIso]);
      history[counterDateKey] = counterValue;
      await storageSet({
        processed_edits: processed,
        editing_stats: history
      });
      const enqueueResult = await appendOutboxOperationsUnlocked([
        {
          type: 'processed_edit_set',
          date_iso: normalizedDateIso,
          path: normalizedPath,
          base_count: normalizedItem.base_count,
          unique_edocids: normalizedItem.unique_edocids
        },
        {
          type: 'counter_set',
          counter_key: 'editing_stats',
          date_key: counterDateKey,
          value: counterValue
        }
      ], reason);
      return { success: true, counterValue, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, counterValue: result.counterValue };
  }

  async function deleteProcessedEdit(dateIso, path, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedPath = String(path || '').trim();
    if (!normalizedDateIso || !normalizedPath) return { success: false, error: 'INVALID_PROCESSED_EDIT_DELETE' };
    const reason = options.reason || 'processed-edit-delete';
    const result = await withOutboxLock(async () => {
      const data = await storageGet(['processed_edits', 'editing_stats']);
      const processed = isPlainObject(data.processed_edits) ? data.processed_edits : {};
      const history = isPlainObject(data.editing_stats) ? data.editing_stats : {};
      if (isPlainObject(processed[normalizedDateIso])) {
        delete processed[normalizedDateIso][normalizedPath];
      }
      const counterDateKey = options.counterDateKey || isoToRuDateKey(normalizedDateIso);
      const counterValue = calculateProcessedDayTotal(processed[normalizedDateIso]);
      history[counterDateKey] = counterValue;
      await storageSet({
        processed_edits: processed,
        editing_stats: history
      });
      const enqueueResult = await appendOutboxOperationsUnlocked([
        {
          type: 'processed_edit_delete',
          date_iso: normalizedDateIso,
          path: normalizedPath
        },
        {
          type: 'counter_set',
          counter_key: 'editing_stats',
          date_key: counterDateKey,
          value: counterValue
        }
      ], reason);
      return { success: true, counterValue, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, counterValue: result.counterValue };
  }

  function calculateProcessedDayTotal(dayProcessed) {
    if (!isPlainObject(dayProcessed)) return 0;
    return Object.values(dayProcessed).reduce((sum, item) => {
      return sum + normalizeProcessedEditItem(item).base_count;
    }, 0);
  }

  async function setActionRule(path, status, tag = '', options = {}) {
    const normalizedPath = String(path || '').trim();
    const normalizedStatus = String(status || '').trim();
    if (!normalizedPath || !['approved', 'blocked'].includes(normalizedStatus)) {
      return { success: false, error: 'INVALID_ACTION_RULE' };
    }

    const reason = options.reason || 'action-rule-set';
    const result = await withOutboxLock(async () => {
      const data = await storageGet(['approved_actions', 'blocked_actions', 'action_tags', 'pending_actions']);
      let approved = uniqueStrings(data.approved_actions);
      let blocked = uniqueStrings(data.blocked_actions);
      const tags = isPlainObject(data.action_tags) ? data.action_tags : {};
      let pending = Array.isArray(data.pending_actions) ? data.pending_actions : [];

      if (normalizedStatus === 'approved') {
        approved = approved.filter((item) => item !== normalizedPath);
        blocked = blocked.filter((item) => item !== normalizedPath);
        approved.push(normalizedPath);
      } else {
        approved = approved.filter((item) => item !== normalizedPath);
        blocked = blocked.filter((item) => item !== normalizedPath);
        blocked.push(normalizedPath);
      }

      const normalizedTag = String(tag || '').trim();
      if (normalizedTag) {
        tags[normalizedPath] = normalizedTag;
      } else if (options.clearEmptyTag === true) {
        delete tags[normalizedPath];
      }

      if (options.pendingMode === 'exact') {
        const edocid = String(options.edocid || '');
        pending = pending.filter((item) => !(item && item.path === normalizedPath && String(item.edocid || '') === edocid));
      } else if (options.pendingMode === 'path') {
        pending = pending.filter((item) => !(item && item.path === normalizedPath));
      }

      await storageSet({
        approved_actions: approved,
        blocked_actions: blocked,
        action_tags: tags,
        pending_actions: pending
      });

      const enqueueResult = await appendOutboxOperationsUnlocked([{
        type: 'action_rule_set',
        path: normalizedPath,
        status: normalizedStatus,
        tag: normalizedTag
      }], reason);

      return { success: true, approved, blocked, tags, pending, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return {
      success: true,
      approved: result.approved,
      blocked: result.blocked,
      tags: result.tags,
      pending: result.pending
    };
  }

  async function setActionTag(path, tag, options = {}) {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return { success: false, error: 'INVALID_ACTION_TAG' };
    const reason = options.reason || 'action-tag-set';
    const result = await withOutboxLock(async () => {
      const data = await storageGet(['approved_actions', 'blocked_actions', 'action_tags']);
      const approved = uniqueStrings(data.approved_actions);
      const blocked = uniqueStrings(data.blocked_actions);
      const tags = isPlainObject(data.action_tags) ? data.action_tags : {};
      const normalizedTag = String(tag || '').trim();
      if (normalizedTag) tags[normalizedPath] = normalizedTag;
      else delete tags[normalizedPath];
      await storageSet({ action_tags: tags });

      const status = blocked.includes(normalizedPath) ? 'blocked' : 'approved';
      if (!approved.includes(normalizedPath) && !blocked.includes(normalizedPath)) {
        await storageSet({ approved_actions: [...approved, normalizedPath] });
      }
      const enqueueResult = await appendOutboxOperationsUnlocked([{
        type: 'action_rule_set',
        path: normalizedPath,
        status,
        tag: normalizedTag
      }], reason);
      return { success: true, status, tag: normalizedTag, enqueueResult };
    });
    if (result.enqueueResult && result.enqueueResult.queued) {
      scheduleFlushOutbox(reason);
      await broadcastStatus();
    }
    return { success: true, status: result.status, tag: result.tag };
  }

  async function importSyncData(importedData) {
    const data = importedData && typeof importedData === 'object' ? cloneJson(importedData) : {};
    if (!currentSession) await loadStoredSession();

    if (!currentSession) {
      const current = await storageGet(null);
      const keysToRemove = Object.keys(current || {}).filter((key) => isSyncableKey(key));
      if (keysToRemove.length) await storageRemove(keysToRemove);
      await storageSet(data);
      return { success: true, localOnly: true };
    }

    const localValues = {};
    Object.keys(data || {}).forEach((key) => {
      if (isSyncableKey(key)) localValues[key] = data[key];
    });
    const operations = makeOperationsFromSnapshot(localValues);
    const enqueueResult = await withOutboxLock(async () => {
      const current = await storageGet(null);
      const keysToRemove = Object.keys(current || {}).filter((key) => isSyncableKey(key));
      applyingCanonicalState = true;
      try {
        if (keysToRemove.length) await storageRemove(keysToRemove);
        await storageSet(localValues);
      } finally {
        applyingCanonicalState = false;
      }
      return appendOutboxOperationsUnlocked(operations, 'json-import');
    });
    if (enqueueResult && enqueueResult.queued) {
      scheduleFlushOutbox('json-import');
      await broadcastStatus();
    }
    const flushResult = await flushOutbox('json-import');
    if (flushResult.success !== false) {
      await pullCanonicalState('json-import-confirm', { forceApply: true });
    }
    return flushResult;
  }

  function makeRealtimeRef() {
    realtimeRefCounter += 1;
    return String(realtimeRefCounter);
  }

  function sendRealtimeMessage(socket, event, payload = {}, options = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return '';
    const ref = options.ref || makeRealtimeRef();
    const topic = options.topic || REALTIME_TOPIC;
    const joinRef = Object.prototype.hasOwnProperty.call(options, 'joinRef')
      ? options.joinRef
      : realtimeJoinRef;
    socket.send(JSON.stringify({
      topic,
      event,
      payload: payload || {},
      ref,
      join_ref: joinRef || null
    }));
    return ref;
  }

  async function decodeRealtimeMessage(rawData) {
    try {
      let text = '';
      if (typeof rawData === 'string') {
        text = rawData;
      } else if (rawData instanceof ArrayBuffer) {
        text = new TextDecoder().decode(rawData);
      } else if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
        text = new TextDecoder().decode(await rawData.arrayBuffer());
      }
      if (!text) return null;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const [joinRef, ref, topic, event, payload] = parsed;
        return { joinRef, ref, topic, event, payload };
      }
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          joinRef: parsed.join_ref || parsed.joinRef || null
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  function getRealtimeChangeData(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.data && typeof payload.data === 'object') return payload.data;
    return payload;
  }

  function getRealtimeChangeRecord(payload) {
    const data = getRealtimeChangeData(payload);
    if (!data || typeof data !== 'object') return {};
    if (data.record && typeof data.record === 'object') return data.record;
    if (data.new && typeof data.new === 'object') return data.new;
    return {};
  }

  function scheduleRealtimePull(reason = 'realtime') {
    realtimePullTimer = clearTimer(realtimePullTimer);
    realtimePullTimer = setTimeout(() => {
      realtimePullTimer = 0;
      void pullCanonicalState(reason, { quiet: true });
    }, REALTIME_PULL_DEBOUNCE_MS);
  }

  async function handleRealtimePostgresChange(payload) {
    const data = getRealtimeChangeData(payload);
    if (!data || typeof data !== 'object') return;
    const eventType = String(data.type || data.eventType || '').toUpperCase();
    if (eventType && eventType !== 'INSERT' && eventType !== 'UPDATE') return;

    const record = getRealtimeChangeRecord(payload);
    const userId = String(record.user_id || '').trim();
    if (currentUser && currentUser.id && userId && userId !== String(currentUser.id)) return;

    const remoteRevision = Number(record.revision || 0);
    const localRevision = await getCacheRevision();
    await setSyncMeta({
      realtimeLastEventAt: new Date().toISOString(),
      serverRevision: remoteRevision || undefined
    });
    if (!remoteRevision || remoteRevision > localRevision) {
      scheduleRealtimePull('realtime');
    }
  }

  function clearRealtimeTimers() {
    realtimeJoinTimer = clearTimer(realtimeJoinTimer);
    realtimeHeartbeatTimer = clearTimer(realtimeHeartbeatTimer);
    realtimeReconnectTimer = clearTimer(realtimeReconnectTimer);
    realtimePullTimer = clearTimer(realtimePullTimer);
    realtimePendingHeartbeatRef = '';
  }

  function scheduleRealtimeHeartbeat(socket) {
    realtimeHeartbeatTimer = clearTimer(realtimeHeartbeatTimer);
    realtimeHeartbeatTimer = setTimeout(() => {
      if (socket !== realtimeSocket || !socket || socket.readyState !== WebSocket.OPEN) return;
      if (realtimePendingHeartbeatRef) {
        try {
          socket.close();
        } catch (error) {
          // ignore
        }
        return;
      }
      realtimePendingHeartbeatRef = sendRealtimeMessage(socket, 'heartbeat', {}, {
        topic: 'phoenix',
        joinRef: null
      });
      scheduleRealtimeHeartbeat(socket);
    }, REALTIME_HEARTBEAT_MS);
  }

  function scheduleRealtimeReconnect(reason = 'closed') {
    if (!realtimeWanted || !currentSession) return;
    realtimeReconnectTimer = clearTimer(realtimeReconnectTimer);
    const delayMs = REALTIME_RECONNECT_DELAYS_MS[
      Math.min(realtimeReconnectAttempt, REALTIME_RECONNECT_DELAYS_MS.length - 1)
    ];
    realtimeReconnectAttempt += 1;
    realtimeReconnectTimer = setTimeout(() => {
      realtimeReconnectTimer = 0;
      void startRealtimeSubscription(`reconnect-${reason}`);
    }, delayMs);
  }

  function stopRealtimeSubscription(options = {}) {
    const keepWanted = options.keepWanted === true;
    if (!keepWanted) realtimeWanted = false;
    clearRealtimeTimers();
    realtimeJoined = false;
    const joinRef = realtimeJoinRef;
    realtimeJoinRef = '';
    realtimeUserId = '';
    realtimeAccessToken = '';

    const socket = realtimeSocket;
    realtimeSocket = null;
    if (socket) {
      try {
        if (typeof WebSocket !== 'undefined' && socket.readyState === WebSocket.OPEN) {
          sendRealtimeMessage(socket, 'phx_leave', {}, { joinRef });
        }
        socket.close();
      } catch (error) {
        // ignore
      }
    }
  }

  async function handleRealtimeMessage(socket, rawData) {
    const message = await decodeRealtimeMessage(rawData);
    if (socket !== realtimeSocket || !message) return;

    const { topic, event, payload, ref } = message;
    if (ref && ref === realtimePendingHeartbeatRef) {
      realtimePendingHeartbeatRef = '';
    }

    if (topic !== REALTIME_TOPIC) return;

    if (event === 'phx_reply' && ref === realtimeJoinRef) {
      const status = payload && payload.status ? String(payload.status) : '';
      if (status === 'ok') {
        realtimeJoined = true;
        realtimeReconnectAttempt = 0;
        await setSyncMeta({
          realtimeStatus: 'connected',
          realtimeConnectedAt: new Date().toISOString(),
          realtimeLastError: ''
        });
        await broadcastStatus();
        return;
      }

      realtimeJoined = false;
      await setSyncMeta({
        realtimeStatus: 'error',
        realtimeLastError: extractSupabaseErrorMessage(payload) || 'Realtime subscription failed.'
      });
      try {
        socket.close();
      } catch (error) {
        // ignore
      }
      return;
    }

    if (event === 'postgres_changes') {
      void handleRealtimePostgresChange(payload);
    } else if (event === 'system' && payload && payload.status === 'error') {
      await setSyncMeta({
        realtimeStatus: 'error',
        realtimeLastError: extractSupabaseErrorMessage(payload) || 'Realtime system error.'
      });
      await broadcastStatus();
    }
  }

  async function startRealtimeSubscription(reason = 'auth') {
    realtimeWanted = true;
    if (realtimeStarting) return;
    if (typeof WebSocket !== 'function') {
      await setSyncMeta({ realtimeStatus: 'unsupported' });
      return;
    }

    realtimeStarting = true;
    try {
      await assertTransportAvailable();
      await ensureSession();
      if (!currentUser) currentUser = await fetchCurrentUser();
      const userId = currentUser && currentUser.id ? String(currentUser.id) : '';
      const accessToken = currentSession && currentSession.access_token ? String(currentSession.access_token) : '';
      if (!userId || !accessToken) return;

      if (
        realtimeSocket &&
        (realtimeSocket.readyState === WebSocket.OPEN || realtimeSocket.readyState === WebSocket.CONNECTING) &&
        realtimeUserId === userId &&
        realtimeAccessToken === accessToken
      ) {
        return;
      }

      stopRealtimeSubscription({ keepWanted: true });
      realtimeUserId = userId;
      realtimeAccessToken = accessToken;
      realtimeJoined = false;

      realtimeCurrentOriginIndex = realtimeOriginIndex % REALTIME_WS_URLS.length;
      const socket = new WebSocket(REALTIME_WS_URLS[realtimeCurrentOriginIndex]);
      realtimeSocket = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        if (socket !== realtimeSocket) return;
        realtimeJoinRef = makeRealtimeRef();
        sendRealtimeMessage(socket, 'phx_join', {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            postgres_changes: [{
              event: '*',
              schema: 'public',
              table: 'extension_sync_state',
              filter: `user_id=eq.${userId}`
            }],
            private: false
          },
          access_token: accessToken
        }, {
          ref: realtimeJoinRef,
          joinRef: realtimeJoinRef
        });

        realtimeJoinTimer = clearTimer(realtimeJoinTimer);
        realtimeJoinTimer = setTimeout(() => {
          if (socket === realtimeSocket && !realtimeJoined) {
            try {
              socket.close();
            } catch (error) {
              // ignore
            }
          }
        }, REALTIME_JOIN_TIMEOUT_MS);
        scheduleRealtimeHeartbeat(socket);
      };

      socket.onmessage = (event) => {
        void handleRealtimeMessage(socket, event.data);
      };

      socket.onerror = () => {
        void setSyncMeta({
          realtimeStatus: 'error',
          realtimeLastError: 'Ошибка WebSocket Realtime.'
        });
      };

      socket.onclose = () => {
        if (socket !== realtimeSocket) return;
        clearRealtimeTimers();
        realtimeSocket = null;
        realtimeJoined = false;
        realtimeOriginIndex = (realtimeCurrentOriginIndex + 1) % REALTIME_WS_URLS.length;
        void setSyncMeta({
          realtimeStatus: 'disconnected',
          realtimeDisconnectedAt: new Date().toISOString()
        });
        scheduleRealtimeReconnect(reason);
      };
    } catch (error) {
      await setSyncMeta({
        realtimeStatus: 'error',
        realtimeLastError: localizeSupabaseError(error)
      });
      scheduleRealtimeReconnect(reason);
    } finally {
      realtimeStarting = false;
    }
  }

  function ensureFallbackPullAlarm() {
    if (!hasChromeAlarms()) return;
    try {
      chrome.alarms.create(FALLBACK_PULL_ALARM_NAME, {
        delayInMinutes: FALLBACK_PULL_MINUTES,
        periodInMinutes: FALLBACK_PULL_MINUTES
      });
    } catch (error) {
      // ignore
    }
  }

  function clearFallbackPullAlarm() {
    if (!hasChromeAlarms()) return;
    try {
      chrome.alarms.clear(FALLBACK_PULL_ALARM_NAME);
    } catch (error) {
      // ignore
    }
  }

  async function ensureBackgroundSyncActive(reason = 'auth') {
    if (!currentSession) await loadStoredSession();
    if (!currentSession) {
      stopRealtimeSubscription();
      clearFallbackPullAlarm();
      return;
    }
    ensureFallbackPullAlarm();
    void startRealtimeSubscription(reason);
  }

  async function handleFallbackPullAlarm() {
    if (!currentSession) await loadStoredSession();
    if (!currentSession) {
      stopRealtimeSubscription();
      clearFallbackPullAlarm();
      return;
    }

    await ensureBackgroundSyncActive('fallback-alarm');
    const outbox = await getOutbox();
    if (outbox.length) {
      await flushOutbox('fallback-alarm');
    }
    await pullCanonicalState('fallback-alarm', { quiet: true });
  }

  async function signIn(email, password) {
    const payload = {
      email: String(email || '').trim(),
      password: String(password || '')
    };
    if (!payload.email || !payload.password) throw new Error('Укажи почту и пароль.');

    const data = await supabaseFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, false);
    const session = normalizeSession(data);
    await persistSession(session);
    await initializeAuthenticatedSession('sign-in');
    lastRuntimeMessage = 'Вход выполнен, синхронизация включена.';
    return getPublicStatus();
  }

  async function signUp(email, password) {
    const payload = {
      email: String(email || '').trim(),
      password: String(password || '')
    };
    if (!payload.email || !payload.password) throw new Error('Укажи почту и пароль.');

    const data = await supabaseFetch('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, false);
    const session = normalizeSession(data);
    if (session) {
      await persistSession(session);
      await initializeAuthenticatedSession('sign-up');
      lastRuntimeMessage = 'Аккаунт создан, синхронизация включена.';
      return getPublicStatus();
    }

    lastRuntimeMessage = 'Аккаунт создан. Подтверди почту в письме Supabase, затем войди.';
    await broadcastStatus();
    return getPublicStatus();
  }

  async function signOut() {
    try {
      if (currentSession) {
        await supabaseFetch('/auth/v1/logout', { method: 'POST' }, true);
      }
    } catch (error) {
      // Локальный выход нужен даже при ошибке серверного logout.
    }
    stopRealtimeSubscription();
    clearFallbackPullAlarm();
    await clearStoredSession();
    await withOutboxLock(() => storageRemove([SYNC_META_KEY, OUTBOX_KEY]));
    syncIssueActive = false;
    lastRuntimeError = '';
    lastRuntimeMessage = 'Выход выполнен. Данные снова хранятся локально.';
    await broadcastStatus();
    return getPublicStatus();
  }

  async function sendPasswordRecovery(email) {
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail) throw new Error('Укажи почту для восстановления.');
    await supabaseFetch('/auth/v1/recover', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail })
    }, false);
    lastRuntimeMessage = 'Письмо для восстановления отправлено.';
    await broadcastStatus();
    return getPublicStatus();
  }

  async function confirmPasswordRecovery(email, token, password) {
    const payload = {
      email: String(email || '').trim(),
      token: String(token || '').trim(),
      type: 'recovery'
    };
    const newPassword = String(password || '');
    if (!payload.email || !payload.token || !newPassword) {
      throw new Error('Укажи почту, код из письма и новый пароль.');
    }

    const data = await supabaseFetch('/auth/v1/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, false);
    const session = normalizeSession(data);
    await persistSession(session);
    await supabaseFetch('/auth/v1/user', {
      method: 'PUT',
      body: JSON.stringify({ password: newPassword })
    }, true);
    await initializeAuthenticatedSession('password-recovery');
    lastRuntimeMessage = 'Пароль обновлен, вход выполнен.';
    return getPublicStatus();
  }

  async function getPublicStatus(messageOverride = '') {
    if (!currentSession) await loadStoredSession();
    const meta = await getSyncMeta();
    const outbox = await getOutbox();
    const localRevision = await getCacheRevision();
    const serverRevision = Number(meta.serverRevision || localRevision || 0);
    const lastPullError = meta.lastPullError || '';
    const lastPushError = meta.lastPushError || '';
    const lastError = lastRuntimeError || meta.lastError || meta.lastPushError || meta.lastPullError || '';
    const syncing = flushInProgress || pullInProgress;
    const revisionState = (() => {
      if (lastError || lastPullError || lastPushError) {
        return {
          code: 'error',
          label: 'есть ошибка обмена с Supabase'
        };
      }
      if (syncing && outbox.length > 0) {
        return {
          code: 'syncing-push',
          label: 'идет отправка локальных изменений'
        };
      }
      if (syncing) {
        return {
          code: 'syncing',
          label: 'идет синхронизация с Supabase'
        };
      }
      if (outbox.length > 0) {
        return {
          code: 'pending-local',
          label: 'есть неотправленные локальные изменения'
        };
      }
      if (serverRevision > localRevision) {
        return {
          code: 'server-newer',
          label: 'сервер новее, локальный кэш догоняет'
        };
      }
      if (localRevision > serverRevision) {
        return {
          code: 'local-newer',
          label: 'локальный кэш новее сервера, жду подтверждение'
        };
      }
      return {
        code: 'synced',
        label: 'сервер и локальный кэш синхронны'
      };
    })();
    return {
      configured: true,
      authenticated: !!currentSession,
      email: currentUser && currentUser.email ? String(currentUser.email) : '',
      userId: currentUser && currentUser.id ? String(currentUser.id) : '',
      syncing,
      lastSyncAt: meta.lastPushAt || meta.lastPullAt || '',
      lastPullAt: meta.lastPullAt || '',
      lastPushAt: meta.lastPushAt || '',
      lastPullError,
      lastPushError,
      lastError,
      message: messageOverride || lastRuntimeMessage || '',
      remotePriority: true,
      realtimeConnected: realtimeJoined,
      realtimeStatus: meta.realtimeStatus || '',
      realtimeLastError: meta.realtimeLastError || '',
      serverRevision,
      localRevision,
      revisionState: revisionState.code,
      revisionStateLabel: revisionState.label,
      outboxSize: outbox.length,
      outboxLastError: outbox.length ? String(outbox[0].lastError || '') : '',
      syncHealthCode: meta.syncHealthCode || '',
      syncHealthMessage: meta.syncHealthMessage || '',
      syncHealthAt: meta.syncHealthAt || '',
      lastSyncTestAt: meta.lastSyncTestAt || '',
      lastSyncTestStatus: meta.lastSyncTestStatus || '',
      lastSyncTestMessage: meta.lastSyncTestMessage || '',
      deviceId: meta.deviceId || '',
      schemaVersion: SCHEMA_VERSION,
      syncFlow: getPublicSyncFlow()
    };
  }

  async function broadcastStatus(messageOverride = '') {
    const status = await getPublicStatus(messageOverride);
    try {
      chrome.runtime.sendMessage({
        action: 'DUP_SUPABASE_STATUS_CHANGED',
        status
      }, () => {
        if (chrome.runtime.lastError) {
          // Sidepanel может быть закрыт.
        }
      });
    } catch (error) {
      // ignore
    }
    return status;
  }

  async function handleRuntimeMessage(message) {
    const action = message && message.action ? String(message.action) : '';
    const data = message && message.data && typeof message.data === 'object' ? message.data : {};

    try {
      if (action === 'DUP_SUPABASE_GET_STATUS') {
        return { success: true, status: await getPublicStatus() };
      }
      if (action === 'DUP_SUPABASE_SIGN_IN') return { success: true, status: await signIn(data.email, data.password) };
      if (action === 'DUP_SUPABASE_SIGN_UP') return { success: true, status: await signUp(data.email, data.password) };
      if (action === 'DUP_SUPABASE_SIGN_OUT') return { success: true, status: await signOut() };
      if (action === 'DUP_SUPABASE_SYNC_NOW') {
        const result = await manualSync();
        return { success: result.success !== false, status: await getPublicStatus(), result };
      }
      if (action === 'DUP_SUPABASE_SYNC_TEST') {
        const result = await runSyncHealthTest();
        return { success: result.success !== false, status: await getPublicStatus(), result };
      }
      if (action === 'DUP_SUPABASE_SEND_PASSWORD_RECOVERY') {
        return { success: true, status: await sendPasswordRecovery(data.email) };
      }
      if (action === 'DUP_SUPABASE_CONFIRM_PASSWORD_RECOVERY') {
        return { success: true, status: await confirmPasswordRecovery(data.email, data.token, data.password) };
      }

      if (action === 'DUP_SYNC_SET') return { success: true, result: await syncSet(data.values || {}, data.options || {}) };
      if (action === 'DUP_SYNC_REMOVE') return { success: true, result: await syncRemove(data.keys || [], data.options || {}) };
      if (action === 'DUP_SYNC_COUNTER_INCREMENT') {
        return { success: true, result: await incrementCounter(data.counterKey, data.dateKey, data.delta, data.options || {}) };
      }
      if (action === 'DUP_SYNC_COUNTER_SET') {
        return { success: true, result: await setCounter(data.counterKey, data.dateKey, data.value, data.options || {}) };
      }
      if (action === 'DUP_SYNC_PROCESSED_EDOCIDS_ADD') {
        return {
          success: true,
          result: await addProcessedEdocids(data.dateIso, data.dateKey, data.edocids, data.options || {})
        };
      }
      if (action === 'DUP_SYNC_PROCESSED_EDIT_ADD_EDOCID') {
        return {
          success: true,
          result: await addProcessedEditEdocid(data.dateIso, data.dateKey, data.path, data.edocid, data.options || {})
        };
      }
      if (action === 'DUP_SYNC_PROCESSED_EDIT_SET') {
        return {
          success: true,
          result: await setProcessedEdit(data.dateIso, data.path, data.item, data.options || {})
        };
      }
      if (action === 'DUP_SYNC_PROCESSED_EDIT_DELETE') {
        return {
          success: true,
          result: await deleteProcessedEdit(data.dateIso, data.path, data.options || {})
        };
      }
      if (action === 'DUP_SYNC_ACTION_RULE_SET') {
        return {
          success: true,
          result: await setActionRule(data.path, data.status, data.tag, data.options || {})
        };
      }
      if (action === 'DUP_SYNC_ACTION_TAG_SET') {
        return {
          success: true,
          result: await setActionTag(data.path, data.tag, data.options || {})
        };
      }
      if (action === 'DUP_SYNC_IMPORT_JSON') {
        return { success: true, result: await importSyncData(data.importedData || {}) };
      }

      return null;
    } catch (error) {
      const localizedError = localizeSupabaseError(error);
      lastRuntimeError = localizedError;
      await setSyncMeta({ lastError: localizedError });
      return { success: false, error: localizedError, status: await getPublicStatus() };
    }
  }

  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const action = message && message.action ? String(message.action) : '';
      if (!action.startsWith('DUP_SUPABASE_') && !action.startsWith('DUP_SYNC_')) return false;
      handleRuntimeMessage(message).then((response) => {
        sendResponse(response || { success: false, error: 'UNKNOWN_ACTION' });
      });
      return true;
    });
  }

  if (hasChromeAlarms()) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (!alarm || alarm.name !== FALLBACK_PULL_ALARM_NAME) return;
      void handleFallbackPullAlarm();
    });
  }

  async function boot() {
    if (bootStarted) return;
    bootStarted = true;
    await storageRemove('dup_id_card_check_state_v1');
    await compactOutboxLocked('remove-tab-only-id-card-state');
    await loadStoredSession();
    if (currentSession) {
      await initializeAuthenticatedSession('startup');
    } else {
      stopRealtimeSubscription();
      clearFallbackPullAlarm();
      await broadcastStatus();
    }
  }

  globalThis.__dupSupabaseSync = {
    isSyncableKey,
    isKvSyncKey,
    collectLocalSyncSnapshot,
    pullRemoteState: pullCanonicalState,
    flushSync: flushOutbox,
    flushOutbox,
    startRealtimeSubscription,
    stopRealtimeSubscription,
    syncSet,
    syncRemove,
    incrementCounter,
    setCounter,
    addProcessedEdocids,
    addProcessedEditEdocid,
    setProcessedEdit,
    deleteProcessedEdit,
    setActionRule,
    setActionTag,
    importSyncData,
    getPublicStatus
  };

  setTimeout(() => {
    void boot();
  }, 0);
})();
