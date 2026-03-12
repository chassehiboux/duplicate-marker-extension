/* Перед изменениями в папке PyramidNewYear см. SEASONAL_THEME_RULES.md */
(function() {
    'use strict';

    // Быстрый конфиг сезонных тем.
    // Достаточно изменить значения true/false и перезагрузить страницу.
    window.PYRAMID_THEME_CONFIG = {
        toggles: {
            // Показывать переключатель "Новый год" в шапке.
            showNewYearToggle: false,
            // Показывать переключатель "Весна!" в шапке.
            showSpringToggle: true
        },
        behavior: {
            // Если false, одновременно можно держать активной только одну сезонную тему.
            allowThemeOverlap: false,
            // Какая тема включается по умолчанию при первом запуске без сохраненного состояния.
            // Возможные значения: "none" | "newyear" | "spring"
            defaultTheme: 'spring'
        },
        newYear: {
            // Включать ли тему "Новый год" по умолчанию, если нет сохраненного состояния.
            enabledByDefault: false,
            // Если переключатель скрыт, принудительно выключать тему.
            forceDisableWhenToggleHidden: true,
            features: {
                // Гирлянда в самом верху страницы.
                pageGarlandEnabled: true,
                // Гирлянды в шапках модальных окон.
                modalGarlandEnabled: true,
                // Падающий снег.
                snowfallEnabled: true,
                // Новогоднее оформление заголовков таблиц и окон.
                chromeDecorEnabled: true,
                // Иконки в заголовках.
                titleIconsEnabled: true,
                // Стили кнопок внутри заголовков.
                titleButtonsEnabled: true,
                // Новогоднее оформление вкладок.
                tabsEnabled: true,
                // Свечение модальных окон.
                modalGlowEnabled: true
            }
        },
        spring: {
            // Включать ли тему "Весна!" по умолчанию, если нет сохраненного состояния.
            enabledByDefault: true,
            // Оставляем только оформление "Сакура".
            randomVariantOnReload: false,
            variants: ['a'],
            defaultVariant: 'a',
            // Эффект лепестков.
            petalsEnabled: true,
            maxPetals: 18,
            spawnIntervalMs: 520,
            features: {
                // Заголовки таблиц и окон.
                chromeDecorEnabled: true,
                // Иконки 🌸 и 🌿 в заголовках.
                titleIconsEnabled: true,
                // Внешний вид обычных модальных окон.
                dialogFrameEnabled: true,
                // Обрамление самого грида.
                gridFrameEnabled: true,
                // Шапка грида: названия столбцов и строка фильтров.
                gridHeaderEnabled: true,
                // Оформление модалки карточки с iframe и action-кнопок внутри неё.
                cardModalThemeEnabled: true,
                // Вкладки и аккордеоны внутри карточки.
                cardTabsEnabled: true,
                // Фон и анимация шапки.
                headerBackgroundEnabled: true,
                // Кнопки в шапке.
                headerButtonsEnabled: true,
                // Выпадающие меню.
                dropdownEnabled: true,
                // Пагинация.
                pagerEnabled: true
            }
        }
    };
})();
