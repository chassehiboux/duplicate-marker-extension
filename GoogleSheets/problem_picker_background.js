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

  const bridgePostQueue = [];
  let bridgePostQueueIsRunning = false;
  let bridgePostQueueDrainTimer = null;
  let bridgePostQueueNextId = 1;
  const BRIDGE_POST_BATCH_MAX_ITEMS = 10;
  const BRIDGE_POST_BATCH_DELAY_MS = 150;
  const BRIDGE_POST_BATCH_ACTIONS = new Set(['saveItilData', 'saveSuppData']);

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

      scheduleBridgePostQueueDrain();
    });
  }

  function scheduleBridgePostQueueDrain() {
    if (bridgePostQueueIsRunning || bridgePostQueueDrainTimer) return;

    bridgePostQueueDrainTimer = setTimeout(() => {
      bridgePostQueueDrainTimer = null;
      void drainBridgePostQueue();
    }, BRIDGE_POST_BATCH_DELAY_MS);
  }

  async function drainBridgePostQueue() {
    if (bridgePostQueueIsRunning) return;

    if (bridgePostQueueDrainTimer) {
      clearTimeout(bridgePostQueueDrainTimer);
      bridgePostQueueDrainTimer = null;
    }

    bridgePostQueueIsRunning = true;
    try {
      while (bridgePostQueue.length) {
        const item = bridgePostQueue.shift();
        if (!item) continue;
        const batch = takeBridgePostBatch(item);

        try {
          await postBridgeQueueBatch(batch);
        } catch (error) {
          batch.forEach((batchItem) => {
            batchItem.reject(error);
          });
        }
      }
    } finally {
      bridgePostQueueIsRunning = false;
      if (bridgePostQueue.length) scheduleBridgePostQueueDrain();
    }
  }

  function getBridgePostBatchKey(item) {
    const payload = item && item.payload ? item.payload : {};
    const action = String(payload.action || '');

    if (!BRIDGE_POST_BATCH_ACTIONS.has(action)) return '';

    const spreadsheetId = String(payload.spreadsheetId || '').trim();
    const sheetName = String(payload.sheetName || '').trim();

    if (!spreadsheetId || !sheetName) return '';

    return [
      item.url,
      spreadsheetId,
      sheetName
    ].join('\u0001');
  }

  function takeBridgePostBatch(firstItem) {
    const batch = [firstItem];
    const key = getBridgePostBatchKey(firstItem);

    if (!key) return batch;

    for (let index = 0; index < bridgePostQueue.length && batch.length < BRIDGE_POST_BATCH_MAX_ITEMS;) {
      const item = bridgePostQueue[index];
      if (getBridgePostBatchKey(item) === key) {
        batch.push(item);
        bridgePostQueue.splice(index, 1);
      } else {
        index += 1;
      }
    }

    return batch;
  }

  function resolveBridgeQueueItem(item, result) {
    item.resolve({
      queueId: item.id,
      result
    });
  }

  function rejectBridgeQueueItem(item, error) {
    item.reject(error);
  }

  async function postBridgeQueueBatch(batch) {
    if (!Array.isArray(batch) || !batch.length) return;

    if (batch.length === 1 || !getBridgePostBatchKey(batch[0])) {
      await postBridgeSingleQueueItem(batch[0]);
      return;
    }

    const firstPayload = batch[0].payload || {};
    const batchPayload = {
      action: 'saveFillDataBatch',
      spreadsheetId: firstPayload.spreadsheetId,
      sheetName: firstPayload.sheetName,
      sourceAction: firstPayload.action,
      items: batch.map((item) => ({
        ...item.payload,
        clientQueueId: item.id
      }))
    };

    const response = await postBridge(batch[0].url, batchPayload);
    if (response && response.success === false) {
      const errorText = response.error || 'Bridge не сохранил batch.';
      if (/Неизвестное действие bridge/i.test(errorText)) {
        await postBridgeQueueItemsIndividually(batch);
        return;
      }
      throw new Error(errorText);
    }

    const batchResult = response && response.result ? response.result : {};
    const itemResults = Array.isArray(batchResult.items) ? batchResult.items : [];
    const resultByQueueId = new Map();
    itemResults.forEach((itemResult) => {
      resultByQueueId.set(Number(itemResult && itemResult.clientQueueId), itemResult);
    });

    batch.forEach((item) => {
      const itemResult = resultByQueueId.get(item.id);
      if (!itemResult) {
        rejectBridgeQueueItem(item, new Error('Bridge не вернул результат batch-строки.'));
        return;
      }

      if (itemResult.success === false) {
        rejectBridgeQueueItem(item, new Error(itemResult.error || 'Bridge не сохранил batch-строку.'));
        return;
      }

      resolveBridgeQueueItem(item, {
        success: true,
        result: itemResult.result || {},
        batch: {
          total: Number(batchResult.total || batch.length),
          successCount: Number(batchResult.successCount || 0),
          failedCount: Number(batchResult.failedCount || 0)
        }
      });
    });
  }

  async function postBridgeSingleQueueItem(item) {
    const result = await postBridge(item.url, item.payload);
    if (result && result.success === false) {
      throw new Error(result.error || 'Bridge не сохранил значение.');
    }

    resolveBridgeQueueItem(item, result);
  }

  async function postBridgeQueueItemsIndividually(batch) {
    for (const item of batch) {
      try {
        await postBridgeSingleQueueItem(item);
      } catch (error) {
        rejectBridgeQueueItem(item, error);
      }
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

  async function activateTabForInteractiveAutomation(tab, urlPrefix, label) {
    const tabId = tab && Number.isInteger(tab.id) ? tab.id : null;
    if (!Number.isInteger(tabId)) {
      throw new Error(`Не удалось активировать вкладку ${label || ''}: нет tabId.`);
    }

    let currentTab = await tabsGet(tabId).catch(() => tab);

    if (currentTab && currentTab.status !== 'complete') {
      currentTab = await waitForTabReady(tabId, urlPrefix);
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
      return waitForTabReady(tabId, urlPrefix);
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
      return activateTabForInteractiveAutomation(existing, ITIL_URL, 'ITIL');
    }

    const created = await tabsCreate({ url: ITIL_URL, active: true });
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть вкладку ITIL.');
    }

    await waitForTabReady(created.id, ITIL_URL);
    return activateTabForInteractiveAutomation(created, ITIL_URL, 'ITIL');
  }

  async function getOrCreateSuppTab() {
    const tabs = await tabsQuery({});
    const existing = tabs.find((tab) => String(tab.url || '').startsWith(SUPP_URL));

    if (existing && Number.isInteger(existing.id)) {
      if (existing.status !== 'complete') await waitForTabReady(existing.id, SUPP_URL);
      return activateTabForInteractiveAutomation(existing, SUPP_URL, 'СУПП');
    }

    const created = await tabsCreate({ url: SUPP_URL, active: true });
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть вкладку СУПП.');
    }

    await waitForTabReady(created.id, SUPP_URL);
    return activateTabForInteractiveAutomation(created, SUPP_URL, 'СУПП');
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
    normalizeBridgeUrl(data.bridgeUrl);

    const tab = await getOrCreateItilTab();
    const clipboardPrepared = await writeClipboardText(itilNumber);
    const result = await executeInTab(tab.id, collectItilRequestData, [itilNumber, clipboardPrepared]);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось получить данные из ITIL.');
    }

    const requestText = processRequestText(result.requestText || '');
    const solutionText = String(result.solutionText || '').trim();
    if (!requestText) throw new Error(`ITIL ${itilNumber}: текст заявки пустой.`);

    const bridgePayload = {
      action: 'saveItilData',
      spreadsheetId,
      sheetName,
      row,
      itilNumber,
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
    normalizeBridgeUrl(data.bridgeUrl);

    const tab = await getOrCreateSuppTab();
    const result = await executeInTab(tab.id, collectSuppRequestData, [suppNumber]);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Не удалось получить данные из СУПП.');
    }

    const requestText = processSuppRequestText(result.requestText || '');
    const infoText = processSuppInfoText(suppNumber, result.commentsText || '', result.discussionText || '');
    if (!requestText) throw new Error(`СУПП ${suppNumber}: текст заявки пустой.`);

    const bridgePayload = {
      action: 'saveSuppData',
      spreadsheetId,
      sheetName,
      row,
      suppNumber,
      requestText,
      infoText
    };

    return {
      row,
      suppNumber,
      requestTextLength: requestText.length,
      infoTextLength: infoText.length,
      bridgePayload
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
        if (await waitForSuppCardOpened(8000)) return true;
      } catch (error) {
        // Пробуем следующие способы ниже.
      }

      try {
        await clickLikeUser(row);
        if (await waitForSuppCardOpened(8000)) return true;
      } catch (error) {
        // Пробуем следующие способы ниже.
      }

      try {
        dispatchMouseLike(row, 'mousedown', 1);
        dispatchMouseLike(row, 'mouseup', 1);
        dispatchMouseLike(row, 'dblclick', 2);
        if (await waitForSuppCardOpened(8000)) return true;
      } catch (error) {
        // Пробуем Enter ниже.
      }

      const enterTarget = isVisible(input) ? input : (document.activeElement || row);
      try {
        if (typeof row.focus === 'function') row.focus();
        enterTarget.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
        enterTarget.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
        if (await waitForSuppCardOpened(8000)) return true;
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
      const input = await waitFor(findGlobalSearchInput, 90000, 'глобальное поле поиска СУПП');

      for (let attempt = 1; attempt <= 2; attempt++) {
        await clearGlobalSearchInput(input);
        await closeGlobalSearchPopup();
        await enterSearchTextLikeUser(input, number);

        // Даём СУПП время не просто показать dropdown, а навесить обработчики.
        await sleep(700);

        const searchState = await waitForSearchResultOrNotFound(35000);

        if (searchState.result) {
          let clicked = false;

          for (let clickAttempt = 1; clickAttempt <= 3; clickAttempt++) {
            const currentResult = findSuppSearchResult() || searchState.result;

            if (currentResult && isVisible(currentResult)) {
              await clickLikeUser(currentResult);
              clicked = true;
            }

            const openedQuickly = await waitForSuppCardOpened(7000);
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

            const openedByEnter = await waitForSuppCardOpened(7000);
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

  async function waitForDiscussionTextStabilized(timeoutMs) {
    const startedAt = Date.now();
    let lastText = '';
    let stableSince = 0;

    while (Date.now() - startedAt < timeoutMs) {
      const root = getDiscussionRoot();
      const text = root ? getDiscussionText() : '';

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
    if (await waitForSuppCardClosed(2500, prefix)) return true;

    try {
      closeButton.click();
    } catch (error) {
      // Игнорируем и пробуем следующие fallback ниже.
    }
    if (await waitForSuppCardClosed(2500, prefix)) return true;

    const svg = closeButton.querySelector('svg,use');
    if (svg) {
      try {
        svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch (error) {
        // SVG fallback не критичен.
      }
    }
    if (await waitForSuppCardClosed(2500, prefix)) return true;

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape', code: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Escape', code: 'Escape' }));
    return waitForSuppCardClosed(2500, prefix);
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

      if (await waitForSuppCardClosed(3000, targetPrefix)) break;
      await sleep(400);
    }

    await waitForSuppCardClosed(5000, targetPrefix);

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
      await waitFor(findGlobalSearchInput, 90000, 'страница СУПП');
      await openSuppRequestFromSearch();

      const requestText = await waitFor(getInfoIframeText, 60000, `текст заявки СУПП ${number}`);
      const commentsText = extractCommentsText(requestText);

      await openDiscussionPanel();
      const discussionText = await waitForDiscussionTextStabilized(2000);

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
          const queued = await enqueueBridgePost(data.bridgeUrl, data.payload || {});
          sendResponse({ success: true, result: queued.result, bridgeQueueId: queued.queueId });
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
