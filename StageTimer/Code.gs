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
const INCIDENT_TIMEZONE = "Asia/Yekaterinburg";
const INCIDENT_SHEET_PREFIX = "Ошибки_";
const INCIDENT_EVENT_LOG_SHEET = "Инциденты_Лог";
const INCIDENT_DYNAMIC_WINDOW_MINUTES = 30;
const INCIDENT_CHAT_CONFIG_RANGE = "A4:F100";
const INCIDENT_SUMMARY_MESSAGE_KEY_PREFIX = "incident_summary_message_id|";
const ROWS10000_EVENT_TYPE = "rows10000_incident";
const ROWS10000_SHEET = "Rows10000_Incidents";
const ROWS10000_TRACE_FOLDER_NAME = "StageTimer_Rows10000_Traces";
const ROWS10000_ALERT_SENT_PREFIX = "rows10000_alert_sent|";
const ROWS10000_HEADERS = [
  "Дата/время",
  "TraceID",
  "База",
  "Департамент",
  "Пользователь",
  "Стадия",
  "Page URL",
  "Request URL",
  "Method",
  "Rows",
  "Counter",
  "SelarrrowLen",
  "VisibleChecked",
  "Причина",
  "Краткий текст",
  "Trace File URL",
  "Версия"
];
const INCIDENT_WORK_INTERVALS = [
  { key: "morning", label: "08:00-12:30", start: "08:00", end: "12:30" },
  { key: "day", label: "12:30-17:00", start: "12:30", end: "17:00" }
];
const INCIDENT_HEADERS = [
  "Первое появление",
  "Последнее появление",
  "Ключ интервала",
  "Тип",
  "База",
  "Департамент",
  "Пользователь",
  "EDocID",
  "DebtID",
  "URL",
  "Контекст",
  "Дата запроса ЕПГУ",
  "Тип запроса ЕПГУ",
  "Краткий текст",
  "Полный текст",
  "Сигнатура",
  "Повторы"
];
const INCIDENT_IDX_FIRST_SEEN = 0;
const INCIDENT_IDX_LAST_SEEN = 1;
const INCIDENT_IDX_INTERVAL_KEY = 2;
const INCIDENT_IDX_TYPE = 3;
const INCIDENT_IDX_BASE = 4;
const INCIDENT_IDX_DEPARTMENT = 5;
const INCIDENT_IDX_USER = 6;
const INCIDENT_IDX_EDOCID = 7;
const INCIDENT_IDX_DEBTID = 8;
const INCIDENT_IDX_URL = 9;
const INCIDENT_IDX_CONTEXT = 10;
const INCIDENT_IDX_EPGU_SENT_AT = 11;
const INCIDENT_IDX_EPGU_REQUEST_TYPE = 12;
const INCIDENT_IDX_SUMMARY_TEXT = 13;
const INCIDENT_IDX_FULL_TEXT = 14;
const INCIDENT_IDX_SIGNATURE = 15;
const INCIDENT_IDX_REPEAT_COUNT = 16;
const INCIDENT_EVENT_HEADERS = [
  "Дата/время",
  "Ключ интервала",
  "Тип",
  "База",
  "Департамент",
  "Пользователь",
  "Сигнатура"
];
const INCIDENT_EVENT_IDX_AT = 0;
const INCIDENT_EVENT_IDX_INTERVAL_KEY = 1;
const INCIDENT_EVENT_IDX_TYPE = 2;
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
  if (p && p.eventType === "stage_incident") {
    return handleIncidentRequest(p);
  }
  if (p && p.eventType === ROWS10000_EVENT_TYPE) {
    return handleRows10000IncidentRequest(p);
  }

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

function normalizeIncidentValue_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateIncidentText_(value, limit) {
  var normalized = normalizeIncidentValue_(value);
  var safeLimit = Math.max(0, Number(limit) || 0);
  if (!normalized || !safeLimit || normalized.length <= safeLimit) return normalized;
  return normalized.slice(0, Math.max(0, safeLimit - 3)).trimEnd() + "...";
}

function isIncidentSheetName_(name) {
  return String(name || "").indexOf(INCIDENT_SHEET_PREFIX) === 0;
}

function isIncidentSystemSheetName_(name) {
  return isIncidentSheetName_(name) || String(name || "") === INCIDENT_EVENT_LOG_SHEET;
}

function getIncidentSheetName_(baseName) {
  return INCIDENT_SHEET_PREFIX + String(baseName || "Неизвестная");
}

function initializeIncidentSheet_(sheet) {
  sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length).setValues([INCIDENT_HEADERS]);
  sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length).setFontWeight("bold").setBackground("#f4cccc");
  sheet.setFrozenRows(1);
}

function ensureIncidentSheetHeader_(sheet) {
  if (sheet.getLastRow() < 1) {
    initializeIncidentSheet_(sheet);
    return;
  }

  var headerRange = sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < INCIDENT_HEADERS.length; i++) {
    if (currentHeaders[i] !== INCIDENT_HEADERS[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    headerRange.setValues([INCIDENT_HEADERS]);
  }

  headerRange.setFontWeight("bold").setBackground("#f4cccc");
  sheet.setFrozenRows(1);
}

function getOrCreateIncidentSheet_(ss, baseName) {
  var sheetName = getIncidentSheetName_(baseName);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeIncidentSheet_(sheet);
    return sheet;
  }

  ensureIncidentSheetHeader_(sheet);
  return sheet;
}

function initializeIncidentEventLogSheet_(sheet) {
  sheet.getRange(1, 1, 1, INCIDENT_EVENT_HEADERS.length).setValues([INCIDENT_EVENT_HEADERS]);
  sheet.getRange(1, 1, 1, INCIDENT_EVENT_HEADERS.length).setFontWeight("bold").setBackground("#fce5cd");
  sheet.setFrozenRows(1);
  try {
    sheet.hideSheet();
  } catch (error) {
    // ignore
  }
}

function ensureIncidentEventLogSheetHeader_(sheet) {
  if (sheet.getLastRow() < 1) {
    initializeIncidentEventLogSheet_(sheet);
    return;
  }

  var headerRange = sheet.getRange(1, 1, 1, INCIDENT_EVENT_HEADERS.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < INCIDENT_EVENT_HEADERS.length; i++) {
    if (currentHeaders[i] !== INCIDENT_EVENT_HEADERS[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    headerRange.setValues([INCIDENT_EVENT_HEADERS]);
  }

  headerRange.setFontWeight("bold").setBackground("#fce5cd");
  sheet.setFrozenRows(1);
}

function getOrCreateIncidentEventLogSheet_(ss) {
  var sheet = ss.getSheetByName(INCIDENT_EVENT_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(INCIDENT_EVENT_LOG_SHEET);
    initializeIncidentEventLogSheet_(sheet);
    return sheet;
  }

  ensureIncidentEventLogSheetHeader_(sheet);
  return sheet;
}

function normalizeIncidentType_(rawType) {
  var normalized = String(rawType || "").toUpperCase();
  if (normalized === "GRID" || normalized === "ERROR_EXCEPTION" || normalized === "EPGU") return normalized;
  return "GRID";
}

function cutIncidentTextAtFirstMarker_(text, markers) {
  var source = String(text || "");
  var lower = source.toLowerCase();
  var cutIndex = -1;
  (markers || []).forEach(function(marker) {
    var normalizedMarker = String(marker || "").toLowerCase();
    if (!normalizedMarker) return;
    var idx = lower.indexOf(normalizedMarker);
    if (idx >= 0 && (cutIndex < 0 || idx < cutIndex)) {
      cutIndex = idx;
    }
  });
  return cutIndex >= 0 ? source.slice(0, cutIndex).trim() : source.trim();
}

function replaceDynamicIncidentFragments_(text) {
  return normalizeIncidentValue_(text)
    .replace(/\b(?=[A-Za-z0-9_-]{16,}\b)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]+\b/g, "<token>")
    .replace(/\b[a-f0-9]{24,}\b/ig, "<hash>")
    .replace(/(['"])[^'"\s]{16,}\1/g, "$1<token>$1")
    .replace(/\b\d{8,}\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGridIncidentErrorInfo_(text) {
  var normalized = normalizeIncidentValue_(text);
  if (!normalized) {
    return { key: "grid|ошибка", title: "Ошибка" };
  }

  if (/parsererror:\s*syntaxerror:\s*unexpected token/i.test(normalized)) {
    return {
      key: "grid|parsererror: syntaxerror: unexpected token",
      title: "parsererror: SyntaxError: Unexpected token"
    };
  }

  if (/out of memory/i.test(normalized)) {
    return { key: "grid|out of memory", title: "Out of memory" };
  }

  var sqlStateMatch = normalized.match(/sqlstate\[[^\]]+\]/i);
  if (sqlStateMatch) {
    return {
      key: "grid|" + sqlStateMatch[0].toLowerCase(),
      title: sqlStateMatch[0]
    };
  }

  if (/internal server error/i.test(normalized)) {
    return { key: "grid|internal server error", title: "Internal Server Error" };
  }

  var cleaned = cutIncidentTextAtFirstMarker_(normalized, [
    " <meta ",
    " <script",
    " <link ",
    " <style",
    " <div ",
    " <form ",
    " <title>",
    " пк пирамида ",
    " window.laravel",
    "$(\"#menu-toggle\")",
    "$(",
    " trace:",
    " stack:",
    " file:",
    " line:",
    "[object object]",
    "<!doctype",
    "<html",
    "<script"
  ]);
  cleaned = cleaned.replace(/,\s*["'].*$/, "");
  cleaned = replaceDynamicIncidentFragments_(cleaned || normalized);
  cleaned = truncateIncidentText_(cleaned, 120) || "Ошибка";

  return {
    key: "grid|" + cleaned.toLowerCase(),
    title: cleaned
  };
}

function buildEpguIncidentErrorInfo_(text) {
  var normalized = normalizeIncidentValue_(text);
  if (!normalized) {
    return { key: "epgu|ошибка", title: "Ошибка" };
  }

  var cleaned = normalized.replace(/^Ошибка:\s*/i, "");
  cleaned = cutIncidentTextAtFirstMarker_(cleaned, [
    " trace:",
    " stack:",
    " window.laravel",
    "[object object]"
  ]);

  var codeMatch = cleaned.match(/^([A-Za-z0-9_.-]+)/);
  if (codeMatch) {
    return {
      key: "epgu|" + codeMatch[1].toLowerCase(),
      title: "Ошибка: " + codeMatch[1]
    };
  }

  cleaned = cleaned.split(/[;(]/)[0] || cleaned;
  cleaned = replaceDynamicIncidentFragments_(cleaned);
  cleaned = truncateIncidentText_(cleaned, 120) || "Ошибка";

  return {
    key: "epgu|" + cleaned.toLowerCase(),
    title: "Ошибка: " + cleaned
  };
}

function buildErrorExceptionIncidentErrorInfo_(text) {
  var normalized = normalizeIncidentValue_(text);
  if (!normalized) {
    return { key: "error_exception|ошибка", title: "ERROR EXCEPTION" };
  }

  var messageMatch = normalized.match(/(?:^|\s)Message:\s*(.*?)(?=\s+(?:Request|URL|Method|Time|UserID|User):|$)/i);
  var cleaned = messageMatch && messageMatch[1] ? messageMatch[1] : normalized;
  cleaned = cleaned.replace(/^ERROR EXCEPTION\s*/i, "");
  cleaned = replaceDynamicIncidentFragments_(cleaned);
  cleaned = truncateIncidentText_(cleaned, 120) || "ERROR EXCEPTION";

  return {
    key: "error_exception|" + cleaned.toLowerCase(),
    title: cleaned
  };
}

function buildIncidentErrorInfo_(type, fullText, summaryText) {
  var incidentType = normalizeIncidentType_(type);
  var sourceText = normalizeIncidentValue_(fullText || summaryText);
  if (incidentType === "ERROR_EXCEPTION") {
    return buildErrorExceptionIncidentErrorInfo_(sourceText);
  }
  if (incidentType === "EPGU") {
    return buildEpguIncidentErrorInfo_(sourceText);
  }
  return buildGridIncidentErrorInfo_(sourceText);
}

function getIncidentIntervalInfo_(eventDate) {
  var date = eventDate instanceof Date && !isNaN(eventDate.getTime()) ? eventDate : new Date();
  var hhmm = Utilities.formatDate(date, INCIDENT_TIMEZONE, "HH:mm");
  var parsed = parseHHMM_(hhmm);
  if (!parsed.ok) {
    return { active: false, label: "", slotKey: "", dateKey: Utilities.formatDate(date, INCIDENT_TIMEZONE, "yyyy-MM-dd") };
  }

  var nowMin = parsed.minutes;
  var dateKey = Utilities.formatDate(date, INCIDENT_TIMEZONE, "yyyy-MM-dd");
  for (var i = 0; i < INCIDENT_WORK_INTERVALS.length; i++) {
    var item = INCIDENT_WORK_INTERVALS[i];
    var start = parseHHMM_(item.start);
    var end = parseHHMM_(item.end);
    if (!start.ok || !end.ok) continue;
    if (nowMin >= start.minutes && nowMin < end.minutes) {
      return {
        active: true,
        label: item.label,
        slotKey: item.key,
        dateKey: dateKey
      };
    }
  }

  return { active: false, label: "", slotKey: "", dateKey: dateKey };
}

function buildIncidentIntervalKey_(intervalInfo) {
  if (!intervalInfo || !intervalInfo.active) return "";
  return String(intervalInfo.dateKey) + "|" + String(intervalInfo.label);
}

function buildIncidentSignature_(incident) {
  var type = normalizeIncidentType_(incident.type);
  var errorInfo = buildIncidentErrorInfo_(type, incident.fullText, incident.summaryText);
  var parts;
  if (type === "EPGU") {
    parts = [
      incident.base,
      incident.department,
      incident.user,
      incident.edocId,
      incident.epguSentAt,
      errorInfo.key
    ];
  } else {
    parts = [
      incident.base,
      incident.department,
      incident.user,
      incident.pageUrl,
      errorInfo.key
    ];
  }

  return parts.map(normalizeIncidentValue_).join(" | ");
}

function buildIncidentPayload_(p, baseName, eventDate, intervalInfo) {
  var incident = {
    firstSeen: eventDate,
    lastSeen: eventDate,
    intervalKey: buildIncidentIntervalKey_(intervalInfo),
    type: normalizeIncidentType_(p.incidentType),
    base: normalizeIncidentValue_(baseName),
    department: normalizeIncidentValue_(p.departmentName) || "Не определен",
    user: normalizeIncidentValue_(p.userName) || "Не определен",
    edocId: normalizeIncidentValue_(p.edocId),
    debtId: normalizeIncidentValue_(p.debtId),
    pageUrl: normalizeIncidentValue_(p.pageUrl),
    context: normalizeIncidentValue_(p.context || p.stageName),
    epguSentAt: normalizeIncidentValue_(p.epguSentAt),
    epguRequestType: normalizeIncidentValue_(p.epguRequestType),
    summaryText: normalizeIncidentValue_(p.summaryText),
    fullText: normalizeIncidentValue_(p.fullText || p.summaryText),
    signature: "",
    repeatCount: 1
  };

  if (!incident.summaryText) {
    incident.summaryText = truncateIncidentText_(incident.fullText, 160);
  }
  if (!incident.fullText) {
    incident.fullText = incident.summaryText;
  }
  incident.signature = buildIncidentSignature_(incident);
  return incident;
}

function buildIncidentRow_(incident) {
  return [
    incident.firstSeen,
    incident.lastSeen,
    incident.intervalKey,
    incident.type,
    incident.base,
    incident.department,
    incident.user,
    incident.edocId,
    incident.debtId,
    incident.pageUrl,
    incident.context,
    incident.epguSentAt,
    incident.epguRequestType,
    incident.summaryText,
    incident.fullText,
    incident.signature,
    incident.repeatCount
  ];
}

function appendIncidentEventLogRow_(sheet, incident) {
  sheet.appendRow([
    incident.lastSeen,
    incident.intervalKey,
    incident.type,
    incident.base,
    incident.department,
    incident.user,
    incident.signature
  ]);
}

function upsertIncidentRow_(sheet, incident) {
  var lastRow = sheet.getLastRow();
  var targetRowNumber = 0;
  var existingRow = null;

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, INCIDENT_HEADERS.length).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var row = values[i];
      if (String(row[INCIDENT_IDX_INTERVAL_KEY] || "") !== incident.intervalKey) continue;
      if (String(row[INCIDENT_IDX_TYPE] || "") !== incident.type) continue;
      if (String(row[INCIDENT_IDX_SIGNATURE] || "") !== incident.signature) continue;
      targetRowNumber = i + 2;
      existingRow = row.slice();
      break;
    }
  }

  if (!targetRowNumber) {
    sheet.appendRow(buildIncidentRow_(incident));
    return;
  }

  var updatedRow = existingRow.slice();
  updatedRow[INCIDENT_IDX_LAST_SEEN] = incident.lastSeen;
  updatedRow[INCIDENT_IDX_BASE] = incident.base;
  updatedRow[INCIDENT_IDX_DEPARTMENT] = incident.department;
  updatedRow[INCIDENT_IDX_USER] = incident.user;
  updatedRow[INCIDENT_IDX_EDOCID] = incident.edocId;
  updatedRow[INCIDENT_IDX_DEBTID] = incident.debtId;
  updatedRow[INCIDENT_IDX_URL] = incident.pageUrl;
  updatedRow[INCIDENT_IDX_CONTEXT] = incident.context;
  updatedRow[INCIDENT_IDX_EPGU_SENT_AT] = incident.epguSentAt;
  updatedRow[INCIDENT_IDX_EPGU_REQUEST_TYPE] = incident.epguRequestType;
  updatedRow[INCIDENT_IDX_SUMMARY_TEXT] = incident.summaryText;
  updatedRow[INCIDENT_IDX_FULL_TEXT] = incident.fullText;
  updatedRow[INCIDENT_IDX_REPEAT_COUNT] = Math.max(1, Number(updatedRow[INCIDENT_IDX_REPEAT_COUNT] || 0)) + 1;

  sheet.getRange(targetRowNumber, 1, 1, INCIDENT_HEADERS.length).setValues([updatedRow]);
}

function handleIncidentRequest(p) {
  var eventDate = parseIncomingTimestamp(p.timestamp);
  var intervalInfo = getIncidentIntervalInfo_(eventDate);
  if (!intervalInfo.active) {
    return ContentService.createTextOutput("IGNORED_OUTSIDE_WORK_INTERVAL").setMimeType(ContentService.MimeType.TEXT);
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return ContentService.createTextOutput("Busy").setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var baseName = normalizeBaseName(p.baseName);
    var sheet = getOrCreateIncidentSheet_(ss, baseName);
    var eventLogSheet = getOrCreateIncidentEventLogSheet_(ss);
    var incident = buildIncidentPayload_(p, baseName, eventDate, intervalInfo);
    upsertIncidentRow_(sheet, incident);
    appendIncidentEventLogRow_(eventLogSheet, incident);
    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error("Incident API Error: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

function normalizeRows10000Value_(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeRows10000Number_(value) {
  var raw = normalizeRows10000Value_(value);
  if (!raw) return "";
  var num = parseInt(raw, 10);
  return isNaN(num) ? raw : num;
}

function initializeRows10000Sheet_(sheet) {
  sheet.getRange(1, 1, 1, ROWS10000_HEADERS.length).setValues([ROWS10000_HEADERS]);
  sheet.getRange(1, 1, 1, ROWS10000_HEADERS.length).setFontWeight("bold").setBackground("#d9e2f3");
  sheet.setFrozenRows(1);
}

function ensureRows10000SheetHeader_(sheet) {
  if (sheet.getLastRow() < 1) {
    initializeRows10000Sheet_(sheet);
    return;
  }
  var headerRange = sheet.getRange(1, 1, 1, ROWS10000_HEADERS.length);
  var current = headerRange.getValues()[0];
  var mismatch = false;
  for (var i = 0; i < ROWS10000_HEADERS.length; i++) {
    if (String(current[i] || "") !== ROWS10000_HEADERS[i]) {
      mismatch = true;
      break;
    }
  }
  if (mismatch) {
    headerRange.setValues([ROWS10000_HEADERS]).setFontWeight("bold").setBackground("#d9e2f3");
  }
  sheet.setFrozenRows(1);
}

function getOrCreateRows10000Sheet_(ss) {
  var sheet = ss.getSheetByName(ROWS10000_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ROWS10000_SHEET);
    initializeRows10000Sheet_(sheet);
    return sheet;
  }
  ensureRows10000SheetHeader_(sheet);
  return sheet;
}

function findRows10000RowByTraceId_(sheet, traceId) {
  var normalizedTraceId = normalizeRows10000Value_(traceId);
  if (!normalizedTraceId) return { rowNumber: 0, row: null };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rowNumber: 0, row: null };
  var values = sheet.getRange(2, 1, lastRow - 1, ROWS10000_HEADERS.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][1] || "") === normalizedTraceId) {
      return { rowNumber: i + 2, row: values[i].slice() };
    }
  }
  return { rowNumber: 0, row: null };
}

function buildRows10000Row_(payload, eventDate, traceFileUrl) {
  return [
    eventDate,
    normalizeRows10000Value_(payload.traceId),
    normalizeBaseName(payload.baseName),
    normalizeRows10000Value_(payload.departmentName) || "Не определен",
    normalizeRows10000Value_(payload.userName) || "Не определен",
    normalizeRows10000Value_(payload.stageName) || "ПК Пирамида",
    normalizeRows10000Value_(payload.pageUrl),
    normalizeRows10000Value_(payload.requestUrl),
    normalizeRows10000Value_(payload.requestMethod || "GET"),
    normalizeRows10000Number_(payload.rows),
    normalizeRows10000Value_(payload.buttonCounter),
    normalizeRows10000Number_(payload.selarrrowLen),
    normalizeRows10000Number_(payload.visibleCheckedCount),
    normalizeRows10000Value_(payload.triggerReason),
    normalizeRows10000Value_(payload.summaryText),
    normalizeRows10000Value_(traceFileUrl),
    "'" + normalizeRows10000Value_(payload.version)
  ];
}

function upsertRows10000Row_(sheet, payload, eventDate, traceFileUrl) {
  var match = findRows10000RowByTraceId_(sheet, payload.traceId);
  var rowValues = buildRows10000Row_(payload, eventDate, traceFileUrl);
  if (!match.rowNumber) {
    sheet.appendRow(rowValues);
    return {
      rowNumber: sheet.getLastRow(),
      row: rowValues,
      isNew: true
    };
  }
  sheet.getRange(match.rowNumber, 1, 1, ROWS10000_HEADERS.length).setValues([rowValues]);
  return {
    rowNumber: match.rowNumber,
    row: rowValues,
    isNew: false
  };
}

function getOrCreateRows10000TraceFolder_() {
  var folders = DriveApp.getFoldersByName(ROWS10000_TRACE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(ROWS10000_TRACE_FOLDER_NAME);
}

function buildRows10000TraceFileName_(payload, eventDate) {
  var ts = Utilities.formatDate(eventDate, INCIDENT_TIMEZONE, "yyyy-MM-dd_HH-mm-ss");
  var user = normalizeRows10000Value_(payload.userName).replace(/[\\\\/:*?\"<>|\\s]+/g, "_") || "unknown";
  var traceId = normalizeRows10000Value_(payload.traceId).replace(/[\\\\/:*?\"<>|\\s]+/g, "_") || "trace";
  return "rows10000_" + ts + "_" + user + "_" + traceId + ".json";
}

function buildRows10000TraceDocument_(payload, eventDate, traceFileUrl) {
  return {
    traceId: normalizeRows10000Value_(payload.traceId),
    eventType: ROWS10000_EVENT_TYPE,
    incidentType: normalizeRows10000Value_(payload.incidentType) || "ROWS10000",
    receivedAt: eventDate.toISOString(),
    baseName: normalizeBaseName(payload.baseName),
    departmentName: normalizeRows10000Value_(payload.departmentName),
    userName: normalizeRows10000Value_(payload.userName),
    stageName: normalizeRows10000Value_(payload.stageName),
    pageUrl: normalizeRows10000Value_(payload.pageUrl),
    requestUrl: normalizeRows10000Value_(payload.requestUrl),
    requestMethod: normalizeRows10000Value_(payload.requestMethod || "GET"),
    rows: normalizeRows10000Number_(payload.rows),
    buttonCounter: normalizeRows10000Value_(payload.buttonCounter),
    buttonCounterNumber: normalizeRows10000Number_(payload.buttonCounterNumber),
    selarrrowLen: normalizeRows10000Number_(payload.selarrrowLen),
    visibleCheckedCount: normalizeRows10000Number_(payload.visibleCheckedCount),
    triggerReason: normalizeRows10000Value_(payload.triggerReason),
    summaryText: normalizeRows10000Value_(payload.summaryText),
    version: normalizeRows10000Value_(payload.version),
    traceFileUrl: normalizeRows10000Value_(traceFileUrl),
    requestData: payload.requestData || {},
    stateSnapshot: payload.stateSnapshot || {},
    trace: Array.isArray(payload.trace) ? payload.trace : []
  };
}

function saveRows10000TraceFile_(payload, eventDate, existingTraceFileUrl) {
  if (existingTraceFileUrl) {
    return existingTraceFileUrl;
  }
  var folder = getOrCreateRows10000TraceFolder_();
  var filename = buildRows10000TraceFileName_(payload, eventDate);
  var doc = buildRows10000TraceDocument_(payload, eventDate, "");
  var blob = Utilities.newBlob(JSON.stringify(doc, null, 2), "application/json", filename);
  var file = folder.createFile(blob);
  return file.getUrl();
}

function wasRows10000AlertSent_(traceId, chatId) {
  var key = ROWS10000_ALERT_SENT_PREFIX + normalizeRows10000Value_(traceId) + "|" + normalizeRows10000Value_(chatId);
  return PropertiesService.getScriptProperties().getProperty(key) === "1";
}

function markRows10000AlertSent_(traceId, chatId) {
  var key = ROWS10000_ALERT_SENT_PREFIX + normalizeRows10000Value_(traceId) + "|" + normalizeRows10000Value_(chatId);
  PropertiesService.getScriptProperties().setProperty(key, "1");
}

function buildRows10000TelegramText_(payload, traceFileUrl, eventDate) {
  var whenText = Utilities.formatDate(eventDate, INCIDENT_TIMEZONE, "dd.MM.yyyy HH:mm:ss");
  var rowsText = normalizeRows10000Value_(payload.rows) || "10000";
  var counterText = normalizeRows10000Value_(payload.buttonCounter) || "\u2014";
  var selarrrowText = normalizeRows10000Value_(payload.selarrrowLen) || "\u2014";
  var checkedText = normalizeRows10000Value_(payload.visibleCheckedCount) || "\u2014";
  var reasonText = normalizeRows10000Value_(payload.triggerReason) || "\u2014";
  var summaryText = normalizeRows10000Value_(payload.summaryText) || "\u2014";

  return [
    "<b>StageTimer • ROWS10000</b>",
    "<b>\u0412\u0440\u0435\u043c\u044f:</b> " + escapeHtml(whenText),
    "<b>\u0411\u0430\u0437\u0430:</b> " + escapeHtml(normalizeBaseName(payload.baseName)),
    "<b>\u0414\u0435\u043f\u0430\u0440\u0442\u0430\u043c\u0435\u043d\u0442:</b> " + escapeHtml(normalizeRows10000Value_(payload.departmentName) || "Не определен"),
    "<b>\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c:</b> " + escapeHtml(normalizeRows10000Value_(payload.userName) || "Не определен"),
    "<b>TraceID:</b> <code>" + escapeHtml(normalizeRows10000Value_(payload.traceId)) + "</code>",
    "<b>Rows:</b> " + escapeHtml(rowsText),
    "<b>Counter / Selarrrow / Checked:</b> " + escapeHtml(counterText + " / " + selarrrowText + " / " + checkedText),
    "<b>\u041f\u0440\u0438\u0447\u0438\u043d\u0430:</b> " + escapeHtml(reasonText),
    "<b>\u041a\u0440\u0430\u0442\u043a\u043e:</b> " + escapeHtml(summaryText),
    "<b>URL:</b> " + escapeHtml(normalizeRows10000Value_(payload.requestUrl) || normalizeRows10000Value_(payload.pageUrl)),
    "<b>Trace:</b> " + escapeHtml(traceFileUrl || "\u2014")
  ].join("\n");
}

function sendRows10000Alerts_(payload, traceFileUrl, eventDate) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) return;
  var chatIds = getActiveIncidentChatIds_(settingsSheet);
  if (!chatIds.length) return;
  var text = buildRows10000TelegramText_(payload, traceFileUrl, eventDate);
  chatIds.forEach(function(chatId) {
    if (wasRows10000AlertSent_(payload.traceId, chatId)) return;
    var msgId = sendTelegram(chatId, text, false);
    if (msgId) {
      markRows10000AlertSent_(payload.traceId, chatId);
    }
  });
}

function handleRows10000IncidentRequest(p) {
  var eventDate = parseIncomingTimestamp(p.timestamp);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return ContentService.createTextOutput("Busy").setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getOrCreateRows10000Sheet_(ss);
    var match = findRows10000RowByTraceId_(sheet, p.traceId);
    var existingTraceFileUrl = match.row ? normalizeRows10000Value_(match.row[15]) : "";
    var traceFileUrl = saveRows10000TraceFile_(p, eventDate, existingTraceFileUrl);
    upsertRows10000Row_(sheet, p, eventDate, traceFileUrl);
    sendRows10000Alerts_(p, traceFileUrl, eventDate);
    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error("Rows10000 API Error: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

function getIncidentRowModel_(row, sheetName) {
  var model = {
    firstSeen: parseIncomingTimestamp(row[INCIDENT_IDX_FIRST_SEEN]),
    lastSeen: parseIncomingTimestamp(row[INCIDENT_IDX_LAST_SEEN]),
    intervalKey: String(row[INCIDENT_IDX_INTERVAL_KEY] || ""),
    type: normalizeIncidentType_(row[INCIDENT_IDX_TYPE]),
    base: normalizeIncidentValue_(row[INCIDENT_IDX_BASE] || sheetName.replace(INCIDENT_SHEET_PREFIX, "")),
    department: normalizeIncidentValue_(row[INCIDENT_IDX_DEPARTMENT]) || "Не определен",
    user: normalizeIncidentValue_(row[INCIDENT_IDX_USER]) || "Не определен",
    edocId: normalizeIncidentValue_(row[INCIDENT_IDX_EDOCID]),
    debtId: normalizeIncidentValue_(row[INCIDENT_IDX_DEBTID]),
    pageUrl: normalizeIncidentValue_(row[INCIDENT_IDX_URL]),
    context: normalizeIncidentValue_(row[INCIDENT_IDX_CONTEXT]),
    epguSentAt: normalizeIncidentValue_(row[INCIDENT_IDX_EPGU_SENT_AT]),
    epguRequestType: normalizeIncidentValue_(row[INCIDENT_IDX_EPGU_REQUEST_TYPE]),
    summaryText: normalizeIncidentValue_(row[INCIDENT_IDX_SUMMARY_TEXT]),
    fullText: normalizeIncidentValue_(row[INCIDENT_IDX_FULL_TEXT]),
    signature: normalizeIncidentValue_(row[INCIDENT_IDX_SIGNATURE]),
    repeatCount: Math.max(1, Number(row[INCIDENT_IDX_REPEAT_COUNT] || 1))
  };
  var errorInfo = buildIncidentErrorInfo_(model.type, model.fullText, model.summaryText);
  model.errorKey = errorInfo.key;
  model.errorTitle = errorInfo.title;
  return model;
}

function getActiveIncidentChatIds_(sheet) {
  var values = sheet.getRange(INCIDENT_CHAT_CONFIG_RANGE).getValues();
  var unique = {};
  var result = [];
  values.forEach(function(row) {
    var chatId = normalizeIncidentValue_(row[2]);
    if (!chatId || row[3] !== true || unique[chatId]) return;
    unique[chatId] = true;
    result.push(chatId);
  });
  return result;
}

function getIncidentSummaryMessageKey_(chatId) {
  return INCIDENT_SUMMARY_MESSAGE_KEY_PREFIX + String(chatId || "");
}

function getIncidentRowsForInterval_(ss, intervalKey) {
  var rows = [];
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (!isIncidentSheetName_(name)) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var values = sheet.getRange(2, 1, lastRow - 1, INCIDENT_HEADERS.length).getValues();
    values.forEach(function(row) {
      if (String(row[INCIDENT_IDX_INTERVAL_KEY] || "") !== intervalKey) return;
      rows.push(getIncidentRowModel_(row, name));
    });
  });
  return rows;
}

function getIncidentEventStatsForInterval_(ss, intervalKey, now) {
  var stats = {
    GRID: { total: 0, recent: 0 },
    ERROR_EXCEPTION: { total: 0, recent: 0 },
    EPGU: { total: 0, recent: 0 }
  };
  var sheet = ss.getSheetByName(INCIDENT_EVENT_LOG_SHEET);
  if (!sheet) return stats;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return stats;

  var cutoff = now.getTime() - INCIDENT_DYNAMIC_WINDOW_MINUTES * 60 * 1000;
  var values = sheet.getRange(2, 1, lastRow - 1, INCIDENT_EVENT_HEADERS.length).getValues();
  values.forEach(function(row) {
    if (String(row[INCIDENT_EVENT_IDX_INTERVAL_KEY] || "") !== intervalKey) return;
    var type = normalizeIncidentType_(row[INCIDENT_EVENT_IDX_TYPE]);
    if (!stats[type]) {
      stats[type] = { total: 0, recent: 0 };
    }

    stats[type].total += 1;

    var eventAt = parseIncomingTimestamp(row[INCIDENT_EVENT_IDX_AT]);
    if (eventAt instanceof Date && !isNaN(eventAt.getTime()) && eventAt.getTime() >= cutoff) {
      stats[type].recent += 1;
    }
  });

  return stats;
}

function formatIncidentBaseExampleLine_(baseName, row, type) {
  var safeBase = tgEscape_(baseName);
  var safeUser = tgEscape_(row.user || "Не определен");
  var safeDepartment = tgEscape_(row.department || "Не определен");
  if (type === "EPGU") {
    var edocText = row.edocId ? ("EDocID " + row.edocId) : (row.summaryText || row.fullText || "Ошибка");
    return safeBase + ": " + safeUser + " • " + safeDepartment + " • " + tgEscape_(edocText);
  }

  return safeBase + ": " + safeUser + " • " + safeDepartment;
}

function buildIncidentSummarySection_(label, type, rows, statsByType) {
  var typeRows = rows.filter(function(row) {
    return row.type === type;
  });
  var typeStats = statsByType && statsByType[type]
    ? statsByType[type]
    : { total: 0, recent: 0 };
  var totalCount = Math.max(0, Number(typeStats.total) || 0);
  var recentCount = Math.max(0, Number(typeStats.recent) || 0);
  var trend = recentCount > 0
    ? "🟢⬆ +" + recentCount + "/30м"
    : "🔴⬇ 0/30м";

  var lines = [label + ": " + totalCount + "  " + trend];
  if (typeRows.length === 0) {
    lines.push("—");
    return lines.join("\n");
  }

  var groupsByError = {};
  typeRows.forEach(function(row) {
    var errorKey = row.errorKey || (type + "|ошибка");
    if (!groupsByError[errorKey]) {
      groupsByError[errorKey] = {
        title: row.errorTitle || "Ошибка",
        rows: []
      };
    }
    groupsByError[errorKey].rows.push(row);
  });

  Object.keys(groupsByError)
    .map(function(errorKey) {
      var group = groupsByError[errorKey];
      var latestTs = 0;
      group.rows.forEach(function(row) {
        var rowTs = row.lastSeen instanceof Date ? row.lastSeen.getTime() : 0;
        if (rowTs >= latestTs) latestTs = rowTs;
      });
      return {
        key: errorKey,
        title: group.title,
        rows: group.rows,
        latestTs: latestTs
      };
    })
    .sort(function(a, b) {
      return b.latestTs - a.latestTs || String(a.title).localeCompare(String(b.title), "ru");
    })
    .forEach(function(group) {
      lines.push("• " + tgEscape_(group.title));

      var latestByBase = {};
      group.rows.forEach(function(row) {
        var baseKey = row.base || "Неизвестная";
        if (!latestByBase[baseKey]) {
          latestByBase[baseKey] = row;
          return;
        }
        var previousTime = latestByBase[baseKey].lastSeen instanceof Date ? latestByBase[baseKey].lastSeen.getTime() : 0;
        var currentTime = row.lastSeen instanceof Date ? row.lastSeen.getTime() : 0;
        if (currentTime >= previousTime) {
          latestByBase[baseKey] = row;
        }
      });

      Object.keys(latestByBase)
        .sort(function(a, b) { return String(a).localeCompare(String(b), "ru"); })
        .forEach(function(baseName) {
          lines.push("  " + formatIncidentBaseExampleLine_(baseName, latestByBase[baseName], type));
        });
    });

  return lines.join("\n");
}

function buildIncidentSummaryText_(rows, intervalInfo, statsByType) {
  var lines = [
    "<b>StageTimer • Инциденты</b>",
    "Интервал: " + tgEscape_(intervalInfo.label) + " YEKT",
    "",
    buildIncidentSummarySection_("Grid", "GRID", rows, statsByType),
    "",
    buildIncidentSummarySection_("ERROR EXCEPTION", "ERROR_EXCEPTION", rows, statsByType),
    "",
    buildIncidentSummarySection_("ЕПГУ", "EPGU", rows, statsByType)
  ];
  return lines.join("\n");
}

function upsertIncidentSummaryMessage_(chatId, text) {
  var props = PropertiesService.getScriptProperties();
  var key = getIncidentSummaryMessageKey_(chatId);
  var messageId = props.getProperty(key);
  var finalMessageId = messageId;

  if (messageId) {
    var editResult = editTelegramMessage(chatId, messageId, text);
    if (editResult === "NOT_FOUND") {
      finalMessageId = sendTelegram(chatId, text, true);
    } else if (editResult !== "SUCCESS") {
      finalMessageId = messageId;
    }
  } else {
    finalMessageId = sendTelegram(chatId, text, true);
  }

  if (finalMessageId) {
    props.setProperty(key, String(finalMessageId));
  }
}

function updateIncidentTelegramSummaries_(ss, settingsSheet) {
  var now = new Date();
  var intervalInfo = getIncidentIntervalInfo_(now);
  if (!intervalInfo.active) return;

  var chatIds = getActiveIncidentChatIds_(settingsSheet);
  if (chatIds.length === 0) return;

  var intervalKey = buildIncidentIntervalKey_(intervalInfo);
  var rows = getIncidentRowsForInterval_(ss, intervalKey);
  var eventStats = getIncidentEventStatsForInterval_(ss, intervalKey, now);
  var text = buildIncidentSummaryText_(rows, intervalInfo, eventStats);

  chatIds.forEach(function(chatId) {
    upsertIncidentSummaryMessage_(chatId, text);
  });
}

function clearIncidentSummaryMessageCache_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  for (var key in all) {
    if (key.indexOf(INCIDENT_SUMMARY_MESSAGE_KEY_PREFIX) === 0) {
      props.deleteProperty(key);
    }
  }
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
  updateIncidentTelegramSummaries_(ss, settingsSheet);

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
    if (name === SHEET_SETTINGS || name.startsWith("Архив_") || isIncidentSystemSheetName_(name)) return;

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
    if (name === SHEET_SETTINGS || name.startsWith("Архив_") || isIncidentSystemSheetName_(name)) return;

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
function setupAlertStageExclusions_(sheet) {
  sheet.getRange("G3").setValue("Исключить стадии (через |)")
    .setBackground("#cfe2f3").setFontWeight("bold");
  sheet.getRange("G4:G6").setNumberFormat("@").setNote(
    "Не включать в алерт по лимиту времени стадии, содержащие любой из фрагментов через |. " +
    "Регистр не учитывается. Пример: Реестры передачи в ОВЗИД | Другая стадия. " +
    "Пустое поле — без исключений. Статистика не изменяется."
  );
}

function parseAlertStageExclusions_(raw) {
  return String(raw || "").split("|").map(function(part) {
    return part.trim().toLowerCase();
  }).filter(function(part) { return part.length > 0; });
}

function isAlertStageExcluded_(stageName, exclusions) {
  var normalized = String(stageName || "").toLowerCase();
  return exclusions.some(function(part) { return normalized.indexOf(part) !== -1; });
}

function checkAlerts(sheet, stats, timeZone) {
  setupAlertStageExclusions_(sheet);
  var configsRange = sheet.getRange("A4:G6");
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
    var stageExclusions = parseAlertStageExclusions_(row[6]);

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
          if (isAlertStageExcluded_(stageName, stageExclusions)) continue;
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
    if (name === SHEET_SETTINGS || name.startsWith("Архив_") || isIncidentSystemSheetName_(name)) return;

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
        if (name === SHEET_SETTINGS || name.startsWith("Архив_") || isIncidentSystemSheetName_(name)) return;
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
  clearIncidentSummaryMessageCache_();
  
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
  setupAlertStageExclusions_(sheet);
  
  sheet.getRange("A4:D4").setValues([["*", 15, "ВСТАВЬТЕ_ID", true]]);
  sheet.getRange("D4").insertCheckboxes();
  
  // Создаем пустые заголовки для дашбордов при сетапе
  updateGlobalUserTable(sheet, {});
  updateMainDashboard(sheet, {}, "Ожидание");
  updateUserDashboard(sheet, {}, "Ожидание");
  updateDayAnalysisDashboard(sheet, {}, "Ожидание");

  console.log("Setup выполнен: Настройки и пустые дашборды созданы.");
}
