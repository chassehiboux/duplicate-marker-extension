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

function queryTabsAsync(queryInfo = {}) {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.query(queryInfo, (tabs) => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError
                    ? chrome.runtime.lastError.message
                    : '';
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(Array.isArray(tabs) ? tabs : []);
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
        departments.length < 1
    ) {
        return null;
    }

    return { baseHost, checkDate, restoreDepid, restoreUrl, departments };
}

function normalizeEpguRequestsWeekLoadRequest(data, sourceTab) {
    const raw = data && typeof data === 'object' ? data : {};
    const baseHost = String(raw.baseHost || '').trim().toLowerCase();
    const minDateKey = String(raw.minDateKey || '').trim();
    const maxDateKey = String(raw.maxDateKey || '').trim();
    let sourceHost = '';

    try {
        sourceHost = String(new URL(sourceTab && sourceTab.url || '').hostname || '').trim().toLowerCase();
    } catch (error) {
        sourceHost = '';
    }

    if (
        !baseHost ||
        baseHost !== sourceHost ||
        !/^\d{2}-\d{2}-\d{4}$/.test(minDateKey) ||
        !/^\d{2}-\d{2}-\d{4}$/.test(maxDateKey)
    ) {
        return null;
    }

    return { baseHost, minDateKey, maxDateKey };
}

async function collectEpguRequestsWeekRowsInTab(tabId, requestData) {
    const result = await executeScriptInTabAsync(tabId, async (payload) => {
        const normalizeText = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        const toComparableDate = (value) => {
            const match = normalizeText(value).match(/^(\d{2})-(\d{2})-(\d{4})/);
            return match ? `${match[3]}${match[2]}${match[1]}` : '';
        };
        const minComparable = toComparableDate(payload.minDateKey);
        const maxComparable = toComparableDate(payload.maxDateKey);
        if (!minComparable || !maxComparable || minComparable > maxComparable) {
            return { success: false, error: 'INVALID_DATE_RANGE' };
        }
        if (String(window.location.hostname || '').trim().toLowerCase() !== payload.baseHost) {
            return { success: false, error: 'WRONG_BASE_HOST' };
        }

        const endpoint = new URL('/ovzid/epgurequests/data', window.location.origin);
        const collectedRows = [];

        try {
            let totalPages = 1;
            let totalRecords = 0;
            for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
                const target = new URL(endpoint.toString());
                const params = {
                    _search: 'false',
                    rows: 300,
                    page: pageNo,
                    sidx: 'DateAdd',
                    sord: 'desc'
                };
                Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, String(value)));
                const response = await fetch(target.toString(), {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                const responseText = await response.text();
                if (!response.ok) throw new Error(`HTTP_${response.status}`);

                let data = null;
                try {
                    data = JSON.parse(responseText);
                } catch (error) {
                    throw new Error('INVALID_JSON');
                }

                totalPages = Math.min(100, Math.max(1, Number(data && data.total || 1)));
                totalRecords = Math.max(0, Number(data && data.records || 0));
                const sourceRows = Array.isArray(data && data.rows) ? data.rows : [];
                let oldestComparable = '';

                sourceRows.forEach((item) => {
                    const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
                    const createDate = normalizeText(cell.CreateDate);
                    const comparableDate = toComparableDate(createDate);
                    if (!comparableDate) return;
                    if (!oldestComparable || comparableDate < oldestComparable) oldestComparable = comparableDate;
                    if (comparableDate < minComparable || comparableDate > maxComparable) return;
                    collectedRows.push({
                        id: normalizeText(cell.Id || (item && item.id)),
                        orderId: normalizeText(cell.OrderId),
                        claimant: normalizeText(cell.Claimant),
                        statusName: normalizeText(cell.StatusName),
                        message: normalizeText(cell.Message),
                        createDate
                    });
                });

                if (oldestComparable && oldestComparable < minComparable) break;
            }

            return { success: true, rows: collectedRows, totalRecords };
        } catch (error) {
            return {
                success: false,
                error: error && error.message ? error.message : 'FETCH_FAILED'
            };
        }
    }, [requestData], { world: 'MAIN' });

    if (!result || result.success !== true || !Array.isArray(result.rows)) {
        throw new Error(result && result.error ? result.error : 'EPGU_REQUEST_ROWS_UNAVAILABLE');
    }
    return result;
}

function normalizeEpguRegistryConductRequest(data) {
    const raw = data && typeof data === 'object' ? data : {};
    const baseHost = String(raw.baseHost || '').trim().toLowerCase();
    const checkDate = String(raw.checkDate || '').trim();
    const restoreDepid = String(raw.restoreDepid || '').trim();
    const targetDepid = String(raw.targetDepid || '').trim();
    const targetDepartment = String(raw.targetDepartment || '').replace(/\s+/g, ' ').trim();
    const restoreUrl = normalizeEpguRegistryScanUrl(raw.restoreUrl, baseHost);
    const targetUrl = normalizeEpguRegistryScanUrl(raw.targetUrl, baseHost);
    const registryId = String(raw.registryId || '').replace(/\s+/g, ' ').trim();
    const fileName = String(raw.fileName || '').replace(/\s+/g, ' ').trim();
    const typeName = String(raw.typeName || '').replace(/\s+/g, ' ').trim();
    const expectedStatusNames = Array.from(new Set(
        (Array.isArray(raw.expectedStatusNames) ? raw.expectedStatusNames : [])
            .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
    ));

    if (
        !baseHost ||
        !/^\d{2}\.\d{2}\.\d{4}$/.test(checkDate) ||
        !restoreDepid ||
        !targetDepid ||
        !targetDepartment ||
        !restoreUrl ||
        !targetUrl ||
        !registryId ||
        !fileName ||
        !typeName
    ) {
        return null;
    }

    return {
        baseHost,
        checkDate,
        restoreDepid,
        restoreUrl,
        targetDepid,
        targetDepartment,
        targetUrl,
        registryId,
        fileName,
        typeName,
        expectedStatusNames
    };
}

async function conductEpguRegistryInTab(tabId, requestData) {
    const result = await executeScriptInTabAsync(tabId, async (payload) => {
        const normalizeText = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        const normalizeKey = (value) => normalizeText(value).replace(/ё/g, 'е').replace(/Ё/g, 'Е').toLocaleLowerCase('ru-RU');
        const delay = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));
        const isVisible = (element) => {
            if (!(element instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        };
        const waitFor = async (getter, timeoutMs, errorCode) => {
            const startedAt = Date.now();
            while ((Date.now() - startedAt) <= timeoutMs) {
                try {
                    const value = getter();
                    if (value) return value;
                } catch (error) {
                    // The target can be rebuilt while jqGrid or the dialog is loading.
                }
                await delay(150);
            }
            throw new Error(errorCode);
        };
        const getCellText = (row, columnName) => {
            if (!(row instanceof HTMLElement)) return '';
            const cell = row.querySelector(`td[aria-describedby="list_${columnName}"]`);
            return normalizeText(cell && (cell.textContent || cell.innerText));
        };
        const getGridRows = () => Array.from(document.querySelectorAll('#list tbody > tr.jqgrow'));
        const findRegistryRow = (requireExpectedStatus) => {
            const expectedStatuses = new Set(payload.expectedStatusNames.map(normalizeKey));
            return getGridRows().find((row) => {
                const rowId = getCellText(row, 'Id');
                const fileName = getCellText(row, 'FileName');
                const typeName = getCellText(row, 'TypeName');
                const statusName = getCellText(row, 'StatusName');
                return rowId === payload.registryId &&
                    fileName === payload.fileName &&
                    typeName === payload.typeName &&
                    (!requireExpectedStatus || expectedStatuses.size === 0 || expectedStatuses.has(normalizeKey(statusName)));
            }) || null;
        };
        const triggerFileFilter = () => {
            const input = document.querySelector('#gs_FileName, input[name="FileName"]');
            if (!(input instanceof HTMLInputElement)) return false;
            const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            if (valueSetter && typeof valueSetter.set === 'function') valueSetter.set.call(input, payload.fileName);
            else input.value = payload.fileName;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
            input.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
            const grid = document.getElementById('list');
            if (grid && typeof grid.triggerToolbar === 'function') grid.triggerToolbar();
            return true;
        };
        const reloadFilteredGrid = async () => {
            const grid = document.getElementById('list');
            if (window.jQuery && grid) window.jQuery(grid).trigger('reloadGrid');
            await delay(250);
            triggerFileFilter();
            await delay(500);
        };

        try {
            if (String(window.location.hostname || '').trim().toLowerCase() !== payload.baseHost) {
                throw new Error('Открылась другая база Пирамиды.');
            }

            await waitFor(() => document.querySelector('#gs_FileName, input[name="FileName"]'), 20000, 'Не найден фильтр «Имя файла».');
            triggerFileFilter();
            await delay(400);

            const targetRow = await waitFor(
                () => findRegistryRow(true),
                20000,
                'Не найдена строка с указанными ID, типом и статусом реестра.'
            );
            const checkbox = targetRow.querySelector('input.cbox[type="checkbox"], input[id^="jqg_list_"]');
            if (!(checkbox instanceof HTMLInputElement)) throw new Error('Не найден флажок выбора реестра.');
            if (!checkbox.checked) checkbox.click();

            const conductToolbarButton = await waitFor(() => (
                Array.from(document.querySelectorAll('button, [role="button"]')).find((button) => {
                    const text = normalizeText(button.textContent || button.innerText);
                    return isVisible(button) &&
                        text.includes('Проведение реестра') &&
                        !text.includes('Отменить проведение реестра') &&
                        !button.disabled;
                }) || null
            ), 10000, 'Не найдена кнопка «Проведение реестра».');
            conductToolbarButton.click();

            const conductDialog = await waitFor(() => (
                Array.from(document.querySelectorAll('[role="dialog"], .ui-dialog')).find((dialog) => (
                    isVisible(dialog) &&
                    normalizeText(dialog.textContent || dialog.innerText).includes('Проведение реестра') &&
                    dialog.querySelector('iframe')
                )) || null
            ), 15000, 'Не открылось окно проведения реестра.');
            const iframe = conductDialog.querySelector('iframe');
            await waitFor(() => {
                if (!(iframe instanceof HTMLIFrameElement)) return null;
                const candidate = iframe.contentDocument;
                return candidate && candidate.body ? candidate : null;
            }, 15000, 'Не загрузилось окно подтверждения проведения.');
            const confirmButton = await waitFor(() => (
                (() => {
                    const currentDocument = iframe instanceof HTMLIFrameElement ? iframe.contentDocument : null;
                    if (!currentDocument || !currentDocument.body) return null;
                    return Array.from(currentDocument.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')).find((button) => {
                        const text = normalizeText(button.textContent || button.innerText || button.value);
                        return text.includes('Провести реестр') && !button.disabled;
                    }) || null;
                })()
            ), 15000, 'Не найдена кнопка «Провести реестр» в окне подтверждения.');
            confirmButton.click();

            const message = await waitFor(() => {
                const currentDocument = iframe instanceof HTMLIFrameElement ? iframe.contentDocument : null;
                if (!currentDocument || !currentDocument.body) return '';
                const alerts = Array.from(currentDocument.querySelectorAll('[role="alert"], .alert'));
                const alertText = alerts.map((alert) => normalizeText(alert.textContent || alert.innerText)).find(Boolean);
                return alertText || '';
            }, 120000, 'Пирамида не сообщила результат проведения реестра.');
            const successPattern = new RegExp(`Реестр\\s+${payload.registryId}\\s*-\\s*Реестр провед[её]н`, 'i');
            if (!successPattern.test(message)) throw new Error(message);

            const closeButton = Array.from(conductDialog.querySelectorAll('button')).find((button) => (
                normalizeText(button.textContent || button.innerText) === 'Закрыть'
            ));
            if (closeButton instanceof HTMLButtonElement) closeButton.click();

            let refreshedRow = null;
            let statusName = '';
            const positiveStatuses = new Set([
                'проведен',
                'проведено',
                'проведен (нет данных)',
                'проведено (нет данных)'
            ]);
            for (let attempt = 1; attempt <= 12; attempt += 1) {
                await reloadFilteredGrid();
                refreshedRow = findRegistryRow(false);
                statusName = refreshedRow ? getCellText(refreshedRow, 'StatusName') : '';
                if (statusName && positiveStatuses.has(normalizeKey(statusName))) break;
            }
            if (!refreshedRow) throw new Error('После проведения реестр не найден повторно.');
            if (!statusName) throw new Error('После проведения не удалось прочитать статус реестра.');

            return {
                success: true,
                registryId: payload.registryId,
                statusName,
                message
            };
        } catch (error) {
            return {
                success: false,
                error: error && error.message ? error.message : 'Не удалось провести реестр.'
            };
        }
    }, [requestData], { world: 'MAIN' });

    if (!result || result.success !== true) {
        throw new Error(result && result.error ? result.error : 'Не удалось провести реестр.');
    }
    return result;
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
                collectedRows.push({
                    ...row,
                    department: department.label,
                    depid: department.depid
                });
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

async function runEpguRegistryConduct(sourceTab, conductRequest) {
    const sourceTabId = sourceTab && Number.isInteger(sourceTab.id) ? sourceTab.id : null;
    const sourceWindowId = sourceTab && Number.isInteger(sourceTab.windowId) ? sourceTab.windowId : null;
    const sourceCookieStoreId = sourceTab && typeof sourceTab.cookieStoreId === 'string'
        ? sourceTab.cookieStoreId.trim()
        : '';
    if (!Number.isInteger(sourceTabId)) throw new Error('NO_SOURCE_TAB');

    const createProperties = {
        url: conductRequest.targetUrl,
        active: false,
        openerTabId: sourceTabId
    };
    if (Number.isInteger(sourceWindowId)) createProperties.windowId = sourceWindowId;
    if (sourceCookieStoreId) createProperties.cookieStoreId = sourceCookieStoreId;

    let workerTabId = null;
    let restoreCompleted = false;
    let conductError = null;
    let conductResult = null;

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
        if (!Number.isInteger(workerTabId)) throw new Error('Не удалось открыть служебную вкладку.');

        await navigateEpguRegistryWorkerTab(workerTabId, conductRequest.targetUrl, conductRequest.targetDepid);
        conductResult = await conductEpguRegistryInTab(workerTabId, conductRequest);
    } catch (error) {
        conductError = error;
    } finally {
        if (Number.isInteger(workerTabId)) {
            try {
                await navigateEpguRegistryWorkerTab(workerTabId, conductRequest.restoreUrl, conductRequest.restoreDepid);
                restoreCompleted = true;
            } catch (error) {
                if (!conductError) {
                    conductError = new Error(`Не удалось вернуть исходный департамент: ${error && error.message ? error.message : error}`);
                }
            }

            if (restoreCompleted) {
                try {
                    await removeTabAsync(workerTabId);
                } catch (error) {
                    if (!conductError) conductError = error;
                }
            } else {
                try {
                    await updateTabAsync(workerTabId, { active: true });
                } catch (error) {
                    // The error below tells the user that manual restoration is required.
                }
            }
        } else {
            restoreCompleted = true;
        }

        if (restoreCompleted) {
            try {
                await updateTabAsync(sourceTabId, { active: true });
            } catch (error) {
                // The result can still be returned if the source tab was closed meanwhile.
            }
        }
    }

    if (!restoreCompleted) {
        throw new Error('Не удалось подтвердить возврат исходного департамента. Служебная вкладка оставлена открытой.');
    }
    if (conductError) throw conductError;
    if (!conductResult) throw new Error('Пирамида не вернула результат проведения реестра.');
    return conductResult;
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

function executeScriptInAllFramesAsync(tabId, func, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const request = {
                target: { tabId: Number(tabId), allFrames: true },
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
                resolve(Array.isArray(results) ? results.map((entry) => entry && entry.result) : []);
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

            setTimeout(() => {
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
const STAGE_DEPARTMENT_STATE_TTL_MS = 10000;
let stageDepartmentStates = {}; // tabId -> { depid, label, host, pageUrl, updatedAt }

function sendStageTabMessageQuiet(tabId, message) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) {
            // Вкладка могла быть закрыта или не содержать content script таймера.
        }
    });
}

function broadcastStageDepartmentConflicts() {
    const now = Date.now();
    Object.keys(stageDepartmentStates).forEach((tabId) => {
        const state = stageDepartmentStates[tabId];
        if (!state || (now - state.updatedAt) > STAGE_DEPARTMENT_STATE_TTL_MS) {
            delete stageDepartmentStates[tabId];
        }
    });

    const states = Object.values(stageDepartmentStates);
    const uniqueDepids = new Set(states.map((state) => state.depid));
    const payload = {
        conflict: uniqueDepids.size > 1,
        entries: states.map((state) => ({
            depid: state.depid,
            label: state.label,
            host: state.host
        }))
    };

    states.forEach((state) => {
        sendStageTabMessageQuiet(state.tabId, {
            action: "STAGE_TIMER_DEPARTMENT_CONFLICT",
            data: payload
        });
    });
}

function updateStageDepartmentState(tabId, data) {
    if (!Number.isInteger(tabId)) return;
    const depid = String(data && data.depid || "").trim();
    if (!depid) return;
    stageDepartmentStates[tabId] = {
        tabId,
        depid,
        label: String(data && data.label || depid).replace(/\s+/g, " ").trim() || depid,
        host: String(data && data.host || "").trim(),
        pageUrl: String(data && data.pageUrl || "").trim(),
        updatedAt: Date.now()
    };
    broadcastStageDepartmentConflicts();
}

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
        sendStageTabMessageQuiet(details.tabId, {
            action: "STAGE_TIMER_START",
            data: { loadType: loadType, requestUrl: details.url }
        });
    }
    
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onCompleted.addListener((details) => {
    const req = stageRequests[details.requestId];
    if (req) {
        const duration = performance.now() - req.startTime;
        
        // Сообщаем контент скрипту: "Готово, вот время"
        sendStageTabMessageQuiet(req.tabId, {
            action: "STAGE_TIMER_STOP",
            data: { 
                duration: duration,
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        });
        
        delete stageRequests[details.requestId];
    }
}, { urls: STAGE_URL_PATTERNS });

chrome.webRequest.onErrorOccurred.addListener((details) => {
    const req = stageRequests[details.requestId];
    if (req) {
        sendStageTabMessageQuiet(req.tabId, {
            action: "STAGE_TIMER_ERROR",
            data: {
                duration: performance.now() - req.startTime,
                error: details.error || "",
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        });
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

const reestrDzWssWorkerTabs = new Map();
const reestrDzWssSourceCleanupPromises = new Map();
const reestrDzWriteOffReviewSessions = new Map();
const reestrDzWriteOffReviewSources = new Map();

function isAllowedReestrDzUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || ''));
        const hostname = String(url.hostname || '').toLowerCase();
        if (!['http:', 'https:'].includes(url.protocol)) return false;
        return hostname === 'wssdocs.vostok-electra.ru' ||
            hostname === 'pyramid.vostok-electra.ru' ||
            hostname === 'pyramid.nesko-nv.ru' ||
            hostname === 'pyramid-vostok.electra.ru' ||
            hostname.endsWith('.pyramid.vostok-electra.ru') ||
            hostname.endsWith('.pyramid.nesko-nv.ru') ||
            hostname.endsWith('.pyramid-vostok.electra.ru');
    } catch (error) {
        return false;
    }
}

function isReestrDzWssDocsUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || ''));
        return ['http:', 'https:'].includes(url.protocol) && String(url.hostname || '').toLowerCase() === 'wssdocs.vostok-electra.ru';
    } catch (error) {
        return false;
    }
}

async function closeReestrDzOrphanTabs(sourceTabId) {
    if (!Number.isInteger(sourceTabId)) return false;
    const tracked = new Set();
    const pool = getReestrDzWssWorkerPool(sourceTabId, false);
    if (pool) for (const tabId of pool.values()) if (Number.isInteger(tabId)) tracked.add(tabId);
    const review = reestrDzWriteOffReviewSessions.get(sourceTabId);
    if (review && Number.isInteger(review.reviewTabId)) tracked.add(review.reviewTabId);
    const tabs = await queryTabsAsync({});
    const staleTabIds = tabs
        .filter((tab) => Number.isInteger(tab && tab.id) && tab.openerTabId === sourceTabId && tab.active !== true &&
            !tracked.has(tab.id) && isReestrDzWssDocsUrl(tab.url))
        .map((tab) => tab.id);
    const results = await Promise.all(staleTabIds.map((tabId) => removeTabAsync(tabId).then(() => true).catch(() => false)));
    return results.some(Boolean);
}

async function ensureReestrDzSourceTabsCleaned(sourceTabId) {
    if (!Number.isInteger(sourceTabId)) return false;
    let cleanup = reestrDzWssSourceCleanupPromises.get(sourceTabId);
    if (!cleanup) {
        cleanup = closeReestrDzOrphanTabs(sourceTabId).catch((error) => {
            reestrDzWssSourceCleanupPromises.delete(sourceTabId);
            throw error;
        });
        reestrDzWssSourceCleanupPromises.set(sourceTabId, cleanup);
    }
    return cleanup;
}

function normalizeReestrDzWssWorkerKey(rawKey) {
    return String(rawKey || 'default').replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 80) || 'default';
}

function getReestrDzWssWorkerPool(sourceTabId, create = false) {
    let pool = reestrDzWssWorkerTabs.get(sourceTabId);
    if (!(pool instanceof Map) && create) {
        pool = new Map();
        reestrDzWssWorkerTabs.set(sourceTabId, pool);
    }
    return pool instanceof Map ? pool : null;
}

async function ensureReestrDzWssWorkerTab(sourceTab, rawWorkerKey) {
    const sourceTabId = sourceTab && Number.isInteger(sourceTab.id) ? sourceTab.id : null;
    if (!Number.isInteger(sourceTabId)) throw new Error('NO_SOURCE_TAB');
    const workerKey = normalizeReestrDzWssWorkerKey(rawWorkerKey);
    const workerPool = getReestrDzWssWorkerPool(sourceTabId, true);

    const storedTabId = workerPool.get(workerKey);
    if (Number.isInteger(storedTabId)) {
        try {
            await getTabAsync(storedTabId);
            return storedTabId;
        } catch (error) {
            workerPool.delete(workerKey);
        }
    }

    const createProperties = {
        url: 'about:blank',
        active: false,
        openerTabId: sourceTabId
    };
    if (Number.isInteger(sourceTab.windowId)) createProperties.windowId = sourceTab.windowId;
    if (sourceTab.cookieStoreId) createProperties.cookieStoreId = sourceTab.cookieStoreId;

    let workerTab;
    try {
        workerTab = await createTabAsync(createProperties);
    } catch (error) {
        delete createProperties.cookieStoreId;
        workerTab = await createTabAsync(createProperties);
    }
    const workerTabId = workerTab && Number.isInteger(workerTab.id) ? workerTab.id : null;
    if (!Number.isInteger(workerTabId)) throw new Error('NO_WSS_WORKER_TAB');
    workerPool.set(workerKey, workerTabId);
    return workerTabId;
}

async function loadReestrDzWssDataInWorker(sourceTab, url, kind, expectedNumber, workerKey) {
    const workerTabId = await ensureReestrDzWssWorkerTab(sourceTab, workerKey);
    await updateTabAsync(workerTabId, { url, active: false });
    const startedAt = Date.now();
    let lastResult = null;
    while (Date.now() - startedAt < 45000) {
        await delayAsync(180);
        try {
            lastResult = await executeScriptInTabAsync(workerTabId, (documentKind, expectedDocumentNumber) => {
                const normalize = (value) => String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
                const readVisibleText = (element) => normalize(element && ('innerText' in element ? element.innerText : element.textContent));
                const findSolutionHistoryTable = () => {
                    const tables = Array.from(document.querySelectorAll('#solHistoryTBL'));
                    return tables.find((table) => table.closest('.wss-solution-history')) ||
                        document.querySelector('#solutionHistoryTD .wss-solution-history table.wssc-shistory-tb') ||
                        tables.find((table) => table.querySelectorAll('tr').length > 1) ||
                        null;
                };
                const readCancellationDecisions = (historyTable) => historyTable
                    ? Array.from(historyTable.querySelectorAll('tr')).map((row) => {
                        const cells = Array.from(row.cells || []).map(readVisibleText);
                        if (cells.length < 2) return null;
                        const decisionMatch = cells[1].match(/^Аннулировать(?:\s+(.+))?$/i);
                        const historyMatch = cells[0].match(/^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+(.+)$/);
                        if (!decisionMatch || !historyMatch) return null;
                        return {
                            date: historyMatch[1],
                            time: historyMatch[2],
                            user: normalize(historyMatch[3]),
                            text: normalize(decisionMatch[1])
                        };
                    }).filter(Boolean)
                    : [];
                const expected = normalize(expectedDocumentNumber);
                const base = { url: window.location.href, title: document.title, kind: documentKind };
                if (document.readyState !== 'complete') return { ...base, success: false, pending: true, error: 'WSS_PAGE_LOADING' };
                if (documentKind === 'writeoff_request') {
                    const title = normalize(document.title);
                    if (expected && !title.includes(expected)) {
                        return { ...base, success: false, pending: true, error: 'WSS_REQUEST_IDENTITY_MISMATCH' };
                    }
                    const findFieldRow = (label) => Array.from(document.querySelectorAll('.dbf_listform_title'))
                        .find((element) => normalize(element.textContent) === label)?.closest('tr') || null;
                    const readFieldText = (label) => Array.from(document.querySelectorAll('.dbf_listform_title'))
                        .filter((element) => normalize(element.textContent) === label)
                        .map((element) => element.closest('tr'))
                        .filter(Boolean)
                        .map((row) => {
                            const valueContainer = row.querySelector('.lc_divValueContent') || row.cells && row.cells[row.cells.length - 1];
                            const input = valueContainer && valueContainer.querySelector('input:not([type="hidden"]), textarea, select');
                            return normalize(input && 'value' in input ? input.value : valueContainer && valueContainer.textContent);
                        })
                        .find(Boolean) || '';
                    const readFieldLinks = (label) => {
                        const row = findFieldRow(label);
                        if (!row) return [];
                        const unique = new Map();
                        row.querySelectorAll('a[href]').forEach((anchor) => {
                            const text = normalize(anchor.textContent);
                            const rawHref = String(anchor.getAttribute('href') || '').trim();
                            if (!text || !rawHref || /^javascript:/i.test(rawHref) || text.toLocaleLowerCase('ru-RU') === 'создать') return;
                            try {
                                const href = new URL(rawHref, window.location.href).toString();
                                unique.set(`${text}\n${href}`, { text, href });
                            } catch (error) {
                                // ignore malformed WSS link
                            }
                        });
                        return Array.from(unique.values());
                    };
                    const responsibleName = readFieldText('Ответственный за отражение списания в биллинговом ПК');
                    const historyTable = findSolutionHistoryTable();
                    if (!responsibleName || !historyTable) {
                        return { ...base, success: false, pending: true, error: 'WSS_REQUEST_AUDIT_DATA_LOADING' };
                    }
                    const allowedDecisions = [
                        'Задолженность списана частично',
                        'Задолженность списана',
                        'Отказ в списании'
                    ];
                    const writeOffDecisions = Array.from(historyTable.querySelectorAll('tr')).map((row) => {
                        const cells = Array.from(row.cells || []).map(readVisibleText);
                        if (cells.length < 2) return null;
                        const decision = allowedDecisions.find((value) => cells[1] === value || cells[1].startsWith(`${value} `));
                        if (!decision) return null;
                        const match = cells[0].match(/^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+(.+)$/);
                        if (!match) return null;
                        return { date: match[1], time: match[2], user: normalize(match[3]), decision, text: cells[1] };
                    }).filter(Boolean);
                    return {
                        ...base,
                        success: true,
                        expectedNumber: expected,
                        outgoingLinks: readFieldLinks('Ссылка на исходящий документ'),
                        incomingLinks: readFieldLinks('Ссылка на входящий документ'),
                        otherLinks: readFieldLinks('Другие документы'),
                        setsCount: readFieldText('Количество комплектов'),
                        writeOffAmount: readFieldText('Сумма списания задолженности'),
                        basicDebtAmount: readFieldText('Основной долг'),
                        stateFeeAmount: readFieldText('Госпошлина'),
                        penaltyAmount: readFieldText('Пени'),
                        additionalExpensesAmount: readFieldText('Доп. расходы'),
                        requestOrderNumber: readFieldText('Номер приказа о списании'),
                        requestOrderDate: readFieldText('Дата приказа'),
                        responsibleName,
                        writeOffDecisions,
                        cancellationDecisions: readCancellationDecisions(historyTable)
                    };
                }
                if (documentKind === 'request') {
                    const title = normalize(document.title);
                    if (expected && !title.includes(expected)) {
                        return { ...base, success: false, pending: true, error: 'WSS_REQUEST_IDENTITY_MISMATCH' };
                    }
                    const field = document.querySelector('#fieldControlContainer36813');
                    if (!field) return { ...base, success: false, pending: true, error: 'WSS_REQUEST_FIELD_NOT_FOUND' };
                    const unique = new Map();
                    field.querySelectorAll('.lc_divValueContent a[href]').forEach((anchor) => {
                        const text = normalize(anchor.textContent);
                        const rawHref = String(anchor.getAttribute('href') || '').trim();
                        if (!text || !rawHref || /^javascript:/i.test(rawHref) || text.toLocaleLowerCase('ru-RU') === 'создать') return;
                        try {
                            const href = new URL(rawHref, window.location.href).toString();
                            unique.set(`${text}\n${href}`, { text, href });
                        } catch (error) {
                            // ignore malformed WSS link
                        }
                    });
                    const responsibleLabel = Array.from(document.querySelectorAll('.dbf_listform_title'))
                        .find((element) => normalize(element.textContent) === 'Ответственный за отражение списания в биллинговом ПК');
                    const responsibleRow = responsibleLabel && responsibleLabel.closest('tr');
                    const responsibleValues = responsibleRow
                        ? Array.from(responsibleRow.cells || []).map((cell) => normalize(cell.textContent)).filter(Boolean)
                        : [];
                    const responsibleName = responsibleValues.find((value) => value !== 'Ответственный за отражение списания в биллинговом ПК') || '';
                    const historyTable = findSolutionHistoryTable();
                    if (!unique.size) {
                        if (!historyTable) return { ...base, success: false, pending: true, error: 'WSS_REQUEST_AUDIT_DATA_LOADING' };
                        return {
                            ...base,
                            success: true,
                            expectedNumber: expected,
                            links: [],
                            cancellationDecisions: readCancellationDecisions(historyTable)
                        };
                    }
                    if (!responsibleLabel || !historyTable) {
                        return { ...base, success: false, pending: true, error: 'WSS_REQUEST_AUDIT_DATA_LOADING' };
                    }
                    const completedDecisions = Array.from(historyTable.querySelectorAll('tr')).map((row) => {
                        const cells = Array.from(row.cells || []).map(readVisibleText);
                        if (cells.length < 2 || cells[1] !== 'Исполнено') return null;
                        const match = cells[0].match(/^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+(.+)$/);
                        if (!match) return null;
                        return { date: match[1], time: match[2], user: normalize(match[3]), decision: cells[1] };
                    }).filter(Boolean);
                    return {
                        ...base,
                        success: true,
                        expectedNumber: expected,
                        links: Array.from(unique.values()),
                        responsibleName,
                        completedDecisions,
                        cancellationDecisions: readCancellationDecisions(historyTable)
                    };
                }
                if (documentKind === 'outgoing') {
                    if (!/\/dms\/outgoing\//i.test(window.location.pathname)) {
                        return { ...base, success: false, pending: true, error: 'WSS_OUTGOING_PAGE_MISMATCH' };
                    }
                    const headers = Array.from(document.querySelectorAll('.stage_info_span_text'))
                        .map((element) => normalize(element.textContent))
                        .filter(Boolean);
                    const matchingHeaders = expected
                        ? headers.filter((header) => header === expected || header.startsWith(`${expected} (`))
                        : headers;
                    if (!matchingHeaders.length) {
                        return { ...base, success: false, pending: true, error: 'WSS_OUTGOING_IDENTITY_MISMATCH' };
                    }
                    return { ...base, success: true, expectedNumber: expected, headers: matchingHeaders };
                }
                return { ...base, success: false, error: 'WSS_DOCUMENT_KIND_UNKNOWN' };
            }, [kind, expectedNumber]);
        } catch (error) {
            lastResult = { success: false, pending: true, error: error && error.message ? error.message : String(error) };
        }
        if (lastResult && lastResult.success === true) return { source: 'tab', ...lastResult };
        if (lastResult && lastResult.pending !== true) break;
    }
    throw new Error(lastResult && lastResult.error ? lastResult.error : 'WSS_DOCUMENT_UNAVAILABLE');
}

async function loadReestrDzWssDocument(sourceTab, rawUrl, rawKind, rawExpectedNumber, rawWorkerKey) {
    const url = String(rawUrl || '').trim();
    const kind = String(rawKind || '').trim();
    const expectedNumber = String(rawExpectedNumber || '').replace(/\s+/g, ' ').trim();
    if (!isAllowedReestrDzUrl(url)) throw new Error('WSS_URL_NOT_ALLOWED');
    if (!['request', 'outgoing', 'writeoff_request'].includes(kind)) throw new Error('WSS_DOCUMENT_KIND_UNKNOWN');
    if (!expectedNumber) throw new Error('WSS_EXPECTED_NUMBER_REQUIRED');

    const sourceTabId = sourceTab && Number.isInteger(sourceTab.id) ? sourceTab.id : null;
    if (!Number.isInteger(sourceTabId)) throw new Error('NO_SOURCE_TAB');
    await ensureReestrDzSourceTabsCleaned(sourceTabId).catch(() => false);
    return loadReestrDzWssDataInWorker(sourceTab, url, kind, expectedNumber, normalizeReestrDzWssWorkerKey(rawWorkerKey));
}

async function closeReestrDzWssWorker(sourceTabId, rawWorkerKey = '') {
    const pool = getReestrDzWssWorkerPool(sourceTabId, false);
    if (!pool) return false;
    const workerKey = String(rawWorkerKey || '').trim() ? normalizeReestrDzWssWorkerKey(rawWorkerKey) : '';
    const tabIds = workerKey
        ? [pool.get(workerKey)].filter(Number.isInteger)
        : Array.from(pool.values()).filter(Number.isInteger);
    if (workerKey) pool.delete(workerKey);
    else reestrDzWssWorkerTabs.delete(sourceTabId);
    if (!pool.size) reestrDzWssWorkerTabs.delete(sourceTabId);
    if (!tabIds.length) return false;
    const results = await Promise.all(tabIds.map(async (tabId) => {
        try {
            await removeTabAsync(tabId);
            return true;
        } catch (error) {
            return false;
        }
    }));
    return results.some(Boolean);
}

async function closeReestrDzWriteOffReview(sourceTabId, activateSource = false) {
    const session = reestrDzWriteOffReviewSessions.get(sourceTabId);
    if (!session) return false;
    reestrDzWriteOffReviewSessions.delete(sourceTabId);
    reestrDzWriteOffReviewSources.delete(session.reviewTabId);
    try {
        if (Number.isInteger(session.reviewTabId)) await removeTabAsync(session.reviewTabId);
    } catch (error) {
        // the review tab may already be closed by the user
    }
    if (activateSource) {
        try {
            await updateTabAsync(sourceTabId, { active: true });
        } catch (error) {
            // source tab may have been closed
        }
    }
    return true;
}

async function openReestrDzWriteOffAttachmentViewer(sourceTabId, session, currentReviewTab, targetUrl, fileName, attachmentType) {
    if (!Number.isInteger(sourceTabId) || !session || !isReestrDzWssDocsUrl(targetUrl)) {
        throw new Error('INVALID_WRITE_OFF_ATTACHMENT_URL');
    }
    const normalizedFileName = String(fileName || '').trim();
    const normalizedType = attachmentType === 'archive' ? 'archive' : 'pdf';
    const archivePattern = /\.(?:zip|rar|7z|tar|tgz|tbz2?|txz|tar\.(?:gz|bz2|xz)|gz|bz2|xz)(?:$|[?#])/i;
    const isValidAttachment = normalizedType === 'archive'
        ? archivePattern.test(normalizedFileName) || archivePattern.test(targetUrl)
        : /\.pdf$/i.test(normalizedFileName) || /\.pdf(?:$|[?#])/i.test(targetUrl);
    if (!isValidAttachment) {
        throw new Error(normalizedType === 'archive' ? 'WRITE_OFF_ATTACHMENT_IS_NOT_ARCHIVE' : 'WRITE_OFF_ATTACHMENT_IS_NOT_PDF');
    }
    const oldReviewTabId = session.reviewTabId;
    const createProperties = {
        url: 'about:blank',
        active: true,
        openerTabId: sourceTabId
    };
    if (currentReviewTab && Number.isInteger(currentReviewTab.windowId)) createProperties.windowId = currentReviewTab.windowId;
    if (currentReviewTab && currentReviewTab.cookieStoreId) createProperties.cookieStoreId = currentReviewTab.cookieStoreId;

    let viewerTab;
    try {
        viewerTab = await createTabAsync(createProperties);
    } catch (error) {
        delete createProperties.cookieStoreId;
        viewerTab = await createTabAsync(createProperties);
    }
    const viewerTabId = viewerTab && Number.isInteger(viewerTab.id) ? viewerTab.id : null;
    if (!Number.isInteger(viewerTabId)) throw new Error('NO_WRITE_OFF_PDF_VIEWER_TAB');

    const currentDocument = Array.isArray(session.data && session.data.documents)
        ? session.data.documents[Math.max(0, Number(session.currentDocumentIndex) || 0)]
        : null;
    const documentCacheKey = String(currentDocument && (currentDocument.text || currentDocument.label) || targetUrl).trim();
    const viewerUrl = chrome.runtime.getURL('reestr_dz_pdf_viewer.html') + '#' + new URLSearchParams({
        url: targetUrl,
        name: normalizedFileName || (normalizedType === 'archive' ? 'Архив' : 'Документ.pdf'),
        mode: normalizedType,
        cacheKey: `${String(session.data && session.data.depid || '')}:${documentCacheKey}`
    }).toString();
    reestrDzWriteOffReviewSources.delete(oldReviewTabId);
    reestrDzWriteOffReviewSources.set(viewerTabId, sourceTabId);
    session.reviewTabId = viewerTabId;
    session.updatedAt = Date.now();
    try {
        await updateTabAsync(viewerTabId, { url: viewerUrl, active: true });
    } catch (error) {
        reestrDzWriteOffReviewSources.delete(viewerTabId);
        session.reviewTabId = oldReviewTabId;
        if (Number.isInteger(oldReviewTabId)) reestrDzWriteOffReviewSources.set(oldReviewTabId, sourceTabId);
        await removeTabAsync(viewerTabId).catch(() => null);
        throw error;
    }
    if (Number.isInteger(oldReviewTabId) && oldReviewTabId !== viewerTabId) {
        setTimeout(() => removeTabAsync(oldReviewTabId).catch(() => null), 180);
    }
    return { success: true, reviewTabId: viewerTabId };
}

function getReestrDzArchiveLocalDateKey(value = new Date()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function pruneReestrDzWriteOffArchiveCache() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(0);
    const today = getReestrDzArchiveLocalDateKey();
    return new Promise((resolve) => {
        const request = indexedDB.open('dupReestrDzWriteOffArchiveCache', 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains('archives')) {
                database.createObjectStore('archives', { keyPath: 'key' });
            }
        };
        request.onerror = () => resolve(0);
        request.onsuccess = () => {
            const database = request.result;
            let removed = 0;
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                database.close();
                resolve(removed);
            };
            let transaction;
            try {
                transaction = database.transaction('archives', 'readwrite');
                const cursorRequest = transaction.objectStore('archives').openCursor();
                cursorRequest.onsuccess = () => {
                    const cursor = cursorRequest.result;
                    if (!cursor) return;
                    if (String(cursor.value && cursor.value.dateKey || '') !== today) {
                        cursor.delete();
                        removed += 1;
                    }
                    cursor.continue();
                };
                cursorRequest.onerror = finish;
                transaction.oncomplete = finish;
                transaction.onerror = finish;
                transaction.onabort = finish;
            } catch (error) {
                finish();
            }
        };
    });
}

async function openReestrDzWriteOffReview(sourceTab, rawData) {
    const sourceTabId = sourceTab && Number.isInteger(sourceTab.id) ? sourceTab.id : null;
    if (!Number.isInteger(sourceTabId)) throw new Error('NO_SOURCE_TAB');
    await closeReestrDzWriteOffReview(sourceTabId, false);
    const data = rawData && typeof rawData === 'object' ? JSON.parse(JSON.stringify(rawData)) : {};
    const documents = Array.isArray(data.documents) ? data.documents.filter((item) => item && isAllowedReestrDzUrl(item.href)) : [];
    if (!documents.length) throw new Error('WRITE_OFF_DOCUMENTS_NOT_FOUND');
    const createProperties = {
        url: documents[0].href,
        active: true,
        openerTabId: sourceTabId
    };
    if (Number.isInteger(sourceTab.windowId)) createProperties.windowId = sourceTab.windowId;
    if (sourceTab.cookieStoreId) createProperties.cookieStoreId = sourceTab.cookieStoreId;
    let reviewTab;
    try {
        reviewTab = await createTabAsync(createProperties);
    } catch (error) {
        delete createProperties.cookieStoreId;
        reviewTab = await createTabAsync(createProperties);
    }
    const reviewTabId = reviewTab && Number.isInteger(reviewTab.id) ? reviewTab.id : null;
    if (!Number.isInteger(reviewTabId)) throw new Error('NO_WRITE_OFF_REVIEW_TAB');
    const session = {
        sourceTabId,
        reviewTabId,
        status: 'reviewing',
        paused: false,
        mode: data.reviewType === 'decision_mismatch'
            ? 'decision_confirm'
            : data.reviewType === 'outgoing_mismatch' ? 'comment' : 'order',
        completionMode: '',
        currentDocumentIndex: 0,
        fields: {
            orderDate: '',
            orderNumber: '',
            comment: String(data.suggestedComment || data.suggestedDecisionText || data.decision || '').trim()
        },
        position: null,
        attachmentsByUrl: {},
        processedArchiveUrls: [],
        data: { ...data, documents },
        updatedAt: Date.now()
    };
    reestrDzWriteOffReviewSessions.set(sourceTabId, session);
    reestrDzWriteOffReviewSources.set(reviewTabId, sourceTabId);
    return { success: true, reviewTabId };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'REESTR_DZ_GET_GRID_STATE': {
            const tabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            if (!Number.isInteger(tabId)) {
                sendResponse({ success: false, error: 'NO_SOURCE_TAB' });
                return false;
            }
            executeScriptInTabAsync(tabId, () => {
                if (!(window.jQuery && window.jQuery.fn && window.jQuery.fn.jqGrid)) {
                    return { success: false, error: 'JQGRID_UNAVAILABLE' };
                }
                const grid = window.jQuery('#list');
                const postData = grid.jqGrid('getGridParam', 'postData') || {};
                return {
                    success: true,
                    page: Number(grid.jqGrid('getGridParam', 'page')) || 1,
                    rowNum: Number(grid.jqGrid('getGridParam', 'rowNum')) || 30,
                    records: Number(grid.jqGrid('getGridParam', 'records')) || 0,
                    lastpage: Number(grid.jqGrid('getGridParam', 'lastpage')) || 1,
                    sortname: String(grid.jqGrid('getGridParam', 'sortname') || 'CreateDate'),
                    sortorder: String(grid.jqGrid('getGridParam', 'sortorder') || 'desc'),
                    postData: JSON.parse(JSON.stringify(postData))
                };
            }, [], { world: 'MAIN' }).then(sendResponse).catch((error) => {
                sendResponse({ success: false, error: error && error.message ? error.message : String(error) });
            });
            return true;
        }

        case 'REESTR_DZ_SET_GRID_PAGE': {
            const tabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const page = Math.max(1, Number.parseInt(String(request.data && request.data.page || 1), 10) || 1);
            const forcePager = request.data && request.data.forcePager === true;
            if (!Number.isInteger(tabId)) {
                sendResponse({ success: false, error: 'NO_SOURCE_TAB' });
                return false;
            }
            executeScriptInTabAsync(tabId, (targetPage, usePager) => {
                if (!(window.jQuery && window.jQuery.fn && window.jQuery.fn.jqGrid)) {
                    return { success: false, error: 'JQGRID_UNAVAILABLE' };
                }
                const grid = window.jQuery('#list');
                if (!grid.length) return { success: false, error: 'GRID_UNAVAILABLE' };
                if (usePager) {
                    const pagerInput = window.jQuery('#pager .ui-pg-input, .ui-jqgrid-pager .ui-pg-input').first();
                    if (!pagerInput.length) return { success: false, error: 'GRID_PAGER_UNAVAILABLE' };
                    pagerInput.val(String(targetPage));
                    const enterEvent = window.jQuery.Event('keydown');
                    enterEvent.which = 13;
                    enterEvent.keyCode = 13;
                    pagerInput.trigger(enterEvent);
                    return { success: true, page: targetPage, method: 'pager' };
                }
                grid.jqGrid('setGridParam', { page: targetPage });
                grid.trigger('reloadGrid', [{ page: targetPage }]);
                return { success: true, page: targetPage, method: 'reloadGrid' };
            }, [page, forcePager], { world: 'MAIN' }).then(sendResponse).catch((error) => {
                sendResponse({ success: false, error: error && error.message ? error.message : String(error) });
            });
            return true;
        }

        case 'REESTR_DZ_SELECT_GRID_ROW': {
            const tabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const rowId = String(request.data && request.data.rowId || '').trim();
            if (!Number.isInteger(tabId) || !rowId) {
                sendResponse({ success: false, error: 'INVALID_GRID_ROW' });
                return false;
            }
            executeScriptInTabAsync(tabId, (targetRowId) => {
                if (!(window.jQuery && window.jQuery.fn && window.jQuery.fn.jqGrid)) {
                    return { success: false, error: 'JQGRID_UNAVAILABLE' };
                }
                const grid = window.jQuery('#list');
                const row = document.querySelector(`#list tr[id="${String(targetRowId).replace(/[^0-9]/g, '')}"]`);
                if (!grid.length || !(row instanceof HTMLElement)) {
                    return { success: false, error: 'GRID_ROW_NOT_READY' };
                }
                grid.jqGrid('resetSelection');
                grid.jqGrid('setSelection', String(targetRowId), true);
                const selected = grid.jqGrid('getGridParam', 'selarrrow') || [];
                const checkbox = row.querySelector('input.cbox[type="checkbox"]');
                const checkedRows = Array.from(document.querySelectorAll('#list tr.jqgrow input.cbox[type="checkbox"]:checked'));
                const selectedIds = selected.map(String);
                return {
                    success: selectedIds.length === 1 &&
                        selectedIds[0] === String(targetRowId) &&
                        checkedRows.length === 1 &&
                        checkedRows[0] === checkbox &&
                        !!checkbox.checked,
                    selected: selectedIds,
                    checkedCount: checkedRows.length
                };
            }, [rowId], { world: 'MAIN' }).then(sendResponse).catch((error) => {
                sendResponse({ success: false, error: error && error.message ? error.message : String(error) });
            });
            return true;
        }

        case 'REESTR_DZ_LOAD_WSS_DOCUMENT': {
            loadReestrDzWssDocument(
                sender && sender.tab,
                request.data && request.data.url,
                request.data && request.data.kind,
                request.data && request.data.expectedNumber,
                request.data && request.data.workerKey
            )
                .then(sendResponse)
                .catch((error) => sendResponse({
                    success: false,
                    error: error && error.message ? error.message : String(error)
                }));
            return true;
        }

        case 'REESTR_DZ_WRITE_OFF_OPEN_REVIEW': {
            openReestrDzWriteOffReview(sender && sender.tab, request.data)
                .then(sendResponse)
                .catch((error) => sendResponse({ success: false, error: error && error.message ? error.message : String(error) }));
            return true;
        }

        case 'REESTR_DZ_WRITE_OFF_GET_REVIEW_STATE': {
            const reviewTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const sourceTabId = Number.isInteger(reviewTabId) ? reestrDzWriteOffReviewSources.get(reviewTabId) : null;
            const session = Number.isInteger(sourceTabId) ? reestrDzWriteOffReviewSessions.get(sourceTabId) : null;
            sendResponse(session ? { success: true, session: JSON.parse(JSON.stringify(session)) } : { success: false, error: 'NO_WRITE_OFF_REVIEW' });
            return false;
        }

        case 'REESTR_DZ_WRITE_OFF_PRUNE_ARCHIVE_CACHE': {
            pruneReestrDzWriteOffArchiveCache()
                .then((removed) => sendResponse({ success: true, removed }))
                .catch((error) => sendResponse({ success: false, error: error && error.message ? error.message : String(error) }));
            return true;
        }

        case 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW': {
            const reviewTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const sourceTabId = Number.isInteger(reviewTabId) ? reestrDzWriteOffReviewSources.get(reviewTabId) : null;
            const session = Number.isInteger(sourceTabId) ? reestrDzWriteOffReviewSessions.get(sourceTabId) : null;
            if (!session) {
                sendResponse({ success: false, error: 'NO_WRITE_OFF_REVIEW' });
                return false;
            }
            const data = request.data && typeof request.data === 'object' ? request.data : {};
            if (data.fields && typeof data.fields === 'object') {
                session.fields = {
                    orderDate: data.fields.orderDate === undefined ? String(session.fields.orderDate || '') : String(data.fields.orderDate || '').trim(),
                    orderNumber: data.fields.orderNumber === undefined ? String(session.fields.orderNumber || '') : String(data.fields.orderNumber || '').trim(),
                    comment: data.fields.comment === undefined ? String(session.fields.comment || '') : String(data.fields.comment || '').trim()
                };
            }
            if (['comment', 'order', 'decision_confirm', 'decision_skip'].includes(data.mode)) session.mode = data.mode;
            if (typeof data.paused === 'boolean') session.paused = data.paused;
            if (data.position && Number.isFinite(Number(data.position.left)) && Number.isFinite(Number(data.position.top))) {
                session.position = { left: Number(data.position.left), top: Number(data.position.top) };
            }
            if (Array.isArray(data.attachments)) {
                const pageUrl = String(data.pageUrl || sender.tab.url || '');
                session.attachmentsByUrl[pageUrl] = data.attachments.filter((item) => item && isAllowedReestrDzUrl(item.href));
            }
            if (data.processedArchiveUrl && isAllowedReestrDzUrl(data.processedArchiveUrl)) {
                const processedArchiveUrls = new Set(Array.isArray(session.processedArchiveUrls) ? session.processedArchiveUrls : []);
                processedArchiveUrls.add(String(data.processedArchiveUrl));
                session.processedArchiveUrls = Array.from(processedArchiveUrls);
            }
            session.updatedAt = Date.now();
            sendResponse({ success: true, session: JSON.parse(JSON.stringify(session)) });
            return false;
        }

        case 'REESTR_DZ_WRITE_OFF_NAVIGATE_REVIEW': {
            const reviewTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const sourceTabId = Number.isInteger(reviewTabId) ? reestrDzWriteOffReviewSources.get(reviewTabId) : null;
            const session = Number.isInteger(sourceTabId) ? reestrDzWriteOffReviewSessions.get(sourceTabId) : null;
            const targetUrl = String(request.data && request.data.url || '').trim();
            if (!session || !isAllowedReestrDzUrl(targetUrl)) {
                sendResponse({ success: false, error: 'INVALID_WRITE_OFF_REVIEW_URL' });
                return false;
            }
            const documentIndex = Number.parseInt(String(request.data && request.data.documentIndex), 10);
            if (Number.isInteger(documentIndex) && documentIndex >= 0) session.currentDocumentIndex = documentIndex;
            session.updatedAt = Date.now();
            const attachmentType = request.data && String(request.data.attachmentType || '');
            if (attachmentType === 'pdf' || attachmentType === 'archive') {
                openReestrDzWriteOffAttachmentViewer(
                    sourceTabId,
                    session,
                    sender && sender.tab,
                    targetUrl,
                    request.data && request.data.fileName,
                    attachmentType
                )
                    .then(sendResponse)
                    .catch((error) => sendResponse({ success: false, error: error && error.message ? error.message : String(error) }));
                return true;
            }
            updateTabAsync(reviewTabId, { url: targetUrl, active: true })
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: error && error.message ? error.message : String(error) }));
            return true;
        }

        case 'REESTR_DZ_WRITE_OFF_FINISH_REVIEW': {
            const reviewTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const sourceTabId = Number.isInteger(reviewTabId) ? reestrDzWriteOffReviewSources.get(reviewTabId) : null;
            const session = Number.isInteger(sourceTabId) ? reestrDzWriteOffReviewSessions.get(sourceTabId) : null;
            if (!session) {
                sendResponse({ success: false, error: 'NO_WRITE_OFF_REVIEW' });
                return false;
            }
            const fields = request.data && request.data.fields && typeof request.data.fields === 'object' ? request.data.fields : {};
            const requestedMode = request.data && String(request.data.mode || '');
            const completionMode = ['comment', 'decision_confirm', 'decision_skip'].includes(requestedMode)
                ? requestedMode
                : 'order';
            session.fields = {
                orderDate: String(fields.orderDate || '').trim(),
                orderNumber: String(fields.orderNumber || '').trim(),
                comment: String(fields.comment || '').trim()
            };
            const allowsEmptyOutgoingComment = session.data &&
                session.data.reviewType === 'outgoing_mismatch' &&
                session.data.outgoingIssueType === 'missing';
            if (completionMode === 'comment' && !session.fields.comment && !allowsEmptyOutgoingComment) {
                sendResponse({ success: false, error: 'WRITE_OFF_COMMENT_REQUIRED' });
                return false;
            }
            session.mode = completionMode;
            session.completionMode = completionMode;
            session.status = 'done';
            session.paused = false;
            session.updatedAt = Date.now();
            updateTabAsync(sourceTabId, { active: true }).catch(() => null);
            sendResponse({ success: true });
            setTimeout(() => removeTabAsync(reviewTabId).catch(() => null), 120);
            return false;
        }

        case 'REESTR_DZ_WRITE_OFF_STOP_REVIEW': {
            const reviewTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const sourceTabId = Number.isInteger(reviewTabId) ? reestrDzWriteOffReviewSources.get(reviewTabId) : null;
            const session = Number.isInteger(sourceTabId) ? reestrDzWriteOffReviewSessions.get(sourceTabId) : null;
            if (!session) {
                sendResponse({ success: false, error: 'NO_WRITE_OFF_REVIEW' });
                return false;
            }
            session.status = 'cancelled';
            session.updatedAt = Date.now();
            updateTabAsync(sourceTabId, { active: true }).catch(() => null);
            sendResponse({ success: true });
            setTimeout(() => removeTabAsync(reviewTabId).catch(() => null), 120);
            return false;
        }

        case 'REESTR_DZ_WRITE_OFF_POLL_REVIEW': {
            const sourceTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const session = Number.isInteger(sourceTabId) ? reestrDzWriteOffReviewSessions.get(sourceTabId) : null;
            if (!session) {
                sendResponse({ success: false, error: 'NO_WRITE_OFF_REVIEW' });
                return false;
            }
            const response = {
                success: true,
                status: session.status,
                mode: session.completionMode || session.mode || 'order',
                fields: { ...session.fields },
                paused: session.paused
            };
            if (session.status === 'done' || session.status === 'cancelled') {
                reestrDzWriteOffReviewSessions.delete(sourceTabId);
                reestrDzWriteOffReviewSources.delete(session.reviewTabId);
            }
            sendResponse(response);
            return false;
        }

        case 'REESTR_DZ_WRITE_OFF_CANCEL_REVIEW': {
            const sourceTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            if (!Number.isInteger(sourceTabId)) {
                sendResponse({ success: false, error: 'NO_SOURCE_TAB' });
                return false;
            }
            closeReestrDzWriteOffReview(sourceTabId, true)
                .then((closed) => sendResponse({ success: true, closed }))
                .catch((error) => sendResponse({ success: false, error: error && error.message ? error.message : String(error) }));
            return true;
        }

        case 'REESTR_DZ_FILL_NATIVE_FORM': {
            const sourceTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const rowId = String(request.data && request.data.rowId || '').trim();
            const sendDate = String(request.data && request.data.sendDate || '').trim();
            const principalNumber = String(request.data && request.data.principalNumber || '').trim();
            if (!Number.isInteger(sourceTabId) || !rowId || !sendDate || !principalNumber) {
                sendResponse({ success: false, error: 'INVALID_NATIVE_FORM_DATA' });
                return false;
            }

            (async () => {
                const startedAt = Date.now();
                while (Date.now() - startedAt < 15000) {
                    const frameResults = await executeScriptInAllFramesAsync(
                        sourceTabId,
                        async (payload) => {
                            if (window.location.pathname !== '/ovzid/ReestrDz/Send') {
                                return { matched: false };
                            }

                            const form = document.querySelector('form[action*="/ovzid/ReestrDz/Send"]');
                            const idInput = form && form.querySelector('input[name="ReestrDzID"]');
                            if (!form || String(idInput && idInput.value || '').trim() !== payload.rowId) {
                                return { matched: false };
                            }

                            const sendDateInput = form.querySelector('input[name="SendDate"]');
                            const principalNumberInput = form.querySelector('input[name="PrincipalNumber"]');
                            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
                            if (!(sendDateInput instanceof HTMLInputElement) ||
                                !(principalNumberInput instanceof HTMLInputElement) ||
                                !(submitButton instanceof HTMLElement)) {
                                return { matched: true, success: false, error: 'NATIVE_FORM_NOT_READY' };
                            }

                            const setValue = (input, value) => {
                                input.focus();
                                input.value = String(value || '');
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.blur();
                            };

                            setValue(sendDateInput, payload.sendDate);
                            setValue(principalNumberInput, payload.principalNumber);
                            window.setTimeout(() => submitButton.click(), 80);
                            return { matched: true, success: true };
                        },
                        [{ rowId, sendDate, principalNumber }],
                        { world: 'MAIN' }
                    );
                    const successfulFrame = frameResults.find((result) => result && result.matched && result.success);
                    if (successfulFrame) return successfulFrame;
                    await delayAsync(120);
                }
                return { success: false, error: 'NATIVE_FORM_NOT_FOUND' };
            })().then(sendResponse).catch((error) => sendResponse({
                success: false,
                error: error && error.message ? error.message : String(error)
            }));
            return true;
        }

        case 'REESTR_DZ_FILL_NOTE_FORM': {
            const sourceTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const rowId = String(request.data && request.data.rowId || '').trim();
            const note = String(request.data && request.data.note || '').trim();
            if (!Number.isInteger(sourceTabId) || !rowId || !note) {
                sendResponse({ success: false, error: 'INVALID_NOTE_FORM_DATA' });
                return false;
            }

            (async () => {
                const startedAt = Date.now();
                while (Date.now() - startedAt < 15000) {
                    const frameResults = await executeScriptInAllFramesAsync(
                        sourceTabId,
                        async (payload) => {
                            if (window.location.pathname !== '/ovzid/ReestrDz/SetNote') {
                                return { matched: false };
                            }

                            const form = document.querySelector('form[action*="/ovzid/ReestrDz/SetNote"]');
                            const idInput = form && form.querySelector('input[name="ReestrDzID"]');
                            if (!form || String(idInput && idInput.value || '').trim() !== payload.rowId) {
                                return { matched: false };
                            }

                            const noteInput = form.querySelector('textarea[name="Note"]');
                            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
                            if (!(noteInput instanceof HTMLTextAreaElement) || !(submitButton instanceof HTMLElement)) {
                                return { matched: true, success: false, error: 'NOTE_FORM_NOT_READY' };
                            }

                            noteInput.focus();
                            noteInput.value = String(payload.note || '');
                            noteInput.dispatchEvent(new Event('input', { bubbles: true }));
                            noteInput.dispatchEvent(new Event('change', { bubbles: true }));
                            noteInput.blur();
                            window.setTimeout(() => submitButton.click(), 80);
                            return { matched: true, success: true };
                        },
                        [{ rowId, note }],
                        { world: 'MAIN' }
                    );
                    const successfulFrame = frameResults.find((result) => result && result.matched && result.success);
                    if (successfulFrame) return successfulFrame;
                    await delayAsync(120);
                }
                return { success: false, error: 'NOTE_FORM_NOT_FOUND' };
            })().then(sendResponse).catch((error) => sendResponse({
                success: false,
                error: error && error.message ? error.message : String(error)
            }));
            return true;
        }

        case 'REESTR_DZ_FILL_ORDER_FORM': {
            const sourceTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            const rowId = String(request.data && request.data.rowId || '').trim();
            const orderDate = String(request.data && request.data.orderDate || '').trim();
            const orderNumber = String(request.data && request.data.orderNumber || '').trim();
            if (!Number.isInteger(sourceTabId) || !rowId || !orderDate || !orderNumber) {
                sendResponse({ success: false, error: 'INVALID_ORDER_FORM_DATA' });
                return false;
            }

            (async () => {
                const startedAt = Date.now();
                while (Date.now() - startedAt < 15000) {
                    const frameResults = await executeScriptInAllFramesAsync(
                        sourceTabId,
                        async (payload) => {
                            if (window.location.pathname !== '/ovzid/ReestrDz/Order') return { matched: false };
                            const form = document.querySelector('form[action*="/ovzid/ReestrDz/Order"]');
                            const idInput = form && form.querySelector('input[name="ReestrDzID"]');
                            if (!form || String(idInput && idInput.value || '').trim() !== payload.rowId) return { matched: false };
                            const dateInput = form.querySelector('input[name="OrderDate"]');
                            const numberInput = form.querySelector('input[name="OrderNumber"]');
                            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
                            if (!(dateInput instanceof HTMLInputElement) || !(numberInput instanceof HTMLInputElement) || !(submitButton instanceof HTMLElement)) {
                                return { matched: true, success: false, error: 'ORDER_FORM_NOT_READY' };
                            }
                            const setValue = (input, value) => {
                                input.focus();
                                input.value = String(value || '');
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.blur();
                            };
                            setValue(dateInput, payload.orderDate);
                            setValue(numberInput, payload.orderNumber);
                            setTimeout(() => submitButton.click(), 80);
                            return { matched: true, success: true };
                        },
                        [{ rowId, orderDate, orderNumber }],
                        { world: 'MAIN' }
                    );
                    const successfulFrame = frameResults.find((result) => result && result.matched && result.success);
                    if (successfulFrame) return successfulFrame;
                    await delayAsync(120);
                }
                return { success: false, error: 'ORDER_FORM_NOT_FOUND' };
            })().then(sendResponse).catch((error) => sendResponse({
                success: false,
                error: error && error.message ? error.message : String(error)
            }));
            return true;
        }

        case 'REESTR_DZ_CLOSE_WSS_SESSION': {
            const sourceTabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
            if (!Number.isInteger(sourceTabId)) {
                sendResponse({ success: false, error: 'NO_SOURCE_TAB' });
                return false;
            }
            const data = request.data && typeof request.data === 'object' ? request.data : {};
            const workersOnly = data.workersOnly === true;
            Promise.all([
                closeReestrDzWssWorker(sourceTabId, data.workerKey),
                workersOnly ? Promise.resolve(false) : closeReestrDzWriteOffReview(sourceTabId, false),
                workersOnly ? Promise.resolve(false) : closeReestrDzOrphanTabs(sourceTabId)
            ])
                .then((results) => sendResponse({ success: true, closed: results.some(Boolean) }))
                .catch((error) => sendResponse({
                    success: false,
                    error: error && error.message ? error.message : String(error)
                }));
            return true;
        }

        case 'STAGE_TIMER_DEPARTMENT_STATE': {
            const tabId = getStageTabId(request, sender);
            updateStageDepartmentState(tabId, request.data || {});
            return false;
        }

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

        case 'FSSP_REGISTRY_SEARCH_GET_GRID_STATE': {
            const sourceTabId = sender && sender.tab ? sender.tab.id : null;
            if (!Number.isInteger(sourceTabId)) {
                sendResponse({ success: false, error: 'Не удалось определить текущую вкладку.' });
                return false;
            }

            (async () => {
                try {
                    const state = await executeScriptInTabAsync(sourceTabId, () => {
                        const $ = window.jQuery;
                        if (!($ && $.fn && $.fn.jqGrid)) return null;
                        const grid = $('#list');
                        if (!(grid && grid.length)) return null;
                        const postData = grid.jqGrid('getGridParam', 'postData') || {};
                        let safePostData = {};
                        try {
                            safePostData = JSON.parse(JSON.stringify(postData));
                        } catch (error) {
                            safePostData = {};
                        }
                        return {
                            url: String(grid.jqGrid('getGridParam', 'url') || ''),
                            postData: safePostData,
                            sortname: String(grid.jqGrid('getGridParam', 'sortname') || ''),
                            sortorder: String(grid.jqGrid('getGridParam', 'sortorder') || '')
                        };
                    }, [], { world: 'MAIN' });
                    if (!state || !state.url) {
                        sendResponse({ success: false, error: 'Таблица реестров ещё не готова.' });
                        return;
                    }
                    sendResponse({ success: true, state });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'Не удалось прочитать параметры таблицы.'
                    });
                }
            })();
            return true;
        }

        case 'EPGU_REQUESTS_WEEK_LOAD': {
            const sourceTab = sender && sender.tab ? sender.tab : null;
            const loadRequest = normalizeEpguRequestsWeekLoadRequest(request && request.data, sourceTab);
            if (!sourceTab || !Number.isInteger(sourceTab.id)) {
                sendResponse({ success: false, error: 'Не удалось определить исходную вкладку.' });
                return false;
            }
            if (!loadRequest) {
                sendResponse({ success: false, error: 'Некорректные параметры загрузки сводки ЕПГУ.' });
                return false;
            }

            (async () => {
                try {
                    const result = await collectEpguRequestsWeekRowsInTab(sourceTab.id, loadRequest);
                    sendResponse({
                        success: true,
                        rows: result.rows,
                        totalRecords: result.totalRecords
                    });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'Не удалось загрузить строки ЕПГУ.'
                    });
                }
            })();
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

        case 'EPGU_REGISTRY_CONDUCT_START': {
            const sourceTab = sender && sender.tab ? sender.tab : null;
            const conductRequest = normalizeEpguRegistryConductRequest(request && request.data);
            if (!sourceTab || !Number.isInteger(sourceTab.id)) {
                sendResponse({ success: false, error: 'Не удалось определить исходную вкладку.' });
                return false;
            }
            if (!conductRequest) {
                sendResponse({ success: false, error: 'Некорректные параметры проведения реестра.' });
                return false;
            }

            (async () => {
                try {
                    const result = await runEpguRegistryConduct(sourceTab, conductRequest);
                    sendResponse({
                        success: true,
                        registryId: result.registryId,
                        statusName: result.statusName,
                        message: result.message
                    });
                } catch (error) {
                    sendResponse({
                        success: false,
                        error: error && error.message ? error.message : 'Не удалось провести реестр.'
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
  const sourceWorkerPool = getReestrDzWssWorkerPool(tabId, false);
  reestrDzWssWorkerTabs.delete(tabId);
  reestrDzWssSourceCleanupPromises.delete(tabId);
  if (sourceWorkerPool) {
    for (const workerTabId of sourceWorkerPool.values()) {
      if (Number.isInteger(workerTabId)) removeTabAsync(workerTabId).catch(() => {});
    }
  }
  for (const [sourceTabId, workerPool] of reestrDzWssWorkerTabs.entries()) {
    for (const [workerKey, workerTabId] of workerPool.entries()) {
      if (workerTabId === tabId) workerPool.delete(workerKey);
    }
    if (!workerPool.size) reestrDzWssWorkerTabs.delete(sourceTabId);
  }
  const reviewSourceTabId = reestrDzWriteOffReviewSources.get(tabId);
  if (Number.isInteger(reviewSourceTabId)) {
    reestrDzWriteOffReviewSources.delete(tabId);
    const reviewSession = reestrDzWriteOffReviewSessions.get(reviewSourceTabId);
    if (reviewSession && reviewSession.status === 'reviewing') {
      reviewSession.status = 'cancelled';
      reviewSession.updatedAt = Date.now();
    }
  }
  const reviewSession = reestrDzWriteOffReviewSessions.get(tabId);
  if (reviewSession) {
    reestrDzWriteOffReviewSessions.delete(tabId);
    reestrDzWriteOffReviewSources.delete(reviewSession.reviewTabId);
    if (Number.isInteger(reviewSession.reviewTabId)) removeTabAsync(reviewSession.reviewTabId).catch(() => {});
  }
  sendStageCancelForClosedTab(tabId);
  clearStageRequestsForTab(tabId);
  delete stageDepartmentStates[tabId];
  broadcastStageDepartmentConflicts();

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
