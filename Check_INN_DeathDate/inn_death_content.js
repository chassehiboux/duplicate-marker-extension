(function initializePyramidIdentityVerification() {
    'use strict';

    if (window.top !== window || window.__pyramidIdentityVerificationInitialized) return;
    if (!/(^|\.)pyramid(?:[.-]|$)|pyramid-vostok/i.test(window.location.hostname)) return;
    window.__pyramidIdentityVerificationInitialized = true;

    const START_EVENT = 'dup-pyramid-identity-verification-start';
    const ACTION_LOOKUP_INN = 'PYRAMID_IDENTITY_LOOKUP_INN';
    const ACTION_CHECK_INVALID_INN = 'PYRAMID_IDENTITY_CHECK_INVALID_INN';
    const ACTION_CHECK_PROBATE = 'PYRAMID_IDENTITY_CHECK_PROBATE';
    const UI_CLASS = 'dup-identity-verification-ui';
    const OVERLAY_ID = 'dup-identity-verification-overlay';
    const STYLE_ID = 'dup-identity-verification-style';
    const CAPTCHA_PAUSE_SECONDS = 30;
    const TRANSIENT_RETRY_DELAYS_MS = [2000, 5000, 10000];
    const GRID_PAGE_SIZE = 500;
    const EDOC_PAGE_SIZE = 200;

    let activeRun = null;

    class CancelledError extends Error {
        constructor() {
            super('Проверка отменена пользователем.');
            this.name = 'CancelledError';
        }
    }

    function normalizeText(value) {
        return String(value === undefined || value === null ? '' : value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function normalizeMatchText(value) {
        return normalizeText(value).toLowerCase().replace(/ё/g, 'е');
    }

    function normalizeAddress(value) {
        return normalizeMatchText(value).replace(/[^0-9a-zа-я]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function digitsOnly(value) {
        return String(value === undefined || value === null ? '' : value).replace(/\D/g, '');
    }

    function normalizeDate(value) {
        const match = normalizeText(value).match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
        return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
    }

    function dateSortValue(value) {
        const match = normalizeDate(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        return match ? Number(`${match[3]}${match[2]}${match[1]}`) : 0;
    }

    function unique(values) {
        return Array.from(new Set((values || []).map(normalizeText).filter(Boolean)));
    }

    function formatPassport(series, number) {
        const normalizedSeries = digitsOnly(series);
        const normalizedNumber = digitsOnly(number);
        return normalizedSeries && normalizedNumber ? `${normalizedSeries} ${normalizedNumber}` : normalizedSeries || normalizedNumber;
    }

    function exactFioMatch(source, target) {
        const normalizedTarget = normalizeMatchText(target);
        if (!normalizedTarget) return false;
        const parts = String(source || '').split(/(?:[;\r\n]+|\s*[➞→]\s*|\s*[-=]+>\s*)/);
        return parts.some((part) => normalizeMatchText(part) === normalizedTarget);
    }

    function rowCell(row) {
        return row && typeof row.cell === 'object' && row.cell ? row.cell : {};
    }

    function rowValue(row, exactKeys, patterns) {
        const sources = [rowCell(row), row || {}];
        for (const source of sources) {
            const entries = Object.entries(source);
            for (const key of exactKeys || []) {
                const entry = entries.find(([candidate]) => String(candidate).toLowerCase() === String(key).toLowerCase());
                if (entry && normalizeText(entry[1])) return normalizeText(entry[1]);
            }
            for (const pattern of patterns || []) {
                const regex = new RegExp(pattern, 'i');
                const entry = entries.find(([candidate, value]) => regex.test(String(candidate)) && normalizeText(value));
                if (entry) return normalizeText(entry[1]);
            }
        }
        return '';
    }

    function ensureNotCancelled(run) {
        if (!run || run.cancelled) throw new CancelledError();
    }

    function waitCancelable(milliseconds, run, onTick) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            let timer = null;
            const tick = () => {
                if (run.cancelled) {
                    if (timer) clearTimeout(timer);
                    reject(new CancelledError());
                    return;
                }
                const remaining = Math.max(0, milliseconds - (Date.now() - startedAt));
                if (typeof onTick === 'function') onTick(remaining);
                if (remaining <= 0) {
                    resolve();
                    return;
                }
                timer = setTimeout(tick, Math.min(1000, remaining));
            };
            tick();
        });
    }

    function sendRuntimeMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                const runtimeError = chrome.runtime.lastError;
                if (runtimeError) reject(new Error(runtimeError.message));
                else resolve(response || null);
            });
        });
    }

    function addLog(run, service, subject, status, details, edocId = '') {
        run.logs.push({
            timestamp: new Date().toLocaleString('ru-RU'),
            edocId: normalizeText(edocId),
            service: normalizeText(service),
            subject: normalizeText(subject),
            status: normalizeText(status),
            details: normalizeText(details)
        });
    }

    async function requestPyramid(url, responseType, run) {
        ensureNotCancelled(run);
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: run.controller.signal
        });
        if (!response.ok) throw new Error(`Пирамида вернула HTTP ${response.status}: ${url}`);
        if (response.url && new URL(response.url).origin !== window.location.origin) {
            throw new Error('Сессия Пирамиды завершена. Обновите страницу и войдите снова.');
        }
        return responseType === 'text' ? response.text() : response.json();
    }

    function buildSlowsearchUrl(rules, page) {
        const query = new URLSearchParams({
            _search: 'true',
            nd: String(Date.now()),
            rows: String(GRID_PAGE_SIZE),
            page: String(page || 1),
            sidx: 'DebtID',
            sord: 'asc',
            limitRecords: '',
            filters: JSON.stringify({ groupOp: 'AND', rules: [...rules, { field: 'DepartmentID', op: 'eq', data: '=' }] })
        });
        return `/datagrids/slowsearch?${query.toString()}`;
    }

    async function querySlowsearch(rules, run) {
        const cacheKey = JSON.stringify(rules);
        if (run.slowsearchCache.has(cacheKey)) return run.slowsearchCache.get(cacheKey);
        const promise = (async () => {
            const rows = [];
            const seen = new Set();
            for (let page = 1; page <= 100; page += 1) {
                const payload = await requestPyramid(buildSlowsearchUrl(rules, page), 'json', run);
                const pageRows = Array.isArray(payload && payload.rows) ? payload.rows : [];
                let added = 0;
                pageRows.forEach((row, index) => {
                    const key = normalizeText(rowValue(row, ['DebtID'], []) || row.id || `${page}:${index}`);
                    if (seen.has(key)) return;
                    seen.add(key);
                    rows.push(row);
                    added += 1;
                });
                const records = Number(payload && payload.records);
                if (!pageRows.length || !added || pageRows.length < GRID_PAGE_SIZE || (Number.isFinite(records) && rows.length >= records)) break;
            }
            return rows;
        })();
        run.slowsearchCache.set(cacheKey, promise);
        return promise;
    }

    async function queryEdocs(debtId, run) {
        const normalizedDebtId = digitsOnly(debtId);
        if (!normalizedDebtId) return [];
        if (run.edocCache.has(normalizedDebtId)) return run.edocCache.get(normalizedDebtId);
        const promise = (async () => {
            const query = new URLSearchParams({
                nostatus: '49',
                id: normalizedDebtId,
                _search: 'false',
                rows: String(EDOC_PAGE_SIZE),
                page: '1',
                sidx: 'EDocID',
                sord: 'asc'
            });
            const payload = await requestPyramid(`/datagrids/globalsearchsub?${query.toString()}`, 'json', run);
            return Array.isArray(payload && payload.rows) ? payload.rows : [];
        })();
        run.edocCache.set(normalizedDebtId, promise);
        return promise;
    }

    function directCellText(cell) {
        return normalizeText(cell && cell.textContent);
    }

    function findCardLabelValue(doc, labels) {
        const wanted = new Set((labels || []).map(normalizeMatchText));
        for (const row of doc.querySelectorAll('tr')) {
            const cells = Array.from(row.children).filter((cell) => /^(TD|TH)$/i.test(cell.tagName));
            if (cells.length < 2) continue;
            const label = normalizeMatchText(directCellText(cells[0]));
            if (wanted.has(label)) return directCellText(cells[1]);
        }
        return '';
    }

    function parseFullCard(html, fallbackEdocId) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const bodyText = normalizeText(doc.body ? doc.body.textContent : '');
        const serviceMatch = bodyText.match(/EDocID:\s*(\d+)\s*\|\s*DebtID:\s*(\d+)\s*\|\s*ФИО:\s*(.*?)\s*\|\s*StatusID:/i);
        const accountMatch = bodyText.match(/ЛС:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/i);
        const addressMatch = bodyText.match(/Адрес:\s*(.*?)\s*Поставщик:/i);
        return {
            edocId: serviceMatch ? serviceMatch[1] : digitsOnly(fallbackEdocId),
            debtId: serviceMatch ? serviceMatch[2] : '',
            fullName: serviceMatch ? normalizeText(serviceMatch[3]) : '',
            accountNumber: accountMatch ? normalizeText(accountMatch[1]) : '',
            departmentName: accountMatch ? normalizeText(accountMatch[2]) : '',
            address: addressMatch ? normalizeText(addressMatch[1]) : '',
            birthDate: normalizeDate(findCardLabelValue(doc, ['ДР должника', 'Дата рождения'])),
            deathDate: normalizeDate(findCardLabelValue(doc, ['Дата Смерти', 'Дата смерти'])),
            docType: findCardLabelValue(doc, ['Вид документа']),
            series: digitsOnly(findCardLabelValue(doc, ['Серия документа'])),
            number: digitsOnly(findCardLabelValue(doc, ['Номер документа'])),
            issueDate: normalizeDate(findCardLabelValue(doc, ['Дата выдачи'])),
            inn: digitsOnly(findCardLabelValue(doc, ['ИНН']))
        };
    }

    function parseSubRow(row) {
        return {
            edocId: digitsOnly(rowValue(row, ['EDocID'], ['edocid']) || row.id),
            debtId: digitsOnly(rowValue(row, ['DebtID'], ['debtid'])),
            fullName: rowValue(row, ['FullName', 'FIO', 'Individual_FullName'], ['individual_?fullname', 'full.?name', '\\bfio\\b', 'фио']),
            birthDate: normalizeDate(rowValue(row, ['Birthdate', 'BirthDate'], ['birth.?date', 'дата\\s*рожд'])),
            docType: rowValue(row, ['DocType'], ['doctype', 'вид\\s*документ']),
            series: digitsOnly(rowValue(row, ['DocSerial'], ['docserial', 'серия'])),
            number: digitsOnly(rowValue(row, ['DocNumber'], ['docnumber', 'номер\\s*док'])),
            issueDate: normalizeDate(rowValue(row, ['DocDate'], ['docdate', 'дата\\s*выда'])),
            inn: digitsOnly(rowValue(row, ['INN'], ['\\binn\\b', 'инн'])),
            edDate: normalizeDate(rowValue(row, ['EDStartAction', 'EDDate'], ['edstartaction', 'eddate']))
        };
    }

    function isRussianPassport(record) {
        const type = normalizeMatchText(record && record.docType);
        return (!type || type.includes('паспорт рф') || type.includes('паспорт гражданина')) &&
            digitsOnly(record && record.series).length === 4 && digitsOnly(record && record.number).length === 6;
    }

    function candidateKey(record) {
        return [digitsOnly(record.series), digitsOnly(record.number), normalizeDate(record.issueDate), digitsOnly(record.inn)].join('|');
    }

    function appendCandidate(map, record) {
        if (!isRussianPassport(record)) return;
        const key = candidateKey(record);
        let candidate = map.get(key);
        if (!candidate) {
            candidate = {
                key,
                series: digitsOnly(record.series),
                number: digitsOnly(record.number),
                issueDate: normalizeDate(record.issueDate),
                pyramidInn: digitsOnly(record.inn),
                sourceEdocIds: [],
                sourceDebtIds: [],
                sourceEdDates: [],
                external: null
            };
            map.set(key, candidate);
        }
        candidate.sourceEdocIds = unique([...candidate.sourceEdocIds, digitsOnly(record.edocId)]);
        candidate.sourceDebtIds = unique([...candidate.sourceDebtIds, digitsOnly(record.debtId)]);
        candidate.sourceEdDates = unique([...candidate.sourceEdDates, normalizeDate(record.edDate)]);
    }

    function detectInternalIssues(candidates) {
        const issues = [];
        const datesByPassport = new Map();
        const passportsByDate = new Map();
        const inns = unique(candidates.map((candidate) => candidate.pyramidInn));
        candidates.forEach((candidate) => {
            const passport = formatPassport(candidate.series, candidate.number);
            if (!datesByPassport.has(passport)) datesByPassport.set(passport, new Set());
            if (candidate.issueDate) datesByPassport.get(passport).add(candidate.issueDate);
            if (candidate.issueDate) {
                if (!passportsByDate.has(candidate.issueDate)) passportsByDate.set(candidate.issueDate, new Set());
                passportsByDate.get(candidate.issueDate).add(passport);
            }
        });
        datesByPassport.forEach((dates, passport) => {
            if (dates.size > 1) issues.push(`Паспорт ${passport} имеет разные даты выдачи: ${Array.from(dates).join(', ')}`);
        });
        passportsByDate.forEach((passports, issueDate) => {
            if (passports.size > 1) issues.push(`Дата выдачи ${issueDate} указана у разных паспортов: ${Array.from(passports).join(', ')}`);
        });
        if (inns.length > 1) issues.push(`В связанных EDoc указано несколько ИНН: ${inns.join(', ')}`);
        return issues;
    }

    async function mapLimit(items, limit, mapper) {
        const result = new Array(items.length);
        let nextIndex = 0;
        async function worker() {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                result[index] = await mapper(items[index], index);
            }
        }
        await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
        return result;
    }

    async function collectPyramidEvidence(target, run) {
        const edocId = digitsOnly(target && target.edocId);
        if (!edocId) throw new Error('Не удалось определить EDocID выбранной строки.');
        const html = await requestPyramid(`/ovzid/fullcard/${edocId}`, 'text', run);
        const card = parseFullCard(html, edocId);
        const debtId = digitsOnly(card.debtId || target.debtId);
        const currentRows = debtId ? await queryEdocs(debtId, run) : [];
        const currentSub = currentRows.map(parseSubRow).find((row) => row.edocId === edocId) || {};
        const current = {
            edocId,
            debtId,
            accountNumber: normalizeText(card.accountNumber || target.accountNumber),
            departmentName: normalizeText(card.departmentName || target.departmentName),
            address: normalizeText(card.address),
            fullName: normalizeText(currentSub.fullName || card.fullName || target.fullName),
            birthDate: normalizeDate(currentSub.birthDate || card.birthDate),
            deathDate: normalizeDate(card.deathDate),
            docType: normalizeText(currentSub.docType || card.docType),
            series: digitsOnly(currentSub.series || card.series),
            number: digitsOnly(currentSub.number || card.number),
            issueDate: normalizeDate(currentSub.issueDate || card.issueDate),
            inn: digitsOnly(currentSub.inn || card.inn),
            edDate: normalizeDate(currentSub.edDate)
        };
        if (!current.fullName || !current.birthDate) {
            throw new Error('В карточке не удалось определить ФИО или дату рождения.');
        }

        const fioRows = await querySlowsearch([{ field: 'FIO', op: 'individualdebtsearch', data: current.fullName }], run);
        const primaryRows = fioRows.filter((row) => {
            const account = rowValue(row, ['AccountNumber', 'AccAddress_AccountNumber'], ['accountnumber', 'лицев']);
            const fio = rowValue(row, ['FIO', 'FullName', 'Individual_FullName'], ['fullname', '\\bfio\\b']);
            return digitsOnly(account) === digitsOnly(current.accountNumber) && exactFioMatch(fio, current.fullName);
        });
        const addresses = unique([
            current.address,
            ...primaryRows.map((row) => rowValue(row, ['FullAddress', 'AccAddress_FullAddress'], ['full.?address', 'адрес']))
        ]);
        const addressResults = await mapLimit(addresses, 3, (address) => querySlowsearch([
            { field: 'FIO', op: 'individualdebtsearch', data: current.fullName },
            { field: 'FullAddress', op: 'eq', data: address }
        ], run));
        const addressKeys = new Set(addresses.map(normalizeAddress));
        const debtRows = [...primaryRows, ...addressResults.flat()].filter((row) => {
            const fio = rowValue(row, ['FIO', 'FullName', 'Individual_FullName'], ['fullname', '\\bfio\\b']);
            const address = rowValue(row, ['FullAddress', 'AccAddress_FullAddress'], ['full.?address', 'адрес']);
            return exactFioMatch(fio, current.fullName) && (!normalizeAddress(address) || addressKeys.has(normalizeAddress(address)));
        });
        const debtIds = unique([debtId, ...debtRows.map((row) => rowValue(row, ['DebtID'], ['debtid']))].map(digitsOnly));
        const edocGroups = await mapLimit(debtIds, 4, (id) => queryEdocs(id, run));
        const candidateMap = new Map();
        appendCandidate(candidateMap, current);
        edocGroups.flat().map(parseSubRow).forEach((record) => {
            if (exactFioMatch(record.fullName, current.fullName) && record.birthDate === current.birthDate) {
                appendCandidate(candidateMap, record);
            }
        });
        const candidates = Array.from(candidateMap.values());
        return {
            target,
            current,
            candidates,
            relatedDebtCount: debtIds.length,
            internalIssues: detectInternalIssues(candidates),
            errors: [],
            probate: null,
            verdicts: null
        };
    }

    async function callExternalWithRetries(action, data, run, meta) {
        let lastError = null;
        for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
            ensureNotCancelled(run);
            try {
                const response = await sendRuntimeMessage({ action, data });
                if (response && response.success) {
                    addLog(run, meta.service, meta.subject, 'Успешно', meta.successDetails(response.result), meta.edocId);
                    return { ok: true, result: response.result };
                }
                lastError = response && response.error ? response.error : { code: 'NO_RESPONSE', message: 'Нет ответа фонового процесса.', retryable: true };
            } catch (error) {
                lastError = { code: 'MESSAGE_ERROR', message: error.message || String(error), retryable: true };
            }
            if (!lastError.retryable || attempt >= TRANSIENT_RETRY_DELAYS_MS.length) break;
            const delay = TRANSIENT_RETRY_DELAYS_MS[attempt];
            addLog(run, meta.service, meta.subject, 'Повтор', `${lastError.message} Следующая попытка через ${Math.round(delay / 1000)} сек.`, meta.edocId);
            await waitCancelable(delay, run);
        }
        addLog(run, meta.service, meta.subject, 'Ошибка', lastError ? lastError.message : 'Неизвестная ошибка.', meta.edocId);
        return { ok: false, error: lastError || { code: 'UNKNOWN', message: 'Неизвестная ошибка.' } };
    }

    function innRequestKey(candidate, person, issueDate) {
        return [
            normalizeMatchText(person.fullName),
            person.birthDate,
            candidate.series,
            candidate.number,
            issueDate || ''
        ].join('|');
    }

    function lookupInnUntilNotCaptcha(candidate, person, issueDate, run) {
        const key = innRequestKey(candidate, person, issueDate);
        if (run.innRequestCache.has(key)) return run.innRequestCache.get(key);
        const request = lookupInnWithoutCache(candidate, person, issueDate, run);
        run.innRequestCache.set(key, request);
        return request;
    }

    async function lookupInnWithoutCache(candidate, person, issueDate, run) {
        let transientAttempt = 0;
        while (true) {
            ensureNotCancelled(run);
            setRunStage(run, `ФНС: ${formatPassport(candidate.series, candidate.number)}${issueDate ? ` от ${issueDate}` : ' без даты выдачи'}`);
            let response;
            try {
                response = await sendRuntimeMessage({
                    action: ACTION_LOOKUP_INN,
                    data: {
                        fio: person.fullName,
                        birthDate: person.birthDate,
                        series: candidate.series,
                        number: candidate.number,
                        issueDate
                    }
                });
            } catch (error) {
                response = { success: false, error: { code: 'MESSAGE_ERROR', message: error.message || String(error), retryable: true } };
            }
            if (response && response.success) {
                const result = response.result || {};
                addLog(
                    run,
                    'ФНС (поиск ИНН)',
                    `${formatPassport(candidate.series, candidate.number)}${issueDate ? `, ${issueDate}` : ', без даты'}`,
                    result.status === 'found' ? 'ИНН найден' : 'ИНН не найден',
                    result.inn || (result.errorCode ? `Код: ${result.errorCode}` : 'Отрицательный ответ сервиса.'),
                    person.edocId
                );
                return { ok: true, result };
            }
            const error = response && response.error ? response.error : { code: 'NO_RESPONSE', message: 'Нет ответа фонового процесса.', retryable: true };
            if (error.code === 'CAPTCHA_REQUIRED') {
                run.captchaCount += 1;
                addLog(run, 'ФНС (поиск ИНН)', formatPassport(candidate.series, candidate.number), 'Капча', error.message, person.edocId);
                await waitCancelable(CAPTCHA_PAUSE_SECONDS * 1000, run, (remaining) => {
                    const seconds = Math.ceil(remaining / 1000);
                    showNotice(`ФНС потребовал капчу. Проверка продолжится автоматически через ${seconds} сек. Попытка не будет потеряна.`, 'captcha');
                    setRunStage(run, `Капча ФНС: ожидание ${seconds} сек.`);
                });
                showNotice('', '');
                transientAttempt = 0;
                continue;
            }
            if (error.retryable && transientAttempt < TRANSIENT_RETRY_DELAYS_MS.length) {
                const delay = TRANSIENT_RETRY_DELAYS_MS[transientAttempt];
                transientAttempt += 1;
                addLog(run, 'ФНС (поиск ИНН)', formatPassport(candidate.series, candidate.number), 'Повтор', `${error.message} Через ${Math.round(delay / 1000)} сек.`, person.edocId);
                await waitCancelable(delay, run);
                continue;
            }
            addLog(run, 'ФНС (поиск ИНН)', formatPassport(candidate.series, candidate.number), 'Ошибка', error.message, person.edocId);
            return { ok: false, error };
        }
    }

    async function verifyPassportCandidate(candidate, evidence, run) {
        const issueDate = candidate.issueDate;
        let withDate = null;
        if (issueDate) {
            withDate = await lookupInnUntilNotCaptcha(candidate, evidence.current, issueDate, run);
            if (!withDate.ok) return { status: 'error', error: withDate.error, withDate: null, withoutDate: null, foundInn: '' };
            if (withDate.result.status === 'found') {
                return { status: 'found_with_date', foundInn: digitsOnly(withDate.result.inn), withDate: withDate.result, withoutDate: null };
            }
        }
        const withoutDate = await lookupInnUntilNotCaptcha(candidate, evidence.current, '', run);
        if (!withoutDate.ok) return { status: 'error', error: withoutDate.error, withDate: withDate && withDate.result, withoutDate: null, foundInn: '' };
        if (withoutDate.result.status === 'found') {
            return {
                status: issueDate ? 'found_without_date' : 'found_no_issue_date',
                foundInn: digitsOnly(withoutDate.result.inn),
                withDate: withDate && withDate.result,
                withoutDate: withoutDate.result
            };
        }
        return { status: 'not_found', foundInn: '', withDate: withDate && withDate.result, withoutDate: withoutDate.result };
    }

    function candidateLookupKey(evidence, candidate) {
        return [normalizeMatchText(evidence.current.fullName), evidence.current.birthDate, candidate.series, candidate.number, candidate.issueDate].join('|');
    }

    function findCurrentPassportCandidates(evidence) {
        const current = evidence.current;
        return evidence.candidates.filter((candidate) => candidate.series === current.series && candidate.number === current.number);
    }

    function verdict(level, text, details) {
        return { level, text, details: normalizeText(details) };
    }

    function evaluateIdentityEvidence(evidence) {
        const current = evidence.current;
        const confirmed = evidence.candidates.filter((candidate) => candidate.external && /^found_/.test(candidate.external.status));
        const currentPassportCandidates = findCurrentPassportCandidates(evidence);
        const currentConfirmed = currentPassportCandidates.filter((candidate) => candidate.external && /^found_/.test(candidate.external.status));
        const otherConfirmed = confirmed.filter((candidate) => !currentPassportCandidates.includes(candidate));
        let passportVerdict;
        if (currentConfirmed.length) {
            const latestConfirmed = [...confirmed].sort((a, b) => dateSortValue(b.issueDate) - dateSortValue(a.issueDate))[0];
            const exactDate = currentConfirmed.find((candidate) => candidate.external.status === 'found_with_date' && candidate.issueDate && candidate.issueDate === current.issueDate);
            const currentIsLatest = latestConfirmed && currentPassportCandidates.includes(latestConfirmed);
            if (confirmed.length > 1 && !currentIsLatest) {
                passportVerdict = verdict('danger', 'Вероятно актуален другой паспорт', `Источник: ФНС (поиск ИНН). Подтверждено несколько паспортов; наиболее поздний подтверждённый вариант ${formatPassport(latestConfirmed.series, latestConfirmed.number)}${latestConfirmed.issueDate ? ` от ${latestConfirmed.issueDate}` : ''}.`);
            } else if (exactDate) {
                passportVerdict = verdict('ok', confirmed.length > 1 ? 'Текущий паспорт вероятно актуален' : 'Подтверждён', `Источник: ФНС (поиск ИНН). Текущий паспорт подтверждён с датой выдачи ${exactDate.issueDate}${confirmed.length > 1 ? '; среди подтверждённых вариантов он имеет наиболее позднюю дату выдачи' : ''}.`);
            } else {
                passportVerdict = verdict('warn', 'Подтверждён, дата выдачи сомнительна', `Источник: ФНС (поиск ИНН). ${current.issueDate ? 'ИНН найден только при запросе без даты выдачи.' : 'Паспорт подтверждён, но в текущем EDoc отсутствует дата выдачи.'}`);
            }
        } else if (otherConfirmed.length) {
            const selected = [...otherConfirmed].sort((a, b) => dateSortValue(b.issueDate) - dateSortValue(a.issueDate))[0];
            passportVerdict = verdict('danger', 'Подтверждён другой паспорт', `Источник: ФНС (поиск ИНН). Подтверждён ${formatPassport(selected.series, selected.number)}${selected.issueDate ? ` от ${selected.issueDate}` : ''}.`);
        } else if (evidence.internalIssues.length) {
            passportVerdict = verdict('warn', 'Противоречивые паспортные данные', evidence.internalIssues.join(' '));
        } else if (evidence.candidates.some((candidate) => candidate.external && candidate.external.status === 'error')) {
            passportVerdict = verdict('muted', 'Не проверен', 'Хотя бы один запрос ФНС завершился технической ошибкой.');
        } else {
            passportVerdict = verdict('warn', 'Не подтверждён внешним источником', 'ФНС не вернул ИНН ни по одному паспортному набору.');
        }

        const pyramidInns = unique(evidence.candidates.map((candidate) => candidate.pyramidInn));
        const foundInns = unique(confirmed.map((candidate) => candidate.external.foundInn));
        let innVerdict;
        if (current.inn && foundInns.includes(current.inn)) {
            innVerdict = verdict('ok', 'Подтверждён паспортом', `Источник: ФНС (поиск ИНН) по паспортным данным. Получен ИНН ${current.inn}, он совпадает с Пирамидой.`);
        } else if (current.inn && foundInns.length) {
            innVerdict = verdict('danger', 'ФНС вернул другой ИНН', `Источник: ФНС (поиск ИНН) по паспортным данным. В Пирамиде ${current.inn}; ФНС вернул: ${foundInns.join(', ')}.`);
        } else if (!current.inn && foundInns.length) {
            innVerdict = verdict('danger', 'В Пирамиде отсутствует, найден ФНС', `Источник: ФНС (поиск ИНН) по паспортным данным. Найдено: ${foundInns.join(', ')}.`);
        } else if (pyramidInns.length > 1) {
            innVerdict = verdict('danger', 'Несколько ИНН в связанных EDoc', pyramidInns.join(', '));
        } else if (current.inn && evidence.candidates.filter((candidate) => candidate.pyramidInn === current.inn).reduce((count, candidate) => count + candidate.sourceEdocIds.length, 0) > 1) {
            innVerdict = verdict('warn', 'Только внутренняя согласованность Пирамиды', `ИНН ${current.inn} повторяется в связанных EDoc, но не подтверждён паспортным поиском ФНС.`);
        } else if (evidence.candidates.some((candidate) => candidate.external && candidate.external.status === 'error')) {
            innVerdict = verdict('muted', 'Не проверен', 'Поиск ИНН завершился технической ошибкой.');
        } else {
            innVerdict = verdict('warn', 'Не подтверждён', current.inn ? `ИНН ${current.inn} не подтверждён паспортным поиском.` : 'ИНН не найден.');
        }

        return { passport: passportVerdict, inn: innVerdict, pyramidInns, foundInns };
    }

    function relevantInnsForEvidence(evidence) {
        return unique([
            evidence.current && evidence.current.inn,
            ...evidence.candidates.map((candidate) => candidate.pyramidInn),
            ...evidence.candidates.map((candidate) => candidate.external && candidate.external.foundInn)
        ]).filter((inn) => digitsOnly(inn).length === 12);
    }

    function describeDeathSources(evidence, invalidResults, includeNegative = false) {
        const lines = [];
        relevantInnsForEvidence(evidence).forEach((inn) => {
            const response = invalidResults.get(inn);
            if (!response) return;
            if (!response.ok) {
                lines.push(`ФНС (дата смерти по ИНН), ${inn}: ошибка ${response.error && response.error.message ? response.error.message : 'без описания'}.`);
            } else if (response.result.date) {
                lines.push(`ФНС (дата смерти по ИНН), ${inn}: дата смерти ${response.result.date}.`);
            } else if (includeNegative) {
                lines.push(`ФНС (дата смерти по ИНН), ${inn}: дата смерти не найдена.`);
            }
        });
        if (evidence.probate) {
            if (!evidence.probate.ok) {
                lines.push(`Нотариат — наследственные дела: ошибка ${evidence.probate.error && evidence.probate.error.message ? evidence.probate.error.message : 'без описания'}.`);
            } else if (evidence.probate.result.records.length) {
                evidence.probate.result.records.forEach((record) => {
                    lines.push(`Нотариат — наследственное дело${record.caseNumber ? ` № ${record.caseNumber}` : ''}: дата смерти ${record.deathDate || 'не указана'}.`);
                });
            } else if (includeNegative) {
                lines.push('Нотариат — наследственные дела: совпадений не найдено.');
            }
        }
        return lines;
    }

    function evaluateEvidence(evidence, invalidResults) {
        const current = evidence.current;
        const identityVerdicts = evaluateIdentityEvidence(evidence);
        const { passport: passportVerdict, inn: innVerdict, pyramidInns, foundInns } = identityVerdicts;

        const relevantInns = unique([...pyramidInns, ...foundInns]);
        const fnsDates = unique(relevantInns.map((inn) => invalidResults.get(inn)).filter((item) => item && item.ok && item.result.date).map((item) => item.result.date));
        const probateRecords = evidence.probate && evidence.probate.ok ? evidence.probate.result.records || [] : [];
        const notariatDates = unique(probateRecords.map((record) => record.deathDate));
        const externalDates = unique([...fnsDates, ...notariatDates]);
        const positiveSourceDetails = describeDeathSources(evidence, invalidResults, false).join(' ');
        const allSourceDetails = describeDeathSources(evidence, invalidResults, true).join(' ');
        let deathVerdict;
        if (externalDates.length > 1) {
            deathVerdict = verdict('danger', 'Внешние источники расходятся', `Найдены даты: ${externalDates.join(', ')}. ${positiveSourceDetails}`);
        } else if (current.deathDate && externalDates.length && externalDates[0] !== current.deathDate) {
            deathVerdict = verdict('danger', 'Не совпадает с внешней датой', `В Пирамиде ${current.deathDate}; внешняя дата ${externalDates[0]}. ${positiveSourceDetails}`);
        } else if (!current.deathDate && externalDates.length) {
            deathVerdict = verdict('danger', 'В Пирамиде отсутствует, найдена извне', `Найдена дата ${externalDates[0]}. ${positiveSourceDetails}`);
        } else if (current.deathDate && externalDates.length) {
            const sourceCount = (fnsDates.includes(current.deathDate) ? 1 : 0) + (notariatDates.includes(current.deathDate) ? 1 : 0);
            deathVerdict = verdict('ok', sourceCount > 1 ? 'Совпадает по двум внешним источникам' : 'Совпадает по одному внешнему источнику', `Дата смерти в Пирамиде ${current.deathDate}. ${positiveSourceDetails}`);
        } else {
            deathVerdict = verdict(current.deathDate ? 'warn' : 'ok', 'Внешнего подтверждения нет', current.deathDate ? `Дата смерти в Пирамиде ${current.deathDate} не подтверждена внешними источниками. ${allSourceDetails}` : `Внешняя дата смерти не найдена; это не доказывает, что человек жив. ${allSourceDetails}`);
        }

        const hasTechnicalError = evidence.errors.length || evidence.candidates.some((candidate) => candidate.external && candidate.external.status === 'error') ||
            (evidence.probate && !evidence.probate.ok) || relevantInns.some((inn) => invalidResults.get(inn) && !invalidResults.get(inn).ok);
        let overall;
        if (hasTechnicalError) overall = verdict('muted', 'Проверка выполнена не полностью', 'Есть технические ошибки; отрицательные выводы по ним не делались.');
        else if (innVerdict.level === 'danger' || deathVerdict.level === 'danger') overall = verdict('danger', 'Есть явное расхождение', [innVerdict.details, deathVerdict.details].filter(Boolean).join(' '));
        else if (passportVerdict.level === 'danger' || passportVerdict.level === 'warn' || innVerdict.level === 'warn') overall = verdict('warn', 'Требует внимания', [passportVerdict.details, innVerdict.details].filter(Boolean).join(' '));
        else if (deathVerdict.level === 'warn') overall = verdict('warn', 'Данные согласованы с оговорками', deathVerdict.details);
        else overall = verdict('ok', 'Данные согласованы', 'Внешние результаты не противоречат сведениям Пирамиды.');

        return { passport: passportVerdict, inn: innVerdict, death: deathVerdict, overall, pyramidInns, foundInns, fnsDates, notariatDates };
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID}.${UI_CLASS}, #${OVERLAY_ID}.${UI_CLASS} * { box-sizing: border-box; }
            #${OVERLAY_ID}.${UI_CLASS} { position: fixed; inset: 0; z-index: 2147483645; display: flex; align-items: center; justify-content: center; padding: clamp(6px, 2vw, 22px); overflow: hidden; background: rgba(14, 20, 24, .74); backdrop-filter: blur(5px); color: #162027; font-family: Bahnschrift, "Arial Narrow", sans-serif; }
            #${OVERLAY_ID}[hidden] { display: none !important; }
            #${OVERLAY_ID} .piv-panel { width: 100%; max-width: 1460px; height: 100%; max-height: 900px; min-width: 0; display: grid; grid-template-rows: auto auto minmax(0,1fr) auto; overflow: hidden; background: #f3f0e7; border: 1px solid #91a2aa; border-radius: 4px; box-shadow: 0 28px 80px rgba(0,0,0,.42); }
            #${OVERLAY_ID} .piv-head { position: relative; inset: auto; width: auto; min-width: 0; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 20px; padding: 18px 22px 16px; background: #15242b; color: #f8f5ea; border-bottom: 4px solid #35b6a6; }
            #${OVERLAY_ID} .piv-head-copy { min-width: 0; }
            #${OVERLAY_ID} .piv-kicker { color: #61d2c4; font-size: 11px; letter-spacing: .15em; text-transform: uppercase; }
            #${OVERLAY_ID} .piv-title { margin-top: 3px; overflow-wrap: anywhere; font-family: Georgia, serif; font-size: clamp(20px, 2.2vw, 25px); line-height: 1.1; font-weight: 400; }
            #${OVERLAY_ID} .piv-stage { margin-top: 7px; overflow-wrap: anywhere; color: #bdc9cc; font-size: 12px; }
            #${OVERLAY_ID} .piv-close { flex: 0 0 auto; align-self: start; width: 34px; height: 34px; border: 1px solid #51636a; border-radius: 50%; background: transparent; color: #fff; cursor: pointer; font-size: 22px; }
            #${OVERLAY_ID} .piv-progress-wrap { padding: 12px 22px; background: #e4e0d4; border-bottom: 1px solid #c8c3b7; }
            #${OVERLAY_ID} .piv-progress-meta { min-width: 0; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; margin-bottom: 7px; font-size: 12px; }
            #${OVERLAY_ID} .piv-progress-track { height: 8px; overflow: hidden; background: #c7c2b7; border-radius: 99px; }
            #${OVERLAY_ID} .piv-progress-bar { width: 0; height: 100%; background: linear-gradient(90deg,#168f82,#52cdbd); transition: width .25s ease; }
            #${OVERLAY_ID} .piv-notice { margin-top: 10px; padding: 9px 12px; overflow-wrap: anywhere; background: #fff2bd; border-left: 4px solid #d38900; font-size: 12px; }
            #${OVERLAY_ID} .piv-notice[hidden] { display: none; }
            #${OVERLAY_ID} .piv-body { min-width: 0; overflow: auto; padding: 14px; background: #f8f6ef; }
            #${OVERLAY_ID} .piv-results { min-width: 0; display: grid; gap: 12px; }
            #${OVERLAY_ID} .piv-case { min-width: 0; overflow: hidden; border: 1px solid #c8c3b7; border-left: 5px solid #2a8f84; background: rgba(255,255,255,.7); box-shadow: 0 3px 12px rgba(32,48,54,.08); }
            #${OVERLAY_ID} .piv-case-head { position: relative; inset: auto; width: auto; min-width: 0; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px; align-items: start; padding: 12px 14px; background: #ebe7dc; border-bottom: 1px solid #d1ccbf; }
            #${OVERLAY_ID} .piv-person { min-width: 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 700; }
            #${OVERLAY_ID} .piv-id { font-family: Consolas, monospace; font-weight: 700; color: #135d66; }
            #${OVERLAY_ID} .piv-sub { display: block; margin-top: 3px; color: #6d777a; font-size: 10px; }
            #${OVERLAY_ID} .piv-facts { min-width: 0; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1px; background: #d7d2c5; border-bottom: 1px solid #d1ccbf; }
            #${OVERLAY_ID} .piv-fact { min-width: 0; padding: 9px 12px; overflow-wrap: anywhere; background: #f7f4ec; }
            #${OVERLAY_ID} .piv-label { display: block; margin-bottom: 4px; color: #697378; font-size: 10px; letter-spacing: .07em; text-transform: uppercase; }
            #${OVERLAY_ID} .piv-fact-value { font-family: Consolas, monospace; font-size: 12px; font-weight: 700; }
            #${OVERLAY_ID} .piv-checks { min-width: 0; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; padding: 12px; }
            #${OVERLAY_ID} .piv-check { min-width: 0; padding: 10px; border: 1px solid #ddd8cc; background: #fffdf7; }
            #${OVERLAY_ID} .piv-badge { display: inline-block; max-width: 100%; padding: 4px 7px; overflow-wrap: anywhere; border: 1px solid; border-radius: 2px; line-height: 1.25; font-weight: 700; }
            #${OVERLAY_ID} .piv-ok { color: #0c6659; background: #dff3ed; border-color: #84c7ba; }
            #${OVERLAY_ID} .piv-warn { color: #805400; background: #fff0c7; border-color: #d8b45d; }
            #${OVERLAY_ID} .piv-danger { color: #8c2525; background: #f9dddd; border-color: #d98f8f; }
            #${OVERLAY_ID} .piv-muted { color: #566268; background: #e9edef; border-color: #b8c1c5; }
            #${OVERLAY_ID} .piv-status-detail { margin-top: 7px; overflow-wrap: anywhere; color: #4c575b; font-size: 11px; line-height: 1.4; }
            #${OVERLAY_ID} .piv-case-details { margin: 0; border-top: 1px solid #ddd8cc; }
            #${OVERLAY_ID} .piv-case-details summary { padding: 10px 14px; cursor: pointer; color: #23656b; font-weight: 700; background: #f1eee5; }
            #${OVERLAY_ID} .piv-evidence { padding: 12px 14px 15px; white-space: pre-wrap; overflow-wrap: anywhere; color: #3f4c51; font-family: Consolas, monospace; font-size: 11px; line-height: 1.55; background: #fffdf7; }
            #${OVERLAY_ID} .piv-foot { position: relative; inset: auto; width: auto; min-width: 0; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 13px 18px; background: #e4e0d4; border-top: 1px solid #c8c3b7; }
            #${OVERLAY_ID} .piv-foot-note { min-width: 0; overflow-wrap: anywhere; color: #697378; font-size: 11px; line-height: 1.35; }
            #${OVERLAY_ID} .piv-actions { min-width: 0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
            #${OVERLAY_ID} .piv-btn { min-height: 32px; max-width: 100%; padding: 6px 12px; white-space: normal; border: 1px solid #87969c; border-radius: 3px; background: #faf8f1; color: #26343a; cursor: pointer; font-weight: 700; }
            #${OVERLAY_ID} .piv-btn:hover { background: #fff; border-color: #40545c; }
            #${OVERLAY_ID} .piv-btn-primary { background: #176f68; border-color: #176f68; color: #fff; }
            #${OVERLAY_ID} .piv-btn-danger { color: #8c2525; border-color: #c18a8a; }
            #${OVERLAY_ID} .piv-btn[disabled] { opacity: .45; cursor: not-allowed; }
            @media (max-width: 1080px) { #${OVERLAY_ID} .piv-checks { grid-template-columns: repeat(2,minmax(0,1fr)); } }
            @media (max-width: 720px) { #${OVERLAY_ID} .piv-head, #${OVERLAY_ID} .piv-progress-wrap { padding-left: 14px; padding-right: 14px; } #${OVERLAY_ID} .piv-body { padding: 7px; } #${OVERLAY_ID} .piv-case-head { grid-template-columns: minmax(0,1fr); } #${OVERLAY_ID} .piv-facts, #${OVERLAY_ID} .piv-checks { grid-template-columns: minmax(0,1fr); } #${OVERLAY_ID} .piv-foot { grid-template-columns: minmax(0,1fr); align-items: start; padding: 10px 12px; } #${OVERLAY_ID} .piv-actions { justify-content: flex-start; } }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureModal() {
        ensureStyle();
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = UI_CLASS;
        overlay.innerHTML = `
            <section class="piv-panel" role="dialog" aria-modal="true" aria-labelledby="piv-title">
                <header class="piv-head"><div class="piv-head-copy"><div class="piv-kicker">Контроль данных Пирамиды</div><div class="piv-title" id="piv-title">Паспорт / ИНН / смерть</div><div class="piv-stage" id="piv-stage">Подготовка…</div></div><button class="piv-close" id="piv-close" type="button" aria-label="Закрыть">×</button></header>
                <div class="piv-progress-wrap"><div class="piv-progress-meta"><span id="piv-progress-label">0 из 0</span><span id="piv-captcha-count"></span></div><div class="piv-progress-track"><div class="piv-progress-bar" id="piv-progress-bar"></div></div><div class="piv-notice" id="piv-notice" hidden></div></div>
                <div class="piv-body"><div class="piv-results" id="piv-results"></div></div>
                <footer class="piv-foot"><div class="piv-foot-note" id="piv-foot-note">Данные не изменяются и не сохраняются в расширении.</div><div class="piv-actions"><button class="piv-btn" id="piv-retry" type="button" hidden>Повторить ошибки</button><button class="piv-btn" id="piv-copy" type="button" disabled>Копировать результаты</button><button class="piv-btn" id="piv-download" type="button" disabled>Скачать Excel</button><button class="piv-btn piv-btn-danger" id="piv-cancel" type="button">Отменить</button><button class="piv-btn piv-btn-primary" id="piv-done" type="button" hidden>Закрыть</button></div></footer>
            </section>`;
        (document.body || document.documentElement).appendChild(overlay);
        overlay.querySelector('#piv-close').addEventListener('click', closeModal);
        overlay.querySelector('#piv-done').addEventListener('click', closeModal);
        overlay.querySelector('#piv-cancel').addEventListener('click', () => cancelActiveRun());
        overlay.querySelector('#piv-retry').addEventListener('click', () => retryFailedRows(activeRun));
        overlay.querySelector('#piv-copy').addEventListener('click', () => copyRunResults(activeRun));
        overlay.querySelector('#piv-download').addEventListener('click', () => downloadRunWorkbook(activeRun));
        return overlay;
    }

    function closeModal() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (activeRun && activeRun.status === 'running') {
            if (!window.confirm('Проверка ещё выполняется. Отменить её и закрыть окно?')) return;
            cancelActiveRun();
        }
        if (overlay) overlay.hidden = true;
    }

    function showNotice(text, type) {
        const notice = document.getElementById('piv-notice');
        if (!notice) return;
        notice.textContent = normalizeText(text);
        notice.hidden = !notice.textContent;
        notice.dataset.type = type || '';
    }

    function setRunStage(run, text) {
        run.stage = normalizeText(text);
        const node = document.getElementById('piv-stage');
        if (node) node.textContent = run.stage;
    }

    function updateProgress(run) {
        const total = Math.max(1, run.totalUnits);
        const percent = Math.min(100, Math.round((run.completedUnits / total) * 100));
        const bar = document.getElementById('piv-progress-bar');
        const label = document.getElementById('piv-progress-label');
        const captcha = document.getElementById('piv-captcha-count');
        if (bar) bar.style.width = `${percent}%`;
        if (label) label.textContent = `${run.completedUnits} из ${run.totalUnits} операций · ${percent}%`;
        if (captcha) captcha.textContent = run.captchaCount ? `Капча ФНС: ${run.captchaCount}` : '';
    }

    function statusBadge(value) {
        const span = document.createElement('span');
        const level = value && value.level ? value.level : 'muted';
        span.className = `piv-badge piv-${level}`;
        span.textContent = value && value.text ? value.text : 'Ожидание';
        span.title = value && value.details ? value.details : '';
        return span;
    }

    function describePassportExternal(candidate) {
        const external = candidate.external;
        if (!external) return 'ФНС (поиск ИНН): запрос ожидается.';
        if (external.status === 'not_found') return 'ФНС (поиск ИНН): ИНН не найден ни с датой выдачи, ни без неё.';
        if (external.status === 'error') return `ФНС (поиск ИНН): ошибка ${external.error && external.error.message ? external.error.message : 'без описания'}.`;
        if (external.status === 'found_with_date') return `ФНС (поиск ИНН): найден ИНН ${external.foundInn} с указанной датой выдачи.`;
        if (external.status === 'found_without_date') return `ФНС (поиск ИНН): найден ИНН ${external.foundInn} только при запросе без даты выдачи.`;
        return `ФНС (поиск ИНН): найден ИНН ${external.foundInn}.`;
    }

    function evidenceText(evidence, run, edocId) {
        if (!evidence || !evidence.current) {
            const errors = evidence && evidence.errors ? evidence.errors : [];
            return errors.length ? `ОШИБКИ\n${errors.join('\n')}` : 'Данные ещё собираются.';
        }
        const current = evidence.current;
        const lines = [
            'ДАННЫЕ ТЕКУЩЕГО EDOC В ПИРАМИДЕ',
            `ФИО: ${current.fullName || '—'}`,
            `Дата рождения: ${current.birthDate || '—'}`,
            `Паспорт: ${formatPassport(current.series, current.number) || '—'}; дата выдачи: ${current.issueDate || '—'}`,
            `ИНН: ${current.inn || '—'}`,
            `Дата смерти: ${current.deathDate || '—'}`,
            `Лицевой счёт: ${current.accountNumber || '—'}; связанных DebtID: ${evidence.relatedDebtCount || 0}`,
            '',
            `ПАСПОРТНЫЕ ВАРИАНТЫ И ОТВЕТЫ ФНС (${evidence.candidates.length})`
        ];
        evidence.candidates.forEach((candidate, index) => {
            lines.push(`${index + 1}. ${formatPassport(candidate.series, candidate.number)}; дата выдачи: ${candidate.issueDate || '—'}; ИНН Пирамиды: ${candidate.pyramidInn || '—'}; EDocID: ${candidate.sourceEdocIds.join(', ') || '—'}.`);
            lines.push(`   ${describePassportExternal(candidate)}`);
        });
        lines.push('', 'ПРОВЕРКА ДАТЫ СМЕРТИ');
        const deathLines = describeDeathSources(evidence, run.invalidInnResults, true);
        lines.push(...(deathLines.length ? deathLines : ['Внешние проверки ещё не завершены.']));
        if (evidence.internalIssues.length) lines.push('', 'ВНУТРЕННИЕ ПРОТИВОРЕЧИЯ', ...evidence.internalIssues);
        if (evidence.errors.length) lines.push('', 'ОШИБКИ СБОРА', ...evidence.errors);
        const logs = run.logs.filter((item) => !item.edocId || item.edocId === edocId);
        if (logs.length) {
            lines.push('', 'ЖУРНАЛ ПРОВЕРОК');
            logs.forEach((item) => lines.push(`${item.timestamp} · ${item.service} · ${item.subject} · ${item.status}: ${item.details}`));
        }
        return lines.join('\n');
    }

    function createFact(label, value, subtext = '') {
        const fact = document.createElement('div');
        fact.className = 'piv-fact';
        const labelNode = document.createElement('span');
        labelNode.className = 'piv-label';
        labelNode.textContent = label;
        const valueNode = document.createElement('div');
        valueNode.className = 'piv-fact-value';
        valueNode.textContent = value || '—';
        fact.append(labelNode, valueNode);
        if (subtext) {
            const sub = document.createElement('span');
            sub.className = 'piv-sub';
            sub.textContent = subtext;
            fact.appendChild(sub);
        }
        return fact;
    }

    function createStatusPanel(label, value) {
        const normalized = value || verdict('muted', 'Ожидание', 'Проверка ещё не началась.');
        const panel = document.createElement('section');
        panel.className = 'piv-check';
        panel.title = normalized.details || '';
        const labelNode = document.createElement('span');
        labelNode.className = 'piv-label';
        labelNode.textContent = label;
        const detail = document.createElement('div');
        detail.className = 'piv-status-detail';
        detail.textContent = normalized.details || 'Подробности появятся после ответа источника.';
        panel.append(labelNode, statusBadge(normalized), detail);
        return panel;
    }

    function renderResults(run) {
        const body = document.getElementById('piv-results');
        if (!body) return;
        const opened = new Set(Array.from(body.querySelectorAll('.piv-case-details[open]')).map((node) => node.closest('.piv-case') && node.closest('.piv-case').dataset.edocId).filter(Boolean));
        body.textContent = '';
        run.rows.forEach((rowState) => {
            const evidence = rowState.evidence;
            const current = evidence && evidence.current;
            const display = evidence && evidence.verdicts ? evidence.verdicts : rowState.display;
            const edocId = digitsOnly(rowState.target.edocId) || '—';
            const card = document.createElement('article');
            card.className = 'piv-case';
            card.dataset.edocId = edocId;

            const head = document.createElement('header');
            head.className = 'piv-case-head';
            const person = document.createElement('div');
            person.className = 'piv-person';
            person.textContent = current ? current.fullName : normalizeText(rowState.target.fullName) || 'Сбор данных…';
            const personSub = document.createElement('span');
            personSub.className = 'piv-sub';
            personSub.textContent = current ? `${current.birthDate || 'Дата рождения не найдена'} · ЛС ${current.accountNumber || '—'}` : rowState.statusText;
            person.appendChild(personSub);
            const id = document.createElement('div');
            id.className = 'piv-id';
            id.textContent = `EDocID ${edocId}`;
            head.append(person, id);

            const facts = document.createElement('div');
            facts.className = 'piv-facts';
            facts.append(
                createFact('Паспорт в Пирамиде', current ? formatPassport(current.series, current.number) : '—', current ? `Дата выдачи: ${current.issueDate || 'не указана'}` : ''),
                createFact('ИНН в Пирамиде', current && current.inn ? current.inn : '—'),
                createFact('Дата смерти в Пирамиде', current && current.deathDate ? current.deathDate : '—')
            );

            const checks = document.createElement('div');
            checks.className = 'piv-checks';
            checks.append(
                createStatusPanel('Паспорт', display && display.passport),
                createStatusPanel('ИНН', display && display.inn),
                createStatusPanel('Дата смерти', display && display.death),
                createStatusPanel('Общий вывод', display && display.overall)
            );

            const details = document.createElement('details');
            details.className = 'piv-case-details';
            details.open = opened.has(edocId) || run.rows.length === 1;
            const summary = document.createElement('summary');
            summary.textContent = 'Все проверенные данные и ответы источников';
            const content = document.createElement('div');
            content.className = 'piv-evidence';
            content.textContent = evidenceText(evidence || { errors: rowState.errors || [] }, run, edocId);
            details.append(summary, content);
            card.append(head, facts, checks, details);
            body.appendChild(card);
        });
    }

    function waitingDisplay() {
        return {
            passport: verdict('muted', 'Ожидание', 'Сначала будут собраны паспортные данные из текущей базы Пирамиды.'),
            inn: verdict('muted', 'Ожидание', 'Проверка ИНН начнётся после получения паспортных вариантов.'),
            death: verdict('muted', 'Ожидание', 'Дата смерти будет проверена через ФНС и Нотариат.'),
            overall: verdict('muted', 'Проверка не начата', 'Итог появится после перекрёстной проверки всех доступных источников.')
        };
    }

    function updatePassportDisplay(rowState) {
        const evidence = rowState.evidence;
        if (!evidence || !evidence.current) return;
        const completed = evidence.candidates.filter((candidate) => candidate.external);
        const confirmedInns = unique(completed.map((candidate) => candidate.external && candidate.external.foundInn));
        const details = evidence.candidates.map((candidate) => `${formatPassport(candidate.series, candidate.number)}${candidate.issueDate ? ` от ${candidate.issueDate}` : ' без даты выдачи'} — ${describePassportExternal(candidate)}`).join(' ');
        if (completed.length === evidence.candidates.length) {
            const identity = evaluateIdentityEvidence(evidence);
            rowState.display.passport = identity.passport;
            rowState.display.inn = identity.inn;
        } else {
            rowState.display.passport = verdict(
                confirmedInns.length ? 'ok' : 'muted',
                `ФНС: проверено ${completed.length} из ${evidence.candidates.length}`,
                details
            );
            rowState.display.inn = confirmedInns.length
                ? verdict('ok', 'ИНН уже найден', `Источник: ФНС (поиск ИНН) по паспортным данным. Получено: ${confirmedInns.join(', ')}. Остальные паспортные варианты ещё проверяются.`)
                : verdict('muted', 'Поиск продолжается', `ФНС пока не вернул ИНН. Проверено паспортных вариантов: ${completed.length} из ${evidence.candidates.length}.`);
        }
        rowState.display.overall = verdict('muted', 'Проверка идёт', `Проверено паспортных вариантов: ${completed.length} из ${evidence.candidates.length}. Ожидаются остальные внешние ответы.`);
    }

    function updateDeathDisplay(rowState, run) {
        const evidence = rowState.evidence;
        if (!evidence || !evidence.current) return;
        const inns = relevantInnsForEvidence(evidence);
        const checkedInns = inns.filter((inn) => run.invalidInnResults.has(inn));
        const notariatDone = Boolean(evidence.probate);
        const details = describeDeathSources(evidence, run.invalidInnResults, true);
        const dates = unique([
            ...checkedInns.map((inn) => run.invalidInnResults.get(inn)).filter((response) => response && response.ok && response.result.date).map((response) => response.result.date),
            ...(evidence.probate && evidence.probate.ok ? evidence.probate.result.records.map((record) => record.deathDate) : [])
        ]);
        rowState.display.death = verdict(
            dates.length ? 'warn' : 'muted',
            dates.length ? `Найдена дата: ${dates.join(', ')}` : `Проверено источников: ${checkedInns.length + (notariatDone ? 1 : 0)} из ${inns.length + 1}`,
            details.length ? details.join(' ') : 'Ответы ФНС и Нотариата ещё ожидаются.'
        );
        rowState.display.overall = verdict('muted', 'Проверка идёт', `Нотариат: ${notariatDone ? 'ответ получен' : 'ожидание'}; ФНС (дата смерти по ИНН): ${checkedInns.length} из ${inns.length}.`);
    }

    function maybeFinalizeRow(rowState, run) {
        const evidence = rowState.evidence;
        if (!evidence || !evidence.current) return false;
        const passportDone = evidence.candidates.every((candidate) => candidate.external);
        const deathInns = relevantInnsForEvidence(evidence);
        const invalidInnDone = deathInns.every((inn) => run.invalidInnResults.has(inn));
        if (!passportDone || !evidence.probate || !invalidInnDone) return false;
        evidence.verdicts = evaluateEvidence(evidence, run.invalidInnResults);
        rowState.display = evidence.verdicts;
        rowState.statusText = 'Проверка завершена';
        return true;
    }

    function applyPassportResult(run, key, result) {
        run.rows.forEach((rowState) => {
            const evidence = rowState.evidence;
            if (!evidence || !evidence.current) return;
            let changed = false;
            evidence.candidates.forEach((candidate) => {
                if (candidateLookupKey(evidence, candidate) !== key) return;
                candidate.external = result;
                changed = true;
            });
            if (!changed) return;
            updatePassportDisplay(rowState);
            updateDeathDisplay(rowState, run);
            maybeFinalizeRow(rowState, run);
        });
    }

    function applyProbateResult(run, key, result) {
        run.rows.forEach((rowState) => {
            const evidence = rowState.evidence;
            if (!evidence || !evidence.current) return;
            const evidenceKey = `${normalizeMatchText(evidence.current.fullName)}|${evidence.current.birthDate}`;
            if (evidenceKey !== key) return;
            evidence.probate = result;
            updateDeathDisplay(rowState, run);
            maybeFinalizeRow(rowState, run);
        });
    }

    function refreshRowsForInvalidInn(run, inn) {
        run.rows.forEach((rowState) => {
            const evidence = rowState.evidence;
            if (!evidence || !evidence.current || !relevantInnsForEvidence(evidence).includes(inn)) return;
            updateDeathDisplay(rowState, run);
            maybeFinalizeRow(rowState, run);
        });
    }

    function resetModal(run) {
        const overlay = ensureModal();
        overlay.hidden = false;
        showNotice('', '');
        const cancel = overlay.querySelector('#piv-cancel');
        const done = overlay.querySelector('#piv-done');
        const copy = overlay.querySelector('#piv-copy');
        const download = overlay.querySelector('#piv-download');
        const retry = overlay.querySelector('#piv-retry');
        cancel.hidden = false;
        cancel.disabled = false;
        done.hidden = true;
        copy.disabled = true;
        download.disabled = true;
        retry.hidden = true;
        setRunStage(run, 'Подготовка проверки…');
        updateProgress(run);
        renderResults(run);
    }

    function finishModal(run, message) {
        const overlay = ensureModal();
        overlay.querySelector('#piv-cancel').hidden = true;
        overlay.querySelector('#piv-done').hidden = false;
        overlay.querySelector('#piv-copy').disabled = !run.rows.some((row) => row.evidence && row.evidence.verdicts);
        overlay.querySelector('#piv-download').disabled = !run.rows.some((row) => row.evidence);
        const failedRows = run.rows.filter((row) => !row.evidence || !row.evidence.verdicts || row.evidence.verdicts.overall.text === 'Проверка выполнена не полностью');
        overlay.querySelector('#piv-retry').hidden = failedRows.length < 1;
        const note = overlay.querySelector('#piv-foot-note');
        if (note) note.textContent = message;
        renderResults(run);
    }

    function cancelActiveRun() {
        if (!activeRun || activeRun.status !== 'running') return;
        activeRun.cancelled = true;
        activeRun.status = 'cancelled';
        activeRun.controller.abort();
        setRunStage(activeRun, 'Проверка отменяется…');
        showNotice('Проверка отменена пользователем. Уже собранные данные останутся доступны.', 'warning');
    }

    function retryFailedRows(run) {
        if (!run || run.status === 'running') return;
        const targets = run.rows
            .filter((row) => !row.evidence || !row.evidence.verdicts || row.evidence.verdicts.overall.text === 'Проверка выполнена не полностью')
            .map((row) => row.target);
        if (!targets.length) {
            showNotice('Технических ошибок для повторной проверки нет.', 'success');
            return;
        }
        startVerification(targets);
    }

    async function performVerification(run) {
        try {
            setRunStage(run, 'Пирамида: сбор карточек и паспортной истории');
            for (const rowState of run.rows) {
                ensureNotCancelled(run);
                try {
                    rowState.evidence = await collectPyramidEvidence(rowState.target, run);
                    rowState.statusText = 'Данные Пирамиды собраны';
                    rowState.display.passport = verdict('muted', 'Ожидает ФНС', `Пирамида: найдено паспортных вариантов ${rowState.evidence.candidates.length}. Начинается внешняя проверка каждого варианта.`);
                    rowState.display.inn = verdict('muted', 'Ожидает ФНС', `ИНН Пирамиды: ${rowState.evidence.current.inn || 'не указан'}. Будет выполнен поиск ИНН по паспортным данным.`);
                    rowState.display.death = verdict('muted', 'Ожидает источники', 'Будут проверены ФНС (дата смерти по ИНН) и Нотариат — наследственные дела.');
                    rowState.display.overall = verdict('muted', 'Данные Пирамиды собраны', 'Внешняя перекрёстная проверка ещё выполняется.');
                    addLog(run, 'Пирамида', 'Сбор связанных EDoc', 'Успешно', `DebtID: ${rowState.evidence.relatedDebtCount}; паспортов: ${rowState.evidence.candidates.length}`, rowState.target.edocId);
                } catch (error) {
                    if (error instanceof CancelledError || run.cancelled) throw new CancelledError();
                    rowState.errors.push(error.message || String(error));
                    rowState.statusText = 'Ошибка получения данных';
                    rowState.evidence = { target: rowState.target, current: null, candidates: [], internalIssues: [], errors: [...rowState.errors], probate: null, verdicts: null };
                    const errorVerdict = verdict('danger', 'Ошибка данных Пирамиды', error.message || String(error));
                    rowState.display = { passport: errorVerdict, inn: errorVerdict, death: errorVerdict, overall: errorVerdict };
                    addLog(run, 'Пирамида', 'Сбор связанных EDoc', 'Ошибка', error.message || String(error), rowState.target.edocId);
                }
                run.completedUnits += 1;
                updateProgress(run);
                renderResults(run);
            }

            const usable = run.rows.map((row) => row.evidence).filter((evidence) => evidence && evidence.current);
            const lookupEntries = [];
            usable.forEach((evidence) => evidence.candidates.forEach((candidate) => {
                const key = candidateLookupKey(evidence, candidate);
                if (!run.passportLookupCache.has(key)) {
                    const promise = { key, evidence, candidate };
                    run.passportLookupCache.set(key, promise);
                    lookupEntries.push(promise);
                }
            }));
            const personEntries = [];
            usable.forEach((evidence) => {
                const key = `${normalizeMatchText(evidence.current.fullName)}|${evidence.current.birthDate}`;
                if (!run.probateCache.has(key)) {
                    const entry = { key, evidence };
                    run.probateCache.set(key, entry);
                    personEntries.push(entry);
                }
            });
            run.totalUnits += lookupEntries.length + personEntries.length;
            updateProgress(run);

            const probatePromise = mapLimit(personEntries, 1, async (entry) => {
                const current = entry.evidence.current;
                setRunStage(run, `Нотариат: ${current.fullName}`);
                const response = await callExternalWithRetries(ACTION_CHECK_PROBATE, {
                    fio: current.fullName,
                    birthDate: current.birthDate
                }, run, {
                    service: 'Нотариат',
                    subject: current.fullName,
                    edocId: current.edocId,
                    successDetails: (result) => result.status === 'found' ? `Найдено дел: ${result.count}.` : 'Наследственные дела не найдены.'
                });
                entry.result = response;
                applyProbateResult(run, entry.key, response);
                run.completedUnits += 1;
                updateProgress(run);
                renderResults(run);
                return entry;
            });

            for (const entry of lookupEntries) {
                ensureNotCancelled(run);
                entry.result = await verifyPassportCandidate(entry.candidate, entry.evidence, run);
                applyPassportResult(run, entry.key, entry.result);
                run.completedUnits += 1;
                updateProgress(run);
                renderResults(run);
            }
            await probatePromise;

            usable.forEach((evidence) => {
                evidence.candidates.forEach((candidate) => {
                    const cached = run.passportLookupCache.get(candidateLookupKey(evidence, candidate));
                    candidate.external = cached && cached.result ? cached.result : { status: 'error', error: { message: 'Результат поиска ИНН потерян.' }, foundInn: '' };
                });
                const probateKey = `${normalizeMatchText(evidence.current.fullName)}|${evidence.current.birthDate}`;
                const probateEntry = run.probateCache.get(probateKey);
                evidence.probate = probateEntry && probateEntry.result ? probateEntry.result : null;
            });

            const inns = unique(usable.flatMap((evidence) => [
                evidence.current.inn,
                ...evidence.candidates.map((candidate) => candidate.pyramidInn),
                ...evidence.candidates.map((candidate) => candidate.external && candidate.external.foundInn)
            ])).filter((inn) => digitsOnly(inn).length === 12);
            run.totalUnits += inns.length;
            updateProgress(run);
            setRunStage(run, 'ФНС: проверка дат смерти по ИНН');
            await mapLimit(inns, 2, async (inn) => {
                const response = await callExternalWithRetries(ACTION_CHECK_INVALID_INN, { inn }, run, {
                    service: 'ФНС (дата смерти по ИНН)',
                    subject: inn,
                    successDetails: (result) => result.date ? `Дата смерти: ${result.date}.` : 'Дата смерти не найдена.'
                });
                run.invalidInnResults.set(inn, response);
                refreshRowsForInvalidInn(run, inn);
                run.completedUnits += 1;
                updateProgress(run);
                renderResults(run);
            });

            run.rows.forEach((rowState) => {
                if (!maybeFinalizeRow(rowState, run) && rowState.evidence && rowState.evidence.current) {
                    rowState.evidence.verdicts = evaluateEvidence(rowState.evidence, run.invalidInnResults);
                    rowState.display = rowState.evidence.verdicts;
                }
            });
            run.completedUnits = run.totalUnits;
            run.status = 'completed';
            setRunStage(run, 'Проверка завершена');
            updateProgress(run);
            renderResults(run);
            finishModal(run, `Проверено EDoc: ${run.rows.length}. Данные Пирамиды не изменены и не сохранялись в расширении. Excel доступен по отдельной кнопке.`);
        } catch (error) {
            if (error instanceof CancelledError || run.cancelled) {
                run.status = 'cancelled';
                setRunStage(run, 'Проверка отменена');
                finishModal(run, 'Проверка отменена. Доступны уже собранные результаты.');
                return;
            }
            run.status = 'failed';
            setRunStage(run, 'Проверка остановлена из-за ошибки');
            showNotice(error && error.message ? error.message : String(error), 'danger');
            addLog(run, 'Расширение', 'Конвейер проверки', 'Ошибка', error && error.message ? error.message : String(error));
            finishModal(run, 'Произошла непредвиденная ошибка. Собранные данные сохранены в окне.');
        }
    }

    function escapeXml(value) {
        return String(value === undefined || value === null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function columnName(index) {
        let value = index + 1;
        let result = '';
        while (value > 0) {
            value -= 1;
            result = String.fromCharCode(65 + (value % 26)) + result;
            value = Math.floor(value / 26);
        }
        return result;
    }

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (const byte of bytes) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function push16(target, value) {
        target.push(value & 255, (value >>> 8) & 255);
    }

    function push32(target, value) {
        target.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
    }

    function storedZip(files) {
        const encoder = new TextEncoder();
        const chunks = [];
        const central = [];
        let offset = 0;
        files.forEach((file) => {
            const name = encoder.encode(file.name);
            const data = encoder.encode(file.content);
            const crc = crc32(data);
            const local = [];
            push32(local, 0x04034B50); push16(local, 20); push16(local, 0x0800); push16(local, 0); push16(local, 0); push16(local, 0);
            push32(local, crc); push32(local, data.length); push32(local, data.length); push16(local, name.length); push16(local, 0);
            chunks.push(new Uint8Array(local), name, data);
            const header = [];
            push32(header, 0x02014B50); push16(header, 20); push16(header, 20); push16(header, 0x0800); push16(header, 0); push16(header, 0); push16(header, 0);
            push32(header, crc); push32(header, data.length); push32(header, data.length); push16(header, name.length); push16(header, 0); push16(header, 0); push16(header, 0); push16(header, 0); push32(header, 0); push32(header, offset);
            central.push({ header: new Uint8Array(header), name });
            offset += local.length + name.length + data.length;
        });
        const centralOffset = offset;
        central.forEach((record) => { chunks.push(record.header, record.name); offset += record.header.length + record.name.length; });
        const end = [];
        push32(end, 0x06054B50); push16(end, 0); push16(end, 0); push16(end, files.length); push16(end, files.length); push32(end, offset - centralOffset); push32(end, centralOffset); push16(end, 0);
        chunks.push(new Uint8Array(end));
        return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function sheetXml(rows) {
        const columnCount = Math.max(1, ...rows.map((row) => row.length));
        const xmlRows = rows.map((row, rowIndex) => {
            const cells = row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr" s="${rowIndex === 0 ? 1 : 2}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`).join('');
            return `<row r="${rowIndex + 1}">${cells}</row>`;
        }).join('');
        const lastCell = `${columnName(columnCount - 1)}${Math.max(1, rows.length)}`;
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${columnCount}" width="22" customWidth="1"/></cols><sheetData>${xmlRows}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`;
    }

    function workbookBlob(sheets) {
        const files = [];
        const sheetEntries = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
        const relEntries = sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
        const overrides = sheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
        files.push({ name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` });
        files.push({ name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
        files.push({ name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>` });
        files.push({ name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntries}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
        files.push({ name: 'xl/styles.xml', content: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176F68"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>' });
        sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet.rows) }));
        return storedZip(files);
    }

    function buildSummaryRows(run) {
        const rows = [['База', 'Департамент', 'EDocID', 'DebtID', 'ЛС', 'ФИО', 'Дата рождения', 'Паспорт Пирамиды', 'Дата выдачи', 'ИНН Пирамиды', 'Дата смерти Пирамиды', 'Паспорт — вывод', 'ИНН ФНС', 'ИНН — вывод', 'Дата смерти ФНС', 'Дата смерти Нотариат', 'Дата смерти — вывод', 'Общий итог', 'Причина']];
        run.rows.forEach((row) => {
            const evidence = row.evidence;
            const current = evidence && evidence.current;
            const verdicts = evidence && evidence.verdicts;
            rows.push([
                window.location.hostname,
                current && current.departmentName,
                digitsOnly(row.target.edocId),
                current && current.debtId,
                current && current.accountNumber,
                current && current.fullName,
                current && current.birthDate,
                current && formatPassport(current.series, current.number),
                current && current.issueDate,
                current && current.inn,
                current && current.deathDate,
                verdicts && verdicts.passport.text,
                verdicts && verdicts.foundInns.join('; '),
                verdicts && verdicts.inn.text,
                verdicts && verdicts.fnsDates.join('; '),
                verdicts && verdicts.notariatDates.join('; '),
                verdicts && verdicts.death.text,
                verdicts && verdicts.overall.text,
                verdicts ? [verdicts.passport.details, verdicts.inn.details, verdicts.death.details, verdicts.overall.details].filter(Boolean).join(' ') : (row.errors || []).join(' ')
            ]);
        });
        return rows;
    }

    function buildCandidateRows(run) {
        const rows = [['Исходный EDocID', 'ФИО', 'Дата рождения', 'Паспорт', 'Дата выдачи', 'ИНН Пирамиды', 'Результат ФНС', 'ИНН ФНС', 'EDocID-источники', 'DebtID-источники', 'Даты EDoc']];
        run.rows.forEach((row) => {
            const evidence = row.evidence;
            if (!evidence || !evidence.current) return;
            evidence.candidates.forEach((candidate) => rows.push([
                evidence.current.edocId,
                evidence.current.fullName,
                evidence.current.birthDate,
                formatPassport(candidate.series, candidate.number),
                candidate.issueDate,
                candidate.pyramidInn,
                candidate.external && candidate.external.status,
                candidate.external && candidate.external.foundInn,
                candidate.sourceEdocIds.join('; '),
                candidate.sourceDebtIds.join('; '),
                candidate.sourceEdDates.join('; ')
            ]));
        });
        return rows;
    }

    function buildWorkbook(run) {
        return workbookBlob([
            { name: 'Итоги', rows: buildSummaryRows(run) },
            { name: 'Паспортные варианты', rows: buildCandidateRows(run) },
            { name: 'Ошибки и проверки', rows: [['Время', 'EDocID', 'Сервис', 'Объект', 'Статус', 'Подробности'], ...run.logs.map((item) => [item.timestamp, item.edocId, item.service, item.subject, item.status, item.details])] }
        ]);
    }

    function buildFileName(run) {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        const department = normalizeText(run.rows.find((row) => row.evidence && row.evidence.current)?.evidence.current.departmentName || 'Текущая_база').replace(/[^0-9a-zа-яё]+/gi, '_').replace(/^_+|_+$/g, '');
        return `Проверка_паспортов_ИНН_смерти_${department}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
    }

    function downloadRunWorkbook(run) {
        if (!run || !run.rows.some((row) => row.evidence)) return false;
        const link = document.createElement('a');
        const url = URL.createObjectURL(buildWorkbook(run));
        link.href = url;
        link.download = buildFileName(run);
        link.style.display = 'none';
        (document.body || document.documentElement).appendChild(link);
        link.click();
        setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1500);
        return true;
    }

    async function copyRunResults(run) {
        if (!run) return;
        const text = buildSummaryRows(run).map((row) => row.map((value) => normalizeText(value).replace(/\t/g, ' ')).join('\t')).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            showNotice('Результаты скопированы в буфер обмена.', 'success');
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-10000px';
            (document.body || document.documentElement).appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            textarea.remove();
            showNotice(copied ? 'Результаты скопированы в буфер обмена.' : 'Не удалось скопировать результаты.', copied ? 'success' : 'danger');
        }
    }

    function startVerification(targets) {
        const normalizedTargets = [];
        const seen = new Set();
        (Array.isArray(targets) ? targets : []).forEach((target) => {
            const edocId = digitsOnly(target && target.edocId);
            if (!edocId || seen.has(edocId)) return;
            seen.add(edocId);
            normalizedTargets.push({ ...target, edocId });
        });
        if (!normalizedTargets.length) {
            window.alert('Не удалось определить EDocID строк для проверки.');
            return;
        }
        if (activeRun && activeRun.status === 'running') {
            ensureModal().hidden = false;
            showNotice('Проверка уже выполняется. Дождитесь завершения или отмените её.', 'warning');
            return;
        }
        activeRun = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            status: 'running',
            cancelled: false,
            controller: new AbortController(),
            rows: normalizedTargets.map((target) => ({ target, evidence: null, errors: [], statusText: 'Ожидание', display: waitingDisplay() })),
            logs: [],
            slowsearchCache: new Map(),
            edocCache: new Map(),
            passportLookupCache: new Map(),
            innRequestCache: new Map(),
            probateCache: new Map(),
            invalidInnResults: new Map(),
            completedUnits: 0,
            totalUnits: normalizedTargets.length,
            captchaCount: 0,
            stage: ''
        };
        resetModal(activeRun);
        void performVerification(activeRun);
    }

    window.addEventListener(START_EVENT, (event) => {
        const detail = event && event.detail ? event.detail : {};
        startVerification(detail.targets || []);
    });

    window.PyramidIdentityVerification = Object.freeze({
        start: startVerification,
        cancel: cancelActiveRun,
        getStatus: () => activeRun ? activeRun.status : 'idle'
    });
})();
