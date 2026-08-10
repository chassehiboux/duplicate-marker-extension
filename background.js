// Этот скрипт обрабатывает фоновые операции расширения.

// --- Подключение модулей ---
try {
    importScripts('SupabaseSync/supabase_sync.js');
    importScripts('Check_INN_DeathDate/inn_death_background.js');
    importScripts('support/support_background.js');
    importScripts('GoogleSheets/problem_picker_background.js');
    // importScripts('StageTimer/telemetry_background.js'); // Логика интегрирована внутрь
} catch (e) {
    console.error("Ошибка импорта скриптов в background.js:", e);
}

// === КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦЫ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkP1L4n2Qc_GR1RigdEnX1kiG4Hw4eE5V3cDNrm3VV4ZYT8db8yTUUKLng1Pvj4Cp7/exec';
const TELEMETRY_RETRIES = 3;
const telemetryQueue = [];
let isTelemetryQueueRunning = false;
const VZID_CAPTURE_TTL_MS = 30 * 60 * 1000;
const vzidCaptureStore = new Map();

function cleanupVzidCaptureStore() {
    const now = Date.now();
    for (const [token, payload] of vzidCaptureStore.entries()) {
        if (!payload || !payload.createdAtMs || (now - payload.createdAtMs) > VZID_CAPTURE_TTL_MS) {
            vzidCaptureStore.delete(token);
        }
    }
}

function createVzidToken() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

// --- Утилита для логирования ---
const LOG_KEY = 'extension_logs'; // Ключ для хранения логов в chrome.storage
const MAX_LOG_ENTRIES = 100; // Максимальное количество записей в логе
const DEPARTMENT_CONTAINER_STORAGE_KEY = 'dup_department_container_cookie_stores_v1';
const ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY = 'idCardCheckFailedReturnsByTab';
const DEPARTMENT_CONTAINER_ICON = 'briefcase';

const addLog = (message) => {
  try {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = `${timestamp}: ${message}`;
    
    chrome.storage.local.get(LOG_KEY, (data) => {
      let logs = data[LOG_KEY] || [];
      logs.unshift(logEntry);
      if (logs.length > MAX_LOG_ENTRIES) {
        logs.length = MAX_LOG_ENTRIES;
      }
      chrome.storage.local.set({ [LOG_KEY]: logs });
    });
  } catch(e) {
    console.error("Не удалось записать в лог расширения:", e);
  }
};

function createExtensionNotification(options) {
    if (!chrome.notifications || typeof chrome.notifications.create !== 'function') return;

    try {
        chrome.notifications.create(options, () => {
            if (chrome.runtime.lastError) {
                addLog(`Ошибка уведомления: ${chrome.runtime.lastError.message}`);
            }
        });
    } catch (e) {
        addLog(`Ошибка уведомления: ${e.message}`);
    }
}

function getContextualIdentitiesApi() {
    if (typeof browser !== 'undefined' && browser.contextualIdentities) {
        return { api: browser.contextualIdentities, promise: true };
    }
    if (typeof chrome !== 'undefined' && chrome.contextualIdentities) {
        return { api: chrome.contextualIdentities, promise: false };
    }
    return null;
}

function isDepartmentContainerSupported() {
    return !!(
        getContextualIdentitiesApi() &&
        chrome.tabs &&
        typeof chrome.tabs.create === 'function'
    );
}

function callContextualIdentityApi(method, ...args) {
    const apiInfo = getContextualIdentitiesApi();
    if (!apiInfo || typeof apiInfo.api[method] !== 'function') {
        return Promise.reject(new Error('CONTEXTUAL_IDENTITIES_UNSUPPORTED'));
    }

    if (apiInfo.promise) {
        return apiInfo.api[method](...args);
    }

    return new Promise((resolve, reject) => {
        try {
            apiInfo.api[method](...args, (result) => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(result);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function chromeStorageGetAsync(keys) {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(keys, (result) => resolve(result || {}));
        } catch (error) {
            resolve({});
        }
    });
}

function chromeStorageSetAsync(values) {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.set(values, () => resolve(true));
        } catch (error) {
            resolve(false);
        }
    });
}

function chromeSessionStorageGetAsync(keys) {
    return new Promise((resolve) => {
        try {
            if (!chrome.storage || !chrome.storage.session || typeof chrome.storage.session.get !== 'function') {
                resolve({});
                return;
            }
            chrome.storage.session.get(keys, (result) => resolve(result || {}));
        } catch (error) {
            resolve({});
        }
    });
}

function chromeSessionStorageSetAsync(values) {
    return new Promise((resolve) => {
        try {
            if (!chrome.storage || !chrome.storage.session || typeof chrome.storage.session.set !== 'function') {
                resolve(false);
                return;
            }
            chrome.storage.session.set(values, () => resolve(!chrome.runtime.lastError));
        } catch (error) {
            resolve(false);
        }
    });
}

function delayAsync(timeoutMs) {
    return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

async function waitForTabCompleteAsync(tabId, timeoutMs = 15000) {
    const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || 15000);
    const startedAt = Date.now();

    while ((Date.now() - startedAt) <= safeTimeoutMs) {
        try {
            const tab = await getTabAsync(tabId);
            if (tab && tab.status === 'complete') return tab;
        } catch (error) {
            // tab may still be initializing, keep waiting until timeout
        }
        await delayAsync(150);
    }

    return getTabAsync(tabId);
}

function getDupSyncStore() {
    return globalThis.__dupSupabaseSync || null;
}

async function dupSyncSetActionRule(path, status, tag, options = {}) {
    const store = getDupSyncStore();
    if (store && typeof store.setActionRule === 'function') {
        return store.setActionRule(path, status, tag, options);
    }
    return { success: false, error: 'SYNC_STORE_UNAVAILABLE' };
}

async function dupSyncAddProcessedEdocids(dateIso, dateKey, edocids, options = {}) {
    const store = getDupSyncStore();
    if (store && typeof store.addProcessedEdocids === 'function') {
        return store.addProcessedEdocids(dateIso, dateKey, edocids, options);
    }
    return { success: false, error: 'SYNC_STORE_UNAVAILABLE' };
}

async function dupSyncAddProcessedEditEdocid(dateIso, dateKey, path, edocid, options = {}) {
    const store = getDupSyncStore();
    if (store && typeof store.addProcessedEditEdocid === 'function') {
        return store.addProcessedEditEdocid(dateIso, dateKey, path, edocid, options);
    }
    return { success: false, error: 'SYNC_STORE_UNAVAILABLE' };
}

function normalizeDepartmentContainerTarget(data) {
    const raw = data && typeof data === 'object' ? data : {};
    const depid = String(raw.depid || '').trim();
    const url = String(raw.url || '').trim();
    const title = String(raw.title || '').trim();
    const color = String(raw.color || '').trim();
    const allowedColors = new Set(['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'toolbar']);

    if (!depid || !url || !title || !allowedColors.has(color)) return null;

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') return null;
    } catch (error) {
        return null;
    }

    return {
        depid,
        url,
        title,
        color,
        icon: DEPARTMENT_CONTAINER_ICON
    };
}

async function getDepartmentContainerMap() {
    const stored = await chromeStorageGetAsync(DEPARTMENT_CONTAINER_STORAGE_KEY);
    const rawMap = stored[DEPARTMENT_CONTAINER_STORAGE_KEY];
    return rawMap && typeof rawMap === 'object' ? rawMap : {};
}

async function setDepartmentContainerMap(nextMap) {
    await chromeStorageSetAsync({ [DEPARTMENT_CONTAINER_STORAGE_KEY]: nextMap || {} });
}

async function queryAllContextualIdentities() {
    try {
        const identities = await callContextualIdentityApi('query', {});
        return Array.isArray(identities) ? identities : [];
    } catch (error) {
        return [];
    }
}

async function ensureDepartmentContainer(target) {
    if (!isDepartmentContainerSupported()) {
        throw new Error('CONTEXTUAL_IDENTITIES_UNSUPPORTED');
    }

    const map = await getDepartmentContainerMap();
    const identities = await queryAllContextualIdentities();
    const storedCookieStoreId = String(map[target.depid] || '').trim();
    let identity = storedCookieStoreId
        ? identities.find((item) => item && item.cookieStoreId === storedCookieStoreId)
        : null;

    if (!identity) {
        identity = identities.find((item) => item && item.name === target.title) || null;
    }

    if (identity && identity.cookieStoreId) {
        if (identity.name !== target.title || identity.color !== target.color || identity.icon !== target.icon) {
            try {
                identity = await callContextualIdentityApi('update', identity.cookieStoreId, {
                    name: target.title,
                    color: target.color,
                    icon: target.icon
                });
            } catch (error) {
                addLog(`Не удалось обновить контейнер ${target.title}: ${error.message || error}`);
            }
        }
        if (map[target.depid] !== identity.cookieStoreId) {
            map[target.depid] = identity.cookieStoreId;
            await setDepartmentContainerMap(map);
        }
        return identity;
    }

    const created = await callContextualIdentityApi('create', {
        name: target.title,
        color: target.color,
        icon: target.icon
    });
    if (!created || !created.cookieStoreId) {
        throw new Error('CONTAINER_CREATE_FAILED');
    }

    map[target.depid] = created.cookieStoreId;
    await setDepartmentContainerMap(map);
    return created;
}

function createTabAsync(createProperties) {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.create(createProperties, (tab) => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(tab || null);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function updateTabAsync(tabId, updateProperties) {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.update(tabId, updateProperties, (tab) => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(tab || null);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function removeTabAsync(tabId) {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.remove(tabId, () => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(true);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function sendTabMessageAsync(tabId, message) {
    return new Promise((resolve) => {
        try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                void (chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '');
                resolve(response || null);
            });
        } catch (error) {
            resolve(null);
        }
    });
}

function getTabAsync(tabId) {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.get(tabId, (tab) => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(tab || null);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function normalizeEpguRegistryScanUrl(value, expectedHost) {
    const rawValue = String(value || '').trim();
    const normalizedHost = String(expectedHost || '').trim().toLowerCase();
    if (!rawValue || !normalizedHost) return '';

    try {
        const parsed = new URL(rawValue);
        if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== normalizedHost) return '';
        return parsed.toString();
    } catch (error) {
        return '';
    }
}

function normalizeEpguRegistryScanRequest(data) {
    const raw = data && typeof data === 'object' ? data : {};
    const baseHost = String(raw.baseHost || '').trim().toLowerCase();
    const checkDate = String(raw.checkDate || '').trim();
    const restoreDepid = String(raw.restoreDepid || '').trim();
    const restoreUrl = normalizeEpguRegistryScanUrl(raw.restoreUrl, baseHost);
    const rawDepartments = Array.isArray(raw.departments) ? raw.departments : [];
    const departments = [];
    const usedDepids = new Set();

    for (const item of rawDepartments) {
        const depid = String(item && item.depid || '').trim();
        const label = String(item && item.label || '').replace(/\s+/g, ' ').trim();
        const switchUrl = normalizeEpguRegistryScanUrl(item && item.switchUrl, baseHost);
        if (!depid || !label || !switchUrl || usedDepids.has(depid)) continue;
        usedDepids.add(depid);
        departments.push({ depid, label, switchUrl });
    }

    if (
        !baseHost ||
        !/^\d{2}\.\d{2}\.\d{4}$/.test(checkDate) ||
        !restoreDepid ||
        !restoreUrl ||
        departments.length < 1 ||
        !usedDepids.has(restoreDepid)
    ) {
        return null;
    }

    return { baseHost, checkDate, restoreDepid, restoreUrl, departments };
}

async function collectEpguRegistryRowsInTab(tabId, requestData) {
    const result = await executeScriptInTabAsync(tabId, async (payload) => {
        const normalizeText = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        if (String(window.location.hostname || '').trim().toLowerCase() !== payload.baseHost) {
            return { success: false, error: 'WRONG_BASE_HOST' };
        }

        const endpoint = new URL('/ovzid/fsspreestr/data', window.location.origin);
        const filters = {
            groupOp: 'AND',
            rules: [{
                field: 'CreateDate',
                op: 'cn',
                data: `${payload.checkDate}-${payload.checkDate}`
            }]
        };

        const fetchPage = async (pageNo) => {
            const target = new URL(endpoint.toString());
            const params = {
                page: pageNo,
                rows: 300,
                sidx: 'Id',
                sord: 'desc',
                _search: 'true',
                filters: JSON.stringify(filters)
            };
            Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, String(value)));
            const response = await fetch(target.toString(), {
                method: 'GET',
                credentials: 'include',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const responseText = await response.text();
            if (!response.ok) {
                throw new Error(`HTTP_${response.status}`);
            }
            try {
                return JSON.parse(responseText);
            } catch (error) {
                throw new Error('INVALID_JSON');
            }
        };

        try {
            const firstPage = await fetchPage(1);
            const totalPages = Math.max(1, Number(firstPage && firstPage.total || 1));
            const sourceRows = Array.isArray(firstPage && firstPage.rows) ? firstPage.rows.slice() : [];
            for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
                const nextPage = await fetchPage(pageNo);
                if (Array.isArray(nextPage && nextPage.rows)) sourceRows.push(...nextPage.rows);
            }

            const rows = sourceRows.map((item) => {
                const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
                return {
                    registryId: normalizeText(cell.Id || (item && item.id)),
                    statusName: normalizeText(cell.StatusName),
                    claimantName: normalizeText(cell.ClaimantName),
                    typeName: normalizeText(cell.TypeName),
                    fileName: normalizeText(cell.FileName),
                    createDate: normalizeText(cell.CreateDate)
                };
            }).filter((item) => (
                item.createDate === payload.checkDate && (item.registryId || item.fileName)
            ));

            return { success: true, rows, totalPages };
        } catch (error) {
            return {
                success: false,
                error: error && error.message ? error.message : 'FETCH_FAILED'
            };
        }
    }, [requestData], { world: 'MAIN' });

    if (!result || result.success !== true || !Array.isArray(result.rows)) {
        throw new Error(result && result.error ? result.error : 'REGISTRY_ROWS_UNAVAILABLE');
    }
    return result.rows;
}

async function verifyEpguRegistryDepartmentInTab(tabId, depid) {
    const activeDepid = await executeScriptInTabAsync(tabId, () => {
        const activeLink = document.querySelector('a.department-switch.active');
        if (!(activeLink instanceof HTMLAnchorElement)) return '';
        const attrDepid = String(activeLink.getAttribute('data-depid') || activeLink.getAttribute('depid') || '').trim();
        if (attrDepid) return attrDepid;
        try {
            const match = String(new URL(activeLink.href, window.location.origin).pathname || '')
                .match(/\/login\/department\/(\d+)(?:\/|$)/i);
            return match ? match[1] : '';
        } catch (error) {
            return '';
        }
    }, [], { world: 'MAIN' });
    return String(activeDepid || '').trim() === String(depid || '').trim();
}

async function navigateEpguRegistryWorkerTab(tabId, targetUrl, expectedDepid) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            await updateTabAsync(tabId, { url: targetUrl, active: false });
            await waitForTabCompleteAsync(tabId, 30000);
            await delayAsync(350);
            if (!expectedDepid || await verifyEpguRegistryDepartmentInTab(tabId, expectedDepid)) return true;
            lastError = new Error('DEPARTMENT_NOT_SELECTED');
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('DEPARTMENT_NAVIGATION_FAILED');
}

async function runEpguRegistryScan(sourceTab, scanRequest) {
    const sourceTabId = sourceTab && Number.isInteger(sourceTab.id) ? sourceTab.id : null;
    const sourceWindowId = sourceTab && Number.isInteger(sourceTab.windowId) ? sourceTab.windowId : null;
    const sourceCookieStoreId = sourceTab && typeof sourceTab.cookieStoreId === 'string'
        ? sourceTab.cookieStoreId.trim()
        : '';
    if (!Number.isInteger(sourceTabId)) throw new Error('NO_SOURCE_TAB');

    const createProperties = {
        url: scanRequest.departments[0].switchUrl,
        active: false,
        openerTabId: sourceTabId
    };
    if (Number.isInteger(sourceWindowId)) createProperties.windowId = sourceWindowId;
    if (sourceCookieStoreId) createProperties.cookieStoreId = sourceCookieStoreId;

    let workerTabId = null;
    let restoreCompleted = false;
    let scanError = null;
    const collectedRows = [];

    try {
        let workerTab = null;
        try {
            workerTab = await createTabAsync(createProperties);
        } catch (error) {
            if (!createProperties.cookieStoreId) throw error;
            const fallbackProperties = { ...createProperties };
            delete fallbackProperties.cookieStoreId;
            workerTab = await createTabAsync(fallbackProperties);
        }
        workerTabId = workerTab && Number.isInteger(workerTab.id) ? workerTab.id : null;
        if (!Number.isInteger(workerTabId)) throw new Error('NO_WORKER_TAB');

        for (let index = 0; index < scanRequest.departments.length; index += 1) {
            const department = scanRequest.departments[index];
            await sendTabMessageAsync(sourceTabId, {
                action: 'EPGU_REGISTRY_SCAN_PROGRESS',
                data: {
                    current: index,
                    total: scanRequest.departments.length,
                    department: department.label
                }
            });

            let departmentRows = null;
            try {
                await navigateEpguRegistryWorkerTab(workerTabId, department.switchUrl, department.depid);
                let lastFetchError = null;
                for (let attempt = 1; attempt <= 2; attempt += 1) {
                    try {
                        departmentRows = await collectEpguRegistryRowsInTab(workerTabId, {
                            baseHost: scanRequest.baseHost,
                            checkDate: scanRequest.checkDate
                        });
                        break;
                    } catch (error) {
                        lastFetchError = error;
                        if (attempt < 2) await delayAsync(500);
                    }
                }
                if (!Array.isArray(departmentRows)) throw lastFetchError || new Error('REGISTRY_FETCH_FAILED');
            } catch (error) {
                throw new Error(
                    `Не удалось проверить департамент «${department.label}»: ${error && error.message ? error.message : error}`
                );
            }
            departmentRows.forEach((row) => {
                collectedRows.push({ ...row, department: department.label, depid: department.depid });
            });

            await sendTabMessageAsync(sourceTabId, {
                action: 'EPGU_REGISTRY_SCAN_PROGRESS',
                data: {
                    current: index + 1,
                    total: scanRequest.departments.length,
                    department: department.label
                }
            });
        }
    } catch (error) {
        scanError = error;
    } finally {
        if (Number.isInteger(workerTabId)) {
            try {
                await sendTabMessageAsync(sourceTabId, {
                    action: 'EPGU_REGISTRY_SCAN_PROGRESS',
                    data: {
                        current: scanRequest.departments.length,
                        total: scanRequest.departments.length,
                        department: 'Возврат исходного департамента',
                        restoring: true
                    }
                });
                await navigateEpguRegistryWorkerTab(workerTabId, scanRequest.restoreUrl, scanRequest.restoreDepid);
                restoreCompleted = true;
            } catch (error) {
                if (!scanError) scanError = new Error(`RESTORE_FAILED:${error && error.message ? error.message : error}`);
            }

            if (restoreCompleted) {
                try {
                    await removeTabAsync(workerTabId);
                } catch (error) {
                    if (!scanError) scanError = error;
                }
            } else {
                try {
                    await updateTabAsync(workerTabId, { active: true });
                } catch (error) {
                    // The source response below still explains that manual restoration is required.
                }
            }
        } else {
            restoreCompleted = true;
        }

        if (restoreCompleted) {
            try {
                await updateTabAsync(sourceTabId, { active: true });
            } catch (error) {
                // The scan result can still be returned if the source tab was closed meanwhile.
            }
        }
    }

    if (!restoreCompleted) {
        throw new Error('Не удалось подтвердить возврат исходного департамента. Служебная вкладка оставлена открытой.');
    }
    if (scanError) throw scanError;

    return {
        rows: collectedRows,
        departmentCount: scanRequest.departments.length
    };
}

function executeScriptInTabAsync(tabId, func, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const request = {
                target: { tabId: Number(tabId) },
                func,
                args: Array.isArray(args) ? args : []
            };
            if (options && options.world) {
                request.world = options.world;
            }

            chrome.scripting.executeScript(request, (results) => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(Array.isArray(results) && results[0] ? results[0].result : null);
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function prepareIdCardCheckEditedocReturnAsync(tabId, edocId, transitionText, timeoutMs = 20000) {
    await waitForTabCompleteAsync(tabId, Math.min(Math.max(1000, Number(timeoutMs) || 20000), 15000));

    const result = await executeScriptInTabAsync(
        tabId,
        (expectedEdocId, actionText) => {
            const HISTORY_PREFIX = 'Документ пришел с ';

            const normalizeText = (value) => String(value === undefined || value === null ? '' : value).trim();
            const normalizeStageText = (value) => String(value || '')
                .toLowerCase()
                .replace(/ё/g, 'е')
                .replace(/[,.;:!?()"`'«»\[\]{}]/g, ' ')
                .replace(/\bоконченые\b/g, 'оконченные')
                .replace(/\bвовзращенн/g, 'возвращенн')
                .replace(/\bвозвращеные\b/g, 'возвращенные')
                .replace(/\s+/g, ' ')
                .trim();
            const formatTm = (stage, status) => {
                const normalizedStage = normalizeText(stage);
                const normalizedStatus = normalizeText(status);
                if (normalizedStage && normalizedStatus) return `${normalizedStage}\\${normalizedStatus}`;
                return normalizedStage || normalizedStatus;
            };
            const splitTmValue = (tmText) => {
                const normalizedTmText = normalizeText(tmText);
                const separatorIndex = normalizedTmText.indexOf('\\');
                if (separatorIndex < 0) {
                    return {
                        tmText: normalizedTmText,
                        stage: normalizedTmText,
                        status: ''
                    };
                }
                return {
                    tmText: normalizedTmText,
                    stage: normalizedTmText.slice(0, separatorIndex).trim(),
                    status: normalizedTmText.slice(separatorIndex + 1).trim()
                };
            };
            const parseOptionText = (text) => {
                const normalizedOptionText = normalizeText(text);
                const separatorIndex = normalizedOptionText.indexOf(' / ');
                if (separatorIndex < 0) {
                    return {
                        text: normalizedOptionText,
                        stage: normalizedOptionText,
                        status: ''
                    };
                }
                return {
                    text: normalizedOptionText,
                    stage: normalizedOptionText.slice(0, separatorIndex).trim(),
                    status: normalizedOptionText.slice(separatorIndex + 3).trim()
                };
            };
            const collectTransitionCandidates = (text) => {
                const normalizedActionText = normalizeText(text);
                if (!normalizedActionText.startsWith(HISTORY_PREFIX)) return [];

                const body = normalizedActionText.slice(HISTORY_PREFIX.length).trim();
                const candidates = [];
                const seen = new Set();
                let searchIndex = 0;

                while (searchIndex >= 0 && searchIndex < body.length) {
                    const separatorIndex = body.indexOf(' на ', searchIndex);
                    if (separatorIndex < 0) break;

                    const previousTm = body.slice(0, separatorIndex).trim();
                    const currentTm = body.slice(separatorIndex + 4).trim();
                    const previous = splitTmValue(previousTm);
                    const current = splitTmValue(currentTm);
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
            };
            const getEditedocEdocId = () => {
                try {
                    return normalizeText(new URL(window.location.href).searchParams.get('edocid'));
                } catch (error) {
                    return '';
                }
            };
            const getDocumentSummary = () => {
                const title = normalizeText(document.title || '');
                const href = normalizeText(window.location.href || '');
                const bodyText = normalizeText((document.body && document.body.textContent) ? document.body.textContent : '').slice(0, 240);
                return [title ? `title=${title}` : '', href ? `url=${href}` : '', bodyText ? `body=${bodyText}` : '']
                    .filter(Boolean)
                    .join(', ');
            };
            const isEditedocLocation = () => {
                const pathname = String(window.location.pathname || '').toLowerCase();
                if (!pathname.includes('/ovzid/actions/editedoc')) return false;
                const currentEdocId = getEditedocEdocId();
                return !normalizeText(expectedEdocId) || currentEdocId === normalizeText(expectedEdocId);
            };
            const collectStatusOptions = () => {
                const select = document.querySelector('select[name="StatusID"]');
                if (!(select instanceof HTMLSelectElement)) return [];
                return Array.from(select.options).map((option) => {
                    const parsed = parseOptionText(option.textContent || '');
                    return {
                        value: normalizeText(option.value),
                        text: parsed.text,
                        stage: parsed.stage,
                        status: parsed.status,
                        normalizedStage: normalizeStageText(parsed.stage),
                        normalizedStatus: normalizeStageText(parsed.status),
                        selected: option.selected === true
                    };
                });
            };
            const isStatusOptionMatch = (option, stage, status) => (
                !!(
                    option &&
                    option.value &&
                    option.normalizedStage === normalizeStageText(stage) &&
                    option.normalizedStatus === normalizeStageText(status)
                )
            );
            const findStatusOption = (options, stage, status) => {
                return (Array.isArray(options) ? options : []).find((option) => (
                    isStatusOptionMatch(option, stage, status)
                )) || null;
            };
            const getSelectedCurrentOption = (options) => (
                (Array.isArray(options) ? options : []).find((option) => option && option.selected) || null
            );
            const getSubmitButton = () => Array.from(document.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]')).find((element) => {
                if (!(element instanceof HTMLButtonElement) && !(element instanceof HTMLInputElement)) return false;
                const text = normalizeStageText(element.textContent || element.getAttribute('value') || '');
                return text.includes(normalizeStageText('Сохранить'));
            }) || null;
            const triggerReturn = (statusOptionValue) => {
                const select = document.querySelector('select[name="StatusID"]');
                const submitButton = getSubmitButton();
                const form = select instanceof HTMLSelectElement ? select.closest('form') : null;

                if (!(select instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) {
                    throw new Error('На форме editedoc не найдены нужные элементы.');
                }

                select.value = normalizeText(statusOptionValue);
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));

                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit(
                        submitButton instanceof HTMLButtonElement || submitButton instanceof HTMLInputElement
                            ? submitButton
                            : undefined
                    );
                    return;
                }

                if (submitButton instanceof HTMLButtonElement || submitButton instanceof HTMLInputElement) {
                    submitButton.click();
                    return;
                }

                form.submit();
            };

            if (!isEditedocLocation()) {
                return {
                    success: false,
                    error: `Во вкладке EdocID ${normalizeText(expectedEdocId)} не открыта форма editedoc. ${getDocumentSummary()}`
                };
            }

            const statusOptions = collectStatusOptions();
            if (!statusOptions.length) {
                return {
                    success: false,
                    error: 'На форме editedoc не найден dropdown со стадиями/статусами.'
                };
            }

            const candidates = collectTransitionCandidates(actionText);
            if (!candidates.length) {
                return {
                    success: false,
                    error: `Не удалось разобрать предыдущую ТМ из action_history: ${normalizeText(actionText)}`
                };
            }

            const selectedCurrentOption = getSelectedCurrentOption(statusOptions);
            const resolvedCandidates = candidates.map((candidate) => ({
                ...candidate,
                matchedOption: findStatusOption(statusOptions, candidate.previousStage, candidate.previousStatus),
                currentMatchesSelected: !!selectedCurrentOption && isStatusOptionMatch(
                    selectedCurrentOption,
                    candidate.currentStage,
                    candidate.currentStatus
                )
            }));
            const resolvedPreviousTm = resolvedCandidates.find((candidate) => (
                candidate.currentMatchesSelected && candidate.matchedOption
            )) || resolvedCandidates.find((candidate) => (
                candidate.currentMatchesSelected
            )) || resolvedCandidates.find((candidate) => (
                candidate.matchedOption
            )) || resolvedCandidates[0] || null;

            const previousTmText = formatTm(
                resolvedPreviousTm && resolvedPreviousTm.previousStage,
                resolvedPreviousTm && resolvedPreviousTm.previousStatus
            );
            if (!resolvedPreviousTm || !resolvedPreviousTm.matchedOption) {
                return {
                    success: true,
                    submitted: false,
                    previousTmText
                };
            }

            window.setTimeout(() => {
                try {
                    triggerReturn(resolvedPreviousTm.matchedOption.value);
                } catch (error) {
                    console.error('Не удалось отправить форму editedoc для возврата на предыдущую ТМ.', error);
                }
            }, 0);

            return {
                success: true,
                submitted: true,
                previousTmText
            };
        },
        [edocId, transitionText]
    );

    if (!result || result.success !== true) {
        throw new Error(result && result.error ? result.error : `Не удалось подготовить editedoc для EdocID ${String(edocId || '').trim()}.`);
    }
    return result;
}

async function confirmIdCardCheckEditedocReturnAsync(tabId, edocId, timeoutMs = 30000) {
    const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || 30000);
    const startedAt = Date.now();
    let lastSummary = '';

    while ((Date.now() - startedAt) <= safeTimeoutMs) {
        try {
            await waitForTabCompleteAsync(tabId, Math.min(5000, Math.max(1000, safeTimeoutMs - (Date.now() - startedAt))));
        } catch (error) {
            // tab may be navigating between checks
        }

        const result = await executeScriptInTabAsync(
            tabId,
            (expectedEdocId) => {
                const normalizeText = (value) => String(value === undefined || value === null ? '' : value).trim();
                const normalizeStageText = (value) => String(value || '')
                    .toLowerCase()
                    .replace(/ё/g, 'е')
                    .replace(/[,.;:!?()"`'«»\[\]{}]/g, ' ')
                    .replace(/\bоконченые\b/g, 'оконченные')
                    .replace(/\bвовзращенн/g, 'возвращенн')
                    .replace(/\bвозвращеные\b/g, 'возвращенные')
                    .replace(/\s+/g, ' ')
                    .trim();
                const getDocumentSummary = () => {
                    const title = normalizeText(document.title || '');
                    const href = normalizeText(window.location.href || '');
                    const bodyText = normalizeText((document.body && document.body.textContent) ? document.body.textContent : '').slice(0, 240);
                    return [title ? `title=${title}` : '', href ? `url=${href}` : '', bodyText ? `body=${bodyText}` : '']
                        .filter(Boolean)
                        .join(', ');
                };
                const isLoginDocument = () => {
                    const pathname = String(window.location.pathname || '').toLowerCase();
                    return pathname.includes('/login/');
                };
                const getEditedocEdocId = () => {
                    try {
                        return normalizeText(new URL(window.location.href).searchParams.get('edocid'));
                    } catch (error) {
                        return '';
                    }
                };
                const isEditedocLocation = () => {
                    const pathname = String(window.location.pathname || '').toLowerCase();
                    if (!pathname.includes('/ovzid/actions/editedoc')) return false;
                    const currentEdocId = getEditedocEdocId();
                    return !normalizeText(expectedEdocId) || currentEdocId === normalizeText(expectedEdocId);
                };

                if (String(document.readyState || '').toLowerCase() === 'loading') {
                    return { state: 'pending', summary: getDocumentSummary() };
                }

                if (isLoginDocument()) {
                    return {
                        state: 'error',
                        error: 'Сайт вернул страницу логина вместо подтверждения сохранения.',
                        summary: getDocumentSummary()
                    };
                }

                const normalizedBodyText = normalizeStageText(document.body ? document.body.textContent || '' : '');
                if (
                    normalizedBodyText.includes(normalizeStageText('Информация успешно обновлена')) &&
                    normalizedBodyText.includes(normalizeStageText('Вы можете закрыть это окно'))
                ) {
                    return { state: 'success', summary: getDocumentSummary() };
                }

                const rawBodyText = normalizeText(document.body ? document.body.textContent || '' : '');
                if (rawBodyText.includes('ERROR EXCEPTION') || rawBodyText.includes('No query results for model')) {
                    return {
                        state: 'error',
                        error: `Форма editedoc не подтвердила сохранение: ${getDocumentSummary()}`,
                        summary: getDocumentSummary()
                    };
                }

                if (!isEditedocLocation()) {
                    return { state: 'pending', summary: getDocumentSummary() };
                }

                return { state: 'pending', summary: getDocumentSummary() };
            },
            [edocId]
        );

        if (result && typeof result.summary === 'string' && result.summary.trim()) {
            lastSummary = result.summary.trim();
        }

        if (result && result.state === 'success') {
            return true;
        }

        if (result && result.state === 'error') {
            throw new Error(result.error || `Форма editedoc не подтвердила сохранение для EdocID ${String(edocId || '').trim()}.`);
        }

        await delayAsync(200);
    }

    throw new Error(
        lastSummary
            ? `Форма editedoc не подтвердила сохранение: ${lastSummary}`
            : `Истек таймаут ожидания подтверждения editedoc для EdocID ${String(edocId || '').trim()}.`
    );
}

// --- Функция надежной отправки (POST + Retry) ---
async function sendWithRetry(url, payload, retries = TELEMETRY_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload),
                keepalive: true, 
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            
            if (text.includes("Busy")) {
                console.warn(`[TELEMETRY] Server busy. Retry ${i + 1}/${retries}`);
                await new Promise(r => setTimeout(r, 2000 * (i + 1))); 
                continue;
            }

            console.log(`[TELEMETRY] Success: ${payload.stageName}`);
            return true;

        } catch (err) {
            console.error(`[TELEMETRY] Attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    console.error(`[TELEMETRY] Failed to send data after ${retries} attempts.`);
    return false;
}

function enqueueTelemetry(payload) {
    if (!payload) return;
    if (!GOOGLE_SCRIPT_URL) {
        console.error("[TELEMETRY] URL для отправки данных не задан.");
        return;
    }
    telemetryQueue.push(payload);
    if (!isTelemetryQueueRunning) {
        processTelemetryQueue().catch((err) => {
            console.error("[TELEMETRY] Telemetry queue crash:", err);
        });
    }
}

async function processTelemetryQueue() {
    if (isTelemetryQueueRunning) return;
    isTelemetryQueueRunning = true;
    try {
        while (telemetryQueue.length > 0) {
            const payload = telemetryQueue.shift();
            await sendWithRetry(GOOGLE_SCRIPT_URL, payload, TELEMETRY_RETRIES);
        }
    } finally {
        isTelemetryQueueRunning = false;
        if (telemetryQueue.length > 0) {
            processTelemetryQueue().catch((err) => {
                console.error("[TELEMETRY] Telemetry queue restart error:", err);
            });
        }
    }
}


// === STAGE TIMER LOGIC (NETWORK BASED) ===
// Отслеживаем загрузку данных (GET) для таймера стадий
const STAGE_URL_PATTERNS = [
    "*://*/ovzid/*/data*", 
    "*://*/ovzid/actions/editedoc*", 
    "*://*/ovzid/claims/execution*",
    "*://*/pu/ReestrSendToOVZID*",
    "*://*/datagrids/slowsearch*",
    "*://*/grid-data*",
    "*://*/big-debtors/grid-data*"
]; 

const EXECUTION_MAP = {
    "execution-fssp": "Формирование заявление (ФССП)",
    "execution-fsspd": "Формирование заявление (ФССП умершие)",
    "execution-fsspb": "Формирование заявление (ФССП банкроты)",
    "execution-pf": "Формирование заявление (ПФ)",
    "execution-ku": "Формирование заявление (Заявление в банк)",
    "execution-buh": "Формирование заявление (Бухгалтерия)",
    "execution-zpbank": "Формирование заявление (ЗП в банк)",
    "execution-bo": "Формирование заявление (Бюджетные организации)",
    "execution-ozon": "Формирование заявление (OZON)",
    "execution-tinkoff": "Формирование заявление (Заявление в ТБанк)"
};

const BIG_DEBTORS_MAP = {
    "search": "Поиск",
    "queue": "ЛС в очереди",
    "work": "ЛС в работе",
    "category_approved": "ЛС с категорией",
    "archive": "ЛС в Архиве",
    "early_execution": "На досрочную проверку",
    "category_approval_wait": "Ожидание присвоения категории",
    "expired_employee": "Пропущен срок сотрудника",
    "expired_boss": "Пропущен срок руководителя"
};

const STAGE_MAX_WAITING_SEC = 2 * 60 * 60; // Жесткий лимит ожидания стадии: 2 часа.
let stageRequests = {}; // requestId -> { startTime, tabId, loadType, requestUrl }
let stageSessions = {}; // tabId -> { sessionId, baseName, userName, departmentName, stageName, loadType, requestUrl, version, startEpochMs }

function parseStageDurationSec(rawDuration) {
    if (rawDuration === undefined || rawDuration === null || rawDuration === "") return null;
    const parsed = Number(String(rawDuration).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function clampStageDurationSec(durationSec) {
    if (!Number.isFinite(durationSec)) return 0;
    return Math.min(STAGE_MAX_WAITING_SEC, Math.max(0, durationSec));
}

function clearStageRequestsForTab(tabId) {
    if (!Number.isInteger(tabId)) return;
    Object.keys(stageRequests).forEach((requestId) => {
        if (stageRequests[requestId] && stageRequests[requestId].tabId === tabId) {
            delete stageRequests[requestId];
        }
    });
}

function getStageTabId(request, sender) {
    const tabIdFromSender = sender && sender.tab ? sender.tab.id : null;
    const tabIdFromRequest = request.data && Number.isInteger(request.data.tabId) ? request.data.tabId : null;
    return Number.isInteger(tabIdFromRequest) ? tabIdFromRequest : tabIdFromSender;
}

function upsertStageSession(tabId, data) {
    if (!Number.isInteger(tabId) || !data) return;

    const existing = stageSessions[tabId] || {};
    const incomingDurationSec = parseStageDurationSec(data.duration);
    stageSessions[tabId] = {
        ...existing,
        tabId: tabId,
        sessionId: data.sessionId || existing.sessionId || "",
        baseName: data.baseName || existing.baseName || "Основная",
        userName: data.userName || existing.userName || "Не определен",
        departmentName: data.departmentName || existing.departmentName || "Не определен",
        stageName: data.stageName || existing.stageName || "ПК Пирамида",
        loadType: data.loadType || existing.loadType || "Загрузка",
        requestUrl: data.requestUrl || existing.requestUrl || "",
        version: data.version || existing.version || "",
        startEpochMs: Number.isFinite(data.startEpochMs) ? data.startEpochMs : (existing.startEpochMs || Date.now()),
        lastDurationSec: incomingDurationSec !== null
            ? clampStageDurationSec(incomingDurationSec)
            : (Number.isFinite(existing.lastDurationSec) ? existing.lastDurationSec : 0),
        lastEventEpochMs: Date.now()
    };
}

function sendStageCancelForClosedTab(tabId) {
    const session = stageSessions[tabId];
    if (!session || !session.sessionId) return;

    const elapsedByClockSec = Math.max(0, (Date.now() - (session.startEpochMs || Date.now())) / 1000);
    const durationSecNum = Number.isFinite(session.lastDurationSec) && session.lastDurationSec > 0
        ? session.lastDurationSec
        : elapsedByClockSec;
    const durationSec = clampStageDurationSec(durationSecNum).toFixed(2);
    const payload = {
        baseName: session.baseName || "Основная",
        stageName: session.stageName || "ПК Пирамида",
        userName: session.userName || "Не определен",
        departmentName: session.departmentName || "Не определен",
        duration: durationSec,
        timestamp: new Date().toLocaleString("ru-RU"),
        status: "ОТМЕНА",
        sessionId: session.sessionId,
        loadType: session.loadType || "Загрузка",
        requestUrl: session.requestUrl || "",
        version: session.version || ""
    };

    delete stageSessions[tabId];

    enqueueTelemetry(payload);
}

chrome.webRequest.onBeforeRequest.addListener((details) => {
    const url = new URL(details.url);
    // console.log("[StageTimer] Intercepted:", details.method, url.pathname); // Debug log

    let loadType = "Загрузка стадии";
    let isTargetRequest = false;

    if (url.pathname.includes("/actions/editedoc")) {
        // Редактирование (POST)
        if (details.method === "POST") {
            loadType = "Редактирование информации";
            isTargetRequest = true;
        }
    } 
    else if (url.pathname.includes("/claims/execution")) {
        // Формирование заявлений (POST)
        if (details.method === "POST") {
            // Пытаемся найти точное совпадение по суффиксу
            const pathParts = url.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1]; 
            
            if (EXECUTION_MAP[lastPart]) {
                loadType = EXECUTION_MAP[lastPart];
            } else {
                loadType = "Формирование заявления (Прочее)";
            }
            isTargetRequest = true;
        }
    }
    else if (url.pathname.includes("/data") && !url.pathname.includes("grid-data")) { // Исключаем grid-data здесь, он обработан отдельно
        // Загрузка грида (обычно GET, но *data* паттерн ловит)
        const searchParam = url.searchParams.get("_search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
        }
        isTargetRequest = true;
    }
    else if (url.pathname.includes("/pu/ReestrSendToOVZID")) {
        // Загрузка реестра для ОВЗИД
        const searchParam = url.searchParams.get("search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
        } else {
             loadType = "Загрузка стадии";
        }
        isTargetRequest = true;
    }
    else if (url.pathname.includes("/datagrids/slowsearch")) {
        // Медленный поиск/загрузка в гридах
        // Срабатывает ТОЛЬКО если есть _search=true
        const searchParam = url.searchParams.get("_search");
        if (searchParam === "true") {
            loadType = "Фильтрация стадии";
            isTargetRequest = true;
        } else {
             // Игнорируем обычный slowsearch
             isTargetRequest = false;
        }
    }
    else if (url.pathname.includes("grid-data")) {
        // Фильтрация (Крупные должники и др.)
        const searchVal = url.searchParams.get("_search") || url.searchParams.get("search");

        if (url.pathname.includes("big-debtors")) {
             // Для крупных должников таймер включаем ТОЛЬКО если есть параметры поиска (true или false)
             if (!searchVal) {
                 isTargetRequest = false;
             } else {
                 if (searchVal === "true") {
                     loadType = "Фильтрация стадии";
                 } else {
                     loadType = "Загрузка стадии";
                 }
                 isTargetRequest = true;
             }
        } else {
            // Обычный грид
            if (searchVal) { // Есть search или _search (неважно true/false)
                loadType = "Фильтрация стадии";
            } else {
                loadType = "Загрузка стадии";
            }
            isTargetRequest = true;
        }
    }

    if (isTargetRequest) {
        stageRequests[details.requestId] = {
            startTime: performance.now(),
            tabId: details.tabId,
            loadType: loadType,
            requestUrl: details.url
        };

        if (Number.isInteger(details.tabId)) {
            upsertStageSession(details.tabId, {
                loadType: loadType,
                requestUrl: details.url
            });
        }
        
        // Сообщаем контент скрипту: "Покажи спиннер"
        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_START",
            data: { loadType: loadType, requestUrl: details.url }
        }).catch(() => {}); 
    }
    
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onCompleted.addListener((details) => {
    const req = stageRequests[details.requestId];
    if (req) {
        const duration = performance.now() - req.startTime;
        
        // Сообщаем контент скрипту: "Готово, вот время"
        chrome.tabs.sendMessage(req.tabId, {
            action: "STAGE_TIMER_STOP",
            data: { 
                duration: duration,
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        }).catch(() => {});
        
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onErrorOccurred.addListener((details) => {
    if (stageRequests[details.requestId]) {
        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_ERROR"
        }).catch(() => {});
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });


// --- Логика боковой панели ---
chrome.runtime.onInstalled.addListener(() => {
  addLog("Расширение установлено/обновлено.");
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => addLog(`Ошибка настройки панели: ${error}`));
  
  // Инициализация хранилища для нового счетчика
  chrome.storage.local.get(['approved_actions', 'blocked_actions', 'pending_actions'], (result) => {
    if (!result.pending_actions) {
      chrome.storage.local.set({ 'pending_actions': [] });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'STAGE_TIMER_SESSION_START': {
            const tabId = getStageTabId(request, sender);
            if (Number.isInteger(tabId)) {
                upsertStageSession(tabId, request.data || {});
            }
            return false;
        }

        case 'STAGE_TIMER_SESSION_UPDATE': {
            const tabId = getStageTabId(request, sender);
            if (Number.isInteger(tabId)) {
                upsertStageSession(tabId, request.data || {});
            }
            return false;
        }

        case 'STAGE_TIMER_CANCEL': {
            const tabId = getStageTabId(request, sender);
            clearStageRequestsForTab(tabId);
            return false;
        }

        case 'LOG_STAGE_INCIDENT': {
            const d = request.data || {};
            const payload = {
                eventType: d.eventType || "stage_incident",
                incidentType: d.incidentType || "",
                baseName: d.baseName || "Основная",
                stageName: d.stageName || "ПК Пирамида",
                userName: d.userName || "Не определен",
                departmentName: d.departmentName || "Не определен",
                timestamp: d.timestamp || new Date().toISOString(),
                pageUrl: d.pageUrl || "",
                context: d.context || "",
                summaryText: d.summaryText || "",
                fullText: d.fullText || "",
                signature: d.signature || "",
                edocId: d.edocId || "",
                debtId: d.debtId || "",
                epguSentAt: d.epguSentAt || "",
                epguRequestType: d.epguRequestType || "",
                version: d.version || ""
            };
            enqueueTelemetry(payload);
            return true;
        }

        case 'LOG_ROWS10000_INCIDENT': {
            const d = request.data || {};
            const payload = {
                eventType: d.eventType || "rows10000_incident",
                incidentType: d.incidentType || "ROWS10000",
                traceId: d.traceId || "",
                baseName: d.baseName || "Основная",
                stageName: d.stageName || "ПК Пирамида",
                userName: d.userName || "Не определен",
                departmentName: d.departmentName || "Не определен",
                timestamp: d.timestamp || new Date().toISOString(),
                pageUrl: d.pageUrl || "",
                requestUrl: d.requestUrl || "",
                requestMethod: d.requestMethod || "GET",
                rows: d.rows || "",
                buttonCounter: d.buttonCounter || "",
                buttonCounterNumber: d.buttonCounterNumber || "",
                selarrrowLen: d.selarrrowLen || "",
                visibleCheckedCount: d.visibleCheckedCount || "",
                summaryText: d.summaryText || "",
                fullText: d.fullText || "",
                triggerReason: d.triggerReason || "",
                requestData: d.requestData || {},
                stateSnapshot: d.stateSnapshot || {},
                trace: Array.isArray(d.trace) ? d.trace : [],
                version: d.version || ""
            };
            enqueueTelemetry(payload);
            return true;
        }

        case 'EXECUTION_ANALYSIS_GET_TAB_ID': {
            const tabId = sender && sender.tab ? sender.tab.id : null;
            if (!Number.isInteger(tabId)) {
                sendResponse({ success: false, error: 'NO_TAB_ID' });
                return false;
            }
            sendResponse({ success: true, tabId });
            return false;
        }

        case 'DEPARTMENT_CONTAINER_GET_SUPPORT': {
            sendResponse({
                success: true,
                supported: isDepartmentContainerSupported()
            });
            return false;
        }

        case 'DEPARTMENT_CONTAINER_OPEN_TAB': {
            const sourceTabId = sender && sender.tab ? sender.tab.id : null;
            const sourceWindowId = sender && sender.tab ? sender.tab.windowId : null;
            const target = normalizeDepartmentContainerTarget(request && request.data);

            if (!Number.isInteger(sourceTabId)) {
                sendResponse({ success: false, error: 'NO_SOURCE_TAB' });
                return false;
            }

            if (!target) {
                sendResponse({ success: false, error: 'INVALID_DEPARTMENT_CONTAINER_TARGET' });
                return false;
            }

            if (!isDepartmentContainerSupported()) {
                sendResponse({ success: false, error: 'CONTEXTUAL_IDENTITIES_UNSUPPORTED' });
                return false;
            }

            (async () => {
                try {
                    const identity = await ensureDepartmentContainer(target);
                    const createProperties = {
                        url: target.url,
                        active: true,
                        cookieStoreId: identity.cookieStoreId
                    };
                    if (Number.isInteger(sourceWindowId)) {
                        createProperties.windowId = sourceWindowId;
                    }
                    if (Number.isInteger(sourceTabId)) {
                        createProperties.openerTabId = sourceTabId;
                    }

                    const tab = await createTabAsync(createProperties);
                    const targetTabId = tab && Number.isInteger(tab.id) ? tab.id : null;
                    if (!Number.isInteger(targetTabId)) {
                        sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                        return;
                    }

                    sendResponse({
                        success: true,
                        tabId: targetTabId,
                        cookieStoreId: identity.cookieStoreId
                    });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'DEPARTMENT_CONTAINER_OPEN_FAILED'
                    });
                }
            })();

            return true;
        }

        case 'EXECUTION_ANALYSIS_OPEN_TAB':
        case 'ID_CARD_CHECK_OPEN_TAB': {
            const sourceTabId = sender && sender.tab ? sender.tab.id : null;
            const sourceWindowId = sender && sender.tab ? sender.tab.windowId : null;
            const sourceCookieStoreId = sender && sender.tab && typeof sender.tab.cookieStoreId === 'string'
                ? sender.tab.cookieStoreId.trim()
                : '';
            const data = request && request.data ? request.data : {};
            const targetUrl = String(data.url || '').trim();
            const active = data.active === true;

            if (!Number.isInteger(sourceTabId)) {
                sendResponse({ success: false, error: 'NO_SOURCE_TAB' });
                return false;
            }

            if (!targetUrl) {
                sendResponse({ success: false, error: 'EMPTY_URL' });
                return false;
            }

            const createProperties = {
                url: targetUrl,
                active
            };
            if (Number.isInteger(sourceWindowId)) {
                createProperties.windowId = sourceWindowId;
            }
            if (Number.isInteger(sourceTabId)) {
                createProperties.openerTabId = sourceTabId;
            }
            if (sourceCookieStoreId) {
                createProperties.cookieStoreId = sourceCookieStoreId;
            }

            const createTab = (properties, allowCookieStoreRetry = true) => {
                chrome.tabs.create(properties, (tab) => {
                    if (chrome.runtime.lastError && properties.cookieStoreId && allowCookieStoreRetry) {
                        const fallbackProperties = { ...properties };
                        delete fallbackProperties.cookieStoreId;
                        createTab(fallbackProperties, false);
                        return;
                    }

                    if (chrome.runtime.lastError) {
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message || 'CREATE_TAB_FAILED'
                        });
                        return;
                    }

                    const targetTabId = tab && Number.isInteger(tab.id) ? tab.id : null;
                    if (!Number.isInteger(targetTabId)) {
                        sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                        return;
                    }

                    sendResponse({ success: true, tabId: targetTabId });
                });
            };

            createTab(createProperties);

            return true;
        }

        case 'ID_CARD_CHECK_SEND_TAB_MESSAGE': {
            const data = request && request.data ? request.data : {};
            const targetTabId = Number(data.tabId);
            const timeoutMs = Math.max(1000, Number(data.timeoutMs) || 20000);
            const startedAt = Date.now();
            const retryOnNoReceiver = data.retryOnNoReceiver !== false;
            const retryOnClosedChannel = data.retryOnClosedChannel === true;
            const message = data.message && typeof data.message === 'object'
                ? data.message
                : null;

            if (!Number.isInteger(targetTabId) || targetTabId <= 0) {
                sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                return false;
            }

            if (!message) {
                sendResponse({ success: false, error: 'EMPTY_TAB_MESSAGE' });
                return false;
            }

            const shouldRetrySendMessage = (runtimeError) => {
                const text = String(runtimeError || '').trim();
                if (!text) return false;
                if ((Date.now() - startedAt) >= timeoutMs) return false;
                if (retryOnNoReceiver && (
                    text.includes('Receiving end does not exist') ||
                    text.includes('Could not establish connection')
                )) {
                    return true;
                }
                return retryOnClosedChannel &&
                    text.includes('The message port closed before a response was received.');
            };

            const trySendMessage = () => {
                chrome.tabs.sendMessage(targetTabId, message, (response) => {
                    const runtimeError = chrome.runtime && chrome.runtime.lastError
                        ? chrome.runtime.lastError.message
                        : '';

                    if (runtimeError) {
                        if (shouldRetrySendMessage(runtimeError)) {
                            setTimeout(trySendMessage, 150);
                            return;
                        }

                        sendResponse({
                            success: false,
                            error: runtimeError || 'SEND_TAB_MESSAGE_FAILED'
                        });
                        return;
                    }

                    sendResponse({
                        success: true,
                        response: response || null
                    });
                });
            };

            trySendMessage();
            return true;
        }

        case 'ID_CARD_CHECK_ACCUMULATE_FAILED_RETURN': {
            (async () => {
                const data = request && request.data ? request.data : {};
                const targetTabId = Number(data.tabId);
                const line = String(data.line || '').trim();

                if (!Number.isInteger(targetTabId) || targetTabId <= 0) {
                    sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                    return;
                }

                const stored = await chromeSessionStorageGetAsync(ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY);
                const currentMap = stored && stored[ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY] && typeof stored[ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY] === 'object'
                    ? stored[ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY]
                    : {};
                const currentEntries = Array.isArray(currentMap[targetTabId])
                    ? currentMap[targetTabId].map((value) => String(value || '').trim()).filter(Boolean)
                    : [];

                if (line && !currentEntries.includes(line)) {
                    currentEntries.push(line);
                }

                const nextMap = {
                    ...currentMap,
                    [targetTabId]: currentEntries
                };
                await chromeSessionStorageSetAsync({ [ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY]: nextMap });

                sendResponse({
                    success: true,
                    entries: currentEntries,
                    count: currentEntries.length,
                    text: currentEntries.join('\n')
                });
            })();
            return true;
        }

        case 'ID_CARD_CHECK_EXTRACT_HISTORY_TRANSITION': {
            (async () => {
                const data = request && request.data ? request.data : {};
                const targetTabId = Number(data.tabId);
                const targetEdocId = String(data.edocId || '').trim();
                const timeoutMs = Math.max(1000, Number(data.timeoutMs) || 20000);

                if (!Number.isInteger(targetTabId) || targetTabId <= 0) {
                    sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                    return;
                }

                try {
                    await waitForTabCompleteAsync(targetTabId, Math.min(timeoutMs, 15000));
                    chrome.scripting.executeScript(
                        {
                            target: { tabId: targetTabId },
                            func: async (expectedEdocId, maxWaitMs) => {
                                const prefix = 'Документ пришел с ';

                                const normalizeText = (value) => String(value || '')
                                    .replace(/\s+/g, ' ')
                                    .trim();

                                const normalizeCompareText = (value) => normalizeText(value).toLowerCase();

                                const getEdocIdFromPath = (pathname) => {
                                    const match = String(pathname || '').match(/^\/ovzid\/fullcard\/([^/]+)(?:\/.*)?$/i);
                                    return match ? decodeURIComponent(match[1]) : '';
                                };

                                const isHistoryLocation = () => {
                                    const pathname = String(window.location.pathname || '').toLowerCase();
                                    if (!pathname.includes('/action_history')) return false;
                                    const currentEdocId = normalizeText(getEdocIdFromPath(window.location.pathname));
                                    return !expectedEdocId || currentEdocId === normalizeText(expectedEdocId);
                                };

                                const getLatestTransitionText = () => {
                                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                                    for (const row of rows) {
                                        const cells = Array.from(row.querySelectorAll('td')).map((cell) => normalizeText(cell.textContent || ''));
                                        const rowKind = normalizeCompareText(cells[0] || '');
                                        const actionText = String(cells[1] || '').trim();
                                        if (rowKind !== normalizeCompareText('ИД')) continue;
                                        if (!actionText.startsWith(prefix)) continue;
                                        return actionText;
                                    }
                                    return '';
                                };

                                const getDocumentSummary = () => {
                                    const title = normalizeText(document.title || '');
                                    const href = normalizeText(window.location.href || '');
                                    const bodyText = normalizeText((document.body && document.body.textContent) ? document.body.textContent : '').slice(0, 200);
                                    return [title ? `title=${title}` : '', href ? `url=${href}` : '', bodyText ? `body=${bodyText}` : '']
                                        .filter(Boolean)
                                        .join(', ');
                                };

                                const startedAt = Date.now();
                                while ((Date.now() - startedAt) <= Math.max(1000, Number(maxWaitMs) || 20000)) {
                                    if (isHistoryLocation()) {
                                        const transitionText = getLatestTransitionText();
                                        if (transitionText) {
                                            return { success: true, transitionText };
                                        }
                                    }

                                    await new Promise((resolve) => window.setTimeout(resolve, 150));
                                }

                                return {
                                    success: false,
                                    error: isHistoryLocation()
                                        ? `Для EdocID ${normalizeText(expectedEdocId)} не найдена история перехода по ТМ. ${getDocumentSummary()}`
                                        : `Во вкладке EdocID ${normalizeText(expectedEdocId)} не открыта История. ${getDocumentSummary()}`
                                };
                            },
                            args: [targetEdocId, timeoutMs]
                        },
                        (results) => {
                            if (chrome.runtime.lastError) {
                                sendResponse({
                                    success: false,
                                    error: chrome.runtime.lastError.message || 'EXECUTE_SCRIPT_FAILED'
                                });
                                return;
                            }

                            const result = Array.isArray(results) && results[0]
                                ? results[0].result
                                : null;
                            if (!result || result.success !== true) {
                                sendResponse({
                                    success: false,
                                    error: result && result.error ? result.error : 'HISTORY_TRANSITION_NOT_FOUND'
                                });
                                return;
                            }

                            sendResponse({
                                success: true,
                                transitionText: String(result.transitionText || '').trim()
                            });
                        }
                    );
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'HISTORY_EXTRACT_FAILED'
                    });
                }
            })();
            return true;
        }

        case 'ID_CARD_CHECK_PREPARE_EDITEDOC_RETURN': {
            (async () => {
                const data = request && request.data ? request.data : {};
                const targetTabId = Number(data.tabId);
                const targetEdocId = String(data.edocId || '').trim();
                const transitionText = String(data.transitionText || '').trim();
                const timeoutMs = Math.max(1000, Number(data.timeoutMs) || 20000);

                if (!Number.isInteger(targetTabId) || targetTabId <= 0) {
                    sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                    return;
                }

                try {
                    const result = await prepareIdCardCheckEditedocReturnAsync(
                        targetTabId,
                        targetEdocId,
                        transitionText,
                        timeoutMs
                    );
                    sendResponse({
                        success: true,
                        submitted: result && result.submitted === true,
                        previousTmText: String(result && result.previousTmText || '').trim()
                    });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'EDITEDOC_PREPARE_FAILED'
                    });
                }
            })();
            return true;
        }

        case 'ID_CARD_CHECK_CONFIRM_EDITEDOC_RETURN': {
            (async () => {
                const data = request && request.data ? request.data : {};
                const targetTabId = Number(data.tabId);
                const targetEdocId = String(data.edocId || '').trim();
                const timeoutMs = Math.max(1000, Number(data.timeoutMs) || 30000);

                if (!Number.isInteger(targetTabId) || targetTabId <= 0) {
                    sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                    return;
                }

                try {
                    await confirmIdCardCheckEditedocReturnAsync(targetTabId, targetEdocId, timeoutMs);
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'EDITEDOC_CONFIRM_FAILED'
                    });
                }
            })();
            return true;
        }

        case 'EXECUTION_ANALYSIS_CLOSE_TAB': {
            const senderTabId = sender && sender.tab ? sender.tab.id : null;
            const data = request && request.data ? request.data : {};
            const requestedTabId = Number(data.tabId);
            const targetTabId = Number.isInteger(requestedTabId) && requestedTabId > 0
                ? requestedTabId
                : senderTabId;

            if (!Number.isInteger(targetTabId)) {
                sendResponse({ success: false, error: 'NO_TARGET_TAB' });
                return false;
            }

            chrome.tabs.remove(targetTabId, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message || 'CLOSE_TAB_FAILED' });
                    return;
                }
                sendResponse({ success: true });
            });
            return true;
        }

        case 'EPGU_REGISTRY_SCAN_START': {
            const sourceTab = sender && sender.tab ? sender.tab : null;
            const scanRequest = normalizeEpguRegistryScanRequest(request && request.data);
            if (!sourceTab || !Number.isInteger(sourceTab.id)) {
                sendResponse({ success: false, error: 'Не удалось определить исходную вкладку.' });
                return false;
            }
            if (!scanRequest) {
                sendResponse({ success: false, error: 'Некорректные параметры проверки реестров.' });
                return false;
            }

            (async () => {
                try {
                    const result = await runEpguRegistryScan(sourceTab, scanRequest);
                    sendResponse({
                        success: true,
                        rows: result.rows,
                        departmentCount: result.departmentCount
                    });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'Не удалось проверить реестры.'
                    });
                }
            })();
            return true;
        }

        case 'EPGU_OPEN_CREATE_REQUEST_FORM': {
            const tabId = sender && sender.tab ? sender.tab.id : null;
            const buttonId = request && request.data
                ? String(request.data.buttonId || '').trim()
                : '';
            if (!Number.isInteger(tabId)) {
                sendResponse({ success: false, error: 'NO_TAB_ID' });
                return false;
            }
            if (buttonId !== 'fromsbrfbutton') {
                sendResponse({ success: false, error: 'INVALID_CREATE_BUTTON_ID' });
                return false;
            }

            (async () => {
                try {
                    const result = await executeScriptInTabAsync(
                        tabId,
                        (buttonId) => {
                            const button = document.getElementById(String(buttonId || ''));
                            if (!(button instanceof HTMLElement)) {
                                return { success: false, error: 'CREATE_BUTTON_NOT_FOUND' };
                            }

                            const originalConfirm = window.confirm;
                            let confirmHandled = false;
                            window.confirm = function(message) {
                                confirmHandled = true;
                                return true;
                            };

                            try {
                                button.click();
                                return { success: true, confirmHandled };
                            } finally {
                                window.confirm = originalConfirm;
                            }
                        },
                        [buttonId],
                        { world: 'MAIN' }
                    );
                    sendResponse(result && typeof result === 'object'
                        ? result
                        : { success: false, error: 'CREATE_DIALOG_NO_RESULT' });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'CREATE_DIALOG_SCRIPT_FAILED'
                    });
                }
            })();
            return true;
        }

        case 'STAGEJUMP_APPLY_DEBTID_MAIN_WORLD': {
            const tabId = sender && sender.tab ? sender.tab.id : null;
            const frameId = (sender && Number.isInteger(sender.frameId)) ? sender.frameId : 0;
            const rawDebtId = request && request.data ? request.data.debtId : '';
            const debtId = String(rawDebtId || '').trim();

            if (!Number.isInteger(tabId)) {
                sendResponse({ success: false, error: 'NO_TAB_ID' });
                return false;
            }

            if (!debtId) {
                sendResponse({ success: false, error: 'EMPTY_DEBTID' });
                return false;
            }

            chrome.scripting.executeScript(
                {
                    target: { tabId: tabId, frameIds: [frameId] },
                    world: 'MAIN',
                    func: (targetDebtId) => {
                        try {
                            const debtIdValue = String(targetDebtId || '').trim();
                            if (!debtIdValue) {
                                return { success: false, error: 'EMPTY_DEBTID' };
                            }

                            const $ = window.jQuery;
                            if (!($ && $.fn && $.fn.jqGrid)) {
                                return { success: false, error: 'NO_JQGRID' };
                            }

                            const jqGrid = $('#list');
                            if (!(jqGrid && jqGrid.length)) {
                                return { success: false, error: 'NO_GRID' };
                            }

                            const gridEl = jqGrid[0];
                            const postData = (gridEl && gridEl.p && gridEl.p.postData) ? gridEl.p.postData : {};
                            const filters = JSON.stringify({
                                groupOp: 'AND',
                                rules: [{ field: 'DebtID', op: 'eq', data: debtIdValue }]
                            });

                            jqGrid.jqGrid('setGridParam', {
                                search: true,
                                page: 1,
                                postData: Object.assign({}, postData, { _search: true, filters: filters })
                            });
                            jqGrid.trigger('reloadGrid', [{ page: 1, current: true }]);

                            return { success: true };
                        } catch (error) {
                            return {
                                success: false,
                                error: (error && error.message) ? error.message : 'EXECUTION_ERROR'
                            };
                        }
                    },
                    args: [debtId]
                },
                (results) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message || 'EXECUTE_SCRIPT_FAILED'
                        });
                        return;
                    }

                    const scriptResult = Array.isArray(results) && results.length ? results[0].result : null;
                    if (!scriptResult || scriptResult.success !== true) {
                        sendResponse({
                            success: false,
                            error: scriptResult && scriptResult.error ? scriptResult.error : 'NO_SCRIPT_RESULT'
                        });
                        return;
                    }

                    sendResponse({ success: true });
                }
            );

            return true;
        }
        
        // === ТЕЛЕМЕТРИЯ (ОБНОВЛЕННАЯ ВЕРСИЯ) ===
        case 'LOG_STAGE_TIME': {
            const d = request.data || {};
            const incomingDurationSec = parseStageDurationSec(d.duration);
            let normalizedStatus = d.status;
            let normalizedDurationSec = incomingDurationSec;

            if (normalizedStatus === "ОЖИДАНИЕ" && incomingDurationSec !== null && incomingDurationSec > STAGE_MAX_WAITING_SEC) {
                normalizedStatus = "ОТМЕНА";
                normalizedDurationSec = STAGE_MAX_WAITING_SEC;
            }

            const normalizedDurationStr = (normalizedDurationSec !== null)
                ? clampStageDurationSec(normalizedDurationSec).toFixed(2)
                : String(d.duration || "0");
            const tabId = getStageTabId(request, sender);
            if (Number.isInteger(tabId)) {
                upsertStageSession(tabId, {
                    ...d,
                    status: normalizedStatus,
                    duration: normalizedDurationStr
                });
            }
            
            // Игнорируем отправку, если пользователь не определен
            if (d.userName === "Не определен" && normalizedStatus !== "ОТМЕНА") {
                console.log("[TELEMETRY] Запись пропущена: Пользователь не определен.");
                return false;
            }

            const session = Number.isInteger(tabId) ? stageSessions[tabId] : null;
            const requestUrl = d.requestUrl || (session && session.requestUrl) || "";
            const departmentName = d.departmentName || (session && session.departmentName) || "Не определен";

            const payload = {
                baseName: d.baseName,
                stageName: d.stageName,
                userName: d.userName,
                departmentName: departmentName,
                duration: normalizedDurationStr,
                timestamp: d.timestamp,
                status: normalizedStatus,
                sessionId: d.sessionId,
                loadType: d.loadType,
                requestUrl: requestUrl,
                version: d.version // <-- ДОБАВЛЕНО
            };

            // Отправка через последовательную очередь, без наложения параллельных POST.
            enqueueTelemetry(payload);

            // Локальный лог
            if (normalizedStatus !== "ОЖИДАНИЕ") {
                if (Number.isInteger(tabId)) {
                    delete stageSessions[tabId];
                    clearStageRequestsForTab(tabId);
                }
                const storageKey = `logs_${d.baseName}`;
                chrome.storage.local.get([storageKey], (res) => {
                    let logs = res[storageKey] || "";
                    let logEntry = d.logLine || "";
                    if (normalizedStatus !== d.status || normalizedDurationStr !== String(d.duration)) {
                        logEntry += ` [Нормализовано: ${normalizedStatus}, ${normalizedDurationStr}s]`;
                    }
                    if (normalizedStatus !== "УСПЕШНО") logEntry += ` [${normalizedStatus}]`;
                    logs += logEntry + "\n";
                    chrome.storage.local.set({ [storageKey]: logs });
                });
            }

            return true; 
        }

        // === ДЕЙСТВИЯ ПАНЕЛИ УПРАВЛЕНИЯ ===
        case 'approve_action': {
            const { path, edocid, tag } = request.data;
            addLog(`Получено утверждение для '${path}' с тегом '${tag || ''}'`);
            dupSyncSetActionRule(path, 'approved', tag || '', {
                pendingMode: 'exact',
                edocid,
                reason: 'background-approve-action'
            }).then((result) => {
                if (!result || result.success === false) {
                    sendResponse({ success: false, error: result && result.error ? result.error : 'SYNC_FAILED' });
                    return;
                }
                // Счетчик НЕ увеличивается здесь, только при сохранении (POST)
                sendResponse({ success: true });
                chrome.runtime.sendMessage({ action: "pendingActionsUpdated" }); // Уведомить UI об изменениях
            });
            return true; // для асинхронного ответа
        }
        
        case 'block_action': {
            const { path, edocid, tag } = request.data;
            addLog(`Получена блокировка для '${path}' с тегом '${tag || ''}'`);
            dupSyncSetActionRule(path, 'blocked', tag || '', {
                pendingMode: 'path',
                edocid,
                reason: 'background-block-action'
            }).then((result) => {
                if (!result || result.success === false) {
                    sendResponse({ success: false, error: result && result.error ? result.error : 'SYNC_FAILED' });
                    return;
                }
                sendResponse({ success: true });
                chrome.runtime.sendMessage({ action: "pendingActionsUpdated" }); // Уведомить об изменении
            });
            return true; // для асинхронного ответа
        }

        case 'toggle_action_status': {
            const { path, currentStatus } = request.data;
            addLog(`Получен запрос на смену статуса для '${path}' с '${currentStatus}'`);

            const nextStatus = currentStatus === 'approved' ? 'blocked' : 'approved';
            dupSyncSetActionRule(path, nextStatus, '', {
                reason: 'background-toggle-action-status'
            }).then((result) => {
                if (!result || result.success === false) {
                    addLog(`Не удалось изменить статус для '${path}': ${result && result.error ? result.error : 'SYNC_FAILED'}`);
                    sendResponse({ success: false, error: result && result.error ? result.error : 'SYNC_FAILED' });
                    return;
                }
                addLog(`Статус для '${path}' изменен.`);
                // UI обновится автоматически через `storage.onChanged`
                sendResponse({ success: true });
            });
            return true;
        }

        case 'cancel_pending_action': {
            const { path, edocid } = request.data;
            addLog(`Получена отмена для '${path}' edocid: ${edocid}`);
            chrome.storage.local.get(['pending_actions'], (result) => {
                let pending = result.pending_actions || [];
                const newPending = pending.filter(p => !(p.path === path && p.edocid === edocid));

                if (pending.length !== newPending.length) {
                    chrome.storage.local.set({ 'pending_actions': newPending }, () => {
                        addLog(`Ожидающее действие для '${path}' edocid: ${edocid} удалено.`);
                        sendResponse({ success: true });
                        chrome.runtime.sendMessage({ action: "pendingActionsUpdated" });
                    });
                } else {
                    addLog(`Ожидающее действие для '${path}' edocid: ${edocid} не найдено.`);
                    sendResponse({ success: false, message: "Action not found" });
                }
            });
            return true; // для асинхронного ответа
        }

        case 'VZID_OPEN_CAPTURE_PREVIEW': {
            cleanupVzidCaptureStore();

            const data = request.data || {};
            if (!data.fileBase64) {
                sendResponse({ success: false, error: 'PDF не получен' });
                return false;
            }

            const token = createVzidToken();
            vzidCaptureStore.set(token, {
                createdAtMs: Date.now(),
                sourceUrl: data.sourceUrl || '',
                claimTypeLabel: data.claimTypeLabel || '',
                claimTypeValue: data.claimTypeValue || '',
                ipNumber: data.ipNumber || '',
                fileName: data.fileName || 'document.pdf',
                fileMimeType: data.fileMimeType || 'application/pdf',
                fileBase64: data.fileBase64
            });

            const previewUrl = chrome.runtime.getURL(`VZIDCapture/vzid_capture_preview.html?token=${encodeURIComponent(token)}`);
            chrome.tabs.create({ url: previewUrl }, (tab) => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message || 'Не удалось открыть тестовую страницу'
                    });
                    return;
                }
                sendResponse({ success: true, token, tabId: tab ? tab.id : null });
            });

            return true;
        }

        case 'VZID_GET_CAPTURE_DATA': {
            cleanupVzidCaptureStore();
            const token = request && (request.token || (request.data && request.data.token));
            if (!token) {
                sendResponse({ success: false, error: 'Не передан token' });
                return false;
            }

            const payload = vzidCaptureStore.get(token);
            if (!payload) {
                sendResponse({ success: false, error: 'Данные не найдены или устарели' });
                return false;
            }

            sendResponse({ success: true, data: payload });
            return false;
        }

        case 'VZID_CLEAR_CAPTURE_DATA': {
            const token = request && (request.token || (request.data && request.data.token));
            if (token) {
                vzidCaptureStore.delete(token);
            }
            sendResponse({ success: true });
            return false;
        }
    }
});

chrome.action.onClicked.addListener((tab) => {
  addLog("Иконка нажата (запасной вариант).");
  chrome.sidePanel.open({ windowId: tab.windowId });
});


// --- Логика счетчика "Анализа исполнения" ---

// Временное хранилище для edocid, которые были открыты, но еще не сохранены.
let pendingEdocids = {};

// Очищаем временное хранилище при закрытии вкладки.
chrome.tabs.onRemoved.addListener((tabId) => {
  sendStageCancelForClosedTab(tabId);
  clearStageRequestsForTab(tabId);

  if (pendingEdocids[tabId]) {
    addLog(`Вкладка ${tabId} закрыта, удаляю ожидающий edocid: ${pendingEdocids[tabId]}`);
    delete pendingEdocids[tabId];
  }
  // Также очищаем для нового счетчика
  chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
    let currentPendingEditingActions = sessionResult.pendingEditingActions || {};
    if (currentPendingEditingActions[tabId]) {
      addLog(`Вкладка ${tabId} закрыта, удаляю ожидающее действие: ${JSON.stringify(currentPendingEditingActions[tabId])} из session storage.`);
      delete currentPendingEditingActions[tabId];
      chrome.storage.session.set({ 'pendingEditingActions': currentPendingEditingActions });
    }
  });
  chrome.storage.session.get([ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY], (sessionResult) => {
    const currentFailedReturns = sessionResult && sessionResult[ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY] && typeof sessionResult[ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY] === 'object'
      ? sessionResult[ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY]
      : {};
    if (!currentFailedReturns[tabId]) return;
    delete currentFailedReturns[tabId];
    chrome.storage.session.set({ [ID_CARD_CHECK_FAILED_RETURNS_SESSION_KEY]: currentFailedReturns });
  });
});

// --- ЭТАП 1: Слушаем ОТКРЫТИЕ формы (событие onCompleted) ---
// Срабатывает, когда успешно загрузилась страница с параметром ?edocid=...
chrome.webRequest.onCompleted.addListener((details) => {
    if (details.statusCode >= 200 && details.statusCode < 300) {
        try {
            const url = new URL(details.url);
            const edocids = getEdocIdFromUrl(url);
            // Убеждаемся, что edocids действительно есть в параметрах
            if (edocids.length > 0) {
                pendingEdocids[details.tabId] = edocids;
                addLog(`Анализ. Открытие формы. Запомнил edocids: ${JSON.stringify(edocids)} для вкл. ${details.tabId}`);
            }
        } catch(e) {
            addLog(`Анализ. Ошибка на этапе 1: ${e.message}`);
        }
    }
}, {
    urls: ["*://*/ovzid/actions/execution-analysis*"], // Фильтр только для URL с параметрами
    types: ["xmlhttprequest", "main_frame", "sub_frame"]
});


// --- ЭТАП 2: Слушаем СОХРАНЕНИЕ формы (событие onBeforeRedirect) ---
// Срабатывает, когда от URL без параметров происходит перенаправление.
chrome.webRequest.onBeforeRedirect.addListener((details) => {
    try {
        const url = new URL(details.url);
        // Убеждаемся, что это наш URL сохранения (без параметров)
        if (url.pathname.includes("/ovzid/actions/execution-analysis") && url.search === '') {
            addLog(`Анализ. Сохранение (редирект). Ищу edocid для вкл. ${details.tabId}`);
            const edocidToProcess = pendingEdocids[details.tabId];

            if (edocidToProcess) {
                // Запускаем основную логику счетчика
                processCounterLogic(edocidToProcess, details.tabId);
            } else {
                addLog(`Анализ. -> Для вкл. ${details.tabId} нет ожидающего edocid. Пропущено.`);
            }
        }
    } catch(e) {
        addLog(`Анализ. Ошибка на этапе 2: ${e.message}`);
    }
}, {
    urls: ["*://*/ovzid/actions/execution-analysis"] // Фильтр только для URL БЕЗ параметров
});

// Основная функция, которая проверяет дубликаты за день и увеличивает счетчик.
function processCounterLogic(edocids, tabId) { // Change parameter name
    addLog(`Анализ. -> Обработка edocids: ${JSON.stringify(edocids)}`); // Log array
    // Сразу удаляем из ожидания, чтобы избежать двойного срабатывания.
    delete pendingEdocids[tabId];

    const todayForHistory = new Date().toLocaleDateString('ru-RU');
    const todayForProcessed = new Date().toISOString().split('T')[0];

    dupSyncAddProcessedEdocids(todayForProcessed, todayForHistory, edocids, {
        reason: 'background-execution-analysis-counter'
    }).then((syncResult) => {
        if (!syncResult || syncResult.success === false) {
            addLog(`Анализ. -> ошибка синхронизации счетчика: ${syncResult && syncResult.error ? syncResult.error : 'SYNC_FAILED'}`);
            return;
        }

        const newlyProcessedCount = Number(syncResult.addedCount || 0);
        if (newlyProcessedCount === 0) {
            addLog(`Анализ. -> Все edocids уже были. Счетчик НЕ увеличен.`);
            return;
        }

        const newCount = Number(syncResult.value || 0);
        addLog(`Анализ. -> ДОБАВЛЕНО ${newlyProcessedCount}. Счетчик: ${newCount}.`);

        // Проверяем настройку перед отправкой уведомления
        chrome.storage.local.get('setting_notify_execution', (settings) => {
            if (settings.setting_notify_execution !== false) {
                createExtensionNotification({
                    type: 'basic',
                    iconUrl: 'icon.png',
                    title: 'Счетчик обновлен',
                    message: `Анализ исполнения засчитан! Сегодня: ${newCount} шт. (Новых: ${newlyProcessedCount})`
                });
            }
        });
    });
}

// --- Логика счетчика "Редактирование/Маркировка" ---



// Паттерны для URL, которые мы отслеживаем.
// 1. Все, что внутри /ovzid/actions/, кроме /markers_ovzid
// 2. Все, что внутри /ordz/
// 3. Добавлен updateWorkPlaceForm/manual для специфичного случая
const editingUrlPatterns = [
    /ovzid\/actions\/(?!markers_ovzid).*/,
    /ordz\/.*/,
    /ovzid\/updateWorkPlaceForm\/manual.*/
];

// Гибкая функция для извлечения ID документа из URL.
// Ищет любой ключ, начинающийся с "edoc" (без учета регистра) и возвращает его значение.
function getEdocIdFromUrl(url) {
    for (const [key, value] of url.searchParams.entries()) {
        if (key.toLowerCase().startsWith('edoc')) {
            return value.split(',').map(id => id.trim()).filter(id => id); // Split by comma, trim, and filter empty strings
        }
    }
    return []; // Return an empty array if no edocid is found
}


// ЭТАП 1: Слушаем открытие формы (GET-запрос с edocId)
// Это "взводит" механизм и решает, является ли действие новым.
chrome.webRequest.onCompleted.addListener((details) => {
    if (details.method !== "GET" || details.statusCode < 200 || details.statusCode >= 300) return;

    try {
        const url = new URL(details.url);
        const path = url.pathname;

        const isMatch = editingUrlPatterns.some(pattern => pattern.test(path));
        if (!isMatch) return;

        const edocids = getEdocIdFromUrl(url); // This now returns an array

        if (edocids.length > 0) { // Check if array is not empty
            chrome.storage.local.get(['approved_actions', 'blocked_actions', 'pending_actions'], (result) => {
                const approved = result.approved_actions || [];
                const blocked = result.blocked_actions || [];
                let pending = result.pending_actions || [];

                chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
                    let currentPendingEditingActions = sessionResult.pendingEditingActions || {};
                    currentPendingEditingActions[details.tabId] = { id: edocids, path: path };
                    chrome.storage.session.set({ 'pendingEditingActions': currentPendingEditingActions }, () => {
                        addLog(`Редакт. Открытие. Запомнил: ${JSON.stringify(currentPendingEditingActions[details.tabId])} для вкл. ${details.tabId}`);
                    });
                });

                edocids.forEach(singleEdocid => { // Iterate over each edocid
                    if (blocked.includes(path)) {
                        addLog(`Редакт. Открытие. Путь ${path} заблокирован. Игнор для edocid ${singleEdocid}.`);
                        return; // Skip this edocid if path is blocked
                    }

                    if (!approved.includes(path)) { // Only if the path is not yet approved
                        addLog(`Редакт. Открытие (новое). Принудительный вызов модалки для '${path}' edocid ${singleEdocid}.`);
                        // Immediately trigger the modal in the content script
                        chrome.tabs.sendMessage(details.tabId, {
                            action: 'show_confirmation_modal_in_tab',
                            data: { path: path, edocid: singleEdocid }
                        });
                    }
                });
            });
        }
    } catch (e) {
        addLog(`Редакт. Ошибка на этапе 1 (GET): ${e.message}`);
    }
}, {
    urls: ["<all_urls>"],
    types: ["main_frame", "sub_frame", "xmlhttprequest"]
});


// ЭТАП 2: Слушаем сохранение (POST-запрос, который вызывает редирект)
// Это "спускает курок" и засчитывает действие, ЕСЛИ оно было утверждено.
chrome.webRequest.onBeforeRedirect.addListener((details) => {
    // Убедимся, что это успешный POST-запрос.
    if (details.method !== 'POST' || details.statusCode < 300 || details.statusCode >= 400) return;
    
    try {
        const postUrl = new URL(details.url);
        const path = postUrl.pathname;
        
        // Проверяем, что URL сохранения также соответствует паттернам.
        const isMatch = editingUrlPatterns.some(pattern => pattern.test(path));
        if (!isMatch) return;
        
        addLog(`Редакт. Сохранение (POST редирект в ${path}). Ищу действие для вкл. ${details.tabId}`);
        chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
            const currentPendingEditingActions = sessionResult.pendingEditingActions || {};
            const actionToProcess = currentPendingEditingActions[details.tabId];

            if (actionToProcess) {
                processEditingCounterLogic(actionToProcess.id, actionToProcess.path, details.tabId);
            } else {
                addLog(`Редакт. -> Для вкл. ${details.tabId} нет ожидающего действия. Пропущено.`);
            }
        });
    } catch (e) {
        addLog(`Редакт. Ошибка на этапе 2 (POST): ${e.message}`);
    }
}, {
    urls: ["<all_urls>"] // Слушаем все и фильтруем внутри
});


// Упрощенная функция, которая срабатывает при сохранении.
// Основная логика по добавлению в "pending" уже отработала на этапе GET.
function processEditingCounterLogic(edocids, path, tabId) { // Change parameter name to edocids
    addLog(`Редакт. -> Сохранение для: path=${path}, edocids=${JSON.stringify(edocids)}`); // Log array

    chrome.storage.session.get(['pendingEditingActions'], (sessionResult) => {
        let currentPendingEditingActions = sessionResult.pendingEditingActions || {};
        if (currentPendingEditingActions[tabId]) {
            delete currentPendingEditingActions[tabId];
            chrome.storage.session.set({ 'pendingEditingActions': currentPendingEditingActions });
        }
    });

    chrome.storage.local.get(['approved_actions'], (result) => {
        const approved = result.approved_actions || [];

        if (approved.includes(path)) {
            addLog(`Редакт. -> Действие '${path}' утверждено. Засчитываем.`);
            edocids.forEach(singleEdocid => { // Iterate over edocids
                _incrementEditingCounter(singleEdocid, path); // Call for each single edocid
            });
        } else {
            addLog(`Редакт. -> Действие '${path}' еще не утверждено. Сохранение проигнорировано (ожидает подтверждения в UI).`);
        }
    });
}

// Старая логика, переименованная в "приватную" функцию
function _incrementEditingCounter(edocid, path) {
    addLog(`Редакт. -> Инкремент счетчика для: path=${path}, edocid=${edocid}`);

    const todayForHistory = new Date().toLocaleDateString('ru-RU');
    const todayForProcessed = new Date().toISOString().split('T')[0];

    dupSyncAddProcessedEditEdocid(todayForProcessed, todayForHistory, path, edocid, {
        reason: 'background-editing-counter'
    }).then((syncResult) => {
        if (!syncResult || syncResult.success === false) {
            addLog(`Редакт. -> ошибка синхронизации счетчика: ${syncResult && syncResult.error ? syncResult.error : 'SYNC_FAILED'}`);
            return;
        }

        if (!syncResult.added) {
            addLog(`Редакт. -> УЖЕ ЕСТЬ (${path} - ${edocid}). Счетчик НЕ увеличен.`);
            return;
        }

        chrome.storage.local.get(['action_tags'], (result) => {
            const tags = result.action_tags || {};
            const dayTotal = Number(syncResult.dayTotal || 0);
            const actionCount = Number(syncResult.actionCount || 0);
            const actionName = tags[path] || path;

            addLog(`Редакт. -> ДОБАВЛЕН. Общий счетчик: ${dayTotal}.`);
            chrome.runtime.sendMessage({ action: "updateEditingCounter" });

            // Проверяем настройку перед отправкой уведомления
            chrome.storage.local.get('setting_notify_editing', (settings) => {
                if (settings.setting_notify_editing !== false) {
                    createExtensionNotification({
                        type: 'basic',
                        iconUrl: 'icon.png',
                        title: 'Счетчик обновлен',
                        message: `Действие: ${actionName}\nВсего за день: ${dayTotal} (Новых для ${actionName}: ${actionCount})`
                    });
                }
            });
        });
    });
}


addLog("Background скрипт запущен.");

// === ЛОГИКА АВТО-ОБНОВЛЕНИЯ (RELOAD) ===
// Эта логика сработает, если файлы в папке расширения были обновлены (например, через Git или скрипт)
async function checkForLocalUpdate() {
    try {
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;

        // Читаем локальный файл version.json из папки расширения
        // Добавляем timestamp, чтобы браузер не брал файл из кэша
        const response = await fetch(chrome.runtime.getURL('version.json') + '?t=' + Date.now());
        const data = await response.json();
        const folderVersion = data.version;

        if (folderVersion !== currentVersion) {
            addLog(`[UPDATE] Обнаружена новая версия в папке: ${folderVersion}. Перезагрузка...`);
            // Даем немного времени логам записаться
            setTimeout(() => {
                chrome.runtime.reload();
            }, 1000);
        }
    } catch (e) {
        // Ошибка нормальна, если файла еще нет или он занят
    }
}

// Создаем будильник для проверки раз в 15 минут
chrome.alarms.create("CheckFolderUpdate", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "CheckFolderUpdate") checkForLocalUpdate();
});

// Проверяем один раз при запуске (с небольшой задержкой)
setTimeout(checkForLocalUpdate, 5000);
