/* Перед изменениями в папке PyramidNewYear см. SEASONAL_THEME_RULES.md */
(function() {
    'use strict';

    const STORAGE_KEY = 'pyramid_christmas_v10_enabled';
    const THEME_CLASS = 'ny-active';
    const SWITCH_ID = 'nySwicher';
    const THEME_EVENT_NAME = 'pyramid-seasonal-theme-activate';
    const THEME_SOURCE = 'pyramid_christmas';
    const SNOW_IMAGE_URL = 'https://www.expertplus.ru/UserFiles/Image/content/new_year/08.png';

    let switchCheckbox = null;

    function getThemeConfig() {
        const config = window.PYRAMID_THEME_CONFIG || {};
        const toggles = config.toggles || {};
        const behavior = config.behavior || {};
        const newYear = config.newYear || {};
        return {
            showNewYearToggle: toggles.showNewYearToggle !== false,
            allowThemeOverlap: behavior.allowThemeOverlap === true,
            defaultTheme: String(behavior.defaultTheme || '').toLowerCase(),
            enabledByDefault: newYear.enabledByDefault === true,
            forceDisableWhenToggleHidden: newYear.forceDisableWhenToggleHidden === true
        };
    }

    function getDefaultEnabled(config) {
        if (config.defaultTheme === 'newyear') return true;
        return config.enabledByDefault === true;
    }

    function syncSettingsLauncher(targetContainer, anchorElement) {
        const settingsApi = window.PYRAMID_THEME_SETTINGS;
        if (!settingsApi || typeof settingsApi.syncLauncher !== 'function') return;
        settingsApi.syncLauncher({
            targetContainer,
            anchorElement
        });
    }

    function hasChromeStorage() {
        return !!(chrome && chrome.storage && chrome.storage.local);
    }

    function dispatchThemeEvent(isActive) {
        try {
            window.dispatchEvent(new CustomEvent(THEME_EVENT_NAME, {
                detail: {
                    theme: 'newyear',
                    active: !!isActive,
                    source: THEME_SOURCE
                }
            }));
        } catch (error) {
            // ignore
        }
    }

    function applyNewYearState(isEnabled, options = {}) {
        const enabled = !!isEnabled;
        const persist = options.persist === true;
        const broadcast = options.broadcast !== false;
        const body = document.body;
        if (!body) return;

        body.classList.toggle(THEME_CLASS, enabled);
        if (switchCheckbox instanceof HTMLInputElement) {
            switchCheckbox.checked = enabled;
        }

        if (persist && hasChromeStorage()) {
            chrome.storage.local.set({ [STORAGE_KEY]: enabled });
        }

        if (broadcast) {
            dispatchThemeEvent(enabled);
        }
    }

    // === ГЕНЕРАТОР ГИРЛЯНДЫ ===
    function createGarlandElement(count = 30) {
        const container = document.createElement('div');
        container.className = 'ny-element ny-garland-container';
        const wire = document.createElement('div');
        wire.className = 'ny-wire';
        container.appendChild(wire);
        for (let i = 0; i < count; i++) {
            const bulb = document.createElement('div');
            bulb.className = 'ny-bulb';
            container.appendChild(bulb);
        }
        return container;
    }

    // === СНЕГОПАД ===
    function initSnow() {
        if (document.querySelector('.ny-snow-container')) return;
        const snowContainer = document.createElement('div');
        snowContainer.className = 'ny-element ny-snow-container';
        document.body.appendChild(snowContainer);
        setInterval(() => {
            if (!document.body.classList.contains(THEME_CLASS)) return;
            const flake = document.createElement('img');
            flake.src = SNOW_IMAGE_URL;
            flake.className = 'snowflake';
            const startLeft = Math.random() * window.innerWidth;
            const duration = Math.random() * 5 + 7;
            const size = Math.random() * 25 + 15;
            flake.style.left = `${startLeft}px`;
            flake.style.width = `${size}px`;
            flake.style.animation = `fall ${duration}s linear forwards`;
            snowContainer.appendChild(flake);
            setTimeout(() => flake.remove(), duration * 1000);
        }, 300);
    }

    // === МОДАЛКИ ===
    function watchModals() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    if (node.classList.contains('ui-dialog')) {
                        decorateModal(node);
                        return;
                    }
                    node.querySelectorAll('.ui-dialog').forEach(decorateModal);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('.ui-dialog').forEach(decorateModal);
    }

    function decorateModal(modalNode) {
        const titlebar = modalNode.querySelector('.ui-dialog-titlebar');
        if (titlebar && !titlebar.querySelector('.ny-garland-container')) {
            const garland = createGarlandElement(35);
            titlebar.prepend(garland);
        }
    }

    function resolveHeaderContainer() {
        const header = document.querySelector('header');
        if (!header) return null;
        return header.querySelector(
            'div[style*="display:flex"][style*="align-items:center"], div[style*="display: flex"][style*="align-items: center"]'
        );
    }

    function removeNewYearSwitch() {
        const targetContainer = resolveHeaderContainer();
        document.querySelectorAll('.ny-header-item').forEach((node) => node.remove());
        switchCheckbox = null;
        syncSettingsLauncher(targetContainer, null);
    }

    // === ПЕРЕКЛЮЧАТЕЛЬ ===
    function injectSwitch() {
        const config = getThemeConfig();
        if (!config.showNewYearToggle) {
            removeNewYearSwitch();
            return;
        }

        const targetContainer = resolveHeaderContainer();
        if (!targetContainer) return;

        let switchWrapper = targetContainer.querySelector('.ny-header-item');
        if (!(switchWrapper instanceof HTMLElement)) {
            switchWrapper = document.createElement('div');
            switchWrapper.className = 'ny-header-item';
            switchWrapper.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span class="ny-label">Новый год</span>
                    <div class="material-switch-newYear">
                        <input id="${SWITCH_ID}" type="checkbox">
                        <label for="${SWITCH_ID}" class="label-danger"></label>
                    </div>
                </div>
            `;

            if (targetContainer.children.length >= 1) {
                targetContainer.insertBefore(switchWrapper, targetContainer.children[1]);
            } else {
                targetContainer.appendChild(switchWrapper);
            }
        }

        const checkbox = switchWrapper.querySelector(`#${SWITCH_ID}`);
        if (!(checkbox instanceof HTMLInputElement)) return;
        switchCheckbox = checkbox;
        switchCheckbox.checked = document.body.classList.contains(THEME_CLASS);

        if (switchCheckbox.dataset.boundTheme !== '1') {
            switchCheckbox.dataset.boundTheme = '1';
            switchCheckbox.addEventListener('change', (event) => {
                const input = event.target;
                const isEnabled = !!(input && input.checked);
                applyNewYearState(isEnabled, { persist: true, broadcast: true });
            });
        }

        syncSettingsLauncher(targetContainer, switchWrapper);
    }

    function initThemeState() {
        const config = getThemeConfig();
        const forceDisable = !config.showNewYearToggle && config.forceDisableWhenToggleHidden;
        if (!hasChromeStorage()) {
            const enabled = forceDisable ? false : getDefaultEnabled(config);
            applyNewYearState(enabled, { persist: false, broadcast: enabled });
            return;
        }

        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const hasStoredValue = typeof result[STORAGE_KEY] === 'boolean';
            let enabled = hasStoredValue ? result[STORAGE_KEY] === true : getDefaultEnabled(config);

            if (forceDisable && enabled) {
                enabled = false;
            }

            const shouldPersist = !hasStoredValue || (forceDisable && result[STORAGE_KEY] !== false);
            applyNewYearState(enabled, { persist: shouldPersist, broadcast: enabled });
        });
    }

    function handleThemeEvent(event) {
        const detail = event && event.detail ? event.detail : null;
        if (!detail || detail.source === THEME_SOURCE) return;
        if (!detail.active) return;

        const config = getThemeConfig();
        if (config.allowThemeOverlap) return;
        if (detail.theme && detail.theme !== 'newyear') {
            applyNewYearState(false, { persist: true, broadcast: false });
        }
    }

    function init() {
        if (!document.body) return;

        window.addEventListener(THEME_EVENT_NAME, handleThemeEvent, { capture: true });

        document.body.prepend(createGarlandElement(40));
        initSnow();
        watchModals();

        initThemeState();
        injectSwitch();
        setTimeout(injectSwitch, 1000);
    }

    init();
})();
