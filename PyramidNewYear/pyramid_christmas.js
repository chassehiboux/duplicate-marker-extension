(function() {
    'use strict';

    const STORAGE_KEY = 'pyramid_christmas_v10_enabled';
    const SNOW_IMAGE_URL = "https://www.expertplus.ru/UserFiles/Image/content/new_year/08.png";

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
        const snowContainer = document.createElement('div');
        snowContainer.className = 'ny-element ny-snow-container';
        document.body.appendChild(snowContainer);
        setInterval(() => {
            if (!document.body.classList.contains('ny-active')) return;
            const flake = document.createElement('img');
            flake.src = SNOW_IMAGE_URL;
            flake.className = 'snowflake';
            const startLeft = Math.random() * window.innerWidth;
            const duration = Math.random() * 5 + 7; 
            const size = Math.random() * 25 + 15; 
            flake.style.left = startLeft + 'px';
            flake.style.width = size + 'px';
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
                    if (node.nodeType === 1) {
                        if (node.classList.contains('ui-dialog')) {
                            decorateModal(node);
                        } else {
                            node.querySelectorAll('.ui-dialog').forEach(decorateModal);
                        }
                    }
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

    // === ПЕРЕКЛЮЧАТЕЛЬ ===
    function injectSwitch() {
        const header = document.querySelector('header');
        if (!header) return;
        
        // Ищем контейнер с flex и align-items:center (стандартная шапка Пирамиды)
        const targetContainer = header.querySelector('div[style*="display:flex"][style*="align-items:center"], div[style*="display: flex"][style*="align-items: center"]');

        if (targetContainer && !document.getElementById('nySwicher')) {
            const switchWrapper = document.createElement('div');
            switchWrapper.className = 'ny-header-item'; // Обертка
            
            // Вставляем label ВНУТРЬ блока с классом material-switch-dmartSwicher, ПЕРЕД input
            switchWrapper.innerHTML = `
                <div class="material-switch-dmartSwicher" style="display:flex; align-items:center;">
                    <span class="ny-label">Новый год</span>
                    <input id="nySwicher" type="checkbox">
                    <label for="nySwicher" class="label-danger" style="background: #b71c1c; margin-bottom:0;"></label>
                </div>
            `;

            // Вставляем вторым элементом (между меню и витриной/профилем)
            if (targetContainer.children.length >= 1) {
                targetContainer.insertBefore(switchWrapper, targetContainer.children[1]);
            } else {
                targetContainer.appendChild(switchWrapper);
            }
            
            const checkbox = document.getElementById('nySwicher');
            const isEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
            checkbox.checked = isEnabled;
            if(isEnabled) document.body.classList.add('ny-active');

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('ny-active');
                    localStorage.setItem(STORAGE_KEY, 'true');
                } else {
                    document.body.classList.remove('ny-active');
                    localStorage.setItem(STORAGE_KEY, 'false');
                }
            });
        }
    }

    // === ЗАПУСК ===
    document.body.prepend(createGarlandElement(40));
    initSnow();
    watchModals();
    injectSwitch();
    setTimeout(injectSwitch, 1000);
})();