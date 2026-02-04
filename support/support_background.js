(function () {
  const STORAGE_KEY = 'support_reminders_state_v1';
  const TARGET_STAGE = '2.4 Подтверждение решения и закрытие Запроса';
  const TARGET_STAGE_NORMALIZED = normalizeText(TARGET_STAGE);

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeRequest(rawRequest) {
    if (!rawRequest || typeof rawRequest !== 'object') return null;

    const requestId = String(rawRequest.requestId || '').trim();
    if (!requestId) return null;

    return {
      requestId,
      requestNumber: String(rawRequest.requestNumber || '').trim(),
      subject: String(rawRequest.subject || '').trim(),
      stage: String(rawRequest.stage || '').trim(),
      supportNumber: String(rawRequest.supportNumber || '').trim(),
      assignee: String(rawRequest.assignee || '').trim(),
      initiator: String(rawRequest.initiator || '').trim(),
      createdAt: String(rawRequest.createdAt || '').trim()
    };
  }

  function normalizeReminder(rawReminder) {
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
      lastKnown: normalizeRequest(rawReminder.lastKnown) || null
    };
  }

  function normalizeArchiveEntry(rawEntry) {
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
      lastKnown: normalizeRequest(rawEntry.lastKnown) || null
    };
  }

  function normalizeState(rawState) {
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const rawReminders = source.reminders && typeof source.reminders === 'object' ? source.reminders : {};
    const rawArchive = source.archive && typeof source.archive === 'object' ? source.archive : {};

    const reminders = {};
    Object.values(rawReminders).forEach((item) => {
      const normalized = normalizeReminder(item);
      if (normalized) reminders[normalized.requestId] = normalized;
    });

    const archive = {};
    Object.values(rawArchive).forEach((item) => {
      const normalized = normalizeArchiveEntry(item);
      if (normalized) archive[normalized.requestId] = normalized;
    });

    return { reminders, archive };
  }

  function stateToResponse(state) {
    const activeReminders = Object.values(state.reminders).sort((a, b) => {
      const left = Date.parse(b.updatedAt || b.createdAt || '');
      const right = Date.parse(a.updatedAt || a.createdAt || '');
      return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
    });

    const archivedReminders = Object.values(state.archive).sort((a, b) => {
      const left = Date.parse(b.archivedAt || '');
      const right = Date.parse(a.archivedAt || '');
      return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
    });

    return {
      targetStage: TARGET_STAGE,
      activeReminders,
      archivedReminders,
      remindersById: state.reminders,
      archiveById: state.archive
    };
  }

  function getState() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (data) => {
        resolve(normalizeState(data[STORAGE_KEY]));
      });
    });
  }

  function saveState(state) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
    });
  }

  function buildNotificationMessage(request, note) {
    const requestNumber = request.requestNumber ? `№ ${request.requestNumber}` : request.requestId;
    const subject = request.subject ? `\n${request.subject}` : '';
    const noteLine = note ? `\nНапоминание: ${note}` : '';
    return `Заявка ${requestNumber} перешла на этап 2.4.${subject}${noteLine}`.slice(0, 240);
  }

  function createTargetStageNotification(reminder, request) {
    chrome.notifications.create(`support-stage-${reminder.requestId}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Напоминание по заявке',
      message: buildNotificationMessage(request, reminder.note),
      silent: false
    });
  }

  function archiveReminder(state, reminder, reason) {
    state.archive[reminder.requestId] = {
      requestId: reminder.requestId,
      note: reminder.note || '',
      createdAt: reminder.createdAt || '',
      updatedAt: reminder.updatedAt || '',
      archivedAt: nowIso(),
      archivedReason: reason || 'missing_in_open_requests',
      lastKnown: reminder.lastKnown || null
    };
    delete state.reminders[reminder.requestId];
  }

  async function upsertReminder(data) {
    const request = normalizeRequest(data && data.request);
    if (!request) {
      throw new Error('Request data is required for reminder upsert.');
    }

    const note = String((data && data.note) || '').trim();
    if (!note) {
      throw new Error('Reminder text is empty.');
    }

    const state = await getState();
    const now = nowIso();
    const existingReminder = state.reminders[request.requestId];
    const archivedReminder = state.archive[request.requestId];

    if (archivedReminder) {
      delete state.archive[request.requestId];
    }

    const reminder = {
      requestId: request.requestId,
      note,
      createdAt: existingReminder?.createdAt || archivedReminder?.createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
      lastNotifiedStage: existingReminder?.lastNotifiedStage || '',
      lastKnown: request
    };

    const isTargetStage = normalizeText(request.stage) === TARGET_STAGE_NORMALIZED;
    if (isTargetStage && reminder.lastNotifiedStage !== TARGET_STAGE) {
      createTargetStageNotification(reminder, request);
      reminder.lastNotifiedStage = TARGET_STAGE;
    } else if (!isTargetStage) {
      reminder.lastNotifiedStage = '';
    }

    state.reminders[request.requestId] = reminder;
    await saveState(state);

    return stateToResponse(state);
  }

  async function deleteReminder(data) {
    const requestId = String((data && data.requestId) || '').trim();
    if (!requestId) throw new Error('requestId is required.');

    const state = await getState();
    delete state.reminders[requestId];
    await saveState(state);

    return stateToResponse(state);
  }

  async function deleteArchiveEntry(data) {
    const requestId = String((data && data.requestId) || '').trim();
    if (!requestId) throw new Error('requestId is required.');

    const state = await getState();
    delete state.archive[requestId];
    await saveState(state);

    return stateToResponse(state);
  }

  async function syncOpenRequests(data) {
    const openFilterActive = !!(data && data.openFilterActive);
    if (!openFilterActive) {
      return { synced: false, reason: 'open_filter_not_active' };
    }
    const snapshotReady = data && Object.prototype.hasOwnProperty.call(data, 'snapshotReady')
      ? !!data.snapshotReady
      : true;
    if (!snapshotReady) {
      return { synced: false, reason: 'open_requests_loading' };
    }

    const requestList = Array.isArray(data && data.requests) ? data.requests : [];
    const requestMap = {};
    requestList.forEach((item) => {
      const request = normalizeRequest(item);
      if (request) requestMap[request.requestId] = request;
    });

    const state = await getState();
    let changed = false;

    Object.keys(state.reminders).forEach((requestId) => {
      const reminder = state.reminders[requestId];
      const currentRequest = requestMap[requestId];

      if (!currentRequest) {
        archiveReminder(state, reminder, 'missing_in_open_requests');
        changed = true;
        return;
      }

      const now = nowIso();
      const previousKnown = reminder.lastKnown || null;
      if (JSON.stringify(previousKnown) !== JSON.stringify(currentRequest)) {
        changed = true;
      }
      if (!reminder.lastSeenAt) {
        changed = true;
      }
      reminder.lastSeenAt = now;
      reminder.lastKnown = currentRequest;

      const isTargetStage = normalizeText(currentRequest.stage) === TARGET_STAGE_NORMALIZED;
      if (isTargetStage) {
        if (reminder.lastNotifiedStage !== TARGET_STAGE) {
          createTargetStageNotification(reminder, currentRequest);
          reminder.lastNotifiedStage = TARGET_STAGE;
          changed = true;
        }
      } else if (reminder.lastNotifiedStage) {
        reminder.lastNotifiedStage = '';
        changed = true;
      }
    });

    if (changed) {
      await saveState(state);
    }

    return {
      synced: true,
      changed,
      activeCount: Object.keys(state.reminders).length,
      archiveCount: Object.keys(state.archive).length
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request && request.action) {
      case 'SUPPORT_GET_STATE':
        getState()
          .then((state) => sendResponse({ success: true, ...stateToResponse(state) }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case 'SUPPORT_UPSERT_REMINDER':
        upsertReminder(request.data)
          .then((stateResponse) => sendResponse({ success: true, ...stateResponse }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case 'SUPPORT_DELETE_REMINDER':
        deleteReminder(request.data)
          .then((stateResponse) => sendResponse({ success: true, ...stateResponse }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case 'SUPPORT_DELETE_ARCHIVE':
        deleteArchiveEntry(request.data)
          .then((stateResponse) => sendResponse({ success: true, ...stateResponse }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case 'SUPPORT_SYNC_OPEN_REQUESTS':
        syncOpenRequests(request.data)
          .then((result) => sendResponse({ success: true, ...result }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      default:
        return false;
    }
  });
})();
