(function () {
    'use strict';
    const PREFIX = 'fsspRegistrySearchTab:';
    const TTL = 12 * 60 * 60 * 1000;
    const CHUNK_SIZE = 256 * 1024;
    const PENDING = PREFIX + 'pending:';
    let database;
    function openDatabase() {
        if (!database) database = new Promise((resolve, reject) => {
            const request = indexedDB.open('dupFsspSearchResults', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('chunks');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => { database = null; reject(request.error); };
        });
        return database;
    }
    async function chunkOperation(method, key, value) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('chunks', method === 'get' ? 'readonly' : 'readwrite');
            const store = tx.objectStore('chunks');
            const request = method === 'put' ? store.put(value, key) : store[method](key);
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = tx.onerror = () => reject(tx.error || request.error || new Error('Не удалось сохранить результаты поиска.'));
        });
    }
    async function sweepChunks(tabId) {
        const sessions = await call('get', null);
        const live = new Set(Object.entries(sessions || {}).filter(([key, state]) =>
            key.startsWith(PREFIX) && state?.chunked && Date.now() - state.updatedAt <= TTL &&
            (tabId == null || ![PREFIX + tabId, PENDING + tabId].includes(key))
        ).map(([, state]) => state.id));
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('chunks', 'readwrite');
            const request = tx.objectStore('chunks').openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                if (!live.has(cursor.value.id)) cursor.delete();
                cursor.continue();
            };
            tx.oncomplete = resolve;
            tx.onabort = tx.onerror = () => reject(tx.error);
        });
    }
    // Serialize mutations, including cleanup, so a concurrent tab cannot lose its upload.
    let operations = Promise.resolve();
    const storage = () => chrome.storage && chrome.storage['session'];
    function call(method, value) {
        return new Promise((resolve, reject) => {
            if (!storage()) return reject(new Error('Временное хранилище сессии недоступно.'));
            storage()[method](value, (result) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(result);
            });
        });
    }
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (!['FSSP_SEARCH_SESSION_GET', 'FSSP_SEARCH_SESSION_SET', 'FSSP_SEARCH_SESSION_CLEAR',
            'FSSP_SEARCH_SESSION_BEGIN', 'FSSP_SEARCH_SESSION_PART', 'FSSP_SEARCH_SESSION_COMMIT',
            'FSSP_SEARCH_SESSION_READ_PART'].includes(message?.action)) return false;
        const tabId = sender.tab?.id;
        let allowed = false;
        try {
            const url = new URL(sender.url || sender.tab?.url);
            allowed = /^https?:$/.test(url.protocol) && /(^|\.)(pyramid\.vostok-electra\.ru|pyramid-vostok\.electra\.ru|pyramid\.nesko-nv\.ru)$/i.test(url.hostname);
        } catch (_) { /* Reject messages outside the extension's site scope. */ }
        if (!Number.isInteger(tabId) || !allowed) {
            respond({ success: false, error: 'Не удалось определить вкладку поиска.' });
            return false;
        }
        const key = PREFIX + tabId;
        const operation = operations.catch(() => {}).then(async () => {
            if (message.action === 'FSSP_SEARCH_SESSION_CLEAR') {
                await call('remove', key);
                await call('remove', PENDING + tabId);
                if (typeof indexedDB !== 'undefined') await sweepChunks(tabId);
                return { success: true };
            }
            if (message.action === 'FSSP_SEARCH_SESSION_BEGIN') {
                if (!Number.isInteger(message.count) || message.count < 1 || message.count > 4096) throw new Error('Некорректный размер снимка поиска.');
                const pending = { chunked: true, id: crypto.randomUUID(), count: message.count, next: 0, updatedAt: Date.now() };
                await call('set', { [PENDING + tabId]: pending });
                await sweepChunks();
                return { success: true, id: pending.id };
            }
            if (message.action === 'FSSP_SEARCH_SESSION_PART' || message.action === 'FSSP_SEARCH_SESSION_COMMIT') {
                const pending = (await call('get', PENDING + tabId))?.[PENDING + tabId];
                if (!pending || pending.id !== message.id) throw new Error('Снимок поиска больше не активен.');
                if (message.action === 'FSSP_SEARCH_SESSION_PART') {
                    if (message.index !== pending.next || pending.next >= pending.count || typeof message.data !== 'string' || message.data.length > CHUNK_SIZE) throw new Error('Некорректная часть результатов поиска.');
                    await chunkOperation('put', `${pending.id}:${message.index}`, { id: pending.id, data: message.data });
                    pending.next++;
                    pending.updatedAt = Date.now();
                    await call('set', { [PENDING + tabId]: pending });
                } else {
                    if (pending.next !== pending.count) throw new Error('Результаты поиска записаны не полностью.');
                    await call('set', { [key]: { chunked: true, id: pending.id, count: pending.count, updatedAt: Date.now() } });
                    await call('remove', PENDING + tabId);
                    await sweepChunks();
                }
                return { success: true };
            }
            if (message.action === 'FSSP_SEARCH_SESSION_SET') {
                const state = message.state;
                if (state?.version !== 1 || !Array.isArray(state.departments) || !Array.isArray(state.debtors)) throw new Error('Некорректное состояние поиска.');
                if (new TextEncoder().encode(JSON.stringify(state)).length > 8 * 1024 * 1024) throw new Error('Результат превышает объём временной сессии. Выгрузите накопленные результаты в Excel.');
                await call('set', { [key]: { ...state, updatedAt: Date.now() } });
                return { success: true };
            }
            const stored = (await call('get', key))?.[key];
            if (stored && Date.now() - stored.updatedAt > TTL) {
                await call('remove', key);
                if (typeof indexedDB !== 'undefined') await sweepChunks();
                return { success: true, state: null };
            }
            if (message.action === 'FSSP_SEARCH_SESSION_READ_PART') {
                if (!stored?.chunked || stored.id !== message.id || !Number.isInteger(message.index) || message.index < 0 || message.index >= stored.count) throw new Error('Снимок поиска изменился.');
                const chunk = await chunkOperation('get', `${stored.id}:${message.index}`);
                if (!chunk) throw new Error('Часть результатов поиска не найдена.');
                return { success: true, data: chunk.data };
            }
            return { success: true, state: stored || null };
        });
        operations = operation;
        operation.then(respond, (error) => respond({ success: false, error: error.message }));
        return true;
    });
    chrome.tabs.onRemoved.addListener((tabId) => {
        operations = operations.catch(() => {}).then(async () => {
            await call('remove', PREFIX + tabId);
            await call('remove', PENDING + tabId);
            if (typeof indexedDB !== 'undefined') await sweepChunks(tabId);
        });
    });
    if (typeof indexedDB !== 'undefined') operations = sweepChunks().catch(() => {});
})();
