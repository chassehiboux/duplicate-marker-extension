(function() {
  'use strict';

  const SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
  const SAVE_ACTION = 'GOOGLE_SHEETS_PROBLEM_PICKER_SAVE';
  const ITIL_FILL_ACTION = 'GOOGLE_SHEETS_ITIL_FILL_ROW';
  const SUPP_FILL_ACTION = 'GOOGLE_SHEETS_SUPP_FILL_ROW';
  const ITIL_URL = 'http://tmn-vpitil1c01/ITIL/ru_RU/';
  const SUPP_URL = 'http://tmn-vpsupp1c01.corp.vostok-electra.ru/PMS/ru_RU/';

  function isAllowedSender(sender) {
    const url = sender && sender.url ? String(sender.url) : '';
    return url.includes(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/`);
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

  function processSuppRequestText(text) {
    if (!text) return '';

    let result = sliceTextSection(text, 'Детальное описание:', [
      'Причина возникновения инцидента:',
      '\nКомментарии\n',
      '\nФайлы\n'
    ]);

    result = extractFirstItilMessageBody(result);
    result = result.replace(/ЗНО\s+[\d-]+:(?:\s+.*?\(\d{2}\.\d{2}\.\d{4}.*?\))?\s*:?\s*/gi, '');
    return normalizeMultilineText(result);
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

    const resultParts = [];
    if (looseText.length) resultParts.push(looseText.join('\n'));
    logs.forEach((log) => resultParts.push(log.text));
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

  function processSuppInfoText(suppNumber, commentsText, discussionText) {
    const header = String(suppNumber || '').trim();
    const rawText = [
      header,
      normalizeMultilineText(commentsText),
      normalizeMultilineText(discussionText)
    ].filter(Boolean).join('\n\n');

    const validHeaders = new Set([header, 'ИТИЛ'].filter(Boolean));
    const processed = processAndSortInfoCell(rawText, validHeaders);
    return processed ? processed.trim() + '\n\n' : header + '\n\n';
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

  async function waitForTabReady(tabId, urlPrefix) {
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
      }, 90000);

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

  async function getOrCreateItilTab() {
    const tabs = await tabsQuery({});
    const existing = tabs.find((tab) => String(tab.url || '').startsWith(ITIL_URL));

    if (existing && Number.isInteger(existing.id)) {
      if (existing.status !== 'complete') await waitForTabReady(existing.id, ITIL_URL);
      return existing;
    }

    const created = await tabsCreate({ url: ITIL_URL, active: false });
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть вкладку ITIL.');
    }
    await waitForTabReady(created.id, ITIL_URL);
    return created;
  }

  async function getOrCreateSuppTab() {
    const tabs = await tabsQuery({});
    const existing = tabs.find((tab) => String(tab.url || '').startsWith(SUPP_URL));

    if (existing && Number.isInteger(existing.id)) {
      if (existing.status !== 'complete') await waitForTabReady(existing.id, SUPP_URL);
      return existing;
    }

    const created = await tabsCreate({ url: SUPP_URL, active: false });
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть вкладку СУПП.');
    }
    await waitForTabReady(created.id, SUPP_URL);
    return created;
  }

  async function runItilFillRow(data) {
    const payload = data && data.payload ? data.payload : {};
    const row = Number(payload.row);
    const itilNumber = String(payload.itilNumber || '').trim();
    const sheetName = String(payload.sheetName || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();

    if (spreadsheetId !== SPREADSHEET_ID) throw new Error('Некорректная таблица для ITIL-заполнения.');
    if (!sheetName) throw new Error('Не передан лист для ITIL-заполнения.');
    if (!Number.isInteger(row) || row < 2) throw new Error('Некорректный номер строки для ITIL-заполнения.');
    if (!itilNumber) throw new Error('Не передан номер ITIL.');

    const tab = await getOrCreateItilTab();
    const clipboardPrepared = await writeClipboardText(itilNumber);
    const result = await executeInTab(tab.id, collectItilRequestData, [itilNumber, clipboardPrepared]);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось получить данные из ITIL.');
    }

    const requestText = processRequestText(result.requestText || '');
    const solutionText = String(result.solutionText || '').trim();
    if (!requestText) throw new Error(`ITIL ${itilNumber}: текст заявки пустой.`);

    const bridgeResult = await postBridge(data.bridgeUrl, {
      action: 'saveItilData',
      spreadsheetId,
      sheetName,
      row,
      itilNumber,
      requestText,
      solutionText
    });

    if (bridgeResult && bridgeResult.success === false) {
      throw new Error(bridgeResult.error || 'Bridge не сохранил данные ITIL.');
    }

    return {
      row,
      itilNumber,
      requestTextLength: requestText.length,
      solutionTextLength: solutionText.length,
      bridge: bridgeResult
    };
  }

  async function runSuppFillRow(data) {
    const payload = data && data.payload ? data.payload : {};
    const row = Number(payload.row);
    const suppNumber = String(payload.suppNumber || '').trim();
    const sheetName = String(payload.sheetName || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();

    if (spreadsheetId !== SPREADSHEET_ID) throw new Error('Некорректная таблица для СУПП-заполнения.');
    if (!sheetName) throw new Error('Не передан лист для СУПП-заполнения.');
    if (!Number.isInteger(row) || row < 2) throw new Error('Некорректный номер строки для СУПП-заполнения.');
    if (!/^ЗНР-[A-Za-zА-Яа-яЁё0-9-]+$/.test(suppNumber)) throw new Error('Не передан корректный номер СУПП.');

    const tab = await getOrCreateSuppTab();
    const result = await executeInTab(tab.id, collectSuppRequestData, [suppNumber]);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось получить данные из СУПП.');
    }

    const requestText = processSuppRequestText(result.requestText || '');
    const infoText = processSuppInfoText(suppNumber, result.commentsText || '', result.discussionText || '');
    if (!requestText) throw new Error(`СУПП ${suppNumber}: текст заявки пустой.`);

    const bridgeResult = await postBridge(data.bridgeUrl, {
      action: 'saveSuppData',
      spreadsheetId,
      sheetName,
      row,
      suppNumber,
      requestText,
      infoText
    });

    if (bridgeResult && bridgeResult.success === false) {
      throw new Error(bridgeResult.error || 'Bridge не сохранил данные СУПП.');
    }

    return {
      row,
      suppNumber,
      requestTextLength: requestText.length,
      infoTextLength: infoText.length,
      bridge: bridgeResult
    };
  }

  async function collectItilRequestData(itilNumber, clipboardPrepared) {
    const number = String(itilNumber || '').trim();
    const canUseClipboardPaste = !!clipboardPrepared;
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

    function getSolutionText() {
      const explicit = document.querySelector('#form3_Плюс_РешениеОбращения_i0')
        || Array.from(document.querySelectorAll('textarea'))
          .find((textarea) => isVisible(textarea) && String(textarea.id || '').includes('РешениеОбращения'));

      if (explicit) return normalizeMultiline(explicit.value || explicit.textContent || '');

      const label = Array.from(document.querySelectorAll('div,span,label'))
        .find((element) => isVisible(element) && normalizeText(element.textContent) === 'Решение обращения:');
      if (!label) return '';

      const labelRect = label.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll('textarea,input'))
        .filter((element) => {
          if (!isVisible(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.top >= labelRect.top && Math.abs(rect.left - labelRect.left) < 40;
        });
      const field = candidates[0] || null;
      return field ? normalizeMultiline(field.value || field.textContent || '') : '';
    }

    function closeRequestTab() {
      const tab = findRequestTab();
      if (!tab) return null;
      return tab.querySelector('[id$="_cmd_close"],.openedClose,[title="Закрыть"]') || null;
    }

    try {
      await waitFor(() => document.querySelector('.toplineBox'), 90000, 'личный кабинет ITIL');

      let searchInput = findSearchInput();
      if (!searchInput) {
        const launcher = await waitFor(findServiceDeskLauncher, 30000, 'пункт Service Desk');
        await clickLikeUser(launcher);
        searchInput = await waitFor(findSearchInput, 60000, 'поле поиска Service Desk');
      }

      await clickLikeUser(searchInput);
      await clearSearchInputLikeUser(searchInput);
      await sleep(200);
      await pasteNumberLikeUser(searchInput, number);

      const numberCell = await waitFor(findGridNumberCell, 60000, `строка ITIL ${number}`);
      const gridCell = numberCell.closest('.gridBox') || numberCell;
      await doubleClickLikeUser(gridCell);

      await waitFor(findRequestTab, 60000, `вкладка заявки ${number}`);
      await waitFor(() => getIframeText(), 60000, `текст заявки ${number}`);

      const requestText = getIframeText();
      const solutionText = getSolutionText();
      const closeButton = closeRequestTab();
      if (closeButton) {
        await clickLikeUser(closeButton);
        await waitFor(() => !findRequestTab(), 15000, `закрытие вкладки заявки ${number}`);
      }

      return {
        success: true,
        requestText,
        solutionText
      };
    } catch (error) {
      return {
        success: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  async function collectSuppRequestData(suppNumber) {
    const number = String(suppNumber || '').trim();
    if (!number) return { success: false, error: 'Пустой номер СУПП.' };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalizeText = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizeMultiline = (value) => String(value || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();

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

    function hasSearchNotFoundMessage() {
      return getVisibleTextNodes().some((item) => {
        if (item.text.length > 1000) return false;
        return /не\s+найден|ничего\s+не\s+найден|нет\s+результатов/i.test(item.text);
      });
    }

    async function waitForSearchResultOrNotFound(timeoutMs) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const result = findSuppSearchResult();
        if (result) return { result };
        if (hasSearchNotFoundMessage()) return { notFound: true };
        await sleep(250);
      }
      return { timeout: true };
    }

    function findOpenedRequestCard() {
      const title = document.querySelector('#VW_page1headerTopLine_title');
      const titleText = normalizeText((title && (title.getAttribute('title') || title.textContent)) || '');
      if (titleText.includes(number)) return title;

      const numberInput = Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .find((input) => isVisible(input) && normalizeText(input.value || '') === number);
      if (numberInput) return numberInput;

      return null;
    }

    async function openSuppRequestFromSearch() {
      const input = await waitFor(findGlobalSearchInput, 90000, 'глобальное поле поиска СУПП');

      for (let attempt = 1; attempt <= 2; attempt++) {
        await clearGlobalSearchInput(input);
        await closeGlobalSearchPopup();
        await enterSearchTextLikeUser(input, number);

        const searchState = await waitForSearchResultOrNotFound(35000);
        if (searchState.result) {
          await clickLikeUser(searchState.result);
          await waitFor(findOpenedRequestCard, 60000, `карточка заявки ${number}`);
          return;
        }

        await clearGlobalSearchInput(input);
        await closeGlobalSearchPopup();

        if (attempt === 2) {
          throw new Error(searchState.notFound
            ? `Заявка ${number} не найдена в поиске СУПП.`
            : `Не дождался результата поиска СУПП ${number}.`);
        }
      }
    }

    function getInfoIframeText() {
      const explicit = document.querySelector('[id*="ИнформацияПоЗаявке"] iframe');
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
          // Нужный iframe СУПП доступен как same-origin; прочие можно пропустить.
        }
      });
      return bestText;
    }

    function extractCommentsText(infoText) {
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
      return normalizeMultiline(result);
    }

    async function openDiscussionPanel() {
      const button = document.querySelector('#VW_page1headerTopLine_cmdf_ECSFormButton')
        || Array.from(document.querySelectorAll('a,button,span,div'))
          .find((element) => isVisible(element) && normalizeText(element.textContent) === 'Обсуждение');

      if (isVisible(button)) {
        await clickLikeUser(button);
      }

      const startedAt = Date.now();
      while (Date.now() - startedAt < 12000) {
        const root = document.querySelector('#VW_page1ecsCell');
        if (root && (isVisible(root) || root.querySelector('.ecsChatItem'))) return root;
        await sleep(250);
      }
      return document.querySelector('#VW_page1ecsCell');
    }

    function getDiscussionText() {
      const root = document.querySelector('#VW_page1ecsCell') || document;
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
          body: normalizeMultiline((item.querySelector('.ecsChatText') || {}).innerText || ''),
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
          item.body.split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => lines.push(line));
        }
        if (item.time) lines.push(item.time);
      });

      return normalizeMultiline(lines.join('\n'));
    }

    async function closeOpenedRequestCard() {
      const closeButton = document.querySelector('#VW_page1headerTopLine_cmd_CloseButton');
      if (isVisible(closeButton)) {
        await clickLikeUser(closeButton);
        await waitFor(() => !document.querySelector('#VW_page1headerTopLine_cmd_CloseButton'), 15000, `закрытие заявки ${number}`);
      }

      const input = findGlobalSearchInput();
      if (input) {
        await clearGlobalSearchInput(input);
        await closeGlobalSearchPopup();
      }
    }

    try {
      await waitFor(findGlobalSearchInput, 90000, 'страница СУПП');
      await openSuppRequestFromSearch();

      const requestText = await waitFor(getInfoIframeText, 60000, `текст заявки СУПП ${number}`);
      const commentsText = extractCommentsText(requestText);

      await openDiscussionPanel();
      const discussionText = getDiscussionText();

      await closeOpenedRequestCard();

      return {
        success: true,
        requestText,
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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || (request.action !== SAVE_ACTION && request.action !== ITIL_FILL_ACTION && request.action !== SUPP_FILL_ACTION)) return false;

    if (!isAllowedSender(sender)) {
      sendResponse({ success: false, error: 'Запрос разрешён только со страницы настроенной Google-таблицы.' });
      return false;
    }

    const data = request.data || {};
    (async () => {
      try {
        if (request.action === SAVE_ACTION) {
          const result = await postBridge(data.bridgeUrl, data.payload || {});
          if (result && result.success === false) {
            sendResponse({ success: false, error: result.error || 'Bridge не сохранил значение.' });
            return;
          }
          sendResponse({ success: true, result });
          return;
        }

        const result = request.action === ITIL_FILL_ACTION
          ? await runItilFillRow(data)
          : await runSuppFillRow(data);
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
