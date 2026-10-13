/* Общий фоновой поиск новых StatusID для обеих сборок. */
(() => {
  'use strict';
  if (globalThis.__dupStatusLookupBackground) return;
  globalThis.__dupStatusLookupBackground = true;

  const CACHE_KEY = 'dup_status_names_cache_v1';
  const pending = new Map();
  let queue = Promise.resolve();

  function apiCall(target, method, argument) {
    return new Promise((resolve, reject) => {
      target[method](argument, (result) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  async function readSource(request, sender) {
    const results = await apiCall(chrome.scripting, 'executeScript', {
      target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] },
      func: (edocId) => {
        const info = globalThis.__dupIdCardServiceInfo?.getInfo(document, edocId);
        return info ? { edocId: info.edocId, debtId: info.debtId, statusId: info.statusId } : null;
      },
      args: [request.edocId]
    });
    const info = results?.[0]?.result;
    if (!info || info.edocId !== request.edocId || info.debtId !== request.debtId || info.statusId !== request.statusId) {
      throw new Error('Карточка изменилась или её служебные идентификаторы недоступны.');
    }
  }

  // Исполняется в MAIN, где доступны jqGrid и его штатное раскрытие БП.
  async function scanGlobalSearch(debtId, edocId, statusId, maxWaitMs) {
    const deadline = Date.now() + maxWaitMs;
    const pause = () => new Promise((resolve) => setTimeout(resolve, 200));
    const text = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const cell = (row, suffix) => text(row?.querySelector(`[aria-describedby$="_${suffix}"]`)?.textContent);
    let filtered = false;
    let expanded = false;
    let lastPageRequested = 0;

    while (Date.now() < deadline) {
      if (!/^\/bus\/slowsearch\/?$/i.test(location.pathname)) {
        throw new Error('Глобальный поиск недоступен: требуется вход или нет доступа.');
      }
      const grid = document.getElementById('list');
      const jq = window.jQuery;
      if (!grid?.p || !jq?.fn?.jqGrid) { await pause(); continue; }

      if (!filtered) {
        if (grid.p.jqXhr?.readyState > 0 && grid.p.jqXhr.readyState < 4) grid.p.jqXhr.abort();
        const filters = JSON.stringify({ groupOp: 'AND', rules: [{ field: 'DebtID', op: 'eq', data: debtId }] });
        jq(grid).jqGrid('setGridParam', {
          search: true, page: 1,
          postData: { ...grid.p.postData, _search: true, filters }
        }).trigger('reloadGrid', [{ page: 1 }]);
        filtered = true;
        await pause();
        continue;
      }
      if (grid.p.jqXhr?.readyState > 0 && grid.p.jqXhr.readyState < 4) { await pause(); continue; }
      const row = Array.from(grid.querySelectorAll('tbody > tr.jqgrow'))
        .find((item) => cell(item, 'DebtID') === debtId);
      if (!row) { await pause(); continue; }
      if (!expanded) {
        jq(grid).jqGrid('expandSubGridRow', row.id);
        expanded = true;
      }
      const subRow = row.nextElementSibling;
      const subGrid = subRow?.classList.contains('ui-subgrid')
        ? subRow.querySelector('table.ui-jqgrid-btable') : null;
      if (!subGrid?.p || (subGrid.p.jqXhr?.readyState > 0 && subGrid.p.jqXhr.readyState < 4)) {
        await pause(); continue;
      }
      const matches = Array.from(subGrid.querySelectorAll('tbody > tr.jqgrow'))
        .filter((item) => cell(item, 'EDocID') === edocId && cell(item, 'DebtID') === debtId);
      if (matches.length === 1) {
        const statusName = cell(matches[0], 'StatusName');
        if (statusName && !/^(?:null|\(null\)|нет данных|-)$/i.test(statusName)) {
          // Карточка могла устареть ещё до открытия фонового поиска.
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          try {
            const response = await fetch(`/ovzid/fullcard/${edocId}`, {
              credentials: 'same-origin', cache: 'no-store', signal: controller.signal
            });
            if (!response.ok) throw new Error('Не удалось подтвердить текущий StatusID карточки.');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const heading = Array.from(doc.querySelectorAll('.panel-heading'))
              .find((item) => text(item.textContent) === 'Служебная информация');
            const sourceText = heading?.parentElement?.querySelector('.panel-body')?.textContent || '';
            if (sourceText.match(/\bEDocID:\s*(\d+)\b/i)?.[1] !== edocId ||
                sourceText.match(/\bDebtID:\s*(\d+)\b/i)?.[1] !== debtId ||
                sourceText.match(/\bStatusID:\s*(\d+)\b/i)?.[1] !== statusId) {
              throw new Error('StatusID карточки изменился во время поиска. Название не сохранено.');
            }
            return statusName;
          } finally { clearTimeout(timer); }
        }
      }
      const page = Number(subGrid.p.page || 1);
      const lastPage = Number(subGrid.p.lastpage || 0);
      if (page < lastPage && lastPageRequested < page + 1) {
        lastPageRequested = page + 1;
        jq(subGrid).jqGrid('setGridParam', { page: page + 1 }).trigger('reloadGrid', [{ page: page + 1 }]);
      }
      await pause();
    }
    throw new Error('Не удалось найти «Статус дела» нужного EdocID в глобальном поиске за отведённое время.');
  }

  async function waitForTab(tabId) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const tab = await apiCall(chrome.tabs, 'get', tabId);
      if (tab.status === 'complete') return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Истекло время загрузки фоновой вкладки глобального поиска.');
  }

  async function lookup(request, sender, origin) {
    const hostname = new URL(origin).hostname;
    const stored = await apiCall(chrome.storage.local, 'get', CACHE_KEY);
    const cached = stored[CACHE_KEY]?.[hostname]?.[request.statusId];
    if (typeof cached === 'string' && cached.trim()) return cached.trim();
    await readSource(request, sender);

    let workerTabId = null;
    try {
      const createOptions = { url: `${origin}/bus/slowsearch?dup_status_lookup=1`, active: false, openerTabId: sender.tab.id };
      if (Number.isInteger(sender.tab.windowId)) createOptions.windowId = sender.tab.windowId;
      // Firefox: поиск проходит в том же контейнере и с той же сессией.
      if (sender.tab.cookieStoreId) createOptions.cookieStoreId = sender.tab.cookieStoreId;
      const tab = await apiCall(chrome.tabs, 'create', createOptions);
      workerTabId = tab.id;
      await waitForTab(workerTabId);
      const results = await apiCall(chrome.scripting, 'executeScript', {
        target: { tabId: workerTabId }, world: 'MAIN',
        func: scanGlobalSearch, args: [request.debtId, request.edocId, request.statusId, 35000]
      });
      const statusName = results?.[0]?.result;
      if (typeof statusName !== 'string' || !statusName.trim() || statusName.length > 1000) {
        throw new Error('Глобальный поиск не вернул название статуса.');
      }
      // Нельзя сопоставлять старому коду имя, найденное после перемещения ИД.
      await readSource(request, sender);
      const latest = await apiCall(chrome.storage.local, 'get', CACHE_KEY);
      const cache = latest[CACHE_KEY] && typeof latest[CACHE_KEY] === 'object' ? latest[CACHE_KEY] : {};
      if (!globalThis.__dupSupabaseSync?.syncSet) {
        throw new Error('Модуль сохранения и Supabase-синхронизации названий не загружен.');
      }
      await globalThis.__dupSupabaseSync.syncSet({
        [CACHE_KEY]: { ...cache, [hostname]: { ...cache[hostname], [request.statusId]: statusName.trim() } }
      }, { reason: 'status-name-discovered' });
      return statusName.trim();
    } finally {
      if (Number.isInteger(workerTabId)) {
        try { await apiCall(chrome.tabs, 'remove', workerTabId); }
        catch (error) { console.warn('[ТМ] Не удалось закрыть служебную вкладку:', error.message); }
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action !== 'ID_CARD_LOOKUP_STATUS_NAME') return false;
    let origin;
    const request = message.data || {};
    try {
      const source = new URL(sender.url || '');
      if (!sender.tab || !/^\/ovzid\/fullcard\/\d+(?:\/.*)?$/i.test(source.pathname) ||
          ![request.edocId, request.debtId, request.statusId].every((id) => /^\d+$/.test(String(id || ''))) ||
          source.pathname.split('/')[3] !== request.edocId ||
          !/(?:^|\.)pyramid\.vostok-electra\.ru$|(?:^|\.)pyramid\.nesko-nv\.ru$|(?:^|\.)pyramid-vostok\.electra\.ru$/i.test(source.hostname)) {
        throw new Error('Некорректный запрос названия статуса из карточки ИД.');
      }
      origin = source.origin;
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return false;
    }
    const key = `${origin}:${request.statusId}`;
    if (!pending.has(key)) {
      const job = queue.catch(() => {}).then(() => lookup(request, sender, origin));
      pending.set(key, job);
      queue = job.catch(() => {});
      job.finally(() => pending.delete(key)).catch(() => {});
    }
    pending.get(key).then(
      (statusName) => sendResponse({ success: true, statusName }),
      (error) => sendResponse({ success: false, error: error.message })
    );
    return true;
  });
})();
