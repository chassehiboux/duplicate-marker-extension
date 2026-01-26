// ================= КОНФИГУРАЦИЯ =================
const SPREADSHEET_ID = '1jhqGwRJuZBDIwGsPTTW1rm2HODT_dgtHQzLko1wvDY0'; 
const TELEGRAM_BOT_TOKEN = '8598364240:AAGL_8euP_L5zXVoSYEZ08HWoxBZOJgsIlE';

const SHEET_SETTINGS = 'НАСТРОЙКИ_И_ДАШБОРД';
const ROW_LIMIT_FOR_ARCHIVE = 50000; 

// ================= 0. МЕНЮ =================
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('🚀 Пирамида Монитор')
      .addItem('🔄 Обновить Дашборд', 'monitorPerformance')
      .addSeparator()
      .addItem('🧹 Принудительная очистка', 'performCleanup')
      .addItem('📦 Проверить переполнение (Архивация)', 'smartArchiver')
      .addItem('⚙️ Сброс настроек (Setup)', 'setupDashboard')
      .addToUi();
}

// ================= 1. ПРИЕМ ДАННЫХ (API) =================
function doGet(e) { return handleRequest(e.parameter); }
function doPost(e) { 
  var data = {};
  try {
    if (e.postData && e.postData.contents) data = JSON.parse(e.postData.contents);
  } catch (err) { data = e.parameter || {}; }
  return handleRequest(data); 
}

function handleRequest(p) {
  var lock = LockService.getScriptLock();
  if (lock.tryLock(30000)) { 
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var baseName = p.baseName || "Неизвестная";

      if (baseName === SHEET_SETTINGS || baseName.startsWith("Архив_")) baseName += "_Data";

      var sheet = ss.getSheetByName(baseName);
      
      if (!sheet) {
        sheet = ss.insertSheet(baseName);
        sheet.appendRow(["Дата/Время", "Стадия", "Пользователь", "Время (сек)", "Статус", "SessionID", "Тип загрузки"]);
        sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
        sheet.setFrozenRows(1);
      }

      var durationVal = p.duration || "0";
      var durationStr = durationVal.toString().replace(/\./g, ',');
      var timestamp = p.timestamp ? p.timestamp : new Date();

      sheet.appendRow([
        new Date(), 
        p.stageName || "Unknown",
        p.userName || "Guest",
        durationStr, 
        p.status || "УСПЕШНО",
        p.sessionId || "",
        p.loadType || "Прочее"
      ]);

      return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
    } catch (error) {
      return ContentService.createTextOutput("Error: " + error.toString());
    } finally {
      lock.releaseLock();
    }
  } else {
    return ContentService.createTextOutput("Busy").setMimeType(ContentService.MimeType.TEXT);
  }
}

// ================= 2. МОНИТОРИНГ =================

function monitorPerformance() {
  console.log("=== ЗАПУСК МОНИТОРИНГА ===");
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Сначала удаляем зависшие "ОЖИДАНИЯ" (старше 2 мин)
  cleanupStaleWaitingRows(ss);

  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  var timeZone = ss.getSpreadsheetTimeZone();
  
  if (!settingsSheet) return;

  var lastUpdateCell = settingsSheet.getRange("E8");
  var now = new Date();
  var windowMinutes = 3; 
  var filterFromDate = new Date(now.getTime() - windowMinutes * 60 * 1000);
  var lookBackDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); 
  
  var periodStr = Utilities.formatDate(filterFromDate, timeZone, "HH:mm") + " — " + 
                  Utilities.formatDate(now, timeZone, "HH:mm");

  // Расчет статистик
  var result = calculateStats(ss, lookBackDate, filterFromDate, now);
  var dayStats = calculateDayAnalysis(ss, new Date(new Date().setHours(0,0,0,0)));

  // Отрисовка
  updateMainDashboard(settingsSheet, result.mainStats, periodStr);
  updateUserDashboard(settingsSheet, result.userStats, periodStr);
  updateDayAnalysisDashboard(settingsSheet, dayStats, Utilities.formatDate(now, timeZone, "dd.MM.yyyy"));
  
  // Алерты
  checkAlerts(settingsSheet, result.mainStats, timeZone);

  lastUpdateCell.setValue(now).setNumberFormat("dd.MM.yyyy HH:mm:ss");
  console.log("=== ЗАВЕРШЕНО ===");
}

// Новая структура: MainStats[base][loadType][stage]
function calculateStats(ss, scanStartDate, filterNewDate, now) {
  var sheets = ss.getSheets();
  var mainStats = {}; 
  var userStats = {};

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var startRow = Math.max(2, lastRow - 3000); 
    // Читаем 7 колонок
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getValues(); 

    var uniqueSessions = {};

    // 1. Сбор уникальных сессий
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rowDate = row[0]; 
      if (!(rowDate instanceof Date)) continue; 

      if (rowDate > scanStartDate) {
        var sessionId = row[5] || "no_id_" + Math.random();
        var status = row[4];
        
        var rawDuration = row[3];
        var duration = (typeof rawDuration === 'number') ? rawDuration : parseFloat(String(rawDuration).replace(',', '.'));
        if (isNaN(duration)) duration = 0;

        // НОВАЯ ЛОГИКА: Верим времени, которое прислало расширение
        if (status === "ОЖИДАНИЕ") {
          var secondsSinceLastUpdate = (now.getTime() - rowDate.getTime()) / 1000;
          
          // Если от расширения не было "пульса" (heartbeat) более 60 секунд 
          // (учитывая, что оно шлет каждые 30 сек), значит сессия мертва.
          if (secondsSinceLastUpdate > 60) {
             continue; 
          }
          // Используем время, которое прислало расширение (оно обновляется каждые 30с)
          // duration уже вычислен выше из row[3]
        }

        if (!uniqueSessions[sessionId]) {
          uniqueSessions[sessionId] = { row: row, duration: duration };
        } else {
          var existing = uniqueSessions[sessionId];
          var existingStatus = existing.row[4];

          // Логика обновления: Ожидание заменяем ожиданием (если дольше), Финал заменяет ожидание
          if (status !== "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
            uniqueSessions[sessionId] = { row: row, duration: duration };
          }
          else if (status === "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
            if (duration > existing.duration) uniqueSessions[sessionId] = { row: row, duration: duration };
          }
          else if (status !== "ОЖИДАНИЕ" && existingStatus !== "ОЖИДАНИЕ") {
             if (duration > existing.duration) uniqueSessions[sessionId] = { row: row, duration: duration };
          }
        }
      }
    }

    if (!mainStats[name]) mainStats[name] = {};

    // 2. Агрегация
    for (var sid in uniqueSessions) {
      var entry = uniqueSessions[sid];
      var row = entry.row;
      var duration = entry.duration;
      
      var rowDate = row[0];
      var stage = row[1] || "Unknown";
      var user = row[2] || "Unknown";
      var status = row[4];
      var loadType = row[6];
      if (!loadType || loadType === "") loadType = "Прочее";

      if (status !== "УСПЕШНО" && status !== "ОЖИДАНИЕ" && duration < 5) continue;

      var isWaiting = (status === "ОЖИДАНИЕ");
      var isNewFinished = (rowDate > filterNewDate);

      if (isWaiting || isNewFinished) {
        // Инициализация структуры: Base -> LoadType -> Stage
        if (!mainStats[name][loadType]) mainStats[name][loadType] = {};
        if (!mainStats[name][loadType][stage]) {
          mainStats[name][loadType][stage] = { 
            count: 0, timeSum: 0, max: 0, slow: 0, errors: 0, waiting: 0, 
            maxWaiting: 0, uniqueUsers: {}, loads: [] 
          };
        }
        var ms = mainStats[name][loadType][stage];

        ms.count++;
        ms.timeSum += duration;
        
        if (duration > ms.max) ms.max = duration;
        if (duration > 10) ms.slow++;
        ms.uniqueUsers[user] = true;
        ms.loads.push({user: user, time: duration});

        if (status === "УСПЕШНО") { } 
        else if (status === "ОЖИДАНИЕ") { 
            ms.waiting++; 
            if (duration > ms.maxWaiting) ms.maxWaiting = duration;
        } 
        else { ms.errors++; }

        // UserStats: User -> Base -> LoadType -> Stage
        if (!userStats[user]) userStats[user] = {};
        if (!userStats[user][name]) userStats[user][name] = {};
        if (!userStats[user][name][loadType]) userStats[user][name][loadType] = {};
        if (!userStats[user][name][loadType][stage]) userStats[user][name][loadType][stage] = { count: 0, timeSum: 0, max: 0 };
        
        var us = userStats[user][name][loadType][stage];
        us.count++;
        us.timeSum += duration;
        if (duration > us.max) us.max = duration;
      }
    }
    if (Object.keys(mainStats[name]).length === 0) delete mainStats[name];
  });
  
  return { mainStats: mainStats, userStats: userStats };
}

function calculateDayAnalysis(ss, startOfDay) {
  var sheets = ss.getSheets();
  var stats = {}; 

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var startRow = Math.max(2, lastRow - 5000); 
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getValues();

    if (!stats[name]) stats[name] = {};

    data.forEach(function(row) {
      var rowDate = row[0];
      if (!(rowDate instanceof Date)) return;

      if (rowDate >= startOfDay) {
        var status = row[4];
        var rawDur = row[3];
        var duration = (typeof rawDur === 'number') ? rawDur : parseFloat(String(rawDur).replace(',', '.'));
        if (isNaN(duration)) duration = 0;

        if (status !== "УСПЕШНО" && duration < 5) return;

        var stage = row[1] || "Unknown";
        var loadType = row[6] || "Прочее";
        
        if (!stats[name][loadType]) stats[name][loadType] = {};
        if (!stats[name][loadType][stage]) {
          stats[name][loadType][stage] = { hourly: {}, totalSum: 0, totalCnt: 0 };
        }
        var st = stats[name][loadType][stage];
        
        var hour = rowDate.getHours();
        if (!st.hourly[hour]) st.hourly[hour] = { sum: 0, cnt: 0 };
        
        st.hourly[hour].sum += duration;
        st.hourly[hour].cnt++;
        
        st.totalSum += duration;
        st.totalCnt++;
      }
    });
    if (Object.keys(stats[name]).length === 0) delete stats[name];
  });

  return stats;
}


// ---------------- ОТРИСОВКА (ОБНОВЛЕННАЯ СТРУКТУРА) ----------------

function updateMainDashboard(sheet, stats, periodStr) {
  sheet.getRange("A10:I200").clearContent(); // Расширили до I
  sheet.getRange("A8").setValue("СВОДНЫЙ ДАШБОРД (Период: " + periodStr + ")");
  var headers = [["База", "Тип загрузки", "Стадия", "Всего", "В работе", "Ошиб/Отм", "Ср. время", "Макс", "Медл (>10с)"]];
  sheet.getRange("A9:I9").setValues(headers).setBackground("#4a86e8").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var base in stats) {
    for (var loadType in stats[base]) {
      for (var stage in stats[base][loadType]) {
        var s = stats[base][loadType][stage];
        var avg = s.count > 0 ? (s.timeSum / s.count) : 0;
        output.push([base, loadType, stage, s.count, s.waiting, s.errors, avg, s.max, s.slow]);
      }
    }
  }
  // Сортировка: В работе DESC, Ошибки DESC, Среднее DESC
  output.sort((a, b) => b[4] - a[4] || b[5] - a[5] || b[6] - a[6]); 

  if (output.length > 0) {
    sheet.getRange(10, 1, output.length, 9).setValues(output);
    sheet.getRange(10, 7, output.length, 2).setNumberFormat("0.00"); // Формат для Ср.время и Макс
  } else {
    sheet.getRange("A10").setValue("Нет активных данных");
  }
}

function updateUserDashboard(sheet, userStats, periodStr) {
  sheet.getRange("J10:P300").clearContent(); // Расширили до P
  sheet.getRange("J8").setValue("ПОЛЬЗОВАТЕЛИ (Период: " + periodStr + ")");
  var headers = [["Пользователь", "База", "Тип загрузки", "Стадия", "Кол-во", "Ср. Время", "Макс"]];
  sheet.getRange("J9:P9").setValues(headers).setBackground("#6aa84f").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var user in userStats) {
    for (var base in userStats[user]) {
      for (var loadType in userStats[user][base]) {
        for (var stage in userStats[user][base][loadType]) {
          var s = userStats[user][base][loadType][stage];
          var avg = (s.timeSum / s.count);
          output.push([user, base, loadType, stage, s.count, avg, s.max]);
        }
      }
    }
  }
  output.sort((a, b) => a[0].localeCompare(b[0]) || b[6] - a[6]);

  if (output.length > 0) {
    sheet.getRange(10, 10, output.length, 7).setValues(output);
    sheet.getRange(10, 15, output.length, 2).setNumberFormat("0.00");
  } else {
    sheet.getRange("J10").setValue("Нет активности");
  }
}

function updateDayAnalysisDashboard(sheet, dayStats, dateStr) {
  sheet.getRange("R10:W300").clearContent(); // Сдвинули на R (было Q), расширили
  sheet.getRange("R8").setValue("АНАЛИЗ ДНЯ (" + dateStr + ")");
  var headers = [["База", "Тип загрузки", "Стадия", "Худший час (Ср.)", "Общее среднее", "Лучший час (Ср.)"]];
  sheet.getRange("R9:W9").setValues(headers).setBackground("#e06666").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var base in dayStats) {
    for (var loadType in dayStats[base]) {
      for (var stage in dayStats[base][loadType]) {
        var s = dayStats[base][loadType][stage];
        if (s.totalCnt === 0) continue;

        var overallAvg = (s.totalSum / s.totalCnt);
        var maxAvg = -1; var maxHour = "-";
        var minAvg = 99999; var minHour = "-";

        for (var h in s.hourly) {
          var hData = s.hourly[h];
          if (hData.cnt > 0) {
            var hAvg = hData.sum / hData.cnt;
            if (hAvg > maxAvg) { maxAvg = hAvg; maxHour = h; }
            if (hAvg < minAvg) { minAvg = hAvg; minHour = h; }
          }
        }
        var worstStr = (maxHour !== "-") ? maxHour + ":00 (" + maxAvg.toFixed(1).replace('.', ',') + ")" : "-";
        var bestStr = (minHour !== "-") ? minHour + ":00 (" + minAvg.toFixed(1).replace('.', ',') + ")" : "-";
        output.push([base, loadType, stage, worstStr, overallAvg, bestStr]);
      }
    }
  }
  output.sort((a, b) => b[4] - a[4]);

  if (output.length > 0) {
    sheet.getRange(10, 18, output.length, 6).setValues(output);
    sheet.getRange(10, 22, output.length, 1).setNumberFormat("0.00"); 
  } else {
    sheet.getRange("R10").setValue("Нет данных за сегодня");
  }
}


// ---------------- АЛЕРТЫ (С ГРУППИРОВКОЙ) ----------------
function checkAlerts(sheet, stats, timeZone) {
  var configsRange = sheet.getRange("A4:F20");
  var configs = configsRange.getValues();

  for (var i = 0; i < configs.length; i++) {
    var row = configs[i];
    var baseTarget = row[0]; 
    var limit = row[1];      
    var chatId = row[2];     
    var isActive = row[3];   
    var lastMsgId = row[4]; 
    var lastStatus = row[5] || "OK";

    if (!baseTarget || !limit || !chatId || isActive !== true) continue;

    var alertBlocks = []; // Собираем блоки для одной базы

    for (var baseName in stats) {
      if (baseTarget !== "*" && baseName !== baseTarget) continue;
      
      var baseAlerts = []; // Алерты конкретной базы

      for (var loadType in stats[baseName]) {
        var loadTypeAlerts = []; // Алерты внутри типа загрузки

        for (var stageName in stats[baseName][loadType]) {
          var s = stats[baseName][loadType][stageName];
          if (s.count === 0) continue; 

          var avgTime = (s.timeSum / s.count);
          // Условие: Среднее превышено ИЛИ Кто-то висит дольше лимита
          var isAlertCondition = (avgTime > limit) || (s.maxWaiting > limit);

          if (isAlertCondition) {
            var uniqueUserCount = Object.keys(s.uniqueUsers).length;
            var topSlowest = s.loads.sort((a, b) => b.time - a.time).slice(0, 3);
            
            var top3Msg = "";
            topSlowest.forEach((item, index) => {
              var tStr = item.time.toFixed(1).replace('.', ',');
              top3Msg += `\n          ${index + 1}. <b>${item.user}</b>: ${tStr}с`;
            });

            var avgStr = avgTime.toFixed(1).replace('.', ',');
            
            var stageBlock = `   🔸 <b>${stageName}</b>\n` +
                             `      ⏱ Среднее: <b>${avgStr} с</b> (Лимит: ${limit})\n` +
                             `      ⏳ В работе: ${s.waiting} (Макс: ${s.maxWaiting.toFixed(1)}с)\n` +
                             `      🐌 <i>Топ долгих:</i>${top3Msg}`;
            
            loadTypeAlerts.push(stageBlock);
          }
        }

        if (loadTypeAlerts.length > 0) {
          baseAlerts.push(`📂 <b>${loadType}</b>\n` + loadTypeAlerts.join("\n\n"));
        }
      }

      if (baseAlerts.length > 0) {
        alertBlocks.push(`🔴 <b>${baseName}</b>\n\n` + baseAlerts.join("\n\n"));
      }
    }

    var currentTime = Utilities.formatDate(new Date(), timeZone, "HH:mm");
    var finalMessage = "";
    var currentStatus = "OK"; 

    if (alertBlocks.length > 0) {
      currentStatus = "ALERT";
      finalMessage = `⚠️ <b>ОБНАРУЖЕНО ЗАМЕДЛЕНИЕ</b>\n\n` + 
                     alertBlocks.join("\n\n====================\n\n") + 
                     `\n\n🕒 <i>Обновлено: ${currentTime}</i>`;
    } else {
      currentStatus = "OK";
      finalMessage = `🟢 <b>Система работает стабильно</b>\n` +
                     `Зависаний по критериям не обнаружено.\n` + 
                     `🕒 <i>Обновлено: ${currentTime}</i>`;
    }

    var newMsgId = null;    
    // ЛОГИКА ТЕЛЕГРАМ (без изменений)
    if (currentStatus !== lastStatus) {
      if (lastMsgId) deleteTelegramMessage(chatId, lastMsgId);
      var silent = (currentStatus === "OK");
      newMsgId = sendTelegram(chatId, finalMessage, silent);
    } 
    else {
      if (lastMsgId) {
        var edited = editTelegramMessage(chatId, lastMsgId, finalMessage);
        if (edited === "SUCCESS") {
          newMsgId = lastMsgId; 
        } else if (edited === "NOT_FOUND") {
          var silent = (currentStatus === "OK");
          newMsgId = sendTelegram(chatId, finalMessage, silent);
        } else {
          newMsgId = lastMsgId;
        }
      } else {
        var silent = (currentStatus === "OK");
        newMsgId = sendTelegram(chatId, finalMessage, silent);
      }
    }

    if (newMsgId) {
      sheet.getRange(4 + i, 5).setValue(newMsgId);
      sheet.getRange(4 + i, 6).setValue(currentStatus);
    }
  }
}

// ... (Остальные функции Telegram и архивации без изменений) ...
function sendTelegram(chatId, text, silent) {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = { 'chat_id': chatId, 'text': text, 'parse_mode': 'HTML', 'disable_notification': silent };
  try {
    var response = UrlFetchApp.fetch(url, { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload) });
    var json = JSON.parse(response.getContentText());
    if (json.ok) return String(json.result.message_id);
  } catch(e) { console.log("TG Send Error: " + e); }
  return null;
}

function editTelegramMessage(chatId, messageId, text) {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/editMessageText";
  var payload = { 'chat_id': chatId, 'message_id': messageId, 'text': text, 'parse_mode': 'HTML' };
  try {
    var response = UrlFetchApp.fetch(url, { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload) });
    var json = JSON.parse(response.getContentText());
    if (json.ok) return "SUCCESS";
  } catch(e) { 
    var err = e.toString();
    if (err.includes("message to edit not found") || err.includes("message_id_invalid")) return "NOT_FOUND";
    if (err.includes("message is not modified")) return "SUCCESS";
    return "OTHER_ERROR";
  }
  return "OTHER_ERROR";
}

function deleteTelegramMessage(chatId, messageId) {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/deleteMessage";
  var payload = { 'chat_id': chatId, 'message_id': messageId };
  try {
    UrlFetchApp.fetch(url, { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload) });
  } catch(e) { }
}

function smartArchiver() {
  var lock = LockService.getScriptLock();
  if (lock.tryLock(45000)) { 
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheets = ss.getSheets();
      var todayStr = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyyMMdd");

      sheets.forEach(function(sheet) {
        var name = sheet.getName();
        if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;

        if (sheet.getLastRow() >= ROW_LIMIT_FOR_ARCHIVE) {
          console.log("Архивируем лист: " + name);
          
          var archiveName = "Архив_" + name + "_" + todayStr;
          var counter = 1;
          var finalName = archiveName;
          while (ss.getSheetByName(finalName)) {
            finalName = archiveName + "_" + counter;
            counter++;
          }

          sheet.setName(finalName);
          var newSheet = ss.insertSheet(name);
          newSheet.appendRow(["Дата/Время", "Стадия", "Пользователь", "Время (сек)", "Статус", "SessionID", "Тип загрузки"]);
          newSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
          newSheet.setFrozenRows(1);
        }
      });
    } finally {
      lock.releaseLock();
    }
  }
}

// ================= 4. УДАЛЕНИЕ ЗАВИСШИХ СЕССИЙ =================
function cleanupStaleWaitingRows(ss) {
  var sheets = ss.getSheets();
  var now = new Date();
  var thresholdTime = now.getTime() - 2 * 60 * 1000; // 2 минуты назад

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // Читаем только нужные колонки: A (Дата) и E (Статус)
    // A=1, B=2, C=3, D=4, E=5. Берем range от A2 до E_lastRow
    var range = sheet.getRange(2, 1, lastRow - 1, 5);
    var values = range.getValues();
    var rowsToDelete = [];

    // Проходим с конца, чтобы индексы не съезжали при удалении (хотя deleteRow делает это за нас, но собирать лучше так)
    // Но удалять через API по одному долго. Лучше собрать индексы.
    
    // В Google Apps Script удаление строк по одной ОЧЕНЬ медленное.
    // Если "висяков" много, скрипт упадет по таймауту.
    // Оптимизация: Собираем диапазоны или удаляем с конца.
    
    for (var i = values.length - 1; i >= 0; i--) {
      var rowDate = values[i][0];
      var status = values[i][4];

      if (status === "ОЖИДАНИЕ" && rowDate instanceof Date) {
        if (rowDate.getTime() < thresholdTime) {
           // +2 потому что массив с 0, а лист со 2-й строки
           rowsToDelete.push(i + 2);
        }
      }
    }

    // Удаляем
    rowsToDelete.forEach(function(rowIndex) {
      sheet.deleteRow(rowIndex);
    });
    
    if (rowsToDelete.length > 0) {
      console.log("Удалено зависших строк на листе " + name + ": " + rowsToDelete.length);
    }
  });
}

// ... (Cleanup, Setup - без изменений) ...
function performCleanup() {

  var lock = LockService.getScriptLock();
  if (lock.tryLock(45000)) { 
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheets = ss.getSheets();
      sheets.forEach(function(sheet) {
        var name = sheet.getName();
        if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;
        compactSheet(sheet);
      });
    } finally {
      lock.releaseLock();
    }
  }
}

function compactSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var range = sheet.getRange(2, 1, lastRow - 1, 7);
  var data = range.getValues();
  if (data.length == 0) return;

  var uniqueMap = {}; 
  data.forEach(function(row) {
    var sessionId = row[5]; 
    if (!sessionId) sessionId = "leg_" + Math.random();
    
    var status = row[4];
    var rawDur = row[3];
    var duration = (typeof rawDur === 'number') ? rawDur : parseFloat(String(rawDur).replace(',', '.'));
    if (isNaN(duration)) duration = 0;

    if (!uniqueMap[sessionId]) {
      uniqueMap[sessionId] = { row: row, duration: duration };
    } else {
      var existing = uniqueMap[sessionId];
      var existingStatus = existing.row[4];
      if (status !== "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
        uniqueMap[sessionId] = { row: row, duration: duration };
      } else if ((status === "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") || (status !== "ОЖИДАНИЕ" && existingStatus !== "ОЖИДАНИЕ")) {
        if (duration > existing.duration) uniqueMap[sessionId] = { row: row, duration: duration };
      }
    }
  });

  var cleanData = [];
  for (var key in uniqueMap) cleanData.push(uniqueMap[key].row);
  cleanData.sort((a, b) => new Date(a[0]) - new Date(b[0]));

  if (cleanData.length < data.length) {
    range.clearContent();
    if (cleanData.length > 0) sheet.getRange(2, 1, cleanData.length, 7).setValues(cleanData);
  }
}

function setupDashboard() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) sheet = ss.insertSheet(SHEET_SETTINGS);
  
  sheet.clear();
  sheet.getRange("A1").setValue("НАСТРОЙКИ МОНИТОРИНГА").setFontSize(14).setFontWeight("bold");
  sheet.getRange("A3:F3").setValues([["Имя базы (или *)", "Лимит времени (сек)", "ID Чата Telegram", "Активно?", "ID посл. сообщ.", "Статус (Last)"]]);
  sheet.getRange("A3:F3").setBackground("#cfe2f3").setFontWeight("bold");
  
  sheet.getRange("A4:D4").setValues([["*", 15, "ВСТАВЬТЕ_ID", true]]);
  sheet.getRange("D4").insertCheckboxes();
  var yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  sheet.getRange("E8").setValue(yesterday).setNumberFormat("dd.MM.yyyy HH:mm:ss");
  
  updateMainDashboard(sheet, {}, "Ожидание");
  updateUserDashboard(sheet, {}, "Ожидание");
  updateDayAnalysisDashboard(sheet, {}, "Ожидание");
}

function getUpdatesInLog() {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/getUpdates";
  console.log(UrlFetchApp.fetch(url).getContentText());
}
