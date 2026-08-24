(() => {
  'use strict';

  const params = new URLSearchParams(window.location.hash.slice(1));
  const sourceUrl = String(params.get('url') || '').trim();
  const fileName = String(params.get('name') || 'Документ.pdf').trim() || 'Документ.pdf';
  const mode = params.get('mode') === 'archive' ? 'archive' : 'pdf';
  const documentCacheKey = String(params.get('cacheKey') || '').trim();
  const archiveCacheKey = `${documentCacheKey}|${fileName}`;
  if (mode === 'archive') document.documentElement.classList.add('archive-progress-in-overlay');
  const frame = document.querySelector('[data-role="pdf-frame"]');
  const status = document.querySelector('[data-role="status"]');
  const spinner = document.querySelector('[data-role="spinner"]');
  const nameHost = document.querySelector('[data-role="file-name"]');
  const message = document.querySelector('[data-role="message"]');
  const retryButton = document.querySelector('[data-action="retry"]');
  const archivePdfsHost = document.querySelector('[data-role="archive-pdfs"]');
  const progress = document.querySelector('[data-role="progress"]');
  const progressTrack = document.querySelector('.pdf-progress-track');
  const progressBar = document.querySelector('[data-role="progress-bar"]');
  const progressText = document.querySelector('[data-role="progress-text"]');
  const objectUrls = new Set();
  const archiveSourceLimit = 200 * 1024 * 1024;
  const archivePdfCountLimit = 100;
  const archivePdfSizeLimit = 500 * 1024 * 1024;
  const cp437ExtendedCharacters = String.fromCodePoint(
    199, 252, 233, 226, 228, 224, 229, 231, 234, 235, 232, 239, 238, 236, 196, 197,
    201, 230, 198, 244, 246, 242, 251, 249, 255, 214, 220, 162, 163, 165, 8359, 402,
    225, 237, 243, 250, 241, 209, 170, 186, 191, 8976, 172, 189, 188, 161, 171, 187,
    9617, 9618, 9619, 9474, 9508, 193, 194, 192, 169, 9571, 9553, 9559, 9565, 162, 165, 9488,
    9492, 9524, 9516, 9500, 9472, 9532, 227, 195, 9562, 9556, 9577, 9574, 9568, 9552, 9580, 164,
    240, 208, 202, 203, 200, 305, 205, 206, 207, 9496, 9484, 9608, 9604, 166, 204, 9600,
    945, 223, 915, 960, 931, 963, 181, 964, 934, 920, 937, 948, 8734, 966, 949, 8745,
    8801, 177, 8805, 8804, 8992, 8993, 247, 8776, 176, 8729, 183, 8730, 8319, 178, 9632, 160
  );
  const cp437ByteByCharacter = new Map(Array.from(cp437ExtendedCharacters, (character, index) => [character, index + 128]));

  if (nameHost) nameHost.textContent = fileName;
  document.title = fileName + ' · Проверка списания';

  function setLoading() {
    if (status instanceof HTMLElement) status.hidden = false;
    if (spinner instanceof HTMLElement) spinner.hidden = false;
    if (retryButton instanceof HTMLButtonElement) retryButton.hidden = true;
    if (message) message.textContent = mode === 'archive' ? 'Получаю архив из WSS…' : 'Получаю документ из WSS…';
    setProgress(0, 'Подключение к WSS…', true);
  }

  function setError(errorText) {
    if (status instanceof HTMLElement) status.hidden = false;
    if (spinner instanceof HTMLElement) spinner.hidden = true;
    if (retryButton instanceof HTMLButtonElement) retryButton.hidden = false;
    if (message) message.textContent = errorText;
    if (progress instanceof HTMLElement) progress.hidden = true;
  }

  function formatMegabytes(bytes) {
    return `${(Math.max(0, Number(bytes) || 0) / (1024 * 1024)).toFixed(1)} МБ`;
  }

  function scoreDecodedFileName(value) {
    const text = String(value || '');
    const cyrillicCount = (text.match(/[А-ЯЁа-яё]/g) || []).length;
    const suspiciousCount = (text.match(/[Α-ω─-▟ -¿]/g) || []).length;
    const replacementCount = (text.match(/�/g) || []).length;
    return cyrillicCount * 3 - suspiciousCount * 2 - replacementCount * 8;
  }

  function repairArchiveFileName(value) {
    const original = String(value || '');
    const bytes = [];
    for (const character of original) {
      const codePoint = character.codePointAt(0);
      if (codePoint <= 127) {
        bytes.push(codePoint);
        continue;
      }
      const byte = cp437ByteByCharacter.get(character);
      if (byte === undefined) return original;
      bytes.push(byte);
    }
    const originalScore = scoreDecodedFileName(original);
    const candidates = ['ibm866', 'windows-1251'].map((encoding) => {
      try {
        return new TextDecoder(encoding, { fatal: true }).decode(Uint8Array.from(bytes));
      } catch (error) {
        return '';
      }
    }).filter(Boolean);
    const best = candidates.reduce((current, candidate) => (
      scoreDecodedFileName(candidate) > scoreDecodedFileName(current) ? candidate : current
    ), original);
    return scoreDecodedFileName(best) >= originalScore + 4 && /[А-ЯЁа-яё]{2}/.test(best) ? best : original;
  }

  function decodeCp437(bytes) {
    return Array.from(bytes, (byte) => byte < 128 ? String.fromCharCode(byte) : cp437ExtendedCharacters[byte - 128]).join('');
  }

  function decodeLegacyZipName(bytes) {
    const cp437Name = decodeCp437(bytes);
    const candidates = ['ibm866', 'windows-1251'].map((encoding) => {
      try {
        return new TextDecoder(encoding, { fatal: true }).decode(bytes);
      } catch (error) {
        return '';
      }
    }).filter(Boolean);
    const best = candidates.reduce((current, candidate) => (
      scoreDecodedFileName(candidate) > scoreDecodedFileName(current) ? candidate : current
    ), cp437Name);
    return scoreDecodedFileName(best) >= scoreDecodedFileName(cp437Name) + 4 && /[А-ЯЁа-яё]{2}/.test(best)
      ? best
      : cp437Name;
  }

  function readZipEntryNames(bytes) {
    const data = new Uint8Array(bytes);
    const view = new DataView(bytes);
    let endOffset = -1;
    const minimumOffset = Math.max(0, data.length - 65557);
    for (let offset = data.length - 22; offset >= minimumOffset; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    if (endOffset < 0) return [];
    const entryCount = view.getUint16(endOffset + 10, true);
    let offset = view.getUint32(endOffset + 16, true);
    const names = [];
    for (let entryIndex = 0; entryIndex < entryCount && offset + 46 <= data.length; entryIndex += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) return [];
      const flags = view.getUint16(offset + 8, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const fileNameBytes = data.slice(offset + 46, offset + 46 + fileNameLength);
      const extraBytes = data.slice(offset + 46 + fileNameLength, offset + 46 + fileNameLength + extraLength);
      let fileName = '';
      if ((flags & 0x0800) !== 0) {
        try {
          fileName = new TextDecoder('utf-8', { fatal: true }).decode(fileNameBytes);
        } catch (error) {
          fileName = '';
        }
      }
      for (let extraOffset = 0; !fileName && extraOffset + 4 <= extraBytes.length;) {
        const extraView = new DataView(extraBytes.buffer, extraBytes.byteOffset + extraOffset);
        const fieldId = extraView.getUint16(0, true);
        const fieldLength = extraView.getUint16(2, true);
        if (extraOffset + 4 + fieldLength > extraBytes.length) break;
        if (fieldId === 0x7075 && fieldLength > 5) {
          try {
            fileName = new TextDecoder('utf-8', { fatal: true }).decode(extraBytes.slice(extraOffset + 9, extraOffset + 4 + fieldLength));
          } catch (error) {
            fileName = '';
          }
        }
        extraOffset += 4 + fieldLength;
      }
      if (!fileName) fileName = decodeLegacyZipName(fileNameBytes);
      if (fileName && !/[\\/]$/.test(fileName)) names.push(fileName.replace(/\\/g, '/'));
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return names;
  }

  function setProgress(percent, text, indeterminate = false) {
    const normalizedPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    if (progress instanceof HTMLElement) {
      progress.hidden = false;
      progress.dataset.indeterminate = indeterminate ? 'true' : 'false';
    }
    if (progressBar instanceof HTMLElement && !indeterminate) progressBar.style.width = `${normalizedPercent}%`;
    if (progressTrack instanceof HTMLElement) {
      if (indeterminate) progressTrack.removeAttribute('aria-valuenow');
      else progressTrack.setAttribute('aria-valuenow', String(Math.round(normalizedPercent)));
      progressTrack.setAttribute('aria-valuetext', String(text || ''));
    }
    if (progressText instanceof HTMLElement) progressText.textContent = String(text || '');
    if (mode === 'archive') {
      const progressState = {
        fileName,
        percent: normalizedPercent,
        text: String(text || ''),
        indeterminate,
        state: normalizedPercent >= 100 ? 'done' : 'working'
      };
      window.__dupReestrDzArchiveProgress = progressState;
      window.dispatchEvent(new CustomEvent('dup-reestr-dz-archive-progress', { detail: progressState }));
    }
  }

  function clearArchivePdfs() {
    if (archivePdfsHost instanceof HTMLElement) archivePdfsHost.replaceChildren();
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  function openArchiveCache() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dupReestrDzWriteOffArchiveCache', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('archives')) database.createObjectStore('archives', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть кэш архивов.'));
    });
  }

  async function readCachedArchive() {
    if (!documentCacheKey) return null;
    const database = await openArchiveCache();
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction('archives', 'readonly').objectStore('archives').get(archiveCacheKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Не удалось прочитать кэш архива.'));
      });
    } finally {
      database.close();
    }
  }

  async function writeCachedArchive(pdfs) {
    if (!documentCacheKey || !Array.isArray(pdfs) || !pdfs.length) return;
    const database = await openArchiveCache();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('archives', 'readwrite');
        transaction.objectStore('archives').put({ key: archiveCacheKey, pdfs, updatedAt: Date.now() });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Не удалось сохранить кэш архива.'));
        transaction.onabort = () => reject(transaction.error || new Error('Сохранение кэша архива отменено.'));
      });
    } finally {
      database.close();
    }
  }

  function addArchivePdf(name, blob) {
    const fullName = String(name || 'Документ.pdf');
    const objectUrl = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' }));
    objectUrls.add(objectUrl);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.textContent = fullName;
    anchor.dataset.dupArchivePdf = 'true';
    anchor.dataset.fileName = fullName;
    archivePdfsHost?.appendChild(anchor);
  }

  function markArchiveProcessed() {
    chrome.runtime.sendMessage({
      action: 'REESTR_DZ_WRITE_OFF_UPDATE_REVIEW',
      data: { processedArchiveUrl: sourceUrl }
    }).catch(() => null);
  }

  function showPdf(url, title) {
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('Не удалось создать область просмотра PDF.');
    frame.src = url;
    frame.title = title || 'PDF-вложение';
    frame.hidden = false;
    if (status instanceof HTMLElement) status.hidden = true;
    document.title = `${title || fileName} · Проверка списания`;
  }

  async function fetchSource() {
    if (!/^https?:\/\//i.test(sourceUrl)) {
      throw new Error('Не удалось определить адрес вложения.');
    }
    const response = await fetch(sourceUrl, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow'
    });
    if (!response.ok) throw new Error('WSS вернул ошибку ' + response.status + '.');
    const declaredSize = Number(response.headers.get('content-length')) || 0;
    if (mode === 'archive' && declaredSize > archiveSourceLimit) {
      throw new Error('Архив больше 200 МБ. Проверьте его вручную.');
    }
    let bytes;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks = [];
      let receivedSize = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        receivedSize += value.byteLength;
        if (mode === 'archive' && receivedSize > archiveSourceLimit) {
          await reader.cancel();
          throw new Error('Архив больше 200 МБ. Проверьте его вручную.');
        }
        chunks.push(value);
        const downloadPercent = declaredSize ? receivedSize / declaredSize * 100 : 0;
        const downloadText = declaredSize
          ? `Скачивание: ${Math.min(100, Math.round(downloadPercent))}% · ${formatMegabytes(receivedSize)} из ${formatMegabytes(declaredSize)}`
          : `Скачивание: получено ${formatMegabytes(receivedSize)}`;
        setProgress(downloadPercent, downloadText, !declaredSize);
      }
      bytes = await new Blob(chunks).arrayBuffer();
    } else {
      setProgress(0, 'Скачивание файла…', true);
      bytes = await response.arrayBuffer();
    }
    if (mode === 'archive' && bytes.byteLength > archiveSourceLimit) {
      throw new Error('Архив больше 200 МБ. Проверьте его вручную.');
    }
    return bytes;
  }

  async function loadPdf() {
    setLoading();
    try {
      const bytes = await fetchSource();
      const header = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
      if (!header.includes('%PDF-')) throw new Error('WSS вернул не PDF-файл. Возможно, истекла авторизация.');
      clearArchivePdfs();
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      objectUrls.add(objectUrl);
      showPdf(objectUrl, fileName);
    } catch (error) {
      setError(error && error.message ? error.message : 'Не удалось открыть PDF-вложение.');
    }
  }

  async function loadArchive() {
    setLoading();
    let archive = null;
    try {
      clearArchivePdfs();
      const cachedArchive = await readCachedArchive().catch(() => null);
      if (cachedArchive && Array.isArray(cachedArchive.pdfs) && cachedArchive.pdfs.length) {
        cachedArchive.pdfs.forEach((pdf) => addArchivePdf(pdf.name, pdf.blob));
        if (spinner instanceof HTMLElement) spinner.hidden = true;
        if (retryButton instanceof HTMLButtonElement) retryButton.hidden = true;
        if (message) message.textContent = `PDF загружены из кэша: ${cachedArchive.pdfs.length}.`;
        setProgress(100, `Готово из кэша · PDF: ${cachedArchive.pdfs.length}`);
        markArchiveProcessed();
        return;
      }
      const bytes = await fetchSource();
      const zipEntryNames = readZipEntryNames(bytes);
      if (message) message.textContent = 'Читаю содержимое архива…';
      setProgress(0, 'Распаковка: анализ содержимого…', true);
      const { Archive } = await import(chrome.runtime.getURL('vendor/libarchive/libarchive.js'));
      Archive.init({ workerUrl: chrome.runtime.getURL('vendor/libarchive/worker-bundle.js') });
      archive = await Archive.open(new File([bytes], fileName, { type: 'application/octet-stream' }));
      if (await archive.hasEncryptedData()) {
        throw new Error('Архив защищён паролем. Проверьте его вручную.');
      }
      const entries = (await archive.getFilesArray()).map((entry, entryIndex) => ({
        ...entry,
        displayName: zipEntryNames[entryIndex] || repairArchiveFileName(`${String(entry && entry.path || '')}${String(entry && entry.file && entry.file.name || '')}`)
      })).filter((entry) => entry && entry.file && /\.pdf$/i.test(entry.displayName));
      if (!entries.length) throw new Error('В архиве не найдено PDF-файлов.');
      if (entries.length > archivePdfCountLimit) {
        throw new Error(`В архиве больше ${archivePdfCountLimit} PDF. Проверьте его вручную.`);
      }
      const declaredPdfSize = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.file.size) || 0), 0);
      if (declaredPdfSize > archivePdfSizeLimit) {
        throw new Error('Суммарный размер PDF в архиве больше 500 МБ. Проверьте его вручную.');
      }
      let validPdfCount = 0;
      const cachedPdfs = [];
      for (const [entryIndex, entry] of entries.entries()) {
        if (message) message.textContent = `Извлекаю PDF ${entryIndex + 1} из ${entries.length}…`;
        setProgress(entryIndex / entries.length * 100, `Распаковка: ${entryIndex + 1} из ${entries.length} PDF`);
        const extractedFile = await entry.file.extract();
        const header = new TextDecoder('latin1').decode((await extractedFile.slice(0, 1024).arrayBuffer()));
        if (!header.includes('%PDF-')) continue;
        const fullName = entry.displayName || 'Документ.pdf';
        const pdfBlob = new Blob([extractedFile], { type: 'application/pdf' });
        addArchivePdf(fullName, pdfBlob);
        cachedPdfs.push({ name: fullName, blob: pdfBlob });
        validPdfCount += 1;
      }
      if (!validPdfCount) throw new Error('Файлы с расширением PDF внутри архива не являются PDF-документами.');
      await writeCachedArchive(cachedPdfs).catch(() => null);
      if (spinner instanceof HTMLElement) spinner.hidden = true;
      if (retryButton instanceof HTMLButtonElement) retryButton.hidden = true;
      if (message) message.textContent = `Архив разобран. PDF добавлено в список: ${validPdfCount}.`;
      setProgress(100, `Готово · добавлено PDF: ${validPdfCount}`);
      markArchiveProcessed();
    } catch (error) {
      clearArchivePdfs();
      const errorText = error && error.message ? error.message : 'Не удалось разобрать архив.';
      setError(errorText);
      const progressState = { fileName, percent: 0, text: errorText, indeterminate: false, state: 'error' };
      window.__dupReestrDzArchiveProgress = progressState;
      window.dispatchEvent(new CustomEvent('dup-reestr-dz-archive-progress', { detail: progressState }));
    } finally {
      if (archive) await archive.close().catch(() => null);
    }
  }

  window.addEventListener('dup-reestr-dz-open-local-pdf', (event) => {
    const url = String(event && event.detail && event.detail.url || '');
    const title = String(event && event.detail && event.detail.fileName || 'PDF из архива');
    if (!/^blob:/i.test(url) || !objectUrls.has(url)) return;
    showPdf(url, title);
  });
  window.addEventListener('dup-reestr-dz-retry-archive', () => {
    if (mode === 'archive') void loadArchive();
  });

  const load = mode === 'archive' ? loadArchive : loadPdf;
  retryButton?.addEventListener('click', () => void load());
  window.addEventListener('beforeunload', () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  });
  void load();
})();
