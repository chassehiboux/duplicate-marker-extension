(() => {
  'use strict';

  const params = new URLSearchParams(window.location.hash.slice(1));
  const sourceUrl = String(params.get('url') || '').trim();
  const fileName = String(params.get('name') || 'Документ.pdf').trim() || 'Документ.pdf';
  const frame = document.querySelector('[data-role="pdf-frame"]');
  const status = document.querySelector('[data-role="status"]');
  const spinner = document.querySelector('[data-role="spinner"]');
  const nameHost = document.querySelector('[data-role="file-name"]');
  const message = document.querySelector('[data-role="message"]');
  const retryButton = document.querySelector('[data-action="retry"]');
  let objectUrl = '';

  if (nameHost) nameHost.textContent = fileName;
  document.title = fileName + ' · Проверка списания';

  function setLoading() {
    if (status instanceof HTMLElement) status.hidden = false;
    if (spinner instanceof HTMLElement) spinner.hidden = false;
    if (retryButton instanceof HTMLButtonElement) retryButton.hidden = true;
    if (message) message.textContent = 'Получаю документ из WSS…';
  }

  function setError(errorText) {
    if (status instanceof HTMLElement) status.hidden = false;
    if (spinner instanceof HTMLElement) spinner.hidden = true;
    if (retryButton instanceof HTMLButtonElement) retryButton.hidden = false;
    if (message) message.textContent = errorText;
  }

  async function loadPdf() {
    if (!/^https?:\/\//i.test(sourceUrl)) {
      setError('Не удалось определить адрес PDF-вложения.');
      return;
    }
    setLoading();
    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        redirect: 'follow'
      });
      if (!response.ok) throw new Error('WSS вернул ошибку ' + response.status + '.');
      const bytes = await response.arrayBuffer();
      const header = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
      if (!header.includes('%PDF-')) throw new Error('WSS вернул не PDF-файл. Возможно, истекла авторизация.');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      if (!(frame instanceof HTMLIFrameElement)) throw new Error('Не удалось создать область просмотра PDF.');
      frame.src = objectUrl;
      frame.title = fileName;
      frame.hidden = false;
      if (status instanceof HTMLElement) status.hidden = true;
    } catch (error) {
      setError(error && error.message ? error.message : 'Не удалось открыть PDF-вложение.');
    }
  }

  retryButton?.addEventListener('click', () => void loadPdf());
  window.addEventListener('beforeunload', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
  void loadPdf();
})();
