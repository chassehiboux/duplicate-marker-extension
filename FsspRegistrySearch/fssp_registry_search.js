(function() {
    'use strict';

    const LIST_PATH = '/ovzid/fsspreestr';
    const DETAIL_PATH_PATTERN = /^\/ovzid\/fsspreestr\/(\d+)\/?$/i;
    const BUTTON_ID = 'dup-fssp-registry-search-button';
    const MODAL_ID = 'dup-fssp-registry-search-modal';
    const STYLE_ID = 'dup-fssp-registry-search-style';
    const UI_CLASS = 'dup-fssp-registry-search-ui';
    const ROW_CLASS = 'dup-fssp-registry-search-row';
    const HIGHLIGHT_CLASS = 'dup-fssp-registry-search-match';
    const GRID_STATE_ACTION = 'FSSP_REGISTRY_SEARCH_GET_GRID_STATE';
    const LIST_PAGE_SIZE = 300;
    const DETAIL_PAGE_SIZE = 2000;
    const REQUEST_CONCURRENCY = 4;
    const RESULT_PAGE_SIZE = 100;

    function resultPage(debtor, page) {
        const pageCount = Math.max(1, Math.ceil(debtor.matches.size / RESULT_PAGE_SIZE));
        const current = Math.max(0, Math.min(page || 0, pageCount - 1));
        const start = current * RESULT_PAGE_SIZE;
        return { current, pageCount, start, matches: sortedMatches(debtor).slice(start, start + RESULT_PAGE_SIZE) };
    }
    const FIELD_LABELS = Object.freeze({
        Id: 'Идентификатор записи', StatusName: 'Статус', RegNumIP: 'Регистрационный номер ИП',
        FullName: 'Должник', SummDebt: 'Сумма долга', Claimant: 'Взыскатель', BirthDay: 'Д.р. должника',
        EDNumber: 'Номер ИД', DNumber: 'Номер дела', DepartmentOSP: 'ОСП',
        EffectiveDate: 'Дата вступления решения', IssueDate: 'Дата выдачи ИД', StartDate: 'Дата возбуждения',
        EndDate: 'Дата завершения ИП', Article: 'Статья', Paragraph: 'Пункт', SubParagraph: 'Подпункт',
        SpiShortName: 'СПИ', ReasonFail: 'Причина', FSSPReestrId: 'Идентификатор реестра',
        FSSPReestrTypeId: 'Идентификатор типа реестра', TypeName: 'Тип реестра',
        EmployeeId: 'Идентификатор пользователя', FileName: 'Имя файла', CreateDate: 'Дата создания',
        EmployeeFullName: 'Пользователь', LastProcessing: 'Дата проведения', ClaimantInn: 'ИНН взыскателя',
        ClaimantName: 'Имя взыскателя', AddDate: 'Дата добавления', EDocId: 'EdocID', EdocID: 'EdocID'
    });
    const BASE_LABELS = Object.freeze({
        'kgn.pyramid.vostok-electra.ru': 'Курган', 'pyramid.vostok-electra.ru': 'Основная',
        'yuric.pyramid.vostok-electra.ru': 'ЮРИЦ', '81.pyramid.vostok-electra.ru': 'ЧЭС',
        'pyramid.nesko-nv.ru': 'НЭСКО'
    });

    function baseLabel(origin) {
        if (!origin) return '';
        try { const host = new URL(origin).hostname; return BASE_LABELS[host] || host; }
        catch (_) { return origin; }
    }

    function matchDepartments(match) {
        const departments = match.departments?.length ? match.departments : match.department ? [match.department] : [];
        return departments.map((department) => `${department.label} (depid ${department.depid})`).join('; ');
    }
    const END_FIELDS = 'Id StatusName RegNumIP FullName SummDebt Claimant BirthDay EDNumber DNumber DepartmentOSP EffectiveDate IssueDate StartDate EndDate Article Paragraph SubParagraph SpiShortName FSSPReestrId EDocId AddDate';
    const REGISTRY_TYPES = Object.freeze([
        { id: '2', name: 'Сведения об окончании факт и прекращение', fields: END_FIELDS },
        { id: '3', name: 'Сведения об окончании БИ', fields: END_FIELDS },
        { id: '1', name: 'Реестр возбуждение ИП', fields: 'Id StatusName RegNumIP StartDate FullName SummDebt Claimant BirthDay EDNumber DepartmentOSP EffectiveDate IssueDate ReasonFail SpiShortName DNumber EDocId AddDate' }
    ].map((type) => ({ ...type, fields: type.fields.split(' ').map((field) => ({
        key: field, field,
        label: type.id === '1' && field === 'EDNumber' ? 'Номер дела' :
            type.id === '1' && field === 'DepartmentOSP' ? 'Подразделение ОСП' : FIELD_LABELS[field]
    })) })));
    const FILTER_FIELDS = 'Id TypeName StatusName FileName CreateDate EmployeeFullName LastProcessing ClaimantInn ClaimantName'.split(' ');
    const DATE_FIELDS = new Set(['BirthDay', 'EffectiveDate', 'IssueDate', 'StartDate', 'EndDate', 'AddDate']);

    function calendarDay(value) {
        const match = normalizeText(value).match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);
        if (!match) return null;
        const [, day, month, year] = match.map(Number);
        const date = new Date(0);
        date.setUTCFullYear(year, month - 1, day);
        if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return year * 10000 + month * 100 + day;
    }

    function matchesDateQuery(query, actual) {
        const date = '\\d{2}\\.\\d{2}\\.\\d{4}';
        const range = query.match(new RegExp(`^(${date})\\s*-\\s*(${date})$`));
        const before = query.match(new RegExp(`^\\*\\s*(${date})$`));
        const after = query.match(new RegExp(`^(${date})\\s*\\*$`));
        const exact = query.match(new RegExp(`^(${date})$`));
        if (!range && !before && !after && !exact) return null;
        const lower = before ? 0 : calendarDay((range || after || exact)[1]);
        const upper = after ? Infinity : calendarDay(range ? range[2] : (before || exact)[1]);
        const day = calendarDay(actual);
        return lower !== null && upper !== null && day !== null && day >= lower && day <= upper;
    }

    function fieldsFor(element) {
        const typeId = element.closest('[data-registry-type]')?.dataset.registryType;
        return REGISTRY_TYPES.find((type) => type.id === typeId).fields;
    }

    function collectDepartments() {
        const seen = new Set();
        return Array.from(document.querySelectorAll('a.department-switch')).flatMap((link) => {
            try {
                const url = new URL(link.href, location.origin);
                const depid = url.pathname.match(/\/login\/department\/(\d+)(?:\/|$)/)?.[1];
                if (!depid || !/^https?:$/.test(url.protocol) || !/(^|\.)(pyramid\.vostok-electra\.ru|pyramid-vostok\.electra\.ru|pyramid\.nesko-nv\.ru)$/i.test(url.hostname)) return [];
                const key = `${url.origin}|${depid}`;
                if (seen.has(key)) return [];
                seen.add(key);
                return [{ key, depid, host: url.hostname, origin: url.origin, label: normalizeText(link.textContent), active: link.classList.contains('active') && url.origin === location.origin }];
            } catch (_) { return []; }
        });
    }

    function currentDepartment() {
        return collectDepartments().find((department) => department.active);
    }

    function registryFingerprint(registry, origin = window.location.origin) {
        return JSON.stringify([origin, registry.registryId, registry.fileName, registry.lastProcessing]);
    }

    function observeRegistryDepartment(registry, run) {
        const fingerprint = registryFingerprint(registry);
        if (!run.registryDepartments) run.registryDepartments = new Map();
        const matchesRegistry = (match) => match.registryFingerprint === fingerprint || (!match.registryFingerprint && match.baseOrigin === window.location.origin && match.registryId === registry.registryId);
        const firstMatch = run.debtors.flatMap((debtor) => [...debtor.matches.values()]).find(matchesRegistry);
        // Only matches need department attribution; keep the session compact for
        // large scans with thousands of registries that do not match any query.
        if (!firstMatch) return false;
        const departments = run.registryDepartments.get(fingerprint) || firstMatch.departments || (firstMatch.department ? [firstMatch.department] : []);
        const department = run.departments[run.departmentIndex];
        if (!department?.depid || departments.some((item) => item.origin === department.origin && item.depid === department.depid)) return false;
        departments.push({ key: department.key, origin: department.origin, depid: department.depid, label: department.label });
        run.registryDepartments.set(fingerprint, departments);
        let changed = false;
        run.debtors.forEach((debtor) => {
            let updated = false;
            debtor.matches.forEach((match) => {
                if (matchesRegistry(match)) {
                    match.departments = departments;
                    updated = true;
                }
            });
            if (updated) { debtor.metadataRevision = (debtor.metadataRevision || 0) + 1; changed = true; }
        });
        return changed;
    }

    function serializeRun(run, status = run.status) {
        return {
            version: 1, status, departments: run.departments.map(({ active, ...department }) => department),
            departmentIndex: run.departmentIndex, checkedRegistries: [...run.checkedRegistries],
            registryDepartments: [...(run.registryDepartments || new Map())],
            filters: run.filters, completed: run.completed, completedDepartments: run.completedDepartments || 0, skipped: run.skipped, errorCount: run.errorCount,
            debtors: run.debtors.map((debtor) => ({ typeId: debtor.typeId, values: debtor.values, collectAll: !!debtor.collectAll, matches: [...debtor.matches] }))
        };
    }

    const SESSION_CHUNK_SIZE = 256 * 1024;
    let sessionWrites = Promise.resolve();
    async function sessionRequest(action, data = {}) {
        const response = await sendRuntimeMessage({ action: `FSSP_SEARCH_SESSION_${action}`, ...data });
        if (!response?.success) throw new Error(response?.error || 'Не удалось сохранить или восстановить результаты поиска.');
        return response;
    }

    function saveRun(run, status) {
        const snapshot = JSON.stringify(serializeRun(run, status));
        const write = sessionWrites.catch(() => {}).then(async () => {
            const count = Math.ceil(snapshot.length / SESSION_CHUNK_SIZE);
            const { id } = await sessionRequest('BEGIN', { count });
            for (let index = 0; index < count; index++) {
                await sessionRequest('PART', { id, index, data: snapshot.slice(index * SESSION_CHUNK_SIZE, (index + 1) * SESSION_CHUNK_SIZE) });
            }
            await sessionRequest('COMMIT', { id });
        });
        sessionWrites = write;
        return write;
    }

    async function loadSavedRun() {
        const response = await sessionRequest('GET');
        if (!response.state?.chunked) return response.state;
        const { id, count } = response.state;
        const parts = [];
        for (let index = 0; index < count; index++) {
            parts.push((await sessionRequest('READ_PART', { id, index })).data);
        }
        return JSON.parse(parts.join(''));
    }

    async function clearSavedRun() {
        await sessionWrites.catch(() => {});
        const response = await sendRuntimeMessage({ action: 'FSSP_SEARCH_SESSION_CLEAR' });
        if (!response?.success) throw new Error(response?.error || 'Не удалось завершить временную сессию поиска.');
    }

    function departmentSwitchUrl(department, destination = LIST_PATH, params = '') {
        const link = Array.from(document.querySelectorAll('a.department-switch')).find((link) => {
            try {
                const url = new URL(link.href, location.origin);
                return url.origin === department.origin && url.pathname.match(/\/login\/department\/(\d+)(?:\/|$)/)?.[1] === department.depid;
            } catch (_) { return false; }
        });
        if (!link) throw new Error(`Нет доступной ссылки переключения: ${department.label} (depid ${department.depid}).`);
        const url = new URL(link.href, location.origin);
        url.pathname = `/login/department/${department.depid}${destination}`;
        Array.from(url.searchParams.keys()).filter((key) => key.startsWith('dup_fssp_')).forEach((key) => url.searchParams.delete(key));
        new URLSearchParams(params).forEach((value, key) => url.searchParams.set(key, value));
        return url.toString();
    }

    async function navigateDepartment(run, modal) {
        const department = run.departments[run.departmentIndex];
        const url = departmentSwitchUrl(department);
        modal.querySelector('.dup-fssp-registry-search-stop').disabled = true;
        setNotice(modal, `Сохраняю результаты. Перехожу: ${department.label} (${run.departmentIndex + 1}/${run.departments.length})…`);
        await saveRun(run, 'navigating');
        if (activeRun !== run || run.controller.signal.aborted) return;
        window.location.assign(url);
    }

    async function continueDepartmentSearch(run, modal) {
        try {
            const expected = run.departments[run.departmentIndex];
            if (currentDepartment()?.key !== expected.key) {
                await navigateDepartment(run, modal);
                return;
            }
            await saveRun(run, 'running');
            if (activeRun === run && !run.controller.signal.aborted) await performSearch(run, modal);
        } catch (error) {
            if (activeRun !== run) return;
            run.status = 'failed';
            setProgress(modal, 0, 1, 'Поиск прерван — результат частичный', `Найдено ${countMatches(run.debtors)}`);
            setNotice(modal, `${searchOutcome(run)} Причина: ${error.message}`, 'error');
            modal.querySelector('.dup-fssp-registry-search-submit').disabled = false;
            modal.querySelector('.dup-fssp-registry-search-stop').hidden = true;
        }
    }

    async function restoreSearchSession() {
        try {
            const state = await loadSavedRun();
            if (!state || !['running', 'navigating', 'paused', 'failed'].includes(state.status)) return;
            await waitFor(() => document.querySelector('#gs_list_TypeName') && currentDepartment(), 30000);
            const modal = ensureModal();
            resetModal(modal);
            modal.hidden = false;
            state.filters.forEach((rule) => {
                const control = modal.querySelector(`[data-registry-filter="${rule.field}"]`);
                if (!control) return;
                if (Array.isArray(rule.data)) {
                    const options = Array.from(control.querySelectorAll('input')).map((input) => ({ value: input.value, label: input.parentElement.textContent }));
                    rule.data.forEach((value) => { if (!options.some((option) => option.value === value)) options.push({ value, label: value }); });
                    const replacement = createMultiChoice(options, rule.data);
                    Object.assign(replacement.dataset, control.dataset);
                    control.replaceWith(replacement);
                } else if (control.type === 'date') {
                    const dates = rule.data.match(/\d{2}\.\d{2}\.\d{4}/g) || [];
                    control.value = dates[0]?.split('.').reverse().join('-') || '';
                    modal.querySelector(`[data-registry-filter-end="${rule.field}"]`).value = dates[1]?.split('.').reverse().join('-') || '';
                } else control.value = rule.data;
            });
            // Empty filters must stay empty even if this department has its own page filters.
            modal.querySelectorAll('[data-registry-filter]').forEach((control) => {
                if (state.filters.some((rule) => rule.field === control.dataset.registryFilter)) return;
                if (control.dataset.multiple === 'true') {
                    control.querySelector('[data-choice-reset]').click();
                } else control.value = '';
                const end = modal.querySelector(`[data-registry-filter-end="${control.dataset.registryFilter}"]`);
                if (end) end.value = '';
            });
            const departmentControl = modal.querySelector('[data-departments]');
            const replacement = createMultiChoice(state.departments.map((d) => ({ value: d.key, label: `${d.label} — ${baseLabel(d.origin)} (depid ${d.depid})` })), state.departments.map((d) => d.key));
            replacement.dataset.departments = 'true';
            departmentControl.replaceWith(replacement);
            modal.querySelectorAll('.dup-fssp-registry-search-input-table tbody').forEach((tbody) => tbody.replaceChildren());
            const debtors = state.debtors.map((debtor, index) => {
                const tbody = modal.querySelector(`[data-registry-type="${debtor.typeId}"] tbody`);
                const row = appendInputRow(tbody);
                row.querySelectorAll('input').forEach((input) => { input.value = debtor.values[input.dataset.field] || ''; });
                if (debtor.collectAll) {
                    const block = row.closest('[data-registry-type]');
                    block.querySelector('[data-collect-all]').checked = true;
                    updateCollectAllFields(block);
                }
                return { ...debtor, index, row, fields: fieldsFor(row), matches: new Map(debtor.matches) };
            });
            lockDebtorRows(modal, debtors);
            modal.querySelectorAll('.dup-fssp-registry-search-settings').forEach((block) => { block.open = false; });
            modal.querySelectorAll('.dup-fssp-registry-search-settings input, .dup-fssp-registry-search-settings button').forEach((input) => { input.disabled = true; });
            activeRun = { ...state, debtors, status: 'running', paused: false, pauseWaiters: [], controller: new AbortController(), checkedRegistries: new Set(state.checkedRegistries), registryDepartments: new Map(state.registryDepartments || []), discovered: 0, totalPages: 1 };
            const expected = state.departments[state.departmentIndex];
            if (currentDepartment()?.key !== expected?.key) throw new Error(`Переключение не подтверждено. Ожидается ${expected?.label || 'выбранный департамент'} (depid ${expected?.depid || '—'}). Результаты сохранены.`);
            if (state.status === 'failed' || state.status === 'paused') {
                activeRun.status = 'paused';
                activeRun.paused = true;
                showRunningControls(modal);
                setNotice(modal, 'Поиск восстановлен и приостановлен. Нажмите «Продолжить».');
                void performSearch(activeRun, modal);
            } else {
                showRunningControls(modal);
                void continueDepartmentSearch(activeRun, modal);
            }
        } catch (error) {
            const modal = ensureModal();
            modal.hidden = false;
            if (activeRun) activeRun.status = 'failed';
            setNotice(modal, error.message, 'error');
        } finally { restoringSession = false; }
    }

    function showRunningControls(modal) {
        modal.querySelector('.dup-fssp-registry-search-submit').disabled = true;
        const stop = modal.querySelector('.dup-fssp-registry-search-stop');
        stop.disabled = false;
        stop.hidden = false;
        stop.textContent = activeRun?.paused ? 'Продолжить' : 'Стоп';
        stop.classList.toggle('is-paused', !!activeRun?.paused);
        stop.setAttribute('aria-pressed', String(!!activeRun?.paused));
    }

    let activeRun = null;
    let toolbarObserver = null;
    let restoringSession = true;
    let closeChoicePicker = null;

    function normalizeText(value) {
        return String(value == null ? '' : value)
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeMatchValue(value) {
        return normalizeText(value).toLocaleLowerCase('ru-RU');
    }

    function isListPage() {
        return String(window.location.pathname || '').replace(/\/+$/, '') === LIST_PATH;
    }

    function isAbortError(error) {
        return !!(error && (error.name === 'AbortError' || String(error.message || '').includes('AbortError')));
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${BUTTON_ID} .fa { color: #2f8f68; }
            #${MODAL_ID}[hidden] { display: none !important; }
            #${MODAL_ID} {
                --fssp-search-ink: #24342f;
                --fssp-search-muted: #6f7e79;
                --fssp-search-line: #ccd8d3;
                --fssp-search-surface: #f8fbf9;
                --fssp-search-accent: #237a58;
                --fssp-search-accent-dark: #195b41;
                position: fixed;
                inset: 0;
                z-index: 2147483500;
                display: grid;
                place-items: center;
                padding: 8px;
                background: rgba(17, 31, 27, .58);
                backdrop-filter: blur(2px);
                font-family: "Segoe UI", Tahoma, sans-serif;
                color: var(--fssp-search-ink);
            }
            #${MODAL_ID} .dup-fssp-registry-search-dialog {
                width: calc(100vw - 16px);
                box-sizing: border-box;
                height: calc(100vh - 16px);
                max-height: none;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(36, 52, 47, .28);
                border-radius: 8px;
                background: var(--fssp-search-surface);
                box-shadow: 0 24px 70px rgba(8, 24, 19, .34);
            }
            #${MODAL_ID} .dup-fssp-registry-search-header {
                position: static !important;
                inset: auto !important;
                display: flex;
                align-items: flex-start;
                gap: 18px;
                padding: 18px 20px 15px;
                border-bottom: 1px solid var(--fssp-search-line);
                background: linear-gradient(135deg, #edf6f1 0%, #f9fbfa 68%, #e7f1ed 100%);
            }
            #${MODAL_ID} .dup-fssp-registry-search-heading { flex: 1; min-width: 0; }
            #${MODAL_ID} h2 {
                margin: 0;
                font-family: Georgia, "Times New Roman", serif;
                font-size: 22px;
                font-weight: 700;
                line-height: 1.15;
                color: #183d30;
            }
            #${MODAL_ID} .dup-fssp-registry-search-subtitle {
                margin-top: 6px;
                color: var(--fssp-search-muted);
                font-size: 12px;
                line-height: 1.35;
            }
            #${MODAL_ID} .dup-fssp-registry-search-close {
                width: 32px;
                height: 32px;
                border: 1px solid transparent;
                border-radius: 6px;
                background: transparent;
                color: #52635d;
                font-size: 24px;
                line-height: 26px;
                cursor: pointer;
            }
            #${MODAL_ID} .dup-fssp-registry-search-close:hover,
            #${MODAL_ID} .dup-fssp-registry-search-close:focus-visible {
                border-color: #9fb4ac;
                background: #fff;
                color: #183d30;
                outline: none;
            }
            #${MODAL_ID} .dup-fssp-registry-search-body {
                flex: 1 1 auto;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: auto;
                padding: 14px 20px 16px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-table-wrap {
                overflow: auto;
                border: 1px solid var(--fssp-search-line);
                border-radius: 6px;
                background: #fff;
            }
            #${MODAL_ID} .dup-fssp-registry-search-input-wrap {
                max-height: 180px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-collect-all {
                display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer;
            }
            #${MODAL_ID} .dup-fssp-registry-search-collect-all input { margin: 0; width: 16px; height: 16px; }
            #${MODAL_ID} .dup-fssp-registry-search-input-table input:disabled { background: #edf0ee; color: #6f7e79; cursor: default; }
            #${MODAL_ID} .dup-fssp-registry-search-settings { flex: 0 0 auto; min-width: 0; }
            #${MODAL_ID} .dup-fssp-registry-search-settings > summary {
                cursor: pointer; padding: 8px 10px; background: #e8f1ed;
                border: 1px solid var(--fssp-search-line); color: #29453b; font-weight: 600; list-style: none;
            }
            #${MODAL_ID} .dup-fssp-registry-search-settings > summary::-webkit-details-marker { display: none; }
            #${MODAL_ID} .dup-fssp-registry-search-settings > summary::before { content: '▸'; display: inline-block; width: 18px; }
            #${MODAL_ID} .dup-fssp-registry-search-settings[open] > summary::before { content: '▾'; }
            #${MODAL_ID} .dup-fssp-registry-search-settings + .dup-fssp-registry-search-settings { margin-top: 6px; }
            #${MODAL_ID} .dup-fssp-registry-search-filters {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                gap: 10px; padding: 10px; max-height: 190px; overflow: auto;
            }
            #${MODAL_ID} .dup-fssp-registry-search-filters label { min-width: 0; font-size: 12px; }
            #${MODAL_ID} .dup-fssp-registry-search-date-range { display: flex; gap: 4px; }
            #${MODAL_ID} .dup-fssp-registry-search-date-range input { min-width: 0; padding: 3px; }
            #${MODAL_ID} .dup-fssp-registry-search-multi { margin-top: 4px; min-width: 0; }
            #${MODAL_ID} .dup-fssp-registry-search-multi-trigger {
                width: 100%; min-height: 35px; padding: 7px 10px; border: 1px solid #bdcbc6; border-radius: 4px;
                background: #fff; text-align: left; color: #29453b; cursor: pointer;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            #${MODAL_ID} .dup-fssp-registry-search-multi-trigger::after { content: ' ▾'; }
            #${MODAL_ID} .dup-fssp-registry-search-filters > div { min-width: 0; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-overlay {
                position: absolute; inset: 0; z-index: 3; background: rgba(17,31,27,.65);
                display: grid; place-items: center; padding: 20px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-choice-dialog {
                width: min(760px, 100%); max-height: calc(100vh - 40px); display: flex; flex-direction: column;
                min-height: 0; border: 1px solid #9fb4ac; border-radius: 10px; overflow: hidden;
                background: #f8fbf9; box-shadow: 0 22px 70px rgba(8,24,19,.4);
            }
            #${MODAL_ID} .dup-fssp-registry-search-choice-heading {
                display: flex; justify-content: space-between; align-items: center; gap: 16px;
                padding: 18px 22px; border-bottom: 1px solid #ccd8d3; background: #e8f1ed;
            }
            #${MODAL_ID} .dup-fssp-registry-search-choice-heading h3 { margin: 0; font: 700 21px Georgia, serif; color: #183d30; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-tools { padding: 16px 22px 12px; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-list {
                overflow: auto; overscroll-behavior: contain; min-height: 0; max-height: 52vh;
                margin: 0 22px; border: 1px solid #d8e3de; border-radius: 6px; background: #fff;
            }
            #${MODAL_ID} .dup-fssp-registry-search-choice-list label {
                display: flex; align-items: center; gap: 12px; padding: 11px 14px; margin: 0;
                border-bottom: 1px solid #edf2ef; cursor: pointer; font-weight: normal;
            }
            #${MODAL_ID} .dup-fssp-registry-search-choice-list label:hover { background: #f0f7f3; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-list label:has(input:checked) { background: #e8f5ee; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-list label[hidden],
            #${MODAL_ID} .dup-fssp-registry-search-choice-list section[hidden] { display: none; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-list input[type="checkbox"] { width: 18px; height: 18px; flex: 0 0 18px; margin: 0; accent-color: #237a58; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-meta { display: block; margin-top: 3px; color: #6f7e79; font-size: 11px; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-group { position: sticky; top: 0; padding: 9px 14px; background: #edf3f0; color: #426354; font-size: 12px; font-weight: 700; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-empty { padding: 18px; color: #6f7e79; text-align: center; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 16px 22px; }
            #${MODAL_ID} .dup-fssp-registry-search-choice-count { flex: 1; color: #5d6e68; font-size: 12px; }
            #${MODAL_ID} .dup-fssp-registry-search-choices { max-height: 150px; overflow: auto; padding: 6px; }
            #${MODAL_ID} .dup-fssp-registry-search-choices label { display: flex; align-items: center; gap: 7px; padding: 3px; font-weight: normal; }
            #${MODAL_ID} .dup-fssp-registry-search-choices input[type="checkbox"] { width: 16px; height: 16px; flex: 0 0 16px; margin: 0; }
            #${MODAL_ID} .dup-fssp-registry-search-choices button { margin-bottom: 5px; }
            #${MODAL_ID} .dup-fssp-registry-search-filters select {
                width: 100%; height: 31px; margin-top: 4px; border: 1px solid #bdcbc6; background: #fff;
            }
            #${MODAL_ID} .dup-fssp-registry-search-table-wrap,
            #${MODAL_ID} .dup-fssp-registry-search-group-table-wrap { overscroll-behavior: contain; }
            #${MODAL_ID} .dup-fssp-registry-search-input-table,
            #${MODAL_ID} .dup-fssp-registry-search-results-table { width: max-content; min-width: 100%; }
            #${MODAL_ID} .dup-fssp-registry-search-input-table th:not(:first-child),
            #${MODAL_ID} .dup-fssp-registry-search-input-table td:not(:first-child),
            #${MODAL_ID} .dup-fssp-registry-search-results-table th:not(:first-child),
            #${MODAL_ID} .dup-fssp-registry-search-results-table td:not(:first-child) {
                width: 180px; min-width: 180px; max-width: 180px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-results {
                flex: 1 1 auto;
                min-height: 180px;
                display: flex;
                flex-direction: column;
                margin-top: 12px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-results-heading {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
                margin: 0 2px 7px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-results-title {
                color: #29453b;
                font-family: Georgia, "Times New Roman", serif;
                font-size: 16px;
                font-weight: 700;
            }
            #${MODAL_ID} .dup-fssp-registry-search-results-count {
                color: var(--fssp-search-muted);
                font-size: 12px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-results-wrap {
                flex: 1 1 auto;
                min-height: 0;
            }
            #${MODAL_ID} .dup-fssp-registry-search-result-group + .dup-fssp-registry-search-result-group {
                border-top: 1px solid var(--fssp-search-line);
            }
            #${MODAL_ID} .dup-fssp-registry-search-result-group > summary {
                padding: 11px 12px;
                background: #fff3c4;
                color: #725300;
                font-size: 13px;
                cursor: pointer;
                overflow-wrap: anywhere;
            }
            #${MODAL_ID} .dup-fssp-registry-search-result-group > summary:hover { background: #ffe9a0; }
            #${MODAL_ID} .dup-fssp-registry-search-result-group[data-has-matches="true"] > summary {
                background: #dff2e5;
                color: #176344;
            }
            #${MODAL_ID} .dup-fssp-registry-search-result-group[data-has-matches="true"] > summary:hover {
                background: #cce9d6;
            }
            #${MODAL_ID} .dup-fssp-registry-search-result-group > summary:focus-visible {
                outline: 2px solid var(--fssp-search-accent);
                outline-offset: -2px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-group-count {
                display: inline-block;
                margin-left: 12px;
                color: inherit;
                font-weight: 700;
                white-space: nowrap;
            }
            #${MODAL_ID} .dup-fssp-registry-search-group-table-wrap { overflow-x: auto; }
            #${MODAL_ID} .dup-fssp-registry-search-results-placeholder {
                padding: 24px 16px;
                color: #75857f;
                font-size: 12px;
                text-align: center;
            }
            #${MODAL_ID} table {
                width: 100%;
                min-width: 900px;
                border-collapse: separate;
                border-spacing: 0;
                table-layout: fixed;
            }
            #${MODAL_ID} th {
                position: sticky;
                top: 0;
                z-index: 1;
                padding: 9px 10px;
                border-bottom: 1px solid #b9cbc4;
                background: #e8f1ed;
                color: #29453b;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: .025em;
                text-align: left;
                text-transform: uppercase;
            }
            #${MODAL_ID} th:first-child,
            #${MODAL_ID} td:first-child { width: 42px; text-align: center; }
            #${MODAL_ID} .dup-fssp-registry-search-results-table th:last-child,
            #${MODAL_ID} .dup-fssp-registry-search-results-table td:last-child { width: 240px; }
            #${MODAL_ID} td {
                padding: 7px 8px;
                border-bottom: 1px solid #e2eae7;
                background: #fff;
                vertical-align: top;
            }
            #${MODAL_ID} tbody tr:last-child td { border-bottom: 0; }
            #${MODAL_ID} tbody tr:nth-child(even) td { background: #fbfdfc; }
            #${MODAL_ID} .dup-fssp-registry-search-index {
                color: #7d8c87;
                font-size: 12px;
                line-height: 31px;
            }
            #${MODAL_ID} input {
                width: 100%;
                height: 31px;
                box-sizing: border-box;
                border: 1px solid #bdcbc6;
                border-radius: 4px;
                padding: 5px 8px;
                background: #fff;
                color: #24342f;
                font-size: 13px;
            }
            #${MODAL_ID} input::placeholder {
                color: #82908b;
                opacity: .56;
                font-size: 11px;
            }
            #${MODAL_ID} input:focus {
                border-color: var(--fssp-search-accent);
                box-shadow: 0 0 0 2px rgba(35, 122, 88, .14);
                outline: none;
            }
            #${MODAL_ID} input[readonly] { background: #f5f8f6; color: #485a54; }
            #${MODAL_ID} .dup-fssp-registry-search-link {
                display: inline-flex;
                align-items: center;
                min-height: 26px;
                padding: 2px 8px;
                border: 1px solid #a8c9bc;
                border-radius: 999px;
                background: #e8f5ef;
                color: #176344;
                font-size: 12px;
                font-weight: 700;
                text-decoration: none;
                overflow-wrap: anywhere;
            }
            #${MODAL_ID} .dup-fssp-registry-search-link:hover,
            #${MODAL_ID} .dup-fssp-registry-search-link:focus-visible {
                border-color: var(--fssp-search-accent);
                background: #d7eee4;
                color: #0c4d34;
                outline: none;
            }
            #${MODAL_ID} .dup-fssp-registry-search-empty {
                color: #84918d;
                font-size: 12px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-results-empty td {
                padding: 24px 16px;
                color: #75857f;
                text-align: center;
            }
            #${MODAL_ID} .dup-fssp-registry-search-result-value {
                overflow-wrap: anywhere;
                color: #344b43;
                font-size: 12px;
                line-height: 1.35;
            }
            #${MODAL_ID} .dup-fssp-registry-search-progress[hidden] { display: none; }
            #${MODAL_ID} .dup-fssp-registry-search-progress { margin-top: 14px; }
            #${MODAL_ID} .dup-fssp-registry-search-progress-track {
                height: 6px;
                overflow: hidden;
                border-radius: 999px;
                background: #dbe5e1;
            }
            #${MODAL_ID} .dup-fssp-registry-search-progress-bar {
                width: 0;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #2c8b65, #56b38d);
                transition: width .2s ease;
            }
            #${MODAL_ID} .dup-fssp-registry-search-progress-copy {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                margin-top: 7px;
                color: #5f716b;
                font-size: 12px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-notice {
                min-height: 18px;
                margin-top: 10px;
                color: #5d6e68;
                font-size: 12px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-notice[data-tone="error"] { color: #a33d35; }
            #${MODAL_ID} .dup-fssp-registry-search-notice[data-tone="success"] { color: #176344; }
            #${MODAL_ID} .dup-fssp-registry-search-footer {
                position: static !important;
                inset: auto !important;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 9px;
                flex: 0 0 auto;
                padding: 10px 0;
                border-bottom: 1px solid var(--fssp-search-line);
                background: transparent;
            }
            #${MODAL_ID} .dup-fssp-registry-search-action {
                min-height: 34px;
                border: 1px solid #9eb0a9;
                border-radius: 5px;
                padding: 7px 15px;
                background: #fff;
                color: #344b43;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }
            #${MODAL_ID} .dup-fssp-registry-search-action:hover:not(:disabled) { background: #e9f0ed; }
            #${MODAL_ID} .dup-fssp-registry-search-action-primary {
                border-color: var(--fssp-search-accent-dark);
                background: var(--fssp-search-accent);
                color: #fff;
            }
            #${MODAL_ID} .dup-fssp-registry-search-action-primary:hover:not(:disabled) {
                background: var(--fssp-search-accent-dark);
            }
            #${MODAL_ID} .dup-fssp-registry-search-stop[hidden] { display: none; }
            #${MODAL_ID} .dup-fssp-registry-search-stop {
                border-color: #a85b35;
                background: #fff7f1;
                color: #8a3f20;
            }
            #${MODAL_ID} .dup-fssp-registry-search-stop:hover:not(:disabled) { background: #f9e6d9; }
            #${MODAL_ID} .dup-fssp-registry-search-stop.is-paused {
                border-color: var(--fssp-search-accent-dark);
                background: #e6f3ed;
                color: var(--fssp-search-accent-dark);
            }
            #${MODAL_ID} button:disabled { cursor: default; opacity: .55; }
            html.dup-ext-screenshot-mode .${UI_CLASS},
            html.dup-ui-hide-fssp-registry-search .${UI_CLASS} { display: none !important; }
            @keyframes dup-fssp-registry-search-flash {
                0%, 100% { background-color: transparent; box-shadow: none; }
                50% { background-color: #98e6b7; box-shadow: inset 0 0 0 2px #278b52; }
            }
            tr.${HIGHLIGHT_CLASS} > td {
                animation: dup-fssp-registry-search-flash .72s ease-in-out 3;
            }
            @media (max-width: 760px) {
                #${MODAL_ID} { padding: 8px; }
                #${MODAL_ID} .dup-fssp-registry-search-dialog {
                    width: calc(100vw - 16px);
                    height: calc(100vh - 16px);
                }
                #${MODAL_ID} .dup-fssp-registry-search-header,
                #${MODAL_ID} .dup-fssp-registry-search-body { padding-left: 12px; padding-right: 12px; }
            }
            @media (prefers-reduced-motion: reduce) {
                #${MODAL_ID} .dup-fssp-registry-search-progress-bar { transition: none; }
                tr.${HIGHLIGHT_CLASS} > td { animation-duration: 1.1s; }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function createToolbarButton() {
        const button = document.createElement('div');
        button.id = BUTTON_ID;
        button.className = `btn btn-xs ui-pg-button ${UI_CLASS}`;
        button.tabIndex = 0;
        button.setAttribute('role', 'button');
        button.setAttribute('title', 'Найти должников во всех отфильтрованных реестрах');
        button.innerHTML = '<div class="ui-pg-div"><span class="fa fa-lg fa-fw fa-search"></span><span class="ui-pg-button-text">Найти ИД в реестрах</span></div>';
        const activate = (event) => {
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            openModal();
        };
        button.addEventListener('click', activate);
        button.addEventListener('keydown', activate);
        return button;
    }

    function ensureToolbarButton() {
        if (!isListPage() || document.getElementById(BUTTON_ID)) return;
        const candidates = Array.from(document.querySelectorAll('[role="button"], button, .ui-pg-button'));
        const anchor = candidates.find((element) => normalizeText(element.textContent) === 'Единый реестр ФССП');
        if (!(anchor instanceof HTMLElement) || !(anchor.parentElement instanceof HTMLElement)) return;
        anchor.insertAdjacentElement('afterend', createToolbarButton());
    }

    function createInputCell(fieldDefinition) {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.dataset.field = fieldDefinition.key;
        input.setAttribute('aria-label', fieldDefinition.label);
        input.placeholder = 'null для поиска пустых';
        input.addEventListener('paste', pasteColumnValues);
        cell.appendChild(input);
        return cell;
    }

    function pasteColumnValues(event) {
        const input = event.currentTarget;
        if (input.readOnly || input.disabled || !event.clipboardData) return;
        const text = event.clipboardData.getData('text/plain');
        if (!/[\r\n\t]/.test(text)) return;
        event.preventDefault();
        const modal = input.closest(`#${MODAL_ID}`);
        if (text.includes('\t')) {
            setNotice(modal, 'Скопируйте значения только одного столбца Excel.', 'error');
            return;
        }
        const values = text.split(/\r\n|[\r\n]/).map(normalizeText).filter(Boolean);
        if (!values.length) return;
        const row = input.closest(`tr.${ROW_CLASS}`);
        const tbody = row.parentElement;
        const rows = Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`));
        const startIndex = rows.indexOf(row);
        let lastInput = input;
        values.forEach((value, index) => {
            const targetRow = rows[startIndex + index] || appendInputRow(tbody, false);
            const targetInput = targetRow.querySelector(`input[data-field="${input.dataset.field}"]`);
            targetInput.value = value;
            lastInput = targetInput;
        });
        const lastRow = tbody.lastElementChild;
        if (fieldsFor(tbody).some((field) => normalizeText(lastRow.querySelector(`input[data-field="${field.key}"]`).value))) {
            appendInputRow(tbody, false);
        }
        updateRowNumbers(tbody);
        lastInput.focus();
        setNotice(modal, `Вставлено значений в столбец «${input.getAttribute('aria-label')}»: ${values.length}.`);
    }

    function updateRowNumbers(tbody) {
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row, index) => {
            const indexCell = row.querySelector('.dup-fssp-registry-search-index');
            if (indexCell) indexCell.textContent = String(index + 1);
        });
    }

    function scrollLocalBlock(event) {
        if (event.ctrlKey) return;
        const block = event.target.closest('.dup-fssp-registry-search-table-wrap, .dup-fssp-registry-search-group-table-wrap, .dup-fssp-registry-search-choice-list, .dup-fssp-registry-search-choices, .dup-fssp-registry-search-filters');
        if (!block) return;
        if (block.closest('.dup-fssp-registry-search-results')) {
            const results = block.closest('.dup-fssp-registry-search-results-wrap');
            const vertical = results && results.scrollHeight > results.clientHeight
                ? results : block.closest('.dup-fssp-registry-search-body');
            if (!vertical) return;
            const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? vertical.clientHeight : 1;
            vertical.scrollTop += event.deltaY * scale;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || block.scrollHeight <= block.clientHeight;
        const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? block.clientWidth : 1;
        if (horizontal && block.scrollWidth > block.clientWidth) {
            block.scrollLeft += (event.deltaX || event.deltaY) * scale;
        } else if (block.scrollHeight > block.clientHeight) {
            block.scrollTop += event.deltaY * scale;
        } else return;
        event.preventDefault();
        event.stopPropagation();
    }

    function populateRegistryFilters(modal) {
        const container = modal.querySelector('.dup-fssp-registry-search-filters');
        container.replaceChildren();
        FILTER_FIELDS.forEach((field) => {
            const source = document.getElementById(`gs_list_${field}`);
            const label = document.createElement('div');
            label.textContent = field === 'Id' ? 'Идентификатор реестра' : FIELD_LABELS[field];
            const control = source?.tagName === 'SELECT'
                ? createMultiChoice(Array.from(source.options).filter((o) => o.value).map((o) => ({ value: o.value, label: o.text })), source.value ? [source.value] : [])
                : document.createElement('input');
            control.dataset.registryFilter = field;
            control.dataset.operator = source?.tagName === 'SELECT' ? 'eq' : 'cn';
            control.setAttribute('aria-label', label.textContent);
            if (source?.tagName !== 'SELECT') {
                control.type = 'text';
            }
            control.value = source?.value || '';
            if (field === 'CreateDate' || field === 'LastProcessing') {
                const range = document.createElement('span');
                range.className = 'dup-fssp-registry-search-date-range';
                const end = document.createElement('input');
                control.type = end.type = 'date';
                end.dataset.registryFilterEnd = field;
                control.setAttribute('aria-label', `${label.textContent}: начало периода`);
                end.setAttribute('aria-label', `${label.textContent}: конец периода`);
                const dates = (source?.value || '').match(/\d{2}\.\d{2}\.\d{4}/g) || [];
                const iso = (value) => value ? value.split('.').reverse().join('-') : '';
                control.value = iso(dates[0]);
                end.value = iso(dates[1] || dates[0]);
                range.append(control, end);
                label.appendChild(range);
            } else label.appendChild(control);
            container.appendChild(label);
        });
        const departmentLabel = document.createElement('div');
        departmentLabel.textContent = 'Департаменты (можно выбрать несколько баз)';
        const departments = collectDepartments();
        const control = createMultiChoice(departments.map((d) => ({ value: d.key, label: `${d.label} — ${baseLabel(d.origin)} (depid ${d.depid})` })), departments.filter((d) => d.active).map((d) => d.key), 'Выберите департаменты');
        control.dataset.departments = 'true';
        control.setAttribute('aria-label', 'Департаменты для поиска');
        departmentLabel.appendChild(control);
        container.prepend(departmentLabel);
    }

    function createMultiChoice(options, selected, emptyLabel = 'Все') {
        const details = document.createElement('div');
        details.className = 'dup-fssp-registry-search-multi';
        details.dataset.multiple = 'true';
        const summary = document.createElement('button');
        summary.type = 'button';
        summary.className = 'dup-fssp-registry-search-multi-trigger';
        summary.setAttribute('aria-haspopup', 'dialog');
        const choices = document.createElement('div');
        choices.className = 'dup-fssp-registry-search-choices';
        choices.hidden = true;
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.dataset.choiceReset = 'true';
        reset.textContent = 'Снять выбор';
        choices.appendChild(reset);
        const update = () => {
            const labels = Array.from(choices.querySelectorAll('input:checked')).map((input) => input.parentElement.textContent);
            summary.textContent = labels.length ? `Выбрано: ${labels.length} · ${labels.slice(0, 2).join(', ')}${labels.length > 2 ? '…' : ''}` : emptyLabel;
        };
        options.forEach((option) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = option.value;
            input.checked = selected.includes(option.value);
            label.append(input, document.createTextNode(option.label));
            choices.appendChild(label);
        });
        details.append(summary, choices);
        choices.addEventListener('change', update);
        summary.addEventListener('click', () => openChoicePicker(details, summary));
        reset.addEventListener('click', () => {
            choices.querySelectorAll('input').forEach((input) => { input.checked = false; });
            update();
        });
        update();
        return details;
    }

    function openChoicePicker(control, trigger) {
        if (trigger.disabled || closeChoicePicker) return;
        const modal = control.closest(`#${MODAL_ID}`);
        const mainDialog = modal.querySelector('.dup-fssp-registry-search-dialog');
        const overlay = document.createElement('div');
        overlay.className = 'dup-fssp-registry-search-choice-overlay';
        overlay.innerHTML = `
            <section class="dup-fssp-registry-search-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="dup-fssp-choice-title">
                <div class="dup-fssp-registry-search-choice-heading"><h3 id="dup-fssp-choice-title"></h3><button type="button" class="dup-fssp-registry-search-close" aria-label="Закрыть выбор">×</button></div>
                <div class="dup-fssp-registry-search-choice-tools">
                    <input type="search" placeholder="Поиск по списку…" aria-label="Поиск по списку">
                    <div class="dup-fssp-registry-search-choice-actions">
                        <button type="button" class="dup-fssp-registry-search-action" data-select-visible>Выбрать все</button>
                        <button type="button" class="dup-fssp-registry-search-action" data-clear-selection>Снять выбор</button>
                    </div>
                </div>
                <div class="dup-fssp-registry-search-choice-list" tabindex="0" aria-label="Варианты выбора"></div>
                <div class="dup-fssp-registry-search-choice-footer">
                    <span class="dup-fssp-registry-search-choice-count" role="status" aria-live="polite"></span>
                    <button type="button" class="dup-fssp-registry-search-action" data-cancel-choice>Отмена</button>
                    <button type="button" class="dup-fssp-registry-search-action dup-fssp-registry-search-action-primary" data-apply-choice>Применить</button>
                </div>
            </section>`;
        overlay.querySelector('h3').textContent = control.dataset.departments ? 'Выбор департаментов' : FIELD_LABELS[control.dataset.registryFilter] || 'Выбор значений';
        const list = overlay.querySelector('.dup-fssp-registry-search-choice-list');
        const search = overlay.querySelector('input[type="search"]');
        const groups = new Map();
        const rows = Array.from(control.querySelectorAll('input[type="checkbox"]')).map((source) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = source.value;
            input.checked = source.checked;
            const text = normalizeText(source.parentElement.textContent);
            const caption = document.createElement('span');
            caption.textContent = control.dataset.departments ? text.split(' — ')[0] : text;
            let container = list;
            if (control.dataset.departments) {
                const [origin, depid] = source.value.split('|');
                const host = new URL(origin).hostname;
                if (!groups.has(host)) {
                    const group = document.createElement('section');
                    const heading = document.createElement('div');
                    heading.className = 'dup-fssp-registry-search-choice-group';
                    heading.textContent = baseLabel(origin);
                    group.appendChild(heading);
                    list.appendChild(group);
                    groups.set(host, group);
                }
                container = groups.get(host);
                const meta = document.createElement('span');
                meta.className = 'dup-fssp-registry-search-choice-meta';
                meta.textContent = `depid ${depid} · ${baseLabel(origin)}`;
                caption.appendChild(meta);
            }
            label.append(input, caption);
            container.appendChild(label);
            return { label, input, source, searchText: normalizeMatchValue(text + ' ' + source.value + ' ' + (control.dataset.departments ? container.firstElementChild.textContent : '')) };
        });
        const empty = document.createElement('div');
        empty.className = 'dup-fssp-registry-search-choice-empty';
        empty.textContent = 'Ничего не найдено. Попробуйте другое название.';
        list.appendChild(empty);
        const update = () => {
            const query = normalizeMatchValue(search.value);
            rows.forEach((row) => { row.label.hidden = !row.searchText.includes(query); });
            groups.forEach((group) => { group.hidden = !rows.some((row) => row.label.parentElement === group && !row.label.hidden); });
            const visible = rows.filter((row) => !row.label.hidden).length;
            empty.hidden = visible > 0;
            overlay.querySelector('.dup-fssp-registry-search-choice-count').textContent = `Выбрано ${rows.filter((row) => row.input.checked).length} из ${rows.length} · показано ${visible}`;
            overlay.querySelector('[data-select-visible]').textContent = query ? 'Выбрать найденные' : 'Выбрать все';
        };
        const wasInert = mainDialog.inert;
        const close = () => {
            overlay.remove();
            mainDialog.inert = wasInert;
            closeChoicePicker = null;
            if (trigger.isConnected && !modal.hidden) trigger.focus({ preventScroll: true });
        };
        closeChoicePicker = close;
        overlay.querySelector('[data-apply-choice]').addEventListener('click', () => {
            rows.forEach((row) => { row.source.checked = row.input.checked; });
            control.querySelector('.dup-fssp-registry-search-choices').dispatchEvent(new Event('change', { bubbles: true }));
            close();
        });
        overlay.querySelector('[data-cancel-choice]').addEventListener('click', close);
        overlay.querySelector('.dup-fssp-registry-search-close').addEventListener('click', close);
        overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close(); });
        overlay.querySelector('[data-select-visible]').addEventListener('click', () => { rows.forEach((row) => { if (!row.label.hidden) row.input.checked = true; }); update(); });
        overlay.querySelector('[data-clear-selection]').addEventListener('click', () => { rows.forEach((row) => { row.input.checked = false; }); update(); });
        search.addEventListener('input', update);
        list.addEventListener('change', update);
        overlay.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const focusable = Array.from(overlay.querySelectorAll('button, input, [tabindex="0"]')).filter((element) => element.getClientRects().length);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        modal.appendChild(overlay);
        mainDialog.inert = true;
        update();
        search.focus();
    }

    function selectedChoices(control) {
        return Array.from(control.querySelectorAll('input:checked')).map((input) => input.value);
    }

    function readRegistryFilters(modal) {
        return Array.from(modal.querySelectorAll('[data-registry-filter]')).flatMap((control) => {
            if (control.dataset.multiple === 'true') {
                const data = selectedChoices(control);
                return data.length ? [{ field: control.dataset.registryFilter, op: 'eq', data }] : [];
            }
            let data = normalizeText(control.value);
            if (control.type === 'date') {
                const end = modal.querySelector(`[data-registry-filter-end="${control.dataset.registryFilter}"]`).value;
                const date = (value) => value.split('-').reverse().join('.');
                data = data || end ? `${date(data || end)}-${date(end || data)}` : '';
            }
            return data ? [{ field: control.dataset.registryFilter, op: control.dataset.operator, data }] : [];
        });
    }

    function searchGridState(gridState, run) {
        const postData = { ...gridState.postData };
        // Replace page filters with the independent snapshot from the dialog.
        FILTER_FIELDS.forEach((field) => { delete postData[field]; });
        delete postData.filters;
        delete postData.searchField;
        delete postData.searchOper;
        delete postData.searchString;
        const types = [...new Set(run.debtors.map((debtor) => debtor.typeId))];
        postData._search = true;
        // This endpoint ignores nested groups. Send only flat AND conditions;
        // multi-value OR filters are enforced against registry metadata below.
        const rules = run.filters.flatMap((rule) => Array.isArray(rule.data)
            ? rule.data.length === 1 ? [{ ...rule, data: rule.data[0] }] : [] : [rule]);
        if (types.length === 1 && !rules.some((rule) => rule.field === 'TypeName')) {
            rules.push({ field: 'TypeName', op: 'eq', data: REGISTRY_TYPES.find((type) => type.id === types[0]).name });
        }
        postData.filters = JSON.stringify({ groupOp: 'AND', rules });
        return { ...gridState, postData };
    }

    function registryMatchesFilters(cell, filters) {
        const dateKey = (value) => {
            const match = normalizeText(value).match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);
            return match ? `${match[3]}${match[2]}${match[1]}` : '';
        };
        return filters.every((rule) => {
            const actual = normalizeMatchValue(cell?.[rule.field]);
            if (Array.isArray(rule.data)) return !rule.data.length || rule.data.some((value) => actual === normalizeMatchValue(value));
            if (rule.field === 'CreateDate' || rule.field === 'LastProcessing') {
                const bounds = String(rule.data).split('-').map(dateKey);
                const date = dateKey(cell?.[rule.field]);
                return !!date && !!bounds[0] && date >= bounds[0] && date <= (bounds[1] || bounds[0]);
            }
            const expected = normalizeMatchValue(rule.data);
            return rule.op === 'eq' ? actual === expected : actual.includes(expected);
        });
    }

    function appendInputRow(tbody, updateNumbers = true) {
        const row = document.createElement('tr');
        row.className = ROW_CLASS;
        const indexCell = document.createElement('td');
        indexCell.className = 'dup-fssp-registry-search-index';
        row.appendChild(indexCell);
        const fields = fieldsFor(tbody);
        fields.forEach((field) => row.appendChild(createInputCell(field)));
        row.addEventListener('input', () => {
            const rows = Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`));
            if (rows[rows.length - 1] !== row) return;
            const hasValue = fields.some((field) => {
                const input = row.querySelector(`input[data-field="${field.key}"]`);
                return normalizeText(input && input.value) !== '';
            });
            if (hasValue) {
                appendInputRow(tbody);
                updateRowNumbers(tbody);
            }
        });
        tbody.appendChild(row);
        if (updateNumbers) updateRowNumbers(tbody);
        return row;
    }

    function ensureModal() {
        ensureStyles();
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = UI_CLASS;
        modal.hidden = true;
        modal.innerHTML = `
            <section class="dup-fssp-registry-search-dialog" role="dialog" aria-modal="true" aria-labelledby="dup-fssp-registry-search-title">
                <header class="dup-fssp-registry-search-header">
                    <div class="dup-fssp-registry-search-heading">
                        <h2 id="dup-fssp-registry-search-title">Найти ИД в реестрах</h2>
                        <div class="dup-fssp-registry-search-subtitle">Общие фильтры действуют на все три типа. Условия каждого блока ищут только в своём типе реестра. Поля одной строки проверяются вместе; null означает пустое значение. Ctrl+V вставляет список из одного столбца Excel. Колесо прокручивает блок под курсором, Shift+колесо — по горизонтали. Дополнительные скрытые поля расположены в конце таблиц.</div>
                        <div class="dup-fssp-registry-search-subtitle">В полях дат условий: 01.01.2026-21.10.2026 — период; *21.10.2026 — до даты; 21.10.2026* — после даты; 21.10.2026 — конкретный день. Все границы включительно, время не учитывается. В результатах колесо прокручивает вертикально, горизонтально — полоса прокрутки.</div>
                    </div>
                    <button type="button" class="dup-fssp-registry-search-close" aria-label="Закрыть окно">×</button>
                </header>
                <div class="dup-fssp-registry-search-body">
                    <details class="dup-fssp-registry-search-settings dup-fssp-registry-search-filter-section" open>
                        <summary>В каких реестрах искать — общие фильтры</summary>
                        <div class="dup-fssp-registry-search-filters"></div>
                    </details>
                    ${REGISTRY_TYPES.map((type) => `<details class="dup-fssp-registry-search-settings" data-registry-type="${type.id}" open>
                        <summary>${type.name}</summary>
                        <label class="dup-fssp-registry-search-collect-all"><input type="checkbox" data-collect-all>Собирать все строки</label>
                    <div class="dup-fssp-registry-search-table-wrap dup-fssp-registry-search-input-wrap" tabindex="0" aria-label="Условия: ${type.name}">
                        <table class="dup-fssp-registry-search-input-table">
                            <thead><tr><th>№</th>${type.fields.map((field) => `<th>${field.label}</th>`).join('')}</tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    </details>`).join('')}
                    <div class="dup-fssp-registry-search-footer">
                        <button type="button" class="dup-fssp-registry-search-action dup-fssp-registry-search-export" disabled>Выгрузить в Excel</button>
                        <button type="button" class="dup-fssp-registry-search-action dup-fssp-registry-search-cancel">Закрыть</button>
                        <button type="button" class="dup-fssp-registry-search-action dup-fssp-registry-search-stop" aria-pressed="false" hidden>Стоп</button>
                        <button type="button" class="dup-fssp-registry-search-action dup-fssp-registry-search-action-primary dup-fssp-registry-search-submit">Поиск</button>
                    </div>
                    <div class="dup-fssp-registry-search-progress" hidden>
                        <div class="dup-fssp-registry-search-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <div class="dup-fssp-registry-search-progress-bar"></div>
                        </div>
                        <div class="dup-fssp-registry-search-progress-copy"><span class="dup-fssp-registry-search-progress-label">Подготовка…</span><span class="dup-fssp-registry-search-progress-count"></span></div>
                    </div>
                    <div class="dup-fssp-registry-search-notice" role="status" aria-live="polite"></div>
                    <section class="dup-fssp-registry-search-results" aria-labelledby="dup-fssp-registry-search-results-title">
                        <div class="dup-fssp-registry-search-results-heading">
                            <div id="dup-fssp-registry-search-results-title" class="dup-fssp-registry-search-results-title">Результаты поиска</div>
                            <div class="dup-fssp-registry-search-results-count">Совпадений: 0</div>
                        </div>
                        <div class="dup-fssp-registry-search-table-wrap dup-fssp-registry-search-results-wrap">
                        </div>
                    </section>
                </div>
            </section>
        `;
        (document.body || document.documentElement).appendChild(modal);
        modal.querySelectorAll('.dup-fssp-registry-search-input-table tbody').forEach((tbody) => appendInputRow(tbody));
        modal.querySelectorAll('[data-collect-all]').forEach((input) => {
            input.addEventListener('change', () => updateCollectAllFields(input.closest('[data-registry-type]')));
        });
        modal.addEventListener('wheel', scrollLocalBlock, { passive: false });
        renderSearchResults(modal, []);
        modal.querySelector('.dup-fssp-registry-search-results-wrap').addEventListener('contextmenu', (event) => {
            const cell = event.target.closest('.dup-fssp-registry-search-results-table tbody td');
            if (!cell || cell.closest('.dup-fssp-registry-search-results-empty')) return;
            event.preventDefault();
            event.stopPropagation();
            void copyResultCell(modal, normalizeText(cell.textContent));
        });
        const close = () => closeModal();
        modal.querySelector('.dup-fssp-registry-search-close').addEventListener('click', close);
        modal.querySelector('.dup-fssp-registry-search-cancel').addEventListener('click', close);
        modal.querySelector('.dup-fssp-registry-search-stop').addEventListener('click', () => toggleSearchPause(modal));
        modal.querySelector('.dup-fssp-registry-search-submit').addEventListener('click', () => startSearch(modal));
        modal.querySelector('.dup-fssp-registry-search-export').addEventListener('click', () => exportSearchResults(modal));
        modal.addEventListener('mousedown', (event) => {
            if (event.target === modal) closeModal();
        });
        return modal;
    }

    async function copyResultCell(modal, value) {
        try {
            let copied = false;
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                try {
                    await navigator.clipboard.writeText(value);
                    copied = true;
                } catch (error) {
                    // Use a synchronous copy fallback when clipboard access is denied.
                }
            }
            if (!copied) {
                const previousFocus = document.activeElement;
                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.addEventListener('copy', (event) => {
                    if (!event.clipboardData) return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.clipboardData.clearData();
                    event.clipboardData.setData('text/plain', value);
                });
                textarea.setAttribute('aria-label', 'Копирование значения');
                textarea.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;';
                modal.appendChild(textarea);
                try {
                    textarea.select();
                    copied = document.execCommand('copy');
                } finally {
                    textarea.remove();
                    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
                }
            }
            if (!copied) throw new Error('COPY_FAILED');
            setNotice(modal, 'Значение ячейки скопировано без форматирования.', 'success');
        } catch (error) {
            setNotice(modal, 'Не удалось скопировать значение ячейки.', 'error');
        }
    }

    function resetModal(modal) {
        modal.querySelectorAll('[data-collect-all]').forEach((input) => { input.checked = false; input.disabled = false; });
        modal.querySelectorAll('.dup-fssp-registry-search-input-table tbody').forEach((tbody) => {
            tbody.replaceChildren();
            appendInputRow(tbody);
        });
        modal.querySelectorAll('.dup-fssp-registry-search-settings').forEach((block) => { block.open = true; });
        populateRegistryFilters(modal);
        renderSearchResults(modal, []);
        modal.querySelector('.dup-fssp-registry-search-progress').hidden = true;
        modal.querySelector('.dup-fssp-registry-search-notice').textContent = '';
        modal.querySelector('.dup-fssp-registry-search-notice').removeAttribute('data-tone');
        modal.querySelector('.dup-fssp-registry-search-submit').disabled = false;
        const stopButton = modal.querySelector('.dup-fssp-registry-search-stop');
        stopButton.hidden = true;
        stopButton.disabled = false;
        stopButton.textContent = 'Стоп';
        stopButton.classList.remove('is-paused');
        stopButton.setAttribute('aria-pressed', 'false');
    }

    function openModal() {
        const modal = ensureModal();
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) {
            modal.hidden = false;
            return;
        }
        resetModal(modal);
        modal.hidden = false;
        const firstInput = modal.querySelector('input');
        if (firstInput) requestAnimationFrame(() => firstInput.focus());
    }

    function closeModal() {
        if (closeChoicePicker) closeChoicePicker();
        const modal = document.getElementById(MODAL_ID);
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) {
            activeRun.status = 'cancelled';
            activeRun.controller.abort();
            activeRun.pauseWaiters.splice(0).forEach((resolve) => resolve());
        }
        activeRun = null;
        void clearSavedRun().catch((error) => console.warn('[FSSP Registry Search]', error.message));
        if (modal) modal.hidden = true;
    }

    function setNotice(modal, text, tone) {
        const notice = modal.querySelector('.dup-fssp-registry-search-notice');
        notice.textContent = text || '';
        if (tone) notice.dataset.tone = tone;
        else notice.removeAttribute('data-tone');
    }

    function setProgress(modal, current, total, label, suffix) {
        const progress = modal.querySelector('.dup-fssp-registry-search-progress');
        const track = progress.querySelector('[role="progressbar"]');
        const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
        progress.hidden = false;
        track.setAttribute('aria-valuenow', String(percent));
        progress.querySelector('.dup-fssp-registry-search-progress-bar').style.width = `${percent}%`;
        progress.querySelector('.dup-fssp-registry-search-progress-label').textContent = label || 'Поиск';
        progress.querySelector('.dup-fssp-registry-search-progress-count').textContent = suffix || `${current} / ${total}`;
    }

    function updateCollectAllFields(block) {
        const collectAll = block.querySelector('[data-collect-all]').checked;
        block.querySelectorAll('.dup-fssp-registry-search-input-table input').forEach((input) => { input.disabled = collectAll; });
    }

    function readDebtors(modal) {
        const allTypes = new Set();
        return Array.from(modal.querySelectorAll(`tbody tr.${ROW_CLASS}`)).map((row, index) => {
            const block = row.closest('[data-registry-type]');
            const typeId = block.dataset.registryType;
            const collectAll = block.querySelector('[data-collect-all]').checked;
            if (collectAll && allTypes.has(typeId)) return null;
            if (collectAll) allTypes.add(typeId);
            const values = {};
            const fields = fieldsFor(row);
            fields.forEach((field) => {
                const input = row.querySelector(`input[data-field="${field.key}"]`);
                values[field.key] = collectAll ? '' : normalizeText(input && input.value);
            });
            const hasCriteria = Object.values(values).some(Boolean);
            return collectAll || hasCriteria ? { index, row, values, fields, typeId, collectAll, matches: new Map() } : null;
        }).filter(Boolean);
    }

    function lockDebtorRows(modal, debtors) {
        modal.querySelectorAll('.dup-fssp-registry-search-input-table tbody').forEach((tbody) => {
            Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row) => {
                if (!debtors.some((debtor) => debtor.row === row)) row.remove();
            });
            updateRowNumbers(tbody);
        });
        debtors.forEach((debtor) => {
            debtor.row.querySelectorAll('input').forEach((input) => { input.readOnly = true; });
        });
        renderSearchResults(modal, debtors);
    }

    function buildMatchUrl(registryId, match) {
        // Enter through the registry list so switching also works when the current
        // department has no access to the target detail page yet.
        const url = new URL(match.department ? LIST_PATH : `${LIST_PATH}/${encodeURIComponent(registryId)}`, match.department ? window.location.origin : match.baseOrigin || window.location.origin);
        url.searchParams.set('dup_fssp_match', String(match.rowId || ''));
        url.searchParams.set('dup_fssp_pos', String(match.position || 0));
        url.searchParams.set('dup_fssp_total', String(match.totalRows || 0));
        if (match.department?.depid) {
            url.searchParams.set('dup_fssp_dep', match.department.depid);
            url.searchParams.set('dup_fssp_open', registryId);
            url.searchParams.set('dup_fssp_base', match.baseOrigin || window.location.origin);
        }
        return url.toString();
    }

    function routeLinkedRegistry() {
        if (!isListPage()) return false;
        const params = new URLSearchParams(window.location.search);
        const registryId = params.get('dup_fssp_open');
        const depid = params.get('dup_fssp_dep');
        if (!/^\d+$/.test(registryId || '') || !/^\d+$/.test(depid || '')) return false;
        try {
            const origin = params.get('dup_fssp_base') || window.location.origin;
            const department = collectDepartments().find((d) => d.depid === depid && d.origin === origin);
            if (!department) throw new Error('Нет доступа к департаменту найденной записи.');
            params.delete('dup_fssp_open');
            params.delete('dup_fssp_base');
            const path = `${LIST_PATH}/${registryId}`;
            const url = department.active ? new URL(`${path}?${params}`, window.location.origin).toString()
                : departmentSwitchUrl(department, path, params);
            window.location.replace(url);
        } catch (error) { window.alert(error.message); }
        return true;
    }

    function renderSearchResults(modal, debtors, emptyMessage = 'Найденные совпадения появятся здесь во время поиска.') {
        const container = modal.querySelector('.dup-fssp-registry-search-results-wrap');
        const count = modal.querySelector('.dup-fssp-registry-search-results-count');
        if (!(container instanceof HTMLElement)) return;
        const queries = Array.isArray(debtors) ? debtors : [];
        modal.querySelector('.dup-fssp-registry-search-export').disabled = queries.length === 0;
        if (count instanceof HTMLElement) count.textContent = `Совпадений: ${countMatches(queries)}`;
        if (!queries.length) {
            const placeholder = document.createElement('div');
            placeholder.className = 'dup-fssp-registry-search-results-placeholder';
            placeholder.textContent = emptyMessage;
            container.replaceChildren(placeholder);
            return;
        }
        if (container.querySelector('.dup-fssp-registry-search-results-placeholder')) container.replaceChildren();
        queries.forEach((debtor, queryIndex) => {
            let group = container.children[queryIndex];
            if (!group) {
                group = document.createElement('details');
                group.className = 'dup-fssp-registry-search-result-group';
                const summary = document.createElement('summary');
                const criteria = document.createElement('span');
                const labels = debtor.fields.filter((definition) => debtor.values[definition.key])
                    .map((definition) => `${definition.label}: ${debtor.values[definition.key]}`);
                if (debtor.collectAll) labels.splice(0, labels.length, 'Все строки');
                criteria.textContent = `${queryIndex + 1}. ${REGISTRY_TYPES.find((type) => type.id === debtor.typeId).name} · ${labels.join(' · ')}`;
                summary.appendChild(criteria);
                const groupCount = document.createElement('span');
                groupCount.className = 'dup-fssp-registry-search-group-count';
                groupCount.setAttribute('aria-live', 'polite');
                summary.appendChild(groupCount);
                group.appendChild(summary);
                const tableWrap = document.createElement('div');
                tableWrap.className = 'dup-fssp-registry-search-group-table-wrap';
                const table = document.createElement('table');
                table.className = 'dup-fssp-registry-search-results-table';
                table.innerHTML = `<thead><tr><th>№</th>${debtor.fields.map((field) => `<th>${field.label}</th>`).join('')}<th>Идентификатор реестра</th></tr></thead><tbody></tbody>`;
                tableWrap.appendChild(table);
                group.appendChild(tableWrap);
                const navigation = document.createElement('div');
                navigation.className = 'dup-fssp-registry-search-pagination';
                navigation.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0';
                for (const [label, delta] of [['Назад', -1], ['Далее', 1]]) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = label;
                    button.dataset.delta = String(delta);
                    button.addEventListener('click', () => {
                        group.dataset.page = String(Number(group.dataset.page || 0) + delta);
                        renderSearchResults(modal, debtors);
                    });
                    navigation.appendChild(button);
                    if (delta === -1) navigation.appendChild(document.createElement('span'));
                }
                group.appendChild(navigation);
                group.addEventListener('toggle', () => renderSearchResults(modal, debtors));
                container.appendChild(group);
            }
            group.querySelector('.dup-fssp-registry-search-group-count').textContent = `Найдено: ${debtor.matches.size}`;
            group.dataset.hasMatches = String(debtor.matches.size > 0);
            const tbody = group.querySelector('tbody');
            // Closed groups retain only their summary, regardless of result size.
            if (!group.open) {
                if (tbody.children.length) tbody.replaceChildren();
                delete group.dataset.matchCount;
                return;
            }
            // Keep the disclosure and its focus intact as other registries finish.
            const metadataRevision = String(debtor.metadataRevision || 0);
            const pageNumber = String(group.dataset.page || 0);
            if (group.dataset.matchCount === String(debtor.matches.size) && group.dataset.metadataRevision === metadataRevision && group.dataset.renderedPage === pageNumber && debtor.matches.size > 0) return;
            group.dataset.metadataRevision = metadataRevision;
            group.dataset.matchCount = String(debtor.matches.size);
            group.dataset.renderedPage = pageNumber;
            const page = resultPage(debtor, Number(pageNumber));
            group.dataset.page = String(page.current);
            group.dataset.renderedPage = String(page.current);
            const navigation = group.querySelector('.dup-fssp-registry-search-pagination');
            navigation.querySelector('span').textContent = `Страница ${page.current + 1} из ${page.pageCount} · по ${RESULT_PAGE_SIZE} строк`;
            navigation.querySelector('[data-delta="-1"]').disabled = page.current === 0;
            navigation.querySelector('[data-delta="1"]').disabled = page.current + 1 >= page.pageCount;
            tbody.replaceChildren();
            if (!debtor.matches.size) {
                const emptyRow = document.createElement('tr');
                emptyRow.className = 'dup-fssp-registry-search-results-empty';
                const emptyCell = document.createElement('td');
                emptyCell.colSpan = debtor.fields.length + 2;
                emptyCell.textContent = emptyMessage;
                emptyRow.appendChild(emptyCell);
                tbody.appendChild(emptyRow);
                return;
            }
            page.matches.forEach((match, index) => {
                const registryId = match.registryId;
                const row = document.createElement('tr');
                const indexCell = document.createElement('td');
                indexCell.className = 'dup-fssp-registry-search-index';
                indexCell.textContent = String(page.start + index + 1);
                row.appendChild(indexCell);
                debtor.fields.forEach((definition) => {
                    const cell = document.createElement('td');
                    cell.className = 'dup-fssp-registry-search-result-value';
                    cell.textContent = normalizeText(match.values && match.values[definition.key]) || '—';
                    row.appendChild(cell);
                });
                const registryCell = document.createElement('td');
                const link = document.createElement('a');
                link.className = 'dup-fssp-registry-search-link';
                link.href = buildMatchUrl(registryId, match);
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = `${registryId} · ${match.registryTypeName || 'Тип не указан'}${match.department ? ` · ${baseLabel(match.baseOrigin)} · ${matchDepartments(match)}` : ''}`;
                link.title = `Тип реестра: ${match.registryTypeName || 'не указан'}\nОткрыть реестр ${registryId} и показать найденного должника`;
                registryCell.appendChild(link);
                row.appendChild(registryCell);
                tbody.appendChild(row);
            });
        });
    }

    function sortedMatches(debtor) {
        return Array.from(debtor.matches.values()).sort((leftMatch, rightMatch) => {
            const left = BigInt(leftMatch.registryId);
            const right = BigInt(rightMatch.registryId);
            return left === right ? 0 : left > right ? -1 : 1;
        });
    }

    function escapeExcelXml(value) {
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    // Local, uncompressed ZIP, following the existing INN/death-date XLSX exporter.
    function excelZip(files) {
        const encoder = new TextEncoder();
        const chunks = [];
        const central = [];
        let offset = 0;
        const push16 = (target, value) => target.push(value & 255, (value >>> 8) & 255);
        const push32 = (target, value) => target.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
        files.forEach(([path, content]) => {
            const name = encoder.encode(path);
            const data = encoder.encode(content);
            let crc = 0xFFFFFFFF;
            for (const byte of data) {
                crc ^= byte;
                for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
            }
            crc = (crc ^ 0xFFFFFFFF) >>> 0;
            const local = [];
            push32(local, 0x04034B50); push16(local, 20); push16(local, 0x0800); push16(local, 0); push16(local, 0); push16(local, 33);
            push32(local, crc); push32(local, data.length); push32(local, data.length); push16(local, name.length); push16(local, 0);
            chunks.push(new Uint8Array(local), name, data);
            const header = [];
            push32(header, 0x02014B50); push16(header, 20); push16(header, 20); push16(header, 0x0800); push16(header, 0); push16(header, 0); push16(header, 33);
            push32(header, crc); push32(header, data.length); push32(header, data.length); push16(header, name.length);
            push16(header, 0); push16(header, 0); push16(header, 0); push16(header, 0); push32(header, 0); push32(header, offset);
            central.push(new Uint8Array(header), name);
            offset += local.length + name.length + data.length;
        });
        const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
        const end = [];
        push32(end, 0x06054B50); push16(end, 0); push16(end, 0); push16(end, files.length); push16(end, files.length);
        push32(end, centralSize); push32(end, offset); push16(end, 0);
        return new Blob([...chunks, ...central, new Uint8Array(end)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function excelColumnName(index) {
        let result = '';
        for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
            result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
        }
        return result;
    }

    function excelSourceValue(value) {
        if (value == null) return '';
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    function buildSearchWorkbook(debtors) {
        const fields = new Set(debtors.flatMap((debtor) => debtor.fields.map((definition) => definition.field)));
        debtors.forEach((debtor) => debtor.matches.forEach((match) => {
            Object.keys(match.sourceValues || {}).forEach((field) => fields.add(field));
        }));
        fields.add('FileName');
        const sourceFields = Array.from(fields);
        const columnCount = sourceFields.length + 5;
        if (columnCount > 16384) throw new Error('Результаты превышают допустимое число столбцов листа Excel.');
        const lastColumn = excelColumnName(columnCount - 1);
        const headers = ['Параметры поиска', '№', ...sourceFields.map((field) => field === 'FileName' ? 'Имя файла (FileName)' : field === 'EDNumber' ? 'Номер ИД / номер дела (возбуждение ИП)' : FIELD_LABELS[field] || field), 'База', 'Департаменты', 'Идентификатор реестра'];
        const rows = [];
        const links = [];
        const linkRelations = [];
        const appendRow = (values, attributes = '', style = 0) => {
            const number = rows.length + 1;
            if (number > 1048576) throw new Error('Результаты превышают допустимое число строк листа Excel.');
            const cells = values.map((value, index) => `<c r="${excelColumnName(index)}${number}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeExcelXml(value)}</t></is></c>`).join('');
            rows.push(`<row r="${number}" ${attributes}>${cells}</row>`);
            return number;
        };
        appendRow(headers, 'ht="30" customHeight="1"', 1);
        debtors.forEach((debtor) => {
            const matches = sortedMatches(debtor);
            const criteria = REGISTRY_TYPES.find((type) => type.id === debtor.typeId).name + ' · ' + (debtor.collectAll ? 'Все строки' : debtor.fields.filter((field) => debtor.values[field.key])
                .map((field) => `${field.label}: ${debtor.values[field.key]}`).join(' · '));
            if (!matches.length) {
                appendRow([criteria, ...Array(columnCount - 1).fill('')]);
            }
            matches.forEach((match, index) => {
                const number = appendRow([criteria, String(index + 1), ...sourceFields.map((field) => excelSourceValue(field === 'FileName' ? match.registryFileName ?? match.sourceValues?.FileName : match.sourceValues && match.sourceValues[field])), baseLabel(match.baseOrigin), matchDepartments(match), `${match.registryId} · ${match.registryTypeName || 'Тип не указан'}`]);
                const relationId = `rId${links.length + 1}`;
                links.push(`<hyperlink ref="${lastColumn}${number}" r:id="${relationId}"/>`);
                linkRelations.push(`<Relationship Id="${relationId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeExcelXml(buildMatchUrl(match.registryId, match))}" TargetMode="External"/>`);
            });
        });
        const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
        const documentRelationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        const styles = `<styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${['FFE8F1ED', 'FFDFF2E5', 'FFFFF3C4'].map((color) => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4">${[0, 2, 3, 4].map((fill, index) => `<xf numFmtId="49" fontId="${index ? 1 : 0}" fillId="${fill}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
        const columns = headers.map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 0 ? 60 : index === 1 ? 6 : index === columnCount - 1 ? 48 : header === 'ФИО' ? 38 : 30}" customWidth="1"/>`).join('');
        const worksheet = `<worksheet xmlns="${main}" xmlns:r="${documentRelationships}"><dimension ref="A1:${lastColumn}${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${columns}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length}"/>${links.length ? `<hyperlinks>${links.join('')}</hyperlinks>` : ''}</worksheet>`;
        return excelZip([
            ['[Content_Types].xml', `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
            ['_rels/.rels', `${xml}<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${documentRelationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
            ['xl/workbook.xml', `${xml}<workbook xmlns="${main}" xmlns:r="${documentRelationships}"><sheets><sheet name="Результаты поиска" sheetId="1" r:id="rId1"/></sheets></workbook>`],
            ['xl/_rels/workbook.xml.rels', `${xml}<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${documentRelationships}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${documentRelationships}/styles" Target="styles.xml"/></Relationships>`],
            ['xl/styles.xml', xml + styles],
            ['xl/worksheets/sheet1.xml', xml + worksheet],
            ['xl/worksheets/_rels/sheet1.xml.rels', `${xml}<Relationships xmlns="${relationships}">${linkRelations.join('')}</Relationships>`]
        ]);
    }

    function exportSearchResults(modal) {
        if (!activeRun || !activeRun.debtors.length) return;
        try {
            const blob = buildSearchWorkbook(activeRun.debtors);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Поиск_ИД_в_реестрах_${activeRun.status === 'complete' ? 'полный' : 'частичный'}_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
            modal.appendChild(link);
            try {
                link.click();
            } finally {
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
            setNotice(modal, `Выгружено совпадений: ${countMatches(activeRun.debtors)}. ${searchOutcome(activeRun)}`,
                activeRun.status === 'complete' ? 'success' : activeRun.status === 'failed' ? 'error' : undefined);
        } catch (error) {
            setNotice(modal, error && error.message ? error.message : 'Не удалось выгрузить результаты в Excel.', 'error');
        }
    }

    function sendRuntimeMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message || 'Не удалось обратиться к фоновому процессу.'));
                    return;
                }
                resolve(response);
            });
        });
    }

    async function getGridState() {
        const response = await sendRuntimeMessage({ action: GRID_STATE_ACTION });
        if (!response || response.success !== true || !response.state) {
            throw new Error(response && response.error ? response.error : 'Не удалось прочитать текущие фильтры списка.');
        }
        return response.state;
    }

    function buildRequestUrl(endpoint, params) {
        const url = new URL(endpoint, window.location.origin);
        if (url.origin !== window.location.origin) throw new Error('Запрос к другой базе заблокирован.');
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value == null || typeof value === 'object') return;
            url.searchParams.set(key, String(value));
        });
        url.searchParams.set('nd', String(Date.now()));
        return url;
    }

    function waitForRetry(delay, signal) {
        return new Promise((resolve, reject) => {
            const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, delay);
            if (signal.aborted) cancel();
            else signal.addEventListener('abort', cancel, { once: true });
        });
    }

    async function fetchJson(url, signal, run) {
        for (let attempt = 1; ; attempt += 1) {
            if (run) await waitForRunResume(run);
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const controller = new AbortController();
            const abort = () => controller.abort();
            signal.addEventListener('abort', abort, { once: true });
            const timeout = setTimeout(abort, 45000);
            let failure;
            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal: controller.signal
                });
                const responseText = await response.text();
                if (!response.ok) {
                    const error = new Error(`HTTP ${response.status}`);
                    error.permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
                    throw error;
                }
                if (response.redirected && /\/login(?:\/|\?|$)/i.test(new URL(response.url).pathname)) {
                    const error = new Error('Сеанс сайта завершён. Войдите в систему для продолжения поиска.');
                    error.permanent = true;
                    throw error;
                }
                try {
                    const json = JSON.parse(responseText);
                    if (attempt > 1 && activeRun === run) {
                        const modal = document.getElementById(MODAL_ID);
                        if (modal) setNotice(modal, 'Связь восстановлена. Поиск продолжается без пропуска реестров.');
                    }
                    return json;
                } catch (error) {
                    throw new Error('Пирамида вернула ответ не в формате JSON.');
                }
            } catch (error) {
                if (signal.aborted || error.permanent) throw error;
                failure = isAbortError(error) ? 'Сервер не ответил за 45 секунд.' : error.message;
            } finally {
                clearTimeout(timeout);
                signal.removeEventListener('abort', abort);
            }
            const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt - 1, 5));
            if (activeRun === run) {
                const modal = document.getElementById(MODAL_ID);
                if (modal) setNotice(modal, `Ожидаем восстановления связи. ${failure} Повтор ${attempt} через ${delay / 1000} с. Реестр не пропущен.`);
            }
            await waitForRetry(delay, signal);
        }
    }

    function waitForRunResume(run) {
        if (run.controller.signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
        if (!run.paused) return Promise.resolve();
        return new Promise((resolve) => run.pauseWaiters.push(resolve)).then(() => {
            if (run.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        });
    }

    function extractRegistryPageRows(json, seenRegistryIds) {
        const registries = [];
        const sourceRows = Array.isArray(json && json.rows) ? json.rows : [];
        sourceRows.forEach((item) => {
            const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
            const registryId = normalizeText(cell.Id || (item && item.id));
            if (!/^\d+$/.test(registryId) || seenRegistryIds.has(registryId)) return;
            seenRegistryIds.add(registryId);
            registries.push({
                registryId,
                typeId: normalizeText(cell.FSSPReestrTypeId),
                typeName: normalizeText(cell.TypeName),
                statusName: normalizeText(cell.StatusName),
                fileName: normalizeText(cell.FileName),
                lastProcessing: normalizeText(cell.LastProcessing)
            });
        });
        return registries;
    }

    async function scanFilteredRegistryPages(gridState, run, modal) {
        const baseParams = { ...(gridState.postData || {}) };
        delete baseParams.nd;
        baseParams.rows = LIST_PAGE_SIZE;
        baseParams.page = 1;
        baseParams.sidx = gridState.sortname || baseParams.sidx || 'CreateDate';
        baseParams.sord = gridState.sortorder || baseParams.sord || 'desc';
        const endpoint = gridState.url || `${LIST_PATH}/data`;
        const seenRegistryIds = new Set();
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page += 1) {
            await waitForRunResume(run);
            setProgress(modal, page - 1, totalPages, `Загружаю страницу ${page}`, `${page} / ${totalPages} стр.`);
            const json = await fetchJson(buildRequestUrl(endpoint, { ...baseParams, page }), run.controller.signal, run);
            totalPages = Math.max(1, Number(json && json.total || totalPages));
            run.totalPages = totalPages;
            const filteredJson = { ...json, rows: (json.rows || []).filter((item) => registryMatchesFilters(item.cell, run.filters)) };
            const registries = extractRegistryPageRows(filteredJson, seenRegistryIds).filter((registry) =>
                run.debtors.some((debtor) => registryMatchesType(registry, debtor.typeId)));
            run.discovered += registries.length;
            if (registries.length) {
                setNotice(modal, `Страница ${page} из ${totalPages}: проверяю ${registries.length} реестров.`);
                await scanRegistries(registries, run, modal, page, totalPages);
            } else {
                setProgress(modal, page, totalPages, `Страница ${page} проверена`, `${page} / ${totalPages} стр. · найдено ${countMatches(run.debtors)}`);
            }
        }
        return { totalPages, registryCount: seenRegistryIds.size };
    }

    async function collectRegistryRows(registryId, run) {
        const endpoint = `${LIST_PATH}/${encodeURIComponent(registryId)}/typedata`;
        const baseParams = { _search: false, rows: DETAIL_PAGE_SIZE, page: 1, sidx: 'Id', sord: 'asc' };
        await waitForRunResume(run);
        const firstPage = await fetchJson(buildRequestUrl(endpoint, baseParams), run.controller.signal, run);
        const totalPages = Math.max(1, Number(firstPage && firstPage.total || 1));
        const totalRows = Math.max(0, Number(firstPage && firstPage.records || 0));
        const sourceRows = Array.isArray(firstPage && firstPage.rows) ? firstPage.rows.slice() : [];
        for (let page = 2; page <= totalPages; page += 1) {
            await waitForRunResume(run);
            const json = await fetchJson(buildRequestUrl(endpoint, { ...baseParams, page }), run.controller.signal, run);
            if (Array.isArray(json && json.rows)) sourceRows.push(...json.rows);
        }
        return {
            totalRows,
            rows: sourceRows.map((item, position) => ({
                rowId: normalizeText((item && item.id) || (item && item.cell && item.cell.Id)),
                position,
                cell: item && item.cell && typeof item.cell === 'object' ? item.cell : {}
            }))
        };
    }

    function debtorMatchesCell(debtor, cell) {
        if (debtor.collectAll) return true;
        return debtor.fields.every((definition) => {
            const query = normalizeMatchValue(debtor.values[definition.key]);
            if (!query) return true;
            const actual = normalizeMatchValue(cell && cell[definition.field]);
            if (query === 'null') return actual === '';
            if (DATE_FIELDS.has(definition.field)) {
                const matched = matchesDateQuery(query, actual);
                if (matched !== null) return matched;
            }
            return actual.includes(query);
        });
    }

    function registryMatchesType(registry, typeId) {
        if (registry.typeId) return registry.typeId === typeId;
        return registry.typeName === REGISTRY_TYPES.find((type) => type.id === typeId)?.name;
    }

    function isNoDataRegistry(registry) {
        const status = normalizeMatchValue(registry && registry.statusName);
        return status === 'проведен (нет данных)' || status === 'проведено (нет данных)';
    }

    async function inspectRegistry(registry, run, modal) {
        const debtors = run.debtors.filter((debtor) => registryMatchesType(registry, debtor.typeId));
        if (!debtors.length) return;
        const fingerprint = registryFingerprint(registry);
        const departmentsChanged = observeRegistryDepartment(registry, run);
        if (run.checkedRegistries.has(fingerprint)) {
            run.skipped += 1;
            if (departmentsChanged) renderSearchResults(modal, run.debtors);
            return;
        }
        if (isNoDataRegistry(registry)) { run.checkedRegistries.add(fingerprint); return; }
        const registryData = await collectRegistryRows(registry.registryId, run);
        if (!registryData.rows.length) { run.checkedRegistries.add(fingerprint); return; }
        let resultsChanged = false;
        const departments = run.registryDepartments.get(fingerprint) || [run.departments[run.departmentIndex]];
        debtors.forEach((debtor) => {
            registryData.rows.forEach((match) => {
                if (!debtorMatchesCell(debtor, match.cell)) return;
                const values = {};
                debtor.fields.forEach((definition) => {
                    values[definition.key] = normalizeText(match.cell && match.cell[definition.field]);
                });
                debtor.matches.set(`${window.location.origin}:${registry.registryId}:${match.position}`, {
                    registryId: registry.registryId,
                    registryTypeName: registry.typeName,
                    registryFileName: registry.fileName,
                    rowId: match.rowId,
                    position: match.position,
                    totalRows: registryData.totalRows || registryData.rows.length,
                    values,
                    sourceValues: match.cell,
                    baseOrigin: window.location.origin,
                    department: run.departments[run.departmentIndex],
                    registryFingerprint: fingerprint,
                    departments
                });
                resultsChanged = true;
            });
        });
        run.checkedRegistries.add(fingerprint);
        if (resultsChanged) run.registryDepartments.set(fingerprint, departments);
        if (resultsChanged) renderSearchResults(modal, run.debtors);
    }

    function countMatches(debtors) {
        return debtors.reduce((sum, debtor) => sum + debtor.matches.size, 0);
    }

    function searchOutcome(run) {
        const counts = `Полностью проверено департаментов: ${run.completedDepartments || 0} из ${run.departments.length}. Проверено реестров: ${run.completed || 0}.`;
        if (run.status === 'complete') return `Поиск завершён. Результат полный. ${counts}`;
        if (run.status === 'failed') return `Поиск прерван. Результат частичный. ${counts}`;
        if (run.status === 'paused') return `Поиск на паузе. Результат частичный. ${counts}`;
        return `Поиск ещё не завершён. Результат частичный. ${counts}`;
    }

    async function scanRegistries(registries, run, modal, page, totalPages) {
        let cursor = 0;
        let pageCompleted = 0;
        const workers = Array.from({ length: Math.min(REQUEST_CONCURRENCY, Math.max(1, registries.length)) }, async () => {
            while (!run.controller.signal.aborted) {
                await waitForRunResume(run);
                const index = cursor;
                cursor += 1;
                if (index >= registries.length) return;
                try {
                    await inspectRegistry(registries[index], run, modal);
                } catch (error) {
                    if (isAbortError(error)) throw error;
                    run.errorCount += 1;
                    throw error;
                } finally {
                    run.completed += 1;
                    pageCompleted += 1;
                    setProgress(
                        modal,
                        (page - 1) + (pageCompleted / Math.max(1, registries.length)),
                        totalPages,
                        `Проверяю страницу ${page} из ${totalPages}`,
                        `проверено ${run.completed} · найдено ${countMatches(run.debtors)}`
                    );
                }
            }
        });
        await Promise.all(workers);
    }

    async function performSearch(run, modal) {
        try {
            const department = run.departments[run.departmentIndex];
            if (currentDepartment()?.key !== department.key) throw new Error('Активный департамент изменился. Поиск остановлен.');
            setNotice(modal, `Ищу: ${department.label} (depid ${department.depid}), ${run.departmentIndex + 1}/${run.departments.length} департаментов…`);
            setProgress(modal, 0, 1, 'Подготовка поиска', '');
            const gridState = await getGridState();
            const result = await scanFilteredRegistryPages(searchGridState(gridState, run), run, modal);
            if (run.controller.signal.aborted) return;
            await waitForRunResume(run);
            run.completedDepartments = run.departmentIndex + 1;
            if (run.departmentIndex + 1 < run.departments.length) {
                run.departmentIndex += 1;
                try { await navigateDepartment(run, modal); }
                catch (error) { run.departmentIndex -= 1; throw error; }
                return;
            }
            run.status = 'complete';
            const found = countMatches(run.debtors);
            renderSearchResults(modal, run.debtors, 'Совпадений не найдено.');
            const errorSuffix = run.errorCount ? ` Не удалось прочитать: ${run.errorCount}.` : '';
            setProgress(modal, result.totalPages, result.totalPages, 'Поиск завершён', `${result.registryCount} реестров`);
            setNotice(modal, `${searchOutcome(run)} Найдено записей: ${found}. Пропущено ранее проверенных реестров: ${run.skipped}.${errorSuffix}`, run.errorCount ? 'error' : 'success');
            await clearSavedRun().catch((error) => console.warn('[FSSP search cleanup]', error));
        } catch (error) {
            if (isAbortError(error) || run.controller.signal.aborted) return;
            run.status = 'failed';
            run.controller.abort();
            await saveRun(run, 'failed').catch(() => {});
            setProgress(modal, 0, 1, 'Поиск прерван — результат частичный', `Проверено ${run.completed} · найдено ${countMatches(run.debtors)}`);
            setNotice(modal, `${searchOutcome(run)} Причина: ${error?.message || 'Неизвестная ошибка.'}`, 'error');
        } finally {
            if (activeRun === run && run.status !== 'running' && run.status !== 'paused') {
                modal.querySelector('.dup-fssp-registry-search-submit').disabled = false;
                modal.querySelector('.dup-fssp-registry-search-stop').hidden = true;
            }
        }
    }

    function toggleSearchPause(modal) {
        const run = activeRun;
        if (!run || (run.status !== 'running' && run.status !== 'paused')) return;
        const stopButton = modal.querySelector('.dup-fssp-registry-search-stop');
        if (run.status === 'running') {
            run.status = 'paused';
            run.paused = true;
            stopButton.textContent = 'Продолжить';
            stopButton.classList.add('is-paused');
            stopButton.setAttribute('aria-pressed', 'true');
            setNotice(modal, 'Поиск приостановлен. Уже начатые запросы завершаются, новые не запускаются.');
            void saveRun(run, 'paused').catch((error) => setNotice(modal, error.message, 'error'));
            return;
        }
        run.status = 'running';
        run.paused = false;
        stopButton.textContent = 'Стоп';
        stopButton.classList.remove('is-paused');
        stopButton.setAttribute('aria-pressed', 'false');
        run.pauseWaiters.splice(0).forEach((resolve) => resolve());
        setNotice(modal, 'Поиск продолжен.');
        void saveRun(run, 'running').catch((error) => setNotice(modal, error.message, 'error'));
    }

    function startSearch(modal) {
        if (restoringSession) { setNotice(modal, 'Подождите восстановления предыдущего поиска.'); return; }
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) return;
        const filters = readRegistryFilters(modal);
        const typeFilter = filters.find((rule) => rule.field === 'TypeName');
        const debtors = readDebtors(modal).filter((debtor) => !typeFilter || (Array.isArray(typeFilter.data) ? typeFilter.data : [typeFilter.data]).includes(REGISTRY_TYPES.find((type) => type.id === debtor.typeId).name));
        if (!debtors.length) {
            setNotice(modal, 'Введите хотя бы одно условие поиска или отметьте «Собирать все строки» в блоке выбранного типа реестра.', 'error');
            const firstInput = modal.querySelector('.dup-fssp-registry-search-input-table input');
            if (firstInput) firstInput.focus();
            return;
        }
        const selected = selectedChoices(modal.querySelector('[data-departments]'));
        const departments = collectDepartments().filter((department) => selected.includes(department.key));
        if (!departments.length) { setNotice(modal, 'Выберите хотя бы один департамент.', 'error'); return; }
        departments.sort((left, right) => Number(right.active) - Number(left.active));
        lockDebtorRows(modal, debtors);
        modal.querySelectorAll('.dup-fssp-registry-search-settings').forEach((block) => { block.open = false; });
        modal.querySelectorAll('.dup-fssp-registry-search-settings input, .dup-fssp-registry-search-settings button').forEach((control) => { control.disabled = true; });
        modal.querySelector('.dup-fssp-registry-search-submit').disabled = true;
        const stopButton = modal.querySelector('.dup-fssp-registry-search-stop');
        stopButton.hidden = false;
        stopButton.disabled = false;
        stopButton.textContent = 'Стоп';
        stopButton.classList.remove('is-paused');
        stopButton.setAttribute('aria-pressed', 'false');
        activeRun = {
            status: 'running',
            paused: false,
            pauseWaiters: [],
            controller: new AbortController(),
            debtors,
            filters,
            completed: 0,
            errorCount: 0,
            discovered: 0,
            totalPages: 1
        };
        Object.assign(activeRun, { departments, departmentIndex: 0, checkedRegistries: new Set(), registryDepartments: new Map(), skipped: 0 });
        void continueDepartmentSearch(activeRun, modal);
    }

    function waitFor(predicate, timeoutMs) {
        const startedAt = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                const value = predicate();
                if (value) {
                    resolve(value);
                    return;
                }
                if (Date.now() - startedAt >= timeoutMs) {
                    reject(new Error('Истекло время ожидания таблицы реестра.'));
                    return;
                }
                setTimeout(check, 120);
            };
            check();
        });
    }

    function dispatchChange(element) {
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function dispatchEnter(element) {
        ['keydown', 'keypress', 'keyup'].forEach((type) => {
            element.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        });
    }

    function clearMatchQueryParams() {
        const url = new URL(window.location.href);
        ['dup_fssp_match', 'dup_fssp_pos', 'dup_fssp_total', 'dup_fssp_dep', 'dup_fssp_open', 'dup_fssp_base'].forEach((key) => url.searchParams.delete(key));
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function revealLinkedRow() {
        const detailMatch = String(window.location.pathname || '').match(DETAIL_PATH_PATTERN);
        if (!detailMatch) return;
        const params = new URLSearchParams(window.location.search);
        const rowId = normalizeText(params.get('dup_fssp_match'));
        if (!rowId) return;
        const expectedDepid = params.get('dup_fssp_dep');
        if (expectedDepid && currentDepartment()?.depid !== expectedDepid) {
            try {
                const department = collectDepartments().find((d) => d.depid === expectedDepid && d.origin === window.location.origin);
                if (!department) throw new Error('Нет доступа к департаменту найденной записи.');
                window.location.assign(departmentSwitchUrl(department, window.location.pathname, params));
            } catch (error) {
                window.alert(error.message);
            }
            return;
        }
        ensureStyles();
        const totalRows = Math.max(0, Number(params.get('dup_fssp_total') || 0));
        const position = Math.max(0, Number(params.get('dup_fssp_pos') || 0));
        try {
            const pageSizeSelect = await waitFor(() => document.querySelector('select.ui-pg-selbox, select[aria-label="Записей на стр."]'), 20000);
            await waitFor(() => {
                const loadedRows = document.querySelectorAll('#list tbody > tr.jqgrow').length;
                const pagingText = normalizeText(document.querySelector('.ui-paging-info')?.textContent);
                return loadedRows > 0 && pagingText && !/из\s+0$/i.test(pagingText);
            }, 20000);
            const sizes = Array.from(pageSizeSelect.options || [])
                .map((option) => Number(option.value || option.textContent))
                .filter((value) => Number.isFinite(value) && value > 0)
                .sort((left, right) => left - right);
            const maxSize = sizes[sizes.length - 1] || DETAIL_PAGE_SIZE;
            const selectedSize = sizes.find((value) => totalRows > 0 && value >= totalRows) || maxSize;
            if (Number(pageSizeSelect.value) !== selectedSize) {
                pageSizeSelect.value = String(selectedSize);
                dispatchChange(pageSizeSelect);
                const expectedVisibleRows = totalRows > 0 ? Math.min(selectedSize, totalRows) : 1;
                await waitFor(() => document.querySelectorAll('#list tbody > tr.jqgrow').length >= expectedVisibleRows, 25000);
            }
            const targetPage = Math.floor(position / selectedSize) + 1;
            const pageInput = await waitFor(() => document.querySelector('input.ui-pg-input, input[aria-label="Page No."]'), 20000);
            if (Number(pageInput.value) !== targetPage) {
                pageInput.value = String(targetPage);
                dispatchEnter(pageInput);
            }
            const row = await waitFor(() => {
                const direct = document.getElementById(rowId);
                if (direct && direct.matches('#list tr.jqgrow, #list tr')) return direct;
                return Array.from(document.querySelectorAll('#list tbody > tr.jqgrow')).find((candidate) => normalizeText(candidate.id) === rowId) || null;
            }, 25000);
            row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            row.classList.remove(HIGHLIGHT_CLASS);
            void row.offsetWidth;
            row.classList.add(HIGHLIGHT_CLASS);
            window.setTimeout(() => row.classList.remove(HIGHLIGHT_CLASS), 2600);
        } catch (error) {
            console.warn('[FSSP Registry Search] Не удалось показать найденную строку:', error);
        } finally {
            clearMatchQueryParams();
        }
    }

    function initialize() {
        if (routeLinkedRegistry()) return;
        ensureStyles();
        if (isListPage()) {
            ensureToolbarButton();
            toolbarObserver = new MutationObserver(() => ensureToolbarButton());
            toolbarObserver.observe(document.documentElement, { childList: true, subtree: true });
            void restoreSearchSession();
        }
        void revealLinkedRow();
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (closeChoicePicker) {
                event.preventDefault();
                event.stopImmediatePropagation();
                closeChoicePicker();
                return;
            }
            const modal = document.getElementById(MODAL_ID);
            if (modal && !modal.hidden) closeModal();
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
