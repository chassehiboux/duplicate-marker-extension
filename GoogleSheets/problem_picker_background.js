(function() {
  'use strict';

  const SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
  const SAVE_ACTION = 'GOOGLE_SHEETS_PROBLEM_PICKER_SAVE';
  const ITIL_FILL_ACTION = 'GOOGLE_SHEETS_ITIL_FILL_ROW';
  const ITIL_URL = 'http://tmn-vpitil1c01/ITIL/ru_RU/';

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
      await tabsUpdate(existing.id, { active: true });
      return existing;
    }

    const created = await tabsCreate({ url: ITIL_URL, active: true });
    if (!created || !Number.isInteger(created.id)) {
      throw new Error('Не удалось открыть вкладку ITIL.');
    }
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
    const result = await executeInTab(tab.id, collectItilRequestData, [itilNumber]);
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

  async function collectItilRequestData(itilNumber) {
    const number = String(itilNumber || '').trim();
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

    function getElementPoint(element) {
      const rect = element.getBoundingClientRect();
      return {
        clientX: rect.left + Math.max(1, Math.min(rect.width - 1, rect.width / 2)),
        clientY: rect.top + Math.max(1, Math.min(rect.height - 1, rect.height / 2))
      };
    }

    function dispatchMouseLike(element, type, detail, options) {
      const eventOptions = options || {};
      const point = getElementPoint(element);
      const button = Number.isInteger(eventOptions.button) ? eventOptions.button : 0;
      const buttons = Number.isInteger(eventOptions.buttons)
        ? eventOptions.buttons
        : (type === 'mouseup' || type === 'click' || type === 'dblclick' || type === 'contextmenu' ? 0 : 1);

      element.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: detail || 1,
        clientX: point.clientX,
        clientY: point.clientY,
        screenX: window.screenX + point.clientX,
        screenY: window.screenY + point.clientY,
        button,
        buttons
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

    function findServiceDeskSearchInput() {
      return Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .find((input) => isVisible(input) && String(input.id || '').includes('ДополнениеСтрокаПоиска')) || null;
    }

    function findFindDialog() {
      return Array.from(document.querySelectorAll('.cloud.panelsBorder,.cloud,.panelsBorder'))
        .find((element) => {
          if (!isVisible(element)) return false;
          const title = element.querySelector('.toplineBoxTitle,[id$="headerTopLine_title"]');
          const titleBox = element.querySelector('.toplineBox[data-title]');
          const titleText = title
            ? normalizeText(title.getAttribute('title') || title.textContent)
            : '';
          const dataTitle = titleBox ? normalizeText(titleBox.getAttribute('data-title')) : '';
          return titleText === 'Найти' || dataTitle === 'Найти';
        }) || null;
    }

    function findFindDialogInput(dialog, partName) {
      return Array.from(dialog.querySelectorAll('input[type="text"],input:not([type])'))
        .find((input) => isVisible(input) && String(input.id || '').includes(partName)) || null;
    }

    function findFindDialogButton(dialog) {
      const byId = Array.from(dialog.querySelectorAll('a[id$="_Find"],.pressCommand'))
        .find((element) => isVisible(element) && normalizeText(element.textContent).includes('Найти'));
      if (byId) return byId;

      return Array.from(dialog.querySelectorAll('a,span,div'))
        .find((element) => isVisible(element) && normalizeText(element.textContent) === 'Найти') || null;
    }

    function setInputValueLikeUser(input, value, inputType) {
      input.focus();
      if (typeof input.select === 'function') input.select();

      const text = String(value || '');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (setter && typeof setter.set === 'function') {
        setter.set.call(input, text);
      } else {
        input.value = text;
      }

      input.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: inputType || 'insertText',
        data: text
      }));
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: inputType || 'insertText',
        data: text
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function dispatchAltF(target) {
      const options = {
        bubbles: true,
        cancelable: true,
        key: 'f',
        code: 'KeyF',
        altKey: true,
        keyCode: 70,
        which: 70
      };

      const receivers = [target, document.activeElement, document.body, document, window]
        .filter((item, index, list) => item && list.indexOf(item) === index);
      receivers.forEach((receiver) => {
        receiver.dispatchEvent(new KeyboardEvent('keydown', options));
        receiver.dispatchEvent(new KeyboardEvent('keypress', options));
        receiver.dispatchEvent(new KeyboardEvent('keyup', options));
      });
    }

    async function openFindDialog() {
      let dialog = findFindDialog();
      if (dialog) return dialog;

      const searchInput = findServiceDeskSearchInput();
      if (searchInput) await clickLikeUser(searchInput);
      dispatchAltF(searchInput || document.body);
      dialog = await waitFor(findFindDialog, 5000, 'окно «Найти» после Alt+F');
      await sleep(250);
      return dialog;
    }

    async function selectFindFieldNumber(dialog) {
      const fieldInput = findFindDialogInput(dialog, 'FieldSelector');
      if (!fieldInput) throw new Error('В окне «Найти» не найдено поле «Где искать».');

      if (normalizeText(fieldInput.value) === 'Номер') return;

      setInputValueLikeUser(fieldInput, 'Номер', 'insertText');
      fieldInput.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13
      }));
      fieldInput.dispatchEvent(new KeyboardEvent('keyup', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13
      }));
      await sleep(350);
    }

    async function findByNumberInDialog(value) {
      const dialog = await openFindDialog();
      await selectFindFieldNumber(dialog);

      const patternInput = findFindDialogInput(dialog, 'Pattern');
      if (!patternInput) throw new Error('В окне «Найти» не найдено поле «Что искать».');

      setInputValueLikeUser(patternInput, value, 'insertText');
      await sleep(150);

      const findButton = findFindDialogButton(dialog);
      if (!findButton) throw new Error('В окне «Найти» не найдена кнопка «Найти».');
      await clickLikeUser(findButton);
      await sleep(500);
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

      let searchInput = findServiceDeskSearchInput();
      if (!searchInput) {
        const launcher = await waitFor(findServiceDeskLauncher, 30000, 'пункт Service Desk');
        await clickLikeUser(launcher);
        searchInput = await waitFor(findServiceDeskSearchInput, 60000, 'поле поиска Service Desk');
      }

      await findByNumberInDialog(number);

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || (request.action !== SAVE_ACTION && request.action !== ITIL_FILL_ACTION)) return false;

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

        const result = await runItilFillRow(data);
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
