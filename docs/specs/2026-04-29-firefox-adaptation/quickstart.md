# Быстрый старт Firefox-версии

## Где лежит Firefox-версия

После сборки Firefox-версия лежит здесь:

```powershell
C:\chassehiboux\duplicate-marker-extension\dist\firefox
```

Это не исходная папка разработки, а готовая папка для установки в Firefox.

## Локальная сборка

```powershell
python deploy.py --firefox --no-copy
```

Эта команда не трогает сетевую папку и не увеличивает версию. Она просто пересоздает локальную папку:

```text
C:\chassehiboux\duplicate-marker-extension\dist\firefox
```

## Проверка через Mozilla web-ext

```powershell
web-ext lint --source-dir dist/firefox
```

## Временная установка в Firefox

1. Открыть Firefox.
2. В адресной строке открыть:

```text
about:debugging
```

3. Выбрать `This Firefox`.
4. Нажать `Load Temporary Add-on`.
5. Выбрать файл:

```text
C:\chassehiboux\duplicate-marker-extension\dist\firefox\manifest.json
```

Временная установка пропадет после перезапуска Firefox.

## Сетевой деплой Firefox-версии

```powershell
python deploy.py --firefox
```

Эта команда увеличивает версию, пересобирает Firefox-папку и копирует ее сюда:

```text
\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Repository\duplicate-marker-extension-firefox
```

Отдельная папка нужна, чтобы не смешивать Firefox manifest и Chrome manifest.

## Обособленный StageTimer

Если нужна не полная версия расширения, а отдельный StageTimer для Firefox:

```powershell
python deploy_VZID.py --firefox
```

Для проверки без копирования в сетевые папки:

```powershell
python deploy_VZID.py --firefox --no-copy
```

Локальная проверочная папка StageTimer будет здесь:

```text
C:\chassehiboux\duplicate-marker-extension\dist\stagetimer-firefox
```

## Если команда попросит Pillow

Для Firefox автоматически создаются квадратные иконки. Если на другом компьютере Python скажет, что нет `PIL` или `Pillow`, выполнить:

```powershell
pip install Pillow
```

На текущем компьютере Pillow уже есть, сборка прошла.

## Важное ограничение

Автозаполнение Google ITIL в Firefox отключено в сборке, потому что Firefox не поддерживает `chrome.debugger`. Остальное расширение собирается и проходит `web-ext lint` без ошибок.
