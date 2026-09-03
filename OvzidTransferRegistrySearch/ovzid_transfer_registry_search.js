(function() {
    'use strict';

    const LIST_PATH = '/pu/ReestrSendToOVZID';
    const DETAIL_PATH_PATTERN = /^\/pu\/ReestrSendToOVZID\/(\d+)\/?$/i;
    const BUTTON_ID = 'dup-ovzid-transfer-registry-search-button';
    const MODAL_ID = 'dup-ovzid-transfer-registry-search-modal';
    const STYLE_ID = 'dup-ovzid-transfer-registry-search-style';
    const UI_CLASS = 'dup-ovzid-transfer-registry-search-ui';
    const SHARED_UI_CLASS = 'dup-fssp-registry-search-ui';
    const ROW_CLASS = 'dup-ovzid-transfer-registry-search-row';
    const HIGHLIGHT_CLASS = 'dup-ovzid-transfer-registry-search-match';
    const GRID_STATE_ACTION = 'OVZID_TRANSFER_REGISTRY_SEARCH_GET_GRID_STATE';
    const MATCH_PARAM = 'dup_ovzid_transfer_match';
    const LIST_PAGE_SIZE = 500;
    const DETAIL_PAGE_SIZE = 2000;
    const REQUEST_CONCURRENCY = 4;
    const FIELD_DEFINITIONS = Object.freeze([
        { key: 'accountNumber', field: 'AccAddress_AccountNumber', label: 'ЛС' },
        { key: 'edNumber', field: 'EDNumber', label: 'Номер ИД' },
        { key: 'caseNumber', field: 'CaseNumber', label: 'Номер дела' },
        { key: 'fullName', field: 'Individual_FullName', label: 'ФИО' },
        { key: 'birthDate', field: 'Individual_Birthdate', label: 'Дата рождения' }
    ]);

    let activeRun = null;
    let toolbarObserver = null;

    function normalizeText(value) {
        return String(value == null ? '' : value)
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeMatchValue(value) {
        return normalizeText(value).toLocaleLowerCase('ru-RU');
    }

    function normalizedPathname() {
        return String(window.location.pathname || '').replace(/\/+$/, '');
    }

    function isListPage() {
        return normalizedPathname() === LIST_PATH;
    }

    function isDetailPage() {
        return DETAIL_PATH_PATTERN.test(normalizedPathname());
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
                --ors-ink: #24342f;
                --ors-muted: #6f7e79;
                --ors-line: #ccd8d3;
                --ors-surface: #f8fbf9;
                --ors-accent: #237a58;
                --ors-accent-dark: #195b41;
                position: fixed;
                inset: 0;
                z-index: 2147483600;
                display: grid;
                place-items: center;
                padding: 24px;
                background: rgba(21, 35, 31, .54);
                color: var(--ors-ink);
                font-family: "Segoe UI", Tahoma, sans-serif;
            }
            #${MODAL_ID} .dup-ors-dialog {
                width: min(1120px, calc(100vw - 32px));
                max-height: calc(100vh - 32px);
                overflow: hidden;
                border: 1px solid #aebfba;
                border-radius: 10px;
                background: var(--ors-surface);
                box-shadow: 0 24px 70px rgba(14, 33, 27, .28);
            }
            #${MODAL_ID} .dup-ors-header {
                display: flex;
                position: static;
                align-items: flex-start;
                gap: 16px;
                padding: 18px 22px 16px;
                border-bottom: 1px solid var(--ors-line);
                background: linear-gradient(110deg, #eff7f3 0%, #f9fbfa 62%, #e4f0eb 100%);
            }
            #${MODAL_ID} .dup-ors-heading { flex: 1; min-width: 0; }
            #${MODAL_ID} h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
            #${MODAL_ID} .dup-ors-subtitle { margin-top: 5px; color: var(--ors-muted); font-size: 13px; }
            #${MODAL_ID} .dup-ors-close {
                width: 32px;
                height: 32px;
                border: 1px solid transparent;
                border-radius: 7px;
                background: transparent;
                color: #51615c;
                font-size: 24px;
                line-height: 26px;
            }
            #${MODAL_ID} .dup-ors-close:hover,
            #${MODAL_ID} .dup-ors-close:focus-visible { border-color: #adc1ba; background: #fff; outline: none; }
            #${MODAL_ID} .dup-ors-body { max-height: calc(100vh - 132px); overflow: auto; padding: 18px 22px 22px; }
            #${MODAL_ID} .dup-ors-table-wrap { overflow: auto; border: 1px solid var(--ors-line); border-radius: 7px; background: #fff; }
            #${MODAL_ID} table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            #${MODAL_ID} th,
            #${MODAL_ID} td { padding: 8px 9px; border-right: 1px solid #e1e9e6; border-bottom: 1px solid #e1e9e6; text-align: left; vertical-align: middle; }
            #${MODAL_ID} th { position: sticky; top: 0; z-index: 1; background: #edf4f1; color: #3c514a; font-size: 12px; font-weight: 650; }
            #${MODAL_ID} th:first-child,
            #${MODAL_ID} td:first-child { width: 42px; text-align: center; }
            #${MODAL_ID} th:last-child,
            #${MODAL_ID} td:last-child { border-right: 0; }
            #${MODAL_ID} tbody tr:last-child td { border-bottom: 0; }
            #${MODAL_ID} input {
                width: 100%;
                min-width: 120px;
                height: 32px;
                box-sizing: border-box;
                border: 1px solid #b9c9c3;
                border-radius: 5px;
                padding: 5px 8px;
                background: #fff;
                color: var(--ors-ink);
            }
            #${MODAL_ID} input:focus { border-color: var(--ors-accent); box-shadow: 0 0 0 2px rgba(35, 122, 88, .13); outline: none; }
            #${MODAL_ID} input[readonly] { background: #f1f4f3; color: #596963; }
            #${MODAL_ID} .dup-ors-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
            #${MODAL_ID} .dup-ors-action {
                min-height: 34px;
                border: 1px solid #aebdb8;
                border-radius: 6px;
                padding: 7px 15px;
                background: #fff;
                color: #30433d;
                font-weight: 600;
            }
            #${MODAL_ID} .dup-ors-action:hover:not(:disabled) { background: #e9f0ed; }
            #${MODAL_ID} .dup-ors-submit { border-color: var(--ors-accent-dark); background: var(--ors-accent); color: #fff; }
            #${MODAL_ID} .dup-ors-submit:hover:not(:disabled) { background: var(--ors-accent-dark); }
            #${MODAL_ID} .dup-ors-stop { border-color: #a85b35; background: #fff7f1; color: #8a3f20; }
            #${MODAL_ID} .dup-ors-stop.is-paused { border-color: var(--ors-accent-dark); background: #edf7f2; color: var(--ors-accent-dark); }
            #${MODAL_ID} button:disabled { cursor: default; opacity: .55; }
            #${MODAL_ID} .dup-ors-progress[hidden] { display: none; }
            #${MODAL_ID} .dup-ors-progress { margin-top: 14px; }
            #${MODAL_ID} .dup-ors-progress-track { height: 7px; overflow: hidden; border-radius: 99px; background: #dfe8e5; }
            #${MODAL_ID} .dup-ors-progress-bar { width: 0; height: 100%; background: linear-gradient(90deg, #237a58, #52a77f); transition: width .18s ease; }
            #${MODAL_ID} .dup-ors-progress-copy { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; color: var(--ors-muted); font-size: 12px; }
            #${MODAL_ID} .dup-ors-notice { min-height: 20px; margin-top: 10px; color: #4e625b; font-size: 13px; }
            #${MODAL_ID} .dup-ors-notice[data-tone="error"] { color: #a33d35; }
            #${MODAL_ID} .dup-ors-notice[data-tone="success"] { color: #176344; }
            #${MODAL_ID} .dup-ors-results { margin-top: 16px; }
            #${MODAL_ID} .dup-ors-results-heading { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 7px; }
            #${MODAL_ID} .dup-ors-results-title { font-weight: 650; }
            #${MODAL_ID} .dup-ors-results-count { color: var(--ors-muted); }
            #${MODAL_ID} .dup-ors-results-wrap { max-height: 330px; }
            #${MODAL_ID} .dup-ors-result-value { overflow-wrap: anywhere; }
            #${MODAL_ID} .dup-ors-result-link { color: #176344; font-weight: 700; text-decoration: none; }
            #${MODAL_ID} .dup-ors-result-link:hover,
            #${MODAL_ID} .dup-ors-result-link:focus-visible { text-decoration: underline; outline: none; }
            #${MODAL_ID} .dup-ors-results-empty td { padding: 22px; text-align: center; color: var(--ors-muted); }
            html.dup-ui-hide-fssp-registry-search .${UI_CLASS} { display: none !important; }
            @keyframes dup-ors-search-flash {
                0%, 100% { box-shadow: inset 0 0 0 999px transparent; }
                50% { box-shadow: inset 0 0 0 999px rgba(55, 166, 108, .28); }
            }
            tr.${HIGHLIGHT_CLASS} > td { animation: dup-ors-search-flash .72s ease-in-out 3; }
            @media (max-width: 760px) {
                #${MODAL_ID} { padding: 8px; }
                #${MODAL_ID} .dup-ors-dialog { width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
                #${MODAL_ID} .dup-ors-header,
                #${MODAL_ID} .dup-ors-body { padding-left: 12px; padding-right: 12px; }
            }
            @media (prefers-reduced-motion: reduce) {
                #${MODAL_ID} .dup-ors-progress-bar { transition: none; }
                tr.${HIGHLIGHT_CLASS} > td { animation: none; background: #dff2e8 !important; }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function createToolbarButton() {
        const button = document.createElement('div');
        button.id = BUTTON_ID;
        button.className = `btn btn-xs ui-pg-button ${UI_CLASS} ${SHARED_UI_CLASS}`;
        button.tabIndex = 0;
        button.setAttribute('role', 'button');
        button.setAttribute('title', 'Найти ИД во всех отфильтрованных реестрах передачи в ОВЗИД');
        button.innerHTML = '<div class="ui-pg-div"><span class="fa fa-lg fa-fw fa-search"></span><span class="ui-pg-button-text">Найти ИД в реестрах</span></div>';
        const activate = (event) => {
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openModal();
        };
        button.addEventListener('click', activate);
        button.addEventListener('keydown', activate);
        return button;
    }

    function ensureToolbarButton() {
        if (!isListPage() || document.getElementById(BUTTON_ID)) return;
        const candidates = Array.from(document.querySelectorAll('[role="button"], button, .ui-pg-button'));
        const anchor = candidates.find((element) => normalizeText(element.textContent) === 'Дата отправки в ОВЗИД') ||
            candidates.find((element) => normalizeText(element.textContent) === 'Сформировать акт передачи');
        if (!(anchor instanceof HTMLElement) || !(anchor.parentElement instanceof HTMLElement)) return;
        anchor.insertAdjacentElement('afterend', createToolbarButton());
    }

    function updateRowNumbers(tbody) {
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row, index) => {
            const cell = row.querySelector('.dup-ors-index');
            if (cell) cell.textContent = String(index + 1);
        });
    }

    function appendInputRow(tbody) {
        const row = document.createElement('tr');
        row.className = ROW_CLASS;
        const indexCell = document.createElement('td');
        indexCell.className = 'dup-ors-index';
        row.appendChild(indexCell);
        FIELD_DEFINITIONS.forEach((definition) => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'search';
            input.dataset.field = definition.key;
            input.setAttribute('aria-label', definition.label);
            input.placeholder = definition.label;
            input.addEventListener('input', () => {
                const rows = Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`));
                const isLast = rows[rows.length - 1] === row;
                const hasValue = Array.from(row.querySelectorAll('input')).some((item) => normalizeText(item.value));
                if (isLast && hasValue) appendInputRow(tbody);
                updateRowNumbers(tbody);
            });
            cell.appendChild(input);
            row.appendChild(cell);
        });
        tbody.appendChild(row);
        updateRowNumbers(tbody);
    }

    function createModal() {
        ensureStyles();
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = `${UI_CLASS} ${SHARED_UI_CLASS}`;
        modal.hidden = true;
        modal.innerHTML = `
            <section class="dup-ors-dialog" role="dialog" aria-modal="true" aria-labelledby="dup-ors-title">
                <div class="dup-ors-header">
                    <div class="dup-ors-heading">
                        <h2 id="dup-ors-title">Найти ИД в реестрах передачи в ОВЗИД</h2>
                        <div class="dup-ors-subtitle">Проверяются все страницы текущего отфильтрованного списка. В одной строке должны совпасть все заполненные поля.</div>
                    </div>
                    <button type="button" class="dup-ors-close" aria-label="Закрыть окно">×</button>
                </div>
                <div class="dup-ors-body">
                    <div class="dup-ors-table-wrap">
                        <table class="dup-ors-input-table">
                            <thead><tr><th>№</th><th>ЛС</th><th>Номер ИД</th><th>Номер дела</th><th>ФИО</th><th>Дата рождения</th></tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div class="dup-ors-actions">
                        <button type="button" class="dup-ors-action dup-ors-cancel">Закрыть</button>
                        <button type="button" class="dup-ors-action dup-ors-stop" aria-pressed="false" hidden>Стоп</button>
                        <button type="button" class="dup-ors-action dup-ors-submit">Поиск</button>
                    </div>
                    <div class="dup-ors-progress" hidden>
                        <div class="dup-ors-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dup-ors-progress-bar"></div></div>
                        <div class="dup-ors-progress-copy"><span class="dup-ors-progress-label">Подготовка…</span><span class="dup-ors-progress-count"></span></div>
                    </div>
                    <div class="dup-ors-notice" role="status" aria-live="polite"></div>
                    <section class="dup-ors-results" aria-labelledby="dup-ors-results-title">
                        <div class="dup-ors-results-heading">
                            <div id="dup-ors-results-title" class="dup-ors-results-title">Результаты поиска</div>
                            <div class="dup-ors-results-count">Совпадений: 0</div>
                        </div>
                        <div class="dup-ors-table-wrap dup-ors-results-wrap">
                            <table class="dup-ors-results-table">
                                <thead><tr><th>№</th><th>ЛС</th><th>Номер ИД</th><th>Номер дела</th><th>ФИО</th><th>Дата рождения</th><th>№ реестра</th></tr></thead>
                                <tbody aria-live="polite" aria-relevant="additions text"></tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </section>
        `;
        (document.body || document.documentElement).appendChild(modal);
        appendInputRow(modal.querySelector('.dup-ors-input-table tbody'));
        modal.querySelector('.dup-ors-close').addEventListener('click', closeModal);
        modal.querySelector('.dup-ors-cancel').addEventListener('click', closeModal);
        modal.querySelector('.dup-ors-stop').addEventListener('click', () => toggleSearchPause(modal));
        modal.querySelector('.dup-ors-submit').addEventListener('click', () => startSearch(modal));
        return modal;
    }

    function openModal() {
        const modal = createModal();
        if (!activeRun || (activeRun.status !== 'running' && activeRun.status !== 'paused')) {
            const tbody = modal.querySelector('.dup-ors-input-table tbody');
            tbody.replaceChildren();
            appendInputRow(tbody);
            renderEmptyResults(modal);
            modal.querySelector('.dup-ors-progress').hidden = true;
            modal.querySelector('.dup-ors-submit').disabled = false;
            modal.querySelector('.dup-ors-stop').hidden = true;
            setNotice(modal, '');
            activeRun = null;
        }
        modal.hidden = false;
        modal.querySelector('input:not([readonly])')?.focus();
    }

    function closeModal() {
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) {
            activeRun.controller.abort();
            activeRun.pauseWaiters.splice(0).forEach((resolve) => resolve());
            activeRun.status = 'cancelled';
        }
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.hidden = true;
    }

    function setNotice(modal, text, tone) {
        const notice = modal.querySelector('.dup-ors-notice');
        notice.textContent = text || '';
        if (tone) notice.dataset.tone = tone;
        else notice.removeAttribute('data-tone');
    }

    function setProgress(modal, current, total, label, suffix) {
        const progress = modal.querySelector('.dup-ors-progress');
        progress.hidden = false;
        const safeTotal = Math.max(1, Number(total) || 1);
        const safeCurrent = Math.max(0, Math.min(safeTotal, Number(current) || 0));
        const percent = Math.round((safeCurrent / safeTotal) * 100);
        progress.querySelector('.dup-ors-progress-bar').style.width = `${percent}%`;
        progress.querySelector('.dup-ors-progress-track').setAttribute('aria-valuenow', String(percent));
        progress.querySelector('.dup-ors-progress-label').textContent = label || 'Поиск';
        progress.querySelector('.dup-ors-progress-count').textContent = suffix || `${safeCurrent} / ${safeTotal}`;
    }

    function renderEmptyResults(modal, message = 'Запустите поиск, чтобы увидеть результаты.') {
        const tbody = modal.querySelector('.dup-ors-results-table tbody');
        const row = document.createElement('tr');
        row.className = 'dup-ors-results-empty';
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = message;
        row.appendChild(cell);
        tbody.replaceChildren(row);
        modal.querySelector('.dup-ors-results-count').textContent = 'Совпадений: 0';
    }

    function readCriteria(modal) {
        return Array.from(modal.querySelectorAll(`tr.${ROW_CLASS}`)).map((row) => {
            const values = {};
            FIELD_DEFINITIONS.forEach((definition) => {
                values[definition.key] = normalizeText(row.querySelector(`[data-field="${definition.key}"]`)?.value);
            });
            return { row, values };
        }).filter((item) => Object.values(item.values).some(Boolean));
    }

    function lockCriteriaRows(modal, criteria) {
        const tbody = modal.querySelector('.dup-ors-input-table tbody');
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row) => {
            if (!criteria.some((item) => item.row === row)) row.remove();
        });
        criteria.forEach((item) => item.row.querySelectorAll('input').forEach((input) => { input.readOnly = true; }));
        updateRowNumbers(tbody);
    }

    function sendRuntimeMessage(message) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message || 'Не удалось связаться с расширением.'));
                        return;
                    }
                    resolve(response);
                });
            } catch (error) {
                reject(error);
            }
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

    async function fetchJson(url, signal) {
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    signal
                });
                const text = await response.text();
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                try {
                    return JSON.parse(text);
                } catch (error) {
                    throw new Error('Пирамида вернула ответ не в формате JSON.');
                }
            } catch (error) {
                if (isAbortError(error)) throw error;
                lastError = error;
                if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }
        throw lastError || new Error('Запрос завершился ошибкой.');
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
        const rows = Array.isArray(json && json.rows) ? json.rows : [];
        rows.forEach((item) => {
            const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
            const registryId = normalizeText(cell.IdReestr || (item && item.id));
            if (!/^\d+$/.test(registryId) || seenRegistryIds.has(registryId)) return;
            seenRegistryIds.add(registryId);
            registries.push({ registryId, cell });
        });
        return registries;
    }

    async function scanFilteredRegistryPages(gridState, run, modal) {
        const baseParams = { ...(gridState.postData || {}) };
        delete baseParams.nd;
        baseParams.rows = LIST_PAGE_SIZE;
        baseParams.page = 1;
        baseParams.sidx = gridState.sortname || baseParams.sidx || 'DateCreation';
        baseParams.sord = gridState.sortorder || baseParams.sord || 'desc';
        const endpoint = gridState.url || `${LIST_PATH}/data`;
        const seen = new Set();
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page += 1) {
            await waitForRunResume(run);
            setProgress(modal, page - 1, totalPages, `Загружаю страницу ${page}`, `${page} / ${totalPages} стр.`);
            const json = await fetchJson(buildRequestUrl(endpoint, { ...baseParams, page }), run.controller.signal);
            totalPages = Math.max(1, Number(json && json.total || totalPages));
            const registries = extractRegistryPageRows(json, seen);
            if (registries.length) {
                setNotice(modal, `Страница ${page} из ${totalPages}: проверяю ${registries.length} реестров.`);
                await scanRegistries(registries, run, modal, page, totalPages);
            } else {
                setProgress(modal, page, totalPages, `Страница ${page} проверена`, `проверено ${run.completed} · найдено ${run.results.length}`);
            }
        }
        return { totalPages, registryCount: seen.size };
    }

    async function collectRegistryRows(registryId, run) {
        const endpoint = `${LIST_PATH}/${encodeURIComponent(registryId)}/data`;
        const baseParams = { _search: false, rows: DETAIL_PAGE_SIZE, page: 1, sidx: 'CreateEDDate', sord: 'asc' };
        await waitForRunResume(run);
        const firstPage = await fetchJson(buildRequestUrl(endpoint, baseParams), run.controller.signal);
        const totalPages = Math.max(1, Number(firstPage && firstPage.total || 1));
        const rows = Array.isArray(firstPage && firstPage.rows) ? firstPage.rows.slice() : [];
        for (let page = 2; page <= totalPages; page += 1) {
            await waitForRunResume(run);
            const json = await fetchJson(buildRequestUrl(endpoint, { ...baseParams, page }), run.controller.signal);
            if (Array.isArray(json && json.rows)) rows.push(...json.rows);
        }
        return rows;
    }

    function criteriaMatchesCell(criteria, cell) {
        return FIELD_DEFINITIONS.every((definition) => {
            const query = normalizeMatchValue(criteria.values[definition.key]);
            if (!query) return true;
            return normalizeMatchValue(cell && cell[definition.field]).includes(query);
        });
    }

    function buildResultUrl(result) {
        const url = new URL(`${LIST_PATH}/${encodeURIComponent(result.registryId)}`, window.location.origin);
        url.searchParams.set(MATCH_PARAM, result.rowId);
        return url.toString();
    }

    function appendResult(modal, run, registryId, item) {
        const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
        const rowId = normalizeText((item && item.id) || cell.EDocID);
        if (!rowId) return;
        const resultKey = `${registryId}:${rowId}`;
        if (run.resultIds.has(resultKey)) return;
        run.resultIds.add(resultKey);
        const result = { registryId, rowId, cell };
        run.results.push(result);
        const tbody = modal.querySelector('.dup-ors-results-table tbody');
        if (run.results.length === 1) tbody.replaceChildren();
        const row = document.createElement('tr');
        const indexCell = document.createElement('td');
        indexCell.textContent = String(run.results.length);
        row.appendChild(indexCell);
        FIELD_DEFINITIONS.forEach((definition) => {
            const valueCell = document.createElement('td');
            valueCell.className = 'dup-ors-result-value';
            valueCell.textContent = normalizeText(cell[definition.field]) || '—';
            row.appendChild(valueCell);
        });
        const registryCell = document.createElement('td');
        const link = document.createElement('a');
        link.className = 'dup-ors-result-link';
        link.href = buildResultUrl(result);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = registryId;
        link.title = `Открыть реестр ${registryId} и показать найденную строку`;
        registryCell.appendChild(link);
        row.appendChild(registryCell);
        tbody.appendChild(row);
        modal.querySelector('.dup-ors-results-count').textContent = `Совпадений: ${run.results.length}`;
    }

    async function inspectRegistry(registry, run, modal) {
        const rows = await collectRegistryRows(registry.registryId, run);
        rows.forEach((item) => {
            const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
            if (run.criteria.some((criteria) => criteriaMatchesCell(criteria, cell))) {
                appendResult(modal, run, registry.registryId, item);
            }
        });
    }

    async function scanRegistries(registries, run, modal, page, totalPages) {
        let cursor = 0;
        let pageCompleted = 0;
        const workers = Array.from({ length: Math.min(REQUEST_CONCURRENCY, registries.length) }, async () => {
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
                } finally {
                    run.completed += 1;
                    pageCompleted += 1;
                    setProgress(
                        modal,
                        (page - 1) + (pageCompleted / Math.max(1, registries.length)),
                        totalPages,
                        `Проверяю страницу ${page} из ${totalPages}`,
                        `проверено ${run.completed} реестров · найдено ${run.results.length}`
                    );
                }
            }
        });
        await Promise.all(workers);
    }

    async function performSearch(run, modal) {
        try {
            setNotice(modal, 'Читаю текущие фильтры списка…');
            setProgress(modal, 0, 1, 'Подготовка поиска', '');
            const gridState = await getGridState();
            const result = await scanFilteredRegistryPages(gridState, run, modal);
            if (!result.registryCount) {
                run.status = 'complete';
                renderEmptyResults(modal, 'По текущим фильтрам реестры не найдены.');
                setProgress(modal, 1, 1, 'Поиск завершён', '0 реестров');
                setNotice(modal, 'По текущим фильтрам реестры не найдены.', 'success');
                return;
            }
            if (run.controller.signal.aborted) return;
            run.status = 'complete';
            if (!run.results.length) renderEmptyResults(modal, 'Совпадений не найдено.');
            const errorSuffix = run.errorCount ? ` Не удалось прочитать реестров: ${run.errorCount}.` : '';
            setProgress(modal, result.totalPages, result.totalPages, 'Поиск завершён', `${result.registryCount} реестров`);
            setNotice(modal, `Найдено совпадений: ${run.results.length}.${errorSuffix}`, run.errorCount ? 'error' : 'success');
        } catch (error) {
            if (isAbortError(error) || run.controller.signal.aborted) return;
            run.status = 'failed';
            setNotice(modal, error && error.message ? error.message : 'Поиск завершился ошибкой.', 'error');
        } finally {
            if (activeRun === run && run.status !== 'running' && run.status !== 'paused') {
                modal.querySelector('.dup-ors-submit').disabled = false;
                modal.querySelector('.dup-ors-stop').hidden = true;
            }
        }
    }

    function toggleSearchPause(modal) {
        const run = activeRun;
        if (!run || (run.status !== 'running' && run.status !== 'paused')) return;
        const button = modal.querySelector('.dup-ors-stop');
        if (run.status === 'running') {
            run.status = 'paused';
            run.paused = true;
            button.textContent = 'Продолжить';
            button.classList.add('is-paused');
            button.setAttribute('aria-pressed', 'true');
            setNotice(modal, 'Поиск приостановлен. Уже начатые запросы завершаются, новые не запускаются.');
            return;
        }
        run.status = 'running';
        run.paused = false;
        button.textContent = 'Стоп';
        button.classList.remove('is-paused');
        button.setAttribute('aria-pressed', 'false');
        run.pauseWaiters.splice(0).forEach((resolve) => resolve());
        setNotice(modal, 'Поиск продолжен.');
    }

    function startSearch(modal) {
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) return;
        const criteria = readCriteria(modal);
        if (!criteria.length) {
            setNotice(modal, 'Введите хотя бы одно поле для поиска.', 'error');
            modal.querySelector('input')?.focus();
            return;
        }
        lockCriteriaRows(modal, criteria);
        renderEmptyResults(modal);
        modal.querySelector('.dup-ors-submit').disabled = true;
        const stopButton = modal.querySelector('.dup-ors-stop');
        stopButton.hidden = false;
        stopButton.textContent = 'Стоп';
        stopButton.classList.remove('is-paused');
        stopButton.setAttribute('aria-pressed', 'false');
        activeRun = {
            status: 'running',
            paused: false,
            pauseWaiters: [],
            controller: new AbortController(),
            criteria,
            results: [],
            resultIds: new Set(),
            completed: 0,
            errorCount: 0
        };
        void performSearch(activeRun, modal);
    }

    function waitFor(predicate, timeoutMs) {
        const startedAt = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                const value = predicate();
                if (value) return resolve(value);
                if (Date.now() - startedAt >= timeoutMs) return reject(new Error('Истекло время ожидания таблицы реестра.'));
                setTimeout(check, 140);
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

    function isGridLoading() {
        const loader = document.querySelector('#load_list, .ui-jqgrid .loading');
        if (!(loader instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(loader);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function clearMatchParam() {
        const url = new URL(window.location.href);
        url.searchParams.delete(MATCH_PARAM);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function revealLinkedRow() {
        if (!isDetailPage()) return;
        const rowId = normalizeText(new URLSearchParams(window.location.search).get(MATCH_PARAM));
        if (!rowId) return;
        ensureStyles();
        try {
            await waitFor(() => document.querySelector('#list'), 20000);
            await waitFor(() => !isGridLoading(), 25000);
            const pageSize = await waitFor(() => document.querySelector('select.ui-pg-selbox, select[aria-label="Записей на стр."]'), 20000);
            const sizes = Array.from(pageSize.options || [])
                .map((option) => Number(option.value || option.textContent))
                .filter((value) => Number.isFinite(value) && value > 0)
                .sort((left, right) => left - right);
            const maxSize = sizes[sizes.length - 1] || DETAIL_PAGE_SIZE;
            if (Number(pageSize.value) !== maxSize) {
                pageSize.value = String(maxSize);
                dispatchChange(pageSize);
                await waitFor(() => !isGridLoading(), 25000);
            }
            const pageInput = await waitFor(() => document.querySelector('input.ui-pg-input, input[aria-label="Page No."]'), 20000);
            const pagingText = normalizeText(pageInput.parentElement?.textContent || '');
            const pageMatch = pagingText.match(/из\s+(\d+)/i);
            const totalPages = Math.max(1, Number(pageMatch && pageMatch[1] || 1));
            let target = document.getElementById(rowId);
            for (let page = 1; !target && page <= totalPages; page += 1) {
                if (Number(pageInput.value) !== page) {
                    pageInput.value = String(page);
                    dispatchEnter(pageInput);
                    await waitFor(() => !isGridLoading() && Number(pageInput.value) === page, 25000);
                }
                target = document.getElementById(rowId);
            }
            if (!(target instanceof HTMLElement)) throw new Error('Найденная строка отсутствует в реестре.');
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            target.classList.remove(HIGHLIGHT_CLASS);
            void target.offsetWidth;
            target.classList.add(HIGHLIGHT_CLASS);
            window.setTimeout(() => target.classList.remove(HIGHLIGHT_CLASS), 2600);
        } catch (error) {
            console.warn('[OVZID Transfer Registry Search] Не удалось показать найденную строку:', error);
        } finally {
            clearMatchParam();
        }
    }

    function initialize() {
        ensureStyles();
        if (isListPage()) {
            ensureToolbarButton();
            toolbarObserver = new MutationObserver(() => ensureToolbarButton());
            toolbarObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
        void revealLinkedRow();
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
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
