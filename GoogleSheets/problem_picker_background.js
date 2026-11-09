(function() {
  'use strict';

  const SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
  const SAVE_ACTION = 'GOOGLE_SHEETS_PROBLEM_PICKER_SAVE';
  const ITIL_FILL_ACTION = 'GOOGLE_SHEETS_ITIL_FILL_ROW';
  const SUPP_FILL_ACTION = 'GOOGLE_SHEETS_SUPP_FILL_ROW';
  const ITIL_OPEN_REQUEST_ACTION = 'GOOGLE_SHEETS_ITIL_OPEN_REQUEST';
  const SUPP_OPEN_REQUEST_ACTION = 'GOOGLE_SHEETS_SUPP_OPEN_REQUEST';
  const ITIL_INFO_REFRESH_ACTION = 'GOOGLE_SHEETS_ITIL_REFRESH_INFO_ROW';
  const SUPP_INFO_REFRESH_ACTION = 'GOOGLE_SHEETS_SUPP_REFRESH_INFO_ROW';
  const CHATGPT_SEARCH_ACTION = 'GOOGLE_SHEETS_CHATGPT_SEARCH';
  const CHATGPT_QUESTION_ACTION = 'GOOGLE_SHEETS_CHATGPT_QUESTION';
  const CHATGPT_OPEN_TAB_ACTION = 'GOOGLE_SHEETS_CHATGPT_OPEN_TAB';
  const CHATGPT_PROGRESS_ACTION = 'GOOGLE_SHEETS_CHATGPT_PROGRESS';
  const CHATGPT_CLOSE_TAB_ACTION = 'GOOGLE_SHEETS_CHATGPT_CLOSE_TAB';
  const ITIL_URL = 'http://tmn-vpitil1c01/ITIL/ru_RU/';
  const SUPP_URL = 'http://tmn-vpsupp1c01.corp.vostok-electra.ru/PMS/ru_RU/';
  const ITIL_BASE_URL = 'http://tmn-vpitil1c01/ITIL/';
  const ITIL_DESKTOP_HOST = 'ru.duplicate_marker.itil_desktop';
  const SUPP_BASE_URL = 'http://tmn-vpsupp1c01.corp.vostok-electra.ru/PMS/';
  const ONE_C_USERNAME = 'ЗуйкевичДИ';
  const ONE_C_PASSWORD = 'Nu3ho5ja';
  const CHATGPT_TEMPORARY_URL = 'https://chatgpt.com/?temporary-chat=true';
  const CHATGPT_URL_PREFIX = 'https://chatgpt.com/';
  const SUPP_NOT_FOUND_INFO_TEXT = 'Не найдена заявка в СУПП. Проверьте вручную';
  const SUPP_NO_DATA_INFO_TEXT = 'Информации по решению заявки нет';
  const WAIT_TIMEOUT_DEFAULTS_MS = Object.freeze({
    tabLoadMs: 90000,
    oneCReadyMs: 90000,
    itilAccountMs: 90000,
    itilServiceDeskMs: 30000,
    itilSearchInputMs: 60000,
    itilSearchResultMs: 60000,
    itilRequestTabMs: 60000,
    itilRequestTextMs: 60000,
    itilRequestCloseMs: 15000,
    suppSearchInputMs: 90000,
    suppSearchResultMs: 35000,
    suppCardOpenMs: 7000,
    suppFallbackCardOpenMs: 8000,
    suppRequestTextMs: 60000,
    suppDiscussionMs: 8000,
    suppCloseStepMs: 2500,
    suppCloseRetryMs: 3000,
    suppCloseFinalMs: 5000
  });

  function normalizeWaitTimeouts(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = { ...WAIT_TIMEOUT_DEFAULTS_MS };
    Object.keys(result).forEach((key) => {
      const timeoutMs = Number(source[key]);
      if (Number.isFinite(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 3600000) {
        result[key] = Math.round(timeoutMs);
      }
    });
    return result;
  }

  function isAllowedSender(sender) {
    try {
      const url = new URL(sender?.url);
      return url.origin === 'https://docs.google.com'
        && url.pathname.startsWith(`/spreadsheets/d/${SPREADSHEET_ID}/`);
    } catch {
      return false;
    }
  }

  function normalizeBridgeUrl(url) {
    const value = String(url || '').trim();
    if (!value) throw new Error('Не задан URL bridge.');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:[?#].*)?$/i.test(value)) {
      throw new Error('URL bridge должен быть ссылкой Apps Script вида https://script.google.com/macros/s/.../exec');
    }
    return value;
  }

  const FILE_NAME_ONLY_LINE_RE = /^\s*[^\r\n\\/:*?"<>|]+\.(?:png|jpe?g|gif|bmp|webp|svg|heic|pdf|docx?|xlsx?|pptx?|txt|rtf|csv|xml|json|zip|rar|7z)\s*$/i;

  function isFileNameOnlyLine(line) {
    return !!line && FILE_NAME_ONLY_LINE_RE.test(String(line).trim());
  }

  function cleanItilMessageBodyLines(bodyLines) {
    const cleaned = [];
    let prevEmpty = false;

    for (let index = 0; index < bodyLines.length; index++) {
      const rightTrimmed = bodyLines[index].replace(/[ \t]+$/g, '');
      const trimmed = rightTrimmed.trim();

      if (isFileNameOnlyLine(trimmed)) continue;

      if (!trimmed) {
        if (!prevEmpty && cleaned.length > 0) {
          cleaned.push('');
          prevEmpty = true;
        }
        continue;
      }

      cleaned.push(rightTrimmed);
      prevEmpty = false;
    }

    while (cleaned.length && cleaned[cleaned.length - 1] === '') cleaned.pop();
    return cleaned.join('\n');
  }

  function extractFirstItilMessageBody(text) {
    if (!text) return '';

    const normalized = String(text).replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const authorLineRe = /^\s*[^\r\n()]+?\s+\(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2}\):\s*$/;
    const markers = [];

    for (let index = 0; index < lines.length; index++) {
      if (authorLineRe.test(lines[index])) {
        markers.push(index);
        if (markers.length >= 2) break;
      }
    }

    if (!markers.length) return normalized;

    const endIndex = markers.length >= 2 ? markers[1] : lines.length;
    return cleanItilMessageBodyLines(lines.slice(markers[0] + 1, endIndex));
  }

  function processRequestText(text) {
    if (!text) return '';

    let result = String(text);
    result = extractFirstItilMessageBody(result);

    const startMarker = 'Детальное описание:';
    const endMarker = 'Причина возникновения инцидента:';
    const startIdx = result.toLowerCase().indexOf(startMarker.toLowerCase());
    if (startIdx !== -1) result = result.substring(startIdx + startMarker.length);

    const endIdx = result.toLowerCase().indexOf(endMarker.toLowerCase());
    if (endIdx !== -1) result = result.substring(0, endIdx);

    result = result.replace(/ЗНО\s+[\d-]+:(?:\s+.*?\(\d{2}\.\d{2}\.\d{4}.*?\))?\s*:?\s*/gi, '');
    result = result.replace(/\r/g, '');
    result = result.replace(/[ \t]+$/gm, '');
    result = result.replace(/^\n+/, '');
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
  }

  function buildItilInfoSectionsText(solutionText, additionalInfoText) {
    const sections = [
      {
        label: 'Решение обращения:',
        text: normalizeMultilineText(solutionText)
      },
      {
        label: 'Дополнительная информация:',
        text: normalizeMultilineText(additionalInfoText)
      }
    ].filter((section) => section.text);

    return sections.map((section) => `${section.label}\n${section.text}`).join('\n\n');
  }

  function buildItilNoInfoFallbackText() {
    return 'Решение обращения:\nИнформации по решению заявки нет';
  }

  function sliceTextSection(text, startMarker, endMarkers) {
    let result = String(text || '').replace(/\r\n?/g, '\n');
    const startIdx = result.toLowerCase().indexOf(String(startMarker || '').toLowerCase());
    if (startIdx !== -1) result = result.substring(startIdx + String(startMarker || '').length);

    const lower = result.toLowerCase();
    let endIdx = -1;
    (endMarkers || []).forEach((marker) => {
      const idx = lower.indexOf(String(marker || '').toLowerCase());
      if (idx !== -1 && (endIdx === -1 || idx < endIdx)) endIdx = idx;
    });
    if (endIdx !== -1) result = result.substring(0, endIdx);
    return result;
  }

  function normalizeMultilineText(value) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+$/gm, '')
      .replace(/^\n+/, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeSuppSectionText(value) {
    return normalizeMultilineText(String(value || '').replace(/\u00b6/g, '\n'));
  }

  function normalizeSectionLabelLine(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+$/g, '')
      .trim()
      .toLocaleLowerCase('ru-RU');
  }

  function extractLabeledMultilineSection(text, startLabel, endLabels) {
    const lines = String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''));
    const startKey = normalizeSectionLabelLine(startLabel);
    const endKeys = new Set((endLabels || []).map((label) => normalizeSectionLabelLine(label)));
    const startIndex = lines.findIndex((line) => normalizeSectionLabelLine(line) === startKey);
    if (startIndex === -1) return '';

    const collected = [];
    for (let index = startIndex + 1; index < lines.length; index++) {
      const line = lines[index];
      if (endKeys.has(normalizeSectionLabelLine(line))) break;
      collected.push(line);
    }

    return normalizeSuppSectionText(collected.join('\n'));
  }

  function processSuppRequestText(text) {
    if (!text) return '';

    let result = extractLabeledMultilineSection(text, 'Детальное описание:', [
      'Причина возникновения инцидента:',
      'Комментарии',
      'Файлы'
    ]);
    if (!result) {
      result = sliceTextSection(text, 'Детальное описание:', [
        'Причина возникновения инцидента:',
        '\nКомментарии\n',
        '\nФайлы\n'
      ]);
    }

    result = extractFirstItilMessageBody(result);
    result = result.replace(/ЗНО\s+[\d-]+:(?:\s+.*?\(\d{2}\.\d{2}\.\d{4}.*?\))?\s*:?\s*/gi, '');
    return normalizeSuppSectionText(result);
  }

  function extractSuppIncidentReasonText(text) {
    const extracted = extractLabeledMultilineSection(text, 'Причина возникновения инцидента:', [
      'Комментарии',
      'Файлы',
      'Дополнительно'
    ]);
    if (extracted) return extracted;

    return normalizeSuppSectionText(sliceTextSection(text, 'Причина возникновения инцидента:', [
      '\nКомментарии\n',
      '\nФайлы\n',
      '\nДополнительно\n'
    ]));
  }

  function parseLogDate(value) {
    const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return new Date(0);
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    );
  }

  function getTodayLogDate() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }

  function normalizeInlineInfoLogText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeInfoLogBodyKey(value) {
    return normalizeMultilineText(value)
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('ru-RU');
  }

  function parseFormattedInfoLog(log) {
    const text = normalizeMultilineText(log && log.text);
    if (!text) return null;

    const lines = text.split('\n');
    const header = lines.shift() || '';
    const match = header.match(/^(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2})\s+\/\s*(.*?)\s+\/\s*(.*)$/);
    if (!match) return null;

    const sender = normalizeInlineInfoLogText(match[2]);
    const metadata = normalizeInlineInfoLogText(match[3]);
    const body = normalizeMultilineText(lines.join('\n'));
    const bodyKey = normalizeInfoLogBodyKey(body);

    return {
      timestamp: match[1],
      sender,
      senderKey: sender.toLocaleLowerCase('ru-RU'),
      metadataParts: metadata ? [metadata] : [],
      body,
      bodyKey
    };
  }

  function sortInfoLogMetadataParts(parts) {
    return parts.slice().sort((left, right) => {
      const leftPriority = left.includes('→') ? 0 : 1;
      const rightPriority = right.includes('→') ? 0 : 1;
      return leftPriority - rightPriority;
    });
  }

  function buildFormattedInfoLogText(parsed) {
    const metadata = sortInfoLogMetadataParts(parsed.metadataParts || []).join(' / ');
    const headerSuffix = metadata ? ` ${metadata}` : '';
    return `${parsed.timestamp} / ${parsed.sender} /${headerSuffix}${parsed.body ? `\n${parsed.body}` : ''}`;
  }

  function mergeInfoLogMetadata(primary, duplicate) {
    const seen = new Set();
    const mergedParts = [];

    (primary.metadataParts || []).concat(duplicate.metadataParts || []).forEach((part) => {
      const normalized = normalizeInlineInfoLogText(part);
      const key = normalized.toLocaleLowerCase('ru-RU');
      if (!normalized || seen.has(key)) return;
      seen.add(key);
      mergedParts.push(normalized);
    });

    primary.metadataParts = mergedParts;
    primary.text = buildFormattedInfoLogText(primary);
    return primary;
  }

  function mergeDuplicateInfoLogs(logs) {
    const merged = [];

    (logs || []).forEach((log) => {
      const parsed = parseFormattedInfoLog(log);
      if (!parsed || !parsed.senderKey || !parsed.bodyKey) {
        merged.push(log);
        return;
      }

      const existing = merged.find((item) => item
        && item.__parsedInfoLog
        && item.__parsedInfoLog.senderKey === parsed.senderKey
        && item.__parsedInfoLog.bodyKey === parsed.bodyKey);

      if (!existing) {
        merged.push({
          ...log,
          __parsedInfoLog: {
            ...parsed,
            text: log.text
          }
        });
        return;
      }

      mergeInfoLogMetadata(existing.__parsedInfoLog, parsed);
      existing.text = existing.__parsedInfoLog.text;
    });

    return merged.map((log) => {
      if (!log || !log.__parsedInfoLog) return log;
      const cleanLog = { ...log };
      delete cleanLog.__parsedInfoLog;
      return cleanLog;
    });
  }

  function extractLogsFromInfoBlock(lines) {
    const logs = [];
    const looseText = [];

    let buffer = [];
    let lastLog = null;
    let currentDateStr = null;
    let lastChatContext = null;
    let logCount = 0;

    const reLogHeader = /^(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2})\s+\/.*$/;
    const reDate = /^(Сегодня|\d{2}\.\d{2}\.\d{4})$/i;
    const reTime = /^(\d{1,2}:\d{2}(:\d{2})?)$/;

    function pushLastLog() {
      if (!lastLog) return;
      lastLog.originalIndex = logCount++;
      logs.push(lastLog);
      lastLog = null;
    }

    for (let index = 0; index < lines.length; index++) {
      const line = String(lines[index] || '').trim();
      if (!line) continue;

      if (reDate.test(line)) {
        pushLastLog();
        if (buffer.length) {
          looseText.push(buffer.join('\n'));
          buffer = [];
        }
        currentDateStr = line.toLowerCase() === 'сегодня' ? getTodayLogDate() : line;
        lastChatContext = null;
        continue;
      }

      const logMatch = line.match(reLogHeader);
      if (logMatch) {
        pushLastLog();
        if (buffer.length) {
          looseText.push(buffer.join('\n'));
          buffer = [];
        }
        lastLog = {
          dateObj: parseLogDate(logMatch[1]),
          text: line
        };
        lastChatContext = null;
        continue;
      }

      if (!lastLog && reTime.test(line)) {
        if (buffer.length > 0) {
          const dateUse = currentDateStr || getTodayLogDate();
          const arrowIdx = buffer.findIndex((item) => item === '→' || item === '->');

          let headerSuffix = '';
          let sender = '';
          let body = '';

          if (arrowIdx > 0) {
            sender = buffer[0];
            const recipient = buffer.slice(1, arrowIdx).join(' ');
            if (recipient) headerSuffix = ` → ${recipient}`;
            body = buffer.slice(arrowIdx + 1).join('\n');
            lastChatContext = { sender, suffix: headerSuffix };
          } else if (lastChatContext) {
            sender = lastChatContext.sender;
            headerSuffix = lastChatContext.suffix;
            body = buffer.join('\n');
          } else {
            sender = buffer[0];
            body = buffer.slice(1).join('\n');
            lastChatContext = { sender, suffix: '' };
          }

          let fullTime = line;
          if (fullTime.split(':').length === 2) fullTime += ':00';
          const dateTimeStr = `${dateUse} ${fullTime}`;
          logs.push({
            dateObj: parseLogDate(dateTimeStr),
            text: `${dateTimeStr} / ${sender} /${headerSuffix}\n${body}`,
            originalIndex: logCount++
          });
          buffer = [];
        } else {
          looseText.push(line);
        }
        continue;
      }

      if (lastLog) {
        lastLog.text += '\n' + line;
      } else {
        buffer.push(line);
      }
    }

    pushLastLog();
    if (buffer.length) looseText.push(buffer.join('\n'));

    logs.sort((a, b) => (b.dateObj - a.dateObj) || (b.originalIndex - a.originalIndex));
    const deduplicatedLogs = mergeDuplicateInfoLogs(logs);

    const resultParts = [];
    if (looseText.length) resultParts.push(looseText.join('\n'));
    deduplicatedLogs.forEach((log) => resultParts.push(log.text));
    return resultParts.join('\n\n');
  }

  function processAndSortInfoCell(text, validHeaders) {
    if (!text) return '';

    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const blocks = [];
    let currentBlock = { header: null, rawLines: [] };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      const isHeader = validHeaders.has(line)
        || /^ЗНО\s+[\d-]+/.test(line)
        || /^ЗНР-[A-Za-zА-Яа-яЁё0-9-]+/.test(line);

      if (isHeader) {
        blocks.push(currentBlock);
        currentBlock = { header: line, rawLines: [] };
      } else {
        currentBlock.rawLines.push(rawLine);
      }
    });
    blocks.push(currentBlock);

    const finalResult = [];
    blocks.forEach((block) => {
      if (!block.header && block.rawLines.length === 0) return;

      const processedContent = extractLogsFromInfoBlock(block.rawLines);
      if (block.header) finalResult.push(block.header);

      if (processedContent.length > 0) {
        finalResult.push(processedContent);
      } else if (block.header) {
        finalResult.push('');
      }
    });

    return finalResult.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function normalizeSuppNumberList(values) {
    const source = Array.isArray(values) ? values : [values];
    const unique = [];
    const seen = new Set();

    source.forEach((value) => {
      const normalized = String(value || '').trim();
      if (!normalized || normalized === '–' || normalized === '—' || normalized === '-') return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      unique.push(normalized);
    });

    return unique;
  }

  function buildSuppWarningInfoText(suppNumber, messageText) {
    const header = String(suppNumber || '').trim();
    const body = normalizeMultilineText(messageText || SUPP_NOT_FOUND_INFO_TEXT);
    return normalizeMultilineText([header, body].filter(Boolean).join('\n\n'));
  }

  function buildSuppItilFallbackInfoText(itilSolutionText) {
    return normalizeMultilineText(itilSolutionText || buildItilNoInfoFallbackText())
      .replace(/^Решение обращения:/gm, 'Решение обращения (ITIL):')
      .replace(/^Дополнительная информация:/gm, 'Дополнительная информация (ITIL):');
  }

  function buildSuppWarningWithItilInfoText(suppNumber, messageText, itilSolutionText) {
    const header = String(suppNumber || '').trim();
    const body = normalizeMultilineText(messageText || SUPP_NOT_FOUND_INFO_TEXT);
    const itilInfoText = buildSuppItilFallbackInfoText(itilSolutionText);
    return normalizeMultilineText([header, body, itilInfoText].filter(Boolean).join('\n\n'));
  }

  function processSuppInfoText(suppNumber, incidentReasonText, commentsText, discussionText) {
    const header = String(suppNumber || '').trim();
    const reasonText = normalizeSuppSectionText(incidentReasonText);
    const rawText = [
      header,
      reasonText ? `Причина возникновения инцидента:\n${reasonText}` : '',
      normalizeMultilineText(commentsText),
      normalizeMultilineText(discussionText)
    ].filter(Boolean).join('\n\n');

    const validHeaders = new Set([header, 'ИТИЛ'].filter(Boolean));
    const processed = processAndSortInfoCell(rawText, validHeaders);
    return processed ? processed.trim() + '\n\n' : header + '\n\n';
  }

  function buildCombinedSuppInfoText(sectionTexts) {
    return normalizeMultilineText((sectionTexts || [])
      .map((text) => normalizeMultilineText(text))
      .filter(Boolean)
      .join('\n\n'));
  }

  function extractExistingSuppInfoSections(infoText, suppNumbers) {
    const headers = new Set(normalizeSuppNumberList(suppNumbers));
    const sections = new Map();
    if (!headers.size) return sections;

    const lines = String(infoText || '').replace(/\r\n?/g, '\n').split('\n');
    let currentHeader = '';
    let currentLines = [];

    const pushCurrentSection = () => {
      if (!currentHeader || !currentLines.length) return;
      sections.set(currentHeader, normalizeMultilineText(currentLines.join('\n')));
      currentHeader = '';
      currentLines = [];
    };

    lines.forEach((line) => {
      const trimmed = String(line || '').trim();
      if (headers.has(trimmed)) {
        pushCurrentSection();
        currentHeader = trimmed;
        currentLines = [trimmed];
        return;
      }

      if (!currentHeader) return;
      currentLines.push(line);
    });

    pushCurrentSection();
    return sections;
  }

  async function collectSuppInfoBundle(suppNumbers, options) {
    const normalizedSuppNumbers = normalizeSuppNumberList(suppNumbers);
    if (!normalizedSuppNumbers.length) {
      return {
        primarySuppNumber: '',
        totalCount: 0,
        updatedCount: 0,
        warningCount: 0,
        infoText: ''
      };
    }

    const settings = options && typeof options === 'object' ? options : {};
    const waitTimeouts = normalizeWaitTimeouts(settings.waitTimeouts);
    const forceEmptyPrimaryInfoPlaceholder = !!settings.forceEmptyPrimaryInfoPlaceholder;
    const preserveExistingOnSkip = !!settings.preserveExistingOnSkip;
    const itilNumber = String(settings.itilNumber || '').trim();
    const presetItilSolutionText = String(settings.itilSolutionText || '').trim();
    const existingSections = preserveExistingOnSkip
      ? extractExistingSuppInfoSections(settings.currentInfoText, normalizedSuppNumbers)
      : new Map();
    const tab = settings.tab || await getOrCreateSuppTab(waitTimeouts);
    const sectionTexts = [];
    let updatedCount = 0;
    let warningCount = 0;
    let itilDataPromise = null;

    const getItilSolutionText = async () => {
      if (presetItilSolutionText) return presetItilSolutionText;
      if (!itilNumber) return '';
      if (!itilDataPromise) {
        itilDataPromise = collectItilFillData(itilNumber, waitTimeouts);
      }
      const itilData = await itilDataPromise;
      return String(itilData && itilData.solutionText || '').trim();
    };

    for (let index = 0; index < normalizedSuppNumbers.length; index += 1) {
      const suppNumber = normalizedSuppNumbers[index];
      const result = await executeInTab(tab.id, collectSuppRequestData, [suppNumber, { waitTimeouts }]);
      if (!result || result.success !== true) {
        throw new Error(result && result.error ? result.error : `Не удалось получить данные из СУПП для ${suppNumber}.`);
      }

      if (result.skipped === true) {
        warningCount += 1;
        const isSuppNotFound = result.skipReason === 'not-found';
        const existingSection = existingSections.get(suppNumber);
        if (existingSection && !isSuppNotFound) {
          sectionTexts.push(existingSection);
          continue;
        }

        const warningText = isSuppNotFound
          ? SUPP_NOT_FOUND_INFO_TEXT
          : (result.skipMessage || SUPP_NOT_FOUND_INFO_TEXT);
        if (isSuppNotFound) {
          sectionTexts.push(buildSuppWarningWithItilInfoText(
            suppNumber,
            warningText,
            await getItilSolutionText()
          ));
          continue;
        }

        sectionTexts.push(buildSuppWarningInfoText(suppNumber, warningText));
        continue;
      }

      let sectionText = processSuppInfoText(
        suppNumber,
        index === 0 ? (result.incidentReasonText || '') : '',
        result.commentsText || '',
        result.discussionText || ''
      );

      if (index === 0 && forceEmptyPrimaryInfoPlaceholder && normalizeMultilineText(sectionText) === suppNumber) {
        sectionText = processSuppInfoText(
          suppNumber,
          SUPP_NO_DATA_INFO_TEXT,
          '',
          ''
        );
      }

      updatedCount += 1;
      sectionTexts.push(sectionText);
    }

    return {
      primarySuppNumber: normalizedSuppNumbers[0] || '',
      totalCount: normalizedSuppNumbers.length,
      updatedCount,
      warningCount,
      infoText: buildCombinedSuppInfoText(sectionTexts)
    };
  }

  async function writeClipboardText(text) {
    const value = String(text || '');

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      // Firefox/Chrome могут запретить Clipboard API в части контекстов расширения.
    }

    try {
      if (typeof document !== 'undefined' && document.body && typeof document.execCommand === 'function') {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-10000px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return !!copied;
      }
    } catch (error) {
      // Fallback ниже.
    }

    return false;
  }

  async function postBridge(url, payload) {
    const response = await fetch(normalizeBridgeUrl(url), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload || {}),
      credentials: 'omit'
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Bridge вернул HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    if (!text) return { success: true };
    try {
      return JSON.parse(text);
    } catch (error) {
      return { success: true, raw: text };
    }
  }

  const bridgePostQueue = [];
  let bridgePostQueueIsRunning = false;
  let bridgePostQueueNextId = 1;

  function enqueueBridgePost(url, payload) {
    const normalizedUrl = normalizeBridgeUrl(url);

    return new Promise((resolve, reject) => {
      bridgePostQueue.push({
        id: bridgePostQueueNextId++,
        url: normalizedUrl,
        payload: payload || {},
        resolve,
        reject
      });

      void drainBridgePostQueue();
    });
  }

  async function drainBridgePostQueue() {
    if (bridgePostQueueIsRunning) return;

    bridgePostQueueIsRunning = true;
    try {
      while (bridgePostQueue.length) {
        const item = bridgePostQueue.shift();
        if (!item) continue;

        try {
          const result = await postBridge(item.url, item.payload);
          if (result && result.success === false) {
            throw new Error(result.error || 'Bridge не сохранил значение.');
          }

          item.resolve({
            queueId: item.id,
            result
          });
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      bridgePostQueueIsRunning = false;
      if (bridgePostQueue.length) void drainBridgePostQueue();
    }
  }

  function tabsQuery(queryInfo) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(queryInfo || {}, (tabs) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        resolve(Array.isArray(tabs) ? tabs : []);
      });
    });
  }

  function tabsCreate(createProperties) {
    return new Promise((resolve, reject) => {
      chrome.tabs.create(createProperties, (tab) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        resolve(tab);
      });
    });
  }

  function tabsRemove(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabId, () => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        resolve(true);
      });
    });
  }

  function tabsUpdate(tabId, updateProperties) {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, updateProperties, (tab) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        resolve(tab);
      });
    });
  }

  function windowsUpdate(windowId, updateInfo) {
    return new Promise((resolve, reject) => {
      if (!Number.isInteger(windowId) || !chrome.windows || typeof chrome.windows.update !== 'function') {
        resolve(null);
        return;
      }

      chrome.windows.update(windowId, updateInfo || {}, (win) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        resolve(win || null);
      });
    });
  }

  function backgroundSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isSystemTabUrl(url, baseUrl) {
    return String(url || '').startsWith(String(baseUrl || ''));
  }

  async function activateTabForInteractiveAutomation(tab, urlPrefix, label, waitTimeouts) {
    const timeouts = normalizeWaitTimeouts(waitTimeouts);
    const tabId = tab && Number.isInteger(tab.id) ? tab.id : null;
    if (!Number.isInteger(tabId)) {
      throw new Error(`Не удалось активировать вкладку ${label || ''}: нет tabId.`);
    }

    let currentTab = await tabsGet(tabId).catch(() => tab);

    if (currentTab && currentTab.status !== 'complete') {
      currentTab = await waitForTabReady(tabId, urlPrefix, timeouts.tabLoadMs);
    }

    if (currentTab && Number.isInteger(currentTab.windowId)) {
      await windowsUpdate(currentTab.windowId, { focused: true }).catch(() => null);
    }

    const activatedTab = await tabsUpdate(tabId, { active: true });

    if (activatedTab && Number.isInteger(activatedTab.windowId)) {
      await windowsUpdate(activatedTab.windowId, { focused: true }).catch(() => null);
    }

    await backgroundSleep(700);

    const refreshedTab = await tabsGet(tabId).catch(() => activatedTab || currentTab || tab);

    if (refreshedTab && refreshedTab.status !== 'complete') {
      return waitForTabReady(tabId, urlPrefix, timeouts.tabLoadMs);
    }

    return refreshedTab || activatedTab || currentTab || tab;
  }

  function tabsGet(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, (tab) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        resolve(tab);
      });
    });
  }

  async function waitForTabReady(tabId, urlPrefix, timeoutMs) {
    const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : WAIT_TIMEOUT_DEFAULTS_MS.tabLoadMs;
    const existing = await tabsGet(tabId).catch(() => null);
    if (existing && existing.status === 'complete' && String(existing.url || '').startsWith(urlPrefix)) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      let done = false;
      let intervalId = 0;
      const cleanup = () => {
        if (intervalId) clearInterval(intervalId);
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
      };
      const complete = (tab) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(tab);
      };
      const timeoutId = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('Не дождался загрузки вкладки.'));
      }, effectiveTimeoutMs);

      const listener = (updatedTabId, changeInfo, tab) => {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete' && String(tab && tab.url || '').startsWith(urlPrefix)) {
          complete(tab);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
      intervalId = setInterval(() => {
        tabsGet(tabId).then((tab) => {
          if (tab && tab.status === 'complete' && String(tab.url || '').startsWith(urlPrefix)) {
            complete(tab);
          }
        }).catch(() => {});
      }, 500);
    });
  }

  async function ensureOneCSessionInPage(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const systemLabel = String(settings.systemLabel || '1С').trim();
    const readyState = String(settings.readyState || '').trim().toLowerCase();
    const username = String(settings.username || '').trim();
    const password = String(settings.password || '');
    const readyTimeoutMs = Number.isFinite(Number(settings.readyTimeoutMs))
      ? Number(settings.readyTimeoutMs)
      : 90000;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalizeText = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

    function isVisible(element) {
      if (!(element instanceof Element)) return false;
      const style = window.getComputedStyle(element);
      if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.bottom >= 0
        && rect.right >= 0
        && rect.top <= window.innerHeight
        && rect.left <= window.innerWidth;
    }

    function setInputValue(input, value) {
      if (!(input instanceof HTMLInputElement)) return;
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(input, value);
      } else {
        input.value = value;
      }
    }

    function dispatchInputEvent(input, eventName, detail) {
      try {
        input.dispatchEvent(new InputEvent(eventName, detail));
      } catch (error) {
        input.dispatchEvent(new Event(eventName, {
          bubbles: !!(detail && detail.bubbles),
          cancelable: !!(detail && detail.cancelable)
        }));
      }
    }

    async function fillInputLikeUser(input, value) {
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      if (typeof input.select === 'function') input.select();
      setInputValue(input, value);
      dispatchInputEvent(input, 'input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(80);
    }

    async function clickLikeUser(element) {
      if (!(element instanceof Element)) return;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      if (typeof element.focus === 'function') element.focus();
      const rect = typeof element.getBoundingClientRect === 'function'
        ? element.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 };
      const clientX = rect.left + Math.max(1, Math.min(Math.max(rect.width, 2) - 1, rect.width / 2 || 1));
      const clientY = rect.top + Math.max(1, Math.min(Math.max(rect.height, 2) - 1, rect.height / 2 || 1));
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
        const eventInit = {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0,
          buttons: type === 'pointerdown' || type === 'mousedown' ? 1 : 0,
          clientX,
          clientY
        };
        if (type.startsWith('pointer') && typeof PointerEvent === 'function') {
          element.dispatchEvent(new PointerEvent(type, {
            ...eventInit,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true
          }));
          return;
        }
        element.dispatchEvent(new MouseEvent(type, {
          ...eventInit
        }));
      });
      if (typeof element.click === 'function') {
        try {
          element.click();
        } catch (error) {
          // Не все элементы 1С безопасно вызываются через click().
        }
      }
      await sleep(160);
    }

    async function submitLoginForm(userInput, passwordInput, loginButton) {
      const triggerOneCButtonController = (button) => {
        if (!(button instanceof Element)) return false;
        const managerKey = Object.getOwnPropertyNames(button)
          .find((name) => /^closure_lm_/.test(String(name || '')));
        const manager = managerKey ? button[managerKey] : null;
        const clickListeners = manager && manager.$ && Array.isArray(manager.$.click)
          ? manager.$.click
          : [];

        for (const item of clickListeners) {
          const control = item && item.vy;
          if (control && typeof control.onButtonClick === 'function') {
            try {
              control.onButtonClick();
              return true;
            } catch (error) {
              // Пробуем следующий способ.
            }
          }
          if (control && typeof control.aa === 'function') {
            try {
              control.aa(0);
              return true;
            } catch (error) {
              // Пробуем следующий способ.
            }
          }
        }
        return false;
      };

      const candidateForms = [];
      [loginButton, passwordInput, userInput].forEach((element) => {
        if (!(element instanceof Element)) return;
        const closestForm = typeof element.closest === 'function' ? element.closest('form') : null;
        if (closestForm && !candidateForms.includes(closestForm)) candidateForms.push(closestForm);
        if ('form' in element && element.form && !candidateForms.includes(element.form)) {
          candidateForms.push(element.form);
        }
      });

      const invokedController = triggerOneCButtonController(loginButton);
      if (!invokedController) {
        await clickLikeUser(loginButton);
      }
      await sleep(220);

      if (passwordInput instanceof HTMLInputElement) {
        passwordInput.focus();
        ['keydown', 'keypress', 'keyup'].forEach((type) => {
          passwordInput.dispatchEvent(new KeyboardEvent(type, {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));
        });
        await sleep(220);
      }

      for (const form of candidateForms) {
        try {
          if (typeof form.requestSubmit === 'function') {
            if (loginButton instanceof HTMLElement) {
              form.requestSubmit(loginButton);
            } else {
              form.requestSubmit();
            }
          } else if (typeof form.submit === 'function') {
            form.submit();
          }
        } catch (error) {
          // Пробуем следующий способ отправки формы.
        }
        await sleep(220);
      }
    }

    function findLoginUserInput() {
      const inputs = Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .filter((input) => isVisible(input));
      return inputs.find((input) => /пользователь/i.test(normalizeText(
        input.getAttribute('placeholder')
        || input.getAttribute('aria-label')
        || input.getAttribute('title')
        || input.name
      ))) || inputs[0] || null;
    }

    function findLoginPasswordInput() {
      return Array.from(document.querySelectorAll('input[type="password"]'))
        .find((input) => isVisible(input)) || null;
    }

    function findLoginButton() {
      return Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"],div,span,a'))
        .find((element) => isVisible(element) && normalizeText(
          element.value
          || element.textContent
          || element.getAttribute('title')
          || element.getAttribute('aria-label')
        ) === 'Войти') || null;
    }

    function isItilReady() {
      return !!(
        document.querySelector('.toplineBox')
        || document.querySelector('#form2_ДополнениеСтрокаПоиска_i0')
        || document.querySelector('#captionbarField_i0')
      );
    }

    function isSuppReady() {
      if (document.querySelector('#captionbarField_i0')) return true;
      return Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .some((input) => isVisible(input) && normalizeText(
          input.getAttribute('placeholder')
          || input.getAttribute('aria-label')
          || input.getAttribute('title')
        ).includes('Поиск Ctrl+Shift+F'));
    }

    function isReady() {
      return readyState === 'itil' ? isItilReady() : isSuppReady();
    }

    let lastLoginAttemptAt = 0;
    let attempts = 0;
    const startedAt = Date.now();

    while ((Date.now() - startedAt) < readyTimeoutMs) {
      if (isReady()) {
        return {
          success: true,
          url: location.href,
          attempts
        };
      }

      const userInput = findLoginUserInput();
      const passwordInput = findLoginPasswordInput();
      const loginButton = findLoginButton();

      if (userInput && passwordInput && loginButton) {
        if (!lastLoginAttemptAt || (Date.now() - lastLoginAttemptAt) >= 4000) {
          attempts += 1;
          lastLoginAttemptAt = Date.now();
          await fillInputLikeUser(userInput, username);
          await fillInputLikeUser(passwordInput, password);
          await submitLoginForm(userInput, passwordInput, loginButton);
          await sleep(600);
          continue;
        }
      }

      await sleep(250);
    }

    return {
      success: false,
      error: `Не дождался рабочей страницы ${systemLabel}.`
    };
  }

  async function ensureSuppAuthenticated(tabId, waitTimeouts) {
    const timeouts = normalizeWaitTimeouts(waitTimeouts);
    const result = await executeInTab(tabId, ensureOneCSessionInPage, [{
      systemLabel: 'СУПП',
      readyState: 'supp',
      username: ONE_C_USERNAME,
      password: ONE_C_PASSWORD,
      readyTimeoutMs: timeouts.oneCReadyMs
    }]);

    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось подготовить страницу СУПП.');
    }

    const refreshedTab = await tabsGet(tabId).catch(() => null);
    if (refreshedTab && refreshedTab.status !== 'complete') {
      await waitForTabReady(tabId, SUPP_BASE_URL, timeouts.tabLoadMs);
    }
  }

  function executeInTab(tabId, func, args) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func,
        args: args || []
      }, (results) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }

        const first = Array.isArray(results) ? results[0] : null;
        resolve(first ? first.result : null);
      });
    });
  }

  function downloadChatGptCsv(fileName, csvText) {
    const safeName = String(fileName || 'zayavki-search.csv').replace(/[\\/:*?"<>|]+/g, '_');
    const bytes = new TextEncoder().encode(String(csvText || ''));
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    const url = `data:text/csv;charset=utf-8;base64,${btoa(binary)}`;

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url,
        filename: `duplicate-marker-chatgpt/${Date.now()}-${safeName}`,
        conflictAction: 'uniquify',
        saveAs: false
      }, (downloadId) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError || !Number.isInteger(downloadId)) {
          reject(new Error(runtimeError || 'Не удалось создать временный CSV-файл.'));
          return;
        }
        resolve(downloadId);
      });
    });
  }

  async function waitForChatGptCsvDownload(downloadId) {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < 60000) {
      const items = await new Promise((resolve) => chrome.downloads.search({ id: downloadId }, resolve));
      const item = Array.isArray(items) ? items[0] : null;
      if (item && item.state === 'complete' && item.filename) return item.filename;
      if (item && item.state === 'interrupted') throw new Error('Загрузка временного CSV была прервана.');
      await backgroundSleep(150);
    }
    throw new Error('Не дождался создания временного CSV-файла.');
  }

  async function removeChatGptCsvDownload(downloadId) {
    if (!Number.isInteger(downloadId)) return;
    await new Promise((resolve) => chrome.downloads.removeFile(downloadId, () => {
      void (chrome.runtime && chrome.runtime.lastError);
      resolve();
    }));
    await new Promise((resolve) => chrome.downloads.erase({ id: downloadId }, () => resolve()));
  }

  function debuggerAttach(debuggee) {
    return new Promise((resolve, reject) => {
      chrome.debugger.attach(debuggee, '1.3', () => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) reject(new Error(runtimeError));
        else resolve();
      });
    });
  }

  function debuggerDetach(debuggee) {
    return new Promise((resolve) => {
      chrome.debugger.detach(debuggee, () => {
        void (chrome.runtime && chrome.runtime.lastError);
        resolve();
      });
    });
  }

  function debuggerCommand(debuggee, method, params) {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(debuggee, method, params || {}, (result) => {
        const runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : '';
        if (runtimeError) reject(new Error(runtimeError));
        else resolve(result || {});
      });
    });
  }

  async function uploadChatGptCsvFile(tabId, filePath) {
    const debuggee = { tabId };
    let attached = false;
    try {
      await debuggerAttach(debuggee);
      attached = true;
      await debuggerCommand(debuggee, 'DOM.enable');

      const startedAt = Date.now();
      let nodeId = 0;
      while (!nodeId && (Date.now() - startedAt) < 60000) {
        const documentResult = await debuggerCommand(debuggee, 'DOM.getDocument', { depth: 0, pierce: true });
        const rootNodeId = Number(documentResult && documentResult.root && documentResult.root.nodeId);
        if (rootNodeId) {
          const queryResult = await debuggerCommand(debuggee, 'DOM.querySelector', {
            nodeId: rootNodeId,
            selector: '#upload-files'
          });
          nodeId = Number(queryResult && queryResult.nodeId) || 0;
        }
        if (!nodeId) await backgroundSleep(200);
      }

      if (!nodeId) throw new Error('Не найдено актуальное поле загрузки файлов ChatGPT.');
      await debuggerCommand(debuggee, 'DOM.setFileInputFiles', {
        files: [filePath],
        nodeId
      });
    } finally {
      if (attached) await debuggerDetach(debuggee);
    }
  }

  async function getOrCreateItilTab(waitTimeouts) {
    const timeouts = normalizeWaitTimeouts(waitTimeouts);
    const tabs = await tabsQuery({});
    const existing = tabs.find((tab) => isSystemTabUrl(tab.url, ITIL_BASE_URL));

    if (existing && Number.isInteger(existing.id)) {
      if (existing.status !== 'complete') await waitForTabReady(existing.id, ITIL_BASE_URL, timeouts.tabLoadMs);
      return activateTabForInteractiveAutomation(existing, ITIL_BASE_URL, 'ITIL', timeouts);
    }

    const created = await tabsCreate({ url: ITIL_URL, active: true });
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть вкладку ITIL.');
    }

    await waitForTabReady(created.id, ITIL_BASE_URL, timeouts.tabLoadMs);
    return activateTabForInteractiveAutomation(created, ITIL_BASE_URL, 'ITIL', timeouts);
  }

  async function getOrCreateSuppTab(waitTimeouts) {
    const timeouts = normalizeWaitTimeouts(waitTimeouts);
    const tabs = await tabsQuery({});
    const existing = tabs.find((tab) => isSystemTabUrl(tab.url, SUPP_BASE_URL));
    const targetTab = existing && Number.isInteger(existing.id)
      ? existing
      : await tabsCreate({ url: SUPP_URL, active: true });

    if (!targetTab || !Number.isInteger(targetTab.id)) {
      throw new Error('Не удалось открыть вкладку СУПП.');
    }

    if (targetTab.status !== 'complete') {
      await waitForTabReady(targetTab.id, SUPP_BASE_URL, timeouts.tabLoadMs);
    }

    const activatedTab = await activateTabForInteractiveAutomation(targetTab, SUPP_BASE_URL, 'СУПП', timeouts);
    await ensureSuppAuthenticated(activatedTab.id, timeouts);
    const refreshedTab = await tabsGet(activatedTab.id).catch(() => activatedTab);
    return activateTabForInteractiveAutomation(refreshedTab || activatedTab, SUPP_BASE_URL, 'СУПП', timeouts);
  }

  async function createChatGptTemporaryTab(sourceTabId, sourceWindowId) {
    const sourceTab = Number.isInteger(sourceTabId)
      ? await tabsGet(sourceTabId).catch(() => null)
      : null;
    const createProperties = {
      url: CHATGPT_TEMPORARY_URL,
      active: true
    };

    if (sourceTab && Number.isInteger(sourceTab.windowId)) {
      createProperties.windowId = sourceTab.windowId;
    } else if (Number.isInteger(sourceWindowId)) {
      createProperties.windowId = sourceWindowId;
    }

    if (sourceTab && Number.isInteger(sourceTab.index)) {
      createProperties.index = sourceTab.index + 1;
    }

    if (sourceTab && Number.isInteger(sourceTab.id)) {
      createProperties.openerTabId = sourceTab.id;
    }

    const created = await tabsCreate(createProperties);
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть временный чат ChatGPT.');
    }

    await tabsUpdate(created.id, { autoDiscardable: false }).catch(() => null);
    return activateTabForInteractiveAutomation(created, CHATGPT_URL_PREFIX, 'ChatGPT');
  }

  async function activateChatGptTab(tabId) {
    if (!Number.isInteger(tabId)) throw new Error('Не передан tabId вкладки ChatGPT.');

    const tab = await tabsGet(tabId);
    if (!tab || !String(tab.url || '').startsWith(CHATGPT_URL_PREFIX)) {
      throw new Error('Вкладка ChatGPT больше недоступна.');
    }

    return activateTabForInteractiveAutomation(tab, CHATGPT_URL_PREFIX, 'ChatGPT');
  }

  async function restoreSourceTabAfterChatGptSearch(sourceTabId, sourceWindowId) {
    if (Number.isInteger(sourceTabId)) {
      const sourceTab = await tabsGet(sourceTabId).catch(() => null);
      if (sourceTab) {
        if (Number.isInteger(sourceTab.windowId)) {
          await windowsUpdate(sourceTab.windowId, { focused: true }).catch(() => null);
        }

        const activatedTab = await tabsUpdate(sourceTabId, { active: true }).catch(() => null);

        if (activatedTab && Number.isInteger(activatedTab.windowId)) {
          await windowsUpdate(activatedTab.windowId, { focused: true }).catch(() => null);
        }
        return activatedTab || sourceTab;
      }
    }

    if (Number.isInteger(sourceWindowId)) {
      await windowsUpdate(sourceWindowId, { focused: true }).catch(() => null);
    }

    return null;
  }

  async function closeChatGptTab(tabId, sourceTabId, sourceWindowId) {
    if (!Number.isInteger(tabId)) throw new Error('Не передан tabId вкладки ChatGPT.');

    const tab = await tabsGet(tabId).catch(() => null);
    if (tab && String(tab.url || '').startsWith(CHATGPT_URL_PREFIX)) {
      await tabsRemove(tabId);
    } else if (tab) {
      await tabsRemove(tabId).catch(() => null);
    }

    await restoreSourceTabAfterChatGptSearch(sourceTabId, sourceWindowId);
    return {
      tabId,
      sourceTabId: Number.isInteger(sourceTabId) ? sourceTabId : null,
      sourceWindowId: Number.isInteger(sourceWindowId) ? sourceWindowId : null
    };
  }

  function sendChatGptProgress(targetTabId, statusText) {
    if (!Number.isInteger(targetTabId) || !statusText) return;

    try {
      chrome.tabs.sendMessage(targetTabId, {
        action: CHATGPT_PROGRESS_ACTION,
        data: { statusText }
      }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (error) {
      // Прогресс не должен ломать основной сценарий.
    }
  }

  async function runChatGptSearch(data, progressTabId, sourceTabId, sourceWindowId) {
    const payload = data && data.payload ? data.payload : {};
    const fileName = String(payload.fileName || '').trim();
    const csvText = String(payload.csvText || '');
    const promptText = String(payload.promptText || '').trim();

    if (!fileName) throw new Error('Не передано имя CSV-файла для ChatGPT.');
    if (!csvText) throw new Error('CSV-файл для ChatGPT пустой.');
    if (!promptText) throw new Error('Не передан текст запроса для ChatGPT.');

    let tab = null;
    let downloadId = null;

    try {
      tab = await createChatGptTemporaryTab(sourceTabId, sourceWindowId);
      sendChatGptProgress(progressTabId, 'Вкладка ChatGPT открыта. Прикрепляю CSV и готовлю сообщение...');

      downloadId = await downloadChatGptCsv(fileName, csvText);
      const csvFilePath = await waitForChatGptCsvDownload(downloadId);
      await uploadChatGptCsvFile(tab.id, csvFilePath);

      const sendResult = await executeInTab(tab.id, prepareAndSendChatGptPromptInPage, [{
        fileName,
        promptText
      }]);

      if (!sendResult || sendResult.success === false) {
        throw new Error(sendResult && sendResult.error ? sendResult.error : 'Не удалось отправить запрос в ChatGPT.');
      }

      sendChatGptProgress(progressTabId, 'ChatGPT принял сообщение. Жду завершения ответа...');

      const answerResult = await executeInTab(tab.id, waitForChatGptAnswerInPage, []);
      if (!answerResult || answerResult.success === false) {
        throw new Error(answerResult && answerResult.error ? answerResult.error : 'Не удалось получить ответ ChatGPT.');
      }

      sendChatGptProgress(progressTabId, 'Ответ ChatGPT получен. Закрываю вкладку и возвращаюсь к таблице...');

      if (Number.isInteger(tab && tab.id)) {
        await closeChatGptTab(tab.id, sourceTabId, sourceWindowId);
      }

      return answerResult;
    } catch (error) {
      if (Number.isInteger(tab && tab.id)) {
        try {
          await closeChatGptTab(tab.id, sourceTabId, sourceWindowId);
        } catch (closeError) {
          // Ошибка закрытия не должна скрывать первичную причину падения.
        }
      } else {
        await restoreSourceTabAfterChatGptSearch(sourceTabId, sourceWindowId).catch(() => null);
      }
      throw error;
    } finally {
      await removeChatGptCsvDownload(downloadId).catch(() => null);
    }
  }

  async function runChatGptQuestion(data, progressTabId, sourceTabId, sourceWindowId) {
    const payload = data && data.payload ? data.payload : {};
    const fileName = String(payload.fileName || '').trim();
    const csvText = String(payload.csvText || '');
    const promptText = String(payload.promptText || '').trim();

    if (!fileName) throw new Error('Не передано имя CSV-файла для ChatGPT.');
    if (!csvText) throw new Error('CSV-файл для ChatGPT пустой.');
    if (!promptText) throw new Error('Не передан текст запроса для ChatGPT.');

    let tab = null;
    let downloadId = null;

    try {
      tab = await createChatGptTemporaryTab(sourceTabId, sourceWindowId);
      sendChatGptProgress(progressTabId, 'Вкладка ChatGPT открыта. Прикрепляю CSV и отправляю вопрос...');

      downloadId = await downloadChatGptCsv(fileName, csvText);
      const csvFilePath = await waitForChatGptCsvDownload(downloadId);
      await uploadChatGptCsvFile(tab.id, csvFilePath);

      const sendResult = await executeInTab(tab.id, prepareAndSendChatGptPromptInPage, [{
        fileName,
        promptText
      }]);

      if (!sendResult || sendResult.success === false) {
        throw new Error(sendResult && sendResult.error ? sendResult.error : 'Не удалось отправить вопрос в ChatGPT.');
      }

      sendChatGptProgress(progressTabId, 'Вопрос отправлен в ChatGPT. Можно продолжать работу в открытой вкладке...');

      return {
        tabId: tab.id
      };
    } catch (error) {
      if (Number.isInteger(tab && tab.id)) {
        try {
          await closeChatGptTab(tab.id, sourceTabId, sourceWindowId);
        } catch (closeError) {
          // Ошибка закрытия не должна скрывать первичную причину падения.
        }
      } else {
        await restoreSourceTabAfterChatGptSearch(sourceTabId, sourceWindowId).catch(() => null);
      }
      throw error;
    } finally {
      await removeChatGptCsvDownload(downloadId).catch(() => null);
    }
  }

  async function runItilFillRow(data) {
    const payload = data && data.payload ? data.payload : {};
    const waitTimeouts = normalizeWaitTimeouts(data && data.waitTimeouts);
    const row = Number(payload.row);
    const itilNumber = String(payload.itilNumber || '').trim();
    const sheetName = String(payload.sheetName || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();
    const columns = payload.columns && typeof payload.columns === 'object' ? payload.columns : null;

    if (spreadsheetId !== SPREADSHEET_ID) throw new Error('Некорректная таблица для ITIL-заполнения.');
    if (!sheetName) throw new Error('Не передан лист для ITIL-заполнения.');
    if (!Number.isInteger(row) || row < 2) throw new Error('Некорректный номер строки для ITIL-заполнения.');
    if (!itilNumber) throw new Error('Не передан номер ITIL.');
    normalizeBridgeUrl(data.bridgeUrl);

    const itilData = await collectItilFillData(itilNumber, waitTimeouts);
    const requestText = itilData.requestText;
    const solutionText = itilData.solutionText;
    if (!requestText) throw new Error(`ITIL ${itilNumber}: текст заявки пустой.`);

    const bridgePayload = {
      action: 'saveItilData',
      spreadsheetId,
      sheetName,
      row,
      itilNumber,
      columns,
      requestText,
      solutionText
    };

    return {
      row,
      itilNumber,
      requestTextLength: requestText.length,
      solutionTextLength: solutionText.length,
      bridgePayload
    };
  }

  function requestDesktopItil(itilNumber, waitTimeouts, leaveOpen = false) {
    if (!chrome.runtime.getManifest().permissions?.includes('nativeMessaging')) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connectNative(ITIL_DESKTOP_HOST);
      const timer = setTimeout(() => {
        port.disconnect();
        reject(new Error('Не дождался ответа локального помощника 1С:ITIL.'));
      }, 150000);
      port.onDisconnect.addListener(() => {
        clearTimeout(timer);
        const message = chrome.runtime.lastError?.message || '';
        if (message === 'Specified native messaging host not found.') {
          resolve(null);
        } else {
          reject(new Error('Потеряна связь с локальным помощником 1С:ITIL.' + (message ? ' ' + message : '')));
        }
      });
      port.onMessage.addListener((response) => {
        clearTimeout(timer);
        port.disconnect();
        if (response?.success !== true) {
          reject(new Error(response?.error || 'Помощник 1С:ITIL не вернул результат.'));
          return;
        }
        if (response.itilNumber !== itilNumber) {
          reject(new Error('Помощник 1С:ITIL вернул данные другой заявки.'));
          return;
        }
        if (!leaveOpen && ['requestText', 'solutionText', 'additionalInfoText'].some((key) => typeof response[key] !== 'string')) {
          reject(new Error('Помощник 1С:ITIL вернул неполные данные карточки.'));
          return;
        }
        resolve(response);
      });
      try {
        port.postMessage({
          itilNumber,
          leaveOpen,
          searchMs: waitTimeouts.itilSearchResultMs,
          cardMs: waitTimeouts.itilRequestTabMs
        });
      } catch (error) {
        clearTimeout(timer);
        port.disconnect();
        reject(error);
      }
    });
  }

  async function collectItilFillData(itilNumber, waitTimeouts) {
    const number = String(itilNumber || '').trim();
    if (!number) throw new Error('Не передан номер ITIL.');

    const timeouts = normalizeWaitTimeouts(waitTimeouts);
    let result = await requestDesktopItil(number, timeouts);
    if (!result) {
      const tab = await getOrCreateItilTab(timeouts);
      const clipboardPrepared = await writeClipboardText(number);
      result = await executeInTab(tab.id, collectItilRequestData, [number, clipboardPrepared, { waitTimeouts: timeouts }]);
    }
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось получить данные из ITIL.');
    }

    return {
      requestText: processRequestText(result.requestText || ''),
      solutionText: buildItilInfoSectionsText(
        result.solutionText || '',
        result.additionalInfoText || ''
      )
    };
  }

  async function runItilOpenRequest(data) {
    const waitTimeouts = normalizeWaitTimeouts(data && data.waitTimeouts);
    const itilNumber = String(
      (data && data.itilNumber)
      || (data && data.payload && data.payload.itilNumber)
      || ''
    ).trim();
    if (!itilNumber) throw new Error('Не передан номер ITIL для открытия заявки.');

    if (await requestDesktopItil(itilNumber, waitTimeouts, true)) return { itilNumber };

    const tab = await getOrCreateItilTab(waitTimeouts);
    const clipboardPrepared = await writeClipboardText(itilNumber);
    const result = await executeInTab(tab.id, collectItilRequestData, [itilNumber, clipboardPrepared, { leaveOpen: true, waitTimeouts }]);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось открыть заявку ITIL.');
    }

    return {
      tabId: tab.id,
      itilNumber
    };
  }

  async function runSuppFillRow(data) {
    const payload = data && data.payload ? data.payload : {};
    const waitTimeouts = normalizeWaitTimeouts(data && data.waitTimeouts);
    const row = Number(payload.row);
    const suppNumbers = normalizeSuppNumberList(
      Array.isArray(payload.suppNumbers) && payload.suppNumbers.length
        ? payload.suppNumbers
        : [payload.suppNumber]
    );
    const suppNumber = suppNumbers[0] || '';
    const itilNumber = String(payload.itilNumber || '').trim();
    const sheetName = String(payload.sheetName || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();
    const columns = payload.columns && typeof payload.columns === 'object' ? payload.columns : null;

    if (spreadsheetId !== SPREADSHEET_ID) throw new Error('Некорректная таблица для СУПП-заполнения.');
    if (!sheetName) throw new Error('Не передан лист для СУПП-заполнения.');
    if (!Number.isInteger(row) || row < 2) throw new Error('Некорректный номер строки для СУПП-заполнения.');
    if (!suppNumber) throw new Error('Не передан корректный номер СУПП.');
    normalizeBridgeUrl(data.bridgeUrl);

    let requestText = '';
    let requestTextSource = 'SUPP';
    let infoText = '';
    let updatedSuppCount = 0;
    let warningSuppCount = 0;
    const totalSuppCount = suppNumbers.length;

    if (suppNumbers.length > 1) {
      if (!itilNumber) throw new Error(`Строка ${row}: для строки с несколькими СУПП не найден «Номер ITIL».`);
      const itilData = await collectItilFillData(itilNumber, waitTimeouts);
      requestText = itilData.requestText;
      requestTextSource = 'ITIL';
      if (!requestText) {
        throw new Error(`ITIL ${itilNumber}: текст заявки пустой.`);
      }

      const suppBundle = await collectSuppInfoBundle(suppNumbers, {
        tab: await getOrCreateSuppTab(waitTimeouts),
        itilNumber,
        itilSolutionText: itilData.solutionText,
        waitTimeouts
      });
      infoText = suppBundle.infoText;
      updatedSuppCount = suppBundle.updatedCount;
      warningSuppCount = suppBundle.warningCount;
    } else {
      const tab = await getOrCreateSuppTab(waitTimeouts);
      const result = await executeInTab(tab.id, collectSuppRequestData, [suppNumber, { waitTimeouts }]);
      if (!result || result.success !== true) {
        throw new Error(result && result.error ? result.error : 'Не удалось получить данные из СУПП.');
      }
      if (result.skipped === true) {
        const skipReason = String(result.skipReason || 'search-result-unavailable');
        const skipMessage = String(result.skipMessage || `СУПП ${suppNumber}: заявка пропущена.`);
        if (skipReason !== 'not-found') {
          return {
            row,
            suppNumber,
            suppNumbers,
            skipped: true,
            skipReason,
            skipMessage
          };
        }

        if (!itilNumber) {
          throw new Error(`Строка ${row}, СУПП ${suppNumber}: заявка не найдена в СУПП, но в строке не заполнен «Номер ITIL».`);
        }

        const itilData = await collectItilFillData(itilNumber, waitTimeouts);
        requestText = itilData.requestText;
        requestTextSource = 'ITIL';
        if (!requestText) {
          throw new Error(`ITIL ${itilNumber}: текст заявки пустой.`);
        }
        infoText = buildSuppWarningWithItilInfoText(
          suppNumber,
          SUPP_NOT_FOUND_INFO_TEXT,
          itilData.solutionText
        );
        updatedSuppCount = 0;
        warningSuppCount = 1;
      } else {
        const suppRequestItilNumber = String(result.requestItilNumber || '').trim();
        const useItilBySuppMismatch = !!suppRequestItilNumber && suppRequestItilNumber !== itilNumber;
        if (useItilBySuppMismatch && !itilNumber) {
          throw new Error(`Строка ${row}, СУПП ${suppNumber}: в описании СУПП найден ITIL ${suppRequestItilNumber}, но в строке не заполнен «Номер ITIL».`);
        }

        const shouldUseItilRequestText = useItilBySuppMismatch;
        const itilData = shouldUseItilRequestText ? await collectItilFillData(itilNumber, waitTimeouts) : null;
        requestText = shouldUseItilRequestText
          ? (itilData ? itilData.requestText : '')
          : processSuppRequestText(result.requestText || '');
        infoText = processSuppInfoText(
          suppNumber,
          result.incidentReasonText || '',
          result.commentsText || '',
          result.discussionText || ''
        );
        requestTextSource = shouldUseItilRequestText ? 'ITIL' : 'SUPP';
        if (!requestText) {
          throw new Error(shouldUseItilRequestText
            ? `ITIL ${itilNumber}: текст заявки пустой.`
            : `СУПП ${suppNumber}: текст заявки пустой.`);
        }
        updatedSuppCount = 1;
        warningSuppCount = 0;
      }
    }

    const bridgePayload = {
      action: 'saveSuppData',
      spreadsheetId,
      sheetName,
      row,
      suppNumber,
      suppNumbers,
      requestTextSource,
      columns,
      requestText,
      infoText
    };

    return {
      row,
      suppNumber,
      suppNumbers,
      itilNumber,
      requestTextSource,
      requestTextLength: requestText.length,
      infoTextLength: infoText.length,
      updatedSuppCount,
      warningSuppCount,
      totalSuppCount,
      bridgePayload
    };
  }

  async function runSuppOpenRequest(data) {
    const waitTimeouts = normalizeWaitTimeouts(data && data.waitTimeouts);
    const suppNumber = String(
      (data && data.suppNumber)
      || (data && data.payload && data.payload.suppNumber)
      || ''
    ).trim();
    if (!suppNumber || suppNumber === '–' || suppNumber === '—' || suppNumber === '-') {
      throw new Error('Не передан корректный номер СУПП для открытия заявки.');
    }

    const tab = await getOrCreateSuppTab(waitTimeouts);
    const result = await executeInTab(tab.id, collectSuppRequestData, [suppNumber, { leaveOpen: true, waitTimeouts }]);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось открыть заявку СУПП.');
    }

    return {
      tabId: tab.id,
      suppNumber
    };
  }

  async function runItilInfoRefreshRow(data) {
    const payload = data && data.payload ? data.payload : {};
    const waitTimeouts = normalizeWaitTimeouts(data && data.waitTimeouts);
    const row = Number(payload.row);
    const itilNumber = String(payload.itilNumber || '').trim();
    const sheetName = String(payload.sheetName || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();
    const columns = payload.columns && typeof payload.columns === 'object' ? payload.columns : null;
    const forceEmptyInfoPlaceholder = !!payload.forceEmptyInfoPlaceholder;

    if (spreadsheetId !== SPREADSHEET_ID) throw new Error('Некорректная таблица для обновления INFO из ITIL.');
    if (!sheetName) throw new Error('Не передан лист для обновления INFO из ITIL.');
    if (!Number.isInteger(row) || row < 2) throw new Error('Некорректный номер строки для обновления INFO из ITIL.');
    if (!itilNumber) throw new Error('Не передан номер ITIL.');
    normalizeBridgeUrl(data.bridgeUrl);

    const itilData = await collectItilFillData(itilNumber, waitTimeouts);
    let solutionText = String(itilData.solutionText || '').trim();
    if (!solutionText && forceEmptyInfoPlaceholder) {
      solutionText = buildItilNoInfoFallbackText();
    }

    const bridgePayload = {
      action: 'saveItilInfoData',
      spreadsheetId,
      sheetName,
      row,
      itilNumber,
      columns,
      solutionText
    };

    return {
      row,
      itilNumber,
      solutionTextLength: solutionText.length,
      bridgePayload
    };
  }

  async function runSuppInfoRefreshRow(data) {
    const payload = data && data.payload ? data.payload : {};
    const waitTimeouts = normalizeWaitTimeouts(data && data.waitTimeouts);
    const row = Number(payload.row);
    const suppNumbers = normalizeSuppNumberList(
      Array.isArray(payload.suppNumbers) && payload.suppNumbers.length
        ? payload.suppNumbers
        : [payload.suppNumber]
    );
    const suppNumber = suppNumbers[0] || '';
    const itilNumber = String(payload.itilNumber || '').trim();
    const sheetName = String(payload.sheetName || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();
    const columns = payload.columns && typeof payload.columns === 'object' ? payload.columns : null;
    const forceEmptyInfoPlaceholder = !!payload.forceEmptyInfoPlaceholder;
    const currentInfoText = String(payload.currentInfoText || '').trim();

    if (spreadsheetId !== SPREADSHEET_ID) throw new Error('Некорректная таблица для обновления INFO из СУПП.');
    if (!sheetName) throw new Error('Не передан лист для обновления INFO из СУПП.');
    if (!Number.isInteger(row) || row < 2) throw new Error('Некорректный номер строки для обновления INFO из СУПП.');
    if (!suppNumber) throw new Error('Не передан корректный номер СУПП.');
    normalizeBridgeUrl(data.bridgeUrl);

    let infoText = '';
    let updatedSuppCount = 0;
    let warningSuppCount = 0;
    const totalSuppCount = suppNumbers.length;

    if (suppNumbers.length > 1) {
      const suppBundle = await collectSuppInfoBundle(suppNumbers, {
        tab: await getOrCreateSuppTab(waitTimeouts),
        itilNumber,
        forceEmptyPrimaryInfoPlaceholder: forceEmptyInfoPlaceholder,
        preserveExistingOnSkip: true,
        currentInfoText,
        waitTimeouts
      });
      infoText = suppBundle.infoText;
      updatedSuppCount = suppBundle.updatedCount;
      warningSuppCount = suppBundle.warningCount;
    } else {
      const tab = await getOrCreateSuppTab(waitTimeouts);
      const result = await executeInTab(tab.id, collectSuppRequestData, [suppNumber, { waitTimeouts }]);
      if (!result || result.success !== true) {
        throw new Error(result && result.error ? result.error : 'Не удалось получить данные из СУПП.');
      }
      if (result.skipped === true) {
        const skipReason = String(result.skipReason || 'search-result-unavailable');
        const skipMessage = String(result.skipMessage || `СУПП ${suppNumber}: заявка пропущена.`);
        if (skipReason !== 'not-found') {
          return {
            row,
            suppNumber,
            suppNumbers,
            skipped: true,
            skipReason,
            skipMessage
          };
        }

        const itilData = itilNumber ? await collectItilFillData(itilNumber, waitTimeouts) : null;
        infoText = buildSuppWarningWithItilInfoText(
          suppNumber,
          SUPP_NOT_FOUND_INFO_TEXT,
          itilData ? itilData.solutionText : ''
        );
        updatedSuppCount = 0;
        warningSuppCount = 1;
      } else {
        infoText = processSuppInfoText(
          suppNumber,
          result.incidentReasonText || '',
          result.commentsText || '',
          result.discussionText || ''
        );
        if (forceEmptyInfoPlaceholder && normalizeMultilineText(infoText) === suppNumber) {
          infoText = processSuppInfoText(
            suppNumber,
            SUPP_NO_DATA_INFO_TEXT,
            '',
            ''
          );
        }
        updatedSuppCount = 1;
        warningSuppCount = 0;
      }
    }

    const bridgePayload = {
      action: 'saveSuppInfoData',
      spreadsheetId,
      sheetName,
      row,
      suppNumber,
      suppNumbers,
      columns,
      infoText
    };

    return {
      row,
      suppNumber,
      suppNumbers,
      infoTextLength: infoText.length,
      updatedSuppCount,
      warningSuppCount,
      totalSuppCount,
      bridgePayload
    };
  }

  async function collectItilRequestData(itilNumber, clipboardPrepared, options) {
    const number = String(itilNumber || '').trim();
    const canUseClipboardPaste = !!clipboardPrepared;
    const settings = options && typeof options === 'object' ? options : {};
    const leaveOpen = !!settings.leaveOpen;
    const configuredTimeouts = settings.waitTimeouts && typeof settings.waitTimeouts === 'object'
      ? settings.waitTimeouts
      : {};
    const getTimeout = (key, fallbackMs) => {
      const timeoutMs = Number(configuredTimeouts[key]);
      return Number.isFinite(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 3600000
        ? timeoutMs
        : fallbackMs;
    };
    if (!number) return { success: false, error: 'Пустой номер ITIL.' };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalizeText = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizeMultiline = (value) => String(value || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();

    function isVisible(element) {
      if (!(element instanceof Element)) return false;
      const style = window.getComputedStyle(element);
      if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.bottom >= 0
        && rect.right >= 0
        && rect.top <= window.innerHeight
        && rect.left <= window.innerWidth;
    }

    async function waitFor(getter, timeoutMs, label) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const value = getter();
        if (value) return value;
        await sleep(250);
      }
      throw new Error(`Не дождался: ${label}.`);
    }

    function dispatchMouseLike(element, type, detail) {
      const rect = element.getBoundingClientRect();
      const clientX = rect.left + Math.max(1, Math.min(rect.width - 1, rect.width / 2));
      const clientY = rect.top + Math.max(1, Math.min(rect.height - 1, rect.height / 2));
      element.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: detail || 1,
        clientX,
        clientY,
        button: 0,
        buttons: type === 'mouseup' || type === 'click' || type === 'dblclick' ? 0 : 1
      }));
    }

    async function clickLikeUser(element) {
      element.scrollIntoView({ block: 'center', inline: 'center' });
      await sleep(50);
      dispatchMouseLike(element, 'mouseover', 0);
      dispatchMouseLike(element, 'mousemove', 0);
      dispatchMouseLike(element, 'mousedown', 1);
      if (typeof element.focus === 'function') element.focus();
      dispatchMouseLike(element, 'mouseup', 1);
      dispatchMouseLike(element, 'click', 1);
      await sleep(120);
    }

    async function doubleClickLikeUser(element) {
      await clickLikeUser(element);
      dispatchMouseLike(element, 'mousedown', 2);
      dispatchMouseLike(element, 'mouseup', 2);
      dispatchMouseLike(element, 'click', 2);
      dispatchMouseLike(element, 'dblclick', 2);
      await sleep(250);
    }

    function findServiceDeskLauncher() {
      const byId = document.querySelector('#favsCell_cmd_0');
      if (isVisible(byId) && normalizeText(byId.textContent) === 'Service Desk') return byId;

      return Array.from(document.querySelectorAll('.visitItem,.openedItem,.openedItemTitle,div'))
        .find((element) => isVisible(element) && normalizeText(element.textContent) === 'Service Desk') || null;
    }

    function findSearchInput() {
      const byId = document.querySelector('#form2_ДополнениеСтрокаПоиска_i0');
      if (isVisible(byId)) return byId;

      return Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .find((input) => isVisible(input) && String(input.id || '').includes('ДополнениеСтрокаПоиска')) || null;
    }

    async function clearSearchInputLikeUser(input) {
      input.focus();
      if (typeof input.select === 'function') input.select();

      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Backspace', code: 'Backspace' }));
      try {
        document.execCommand('delete');
      } catch (error) {
        // Не все браузеры разрешают execCommand в content script.
      }

      if (String(input.value || '')) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (setter && typeof setter.set === 'function') {
          setter.set.call(input, '');
        } else {
          input.value = '';
        }
      }

      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
        data: null
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Backspace', code: 'Backspace' }));
      await sleep(150);
    }

    async function pasteNumberLikeUser(input, value) {
      input.focus();
      if (typeof input.select === 'function') input.select();

      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Control', code: 'ControlLeft', ctrlKey: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', code: 'KeyV', ctrlKey: true }));

      let pasted = false;
      if (canUseClipboardPaste && value) {
        try {
          pasted = !!document.execCommand('paste');
          await sleep(300);
        } catch (error) {
          pasted = false;
        }
      }

      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', value);
        if (!pasted || String(input.value || '') !== value) {
          input.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
          }));
        }
      } catch (error) {
        if (!pasted) input.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
      }

      const currentValue = String(input.value || '');
      if (currentValue !== value) {
        try {
          document.execCommand('insertText', false, value);
        } catch (error) {
          // Последний fallback ниже.
        }
      }

      if (String(input.value || '') !== value) {
        try {
          if (typeof input.setSelectionRange === 'function') input.setSelectionRange(0, String(input.value || '').length);
          if (typeof input.setRangeText === 'function') {
            input.setRangeText(value, 0, String(input.value || '').length, 'end');
          }
        } catch (error) {
          // Если браузер не даёт заменить выделение, ниже останется value-setter.
        }
      }

      if (String(input.value || '') !== value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (setter && typeof setter.set === 'function') {
          setter.set.call(input, value);
        } else {
          input.value = value;
        }
      }

      input.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertFromPaste',
        data: value
      }));
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertFromPaste',
        data: value
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'v', code: 'KeyV', ctrlKey: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Control', code: 'ControlLeft' }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
      input.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
      await sleep(300);
    }

    function findGridNumberCell() {
      return Array.from(document.querySelectorAll('.gridBoxText,.gridBoxTitle,.gridBox,b,span,div'))
        .find((element) => {
          const gridCell = element.closest('.gridBox');
          return gridCell && isVisible(gridCell) && normalizeText(element.textContent).includes(number);
        }) || null;
    }

    function findRequestTab() {
      return Array.from(document.querySelectorAll('.openedItem'))
        .find((element) => isVisible(element) && normalizeText(element.textContent).includes(number)) || null;
    }

    function getIframeText() {
      const explicit = document.querySelector('#form3_ПолныйТекстHTML iframe')
        || Array.from(document.querySelectorAll('div[id*="ПолныйТекстHTML"] iframe')).find((iframe) => isVisible(iframe));

      const frames = explicit
        ? [explicit]
        : Array.from(document.querySelectorAll('iframe')).filter((iframe) => isVisible(iframe));

      let bestText = '';
      frames.forEach((iframe) => {
        try {
          const body = iframe.contentDocument && iframe.contentDocument.body;
          const text = normalizeMultiline(body ? body.innerText || body.textContent || '' : '');
          if (text.length > bestText.length) bestText = text;
        } catch (error) {
          // В 1С iframe с текстом заявки доступен как same-origin; остальные можно игнорировать.
        }
      });

      return bestText;
    }

    function findLabeledField(labelText, idPart) {
      const explicit = idPart
        ? (
          document.querySelector(`#form3_Плюс_${idPart}_i0`)
          || Array.from(document.querySelectorAll('textarea,input'))
            .find((field) => isVisible(field) && String(field.id || '').includes(idPart))
        )
        : null;
      if (explicit) return explicit;

      const label = Array.from(document.querySelectorAll('div,span,label'))
        .find((element) => isVisible(element) && normalizeText(element.textContent) === labelText);
      if (!label) return null;

      const labelRect = label.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll('textarea,input'))
        .filter((element) => {
          if (!isVisible(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.top >= labelRect.top - 8
            && rect.top <= labelRect.bottom + 80
            && Math.abs(rect.left - labelRect.left) < 40;
        })
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return Math.abs(leftRect.top - labelRect.bottom) - Math.abs(rightRect.top - labelRect.bottom);
        });

      return candidates[0] || null;
    }

    function getLabeledFieldText(labelText, idPart) {
      const field = findLabeledField(labelText, idPart);
      return field ? normalizeMultiline(field.value || field.textContent || '') : '';
    }

    function getSolutionText() {
      return getLabeledFieldText('Решение обращения:', 'РешениеОбращения');
    }

    function getAdditionalInfoText() {
      return getLabeledFieldText('Дополнительная информация:', 'ДополнительнаяИнформация');
    }

    function closeRequestTab() {
      const tab = findRequestTab();
      if (!tab) return null;
      return tab.querySelector('[id$="_cmd_close"],.openedClose,[title="Закрыть"]') || null;
    }

    try {
      await waitFor(() => document.querySelector('.toplineBox'), getTimeout('itilAccountMs', 90000), 'личный кабинет ITIL');

      let searchInput = findSearchInput();
      if (!searchInput) {
        const launcher = await waitFor(findServiceDeskLauncher, getTimeout('itilServiceDeskMs', 30000), 'пункт Service Desk');
        await clickLikeUser(launcher);
        searchInput = await waitFor(findSearchInput, getTimeout('itilSearchInputMs', 60000), 'поле поиска Service Desk');
      }

      await clickLikeUser(searchInput);
      await clearSearchInputLikeUser(searchInput);
      await sleep(200);
      await pasteNumberLikeUser(searchInput, number);

      const numberCell = await waitFor(findGridNumberCell, getTimeout('itilSearchResultMs', 60000), `строка ITIL ${number}`);
      const gridCell = numberCell.closest('.gridBox') || numberCell;
      await doubleClickLikeUser(gridCell);

      await waitFor(findRequestTab, getTimeout('itilRequestTabMs', 60000), `вкладка заявки ${number}`);
      await waitFor(() => getIframeText(), getTimeout('itilRequestTextMs', 60000), `текст заявки ${number}`);

      if (leaveOpen) {
        return {
          success: true,
          opened: true
        };
      }

      const requestText = getIframeText();
      const solutionText = getSolutionText();
      const additionalInfoText = getAdditionalInfoText();
      const closeButton = closeRequestTab();
      if (closeButton) {
        await clickLikeUser(closeButton);
        await waitFor(() => !findRequestTab(), getTimeout('itilRequestCloseMs', 15000), `закрытие вкладки заявки ${number}`);
      }

      return {
        success: true,
        requestText,
        solutionText,
        additionalInfoText
      };
    } catch (error) {
      return {
        success: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  async function collectSuppRequestData(suppNumber, options) {
    const number = String(suppNumber || '').trim();
    const settings = options && typeof options === 'object' ? options : {};
    const leaveOpen = !!settings.leaveOpen;
    const configuredTimeouts = settings.waitTimeouts && typeof settings.waitTimeouts === 'object'
      ? settings.waitTimeouts
      : {};
    const getTimeout = (key, fallbackMs) => {
      const timeoutMs = Number(configuredTimeouts[key]);
      return Number.isFinite(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 3600000
        ? timeoutMs
        : fallbackMs;
    };
    if (!number) return { success: false, error: 'Пустой номер СУПП.' };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalizeText = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizeMultiline = (value) => String(value || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    const normalizeSuppSectionTextLocal = (value) => normalizeMultiline(String(value || '').replace(/\u00b6/g, '\n'));
    const normalizeSectionLabelLineLocal = (value) => String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+$/g, '')
      .trim()
      .toLocaleLowerCase('ru-RU');
    const extractLabeledMultilineSectionLocal = (text, startLabel, endLabels) => {
      const lines = String(text || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/g, ''));
      const startKey = normalizeSectionLabelLineLocal(startLabel);
      const endKeys = new Set((endLabels || []).map((label) => normalizeSectionLabelLineLocal(label)));
      const startIndex = lines.findIndex((line) => normalizeSectionLabelLineLocal(line) === startKey);
      if (startIndex === -1) return '';

      const collected = [];
      for (let index = startIndex + 1; index < lines.length; index++) {
        const line = lines[index];
        if (endKeys.has(normalizeSectionLabelLineLocal(line))) break;
        collected.push(line);
      }

      return normalizeSuppSectionTextLocal(collected.join('\n'));
    };
    const extractSuppIncidentReasonTextLocal = (text) => {
      const extracted = extractLabeledMultilineSectionLocal(text, 'Причина возникновения инцидента:', [
        'Комментарии',
        'Файлы',
        'Дополнительно'
      ]);
      if (extracted) return extracted;

      const source = String(text || '').replace(/\r\n?/g, '\n');
      const startMarker = 'Причина возникновения инцидента:';
      const startIdx = source.toLowerCase().indexOf(startMarker.toLowerCase());
      if (startIdx === -1) return '';

      let result = source.substring(startIdx + startMarker.length);
      let endIdx = -1;
      ['\nКомментарии\n', '\nФайлы\n', '\nДополнительно\n'].forEach((marker) => {
        const idx = result.toLowerCase().indexOf(marker.toLowerCase());
        if (idx !== -1 && (endIdx === -1 || idx < endIdx)) endIdx = idx;
      });
      if (endIdx !== -1) result = result.substring(0, endIdx);
      return normalizeSuppSectionTextLocal(result);
    };
    const encodeDiscussionPlainTextLine = (line) => {
      const value = String(line || '').replace(/\u00a0/g, ' ');
      if (!value) return '';
      if (/^\\/.test(value) || /^\[\[Q\d+\]\](?:\s|$)/i.test(value)) return '\\' + value;
      return value;
    };
    const encodeDiscussionQuoteTextLine = (line, depth) => {
      const normalizedDepth = Math.max(1, Number(depth) || 1);
      const normalizedLine = String(line || '').replace(/\u00a0/g, ' ');
      const prefix = `[[Q${normalizedDepth}]]`;
      return normalizedLine ? `${prefix} ${normalizedLine}` : prefix;
    };
    const extractSuppRequestItilNumber = (text) => {
      if (!text) return '';

      let result = String(text || '').replace(/\r\n?/g, '\n');
      const startMarker = 'Детальное описание:';
      const startIdx = result.toLowerCase().indexOf(startMarker.toLowerCase());
      if (startIdx !== -1) result = result.substring(startIdx + startMarker.length);

      const lower = result.toLowerCase();
      let endIdx = -1;
      ['Причина возникновения инцидента:', '\nКомментарии\n', '\nФайлы\n'].forEach((marker) => {
        const idx = lower.indexOf(String(marker).toLowerCase());
        if (idx !== -1 && (endIdx === -1 || idx < endIdx)) endIdx = idx;
      });
      if (endIdx !== -1) result = result.substring(0, endIdx);

      const lines = result.replace(/\r\n?/g, '\n').split('\n');
      for (const rawLine of lines) {
        const line = String(rawLine || '').trim();
        if (!line) continue;

        const suppLinkMatch = line.match(/^Ссылка на заявку ITIL\s*[:\t ]+([0-9-]+)\b/i);
        if (suppLinkMatch) return String(suppLinkMatch[1] || '').trim();

        const znoMatch = line.match(/^ЗНО\s+([0-9-]+)(?::|\s|$)/i);
        if (znoMatch) return String(znoMatch[1] || '').trim();
      }

      const authorLineRe = /^\s*[^\r\n()]+?\s+\(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2}\):\s*$/;
      const markers = [];
      for (let index = 0; index < lines.length; index++) {
        if (authorLineRe.test(lines[index])) {
          markers.push(index);
          if (markers.length >= 2) break;
        }
      }
      if (markers.length) {
        const endIndex = markers.length >= 2 ? markers[1] : lines.length;
        result = lines.slice(markers[0] + 1, endIndex).join('\n');
      }

      const match = result.replace(/^\s+/, '').match(/^ЗНО\s+([0-9-]+)(?::|\s|$)/i);
      return match ? String(match[1] || '').trim() : '';
    };

    function isVisible(element) {
      if (!(element instanceof Element)) return false;
      const style = window.getComputedStyle(element);
      if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.bottom >= 0
        && rect.right >= 0
        && rect.top <= window.innerHeight
        && rect.left <= window.innerWidth;
    }

    async function waitFor(getter, timeoutMs, label) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const value = getter();
        if (value) return value;
        await sleep(250);
      }
      throw new Error(`Не дождался: ${label}.`);
    }

    function dispatchMouseLike(element, type, detail) {
      const rect = element.getBoundingClientRect();
      const clientX = rect.left + Math.max(1, Math.min(rect.width - 1, rect.width / 2));
      const clientY = rect.top + Math.max(1, Math.min(rect.height - 1, rect.height / 2));
      element.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: detail || 1,
        clientX,
        clientY,
        button: 0,
        buttons: type === 'mouseup' || type === 'click' || type === 'dblclick' ? 0 : 1
      }));
    }

    async function clickLikeUser(element) {
      element.scrollIntoView({ block: 'center', inline: 'center' });
      await sleep(50);
      dispatchMouseLike(element, 'mouseover', 0);
      dispatchMouseLike(element, 'mousemove', 0);
      dispatchMouseLike(element, 'mousedown', 1);
      if (typeof element.focus === 'function') element.focus();
      dispatchMouseLike(element, 'mouseup', 1);
      dispatchMouseLike(element, 'click', 1);
      await sleep(160);
    }

    function findGlobalSearchInput() {
      const explicit = document.querySelector('#captionbarField_i0');
      if (isVisible(explicit)) return explicit;

      return Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .find((input) => isVisible(input) && normalizeText(input.getAttribute('placeholder') || '').includes('Поиск Ctrl+Shift+F')) || null;
    }

    function setInputValue(input, value) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (setter && typeof setter.set === 'function') {
        setter.set.call(input, value);
      } else {
        input.value = value;
      }
    }

    async function clearGlobalSearchInput(input) {
      await clickLikeUser(input);
      if (typeof input.select === 'function') input.select();

      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', code: 'KeyA', ctrlKey: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'a', code: 'KeyA', ctrlKey: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Backspace', code: 'Backspace' }));

      try {
        document.execCommand('delete');
      } catch (error) {
        // Не все браузеры разрешают execCommand в content script.
      }

      if (String(input.value || '')) setInputValue(input, '');
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
        data: null
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Backspace', code: 'Backspace' }));

      const clearButton = document.querySelector('#captionbarField_CLR');
      if (isVisible(clearButton)) {
        await clickLikeUser(clearButton);
      }

      await sleep(250);
    }

    async function closeGlobalSearchPopup() {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape', code: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Escape', code: 'Escape' }));
      await sleep(250);
    }

    async function enterSearchTextLikeUser(input, value) {
      await clickLikeUser(input);
      if (typeof input.select === 'function') input.select();

      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value[0] || '', code: '' }));
      input.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value
      }));

      try {
        document.execCommand('insertText', false, value);
      } catch (error) {
        // Fallback ниже выставит значение через setter.
      }

      if (String(input.value || '') !== value) setInputValue(input, value);
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: value.slice(-1) || '', code: '' }));
      await sleep(450);
    }

    function getVisibleTextNodes() {
      return Array.from(document.querySelectorAll('li,[role="listitem"],div,span,a'))
        .filter((element) => isVisible(element))
        .map((element) => ({
          element,
          text: normalizeText(element.textContent || '')
        }))
        .filter((item) => item.text);
    }

    function escapeRegExp(value) {
      return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function hasExactRequestNumber(text) {
      const normalized = normalizeText(text);
      if (!normalized || !number) return false;
      const escaped = escapeRegExp(number);
      return new RegExp(`(^|[^A-Za-zА-Яа-яЁё0-9])${escaped}($|[^A-Za-zА-Яа-яЁё0-9])`, 'i').test(normalized);
    }

    function getSearchDropdown() {
      return document.getElementById('editDropDown');
    }

    function getSuppDropdownRows() {
      const dropdown = getSearchDropdown();
      if (!dropdown) return [];

      return Array.from(dropdown.querySelectorAll('.eddList > li, li[listindex]'))
        .map((row) => ({
          row,
          text: normalizeText(row.textContent || ''),
          listIndex: Number(row.getAttribute('listindex')),
          selected: row.classList && row.classList.contains('select')
        }))
        .filter((item, index, list) => (
          item.row
          && item.text
          && list.findIndex((other) => other.row === item.row) === index
        ));
    }

    function getSuppSearchNotFoundText() {
      const dropdown = getSearchDropdown();
      const topText = dropdown
        ? normalizeText((dropdown.querySelector('.eddTop') || {}).textContent || '')
        : '';

      if (topText && /ничего\s+не\s+найдено|не\s+найден|нет\s+результатов/i.test(topText)) {
        return topText;
      }

      const visible = getVisibleTextNodes()
        .map((item) => item.text)
        .find((text) => text.length < 500 && /ничего\s+не\s+найдено|не\s+найден|нет\s+результатов/i.test(text));

      return visible || '';
    }

    function hasSearchNotFoundMessage() {
      const text = getSuppSearchNotFoundText();
      if (!text) return false;
      // Если в тексте указан конкретный запрос, он должен совпадать с текущим номером.
      return !/по\s+запросу/i.test(text) || hasExactRequestNumber(text);
    }

    function getSuppDropdownCandidate() {
      const rows = getSuppDropdownRows()
        .filter((item) => hasExactRequestNumber(item.text))
        .filter((item) => !item.row.classList || !item.row.classList.contains('eddListDisabled'));

      if (!rows.length) return null;

      const byListIndexZero = rows.find((item) => item.listIndex === 0);
      if (byListIndexZero) return byListIndexZero.row;

      const directRequest = rows.find((item) => /^Заявка\s+ЗНР-/i.test(item.text));
      if (directRequest) return directRequest.row;

      const requestRow = rows.find((item) => /^Заявка[:\s]/i.test(item.text));
      if (requestRow) return requestRow.row;

      const selected = rows.find((item) => item.selected);
      if (selected) return selected.row;

      return rows[0].row;
    }

    function findSuppSearchResult() {
      const wanted = `Заявка ${number}`;
      const candidates = getVisibleTextNodes()
        .filter((item) => item.text.includes(wanted) && item.text.length <= 500)
        .map((item) => {
          const row = item.element.closest('li,[role="listitem"],a,button') || item.element;
          const rect = row.getBoundingClientRect();
          return {
            element: row,
            area: Math.max(1, rect.width * rect.height),
            text: item.text
          };
        })
        .filter((item, index, list) => list.findIndex((other) => other.element === item.element) === index)
        .sort((a, b) => a.area - b.area);

      return candidates.length ? candidates[0].element : null;
    }

    async function clickSuppSearchResult(row, input) {
      if (!row) return false;

      const target = row.querySelector('.eddText, b, span') || row;

      try {
        await clickLikeUser(target);
        if (await waitForSuppCardOpened(getTimeout('suppFallbackCardOpenMs', 8000))) return true;
      } catch (error) {
        // Пробуем следующие способы ниже.
      }

      try {
        await clickLikeUser(row);
        if (await waitForSuppCardOpened(getTimeout('suppFallbackCardOpenMs', 8000))) return true;
      } catch (error) {
        // Пробуем следующие способы ниже.
      }

      try {
        dispatchMouseLike(row, 'mousedown', 1);
        dispatchMouseLike(row, 'mouseup', 1);
        dispatchMouseLike(row, 'dblclick', 2);
        if (await waitForSuppCardOpened(getTimeout('suppFallbackCardOpenMs', 8000))) return true;
      } catch (error) {
        // Пробуем Enter ниже.
      }

      const enterTarget = isVisible(input) ? input : (document.activeElement || row);
      try {
        if (typeof row.focus === 'function') row.focus();
        enterTarget.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
        enterTarget.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
        if (await waitForSuppCardOpened(getTimeout('suppFallbackCardOpenMs', 8000))) return true;
      } catch (error) {
        // Ничего не делаем, ниже вернём false.
      }

      return false;
    }

    async function waitForSuppCardOpened(timeoutMs) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        if (findOpenedRequestCard()) return true;
        await sleep(250);
      }
      return false;
    }

    async function waitForSearchResultOrNotFound(timeoutMs) {
      const startedAt = Date.now();
      let lastResultText = '';
      let stableCount = 0;

      while (Date.now() - startedAt < timeoutMs) {
        const result = findSuppSearchResult();

        if (result) {
          const resultText = normalizeText(result.textContent || '');

          if (resultText && resultText === lastResultText) {
            stableCount++;
          } else {
            lastResultText = resultText;
            stableCount = 1;
          }

          // Не кликаем в первый же момент появления DOM-элемента:
          // dropdown СУПП визуально уже может быть на экране, но обработчики ещё не готовы.
          if (stableCount >= 2) {
            await sleep(350);
            const refreshedResult = findSuppSearchResult();
            if (refreshedResult) return { result: refreshedResult };
            return { result };
          }
        }

        if (hasSearchNotFoundMessage()) return { notFound: true };

        await sleep(250);
      }

      return { timeout: true };
    }

  function getSuppPageNumberFromId(id) {
    const match = String(id || '').match(/^VW_page(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function getSuppPagePrefixFromElement(element, suffix) {
    if (!element || !element.id) return '';
    return String(element.id).replace(new RegExp(`${suffix}$`), '');
  }

  function getVisibleSuppTitleNodes() {
    return Array.from(document.querySelectorAll('[id^="VW_page"][id$="headerTopLine_title"]'))
      .filter((element) => isVisible(element));
  }

  function getActiveSuppPagePrefix() {
    const titles = getVisibleSuppTitleNodes()
      .map((title) => ({
        title,
        text: normalizeText(title.getAttribute('title') || title.textContent || ''),
        page: getSuppPageNumberFromId(title.id)
      }))
      .filter((item) => !number || item.text.includes(number))
      .sort((a, b) => b.page - a.page);

    if (titles.length) {
      return getSuppPagePrefixFromElement(titles[0].title, 'headerTopLine_title');
    }

    const buttons = getVisibleSuppCloseButtons();
    if (buttons.length) {
      return getSuppPagePrefixFromElement(buttons[0], 'headerTopLine_cmd_CloseButton');
    }

    return '';
  }

  function findOpenedRequestCard() {
    const title = getVisibleSuppTitleNodes()
      .find((element) => hasExactRequestNumber(element.getAttribute('title') || element.textContent || ''));
    if (title) return title;

    return null;
  }

    async function openSuppRequestFromSearch() {
      const input = await waitFor(findGlobalSearchInput, getTimeout('suppSearchInputMs', 90000), 'глобальное поле поиска СУПП');

      for (let attempt = 1; attempt <= 2; attempt++) {
        await clearGlobalSearchInput(input);
        await closeGlobalSearchPopup();
        await enterSearchTextLikeUser(input, number);

        // Даём СУПП время не просто показать dropdown, а навесить обработчики.
        await sleep(700);

        const searchState = await waitForSearchResultOrNotFound(getTimeout('suppSearchResultMs', 35000));

        if (searchState.result) {
          let clicked = false;

          for (let clickAttempt = 1; clickAttempt <= 3; clickAttempt++) {
            const currentResult = findSuppSearchResult() || searchState.result;

            if (currentResult && isVisible(currentResult)) {
              await clickLikeUser(currentResult);
              clicked = true;
            }

            const openedQuickly = await waitForSuppCardOpened(getTimeout('suppCardOpenMs', 7000));
            if (openedQuickly) return;

            // Иногда dropdown выделил нужную строку, но mouse click не прошёл.
            // Тогда Enter по полю поиска открывает выбранный элемент.
            input.dispatchEvent(new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter'
            }));
            input.dispatchEvent(new KeyboardEvent('keyup', {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter'
            }));

            const openedByEnter = await waitForSuppCardOpened(getTimeout('suppCardOpenMs', 7000));
            if (openedByEnter) return;

            await sleep(500);
          }

          if (clicked) {
            throw new Error(`Результат поиска СУПП ${number} найден, но карточка не открылась после клика.`);
          }
        }

        await clearGlobalSearchInput(input);
        await closeGlobalSearchPopup();

        if (attempt === 2) {
          return searchState.notFound
            ? {
              skipped: true,
              skipReason: 'not-found',
              skipMessage: `Заявка ${number} не найдена в поиске СУПП.`
            }
            : {
              skipped: true,
              skipReason: 'search-timeout',
              skipMessage: `Не дождался результата поиска СУПП ${number}.`
            };
        }
      }

      return { skipped: true, skipReason: 'search-result-unavailable', skipMessage: `Не удалось открыть поиск СУПП ${number}.` };
    }

    function getInfoIframeText() {
      const prefix = getActiveSuppPagePrefix();
      const pageMatch = String(prefix || '').match(/^VW_page(\d+)/);
      const activeFormId = pageMatch ? `form${pageMatch[1]}_ИнформацияПоЗаявке` : '';
      const candidates = [];
      const seen = new Set();

      const pushCandidate = (iframe, ownerId) => {
        if (!(iframe instanceof HTMLIFrameElement) || seen.has(iframe)) return;
        seen.add(iframe);

        let text = '';
        try {
          const body = iframe.contentDocument && iframe.contentDocument.body;
          text = normalizeSuppSectionTextLocal(body ? body.innerText || body.textContent || '' : '');
        } catch (error) {
          // Нужный iframe СУПП доступен как same-origin; прочие можно пропустить.
        }
        const ownerVisible = ownerId ? isVisible(document.getElementById(ownerId)) : false;
        const frameVisible = isVisible(iframe);
        let score = text.length;
        if (ownerId && ownerId === activeFormId) score += 1000000;
        if (ownerVisible) score += 100000;
        if (frameVisible) score += 10000;
        candidates.push({ text, score });
      };

      if (activeFormId) {
        const activeContainer = document.getElementById(activeFormId);
        if (activeContainer) {
          activeContainer.querySelectorAll('iframe').forEach((iframe) => pushCandidate(iframe, activeFormId));
        }
      }

      Array.from(document.querySelectorAll('[id*="ИнформацияПоЗаявке"]')).forEach((container) => {
        const ownerId = container && container.id ? container.id : '';
        container.querySelectorAll('iframe').forEach((iframe) => pushCandidate(iframe, ownerId));
      });

      Array.from(document.querySelectorAll('iframe'))
        .filter((iframe) => isVisible(iframe))
        .forEach((iframe) => pushCandidate(iframe, ''));

      candidates.sort((left, right) => right.score - left.score);
      return candidates.length ? candidates[0].text : '';
    }

    function extractCommentsText(infoText) {
      const extracted = extractLabeledMultilineSectionLocal(infoText, 'Комментарии', [
        'Файлы',
        'Дополнительно'
      ]);
      if (extracted) return extracted;

      const source = String(infoText || '').replace(/\r\n?/g, '\n');
      const start = source.indexOf('\nКомментарии\n');
      if (start === -1) return '';

      let result = source.substring(start + '\nКомментарии\n'.length);
      let endIdx = -1;
      ['\nФайлы\n', '\nДополнительно\n'].forEach((marker) => {
        const idx = result.indexOf(marker);
        if (idx !== -1 && (endIdx === -1 || idx < endIdx)) endIdx = idx;
      });
      if (endIdx !== -1) result = result.substring(0, endIdx);
      return normalizeSuppSectionTextLocal(result);
    }

  async function openDiscussionPanel() {
    const prefix = getActiveSuppPagePrefix();
    const button = (prefix ? document.getElementById(`${prefix}headerTopLine_cmdf_ECSFormButton`) : null)
      || Array.from(document.querySelectorAll('[id^="VW_page"][id$="headerTopLine_cmdf_ECSFormButton"]'))
        .filter((element) => isVisible(element))
        .sort((a, b) => getSuppPageNumberFromId(b.id) - getSuppPageNumberFromId(a.id))[0]
      || Array.from(document.querySelectorAll('a,button,span,div'))
        .find((element) => isVisible(element) && normalizeText(element.textContent) === 'Обсуждение');

    if (isVisible(button)) {
      await clickLikeUser(button);
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 2000) {
      const root = (prefix ? document.getElementById(`${prefix}ecsCell`) : null)
        || Array.from(document.querySelectorAll('[id^="VW_page"][id$="ecsCell"]'))
          .filter((element) => isVisible(element) || element.querySelector('.ecsChatItem'))
          .sort((a, b) => getSuppPageNumberFromId(b.id) - getSuppPageNumberFromId(a.id))[0]
        || null;
      if (root && (isVisible(root) || root.querySelector('.ecsChatItem'))) return root;
      await sleep(250);
    }

    return (prefix ? document.getElementById(`${prefix}ecsCell`) : null)
      || Array.from(document.querySelectorAll('[id^="VW_page"][id$="ecsCell"]'))
        .filter((element) => isVisible(element) || element.querySelector('.ecsChatItem'))
        .sort((a, b) => getSuppPageNumberFromId(b.id) - getSuppPageNumberFromId(a.id))[0]
      || null;
  }

  function getDiscussionRoot() {
    const prefix = getActiveSuppPagePrefix();
    return (prefix ? document.getElementById(`${prefix}ecsCell`) : null)
      || Array.from(document.querySelectorAll('[id^="VW_page"][id$="ecsCell"]'))
        .filter((element) => isVisible(element) || element.querySelector('.ecsChatItem'))
        .sort((a, b) => getSuppPageNumberFromId(b.id) - getSuppPageNumberFromId(a.id))[0]
      || null;
  }

    function getDiscussionText() {
      const root = getDiscussionRoot();
      if (!root) return '';

      function serializeDiscussionBody(bodyElement) {
        if (!(bodyElement instanceof HTMLElement)) return '';

        const children = Array.from(bodyElement.children || []);
        const lines = [];
        let usedStructuredMarkup = false;

        children.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains('ecsChatBR')) return;

          if (node.matches('span[data-depth]')) {
            usedStructuredMarkup = true;

            const depth = Math.max(0, Number(node.getAttribute('data-depth') || 0));
            const rawText = String(node.innerText || node.textContent || '')
              .replace(/\u00a0/g, ' ')
              .replace(/\r\n?/g, '\n');
            const parts = rawText.split('\n');
            if (!parts.length) parts.push('');

            parts.forEach((part) => {
              const line = part.replace(/[ \t]+$/g, '');
              if (depth > 0) {
                lines.push(encodeDiscussionQuoteTextLine(line, depth));
              } else {
                lines.push(encodeDiscussionPlainTextLine(line));
              }
            });
            return;
          }

          String(node.innerText || node.textContent || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n?/g, '\n')
            .split('\n')
            .forEach((part) => {
              lines.push(encodeDiscussionPlainTextLine(part.replace(/[ \t]+$/g, '')));
            });
        });

        if (!usedStructuredMarkup) {
          return normalizeMultiline(bodyElement.innerText || bodyElement.textContent || '');
        }

        return normalizeMultiline(lines.join('\n'));
      }

      const items = Array.from(root.querySelectorAll('.ecsChatItem')).map((item) => {
        let date = '';
        let cursor = item.previousElementSibling;
        while (cursor) {
          if (cursor.classList && cursor.classList.contains('ecsChatDate')) {
            date = normalizeMultiline(cursor.innerText || cursor.textContent || '');
            break;
          }
          cursor = cursor.previousElementSibling;
        }

        return {
          date,
          sender: normalizeMultiline((item.querySelector('.ecsChatName.bold') || {}).innerText || ''),
          recipient: normalizeMultiline((item.querySelector('.ecsChatWhom .ecsChatName') || {}).innerText || ''),
          body: serializeDiscussionBody(item.querySelector('.ecsChatText')),
          time: normalizeMultiline((item.querySelector('[data-info-text]') || {}).innerText || '')
        };
      }).filter((item) => item.sender || item.body);

      const lines = [];
      let currentDate = '';
      items.forEach((item) => {
        if (item.date && item.date !== currentDate) {
          if (lines.length) lines.push('');
          lines.push(item.date);
          currentDate = item.date;
        }
        if (item.sender) lines.push(item.sender);
        if (item.recipient) {
          lines.push(item.recipient);
          lines.push('→');
        }
        if (item.body) {
          item.body.split('\n').forEach((line) => {
            const normalizedLine = line.replace(/[ \t]+$/g, '');
            if (normalizedLine || (lines.length && lines[lines.length - 1] !== '')) {
              lines.push(normalizedLine);
            }
          });
        }
        if (item.time) lines.push(item.time);
      });

      return normalizeMultiline(lines.join('\n'));
    }

  async function waitForDiscussionTextStabilized(timeoutMs) {
    const startedAt = Date.now();
    let lastText = '';
    let stableSince = 0;
    let emptySince = 0;

    while (Date.now() - startedAt < timeoutMs) {
      const root = getDiscussionRoot();
      const text = root ? getDiscussionText() : '';
      const chatBlock = root
        ? (root.querySelector('[id$="messages_list_chat_block"]') || root.querySelector('.ecsChatBlock'))
        : null;
      const hasChatItems = !!(root && root.querySelector('.ecsChatItem'));
      const rawChatText = normalizeMultiline((chatBlock && (chatBlock.innerText || chatBlock.textContent)) || '');

      if (!text && root && !hasChatItems && !rawChatText) {
        if (!emptySince) emptySince = Date.now();
        if (Date.now() - emptySince >= 1200) return '';
      } else {
        emptySince = 0;
      }

      if (text && text === lastText) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince >= 900) return text;
      } else {
        lastText = text;
        stableSince = text ? Date.now() : 0;
      }

      await sleep(300);
    }

    return lastText || '';
  }

  function getVisibleSuppCloseButtons() {
    return Array.from(document.querySelectorAll('[id^="VW_page"][id$="headerTopLine_cmd_CloseButton"]'))
      .filter((element) => isVisible(element))
      .sort((a, b) => getSuppPageNumberFromId(b.id) - getSuppPageNumberFromId(a.id));
  }

  function findSuppCloseButton() {
    const prefix = getActiveSuppPagePrefix();
    const buttonByPrefix = prefix ? document.getElementById(`${prefix}headerTopLine_cmd_CloseButton`) : null;
    if (isVisible(buttonByPrefix)) return buttonByPrefix;

    const buttons = getVisibleSuppCloseButtons();
    return buttons.length ? buttons[0] : null;
  }

  async function waitForSuppCardClosed(timeoutMs, prefix) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const sameCardCloseButton = prefix
        ? document.getElementById(`${prefix}headerTopLine_cmd_CloseButton`)
        : findSuppCloseButton();

      const requestCard = findOpenedRequestCard();
      const closeButtonVisible = isVisible(sameCardCloseButton);

      // В СУПП кнопка закрытия может оставаться в DOM во время анимации.
      // Главный признак закрытия — карточка именно этой заявки больше не определяется.
      if (!requestCard) {
        await sleep(300);
        return true;
      }

      if (!closeButtonVisible) {
        await sleep(300);
        return true;
      }

      await sleep(250);
    }
    return false;
  }

  async function clickSuppCloseButton(closeButton) {
    if (!isVisible(closeButton)) return false;

    const prefix = getSuppPagePrefixFromElement(closeButton, 'headerTopLine_cmd_CloseButton');

    await clickLikeUser(closeButton);
    if (await waitForSuppCardClosed(getTimeout('suppCloseStepMs', 2500), prefix)) return true;

    try {
      closeButton.click();
    } catch (error) {
      // Игнорируем и пробуем следующие fallback ниже.
    }
    if (await waitForSuppCardClosed(getTimeout('suppCloseStepMs', 2500), prefix)) return true;

    const svg = closeButton.querySelector('svg,use');
    if (svg) {
      try {
        svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch (error) {
        // SVG fallback не критичен.
      }
    }
    if (await waitForSuppCardClosed(getTimeout('suppCloseStepMs', 2500), prefix)) return true;

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape', code: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Escape', code: 'Escape' }));
    return waitForSuppCardClosed(getTimeout('suppCloseStepMs', 2500), prefix);
  }

  async function closeOpenedRequestCard() {
    let closeError = null;
    let targetPrefix = getActiveSuppPagePrefix();

    for (let attempt = 1; attempt <= 3; attempt++) {
      const closeButton = targetPrefix
        ? document.getElementById(`${targetPrefix}headerTopLine_cmd_CloseButton`)
        : findSuppCloseButton();

      if (!isVisible(closeButton)) break;
      if (!targetPrefix) targetPrefix = getSuppPagePrefixFromElement(closeButton, 'headerTopLine_cmd_CloseButton');

      const closed = await clickSuppCloseButton(closeButton);
      if (closed) break;

      closeError = new Error(`Не удалось закрыть заявку ${number}: кнопка ${closeButton.id || closeButton.getAttribute('title') || 'Закрыть'} осталась видимой после попытки ${attempt}.`);

      if (await waitForSuppCardClosed(getTimeout('suppCloseRetryMs', 3000), targetPrefix)) break;
      await sleep(400);
    }

    await waitForSuppCardClosed(getTimeout('suppCloseFinalMs', 5000), targetPrefix);

    if (findOpenedRequestCard()) {
      throw closeError || new Error(`Не удалось закрыть заявку ${number}: карточка осталась открытой.`);
    }

    const input = findGlobalSearchInput();
    if (input) {
      await clearGlobalSearchInput(input);
      await closeGlobalSearchPopup();
    }
  }

    try {
      await waitFor(findGlobalSearchInput, getTimeout('suppSearchInputMs', 90000), 'страница СУПП');
      const openResult = await openSuppRequestFromSearch();
      if (openResult && openResult.skipped === true) {
        return {
          success: true,
          skipped: true,
          skipReason: openResult.skipReason,
          skipMessage: openResult.skipMessage
        };
      }

      const requestText = await waitFor(getInfoIframeText, getTimeout('suppRequestTextMs', 60000), `текст заявки СУПП ${number}`);
      if (leaveOpen) {
        return {
          success: true,
          opened: true,
          requestItilNumber: extractSuppRequestItilNumber(requestText)
        };
      }

      const incidentReasonText = extractSuppIncidentReasonTextLocal(requestText);
      const commentsText = extractCommentsText(requestText);

      await openDiscussionPanel();
      const discussionText = await waitForDiscussionTextStabilized(getTimeout('suppDiscussionMs', 8000));

      await closeOpenedRequestCard();

      return {
        success: true,
        requestText,
        requestItilNumber: extractSuppRequestItilNumber(requestText),
        incidentReasonText,
        commentsText,
        discussionText
      };
    } catch (error) {
      try {
        await closeOpenedRequestCard();
      } catch (closeError) {
        // Ошибка очистки/закрытия не должна скрывать первичную причину падения.
      }
      return {
        success: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  async function prepareAndSendChatGptPromptInPage(payload) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitFor = async (getter, timeoutMs, description) => {
      const startedAt = Date.now();
      while ((Date.now() - startedAt) < timeoutMs) {
        const value = getter();
        if (value) return value;
        await sleep(250);
      }
      throw new Error(`Не дождался: ${description}.`);
    };

    const getComposer = () => document.querySelector('#prompt-textarea[contenteditable="true"]')
      || document.querySelector('[contenteditable="true"][role="textbox"]');
    const getSendButton = () => document.querySelector('[data-testid="send-button"]')
      || Array.from(document.querySelectorAll('button')).find((button) => /отправ/i.test(String(button.getAttribute('aria-label') || '')));
    const getReadySendButton = () => {
      const button = getSendButton();
      if (!(button instanceof HTMLButtonElement)) return null;
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
      return button;
    };
    const getStopButton = () => document.querySelector('[data-testid="stop-button"]')
      || Array.from(document.querySelectorAll('button')).find((button) => /останов/i.test(String(button.getAttribute('aria-label') || '')));
    const getAssistantMessages = () => Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));

    try {
      const fileName = String(payload && payload.fileName || '').trim();
      const promptText = String(payload && payload.promptText || '').trim();
      if (!fileName || !promptText) {
        throw new Error('Для ChatGPT переданы неполные данные.');
      }

      const composer = await waitFor(getComposer, 90000, 'поле ввода ChatGPT');
      await waitFor(() => {
        const attachment = Array.from(document.querySelectorAll('[role="group"], button, [data-testid]')).find((element) => {
          return String(element.getAttribute('aria-label') || '').includes(fileName)
            || String(element.textContent || '').trim() === fileName;
        });
        return attachment || getReadySendButton();
      }, 90000, 'прикрепление CSV-файла');

      composer.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection.addRange(range);
      }
      document.execCommand('insertText', false, promptText);

      const sendButton = await waitFor(getReadySendButton, 90000, 'готовую кнопку отправки ChatGPT после обработки CSV');
      sendButton.click();

      await waitFor(() => getAssistantMessages().length > 0 || !!getStopButton(), 60000, 'начало ответа ChatGPT');
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  async function waitForChatGptAnswerInPage() {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const getStopButton = () => document.querySelector('[data-testid="stop-button"]')
      || Array.from(document.querySelectorAll('button')).find((button) => /останов/i.test(String(button.getAttribute('aria-label') || '')));
    const getAssistantMessages = () => Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));

    try {
      const timeoutMs = 10 * 60 * 1000;
      const startedAt = Date.now();
      let lastText = '';
      let stableSince = 0;

      while ((Date.now() - startedAt) < timeoutMs) {
        const assistantMessages = getAssistantMessages();
        const latestAssistant = assistantMessages[assistantMessages.length - 1] || null;
        const latestText = latestAssistant ? String(latestAssistant.innerText || '').trim() : '';
        const isGenerating = !!getStopButton();

        if (latestText && !isGenerating) {
          if (latestText === lastText) {
            if (!stableSince) stableSince = Date.now();
            if ((Date.now() - stableSince) >= 1200) {
              return {
                success: true,
                answerText: latestText
              };
            }
          } else {
            lastText = latestText;
            stableSince = 0;
          }
        } else if (latestText !== lastText) {
          lastText = latestText;
          stableSince = 0;
        }

        await sleep(350);
      }

      throw new Error('Не дождался завершения ответа ChatGPT.');
    } catch (error) {
      return {
        success: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || (
      request.action !== SAVE_ACTION
      && request.action !== ITIL_FILL_ACTION
      && request.action !== SUPP_FILL_ACTION
      && request.action !== ITIL_OPEN_REQUEST_ACTION
      && request.action !== SUPP_OPEN_REQUEST_ACTION
      && request.action !== ITIL_INFO_REFRESH_ACTION
      && request.action !== SUPP_INFO_REFRESH_ACTION
      && request.action !== CHATGPT_SEARCH_ACTION
      && request.action !== CHATGPT_QUESTION_ACTION
      && request.action !== CHATGPT_OPEN_TAB_ACTION
      && request.action !== CHATGPT_CLOSE_TAB_ACTION
    )) return false;

    if (!isAllowedSender(sender)) {
      sendResponse({ success: false, error: 'Запрос разрешён только со страницы настроенной Google-таблицы.' });
      return false;
    }

    const data = request.data || {};
    (async () => {
      try {
        if (request.action === SAVE_ACTION) {
          const queued = await enqueueBridgePost(data.bridgeUrl, data.payload || {});
          sendResponse({ success: true, result: queued.result, bridgeQueueId: queued.queueId });
          return;
        }

        let result;
        if (request.action === ITIL_FILL_ACTION) {
          result = await runItilFillRow(data);
        } else if (request.action === SUPP_FILL_ACTION) {
          result = await runSuppFillRow(data);
        } else if (request.action === ITIL_OPEN_REQUEST_ACTION) {
          result = await runItilOpenRequest(data);
        } else if (request.action === SUPP_OPEN_REQUEST_ACTION) {
          result = await runSuppOpenRequest(data);
        } else if (request.action === ITIL_INFO_REFRESH_ACTION) {
          result = await runItilInfoRefreshRow(data);
        } else if (request.action === SUPP_INFO_REFRESH_ACTION) {
          result = await runSuppInfoRefreshRow(data);
        } else if (request.action === CHATGPT_SEARCH_ACTION) {
          const progressTabId = sender && sender.tab && Number.isInteger(sender.tab.id)
            ? sender.tab.id
            : null;
          result = await runChatGptSearch(
            data,
            progressTabId,
            sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null,
            sender && sender.tab && Number.isInteger(sender.tab.windowId) ? sender.tab.windowId : null
          );
        } else if (request.action === CHATGPT_QUESTION_ACTION) {
          const progressTabId = sender && sender.tab && Number.isInteger(sender.tab.id)
            ? sender.tab.id
            : null;
          result = await runChatGptQuestion(
            data,
            progressTabId,
            sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null,
            sender && sender.tab && Number.isInteger(sender.tab.windowId) ? sender.tab.windowId : null
          );
        } else if (request.action === CHATGPT_OPEN_TAB_ACTION) {
          result = await activateChatGptTab(Number(data.tabId));
        } else {
          result = await closeChatGptTab(
            Number(data.tabId),
            Number.isInteger(data.sourceTabId) ? data.sourceTabId : null,
            Number.isInteger(data.sourceWindowId) ? data.sourceWindowId : null
          );
        }
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({
          success: false,
          error: error && error.message ? error.message : 'Ошибка выполнения GoogleSheets background.'
        });
      }
    })();

    return true;
  });
})();
