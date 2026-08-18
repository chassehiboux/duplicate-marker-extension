(function () {
    'use strict';

    const LIST_PATH = '/call-center/reestrs/view';
    const DETAIL_PATH = '/call-center/tasks/view';
    const DATA_PATH = '/call-center/tasks/data';
    const SECTION = 'debt_claim';
    const BUTTON_ID = 'dup-call-center-registry-search-button';
    const MODAL_ID = 'dup-call-center-registry-search-modal';
    const STYLE_ID = 'dup-call-center-registry-search-style';
    const UI_CLASS = 'dup-call-center-registry-search-ui';
    const ROW_CLASS = 'dup-call-center-registry-search-row';
    const HIGHLIGHT_CLASS = 'dup-call-center-registry-search-match';
    const PAGE_SIZE = 300;
    const REQUEST_CONCURRENCY = 3;
    const SEARCH_TABS = Object.freeze([
        { key: 'queue', label: 'Очередь' },
        { key: 'work', label: 'В работе' },
        { key: 'archive', label: 'Архив' }
    ]);
    const FIELD_DEFINITIONS = Object.freeze([
        { key: 'accountNumber', field: 'AccountNumber', label: 'ЛС' },
        { key: 'phoneNumber', field: 'PhoneNumber', label: 'Номер телефона' },
        { key: 'fullAddress', field: 'FullAddress', label: 'Адрес' },
        { key: 'abonentFullName', field: 'AbonentFullName', label: 'ФИО абонента' },
        { key: 'edNumber', field: 'EDNumber', label: 'Номер ИД' },
        { key: 'solidarityType', field: 'SolidarityType', label: 'Тип взыскания' }
    ]);

    let activeRun = null;
    let toolbarObserver = null;

    function normalizeText(value) {
        return String(value == null ? '' : value)
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isDebtClaimPage() {
        return new URLSearchParams(window.location.search).get('section') === SECTION;
    }

    function isListPage() {
        return String(window.location.pathname || '').replace(/\/+$/, '') === LIST_PATH && isDebtClaimPage();
    }

    function isDetailPage() {
        return String(window.location.pathname || '').replace(/\/+$/, '') === DETAIL_PATH && isDebtClaimPage();
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
                --cc-search-ink: #24342f;
                --cc-search-muted: #6f7e79;
                --cc-search-line: #ccd8d3;
                --cc-search-surface: #f8fbf9;
                --cc-search-accent: #237a58;
                --cc-search-accent-dark: #195b41;
                position: fixed;
                inset: 0;
                z-index: 2147483500;
                display: grid;
                place-items: center;
                padding: 8px;
                background: rgba(17, 31, 27, .58);
                backdrop-filter: blur(2px);
                font-family: "Segoe UI", Tahoma, sans-serif;
                color: var(--cc-search-ink);
            }
            #${MODAL_ID} .dup-cc-registry-search-dialog {
                width: min(1360px, calc(100vw - 16px));
                height: calc(100vh - 16px);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(36, 52, 47, .28);
                border-radius: 8px;
                background: var(--cc-search-surface);
                box-shadow: 0 24px 70px rgba(8, 24, 19, .34);
            }
            #${MODAL_ID} .dup-cc-registry-search-header {
                position: static;
                inset: auto;
                width: auto;
                flex: 0 0 auto;
                display: flex;
                align-items: flex-start;
                gap: 18px;
                padding: 16px 20px 13px;
                border-bottom: 1px solid var(--cc-search-line);
                background: linear-gradient(135deg, #edf6f1 0%, #f9fbfa 68%, #e7f1ed 100%);
            }
            #${MODAL_ID} .dup-cc-registry-search-heading { flex: 1; min-width: 0; }
            #${MODAL_ID} h2 {
                margin: 0;
                font-family: Georgia, "Times New Roman", serif;
                font-size: 22px;
                line-height: 1.15;
                color: #183d30;
            }
            #${MODAL_ID} .dup-cc-registry-search-subtitle {
                margin-top: 5px;
                color: var(--cc-search-muted);
                font-size: 12px;
                line-height: 1.35;
            }
            #${MODAL_ID} .dup-cc-registry-search-close {
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
            #${MODAL_ID} .dup-cc-registry-search-close:hover,
            #${MODAL_ID} .dup-cc-registry-search-close:focus-visible {
                border-color: #9fb4ac;
                background: #fff;
                color: #183d30;
                outline: none;
            }
            #${MODAL_ID} .dup-cc-registry-search-body {
                flex: 1 1 auto;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                padding: 14px 20px 16px;
            }
            #${MODAL_ID} .dup-cc-registry-search-table-wrap {
                overflow: auto;
                border: 1px solid var(--cc-search-line);
                border-radius: 6px;
                background: #fff;
            }
            #${MODAL_ID} .dup-cc-registry-search-input-wrap {
                flex: 0 1 auto;
                max-height: 220px;
            }
            #${MODAL_ID} .dup-cc-registry-search-results {
                flex: 1 1 auto;
                min-height: 180px;
                display: flex;
                flex-direction: column;
                margin-top: 12px;
            }
            #${MODAL_ID} .dup-cc-registry-search-results-heading {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
                margin: 0 2px 7px;
            }
            #${MODAL_ID} .dup-cc-registry-search-results-title {
                color: #29453b;
                font-family: Georgia, "Times New Roman", serif;
                font-size: 16px;
                font-weight: 700;
            }
            #${MODAL_ID} .dup-cc-registry-search-results-count {
                color: var(--cc-search-muted);
                font-size: 12px;
            }
            #${MODAL_ID} .dup-cc-registry-search-results-wrap {
                flex: 1 1 auto;
                min-height: 0;
            }
            #${MODAL_ID} table {
                width: 100%;
                min-width: 1120px;
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
            #${MODAL_ID} .dup-cc-registry-search-results-table th:last-child,
            #${MODAL_ID} .dup-cc-registry-search-results-table td:last-child { width: 120px; }
            #${MODAL_ID} td {
                padding: 7px 8px;
                border-bottom: 1px solid #e2eae7;
                background: #fff;
                vertical-align: top;
            }
            #${MODAL_ID} tbody tr:last-child td { border-bottom: 0; }
            #${MODAL_ID} tbody tr:nth-child(even) td { background: #fbfdfc; }
            #${MODAL_ID} .dup-cc-registry-search-index {
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
            #${MODAL_ID} input::placeholder { color: #82908b; opacity: .62; font-size: 11px; }
            #${MODAL_ID} input:focus {
                border-color: var(--cc-search-accent);
                box-shadow: 0 0 0 2px rgba(35, 122, 88, .14);
                outline: none;
            }
            #${MODAL_ID} input[readonly] { background: #f5f8f6; color: #485a54; }
            #${MODAL_ID} .dup-cc-registry-search-result-value {
                overflow-wrap: anywhere;
                color: #344b43;
                font-size: 12px;
                line-height: 1.35;
            }
            #${MODAL_ID} .dup-cc-registry-search-result-link {
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
            }
            #${MODAL_ID} .dup-cc-registry-search-result-link:hover,
            #${MODAL_ID} .dup-cc-registry-search-result-link:focus-visible {
                border-color: var(--cc-search-accent);
                background: #d7eee4;
                color: #0c4d34;
                outline: none;
            }
            #${MODAL_ID} .dup-cc-registry-search-results-empty td {
                padding: 24px 16px;
                color: #75857f;
                text-align: center;
            }
            #${MODAL_ID} .dup-cc-registry-search-progress[hidden] { display: none; }
            #${MODAL_ID} .dup-cc-registry-search-progress { margin-top: 12px; }
            #${MODAL_ID} .dup-cc-registry-search-progress-track {
                height: 6px;
                overflow: hidden;
                border-radius: 999px;
                background: #dbe5e1;
            }
            #${MODAL_ID} .dup-cc-registry-search-progress-bar {
                width: 0;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #2c8b65, #56b38d);
                transition: width .2s ease;
            }
            #${MODAL_ID} .dup-cc-registry-search-progress-copy {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                margin-top: 7px;
                color: #5f716b;
                font-size: 12px;
            }
            #${MODAL_ID} .dup-cc-registry-search-notice {
                min-height: 18px;
                margin-top: 8px;
                color: #5d6e68;
                font-size: 12px;
            }
            #${MODAL_ID} .dup-cc-registry-search-notice[data-tone="error"] { color: #a33d35; }
            #${MODAL_ID} .dup-cc-registry-search-notice[data-tone="success"] { color: #176344; }
            #${MODAL_ID} .dup-cc-registry-search-actions {
                flex: 0 0 auto;
                display: flex;
                justify-content: flex-end;
                gap: 9px;
                padding: 10px 0;
                border-bottom: 1px solid var(--cc-search-line);
            }
            #${MODAL_ID} .dup-cc-registry-search-action {
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
            #${MODAL_ID} .dup-cc-registry-search-action:hover:not(:disabled) { background: #e9f0ed; }
            #${MODAL_ID} .dup-cc-registry-search-submit {
                border-color: var(--cc-search-accent-dark);
                background: var(--cc-search-accent);
                color: #fff;
            }
            #${MODAL_ID} .dup-cc-registry-search-submit:hover:not(:disabled) { background: var(--cc-search-accent-dark); }
            #${MODAL_ID} .dup-cc-registry-search-stop[hidden] { display: none; }
            #${MODAL_ID} .dup-cc-registry-search-stop { border-color: #a85b35; background: #fff7f1; color: #8a3f20; }
            #${MODAL_ID} .dup-cc-registry-search-stop:hover:not(:disabled) { background: #f9e6d9; }
            #${MODAL_ID} .dup-cc-registry-search-stop.is-paused {
                border-color: var(--cc-search-accent-dark);
                background: #e6f3ed;
                color: var(--cc-search-accent-dark);
            }
            #${MODAL_ID} button:disabled { cursor: default; opacity: .55; }
            html.dup-ext-screenshot-mode .${UI_CLASS},
            html.dup-ui-hide-call-center-registry-search .${UI_CLASS} { display: none !important; }
            @keyframes dup-cc-registry-search-flash {
                0%, 100% { background-color: transparent; box-shadow: none; }
                50% { background-color: #98e6b7; box-shadow: inset 0 0 0 2px #278b52; }
            }
            tr.${HIGHLIGHT_CLASS} > td { animation: dup-cc-registry-search-flash .72s ease-in-out 3; }
            @media (max-width: 760px) {
                #${MODAL_ID} .dup-cc-registry-search-header,
                #${MODAL_ID} .dup-cc-registry-search-body { padding-left: 12px; padding-right: 12px; }
            }
            @media (prefers-reduced-motion: reduce) {
                #${MODAL_ID} .dup-cc-registry-search-progress-bar { transition: none; }
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
        button.setAttribute('title', 'Найти абонента во всех реестрах взыскания');
        button.innerHTML = '<div class="ui-pg-div"><span class="fa fa-lg fa-fw fa-search"></span><span class="ui-pg-button-text">Найти в реестрах</span></div>';
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
        const anchor = candidates.find((element) => normalizeText(element.textContent) === 'Добавить комментарий');
        if (anchor instanceof HTMLElement && anchor.parentElement instanceof HTMLElement) {
            anchor.insertAdjacentElement('afterend', createToolbarButton());
            return;
        }
        const toolbar = document.querySelector('#pager_left .navtable');
        if (toolbar instanceof HTMLElement) toolbar.appendChild(createToolbarButton());
    }

    function createInputCell(definition) {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.dataset.field = definition.key;
        input.setAttribute('aria-label', definition.label);
        input.placeholder = 'часть значения';
        cell.appendChild(input);
        return cell;
    }

    function updateRowNumbers(tbody) {
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row, index) => {
            const cell = row.querySelector('.dup-cc-registry-search-index');
            if (cell) cell.textContent = String(index + 1);
        });
    }

    function appendInputRow(tbody) {
        const row = document.createElement('tr');
        row.className = ROW_CLASS;
        const indexCell = document.createElement('td');
        indexCell.className = 'dup-cc-registry-search-index';
        row.appendChild(indexCell);
        FIELD_DEFINITIONS.forEach((definition) => row.appendChild(createInputCell(definition)));
        row.addEventListener('input', () => {
            const rows = Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`));
            if (rows[rows.length - 1] !== row) return;
            const hasValue = FIELD_DEFINITIONS.some((definition) => (
                normalizeText(row.querySelector(`input[data-field="${definition.key}"]`)?.value) !== ''
            ));
            if (hasValue) appendInputRow(tbody);
        });
        tbody.appendChild(row);
        updateRowNumbers(tbody);
        return row;
    }

    function renderEmptyResults(modal, message = 'Найденные совпадения появятся здесь во время поиска.') {
        const tbody = modal.querySelector('.dup-cc-registry-search-results-table tbody');
        const count = modal.querySelector('.dup-cc-registry-search-results-count');
        if (!(tbody instanceof HTMLElement)) return;
        tbody.replaceChildren();
        const row = document.createElement('tr');
        row.className = 'dup-cc-registry-search-results-empty';
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.textContent = message;
        row.appendChild(cell);
        tbody.appendChild(row);
        if (count instanceof HTMLElement) count.textContent = 'Совпадений: 0';
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
            <section class="dup-cc-registry-search-dialog" role="dialog" aria-modal="true" aria-labelledby="dup-cc-registry-search-title">
                <div class="dup-cc-registry-search-header">
                    <div class="dup-cc-registry-search-heading">
                        <h2 id="dup-cc-registry-search-title">Найти в реестрах взыскания</h2>
                        <div class="dup-cc-registry-search-subtitle">В одной строке должны совпасть все заполненные поля. Разные строки ищутся независимо. Проверяются очередь, работа и архив.</div>
                    </div>
                    <button type="button" class="dup-cc-registry-search-close" aria-label="Закрыть окно">×</button>
                </div>
                <div class="dup-cc-registry-search-body">
                    <div class="dup-cc-registry-search-table-wrap dup-cc-registry-search-input-wrap">
                        <table class="dup-cc-registry-search-input-table">
                            <thead><tr><th>№</th><th>ЛС</th><th>Номер телефона</th><th>Адрес</th><th>ФИО абонента</th><th>Номер ИД</th><th>Тип взыскания</th></tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div class="dup-cc-registry-search-actions">
                        <button type="button" class="dup-cc-registry-search-action dup-cc-registry-search-cancel">Закрыть</button>
                        <button type="button" class="dup-cc-registry-search-action dup-cc-registry-search-stop" aria-pressed="false" hidden>Стоп</button>
                        <button type="button" class="dup-cc-registry-search-action dup-cc-registry-search-submit">Поиск</button>
                    </div>
                    <div class="dup-cc-registry-search-progress" hidden>
                        <div class="dup-cc-registry-search-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dup-cc-registry-search-progress-bar"></div></div>
                        <div class="dup-cc-registry-search-progress-copy"><span class="dup-cc-registry-search-progress-label">Подготовка…</span><span class="dup-cc-registry-search-progress-count"></span></div>
                    </div>
                    <div class="dup-cc-registry-search-notice" role="status" aria-live="polite"></div>
                    <section class="dup-cc-registry-search-results" aria-labelledby="dup-cc-registry-search-results-title">
                        <div class="dup-cc-registry-search-results-heading">
                            <div id="dup-cc-registry-search-results-title" class="dup-cc-registry-search-results-title">Результаты поиска</div>
                            <div class="dup-cc-registry-search-results-count">Совпадений: 0</div>
                        </div>
                        <div class="dup-cc-registry-search-table-wrap dup-cc-registry-search-results-wrap">
                            <table class="dup-cc-registry-search-results-table">
                                <thead><tr><th>№</th><th>ЛС</th><th>Номер телефона</th><th>Адрес</th><th>ФИО абонента</th><th>Номер ИД</th><th>Тип взыскания</th><th>№ реестра</th></tr></thead>
                                <tbody aria-live="polite" aria-relevant="additions text"></tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </section>
        `;
        (document.body || document.documentElement).appendChild(modal);
        appendInputRow(modal.querySelector('.dup-cc-registry-search-input-table tbody'));
        renderEmptyResults(modal);
        const close = () => closeModal();
        modal.querySelector('.dup-cc-registry-search-close').addEventListener('click', close);
        modal.querySelector('.dup-cc-registry-search-cancel').addEventListener('click', close);
        modal.querySelector('.dup-cc-registry-search-stop').addEventListener('click', () => toggleSearchPause(modal));
        modal.querySelector('.dup-cc-registry-search-submit').addEventListener('click', () => startSearch(modal));
        modal.addEventListener('mousedown', (event) => {
            if (event.target === modal) closeModal();
        });
        return modal;
    }

    function resetModal(modal) {
        const tbody = modal.querySelector('.dup-cc-registry-search-input-table tbody');
        tbody.replaceChildren();
        appendInputRow(tbody);
        renderEmptyResults(modal);
        modal.querySelector('.dup-cc-registry-search-progress').hidden = true;
        modal.querySelector('.dup-cc-registry-search-notice').textContent = '';
        modal.querySelector('.dup-cc-registry-search-notice').removeAttribute('data-tone');
        modal.querySelector('.dup-cc-registry-search-submit').disabled = false;
        const stopButton = modal.querySelector('.dup-cc-registry-search-stop');
        stopButton.hidden = true;
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
        requestAnimationFrame(() => modal.querySelector('input')?.focus());
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) {
            activeRun.status = 'cancelled';
            activeRun.controller.abort();
            activeRun.pauseWaiters.splice(0).forEach((resolve) => resolve());
        }
        activeRun = null;
        if (modal) modal.hidden = true;
    }

    function setNotice(modal, text, tone) {
        const notice = modal.querySelector('.dup-cc-registry-search-notice');
        notice.textContent = text || '';
        if (tone) notice.dataset.tone = tone;
        else notice.removeAttribute('data-tone');
    }

    function setProgress(modal, current, total, label, suffix) {
        const progress = modal.querySelector('.dup-cc-registry-search-progress');
        const track = progress.querySelector('[role="progressbar"]');
        const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
        progress.hidden = false;
        track.setAttribute('aria-valuenow', String(percent));
        progress.querySelector('.dup-cc-registry-search-progress-bar').style.width = `${percent}%`;
        progress.querySelector('.dup-cc-registry-search-progress-label').textContent = label || 'Поиск';
        progress.querySelector('.dup-cc-registry-search-progress-count').textContent = suffix || `${current} / ${total}`;
    }

    function readCriteria(modal) {
        return Array.from(modal.querySelectorAll(`tr.${ROW_CLASS}`)).map((row, index) => {
            const values = {};
            FIELD_DEFINITIONS.forEach((definition) => {
                values[definition.key] = normalizeText(row.querySelector(`input[data-field="${definition.key}"]`)?.value);
            });
            return Object.values(values).some(Boolean) ? { index, row, values } : null;
        }).filter(Boolean);
    }

    function lockCriteriaRows(modal, criteria) {
        const tbody = modal.querySelector('.dup-cc-registry-search-input-table tbody');
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row) => {
            if (!criteria.some((item) => item.row === row)) row.remove();
        });
        criteria.forEach((item) => item.row.querySelectorAll('input').forEach((input) => { input.readOnly = true; }));
        updateRowNumbers(tbody);
    }

    function buildRequestUrl(params) {
        const url = new URL(DATA_PATH, window.location.origin);
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value != null) url.searchParams.set(key, String(value));
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

    function buildFilters(criteria) {
        return JSON.stringify({
            groupOp: 'AND',
            rules: FIELD_DEFINITIONS.map((definition) => ({
                field: definition.field,
                op: 'cn',
                data: criteria.values[definition.key]
            })).filter((rule) => rule.data)
        });
    }

    function buildResultUrl(result) {
        const url = new URL(DETAIL_PATH, window.location.origin);
        url.searchParams.set('section', SECTION);
        url.searchParams.set('reestrId', result.reestrId);
        url.searchParams.set('tab', result.tab);
        url.searchParams.set('dup_cc_match', result.taskId);
        return url.toString();
    }

    function appendResults(modal, run, json, tabKey) {
        const sourceRows = Array.isArray(json && json.rows) ? json.rows : [];
        const tbody = modal.querySelector('.dup-cc-registry-search-results-table tbody');
        const count = modal.querySelector('.dup-cc-registry-search-results-count');
        sourceRows.forEach((item) => {
            const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
            const taskId = normalizeText(cell.CallCenterTaskID || (item && item.id));
            const reestrId = normalizeText(cell.ReestrID);
            if (!taskId || !reestrId || run.resultIds.has(taskId)) return;
            run.resultIds.add(taskId);
            const result = { taskId, reestrId, tab: tabKey, cell };
            run.results.push(result);
            if (run.results.length === 1) tbody.replaceChildren();
            const row = document.createElement('tr');
            const indexCell = document.createElement('td');
            indexCell.className = 'dup-cc-registry-search-index';
            indexCell.textContent = String(run.results.length);
            row.appendChild(indexCell);
            FIELD_DEFINITIONS.forEach((definition) => {
                const valueCell = document.createElement('td');
                valueCell.className = 'dup-cc-registry-search-result-value';
                valueCell.textContent = normalizeText(cell[definition.field]) || '—';
                row.appendChild(valueCell);
            });
            const registryCell = document.createElement('td');
            const link = document.createElement('a');
            link.className = 'dup-cc-registry-search-result-link';
            link.href = buildResultUrl(result);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = reestrId;
            link.title = `Открыть реестр ${reestrId} (${SEARCH_TABS.find((tab) => tab.key === tabKey)?.label || tabKey})`;
            registryCell.appendChild(link);
            row.appendChild(registryCell);
            tbody.appendChild(row);
        });
        if (count instanceof HTMLElement) count.textContent = `Совпадений: ${run.results.length}`;
    }

    async function scanUnit(unit, run, modal, totalUnits) {
        const filters = buildFilters(unit.criteria);
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page += 1) {
            await waitForRunResume(run);
            const json = await fetchJson(buildRequestUrl({
                section: SECTION,
                tab: unit.tab.key,
                _search: true,
                rows: PAGE_SIZE,
                page,
                sidx: 'CallCenterTaskID',
                sord: 'desc',
                filters
            }), run.controller.signal);
            totalPages = Math.max(1, Number(json && json.total || totalPages));
            appendResults(modal, run, json, unit.tab.key);
            setProgress(
                modal,
                run.completedUnits + (page / totalPages),
                totalUnits,
                `Проверяю: ${unit.tab.label}`,
                `${run.completedUnits} из ${totalUnits} · найдено ${run.results.length}`
            );
        }
    }

    async function performSearch(run, modal) {
        const units = [];
        run.criteria.forEach((criteria) => SEARCH_TABS.forEach((tab) => units.push({ criteria, tab })));
        let cursor = 0;
        try {
            setNotice(modal, 'Запускаю поиск по очереди, работе и архиву…');
            setProgress(modal, 0, units.length, 'Подготовка поиска', `0 из ${units.length}`);
            const workers = Array.from({ length: Math.min(REQUEST_CONCURRENCY, units.length) }, async () => {
                while (!run.controller.signal.aborted) {
                    await waitForRunResume(run);
                    const index = cursor;
                    cursor += 1;
                    if (index >= units.length) return;
                    try {
                        await scanUnit(units[index], run, modal, units.length);
                    } catch (error) {
                        if (isAbortError(error)) throw error;
                        run.errorCount += 1;
                    } finally {
                        run.completedUnits += 1;
                        setProgress(
                            modal,
                            run.completedUnits,
                            units.length,
                            'Проверяю реестры взыскания',
                            `${run.completedUnits} из ${units.length} · найдено ${run.results.length}`
                        );
                    }
                }
            });
            await Promise.all(workers);
            if (run.controller.signal.aborted) return;
            run.status = 'complete';
            if (!run.results.length) renderEmptyResults(modal, 'Совпадений не найдено.');
            const errorSuffix = run.errorCount ? ` Не удалось выполнить запросов: ${run.errorCount}.` : '';
            setNotice(modal, `Поиск завершён. Найдено строк: ${run.results.length}.${errorSuffix}`, run.errorCount ? 'error' : 'success');
        } catch (error) {
            if (isAbortError(error) || run.controller.signal.aborted) return;
            run.status = 'failed';
            setNotice(modal, error && error.message ? error.message : 'Поиск завершился ошибкой.', 'error');
        } finally {
            if (activeRun === run && run.status !== 'running' && run.status !== 'paused') {
                modal.querySelector('.dup-cc-registry-search-submit').disabled = false;
                modal.querySelector('.dup-cc-registry-search-stop').hidden = true;
            }
        }
    }

    function toggleSearchPause(modal) {
        const run = activeRun;
        if (!run || (run.status !== 'running' && run.status !== 'paused')) return;
        const button = modal.querySelector('.dup-cc-registry-search-stop');
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
        modal.querySelector('.dup-cc-registry-search-submit').disabled = true;
        const stopButton = modal.querySelector('.dup-cc-registry-search-stop');
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
            completedUnits: 0,
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

    function clearMatchParams() {
        const url = new URL(window.location.href);
        url.searchParams.delete('dup_cc_match');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function revealLinkedTask() {
        if (!isDetailPage()) return;
        const taskId = normalizeText(new URLSearchParams(window.location.search).get('dup_cc_match'));
        if (!taskId) return;
        ensureStyles();
        try {
            const pageSize = await waitFor(() => document.querySelector('select.ui-pg-selbox, select[aria-label="Записей на стр."]'), 20000);
            const sizes = Array.from(pageSize.options || [])
                .map((option) => Number(option.value || option.textContent))
                .filter((value) => Number.isFinite(value) && value > 0)
                .sort((left, right) => left - right);
            const maxSize = sizes[sizes.length - 1] || 2000;
            if (Number(pageSize.value) !== maxSize) {
                pageSize.value = String(maxSize);
                dispatchChange(pageSize);
                await new Promise((resolve) => setTimeout(resolve, 300));
                await waitFor(() => !isGridLoading(), 25000);
            }
            const pageInput = await waitFor(() => document.querySelector('input.ui-pg-input, input[aria-label="Page No."]'), 20000);
            const pagingText = normalizeText(pageInput.parentElement?.textContent || '');
            const pageMatch = pagingText.match(/из\s+(\d+)/i);
            const totalPages = Math.max(1, Number(pageMatch && pageMatch[1] || 1));
            let target = document.getElementById(taskId);
            for (let page = 1; !target && page <= totalPages; page += 1) {
                if (Number(pageInput.value) !== page) {
                    pageInput.value = String(page);
                    dispatchEnter(pageInput);
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    await waitFor(() => !isGridLoading() && Number(pageInput.value) === page, 25000);
                }
                target = document.getElementById(taskId);
            }
            if (!(target instanceof HTMLElement)) throw new Error('Найденная строка отсутствует в реестре.');
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            target.classList.remove(HIGHLIGHT_CLASS);
            void target.offsetWidth;
            target.classList.add(HIGHLIGHT_CLASS);
            window.setTimeout(() => target.classList.remove(HIGHLIGHT_CLASS), 2600);
        } catch (error) {
            console.warn('[Call Center Registry Search] Не удалось показать найденную строку:', error);
        } finally {
            clearMatchParams();
        }
    }

    function initialize() {
        ensureStyles();
        if (isListPage()) {
            ensureToolbarButton();
            toolbarObserver = new MutationObserver(() => ensureToolbarButton());
            toolbarObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
        void revealLinkedTask();
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
