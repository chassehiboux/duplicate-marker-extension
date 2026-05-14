/* Перед изменениями в папке PyramidNewYear см. SEASONAL_THEME_RULES.md */
(function() {
    'use strict';

    const STORAGE_KEY = 'pyramid_spring_enabled';
    const STORAGE_CACHE_KEY = 'pyramid_spring_enabled_cache_v1';
    const THEME_CLASS = 'spring-active';
    const VARIANT_PREFIX = 'spring-variant-';
    const ONLY_VARIANT = 'a';
    const SWITCH_ID = 'springSwitcher';
    const THEME_EVENT_NAME = 'pyramid-seasonal-theme-activate';
    const THEME_SOURCE = 'pyramid_spring';
    const DEFAULT_VARIANTS = [ONLY_VARIANT];
    const MODAL_THEME_CLASS = 'spring-card-modal';
    const IS_TOP_WINDOW = (() => {
        try {
            return window.top === window;
        } catch (error) {
            return true;
        }
    })();

    let switchCheckbox = null;
    let petalLayer = null;
    let petalIntervalId = null;
    let modalObserver = null;
    let storageSyncBound = false;
    let pendingThemeState = null;
    let bodyReadyObserver = null;
    const pendingBodyReadyCallbacks = [];

    function hasChromeStorage() {
        return !!(chrome && chrome.storage && chrome.storage.local);
    }

    function syncSet(values, reason) {
        try {
            chrome.runtime.sendMessage({
                action: 'DUP_SYNC_SET',
                data: {
                    values,
                    options: { reason: reason || 'pyramid-spring' }
                }
            }, () => {});
        } catch (error) {
            // background недоступен
        }
    }

    function readCachedEnabledState() {
        try {
            const rawValue = window.localStorage.getItem(STORAGE_CACHE_KEY);
            if (!rawValue) return null;
            const parsedValue = JSON.parse(rawValue);
            return typeof parsedValue === 'boolean' ? parsedValue : null;
        } catch (error) {
            return null;
        }
    }

    function writeCachedEnabledState(enabled) {
        try {
            window.localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(enabled === true));
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
        const config = window.PYRAMID_THEME_CONFIG || {};
        const toggles = config.toggles || {};
        const behavior = config.behavior || {};
        const spring = config.spring || {};
        return {
            showSpringToggle: toggles.showSpringToggle !== false,
            allowThemeOverlap: behavior.allowThemeOverlap === true,
            defaultTheme: String(behavior.defaultTheme || '').toLowerCase(),
            enabledByDefault: spring.enabledByDefault === true,
            randomVariantOnReload: false,
            variants: DEFAULT_VARIANTS.slice(),
            defaultVariant: ONLY_VARIANT,
            petalsEnabled: spring.petalsEnabled !== false,
            maxPetals: Number.isFinite(spring.maxPetals) ? Math.max(0, Math.floor(spring.maxPetals)) : 18,
            spawnIntervalMs: Number.isFinite(spring.spawnIntervalMs) ? Math.max(120, Math.floor(spring.spawnIntervalMs)) : 520
        };
    }

    function syncSettingsLauncher(targetContainer, anchorElement) {
        const settingsApi = window.PYRAMID_THEME_SETTINGS;
        if (!settingsApi || typeof settingsApi.syncLauncher !== 'function') return;
        settingsApi.syncLauncher({
            targetContainer,
            anchorElement
        });
    }

    function resolveHeaderContainer() {
        const header = document.querySelector('header');
        if (!header) return null;
        return header.querySelector(
            'div[style*="display:flex"][style*="align-items:center"], div[style*="display: flex"][style*="align-items: center"]'
        );
    }

    function getDefaultEnabled(config) {
        if (config.defaultTheme === 'spring') return true;
        return config.enabledByDefault === true;
    }

    function normalizeVariants(variants, fallbackVariant) {
        const normalized = Array.isArray(variants)
            ? variants.map((item) => String(item || '').trim().toLowerCase()).filter((item) => item === ONLY_VARIANT)
            : [];
        if (normalized.length) return [ONLY_VARIANT];
        return [ONLY_VARIANT];
    }

    function removeSpringVariantClasses(body) {
        if (!(body instanceof HTMLElement)) return;
        Array.from(body.classList)
            .filter((className) => className.indexOf(VARIANT_PREFIX) === 0)
            .forEach((className) => body.classList.remove(className));
    }

    function resolveVariant(config, forceRandom) {
        const variants = normalizeVariants(config.variants, config.defaultVariant);
        if (!variants.length) return ONLY_VARIANT;

        const useRandom = forceRandom || config.randomVariantOnReload;
        if (!useRandom) {
            return ONLY_VARIANT;
        }

        return ONLY_VARIANT;
    }

    function dispatchThemeEvent(isActive) {
        try {
            window.dispatchEvent(new CustomEvent(THEME_EVENT_NAME, {
                detail: {
                    theme: 'spring',
                    active: !!isActive,
                    source: THEME_SOURCE
                }
            }));
        } catch (error) {
            // ignore
        }
    }

    function applySpringClasses(body, enabled, forceRandom) {
        const config = getThemeConfig();
        if (enabled) {
            const variant = resolveVariant(config, forceRandom);
            removeSpringVariantClasses(body);
            body.classList.add(`${VARIANT_PREFIX}${variant}`);
            body.classList.add(THEME_CLASS);
        } else {
            body.classList.remove(THEME_CLASS);
            removeSpringVariantClasses(body);
        }
    }

    function flushPendingThemeState() {
        if (!pendingThemeState || !document.body) return;
        const nextState = pendingThemeState;
        pendingThemeState = null;
        applySpringState(nextState.enabled, {
            persist: false,
            broadcast: nextState.broadcast,
            forceRandom: nextState.forceRandom
        });
    }

    function applySpringState(isEnabled, options = {}) {
        const enabled = !!isEnabled;
        const persist = options.persist === true;
        const broadcast = options.broadcast !== false;
        const forceRandom = options.forceRandom === true;
        const body = document.body;

        writeCachedEnabledState(enabled);

        if (persist && hasChromeStorage()) {
            syncSet({ [STORAGE_KEY]: enabled }, 'pyramid-spring-toggle');
        }

        if (!body) {
            pendingThemeState = {
                enabled,
                broadcast,
                forceRandom
            };
            onBodyReady(flushPendingThemeState);
            return;
        }

        pendingThemeState = null;
        applySpringClasses(body, enabled, forceRandom);

        if (switchCheckbox instanceof HTMLInputElement) {
            switchCheckbox.checked = enabled;
        }

        if (broadcast) {
            dispatchThemeEvent(enabled);
        }

        syncModalIframeThemes();
    }

    function removeSpringSwitch() {
        const targetContainer = resolveHeaderContainer();
        document.querySelectorAll('.spring-header-item').forEach((node) => node.remove());
        switchCheckbox = null;
        syncSettingsLauncher(targetContainer, null);
    }

    function injectSwitch() {
        const config = getThemeConfig();
        if (!config.showSpringToggle) {
            removeSpringSwitch();
            return;
        }

        const targetContainer = resolveHeaderContainer();
        if (!targetContainer) return;

        let wrapper = targetContainer.querySelector('.spring-header-item');
        if (!(wrapper instanceof HTMLElement)) {
            wrapper = document.createElement('div');
            wrapper.className = 'spring-header-item';
            wrapper.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span class="spring-label">Весна!</span>
                    <div class="material-switch-spring">
                        <input id="${SWITCH_ID}" type="checkbox">
                        <label for="${SWITCH_ID}" class="label-success"></label>
                    </div>
                </div>
            `;

            const newYearWrapper = targetContainer.querySelector('.ny-header-item');
            if (newYearWrapper && newYearWrapper.parentElement === targetContainer) {
                targetContainer.insertBefore(wrapper, newYearWrapper.nextSibling);
            } else if (targetContainer.children.length >= 1) {
                targetContainer.insertBefore(wrapper, targetContainer.children[1]);
            } else {
                targetContainer.appendChild(wrapper);
            }
        }

        const checkbox = wrapper.querySelector(`#${SWITCH_ID}`);
        if (!(checkbox instanceof HTMLInputElement)) return;
        switchCheckbox = checkbox;
        switchCheckbox.checked = document.body.classList.contains(THEME_CLASS);

        if (switchCheckbox.dataset.boundTheme !== '1') {
            switchCheckbox.dataset.boundTheme = '1';
            switchCheckbox.addEventListener('change', (event) => {
                const input = event.target;
                const enabled = !!(input && input.checked);
                applySpringState(enabled, {
                    persist: true,
                    broadcast: true,
                    forceRandom: true
                });
            });
        }

        syncSettingsLauncher(targetContainer, wrapper);
    }

    function ensurePetalLayer() {
        if (!document.body) return null;
        if (petalLayer instanceof HTMLElement && document.body.contains(petalLayer)) {
            return petalLayer;
        }

        const existing = document.querySelector('.spring-petal-layer');
        if (existing instanceof HTMLElement) {
            petalLayer = existing;
            return petalLayer;
        }

        petalLayer = document.createElement('div');
        petalLayer.className = 'spring-element spring-petal-layer';
        document.body.appendChild(petalLayer);
        return petalLayer;
    }

    function spawnPetal() {
        const body = document.body;
        if (!body || !body.classList.contains(THEME_CLASS)) return;
        if (!body.classList.contains('spring-feature-petals-enabled')) return;

        const config = getThemeConfig();
        if (config.maxPetals <= 0) return;

        const layer = ensurePetalLayer();
        if (!(layer instanceof HTMLElement)) return;
        if (layer.children.length >= config.maxPetals) return;

        const petal = document.createElement('span');
        petal.className = 'spring-element spring-petal';
        const left = Math.random() * Math.max(window.innerWidth, 320);
        const size = 10 + Math.random() * 10;
        const duration = 7 + Math.random() * 8;
        const drift = -140 + Math.random() * 280;

        petal.style.left = `${left}px`;
        petal.style.width = `${size}px`;
        petal.style.height = `${Math.max(6, size * 0.66)}px`;
        petal.style.animationDuration = `${duration}s`;
        petal.style.setProperty('--spring-petal-drift', `${drift}px`);

        layer.appendChild(petal);
        setTimeout(() => petal.remove(), Math.ceil(duration * 1000));
    }

    function initPetalEngine() {
        ensurePetalLayer();

        if (petalIntervalId) {
            clearInterval(petalIntervalId);
            petalIntervalId = null;
        }

        const config = getThemeConfig();
        petalIntervalId = setInterval(() => {
            spawnPetal();
        }, config.spawnIntervalMs);
    }

    function syncModalIframeThemes() {
        if (!IS_TOP_WINDOW) return;
        const body = document.body;
        if (!body) return;
        const enabled = body.classList.contains(THEME_CLASS);

        document.querySelectorAll('.ui-dialog').forEach((modalNode) => {
            if (!(modalNode instanceof HTMLElement)) return;
            const hasIframe = !!modalNode.querySelector('iframe');
            modalNode.classList.toggle(MODAL_THEME_CLASS, enabled && hasIframe);
        });
    }

    function observeModalIframes() {
        if (!IS_TOP_WINDOW) return;
        if (!document.body) return;
        if (modalObserver) {
            modalObserver.disconnect();
            modalObserver = null;
        }

        modalObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.matches('.ui-dialog') || node.querySelector('.ui-dialog')) {
                        syncModalIframeThemes();
                        return;
                    }
                }
            }
        });

        modalObserver.observe(document.body, { childList: true, subtree: true });
    }

    function bindStorageSync() {
        if (!hasChromeStorage() || storageSyncBound) return;
        if (!chrome.storage.onChanged || typeof chrome.storage.onChanged.addListener !== 'function') return;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes || !Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) return;
            const nextValue = changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue;
            if (typeof nextValue !== 'boolean') return;
            applySpringState(nextValue, {
                persist: false,
                broadcast: false
            });
        });

        storageSyncBound = true;
    }

    function initThemeState() {
        const config = getThemeConfig();
        const defaultEnabled = getDefaultEnabled(config);
        const cachedEnabled = readCachedEnabledState();
        const bootstrapEnabled = typeof cachedEnabled === 'boolean' ? cachedEnabled : defaultEnabled;

        applySpringState(bootstrapEnabled, {
            persist: false,
            broadcast: false,
            forceRandom: true
        });

        if (!hasChromeStorage()) {
            applySpringState(bootstrapEnabled, {
                persist: false,
                broadcast: bootstrapEnabled,
                forceRandom: true
            });
            return;
        }

        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const hasStoredValue = typeof result[STORAGE_KEY] === 'boolean';
            const enabled = hasStoredValue ? result[STORAGE_KEY] === true : defaultEnabled;
            applySpringState(enabled, {
                persist: !hasStoredValue,
                broadcast: enabled,
                forceRandom: true
            });
        });
    }

    function handleThemeEvent(event) {
        const detail = event && event.detail ? event.detail : null;
        if (!detail || detail.source === THEME_SOURCE) return;
        if (!detail.active) return;

        const config = getThemeConfig();
        if (config.allowThemeOverlap) return;
        if (detail.theme && detail.theme !== 'spring') {
            applySpringState(false, { persist: true, broadcast: false });
        }
    }

    function init() {
        window.addEventListener(THEME_EVENT_NAME, handleThemeEvent, { capture: true });

        initThemeState();
        bindStorageSync();

        if (IS_TOP_WINDOW) {
            onBodyReady(() => {
                initPetalEngine();
                observeModalIframes();
                syncModalIframeThemes();
                injectSwitch();
                setTimeout(injectSwitch, 1000);
            });
        }
    }

    init();
})();
