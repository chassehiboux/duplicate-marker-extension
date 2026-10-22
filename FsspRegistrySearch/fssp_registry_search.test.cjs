const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/fssp_registry_search.js`, 'utf8');
const context = vm.createContext({
    URL, Blob, TextEncoder, setTimeout, clearTimeout, AbortController, DOMException, HTMLElement: class {},
    window: { location: { origin: 'https://example.test', pathname: '/ovzid/fsspreestr' } },
    document: { readyState: 'loading', addEventListener() {} }
});
vm.runInContext(source.replace('    function initialize() {', `
    globalThis.resultPage = resultPage;
    globalThis.fetchJson = fetchJson;
    globalThis.waitForRetry = waitForRetry;
    globalThis.renderSearchResults = renderSearchResults;
    globalThis.api = { scrollLocalBlock, REGISTRY_TYPES, FIELD_LABELS, debtorMatchesCell, registryMatchesType, searchGridState, readRegistryFilters, buildSearchWorkbook, registryFingerprint, serializeRun, inspectRegistry, buildMatchUrl, baseLabel, matchDepartments, registryMatchesFilters };
    function initialize() {`), context);
const api = context.api;
const query = (typeId, values) => ({ typeId, values, fields: api.REGISTRY_TYPES.find(t => t.id === typeId).fields, matches: new Map() });

test('21469 results create no closed-group rows and at most 100 open-group rows', () => {
    class Element extends context.HTMLElement {
        constructor(tag) { super(); this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.listeners = {}; }
        appendChild(child) { this.children.push(child); return child; }
        replaceChildren(...children) { this.children = children; }
        setAttribute() {}
        addEventListener(type, callback) { this.listeners[type] = callback; }
        set innerHTML(_) { this.children = [new Element('tbody')]; }
        querySelector(selector) {
            const matches = node => selector.startsWith('.') ? node.className === selector.slice(1)
                : selector.startsWith('[data-delta=') ? node.dataset.delta === selector.match(/"([^"]+)"/)[1]
                : node.tag === selector;
            for (const child of this.children) {
                if (matches(child)) return child;
                const found = child.querySelector(selector);
                if (found) return found;
            }
            return null;
        }
    }
    const originalCreate = context.document.createElement;
    context.document.createElement = tag => new Element(tag);
    try {
        const debtor = query('2', { FullName: 'Иванов' });
        for (let i = 1; i <= 21469; i++) debtor.matches.set(String(i), { registryId: String(i), values: {} });
        const modal = new Element('div');
        for (const name of ['results-wrap', 'results-count', 'export']) {
            const element = new Element('div');
            element.className = `dup-fssp-registry-search-${name}`;
            modal.appendChild(element);
        }
        context.renderSearchResults(modal, [debtor]);
        const group = modal.children[0].children[0];
        const tbody = group.querySelector('tbody');
        assert.equal(tbody.children.length, 0);
        group.open = true;
        group.listeners.toggle();
        assert.equal(tbody.children.length, 100);
        assert.equal(tbody.children[0].children[0].textContent, '1');
        group.querySelector('[data-delta="1"]').listeners.click();
        assert.equal(tbody.children.length, 100);
        assert.equal(tbody.children[0].children[0].textContent, '101');
        group.dataset.page = '214';
        context.renderSearchResults(modal, [debtor]);
        assert.equal(tbody.children.length, 69);
        assert.equal(group.querySelector('[data-delta="1"]').disabled, true);
        assert.equal(tbody.children[68].children[0].textContent, '21469');
        assert.equal(context.resultPage(debtor, 999).current, 214);
        assert.equal(debtor.matches.size, 21469);
        group.open = false;
        group.listeners.toggle();
        assert.equal(tbody.children.length, 0);
    } finally { context.document.createElement = originalCreate; }
});

test('date criteria include both boundaries and ignore time in all agreed columns', () => {
    for (const type of api.REGISTRY_TYPES) {
        for (const field of ['BirthDay', 'EffectiveDate', 'IssueDate', 'StartDate', 'EndDate', 'AddDate']) {
            if (!type.fields.some(f => f.field === field)) continue;
            const matches = (q, value) => api.debtorMatchesCell(query(type.id, { [field]: q }), { [field]: value });
            for (const value of ['01.01.2026', '21.10.2026 23:59:59']) assert.ok(matches('01.01.2026 - 21.10.2026', value));
            assert.equal(matches('01.01.2026-21.10.2026', '22.10.2026'), false);
            assert.ok(matches('*21.10.2026', '21.10.2026 23:59:59'));
            assert.equal(matches('*21.10.2026', '22.10.2026'), false);
            assert.ok(matches('21.10.2026*', '21.10.2026'));
            assert.equal(matches('21.10.2026*', '20.10.2026'), false);
            assert.ok(matches('21.10.2026', '21.10.2026 12:00:00'));
            assert.equal(matches('21.10.2026', '20.10.2026'), false);
            for (const value of ['', null, '31.02.2026']) assert.equal(matches('*21.10.2026', value), false);
            assert.equal(matches('31.02.2026*', '01.03.2026'), false);
            assert.equal(matches('21.10.2026-01.01.2026', '20.10.2026'), false);
            assert.ok(matches('29.02.2024', '29.02.2024'));
            assert.ok(matches('null', null));
            assert.ok(matches('2026', '21.10.2026'));
        }
    }
});

test('wheel over a wide result table scrolls results vertically and falls back to dialog body', () => {
    const results = { scrollHeight: 800, clientHeight: 200, scrollTop: 0, scrollLeft: 0 };
    const body = { scrollTop: 0, clientHeight: 600 };
    const block = { closest: selector => selector.endsWith('results-wrap') ? results : selector.endsWith('search-body') ? body : {} };
    const event = { target: { closest: () => block }, deltaY: 50, deltaX: 0, deltaMode: 0, shiftKey: false,
        preventDefault() {}, stopPropagation() {} };
    api.scrollLocalBlock(event);
    assert.equal(results.scrollTop, 50);
    assert.equal(results.scrollLeft, 0);
    results.scrollHeight = 200;
    api.scrollLocalBlock(event);
    assert.equal(body.scrollTop, 50);
});

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
    assert.ok(start.every(f => f.field === 'EDocId' ? f.label === 'EdocID' : /[А-Яа-яЁё]/.test(f.label)));
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
    assert.equal(filters.groups, undefined);
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
    for (const value of ['EdocID', 'Дата добавления', 'Сумма долга', '00123', 'false', 'Нет результата', 'autoFilter', 'dup_fssp_match=7', 'Extra']) assert.ok(xml.includes(value), value);
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
    assert.equal(filters.rules.length, 2);
    assert.equal(filters.groups, undefined);
    const rules = [{field:'StatusName',op:'eq',data:['Проведен','Не проведен']},{field:'ClaimantInn',op:'eq',data:['111','222']}];
    assert.ok(api.registryMatchesFilters({StatusName:'Проведен',ClaimantInn:'222'},rules));
    assert.equal(api.registryMatchesFilters({StatusName:'Отменён',ClaimantInn:'222'},rules),false);
    assert.equal(api.registryMatchesFilters({StatusName:'Проведен',ClaimantInn:'333'},rules),false);
});

test('creation date and selected employee are both required, even if server ignores filters', () => {
    const filters = [{field:'CreateDate',op:'cn',data:'16.10.2026-16.10.2026'},{field:'EmployeeFullName',op:'eq',data:['Золотова Екатерина Игоревна']}];
    const good = {CreateDate:'16.10.2026',EmployeeFullName:'Золотова Екатерина Игоревна'};
    assert.ok(api.registryMatchesFilters(good,filters));
    assert.equal(api.registryMatchesFilters({...good,CreateDate:'15.10.2026'},filters),false);
    assert.equal(api.registryMatchesFilters({...good,EmployeeFullName:'Другой пользователь'},filters),false);
    assert.equal(api.registryMatchesFilters({...good,CreateDate:''},filters),false);
    const request = JSON.parse(api.searchGridState({postData:{}},{debtors:[query('1',{}),query('2',{}),query('3',{})],filters}).postData.filters);
    assert.equal(request.rules.length,2);
    assert.equal(request.rules[1].data,'Золотова Екатерина Игоревна');
    assert.equal(request.groups,undefined);
    assert.ok(api.registryMatchesFilters({LastProcessing:'16.10.2026 12:30:00'},[{field:'LastProcessing',data:'15.10.2026-17.10.2026'}]));
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
    context.fetch = async () => ({ ok: false, status: 403, text: async () => '' });
    const changed = { ...registry, lastProcessing: 'tomorrow' };
    await assert.rejects(api.inspectRegistry(changed, run, null), /HTTP 403/);
    assert.equal(run.checkedRegistries.has(api.registryFingerprint(changed)), false);
});

test('network failures and server overload retry the same request beyond two attempts', async () => {
    const urls = [];
    const originalTimer = context.setTimeout;
    context.setTimeout = (fn, delay) => setTimeout(fn, delay === 45000 ? delay : 0);
    try {
        context.fetch = async url => {
            urls.push(url);
            if (urls.length === 1) throw new TypeError('Failed to fetch');
            if (urls.length === 2) return { ok: false, status: 503, text: async () => '' };
            if (urls.length === 3) return { ok: false, status: 429, text: async () => '' };
            return { ok: true, text: async () => '{"rows":[{"id":42}]}' };
        };
        const result = await context.fetchJson(new URL('https://example.test/registry'), new AbortController().signal);
        assert.equal(urls.length, 4);
        assert.equal(new Set(urls).size, 1);
        assert.equal(result.rows[0].id, 42);
        context.fetch = async () => ({ ok: false, status: 401, text: async () => '' });
        await assert.rejects(context.fetchJson(new URL('https://example.test/registry'), new AbortController().signal), /HTTP 401/);
    } finally { context.setTimeout = originalTimer; }
});

test('cancel interrupts retry backoff immediately', async () => {
    const controller = new AbortController();
    const waiting = context.waitForRetry(30000, controller.signal);
    controller.abort();
    await assert.rejects(waiting, error => error.name === 'AbortError');
});

test('a hung request times out and is retried without losing its URL', async () => {
    const originalTimer = context.setTimeout;
    let calls = 0;
    context.setTimeout = fn => setTimeout(fn, 1);
    context.fetch = async (url, options) => {
        calls++;
        if (calls === 1) return new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
        return { ok: true, text: async () => '{"records":1}' };
    };
    try {
        const result = await context.fetchJson(new URL('https://example.test/registry'), new AbortController().signal);
        assert.equal(result.records, 1);
        assert.equal(calls, 2);
    } finally { context.setTimeout = originalTimer; }
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

test('registry 22165 accumulates all departments across checkpoints without reading contents again', async () => {
    let requests = 0;
    context.fetch = async () => { requests++; return { ok: true, text: async () => JSON.stringify({ total: 1, records: 1, rows: [{ id: 5, cell: { FullName: 'Искомый' } }] }) }; };
    const departments = ['Курган', 'Курган-Восточный', 'Шадринск'].map((label, index) => ({ label, depid: ['39', '43', '40'][index], origin: 'https://example.test', key: 'https://example.test|' + ['39', '43', '40'][index] }));
    const registry = { registryId: '22165', typeId: '1', fileName: 'file.xml', lastProcessing: '16.10.2026' };
    const modal = { querySelector: () => null };
    let run = { status: 'running', debtors: [query('1', { FullName: 'Искомый' })], filters: [], checkedRegistries: new Set(), skipped: 0, controller: new AbortController(), departments, departmentIndex: 0 };
    await api.inspectRegistry(registry, run, modal);
    const saved = JSON.parse(JSON.stringify(api.serializeRun(run)));
    run = { ...saved, checkedRegistries: new Set(saved.checkedRegistries), registryDepartments: new Map(saved.registryDepartments), controller: new AbortController(), debtors: saved.debtors.map(d => ({ ...query(d.typeId, d.values), matches: new Map(d.matches) })) };
    for (const index of [1, 2, 2]) { run.departmentIndex = index; await api.inspectRegistry(registry, run, modal); }
    assert.equal(requests, 1);
    assert.equal(run.debtors[0].matches.size, 1);
    const match = [...run.debtors[0].matches.values()][0];
    assert.deepEqual(Array.from(match.departments, d => d.label), ['Курган', 'Курган-Восточный', 'Шадринск']);
    assert.equal(run.debtors[0].metadataRevision, 2);
    const xml = Buffer.from(await api.buildSearchWorkbook(run.debtors).arrayBuffer()).toString('utf8');
    assert.ok(xml.includes('Курган (depid 39); Курган-Восточный (depid 43); Шадринск (depid 40)'));
    assert.ok(xml.includes('Департаменты'));
});

test('database display labels and EdocID spelling match the requested names', async () => {
    const labels = { 'kgn.pyramid.vostok-electra.ru': 'Курган', 'pyramid.vostok-electra.ru': 'Основная', 'yuric.pyramid.vostok-electra.ru': 'ЮРИЦ', '81.pyramid.vostok-electra.ru': 'ЧЭС', 'pyramid.nesko-nv.ru': 'НЭСКО' };
    for (const [host, label] of Object.entries(labels)) assert.equal(api.baseLabel('https://' + host), label);
    assert.equal(api.baseLabel('https://other.test'), 'other.test');
    const debtor = query('1', { EDocId: '123' });
    debtor.matches.set('1', { registryId: '22165', baseOrigin: 'https://pyramid.nesko-nv.ru', rowId: '5', sourceValues: { EDocId: '123' } });
    const xml = Buffer.from(await api.buildSearchWorkbook([debtor]).arrayBuffer()).toString('utf8');
    assert.ok(xml.includes('>НЭСКО<'));
    assert.ok(xml.includes('>EdocID<'));
    assert.ok(!xml.includes('Идентификатор электронного документа'));
});
