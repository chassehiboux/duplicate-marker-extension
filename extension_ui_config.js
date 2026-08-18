/* Глобальная конфигурация элементов интерфейса расширения.
   Достаточно изменить значения и перезагрузить страницу.

   globalEnabled:
   - true  -> учитывать настройки F2 и сохраненное состояние.
   - false -> принудительно скрыть все элементы расширения для всех пользователей.

   forcedVisibility:
   - null  -> использовать состояние из F2 / chrome.storage.local.
   - true  -> принудительно показывать элемент для всех пользователей.
   - false -> принудительно скрывать элемент для всех пользователей.
*/
(function() {
    'use strict';

    window.PYRAMID_EXTENSION_UI_CONFIG = {
        // Полностью включает или отключает весь интерфейс расширения на всех страницах.
        globalEnabled: true,
        forcedVisibility: {
            // Подсветка дубликатов публикаций в основном списке.
            duplicateHighlights: null,
            // Подсветка дубликатов карточек/строк ФССП.
            fsspDuplicateHighlights: null,
            // Подсветка статусов и связанных маркеров в блоках ФССП.
            fsspStatusHighlights: null,
            // Подсветка дубликатов в блоках ЕПГУ.
            epguDuplicateHighlights: null,
            // Подсветка заполненности и служебных отметок ЕПГУ.
            epguFillHighlights: null,
            // Кнопка ЕПГУ, проверка реестров, переключение баз, сводка и повторы.
            epguSummaryTools: null,
            // Основная панель таймера StageTimer.
            stageTimer: null,
            // Кнопка сворачивания/скрытия таймера.
            stageTimerToggle: null,
            // Кнопка прерывания таймера.
            stageTimerAbort: null,
            // Предупреждение о разных департаментах в открытых вкладках Пирамиды.
            stageTimerDepartmentConflict: null,
            // Кнопки и выпадающее меню быстрых действий StageJump, включая реестр возврата ИД.
            stageJumpButtons: null,
            // Блок "Занести анализ исполнения" во вкладке "Функции" меню F2.
            executionAnalysisTools: null,
            // Блок "Проверка карточек ИД" и навигационные панели по загруженному списку или текущему гриду EdocID.
            idCardCheckTools: null,
            // Фильтр depid и переключатель показа скрытых департаментов.
            departmentDropdownFilter: null,
            // Кнопка группировки записей ФССП.
            fsspGroupingToggle: null,
            // Кнопка и окно пакетного поиска должников в реестрах ФССП.
            fsspRegistrySearch: null,
            // Кнопка и окно поиска абонентов в реестрах взыскания колл-центра.
            callCenterRegistrySearch: null,
            // Команда StageJump и окно перекрёстной проверки паспорта, ИНН и даты смерти.
            identityVerificationTools: null,
            // Быстрые и массовые действия с чатами на chatgpt.com.
            chatgptChatTools: null,
            // Новогоднее/весеннее сезонное оформление.
            seasonalTheme: false,
            // Кнопка "Настройки сезонного оформления" и связанные панели.
            seasonalThemeSettings: false,
            // Кнопка "Настройка столбцов" и её модальное окно.
            columnManager: null
        }
    };
})();
