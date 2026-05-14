/* Перед изменениями в папке PyramidNewYear см. SEASONAL_THEME_RULES.md */
(function() {
    'use strict';

    const FEATURE_STORAGE_KEY = 'pyramid_theme_feature_settings_v1';
    const FEATURE_CACHE_KEY = 'pyramid_theme_feature_settings_cache_v1';
    const SETTINGS_EVENT_NAME = 'pyramid-theme-feature-settings-changed';
    const LAUNCHER_HOST_ID = 'pyramid-seasonal-theme-settings-launcher';
    const OVERLAY_ID = 'pyramid-seasonal-theme-settings-overlay';
    const TITLE_ID = 'pyramid-seasonal-theme-settings-title';
    const BODY_OPEN_CLASS = 'seasonal-theme-settings-open';
    const IS_TOP_WINDOW = (() => {
        try {
            return window.top === window;
        } catch (error) {
            return true;
        }
    })();

    const FEATURE_CLASS_MAP = Object.freeze({
        spring: Object.freeze({
            petals: 'spring-feature-petals-enabled',
            chromeDecor: 'spring-feature-chrome-enabled',
            titleIcons: 'spring-feature-title-icons-enabled',
            dialogFrame: 'spring-feature-dialog-frame-enabled',
            gridFrame: 'spring-feature-grid-frame-enabled',
            gridHeader: 'spring-feature-grid-header-enabled',
            cardModalTheme: 'spring-feature-card-modal-enabled',
            cardTabs: 'spring-feature-card-tabs-enabled',
            headerBackground: 'spring-feature-header-background-enabled',
            headerButtons: 'spring-feature-header-buttons-enabled',
            dropdown: 'spring-feature-dropdown-enabled',
            pager: 'spring-feature-pager-enabled'
        }),
        newYear: Object.freeze({
            pageGarland: 'ny-feature-page-garland-enabled',
            modalGarland: 'ny-feature-modal-garland-enabled',
            snowfall: 'ny-feature-snowfall-enabled',
            chromeDecor: 'ny-feature-chrome-enabled',
            titleIcons: 'ny-feature-title-icons-enabled',
            titleButtons: 'ny-feature-title-buttons-enabled',
            tabs: 'ny-feature-tabs-enabled',
            modalGlow: 'ny-feature-modal-glow-enabled'
        })
    });

    const FEATURE_SECTIONS = Object.freeze([
        Object.freeze({
            themeKey: 'spring',
            title: 'Весенняя тема',
            items: Object.freeze([
                Object.freeze({
                    key: 'petals',
                    label: 'Падающие лепестки',
                    description: 'Анимированные лепестки поверх страницы.'
                }),
                Object.freeze({
                    key: 'chromeDecor',
                    label: 'Оформление заголовков таблиц и окон',
                    description: 'Градиенты и цвета шапок таблиц, вкладок и диалогов.'
                }),
                Object.freeze({
                    key: 'titleIcons',
                    label: 'Значки в заголовках',
                    description: 'Цветы и веточки возле названий таблиц и окон.'
                }),
                Object.freeze({
                    key: 'dialogFrame',
                    label: 'Свечение и скругление модальных окон',
                    description: 'Мягкая рамка и тень у обычных модалок.'
                }),
                Object.freeze({
                    key: 'gridFrame',
                    label: 'Рамка таблицы',
                    description: 'Оформление верхней части грида.'
                }),
                Object.freeze({
                    key: 'gridHeader',
                    label: 'Шапка столбцов и фильтров',
                    description: 'Оформление заголовков колонок и полей фильтрации в гриде.'
                }),
                Object.freeze({
                    key: 'cardModalTheme',
                    label: 'Фон и кнопки карточки',
                    description: 'Оформление модалки с iframe, включая фон, рамки и action-кнопки.'
                }),
                Object.freeze({
                    key: 'cardTabs',
                    label: 'Вкладки и аккордеоны внутри карточки',
                    description: 'Оформление табов и секций в карточке.'
                }),
                Object.freeze({
                    key: 'headerBackground',
                    label: 'Фон и анимация шапки',
                    description: 'Весенний фон верхней панели.'
                }),
                Object.freeze({
                    key: 'headerButtons',
                    label: 'Кнопки в шапке',
                    description: 'Стили основных кнопок в верхнем меню.'
                }),
                Object.freeze({
                    key: 'dropdown',
                    label: 'Выпадающие меню',
                    description: 'Оформление выпадающих списков в шапке.'
                }),
                Object.freeze({
                    key: 'pager',
                    label: 'Панель пагинации',
                    description: 'Оформление пагинатора таблицы.'
                })
            ])
        }),
        Object.freeze({
            themeKey: 'newYear',
            title: 'Новогодняя тема',
            items: Object.freeze([
                Object.freeze({
                    key: 'pageGarland',
                    label: 'Гирлянда вверху страницы',
                    description: 'Большая гирлянда над основной страницей.'
                }),
                Object.freeze({
                    key: 'modalGarland',
                    label: 'Гирлянды в модальных окнах',
                    description: 'Гирлянды в шапках модалок.'
                }),
                Object.freeze({
                    key: 'snowfall',
                    label: 'Снегопад',
                    description: 'Падающий снег поверх страницы.'
                }),
                Object.freeze({
                    key: 'chromeDecor',
                    label: 'Оформление заголовков таблиц и окон',
                    description: 'Новогодняя шапка таблиц, вкладок и окон.'
                }),
                Object.freeze({
                    key: 'titleIcons',
                    label: 'Праздничные значки в заголовках',
                    description: 'Ёлка, Дед Мороз, снеговик и снежинки.'
                }),
                Object.freeze({
                    key: 'titleButtons',
                    label: 'Кнопки в заголовках таблиц и окон',
                    description: 'Стили ссылок и кнопок внутри заголовков.'
                }),
                Object.freeze({
                    key: 'tabs',
                    label: 'Оформление вкладок',
                    description: 'Новогодние цвета для вкладок.'
                }),
                Object.freeze({
                    key: 'modalGlow',
                    label: 'Свечение модальных окон',
                    description: 'Подсветка и рамка у модалок.'
                })
            ])
        })
    ]);

    let cachedSettings = null;
    let storageLoadStarted = false;
    let storageLoadCompleted = false;
    let storageSyncBound = false;
    let overlayElement = null;
    let launcherHost = null;
    let launcherButton = null;
    let pendingFeatureSettings = null;
    let bodyReadyObserver = null;
    const pendingLoadCallbacks = [];
    const pendingBodyReadyCallbacks = [];

    function hasChromeStorage() {
        return !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
    }

    function syncSet(values, reason) {
        try {
            chrome.runtime.sendMessage({
                action: 'DUP_SYNC_SET',
                data: {
                    values,
                    options: { reason: reason || 'pyramid-theme-settings' }
                }
            }, () => {});
        } catch (error) {
            // background недоступен
        }
    }

    function readLocalCache(key) {
        try {
            const rawValue = window.localStorage.getItem(key);
            if (!rawValue) return null;
            return JSON.parse(rawValue);
        } catch (error) {
            return null;
        }
    }

    function writeLocalCache(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            // ignore
        }
    }

    function flushBodyReadyCallbacks() {
        if (!document.body) return;

        if (bodyReadyObserver) {
            bodyReadyObserver.disconnect();
            bodyReadyObserver = null;
        }

        while (pendingBodyReadyCallbacks.length) {
            const callback = pendingBodyReadyCallbacks.shift();
            try {
                callback();
            } catch (error) {
                // ignore
            }
        }
    }

    function onBodyReady(callback) {
        if (typeof callback !== 'function') return;
        if (document.body) {
            callback();
            return;
        }

        pendingBodyReadyCallbacks.push(callback);
        document.addEventListener('DOMContentLoaded', flushBodyReadyCallbacks, { once: true });
        if (bodyReadyObserver || !document.documentElement) return;

        bodyReadyObserver = new MutationObserver(() => {
            flushBodyReadyCallbacks();
        });
        bodyReadyObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    function getThemeConfig() {
        return window.PYRAMID_THEME_CONFIG || {};
    }

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildDefaultSettings() {
        const config = getThemeConfig();
        const springConfig = config.spring || {};
        const springFeatures = springConfig.features || {};
        const newYearConfig = config.newYear || {};
        const newYearFeatures = newYearConfig.features || {};

        return {
            spring: {
                petals: springConfig.petalsEnabled !== false,
                chromeDecor: springFeatures.chromeDecorEnabled !== false,
                titleIcons: springFeatures.titleIconsEnabled !== false,
                dialogFrame: springFeatures.dialogFrameEnabled !== false,
                gridFrame: springFeatures.gridFrameEnabled !== false,
                gridHeader: springFeatures.gridHeaderEnabled !== false,
                cardModalTheme: springFeatures.cardModalThemeEnabled !== false,
                cardTabs: springFeatures.cardTabsEnabled !== false,
                headerBackground: springFeatures.headerBackgroundEnabled !== false,
                headerButtons: springFeatures.headerButtonsEnabled !== false,
                dropdown: springFeatures.dropdownEnabled !== false,
                pager: springFeatures.pagerEnabled !== false
            },
            newYear: {
                pageGarland: newYearFeatures.pageGarlandEnabled !== false,
                modalGarland: newYearFeatures.modalGarlandEnabled !== false,
                snowfall: newYearFeatures.snowfallEnabled !== false,
                chromeDecor: newYearFeatures.chromeDecorEnabled !== false,
                titleIcons: newYearFeatures.titleIconsEnabled !== false,
                titleButtons: newYearFeatures.titleButtonsEnabled !== false,
                tabs: newYearFeatures.tabsEnabled !== false,
                modalGlow: newYearFeatures.modalGlowEnabled !== false
            }
        };
    }

    function normalizeSettings(inputValue) {
        const defaults = buildDefaultSettings();
        const input = inputValue && typeof inputValue === 'object' ? inputValue : {};
        const normalized = {};

        FEATURE_SECTIONS.forEach((section) => {
            const themeDefaults = defaults[section.themeKey] || {};
            const themeInput = input[section.themeKey] && typeof input[section.themeKey] === 'object'
                ? input[section.themeKey]
                : {};
            const themeResult = {};

            section.items.forEach((item) => {
                themeResult[item.key] = typeof themeInput[item.key] === 'boolean'
                    ? themeInput[item.key]
                    : themeDefaults[item.key] !== false;
            });

            normalized[section.themeKey] = themeResult;
        });

        return normalized;
    }

    function getSettingsSnapshot() {
        return normalizeSettings(cachedSettings || buildDefaultSettings());
    }

    function readCachedSettings() {
        const cachedValue = readLocalCache(FEATURE_CACHE_KEY);
        if (!cachedValue || typeof cachedValue !== 'object') return null;
        return normalizeSettings(cachedValue);
    }

    function persistSettingsCache(settings) {
        writeLocalCache(FEATURE_CACHE_KEY, normalizeSettings(settings));
    }

    function applyFeatureClassesToBody(body, settings) {
        if (!(body instanceof HTMLElement)) return;

        Object.keys(FEATURE_CLASS_MAP).forEach((themeKey) => {
            const themeClasses = FEATURE_CLASS_MAP[themeKey];
            const themeSettings = settings[themeKey] || {};

            Object.keys(themeClasses).forEach((featureKey) => {
                body.classList.toggle(themeClasses[featureKey], themeSettings[featureKey] === true);
            });
        });
    }

    function flushPendingFeatureClasses() {
        if (!pendingFeatureSettings || !document.body) return;
        const nextSettings = pendingFeatureSettings;
        pendingFeatureSettings = null;
        applyFeatureClassesToBody(document.body, nextSettings);
    }

    function applyFeatureClasses(settings) {
        const normalizedSettings = normalizeSettings(settings);
        const body = document.body;
        if (!body) {
            pendingFeatureSettings = normalizedSettings;
            onBodyReady(flushPendingFeatureClasses);
            return;
        }

        pendingFeatureSettings = null;
        applyFeatureClassesToBody(body, normalizedSettings);
    }

    function syncRenderedInputs() {
        if (!(overlayElement instanceof HTMLElement)) return;
        const settings = getSettingsSnapshot();
        overlayElement.querySelectorAll('input[data-theme-key][data-feature-key]').forEach((input) => {
            if (!(input instanceof HTMLInputElement)) return;
            const themeKey = input.dataset.themeKey || '';
            const featureKey = input.dataset.featureKey || '';
            input.checked = !!(settings[themeKey] && settings[themeKey][featureKey]);
        });
    }

    function dispatchSettingsEvent(source) {
        try {
            window.dispatchEvent(new CustomEvent(SETTINGS_EVENT_NAME, {
                detail: {
                    source: source || 'unknown',
                    settings: getSettingsSnapshot()
                }
            }));
        } catch (error) {
            // ignore
        }
    }

    function setCachedSettings(nextSettings, source) {
        cachedSettings = normalizeSettings(nextSettings);
        persistSettingsCache(cachedSettings);
        applyFeatureClasses(cachedSettings);
        syncRenderedInputs();
        dispatchSettingsEvent(source);
    }

    function flushLoadCallbacks() {
        if (!storageLoadCompleted) return;
        const payload = deepClone(getSettingsSnapshot());
        while (pendingLoadCallbacks.length) {
            const callback = pendingLoadCallbacks.shift();
            try {
                callback(payload);
            } catch (error) {
                // ignore
            }
        }
    }

    function loadSettings(callback) {
        if (typeof callback === 'function') {
            pendingLoadCallbacks.push(callback);
        }

        if (storageLoadStarted) {
            flushLoadCallbacks();
            return;
        }

        storageLoadStarted = true;
        const cachedLocalSettings = readCachedSettings();
        setCachedSettings(cachedLocalSettings || buildDefaultSettings(), cachedLocalSettings ? 'bootstrap-cache' : 'bootstrap-defaults');

        if (!hasChromeStorage()) {
            storageLoadCompleted = true;
            flushLoadCallbacks();
            return;
        }

        chrome.storage.local.get([FEATURE_STORAGE_KEY], (result) => {
            const storedSettings = result && result[FEATURE_STORAGE_KEY];
            setCachedSettings(storedSettings, 'storage-load');
            storageLoadCompleted = true;
            flushLoadCallbacks();
        });
    }

    function saveSettings(nextSettings, source) {
        setCachedSettings(nextSettings, source || 'ui');

        if (!hasChromeStorage()) return;
        syncSet({
            [FEATURE_STORAGE_KEY]: getSettingsSnapshot()
        }, 'pyramid-theme-settings-save');
    }

    function updateSetting(themeKey, featureKey, enabled) {
        const nextSettings = getSettingsSnapshot();
        if (!nextSettings[themeKey] || !Object.prototype.hasOwnProperty.call(nextSettings[themeKey], featureKey)) {
            return;
        }

        nextSettings[themeKey][featureKey] = !!enabled;
        saveSettings(nextSettings, `toggle:${themeKey}:${featureKey}`);
    }

    function bindStorageSync() {
        if (!hasChromeStorage() || storageSyncBound) return;
        if (!chrome.storage.onChanged || typeof chrome.storage.onChanged.addListener !== 'function') return;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;
            if (!changes || !Object.prototype.hasOwnProperty.call(changes, FEATURE_STORAGE_KEY)) return;
            const nextValue = changes[FEATURE_STORAGE_KEY]
                ? changes[FEATURE_STORAGE_KEY].newValue
                : undefined;
            setCachedSettings(nextValue, 'storage-onChanged');
        });

        storageSyncBound = true;
    }

    function renderDialogBody() {
        if (!(overlayElement instanceof HTMLElement)) return;
        const target = overlayElement.querySelector('[data-seasonal-settings-body]');
        if (!(target instanceof HTMLElement)) return;

        const settings = getSettingsSnapshot();
        target.innerHTML = FEATURE_SECTIONS.map((section) => {
            const itemsHtml = section.items.map((item) => {
                const checked = settings[section.themeKey] && settings[section.themeKey][item.key] ? ' checked' : '';
                return `
                    <label class="seasonal-theme-settings-row">
                        <span class="seasonal-theme-settings-copy">
                            <span class="seasonal-theme-settings-name">${escapeHtml(item.label)}</span>
                            <span class="seasonal-theme-settings-description">${escapeHtml(item.description)}</span>
                        </span>
                        <span class="seasonal-theme-settings-switch">
                            <input
                                type="checkbox"
                                data-theme-key="${escapeHtml(section.themeKey)}"
                                data-feature-key="${escapeHtml(item.key)}"${checked}
                            >
                            <span class="seasonal-theme-settings-switch-track" aria-hidden="true"></span>
                        </span>
                    </label>
                `;
            }).join('');

            return `
                <section class="seasonal-theme-settings-section">
                    <h3 class="seasonal-theme-settings-section-title">${escapeHtml(section.title)}</h3>
                    <div class="seasonal-theme-settings-section-list">
                        ${itemsHtml}
                    </div>
                </section>
            `;
        }).join('');

        target.querySelectorAll('input[data-theme-key][data-feature-key]').forEach((input) => {
            if (!(input instanceof HTMLInputElement)) return;
            input.addEventListener('change', () => {
                updateSetting(input.dataset.themeKey || '', input.dataset.featureKey || '', input.checked);
            });
        });
    }

    function closeDialog() {
        if (!(overlayElement instanceof HTMLElement) || overlayElement.hidden) return;
        overlayElement.hidden = true;
        document.body.classList.remove(BODY_OPEN_CLASS);
        if (launcherButton instanceof HTMLButtonElement && launcherButton.isConnected) {
            launcherButton.focus();
        }
    }

    function openDialog() {
        if (!IS_TOP_WINDOW) return;
        const overlay = ensureOverlay();
        if (!(overlay instanceof HTMLElement)) return;

        renderDialogBody();
        overlay.hidden = false;
        document.body.classList.add(BODY_OPEN_CLASS);

        const firstControl = overlay.querySelector('input[data-theme-key][data-feature-key], button[data-seasonal-settings-close]');
        if (firstControl instanceof HTMLElement) {
            firstControl.focus();
        }
    }

    function ensureOverlay() {
        if (!IS_TOP_WINDOW || !document.body) return null;
        if (overlayElement instanceof HTMLElement && document.body.contains(overlayElement)) {
            return overlayElement;
        }

        overlayElement = document.createElement('div');
        overlayElement.id = OVERLAY_ID;
        overlayElement.className = 'seasonal-theme-settings-overlay seasonal-theme-settings-element';
        overlayElement.hidden = true;
        overlayElement.innerHTML = `
            <div
                class="seasonal-theme-settings-panel seasonal-theme-settings-element"
                role="dialog"
                aria-modal="true"
                aria-labelledby="${TITLE_ID}"
            >
                <div class="seasonal-theme-settings-header">
                    <div class="seasonal-theme-settings-header-copy">
                        <h2 id="${TITLE_ID}" class="seasonal-theme-settings-title">Настройки сезонного оформления</h2>
                        <p class="seasonal-theme-settings-subtitle">Изменения применяются сразу и сохраняются автоматически.</p>
                    </div>
                    <button
                        type="button"
                        class="seasonal-theme-settings-close"
                        data-seasonal-settings-close="1"
                        aria-label="Закрыть настройки"
                    >×</button>
                </div>
                <div class="seasonal-theme-settings-body" data-seasonal-settings-body></div>
            </div>
        `;

        overlayElement.addEventListener('click', (event) => {
            if (event.target === overlayElement || (event.target instanceof HTMLElement && event.target.dataset.seasonalSettingsClose === '1')) {
                closeDialog();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (!(overlayElement instanceof HTMLElement) || overlayElement.hidden) return;
            event.preventDefault();
            closeDialog();
        }, true);

        document.body.appendChild(overlayElement);
        renderDialogBody();
        return overlayElement;
    }

    function ensureLauncherHost() {
        if (!IS_TOP_WINDOW || !document.body) return null;
        if (launcherHost instanceof HTMLElement && launcherHost.isConnected) {
            return launcherHost;
        }

        launcherHost = document.createElement('div');
        launcherHost.id = LAUNCHER_HOST_ID;
        launcherHost.className = 'seasonal-theme-settings-header-item seasonal-theme-settings-element';
        launcherHost.innerHTML = `
            <button
                type="button"
                class="seasonal-theme-settings-launcher seasonal-theme-settings-element"
                aria-label="Настройки сезонного оформления"
                title="Настройки сезонного оформления"
            >
                <span aria-hidden="true">⚙</span>
            </button>
        `;

        launcherButton = launcherHost.querySelector('button');
        if (launcherButton instanceof HTMLButtonElement) {
            launcherButton.addEventListener('click', () => {
                openDialog();
            });
        }

        return launcherHost;
    }

    function resolveAnchorElement(preferredAnchor) {
        if (preferredAnchor instanceof HTMLElement && preferredAnchor.isConnected) {
            return preferredAnchor;
        }

        const existingAnchors = Array.from(document.querySelectorAll('.ny-header-item, .spring-header-item'))
            .filter((node) => node instanceof HTMLElement);
        if (!existingAnchors.length) return null;
        return existingAnchors[existingAnchors.length - 1];
    }

    function syncLauncher(options = {}) {
        if (!IS_TOP_WINDOW || !document.body) return null;

        ensureOverlay();
        const host = ensureLauncherHost();
        if (!(host instanceof HTMLElement)) return null;

        const anchorElement = resolveAnchorElement(options.anchorElement);
        const targetContainer = options.targetContainer instanceof HTMLElement
            ? options.targetContainer
            : (anchorElement instanceof HTMLElement ? anchorElement.parentElement : null);

        if (!(anchorElement instanceof HTMLElement) || !(targetContainer instanceof HTMLElement)) {
            if (host.parentElement) {
                host.remove();
            }
            return null;
        }

        if (anchorElement.nextSibling) {
            if (anchorElement.nextSibling !== host || host.parentElement !== targetContainer) {
                targetContainer.insertBefore(host, anchorElement.nextSibling);
            }
        } else {
            targetContainer.appendChild(host);
        }

        return host;
    }

    function isFeatureEnabled(themeKey, featureKey, targetDocument) {
        const doc = targetDocument && targetDocument.body ? targetDocument : document;
        const className = FEATURE_CLASS_MAP[themeKey] && FEATURE_CLASS_MAP[themeKey][featureKey];
        if (!className || !doc.body) return false;
        return doc.body.classList.contains(className);
    }

    function init() {
        onBodyReady(flushPendingFeatureClasses);
        loadSettings();
        bindStorageSync();

        window.PYRAMID_THEME_SETTINGS = {
            FEATURE_STORAGE_KEY,
            SETTINGS_EVENT_NAME,
            FEATURE_CLASS_MAP,
            FEATURE_SECTIONS,
            getSettingsSnapshot() {
                return deepClone(getSettingsSnapshot());
            },
            loadSettings,
            saveSettings,
            updateSetting,
            syncLauncher,
            openDialog,
            closeDialog,
            isFeatureEnabled
        };
    }

    init();
})();
