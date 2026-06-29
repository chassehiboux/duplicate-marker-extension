# Баг: возможная потеря пользовательских изменений при одновременном flush outbox и применении canonical state

## Описание проблемы

В текущей реализации Supabase-синхронизации возможна потеря пользовательских изменений из-за race condition между:

- локальным добавлением новой mutation в outbox;
- активной отправкой уже существующей mutation в Supabase;
- удалением подтвержденной mutation из outbox;
- применением canonical state обратно в `chrome.storage.local`.

Проблема не ограничивается счетчиками. Потенциально она может затрагивать любые синхронизируемые данные проекта:

```text
settings / KV-ключи
counter operations
processed_edits
processed_edocids
action_rules
support reminders
theme/settings keys
jqgrid_settings_*
любые будущие sync-операции
```

Основной риск: сервер возвращает canonical state, который содержит только уже подтвержденные изменения, а в это же время в локальном браузере уже появились новые pending-изменения.

Если такой canonical state применяется поверх локального optimistic cache или если outbox перезаписывается по устаревшей копии, новое изменение может быть потеряно.

---

## Пример проблемного сценария

1. В локальном кэше есть актуальное состояние.
2. Пользователь выполняет действие №1.
3. Действие №1 записывается в outbox и отправляется в Supabase.
4. Пока flush еще выполняется, пользователь выполняет действие №2.
5. Действие №2 локально применяется и должно быть сохранено как новая pending mutation.
6. В этот момент завершается push действия №1.
7. Supabase возвращает canonical state, в котором учтено только действие №1.
8. Клиент применяет этот canonical state в `chrome.storage.local` или перезаписывает outbox по старой копии.
9. Действие №2 теряется полностью или локально откатывается.

---

## Фактическое поведение

При быстрых последовательных изменениях часть действий может не дойти до Supabase или может быть перезаписана состоянием, полученным после предыдущего push/pull.

Иными словами, sync layer может вести себя так, будто последнего пользовательского действия не было.

---

## Ожидаемое поведение

Любое пользовательское изменение, которое уже принято расширением, должно быть сохранено в durable outbox и не должно теряться при:

```text
одновременном flush;
повторном быстром действии пользователя;
приходе Realtime-события;
ручном sync now;
fallback pull;
успешном push предыдущей mutation;
revision mismatch;
повторном применении canonical state.
```

Если изменение принято локально, оно должно либо:

```text
1. успешно примениться в Supabase;
2. остаться в outbox до успешной отправки;
3. перейти в явный conflict/error state;
```

но не должно молча исчезать.

---

## Требуемое исправление

Необходимо доработать sync layer так, чтобы outbox и local cache обрабатывались атомарно и безопасно.

---

### 1. Не перезаписывать outbox по устаревшей копии

После успешной отправки mutation нельзя удалять элемент из outbox на основании массива, который был прочитан до начала flush.

Неправильная логика:

```js
const outbox = await getOutbox();
const item = outbox[0];

await send(item);

outbox.shift();
await setOutbox(outbox);
```

Проблема этой логики: пока `send(item)` выполняется, в outbox может быть добавлена новая mutation. После этого `setOutbox(outbox)` может перезаписать актуальную очередь старой копией и удалить новые pending-изменения.

Правильная логика:

```js
const confirmedMutationId = item.mutationId;

const latestOutbox = await getOutbox();
const nextOutbox = latestOutbox.filter(
  item => item.mutationId !== confirmedMutationId
);

await setOutbox(nextOutbox);
```

Удалять можно только конкретную mutation, подтвержденную сервером, по `mutationId`.

---

### 2. Сериализовать операции enqueue / flush / remove / rebase

Все операции с outbox должны выполняться через единый lock/mutex:

```text
enqueue mutation
flush mutation
remove confirmed mutation
update attempts / lastError
rebase pending mutation
clear outbox после успешного sync
```

Нельзя допускать, чтобы `enqueue` и `flush` одновременно читали и записывали один и тот же outbox-массив без повторного чтения актуального состояния.

---

### 3. Не применять canonical state поверх pending changes

Перед применением canonical state необходимо заново читать outbox.

Если outbox не пустой, canonical state нельзя применять поверх локального optimistic cache без безопасного merge/rebase.

Правило:

```text
если outbox не пустой — canonical state не должен молча затирать локальные изменения
```

Допустимые варианты:

```text
1. отложить apply canonical state до успешного flush;
2. применить canonical state только к ключам/сущностям, не затронутым pending mutations;
3. выполнить rebase pending mutations поверх нового canonical state;
4. при невозможности безопасного merge зафиксировать conflict.
```

---

### 4. Разделить server-confirmed cache и optimistic overlay

Желательно архитектурно разделить:

```text
server-confirmed local cache
pending optimistic changes
```

UI может показывать optimistic-состояние, но canonical state из Supabase должен применяться только к подтвержденной базе, не уничтожая pending overlay.

---

### 5. Проверять изменение outbox после каждого push

После успешного push одной mutation нужно:

```text
1. перечитать актуальный outbox;
2. удалить только подтвержденную mutation;
3. проверить, появились ли новые pending mutations;
4. если появились — не применять server canonical state поверх локального optimistic состояния;
5. продолжить flush следующей mutation.
```

---

### 6. Исправить статус синхронизации

Состояние `Синхронизация...` не должно зависать бесконечно.

При любой ошибке push/pull/rebase/conflict должен отображаться конкретный статус:

```text
REST push: ошибка ...
REST pull: ошибка ...
Очередь изменений: N
Данные будут отправлены повторно автоматически
Conflict: требуется повторный pull/rebase
```

---

## Критерии приемки

1. Быстрые последовательные изменения в одном браузере не теряются.
2. Изменение, добавленное в outbox во время активного flush, не удаляется после завершения предыдущего push.
3. Canonical state, полученный после push/pull, не перезаписывает локальные pending изменения.
4. При непустом outbox remote state не применяется вслепую поверх local cache.
5. После успешной отправки удаляется только конкретная подтвержденная mutation по `mutationId`.
6. При ошибке сети pending mutations остаются в outbox после перезапуска браузера.
7. После восстановления сети все pending mutations отправляются последовательно.
8. UI не показывает «все синхронизировано», если outbox не пустой.
9. UI не зависает навечно в состоянии `Синхронизация...`.
10. Для всех sync-операций поведение одинаково безопасное, а не только для счетчиков.

---

## Обязательные тесты

Проверить минимум следующие сценарии:

```text
1. Быстро выполнить несколько изменений подряд в одном браузере.
2. Выполнить изменение во время активного flush предыдущей mutation.
3. Выполнить изменение во время pull canonical state.
4. Выполнить изменение во время Realtime-triggered pull.
5. Отключить сеть после записи mutation в outbox.
6. Закрыть и открыть браузер с непустым outbox.
7. Проверить, что pending mutation не исчезает после успешного push другой mutation.
8. Проверить, что canonical state не откатывает локальное optimistic изменение.
9. Проверить несколько типов данных: counter, KV-setting, action_rule, processed_edit, support reminder.
```

---

## Итоговое требование

Sync layer должен гарантировать:

```text
любое локально принятое пользовательское изменение либо подтверждается Supabase, либо остается в outbox, либо явно фиксируется как conflict/error.
Молчаливая потеря mutation недопустима.
```
