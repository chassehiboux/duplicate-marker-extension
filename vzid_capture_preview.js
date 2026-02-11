(async () => {
  const claimTypeLabelEl = document.getElementById('claim-type-label');
  const claimTypeValueEl = document.getElementById('claim-type-value');
  const ipNumberEl = document.getElementById('ip-number');
  const fileNameEl = document.getElementById('file-name');
  const openPdfLink = document.getElementById('open-pdf-link');
  const downloadPdfLink = document.getElementById('download-pdf-link');
  const pdfFrame = document.getElementById('pdf-frame');
  const errorBox = document.getElementById('error-box');

  let objectUrl = null;

  function showError(message) {
    if (!errorBox) return;
    errorBox.style.display = 'block';
    errorBox.textContent = message;
  }

  function getToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || 'Ошибка обмена сообщениями'));
          return;
        }
        resolve(response);
      });
    });
  }

  function base64ToBlob(base64, mimeType) {
    const byteChars = atob(base64);
    const byteArrays = [];
    const sliceSize = 1024;

    for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
      const slice = byteChars.slice(offset, offset + sliceSize);
      const bytes = new Array(slice.length);
      for (let i = 0; i < slice.length; i += 1) {
        bytes[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(bytes));
    }

    return new Blob(byteArrays, { type: mimeType || 'application/pdf' });
  }

  try {
    const token = getToken();
    if (!token) {
      throw new Error('Не передан token в URL');
    }

    const response = await sendMessage({
      action: 'VZID_GET_CAPTURE_DATA',
      token
    });

    if (!response || !response.success || !response.data) {
      throw new Error((response && response.error) || 'Данные по token не найдены');
    }

    const data = response.data;
    claimTypeLabelEl.textContent = data.claimTypeLabel || '—';
    claimTypeValueEl.textContent = data.claimTypeValue || '—';
    ipNumberEl.textContent = data.ipNumber || 'Не найден';
    fileNameEl.textContent = data.fileName || 'document.pdf';

    const blob = base64ToBlob(data.fileBase64 || '', data.fileMimeType || 'application/pdf');
    objectUrl = URL.createObjectURL(blob);

    openPdfLink.href = objectUrl;
    downloadPdfLink.href = objectUrl;
    downloadPdfLink.download = data.fileName || 'document.pdf';
    pdfFrame.src = objectUrl;
  } catch (error) {
    showError(`Ошибка загрузки данных:\n${error.message || error}`);
    openPdfLink.setAttribute('disabled', 'disabled');
    downloadPdfLink.setAttribute('disabled', 'disabled');
  }

  window.addEventListener('beforeunload', () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }, { once: true });
})();
