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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    const syncTestButton = $('supabase-auth-sync-test');
    const syncFlowNode = $('supabase-sync-flow');
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
      syncTestButton,
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

    function getRealtimeStatusText(status) {
      if (!status || status.authenticated !== true) return '';
      if (status.realtimeConnected === true) return 'Realtime: подключен';
      const realtimeStatus = String(status.realtimeStatus || '').trim();
      if (realtimeStatus === 'unsupported') return 'Realtime: недоступен, резервная проверка раз в минуту';
      if (realtimeStatus === 'error') return 'Realtime: ошибка, резервная проверка раз в минуту';
      if (realtimeStatus === 'disconnected') return 'Realtime: переподключение, резервная проверка раз в минуту';
      return 'Realtime: ожидание, резервная проверка раз в минуту';
    }

    function formatOutboxSize(value) {
      const numberValue = Number(value || 0);
      return Number.isFinite(numberValue) ? String(Math.max(0, Math.trunc(numberValue))) : '0';
    }

    function buildLastTestText(status) {
      const testStatus = String(status.lastSyncTestStatus || '').trim();
      if (!testStatus) return '';

      if (testStatus === 'running') {
        return 'Тест синхронизации выполняется...';
      }

      const testAt = formatSyncTime(status.lastSyncTestAt);
      const testMessage = String(status.lastSyncTestMessage || '').trim();
      const prefix = testAt ? `${testAt} — ` : '';
      return `${prefix}${testMessage || (testStatus === 'success' ? 'Тест пройден.' : 'Тест не пройден.')}`;
    }

    function buildSignedInStatusText(status) {
      const lines = ['Состояние:'];
      const lastPull = formatSyncTime(status.lastPullAt);
      const lastPush = formatSyncTime(status.lastPushAt);
      const outboxSize = Number(status.outboxSize || 0);
      const pullError = String(status.lastPullError || '').trim();
      const pushError = String(status.lastPushError || '').trim();
      const generalError = String(status.lastError || '').trim();
      const outboxError = String(status.outboxLastError || '').trim();
      const syncHealthMessage = String(status.syncHealthMessage || '').trim();
      const revisionStateLabel = String(status.revisionStateLabel || '').trim() || 'ожидание данных';
      const lastTestText = buildLastTestText(status);
      const messageText = String(status.message || '').trim();

      lines.push(`- Состояние синхронизации: ${revisionStateLabel}`);
      lines.push(`- ${getRealtimeStatusText(status)}`);
      lines.push(`- Последний pull: ${lastPull || 'еще не выполнялся'}`);
      lines.push(`- Последний push: ${lastPush || 'еще не выполнялся'}`);
      lines.push(`- Очередь изменений: ${formatOutboxSize(outboxSize)}`);
      if (lastTestText) lines.push(`- Последний тест: ${lastTestText}`);

      if (pushError) lines.push(`- REST push: ${pushError}`);
      if (pullError) lines.push(`- REST pull: ${pullError}`);
      if (!pushError && !pullError && generalError) lines.push(`- Последняя ошибка: ${generalError}`);
      if (outboxError && outboxError !== pushError) lines.push(`- Ошибка очереди: ${outboxError}`);
      if (
        syncHealthMessage
        && syncHealthMessage !== pushError
        && syncHealthMessage !== pullError
        && syncHealthMessage !== generalError
      ) {
        lines.push(`- Диагностика: ${syncHealthMessage}`);
      }
      if (outboxSize > 0) lines.push('- Данные будут отправлены повторно автоматически');
      if (messageText && !pushError && !pullError && !generalError && !syncHealthMessage) lines.push(messageText);

      return lines.join('\n');
    }

    function renderSyncFlow(flow, authenticated) {
      if (!syncFlowNode) return;
      const steps = flow && Array.isArray(flow.steps) ? flow.steps : [];
      if (!authenticated || !steps.length) {
        syncFlowNode.hidden = true;
        syncFlowNode.innerHTML = '';
        return;
      }

      const titleText = String(flow.title || 'Синхронизация Supabase').trim();
      const rows = steps.map((step) => {
        const status = String(step.status || 'pending');
        const detail = String(step.detail || '').trim();
        return `
          <div class="supabase-sync-step is-${escapeHtml(status)}">
            <span class="supabase-sync-step-dot" aria-hidden="true"></span>
            <span class="supabase-sync-step-text">
              <span class="supabase-sync-step-label">${escapeHtml(step.label || '')}</span>
              ${detail ? `<span class="supabase-sync-step-detail">${escapeHtml(detail)}</span>` : ''}
            </span>
          </div>
        `;
      }).join('');

      syncFlowNode.hidden = false;
      syncFlowNode.innerHTML = `
        <div class="supabase-sync-flow-title">${escapeHtml(titleText)}</div>
        <div class="supabase-sync-flow-steps">${rows}</div>
      `;
    }

    function renderStatus(status) {
      currentStatus = status || {};
      const authenticated = currentStatus.authenticated === true;
      const email = String(currentStatus.email || '').trim();
      const isSyncing = currentStatus.syncing === true;
      const errorText = String(currentStatus.lastError || '').trim();
      const healthText = String(currentStatus.syncHealthMessage || '').trim();
      const messageText = String(currentStatus.message || '').trim();
      const outboxSize = Number(currentStatus.outboxSize || 0);

      root.classList.toggle('is-authenticated', authenticated);
      root.classList.toggle('has-pending', authenticated && outboxSize > 0);
      root.classList.toggle('is-syncing', authenticated && isSyncing);
      title.textContent = authenticated ? 'Supabase включен' : 'Синхронизация';
      subtitle.textContent = authenticated
        ? (email || 'Пользователь авторизован')
        : 'Локальное хранение';

      if (signedOut) signedOut.hidden = authenticated;
      if (signedIn) signedIn.hidden = !authenticated;

      if (authenticated) {
        renderSyncFlow(currentStatus.syncFlow || {}, true);
        setStatusText(
          buildSignedInStatusText({
            ...currentStatus,
            message: isSyncing ? 'Синхронизация...' : messageText
          }),
          !!errorText || !!healthText
        );
      } else {
        renderSyncFlow(null, false);
        const lines = [];
        if (errorText) {
          lines.push(errorText);
        } else if (messageText) {
          lines.push(messageText);
        }
        lines.push('Без входа все данные остаются только в этом браузере.');
        setStatusText(lines.join('\n\n'), !!errorText);
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
          const statusError = response.status
            ? String(
              response.status.lastError
              || response.status.syncHealthMessage
              || response.status.message
              || ''
            ).trim()
            : '';
          setStatusText(response.error || statusError || 'Операция не выполнена.', true);
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

    if (syncTestButton) {
      syncTestButton.addEventListener('click', () => {
        void runAuthAction('DUP_SUPABASE_SYNC_TEST', {});
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
