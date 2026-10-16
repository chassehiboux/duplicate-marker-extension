(function () {
    'use strict';
    const PREFIX = 'fsspRegistrySearchTab:';
    const TTL = 12 * 60 * 60 * 1000;
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
        if (!['FSSP_SEARCH_SESSION_GET', 'FSSP_SEARCH_SESSION_SET', 'FSSP_SEARCH_SESSION_CLEAR'].includes(message?.action)) return false;
        const tabId = sender.tab?.id;
        let allowed = false;
        try {
            const url = new URL(sender.url || sender.tab?.url);
            allowed = /^https?:$/.test(url.protocol) && /(^|\.)(pyramid\.vostok-electra\.ru|pyramid-vostok\.electra\.ru)$/i.test(url.hostname);
        } catch (_) { /* Reject messages outside the extension's site scope. */ }
        if (!Number.isInteger(tabId) || !allowed) {
            respond({ success: false, error: 'Не удалось определить вкладку поиска.' });
            return false;
        }
        const key = PREFIX + tabId;
        (async () => {
            if (message.action === 'FSSP_SEARCH_SESSION_CLEAR') {
                await call('remove', key);
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
                return { success: true, state: null };
            }
            return { success: true, state: stored || null };
        })().then(respond, (error) => respond({ success: false, error: error.message }));
        return true;
    });
    chrome.tabs.onRemoved.addListener((tabId) => { void call('remove', PREFIX + tabId).catch(() => {}); });
})();
