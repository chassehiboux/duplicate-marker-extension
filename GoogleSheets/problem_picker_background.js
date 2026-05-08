(function() {
  'use strict';

  const SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
  const SAVE_ACTION = 'GOOGLE_SHEETS_PROBLEM_PICKER_SAVE';

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || request.action !== SAVE_ACTION) return false;

    if (!isAllowedSender(sender)) {
      sendResponse({ success: false, error: 'Запрос разрешён только со страницы настроенной Google-таблицы.' });
      return false;
    }

    const data = request.data || {};
    (async () => {
      try {
        const result = await postBridge(data.bridgeUrl, data.payload || {});
        if (result && result.success === false) {
          sendResponse({ success: false, error: result.error || 'Bridge не сохранил значение.' });
          return;
        }
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({
          success: false,
          error: error && error.message ? error.message : 'Ошибка сохранения через bridge.'
        });
      }
    })();

    return true;
  });
})();
