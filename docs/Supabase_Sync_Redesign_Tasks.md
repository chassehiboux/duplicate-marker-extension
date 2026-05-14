# Задачи переработки Supabase-синхронизации

## 1. Подготовка

- [x] Создать отдельную ветку `supabase-sync-redesign`.
- [x] Зафиксировать план реализации в Markdown.
- [ ] Проверить доступность Supabase MCP. Текущая сессия после `codex mcp login supabase` все еще получает `OAuth token refresh failed` при handshake.
- [ ] Через Supabase MCP посмотреть текущие таблицы, функции, RLS и realtime publication.

## 2. База данных

- [x] Создать миграцию новой схемы.
- [x] Добавить таблицы устройств, sync-state, key-value, счетчиков, обработанных правок, обработанных edocid, action rules и mutation log.
- [x] Добавить RLS по `auth.uid()`.
- [x] Добавить grants для authenticated.
- [x] Добавить RPC `extension_register_device`.
- [x] Добавить RPC `extension_get_state`.
- [x] Добавить RPC `extension_apply_mutation`.
- [x] Добавить новые таблицы или revision-события в realtime publication.
- [ ] Применить миграции через Supabase MCP.
- [ ] Проверить, что миграции реально применились.

## 3. Sync layer

- [x] Заменить `dup_supabase_sync_meta_v1` на `dup_supabase_sync_meta_v2`.
- [x] Добавить `dup_supabase_device_id_v1`.
- [x] Добавить `dup_supabase_outbox_v1`.
- [x] Добавить `dup_supabase_cache_revision_v1`.
- [x] Добавить `dup_supabase_pre_login_backup_v2`.
- [x] Реализовать request wrapper с timeout, retry и single 401 refresh.
- [x] Реализовать register device.
- [x] Реализовать pull canonical state.
- [x] Реализовать apply canonical state to local cache.
- [x] Реализовать durable outbox и последовательный flush.
- [x] Реализовать revision mismatch handling.
- [x] Отключить active-write full snapshot upsert.

## 4. Замена прямых sync-записей

- [x] `popup.js`: настройки, счетчики, action tags, импорт.
- [x] `background.js`: approved/blocked rules, counters, processed edits, processed edocids.
- [x] `content.js`: F2 UI settings, FSSP grouping, departments, execution analysis, id card check.
- [x] `ColumnManager/column_manager.js`: `jqgrid_settings_*`.
- [x] `VZIDCapture/vzid_create_send.js`: claim type keys.
- [x] `PyramidNewYear/*`: seasonal theme keys.
- [x] `support/*`: reminders state.
- [x] `GoogleSheets/problem_picker_content.js`: bridge URL.

## 5. UI

- [x] Расширить public status background-слоя.
- [x] Переделать `SupabaseSync/supabase_auth_ui.js` на раздельные статусы auth/realtime/pull/push/revision/outbox/error.
- [ ] Обновить popup styles при необходимости.
- [x] Изменить кнопку "Синхронизировать сейчас" на flush+pull.
- [x] Изменить импорт JSON на batch mutation после входа.

## 6. Проверки

- [ ] `git diff --check` перед staging.
- [ ] Точечные JS syntax checks для измененных JS/GS-файлов.
- [ ] Точечная UTF-8/mojibake-проверка staged-файлов с русским текстом.
- [ ] `git diff --cached --check`.
- [ ] Проверка staged-состава.
- [ ] Коммит на русском языке.
