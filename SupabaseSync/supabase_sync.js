(() => {
  'use strict';

  if (globalThis.__dupSupabaseSyncInitialized) return;
  globalThis.__dupSupabaseSyncInitialized = true;

  const SUPABASE_URL = 'https://odljanxhmjysnduylvxz.supabase.co';
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

  const SESSION_REFRESH_MARGIN_MS = 60 * 1000;
  const REQUEST_TIMEOUT_MS = 15000;
  const RETRY_DELAYS_MS = [600, 1500, 3500];
  const FLUSH_DEBOUNCE_MS = 250;
  const REALTIME_WS_URL = `${SUPABASE_URL.replace(/^http/i, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_PUBLISHABLE_KEY)}&log_level=warning&vsn=1.0.0`;
  const REALTIME_TOPIC = 'realtime:extension-sync-state';
  const REALTIME_JOIN_TIMEOUT_MS = 10000;
  const REALTIME_HEARTBEAT_MS = 25000;
  const REALTIME_PULL_DEBOUNCE_MS = 800;
  const REALTIME_RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
  const FALLBACK_PULL_ALARM_NAME = 'dup_supabase_pull_fallback_v2';
  const FALLBACK_PULL_MINUTES = 1;

  const KV_SYNC_KEYS = new Set([
    'setting_copy_mode',
    'setting_highlight_mode',
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
    'support_reminders_state_v1',
    'dup_execution_analysis_params_v1',
    'dup_execution_analysis_state_v1',
    'dup_id_card_check_state_v1'
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
    return new Promise((resolve) => {
      if (!hasChromeStorage()) {
        resolve(false);
        return;
      }
      try {
        chrome.storage.local.set(values, () => resolve(true));
      } catch (error) {
        resolve(false);
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
    if (KV_SYNC_KEYS.has(normalizedKey)) return true;
    if (STRUCTURED_SYNC_KEYS.has(normalizedKey)) return true;
    if (normalizedKey.startsWith('dup_ui_show_')) return true;
    if (SYNC_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) return true;
    return false;
  }

  function isKvSyncKey(key) {
    const normalizedKey = String(key || '').trim();
    if (!isSyncableKey(normalizedKey)) return false;
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

  function sanitizeIdCardCheckState(value) {
    if (!isPlainObject(value)) return value;
    const state = cloneJson(value);
    state.tabId = 0;
    return state;
  }

  function sanitizeValueForCloud(key, value) {
    if (key === 'dup_execution_analysis_state_v1') {
      return sanitizeExecutionAnalysisState(value);
    }
    if (key === 'dup_id_card_check_state_v1') {
      return sanitizeIdCardCheckState(value);
    }
    return cloneJson(value);
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

  function normalizeSession(rawSession) {
    const source = rawSession && rawSession.session ? rawSession.session : rawSession;
    if (!source || typeof source !== 'object') return null;
    const accessToken = String(source.access_token || '').trim();
    const refreshToken = String(source.refresh_token || '').trim();
    if (!accessToken || !refreshToken) return null;
    const expiresInMs = Number(source.expires_in || 3600) * 1000;
    const expiresAt = Number(source.expires_at || 0) > 10000000000
      ? Number(source.expires_at)
      : Date.now() + expiresInMs;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: String(source.token_type || 'bearer'),
      expires_at: expiresAt,
      user: source.user && typeof source.user === 'object' ? source.user : null
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
    return message;
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

  function isRetryableStatus(status) {
    return [408, 429, 500, 502, 503, 504].includes(Number(status));
  }

  async function loadStoredSession() {
    const result = await storageGet(AUTH_SESSION_KEY);
    const session = normalizeSession(result[AUTH_SESSION_KEY]);
    currentSession = session;
    currentUser = getUserFromSession(session);
    return session;
  }

  async function persistSession(session) {
    const normalized = normalizeSession(session);
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

  async function refreshSession() {
    if (!currentSession) await loadStoredSession();
    if (!currentSession || !currentSession.refresh_token) {
      throw new Error('Нет активной Supabase-сессии.');
    }

    const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(null),
      body: JSON.stringify({ refresh_token: currentSession.refresh_token })
    });
    const data = await parseSupabaseResponse(response);
    if (!response.ok) {
      throw new Error(localizeSupabaseError(data || response.statusText));
    }
    const session = normalizeSession(data);
    if (!session) throw new Error('Supabase не вернул новую сессию.');
    await persistSession(session);
    return currentSession;
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
        response = await fetchWithTimeout(`${SUPABASE_URL}${path}`, {
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

        return data;
      } catch (error) {
        const retryable = error && (
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
    const previous = await getSyncMeta();
    await storageSet({
      [SYNC_META_KEY]: {
        ...previous,
        ...nextMeta
      }
    });
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
    ['status', 'applied_revision', 'current_revision', 'error'].forEach((key) => {
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
      if (isKvSyncKey(key)) {
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
    const outbox = await getOutbox();
    if (outbox.length && options.force !== true) {
      await setSyncMeta({
        serverRevision: Number(rawState && rawState.revision || 0),
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
  }

  function makeKvOperationsFromValues(values) {
    const operations = [];
    Object.entries(values || {}).forEach(([key, value]) => {
      if (!isKvSyncKey(key)) return;
      const sanitized = sanitizeValueForCloud(key, value);
      if (sanitized === undefined) return;
      operations.push({ type: 'kv_set', key, value: sanitized });
    });
    return operations;
  }

  function makeOperationsFromSnapshot(snapshot) {
    const operations = [];

    operations.push(...makeKvOperationsFromValues(snapshot));

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
    const data = await callRpc('extension_register_device', {
      p_device_id: deviceId,
      p_device_name: getDeviceName(),
      p_browser: getBrowserName()
    });
    const state = data && data.state ? data.state : data;
    await setSyncMeta({
      deviceId,
      lastDeviceRegisterAt: new Date().toISOString()
    });
    return normalizeCanonicalState(state);
  }

  async function getRemoteCanonicalState(reason = 'pull') {
    const localRevision = await getCacheRevision();
    const data = await callRpc('extension_get_state', {
      p_since_revision: localRevision || null
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
    const filteredOperations = toArray(operations).filter((operation) => operation && typeof operation === 'object');
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
    outbox.push(item);
    await setOutbox(outbox);
    await setSyncMeta({
      outboxSize: outbox.length,
      lastQueuedAt: new Date().toISOString(),
      lastError: ''
    });
    scheduleFlushOutbox(reason);
    await broadcastStatus();
    return { queued: true, item };
  }

  function scheduleFlushOutbox(reason = 'queued') {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = 0;
      void flushOutbox(reason);
    }, FLUSH_DEBOUNCE_MS);
  }

  async function applyMutationItem(item) {
    const result = await callRpc('extension_apply_mutation', {
      p_device_id: item.deviceId,
      p_mutation_id: item.mutationId,
      p_base_revision: item.baseRevision,
      p_operations: item.operations
    });
    return normalizeCanonicalState(result);
  }

  async function flushOutbox(reason = 'manual') {
    if (flushInProgress) return { success: true, skipped: 'flush-in-progress' };
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return { success: false, error: 'NO_SESSION' };

    flushInProgress = true;
    await broadcastStatus('Отправляю изменения в Supabase...');
    try {
      await ensureSession();
      await registerDevice();

      while (true) {
        const outbox = await getOutbox();
        if (!outbox.length) {
          await setSyncMeta({
            outboxSize: 0,
            lastPushError: '',
            lastError: '',
            lastFlushAt: new Date().toISOString()
          });
          lastRuntimeError = '';
          return { success: true };
        }

        const item = outbox[0];
        item.attempts = Number(item.attempts || 0) + 1;
        await setOutbox([item, ...outbox.slice(1)]);

        try {
          const state = await applyMutationItem(item);
          if (state && state.status === 'conflict') {
            const metaState = await getRemoteCanonicalState('conflict-rebase');
            const rebasedRevision = Number(metaState.revision || state.current_revision || 0);
            const nextItem = {
              ...item,
              mutationId: makeMutationId(item.deviceId),
              baseRevision: rebasedRevision,
              lastError: String(state.error || 'revision_mismatch'),
              rebasedAt: new Date().toISOString()
            };
            await setOutbox([nextItem, ...outbox.slice(1)]);
            await setCacheRevision(rebasedRevision);
            if (String(state.error || '').startsWith('unknown_operation')) {
              throw new Error(state.error);
            }
            continue;
          }

          const nextOutbox = outbox.slice(1);
          await setOutbox(nextOutbox);
          await applyCanonicalState(state, { force: true });
          await setSyncMeta({
            outboxSize: nextOutbox.length,
            serverRevision: state.revision,
            localRevision: state.revision,
            lastPushAt: new Date().toISOString(),
            lastPushError: '',
            lastError: '',
            lastReason: reason
          });
          lastRuntimeMessage = nextOutbox.length
            ? `Отправлено изменение, осталось в очереди: ${nextOutbox.length}.`
            : 'Все изменения отправлены в Supabase.';
          lastRuntimeError = '';
        } catch (error) {
          const message = localizeSupabaseError(error);
          const currentOutbox = await getOutbox();
          if (currentOutbox.length) {
            currentOutbox[0] = {
              ...currentOutbox[0],
              attempts: Number(currentOutbox[0].attempts || item.attempts || 0),
              lastError: message,
              lastAttemptAt: new Date().toISOString()
            };
            await setOutbox(currentOutbox);
          }
          lastRuntimeError = message;
          await setSyncMeta({
            outboxSize: currentOutbox.length,
            lastPushError: message,
            lastError: message,
            lastPushAttemptAt: new Date().toISOString()
          });
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
    if (options.quiet !== true) await broadcastStatus('Загружаю данные из Supabase...');
    try {
      await ensureSession();
      await registerDevice();
      const outbox = await getOutbox();
      const state = await getRemoteCanonicalState(reason);
      const localRevision = await getCacheRevision();
      const shouldApply = options.forceApply === true || (!outbox.length && state.revision >= localRevision);
      const applied = shouldApply ? await applyCanonicalState(state, { force: options.forceApply === true }) : false;
      await setSyncMeta({
        lastPullAt: new Date().toISOString(),
        lastPullError: '',
        lastError: '',
        serverRevision: state.revision,
        localRevision: await getCacheRevision(),
        outboxSize: outbox.length,
        lastReason: reason
      });
      lastRuntimeMessage = applied
        ? 'Данные Supabase применены локально.'
        : (outbox.length ? 'Pull выполнен, локальная очередь сохранена.' : 'Локальный кэш уже актуален.');
      lastRuntimeError = '';
      return { success: true, state, applied };
    } catch (error) {
      const message = localizeSupabaseError(error);
      lastRuntimeError = message;
      await setSyncMeta({
        lastPullError: message,
        lastError: message,
        lastPullAttemptAt: new Date().toISOString()
      });
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

      const registeredState = await registerDevice();
      const remoteState = registeredState.revision > 0
        ? registeredState
        : await getRemoteCanonicalState(reason || 'auth');

      if (remoteState.revision > 0) {
        await applyCanonicalState(remoteState, { force: true });
        await setSyncMeta({
          lastPullAt: new Date().toISOString(),
          lastPullError: '',
          lastError: '',
          serverRevision: remoteState.revision,
          localRevision: remoteState.revision,
          lastReason: reason
        });
        lastRuntimeMessage = 'Данные Supabase применены локально.';
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

  async function manualSync() {
    await ensureSession();
    await registerDevice();
    const flushResult = await flushOutbox('manual');
    const outbox = await getOutbox();
    const pullResult = await pullCanonicalState('manual', {
      forceApply: outbox.length === 0
    });
    return {
      success: flushResult.success !== false && pullResult.success !== false,
      flush: flushResult,
      pull: pullResult
    };
  }

  async function syncSet(values, options = {}) {
    const nextValues = values && typeof values === 'object' ? values : {};
    await storageSet(nextValues);

    const operations = makeKvOperationsFromValues(nextValues);
    if (options.queue !== false) {
      await appendOutboxOperations(operations, options.reason || 'kv-set');
    }
    return { success: true, operationsQueued: operations.length };
  }

  async function syncRemove(keys, options = {}) {
    const normalizedKeys = Array.isArray(keys) ? keys : [keys];
    await storageRemove(normalizedKeys);
    const operations = normalizedKeys
      .map((key) => String(key || '').trim())
      .filter((key) => isKvSyncKey(key))
      .map((key) => ({ type: 'kv_delete', key }));
    if (options.queue !== false) {
      await appendOutboxOperations(operations, options.reason || 'kv-delete');
    }
    return { success: true, operationsQueued: operations.length };
  }

  async function incrementCounter(counterKey, dateKey, delta, options = {}) {
    const storageKey = String(counterKey || '');
    const normalizedDate = String(dateKey || '');
    const amount = Number(delta || 0);
    if (!storageKey || !normalizedDate || !Number.isFinite(amount) || amount === 0) {
      return { success: false, error: 'INVALID_COUNTER_INCREMENT' };
    }

    const data = await storageGet(storageKey);
    const history = isPlainObject(data[storageKey]) ? data[storageKey] : {};
    const nextValue = Math.max(0, toNonNegativeInteger(history[normalizedDate]) + Math.trunc(amount));
    history[normalizedDate] = nextValue;
    await storageSet({ [storageKey]: history });
    await appendOutboxOperations([{
      type: 'counter_increment',
      counter_key: storageKey,
      date_key: normalizedDate,
      delta: Math.trunc(amount)
    }], options.reason || 'counter-increment');
    return { success: true, value: nextValue };
  }

  async function setCounter(counterKey, dateKey, value, options = {}) {
    const storageKey = String(counterKey || '');
    const normalizedDate = String(dateKey || '');
    if (!storageKey || !normalizedDate) return { success: false, error: 'INVALID_COUNTER_SET' };
    const normalizedValue = toNonNegativeInteger(value);
    const data = await storageGet(storageKey);
    const history = isPlainObject(data[storageKey]) ? data[storageKey] : {};
    history[normalizedDate] = normalizedValue;
    await storageSet({ [storageKey]: history });
    await appendOutboxOperations([{
      type: 'counter_set',
      counter_key: storageKey,
      date_key: normalizedDate,
      value: normalizedValue
    }], options.reason || 'counter-set');
    return { success: true, value: normalizedValue };
  }

  async function addProcessedEdocids(dateIso, dateKey, edocids, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedDateKey = String(dateKey || '').trim() || isoToRuDateKey(normalizedDateIso);
    const uniqueEdocids = uniqueStrings(edocids);
    if (!normalizedDateIso || !uniqueEdocids.length) return { success: false, error: 'INVALID_EDOCIDS' };

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

    await appendOutboxOperations([{
      type: 'processed_edocids_add',
      date_iso: normalizedDateIso,
      date_key: normalizedDateKey,
      edocids: uniqueEdocids
    }], options.reason || 'processed-edocids-add');

    return {
      success: true,
      addedCount: newlyProcessed.length,
      value: toNonNegativeInteger(history[normalizedDateKey])
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

    await appendOutboxOperations([{
      type: 'processed_edit_add_edocid',
      date_iso: normalizedDateIso,
      date_key: normalizedDateKey,
      path: normalizedPath,
      edocid: normalizedEdocid
    }], options.reason || 'processed-edit-add-edocid');

    return {
      success: true,
      added: !alreadyExists,
      dayTotal: toNonNegativeInteger(history[normalizedDateKey]),
      actionCount: item.base_count
    };
  }

  async function setProcessedEdit(dateIso, path, item, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedPath = String(path || '').trim();
    if (!normalizedDateIso || !normalizedPath) return { success: false, error: 'INVALID_PROCESSED_EDIT_SET' };
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
    await appendOutboxOperations([
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
    ], options.reason || 'processed-edit-set');
    return { success: true, counterValue };
  }

  async function deleteProcessedEdit(dateIso, path, options = {}) {
    const normalizedDateIso = String(dateIso || '').trim();
    const normalizedPath = String(path || '').trim();
    if (!normalizedDateIso || !normalizedPath) return { success: false, error: 'INVALID_PROCESSED_EDIT_DELETE' };
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
    await appendOutboxOperations([
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
    ], options.reason || 'processed-edit-delete');
    return { success: true, counterValue };
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

    await appendOutboxOperations([{
      type: 'action_rule_set',
      path: normalizedPath,
      status: normalizedStatus,
      tag: normalizedTag
    }], options.reason || 'action-rule-set');

    return { success: true, approved, blocked, tags, pending };
  }

  async function setActionTag(path, tag, options = {}) {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return { success: false, error: 'INVALID_ACTION_TAG' };
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
    await appendOutboxOperations([{
      type: 'action_rule_set',
      path: normalizedPath,
      status,
      tag: normalizedTag
    }], options.reason || 'action-tag-set');
    return { success: true, status, tag: normalizedTag };
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
    const current = await storageGet(null);
    const keysToRemove = Object.keys(current || {}).filter((key) => isSyncableKey(key));
    applyingCanonicalState = true;
    try {
      if (keysToRemove.length) await storageRemove(keysToRemove);
      await storageSet(localValues);
    } finally {
      applyingCanonicalState = false;
    }
    await appendOutboxOperations(operations, 'json-import');
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

      const socket = new WebSocket(REALTIME_WS_URL);
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
    await storageRemove([SYNC_META_KEY, OUTBOX_KEY]);
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
    const lastError = lastRuntimeError || meta.lastError || meta.lastPushError || meta.lastPullError || '';
    return {
      configured: true,
      authenticated: !!currentSession,
      email: currentUser && currentUser.email ? String(currentUser.email) : '',
      userId: currentUser && currentUser.id ? String(currentUser.id) : '',
      syncing: flushInProgress || pullInProgress,
      lastSyncAt: meta.lastPushAt || meta.lastPullAt || '',
      lastPullAt: meta.lastPullAt || '',
      lastPushAt: meta.lastPushAt || '',
      lastPullError: meta.lastPullError || '',
      lastPushError: meta.lastPushError || '',
      lastError,
      message: messageOverride || lastRuntimeMessage || '',
      remotePriority: true,
      realtimeConnected: realtimeJoined,
      realtimeStatus: meta.realtimeStatus || '',
      realtimeLastError: meta.realtimeLastError || '',
      serverRevision,
      localRevision,
      outboxSize: outbox.length,
      outboxLastError: outbox.length ? String(outbox[0].lastError || '') : '',
      deviceId: meta.deviceId || '',
      schemaVersion: SCHEMA_VERSION
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
        void ensureBackgroundSyncActive('status');
        void pullCanonicalState('panel-open', { quiet: true });
        return { success: true, status: await getPublicStatus() };
      }
      if (action === 'DUP_SUPABASE_SIGN_IN') return { success: true, status: await signIn(data.email, data.password) };
      if (action === 'DUP_SUPABASE_SIGN_UP') return { success: true, status: await signUp(data.email, data.password) };
      if (action === 'DUP_SUPABASE_SIGN_OUT') return { success: true, status: await signOut() };
      if (action === 'DUP_SUPABASE_SYNC_NOW') {
        const result = await manualSync();
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
