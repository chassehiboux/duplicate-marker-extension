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
    globalThis.api = { REGISTRY_TYPES, FIELD_LABELS, debtorMatchesCell, registryMatchesType, searchGridState, readRegistryFilters, buildSearchWorkbook };
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
