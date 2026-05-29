# Rows10000 Trace Tasks

- [ ] Добавить contract payload для `rows10000_incident`.
- [ ] Реализовать локальный trace ring buffer на страницах `/ovzid/status/*`.
- [ ] Добавить main-world interception jqGrid-методов и XHR к `/data`.
- [ ] Логировать ключевые пользовательские действия по гриду и toolbar.
- [ ] Детектировать запрос `rows=10000` с пустым `EDocID in` и смежные противоречивые состояния.
- [ ] Замораживать trace и отправлять один payload на один инцидент.
- [ ] Дублировать новый обработчик в `background.js` и `StageTimer/timer_background.js`.
- [ ] Реализовать в GAS summary-лист, Drive trace file и Telegram alert.
- [ ] Проверить синтаксис изменённых JS/Python и точечную UTF-8/mojibake-проверку только по затронутым файлам с русским текстом.
