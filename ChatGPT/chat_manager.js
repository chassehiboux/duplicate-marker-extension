(() => {
  'use strict';

  if (
    window.top !== window
    || !/^(?:chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)
    || new URLSearchParams(location.search).get('temporary-chat') === 'true'
  ) return;

  const UI_CLASS = 'dup-chatgpt-extension-ui';
  const ACTIONS_CLASS = 'dup-chatgpt-actions';
  const HISTORY_SELECTOR = 'nav[aria-label="История чатов"], nav[aria-label="История чата"], nav[aria-label="Chat history"]';
  let actionBusy = false;
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
    const label = String(link.getAttribute('aria-label') || '').trim();
    if (label) return label;
    const menuButton = link.querySelector('button[aria-label*="настройки диалога" i], button[aria-label*="conversation" i]');
    const aria = String(menuButton?.getAttribute('aria-label') || '');
    const quoted = aria.match(/[«“\"](.+?)[»”\"]/);
    if (quoted) return quoted[1].trim();
    const clone = link.cloneNode(true);
    clone.querySelectorAll('button, .' + ACTIONS_CLASS).forEach((node) => node.remove());
    return String(clone.textContent || '').trim() || 'Без названия';
  }

  function chatRow(link) {
    return link?.closest('[data-sidebar-cycle-item]') || link;
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
    const link = [...(document.querySelector(HISTORY_SELECTOR)?.querySelectorAll('a[href*="/c/"]') || [])]
      .find((candidate) => conversationIdFromLink(candidate) === id);
    const trigger = chatRow(link)?.querySelector('[data-conversation-options-trigger], button[aria-haspopup="menu"]');
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

  async function runNativeConversationAction(id, action) {
    await requestConversation(id, action);
    const removed = await waitForCondition(() => {
      return ![...(document.querySelector(HISTORY_SELECTOR)?.querySelectorAll('a[href*="/c/"]') || [])]
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
    if (!id || button.disabled || actionBusy) return;
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
    actionBusy = true;
    try {
      await runNativeConversationAction(id, action);
      if (conversationIdFromLink({ getAttribute: () => location.pathname }) === id) location.assign('/');
    } catch (error) {
      button.disabled = false;
      window.alert(`Не удалось ${action === 'delete' ? 'удалить' : 'архивировать'} чат. ${error.message}`);
    } finally {
      actionBusy = false;
    }
  }

  function enhanceChatLinks(root = document) {
    const history = root.querySelector(HISTORY_SELECTOR);
    if (!history) return;
    history.querySelectorAll('a[href*="/c/"]').forEach((link) => {
      if (!conversationIdFromLink(link) || link.querySelector(':scope > .' + ACTIONS_CLASS)) return;
      const actions = document.createElement('span');
      actions.className = `${ACTIONS_CLASS} ${UI_CLASS}`;
      const row = chatRow(link);
      if (row !== link) row.classList.add('dup-chatgpt-chat-host');
      const nativeTrailing = link.querySelector(':scope > .trailing, :scope > [class*="trailing"]');
      if (nativeTrailing) nativeTrailing.classList.add('dup-chatgpt-native-actions');
      const archive = iconButton('archive', 'Архивировать чат');
      const remove = iconButton('delete', 'Удалить чат');
      archive.addEventListener('click', runSingleAction);
      remove.addEventListener('click', runSingleAction);
      row.addEventListener('mouseleave', () => {
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
    const nav = document.querySelector(HISTORY_SELECTOR);
    const chats = [];
    const seen = new Set();
    nav?.querySelectorAll('a[href*="/c/"]').forEach((link) => {
      const id = conversationIdFromLink(link);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const project = String(link.getAttribute('href') || '').match(/\/g\/(g-p-[a-zA-Z0-9-]+)(?:\/|$)/);
      chats.push({ id, title: chatTitle(link), projectId: project ? project[1] : '' });
    });
    return chats;
  }

  function loadProjects() {
    const projects = new Map();
    document.querySelector(HISTORY_SELECTOR)?.querySelectorAll('[data-app-action-sidebar-project-id]').forEach((row) => {
      const id = row.getAttribute('data-app-action-sidebar-project-id');
      if (!id || projects.has(id)) return;
      projects.set(id, { id, title: row.getAttribute('data-app-action-sidebar-project-label') || 'Проект', loaded: false });
    });
    return projects;
  }

  async function expandNativeProject(id) {
    const row = [...(document.querySelector(HISTORY_SELECTOR)?.querySelectorAll('[data-app-action-sidebar-project-id]') || [])]
      .find((candidate) => candidate.getAttribute('data-app-action-sidebar-project-id') === id);
    if (!row) throw new Error('Проект не найден в боковой панели.');
    if (row.getAttribute('data-app-action-sidebar-project-collapsed') === 'true') row.click();
    const ready = await waitForCondition(() => {
      const list = row.nextElementSibling?.querySelector('[role="list"]');
      return list && !list.querySelector('[aria-busy="true"], [role="progressbar"]')
        && (list.querySelector('a[href*="/c/"]') || /Нет чатов|No chats/i.test(list.textContent || ''));
    }, 10000);
    if (!ready) throw new Error('ChatGPT не загрузил список проекта. Попробуйте ещё раз.');
    return row;
  }

  async function loadNextHistoryPage() {
    const nav = document.querySelector(HISTORY_SELECTOR);
    const section = nav?.querySelector('[data-app-action-sidebar-section-heading="Recents"]');
    if (!section) throw new Error('Не удалось найти раздел недавних чатов для подгрузки.');
    if (section.getAttribute('data-app-action-sidebar-section-collapsed') === 'true') {
      section.querySelector('[aria-expanded="false"]:not([aria-haspopup])')?.click();
    }
    const items = () => [...section.querySelectorAll('[role="listitem"]')];
    const hasMore = () => items().some((item) => !item.querySelector('a[href*="/c/"]') && item.querySelector('.min-h-px, [role="progressbar"]'));
    if (!hasMore()) return false;
    const scroll = [...nav.querySelectorAll('div')].find((element) => {
      return element.contains(section) && ['auto', 'scroll'].includes(getComputedStyle(element).overflowY);
    });
    if (!scroll) throw new Error('Не удалось найти прокрутку истории чатов.');
    const before = section.querySelectorAll('a[href*="/c/"]').length;
    // Keep the native pagination sentinel visible even behind the manager overlay.
    scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight - 2);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    scroll.scrollTop = scroll.scrollHeight;
    const changed = await waitForCondition(() => {
      // content-visibility changes row heights after scrolling; follow the moving bottom.
      scroll.scrollTop = scroll.scrollHeight;
      return section.querySelectorAll('a[href*="/c/"]').length > before || !hasMore();
    }, 15000);
    if (!changed) throw new Error('ChatGPT не загрузил следующую страницу истории. Нажмите «Продолжить загрузку».');
    return hasMore();
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
    const status = modal.querySelector('.dup-chatgpt-status');
    const bulkButtons = [...modal.querySelectorAll('[data-bulk]')];
    const deleteButton = modal.querySelector('[data-bulk="delete"]');
    let chats = [];
    const projects = loadProjects();
    const outside = { id: '', title: 'Вне проектов', loaded: false };
    const openedGroups = new Set(['']);
    const loadingProjects = new Set();
    const projectErrors = new Map();

    let processing = false;
    const close = () => { if (!processing) modal.remove(); };
    const selectedInputs = () => [...list.querySelectorAll('input[data-chat-id]:checked')];
    const resetBulkDeleteConfirmation = () => {
      delete deleteButton.dataset.confirmed;
      delete deleteButton.dataset.confirmedCount;
      deleteButton.textContent = 'Удалить';
    };
    const updateSelection = (result = '') => {
      resetBulkDeleteConfirmation();
      const selected = selectedInputs().length;
      status.textContent = typeof result === 'string' && result ? result : `Выбрано: ${selected}`;
      bulkButtons.forEach((button) => { button.disabled = selected === 0 || loadingProjects.size > 0; });
      list.querySelectorAll('.dup-chatgpt-group').forEach((group) => {
        const visible = [...group.querySelectorAll('.dup-chatgpt-chat-row:not([hidden]) input[data-chat-id]')];
        const selectAll = group.querySelector('[data-select-all]');
        selectAll.checked = visible.length > 0 && visible.every((input) => input.checked);
        selectAll.indeterminate = visible.some((input) => input.checked) && !selectAll.checked;
        selectAll.disabled = processing || loadingProjects.has(group.dataset.projectId) || visible.length === 0;
        const project = group.dataset.projectId ? projects.get(group.dataset.projectId) : outside;
        group.querySelector('.dup-chatgpt-group-count').textContent = `${visible.length}${project?.loaded ? '' : '+'}`;
      });
    };
    const applySearch = () => {
      const query = search.value.trim().toLocaleLowerCase();
      list.querySelectorAll('.dup-chatgpt-chat-row').forEach((row) => { row.hidden = !row.dataset.search.includes(query); });
      updateSelection();
    };
    const syncChats = () => {
      const merged = new Map(chats.map((chat) => [chat.id, chat]));
      loadVisibleChats().forEach((chat) => merged.set(chat.id, chat));
      chats = [...merged.values()];
      chats.forEach((chat) => {
        if (chat.projectId && !projects.has(chat.projectId)) {
          projects.set(chat.projectId, { id: chat.projectId, title: `Проект ${chat.projectId}`, loaded: false });
        }
      });
    };
    const loadProject = async (project) => {
      if (processing || loadingProjects.has(project.id) || project.loaded) return;
      loadingProjects.add(project.id);
      projectErrors.delete(project.id);
      render();
      try {
        if (project.id) {
          const row = await expandNativeProject(project.id);
          syncChats();
          render();
          while (modal.isConnected) {
            const more = [...(row.nextElementSibling?.querySelectorAll('button') || [])]
              .find((button) => /^(Показать (?:больше|ещё|еще)|Show more)$/i.test(String(button.textContent || '').trim()));
            if (!more) break;
            const before = row.nextElementSibling.querySelectorAll('a[href*="/c/"]').length;
            more.click();
            const changed = await waitForCondition(() => row.nextElementSibling?.querySelectorAll('a[href*="/c/"]').length > before, 15000);
            if (!changed) throw new Error('ChatGPT не загрузил следующую страницу проекта.');
            syncChats();
            render();
          }
        } else {
          let more = true;
          while (more && modal.isConnected) {
            more = await loadNextHistoryPage();
            syncChats();
            render();
          }
        }
        if (!modal.isConnected) return;
        project.loaded = true;
      } catch (error) {
        projectErrors.set(project.id, String(error.message || error));
      } finally {
        loadingProjects.delete(project.id);
        if (modal.isConnected) render();
      }
    };
    const render = () => {
      const selectedIds = new Set(selectedInputs().map((input) => input.dataset.chatId));
      list.replaceChildren();
      [...projects.values(), outside].forEach((project) => {
        const group = document.createElement('details');
        group.className = 'dup-chatgpt-group';
        group.dataset.projectId = project.id;
        group.open = openedGroups.has(project.id);
        const summary = document.createElement('summary');
        summary.className = 'dup-chatgpt-group-heading';
        const heading = document.createElement('span');
        heading.textContent = project.title;
        const count = document.createElement('span');
        count.className = 'dup-chatgpt-group-count';
        summary.append(heading, count);
        const selectLabel = document.createElement('label');
        selectLabel.className = 'dup-chatgpt-select-all';
        const selectAll = document.createElement('input');
        selectAll.type = 'checkbox';
        selectAll.dataset.selectAll = '';
        selectAll.setAttribute('aria-label', `Выбрать все: ${project.title}`);
        selectLabel.append(selectAll, document.createTextNode('Выбрать все'));
        group.append(summary, selectLabel);
        selectAll.addEventListener('change', () => {
          group.querySelectorAll('.dup-chatgpt-chat-row:not([hidden]) input[data-chat-id]').forEach((input) => { input.checked = selectAll.checked; });
          updateSelection();
        });
        const groupChats = chats.filter((chat) => chat.projectId === project.id);
        groupChats.forEach((chat) => {
          const row = document.createElement('label');
          row.className = 'dup-chatgpt-chat-row';
          row.dataset.search = chat.title.toLocaleLowerCase();
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.chatId = chat.id;
          checkbox.checked = selectedIds.has(chat.id);
          const title = document.createElement('span');
          title.className = 'dup-chatgpt-chat-title';
          title.textContent = chat.title;
          row.append(checkbox, title);
          group.append(row);
        });
        const error = projectErrors.get(project.id);
        if (!groupChats.length || loadingProjects.has(project.id) || error) {
          const empty = document.createElement('div');
          empty.className = 'dup-chatgpt-group-note';
          empty.textContent = loadingProjects.has(project.id) ? 'Загружаем все чаты… Список пополняется автоматически.'
            : error || (project.loaded ? 'Нет доступных чатов' : 'Раскройте проект, чтобы загрузить его чаты');
          group.append(empty);
          if (error) {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'dup-chatgpt-button';
            retry.textContent = 'Продолжить загрузку';
            retry.addEventListener('click', () => loadProject(project));
            group.append(retry);
          }
        }
        group.addEventListener('toggle', () => {
          if (!group.isConnected) return;
          if (group.open) {
            openedGroups.add(project.id);
            if (!projectErrors.has(project.id)) loadProject(project);
          } else openedGroups.delete(project.id);
        });
        list.append(group);
      });
      applySearch();
    };

    modal.querySelector('[data-close]').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    list.addEventListener('change', updateSelection);
    search.addEventListener('input', applySearch);
    bulkButtons.forEach((button) => button.addEventListener('click', async () => {
      const selected = selectedInputs();
      const action = button.dataset.bulk;
      if (!selected.length || actionBusy || loadingProjects.size) return;
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
      actionBusy = true;
      processing = true;
      search.disabled = true;
      list.querySelectorAll('input').forEach((input) => { input.disabled = true; });
      let completed = 0;
      const failed = [];
      for (const input of selected) {
        status.textContent = `Обработано: ${completed} из ${selected.length}`;
        try {
          await runNativeConversationAction(input.dataset.chatId, action);
          chats = chats.filter((chat) => chat.id !== input.dataset.chatId);
          input.closest('.dup-chatgpt-chat-row')?.remove();
        } catch (error) {
          failed.push(String(error.message || error));
        }
        completed += 1;
      }
      search.disabled = false;
      list.querySelectorAll('input').forEach((input) => { input.disabled = false; });
      actionBusy = false;
      processing = false;
      updateSelection(failed.length ? `Готово: ${completed - failed.length}; ошибок: ${failed.length}. ${failed[0]}` : `Готово: ${completed}`);
      enhanceChatLinks();
    }));

    try {
      syncChats();
      render();
      search.focus();
    } catch (error) {
      list.innerHTML = `<div class="dup-chatgpt-empty">Не удалось загрузить список. ${String(error.message || '')}</div>`;
    }
  }

  function addManagerTrigger() {
    const closeButtons = [...document.querySelectorAll('button')].filter((button) => {
      const label = String(button.getAttribute('aria-label') || '').toLocaleLowerCase();
      return ['закрыть боковую панель', 'скрыть боковую панель', 'close sidebar', 'hide sidebar'].includes(label)
        || (button.matches('[data-app-shell-sidebar-trigger]') && button.getAttribute('aria-expanded') === 'true');
    });
    closeButtons.forEach((closeButton) => {
      if (!closeButton.parentElement || closeButton.parentElement.querySelector('.dup-chatgpt-manager-trigger')) return;
      const trigger = iconButton('manage', 'Массовое управление чатами');
      trigger.classList.add('dup-chatgpt-manager-trigger', UI_CLASS);
      trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openManager(); });
      closeButton.before(trigger);
    });
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
