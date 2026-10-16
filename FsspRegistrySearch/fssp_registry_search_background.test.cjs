const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function broker() {
    const stored = {};
    let listener, removed;
    const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } },
        tabs: { onRemoved: { addListener(fn) { removed = fn; } } },
        storage: { session: {
            get(key, cb) { cb({ [key]: stored[key] }); },
            set(values, cb) { Object.assign(stored, values); cb(); },
            remove(key, cb) { delete stored[key]; cb(); }
        } }
    };
    vm.runInNewContext(fs.readFileSync(`${__dirname}/fssp_registry_search_background.js`, 'utf8'), { chrome, URL, TextEncoder, Date });
    return { stored, chrome, removed: id => removed(id), send: (action, tabId, state, url = 'https://kgn.pyramid.vostok-electra.ru/ovzid/fsspreestr') =>
        new Promise(resolve => listener({ action, state }, { url, tab: { id: tabId, url } }, resolve)) };
}
const state = () => ({ version: 1, status: 'navigating', departments: [{ depid: '39' }], debtors: [] });

test('session survives switching database but is isolated by tab', async () => {
    const b = broker();
    assert.ok((await b.send('FSSP_SEARCH_SESSION_SET', 1, state())).success);
    assert.equal((await b.send('FSSP_SEARCH_SESSION_GET', 2)).state, null);
    const restored = await b.send('FSSP_SEARCH_SESSION_GET', 1, null, 'https://pyramid.vostok-electra.ru/ovzid/fsspreestr');
    assert.equal(restored.state.status, 'navigating');
    await b.send('FSSP_SEARCH_SESSION_CLEAR', 1);
    assert.equal((await b.send('FSSP_SEARCH_SESSION_GET', 1)).state, null);
});

test('expired sessions and closed tabs are cleaned up', async () => {
    const b = broker();
    await b.send('FSSP_SEARCH_SESSION_SET', 1, state());
    b.stored['fsspRegistrySearchTab:1'].updatedAt = Date.now() - 13 * 60 * 60 * 1000;
    assert.equal((await b.send('FSSP_SEARCH_SESSION_GET', 1)).state, null);
    await b.send('FSSP_SEARCH_SESSION_SET', 2, state());
    b.removed(2);
    assert.equal(b.stored['fsspRegistrySearchTab:2'], undefined);
});

test('untrusted sites, malformed snapshots and unavailable session storage fail explicitly', async () => {
    const b = broker();
    assert.equal((await b.send('FSSP_SEARCH_SESSION_SET', 1, state(), 'https://evil.test')).success, false);
    assert.equal((await b.send('FSSP_SEARCH_SESSION_SET', 1, {})).success, false);
    delete b.chrome.storage.session;
    const result = await b.send('FSSP_SEARCH_SESSION_GET', 1);
    assert.equal(result.success, false);
    assert.match(result.error, /хранилище/);
});
