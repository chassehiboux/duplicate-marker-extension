"""Подготовка текста скопированных таблиц 1С для вставки в браузер.

Буфер не перезаписывается; текст заявок не читается и не сохраняется.
Остановка: создать %TEMP%/stop_1c_clipboard_warmer.txt.
"""
import ctypes as c
from ctypes import wintypes as w
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import sys
import tempfile
import time

TEMP = Path(tempfile.gettempdir())
STOP = TEMP / 'stop_1c_clipboard_warmer.txt'
LOG = logging.getLogger('1c_clipboard_warmer')


def bind(lib, name, args, result):
    fn = getattr(lib, name)
    fn.argtypes, fn.restype = args, result
    return fn


def main():
    handler = RotatingFileHandler(TEMP / '1c_clipboard_warmer.log',
                                 maxBytes=65536, backupCount=1, encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    LOG.addHandler(handler)
    LOG.setLevel(logging.INFO)
    u = c.WinDLL('user32', use_last_error=True)
    k = c.WinDLL('kernel32', use_last_error=True)
    ole = c.OleDLL('ole32')
    mutex_create = bind(k, 'CreateMutexW', [c.c_void_p, w.BOOL, w.LPCWSTR], w.HANDLE)
    close_handle = bind(k, 'CloseHandle', [w.HANDLE], w.BOOL)
    c.set_last_error(0)
    mutex = mutex_create(None, False, 'Local\\1CClipboardWarmer_v1')
    if not mutex:
        raise c.WinError(c.get_last_error())
    if c.get_last_error() == 183:
        close_handle(mutex)
        LOG.info('Уже запущен; второй экземпляр завершён')
        return

    init = bind(ole, 'OleInitialize', [c.c_void_p], c.c_long)
    uninit = bind(ole, 'OleUninitialize', [], None)
    create = bind(u, 'CreateWindowExW', [w.DWORD, w.LPCWSTR, w.LPCWSTR, w.DWORD,
                  c.c_int, c.c_int, c.c_int, c.c_int, w.HWND, w.HMENU,
                  w.HINSTANCE, c.c_void_p], w.HWND)
    destroy = bind(u, 'DestroyWindow', [w.HWND], w.BOOL)
    open_clip = bind(u, 'OpenClipboard', [w.HWND], w.BOOL)
    close_clip = bind(u, 'CloseClipboard', [], w.BOOL)
    sequence = bind(u, 'GetClipboardSequenceNumber', [], w.DWORD)
    register = bind(u, 'RegisterClipboardFormatW', [w.LPCWSTR], w.UINT)
    available = bind(u, 'IsClipboardFormatAvailable', [w.UINT], w.BOOL)
    get_data = bind(u, 'GetClipboardData', [w.UINT], w.HANDLE)
    size = bind(k, 'GlobalSize', [w.HANDLE], c.c_size_t)
    peek = bind(u, 'PeekMessageW', [c.POINTER(w.MSG), w.HWND, w.UINT, w.UINT, w.UINT], w.BOOL)
    translate = bind(u, 'TranslateMessage', [c.POINTER(w.MSG)], w.BOOL)
    dispatch = bind(u, 'DispatchMessageW', [c.POINTER(w.MSG)], c.c_ssize_t)
    initialized, hwnd = False, None
    try:
        hr = init(None)
        if hr < 0:
            raise RuntimeError(f'OleInitialize: {hr}')
        initialized = True
        hwnd = create(0, 'STATIC', '1C Clipboard Warmer', 0, 0, 0, 0, 0,
                      w.HWND(-3), None, None, None)
        if not hwnd:
            raise c.WinError(c.get_last_error())
        formats = [register(name) for name in ('1C:Moxcel8 Document', '1C:Moxcel Document')]
        if not all(formats):
            raise c.WinError(c.get_last_error())
        STOP.unlink(missing_ok=True)
        LOG.info('Запущен; только форматы таблиц 1С')
        last, attempted, failures = None, None, 0
        message = w.MSG()
        while not STOP.exists():
            while peek(c.byref(message), None, 0, 0, 1):
                if message.message == 0x0012:
                    return
                translate(c.byref(message))
                dispatch(c.byref(message))
            current = sequence()
            if current != last and open_clip(hwnd):
                try:
                    current = sequence()
                    if current != attempted:
                        attempted, failures = current, 0
                    if any(available(fmt) for fmt in formats) and available(13):
                        started = time.perf_counter()
                        data = get_data(13)
                        if data:
                            LOG.info('Текст 1С подготовлен: байт=%s, секунд=%.3f',
                                     size(data), time.perf_counter() - started)
                            last = current
                        else:
                            failures += 1
                            if failures >= 3:
                                LOG.warning('Не удалось получить текст 1С после 3 попыток')
                                last = current
                    else:
                        last = current
                finally:
                    close_clip()
            time.sleep(0.25)
        LOG.info('Остановлен по сигналу')
    finally:
        if hwnd:
            destroy(hwnd)
        if initialized:
            uninit()
        close_handle(mutex)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        LOG.exception('Ошибка помощника')
        sys.exit(1)
