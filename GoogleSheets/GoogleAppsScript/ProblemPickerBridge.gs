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
    } else if (payload.action === 'saveFillDataBatch') {
      result = _problemPickerBridgeSaveFillDataBatch_(payload);
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

  const colProb = getColByHeader(sh, PROBLEM_HEADER);

  if (!colProb) {
    throw new Error('Не найдена колонка «' + PROBLEM_HEADER + '».');
  }

  sh.getRange(row, colProb).setValue(value);

  if (Object.prototype.hasOwnProperty.call(payload, 'cleanText')) {
    const colText = getColByHeader(sh, TEXT_HEADER);
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

  const colItil = getColByHeader(sh, 'Номер ITIL');
  const colSupp = getColByHeader(sh, 'Номер СУПП (последний)');
  const colText = getColByHeader(sh, TEXT_HEADER);
  const colInfo = getColByHeader(sh, INFO_HEADER);

  if (!colItil || !colSupp || !colText || !colInfo) {
    throw new Error('Не найдены колонки «Номер ITIL», «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
  }

  const rowItil = String(sh.getRange(row, colItil).getDisplayValue() || '').trim();

  if (rowItil !== itilNumber) {
    throw new Error('Строка ' + row + ' больше не соответствует ITIL ' + itilNumber + ' (сейчас: ' + rowItil + ').');
  }

  const rowSupp = String(sh.getRange(row, colSupp).getDisplayValue() || '').trim();

  if (rowSupp !== '–') {
    throw new Error('Строка ' + row + ' больше не подходит для ITIL-заполнения: «Номер СУПП (последний)» = ' + rowSupp + '.');
  }

  const currentText = String(sh.getRange(row, colText).getDisplayValue() || '').trim();

  if (currentText) {
    throw new Error('Строка ' + row + ' уже содержит «Текст заявки», запись отменена.');
  }

  sh.getRange(row, colText).setValue(requestText);

  const infoRichText = _problemPickerBridgeBuildItilInfoRichText_(solutionText);
  sh.getRange(row, colInfo).setRichTextValue(infoRichText);
  _applyInfoEditSideEffects_(sh, row, 1, { showFormattingToast: false, resetColors: false });

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

  const colSupp = getColByHeader(sh, 'Номер СУПП (последний)');
  const colText = getColByHeader(sh, TEXT_HEADER);
  const colInfo = getColByHeader(sh, INFO_HEADER);

  if (!colSupp || !colText || !colInfo) {
    throw new Error('Не найдены колонки «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
  }

  const rowSupp = String(sh.getRange(row, colSupp).getDisplayValue() || '').trim();

  if (rowSupp.indexOf(suppNumber) === -1) {
    throw new Error('Строка ' + row + ' больше не содержит СУПП ' + suppNumber + ' (сейчас: ' + rowSupp + ').');
  }

  const currentText = String(sh.getRange(row, colText).getDisplayValue() || '').trim();

  if (currentText) {
    throw new Error('Строка ' + row + ' уже содержит «Текст заявки», запись отменена.');
  }

  sh.getRange(row, colText).setValue(requestText);

  const infoRichText = _problemPickerBridgeBuildSuppInfoRichText_(suppNumber, infoText);
  sh.getRange(row, colInfo).setRichTextValue(infoRichText);
  _applyInfoEditSideEffects_(sh, row, 1, { showFormattingToast: false, resetColors: false });

  return {
    sheetName: sheetName,
    row: row,
    suppNumber: suppNumber,
    requestTextLength: requestText.length,
    infoTextLength: infoRichText.getText().length
  };
}

function _problemPickerBridgeSaveFillDataBatch_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || '').trim();

  if (spreadsheetId !== PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID) {
    throw new Error('Некорректная таблица: ' + spreadsheetId);
  }

  const sheetName = String(payload.sheetName || '').trim();

  if (PROBLEM_PICKER_BRIDGE_ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Лист не разрешён для batch-заполнения: ' + sheetName);
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!rawItems.length) {
    return {
      total: 0,
      successCount: 0,
      failedCount: 0,
      items: []
    };
  }

  const ss = SpreadsheetApp.openById(PROBLEM_PICKER_BRIDGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);

  if (!sh) {
    throw new Error('Лист не найден: ' + sheetName);
  }

  const context = {
    sh: sh,
    sheetName: sheetName,
    columns: _problemPickerBridgeGetHeaderMap_(sh)
  };

  const resultsByIndex = {};
  const normalizedItems = [];

  rawItems.forEach(function(rawItem, index) {
    try {
      const item = _problemPickerBridgeNormalizeFillBatchItem_(rawItem, spreadsheetId, sheetName, index);
      normalizedItems.push(item);
    } catch (error) {
      resultsByIndex[index] = _problemPickerBridgeRawBatchFailure_(rawItem, error);
    }
  });

  _problemPickerBridgeSaveFillBatchItems_(context, normalizedItems).forEach(function(itemResult) {
    resultsByIndex[itemResult.batchIndex] = itemResult;
  });

  const results = rawItems.map(function(rawItem, index) {
    return resultsByIndex[index] || _problemPickerBridgeRawBatchFailure_(rawItem, 'Bridge не обработал строку batch.');
  });
  const successCount = results.filter(function(item) {
    return item && item.success === true;
  }).length;

  return {
    total: results.length,
    successCount: successCount,
    failedCount: results.length - successCount,
    items: results
  };
}

function _problemPickerBridgeGetHeaderMap_(sh) {
  const heads = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const columns = {};

  heads.forEach(function(header, index) {
    const name = String(header || '').trim();
    if (name && !columns[name]) columns[name] = index + 1;
  });

  return columns;
}

function _problemPickerBridgeNormalizeFillBatchItem_(rawItem, spreadsheetId, sheetName, batchIndex) {
  const payload = rawItem && typeof rawItem === 'object' ? rawItem : {};
  const action = String(payload.action || '').trim();

  if (action !== 'saveItilData' && action !== 'saveSuppData') {
    throw new Error('Некорректное действие batch-строки: ' + action);
  }

  const itemSpreadsheetId = String(payload.spreadsheetId || '').trim();

  if (itemSpreadsheetId !== spreadsheetId) {
    throw new Error('Некорректная таблица batch-строки: ' + itemSpreadsheetId);
  }

  const itemSheetName = String(payload.sheetName || '').trim();

  if (itemSheetName !== sheetName) {
    throw new Error('Некорректный лист batch-строки: ' + itemSheetName);
  }

  const row = Number(payload.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Некорректный номер строки batch: ' + payload.row);
  }

  const requestText = String(payload.requestText || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!requestText) {
    throw new Error(action === 'saveItilData' ? 'Пустой текст заявки из ITIL.' : 'Пустой текст заявки из СУПП.');
  }

  const item = {
    action: action,
    batchIndex: batchIndex,
    clientQueueId: Number(payload.clientQueueId),
    row: row,
    requestText: requestText
  };

  if (action === 'saveItilData') {
    item.itilNumber = String(payload.itilNumber || '').trim();

    if (!item.itilNumber) {
      throw new Error('Пустой номер ITIL.');
    }

    item.solutionText = String(payload.solutionText || '')
      .replace(/\r\n?/g, '\n')
      .trim();
  } else {
    item.suppNumber = String(payload.suppNumber || '').trim();

    if (!/^ЗНР-[A-Za-zА-Яа-яЁё0-9-]+$/.test(item.suppNumber)) {
      throw new Error('Некорректный номер СУПП: ' + payload.suppNumber);
    }

    item.infoText = String(payload.infoText || '')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  return item;
}

function _problemPickerBridgeSaveFillBatchItems_(context, items) {
  if (!items.length) return [];

  const results = [];
  const itilItems = items.filter(function(item) {
    return item.action === 'saveItilData';
  });
  const suppItems = items.filter(function(item) {
    return item.action === 'saveSuppData';
  });

  Array.prototype.push.apply(results, _problemPickerBridgeSaveItilBatchItems_(context, itilItems));
  Array.prototype.push.apply(results, _problemPickerBridgeSaveSuppBatchItems_(context, suppItems));

  return results;
}

function _problemPickerBridgeSaveItilBatchItems_(context, items) {
  if (!items.length) return [];

  const colItil = context.columns['Номер ITIL'];
  const colSupp = context.columns['Номер СУПП (последний)'];
  const colText = context.columns[TEXT_HEADER];
  const colInfo = context.columns[INFO_HEADER];

  if (!colItil || !colSupp || !colText || !colInfo) {
    return _problemPickerBridgeFailBatchItems_(items, 'Не найдены колонки «Номер ITIL», «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
  }

  const duplicateRows = _problemPickerBridgeGetDuplicateRows_(items);
  const rowValues = _problemPickerBridgeReadBatchRows_(context.sh, items, [colItil, colSupp, colText]);
  const results = [];
  const writable = [];

  items.forEach(function(item) {
    if (duplicateRows[item.row]) {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' повторяется внутри batch.'));
      return;
    }

    const values = rowValues[item.row] || {};
    const rowItil = String(values[colItil] || '').trim();

    if (rowItil !== item.itilNumber) {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' больше не соответствует ITIL ' + item.itilNumber + ' (сейчас: ' + rowItil + ').'));
      return;
    }

    const rowSupp = String(values[colSupp] || '').trim();

    if (rowSupp !== '–') {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' больше не подходит для ITIL-заполнения: «Номер СУПП (последний)» = ' + rowSupp + '.'));
      return;
    }

    const currentText = String(values[colText] || '').trim();

    if (currentText) {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' уже содержит «Текст заявки», запись отменена.'));
      return;
    }

    item.infoRichText = _problemPickerBridgeBuildItilInfoRichText_(item.solutionText);
    writable.push(item);
  });

  _problemPickerBridgeWriteFillBatchItems_(context.sh, writable, colText, colInfo);
  writable.forEach(function(item) {
    results.push(_problemPickerBridgeBatchSuccess_(item, {
      sheetName: context.sheetName,
      row: item.row,
      itilNumber: item.itilNumber,
      requestTextLength: item.requestText.length,
      solutionTextLength: item.solutionText.length
    }));
  });

  return results;
}

function _problemPickerBridgeSaveSuppBatchItems_(context, items) {
  if (!items.length) return [];

  const colSupp = context.columns['Номер СУПП (последний)'];
  const colText = context.columns[TEXT_HEADER];
  const colInfo = context.columns[INFO_HEADER];

  if (!colSupp || !colText || !colInfo) {
    return _problemPickerBridgeFailBatchItems_(items, 'Не найдены колонки «Номер СУПП (последний)», «Текст заявки» или «Информация из СУПП/ITIL».');
  }

  const duplicateRows = _problemPickerBridgeGetDuplicateRows_(items);
  const rowValues = _problemPickerBridgeReadBatchRows_(context.sh, items, [colSupp, colText]);
  const results = [];
  const writable = [];

  items.forEach(function(item) {
    if (duplicateRows[item.row]) {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' повторяется внутри batch.'));
      return;
    }

    const values = rowValues[item.row] || {};
    const rowSupp = String(values[colSupp] || '').trim();

    if (rowSupp.indexOf(item.suppNumber) === -1) {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' больше не содержит СУПП ' + item.suppNumber + ' (сейчас: ' + rowSupp + ').'));
      return;
    }

    const currentText = String(values[colText] || '').trim();

    if (currentText) {
      results.push(_problemPickerBridgeBatchFailure_(item, 'Строка ' + item.row + ' уже содержит «Текст заявки», запись отменена.'));
      return;
    }

    item.infoRichText = _problemPickerBridgeBuildSuppInfoRichText_(item.suppNumber, item.infoText);
    writable.push(item);
  });

  _problemPickerBridgeWriteFillBatchItems_(context.sh, writable, colText, colInfo);
  writable.forEach(function(item) {
    results.push(_problemPickerBridgeBatchSuccess_(item, {
      sheetName: context.sheetName,
      row: item.row,
      suppNumber: item.suppNumber,
      requestTextLength: item.requestText.length,
      infoTextLength: item.infoRichText.getText().length
    }));
  });

  return results;
}

function _problemPickerBridgeReadBatchRows_(sh, items, columns) {
  const rows = _problemPickerBridgeNormalizeRows_(items.map(function(item) {
    return item.row;
  }));
  const sortedColumns = Array.from(new Set(columns)).sort(function(a, b) {
    return a - b;
  });
  const minCol = sortedColumns[0];
  const maxCol = sortedColumns[sortedColumns.length - 1];
  const width = maxCol - minCol + 1;
  const result = {};

  _problemPickerBridgeBuildRowSegments_(rows).forEach(function(segment) {
    const values = sh.getRange(segment.start, minCol, segment.count, width).getDisplayValues();

    for (let offset = 0; offset < segment.count; offset++) {
      const row = segment.start + offset;
      const rowData = {};

      sortedColumns.forEach(function(column) {
        rowData[column] = values[offset][column - minCol];
      });

      result[row] = rowData;
    }
  });

  return result;
}

function _problemPickerBridgeWriteFillBatchItems_(sh, items, colText, colInfo) {
  if (!items.length) return;

  const sortedItems = items.slice().sort(function(a, b) {
    return a.row - b.row;
  });
  const groups = _problemPickerBridgeBuildContiguousItemGroups_(sortedItems);

  groups.forEach(function(group) {
    const startRow = group[0].row;
    const values = group.map(function(item) {
      return [item.requestText];
    });
    const richTextValues = group.map(function(item) {
      return [item.infoRichText];
    });

    sh.getRange(startRow, colText, group.length, 1).setValues(values);
    sh.getRange(startRow, colInfo, group.length, 1).setRichTextValues(richTextValues);
    _applyInfoEditSideEffects_(sh, startRow, group.length, {
      showFormattingToast: false,
      resetColors: false
    });
  });
}

function _problemPickerBridgeBuildContiguousItemGroups_(items) {
  const groups = [];
  let current = [];

  items.forEach(function(item) {
    if (!current.length || item.row === current[current.length - 1].row + 1) {
      current.push(item);
      return;
    }

    groups.push(current);
    current = [item];
  });

  if (current.length) groups.push(current);

  return groups;
}

function _problemPickerBridgeGetDuplicateRows_(items) {
  const counts = {};

  items.forEach(function(item) {
    counts[item.row] = (counts[item.row] || 0) + 1;
  });

  const duplicates = {};

  Object.keys(counts).forEach(function(row) {
    if (counts[row] > 1) duplicates[row] = true;
  });

  return duplicates;
}

function _problemPickerBridgeFailBatchItems_(items, error) {
  return items.map(function(item) {
    return _problemPickerBridgeBatchFailure_(item, error);
  });
}

function _problemPickerBridgeBatchSuccess_(item, result) {
  return {
    clientQueueId: item.clientQueueId,
    batchIndex: item.batchIndex,
    success: true,
    result: result
  };
}

function _problemPickerBridgeBatchFailure_(item, error) {
  return {
    clientQueueId: item.clientQueueId,
    batchIndex: item.batchIndex,
    success: false,
    error: error && error.message ? error.message : String(error)
  };
}

function _problemPickerBridgeRawBatchFailure_(rawItem, error) {
  return {
    clientQueueId: Number(rawItem && rawItem.clientQueueId),
    success: false,
    error: error && error.message ? error.message : String(error)
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
