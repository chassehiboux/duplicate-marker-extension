const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const background = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
const content = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
function section(text, start, end) { return text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start))); }
async function scan(reply) {
  const context = vm.createContext({ URL, window: { location: { hostname: 'example.test', origin: 'https://example.test' } },
    fetch: async (url) => ({ ok: true, text: async () => JSON.stringify(reply(new URL(url))), json: async () => reply(new URL(url)) }),
    executeScriptInTabAsync: async (_id, fn, args) => fn(...args) });
  vm.runInContext(section(background, 'async function collectEpguRegistryRowsInTab(', 'async function verifyEpguRegistryDepartmentInTab('), context);
  return context.collectEpguRegistryRowsInTab(1, { baseHost: 'example.test', checkDate: '03-11-2026' });
}
function list() { return { total: 1, records: 1, rows: [{ cell: { Id: 1, CreateDate: '03-11-2026', StatusName: 'Проведен' } }] }; }
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
