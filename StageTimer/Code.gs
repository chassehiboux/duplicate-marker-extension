// ================= КОНФИГУРАЦИЯ =================
const SPREADSHEET_ID = '1jhqGwRJuZBDIwGsPTTW1rm2HODT_dgtHQzLko1wvDY0'; 
const TELEGRAM_BOT_TOKEN = '8598364240:AAGL_8euP_L5zXVoSYEZ08HWoxBZOJgsIlE';

const SHEET_SETTINGS = 'ДАШБОРД'; // Имя главного листа
const DATA_HEADERS = ["Дата/Время", "Департамент", "Стадия", "Пользователь", "Время (сек)", "Статус", "SessionID", "Тип загрузки", "Версия", "URL Request"];
const WAITING_ENTRY_FRESHNESS_SEC = 180; // ОЖИДАНИЕ считаем актуальным 3 минуты (а не 1), чтобы не флапать при задержках доставки
const WAITING_ROW_CLEANUP_SEC = 300; // Удаляем "зависшие" ОЖИДАНИЕ спустя 5 минут
const MAX_WAITING_DURATION_SEC = 2 * 60 * 60; // Жесткий лимит для ОЖИДАНИЕ: 2 часа
const ALERT_RECOVERY_HOLD_SEC = 180; // После последнего ALERT держим статус ALERT еще 3 минуты
const ALERT_OK_CONFIRM_CYCLES = 2; // Дополнительно требуем 2 спокойных цикла monitorPerformance перед OK
// --- ОКНО УВЕДОМЛЕНИЙ (GMT+5) ---
const NOTIFY_TIMEZONE = "GMT+5";
const NOTIFY_WINDOW_START_CELL = "B2"; // HH:MM
const NOTIFY_WINDOW_END_CELL = "D2";   // HH:MM

// ================= 0. МЕНЮ =================
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('🚀 Пирамида Монитор')
      .addItem('🔄 Обновить Дашборд', 'monitorPerformance')
      .addItem('🔍 Декодировать URL', 'decodeSelectedUrl')
      .addSeparator()
      .addItem('🧹 Принудительная очистка (Только сегодня)', 'performCleanup')
      .addItem('⚙️ Сброс настроек (Setup)', 'setupDashboard')
      .addToUi(); 
}

function decodeSelectedUrl() {
  var ui = SpreadsheetApp.getUi();
  var range = SpreadsheetApp.getActiveRange();

  if (!range) {
    ui.alert("Выберите ячейку с URL и повторите.");
    return;
  }

  if (range.getNumRows() > 1 || range.getNumColumns() > 1) {
    range = range.getCell(1, 1);
  }

  var displayValue = range.getDisplayValue();
  var richText = range.getRichTextValue();
  var richLink = richText ? richText.getLinkUrl() : "";
  var rawUrl = String(richLink || displayValue || "").trim();

  if (!rawUrl) {
    ui.alert("В выбранной ячейке пусто. Нужен URL для декодирования.");
    return;
  }

  var report = buildDecodedUrlReport(rawUrl);
  showDecodedUrlModal(report);
}

function buildDecodedUrlReport(rawUrl) {
  var params = parseUrlParams(rawUrl);
  var report = {
    rawUrl: rawUrl,
    search: toDisplayValue(getParamValue(params, ["_search", "search"])),
    nd: formatNdDisplay(getParamValue(params, ["nd"])),
    rows: toDisplayValue(getParamValue(params, ["rows"])),
    page: toDisplayValue(getParamValue(params, ["page"])),
    sidx: toDisplayValue(getParamValue(params, ["sidx"])),
    sord: toDisplayValue(getParamValue(params, ["sord"])),
    groupOp: "(пусто)",
    filters: [],
    filtersError: "",
    filtersRaw: ""
  };

  var filtersRaw = firstParamValue(getParamValue(params, ["filters"]));
  report.filtersRaw = filtersRaw;
  if (!filtersRaw) {
    return report;
  }

  var parsedFilters = tryParseFilters(filtersRaw);
  if (parsedFilters.error) {
    report.filtersError = parsedFilters.error;
    return report;
  }

  report.groupOp = toDisplayValue(parsedFilters.value.groupOp);

  var collectedRules = [];
  collectFilterRules(parsedFilters.value, collectedRules);
  report.filters = collectedRules;
  return report;
}

function parseUrlParams(rawUrl) {
  var url = String(rawUrl || "").trim();
  var query = url;

  var qIndex = query.indexOf("?");
  if (qIndex >= 0) {
    query = query.substring(qIndex + 1);
  }

  var hashIndex = query.indexOf("#");
  if (hashIndex >= 0) {
    query = query.substring(0, hashIndex);
  }

  var result = {};
  if (!query) return result;

  query.split("&").forEach(function(pair) {
    if (!pair) return;

    var eqIndex = pair.indexOf("=");
    var key = eqIndex >= 0 ? pair.substring(0, eqIndex) : pair;
    var value = eqIndex >= 0 ? pair.substring(eqIndex + 1) : "";

    key = safeDecodeURIComponent(key.replace(/\+/g, " "));
    value = safeDecodeURIComponent(value.replace(/\+/g, " "));

    if (result[key] === undefined) {
      result[key] = value;
    } else if (Array.isArray(result[key])) {
      result[key].push(value);
    } else {
      result[key] = [result[key], value];
    }
  });

  return result;
}

function tgEscape_(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate_(s, n) {
  s = String(s || "");
  if (s.length <= n) return s;
  return s.substring(0, n - 1) + "…";
}

function getUrlHostShort_(rawUrl) {
  var m = String(rawUrl || "").match(/^https?:\/\/([^\/?#]+)/i);
  if (!m) return "";
  var host = m[1].toLowerCase();
  // коротко: берем первый “ярлык” до точки: pyramid / kgn / и т.п.
  return host.split(".")[0] || host;
}

function getUrlPath_(rawUrl) {
  var m = String(rawUrl || "").match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i);
  return m && m[1] ? m[1] : "";
}

function prettyField_(field) {
  var map = {
    "Individual_FullName": "ФИО",
    "Claimant_Name": "Взыскатель",
    "CaseNumber": "№ дела",
    "V_OVZID.EDocID": "EDocID"
  };
  return map[field] || field || "";
}

function buildUrlHintForTelegram_(rawUrl) {
  var url = String(rawUrl || "").trim();
  if (!url) return "";

  var params = parseUrlParams(url);

  var rows = firstParamValue(getParamValue(params, ["rows"]));
  var page = firstParamValue(getParamValue(params, ["page"]));
  var sidx = firstParamValue(getParamValue(params, ["sidx"]));
  var sord = firstParamValue(getParamValue(params, ["sord"]));

  var bits = [];
  if (rows && rows !== "(пусто)") bits.push("строк=" + rows);
  if (page && page !== "(пусто)") bits.push("стр=" + page);
  if (sidx && sidx !== "(пусто)") {
    var arrow = (sord === "asc") ? "↑" : (sord === "desc" ? "↓" : "");
    bits.push("сорт=" + sidx + arrow);
  }

  // filters (первое правило — как “куда копать”)
  var filterLine = "";
  var filtersRaw = firstParamValue(getParamValue(params, ["filters"]));
  if (filtersRaw) {
    var parsed = tryParseFilters(filtersRaw);
    if (!parsed.error && parsed.value) {
      var rules = [];
      collectFilterRules(parsed.value, rules);
      if (rules.length > 0) {
        var r = rules[0];
        var f = prettyField_(toDisplayValue(r.field));
        var op = toDisplayValue(r.op);
        var d = toDisplayValue(r.data);
        d = truncate_(d, 80);
        filterLine = "🧩 Фильтр: <code>" + tgEscape_(f) + "</code> (" + tgEscape_(op) + ") = \"" + tgEscape_(d) + "\"";
      }
    }
  }

  if (bits.length === 0 && !filterLine) return "";

  var line1 = bits.length ? ("🔎 " + tgEscape_(bits.join(" • "))) : "";
  return filterLine ? (line1 ? (line1 + "\n" + filterLine) : filterLine) : line1;
}

function getParamValue(params, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (params[key] !== undefined) return params[key];
  }
  return "";
}

function firstParamValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : "";
  }
  if (value === null || value === undefined) return "";
  return String(value);
}

function toDisplayValue(value) {
  var v = firstParamValue(value);
  return v === "" ? "(пусто)" : v;
}

function formatNdDisplay(ndValue) {
  var raw = firstParamValue(ndValue);
  if (!raw) return "(пусто)";

  var numeric = Number(raw);
  if (!isFinite(numeric)) return raw + " (не число)";

  var date = new Date(numeric);
  if (isNaN(date.getTime())) return raw + " (некорректная дата)";

  var gmt5 = Utilities.formatDate(date, "GMT+5", "dd.MM.yyyy HH:mm:ss");
  return raw + " (" + gmt5 + " GMT+5)";
}

function tryParseFilters(filtersRaw) {
  var candidates = [
    String(filtersRaw || ""),
    safeDecodeURIComponent(String(filtersRaw || ""))
  ];

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (!candidate) continue;

    try {
      return { value: JSON.parse(candidate), error: "" };
    } catch (e) { }
  }

  return { value: null, error: "Не удалось распарсить JSON filters." };
}

function collectFilterRules(node, out) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node.rules)) {
    node.rules.forEach(function(rule) {
      if (!rule || typeof rule !== "object") return;

      if (rule.field !== undefined || rule.data !== undefined || rule.op !== undefined) {
        out.push({
          field: rule.field,
          data: rule.data,
          op: rule.op
        });
      } else {
        collectFilterRules(rule, out);
      }
    });
  }

  if (Array.isArray(node.groups)) {
    node.groups.forEach(function(group) {
      collectFilterRules(group, out);
    });
  }
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function showDecodedUrlModal(report) {
  var html = buildDecodedUrlModalHtml(report);

  var output = HtmlService.createHtmlOutput(html)
    .setWidth(1000)
    .setHeight(620);

  SpreadsheetApp.getUi().showModalDialog(output, "Декодирование URL");
}

function buildDecodedUrlModalHtml(report) {
  var rowsHtml = "";

  if (report.filtersError) {
    rowsHtml = "<div class='error'>"
      + "<b>Ошибка разбора filters:</b> " + escapeHtml(report.filtersError)
      + "<div class='raw-title'>filters (raw):</div>"
      + "<pre>" + escapeHtml(report.filtersRaw || "(пусто)") + "</pre>"
      + "</div>";
  } else if (!report.filters || report.filters.length === 0) {
    rowsHtml = "<div class='empty'>Фильтры не найдены</div>";
  } else {
    var bodyRows = "";
    report.filters.forEach(function(rule) {
      var field = toDisplayValue(rule.field);
      var value = toDisplayValue(rule.data);
      var op = toDisplayValue(rule.op);
      var valueWithOp = value + " <span class='op'>(op: " + escapeHtml(op) + ")</span>";
      bodyRows += "<tr><td>" + escapeHtml(field) + "</td><td>" + valueWithOp + "</td></tr>";
    });

    rowsHtml = ""
      + "<div class='group-op'>groupOp: <b>" + escapeHtml(report.groupOp) + "</b></div>"
      + "<table class='grid'>"
      + "<thead><tr><th>Поле</th><th>Значение</th></tr></thead>"
      + "<tbody>" + bodyRows + "</tbody>"
      + "</table>";
  }

  return "<!doctype html><html><head><meta charset='utf-8'>"
    + "<style>"
    + "body{font-family:Arial,sans-serif;margin:0;padding:14px;background:#f7f7f7;color:#222;}"
    + ".card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:12px;}"
    + ".title{font-size:15px;font-weight:700;margin:0 0 8px 0;}"
    + ".url{font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;background:#fafafa;border:1px solid #e7e7e7;border-radius:6px;padding:8px;}"
    + ".summary{width:100%;border-collapse:collapse;font-size:13px;}"
    + ".summary td{border:1px solid #ececec;padding:7px 8px;vertical-align:top;}"
    + ".summary td:first-child{width:170px;background:#fafafa;font-weight:600;}"
    + ".group-op{margin:0 0 8px 0;font-size:13px;}"
    + ".grid{width:100%;border-collapse:collapse;font-size:13px;}"
    + ".grid th,.grid td{border:1px solid #ececec;padding:7px 8px;text-align:left;vertical-align:top;}"
    + ".grid th{background:#f3f7ff;font-weight:700;}"
    + ".op{color:#666;font-size:12px;}"
    + ".error{background:#fff5f5;border:1px solid #ffcccc;color:#9f2c2c;border-radius:6px;padding:8px;}"
    + ".error .raw-title{margin-top:8px;font-weight:700;}"
    + ".error pre{margin:6px 0 0 0;white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;}"
    + ".empty{color:#666;font-style:italic;}"
    + "</style></head><body>"
    + "<div class='card'><div class='title'>URL запроса</div><div class='url'>" + escapeHtml(report.rawUrl) + "</div></div>"
    + "<div class='card'><div class='title'>Параметры</div>"
    + "<table class='summary'>"
    + "<tr><td>Search</td><td>" + escapeHtml(report.search) + "</td></tr>"
    + "<tr><td>nd</td><td>" + escapeHtml(report.nd) + "</td></tr>"
    + "<tr><td>rows / page</td><td>" + escapeHtml(report.rows) + " / " + escapeHtml(report.page) + "</td></tr>"
    + "<tr><td>sidx</td><td>" + escapeHtml(report.sidx) + "</td></tr>"
    + "<tr><td>sord</td><td>" + escapeHtml(report.sord) + "</td></tr>"
    + "</table></div>"
    + "<div class='card'><div class='title'>filters</div>" + rowsHtml + "</div>"
    + "</body></html>";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var baseName = normalizeBaseName(p.baseName);
    var sheet = getOrCreateDataSheet(ss, baseName);
    if (!sheet) {
      return ContentService.createTextOutput("Busy").setMimeType(ContentService.MimeType.TEXT);
    }

    var durationVal = p.duration || "0";
    var incomingStatus = p.status || "УСПЕШНО";
    var normalizedDuration = parseStageDuration(durationVal);

    if (incomingStatus === "ОЖИДАНИЕ" && normalizedDuration > MAX_WAITING_DURATION_SEC) {
      incomingStatus = "ОТМЕНА";
      normalizedDuration = MAX_WAITING_DURATION_SEC;
    }

    var durationStr = normalizedDuration.toFixed(2).replace(/\./g, ',');

    var rawVer = p.version || "";
    var versionStr = "'" + String(rawVer);
    var requestUrl = p.requestUrl ? String(p.requestUrl) : "";
    var departmentName = p.departmentName ? String(p.departmentName) : "Не определен";
    var eventDate = parseIncomingTimestamp(p.timestamp);

    sheet.appendRow([
      eventDate,
      departmentName,
      p.stageName || "Unknown",
      p.userName || "Guest",
      durationStr,
      incomingStatus,
      p.sessionId || "",
      p.loadType || "Прочее",
      versionStr,
      requestUrl
    ]);

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error("API Error: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function normalizeBaseName(rawBaseName) {
  var baseName = rawBaseName || "Неизвестная";
  if (baseName === SHEET_SETTINGS || baseName.startsWith("Архив_")) baseName += "_Data";
  return baseName;
}

function getOrCreateDataSheet(ss, baseName) {
  var sheet = ss.getSheetByName(baseName);
  if (sheet) {
    if (sheet.getLastRow() < 1) {
      initializeDataSheet(sheet);
    }
    return sheet;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return null;
  }

  try {
    sheet = ss.getSheetByName(baseName);
    if (!sheet) {
      sheet = ss.insertSheet(baseName);
      initializeDataSheet(sheet);
    } else if (sheet.getLastRow() < 1) {
      initializeDataSheet(sheet);
    } else {
      ensureDataSheetHeader(sheet);
    }
    return sheet;
  } finally {
    lock.releaseLock();
  }
}

function parseIncomingTimestamp(rawTimestamp) {
  if (!rawTimestamp) return new Date();

  var raw = String(rawTimestamp).trim();
  if (!raw) return new Date();

  var normalized = raw.replace(",", " ").replace(/\s+/g, " ").trim();
  var m = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    var day = parseInt(m[1], 10);
    var month = parseInt(m[2], 10) - 1;
    var year = parseInt(m[3], 10);
    var hours = parseInt(m[4] || "0", 10);
    var minutes = parseInt(m[5] || "0", 10);
    var seconds = parseInt(m[6] || "0", 10);

    return new Date(year, month, day, hours, minutes, seconds);
  }

  var direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;

  return new Date();
}

function initializeDataSheet(sheet) {
  sheet.appendRow(DATA_HEADERS);
  sheet.getRange(1, 1, 1, DATA_HEADERS.length).setFontWeight("bold").setBackground("#d9ead3");
  sheet.setFrozenRows(1);
}

function ensureDataSheetHeader(sheet) {
  if (sheet.getLastRow() < 1) {
    initializeDataSheet(sheet);
    return;
  }

  var headerRange = sheet.getRange(1, 1, 1, DATA_HEADERS.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsUpdate = false;

  for (var i = 0; i < DATA_HEADERS.length; i++) {
    if (currentHeaders[i] !== DATA_HEADERS[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    headerRange.setValues([DATA_HEADERS]);
  }

  headerRange.setFontWeight("bold").setBackground("#d9ead3");
  sheet.setFrozenRows(1);
}

function isKnownStageStatus(status) {
  return status === "УСПЕШНО" || status === "ОЖИДАНИЕ" || status === "ОТМЕНА" || status === "ОШИБКА";
}

function parseStageDuration(rawValue) {
  var parsed = (typeof rawValue === 'number') ? rawValue : parseFloat(String(rawValue).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

function getStageRowModel(row) {
  var isNewFormat = isKnownStageStatus(row[5]);

  if (isNewFormat) {
    return {
      rowDate: row[0],
      department: row[1] || "Не определен",
      stage: row[2] || "Unknown",
      user: row[3] || "Guest",
      rawDuration: row[4],
      status: row[5] || "",
      sessionId: row[6] || "",
      loadType: row[7] || "Прочее",
      version: row[8] || "",
      requestUrl: row[9] || ""
    };
  }

  return {
    rowDate: row[0],
    department: "Не определен",
    stage: row[1] || "Unknown",
    user: row[2] || "Guest",
    rawDuration: row[3],
    status: row[4] || "",
    sessionId: row[5] || "",
    loadType: row[6] || "Прочее",
    version: row[7] || "",
    requestUrl: row[8] || ""
  };
}

// ================= 2. МОНИТОРИНГ И ДАШБОРД =================

function monitorPerformance() {
  console.log("=== ЗАПУСК МОНИТОРИНГА ===");
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  cleanupStaleWaitingRows(ss);

  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) settingsSheet = ss.insertSheet(SHEET_SETTINGS);

  var timeZone = ss.getSpreadsheetTimeZone();
  var lastUpdateCell = settingsSheet.getRange("E8");
  var now = new Date();
  
  var windowMinutes = 3; 
  var filterFromDate = new Date(now.getTime() - windowMinutes * 60 * 1000);
  var lookBackDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); 
  
  var periodStr = Utilities.formatDate(filterFromDate, timeZone, "HH:mm") + " — " + 
                  Utilities.formatDate(now, timeZone, "HH:mm");

  var data = calculateStatsAndUsers(ss, lookBackDate, filterFromDate, now);
  var dayStats = calculateDayAnalysis(ss, new Date(new Date().setHours(0,0,0,0)));

  settingsSheet.getRange("A10:Z1000").clear();

  updateGlobalUserTable(settingsSheet, data.globalUserSummary);
  updateMainDashboard(settingsSheet, data.mainStats, periodStr);
  updateUserDashboard(settingsSheet, data.userStats, periodStr);
  updateDayAnalysisDashboard(settingsSheet, dayStats, Utilities.formatDate(now, timeZone, "dd.MM.yyyy"));
  
  checkAlerts(settingsSheet, data.mainStats, timeZone);

  lastUpdateCell.setValue(now).setNumberFormat("dd.MM.yyyy HH:mm:ss");
  console.log("=== ЗАВЕРШЕНО ===");
}

function calculateStatsAndUsers(ss, scanStartDate, filterNewDate, now) {
  var sheets = ss.getSheets();
  var mainStats = {}; 
  var userStats = {};
  var globalUsers = {};

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var startRow = Math.max(2, lastRow - 3000); 
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, DATA_HEADERS.length).getValues(); 

    var uniqueSessions = {};

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rowModel = getStageRowModel(row);
      var rowDate = rowModel.rowDate; 
      if (!(rowDate instanceof Date)) continue; 

      var user = rowModel.user || "Guest";
      var ver = rowModel.version || "";

      if (!globalUsers[user]) {
        globalUsers[user] = { lastDate: rowDate, version: ver };
      } else {
        if (rowDate > globalUsers[user].lastDate) {
          globalUsers[user].lastDate = rowDate;
          globalUsers[user].version = ver;
        }
      }

      if (rowDate > scanStartDate) {
        var sessionId = rowModel.sessionId || "no_id_" + Math.random();
        var status = rowModel.status;
        var duration = parseStageDuration(rowModel.rawDuration);

        if (status === "ОЖИДАНИЕ") {
          if (duration > MAX_WAITING_DURATION_SEC) continue;
          var secondsSinceLastUpdate = (now.getTime() - rowDate.getTime()) / 1000;
          if (secondsSinceLastUpdate > WAITING_ENTRY_FRESHNESS_SEC) continue;
        }

        if (!uniqueSessions[sessionId]) {
          uniqueSessions[sessionId] = { model: rowModel, duration: duration };
        } else {
          var existing = uniqueSessions[sessionId];
          var existingStatus = existing.model.status;

          if (status !== "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
            uniqueSessions[sessionId] = { model: rowModel, duration: duration };
          }
          else if (status === "ОЖИДАНИЕ" && existingStatus === "ОЖИДАНИЕ") {
            if (duration > existing.duration) uniqueSessions[sessionId] = { model: rowModel, duration: duration };
          }
          else if (status !== "ОЖИДАНИЕ" && existingStatus !== "ОЖИДАНИЕ") {
             if (duration > existing.duration) uniqueSessions[sessionId] = { model: rowModel, duration: duration };
          }
        }
      }
    }

    if (!mainStats[name]) mainStats[name] = {};

    for (var sid in uniqueSessions) {
      var entry = uniqueSessions[sid];
      var rowModel = entry.model;
      var duration = entry.duration;
      
      var rowDate = rowModel.rowDate;
      var stage = rowModel.stage || "Unknown";
      var user = rowModel.user || "Unknown";
      var status = rowModel.status;
      var loadType = rowModel.loadType || "Прочее";

      if (status !== "УСПЕШНО" && status !== "ОЖИДАНИЕ" && duration < 5) continue;

      var isWaiting = (status === "ОЖИДАНИЕ");
      var isNewFinished = (rowDate > filterNewDate);

      if (isWaiting || isNewFinished) {
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
        ms.loads.push({
          user: user,
          time: duration,
          department: rowModel.department || "Не определен",
          requestUrl: rowModel.requestUrl || "",
          sessionId: rowModel.sessionId || ""
        });
        if (status === "УСПЕШНО") { } 
        else if (status === "ОЖИДАНИЕ") { 
            ms.waiting++; 
            if (duration > ms.maxWaiting) ms.maxWaiting = duration;
        } 
        else { ms.errors++; }

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
  
  return { mainStats: mainStats, userStats: userStats, globalUserSummary: globalUsers };
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
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, DATA_HEADERS.length).getValues();

    if (!stats[name]) stats[name] = {};

    data.forEach(function(row) {
      var rowModel = getStageRowModel(row);
      var rowDate = rowModel.rowDate;
      if (!(rowDate instanceof Date)) return;

      if (rowDate >= startOfDay) {
        var status = rowModel.status;
        var duration = parseStageDuration(rowModel.rawDuration);
        if (status === "ОЖИДАНИЕ" && duration > MAX_WAITING_DURATION_SEC) return;

        if (status !== "УСПЕШНО" && duration < 5) return;

        var stage = rowModel.stage || "Unknown";
        var loadType = rowModel.loadType || "Прочее";
        
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


// ---------------- ОТРИСОВКА ----------------

function updateGlobalUserTable(sheet, globalUsers) {
  sheet.getRange("A8").setValue("ПОЛЬЗОВАТЕЛИ (ONLINE)");
  var headers = [["Пользователь", "Последняя активность", "Версия"]];
  sheet.getRange("A9:C9").setValues(headers).setBackground("#3c78d8").setFontColor("white").setFontWeight("bold");

  var output = [];
  for (var user in globalUsers) {
    var u = globalUsers[user];
    var vStr = String(u.version);
    if (!vStr.startsWith("'")) vStr = "'" + vStr;
    
    output.push([user, u.lastDate, vStr]);
  }

  output.sort((a, b) => b[1] - a[1]);

  if (output.length > 0) {
    sheet.getRange(10, 1, output.length, 3).setValues(output);
    sheet.getRange(10, 2, output.length, 1).setNumberFormat("dd.MM.yyyy HH:mm:ss");
  } else {
    sheet.getRange("A10").setValue("Нет данных");
  }
}

function updateMainDashboard(sheet, stats, periodStr) {
  sheet.getRange("E8").setValue("СВОДНЫЙ ДАШБОРД (Период: " + periodStr + ")");
  var headers = [["База", "Тип загрузки", "Стадия", "Всего", "В работе", "Ошиб/Отм", "Ср. время", "Макс", "Медл (>10с)"]];
  sheet.getRange("E9:M9").setValues(headers).setBackground("#4a86e8").setFontColor("white").setFontWeight("bold");

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
  output.sort((a, b) => b[4] - a[4] || b[5] - a[5] || b[6] - a[6]); 

  if (output.length > 0) {
    sheet.getRange(10, 5, output.length, 9).setValues(output);
    sheet.getRange(10, 11, output.length, 2).setNumberFormat("0.00"); 
  } else {
    sheet.getRange("E10").setValue("Нет активных данных");
  }
}

function updateUserDashboard(sheet, userStats, periodStr) {
  sheet.getRange("O8").setValue("ДЕТАЛИЗАЦИЯ (Период: " + periodStr + ")");
  var headers = [["Пользователь", "База", "Тип загрузки", "Стадия", "Кол-во", "Ср. Время", "Макс"]];
  sheet.getRange("O9:U9").setValues(headers).setBackground("#6aa84f").setFontColor("white").setFontWeight("bold");

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
    sheet.getRange(10, 15, output.length, 7).setValues(output);
    sheet.getRange(10, 20, output.length, 2).setNumberFormat("0.00");
  } else {
    sheet.getRange("O10").setValue("Нет активности");
  }
}

function updateDayAnalysisDashboard(sheet, dayStats, dateStr) {
  sheet.getRange("W8").setValue("АНАЛИЗ ДНЯ (" + dateStr + ")");
  var headers = [["База", "Тип загрузки", "Стадия", "Худший час (Ср.)", "Общее среднее", "Лучший час (Ср.)"]];
  sheet.getRange("W9:AB9").setValues(headers).setBackground("#e06666").setFontColor("white").setFontWeight("bold");

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
    sheet.getRange(10, 23, output.length, 6).setValues(output);
    sheet.getRange(10, 27, output.length, 1).setNumberFormat("0.00"); 
  } else {
    sheet.getRange("W10").setValue("Нет данных за сегодня");
  }
}

function pad2_(n) {
  n = Number(n) || 0;
  return (n < 10 ? "0" : "") + n;
}

function parseHHMM_(raw) {
  var s = String(raw || "").trim();
  if (!s) return { ok: false, minutes: 0, str: "" };

  var m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return { ok: false, minutes: 0, str: "" };

  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return { ok: false, minutes: 0, str: "" };

  return {
    ok: true,
    minutes: hh * 60 + mm,
    str: pad2_(hh) + ":" + pad2_(mm)
  };
}

function getNowMinutesInTz_(tz) {
  var hhmm = Utilities.formatDate(new Date(), tz, "HH:mm"); // уже с ведущими нулями
  var p = parseHHMM_(hhmm);
  return p.ok ? p.minutes : 0;
}

function isWithinWindow_(nowMin, startMin, endMin) {
  // start == end -> считаем "всегда можно" (24ч), чтобы не “вырубить” мониторинг случайно
  if (startMin === endMin) return true;

  // обычное окно (например 09:00-21:00)
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;

  // окно через полночь (например 22:00-06:00)
  return nowMin >= startMin || nowMin < endMin;
}

function readNotifyWindow_(sheet) {
  var startRaw = sheet.getRange(NOTIFY_WINDOW_START_CELL).getDisplayValue();
  var endRaw = sheet.getRange(NOTIFY_WINDOW_END_CELL).getDisplayValue();

  var start = parseHHMM_(startRaw);
  var end = parseHHMM_(endRaw);

  // если невалидно — ограничения НЕ применяем (fail-open)
  if (!start.ok || !end.ok) {
    return { enabled: false, startMin: 0, endMin: 0, startStr: "", endStr: "" };
  }

  return { enabled: true, startMin: start.minutes, endMin: end.minutes, startStr: start.str, endStr: end.str };
}

// ---------------- АЛЕРТЫ ----------------
function checkAlerts(sheet, stats, timeZone) {
  var configsRange = sheet.getRange("A4:F6");
  var configs = configsRange.getValues();
  var props = PropertiesService.getScriptProperties();
  var nowMs = Date.now();
  var notifyWindow = readNotifyWindow_(sheet);
  var nowMinGmt5 = notifyWindow.enabled ? getNowMinutesInTz_(NOTIFY_TIMEZONE) : 0;
  var recoveryHoldMs = ALERT_RECOVERY_HOLD_SEC * 1000;
  var extraConfirmCycles = Math.max(1, ALERT_OK_CONFIRM_CYCLES) - 1;

  for (var i = 0; i < configs.length; i++) {
    var row = configs[i];
    var baseTarget = row[0]; 
    var limit = row[1];      
    var chatId = row[2];     
    var isActive = row[3];   
    var lastMsgId = row[4]; 
    var lastStatus = row[5] || "OK";

    if (!baseTarget || !limit || !chatId || isActive !== true) continue;

    // --- Ограничение отправки/редактирования по окну времени (GMT+5) ---
    if (notifyWindow.enabled && !isWithinWindow_(nowMinGmt5, notifyWindow.startMin, notifyWindow.endMin)) {
      var offText = "Уведомления приходят в рабочее время с " + notifyWindow.startStr + " до " + notifyWindow.endStr;

      // В нерабочее время именно РЕДАКТИРУЕМ сообщение, чтобы не спамить
      var offMsgId = null;

      if (lastMsgId) {
        var editedOff = editTelegramMessage(chatId, lastMsgId, offText);
        if (editedOff === "SUCCESS") {
          offMsgId = lastMsgId;
        } else if (editedOff === "NOT_FOUND") {
          offMsgId = sendTelegram(chatId, offText, true /* silent */);
        } else {
          offMsgId = lastMsgId; // оставляем как есть, чтобы не плодить новые
        }
      } else {
        offMsgId = sendTelegram(chatId, offText, true /* silent */);
      }

      if (offMsgId) {
        sheet.getRange(4 + i, 5).setValue(offMsgId);
      }
      sheet.getRange(4 + i, 6).setValue("OFF");
      continue;
    }

    var alertBlocks = []; 

    for (var baseName in stats) {
      if (baseTarget !== "*" && baseName !== baseTarget) continue;
      
      var baseAlerts = []; 

      for (var loadType in stats[baseName]) {
        var loadTypeAlerts = []; 

        for (var stageName in stats[baseName][loadType]) {
          var s = stats[baseName][loadType][stageName];
          if (s.count === 0) continue; 

          var avgTime = (s.timeSum / s.count);
          var isAlertCondition = (avgTime > limit) || (s.maxWaiting > limit);

          if (isAlertCondition) {
            var perUser = {};
            s.loads.forEach(function(item) {
              var u = (item && item.user) ? String(item.user) : "Unknown";
              if (!perUser[u] || (Number(item.time || 0) > Number(perUser[u].time || 0))) {
                perUser[u] = item; // храним запись с максимальным временем
              }
            });

            var topSlowest = Object.keys(perUser)
              .map(function(k){ return perUser[k]; })
              .sort(function(a, b){ return Number(b.time || 0) - Number(a.time || 0); })
              .slice(0, 3);

            var top3Msg = "";
            topSlowest.forEach(function(item, index) {
              var tStr = Number(item.time || 0).toFixed(1).replace('.', ',');
              var dep = item.department ? String(item.department) : "Не определен";
              var hint = buildUrlHintForTelegram_(item.requestUrl || "");

              top3Msg +=
                "   " + (index + 1) + ") <b>" + tgEscape_(item.user) + "</b> — " + tgEscape_(tStr) + "с\n       🏛 - <i>" + tgEscape_(dep) + "</i>" +
                (hint ? ("\n      " + hint.replace(/\n/g, "\n      ")) : "") +
                "\n";
            });
            top3Msg = top3Msg.trimEnd();  
                      
            var avgStr = avgTime.toFixed(1).replace('.', ',');
            
            var stageBlock =
              "   🔸 <b>" + tgEscape_(stageName) + "</b>" +
              (top3Msg ? ("\n" + top3Msg) : "\n   — нет данных");   
                       
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

    var stateKey = getAlertStateKey(baseTarget, chatId, i);
    var alertState = loadAlertState(props, stateKey);
    var previousStatus = alertState.status || lastStatus || "OK";
    var currentTime = Utilities.formatDate(new Date(), timeZone, "HH:mm");
    var finalMessage = "";
    var currentStatus = "OK";

    if (alertBlocks.length > 0) {
      currentStatus = "ALERT";
      alertState.lastAlertAtMs = nowMs;
      alertState.okStreak = 0;
      alertState.status = "ALERT";
      finalMessage = `⚠️ <b>ОБНАРУЖЕНО ЗАМЕДЛЕНИЕ</b>\n\n` + 
                     alertBlocks.join("\n\n====================\n\n") + 
                     `\n\n🕒 <i>Обновлено: ${currentTime}</i>`;
    } else {
      var withinRecoveryHold = alertState.lastAlertAtMs > 0 && ((nowMs - alertState.lastAlertAtMs) < recoveryHoldMs);

      if (previousStatus === "ALERT" && (withinRecoveryHold || alertState.okStreak < extraConfirmCycles)) {
        currentStatus = "ALERT";
        if (!withinRecoveryHold) {
          alertState.okStreak++;
        }

        var holdLeftSec = alertState.lastAlertAtMs > 0
          ? Math.max(0, Math.ceil((recoveryHoldMs - (nowMs - alertState.lastAlertAtMs)) / 1000))
          : 0;

        var reason = "";
        if (holdLeftSec > 0) {
          reason = `Идет удержание ALERT после последнего события: ещё ${holdLeftSec}с.`;
        } else if (extraConfirmCycles > 0) {
          reason = `Подтверждение нормализации: ${alertState.okStreak}/${extraConfirmCycles}.`;
        } else {
          reason = "Ожидаем следующий цикл для подтверждения нормализации.";
        }

        finalMessage = `🟡 <b>ОЖИДАНИЕ ПОДТВЕРЖДЕНИЯ НОРМАЛИЗАЦИИ</b>\n` +
                       `${reason}\n` +
                       `🕒 <i>Обновлено: ${currentTime}</i>`;
      } else {
        currentStatus = "OK";
        alertState.okStreak = 0;
        finalMessage = `🟢 <b>Система работает стабильно</b>\n` +
                       `Зависаний по критериям не обнаружено.\n` +
                       `🕒 <i>Обновлено: ${currentTime}</i>`;
      }

      alertState.status = currentStatus;
    }

    saveAlertState(props, stateKey, alertState);

    var newMsgId = null;

    if (currentStatus !== lastStatus) {

      // ✅ ALERT → OK: редактируем ALERT-сообщение в OK
      if (lastStatus === "ALERT" && currentStatus === "OK") {
        if (lastMsgId) {
          var editedToOk = editTelegramMessage(chatId, lastMsgId, finalMessage);
          if (editedToOk === "SUCCESS") {
            newMsgId = lastMsgId;
          } else if (editedToOk === "NOT_FOUND") {
            // если сообщения уже нет — запасной вариант: отправим OK тихо
            newMsgId = sendTelegram(chatId, finalMessage, true);
          } else {
            // чтобы не спамить — оставляем старый id как есть
            newMsgId = lastMsgId;
          }
        } else {
          newMsgId = sendTelegram(chatId, finalMessage, true);
        }
      }

      // ✅ OK → ALERT: удаляем OK и шлем новый ALERT
      else if (lastStatus === "OK" && currentStatus === "ALERT") {
        if (lastMsgId) deleteTelegramMessage(chatId, lastMsgId);
        newMsgId = sendTelegram(chatId, finalMessage, false);
      }

      // Остальные переходы (например OFF ↔ OK/ALERT, если ты уже добавил OFF)
      else {
        if (lastMsgId) {
          var editedAny = editTelegramMessage(chatId, lastMsgId, finalMessage);
          if (editedAny === "SUCCESS") {
            newMsgId = lastMsgId;
          } else if (editedAny === "NOT_FOUND") {
            var silentAny = (currentStatus === "OK" || currentStatus === "OFF");
            newMsgId = sendTelegram(chatId, finalMessage, silentAny);
          } else {
            newMsgId = lastMsgId;
          }
        } else {
          var silentAny2 = (currentStatus === "OK" || currentStatus === "OFF");
          newMsgId = sendTelegram(chatId, finalMessage, silentAny2);
        }
      }

    } else {
      // Статус не изменился — как раньше: обновляем (edit) то же сообщение
      if (lastMsgId) {
        var editedSame = editTelegramMessage(chatId, lastMsgId, finalMessage);
        if (editedSame === "SUCCESS") {
          newMsgId = lastMsgId;
        } else if (editedSame === "NOT_FOUND") {
          var silentSame = (currentStatus === "OK" || currentStatus === "OFF");
          newMsgId = sendTelegram(chatId, finalMessage, silentSame);
        } else {
          newMsgId = lastMsgId;
        }
      } else {
        var silentSame2 = (currentStatus === "OK" || currentStatus === "OFF");
        newMsgId = sendTelegram(chatId, finalMessage, silentSame2);
      }
    }
    
    if (newMsgId) {
      sheet.getRange(4 + i, 5).setValue(newMsgId);
    }
    sheet.getRange(4 + i, 6).setValue(currentStatus);
  }
}

function getAlertStateKey(baseTarget, chatId, rowIndex) {
  return "alert_state|" + rowIndex + "|" + String(baseTarget) + "|" + String(chatId);
}

function loadAlertState(props, key) {
  var raw = props.getProperty(key);
  if (!raw) {
    return { status: "OK", okStreak: 0, lastAlertAtMs: 0 };
  }
  try {
    var parsed = JSON.parse(raw);
    return {
      status: parsed.status || "OK",
      okStreak: Number(parsed.okStreak) || 0,
      lastAlertAtMs: Number(parsed.lastAlertAtMs) || 0
    };
  } catch (e) {
    return { status: "OK", okStreak: 0, lastAlertAtMs: 0 };
  }
}

function saveAlertState(props, key, state) {
  var payload = {
    status: state.status || "OK",
    okStreak: Number(state.okStreak) || 0,
    lastAlertAtMs: Number(state.lastAlertAtMs) || 0
  };
  props.setProperty(key, JSON.stringify(payload));
}

function clearAlertStateCache() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  for (var key in all) {
    if (key.indexOf("alert_state|") === 0) {
      props.deleteProperty(key);
    }
  }
}

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

function cleanupStaleWaitingRows(ss) {
  var sheets = ss.getSheets();
  var now = new Date();
  var thresholdTime = now.getTime() - WAITING_ROW_CLEANUP_SEC * 1000;

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var checkRows = Math.min(lastRow - 1, 500);
    var range = sheet.getRange(2, 1, checkRows, DATA_HEADERS.length);
    var values = range.getValues();
    var rowsToDelete = [];

    for (var i = values.length - 1; i >= 0; i--) {
      var rowModel = getStageRowModel(values[i]);
      var rowDate = rowModel.rowDate;
      var status = rowModel.status;
      var duration = parseStageDuration(rowModel.rawDuration);

      if (status === "ОЖИДАНИЕ" && rowDate instanceof Date) {
        if (rowDate.getTime() < thresholdTime || duration > MAX_WAITING_DURATION_SEC) {
           rowsToDelete.push(i + 2);
        }
      }
    }
    rowsToDelete.forEach(function(rowIndex) {
      sheet.deleteRow(rowIndex);
    });
  });
}

// ================= 3. ЖЕСТКАЯ ОЧИСТКА =================
function performCleanup() {
  console.log("=== ЗАПУСК ЖЕСТКОЙ ОЧИСТКИ ===");
  var lock = LockService.getScriptLock();
  
  if (lock.tryLock(45000)) { 
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var timeZone = ss.getSpreadsheetTimeZone();
      var sheets = ss.getSheets();
      
      var todayStr = Utilities.formatDate(new Date(), timeZone, "yyyyMMdd");
      var todayInt = parseInt(todayStr, 10);

      console.log("Фильтр даты: " + todayInt);

      sheets.forEach(function(sheet) {
        var name = sheet.getName();
        if (name === SHEET_SETTINGS || name.startsWith("Архив_")) return;
        compactSheet(sheet, todayInt, timeZone);
      });
      console.log("=== ГОТОВО ===");
    } catch (e) {
      console.error(e);
    } finally {
      lock.releaseLock();
    }
  }
}

function compactSheet(sheet, todayInt, timeZone) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(2, 1, lastRow - 1, DATA_HEADERS.length);
  var data = range.getValues();
  if (data.length === 0) return;

  var uniqueMap = {}; 
  var cntBefore = data.length;

  data.forEach(function(row) {
    var val = row[0];
    var rowDateInt = 0;

    if (val instanceof Date) {
      rowDateInt = parseInt(Utilities.formatDate(val, timeZone, "yyyyMMdd"), 10);
    } 
    else {
      var str = String(val);
      var parts = str.split(/[^\d]+/);
      if (parts.length >= 3) {
        var d = parts[0]; var m = parts[1]; var y = parts[2];
        if (y.length === 2) y = "20" + y;
        if (d.length === 1) d = "0" + d;
        if (m.length === 1) m = "0" + m;
        rowDateInt = parseInt(y + m + d, 10);
      }
    }

    if (rowDateInt > 0 && rowDateInt < todayInt) return;

    var rowModel = getStageRowModel(row);
    var sessionId = rowModel.sessionId || "unk_" + Math.random();
    var status = rowModel.status;
    var duration = parseStageDuration(rowModel.rawDuration);
    if (status === "ОЖИДАНИЕ" && duration > MAX_WAITING_DURATION_SEC) return;

    if (!uniqueMap[sessionId]) {
      uniqueMap[sessionId] = { row: row, model: rowModel, duration: duration };
    } else {
      var existing = uniqueMap[sessionId];
      var existingStatus = existing.model.status;
      
      var isNewWait = (status === "ОЖИДАНИЕ");
      var isOldWait = (existingStatus === "ОЖИДАНИЕ");

      if (!isNewWait && isOldWait) {
        uniqueMap[sessionId] = { row: row, model: rowModel, duration: duration };
      } 
      else if (isNewWait === isOldWait) {
        if (duration > existing.duration) {
          uniqueMap[sessionId] = { row: row, model: rowModel, duration: duration };
        }
      }
    }
  });

  var cleanData = [];
  for (var key in uniqueMap) cleanData.push(uniqueMap[key].row);
  
  cleanData.sort(function(a, b) { return new Date(a[0]) - new Date(b[0]); });

  console.log("Лист " + sheet.getName() + ": " + cntBefore + " -> " + cleanData.length);

  if (cleanData.length < cntBefore) {
    range.clearContent();
    if (cleanData.length > 0) {
      sheet.getRange(2, 1, cleanData.length, DATA_HEADERS.length).setValues(cleanData);
    }
  }
}

// ================= SETUP =================
function setupDashboard() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) sheet = ss.insertSheet(SHEET_SETTINGS);
  clearAlertStateCache();
  
  sheet.clear();
  sheet.getRange("A1").setValue("НАСТРОЙКИ МОНИТОРИНГА").setFontSize(14).setFontWeight("bold");
    // Окно уведомлений (GMT+5)
  sheet.getRange("A2").setValue("Начало дня (GMT+5)").setFontWeight("bold");
  sheet.getRange("B2").setValue("09:00").setNumberFormat("@");
  sheet.getRange("C2").setValue("Конец дня (GMT+5)").setFontWeight("bold");
  sheet.getRange("D2").setValue("21:00").setNumberFormat("@");
  sheet.getRange("A2:D2").setBackground("#fff2cc");
  sheet.getRange("A3:F3").setValues([["Имя базы (или *)", "Лимит времени (сек)", "ID Чата Telegram", "Активно?", "ID посл. сообщ.", "Статус (Last)"]]);
  sheet.getRange("A3:F3").setBackground("#cfe2f3").setFontWeight("bold");
  
  sheet.getRange("A4:D4").setValues([["*", 15, "ВСТАВЬТЕ_ID", true]]);
  sheet.getRange("D4").insertCheckboxes();
  
  // Создаем пустые заголовки для дашбордов при сетапе
  updateGlobalUserTable(sheet, {});
  updateMainDashboard(sheet, {}, "Ожидание");
  updateUserDashboard(sheet, {}, "Ожидание");
  updateDayAnalysisDashboard(sheet, {}, "Ожидание");

  console.log("Setup выполнен: Настройки и пустые дашборды созданы.");
}
