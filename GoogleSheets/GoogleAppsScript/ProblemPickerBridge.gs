const PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID = '1A7bsMpcMegLvTIpdRBa06TD5RxGi64Cw3goYydbujNo';
const PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS = ['Заявки', 'Заявки (наши)'];

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
    } else if (payload.action === 'resetInfoEditColors') {
      result = _problemPickerBridgeResetInfoEditColors_(payload);
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

function _problemPickerBridgeResetRowColors_(sh, row, colResp, colSupp) {
  const ranges = [];

  if (colResp) ranges.push(_problemPickerBridgeColumnToA1_(colResp) + row);
  if (colSupp) ranges.push(_problemPickerBridgeColumnToA1_(colSupp) + row);
  if (ranges.length) sh.getRangeList(ranges).setBackground('#f5f5f5');
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

  if (rowSupp !== '–') {
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

  // Стиль для обычного текста решения
  const normalStyle = SpreadsheetApp.newTextStyle()
    .setBold(false)
    .build();

  const builder = SpreadsheetApp.newRichTextValue()
    .setText(fullText)
    .setTextStyle(0, title.length, titleStyle);

  if (fullText.length > title.length) {
    builder.setTextStyle(title.length, fullText.length, normalStyle);
  }

  return builder.build();
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

  const suppNumber = String(payload.suppNumber || '').trim();

  if (!/^ЗНР-[A-Za-zА-Яа-яЁё0-9-]+$/.test(suppNumber)) {
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

  if (rowSupp.indexOf(suppNumber) === -1) {
    throw new Error('Строка ' + row + ' больше не содержит СУПП ' + suppNumber + ' (сейчас: ' + rowSupp + ').');
  }

  const currentText = String(rowValues[colText] || '').trim();

  if (currentText) {
    throw new Error('Строка ' + row + ' уже содержит «Текст заявки», запись отменена.');
  }

  sh.getRange(row, colText).setValue(requestText);

  const infoRichText = _problemPickerBridgeBuildSuppInfoRichText_(suppNumber, infoText);
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
    requestTextLength: requestText.length,
    infoTextLength: infoRichText.getText().length
  };
}

function _problemPickerBridgeBuildSuppInfoRichText_(suppNumber, infoText) {
  const header = String(suppNumber || '').trim();
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

  _problemPickerBridgeApplySuppInfoStyles_(builder, fullText, header, headerStyle, logStyle);

  return builder.build();
}

function _problemPickerBridgeApplySuppInfoStyles_(builder, text, suppNumber, headerStyle, logStyle) {
  const logLineRe = /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\/.*$/;
  let pos = 0;

  while (pos < text.length) {
    const nextNewline = text.indexOf('\n', pos);
    const end = nextNewline === -1 ? text.length : nextNewline;
    const line = text.substring(pos, end);
    const trimmed = line.trim();

    if (trimmed === suppNumber) {
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

function _problemPickerBridgeJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
