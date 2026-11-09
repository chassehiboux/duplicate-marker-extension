'use strict';

const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync, readSync, rmSync, writeSync } = require('node:fs');
const path = require('node:path');

const FRAME_LIMIT = 1024 * 1024;
const WINDOW_ERROR = 'Откройте одно локальное окно 1С:ITIL и выберите Service Desk.';
const CARD_ERROR = 'В локальной 1С:ITIL не открылась карточка с нужным номером.';
const ACTION_LABELS = {
  'list-windows': 'Проверка окна 1С',
  'focus-window': 'Переключение на окно 1С',
  minimize: 'Сворачивание окна 1С',
  restore: 'Восстановление окна 1С',
  snapshot: 'Чтение интерфейса 1С',
  'clipboard-set': 'Копирование номера ITIL',
  press: 'Ввод с клавиатуры',
  'mouse-click': 'Нажатие в окне 1С'
};

function readBytes(size) {
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const count = readSync(0, bytes, offset, size - offset);
    if (!count) throw new Error('Получено неполное сообщение от расширения.');
    offset += count;
  }
  return bytes;
}

function readMessage() {
  const size = readBytes(4).readUInt32LE();
  if (!size || size > 4096) throw new Error('Недопустимый размер запроса от расширения.');
  return JSON.parse(readBytes(size).toString('utf8'));
}

function writeMessage(response) {
  let payload = Buffer.from(JSON.stringify(response));
  if (payload.length >= FRAME_LIMIT) {
    payload = Buffer.from(JSON.stringify({ success: false, error: 'Текст карточки 1С превышает размер ответа.' }));
  }
  const frame = Buffer.allocUnsafe(payload.length + 4);
  frame.writeUInt32LE(payload.length);
  payload.copy(frame, 4);
  let offset = 0;
  while (offset < frame.length) offset += writeSync(1, frame, offset, frame.length - offset);
}

function flatten(node) {
  return [node, ...(node.children || []).flatMap(flatten)];
}

function readDocumentLines(node) {
  if (node.role === 'link') return node.name ? [node.name] : [];
  if (node.role === 'textfield' || node.role === 'statictext') {
    const text = node.name || node.value;
    return typeof text === 'string' && text.trim() ? [text.trim()] : [];
  }
  const children = node.children || [];
  const lines = children.flatMap(readDocumentLines);
  if (node.role === 'group' && children.every((child) => ['textfield', 'statictext', 'link'].includes(child.role))) {
    return lines.length ? [lines.join(' ')] : [''];
  }
  return lines;
}

function findField(nodes, name) {
  const matches = nodes.filter((node) => node.role === 'textfield' && node.name === name
    && !node.states?.includes('offscreen'));
  return matches.length === 1 ? matches[0] : null;
}

function findDeskSearch(nodes) {
  if (!nodes.some((node) => node.role === 'group' && node.name === 'Service Desk')) return null;
  const labels = nodes.filter((node) => node.role === 'statictext' && node.name === 'Найти:' && node.bounds);
  const fields = nodes.filter((node) => node.role === 'textfield' && node.bounds
    && !node.states?.includes('offscreen') && labels.some(({ bounds }) => (
      node.bounds.x >= bounds.x + bounds.width
      && bounds.y >= node.bounds.y
      && bounds.y < node.bounds.y + node.bounds.height
    )));
  return fields.length === 1 ? fields[0] : null;
}

function readCard(nodes, number) {
  const cardNumber = findField(nodes, 'Номер:')?.value;
  if (cardNumber && cardNumber !== number) throw new Error(CARD_ERROR);
  if (cardNumber !== number) return null;

  const docs = nodes.filter((node) => node.role === 'document' && !node.states?.includes('offscreen'));
  const solution = findField(nodes, 'Решение обращения:');
  const additional = findField(nodes, 'Дополнительная информация:');
  if (docs.length !== 1 || !solution || !additional) return null;
  const requestText = readDocumentLines(docs[0]).join('\n').trim();
  if (!requestText) return null;

  return {
    requestText,
    solutionText: solution.value || '',
    additionalInfoText: additional.value || ''
  };
}

function findCardClose(nodes) {
  const header = nodes.find((node) => node.children?.some((child) => child.name === 'Получить ссылку...'));
  return header?.children.find((node) => node.role === 'button' && node.name === 'Закрыть' && node.bounds);
}

function targetTimeout(value) {
  return Number.isFinite(value) ? Math.max(1000, Math.min(45000, value)) : 30000;
}

async function poll(snapshot, find, timeoutMs, errorMessage) {
  const deadline = Date.now() + timeoutMs;
  do {
    const nodes = snapshot();
    const match = nodes && find(nodes);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 300));
  } while (Date.now() < deadline);
  throw new Error(errorMessage);
}

async function searchItil(run, message) {
  const number = message.itilNumber;
  if (typeof number !== 'string' || !/^\d{1,8}-\d{1,30}$/.test(number)) {
    throw new Error('Локальному поиску нужен полный номер заявки ITIL.');
  }
  const leaveOpen = message.leaveOpen === true;
  const allWindows = run('list-windows');
  const candidates = allWindows.filter((window) => window.app_name.toLowerCase() === '1cv8c.exe'
    && /^1С:ITIL\b/i.test(window.title));
  if (candidates.length !== 1) throw new Error(WINDOW_ERROR);
  const target = candidates[0];
  const windowArgs = ['--window-id', target.id];
  const originalFocus = allWindows.find((window) => window.is_focused && window.app_name.toLowerCase() === 'msedge.exe');
  let usedManualFocus = false;
  let snapshotBounds;

  function snapshot() {
    try {
      const result = run('snapshot', ...windowArgs, '--max-depth', '44', '--timeout-ms', '12000', '--include-bounds', '--compact');
      if (!result.complete || !result.tree?.bounds) return null;
      snapshotBounds = result.tree.bounds;
      return flatten(result.tree);
    } catch (error) {
      if (error.code === 'TIMEOUT' && error.safeToRetry) return null;
      throw error;
    }
  }

  function getTargetWindow() {
    const current = run('list-windows', '--app', '1cv8c.exe').find((window) => window.id === target.id
      && window.process_instance === target.process_instance);
    if (!current) throw new Error('Окно 1С:ITIL закрылось во время поиска.');
    return current;
  }

  async function focusTarget(current = target) {
    if (current.is_focused) return;
    if (current.minimized) {
      run('restore', ...windowArgs);
      if (getTargetWindow().is_focused) return;
    }
    try {
      run('focus-window', ...windowArgs);
    } catch (error) {
      if (error.code !== 'ACTION_FAILED' || !error.safeToRetry) throw error;
      const current = getTargetWindow();
      if (current.is_focused) return;
      if (!current.minimized) run('minimize', ...windowArgs);
      run('restore', ...windowArgs);
      if (!getTargetWindow().is_focused) {
        await poll(getTargetWindow, (window) => window.is_focused, 15000,
          'Windows не вывела 1С:ITIL на передний план. Повторите запуск и сразу переключитесь на Service Desk.');
        usedManualFocus = true;
      }
    }
  }

  function click(node, label) {
    const current = getTargetWindow();
    const { x, y, width, height } = node.bounds;
    const center = { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
    const area = current.bounds;
    const sameBounds = ['x', 'y', 'width', 'height'].every((key) => area[key] === snapshotBounds[key]);
    if (!current.is_focused || !sameBounds || center.x < area.x || center.x >= area.x + area.width
      || center.y < area.y || center.y >= area.y + area.height) {
      const error = new Error(label + '. Окно 1С:ITIL потеряло фокус или переместилось.');
      error.safeToRetry = true;
      throw error;
    }
    try {
      run('--headed', 'mouse-click', '--xy=' + center.x + ',' + center.y);
    } catch (error) {
      error.message = label + '. ' + error.message;
      throw error;
    }
  }

  async function closeCard(close) {
    const label = 'Закрытие карточки ITIL';
    try {
      click(close, label);
    } catch (error) {
      if (!error.safeToRetry && error.code !== 'ACTION_FAILED') throw error;
      if (error.safeToRetry) await focusTarget(getTargetWindow());
      const state = await poll(snapshot, (nodes) => {
        if (findDeskSearch(nodes)) return { closed: true };
        if (!error.safeToRetry || findField(nodes, 'Номер:')?.value !== number) return null;
        const button = findCardClose(nodes);
        return button && { button };
      }, 5000, error.message);
      if (!state.closed) click(state.button, label);
    }
  }

  try {
    await focusTarget();
    const ready = await poll(snapshot, (nodes) => {
      const field = findDeskSearch(nodes);
      if (field) return { field };
      if (findField(nodes, 'Номер:')?.value !== number) return null;
      if (leaveOpen) return {};
      const data = readCard(nodes, number);
      return data && { data };
    }, 5000, WINDOW_ERROR);
    if (!ready.field) return { success: true, itilNumber: number, ...ready.data };

    click(ready.field, 'Выбор поля поиска Service Desk');
    run('clipboard-set', number);
    run('press', 'ctrl+a', ...windowArgs);
    run('press', 'ctrl+v', ...windowArgs);
    run('press', 'return', ...windowArgs);

    function findResult(nodes) {
      if (findDeskSearch(nodes)?.value !== number) return null;
      const matches = nodes.filter((node) => node.bounds && node.name?.replace(/<[^>]*>/g, '') === number + ' Номер'
        && !node.states?.includes('offscreen'));
      if (matches.length > 1) throw new Error('В 1С найдено несколько строк с одним номером.');
      return matches[0];
    }
    const row = await poll(snapshot, findResult, targetTimeout(message.searchMs),
      'В Service Desk не найдена строка с точным номером ' + number + '.');
    click(row, 'Выбор найденной строки ITIL');
    await poll(snapshot, (nodes) => findResult(nodes)?.states?.includes('focused'), 5000,
      'В 1С не удалось выбрать строку с точным номером.');
    run('press', 'return', ...windowArgs);

    const card = await poll(snapshot, (nodes) => {
      if (leaveOpen && findField(nodes, 'Номер:')?.value === number) return {};
      const data = readCard(nodes, number);
      const close = findCardClose(nodes);
      return data && close ? { data, close } : null;
    }, targetTimeout(message.cardMs), CARD_ERROR);
    if (card.close) await closeCard(card.close);
    return { success: true, itilNumber: number, ...card.data };
  } finally {
    if (!leaveOpen && originalFocus && !usedManualFocus) {
      try {
        if (getTargetWindow().is_focused) run('focus-window', '--window-id', originalFocus.id);
      } catch {
        // A user can close or switch windows while the request finishes.
      }
    }
  }
}

async function main() {
  const statePath = path.join(__dirname, 'state-' + randomUUID());
  let response;
  try {
    const message = readMessage();
    const agentPath = readFileSync(path.join(__dirname, 'agent-path.txt'), 'utf8').trim();
    const env = { ...process.env, AGENT_DESKTOP_HOME: statePath };
    const run = (...args) => {
      const output = spawnSync(agentPath, args, { encoding: 'utf8', env, windowsHide: true, timeout: 16000, maxBuffer: 16 * FRAME_LIMIT });
      let result;
      try {
        result = JSON.parse(output.stdout);
      } catch {
        throw new Error('Не удалось получить ответ от установленного agent-desktop.');
      }
      if (!result.ok) {
        const action = args[0] === '--headed' ? args[1] : args[0];
        const label = ACTION_LABELS[action] || action;
        const detail = result.error?.message?.slice(0, 240);
        const error = new Error(label + ' (' + result.error?.code + ').' + (detail ? ' ' + detail : ''));
        error.code = result.error?.code;
        error.safeToRetry = result.error?.disposition?.retry === 'safe';
        throw error;
      }
      return result.data;
    };
    response = await searchItil(run, message);
  } catch (error) {
    response = { success: false, error: error.message };
  } finally {
    rmSync(statePath, { recursive: true, force: true });
  }
  writeMessage(response);
}

void main();
