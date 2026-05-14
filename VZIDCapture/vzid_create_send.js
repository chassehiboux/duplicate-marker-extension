(() => {
  if (window.__vzidCreateSendInitialized) {
    return;
  }
  window.__vzidCreateSendInitialized = true;

  const TARGET_PATH_PART = '/ovzid/claims/fssp';
  const CUSTOM_BUTTON_ID = 'vzid-create-send-btn';
  const STATUS_LINE_ID = 'vzid-create-send-status';
  const CLAIM_TYPE_STORAGE_KEY = 'vzid_last_claim_type';
  const CLAIM_TYPE_LABEL_STORAGE_KEY = 'vzid_last_claim_type_label';
  const CLAIM_TYPE_UPDATED_AT_KEY = 'vzid_last_claim_type_updated_at';

  if (!window.location.pathname.includes(TARGET_PATH_PART)) {
    return;
  }

  function getButtonText(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT') return String(el.value || '').trim();
    return String(el.textContent || '').trim();
  }

  function findMainSubmitButton() {
    const candidates = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    return candidates.find((el) => {
      const text = getButtonText(el).toLowerCase();
      return text.includes('сформировать заявление');
    }) || null;
  }

  function findTargetForm() {
    const submitButton = findMainSubmitButton();
    if (submitButton && submitButton.closest('form')) {
      return submitButton.closest('form');
    }
    const formByAction = document.querySelector('form[action*="/ovzid/claims/fssp"]');
    if (formByAction) {
      return formByAction;
    }
    return document.querySelector('form');
  }

  function setStatus(text, isError = false) {
    let line = document.getElementById(STATUS_LINE_ID);
    if (!line) {
      line = document.createElement('div');
      line.id = STATUS_LINE_ID;
      line.style.marginTop = '8px';
      line.style.fontSize = '12px';
      line.style.lineHeight = '1.4';
      const submitButton = findMainSubmitButton();
      if (submitButton && submitButton.parentElement) {
        submitButton.parentElement.appendChild(line);
      } else {
        document.body.appendChild(line);
      }
    }

    line.style.color = isError ? '#c62828' : '#2e7d32';
    line.textContent = text || '';
  }

  function getClaimTypeMeta(form) {
    const select = form ? form.querySelector('select[name="ClaimType"]') : null;
    if (!select) {
      return { value: '', label: '' };
    }
    const value = String(select.value || '').trim();
    const selectedOption = select.options[select.selectedIndex];
    const label = selectedOption ? String(selectedOption.textContent || '').trim() : '';
    return { value, label };
  }

  function saveClaimTypeMeta(form) {
    const claimType = getClaimTypeMeta(form);
    const payload = {
      [CLAIM_TYPE_STORAGE_KEY]: claimType.value,
      [CLAIM_TYPE_LABEL_STORAGE_KEY]: claimType.label,
      [CLAIM_TYPE_UPDATED_AT_KEY]: new Date().toISOString()
    };
    try {
      chrome.runtime.sendMessage({
        action: 'DUP_SYNC_SET',
        data: {
          values: payload,
          options: { reason: 'vzid-claim-type' }
        }
      }, () => {});
    } catch (error) {
      // background недоступен
    }
    return claimType;
  }

  function attachClaimTypeChangeListener(form) {
    if (!form) return;
    const select = form.querySelector('select[name="ClaimType"]');
    if (!select || select.dataset.vzidClaimTypeListenerAttached === '1') {
      return;
    }
    select.dataset.vzidClaimTypeListenerAttached = '1';
    select.addEventListener('change', () => {
      saveClaimTypeMeta(form);
    });
  }

  function parseFileName(contentDisposition) {
    if (!contentDisposition) {
      return 'document.pdf';
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1].replace(/["']/g, '')).trim();
      } catch (_) {
        // ignore decode error and try fallback below
      }
    }

    const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1].trim();
    }

    return 'document.pdf';
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => {
        reject(reader.error || new Error('Не удалось прочитать PDF'));
      };
      reader.readAsDataURL(blob);
    });
  }

  function normalizeIpNumber(rawValue) {
    if (!rawValue) return '';
    return String(rawValue)
      .trim()
      .replace(/[.,;:!?]+$/g, '')
      .replace(/\s+/g, '');
  }

  function findIpInText(text) {
    if (!text) return '';
    const match = text.match(/\d{2,8}\/\d{2}\/\d{5}(?:-[A-Za-zА-Яа-яЁё]{1,3})?/);
    return match ? normalizeIpNumber(match[0]) : '';
  }

  function getIpFromRowByKnownColumns(row) {
    if (!row) return '';
    const selectors = [
      'td[aria-describedby="list_RegNumIP"]',
      'td[aria-describedby="list_ExecNumber"]',
      'td[aria-describedby="list_ExecProcNumber"]',
      'td[aria-describedby="list_ExecProceedingNumber"]',
      'td[aria-describedby="list_IPNumber"]'
    ];

    for (const selector of selectors) {
      const cell = row.querySelector(selector);
      const candidate = normalizeIpNumber(cell ? cell.textContent : '');
      if (candidate) {
        return candidate;
      }
    }

    return '';
  }

  function getIpFromRowByHeaderIndex(row, doc) {
    if (!row || !doc) return '';

    const headerCell = Array.from(
      doc.querySelectorAll('th, td[role="columnheader"], div[role="columnheader"]')
    ).find((el) => {
      const text = String(el.textContent || '').toLowerCase();
      return text.includes('номер ип');
    });

    if (!headerCell) {
      return '';
    }

    const index = Number.isInteger(headerCell.cellIndex)
      ? headerCell.cellIndex
      : Array.from(headerCell.parentElement ? headerCell.parentElement.children : []).indexOf(headerCell);

    if (index < 0) {
      return '';
    }

    const cells = row.querySelectorAll('td[role="gridcell"], td');
    if (!cells || !cells[index]) {
      return '';
    }

    return normalizeIpNumber(cells[index].textContent);
  }

  function getIpFromRowByCellPattern(row) {
    if (!row) return '';
    const cells = row.querySelectorAll('td[role="gridcell"], td');
    for (const cell of cells) {
      const text = normalizeIpNumber(cell.textContent);
      const found = findIpInText(text);
      if (found) {
        return found;
      }
    }
    return '';
  }

  function getStrictSelectedRows(parentDoc) {
    const rows = Array.from(parentDoc.querySelectorAll('tr.jqgrow'));
    if (rows.length === 0) {
      return [];
    }

    const checkedRows = rows.filter((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      return checkbox && checkbox.checked;
    });
    if (checkedRows.length > 0) {
      return checkedRows;
    }

    const ariaSelectedRows = rows.filter((row) => row.getAttribute('aria-selected') === 'true');
    if (ariaSelectedRows.length > 0) {
      return ariaSelectedRows;
    }

    const classSelectedRows = rows.filter((row) => {
      const cls = String(row.className || '');
      return cls.includes('success') || cls.includes('ui-state-highlight') || cls.includes('selected');
    });
    if (classSelectedRows.length > 0) {
      return classSelectedRows;
    }

    return [];
  }

  function getLikelySelectedRows(parentDoc) {
    const strictRows = getStrictSelectedRows(parentDoc);
    if (strictRows.length > 0) {
      return strictRows;
    }

    const rows = Array.from(parentDoc.querySelectorAll('tr.jqgrow'));
    return rows.slice(0, 3);
  }

  function hasExactlyOneSelectedGridRow() {
    try {
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc || parentDoc === document) {
        return false;
      }
      return getStrictSelectedRows(parentDoc).length === 1;
    } catch (_) {
      return false;
    }
  }

  function removeCustomControls() {
    const button = document.getElementById(CUSTOM_BUTTON_ID);
    if (button) {
      button.remove();
    }

    const status = document.getElementById(STATUS_LINE_ID);
    if (status) {
      status.remove();
    }
  }

  function getParentSelectedIp() {
    try {
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc || parentDoc === document) {
        return '';
      }

      const candidates = getLikelySelectedRows(parentDoc);
      for (const row of candidates) {
        const byKnownCols = getIpFromRowByKnownColumns(row);
        if (byKnownCols) return byKnownCols;

        const byHeaderIndex = getIpFromRowByHeaderIndex(row, parentDoc);
        if (byHeaderIndex) return byHeaderIndex;

        const byPattern = getIpFromRowByCellPattern(row);
        if (byPattern) return byPattern;
      }

      return '';
    } catch (_) {
      return '';
    }
  }

  async function extractIpNumberFromPdfBlob(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const parentSelectedIp = getParentSelectedIp();
    const decoders = [
      new TextDecoder('utf-8', { fatal: false }),
      new TextDecoder('windows-1251', { fatal: false }),
      new TextDecoder('latin1', { fatal: false })
    ];

    for (const decoder of decoders) {
      const text = decoder.decode(bytes);
      const found = findIpInText(text);
      if (found) {
        if (!found.includes('-') && parentSelectedIp && parentSelectedIp.startsWith(found)) {
          return parentSelectedIp;
        }
        return found;
      }
    }

    return parentSelectedIp;
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || 'Не удалось отправить сообщение'));
          return;
        }
        resolve(response);
      });
    });
  }

  function setButtonsState(disabled, mainButton, customButton, defaultCustomText = 'Создать и отправить') {
    if (mainButton) {
      mainButton.disabled = disabled;
    }

    if (customButton) {
      customButton.disabled = disabled;
      if (!disabled) {
        customButton.textContent = defaultCustomText;
      }
    }
  }

  function alignCustomButton(customButton, mainButton) {
    if (!customButton || !mainButton) {
      return;
    }

    const leftOffset = Math.max(0, Number(mainButton.offsetLeft) || 0);
    customButton.style.display = 'block';
    customButton.style.marginTop = '8px';
    customButton.style.marginLeft = `${leftOffset}px`;
  }

  async function onCreateAndSendClick() {
    const form = findTargetForm();
    const mainButton = findMainSubmitButton();
    const customButton = document.getElementById(CUSTOM_BUTTON_ID);

    if (!form || !customButton) {
      setStatus('Не найдена форма формирования заявления', true);
      return;
    }

    if (!hasExactlyOneSelectedGridRow()) {
      setStatus('Выберите ровно одну строку в гриде', true);
      return;
    }

    const claimType = saveClaimTypeMeta(form);
    const actionUrl = new URL(form.getAttribute('action') || window.location.href, window.location.href).toString();

    try {
      setButtonsState(true, mainButton, customButton);
      customButton.textContent = 'Формирую...';
      setStatus('Формирую PDF и извлекаю номер ИП...');

      const formData = new FormData(form);
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/pdf'
        },
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP ${response.status}`);
      }

      const pdfBlob = await response.blob();
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/pdf') && pdfBlob.type !== 'application/pdf') {
        throw new Error('Ответ не содержит PDF');
      }

      const ipNumber = await extractIpNumberFromPdfBlob(pdfBlob);
      const fileName = parseFileName(response.headers.get('content-disposition'));
      const fileBase64 = await blobToBase64(pdfBlob);

      const openResult = await sendMessage({
        action: 'VZID_OPEN_CAPTURE_PREVIEW',
        data: {
          sourceUrl: actionUrl,
          claimTypeLabel: claimType.label,
          claimTypeValue: claimType.value,
          ipNumber: ipNumber,
          fileName: fileName,
          fileMimeType: pdfBlob.type || 'application/pdf',
          fileBase64: fileBase64
        }
      });

      if (!openResult || !openResult.success) {
        throw new Error((openResult && openResult.error) || 'Не удалось открыть тестовую страницу');
      }

      const ipText = ipNumber ? `Номер ИП: ${ipNumber}` : 'Номер ИП не найден';
      setStatus(`Готово. ${ipText}`);
    } catch (error) {
      setStatus(`Ошибка: ${error.message || error}`, true);
    } finally {
      setButtonsState(false, mainButton, customButton);
    }
  }

  function ensureCustomButton() {
    const form = findTargetForm();
    const mainButton = findMainSubmitButton();
    if (!form || !mainButton) {
      removeCustomControls();
      return;
    }

    if (!hasExactlyOneSelectedGridRow()) {
      removeCustomControls();
      return;
    }

    attachClaimTypeChangeListener(form);

    const existingButton = document.getElementById(CUSTOM_BUTTON_ID);
    if (existingButton) {
      alignCustomButton(existingButton, mainButton);
      return;
    }

    const customButton = document.createElement('button');
    customButton.id = CUSTOM_BUTTON_ID;
    customButton.type = 'button';
    customButton.className = mainButton.className || '';
    customButton.textContent = 'Создать и отправить';
    customButton.addEventListener('click', onCreateAndSendClick);

    mainButton.insertAdjacentElement('afterend', customButton);
    alignCustomButton(customButton, mainButton);
    saveClaimTypeMeta(form);
  }

  const observer = new MutationObserver(() => {
    ensureCustomButton();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  ensureCustomButton();
  window.addEventListener('resize', ensureCustomButton);
  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
})();
