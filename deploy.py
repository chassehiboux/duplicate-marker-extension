# -*- coding: utf-8 -*-
import argparse
import json
import os
import re
import shutil
import stat

# --- Configuration ---

# The root directory of the project. This script assumes it is located in the project root.
SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(SOURCE_DIR, 'manifest.json')
VERSION_FILE_PATH = os.path.join(SOURCE_DIR, 'version.json')

# The network destination path.
# The 'r' prefix is important for Windows paths to handle backslashes correctly.
# The script will create a folder named 'duplicate-marker-extension' at this location.
DESTINATION_REPO = r'\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Repository'
PROJECT_NAME = os.path.basename(SOURCE_DIR)
DESTINATION_DIR = os.path.join(DESTINATION_REPO, PROJECT_NAME)
FIREFOX_PROJECT_NAME = f'{PROJECT_NAME}-firefox'
FIREFOX_DESTINATION_DIR = os.path.join(DESTINATION_REPO, FIREFOX_PROJECT_NAME)
FIREFOX_BUILD_DIR = os.path.join(SOURCE_DIR, 'dist', 'firefox')
FIREFOX_GECKO_ID = 'pyramid-helper@vostok-electra.local'

# Patterns of files and directories to ignore during the copy process.
# This prevents copying version control, caches, and this script itself.
IGNORE_PATTERNS = shutil.ignore_patterns('.git', '__pycache__', '*.pyc', 'dist', 'web-ext-artifacts', 'deploy.py')

FIREFOX_REQUIRED_FILES = [
    'background.js',
    'column_manager.js',
    'content.js',
    'extension_ui_config.js',
    'popup.html',
    'popup.js',
    'version.json',
    'vzid_capture_preview.html',
    'vzid_capture_preview.js',
    'vzid_create_send.js',
]

FIREFOX_REQUIRED_DIR_FILES = {
    'Check_INN_DeathDate': [
        'inn_death_background.js',
        'inn_death_content.js',
    ],
    'google_itil': [
        'google_itil_background.js',
        'google_itil_content.js',
        'google_itil_popup.js',
    ],
    'PyramidNewYear': [
        'pyramid_christmas.css',
        'pyramid_christmas.js',
        'pyramid_spring.css',
        'pyramid_spring.js',
        'pyramid_theme_config.js',
        'pyramid_theme_settings.css',
        'pyramid_theme_settings.js',
    ],
    'redirector': [
        'redirect_rules.json',
    ],
    'StageTimer': [
        'screenshot_hotkeys_bridge.js',
        'timer_background.js',
        'timer_content.js',
        'timer_styles.css',
    ],
    'support': [
        'support_background.js',
        'support_content.js',
        'support_popup.js',
    ],
}

FIREFOX_BACKGROUND_IMPORTS = [
    'Check_INN_DeathDate/inn_death_background.js',
    'support/support_background.js',
    'google_itil/google_itil_background.js',
]


# --- Helper Functions ---

def on_rm_error(func, path, exc_info):
    """
    Error handler for shutil.rmtree.
    If the error is a permission error, it attempts to change the file's permissions and retry.
    """
    if not os.access(path, os.W_OK):
        os.chmod(path, stat.S_IWUSR)
        func(path)


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path, data):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def bump_root_version():
    """Increment version in manifest.json and version.json."""
    print("\nUpdating version in manifest.json...")
    try:
        manifest = read_json(MANIFEST_PATH)

        old_version = manifest['version']
        version_parts = old_version.split('.')
        version_parts[-1] = str(int(version_parts[-1]) + 1)
        new_version = '.'.join(version_parts)
        manifest['version'] = new_version

        write_json(MANIFEST_PATH, manifest)
        print(f"[OK] Version bumped from {old_version} to {new_version}")

        write_json(VERSION_FILE_PATH, {"version": new_version})
        print(f"[OK] version.json updated to {new_version}")
        return new_version

    except FileNotFoundError:
        print("[ERROR] manifest.json not found!")
        raise SystemExit(1)
    except (ValueError, KeyError) as e:
        print(f"[ERROR] Invalid format in manifest.json: {e}")
        raise SystemExit(1)


def get_current_version():
    manifest = read_json(MANIFEST_PATH)
    return manifest.get('version', '0.0.0')


def copy_file(source_relative_path, destination_root):
    source_path = os.path.join(SOURCE_DIR, source_relative_path)
    if not os.path.exists(source_path):
        print(f"! Пропущен отсутствующий файл: {source_relative_path}")
        return False

    destination_path = os.path.join(destination_root, source_relative_path)
    os.makedirs(os.path.dirname(destination_path), exist_ok=True)
    shutil.copy2(source_path, destination_path)
    return True


def copy_text_file_with_transform(source_relative_path, destination_root, transform):
    source_path = os.path.join(SOURCE_DIR, source_relative_path)
    if not os.path.exists(source_path):
        print(f"! Пропущен отсутствующий файл: {source_relative_path}")
        return False

    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()

    destination_path = os.path.join(destination_root, source_relative_path)
    os.makedirs(os.path.dirname(destination_path), exist_ok=True)
    with open(destination_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(transform(content))
    return True


def remove_background_import_scripts(content):
    return re.sub(
        r'\n// --- Подключение модулей ---\r?\ntry \{.*?\} catch \(e\) \{\r?\n\s*console\.error\("Ошибка импорта скриптов в background\.js:", e\);\r?\n\}\r?\n',
        '\n',
        content,
        count=1,
        flags=re.DOTALL
    )


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


def inject_firefox_background_helpers(content):
    helper = r'''
// --- Firefox compatibility helpers ---
function getSidebarActionApi() {
    if (typeof browser !== 'undefined' && browser.sidebarAction) return browser.sidebarAction;
    if (typeof chrome !== 'undefined' && chrome.sidebarAction) return chrome.sidebarAction;
    return null;
}

function maybeCatchPromise(result, onError) {
    if (result && typeof result.catch === 'function') {
        result.catch(onError);
    }
}

function configureExtensionPanelBehavior() {
    // В Firefox отдельной настройки поведения для sidebar_action нет.
}

function openExtensionPanel(tab) {
    const sidebarAction = getSidebarActionApi();
    if (sidebarAction && typeof sidebarAction.open === 'function') {
        maybeCatchPromise(
            sidebarAction.open(),
            (error) => addLog(`Ошибка открытия панели Firefox: ${error}`)
        );
    }
}

function sendTabMessageQuiet(tabId, message) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) {
            // Вкладка могла не содержать нужный content script.
        }
    });
}

function getExtensionSessionStorage() {
    return chrome.storage.local;
}

'''
    marker = '// --- Функция надежной отправки (POST + Retry) ---'
    if marker not in content:
        return helper + content
    return content.replace(marker, helper + marker, 1)


def transform_main_background_for_firefox(content):
    content = remove_background_import_scripts(content)
    content = inject_firefox_background_helpers(content)
    content = replace_stage_timer_message_promises(content)
    content = content.replace(
        'chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => addLog(`Ошибка настройки панели: ${error}`));',
        'configureExtensionPanelBehavior();'
    )
    content = content.replace(
        'chrome.sidePanel.open({ windowId: tab.windowId });',
        'openExtensionPanel(tab);'
    )
    content = content.replace('chrome.storage.session.', 'getExtensionSessionStorage().')
    content = content.replace("iconUrl: 'icon.png'", "iconUrl: 'icons/icon-128.png'")
    return content


def inject_stage_timer_background_helpers(content):
    helper = r'''function sendTabMessageQuiet(tabId, message) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) {
            // Вкладка могла быть закрыта или не содержать content script таймера.
        }
    });
}

'''
    marker = '// === STAGE TIMER LOGIC (NETWORK BASED) ==='
    if marker not in content:
        return helper + content
    return content.replace(marker, helper + marker, 1)


def transform_stage_timer_background_for_firefox(content):
    content = inject_stage_timer_background_helpers(content)
    return replace_stage_timer_message_promises(content)


def transform_support_background_for_firefox(content):
    return content.replace("iconUrl: 'icon.png'", "iconUrl: 'icons/icon-128.png'")


def transform_google_itil_background_for_firefox(content):
    return r'''(function () {
  const STORAGE_KEY = 'google_itil_fill_state_v1';
  const MESSAGE = 'Автозаполнение Google ITIL в Firefox отключено: Firefox не поддерживает chrome.debugger, который нужен этой функции.';

  function createState() {
    return {
      visible: false,
      status: 'error',
      queue: [],
      currentIndex: 0,
      processedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      currentTicket: '',
      message: MESSAGE,
      lastError: MESSAGE,
      lastProcessedTicket: '',
      processing: false,
      pauseRequested: false,
      stopRequested: false,
      sheetTabId: null,
      itilTabId: null
    };
  }

  function saveState(state) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve(state));
    });
  }

  function getState() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (data) => {
        resolve(data[STORAGE_KEY] || createState());
      });
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request && request.action) {
      case 'GOOGLE_ITIL_GET_STATE':
        getState()
          .then((state) => sendResponse({ success: true, state }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case 'GOOGLE_ITIL_START':
      case 'GOOGLE_ITIL_RESUME':
      case 'GOOGLE_ITIL_PAUSE':
      case 'GOOGLE_ITIL_FINISH':
        saveState(createState())
          .then((state) => sendResponse({ success: false, error: MESSAGE, state }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      default:
        return false;
    }
  });
})();
'''


def create_firefox_icons(destination_root):
    try:
        from PIL import Image
    except ImportError:
        print("[ERROR] Для создания квадратных Firefox-иконок нужен Pillow: pip install Pillow")
        raise SystemExit(1)

    source_path = os.path.join(SOURCE_DIR, 'icon.png')
    icons_dir = os.path.join(destination_root, 'icons')
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


def existing_background_imports_for_firefox():
    return [
        path for path in FIREFOX_BACKGROUND_IMPORTS
        if os.path.exists(os.path.join(SOURCE_DIR, path))
    ]


def create_firefox_manifest(version):
    manifest = read_json(MANIFEST_PATH)
    manifest['version'] = version
    manifest['background'] = {
        'scripts': [
            *existing_background_imports_for_firefox(),
            'background.js',
        ]
    }
    manifest['permissions'] = [
        permission for permission in manifest.get('permissions', [])
        if permission not in {'sidePanel', 'debugger'}
    ]
    firefox_icons = {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
    }
    manifest['icons'] = firefox_icons
    manifest.pop('side_panel', None)
    manifest.setdefault('action', {})
    manifest['action']['default_icon'] = firefox_icons
    manifest['sidebar_action'] = {
        'default_title': manifest.get('action', {}).get('default_title', manifest.get('name', 'Расширение')),
        'default_icon': firefox_icons,
        'default_panel': 'popup.html',
    }
    manifest['browser_specific_settings'] = {
        'gecko': {
            'id': FIREFOX_GECKO_ID,
            'strict_min_version': '140.0',
            'data_collection_permissions': {
                'required': [
                    'personallyIdentifyingInfo',
                    'websiteActivity',
                    'websiteContent',
                ]
            }
        }
    }
    return manifest


def build_firefox_extension(version):
    print("\n--- Сборка Firefox-версии ---")
    print(f"Папка сборки: {FIREFOX_BUILD_DIR}")

    if os.path.exists(FIREFOX_BUILD_DIR):
        shutil.rmtree(FIREFOX_BUILD_DIR, onerror=on_rm_error)
    os.makedirs(FIREFOX_BUILD_DIR, exist_ok=True)

    for file_path in FIREFOX_REQUIRED_FILES:
        if file_path == 'background.js':
            copy_text_file_with_transform(file_path, FIREFOX_BUILD_DIR, transform_main_background_for_firefox)
        else:
            copy_file(file_path, FIREFOX_BUILD_DIR)

    create_firefox_icons(FIREFOX_BUILD_DIR)

    for directory, file_names in FIREFOX_REQUIRED_DIR_FILES.items():
        for file_name in file_names:
            relative_path = os.path.join(directory, file_name)
            if relative_path == os.path.join('StageTimer', 'timer_background.js'):
                copy_text_file_with_transform(relative_path, FIREFOX_BUILD_DIR, transform_stage_timer_background_for_firefox)
            elif relative_path == os.path.join('google_itil', 'google_itil_background.js'):
                copy_text_file_with_transform(relative_path, FIREFOX_BUILD_DIR, transform_google_itil_background_for_firefox)
            elif relative_path == os.path.join('support', 'support_background.js'):
                copy_text_file_with_transform(relative_path, FIREFOX_BUILD_DIR, transform_support_background_for_firefox)
            else:
                copy_file(relative_path, FIREFOX_BUILD_DIR)

    write_json(os.path.join(FIREFOX_BUILD_DIR, 'manifest.json'), create_firefox_manifest(version))
    write_json(os.path.join(FIREFOX_BUILD_DIR, 'version.json'), {"version": version})
    print("[OK] Firefox-сборка готова.")


def copy_directory(source_dir, destination_dir, ignore=None):
    if os.path.exists(destination_dir):
        print("Destination already exists. Removing old version...")
        try:
            shutil.rmtree(destination_dir, onerror=on_rm_error)
            print("[OK] Old version removed successfully.")
        except Exception as e:
            print(f"[ERROR] Could not remove old directory: {e}")
            print("  Please check your permissions for the network path and ensure no files are in use.")
            raise SystemExit(1)
    else:
        print("Destination not found, no need to remove.")

    print("\nCopying project files...")
    try:
        shutil.copytree(source_dir, destination_dir, ignore=ignore)
        print("[OK] Project copied successfully!")
    except Exception as e:
        print(f"[ERROR] An error occurred during copy: {e}")
        raise SystemExit(1)


def deploy_chrome():
    """Run the original Chrome/Yandex deployment process."""
    print("--- Starting Deployment Script ---")
    new_version = bump_root_version()

    print(f"\nProject: {PROJECT_NAME} (v{new_version})")
    print(f"Source:      {SOURCE_DIR}")
    print(f"Destination: {DESTINATION_DIR}")
    print("-" * 35)

    copy_directory(SOURCE_DIR, DESTINATION_DIR, ignore=IGNORE_PATTERNS)
    print("\n--- Deployment Finished ---")


def deploy_firefox(no_copy=False, destination=None):
    """Build the Firefox extension and optionally deploy it to the network folder."""
    print("--- Запуск Firefox-сборки ---")
    version = get_current_version() if no_copy else bump_root_version()
    build_firefox_extension(version)

    if no_copy:
        print("\nСетевое копирование отключено. Готовая папка:")
        print(FIREFOX_BUILD_DIR)
        return

    firefox_destination = destination or FIREFOX_DESTINATION_DIR
    print(f"\nProject: {FIREFOX_PROJECT_NAME} (v{version})")
    print(f"Source:      {FIREFOX_BUILD_DIR}")
    print(f"Destination: {firefox_destination}")
    print("-" * 35)

    copy_directory(FIREFOX_BUILD_DIR, firefox_destination)
    print("\n--- Firefox-деплой завершен ---")


def parse_args():
    parser = argparse.ArgumentParser(description='Deploy duplicate-marker-extension.')
    parser.add_argument('--firefox', action='store_true', help='Собрать и задеплоить Firefox-версию.')
    parser.add_argument('--no-copy', action='store_true', help='Для --firefox: только собрать dist/firefox без сетевого копирования.')
    parser.add_argument('--firefox-destination', help='Для --firefox: свой путь сетевой папки назначения.')
    return parser.parse_args()


def main():
    args = parse_args()
    if args.no_copy and not args.firefox:
        print("[ERROR] --no-copy сейчас поддерживается только вместе с --firefox.")
        raise SystemExit(1)

    if args.firefox:
        deploy_firefox(no_copy=args.no_copy, destination=args.firefox_destination)
        return

    deploy_chrome()


if __name__ == '__main__':
    main()
