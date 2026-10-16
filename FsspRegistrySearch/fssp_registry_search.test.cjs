const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/fssp_registry_search.js`, 'utf8');
const context = vm.createContext({
    URL, Blob, TextEncoder, setTimeout,
    window: { location: { origin: 'https://example.test', pathname: '/ovzid/fsspreestr' } },
    document: { readyState: 'loading', addEventListener() {} }
});
vm.runInContext(source.replace('    function initialize() {', `
    globalThis.api = { REGISTRY_TYPES, FIELD_LABELS, debtorMatchesCell, registryMatchesType, searchGridState, readRegistryFilters, buildSearchWorkbook, registryFingerprint, serializeRun, inspectRegistry, buildMatchUrl };
    function initialize() {`), context);
const api = context.api;
const query = (typeId, values) => ({ typeId, values, fields: api.REGISTRY_TYPES.find(t => t.id === typeId).fields, matches: new Map() });

test('all observed payload fields are searchable, with registry column order preserved', () => {
    const end = 'Id StatusName RegNumIP FullName SummDebt Claimant BirthDay EDNumber DNumber DepartmentOSP EffectiveDate IssueDate StartDate EndDate Article Paragraph SubParagraph SpiShortName'.split(' ');
    for (const id of ['2', '3']) {
        const names = Array.from(query(id, {}).fields, f => f.field);
        assert.deepEqual(names.slice(0, end.length), end);
        for (const hidden of ['FSSPReestrId', 'EDocId', 'AddDate']) assert.ok(names.includes(hidden));
    }
    const start = query('1', {}).fields;
    assert.equal(start[3].field, 'StartDate');
    assert.equal(start.find(f => f.field === 'EDNumber').label, 'Номер дела');
    assert.ok(start.some(f => f.field === 'DNumber'));
    assert.ok(start.every(f => /[А-Яа-яЁё]/.test(f.label)));
});

test('criteria combine all columns, including amounts, hidden values and null', () => {
    const debtor = query('2', { FullName: 'иванов', SummDebt: '123', AddDate: '2026', EDocId: 'null' });
    assert.ok(api.debtorMatchesCell(debtor, { FullName: 'ИВАНОВ Иван', SummDebt: 123.45, AddDate: '16.10.2026', EDocId: null }));
    assert.equal(api.debtorMatchesCell(debtor, { FullName: 'Иванов', SummDebt: 999, AddDate: '2026' }), false);
    assert.equal(api.debtorMatchesCell(query('1', { SummDebt: '0' }), { SummDebt: 0 }), true);
});

test('registry types are isolated, unknown types never match', () => {
    assert.equal(api.registryMatchesType({ typeId: '2' }, '1'), false);
    assert.equal(api.registryMatchesType({ typeName: api.REGISTRY_TYPES[1].name }, '3'), true);
    assert.equal(api.registryMatchesType({ typeName: 'Неизвестный тип' }, '3'), false);
});

test('dialog filters replace page filters and restrict request to populated types', () => {
    const result = api.searchGridState({ url: '/data', postData: { filters: 'old', StatusName: 'old', searchString: 'old', department: 6 } }, {
        debtors: [query('1', {}), query('3', {})], filters: [{ field: 'StatusName', op: 'eq', data: 'Проведен' }]
    });
    const filters = JSON.parse(result.postData.filters);
    assert.equal(filters.groupOp, 'AND');
    assert.equal(filters.rules[0].data, 'Проведен');
    assert.deepEqual(filters.groups[0].rules.map(r => r.data), [api.REGISTRY_TYPES[2].name, api.REGISTRY_TYPES[1].name]);
    assert.equal(result.postData.StatusName, undefined);
    assert.equal(result.postData.searchString, undefined);
    assert.equal(result.postData.department, 6);
});

test('calendar ranges use the same date format as the page filter', () => {
    const start = { type: 'date', value: '2026-10-01', dataset: { registryFilter: 'CreateDate', operator: 'cn' } };
    const end = { value: '2026-10-16' };
    const modal = { querySelectorAll: () => [start], querySelector: () => end };
    assert.equal(api.readRegistryFilters(modal)[0].data, '01.10.2026-16.10.2026');
    start.value = '';
    assert.equal(api.readRegistryFilters(modal)[0].data, '16.10.2026-16.10.2026');
    end.value = '';
    assert.equal(api.readRegistryFilters(modal).length, 0);
});

test('Excel retains hidden and unknown data, Russian headers, text values and hyperlinks', async () => {
    const debtor = query('1', { EDocId: '00123' });
    debtor.matches.set('9:0', { registryId: '9', registryTypeName: api.REGISTRY_TYPES[2].name, rowId: '7', position: 0,
        sourceValues: { Id: 7, EDocId: '00123', AddDate: '16.10.2026', SummDebt: 0, Extra: false, Object: { a: 1 } } });
    const blob = api.buildSearchWorkbook([debtor, query('2', { FullName: 'Нет результата' })]);
    const bytes = Buffer.from(await blob.arrayBuffer());
    const xml = bytes.toString('utf8');
    for (const value of ['Идентификатор электронного документа', 'Дата добавления', 'Сумма долга', '00123', 'false', 'Нет результата', 'autoFilter', 'dup_fssp_match=7', 'Extra']) assert.ok(xml.includes(value), value);
    assert.ok(!xml.includes('>EDocId<'));
    assert.ok(!xml.includes('>AddDate<'));
    assert.ok(xml.includes('Идентификатор записи'));
});

test('multiple filter values use OR within each AND group', () => {
    const result = api.searchGridState({ postData: {} }, {
        debtors: [query('1', {})], filters: [
            { field: 'StatusName', op: 'eq', data: ['Проведен', 'Не проведен'] },
            { field: 'ClaimantInn', op: 'eq', data: ['111', '222'] },
            { field: 'Id', op: 'cn', data: '123' }
        ]
    });
    const filters = JSON.parse(result.postData.filters);
    assert.equal(filters.rules.length, 1);
    assert.equal(filters.groups.length, 3);
    assert.deepEqual(filters.groups[0].rules.map(r => r.data), ['Проведен', 'Не проведен']);
    assert.equal(filters.groups[1].groupOp, 'OR');
});

test('fingerprints distinguish changed metadata and independent databases', () => {
    const registry = { registryId: '42', fileName: 'a.xml', lastProcessing: '16.10.2026' };
    const key = api.registryFingerprint(registry, 'https://kgn.pyramid.vostok-electra.ru');
    assert.notEqual(key, api.registryFingerprint(registry, 'https://pyramid.vostok-electra.ru'));
    assert.notEqual(key, api.registryFingerprint({ ...registry, fileName: 'b.xml' }, 'https://kgn.pyramid.vostok-electra.ru'));
    assert.notEqual(key, api.registryFingerprint({ ...registry, lastProcessing: '' }, 'https://kgn.pyramid.vostok-electra.ru'));
});

test('only successfully read registries are remembered and skipped on the next department', async () => {
    let calls = 0;
    context.fetch = async () => { calls++; return { ok: true, text: async () => JSON.stringify({ total: 1, records: 1, rows: [{ id: 1, cell: { FullName: 'Другой должник' } }] }) }; };
    const registry = { registryId: '42', typeId: '1', fileName: 'file.xml', lastProcessing: 'today' };
    const run = { debtors: [query('1', { FullName: 'Искомый' })], checkedRegistries: new Set(), skipped: 0, controller: new AbortController(), departments: [{}], departmentIndex: 0 };
    await api.inspectRegistry(registry, run, null);
    await api.inspectRegistry(registry, run, null);
    assert.equal(calls, 1);
    assert.equal(run.skipped, 1);
    context.fetch = async () => { throw new Error('network failure'); };
    const changed = { ...registry, lastProcessing: 'tomorrow' };
    await assert.rejects(api.inspectRegistry(changed, run, null), /network failure/);
    assert.equal(run.checkedRegistries.has(api.registryFingerprint(changed)), false);
});

test('checkpoint converts result Maps and registry Sets to portable JSON', () => {
    const debtor = query('1', { EDNumber: '123' });
    debtor.matches.set('base:42:0', { registryId: '42', baseOrigin: 'https://kgn.pyramid.vostok-electra.ru' });
    const result = JSON.parse(JSON.stringify(api.serializeRun({ status: 'running', departments: [{ active: true, key: 'base|39', depid: '39' }], departmentIndex: 0,
        debtors: [debtor], filters: [], checkedRegistries: new Set(['seen']), completed: 1, skipped: 0, errorCount: 0 }, 'navigating')));
    assert.equal(result.status, 'navigating');
    assert.deepEqual(result.checkedRegistries, ['seen']);
    assert.equal(result.debtors[0].matches[0][1].registryId, '42');
    assert.equal(result.departments[0].active, undefined);
    assert.equal(result.debtors[0].row, undefined);
});

test('cross-base result links enter the list and preserve target department and row', () => {
    const link = new URL(api.buildMatchUrl('42', { baseOrigin: 'https://kgn.pyramid.vostok-electra.ru', department: { depid: '39' }, rowId: '7', position: 2, totalRows: 100 }));
    assert.equal(link.origin, 'https://example.test');
    assert.equal(link.searchParams.get('dup_fssp_base'), 'https://kgn.pyramid.vostok-electra.ru');
    assert.equal(link.pathname, '/ovzid/fsspreestr');
    assert.equal(link.searchParams.get('dup_fssp_open'), '42');
    assert.equal(link.searchParams.get('dup_fssp_dep'), '39');
    assert.equal(link.searchParams.get('dup_fssp_match'), '7');
    assert.equal(link.searchParams.get('token'), null);
});
