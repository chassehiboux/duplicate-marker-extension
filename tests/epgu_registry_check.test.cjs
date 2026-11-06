const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const background = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
const content = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
function section(text, start, end) { return text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start))); }
async function scan(reply, cache, progress) {
  const context = vm.createContext({ URL, window: { location: { hostname: 'example.test', origin: 'https://example.test' } },
    fetch: async (url) => { const data = await reply(new URL(url)); return { ok: true, text: async () => JSON.stringify(data), json: async () => data }; },
    executeScriptInTabAsync: async (_id, fn, args) => fn(...args) });
  vm.runInContext(section(background, 'async function collectEpguRegistryRowsInTab(', 'async function verifyEpguRegistryDepartmentInTab('), context);
  return context.collectEpguRegistryRowsInTab(1, { baseHost: 'example.test', checkDate: '03-11-2026' }, cache, progress);
}
test('reuses detail result across departments but reads each department list and reports progress', async () => {
  let lists = 0, details = 0;
  const reply = url => {
    if (url.pathname.endsWith('/data')) { lists++; return list(); }
    details++;
    return { total: 1, records: 1, rows: [{ cell: { StatusName: 'Неизвестно' } }] };
  };
  const cache = new Map(), progress = [];
  await scan(reply, cache);
  const rows = await scan(reply, cache, async counts => progress.push(counts));
  assert.equal(lists, 2);
  assert.equal(details, 1);
  assert.equal(rows[0].hasUnknown, true);
  assert.deepEqual(progress.map(p => [p.registryCurrent, p.registryTotal, p.registryReused]), [[0, 1, 0], [1, 1, 1]]);
  await scan(reply);
  assert.equal(details, 2, 'new scan must read fresh details');
});
function list() { return { total: 1, records: 1, rows: [{ cell: { Id: 1, CreateDate: '03-11-2026', StatusName: 'Проведен' } }] }; }
test('limits parallel readers to four and shares simultaneous duplicate IDs', async () => {
  let active = 0, peak = 0, calls = 0;
  const counts = [];
  await scan(async url => {
    if (url.pathname.endsWith('/data')) return { total: 1, records: 7,
      rows: [1, 1, 2, 3, 4, 5, 6].map(Id => ({ cell: { Id, CreateDate: '03-11-2026' } })) };
    assert.equal(url.searchParams.get('rows'), '2000');
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { total: 0, records: 0, rows: [] };
  }, new Map(), async p => counts.push(p.registryCurrent));
  assert.ok(peak > 1 && peak <= 4);
  assert.equal(calls, 6);
  assert.deepEqual(counts, [0, 1, 2, 3, 4, 5, 6, 7]);
});
test('reads later detail pages and normalizes both problem statuses', async () => {
  const rows = await scan(url => url.pathname.endsWith('/data') ? list() : {
    total: 2, records: 2, rows: [{ cell: { StatusName: url.searchParams.get('page') === '1' ? ' Неизвестно ' : 'Поиск дела произведён' } }]
  });
  assert.equal(rows[0].hasUnknown, true);
  assert.equal(rows[0].hasCaseSearch, true);
  assert.equal(rows[0].statusName, 'Проведен');
});
test('rejects partial detail results and malformed responses', async () => {
  await assert.rejects(scan(url => url.pathname.endsWith('/data') ? list() : { total: 1, records: 2, rows: [] }), /INCOMPLETE_DETAIL_ROWS/);
  await assert.rejects(scan(url => url.pathname.endsWith('/data') ? list() : {}), /INVALID_DETAIL_DATA/);
  await assert.rejects(scan(() => ({ total: 1, records: 2, rows: [] })), /INCOMPLETE_REGISTRY_ROWS/);
});
test('accepts empty registries', async () => {
  const rows = await scan(url => url.pathname.endsWith('/data') ? list() : { total: 0, records: 0, rows: [] });
  assert.equal(rows[0].hasUnknown, false);
});
const context = vm.createContext({ EPGU_REQUESTS_COLOR_RED: 'red', EPGU_REQUESTS_COLOR_YELLOW: 'yellow', EPGU_REQUESTS_COLOR_GREEN: 'green',
  normalizeEpguRegistryStatusKey: value => String(value).toLowerCase() });
vm.runInContext(section(content, '  function resolveEpguRegistrySummaryMeta(', '  function formatEpguRegistryCount(') +
  section(content, '  function getEpguRegistryDepartmentsForRecheck(', '  function mergeEpguRegistryScanRows('), context);
test('red wins over unknown, yellow for unknown alone, green for clean registries', () => {
  const resolve = rows => context.resolveEpguRegistrySummaryMeta(rows, true);
  assert.equal(resolve([{ hasUnknown: true }]).color, 'yellow');
  assert.equal(resolve([{ hasUnknown: true, hasCaseSearch: true }]).color, 'red');
  assert.equal(resolve([{ statusNames: ['Проведен'] }]).color, 'green');
});
test('always rechecks previously positive departments', () => {
  const departments = [{ depid: '1' }, { depid: '2' }];
  assert.deepEqual(Array.from(context.getEpguRegistryDepartmentsForRecheck({ departments })), departments);
});
