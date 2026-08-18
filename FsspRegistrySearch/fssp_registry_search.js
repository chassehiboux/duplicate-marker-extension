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
    const FIELD_DEFINITIONS = Object.freeze([
        { key: 'regNumIp', field: 'RegNumIP', label: 'Номер ИП' },
        { key: 'fullName', field: 'FullName', label: 'ФИО' },
        { key: 'birthDay', field: 'BirthDay', label: 'Д.р. должника' },
        { key: 'edNumber', field: 'EDNumber', label: 'Номер ИД' }
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
                width: min(1120px, calc(100vw - 16px));
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
                overflow: hidden;
                padding: 14px 20px 16px;
            }
            #${MODAL_ID} .dup-fssp-registry-search-table-wrap {
                overflow: auto;
                border: 1px solid var(--fssp-search-line);
                border-radius: 6px;
                background: #fff;
            }
            #${MODAL_ID} .dup-fssp-registry-search-input-wrap {
                flex: 0 1 auto;
                max-height: 220px;
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
            #${MODAL_ID} .dup-fssp-registry-search-results-table td:last-child { width: 150px; }
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
        cell.appendChild(input);
        return cell;
    }

    function updateRowNumbers(tbody) {
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row, index) => {
            const indexCell = row.querySelector('.dup-fssp-registry-search-index');
            if (indexCell) indexCell.textContent = String(index + 1);
        });
    }

    function appendInputRow(tbody) {
        const row = document.createElement('tr');
        row.className = ROW_CLASS;
        const indexCell = document.createElement('td');
        indexCell.className = 'dup-fssp-registry-search-index';
        row.appendChild(indexCell);
        FIELD_DEFINITIONS.forEach((field) => row.appendChild(createInputCell(field)));
        row.addEventListener('input', () => {
            const rows = Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`));
            if (rows[rows.length - 1] !== row) return;
            const hasValue = FIELD_DEFINITIONS.some((field) => {
                const input = row.querySelector(`input[data-field="${field.key}"]`);
                return normalizeText(input && input.value) !== '';
            });
            if (hasValue) {
                appendInputRow(tbody);
                updateRowNumbers(tbody);
            }
        });
        tbody.appendChild(row);
        updateRowNumbers(tbody);
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
                        <div class="dup-fssp-registry-search-subtitle">Поиск пройдёт по всем страницам текущего отфильтрованного списка. Поля одной строки проверяются вместе.</div>
                    </div>
                    <button type="button" class="dup-fssp-registry-search-close" aria-label="Закрыть окно">×</button>
                </header>
                <div class="dup-fssp-registry-search-body">
                    <div class="dup-fssp-registry-search-table-wrap dup-fssp-registry-search-input-wrap">
                        <table class="dup-fssp-registry-search-input-table">
                            <thead><tr><th>№</th><th>Номер ИП</th><th>ФИО</th><th>Д.р. должника</th><th>Номер ИД</th></tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div class="dup-fssp-registry-search-footer">
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
                            <table class="dup-fssp-registry-search-results-table">
                                <thead><tr><th>№</th><th>Номер ИП</th><th>ФИО</th><th>Д.р. должника</th><th>Номер ИД</th><th>ID реестра</th></tr></thead>
                                <tbody aria-live="polite" aria-relevant="additions text"></tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </section>
        `;
        (document.body || document.documentElement).appendChild(modal);
        const tbody = modal.querySelector('.dup-fssp-registry-search-input-table tbody');
        appendInputRow(tbody);
        renderSearchResults(modal, []);
        const close = () => closeModal();
        modal.querySelector('.dup-fssp-registry-search-close').addEventListener('click', close);
        modal.querySelector('.dup-fssp-registry-search-cancel').addEventListener('click', close);
        modal.querySelector('.dup-fssp-registry-search-stop').addEventListener('click', () => toggleSearchPause(modal));
        modal.querySelector('.dup-fssp-registry-search-submit').addEventListener('click', () => startSearch(modal));
        modal.addEventListener('mousedown', (event) => {
            if (event.target === modal) closeModal();
        });
        return modal;
    }

    function resetModal(modal) {
        const tbody = modal.querySelector('.dup-fssp-registry-search-input-table tbody');
        tbody.replaceChildren();
        appendInputRow(tbody);
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

    function readDebtors(modal) {
        return Array.from(modal.querySelectorAll(`tbody tr.${ROW_CLASS}`)).map((row, index) => {
            const values = {};
            FIELD_DEFINITIONS.forEach((field) => {
                const input = row.querySelector(`input[data-field="${field.key}"]`);
                values[field.key] = normalizeText(input && input.value);
            });
            const hasCriteria = Object.values(values).some(Boolean);
            return hasCriteria ? { index, row, values, matches: new Map() } : null;
        }).filter(Boolean);
    }

    function lockDebtorRows(modal, debtors) {
        const tbody = modal.querySelector('.dup-fssp-registry-search-input-table tbody');
        Array.from(tbody.querySelectorAll(`tr.${ROW_CLASS}`)).forEach((row) => {
            if (!debtors.some((debtor) => debtor.row === row)) row.remove();
        });
        debtors.forEach((debtor) => {
            debtor.row.querySelectorAll('input').forEach((input) => { input.readOnly = true; });
        });
        updateRowNumbers(tbody);
        renderSearchResults(modal, debtors);
    }

    function buildMatchUrl(registryId, match) {
        const url = new URL(`${LIST_PATH}/${encodeURIComponent(registryId)}`, window.location.origin);
        url.searchParams.set('dup_fssp_match', String(match.rowId || ''));
        url.searchParams.set('dup_fssp_pos', String(match.position || 0));
        url.searchParams.set('dup_fssp_total', String(match.totalRows || 0));
        return url.toString();
    }

    function renderSearchResults(modal, debtors, emptyMessage = 'Найденные совпадения появятся здесь во время поиска.') {
        const tbody = modal.querySelector('.dup-fssp-registry-search-results-table tbody');
        const count = modal.querySelector('.dup-fssp-registry-search-results-count');
        if (!(tbody instanceof HTMLElement)) return;
        const rows = [];
        (Array.isArray(debtors) ? debtors : []).forEach((debtor) => {
            debtor.matches.forEach((match, registryId) => rows.push({ debtor, registryId, match }));
        });
        tbody.replaceChildren();
        if (count instanceof HTMLElement) count.textContent = `Совпадений: ${rows.length}`;
        if (!rows.length) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'dup-fssp-registry-search-results-empty';
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 6;
            emptyCell.textContent = emptyMessage;
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
            return;
        }
        rows.forEach(({ registryId, match }, index) => {
            const row = document.createElement('tr');
            const indexCell = document.createElement('td');
            indexCell.className = 'dup-fssp-registry-search-index';
            indexCell.textContent = String(index + 1);
            row.appendChild(indexCell);
            FIELD_DEFINITIONS.forEach((definition) => {
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
            link.textContent = registryId;
            link.title = `Открыть реестр ${registryId} и показать найденного должника`;
            registryCell.appendChild(link);
            row.appendChild(registryCell);
            tbody.appendChild(row);
        });
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
                const responseText = await response.text();
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                try {
                    return JSON.parse(responseText);
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
        const sourceRows = Array.isArray(json && json.rows) ? json.rows : [];
        sourceRows.forEach((item) => {
            const cell = item && item.cell && typeof item.cell === 'object' ? item.cell : {};
            const registryId = normalizeText(cell.Id || (item && item.id));
            if (!/^\d+$/.test(registryId) || seenRegistryIds.has(registryId)) return;
            seenRegistryIds.add(registryId);
            registries.push({
                registryId,
                statusName: normalizeText(cell.StatusName)
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
            const json = await fetchJson(buildRequestUrl(endpoint, { ...baseParams, page }), run.controller.signal);
            totalPages = Math.max(1, Number(json && json.total || totalPages));
            run.totalPages = totalPages;
            const registries = extractRegistryPageRows(json, seenRegistryIds);
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
        const firstPage = await fetchJson(buildRequestUrl(endpoint, baseParams), run.controller.signal);
        const totalPages = Math.max(1, Number(firstPage && firstPage.total || 1));
        const totalRows = Math.max(0, Number(firstPage && firstPage.records || 0));
        const sourceRows = Array.isArray(firstPage && firstPage.rows) ? firstPage.rows.slice() : [];
        for (let page = 2; page <= totalPages; page += 1) {
            await waitForRunResume(run);
            const json = await fetchJson(buildRequestUrl(endpoint, { ...baseParams, page }), run.controller.signal);
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
        return FIELD_DEFINITIONS.every((definition) => {
            const query = normalizeMatchValue(debtor.values[definition.key]);
            if (!query) return true;
            const actual = normalizeMatchValue(cell && cell[definition.field]);
            if (query === 'null') return actual === '';
            return actual.includes(query);
        });
    }

    function isNoDataRegistry(registry) {
        const status = normalizeMatchValue(registry && registry.statusName);
        return status === 'проведен (нет данных)' || status === 'проведено (нет данных)';
    }

    async function inspectRegistry(registry, run, modal) {
        if (isNoDataRegistry(registry)) return;
        const registryData = await collectRegistryRows(registry.registryId, run);
        if (!registryData.rows.length) return;
        let resultsChanged = false;
        run.debtors.forEach((debtor) => {
            const match = registryData.rows.find((row) => debtorMatchesCell(debtor, row.cell));
            if (!match) return;
            const values = {};
            FIELD_DEFINITIONS.forEach((definition) => {
                values[definition.key] = normalizeText(match.cell && match.cell[definition.field]);
            });
            debtor.matches.set(registry.registryId, {
                rowId: match.rowId,
                position: match.position,
                totalRows: registryData.totalRows || registryData.rows.length,
                values
            });
            resultsChanged = true;
        });
        if (resultsChanged) renderSearchResults(modal, run.debtors);
    }

    function countMatches(debtors) {
        return debtors.reduce((sum, debtor) => sum + debtor.matches.size, 0);
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
            setNotice(modal, 'Читаю текущие фильтры списка…');
            setProgress(modal, 0, 1, 'Подготовка поиска', '');
            const gridState = await getGridState();
            const result = await scanFilteredRegistryPages(gridState, run, modal);
            if (!result.registryCount) {
                run.status = 'complete';
                renderSearchResults(modal, run.debtors, 'По текущим фильтрам реестры не найдены.');
                setProgress(modal, 1, 1, 'Поиск завершён', '0 реестров');
                setNotice(modal, 'По текущим фильтрам реестры не найдены.', 'success');
                return;
            }
            if (run.controller.signal.aborted) return;
            run.status = 'complete';
            const found = countMatches(run.debtors);
            renderSearchResults(modal, run.debtors, 'Совпадений не найдено.');
            const errorSuffix = run.errorCount ? ` Не удалось прочитать: ${run.errorCount}.` : '';
            setProgress(modal, result.totalPages, result.totalPages, 'Поиск завершён', `${result.registryCount} реестров`);
            setNotice(modal, `Найдено совпадений по реестрам: ${found}.${errorSuffix}`, run.errorCount ? 'error' : 'success');
        } catch (error) {
            if (isAbortError(error) || run.controller.signal.aborted) return;
            run.status = 'failed';
            setNotice(modal, error && error.message ? error.message : 'Поиск завершился ошибкой.', 'error');
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
            return;
        }
        run.status = 'running';
        run.paused = false;
        stopButton.textContent = 'Стоп';
        stopButton.classList.remove('is-paused');
        stopButton.setAttribute('aria-pressed', 'false');
        run.pauseWaiters.splice(0).forEach((resolve) => resolve());
        setNotice(modal, 'Поиск продолжен.');
    }

    function startSearch(modal) {
        if (activeRun && (activeRun.status === 'running' || activeRun.status === 'paused')) return;
        const debtors = readDebtors(modal);
        if (!debtors.length) {
            setNotice(modal, 'Введите хотя бы одно поле должника.', 'error');
            const firstInput = modal.querySelector('input');
            if (firstInput) firstInput.focus();
            return;
        }
        lockDebtorRows(modal, debtors);
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
            completed: 0,
            errorCount: 0,
            discovered: 0,
            totalPages: 1
        };
        void performSearch(activeRun, modal);
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
        ['dup_fssp_match', 'dup_fssp_pos', 'dup_fssp_total'].forEach((key) => url.searchParams.delete(key));
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async function revealLinkedRow() {
        const detailMatch = String(window.location.pathname || '').match(DETAIL_PATH_PATTERN);
        if (!detailMatch) return;
        const params = new URLSearchParams(window.location.search);
        const rowId = normalizeText(params.get('dup_fssp_match'));
        if (!rowId) return;
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
