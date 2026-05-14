# ТЗ для Codex: полная переработка Supabase-синхронизации расширения `duplicate-marker-extension`

## 0. Важное уточнение: частичная реализация запрещена

Это ТЗ нужно выполнять как **полный переход на новую схему синхронизации**, а не как частичную доработку текущего snapshot-механизма.

Недопустимый результат:

```text
1. Часть данных синхронизируется по новой схеме, а часть продолжает перезаписываться старым полным JSON snapshot.
2. В коде одновременно остаются два активных механизма записи в Supabase:
   - старый upsert полного extension_user_state.state;
   - новый mutation/revision/outbox-механизм.
3. UI показывает новый статус, но фактическая запись данных продолжает идти напрямую через chrome.storage.local -> полный snapshot.
4. Realtime подключен, но изменения между браузерами все еще зависят от ручной кнопки "Синхронизировать сейчас".
5. Старые функции остаются активными и могут перезаписать новые данные.
```

Обязательное правило:

```text
Если новая схема не внедрена полностью по всем sync-ключам, которые сейчас синхронизируются через Supabase, задачу нельзя считать выполненной.
```

Старую таблицу `extension_user_state` можно оставить только как:

```text
1. legacy-источник для первичной миграции старых данных;
2. read-only fallback на этапе переноса;
3. диагностический источник.
```

Но старый механизм записи:

```text
collectLocalSyncSnapshot() -> upsertRemoteState(snapshot) -> extension_user_state.state
```

должен быть отключен как активный путь синхронизации после внедрения новой схемы.

Если Codex по техническим причинам не может завершить полный переход, он должен:

```text
1. не делать частичный "франкенштейн";
2. остановиться;
3. явно перечислить блокеры;
4. не оставлять старый и новый механизмы одновременно активными для записи пользовательских данных.
```

---

## 1. Репозиторий и ветка

Работать в репозитории:

```text
chassehiboux/duplicate-marker-extension
```

Рабочая ветка:

```text
firefox-adaptation
```

Перед началом работ изучить текущие файлы:

```text
SupabaseSync/supabase_sync.js
SupabaseSync/supabase_auth_ui.js
background.js
popup.js
manifest.json
supabase/migrations/*
```

Также найти все места, где используются:

```text
chrome.storage.local.get
chrome.storage.local.set
chrome.storage.local.remove
chrome.storage.onChanged
DUP_SUPABASE_*
supabase
stats_history
processed_edits
editing_stats
approved_actions
blocked_actions
action_tags
```

---

## 2. Главная цель

Переделать синхронизацию так, чтобы после входа пользователя в Supabase-аккаунт **единым источником истины была база Supabase**, а не локальное хранилище конкретного браузера.

`chrome.storage.local` после авторизации должен использоваться только как:

```text
1. локальный кэш последнего подтвержденного сервером состояния;
2. очередь неотправленных локальных изменений;
3. техническое хранилище auth-сессии, sync-meta, device_id и временных UI-флагов.
```

Недопустимо, чтобы один браузер мог перезаписать данные другого браузера полным локальным snapshot, если его локальное состояние устарело.

---

## 3. Что сейчас надо считать неправильным

Текущую модель:

```text
local chrome.storage.local -> собрать полный snapshot -> записать весь snapshot в extension_user_state.state jsonb
```

считать устаревшей и подлежащей замене.

Проблемы текущей модели:

```text
1. Supabase хранит один большой JSON state на пользователя.
2. Любой браузер может отправить полный локальный снимок и затереть более свежие данные.
3. Нет server revision / optimistic concurrency.
4. Нет надежной durable outbox-очереди изменений.
5. Realtime используется только как сигнал "что-то изменилось", но не гарантирует успешный REST pull/push.
6. UI может показывать "Realtime: подключен", хотя фактическая синхронизация через REST упала или зависла.
```

---

## 4. Обязательное требование по Supabase MCP

Codex обязан самостоятельно провести работу с БД через Supabase MCP.

Нужно:

```text
1. Через Supabase MCP проверить текущее состояние проекта Supabase.
2. Посмотреть существующие таблицы, функции, RLS-политики, publication для realtime.
3. Создать новые миграции в supabase/migrations.
4. Применить миграции через Supabase MCP.
5. Проверить, что миграции реально применились.
6. Проверить RLS-политики.
7. Проверить, что realtime publication содержит новые таблицы/таблицу событий.
8. Не просить пользователя вручную выполнять SQL в Supabase.
```

Все изменения схемы БД должны быть оформлены миграциями в репозитории.

Нельзя удалять старую таблицу `extension_user_state` на первом этапе. Ее нужно оставить как legacy/fallback-источник для миграции данных, чтобы не потерять уже сохраненные состояния.

---

## 5. Целевая архитектура

Нужно реализовать модель:

```text
Supabase = источник истины.
Локальный browser storage = кэш + outbox.
Realtime = уведомление о новой server revision.
REST/RPC = фактическая загрузка и применение изменений.
```

После авторизации расширение не должно считать локальные sync-ключи истинными. Оно должно:

```text
1. получить canonical state из Supabase;
2. применить его в локальный кэш;
3. подписаться на realtime;
4. все дальнейшие изменения отправлять в Supabase как mutations;
5. применять обратно только состояние, подтвержденное сервером.
```

---

## 6. Запрет активного смешивания старого и нового механизмов

После внедрения новой схемы запрещено оставлять активным любой код, который может записать в Supabase полный локальный snapshot.

Нужно сделать одно из двух:

```text
1. полностью удалить старые функции записи полного snapshot;
2. либо оставить их только как legacy/helper-код для одноразовой миграции, но без вызова из пользовательских сценариев.
```

Обязательно проверить и убрать/переписать такие сценарии:

```text
1. вход в аккаунт;
2. регистрация;
3. ручная кнопка "Синхронизировать сейчас";
4. импорт JSON;
5. chrome.storage.onChanged;
6. fallback alarm;
7. realtime pull;
8. обновление настроек;
9. изменение счетчиков;
10. изменение approved/blocked actions;
11. изменение action_tags;
12. изменение processed_edits.
```

Ни один из этих сценариев не должен вызывать старый full snapshot upsert.

---

## 7. Новая модель БД

Нужно уйти от одного большого `state jsonb`.

Минимально допустимая целевая схема:

### 7.1. Таблица устройств

```sql
public.extension_devices
```

Назначение: хранить устройства/браузеры пользователя.

Поля:

```text
user_id uuid not null references auth.users(id) on delete cascade
device_id text not null
device_name text
browser text
created_at timestamptz not null default now()
last_seen_at timestamptz not null default now()
```

PK:

```text
(user_id, device_id)
```

RLS:

```text
auth.uid() = user_id
```

### 7.2. Таблица глобальной sync-ревизии пользователя

```sql
public.extension_sync_state
```

Поля:

```text
user_id uuid primary key references auth.users(id) on delete cascade
schema_version integer not null default 2
revision bigint not null default 0
updated_at timestamptz not null default now()
updated_by_device_id text
```

Назначение: монотонная серверная ревизия состояния пользователя.

Важно:

```text
revision увеличивается только на сервере;
клиент не имеет права сам назначать revision;
клиент передает expected_revision/base_revision.
```

### 7.3. Таблица key-value состояния

```sql
public.extension_user_kv
```

Поля:

```text
user_id uuid not null references auth.users(id) on delete cascade
key text not null
value jsonb not null
revision bigint not null
updated_at timestamptz not null default now()
updated_by_device_id text
deleted_at timestamptz
```

PK:

```text
(user_id, key)
```

Назначение: хранить простые настройки и объекты не одним большим JSON, а по ключам.

В эту таблицу можно перенести:

```text
setting_copy_mode
setting_highlight_mode
setting_notify_execution
setting_notify_editing
setting_department_containers
list_DebtID
list_AccAddress_AccountNumber
list_Individual_FullName
list_CaseNumber
list_EDNumber
strict_CaseNumber
strict_EDNumber
dup_show_hidden_departments
dup_fsspreestr_group_duplicates
pyramid_christmas_v10_enabled
pyramid_spring_enabled
pyramid_theme_feature_settings_v1
vzid_last_claim_type
vzid_last_claim_type_label
vzid_last_claim_type_updated_at
dup_google_sheets_problem_picker_bridge_url
support_reminders_state_v1
dup_execution_analysis_params_v1
dup_execution_analysis_state_v1
dup_id_card_check_state_v1
jqgrid_settings_*
dup_ui_show_*
```

### 7.4. Таблица дневных счетчиков

```sql
public.extension_counter_days
```

Поля:

```text
user_id uuid not null references auth.users(id) on delete cascade
counter_key text not null
date_key text not null
value integer not null default 0
revision bigint not null
updated_at timestamptz not null default now()
updated_by_device_id text
```

PK:

```text
(user_id, counter_key, date_key)
```

Использовать для:

```text
stats_history
editing_stats
```

Нельзя синхронизировать счетчики как полную карту дат, потому что это вызывает потерю изменений при работе из разных браузеров. Изменения счетчиков должны применяться как атомарные операции:

```text
increment
decrement
set
reset_day
```

### 7.5. Таблица обработанных правок

```sql
public.extension_processed_edits
```

Поля:

```text
user_id uuid not null references auth.users(id) on delete cascade
date_iso text not null
path text not null
base_count integer not null default 0
unique_edocids jsonb not null default '[]'::jsonb
revision bigint not null
updated_at timestamptz not null default now()
updated_by_device_id text
```

PK:

```text
(user_id, date_iso, path)
```

Использовать вместо полной перезаписи `processed_edits`.

### 7.6. Таблица правил действий

```sql
public.extension_action_rules
```

Поля:

```text
user_id uuid not null references auth.users(id) on delete cascade
path text not null
status text not null check (status in ('approved', 'blocked'))
tag text
revision bigint not null
updated_at timestamptz not null default now()
updated_by_device_id text
```

PK:

```text
(user_id, path)
```

Использовать вместо раздельных массивов:

```text
approved_actions
blocked_actions
action_tags
```

При сборке локального кэша можно обратно формировать старые ключи:

```text
approved_actions = все path со status = approved
blocked_actions = все path со status = blocked
action_tags = object path -> tag
```

### 7.7. Таблица mutation log / idempotency

```sql
public.extension_mutations
```

Поля:

```text
user_id uuid not null references auth.users(id) on delete cascade
mutation_id text not null
device_id text not null
base_revision bigint
applied_revision bigint
operations jsonb not null
created_at timestamptz not null default now()
applied_at timestamptz
status text not null default 'applied'
error text
```

PK:

```text
(user_id, mutation_id)
```

Назначение:

```text
1. идемпотентность повторных отправок;
2. защита от повторного применения одной и той же mutation;
3. диагностика синхронизации.
```

---

## 8. RPC-функции Supabase

Нужно создать серверные функции через миграции.

### 8.1. `extension_register_device`

Назначение: зарегистрировать/обновить устройство пользователя.

Вход:

```text
p_device_id text
p_device_name text
p_browser text
```

Логика:

```text
1. user_id = auth.uid()
2. upsert в extension_devices
3. обновить last_seen_at
```

### 8.2. `extension_get_state`

Назначение: вернуть canonical state пользователя.

Вход:

```text
p_since_revision bigint default null
```

Выход:

```json
{
  "schema_version": 2,
  "revision": 123,
  "kv": {},
  "counter_days": [],
  "processed_edits": [],
  "action_rules": [],
  "server_time": "..."
}
```

Если `p_since_revision` передан, можно вернуть только изменения после указанной ревизии. Если реализация diff усложняет задачу, на первом этапе допустимо возвращать полный canonical state, но обязательно с текущей `revision`.

### 8.3. `extension_apply_mutation`

Главная функция записи.

Вход:

```text
p_device_id text
p_mutation_id text
p_base_revision bigint
p_operations jsonb
```

Формат `p_operations`:

```json
[
  {
    "type": "kv_set",
    "key": "setting_copy_mode",
    "value": true
  },
  {
    "type": "kv_delete",
    "key": "some_key"
  },
  {
    "type": "counter_increment",
    "counter_key": "stats_history",
    "date_key": "13.05.2026",
    "delta": 1
  },
  {
    "type": "counter_set",
    "counter_key": "editing_stats",
    "date_key": "13.05.2026",
    "value": 5
  },
  {
    "type": "processed_edit_set",
    "date_iso": "2026-05-13",
    "path": "/some/action",
    "base_count": 3,
    "unique_edocids": []
  },
  {
    "type": "action_rule_set",
    "path": "/some/action",
    "status": "approved",
    "tag": "Тег"
  },
  {
    "type": "action_rule_delete",
    "path": "/some/action"
  }
]
```

Обязательная логика:

```text
1. user_id = auth.uid()
2. если mutation_id уже есть у пользователя — не применять повторно, вернуть ранее applied_revision и текущее состояние/ревизию
3. заблокировать строку extension_sync_state пользователя FOR UPDATE
4. если extension_sync_state еще нет — создать
5. проверить base_revision
6. применить операции
7. увеличить revision на 1
8. записать applied_revision в extension_mutations
9. вернуть новую revision и canonical state или changed summary
```

По конфликтам:

```text
Если p_base_revision меньше текущей server revision:
- функция не должна молча перетирать данные;
- вернуть специальный статус conflict/revision_mismatch;
- клиент должен сделать pull, затем rebase pending mutations и повторить.
```

Для атомарных `counter_increment` допустимо применять поверх текущей ревизии, если операция коммутативна.

Для `kv_set` и `processed_edit_set` при конфликте по тому же ключу/записи нужно использовать безопасную стратегию:

```text
1. pull актуального состояния;
2. повторить mutation как новое пользовательское намерение;
3. если невозможно безопасно объединить — зафиксировать conflict в локальном sync-meta и не затирать данные молча.
```

---

## 9. Миграция старых данных

Старую таблицу:

```text
public.extension_user_state
```

не удалять.

Нужно выполнить миграцию данных:

```text
1. Если у пользователя есть legacy extension_user_state.state,
   перенести данные в новые таблицы.
2. Простые ключи перенести в extension_user_kv.
3. stats_history перенести в extension_counter_days с counter_key = 'stats_history'.
4. editing_stats перенести в extension_counter_days с counter_key = 'editing_stats'.
5. processed_edits перенести в extension_processed_edits.
6. approved_actions / blocked_actions / action_tags объединить в extension_action_rules.
7. После переноса выставить начальную revision.
```

Если SQL-миграция всех сложных структур слишком рискованная, допустим безопасный вариант:

```text
1. создать новые таблицы;
2. оставить legacy state как fallback;
3. при первом входе пользователя новая RPC-функция или клиентский migration step читает legacy state;
4. переносит его через extension_apply_mutation/bootstrap;
5. помечает миграцию как выполненную.
```

Но нельзя потерять текущие пользовательские данные.

---

## 10. Поведение при входе в аккаунт

После успешного входа:

```text
1. Сохранить локальный pre-login backup sync-ключей в dup_supabase_pre_login_backup_v2.
2. Зарегистрировать device_id через extension_register_device.
3. Получить remote canonical state через extension_get_state.
4. Если remote state существует и revision > 0:
   - заменить локальные sync-ключи состоянием из Supabase;
   - не заливать локальные данные автоматически поверх Supabase.
5. Если remote state пустой:
   - выполнить bootstrap из текущих локальных данных;
   - записать их в Supabase через extension_apply_mutation;
   - затем заново получить canonical state и применить в кэш.
6. Запустить realtime-подписку.
7. Запустить fallback pull по alarm.
```

Важно:

```text
Локальные данные нового/другого браузера не должны автоматически становиться главным состоянием, если в Supabase уже есть данные.
```

---

## 11. Поведение при выходе из аккаунта

При выходе:

```text
1. Остановить realtime.
2. Остановить fallback alarm.
3. Удалить auth session.
4. Удалить sync-meta текущей сессии.
5. По возможности оставить локальный кэш как локальный режим, но четко показать в UI, что пользователь вышел и данные больше не синхронизируются.
```

Не удалять пользовательские данные без явного подтверждения.

---

## 12. Локальный outbox

Нужно добавить durable outbox в `chrome.storage.local`.

Ключи:

```text
dup_supabase_device_id_v1
dup_supabase_outbox_v1
dup_supabase_cache_revision_v1
dup_supabase_sync_meta_v2
dup_supabase_pre_login_backup_v2
```

Формат outbox item:

```json
{
  "mutationId": "deviceId:timestamp:random",
  "deviceId": "...",
  "baseRevision": 123,
  "createdAt": "2026-05-13T...",
  "attempts": 0,
  "lastError": "",
  "operations": []
}
```

Требования:

```text
1. Outbox хранится durable, переживает закрытие браузера.
2. Изменения не теряются при NetworkError.
3. Push идет строго последовательно.
4. Если один push завис/упал, очередь не считается обработанной.
5. После успешного подтверждения сервером mutation удаляется из outbox.
6. Пока outbox не пустой, remote pull не должен молча затирать локальные dirty-данные.
```

---

## 13. Единый sync API внутри расширения

Нужно перестать напрямую писать синхронизируемые данные в `chrome.storage.local`.

Создать единый слой, например:

```text
sync_store.js
```

или внутри `SupabaseSync/supabase_sync.js`, но архитектурно отделить:

```js
DupSyncStore.get(key)
DupSyncStore.setKv(key, value)
DupSyncStore.deleteKv(key)
DupSyncStore.incrementCounter(counterKey, dateKey, delta)
DupSyncStore.setCounter(counterKey, dateKey, value)
DupSyncStore.setProcessedEdit(dateIso, path, data)
DupSyncStore.setActionRule(path, status, tag)
DupSyncStore.deleteActionRule(path)
DupSyncStore.flush()
DupSyncStore.pull()
DupSyncStore.getStatus()
```

Задача Codex:

```text
1. Найти все места прямой записи sync-ключей.
2. Заменить их на вызовы единого sync API.
3. Для несинхронизируемых технических ключей оставить прямой local storage.
```

Технические ключи, которые не надо синхронизировать:

```text
dup_supabase_*
extension_logs
pending_actions
pendingEditingActions
dup_department_container_cookie_stores_v1
dup_stage_jump_pending
pyramid_christmas_enabled_cache_v1
pyramid_spring_enabled_cache_v1
pyramid_theme_feature_settings_cache_v1
logs_*
stage timer runtime keys
```

---

## 14. Поведение при изменениях в UI

Когда пользователь меняет настройку/счетчик:

```text
1. UI может обновиться оптимистично.
2. Изменение обязательно записывается в outbox.
3. Изменение отправляется в Supabase.
4. После успешного ответа сервера локальный кэш приводится к canonical state/revision.
5. Если отправка не удалась — UI показывает, что есть pending changes.
6. Нельзя показывать "всё синхронизировано", если outbox не пустой.
```

---

## 15. Realtime

Realtime должен использоваться так:

```text
1. Клиент подписывается на изменения состояния пользователя.
2. Realtime-событие не считается данными.
3. Realtime-событие означает: "на сервере появилась новая revision".
4. После события клиент делает pull.
5. Если pull не удался — состояние остается "Realtime connected, pull failed".
```

Не путать:

```text
Realtime connected != sync successful
```

UI обязан показывать отдельно:

```text
Auth status
Realtime status
Last successful pull
Last successful push
Server revision
Local cache revision
Outbox size
Last error
```

---

## 16. Fetch/retry/timeout

Нужно заменить текущие нестабильные fetch-вызовы на надежный wrapper.

Требования:

```text
1. AbortController timeout для каждого REST/RPC-запроса.
2. Retry с exponential backoff для:
   - NetworkError
   - timeout
   - 408
   - 429
   - 500
   - 502
   - 503
   - 504
3. Не retry для:
   - 400
   - 401 после неуспешного refresh
   - 403
   - 404
   - validation errors
4. При 401 один раз refresh session и повторить.
5. В finally всегда сбрасывать syncInProgress.
6. UI не должен зависать навечно на "Синхронизация...".
```

---

## 17. Статусы в UI

Переделать статус в `SupabaseSync/supabase_auth_ui.js`.

Статус должен показывать не только "Realtime: подключен", а примерно:

```text
Supabase включен
user@example.com

Состояние:
- Realtime: подключен
- Последний pull: 13.05 15:42
- Последний push: 13.05 15:41
- Server revision: 128
- Local revision: 128
- Очередь изменений: 0
```

Если есть проблемы:

```text
Realtime: подключен
REST push: ошибка NetworkError
Очередь изменений: 2
Данные будут отправлены повторно автоматически
```

Если pull упал:

```text
Realtime: подключен
REST pull: ошибка timeout
Локальный кэш может быть неактуален
```

---

## 18. Ручная кнопка "Синхронизировать сейчас"

Кнопка должна делать не "перезаписать одно другим", а безопасный цикл:

```text
1. refresh session
2. register device
3. если outbox не пустой — сначала flush outbox
4. pull latest canonical state
5. apply canonical state to local cache
6. update UI status
```

Нельзя, чтобы кнопка "Синхронизировать сейчас" затирала локальные неотправленные изменения remote-состоянием.

---

## 19. Импорт JSON

Сейчас импорт JSON пишет данные в local storage и затем вызывает `DUP_SUPABASE_SYNC_NOW`.

Нужно переделать:

```text
Если пользователь не авторизован:
- импорт остается локальным.

Если пользователь авторизован:
- импорт должен быть оформлен как batch mutation через extension_apply_mutation;
- перед применением показать подтверждение, что импорт перезапишет/обновит облачные данные;
- после успешного сервера применить canonical state.
```

Нельзя импортировать JSON так, чтобы он молча затер Supabase без revision/mutation-механизма.

---

## 20. Совместимость с текущим кодом

Чтобы не ломать все content scripts сразу, допустим промежуточный слой совместимости:

```text
1. В локальном кэше продолжать поддерживать старые ключи:
   - stats_history
   - editing_stats
   - processed_edits
   - approved_actions
   - blocked_actions
   - action_tags
2. Но источником их наполнения должен быть canonical state из Supabase.
3. Запись этих ключей должна идти через sync API, а не прямой set.
```

Важно:

```text
Совместимость старых local storage ключей допускается только как формат локального кэша.
Она не означает, что старый механизм синхронизации полного snapshot можно оставить активным.
```

---

## 21. Требования к безопасности

```text
1. Не коммитить service_role key.
2. Не добавлять секреты в репозиторий.
3. Использовать только publishable/anon key на клиенте.
4. Все права на данные ограничить RLS по auth.uid().
5. RPC-функции должны использовать auth.uid(), а не принимать user_id от клиента.
6. p_device_id можно принимать от клиента, но user_id всегда только через auth.uid().
```

---

## 22. Тест-кейсы

Codex должен после реализации проверить минимум такие сценарии.

### 22.1. Первый вход на первом браузере

```text
Дано:
- пользователь не имеет remote state;
- локально есть настройки/счетчики.

Ожидается:
- создается device;
- создается server state;
- revision > 0;
- локальный кэш соответствует Supabase;
- outbox пустой.
```

### 22.2. Вход на втором браузере

```text
Дано:
- в Supabase уже есть state;
- во втором браузере локально другие/старые данные.

Ожидается:
- локальные sync-ключи заменяются состоянием из Supabase;
- локальные данные не отправляются поверх Supabase автоматически;
- создается pre-login backup.
```

### 22.3. Одновременная работа в двух браузерах

```text
Дано:
- браузер А меняет настройку;
- браузер Б открыт в это время.

Ожидается:
- браузер А отправляет mutation;
- Supabase увеличивает revision;
- браузер Б получает realtime-событие;
- браузер Б делает pull;
- настройка обновляется без ручной синхронизации.
```

### 22.4. NetworkError при push

```text
Дано:
- браузер Б меняет данные;
- сеть/Supabase временно недоступны.

Ожидается:
- изменение остается в outbox;
- UI показывает pending changes и ошибку push;
- remote pull не затирает dirty local change;
- после восстановления сети outbox отправляется;
- Supabase получает изменение.
```

### 22.5. Конфликт ревизий

```text
Дано:
- браузер А обновил server revision;
- браузер Б пытается отправить mutation с устаревшей baseRevision.

Ожидается:
- сервер не молча перетирает данные;
- клиент делает pull;
- безопасные операции переигрываются поверх новой revision;
- опасные конфликты фиксируются в status/meta и не затираются молча.
```

### 22.6. Счетчики

```text
Дано:
- два браузера одновременно увеличивают один и тот же счетчик за один день.

Ожидается:
- оба increment учитываются;
- итоговое значение не теряет один из инкрементов.
```

### 22.7. Realtime есть, REST упал

```text
Дано:
- WebSocket подключен;
- REST pull/push падает.

Ожидается:
- UI не пишет "всё синхронизировано";
- UI показывает Realtime connected + REST error;
- повторная попытка выполняется автоматически.
```

### 22.8. Проверка отсутствия старого активного snapshot-механизма

```text
Дано:
- пользователь авторизован;
- меняет любую sync-настройку;
- меняет счетчик;
- меняет action rule;
- нажимает "Синхронизировать сейчас";
- выполняет импорт JSON.

Ожидается:
- ни один сценарий не вызывает старую запись полного state jsonb в extension_user_state;
- все записи идут только через extension_apply_mutation;
- extension_user_state не используется как активный источник истины.
```

---

## 23. Критерии приемки

Работу считать выполненной только если выполнены все пункты:

```text
1. Supabase после авторизации является источником истины.
2. Нет активной перезаписи всего state jsonb при каждом изменении.
3. Есть server revision.
4. Есть durable outbox.
5. Есть idempotent mutation_id.
6. Есть безопасная обработка revision mismatch.
7. Realtime обновляет второй браузер без ручной кнопки.
8. NetworkError не приводит к потере локальных изменений.
9. "Синхронизировать сейчас" не затирает dirty local state.
10. UI показывает реальные статусы pull/push/realtime/outbox/revision.
11. Все изменения БД оформлены миграциями.
12. Миграции применены через Supabase MCP.
13. Старые данные из legacy extension_user_state не потеряны.
14. Прямые записи sync-ключей в chrome.storage.local заменены на единый sync API.
15. Старый full snapshot upsert не остается активным ни в одном пользовательском сценарии.
16. Новая схема покрывает все sync-ключи, которые ранее входили в Supabase-синхронизацию.
```

Если хотя бы один пункт не выполнен, задачу нельзя считать завершенной.

---

## 24. Что не делать

```text
1. Не удалять старую таблицу extension_user_state на первом этапе.
2. Не делать "last write wins" по полному snapshot.
3. Не считать client_updated_at надежным механизмом конфликтов.
4. Не считать Realtime-соединение доказательством успешной синхронизации.
5. Не просить пользователя вручную запускать SQL.
6. Не добавлять service_role key в расширение.
7. Не затирать локальные pending changes при pull.
8. Не оставлять старый и новый механизмы одновременно активными.
9. Не ограничиваться только изменением UI-статуса без изменения фактической модели данных.
10. Не делать частичную миграцию только для части ключей, если остальные продолжают синхронизироваться старым snapshot.
```

---

## 25. Итоговый ожидаемый результат

После переделки пользователь может войти в один Supabase-аккаунт в нескольких браузерах.

Ожидаемое поведение:

```text
1. В одном браузере изменил настройку/счетчик/тег.
2. Изменение ушло в Supabase как mutation.
3. Supabase увеличил revision.
4. Другие браузеры получили realtime-событие.
5. Другие браузеры подтянули canonical state.
6. Во всех браузерах стало одинаковое состояние.
7. Если сеть временно упала, изменение не потерялось, а осталось в outbox и отправилось позже.
```

Главный принцип:

```text
Локальные данные не должны побеждать Supabase автоматически.
Supabase должен быть единственным источником актуальных данных после авторизации.
```

---

## 26. Финальное указание для Codex

Перед завершением задачи Codex должен явно проверить:

```text
1. Есть ли в коде активные вызовы старого upsertRemoteState(snapshot)?
2. Может ли chrome.storage.onChanged инициировать старый полный push?
3. Может ли кнопка "Синхронизировать сейчас" затереть локальные pending changes?
4. Может ли импорт JSON обойти mutation/revision-механизм?
5. Все ли sync-ключи покрыты новой схемой?
6. Применены ли миграции через Supabase MCP?
7. Проверены ли RLS и realtime publication?
8. Есть ли тест/ручной сценарий на два браузера?
```

Если ответ на любой из пунктов отрицательный, не завершать задачу как выполненную.
