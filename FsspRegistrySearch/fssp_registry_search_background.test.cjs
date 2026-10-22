const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function broker(options = {}) {
    const stored = options.stored || {};
    let listener, removed;
    const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } },
        tabs: { onRemoved: { addListener(fn) { removed = fn; } } },
        storage: { session: {
            get(key, cb) { cb(key === null ? { ...stored } : { [key]: stored[key] }); },
            set(values, cb) { Object.assign(stored, values); cb(); },
            remove(key, cb) { delete stored[key]; cb(); }
        } }
    };
    vm.runInNewContext(fs.readFileSync(`${__dirname}/fssp_registry_search_background.js`, 'utf8'), { chrome, URL, TextEncoder, Date,
        indexedDB: options.indexedDB, crypto: require('node:crypto').webcrypto });
    const sendMessage = (message, tabId = 1, url = 'https://kgn.pyramid.vostok-electra.ru/ovzid/fsspreestr') =>
        new Promise(resolve => listener(message, { url, tab: { id: tabId, url } }, resolve));
    return { stored, chrome, sendMessage, removed: id => removed(id), send: (action, tabId, state, url) => sendMessage({ action, state }, tabId, url) };
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
    await b.send('FSSP_SEARCH_SESSION_GET', 2);
    assert.equal(b.stored['fsspRegistrySearchTab:2'], undefined);
});

test('NESKO uses the same temporary search session', async () => {
    const b = broker();
    await b.send('FSSP_SEARCH_SESSION_SET', 1, state());
    const restored = await b.send('FSSP_SEARCH_SESSION_GET', 1, null, 'https://pyramid.nesko-nv.ru/ovzid/fsspreestr');
    assert.equal(restored.success, true);
    assert.equal(restored.state.status, 'navigating');
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

// Optional integration dependency lives outside the shipped extension.
// FSSP_TEST_IDB_MODULE must point to fake-indexeddb's package directory.
const idbModule = process.env.FSSP_TEST_IDB_MODULE;
test('large checkpoint round-trips above 64 MiB using bounded messages and survives worker restart', { skip: !idbModule }, async () => {
    const indexedDB = new (require(idbModule).IDBFactory)();
    let b = broker({ indexedDB });
    let maximumMessage = 0;
    const source = fs.readFileSync(`${__dirname}/fssp_registry_search.js`, 'utf8');
    const context = vm.createContext({ URL, Blob, TextEncoder, setTimeout,
        window: { location: { origin: 'https://example.test', pathname: '/ovzid/fsspreestr' } },
        document: { readyState: 'loading', addEventListener() {} },
        chrome: { runtime: { sendMessage(message, callback) {
            maximumMessage = Math.max(maximumMessage, Buffer.byteLength(JSON.stringify(message)));
            b.sendMessage(message).then(callback);
        } } }
    });
    vm.runInContext(source.replace('    function initialize() {', `
        globalThis.api = { saveRun, loadSavedRun, clearSavedRun, searchOutcome };
        function initialize() {`), context);
    const matches = new Map();
    const payload = 'x'.repeat(2200) + 'Должник';
    for (let i = 0; i < 33188; i++) matches.set(String(i), { registryId: String(i), sourceValues: { payload, Id: i } });
    assert.ok(matches.size * payload.length > 64 * 1024 * 1024);
    const run = { ...state(), status: 'running', departmentIndex: 0, completedDepartments: 1, completed: 271,
        checkedRegistries: new Set(['271']), registryDepartments: new Map(),
        debtors: [{ typeId: '1', values: {}, matches }] };
    await context.api.saveRun(run, 'navigating');
    assert.ok(maximumMessage < 2 * 1024 * 1024);
    assert.ok(Buffer.byteLength(JSON.stringify(b.stored)) < 1024);
    b = broker({ indexedDB, stored: b.stored });
    const restored = await context.api.loadSavedRun();
    assert.equal(restored.status, 'navigating');
    assert.equal(restored.debtors[0].matches.length, 33188);
    assert.equal(restored.debtors[0].matches.at(-1)[1].sourceValues.payload, payload);
    assert.equal(restored.completedDepartments, 1);
    assert.match(context.api.searchOutcome({ ...run, status: 'failed' }), /Результат частичный/);
    assert.match(context.api.searchOutcome({ ...run, status: 'complete' }), /Результат полный/);
    await context.api.clearSavedRun();
    assert.equal(await context.api.loadSavedRun(), null);
});

test('incomplete upload preserves committed snapshot; foreign, oversized and out-of-order chunks fail', { skip: !idbModule }, async () => {
    const indexedDB = new (require(idbModule).IDBFactory)();
    const b = broker({ indexedDB });
    const send = (suffix, data = {}, tab = 1) => b.sendMessage({ action: `FSSP_SEARCH_SESSION_${suffix}`, ...data }, tab);
    const first = await send('BEGIN', { count: 1 });
    await send('PART', { id: first.id, index: 0, data: 'first' });
    assert.equal((await send('COMMIT', { id: first.id })).success, true);
    const next = await send('BEGIN', { count: 2 });
    assert.equal((await send('PART', { id: next.id, index: 1, data: 'bad' })).success, false);
    assert.equal((await send('PART', { id: next.id, index: 0, data: 'x'.repeat(256 * 1024 + 1) })).success, false);
    assert.equal((await send('PART', { id: next.id, index: 0, data: 'foreign' }, 2)).success, false);
    await send('PART', { id: next.id, index: 0, data: 'new' });
    assert.equal((await send('COMMIT', { id: next.id })).success, false);
    assert.equal((await send('GET')).state.id, first.id);
    assert.equal((await send('READ_PART', { id: first.id, index: 0 })).data, 'first');
    await send('PART', { id: next.id, index: 1, data: 'last' });
    assert.equal((await send('COMMIT', { id: next.id })).success, true);
    assert.equal((await send('READ_PART', { id: first.id, index: 0 })).success, false);
    b.removed(1);
    assert.equal((await send('GET')).state, null);
    const readChunks = () => new Promise((resolve, reject) => {
        const request = indexedDB.open('dupFsspSearchResults', 1);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('chunks', 'readonly');
            const count = tx.objectStore('chunks').count();
            tx.oncomplete = () => { db.close(); resolve(count.result); };
            tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
    });
    assert.equal(await readChunks(), 0);
    const orphan = await send('BEGIN', { count: 1 });
    await send('PART', { id: orphan.id, index: 0, data: 'orphan' });
    const restarted = broker({ indexedDB }); // New browser session: no session pointers.
    await restarted.send('FSSP_SEARCH_SESSION_GET', 1);
    assert.equal(await readChunks(), 0);
});
