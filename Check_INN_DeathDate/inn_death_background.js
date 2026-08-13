(function initializePyramidIdentityVerificationBackground() {
    'use strict';

    const ACTION_LOOKUP_INN = 'PYRAMID_IDENTITY_LOOKUP_INN';
    const ACTION_CHECK_INVALID_INN = 'PYRAMID_IDENTITY_CHECK_INVALID_INN';
    const ACTION_CHECK_PROBATE = 'PYRAMID_IDENTITY_CHECK_PROBATE';
    const FNS_INN_PAGE_URL = 'https://service.nalog.ru/inn.do';
    const FNS_CONSENT_URL = 'https://service.nalog.ru/static/personal-data-proc.json';
    const FNS_INN_API_URL = 'https://service.nalog.ru/inn-new-proc.json';
    const FNS_INVALID_INN_API_URL = 'https://service.nalog.ru/invalid-inn-proc.json';
    const NOTARIAT_API_URL = 'https://notariat.ru/api/probate-cases';
    const REQUEST_TIMEOUT_MS = 30000;
    const INN_LOOKUP_INTERVAL_MS = 11000;
    const INN_POLL_ATTEMPTS = 16;
    const INN_POLL_INTERVAL_MS = 500;
    const NOTARIAT_IGNORED_CASE_IDS = new Set(['38129461']);

    let innLookupQueue = Promise.resolve();
    let lastInnLookupStartedAt = 0;

    class VerificationServiceError extends Error {
        constructor(code, message, options = {}) {
            super(message);
            this.name = 'VerificationServiceError';
            this.code = code || 'SERVICE_ERROR';
            this.service = options.service || '';
            this.retryable = options.retryable !== false;
            this.details = options.details || null;
        }
    }

    function sleep(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds || 0)));
    }

    function digitsOnly(value) {
        return String(value === undefined || value === null ? '' : value).replace(/\D/g, '');
    }

    function normalizeText(value) {
        return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function splitFio(value) {
        const parts = normalizeText(value).split(' ').filter(Boolean);
        return {
            surname: parts[0] || '',
            name: parts[1] || '',
            patronymic: parts.slice(2).join(' ')
        };
    }

    function formatPassportNumber(series, number) {
        const normalizedSeries = digitsOnly(series);
        const normalizedNumber = digitsOnly(number);
        if (normalizedSeries.length !== 4 || normalizedNumber.length !== 6) return '';
        return `${normalizedSeries.slice(0, 2)} ${normalizedSeries.slice(2)} ${normalizedNumber}`;
    }

    function formatBirthDateForNotariat(value) {
        const match = normalizeText(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        return match ? `${match[3]}${match[2]}${match[1]}` : '';
    }

    function extractDate(value) {
        const text = normalizeText(value);
        const russianMatch = text.match(/\b\d{2}\.\d{2}\.\d{4}\b/);
        if (russianMatch) return russianMatch[0];
        const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
        return isoMatch ? `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}` : '';
    }

    async function fetchWithTimeout(url, options = {}, service = '') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } catch (error) {
            if (error && error.name === 'AbortError') {
                throw new VerificationServiceError(
                    'REQUEST_TIMEOUT',
                    `Сервис ${service || 'проверки'} не ответил за ${Math.round(REQUEST_TIMEOUT_MS / 1000)} секунд.`,
                    { service, retryable: true }
                );
            }
            throw new VerificationServiceError(
                'NETWORK_ERROR',
                `Не удалось связаться с сервисом ${service || 'проверки'}: ${error && error.message ? error.message : error}`,
                { service, retryable: true }
            );
        } finally {
            clearTimeout(timeout);
        }
    }

    async function readJsonResponse(response, service, operation) {
        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new VerificationServiceError(
                'INVALID_RESPONSE',
                `${service}: получен некорректный ответ при операции «${operation}».`,
                { service, retryable: true, details: text.slice(0, 500) }
            );
        }
        if (!response.ok) {
            assertNoFnsCaptcha(data);
            throw new VerificationServiceError(
                response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR',
                `${service}: HTTP ${response.status} при операции «${operation}».`,
                { service, retryable: response.status === 429 || response.status >= 500, details: data }
            );
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new VerificationServiceError(
                'INVALID_RESPONSE',
                `${service}: неожиданный формат ответа при операции «${operation}».`,
                { service, retryable: true, details: data }
            );
        }
        return data;
    }

    function assertNoFnsCaptcha(data) {
        const errors = data && typeof data.ERRORS === 'object' ? data.ERRORS : null;
        if (data && data.captchaRequired === true) {
            throw new VerificationServiceError(
                'CAPTCHA_REQUIRED',
                'ФНС потребовал ввод капчи.',
                { service: 'ФНС (поиск ИНН)', retryable: true, details: data }
            );
        }
        if (errors && errors.captcha) {
            throw new VerificationServiceError(
                'CAPTCHA_REQUIRED',
                `ФНС потребовал ввод капчи: ${normalizeText(errors.captcha)}`,
                { service: 'ФНС (поиск ИНН)', retryable: true, details: data }
            );
        }
    }

    async function prepareFnsInnSession() {
        const pageResponse = await fetchWithTimeout(FNS_INN_PAGE_URL, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        }, 'ФНС (поиск ИНН)');
        if (!pageResponse.ok) {
            throw new VerificationServiceError(
                'HTTP_ERROR',
                `ФНС: не удалось открыть сервис поиска ИНН, HTTP ${pageResponse.status}.`,
                { service: 'ФНС (поиск ИНН)', retryable: pageResponse.status >= 500 }
            );
        }

        const consentResponse = await fetchWithTimeout(FNS_CONSENT_URL, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: new URLSearchParams({
                from: '/inn.do',
                svc: 'inn',
                personalData: '1'
            })
        }, 'ФНС (поиск ИНН)');
        if (!consentResponse.ok) {
            throw new VerificationServiceError(
                'CONSENT_FAILED',
                `ФНС: не удалось подтвердить согласие, HTTP ${consentResponse.status}.`,
                { service: 'ФНС (поиск ИНН)', retryable: consentResponse.status >= 500 }
            );
        }
    }

    async function lookupInnDirect(payload) {
        const fio = splitFio(payload && payload.fio);
        const birthDate = normalizeText(payload && payload.birthDate);
        const documentNumber = formatPassportNumber(payload && payload.series, payload && payload.number);
        const issueDate = normalizeText(payload && payload.issueDate);
        if (!fio.surname || !fio.name || !birthDate || !documentNumber) {
            throw new VerificationServiceError(
                'INVALID_INPUT',
                'Для поиска ИНН не хватает ФИО, даты рождения или паспортных данных.',
                { service: 'ФНС (поиск ИНН)', retryable: false }
            );
        }

        await prepareFnsInnSession();
        const findPayload = new URLSearchParams({
            c: 'find',
            captcha: '',
            captchaToken: '',
            fam: fio.surname,
            nam: fio.name,
            bdate: birthDate,
            doctype: '21',
            docno: documentNumber,
            docdt: issueDate
        });
        if (fio.patronymic) findPayload.set('otch', fio.patronymic);
        else findPayload.set('opt_otch', '1');

        const findResponse = await fetchWithTimeout(FNS_INN_API_URL, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: findPayload
        }, 'ФНС (поиск ИНН)');
        const findData = await readJsonResponse(findResponse, 'ФНС (поиск ИНН)', 'создание запроса');
        assertNoFnsCaptcha(findData);

        const requestId = normalizeText(findData.requestId);
        if (!requestId) {
            throw new VerificationServiceError(
                'MISSING_REQUEST_ID',
                'ФНС не вернул идентификатор запроса поиска ИНН.',
                { service: 'ФНС (поиск ИНН)', retryable: true, details: findData }
            );
        }

        let lastData = findData;
        for (let attempt = 0; attempt < INN_POLL_ATTEMPTS; attempt += 1) {
            const resultResponse = await fetchWithTimeout(FNS_INN_API_URL, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: new URLSearchParams({ c: 'get', requestId })
            }, 'ФНС (поиск ИНН)');
            lastData = await readJsonResponse(resultResponse, 'ФНС (поиск ИНН)', 'получение результата');
            assertNoFnsCaptcha(lastData);
            const state = Number(lastData.state);
            if (state === 0) {
                return {
                    status: 'not_found',
                    inn: '',
                    errorCode: normalizeText(lastData.error_code),
                    requestId
                };
            }
            if (state === 1) {
                const inn = digitsOnly(lastData.inn);
                if (inn.length !== 12) {
                    throw new VerificationServiceError(
                        'INVALID_INN_RESPONSE',
                        'ФНС вернул ИНН неожиданного формата.',
                        { service: 'ФНС (поиск ИНН)', retryable: true, details: lastData }
                    );
                }
                return { status: 'found', inn, errorCode: '', requestId };
            }
            if (state === -2) {
                throw new VerificationServiceError(
                    'SERVICE_UNAVAILABLE',
                    'ФНС временно не может выполнить поиск ИНН.',
                    { service: 'ФНС (поиск ИНН)', retryable: true, details: lastData }
                );
            }
            await sleep(INN_POLL_INTERVAL_MS);
        }

        throw new VerificationServiceError(
            'RESULT_TIMEOUT',
            'ФНС не сформировал итог поиска ИНН за отведённое время.',
            { service: 'ФНС (поиск ИНН)', retryable: true, details: lastData }
        );
    }

    function enqueueInnLookup(payload) {
        const queued = innLookupQueue.then(async () => {
            const remaining = INN_LOOKUP_INTERVAL_MS - (Date.now() - lastInnLookupStartedAt);
            if (remaining > 0) await sleep(remaining);
            lastInnLookupStartedAt = Date.now();
            return lookupInnDirect(payload);
        });
        innLookupQueue = queued.catch(() => undefined);
        return queued;
    }

    async function checkInvalidInn(payload) {
        const inn = digitsOnly(payload && payload.inn);
        if (inn.length !== 12) {
            throw new VerificationServiceError(
                'INVALID_INPUT',
                'Для проверки даты смерти нужен ИНН из 12 цифр.',
                { service: 'ФНС (дата смерти по ИНН)', retryable: false }
            );
        }
        const response = await fetchWithTimeout(FNS_INVALID_INN_API_URL, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: new URLSearchParams({ k: 'fl', inn })
        }, 'ФНС (дата смерти по ИНН)');
        const data = await readJsonResponse(response, 'ФНС (дата смерти по ИНН)', 'проверка даты смерти');
        return {
            status: extractDate(data.date) ? 'date_found' : 'no_date',
            inn,
            date: extractDate(data.date)
        };
    }

    function normalizeProbateRecord(record) {
        if (!record || typeof record !== 'object') return null;
        const caseId = normalizeText(record.CaseId || record.caseId || record.case_id || record.id);
        if (caseId && NOTARIAT_IGNORED_CASE_IDS.has(caseId)) return null;
        return {
            caseId,
            caseNumber: normalizeText(record.CaseNumber || record.caseNumber || record.case_number),
            fio: normalizeText(record.Fio || record.FIO || record.name || record.fio),
            birthDate: extractDate(record.BirthDate || record.birthDate || record.birth_date),
            deathDate: extractDate(record.DeathDate || record.deathDate || record.death_date)
        };
    }

    async function checkProbate(payload) {
        const fio = normalizeText(payload && payload.fio);
        const birthDate = formatBirthDateForNotariat(payload && payload.birthDate);
        if (!fio || !birthDate) {
            throw new VerificationServiceError(
                'INVALID_INPUT',
                'Для поиска наследственного дела не хватает ФИО или даты рождения.',
                { service: 'Нотариат', retryable: false }
            );
        }
        const response = await fetchWithTimeout(NOTARIAT_API_URL, {
            method: 'POST',
            credentials: 'omit',
            cache: 'no-store',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json;charset=UTF-8'
            },
            body: JSON.stringify({ name: fio, birth_date: birthDate, death_date: 'NULL' })
        }, 'Нотариат');
        const data = await readJsonResponse(response, 'Нотариат', 'поиск наследственного дела');
        const rawRecords = Array.isArray(data.records)
            ? data.records
            : (Array.isArray(data.items) ? data.items : (Array.isArray(data.data) ? data.data : []));
        const records = rawRecords.map(normalizeProbateRecord).filter(Boolean);
        return {
            status: records.length ? 'found' : 'not_found',
            count: records.length,
            records
        };
    }

    function serializeError(error) {
        return {
            code: error && error.code ? error.code : 'UNEXPECTED_ERROR',
            message: error && error.message ? error.message : String(error),
            service: error && error.service ? error.service : '',
            retryable: !(error && error.retryable === false),
            details: error && error.details ? error.details : null
        };
    }

    function notifyCaptcha() {
        if (!chrome.notifications || typeof chrome.notifications.create !== 'function') return;
        try {
            const result = chrome.notifications.create('pyramid-identity-verification-captcha', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icon.png'),
                title: 'Проверка приостановлена: ФНС запросил капчу',
                message: 'Повторный запрос будет выполнен автоматически через 30 секунд.',
                priority: 2
            });
            if (result && typeof result.catch === 'function') result.catch(() => undefined);
        } catch (error) {
            // Уведомление в модальном окне всё равно будет показано content script.
        }
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!request || ![ACTION_LOOKUP_INN, ACTION_CHECK_INVALID_INN, ACTION_CHECK_PROBATE].includes(request.action)) {
            return false;
        }

        let operation;
        if (request.action === ACTION_LOOKUP_INN) operation = enqueueInnLookup(request.data || {});
        else if (request.action === ACTION_CHECK_INVALID_INN) operation = checkInvalidInn(request.data || {});
        else operation = checkProbate(request.data || {});

        operation
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) => {
                if (error && error.code === 'CAPTCHA_REQUIRED') notifyCaptcha();
                sendResponse({ success: false, error: serializeError(error) });
            });
        return true;
    });
})();
