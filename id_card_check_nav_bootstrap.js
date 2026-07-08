(function() {
  'use strict';

  const SESSION_CACHE_KEY = 'dup_id_card_check_nav_state_v1';
  const NAV_ID = 'dup-id-card-check-nav';
  const FULLCARD_PATH_RE = /^\/ovzid\/fullcard\/([^/]+)(?:\/.*)?$/i;

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeState(rawState) {
    const raw = rawState && typeof rawState === 'object' ? rawState : {};
    const edocIds = Array.isArray(raw.edocIds)
      ? raw.edocIds.map(normalizeText).filter(Boolean)
      : [];
    const uniqueEdocIds = [];
    const seen = new Set();
    edocIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      uniqueEdocIds.push(id);
    });
    const rawIndex = Number.parseInt(String(raw.currentIndex || 0), 10);
    const currentIndex = uniqueEdocIds.length
      ? Math.min(Math.max(Number.isFinite(rawIndex) ? rawIndex : 0, 0), uniqueEdocIds.length - 1)
      : 0;
    const rawTabId = Number(raw.tabId || 0);
    return {
      version: 1,
      tabId: Number.isInteger(rawTabId) && rawTabId > 0 ? rawTabId : 0,
      edocIds: uniqueEdocIds,
      currentIndex,
      updatedAt: Number(raw.updatedAt || 0) || Date.now()
    };
  }

  function readSessionState() {
    try {
      const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
      if (!raw) return normalizeState(null);
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      try {
        window.sessionStorage.removeItem(SESSION_CACHE_KEY);
      } catch (removeError) {
        // ignore session storage cleanup failures
      }
      return normalizeState(null);
    }
  }

  function writeSessionState(state) {
    const normalized = normalizeState(state);
    try {
      if (!normalized.edocIds.length) {
        window.sessionStorage.removeItem(SESSION_CACHE_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(normalized));
      }
    } catch (error) {
      // ignore session storage write failures
    }
    return normalized;
  }

  function getCurrentEdocId() {
    const match = String(window.location.pathname || '').match(FULLCARD_PATH_RE);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function isFullcardPage() {
    return FULLCARD_PATH_RE.test(String(window.location.pathname || ''));
  }

  function buildNavigationUrl(edocId) {
    const url = new URL(window.location.href);
    const targetId = encodeURIComponent(normalizeText(edocId));
    const match = url.pathname.match(/^(\/ovzid\/fullcard\/)([^/]+)(.*)$/i);
    url.pathname = match
      ? `${match[1]}${targetId}${match[3] || ''}`
      : `/ovzid/fullcard/${targetId}`;
    return url.toString();
  }

  function getHydratedState() {
    const state = readSessionState();
    if (!state.edocIds.length || !isFullcardPage()) return null;
    const currentEdocId = getCurrentEdocId();
    if (!currentEdocId) return null;
    const currentIndex = state.edocIds.indexOf(currentEdocId);
    return {
      ...state,
      currentIndex: currentIndex >= 0 ? currentIndex : state.currentIndex
    };
  }

  function renderStatus(nav, state) {
    const status = nav.querySelector('.dup-id-card-check-status');
    if (!(status instanceof HTMLElement)) return;
    const currentEdocId = getCurrentEdocId();
    const currentFromState = state.edocIds[state.currentIndex] || '';
    status.textContent = currentEdocId && !state.edocIds.includes(currentEdocId)
      ? `Вне списка: ${currentEdocId}`
      : currentFromState
        ? `${state.currentIndex + 1}/${state.edocIds.length}: ${currentFromState}`
        : 'Список не загружен';
  }

  function updateButtons(nav, state) {
    const previousButton = nav.querySelector('.dup-id-card-check-prev');
    const nextButton = nav.querySelector('.dup-id-card-check-next');
    const actionButton = nav.querySelector('.dup-id-card-check-current-actions');
    if (previousButton instanceof HTMLButtonElement) previousButton.disabled = state.currentIndex <= 0;
    if (nextButton instanceof HTMLButtonElement) nextButton.disabled = state.currentIndex >= state.edocIds.length - 1;
    if (actionButton instanceof HTMLButtonElement) actionButton.hidden = true;
  }

  function navigateBy(delta) {
    const state = getHydratedState();
    if (!state || !state.edocIds.length) return;
    const nextIndex = Math.min(Math.max(state.currentIndex + delta, 0), state.edocIds.length - 1);
    const targetEdocId = state.edocIds[nextIndex];
    if (!targetEdocId || nextIndex === state.currentIndex) return;
    writeSessionState({
      ...state,
      currentIndex: nextIndex,
      updatedAt: Date.now()
    });
    window.location.assign(buildNavigationUrl(targetEdocId));
  }

  function createNav() {
    const nav = document.createElement('div');
    nav.id = NAV_ID;
    nav.className = 'dup-id-card-check-nav';
    nav.dataset.dupIdCardCheckBootstrap = '1';
    nav.innerHTML = `
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-prev" aria-label="Назад" title="Назад">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.4 11H19a1 1 0 1 1 0 2h-8.6l4.3 4.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0z"></path>
        </svg>
      </button>
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-choice" aria-label="Выбор" title="Выбор">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1zM4 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm0 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm0 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"></path>
        </svg>
      </button>
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-current-actions" hidden aria-label="Действия по текущему EdocID" title="Действия по текущему EdocID">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13 2 4 14h6l-1 8 11-14h-7l1-6z"></path>
        </svg>
      </button>
      <button type="button" class="dup-id-card-check-nav-button dup-id-card-check-next" aria-label="Вперед" title="Вперед">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.3 18.7a1 1 0 0 1 0-1.4l4.3-4.3H5a1 1 0 1 1 0-2h8.6L9.3 6.7a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0z"></path>
        </svg>
      </button>
      <span class="dup-id-card-check-status"></span>
      <span class="dup-id-card-check-toast" aria-live="polite"></span>
    `;
    nav.querySelector('.dup-id-card-check-prev')?.addEventListener('click', () => {
      if (nav.dataset.dupIdCardCheckContentReady === '1') return;
      navigateBy(-1);
    }, { capture: true });
    nav.querySelector('.dup-id-card-check-next')?.addEventListener('click', () => {
      if (nav.dataset.dupIdCardCheckContentReady === '1') return;
      navigateBy(1);
    }, { capture: true });
    return nav;
  }

  function getMountPoint(nav) {
    const tabsHeader = document.querySelector('.custom-ui-tab.ui-tabs-nav, .ui-tabs-nav');
    if (tabsHeader instanceof HTMLElement) {
      return {
        target: tabsHeader,
        position: 'afterend'
      };
    }

    const hostRoot = document.body || document.documentElement;
    if (!(hostRoot instanceof HTMLElement)) return null;
    const firstVisibleBlock = Array.from(hostRoot.children).find((child) => {
      if (!(child instanceof HTMLElement)) return false;
      if (child === nav || child.id === NAV_ID) return false;
      return !child.hidden;
    });
    if (firstVisibleBlock instanceof HTMLElement && firstVisibleBlock.parentElement) {
      return {
        target: firstVisibleBlock,
        position: 'beforebegin'
      };
    }
    return {
      target: hostRoot,
      position: 'afterbegin'
    };
  }

  function attachNav(nav) {
    const mountPoint = getMountPoint(nav);
    if (!(mountPoint && mountPoint.target instanceof HTMLElement)) return false;
    const { target, position } = mountPoint;
    if (position === 'afterend') {
      if (nav.parentElement !== target.parentElement || nav.previousElementSibling !== target) {
        target.insertAdjacentElement('afterend', nav);
      }
      return true;
    }
    if (position === 'beforebegin') {
      if (nav.parentElement !== target.parentElement || nav.nextElementSibling !== target) {
        target.insertAdjacentElement('beforebegin', nav);
      }
      return true;
    }
    if (nav.parentElement !== target || target.firstElementChild !== nav) {
      target.insertAdjacentElement('afterbegin', nav);
    }
    return true;
  }

  function sync() {
    const state = getHydratedState();
    if (!state) return false;
    const existing = document.getElementById(NAV_ID);
    const nav = existing instanceof HTMLElement ? existing : createNav();
    if (!attachNav(nav)) return false;
    renderStatus(nav, state);
    updateButtons(nav, state);
    return true;
  }

  if (sync()) return;

  const observer = new MutationObserver(() => {
    if (!sync()) return;
    observer.disconnect();
  });
  const observeTarget = document.documentElement || document;
  observer.observe(observeTarget, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', () => {
    if (sync()) observer.disconnect();
  }, { once: true });
})();
