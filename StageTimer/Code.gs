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
// Обработка GET (для ручных тестов и легаси)
function doGet(e) { 
  return handleRequest(e.parameter); 
}

// Обработка POST (основной метод для расширения)
function doPost(e) { 
  var data = {};
  try {
    // Пытаемся распарсить JSON из тела запроса
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    // Если пришел не JSON, пробуем взять параметры (fallback)
    data = e.parameter || {};
  }
  return handleRequest(data); 
}

function handleRequest(p) {
  // Увеличили время ожидания блокировки до 30 секунд
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

      // Форматируем дату, если она пришла текстом, или берем текущую
      var timestamp = p.timestamp ? p.timestamp : new Date();

      sheet.appendRow([
        new Date(), // Всегда пишем серверное время получения для сортировки
        p.stageName || "Unknown",
        p.userName || "Guest",
        durationStr, 
        p.status || "УСПЕШНО",
        p.sessionId || "",
        p.loadType || ""
      ]);

      return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
    } catch (error) {
      return ContentService.createTextOutput("Error: " + error.toString());
    } finally {
      lock.releaseLock();
    }
  } else {
    // Если скрипт занят более 30 секунд
    return ContentService.createTextOutput("Busy").setMimeType(ContentService.MimeType.TEXT);
  }
}

// ================= 2. МОНИТОРИНГ =================

function monitorPerformance() {
  console.log("=== ЗАПУСК МОНИТОРИНГА ===");
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  var timeZone = ss.getSpreadsheetTimeZone();
  
  if (!settingsSheet) return;

  var lastUpdateCell = settingsSheet.getRange("E8");
  var lastUpdateRaw = lastUpdateCell.getValue();
  var lastUpdateDate;

  if (lastUpdateRaw instanceof Date) {
    lastUpdateDate = lastUpdateRaw;
  } else {
    lastUpdateDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000); 
  }
  
  var now = new Date();
  var windowMinutes = 3; 
  var filterFromDate = new Date(now.getTime() - windowMinutes * 60 * 1000);
  var lookBackDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); 
  
  var periodStr = Utilities.formatDate(filterFromDate, timeZone, "HH:mm") + " — " + 
                  Utilities.formatDate(now, timeZone, "HH:mm");

  var result = calculateStats(ss, lookBackDate, filterFromDate, now);
  var dayStats = calculateDayAnalysis(ss, new Date(new Date().setHours(0,0,0,0)));

  updateMainDashboard(settingsSheet, result.mainStats, periodStr);
  updateUserDashboard(settingsSheet, result.userStats, periodStr);
  updateDayAnalysisDashboard(settingsSheet, dayStats, Utilities.formatDate(now, timeZone, "dd.MM.yyyy"));
  
  checkAlerts(settingsSheet, result.mainStats, timeZone);

  lastUpdateCell.setValue(now).setNumberFormat("dd.MM.yyyy HH:mm:ss");
  console.log("=== ЗАВЕРШЕНО ===");
}


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
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 6).getValues(); 

    var uniqueSessions = {};

    data.forEach(function(row) {
      var rowDate = row[0]; 
      if (!(rowDate instanceof Date)) return; 

      if (rowDate > scanStartDate) {
        var sessionId = row[5]; 
        var status = row[4];
        
        var rawDuration = row[3];
        var duration = 0;
        if (typeof rawDuration === 'number') {
          duration = rawDuration;
        } else {
          duration = parseFloat(String(rawDuration).replace(',', '.'));
        }
        if (isNaN(duration)) duration = 0;

        if (!sessionId) sessionId = "no_id_" + Math.random();

        if (!uniqueSessions[sessionId]) {
          uniqueSessions[sessionId] = { row: row, duration: duration };
        } else {
          var existing = uniqueSessions[sessionId];
          var existingStatus = existing.row[4];
          var existingDuration = existing.duration;

          if (status !== "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
            uniqueSessions[sessionId] = { row: row, duration: duration };
          }
          else if (status === "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
            if (duration > existingDuration) {
              uniqueSessions[sessionId] = { row: row, duration: duration };
            }
          }
          else if (status !== "ОЖИДАНИЕ" && existingStatus !== "ОЖИДАНИЕ") {
             if (duration > existingDuration) {
              uniqueSessions[sessionId] = { row: row, duration: duration };
            }
          }
        }
      }
    });

    if (!mainStats[name]) mainStats[name] = {};

    for (var sid in uniqueSessions) {
      var entry = uniqueSessions[sid];
      var row = entry.row;
      var duration = entry.duration;
      
      var rowDate = row[0];
      var stage = row[1] || "Unknown";
      var user = row[2] || "Unknown";
      var status = row[4];

      if (status !== "УСПЕШНО" && status !== "ОЖИДАНИЕ" && duration < 5) continue;

      var isWaiting = (status === "ОЖИДАНИЕ");
      var isNewFinished = (rowDate > filterNewDate);

      if (isWaiting || isNewFinished) {
        if (!mainStats[name][stage]) {
          mainStats[name][stage] = { count: 0, timeSum: 0, max: 0, slow: 0, errors: 0, waiting: 0, uniqueUsers: {}, loads: [] };
        }
        var ms = mainStats[name][stage];

        ms.count++;
        ms.timeSum += duration;
        
        if (duration > ms.max) ms.max = duration;
        if (duration > 10) ms.slow++;
        ms.uniqueUsers[user] = true;
        ms.loads.push({user: user, time: duration});

        if (status === "УСПЕШНО") { } 
        else if (status === "ОЖИДАНИЕ") { ms.waiting++; } 
        else { ms.errors++; }

        if (!userStats[user]) userStats[user] = {};
        if (!userStats[user][name]) userStats[user][name] = {};
        if (!userStats[user][name][stage]) userStats[user][name][stage] = { count: 0, timeSum: 0, max: 0 };
        
        var us = userStats[user][name][stage];
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
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 6).getValues();

    if (!stats[name]) stats[name] = {};

    data.forEach(function(row) {
      var rowDate = row[0];
      if (!(rowDate instanceof Date)) return;

      if (rowDate >= startOfDay) {
        var status = row[4];
        var rawDur = row[3];
        var duration = 0;
        if (typeof rawDur === 'number') duration = rawDur;
        else duration = parseFloat(String(rawDur).replace(',', '.'));
        if (isNaN(duration)) duration = 0;

        if (status !== "УСПЕШНО" && duration < 5) return;

        var stage = row[1] || "Unknown";
        
        if (!stats[name][stage]) {
          stats[name][stage] = { hourly: {}, totalSum: 0, totalCnt: 0 };
        }
        var st = stats[name][stage];
        
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


// ---------------- ОТРИСОВКА ----------------

function updateMainDashboard(sheet, stats, periodStr) {
  sheet.getRange("A10:H200").clearContent();
  sheet.getRange("A8").setValue("СВОДНЫЙ ДАШБОРД (Период: " + periodStr + ")");
  var headers = [["База", "Стадия", "Всего", "В работе", "Ошиб/Отм", "Ср. время", "Макс", "Медл (>10с)"]];
  sheet.getRange("A9:H9").setValues(headers).setBackground("#4a86e8").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var base in stats) {
    for (var stage in stats[base]) {
      var s = stats[base][stage];
      var avg = s.count > 0 ? (s.timeSum / s.count) : 0;
      output.push([base, stage, s.count, s.waiting, s.errors, avg, s.max, s.slow]);
    }
  }
  output.sort((a, b) => b[3] - a[3] || b[4] - a[4] || b[5] - a[5]); 

  if (output.length > 0) {
    sheet.getRange(10, 1, output.length, 8).setValues(output);
    sheet.getRange(10, 6, output.length, 2).setNumberFormat("0.00");
  } else {
    sheet.getRange("A10").setValue("Нет активных данных");
  }
}

function updateUserDashboard(sheet, userStats, periodStr) {
  sheet.getRange("J10:O300").clearContent();
  sheet.getRange("J8").setValue("ПОЛЬЗОВАТЕЛИ (Период: " + periodStr + ")");
  var headers = [["Пользователь", "База", "Стадия", "Кол-во", "Ср. Время", "Макс"]];
  sheet.getRange("J9:O9").setValues(headers).setBackground("#6aa84f").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var user in userStats) {
    for (var base in userStats[user]) {
      for (var stage in userStats[user][base]) {
        var s = userStats[user][base][stage];
        var avg = (s.timeSum / s.count);
        output.push([user, base, stage, s.count, avg, s.max]);
      }
    }
  }
  output.sort((a, b) => a[0].localeCompare(b[0]) || b[5] - a[5]);

  if (output.length > 0) {
    sheet.getRange(10, 10, output.length, 6).setValues(output);
    sheet.getRange(10, 14, output.length, 2).setNumberFormat("0.00");
  } else {
    sheet.getRange("J10").setValue("Нет активности");
  }
}

function updateDayAnalysisDashboard(sheet, dayStats, dateStr) {
  sheet.getRange("Q10:U300").clearContent();
  sheet.getRange("Q8").setValue("АНАЛИЗ ДНЯ (" + dateStr + ")");
  var headers = [["База", "Стадия", "Худший час (Ср.)", "Общее среднее", "Лучший час (Ср.)"]];
  sheet.getRange("Q9:U9").setValues(headers).setBackground("#e06666").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var base in dayStats) {
    for (var stage in dayStats[base]) {
      var s = dayStats[base][stage];
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
      output.push([base, stage, worstStr, overallAvg, bestStr]);
    }
  }
  output.sort((a, b) => b[3] - a[3]);

  if (output.length > 0) {
    sheet.getRange(10, 17, output.length, 5).setValues(output);
    sheet.getRange(10, 20, output.length, 1).setNumberFormat("0.00"); 
  } else {
    sheet.getRange("Q10").setValue("Нет данных за сегодня");
  }
}


// ---------------- АЛЕРТЫ ----------------
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

    var alertMessages = [];

    for (var baseName in stats) {
      if (baseTarget !== "*" && baseName !== baseTarget) continue;

      for (var stageName in stats[baseName]) {
        var s = stats[baseName][stageName];
        if (s.count === 0) continue; 

        var avgTime = (s.timeSum / s.count);

        if (avgTime > limit) {
          var uniqueUserCount = Object.keys(s.uniqueUsers).length;
          var topSlowest = s.loads.sort((a, b) => b.time - a.time).slice(0, 3);
          
          var top3Msg = "";
          topSlowest.forEach((item, index) => {
            var tStr = item.time.toFixed(1).replace('.', ',');
            top3Msg += `\n      ${index + 1}. <b>${item.user}</b>: ${tStr}с`;
          });

          var avgStr = avgTime.toFixed(1).replace('.', ',');

          var block = `🔴 <b>${baseName}</b> → <b>${stageName}</b>\n` +
                      `   ⏱ Среднее: <b>${avgStr} с</b> (Лимит: ${limit})\n` +
                      `   ⏳ В работе: ${s.waiting} | 👥 Людей: ${uniqueUserCount}\n` +
                      `   🐌 <i>Топ долгих:</i>${top3Msg}`;
          
          alertMessages.push(block);
        }
      }
    }

    var currentTime = Utilities.formatDate(new Date(), timeZone, "HH:mm");
    var finalMessage = "";
    var currentStatus = "OK"; 

    if (alertMessages.length > 0) {
      currentStatus = "ALERT";
      finalMessage = `⚠️ <b>ОБНАРУЖЕНО ЗАМЕДЛЕНИЕ (${alertMessages.length})</b>\n\n` + 
                     alertMessages.join("\n\n") + 
                     `\n\n🕒 <i>Обновлено: ${currentTime}</i>`;
    } else {
      currentStatus = "OK";
      finalMessage = `🟢 <b>Система работает стабильно</b>\n` +
                     `Зависаний по критериям не обнаружено.\n` + 
                     `🕒 <i>Обновлено: ${currentTime}</i>`;
    }

    var newMsgId = null;
    
    // ЛОГИКА ТЕЛЕГРАМ:
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
          // OTHER_ERROR: не шлем новое, оставляем как есть
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

// ================= ТЕЛЕГРАМ УТИЛИТЫ =================

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

// ================= 3. УМНАЯ АРХИВАЦИЯ =================
// Этот триггер можно ставить раз в день или раз в час
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

        // ПРОВЕРЯЕМ ЛИМИТ
        if (sheet.getLastRow() >= ROW_LIMIT_FOR_ARCHIVE) {
          console.log("Архивируем лист: " + name);
          
          var archiveName = "Архив_" + name + "_" + todayStr;
          
          // Проверка на уникальность имени архива
          var counter = 1;
          var finalName = archiveName;
          while (ss.getSheetByName(finalName)) {
            finalName = archiveName + "_" + counter;
            counter++;
          }

          sheet.setName(finalName);
          
          // Создаем новый чистый лист
          var newSheet = ss.insertSheet(name);
          newSheet.appendRow(["Дата/Время", "Стадия", "Пользователь", "Время (сек)", "Статус", "SessionID"]);
          newSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3");
          newSheet.setFrozenRows(1);
        }
      });
    } finally {
      lock.releaseLock();
    }
  }
}

// ... (Cleanup, Setup - без изменений)
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
    var duration = 0;
    if (typeof rawDur === 'number') duration = rawDur;
    else duration = parseFloat(String(rawDur).replace(',', '.'));
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