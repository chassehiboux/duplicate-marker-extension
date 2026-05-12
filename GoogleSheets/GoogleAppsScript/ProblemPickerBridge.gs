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

function _problemPickerBridgeJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
