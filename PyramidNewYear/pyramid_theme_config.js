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
            forceDisableWhenToggleHidden: true
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
            spawnIntervalMs: 520
        }
    };
})();
