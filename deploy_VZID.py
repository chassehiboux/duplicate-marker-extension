# -*- coding: utf-8 -*-
import argparse
import shutil
import os
import stat
import json
import tempfile

# --- Конфигурация ---

# Список сетевых путей для развертывания
DESTINATION_REPOS = [
    r'\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Excel\ВЗИД\Extensions\StageTimer',
    r'\\Ekb-vpfs01\екатеринбург\Отделы\Отдел взыскания задолженности по исполнительным документам\26. Макрос\ВЗИД\Extensions\StageTimer',
    r'\\corp.vostok-electra.ru\Tmn\Общая\ОВЗИД\Зуйкевич\ВЗИД\Extensions\StageTimer'
]

# Имя проекта и исходная директория
SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_NAME = 'StageTimerExtension'
FIREFOX_PROJECT_NAME = 'StageTimerExtensionFirefox'
FIREFOX_GECKO_ID = 'stage-timer@vostok-electra.local'
STAGETIMER_BUILD_ROOT = os.path.join(SOURCE_DIR, 'dist')

# --- Вспомогательные функции ---

def on_rm_error(func, path, exc_info):
    """
    Обработчик ошибок для shutil.rmtree.
    Если ошибка связана с правами доступа, он пытается изменить права и повторить попытку.
    """
    if not os.access(path, os.W_OK):
        os.chmod(path, stat.S_IWUSR)
        func(path)

# --- Основное выполнение ---

def create_minimal_manifest(version, target_browser='chrome'):
    """Создает минимальный manifest.json для StageTimer."""
    icon_paths = {
        "16": "icon.png",
        "48": "icon.png",
        "128": "icon.png"
    }
    background = {
        "service_worker": "StageTimer/timer_background.js"
    }

    if target_browser == 'firefox':
        icon_paths = {
            "16": "icons/icon-16.png",
            "48": "icons/icon-48.png",
            "128": "icons/icon-128.png"
        }
        background = {
            "scripts": ["StageTimer/timer_background.js"]
        }

    manifest = {
        "manifest_version": 3,
        "name": "Stage Timer",
        "version": version,
        "description": "Мониторинг скорости стадий в Пирамиде",
        "icons": icon_paths,
        "background": background,
        "permissions": [
            "webRequest",
            "alarms",
            "storage",
            "tabs"
        ],
        "host_permissions": [
            "<all_urls>"
        ],
        "content_scripts": [
            {
                "matches": [
                    "*://pyramid.vostok-electra.ru/*",
                    "*://*.pyramid.vostok-electra.ru/*",
                    "*://pyramid-vostok.electra.ru/*",
                    "*://*.pyramid-vostok.electra.ru/*"
                ],
                "css": [
                    "StageTimer/timer_styles.css"
                ],
                "js": [
                    "extension_ui_config.js",
                    "StageTimer/timer_content.js"
                ],
                "run_at": "document_start",
                "all_frames": False
            },
            {
                "matches": [
                    "*://pyramid.vostok-electra.ru/*",
                    "*://*.pyramid.vostok-electra.ru/*",
                    "*://pyramid-vostok.electra.ru/*",
                    "*://*.pyramid-vostok.electra.ru/*"
                ],
                "js": [
                    "StageTimer/screenshot_hotkeys_bridge.js"
                ],
                "run_at": "document_start",
                "all_frames": True
            }
        ]
    }

    if target_browser == 'firefox':
        manifest["browser_specific_settings"] = {
            "gecko": {
                "id": FIREFOX_GECKO_ID,
                "strict_min_version": "140.0",
                "data_collection_permissions": {
                    "required": [
                        "personallyIdentifyingInfo",
                        "websiteActivity",
                        "websiteContent"
                    ]
                }
            }
        }

    return manifest

def replace_stage_timer_message_promises(content):
    content = content.replace(
        '''        // Сообщаем контент скрипту: "Покажи спиннер"
        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_START",
            data: { loadType: loadType, requestUrl: details.url }
        }).catch(() => {}); ''',
        '''        // Сообщаем контент скрипту: "Покажи спиннер"
        sendTabMessageQuiet(details.tabId, {
            action: "STAGE_TIMER_START",
            data: { loadType: loadType, requestUrl: details.url }
        });'''
    )
    content = content.replace(
        '''        // Сообщаем контент скрипту: "Готово, вот время"
        chrome.tabs.sendMessage(req.tabId, {
            action: "STAGE_TIMER_STOP",
            data: { 
                duration: duration,
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        }).catch(() => {});''',
        '''        // Сообщаем контент скрипту: "Готово, вот время"
        sendTabMessageQuiet(req.tabId, {
            action: "STAGE_TIMER_STOP",
            data: {
                duration: duration,
                loadType: req.loadType,
                requestUrl: req.requestUrl
            }
        });'''
    )
    content = content.replace(
        '''        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_ERROR"
        }).catch(() => {});''',
        '''        sendTabMessageQuiet(details.tabId, {
            action: "STAGE_TIMER_ERROR"
        });'''
    )
    return content

def transform_stage_timer_background_for_firefox(content):
    helper = '''function sendTabMessageQuiet(tabId, message) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) {
            // Вкладка могла быть закрыта или не содержать content script таймера.
        }
    });
}

'''
    marker = '// === STAGE TIMER LOGIC (NETWORK BASED) ==='
    if marker in content:
        content = content.replace(marker, helper + marker, 1)
    else:
        content = helper + content
    return replace_stage_timer_message_promises(content)

def copy_timer_background(source_path, destination_path, target_browser):
    if target_browser != 'firefox':
        shutil.copy(source_path, destination_path)
        return

    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()

    with open(destination_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(transform_stage_timer_background_for_firefox(content))

def create_firefox_icons(build_dir):
    try:
        from PIL import Image
    except ImportError:
        print("[ERROR] Для создания квадратных Firefox-иконок нужен Pillow: pip install Pillow")
        raise SystemExit(1)

    source_path = os.path.join(SOURCE_DIR, 'icon.png')
    icons_dir = os.path.join(build_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    with Image.open(source_path) as source:
        source = source.convert('RGBA')
        canvas_size = max(source.size)
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        offset = ((canvas_size - source.width) // 2, (canvas_size - source.height) // 2)
        canvas.paste(source, offset)

        for size in (16, 48, 128):
            resized = canvas.resize((size, size), Image.LANCZOS)
            resized.save(os.path.join(icons_dir, f'icon-{size}.png'))

def get_destination_path(base_dest_path, target_browser):
    if target_browser != 'firefox':
        return base_dest_path
    return os.path.join(os.path.dirname(base_dest_path), FIREFOX_PROJECT_NAME)

def get_next_version(dest_path):
    """Определяет следующую версию, основываясь на существующем manifest.json."""
    manifest_path = os.path.join(dest_path, 'manifest.json')
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            old_version = manifest.get('version', '1.0.0')
            version_parts = old_version.split('.')
            version_parts[-1] = str(int(version_parts[-1]) + 1)
            return '.'.join(version_parts)
        except (json.JSONDecodeError, ValueError):
            return '1.0.1' # Если старый манифест некорректен
    return '1.0.0'

def parse_args():
    parser = argparse.ArgumentParser(description='Развертывание StageTimer.')
    parser.add_argument('--firefox', action='store_true', help='Собрать Firefox-версию StageTimer.')
    parser.add_argument('--no-copy', action='store_true', help='Только собрать временный пакет без копирования в сетевые папки.')
    return parser.parse_args()

def main():
    """Основная функция для выполнения развертывания."""
    args = parse_args()
    target_browser = 'firefox' if args.firefox else 'chrome'
    print(f"--- Запуск скрипта развертывания StageTimer ({target_browser}) ---")

    destination_repos = DESTINATION_REPOS[:1] if args.no_copy else DESTINATION_REPOS

    for configured_dest_path in destination_repos:
        dest_path = get_destination_path(configured_dest_path, target_browser)
        print(f"\n--- Обработка назначения: {dest_path} ---")

        # Для каждой цели создается своя временная директория, чтобы избежать проблем состояний
        if args.no_copy:
            build_dir = os.path.join(
                STAGETIMER_BUILD_ROOT,
                'stagetimer-firefox' if target_browser == 'firefox' else 'stagetimer-chrome'
            )
            if os.path.exists(build_dir):
                shutil.rmtree(build_dir, onerror=on_rm_error)
            os.makedirs(build_dir)
        else:
            build_dir = tempfile.mkdtemp(prefix="stagetimer-build-")
        print(f"Временная директория сборки: {build_dir}")

        try:
            # 1. Определяем и увеличиваем версию, основываясь на данных в целевой папке
            new_version = get_next_version(dest_path)
            print(f"Новая версия: {new_version}")

            # 2. Подготовка всех файлов в этой временной директории
            print("Подготовка файлов для развертывания...")
            os.makedirs(os.path.join(build_dir, 'StageTimer'))
            
            # Копируем все необходимые файлы
            shutil.copy(os.path.join(SOURCE_DIR, 'StageTimer', 'timer_content.js'), os.path.join(build_dir, 'StageTimer'))
            shutil.copy(os.path.join(SOURCE_DIR, 'StageTimer', 'timer_styles.css'), os.path.join(build_dir, 'StageTimer'))
            copy_timer_background(
                os.path.join(SOURCE_DIR, 'StageTimer', 'timer_background.js'),
                os.path.join(build_dir, 'StageTimer', 'timer_background.js'),
                target_browser
            )
            shutil.copy(os.path.join(SOURCE_DIR, 'StageTimer', 'screenshot_hotkeys_bridge.js'), os.path.join(build_dir, 'StageTimer'))
            shutil.copy(os.path.join(SOURCE_DIR, 'extension_ui_config.js'), build_dir)
            if target_browser == 'firefox':
                create_firefox_icons(build_dir)
            else:
                shutil.copy(os.path.join(SOURCE_DIR, 'icon.png'), build_dir)
            
            # Создаем и записываем manifest.json с корректной версией
            manifest_data = create_minimal_manifest(new_version, target_browser)
            manifest_build_path = os.path.join(build_dir, 'manifest.json')
            with open(manifest_build_path, 'w', encoding='utf-8') as f:
                json.dump(manifest_data, f, indent=2, ensure_ascii=False)
            
            # Создаем version.json для авто-обновления
            version_file_path = os.path.join(build_dir, 'version.json')
            with open(version_file_path, 'w', encoding='utf-8') as f:
                json.dump({"version": new_version}, f, indent=2)

            print("[OK] Пакет собран.")

            if args.no_copy:
                print(f"Сетевое копирование отключено. Пакет собран здесь: {build_dir}")
                continue

            # 3. Удаляем старую версию в папке назначения
            if os.path.exists(dest_path):
                print("Обнаружена старая версия. Удаление...")
                try:
                    shutil.rmtree(dest_path, onerror=on_rm_error)
                    print("[OK] Старая версия успешно удалена.")
                except Exception as e:
                    print(f"[ERROR] Не удалось удалить старую директорию: {e}")
                    print("  Проверьте права доступа и убедитесь, что файлы не используются.")
                    continue # Переходим к следующему пути
            else:
                print("Папка назначения не существует, будет создана новая.")

            # 4. Копируем новую версию из временной папки
            print("Копирование новых файлов...")
            try:
                shutil.copytree(build_dir, dest_path)
                print("[OK] Проект успешно скопирован!")
            except Exception as e:
                print(f"[ERROR] Произошла ошибка во время копирования: {e}")
                continue

        finally:
            # 5. Очистка временной директории
            if build_dir and not args.no_copy:
                print(f"Очистка временной директории: {build_dir}")
                shutil.rmtree(build_dir, ignore_errors=True)

    print(f"\n--- Развертывание StageTimer ({target_browser}) завершено ---")

if __name__ == '__main__':
    main()
