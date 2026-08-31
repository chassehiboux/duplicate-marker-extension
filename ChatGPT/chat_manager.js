(() => {
  'use strict';

  if (
    window.top !== window
    || !/^(?:chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)
    || new URLSearchParams(location.search).get('temporary-chat') === 'true'
  ) return;

  const UI_CLASS = 'dup-chatgpt-extension-ui';
  const ACTIONS_CLASS = 'dup-chatgpt-actions';
  const ICONS = {
    archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16v12H4z"/><path d="M3 4h18v3H3zM9 11h6"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg>',
    confirm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    manage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  function conversationIdFromLink(link) {
    const match = String(link.getAttribute('href') || '').match(/(?:^|\/)c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : '';
  }

  function chatTitle(link) {
    const menuButton = link.querySelector('button[aria-label*="настройки диалога" i], button[aria-label*="conversation" i]');
    const aria = String(menuButton?.getAttribute('aria-label') || '');
    const quoted = aria.match(/[«“\"](.+?)[»”\"]/);
    if (quoted) return quoted[1].trim();
    const clone = link.cloneNode(true);
    clone.querySelectorAll('button, .' + ACTIONS_CLASS).forEach((node) => node.remove());
    return String(clone.textContent || '').trim() || 'Без названия';
  }

  function nativeActionLabel(action) {
    return action === 'delete'
      ? ['Удалить', 'Delete']
      : ['Архивировать', 'Archive'];
  }

  async function waitForElement(getElement, timeout = 3000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const element = getElement();
      if (element) return element;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return null;
  }

  async function waitForCondition(check, timeout = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      if (check()) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  async function requestConversation(id, action) {
    const link = [...document.querySelectorAll('a[href*="/c/"]')]
      .find((candidate) => conversationIdFromLink(candidate) === id);
    const trigger = link?.querySelector('[data-conversation-options-trigger], button[aria-haspopup="menu"]');
    if (!trigger) throw new Error('Не удалось найти штатное меню чата.');
    trigger.click();
    const menuItem = await waitForElement(() => {
      const labels = nativeActionLabel(action);
      return [...document.querySelectorAll('[role="menuitem"]')].find((item) => labels.includes(String(item.textContent || '').trim()));
    });
    if (!menuItem) throw new Error('В штатном меню ChatGPT нет нужного действия.');
    menuItem.click();
    if (action !== 'delete') return;

    const confirmButton = await waitForElement(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find((candidate) => {
        const title = String(candidate.querySelector('h2')?.textContent || '').trim();
        return title === 'Удалить чат?' || title === 'Delete chat?';
      });
      return dialog?.querySelector('[data-testid="delete-conversation-confirm-button"]')
        || [...(dialog?.querySelectorAll('button') || [])].find((button) => ['Удалить', 'Delete'].includes(String(button.textContent || '').trim()));
    });
    if (!confirmButton) throw new Error('Не удалось найти подтверждение «Удалить чат?».');
    confirmButton.click();

    const dialogClosed = await waitForCondition(() => {
      return ![...document.querySelectorAll('[role="dialog"]')].some((candidate) => {
        const title = String(candidate.querySelector('h2')?.textContent || '').trim();
        return title === 'Удалить чат?' || title === 'Delete chat?';
      });
    });
    if (!dialogClosed) throw new Error('Окно подтверждения удаления не закрылось.');
  }

  function removeConversationLinks(id) {
    document.querySelectorAll('a[href*="/c/"]').forEach((candidate) => {
      if (conversationIdFromLink(candidate) === id) candidate.remove();
    });
  }

  async function runNativeConversationAction(id, action) {
    await requestConversation(id, action);
    const removed = await waitForCondition(() => {
      return ![...document.querySelectorAll('a[href*="/c/"]')]
        .some((candidate) => conversationIdFromLink(candidate) === id);
    }, 5000);
    if (!removed) throw new Error(`ChatGPT не подтвердил ${action === 'delete' ? 'удаление' : 'архивирование'} чата.`);
  }

  function iconButton(action, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dup-chatgpt-icon-button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = ICONS[action];
    return button;
  }

  async function runSingleAction(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const link = button.closest('a[href*="/c/"]');
    const id = link && conversationIdFromLink(link);
    if (!id || button.disabled) return;
    const action = button.dataset.action === 'confirm-delete' ? 'delete' : button.dataset.action;
    const title = chatTitle(link);
    if (action === 'delete' && button.dataset.action !== 'confirm-delete') {
      const actions = button.closest('.' + ACTIONS_CLASS);
      actions.dataset.confirmingDelete = 'true';
      actions.querySelectorAll('button').forEach((item) => { item.hidden = item !== button; });
      button.dataset.action = 'confirm-delete';
      button.setAttribute('aria-label', `Подтвердить удаление чата «${title}»`);
      button.title = 'Подтвердить удаление';
      button.innerHTML = ICONS.confirm;
      return;
    }
    button.disabled = true;
    try {
      await runNativeConversationAction(id, action);
      if (conversationIdFromLink({ getAttribute: () => location.pathname }) === id) location.assign('/');
    } catch (error) {
      button.disabled = false;
      window.alert(`Не удалось ${action === 'delete' ? 'удалить' : 'архивировать'} чат. ${error.message}`);
    }
  }

  function enhanceChatLinks(root = document) {
    const history = root.querySelector('nav[aria-label="История чата"], nav[aria-label="Chat history"]');
    if (!history) return;
    history.querySelectorAll('a[href*="/c/"]').forEach((link) => {
      if (!conversationIdFromLink(link) || link.querySelector(':scope > .' + ACTIONS_CLASS)) return;
      const actions = document.createElement('span');
      actions.className = `${ACTIONS_CLASS} ${UI_CLASS}`;
      const nativeTrailing = link.querySelector(':scope > .trailing, :scope > [class*="trailing"]');
      if (nativeTrailing) nativeTrailing.classList.add('dup-chatgpt-native-actions');
      const archive = iconButton('archive', 'Архивировать чат');
      const remove = iconButton('delete', 'Удалить чат');
      archive.addEventListener('click', runSingleAction);
      remove.addEventListener('click', runSingleAction);
      link.addEventListener('mouseleave', () => {
        if (actions.dataset.confirmingDelete !== 'true') return;
        delete actions.dataset.confirmingDelete;
        archive.hidden = false;
        remove.hidden = false;
        remove.dataset.action = 'delete';
        remove.setAttribute('aria-label', 'Удалить чат');
        remove.title = 'Удалить чат';
        remove.innerHTML = ICONS.delete;
      });
      actions.append(archive, remove);
      if (nativeTrailing) nativeTrailing.before(actions);
      else link.append(actions);
    });
  }

  function loadVisibleChats() {
    const nav = document.querySelector('nav[aria-label="История чата"], nav[aria-label="Chat history"]');
    const chats = [];
    const seen = new Set();
    nav?.querySelectorAll('a[href*="/c/"]').forEach((link) => {
      const id = conversationIdFromLink(link);
      if (!id || seen.has(id)) return;
      seen.add(id);
      chats.push({ id, title: chatTitle(link) });
    });
    return chats;
  }

  function createModal() {
    const backdrop = document.createElement('div');
    backdrop.className = `dup-chatgpt-modal-backdrop ${UI_CLASS}`;
    backdrop.innerHTML = `
      <section class="dup-chatgpt-modal" role="dialog" aria-modal="true" aria-labelledby="dup-chatgpt-title">
        <header class="dup-chatgpt-modal-header">
          <h2 id="dup-chatgpt-title">Управление чатами</h2>
          <button type="button" class="dup-chatgpt-icon-button" data-close aria-label="Закрыть">${ICONS.close}</button>
        </header>
        <div class="dup-chatgpt-modal-toolbar">
          <input class="dup-chatgpt-search" type="search" placeholder="Поиск по названию" aria-label="Поиск по названию чата">
          <label class="dup-chatgpt-select-all"><input type="checkbox" data-select-all> Выбрать все</label>
        </div>
        <div class="dup-chatgpt-chat-list"><div class="dup-chatgpt-empty">Загружаем чаты…</div></div>
        <footer class="dup-chatgpt-modal-footer">
          <span class="dup-chatgpt-status">Выбрано: 0</span>
          <button type="button" class="dup-chatgpt-button" data-bulk="archive" disabled>Архивировать</button>
          <button type="button" class="dup-chatgpt-button dup-chatgpt-button--danger" data-bulk="delete" disabled>Удалить</button>
        </footer>
      </section>`;
    return backdrop;
  }

  async function openManager() {
    if (document.querySelector('.dup-chatgpt-modal-backdrop')) return;
    const modal = createModal();
    document.body.append(modal);
    const list = modal.querySelector('.dup-chatgpt-chat-list');
    const search = modal.querySelector('.dup-chatgpt-search');
    const selectAll = modal.querySelector('[data-select-all]');
    const status = modal.querySelector('.dup-chatgpt-status');
    const bulkButtons = [...modal.querySelectorAll('[data-bulk]')];
    const deleteButton = modal.querySelector('[data-bulk="delete"]');
    let chats = [];

    const close = () => modal.remove();
    const selectedInputs = () => [...list.querySelectorAll('input[data-chat-id]:checked')];
    const resetBulkDeleteConfirmation = () => {
      delete deleteButton.dataset.confirmed;
      delete deleteButton.dataset.confirmedCount;
      deleteButton.textContent = 'Удалить';
    };
    const updateSelection = () => {
      resetBulkDeleteConfirmation();
      const selected = selectedInputs().length;
      const visible = [...list.querySelectorAll('.dup-chatgpt-chat-row:not([hidden]) input[data-chat-id]')];
      status.textContent = `Выбрано: ${selected}`;
      bulkButtons.forEach((button) => { button.disabled = selected === 0; });
      selectAll.checked = visible.length > 0 && visible.every((input) => input.checked);
      selectAll.indeterminate = visible.some((input) => input.checked) && !selectAll.checked;
    };
    const render = () => {
      list.replaceChildren();
      chats.forEach((chat) => {
        const row = document.createElement('label');
        row.className = 'dup-chatgpt-chat-row';
        row.dataset.search = chat.title.toLocaleLowerCase();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.chatId = chat.id;
        const title = document.createElement('span');
        title.className = 'dup-chatgpt-chat-title';
        title.textContent = chat.title;
        row.append(checkbox, title);
        list.append(row);
      });
      if (!chats.length) list.innerHTML = '<div class="dup-chatgpt-empty">Чаты не найдены</div>';
      updateSelection();
    };

    modal.querySelector('[data-close]').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    list.addEventListener('change', updateSelection);
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      list.querySelectorAll('.dup-chatgpt-chat-row').forEach((row) => { row.hidden = !row.dataset.search.includes(query); });
      updateSelection();
    });
    selectAll.addEventListener('change', () => {
      list.querySelectorAll('.dup-chatgpt-chat-row:not([hidden]) input[data-chat-id]').forEach((input) => { input.checked = selectAll.checked; });
      updateSelection();
    });
    bulkButtons.forEach((button) => button.addEventListener('click', async () => {
      const selected = selectedInputs();
      const action = button.dataset.bulk;
      if (!selected.length) return;
      if (action === 'delete' && button.dataset.confirmed !== 'true') {
        button.dataset.confirmed = 'true';
        button.dataset.confirmedCount = String(selected.length);
        button.textContent = `Подтвердить удаление (${selected.length})`;
        return;
      }
      if (action === 'delete' && button.dataset.confirmedCount !== String(selected.length)) {
        resetBulkDeleteConfirmation();
        return;
      }
      bulkButtons.forEach((item) => { item.disabled = true; });
      search.disabled = true;
      selectAll.disabled = true;
      let completed = 0;
      const failed = [];
      for (const input of selected) {
        status.textContent = `Обработано: ${completed} из ${selected.length}`;
        try {
          await runNativeConversationAction(input.dataset.chatId, action);
          chats = chats.filter((chat) => chat.id !== input.dataset.chatId);
          input.closest('.dup-chatgpt-chat-row')?.remove();
        } catch (error) {
          failed.push(input.dataset.chatId);
        }
        completed += 1;
      }
      search.disabled = false;
      selectAll.disabled = false;
      status.textContent = failed.length ? `Готово: ${completed - failed.length}; ошибок: ${failed.length}` : `Готово: ${completed}`;
      updateSelection();
      enhanceChatLinks();
    }));

    try {
      chats = loadVisibleChats();
      render();
      search.focus();
    } catch (error) {
      list.innerHTML = `<div class="dup-chatgpt-empty">Не удалось загрузить список. ${String(error.message || '')}</div>`;
    }
  }

  function addManagerTrigger() {
    if (document.querySelector('.dup-chatgpt-manager-trigger')) return;
    const closeButton = [...document.querySelectorAll('button')].find((button) => {
      const label = String(button.getAttribute('aria-label') || '').toLocaleLowerCase();
      return label === 'закрыть боковую панель' || label === 'close sidebar';
    });
    if (!closeButton?.parentElement) return;
    const trigger = iconButton('manage', 'Массовое управление чатами');
    trigger.classList.add('dup-chatgpt-manager-trigger', UI_CLASS);
    trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openManager(); });
    closeButton.before(trigger);
  }

  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceChatLinks();
      addManagerTrigger();
    });
  };
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
