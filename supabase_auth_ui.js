(() => {
  'use strict';

  if (window.__dupSupabaseAuthUiInitialized) return;
  window.__dupSupabaseAuthUiInitialized = true;

  function $(id) {
    return document.getElementById(id);
  }

  function sendSupabaseMessage(action, data = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action, data }, (response) => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : '';
          resolve(runtimeError
            ? { success: false, error: runtimeError }
            : (response || { success: false, error: 'Нет ответа от фонового скрипта.' }));
        });
      } catch (error) {
        resolve({ success: false, error: error && error.message ? error.message : 'Ошибка отправки сообщения.' });
      }
    });
  }

  function formatSyncTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function setBusy(elements, isBusy) {
    elements.forEach((element) => {
      if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
        element.disabled = !!isBusy;
      }
    });
  }

  function stringifyStatusText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      if (typeof value.message === 'string') return value.message;
      if (typeof value.error_description === 'string') return value.error_description;
      if (typeof value.error === 'string') return value.error;
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }
    return String(value);
  }

  function initSupabaseAuthUi() {
    const root = $('supabase-auth-root');
    const mainButton = $('supabase-auth-main');
    const panel = $('supabase-auth-panel');
    const title = $('supabase-auth-title');
    const subtitle = $('supabase-auth-subtitle');
    const chevron = $('supabase-auth-chevron');
    const signedOut = $('supabase-auth-signed-out');
    const signedIn = $('supabase-auth-signed-in');
    const statusLine = $('supabase-auth-status');
    const emailInput = $('supabase-auth-email');
    const passwordInput = $('supabase-auth-password');
    const signInButton = $('supabase-auth-sign-in');
    const signUpButton = $('supabase-auth-sign-up');
    const signOutButton = $('supabase-auth-sign-out');
    const syncNowButton = $('supabase-auth-sync-now');
    const resetToggle = $('supabase-auth-reset-toggle');
    const resetPanel = $('supabase-auth-reset');
    const resetEmailInput = $('supabase-auth-reset-email');
    const resetCodeInput = $('supabase-auth-reset-code');
    const resetPasswordInput = $('supabase-auth-reset-password');
    const resetSendButton = $('supabase-auth-reset-send');
    const resetConfirmButton = $('supabase-auth-reset-confirm');

    if (!root || !mainButton || !panel || !title || !subtitle || !statusLine) return;

    const busyElements = [
      signInButton,
      signUpButton,
      signOutButton,
      syncNowButton,
      resetSendButton,
      resetConfirmButton,
      emailInput,
      passwordInput,
      resetEmailInput,
      resetCodeInput,
      resetPasswordInput
    ].filter(Boolean);

    let currentStatus = null;

    function setStatusText(text, isError = false) {
      statusLine.textContent = stringifyStatusText(text);
      statusLine.classList.toggle('is-error', !!isError);
      root.classList.toggle('is-error', !!isError);
    }

    function renderStatus(status) {
      currentStatus = status || {};
      const authenticated = currentStatus.authenticated === true;
      const email = String(currentStatus.email || '').trim();
      const lastSync = formatSyncTime(currentStatus.lastSyncAt);
      const isSyncing = currentStatus.syncing === true;
      const errorText = String(currentStatus.lastError || '').trim();
      const messageText = String(currentStatus.message || '').trim();

      root.classList.toggle('is-authenticated', authenticated);
      title.textContent = authenticated ? 'Supabase включен' : 'Синхронизация';
      subtitle.textContent = authenticated
        ? (email || 'Пользователь авторизован')
        : 'Локальное хранение';

      if (signedOut) signedOut.hidden = authenticated;
      if (signedIn) signedIn.hidden = !authenticated;

      if (isSyncing) {
        setStatusText('Синхронизация...');
      } else if (errorText) {
        setStatusText(errorText, true);
      } else if (messageText) {
        setStatusText(messageText);
      } else if (authenticated && lastSync) {
        setStatusText(`Последняя синхронизация: ${lastSync}`);
      } else if (authenticated) {
        setStatusText('После входа данные берутся из Supabase и сохраняются туда.');
      } else {
        setStatusText('Без входа все данные остаются только в этом браузере.');
      }
    }

    async function refreshStatus() {
      const response = await sendSupabaseMessage('DUP_SUPABASE_GET_STATUS');
      if (response.success && response.status) {
        renderStatus(response.status);
      } else {
        setStatusText(response.error || 'Не удалось получить статус Supabase.', true);
      }
    }

    async function runAuthAction(action, payload, successCallback) {
      setBusy(busyElements, true);
      setStatusText('Выполняю...');
      try {
        const response = await sendSupabaseMessage(action, payload);
        if (!response.success) {
          renderStatus(response.status || currentStatus || {});
          setStatusText(response.error || 'Операция не выполнена.', true);
          return false;
        }
        if (response.status) renderStatus(response.status);
        if (typeof successCallback === 'function') successCallback();
        return true;
      } finally {
        setBusy(busyElements, false);
      }
    }

    mainButton.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (chevron) chevron.textContent = panel.hidden ? '▾' : '▴';
      if (!panel.hidden) {
        void refreshStatus();
      }
    });

    if (signInButton) {
      signInButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_SIGN_IN', {
          email: emailInput ? emailInput.value : '',
          password: passwordInput ? passwordInput.value : ''
        }, () => {
          if (passwordInput) passwordInput.value = '';
        });
      });
    }

    if (signUpButton) {
      signUpButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_SIGN_UP', {
          email: emailInput ? emailInput.value : '',
          password: passwordInput ? passwordInput.value : ''
        }, () => {
          if (passwordInput) passwordInput.value = '';
        });
      });
    }

    if (signOutButton) {
      signOutButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_SIGN_OUT', {});
      });
    }

    if (syncNowButton) {
      syncNowButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_SYNC_NOW', {});
      });
    }

    if (resetToggle && resetPanel) {
      resetToggle.addEventListener('click', () => {
        resetPanel.hidden = !resetPanel.hidden;
        if (!resetPanel.hidden && resetEmailInput && emailInput && emailInput.value) {
          resetEmailInput.value = emailInput.value;
        }
      });
    }

    if (resetSendButton) {
      resetSendButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_SEND_PASSWORD_RECOVERY', {
          email: resetEmailInput ? resetEmailInput.value : ''
        });
      });
    }

    if (resetConfirmButton) {
      resetConfirmButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_CONFIRM_PASSWORD_RECOVERY', {
          email: resetEmailInput ? resetEmailInput.value : '',
          token: resetCodeInput ? resetCodeInput.value : '',
          password: resetPasswordInput ? resetPasswordInput.value : ''
        }, () => {
          if (resetCodeInput) resetCodeInput.value = '';
          if (resetPasswordInput) resetPasswordInput.value = '';
          if (resetPanel) resetPanel.hidden = true;
        });
      });
    }

    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.action !== 'DUP_SUPABASE_STATUS_CHANGED') return;
      renderStatus(message.status || {});
    });

    void refreshStatus();
  }

  document.addEventListener('DOMContentLoaded', initSupabaseAuthUi);
})();
