(() => {
  'use strict';

  if (globalThis.__dupSupabaseSyncInitialized) return;
  globalThis.__dupSupabaseSyncInitialized = true;

  const SUPABASE_URL = 'https://odljanxhmjysnduylvxz.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2Z6tbzq-QJFyJVmCTbhG4w_ZZAiNu-d';
  const STATE_TABLE = 'extension_user_state';
  const STATE_VERSION = 1;

  const AUTH_SESSION_KEY = 'dup_supabase_auth_session_v1';
  const SYNC_META_KEY = 'dup_supabase_sync_meta_v1';
  const PRE_LOGIN_BACKUP_KEY = 'dup_supabase_pre_login_backup_v1';
  const SYNC_DEBOUNCE_MS = 1500;
  const SESSION_REFRESH_MARGIN_MS = 60 * 1000;

  const EXACT_SYNC_KEYS = new Set([
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
    'stats_history',
    'processed_edocids',
    'editing_stats',
    'processed_edits',
    'approved_actions',
    'blocked_actions',
    'action_tags',
    'support_reminders_state_v1',
    'dup_execution_analysis_params_v1',
    'dup_execution_analysis_state_v1',
    'dup_id_card_check_state_v1'
  ]);

  const STAGE_TIMER_KEYS = new Set([
    'dup_ui_show_stage_timer',
    'dup_ui_show_stage_timer_toggle',
    'dup_ui_show_stage_timer_abort',
    'pyramid_stage_timer_ui_visible'
  ]);

  const EXACT_EXCLUDED_KEYS = new Set([
    AUTH_SESSION_KEY,
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
    'jqgrid_settings_'
  ];

  const EXCLUDED_PREFIXES = [
    'dup_supabase_',
    'logs_'
  ];

  let currentSession = null;
  let currentUser = null;
  let bootStarted = false;
  let applyingRemoteState = false;
  let syncTimer = 0;
  let syncInProgress = false;
  let lastRuntimeMessage = '';
  let lastRuntimeError = '';

  function hasChromeStorage() {
    return !!(chrome && chrome.storage && chrome.storage.local);
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

  function isEmptyObject(value) {
    return isPlainObject(value) && Object.keys(value).length === 0;
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
    if (EXACT_SYNC_KEYS.has(normalizedKey)) return true;
    if (normalizedKey.startsWith('dup_ui_show_')) return true;
    if (SYNC_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) return true;
    return false;
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
      if (sanitized !== undefined) {
        snapshot[key] = sanitized;
      }
    });
    return snapshot;
  }

  function normalizeSession(rawSession) {
    const source = rawSession && rawSession.session
      ? rawSession.session
      : rawSession;
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
      const fields = [
        'message',
        'error_description',
        'error',
        'msg',
        'detail',
        'hint',
        'code'
      ];

      for (const field of fields) {
        const value = error[field];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
        if (value && typeof value === 'object') {
          const nestedMessage = extractSupabaseErrorMessage(value);
          if (nestedMessage) return nestedMessage;
        }
      }

      if (Array.isArray(error.errors) && error.errors.length) {
        const nestedMessage = extractSupabaseErrorMessage(error.errors[0]);
        if (nestedMessage) return nestedMessage;
      }

      try {
        return JSON.stringify(error);
      } catch (jsonError) {
        return '';
      }
    }

    return String(error);
  }

  function localizeSupabaseError(error) {
    const message = extractSupabaseErrorMessage(error) || 'Неизвестная ошибка Supabase.';
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'Неверная почта или пароль.';
    if (lower.includes('email not confirmed')) return 'Почта еще не подтверждена. Проверь письмо от Supabase и затем войди снова.';
    if (lower.includes('user already registered') || lower.includes('user already exists') || lower.includes('email_exists')) return 'Пользователь с такой почтой уже зарегистрирован.';
    if (lower.includes('password should be at least') || lower.includes('weak_password')) return 'Пароль слишком короткий.';
    if (lower.includes('email address') && lower.includes('invalid')) return 'Некорректная почта.';
    if (lower.includes('signup_disabled')) return 'Регистрация отключена в настройках Supabase Auth.';
    if (lower.includes('token has expired') || lower.includes('invalid token')) return 'Код восстановления неверный или уже истек.';
    if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) return 'Слишком много попыток. Подожди немного и попробуй снова.';
    return message;
  }

  async function parseSupabaseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return { message: text };
    }
  }

  async function refreshSession() {
    const session = currentSession || (await loadStoredSession());
    if (!session || !session.refresh_token) {
      throw new Error('Нет активной Supabase-сессии.');
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const data = await parseSupabaseResponse(response);
    if (!response.ok) {
      await clearStoredSession();
      throw new Error(localizeSupabaseError(data || response.statusText));
    }

    const refreshed = normalizeSession(data);
    if (!refreshed) {
      await clearStoredSession();
      throw new Error('Supabase не вернул новую сессию.');
    }
    await persistSession(refreshed);
    return refreshed;
  }

  async function ensureSession() {
    let session = currentSession || (await loadStoredSession());
    if (!session) {
      throw new Error('Пользователь не авторизован.');
    }
    if (Number(session.expires_at || 0) - Date.now() < SESSION_REFRESH_MARGIN_MS) {
      session = await refreshSession();
    }
    return session;
  }

  async function supabaseFetch(path, options = {}, requireAuth = true, retryOnUnauthorized = true) {
    const session = requireAuth ? await ensureSession() : null;
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: {
        ...authHeaders(session),
        ...(options.headers || {})
      }
    });
    const data = await parseSupabaseResponse(response);

    if (response.status === 401 && requireAuth && retryOnUnauthorized) {
      await refreshSession();
      return supabaseFetch(path, options, requireAuth, false);
    }

    if (!response.ok) {
      const error = new Error(localizeSupabaseError(data || response.statusText));
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
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

  async function readRemoteState() {
    const user = currentUser || await fetchCurrentUser();
    if (!user || !user.id) throw new Error('Не удалось определить пользователя Supabase.');
    const query = `/rest/v1/${STATE_TABLE}?select=state,state_version,updated_at,client_updated_at&user_id=eq.${encodeURIComponent(user.id)}&limit=1`;
    const rows = await supabaseFetch(query, { method: 'GET' }, true);
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row
      ? {
        exists: true,
        state: row.state && typeof row.state === 'object' ? row.state : {},
        updatedAt: row.updated_at || '',
        clientUpdatedAt: row.client_updated_at || ''
      }
      : { exists: false, state: {}, updatedAt: '', clientUpdatedAt: '' };
  }

  async function upsertRemoteState(snapshot) {
    const user = currentUser || await fetchCurrentUser();
    if (!user || !user.id) throw new Error('Не удалось определить пользователя Supabase.');
    const payload = [{
      user_id: user.id,
      state: snapshot || {},
      state_version: STATE_VERSION,
      client_updated_at: new Date().toISOString()
    }];
    await supabaseFetch(`/rest/v1/${STATE_TABLE}?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    }, true);
  }

  async function applyRemoteState(remoteState) {
    const state = remoteState && typeof remoteState === 'object' ? remoteState : {};
    const localData = await storageGet(null);
    const valuesToSet = {};

    Object.keys(state).forEach((key) => {
      if (!isSyncableKey(key)) return;
      const value = sanitizeValueForCloud(key, state[key]);
      if (!storageValueEquals(localData[key], value)) {
        valuesToSet[key] = value;
      }
    });

    if (!Object.keys(valuesToSet).length) return;

    applyingRemoteState = true;
    try {
      await storageSet(valuesToSet);
    } finally {
      applyingRemoteState = false;
    }
  }

  async function pullRemoteState(reason = 'manual') {
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return { success: false, error: 'NO_SESSION' };

    syncInProgress = true;
    await broadcastStatus('Синхронизация...');
    try {
      await ensureSession();
      if (!currentUser) {
        currentUser = await fetchCurrentUser();
      }
      const remote = await readRemoteState();
      const localSnapshot = await collectLocalSyncSnapshot();

      if (!remote.exists || isEmptyObject(remote.state)) {
        await upsertRemoteState(localSnapshot);
        await setSyncMeta({
          lastSyncAt: new Date().toISOString(),
          lastPullAt: new Date().toISOString(),
          lastPushAt: new Date().toISOString(),
          lastError: '',
          lastReason: reason,
          remoteWasEmpty: true
        });
        lastRuntimeMessage = 'Локальные данные отправлены в Supabase.';
        return { success: true, uploadedLocalState: true };
      }

      await storageSet({
        [PRE_LOGIN_BACKUP_KEY]: {
          createdAt: new Date().toISOString(),
          reason,
          state: localSnapshot
        }
      });
      await applyRemoteState(remote.state);
      await setSyncMeta({
        lastSyncAt: new Date().toISOString(),
        lastPullAt: new Date().toISOString(),
        lastError: '',
        lastReason: reason,
        remoteUpdatedAt: remote.updatedAt || ''
      });
      lastRuntimeMessage = 'Данные Supabase применены локально.';
      return { success: true, appliedRemoteState: true };
    } catch (error) {
      lastRuntimeError = localizeSupabaseError(error);
      await setSyncMeta({ lastError: lastRuntimeError });
      return { success: false, error: lastRuntimeError };
    } finally {
      syncInProgress = false;
      await broadcastStatus();
    }
  }

  async function flushSync(reason = 'storage-change') {
    if (syncInProgress || applyingRemoteState) return;
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return;

    syncInProgress = true;
    await broadcastStatus('Сохраняю в Supabase...');
    try {
      await ensureSession();
      const snapshot = await collectLocalSyncSnapshot();
      await upsertRemoteState(snapshot);
      await setSyncMeta({
        lastSyncAt: new Date().toISOString(),
        lastPushAt: new Date().toISOString(),
        lastError: '',
        lastReason: reason
      });
      lastRuntimeMessage = 'Данные сохранены в Supabase.';
      lastRuntimeError = '';
    } catch (error) {
      lastRuntimeError = localizeSupabaseError(error);
      await setSyncMeta({ lastError: lastRuntimeError });
    } finally {
      syncInProgress = false;
      await broadcastStatus();
    }
  }

  function scheduleSync(reason = 'storage-change') {
    if (applyingRemoteState || !currentSession) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = 0;
      void flushSync(reason);
    }, SYNC_DEBOUNCE_MS);
  }

  async function initializeAuthenticatedSession(reason) {
    if (!currentSession) await loadStoredSession();
    if (!currentSession) return;
    try {
      await ensureSession();
      if (!currentUser) await fetchCurrentUser();
      await pullRemoteState(reason || 'auth');
    } catch (error) {
      lastRuntimeError = localizeSupabaseError(error);
      await setSyncMeta({ lastError: lastRuntimeError });
      await broadcastStatus();
    }
  }

  async function signIn(email, password) {
    const payload = {
      email: String(email || '').trim(),
      password: String(password || '')
    };
    if (!payload.email || !payload.password) {
      throw new Error('Укажи почту и пароль.');
    }

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
    if (!payload.email || !payload.password) {
      throw new Error('Укажи почту и пароль.');
    }

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
      // Даже если серверный logout не ответил, локальную сессию нужно убрать.
    }
    await clearStoredSession();
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
    return {
      configured: true,
      authenticated: !!currentSession,
      email: currentUser && currentUser.email ? String(currentUser.email) : '',
      userId: currentUser && currentUser.id ? String(currentUser.id) : '',
      syncing: syncInProgress,
      lastSyncAt: meta.lastSyncAt || '',
      lastError: lastRuntimeError || meta.lastError || '',
      message: messageOverride || lastRuntimeMessage || '',
      remotePriority: true
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
    const data = message && message.data && typeof message.data === 'object'
      ? message.data
      : {};

    try {
      if (action === 'DUP_SUPABASE_GET_STATUS') {
        return { success: true, status: await getPublicStatus() };
      }
      if (action === 'DUP_SUPABASE_SIGN_IN') {
        return { success: true, status: await signIn(data.email, data.password) };
      }
      if (action === 'DUP_SUPABASE_SIGN_UP') {
        return { success: true, status: await signUp(data.email, data.password) };
      }
      if (action === 'DUP_SUPABASE_SIGN_OUT') {
        return { success: true, status: await signOut() };
      }
      if (action === 'DUP_SUPABASE_SYNC_NOW') {
        const result = await pullRemoteState('manual');
        return { success: result.success !== false, status: await getPublicStatus(), result };
      }
      if (action === 'DUP_SUPABASE_SEND_PASSWORD_RECOVERY') {
        return { success: true, status: await sendPasswordRecovery(data.email) };
      }
      if (action === 'DUP_SUPABASE_CONFIRM_PASSWORD_RECOVERY') {
        return {
          success: true,
          status: await confirmPasswordRecovery(data.email, data.token, data.password)
        };
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
      if (!action.startsWith('DUP_SUPABASE_')) return false;
      handleRuntimeMessage(message).then((response) => {
        sendResponse(response || { success: false, error: 'UNKNOWN_ACTION' });
      });
      return true;
    });
  }

  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || applyingRemoteState || !currentSession) return;
      const changedKeys = Object.keys(changes || {});
      if (changedKeys.some((key) => isSyncableKey(key))) {
        scheduleSync('storage-change');
      }
    });
  }

  async function boot() {
    if (bootStarted) return;
    bootStarted = true;
    await loadStoredSession();
    if (currentSession) {
      await initializeAuthenticatedSession('startup');
    } else {
      await broadcastStatus();
    }
  }

  globalThis.__dupSupabaseSync = {
    isSyncableKey,
    collectLocalSyncSnapshot,
    pullRemoteState,
    flushSync
  };

  setTimeout(() => {
    void boot();
  }, 0);
})();
