# StageTimer Error Incidents Plan

1. Добавить в StageTimer content-логику распознавания GRID и EPGU инцидентов.
2. Исключить ложные срабатывания после ручного `abort`.
3. Прокинуть новый тип payload через `background.js` и `StageTimer/timer_background.js` в существующий GAS endpoint.
4. Доработать `StageTimer/Code.gs` для записи инцидентов в листы ошибок и в служебный лог счётчиков.
5. Доработать минутный цикл `monitorPerformance()` для пересборки Telegram-сводки по инцидентам.
6. Сохранить функциональное равенство между основной и standalone StageTimer сборкой.
