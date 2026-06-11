const PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
const PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS = ['Заявки', 'Заявки (наши)'];
const PROBLEM_PICKER_BRIDGE_NEW_RESPONSE_GREEN = '#00ff00';
const PROBLEM_PICKER_BRIDGE_AI_SEARCH_RESULT_SHEET = 'Поиск заявок (ИИ)';
const PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_SHEET = 'Шаблон (Поиск заявок (ИИ))';
const PROBLEM_PICKER_BRIDGE_AI_SEARCH_TEMPLATE_ROW = 2;

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
    } else if (payload.action === 'saveItilData') {
      result = _problemPickerBridgeSaveItilData_(payload);
    } else if (payload.action === 'saveSuppData') {
      result = _problemPickerBridgeSaveSuppData_(payload);
    } else if (payload.action === 'getNewResponseRows') {
      result = _problemPickerBridgeGetNewResponseRows_(payload);
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
    solutionTextLength: solutionText.length
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
    infoTextLength: infoRichText.getText().length
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
    } else if (logLineRe.test(trimmed)) {
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
