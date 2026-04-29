# Подписание и автообновление Firefox-версии

## Коротко про отличие от Chrome

В Chrome у тебя сейчас работает unpacked-режим: браузер смотрит прямо в папку расширения. Обновил файлы в этой папке - расширение после перезагрузки/обновления в `chrome://extensions` видит новые файлы.

В Firefox постоянное signed/unlisted-расширение ставится из `.xpi` внутрь профиля браузера. Простая замена файла в сетевой папке установленное расширение не меняет. Для автоматического обновления Firefox должен видеть `update_url` в подписанном `manifest.json`, скачать по нему `updates.json`, найти там новую версию и загрузить новый подписанный `.xpi` по HTTPS.

## Что требуется

- Аккаунт Mozilla Add-ons.
- `JWT issuer`.
- `JWT secret`.
- Установленный `web-ext`.
- HTTPS-сервер для автообновлений.

Ключи Mozilla не сохраняются в проект. Скрипт спрашивает их при запуске видимым вводом и передает в `web-ext` через переменные окружения текущего процесса.

## Обычная команда деплоя

```powershell
python deploy-firefox.py
```

Скрипт:

1. спросит `JWT issuer` и `JWT secret` видимым вводом;
2. увеличит версию в `manifest.json` и `version.json`;
3. соберет Firefox-версию во временную папку;
4. добавит в Firefox-манифест `update_url`;
5. проверит сборку через `web-ext lint --self-hosted`;
6. отправит сборку на Mozilla unlisted-подписание;
7. создаст `updates.json` для автообновления;
8. скопирует `.xpi`, `updates.json`, `version.json`, `INSTALL_FIREFOX.txt` и `index.html` в сетевую папку;
9. загрузит эти же файлы на HTTPS-сервер через `ssh/scp`.

Сетевая папка:

```text
\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Repository\duplicate-marker-extension-firefox
```

HTTPS-адрес автообновлений по умолчанию:

```text
https://188.253.23.149.sslip.io/duplicate-marker-extension-firefox
```

Файл, который Firefox будет проверять:

```text
https://188.253.23.149.sslip.io/duplicate-marker-extension-firefox/updates.json
```

## Первая установка у пользователя

Если у пользователя уже стоит старая Firefox-версия без `update_url`, она сама обновляться не сможет. Один раз надо вручную поставить новую подписанную версию, собранную после добавления автообновлений.

1. Открыть Firefox.
2. Открыть `about:addons`.
3. Нажать шестеренку.
4. Выбрать `Install Add-on From File...`.
5. Выбрать подписанный `.xpi` из сетевой папки или скачать его с HTTPS-страницы.

После этой установки следующие версии должны подтягиваться через Firefox auto-update, если версия в новом `.xpi` выше установленной и сервер доступен по HTTPS.

## Если надо временно не грузить на сервер

```powershell
python deploy-firefox.py --no-server-deploy
```

Такой запуск соберет и подпишет `.xpi`, положит файлы в сетевую папку, но не обновит HTTPS-сервер. Для обычной работы этот режим не нужен.

## Одноразовая настройка HTTPS-сервера

Для текущего VPS уже настроено:

- домен автообновлений: `188.253.23.149.sslip.io`;
- HTTPS через Let's Encrypt;
- nginx location `/duplicate-marker-extension-firefox/`;
- HAProxy SNI-маршрут на локальный nginx backend;
- папка деплоя: `/var/www/duplicate-marker-extension-firefox`;
- пользователь `jassco` может писать в папку деплоя по SSH-ключу.

Сервер должен отдавать папку:

```text
/var/www/duplicate-marker-extension-firefox
```

Пример nginx-конфига для `/etc/nginx/sites-available/firefox-updates`:

```nginx
server {
    listen 80;
    server_name 188.253.23.149.sslip.io;

    location = /duplicate-marker-extension-firefox {
        return 301 /duplicate-marker-extension-firefox/;
    }

    location ^~ /duplicate-marker-extension-firefox/ {
        alias /var/www/duplicate-marker-extension-firefox/;
        try_files $uri $uri/ =404;
        add_header Cache-Control "no-store" always;
        types {
            application/json json;
            application/x-xpinstall xpi;
            text/html html;
            text/plain txt;
        }
    }
}
```

После настройки веб-сервера пользователь `jassco` должен иметь право писать в эту папку:

```bash
sudo mkdir -p /var/www/duplicate-marker-extension-firefox
sudo chown -R jassco:jassco /var/www/duplicate-marker-extension-firefox
```

## Если Mozilla не вернула `.xpi` сразу

Unlisted-подписание обычно проходит автоматически, но Mozilla может отправить версию на проверку. В этом случае скрипт завершится ошибкой ожидания, а готовый файл надо будет скачать из кабинета разработчика Mozilla Add-ons после проверки.

## Если ключи вставлены неправильно

Локальной валидации ключей в скрипте нет. Проверка того, что ключи реально действуют, происходит на стороне Mozilla во время `web-ext sign`. Если ключи неверные, пустые или отозваны, `web-ext sign` завершится ошибкой авторизации, и версия не будет подписана.

## Полезные ссылки Mozilla

- `update_url` в Firefox-манифесте: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
- Обновление self-hosted расширений: https://extensionworkshop.com/documentation/manage/updating-your-extension/
- Самостоятельное распространение signed/unlisted расширений: https://extensionworkshop.com/documentation/publish/self-distribution/
