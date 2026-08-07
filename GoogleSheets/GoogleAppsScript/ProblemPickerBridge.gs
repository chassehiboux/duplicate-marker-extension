const PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
const PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS = ['Заявки', 'Заявки (наши)'];
const PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_GREEN = '#00ff00';
const PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_SHEET = 'Служебные новые ответы';
const PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_PENDING = 'pending';
const PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_UNREAD = 'unread';
const PROBLEM_PICKER_BRIDGE_FAVORITE_HEADER = 'Избранное';
const PROBLEM_PICKER_BRIDGE_FAVORITE_VALUE = 'Да';
const PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_HEADERS = [
  'event_id',
  'state',
  'created_at',
  'source_sheet',
  'source_row',
  'mode',
  'itil_number',
  'supp_value',
  'supp_numbers_json',
  'request_date',
  'request_status',
  'status_background',
  'current_stage',
  'stage_background',
  'initiator',
  'initiator_background',
  'request_text',
  'before_info',
  'after_info'
];
const PROBLEM_PICKER_BRIDGE_AI_SEARCH_RESULT_SHEET = 'Поиск заявок (ИИ)';
const PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_SHEET = 'Шаблон (Поиск заявок (ИИ))';
const PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW = 2;
const PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_SHEET = 'ITIL';
const PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_START_ROW = 2003;
const PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_COLUMN_COUNT = 22;
const PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_HEADERS = [
  'Индекс картинки события',
  'Статус порядок',
  'Дата',
  'Приоритет',
  'Номер',
  'Текущий этап',
  'Наименование',
  'Номер заявки в СУПП',
  'Дата передачи заявки в СУПП',
  'Состояние в СУПП',
  'Дата состояния заявки СУПП',
  'Инициатор',
  'Текущий исполнитель',
  'Комментарий исполнителя',
  'Крайний срок устранения',
  'Дата завершения',
  'Массовый',
  'Время перехода',
  'Маршрут',
  'Организация',
  'Исполнитель в ПК СУПП',
  'Последний исполнитель'
];
const PROBLEM_PICKER_BRIDGE_WSS_SHEET = 'WSS';
const PROBLEM_PICKER_BRIDGE_WSS_TEMPLATE_ROW = 2;
const PROBLEM_PICKER_BRIDGE_WSS_TEXT_LIMIT = 45000;
const PROBLEM_PICKER_BRIDGE_WSS_HEADERS = [
  'WSS ID',
  'Рег. номер',
  'Краткое описание задачи',
  'Содержание',
  'Расширенная история решений',
  'Доп. файлы',
  'Дата регистрации',
  'Этап',
  'Статус',
  'Призано исполненным',
  'Заказчик',
  'Ответственный',
  'Плановое количество часов',
  'Исполнить до',
  'Комментарий',
  'Номер заявки в СУПП',
  'Состояние заявки в СУПП',
  'Связанные задачи СУПП',
  'last_parsed_at'
];

// Bridge больше не зависит от PROBLEM_OPTIONS из Code.gs.
// Так меньше риск, что /exec работает с другим набором глобальных переменных.
const PROBLEM_PICKER_BRIDGE_ALLOWED_VALUES = [
  'Публикация/Некорректная публикация/Ошибки публикации',
  'Распределение оплат',
  'Скачки долга',
  'Разночтения остатков ПКП/АИС',
  'Ошибка в работе функционала',
  'Ошибка из-за проблем с данными',
  'Системный сбой',
  'Некорректная работа отчётов',
  'Редактирование/Перемещение ИД/БП',
  'Миграция АСРН/АИС',
  'Иные заявки',
  'Запросы через ТП',
  'ЕПГУ',
  'Разное'
];

function doPost(e) {
  try {
    const payload = _problemPickerBridgeParsePayload_(e);
    let result;

    if (payload.action === 'saveProblem') {
      result = _problemPickerBridgeSaveProblem_(payload);
    } else if (payload.action === 'setFavoriteState') {
      result = _problemPickerBridgeSetFavoriteState_(payload);
    } else if (payload.action === 'saveItilData') {
      result = _problemPickerBridgeSaveItilData_(payload);
    } else if (payload.action === 'saveSuppData') {
      result = _problemPickerBridgeSaveSuppData_(payload);
    } else if (payload.action === 'getNewResponseRows') {
      result = _problemPickerBridgeGetNewResponseRows_(payload);
    } else if (payload.action === 'getNewResponseInbox') {
      result = _problemPickerBridgeGetNewResponseInbox_(payload);
    } else if (payload.action === 'deleteNewResponseInboxItem') {
      result = _problemPickerBridgeDeleteNewResponseInboxItem_(payload);
    } else if (payload.action === 'getInitiatorBackgrounds') {
      result = _problemPickerBridgeGetInitiatorBackgrounds_(payload);
    } else if (payload.action === 'saveItilInfoData') {
      result = _problemPickerBridgeSaveItilInfoData_(payload);
    } else if (payload.action === 'saveSuppInfoData') {
      result = _problemPickerBridgeSaveSuppInfoData_(payload);
    } else if (payload.action === 'resetInfoEditColors') {
      result = _problemPickerBridgeResetInfoEditColors_(payload);
    } else if (payload.action === 'saveAiSearchResults') {
      result = _problemPickerBridgeSaveAiSearchResults_(payload);
    } else if (payload.action === 'importItilTableRows') {
      result = _problemPickerBridgeImportItilTableRows_(payload);
    } else if (payload.action === 'getWssImportState') {
      result = _problemPickerBridgeGetWssImportState_(payload);
    } else if (payload.action === 'importWssArchiveRows') {
      result = _problemPickerBridgeImportWssArchiveRows_(payload);
    } else {
      throw new Error('Неизвестное действие bridge: ' + payload.action);
    }

    return _problemPickerBridgeJson_({ success: true, result });
  } catch (error) {
    return _problemPickerBridgeJson_({
      success: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function _problemPickerBridgeParsePayload_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!text) throw new Error('Пустой запрос bridge.');

  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object') throw new Error('Пустой JSON.');
    return payload;
  } catch (error) {
    throw new Error('Некорректный JSON bridge: ' + text.slice(0, 300));
  }
}

function _problemPickerBridgePayloadColumn_(payload, key) {
  const columns = payload && payload.columns && typeof payload.columns === 'object'
    ? payload.columns
    : null;
  if (!columns) return null;

  const column = Number(columns[key]);
  return Number.isInteger(column) && column > 0 ? column : null;
}

function _problemPickerBridgeHasPayloadColumnKey_(payload, key) {
  const columns = payload && payload.columns && typeof payload.columns === 'object'
    ? payload.columns
    : null;
  return !!columns && Object.prototype.hasOwnProperty.call(columns, key);
}

function _problemPickerBridgeIsFavoriteValue_(value) {
  return String(value == null ? '' : value).trim().toLowerCase() ===
    PROBLEM_PICKER_BRIDGE_FAVORITE_VALUE.toLowerCase();
}

function _problemPickerBridgeNormalizeFavoriteAnchor_(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .trim();
}

function _problemPickerBridgeColumn_(payload, key, sh, header) {
  return _problemPickerBridgePayloadColumn_(payload, key) || getColByHeader(sh, header);
}

function _problemPickerBridgeOptionalColumn_(payload, key, sh, header) {
  if (_problemPickerBridgeHasPayloadColumnKey_(payload, key)) {
    return _problemPickerBridgePayloadColumn_(payload, key);
  }
  return getColByHeader(sh, header);
}

function _problemPickerBridgeReadRowDisplayValues_(sh, row, columns) {
  const sortedColumns = Array.from(new Set((columns || [])
    .map(function(column) { return Number(column); })
    .filter(function(column) { return Number.isInteger(column) && column > 0; })))
    .sort(function(a, b) { return a - b; });

  if (!sortedColumns.length) return {};

  const minColumn = sortedColumns[0];
  const maxColumn = sortedColumns[sortedColumns.length - 1];
  const values = sh.getRange(row, minColumn, 1, maxColumn - minColumn + 1).getDisplayValues()[0];
  const result = {};

  sortedColumns.forEach(function(column) {
    result[column] = values[column - minColumn];
  });

  return result;
}

function _problemPickerBridgeIsSuppPlaceholderLine_(value) {
  const text = String(value || '').trim();
  return text === '–' || text === '—' || text === '-';
}

function _problemPickerBridgeNormalizeSuppNumbersList_(values) {
  const source = Array.isArray(values) ? values : [values];
  const unique = [];
  const seen = {};

  source.forEach(function(value) {
    const normalized = String(value || '').trim();
    if (!normalized || _problemPickerBridgeIsSuppPlaceholderLine_(normalized) || seen[normalized]) return;
    seen[normalized] = true;
    unique.push(normalized);
  });

  return unique;
}

function _problemPickerBridgeExtractSuppNumbers_(value) {
  const lines = String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(function(line) { return String(line || '').trim(); })
    .filter(function(line) { return !!line && !_problemPickerBridgeIsSuppPlaceholderLine_(line); });

  const unique = [];
  const seen = {};
  lines.forEach(function(line) {
    if (seen[line]) return;
    seen[line] = true;
    unique.push(line);
  });

  return unique.reverse();
}

function _problemPickerBridgeExtractSuppNumber_(value) {
  const numbers = _problemPickerBridgeExtractSuppNumbers_(value);
  return numbers.length ? String(numbers[0] || '').trim() : '';
}

function _problemPickerBridgeResetRowColors_(sh, row, colResp, colSupp) {
  const ranges = [];

  if (colResp) ranges.push(_problemPickerBridgeColumnToA1_(colResp) + row);
  if (colSupp) ranges.push(_problemPickerBridgeColumnToA1_(colSupp) + row);
  if (ranges.length) sh.getRangeList(ranges).setBackground('#f5f5f5');
}

function _problemPickerBridgeEnsureNewResponseInboxSheet_(ss) {
  let sh = ss.getSheetByName(PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_SHEET);
  const headers = PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_HEADERS;

  if (!sh) {
    sh = ss.insertSheet(PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_SHEET);
  }

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const actualHeaders = sh.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    const mismatches = [];
    headers.forEach(function(expected, index) {
      const actual = String(actualHeaders[index] || '').trim();
      if (actual !== expected) {
        mismatches.push((index + 1) + ': ожидалось «' + expected + '», получено «' + (actual || 'пусто') + '»');
      }
    });
    if (mismatches.length) {
      throw new Error(
        'Повреждены заголовки системного листа «' + PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_SHEET + '».\n' +
        mismatches.join('\n')
      );
    }
  }

  if (!sh.isSheetHidden()) sh.hideSheet();
  return sh;
}

function _problemPickerBridgeNewResponseInboxHeaderMap_() {
  const map = {};
  PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_HEADERS.forEach(function(header, index) {
    map[header] = index + 1;
  });
  return map;
}

function _problemPickerBridgeComputeNewResponseEventId_(parts) {
  const source = (parts || []).map(function(value) {
    return String(value == null ? '' : value).replace(/\r\n?/g, '\n');
  }).join('\n\u241e\n');
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    source,
    Utilities.Charset.UTF_8
  );
  return digest.map(function(value) {
    const normalized = value < 0 ? value + 256 : value;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function _problemPickerBridgeParseInboxSuppNumbers_(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return _problemPickerBridgeNormalizeSuppNumbersList_(parsed);
  } catch (error) {
    return [];
  }
}

function _problemPickerBridgeNormalizeInboxComparisonText_(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .trim();
}

function _problemPickerBridgeBuildNewResponseInboxRecord_(options) {
  const data = options && typeof options === 'object' ? options : {};
  const snapshot = data.snapshot && typeof data.snapshot === 'object' ? data.snapshot : {};
  const suppNumbers = _problemPickerBridgeNormalizeSuppNumbersList_(data.suppNumbers || snapshot.suppNumbers || []);
  const itilNumber = String(data.itilNumber || snapshot.itilNumber || '');
  const suppValue = String(data.suppValue || snapshot.suppValue || '');
  const hasSnapshotBeforeInfo = Object.prototype.hasOwnProperty.call(snapshot, 'beforeInfo');
  const hasSnapshotAfterInfo = Object.prototype.hasOwnProperty.call(snapshot, 'afterInfo');
  const beforeInfo = String(
    hasSnapshotBeforeInfo ? snapshot.beforeInfo : (data.beforeInfo == null ? '' : data.beforeInfo)
  ).replace(/\r\n?/g, '\n').trim();
  const afterInfo = String(
    hasSnapshotAfterInfo ? snapshot.afterInfo : (data.afterInfo == null ? '' : data.afterInfo)
  ).replace(/\r\n?/g, '\n').trim();
  const eventId = _problemPickerBridgeComputeNewResponseEventId_([
    data.sheetName,
    data.row,
    data.mode,
    itilNumber,
    suppValue,
    suppNumbers.join('\n'),
    beforeInfo,
    afterInfo
  ]);

  return {
    eventId: eventId,
    values: [
      eventId,
      PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_PENDING,
      new Date().toISOString(),
      String(data.sheetName || ''),
      Number(data.row || 0),
      String(data.mode || ''),
      itilNumber,
      suppValue,
      JSON.stringify(suppNumbers),
      String(snapshot.date || ''),
      String(snapshot.status || ''),
      _problemPickerBridgeNormalizeCssColor_(snapshot.statusBackgroundColor),
      String(snapshot.currentStage || ''),
      _problemPickerBridgeNormalizeCssColor_(snapshot.currentStageBackgroundColor),
      String(snapshot.initiator || ''),
      _problemPickerBridgeNormalizeCssColor_(snapshot.initiatorBackgroundColor),
      String(snapshot.text || ''),
      beforeInfo,
      afterInfo
    ]
  };
}

function _problemPickerBridgeFindNewResponseInboxEvent_(sh, eventId) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0] || '') === eventId) {
      return {
        row: index + 2,
        state: String(values[index][1] || '')
      };
    }
  }
  return null;
}

function _problemPickerBridgeAppendNewResponseInboxRecord_(sh, record) {
  const existing = _problemPickerBridgeFindNewResponseInboxEvent_(sh, record.eventId);
  if (existing) {
    return {
      eventId: record.eventId,
      row: existing.row,
      created: false
    };
  }

  const row = Math.max(2, sh.getLastRow() + 1);
  if (row > sh.getMaxRows()) {
    sh.insertRowsAfter(sh.getMaxRows(), row - sh.getMaxRows());
  }
  const safeValues = record.values.map(function(value) {
    const text = typeof value === 'string' ? value : null;
    return text && text.charAt(0) === '=' ? "'" + text : value;
  });
  sh.getRange(row, 1, 1, safeValues.length).setValues([safeValues]);
  return {
    eventId: record.eventId,
    row: row,
    created: true
  };
}

function _problemPickerBridgeCommitNewResponseInfo_(options) {
  const data = options && typeof options === 'object' ? options : {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const inbox = _problemPickerBridgeEnsureNewResponseInboxSheet_(data.ss);
    const beforeInfo = data.sh.getRange(data.row, data.colInfo).getDisplayValue();
    const afterInfo = data.infoRichText.getText();
    const record = _problemPickerBridgeBuildNewResponseInboxRecord_({
      snapshot: data.payload && data.payload.reviewSnapshot,
      sheetName: data.sh.getName(),
      row: data.row,
      mode: data.mode,
      itilNumber: data.itilNumber,
      suppValue: data.suppValue,
      suppNumbers: data.suppNumbers,
      beforeInfo: beforeInfo,
      afterInfo: afterInfo
    });
    const inboxItem = _problemPickerBridgeAppendNewResponseInboxRecord_(inbox, record);

    data.sh.getRange(data.row, data.colInfo).setRichTextValue(data.infoRichText);
    _problemPickerBridgeResetRowColors_(data.sh, data.row, data.colResp, data.colSupp);

    const headerMap = _problemPickerBridgeNewResponseInboxHeaderMap_();
    inbox.getRange(inboxItem.row, headerMap.state).setValue(PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_UNREAD);

    return {
      eventId: inboxItem.eventId,
      created: inboxItem.created
    };
  } finally {
    lock.releaseLock();
  }
}

function _problemPickerBridgeExtractItilSolutionFromInboxInfo_(value) {
  const text = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  if (text === 'ИТИЛ') return '';
  if (text.indexOf('ИТИЛ\n') === 0) return text.slice('ИТИЛ'.length).replace(/^\n+/, '');
  return text;
}

function _problemPickerBridgeRecoverPendingNewResponseInbox_(ss) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const inbox = _problemPickerBridgeEnsureNewResponseInboxSheet_(ss);
    const lastRow = inbox.getLastRow();
    if (lastRow < 2) return;

    const headerMap = _problemPickerBridgeNewResponseInboxHeaderMap_();
    const values = inbox.getRange(
      2,
      1,
      lastRow - 1,
      PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_HEADERS.length
    ).getDisplayValues();

    values.forEach(function(rowValues, index) {
      if (String(rowValues[headerMap.state - 1] || '') !== PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_PENDING) return;

      const inboxRow = index + 2;
      try {
        const sheetName = String(rowValues[headerMap.source_sheet - 1] || '').trim();
        const sourceRow = Number(rowValues[headerMap.source_row - 1]);
        const mode = String(rowValues[headerMap.mode - 1] || '').trim();
        const beforeInfo = String(rowValues[headerMap.before_info - 1] || '');
        const afterInfo = String(rowValues[headerMap.after_info - 1] || '');
        const sh = PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) !== -1
          ? ss.getSheetByName(sheetName)
          : null;

        if (sh && Number.isInteger(sourceRow) && sourceRow >= 2 && sourceRow <= sh.getLastRow()) {
          const colInfo = getColByHeader(sh, INFO_HEADER);
          const colSupp = getColByHeader(sh, 'Номер СУПП (последний)');
          const colResp = getColByHeader(sh, 'Пришел новый ответ');
          const currentInfo = colInfo ? sh.getRange(sourceRow, colInfo).getDisplayValue() : '';
          const normalizedCurrent = _problemPickerBridgeNormalizeInboxComparisonText_(currentInfo);
          const normalizedBefore = _problemPickerBridgeNormalizeInboxComparisonText_(beforeInfo);
          const normalizedAfter = _problemPickerBridgeNormalizeInboxComparisonText_(afterInfo);

          if (colInfo && normalizedCurrent === normalizedBefore) {
            const richText = mode === 'itil'
              ? _problemPickerBridgeBuildItilInfoRichText_(_problemPickerBridgeExtractItilSolutionFromInboxInfo_(afterInfo))
              : _problemPickerBridgeBuildSuppInfoRichText_(
                _problemPickerBridgeParseInboxSuppNumbers_(rowValues[headerMap.supp_numbers_json - 1]),
                afterInfo
              );
            sh.getRange(sourceRow, colInfo).setRichTextValue(richText);
            _problemPickerBridgeResetRowColors_(sh, sourceRow, colResp, colSupp);
          } else if (colInfo && normalizedCurrent === normalizedAfter) {
            _problemPickerBridgeResetRowColors_(sh, sourceRow, colResp, colSupp);
          }
        }
      } catch (error) {
        // Снимок ответа уже сохранён. Оставляем его доступным для просмотра,
        // даже если исходная строка успела измениться или исчезнуть.
      } finally {
        inbox.getRange(inboxRow, headerMap.state).setValue(PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_UNREAD);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function _problemPickerBridgeReadNewResponseInboxItems_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const headerMap = _problemPickerBridgeNewResponseInboxHeaderMap_();
  const values = sh.getRange(
    2,
    1,
    lastRow - 1,
    PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_HEADERS.length
  ).getDisplayValues();

  return values.filter(function(rowValues) {
    return String(rowValues[headerMap.state - 1] || '') === PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_INBOX_UNREAD;
  }).map(function(rowValues) {
    return {
      eventId: String(rowValues[headerMap.event_id - 1] || ''),
      createdAt: String(rowValues[headerMap.created_at - 1] || ''),
      sourceSheetName: String(rowValues[headerMap.source_sheet - 1] || ''),
      row: Number(rowValues[headerMap.source_row - 1] || 0),
      mode: String(rowValues[headerMap.mode - 1] || ''),
      itilNumber: String(rowValues[headerMap.itil_number - 1] || ''),
      suppValue: String(rowValues[headerMap.supp_value - 1] || ''),
      suppNumbers: _problemPickerBridgeParseInboxSuppNumbers_(rowValues[headerMap.supp_numbers_json - 1]),
      date: String(rowValues[headerMap.request_date - 1] || ''),
      status: String(rowValues[headerMap.request_status - 1] || ''),
      statusBackgroundColor: String(rowValues[headerMap.status_background - 1] || ''),
      currentStage: String(rowValues[headerMap.current_stage - 1] || ''),
      currentStageBackgroundColor: String(rowValues[headerMap.stage_background - 1] || ''),
      initiator: String(rowValues[headerMap.initiator - 1] || ''),
      initiatorBackgroundColor: String(rowValues[headerMap.initiator_background - 1] || ''),
      text: String(rowValues[headerMap.request_text - 1] || ''),
      beforeInfo: String(rowValues[headerMap.before_info - 1] || ''),
      afterInfo: String(rowValues[headerMap.after_info - 1] || '')
    };
  });
}

function _problemPickerBridgeAttachNewResponseFavoriteStates_(ss, items) {
  const sourceItems = Array.isArray(items) ? items : [];
  const grouped = {};

  sourceItems.forEach(function(item) {
    const sheetName = String(item && item.sourceSheetName || '').trim();
    if (!grouped[sheetName]) grouped[sheetName] = [];
    grouped[sheetName].push(item);
    item.favorite = false;
    item.favoriteAvailable = false;
  });

  Object.keys(grouped).forEach(function(sheetName) {
    if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) return;

    const sourceSheet = ss.getSheetByName(sheetName);
    if (!sourceSheet) return;

    const favoriteColumn = getColByHeader(sourceSheet, PROBLEM_PICKER_BRIDGE_FAVORITE_HEADER);
    const itilColumn = getColByHeader(sourceSheet, 'Номер ITIL');
    const suppColumn = getColByHeader(sourceSheet, 'Номер СУПП (последний)');
    const textColumn = getColByHeader(sourceSheet, TEXT_HEADER);
    if (!favoriteColumn || !itilColumn || !suppColumn || !textColumn) {
      throw new Error(
        'На листе «' + sheetName + '» не найдены колонки «' +
        PROBLEM_PICKER_BRIDGE_FAVORITE_HEADER + '», «Номер ITIL», «Номер СУПП (последний)» или «' +
        TEXT_HEADER + '».'
      );
    }

    const sourceLastRow = sourceSheet.getLastRow();
    const validRows = grouped[sheetName].map(function(item) {
      return Number(item && item.row || 0);
    }).filter(function(row) {
      return Number.isInteger(row) && row >= 2 && row <= sourceLastRow;
    });
    if (!validRows.length) return;

    const minRow = Math.min.apply(null, validRows);
    const maxRow = Math.max.apply(null, validRows);
    const minColumn = Math.min(favoriteColumn, itilColumn, suppColumn, textColumn);
    const maxColumn = Math.max(favoriteColumn, itilColumn, suppColumn, textColumn);
    const values = sourceSheet.getRange(
      minRow,
      minColumn,
      maxRow - minRow + 1,
      maxColumn - minColumn + 1
    ).getDisplayValues();

    grouped[sheetName].forEach(function(item) {
      const row = Number(item && item.row || 0);
      if (!Number.isInteger(row) || row < minRow || row > maxRow) return;
      const rowValues = values[row - minRow] || [];
      const expectedItil = _problemPickerBridgeNormalizeFavoriteAnchor_(item && item.itilNumber);
      const expectedSupp = _problemPickerBridgeNormalizeFavoriteAnchor_(item && item.suppValue);
      const expectedText = _problemPickerBridgeNormalizeFavoriteAnchor_(item && item.text);
      const actualItil = _problemPickerBridgeNormalizeFavoriteAnchor_(rowValues[itilColumn - minColumn]);
      const actualSupp = _problemPickerBridgeNormalizeFavoriteAnchor_(rowValues[suppColumn - minColumn]);
      const actualText = _problemPickerBridgeNormalizeFavoriteAnchor_(rowValues[textColumn - minColumn]);
      const hasIdentifierAnchor = !!expectedItil || !!expectedSupp;
      const matches = (!expectedItil || actualItil === expectedItil) &&
        (!expectedSupp || actualSupp === expectedSupp) &&
        (hasIdentifierAnchor || (!!expectedText && actualText === expectedText));
      if (!matches) return;

      item.favorite = _problemPickerBridgeIsFavoriteValue_(rowValues[favoriteColumn - minColumn]);
      item.favoriteAvailable = true;
    });
  });

  return sourceItems;
}

function _problemPickerBridgeValidateNewResponseInboxPayload_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();
  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }
}

function _problemPickerBridgeGetNewResponseInbox_(payload) {
  _problemPickerBridgeValidateNewResponseInboxPayload_(payload);
  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  _problemPickerBridgeRecoverPendingNewResponseInbox_(ss);
  const sh = _problemPickerBridgeEnsureNewResponseInboxSheet_(ss);
  let items = _problemPickerBridgeReadNewResponseInboxItems_(sh);
  if (!payload.summaryOnly) {
    items = _problemPickerBridgeAttachNewResponseFavoriteStates_(ss, items);
  }

  return {
    sheetName: sh.getName(),
    itemsCount: items.length,
    items: payload.summaryOnly ? [] : items
  };
}

function _problemPickerBridgeSetFavoriteState_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();
  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();
  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для изменения избранного: ' + sheetName);
  }

  const row = Number(payload.row);
  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки: ' + payload.row);
  }
  if (payload.isFavorite !== true && payload.isFavorite !== false) {
    throw new Error('Не передано состояние избранного для строки ' + row + '.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
    const sh = ss.getSheetByName(sheetName);
    if (!sh) throw new Error('Лист не найден: ' + sheetName);
    if (row > sh.getLastRow()) {
      throw new Error('Строка ' + row + ' больше не существует на листе «' + sheetName + '».');
    }

    const colFavorite = getColByHeader(sh, PROBLEM_PICKER_BRIDGE_FAVORITE_HEADER);
    const colItil = getColByHeader(sh, 'Номер ITIL');
    const colSupp = getColByHeader(sh, 'Номер СУПП (последний)');
    const colText = getColByHeader(sh, TEXT_HEADER);
    if (!colFavorite || !colItil || !colSupp || !colText) {
      throw new Error(
        'Не найдены колонки «' + PROBLEM_PICKER_BRIDGE_FAVORITE_HEADER +
        '», «Номер ITIL», «Номер СУПП (последний)» или «' + TEXT_HEADER + '».'
      );
    }

    const rowValues = _problemPickerBridgeReadRowDisplayValues_(sh, row, [colItil, colSupp, colText]);
    const expectedItil = _problemPickerBridgeNormalizeFavoriteAnchor_(payload.expectedItilNumber);
    const expectedSupp = _problemPickerBridgeNormalizeFavoriteAnchor_(payload.expectedSuppValue);
    const expectedText = _problemPickerBridgeNormalizeFavoriteAnchor_(payload.expectedRequestText);
    const expectedCleanText = _problemPickerBridgeNormalizeFavoriteAnchor_(payload.expectedCleanRequestText);
    const actualItil = _problemPickerBridgeNormalizeFavoriteAnchor_(rowValues[colItil]);
    const actualSupp = _problemPickerBridgeNormalizeFavoriteAnchor_(rowValues[colSupp]);
    const actualText = _problemPickerBridgeNormalizeFavoriteAnchor_(rowValues[colText]);
    let hasIdentifierAnchor = false;

    if (expectedItil) {
      hasIdentifierAnchor = true;
      if (actualItil !== expectedItil) {
        throw new Error('Строка ' + row + ' больше не соответствует ITIL ' + expectedItil + '.');
      }
    }
    if (expectedSupp) {
      hasIdentifierAnchor = true;
      if (actualSupp !== expectedSupp) {
        throw new Error('Строка ' + row + ' больше не соответствует ожидаемому списку СУПП.');
      }
    }
    if (!hasIdentifierAnchor) {
      if (!expectedText && !expectedCleanText) {
        throw new Error('Не удалось безопасно идентифицировать заявку в строке ' + row + '.');
      }
      if (actualText !== expectedText && actualText !== expectedCleanText) {
        throw new Error('Текст заявки в строке ' + row + ' изменился. Обновите очередь и повторите действие.');
      }
    }

    const favoriteRange = sh.getRange(row, colFavorite);
    if (payload.isFavorite) {
      favoriteRange.setValue(PROBLEM_PICKER_BRIDGE_FAVORITE_VALUE);
    } else {
      favoriteRange.clearContent();
    }

    return {
      sheetName: sheetName,
      row: row,
      favorite: payload.isFavorite,
      value: payload.isFavorite ? PROBLEM_PICKER_BRIDGE_FAVORITE_VALUE : ''
    };
  } finally {
    lock.releaseLock();
  }
}

function _problemPickerBridgeDeleteNewResponseInboxItem_(payload) {
  _problemPickerBridgeValidateNewResponseInboxPayload_(payload);
  const eventId = String(payload.eventId || '').trim();
  if (!eventId) throw new Error('Не передан идентификатор непрочитанного ответа.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
    const sh = _problemPickerBridgeEnsureNewResponseInboxSheet_(ss);
    const existing = _problemPickerBridgeFindNewResponseInboxEvent_(sh, eventId);
    if (existing) sh.deleteRow(existing.row);
    const remainingCount = _problemPickerBridgeReadNewResponseInboxItems_(sh).length;

    return {
      eventId: eventId,
      deleted: !!existing,
      remainingCount: remainingCount
    };
  } finally {
    lock.releaseLock();
  }
}

function _problemPickerBridgeGetNewResponseRows_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для поиска новых ответов: ' + sheetName);
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  _problemPickerBridgeRecoverPendingNewResponseInbox_(ss);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colItil = getColByHeader(sh, 'Номер ITIL');
  const colSupp = getColByHeader(sh, 'Номер СУПП (последний)');
  const colText = getColByHeader(sh, TEXT_HEADER);
  const colInfo = getColByHeader(sh, INFO_HEADER);
  const colResp = getColByHeader(sh, 'Пришел новый ответ');
  const colStatus = getColByHeader(sh, 'Статус заявки');

  if (!colItil || !colSupp || !colText || !colInfo || !colResp || !colStatus) {
    throw new Error('Не найдены колонки «Номер ITIL», «Номер СУПП (последний)», «Текст заявки», «Информация из СУПП/ITIL», «Пришел новый ответ» или «Статус заявки».');
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return {
      sheetName: sheetName,
      rowsCount: 0,
      columns: {
        itil: colItil,
        supp: colSupp,
        text: colText,
        info: colInfo,
        response: colResp,
        status: colStatus
      },
      rows: []
    };
  }

  const rowCount = lastRow - 1;
  const responseColors = sh.getRange(2, colResp, rowCount, 1).getBackgrounds();
  const minColumn = Math.min(colItil, colSupp, colText, colInfo, colStatus);
  const maxColumn = Math.max(colItil, colSupp, colText, colInfo, colStatus);
  const rowValues = sh.getRange(2, minColumn, rowCount, maxColumn - minColumn + 1).getDisplayValues();
  const targetColor = String(PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_GREEN).toLowerCase();
  const rows = [];

  for (let index = 0; index < rowCount; index++) {
    const background = String(responseColors[index] && responseColors[index][0] || '').toLowerCase();
    const values = rowValues[index] || [];
    const itilNumber = String(values[colItil - minColumn] || '').trim();
    const suppValue = String(values[colSupp - minColumn] || '').trim();
    const suppNumbers = _problemPickerBridgeExtractSuppNumbers_(suppValue);
    const suppNumber = suppNumbers.length ? suppNumbers[0] : '';
    const requestText = String(values[colText - minColumn] || '').trim();
    const infoText = String(values[colInfo - minColumn] || '').trim();
    const statusText = String(values[colStatus - minColumn] || '').trim();
    const forceEmptyItilInfoPlaceholder = _problemPickerBridgeIsSuppPlaceholderLine_(suppValue)
      && !!itilNumber
      && !!requestText
      && infoText === 'ИТИЛ'
      && statusText === 'Выполнено';
    const forceEmptySuppInfoPlaceholder = !!suppNumber
      && !!requestText
      && infoText === suppNumber
      && statusText === 'Выполнено';
    const forceEmptyInfoPlaceholder = forceEmptyItilInfoPlaceholder || forceEmptySuppInfoPlaceholder;

    if (background !== targetColor && !forceEmptyInfoPlaceholder) continue;

    rows.push({
      row: index + 2,
      itilNumber: itilNumber,
      suppValue: suppValue,
      forceEmptyInfoPlaceholder: forceEmptyInfoPlaceholder
    });
  }

  return {
    sheetName: sheetName,
    rowsCount: rowCount,
    columns: {
      itil: colItil,
      supp: colSupp,
      text: colText,
      info: colInfo,
      response: colResp,
      status: colStatus
    },
    rows: rows
  };
}

function _problemPickerBridgeGetInitiatorBackgrounds_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для чтения форматирования инициатора: ' + sheetName);
  }

  const rows = _problemPickerBridgeNormalizeRows_(payload.rows || []);

  if (!rows.length) {
    return {
      sheetName: sheetName,
      rows: []
    };
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colInitiator = _problemPickerBridgeColumn_(payload, 'initiator', sh, 'Инициатор');
  if (!colInitiator) {
    throw new Error('Не найдена колонка «Инициатор».');
  }

  const lastRow = sh.getLastRow();
  const validRows = rows.filter(function(row) {
    return row >= 2 && row <= lastRow;
  });

  if (!validRows.length) {
    return {
      sheetName: sheetName,
      column: colInitiator,
      rows: []
    };
  }

  const minRow = validRows[0];
  const maxRow = validRows[validRows.length - 1];
  const fallbackBackgrounds = _problemPickerBridgeReadRangeBackgroundsByRow_(
    sh,
    colInitiator,
    minRow,
    maxRow
  );
  const hasFallbackBackground = validRows.some(function(row) {
    const color = _problemPickerBridgeNormalizeCssColor_(fallbackBackgrounds[row]);
    return color && color !== '#ffffff';
  });

  if (hasFallbackBackground) {
    return {
      sheetName: sheetName,
      column: colInitiator,
      rows: validRows.map(function(row) {
        return {
          row: row,
          backgroundColor: _problemPickerBridgeChooseBackgroundColor_('', fallbackBackgrounds[row])
        };
      }),
      source: 'rangeBackgrounds'
    };
  }

  const rangeA1 = _problemPickerBridgeSheetRangeA1_(
    sheetName,
    colInitiator,
    minRow,
    maxRow
  );
  const fields = 'sheets(data(startRow,rowData(values(effectiveFormat(backgroundColor,backgroundColorStyle)))))';
  const url =
    'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) +
    '?includeGridData=true' +
    '&ranges=' + encodeURIComponent(rangeA1) +
    '&fields=' + encodeURIComponent(fields);

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Sheets API не вернул форматирование инициатора: HTTP ' + code + ' ' + text.slice(0, 200));
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error('Sheets API вернул некорректный JSON форматирования инициатора.');
    }

    const gridData = parsed &&
      parsed.sheets &&
      parsed.sheets[0] &&
      parsed.sheets[0].data &&
      parsed.sheets[0].data[0]
        ? parsed.sheets[0].data[0]
        : {};
    const startRowZeroBased = Number.isInteger(Number(gridData.startRow))
      ? Number(gridData.startRow)
      : minRow - 1;
    const rowData = Array.isArray(gridData.rowData) ? gridData.rowData : [];

    return {
      sheetName: sheetName,
      column: colInitiator,
      rows: validRows.map(function(row) {
        const offset = row - startRowZeroBased - 1;
        const value = offset >= 0 && rowData[offset] && rowData[offset].values && rowData[offset].values[0]
          ? rowData[offset].values[0]
          : {};
        const effectiveBackground = _problemPickerBridgeEffectiveBackgroundToCss_(
          value && value.effectiveFormat ? value.effectiveFormat : null
        );
        return {
          row: row,
          backgroundColor: _problemPickerBridgeChooseBackgroundColor_(
            effectiveBackground,
            fallbackBackgrounds[row]
          )
        };
      })
    };
  } catch (error) {
    return {
      sheetName: sheetName,
      column: colInitiator,
      rows: validRows.map(function(row) {
        return {
          row: row,
          backgroundColor: _problemPickerBridgeChooseBackgroundColor_('', fallbackBackgrounds[row])
        };
      }),
      fallback: true
    };
  }
}

function _problemPickerBridgeSaveProblem_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для классификации: ' + sheetName);
  }

  const row = Number(payload.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки: ' + payload.row);
  }

  const value = String(payload.value || '').trim();

  if (!value) {
    throw new Error('Пустое значение проблемы.');
  }

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_VALUES.indexOf(value) === -1) {
    throw new Error(
      'Значение проблемы не входит в список разрешённых: «' + value + '». ' +
      'Коды символов: ' + value.split('').map(function(ch) {
        return ch.charCodeAt(0).toString(16);
      }).join(' ')
    );
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colProb = _problemPickerBridgeColumn_(payload, 'problem', sh, PROBLEM_HEADER);

  if (!colProb) {
    throw new Error('Не найдена колонка «' + PROBLEM_HEADER + '».');
  }

  sh.getRange(row, colProb).setValue(value);

  if (Object.prototype.hasOwnProperty.call(payload, 'cleanText')) {
    const colText = _problemPickerBridgeColumn_(payload, 'text', sh, TEXT_HEADER);
    if (!colText) throw new Error('Не найдена колонка «' + TEXT_HEADER + '».');
    sh.getRange(row, colText).setValue(String(payload.cleanText || ''));
  }

  return {
    sheetName: sheetName,
    row: row,
    value: value
  };
}

function _problemPickerBridgeSaveItilData_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для ITIL-заполнения: ' + sheetName);
  }

  const row = Number(payload.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки: ' + payload.row);
  }

  const itilNumber = String(payload.itilNumber || '').trim();

  if (!itilNumber) {
    throw new Error('Пустой номер ITIL.');
  }

  const requestText = String(payload.requestText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!requestText) {
    throw new Error('Пустой текст заявки из ITIL.');
  }

  const solutionText = String(payload.solutionText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colItil = _problemPickerBridgeColumn_(payload, 'itil', sh, 'Номер ITIL');
  const colSupp = _problemPickerBridgeColumn_(payload, 'supp', sh, 'Номер СУПП (последний)');
  const colText = _problemPickerBridgeColumn_(payload, 'text', sh, TEXT_HEADER);
  const colInfo = _problemPickerBridgeColumn_(payload, 'info', sh, INFO_HEADER);

  if (!colItil || !colSupp || !colText || !colInfo) {
    throw new Error('Не найдены колонки «Номер ITIL», «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
  }

  const rowValues = _problemPickerBridgeReadRowDisplayValues_(sh, row, [colItil, colSupp, colText]);
  const rowItil = String(rowValues[colItil] || '').trim();

  if (rowItil !== itilNumber) {
    throw new Error('Строка ' + row + ' больше не соответствует ITIL ' + itilNumber + ' (сейчас: ' + rowItil + ').');
  }

  const rowSupp = String(rowValues[colSupp] || '').trim();

  if (!_problemPickerBridgeIsSuppPlaceholderLine_(rowSupp)) {
    throw new Error('Строка ' + row + ' больше не подходит для ITIL-заполнения: «Номер СУПП (последний)» = ' + rowSupp + '.');
  }

  const currentText = String(rowValues[colText] || '').trim();

  if (currentText) {
    throw new Error('Строка ' + row + ' уже содержит «Текст заявки», запись отменена.');
  }

  sh.getRange(row, colText).setValue(requestText);

  const infoRichText = _problemPickerBridgeBuildItilInfoRichText_(solutionText);
  sh.getRange(row, colInfo).setRichTextValue(infoRichText);
  _problemPickerBridgeResetRowColors_(
    sh,
    row,
    _problemPickerBridgeOptionalColumn_(payload, 'response', sh, 'Пришел новый ответ'),
    colSupp
  );

  return {
    sheetName: sheetName,
    row: row,
    itilNumber: itilNumber,
    requestTextLength: requestText.length,
    solutionTextLength: solutionText.length
  };
}

function _problemPickerBridgeSaveItilInfoData_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для обновления INFO из ITIL: ' + sheetName);
  }

  const row = Number(payload.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки: ' + payload.row);
  }

  const itilNumber = String(payload.itilNumber || '').trim();

  if (!itilNumber) {
    throw new Error('Пустой номер ITIL.');
  }

  const solutionText = String(payload.solutionText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colItil = _problemPickerBridgeColumn_(payload, 'itil', sh, 'Номер ITIL');
  const colSupp = _problemPickerBridgeColumn_(payload, 'supp', sh, 'Номер СУПП (последний)');
  const colInfo = _problemPickerBridgeColumn_(payload, 'info', sh, INFO_HEADER);

  if (!colItil || !colSupp || !colInfo) {
    throw new Error('Не найдены колонки «Номер ITIL», «Номер СУПП (последний)» или «Информация из СУПП/ITIL».');
  }

  const rowValues = _problemPickerBridgeReadRowDisplayValues_(sh, row, [colItil, colSupp]);
  const rowItil = String(rowValues[colItil] || '').trim();

  if (rowItil !== itilNumber) {
    throw new Error('Строка ' + row + ' больше не соответствует ITIL ' + itilNumber + ' (сейчас: ' + rowItil + ').');
  }

  const rowSupp = String(rowValues[colSupp] || '').trim();

  if (!_problemPickerBridgeIsSuppPlaceholderLine_(rowSupp)) {
    throw new Error('Строка ' + row + ' больше не подходит для обновления INFO из ITIL: «Номер СУПП (последний)» = ' + rowSupp + '.');
  }

  const infoRichText = _problemPickerBridgeBuildItilInfoRichText_(solutionText);
  const reviewCommit = _problemPickerBridgeCommitNewResponseInfo_({
    ss: ss,
    sh: sh,
    row: row,
    mode: 'itil',
    itilNumber: itilNumber,
    suppValue: rowSupp,
    suppNumbers: [],
    colInfo: colInfo,
    colResp: _problemPickerBridgeOptionalColumn_(payload, 'response', sh, 'Пришел новый ответ'),
    colSupp: colSupp,
    infoRichText: infoRichText,
    payload: payload
  });

  return {
    sheetName: sheetName,
    row: row,
    itilNumber: itilNumber,
    solutionTextLength: solutionText.length,
    reviewEventId: reviewCommit.eventId,
    reviewEventCreated: reviewCommit.created
  };
}

function _problemPickerBridgeBuildItilInfoRichText_(solutionText) {
  const title = 'ИТИЛ';
  const body = String(solutionText || '').trim();

  const fullText = body ? title + '\n\n' + body : title;

  // Стиль только для заголовка "ИТИЛ":
  // жирный + размер шрифта 11
  const titleStyle = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setFontSize(11)
    .build();

  const sectionStyle = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setFontSize(10)
    .build();

  // Стиль для обычного текста информации
  const normalStyle = SpreadsheetApp.newTextStyle()
    .setBold(false)
    .build();

  const builder = SpreadsheetApp.newRichTextValue()
    .setText(fullText)
    .setTextStyle(0, title.length, titleStyle);

  if (fullText.length > title.length) {
    builder.setTextStyle(title.length, fullText.length, normalStyle);
  }

  _problemPickerBridgeApplyItilInfoStyles_(builder, fullText, title, titleStyle, sectionStyle);

  return builder.build();
}

function _problemPickerBridgeApplyItilInfoStyles_(builder, text, title, titleStyle, sectionStyle) {
  const sectionHeaders = {
    'Решение обращения:': true,
    'Дополнительная информация:': true
  };
  let pos = 0;

  while (pos < text.length) {
    const nextNewline = text.indexOf('\n', pos);
    const end = nextNewline === -1 ? text.length : nextNewline;
    const line = text.substring(pos, end);
    const trimmed = line.trim();

    if (trimmed === title) {
      builder.setTextStyle(pos, end, titleStyle);
    } else if (sectionHeaders[trimmed]) {
      builder.setTextStyle(pos, end, sectionStyle);
    }

    pos = end + 1;
  }
}

function _problemPickerBridgeSaveSuppData_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для СУПП-заполнения: ' + sheetName);
  }

  const row = Number(payload.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки: ' + payload.row);
  }

  const suppNumbers = _problemPickerBridgeNormalizeSuppNumbersList_(
    Array.isArray(payload.suppNumbers) && payload.suppNumbers.length
      ? payload.suppNumbers
      : [payload.suppNumber]
  );
  const suppNumber = String(suppNumbers[0] || '').trim();

  if (!suppNumber) {
    throw new Error('Некорректный номер СУПП: ' + payload.suppNumber);
  }

  const requestText = String(payload.requestText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!requestText) {
    throw new Error('Пустой текст заявки из СУПП.');
  }

  const infoText = String(payload.infoText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colSupp = _problemPickerBridgeColumn_(payload, 'supp', sh, 'Номер СУПП (последний)');
  const colText = _problemPickerBridgeColumn_(payload, 'text', sh, TEXT_HEADER);
  const colInfo = _problemPickerBridgeColumn_(payload, 'info', sh, INFO_HEADER);

  if (!colSupp || !colText || !colInfo) {
    throw new Error('Не найдены колонки «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
  }

  const rowValues = _problemPickerBridgeReadRowDisplayValues_(sh, row, [colSupp, colText]);
  const rowSupp = String(rowValues[colSupp] || '').trim();
  const rowSuppNumbers = _problemPickerBridgeExtractSuppNumbers_(rowSupp);

  if (suppNumbers.some(function(number) { return rowSuppNumbers.indexOf(number) === -1; })) {
    throw new Error('Строка ' + row + ' больше не содержит ожидаемый список СУПП (сейчас: ' + rowSupp + ').');
  }

  const currentText = String(rowValues[colText] || '').trim();

  if (currentText) {
    throw new Error('Строка ' + row + ' уже содержит «Текст заявки», запись отменена.');
  }

  sh.getRange(row, colText).setValue(requestText);

  const infoRichText = _problemPickerBridgeBuildSuppInfoRichText_(suppNumbers, infoText);
  sh.getRange(row, colInfo).setRichTextValue(infoRichText);
  _problemPickerBridgeResetRowColors_(
    sh,
    row,
    _problemPickerBridgeOptionalColumn_(payload, 'response', sh, 'Пришел новый ответ'),
    colSupp
  );

  return {
    sheetName: sheetName,
    row: row,
    suppNumber: suppNumber,
    suppNumbers: suppNumbers,
    requestTextLength: requestText.length,
    infoTextLength: infoRichText.getText().length
  };
}

function _problemPickerBridgeSaveSuppInfoData_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для обновления INFO из СУПП: ' + sheetName);
  }

  const row = Number(payload.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки: ' + payload.row);
  }

  const suppNumbers = _problemPickerBridgeNormalizeSuppNumbersList_(
    Array.isArray(payload.suppNumbers) && payload.suppNumbers.length
      ? payload.suppNumbers
      : [payload.suppNumber]
  );
  const suppNumber = String(suppNumbers[0] || '').trim();

  if (!suppNumber) {
    throw new Error('Некорректный номер СУПП: ' + payload.suppNumber);
  }

  const infoText = String(payload.infoText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colSupp = _problemPickerBridgeColumn_(payload, 'supp', sh, 'Номер СУПП (последний)');
  const colInfo = _problemPickerBridgeColumn_(payload, 'info', sh, INFO_HEADER);

  if (!colSupp || !colInfo) {
    throw new Error('Не найдены колонки «Номер СУПП (последний)» или «Информация из СУПП/ITIL».');
  }

  const rowValues = _problemPickerBridgeReadRowDisplayValues_(sh, row, [colSupp]);
  const rowSupp = String(rowValues[colSupp] || '').trim();
  const rowSuppNumbers = _problemPickerBridgeExtractSuppNumbers_(rowSupp);

  if (suppNumbers.some(function(number) { return rowSuppNumbers.indexOf(number) === -1; })) {
    throw new Error('Строка ' + row + ' больше не содержит ожидаемый список СУПП (сейчас: ' + rowSupp + ').');
  }

  const infoRichText = _problemPickerBridgeBuildSuppInfoRichText_(suppNumbers, infoText);
  const reviewCommit = _problemPickerBridgeCommitNewResponseInfo_({
    ss: ss,
    sh: sh,
    row: row,
    mode: 'supp',
    itilNumber: '',
    suppValue: rowSupp,
    suppNumbers: suppNumbers,
    colInfo: colInfo,
    colResp: _problemPickerBridgeOptionalColumn_(payload, 'response', sh, 'Пришел новый ответ'),
    colSupp: colSupp,
    infoRichText: infoRichText,
    payload: payload
  });

  return {
    sheetName: sheetName,
    row: row,
    suppNumber: suppNumber,
    suppNumbers: suppNumbers,
    infoTextLength: infoRichText.getText().length,
    reviewEventId: reviewCommit.eventId,
    reviewEventCreated: reviewCommit.created
  };
}

function _problemPickerBridgeBuildSuppInfoRichText_(suppNumbers, infoText) {
  const headers = _problemPickerBridgeNormalizeSuppNumbersList_(suppNumbers);
  const header = String(headers[0] || '').trim();
  let fullText = String(infoText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (fullText.indexOf(header) !== 0) {
    fullText = header + (fullText ? '\n\n' + fullText : '');
  }

  if (fullText) {
    fullText = fullText.trim() + '\n\n';
  } else {
    fullText = header + '\n\n';
  }

  const normalStyle = SpreadsheetApp.newTextStyle()
    .setBold(false)
    .setFontSize(10)
    .build();

  const headerStyle = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setFontSize(11)
    .build();

  const logStyle = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setFontSize(10)
    .build();

  const builder = SpreadsheetApp.newRichTextValue()
    .setText(fullText)
    .setTextStyle(0, fullText.length, normalStyle);

  _problemPickerBridgeApplySuppInfoStyles_(builder, fullText, headers, headerStyle, logStyle);

  return builder.build();
}

function _problemPickerBridgeApplySuppInfoStyles_(builder, text, suppNumbers, headerStyle, logStyle) {
  const logLineRe = /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\/.*$/;
  const sectionHeaders = {
    'Причина возникновения инцидента:': true,
    'Решение обращения:': true,
    'Дополнительная информация:': true,
    'Решение обращения (ITIL):': true,
    'Дополнительная информация (ITIL):': true
  };
  const headerSet = {};
  _problemPickerBridgeNormalizeSuppNumbersList_(suppNumbers).forEach(function(value) {
    headerSet[value] = true;
  });
  let pos = 0;

  while (pos < text.length) {
    const nextNewline = text.indexOf('\n', pos);
    const end = nextNewline === -1 ? text.length : nextNewline;
    const line = text.substring(pos, end);
    const trimmed = line.trim();

    if (headerSet[trimmed]) {
      builder.setTextStyle(pos, end, headerStyle);
    } else if (sectionHeaders[trimmed] || logLineRe.test(trimmed)) {
      builder.setTextStyle(pos, end, logStyle);
    }

    pos = end + 1;
  }
}

function _problemPickerBridgeResetInfoEditColors_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для сброса цвета: ' + sheetName);
  }

  const rows = _problemPickerBridgeNormalizeRows_(payload.rows || []);

  if (!rows.length) {
    return {
      sheetName: sheetName,
      rowsCount: 0
    };
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const colResp = getColByHeader(sh, 'Пришел новый ответ');
  const colSupp = getColByHeader(sh, 'Номер СУПП (последний)');

  if (!colResp || !colSupp) {
    throw new Error('Не найдены колонки «Пришел новый ответ» или «Номер СУПП (последний)».');
  }

  const lastRow = sh.getLastRow();
  const validRows = rows.filter(function(row) {
    return row >= 2 && row <= lastRow;
  });

  if (!validRows.length) {
    return {
      sheetName: sheetName,
      rowsCount: 0
    };
  }

  const ranges = [];
  const colRespA1 = _problemPickerBridgeColumnToA1_(colResp);
  const colSuppA1 = _problemPickerBridgeColumnToA1_(colSupp);
  const segments = _problemPickerBridgeBuildRowSegments_(validRows);

  segments.forEach(function(segment) {
    const endRow = segment.start + segment.count - 1;
    ranges.push(colRespA1 + segment.start + ':' + colRespA1 + endRow);
    ranges.push(colSuppA1 + segment.start + ':' + colSuppA1 + endRow);
  });

  sh.getRangeList(ranges).setBackground('#f5f5f5');

  return {
    sheetName: sheetName,
    rowsCount: validRows.length,
    rangesCount: ranges.length
  };
}

function _problemPickerBridgeGetItilImportSheet_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();
  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_SHEET).trim();
  if (sheetName !== PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_SHEET) {
    throw new Error('Некорректный лист ITIL-импорта: ' + sheetName);
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  return sh;
}

function _problemPickerBridgeNormalizeItilImportRows_(rows) {
  const source = Array.isArray(rows) ? rows : [];
  return source.map(function(row, index) {
    if (!Array.isArray(row)) {
      throw new Error('Строка ITIL-импорта ' + (index + 1) + ' имеет некорректный формат.');
    }
    if (row.length !== PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_COLUMN_COUNT) {
      throw new Error(
        'Строка ITIL-импорта ' + (index + 1) +
        ' содержит ' + row.length +
        ' ячеек вместо ' + PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_COLUMN_COUNT + '.'
      );
    }
    return row.map(function(value) {
      return String(value == null ? '' : value);
    });
  });
}

function _problemPickerBridgeValidateItilImportHeaderRow_(headerRow) {
  const mismatches = [];

  PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_HEADERS.forEach(function(expected, index) {
    const actual = String(headerRow[index] || '').trim();
    if (actual === expected) return;
    mismatches.push(
      (index + 1) + '. ожидалось «' + expected + '», получено «' + (actual || 'пусто') + '»'
    );
  });

  if (mismatches.length) {
    throw new Error('В первой строке вставки неожиданные заголовки.\n' + mismatches.join('\n'));
  }
}

function _problemPickerBridgeImportItilTableRows_(payload) {
  const sh = _problemPickerBridgeGetItilImportSheet_(payload);
  const startRow = Number(payload.startRow);

  if (!Number.isInteger(startRow) || startRow < PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_START_ROW) {
    throw new Error('Некорректная стартовая строка ITIL-импорта: ' + payload.startRow);
  }

  const rows = _problemPickerBridgeNormalizeItilImportRows_(payload.rows);
  if (!rows.length) {
    return {
      sheetName: sh.getName(),
      sheetId: sh.getSheetId(),
      writtenRows: 0,
      startRow: startRow
    };
  }

  if (startRow === PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_START_ROW) {
    _problemPickerBridgeValidateItilImportHeaderRow_(rows[0]);
  }

  const requiredLastRow = startRow + rows.length - 1;
  if (requiredLastRow > sh.getMaxRows()) {
    sh.insertRowsAfter(sh.getMaxRows(), requiredLastRow - sh.getMaxRows());
  }

  sh.getRange(startRow, 1, rows.length, PROBLEM_PICKER_BRIDGE_ITIL_IMPORT_COLUMN_COUNT)
    .setValues(rows);

  return {
    sheetName: sh.getName(),
    sheetId: sh.getSheetId(),
    writtenRows: rows.length,
    startRow: startRow,
    endRow: requiredLastRow
  };
}

function _problemPickerBridgeSaveAiSearchResults_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();
  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();
  if (sheetName !== PROBLEM_PICKER_BRIDGE_AI_SEARCH_RESULT_SHEET) {
    throw new Error('Некорректный лист результатов ИИ-поиска: ' + sheetName);
  }

  const headers = Array.isArray(payload.headers) ? payload.headers.map(function(value) {
    return String(value == null ? '' : value);
  }) : [];
  if (!headers.length) {
    throw new Error('Не переданы заголовки результатов ИИ-поиска.');
  }

  const rows = Array.isArray(payload.rows) ? payload.rows.map(function(row) {
    return Array.isArray(row) ? row.map(function(value) {
      return String(value == null ? '' : value);
    }) : [];
  }) : [];

  rows.forEach(function(row, index) {
    if (row.length !== headers.length) {
      throw new Error('Строка результата ИИ-поиска ' + (index + 1) + ' содержит ' + row.length + ' ячеек вместо ' + headers.length + '.');
    }
  });

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = _problemPickerBridgePrepareAiSearchResultSheet_(ss, sheetName, headers.length, rows.length);
  const headerMap = _problemPickerBridgeBuildAiSearchHeaderMap_(sh, headers, rows);
  const writableRowCount = Math.max(rows.length, 1);

  sh.getRange(
    PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW,
    1,
    writableRowCount,
    headerMap.lastColumn
  ).clearContent();

  if (rows.length) {
    const values = rows.map(function(sourceRow) {
      const targetRow = Array(headerMap.lastColumn).fill('');
      sourceRow.forEach(function(value, index) {
        const targetColumn = headerMap.sourceIndexToTargetColumn[index];
        if (!targetColumn) return;
        targetRow[targetColumn - 1] = String(value == null ? '' : value);
      });
      return targetRow;
    });
    sh.getRange(PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW, 1, values.length, headerMap.lastColumn)
      .setValues(values);
    _applyInfoEditSideEffects_(
      sh,
      PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW,
      values.length,
      { resetColors: false, showFormattingToast: false }
    );
  }

  return {
    sheetName: sheetName,
    sheetId: sh.getSheetId(),
    rowsCount: rows.length,
    columnsCount: headers.length
  };
}

function _problemPickerBridgePrepareAiSearchResultSheet_(ss, sheetName, headersCount, rowsCount) {
  const template = ss.getSheetByName(PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_SHEET);
  if (!template) {
    throw new Error('Не найден шаблон листа результатов ИИ-поиска: ' + PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_SHEET);
  }

  const existing = ss.getSheetByName(sheetName);
  if (existing) {
    ss.deleteSheet(existing);
  }

  const sh = template.copyTo(ss).setName(sheetName);
  if (sh.isSheetHidden()) sh.showSheet();

  if (sh.getMaxRows() < PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW) {
    sh.insertRowsAfter(sh.getMaxRows(), PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW - sh.getMaxRows());
  }

  const lastColumn = sh.getLastColumn();
  if (rowsCount > 1) {
    sh.insertRowsAfter(PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW, rowsCount - 1);
    sh.getRange(PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW, 1, 1, lastColumn)
      .copyTo(
        sh.getRange(PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW + 1, 1, rowsCount - 1, lastColumn)
      );
  }

  sh.getRange(
    PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW,
    1,
    sh.getMaxRows() - PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW + 1,
    lastColumn
  ).clearContent();

  return sh;
}

function _problemPickerBridgeBuildAiSearchHeaderMap_(sh, sourceHeaders, rows) {
  const templateHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function(value) {
    return String(value == null ? '' : value).trim();
  });
  const templateHeaderToColumn = {};

  templateHeaders.forEach(function(header, index) {
    if (header && !templateHeaderToColumn[header]) {
      templateHeaderToColumn[header] = index + 1;
    }
  });

  const sourceIndexToTargetColumn = [];
  const missingHeaders = [];

  sourceHeaders.forEach(function(header, index) {
    const normalizedHeader = String(header == null ? '' : header).trim();
    const targetColumn = templateHeaderToColumn[normalizedHeader] || 0;
    sourceIndexToTargetColumn[index] = targetColumn;
    if (targetColumn) return;

    const hasNonEmptyValues = rows.some(function(row) {
      return String(row && row[index] != null ? row[index] : '').trim() !== '';
    });
    if (hasNonEmptyValues || normalizedHeader) {
      missingHeaders.push(normalizedHeader || ('Колонка #' + (index + 1)));
    }
  });

  if (missingHeaders.length) {
    throw new Error('В шаблоне не найдены колонки для результатов ИИ-поиска: ' + missingHeaders.join(', '));
  }

  return {
    lastColumn: templateHeaders.length,
    sourceIndexToTargetColumn: sourceIndexToTargetColumn
  };
}

function _problemPickerBridgeGetWssSheet_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();
  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || PROBLEM_PICKER_BRIDGE_WSS_SHEET).trim();
  if (sheetName !== PROBLEM_PICKER_BRIDGE_WSS_SHEET) {
    throw new Error('Некорректный лист WSS-импорта: ' + sheetName);
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  return sh;
}

function _problemPickerBridgeGetWssHeaderMap_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function(value) {
    return String(value == null ? '' : value).trim();
  });
  const map = {};

  headers.forEach(function(header, index) {
    if (header && !map[header]) map[header] = index + 1;
  });

  const missing = PROBLEM_PICKER_BRIDGE_WSS_HEADERS.filter(function(header) {
    return !map[header];
  });
  if (missing.length) {
    throw new Error('На листе WSS не найдены колонки: ' + missing.join(', '));
  }

  return {
    columns: map,
    lastColumn: headers.length
  };
}

function _problemPickerBridgeNormalizeWssTimestamp_(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return [
      match[1],
      match[2],
      match[3],
      ('0' + match[4]).slice(-2),
      match[5],
      match[6] || '00'
    ].join('');
  }

  match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return [
      match[3],
      match[2],
      match[1],
      ('0' + match[4]).slice(-2),
      match[5],
      match[6] || '00'
    ].join('');
  }

  return text;
}

function _problemPickerBridgeCompareWssParsedAt_(incoming, existing) {
  const left = _problemPickerBridgeNormalizeWssTimestamp_(incoming);
  const right = _problemPickerBridgeNormalizeWssTimestamp_(existing);
  if (!left && !right) return 0;
  if (left && !right) return 1;
  if (!left && right) return -1;
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

function _problemPickerBridgeGetWssExistingRows_(sh, headerMap) {
  const lastRow = sh.getLastRow();
  const rows = {};
  if (lastRow < 2) return rows;

  const columns = headerMap.columns;
  const colWss = columns['WSS ID'];
  const colParsed = columns['last_parsed_at'];
  const minColumn = Math.min(colWss, colParsed);
  const maxColumn = Math.max(colWss, colParsed);
  const values = sh.getRange(2, minColumn, lastRow - 1, maxColumn - minColumn + 1).getDisplayValues();

  values.forEach(function(row, index) {
    const wssId = String(row[colWss - minColumn] || '').trim();
    if (!wssId) return;
    rows[wssId] = {
      row: index + 2,
      lastParsedAt: String(row[colParsed - minColumn] || '').trim()
    };
  });

  return rows;
}

function _problemPickerBridgeGetWssImportState_(payload) {
  const sh = _problemPickerBridgeGetWssSheet_(payload);
  const headerMap = _problemPickerBridgeGetWssHeaderMap_(sh);
  const existing = _problemPickerBridgeGetWssExistingRows_(sh, headerMap);
  const rows = Object.keys(existing).map(function(wssId) {
    return {
      wssId: wssId,
      row: existing[wssId].row,
      lastParsedAt: existing[wssId].lastParsedAt
    };
  });

  return {
    sheetName: sh.getName(),
    sheetId: sh.getSheetId(),
    rowsCount: rows.length,
    rows: rows
  };
}

function _problemPickerBridgeNormalizeWssText_(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function _problemPickerBridgeTruncateWssText_(value, limit) {
  const text = _problemPickerBridgeNormalizeWssText_(value);
  const maxLength = Math.max(1000, Number(limit) || PROBLEM_PICKER_BRIDGE_WSS_TEXT_LIMIT);
  const marker = '\n\n[текст сокращен]';
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - marker.length)).replace(/\s+$/g, '') + marker;
}

function _problemPickerBridgeBuildWssRichTextFromSegments_(segments, limit) {
  const maxLength = Math.max(1000, Number(limit) || PROBLEM_PICKER_BRIDGE_WSS_TEXT_LIMIT);
  const marker = '\n\n[текст сокращен]';
  const markerLength = marker.length;
  const maxBeforeMarker = Math.max(0, maxLength - markerLength);
  const normalStyle = SpreadsheetApp.newTextStyle()
    .setBold(false)
    .setFontSize(10)
    .build();
  const boldStyle = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setFontSize(10)
    .build();
  const historyHeaderStyle = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setFontSize(11)
    .build();
  const textParts = [];
  const styledRanges = [];
  let length = 0;
  let truncated = false;

  (segments || []).forEach(function(segment) {
    if (truncated) return;
    const text = String(segment && segment.text != null ? segment.text : '');
    if (!text) return;
    const remaining = maxBeforeMarker - length;
    if (remaining <= 0) {
      truncated = true;
      return;
    }

    const part = text.length > remaining ? text.slice(0, remaining) : text;
    const start = length;
    textParts.push(part);
    length += part.length;
    if (part.length) {
      if (segment && segment.style === 'historyHeader') {
        styledRanges.push({ start: start, end: length, style: historyHeaderStyle });
      } else if (segment && segment.bold) {
        styledRanges.push({ start: start, end: length, style: boldStyle });
      }
    }
    if (part.length < text.length) truncated = true;
  });

  let fullText = textParts.join('').replace(/\s+$/g, '');
  if (truncated) fullText += marker;
  if (!fullText) return null;

  const builder = SpreadsheetApp.newRichTextValue()
    .setText(fullText)
    .setTextStyle(0, fullText.length, normalStyle);

  styledRanges.forEach(function(range) {
    const start = Math.max(0, Math.min(range.start, fullText.length));
    const end = Math.max(start, Math.min(range.end, fullText.length));
    if (end > start) builder.setTextStyle(start, end, range.style);
  });

  return builder.build();
}

function _problemPickerBridgeBuildWssHistoryRichText_(entries, limit) {
  const segments = [];
  (Array.isArray(entries) ? entries : []).forEach(function(entry, index) {
    const date = _problemPickerBridgeNormalizeWssText_(entry && entry.date);
    const user = _problemPickerBridgeNormalizeWssText_(entry && entry.user);
    const notified = _problemPickerBridgeNormalizeWssText_(entry && entry.notified);
    const solution = _problemPickerBridgeNormalizeWssText_(entry && entry.solution);
    const comment = _problemPickerBridgeNormalizeWssText_(entry && entry.comment) || 'комментария нет';
    const headerBase = [date, user].filter(function(value) { return !!value; }).join(' / ');
    const header = notified
      ? (headerBase ? headerBase + ' → ' + notified : '→ ' + notified)
      : headerBase;
    if (!header && !solution && !comment) return;
    if (index > 0) segments.push({ text: '\n\n', bold: false });
    if (header) segments.push({ text: header + '\n', style: 'historyHeader' });
    if (solution) segments.push({ text: solution + '\n', bold: true });
    segments.push({ text: comment, bold: false });
  });
  return _problemPickerBridgeBuildWssRichTextFromSegments_(segments, limit);
}

function _problemPickerBridgeBuildWssAttachmentsRichText_(entries, limit) {
  const segments = [];
  (Array.isArray(entries) ? entries : []).forEach(function(entry, index) {
    const title = _problemPickerBridgeNormalizeWssText_(entry && entry.title);
    const text = _problemPickerBridgeNormalizeWssText_(entry && entry.text);
    if (!title || !text) return;
    if (index > 0) segments.push({ text: '\n\n', bold: false });
    segments.push({ text: title + '\n', bold: true });
    segments.push({ text: text, bold: false });
  });
  return _problemPickerBridgeBuildWssRichTextFromSegments_(segments, limit);
}

function _problemPickerBridgeCopyWssTemplateRows_(sh, startRow, count, lastColumn) {
  if (count <= 0) return;
  const templateRow = PROBLEM_PICKER_BRIDGE_WSS_TEMPLATE_ROW;
  const templateRange = sh.getRange(templateRow, 1, 1, lastColumn);
  if (startRow === templateRow) {
    if (count > 1) {
      templateRange.copyTo(sh.getRange(templateRow + 1, 1, count - 1, lastColumn), { formatOnly: true });
    }
    return;
  }
  templateRange.copyTo(sh.getRange(startRow, 1, count, lastColumn), { formatOnly: true });
}

function _problemPickerBridgeEnsureWssRows_(sh, requiredLastRow) {
  const targetLastRow = Number(requiredLastRow);
  if (!Number.isInteger(targetLastRow) || targetLastRow <= sh.getMaxRows()) return;
  sh.insertRowsAfter(sh.getMaxRows(), targetLastRow - sh.getMaxRows());
}

function _problemPickerBridgeExpandWssConditionalFormatting_(sh, oldLastRow, newLastRow) {
  if (newLastRow <= oldLastRow) return;
  const rules = sh.getConditionalFormatRules();
  if (!rules || !rules.length) return;

  const updatedRules = rules.map(function(rule) {
    const ranges = rule.getRanges();
    let changed = false;
    const nextRanges = ranges.map(function(range) {
      const startRow = range.getRow();
      const lastRow = range.getLastRow();
      if (startRow <= oldLastRow && lastRow >= oldLastRow && lastRow < newLastRow) {
        changed = true;
        return sh.getRange(startRow, range.getColumn(), newLastRow - startRow + 1, range.getNumColumns());
      }
      return range;
    });
    return changed ? rule.copy().setRanges(nextRanges).build() : rule;
  });

  sh.setConditionalFormatRules(updatedRules);
}

function _problemPickerBridgeSetWssRowValues_(sh, rowNumber, headerMap, sourceRow, textLimit) {
  const columns = headerMap.columns;
  const valuesObject = sourceRow && sourceRow.values && typeof sourceRow.values === 'object'
    ? sourceRow.values
    : {};
  const rowValues = Array(headerMap.lastColumn).fill('');

  PROBLEM_PICKER_BRIDGE_WSS_HEADERS.forEach(function(header) {
    const column = columns[header];
    if (!column) return;
    if (header === 'Расширенная история решений' || header === 'Доп. файлы') {
      rowValues[column - 1] = '';
      return;
    }
    rowValues[column - 1] = _problemPickerBridgeTruncateWssText_(valuesObject[header], textLimit);
  });

  sh.getRange(rowNumber, 1, 1, headerMap.lastColumn).setValues([rowValues]);

  const historyColumn = columns['Расширенная история решений'];
  const attachmentsColumn = columns['Доп. файлы'];
  if (historyColumn) {
    const historyRichText = _problemPickerBridgeBuildWssHistoryRichText_(sourceRow && sourceRow.historyEntries, textLimit);
    if (historyRichText) sh.getRange(rowNumber, historyColumn).setRichTextValue(historyRichText);
    else sh.getRange(rowNumber, historyColumn).setValue('');
  }
  if (attachmentsColumn) {
    const attachmentsRichText = _problemPickerBridgeBuildWssAttachmentsRichText_(sourceRow && sourceRow.attachmentEntries, textLimit);
    if (attachmentsRichText) sh.getRange(rowNumber, attachmentsColumn).setRichTextValue(attachmentsRichText);
    else sh.getRange(rowNumber, attachmentsColumn).setValue('');
  }
}

function _problemPickerBridgeImportWssArchiveRows_(payload) {
  const sh = _problemPickerBridgeGetWssSheet_(payload);
  const headerMap = _problemPickerBridgeGetWssHeaderMap_(sh);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const textLimit = Math.min(
    PROBLEM_PICKER_BRIDGE_WSS_TEXT_LIMIT,
    Math.max(1000, Number(payload.textLimit) || PROBLEM_PICKER_BRIDGE_WSS_TEXT_LIMIT)
  );
  if (!rows.length) {
    return {
      sheetName: sh.getName(),
      sheetId: sh.getSheetId(),
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      createdRows: [],
      updatedRows: []
    };
  }

  const oldLastRow = sh.getLastRow();
  const existing = _problemPickerBridgeGetWssExistingRows_(sh, headerMap);
  const existingRows = Object.keys(existing).map(function(wssId) {
    return Number(existing[wssId] && existing[wssId].row || 0);
  }).filter(function(row) {
    return Number.isInteger(row) && row >= PROBLEM_PICKER_BRIDGE_WSS_TEMPLATE_ROW;
  });
  const maxExistingRow = existingRows.length
    ? Math.max.apply(null, existingRows)
    : 0;
  const writePlan = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const createdRows = [];
  const updatedRows = [];

  rows.forEach(function(sourceRow) {
    const wssId = String(sourceRow && sourceRow.wssId || '').trim();
    const incomingParsedAt = String(sourceRow && sourceRow.lastParsedAt || '').trim();
    if (!wssId) {
      failed += 1;
      return;
    }

    const existingRow = existing[wssId] || null;
    if (existingRow && _problemPickerBridgeCompareWssParsedAt_(incomingParsedAt, existingRow.lastParsedAt) <= 0) {
      skipped += 1;
      return;
    }

    if (existingRow) {
      writePlan.push({
        type: 'update',
        row: existingRow.row,
        sourceRow: sourceRow
      });
      updated += 1;
      return;
    }

    writePlan.push({
      type: 'create',
      row: 0,
      sourceRow: sourceRow
    });
    created += 1;
  });

  const createItems = writePlan.filter(function(item) { return item.type === 'create'; });
  if (createItems.length) {
    const firstCreateRow = maxExistingRow
      ? Math.max(oldLastRow, maxExistingRow) + 1
      : PROBLEM_PICKER_BRIDGE_WSS_TEMPLATE_ROW;
    const newLastRow = firstCreateRow + createItems.length - 1;
    _problemPickerBridgeEnsureWssRows_(sh, newLastRow);
    _problemPickerBridgeCopyWssTemplateRows_(sh, firstCreateRow, createItems.length, headerMap.lastColumn);
    createItems.forEach(function(item, index) {
      item.row = firstCreateRow + index;
      const wssId = String(item.sourceRow && item.sourceRow.wssId || '').trim();
      existing[wssId] = {
        row: item.row,
        lastParsedAt: ''
      };
    });
    _problemPickerBridgeExpandWssConditionalFormatting_(
      sh,
      Math.max(oldLastRow, PROBLEM_PICKER_BRIDGE_WSS_TEMPLATE_ROW),
      newLastRow
    );
  }

  writePlan.forEach(function(item) {
    try {
      _problemPickerBridgeSetWssRowValues_(sh, item.row, headerMap, item.sourceRow, textLimit);
      const changeInfo = _problemPickerBridgeBuildWssChangeInfo_(item);
      if (item.type === 'create') createdRows.push(changeInfo);
      if (item.type === 'update') updatedRows.push(changeInfo);
    } catch (error) {
      failed += 1;
      if (item.type === 'create') created = Math.max(0, created - 1);
      if (item.type === 'update') updated = Math.max(0, updated - 1);
    }
  });

  return {
    sheetName: sh.getName(),
    sheetId: sh.getSheetId(),
    created: created,
    updated: updated,
    skipped: skipped,
    failed: failed,
    createdRows: createdRows,
    updatedRows: updatedRows,
    rowsCount: rows.length
  };
}

function _problemPickerBridgeBuildWssChangeInfo_(item) {
  const sourceRow = item && item.sourceRow ? item.sourceRow : {};
  return {
    type: item && item.type ? String(item.type) : '',
    row: Number(item && item.row || 0),
    wssId: String(sourceRow.wssId || ''),
    lastParsedAt: String(sourceRow.lastParsedAt || '')
  };
}

function _problemPickerBridgeNormalizeRows_(rows) {
  const source = Array.isArray(rows) ? rows : [rows];
  const unique = {};

  source.forEach(function(value) {
    const row = Number(value);
    if (Number.isInteger(row) && row >= 2) {
      unique[row] = true;
    }
  });

  return Object.keys(unique).map(function(value) {
    return Number(value);
  }).sort(function(a, b) {
    return a - b;
  });
}

function _problemPickerBridgeBuildRowSegments_(rows) {
  const segments = [];
  let start = 0;
  let prev = 0;

  rows.forEach(function(row) {
    if (!start) {
      start = row;
      prev = row;
      return;
    }

    if (row === prev + 1) {
      prev = row;
      return;
    }

    segments.push({ start: start, count: prev - start + 1 });
    start = row;
    prev = row;
  });

  if (start) {
    segments.push({ start: start, count: prev - start + 1 });
  }

  return segments;
}

function _problemPickerBridgeColumnToA1_(column) {
  let value = Number(column);
  let result = '';

  while (value > 0) {
    const mod = (value - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    value = Math.floor((value - mod) / 26);
  }

  return result;
}

function _problemPickerBridgeSheetRangeA1_(sheetName, column, startRow, endRow) {
  const safeSheetName = String(sheetName || '').replace(/'/g, "''");
  const col = _problemPickerBridgeColumnToA1_(column);
  return "'" + safeSheetName + "'!" + col + startRow + ':' + col + endRow;
}

function _problemPickerBridgeReadRangeBackgroundsByRow_(sh, column, startRow, endRow) {
  const rowCount = Math.max(0, Number(endRow) - Number(startRow) + 1);
  if (!sh || !column || rowCount <= 0) return {};

  const backgrounds = sh.getRange(startRow, column, rowCount, 1).getBackgrounds();
  const result = {};

  for (let index = 0; index < rowCount; index++) {
    result[startRow + index] = _problemPickerBridgeNormalizeCssColor_(backgrounds[index] && backgrounds[index][0]);
  }

  return result;
}

function _problemPickerBridgeNormalizeCssColor_(value) {
  const color = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : '';
}

function _problemPickerBridgeChooseBackgroundColor_(primary, fallback) {
  const primaryColor = _problemPickerBridgeNormalizeCssColor_(primary);
  const fallbackColor = _problemPickerBridgeNormalizeCssColor_(fallback);

  if (primaryColor && primaryColor !== '#ffffff') return primaryColor;
  if (fallbackColor && fallbackColor !== '#ffffff') return fallbackColor;
  return primaryColor || fallbackColor || '';
}

function _problemPickerBridgeEffectiveBackgroundToCss_(effectiveFormat) {
  if (!effectiveFormat || typeof effectiveFormat !== 'object') return '';

  const styleColor = effectiveFormat.backgroundColorStyle &&
    effectiveFormat.backgroundColorStyle.rgbColor
      ? effectiveFormat.backgroundColorStyle.rgbColor
      : null;
  return _problemPickerBridgeRgbColorToCss_(styleColor || effectiveFormat.backgroundColor);
}

function _problemPickerBridgeRgbColorToCss_(color) {
  if (!color || typeof color !== 'object') return '';

  function component(value) {
    const number = typeof value === 'number' ? value : 0;
    const bounded = Math.max(0, Math.min(1, number));
    const intValue = Math.round(bounded * 255);
    return ('0' + intValue.toString(16)).slice(-2);
  }

  return '#' + component(color.red) + component(color.green) + component(color.blue);
}

function _problemPickerBridgeJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
