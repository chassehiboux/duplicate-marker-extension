# Rows10000 Trace Plan

1. Зафиксировать отдельный контракт `ROWS10000`-инцидента и формат trace.
2. Добавить в StageTimer content-логику локального ring buffer на страницах `/ovzid/status/*`.
3. Добавить main-world instrumentation для jqGrid/XHR:
   - `resetSelection`;
   - `setGridParam`;
   - `reloadGrid`;
   - `.showSelectedRow`;
   - запросы `/data`.
4. Научить content-часть распознавать инцидент `rows=10000` и замораживать trace.
5. Прокинуть новый payload через `background.js` и `StageTimer/timer_background.js`.
6. Доработать `StageTimer/Code.gs`:
   - отдельный лист summary;
   - сохранение trace в Drive;
   - отдельный Telegram alert.
7. Сохранить функциональное равенство между основной и standalone StageTimer сборкой.
