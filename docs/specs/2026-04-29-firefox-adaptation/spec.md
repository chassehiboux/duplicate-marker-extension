# Спецификация: адаптация расширения для Firefox

## Цель

Подготовить отдельную Firefox-версию расширения без разрыва с текущей Chrome/Яндекс-версией.

## Результат

- Исходники остаются в корне проекта.
- Firefox-сборка создается в `dist/firefox/`.
- Сетевой деплой Firefox-версии выполняется отдельно от Chrome-версии.
- Обычный запуск `python deploy.py` сохраняет прежнее поведение Chrome-деплоя.
- Запуск `python deploy.py --firefox` собирает Firefox-версию и копирует ее в отдельную сетевую папку.

## Решение по папкам

- Локальная Firefox-сборка: `dist/firefox/`.
- Сетевая Firefox-папка по умолчанию: рядом с текущей Chrome-папкой, имя `duplicate-marker-extension-firefox`.
- Полный сетевой путь по умолчанию:

```text
\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Repository\duplicate-marker-extension-firefox
```

## Совместимость Firefox

Нужен отдельный manifest для Firefox:

- `background.service_worker` заменить на `background.scripts`;
- `side_panel` заменить на `sidebar_action`;
- Chrome-only разрешение `sidePanel` не включать в Firefox manifest;
- добавить `browser_specific_settings.gecko.id`;
- сохранить подключение StageTimer и остальных content scripts;
- проверить поддержку `declarative_net_request`, `webRequest`, `scripting`, `storage`, `tabs`, `alarms`, `notifications`, `clipboardRead`, `clipboardWrite`.

## Ограничение Firefox

Firefox не реализует Chrome Debugger API (`chrome.debugger`). Поэтому Firefox-сборка не включает разрешение `debugger`, а модуль Google ITIL возвращает понятное сообщение, что автозаполнение Google ITIL в Firefox отключено. Остальные части расширения собираются и проходят проверку `web-ext lint` без ошибок.

## StageTimer

Проект содержит отдельную StageTimer-сборку. Изменения совместимости должны учитывать:

- основное расширение через корневой `background.js`;
- обособленную StageTimer-сборку через `deploy_VZID.py`;
- общие файлы `StageTimer/timer_content.js`, `StageTimer/timer_styles.css`, `StageTimer/timer_background.js`.

## Установка пользователем

Для теста аккаунт Mozilla не нужен. Достаточно Firefox и временной установки через `about:debugging`.

Для постоянной установки в обычный Firefox нужен подписанный `.xpi`. Для этого нужен аккаунт Mozilla Add-ons и unlisted-подписание, если расширение не должно публиковаться в магазине.
