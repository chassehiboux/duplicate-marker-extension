const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(options = {}) {
  let listener;
  let sourceReads = 0;
  let scans = 0;
  let stored = options.cache || {};
  let syncWrites = 0;
  const created = [];
  const removed = [];
  const data = { edocId: '28055705', debtId: '7499025', statusId: '100999' };
  const sender = { url: 'https://kgn.pyramid.vostok-electra.ru/ovzid/fullcard/28055705', frameId: 4,
    tab: { id: 8, windowId: 3, cookieStoreId: 'firefox-container-2' } };
  const chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: {
      get(key, cb) { cb({ [key]: structuredClone(stored) }); },
      set(value, cb) { stored = value.dup_status_names_cache_v1; cb(); }
    } },
    tabs: {
      create(props, cb) { created.push(props); cb({ id: 20 }); },
      get(id, cb) { cb({ id, status: 'complete' }); },
      remove(id, cb) { removed.push(id); cb(); }
    },
    scripting: { executeScript(args, cb) {
      if (args.func.name === 'scanGlobalSearch') {
        scans++;
        assert.equal(args.world, 'MAIN');
        assert.deepEqual(Array.from(args.args.slice(0, 3)), [data.debtId, data.edocId, data.statusId]);
        if (options.scanError) {
          chrome.runtime.lastError = { message: options.scanError };
          cb(); delete chrome.runtime.lastError;
        } else cb([{ result: 'Склад (иски)' }]);
      } else {
        sourceReads++;
        assert.deepEqual(Array.from(args.target.frameIds), [4]);
        cb([{ result: options.changed && sourceReads > 1 ? { ...data, statusId: '100057' } : data }]);
      }
    } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'status_lookup_background.js'), 'utf8'),
    { chrome, URL, console, setTimeout, Promise, __dupSupabaseSync: { async syncSet(values, opts) {
      assert.equal(opts.reason, 'status-name-discovered');
      syncWrites++;
      stored = values.dup_status_names_cache_v1;
    } } });
  const request = (override = {}, source = sender) => new Promise((resolve) => {
    listener({ action: 'ID_CARD_LOOKUP_STATUS_NAME', data: { ...data, ...override } }, source, resolve);
  });
  return { request, created, removed, get stored() { return stored; }, get scans() { return scans; }, get syncWrites() { return syncWrites; } };
}

test('unknown code uses inactive tab in same container, saves name and reuses cache', async () => {
  const worker = setup({ cache: { 'pyramid.vostok-electra.ru': { 77: 'Другой статус' } } });
  assert.equal((await worker.request()).statusName, 'Склад (иски)');
  assert.equal(worker.created.length, 1);
  assert.equal(worker.syncWrites, 1);
  assert.equal(worker.created[0].active, false);
  assert.equal(worker.created[0].cookieStoreId, 'firefox-container-2');
  assert.equal(worker.created[0].windowId, 3);
  assert.deepEqual(worker.removed, [20]);
  assert.equal(worker.stored['kgn.pyramid.vostok-electra.ru']['100999'], 'Склад (иски)');
  assert.equal(worker.stored['pyramid.vostok-electra.ru']['77'], 'Другой статус');
  assert.equal((await worker.request()).success, true);
  assert.equal(worker.created.length, 1);
});

test('concurrent requests for one status share one lookup', async () => {
  const worker = setup();
  const results = await Promise.all([worker.request(), worker.request()]);
  assert.ok(results.every(result => result.success));
  assert.equal(worker.scans, 1);
  assert.equal(worker.created.length, 1);
});

test('lookup failure/timeout closes worker tab and does not save a false mapping', async () => {
  const worker = setup({ scanError: 'Истекло время поиска' });
  const result = await worker.request();
  assert.equal(result.success, false);
  assert.match(result.error, /Истекло время/);
  assert.deepEqual(worker.removed, [20]);
  assert.deepEqual(worker.stored, {});
  await worker.request();
  assert.equal(worker.created.length, 2);
});

test('changed source StatusID prevents saving and still closes worker', async () => {
  const worker = setup({ changed: true });
  assert.equal((await worker.request()).success, false);
  assert.deepEqual(worker.stored, {});
  assert.deepEqual(worker.removed, [20]);
});

test('wrong EdocID/source or invalid identifiers cannot start worker', async () => {
  const worker = setup();
  assert.equal((await worker.request({ edocId: '999' })).success, false);
  assert.equal((await worker.request({ debtId: '7499025 OR 1' })).success, false);
  assert.equal(worker.created.length, 0);
});
