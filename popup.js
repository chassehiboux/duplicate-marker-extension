document.addEventListener('DOMContentLoaded', () => {
  const inputsSearch = [
    'list_DebtID', 'list_EDocID', 'list_AccAddress_AccountNumber',
    'list_Individual_FullName', 'list_CaseNumber', 'list_EDNumber'
  ];
  const inputsStrict = ['strict_CaseNumber', 'strict_EDNumber'];
  
  const inputCopyMode = document.getElementById('setting_copy_mode');
  const btnCheck = document.getElementById('btn-check');
  const btnClear = document.getElementById('btn-clear');

  // 1. ЗАГРУЗКА НАСТРОЕК
  chrome.storage.local.get(null, (items) => {
    // Поля поиска
    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      if (items[id] === undefined) el.checked = true;
      else el.checked = items[id];
    });

    // Строгий режим (+ЛС)
    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      if (items[id] !== undefined) el.checked = items[id];
    });

    // Турбо режим
    if (items['setting_copy_mode'] !== undefined) {
      inputCopyMode.checked = items['setting_copy_mode'];
    }
  });

  // 2. СОХРАНЕНИЕ "ТУРБО" РЕЖИМА (Глобально)
  inputCopyMode.addEventListener('change', () => {
    // Просто сохраняем в storage.
    // content.js во ВСЕХ вкладках увидит это через chrome.storage.onChanged
    chrome.storage.local.set({ 'setting_copy_mode': inputCopyMode.checked });
  });

  // 3. ПОИСК ДУБЛИКАТОВ (Только на текущей вкладке)
  async function runSearch(action) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const settings = {};
    const activeFields = [];
    const strictOptions = {};

    inputsSearch.forEach(id => {
      const el = document.getElementById(id);
      settings[id] = el.checked;
      if (el.checked) activeFields.push(id);
    });

    inputsStrict.forEach(id => {
      const el = document.getElementById(id);
      settings[id] = el.checked;
      const fieldName = id.replace('strict_', 'list_');
      strictOptions[fieldName] = el.checked;
    });

    chrome.storage.local.set(settings);

    // Отправляем команду. Scripting.executeScript больше не нужен, 
    // так как скрипт уже там благодаря manifest.json
    chrome.tabs.sendMessage(tab.id, {
      action: action,
      fields: activeFields,
      strictMode: strictOptions
    }).catch(err => {
        // Если скрипт вдруг не загрузился (например на странице настроек Chrome), игнорируем
        console.log("Скрипт не готов или страница служебная");
    });
  }

  btnCheck.addEventListener('click', () => runSearch('highlight'));
  btnClear.addEventListener('click', () => runSearch('clear'));
});