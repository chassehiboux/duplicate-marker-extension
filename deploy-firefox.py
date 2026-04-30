# -*- coding: utf-8 -*-
import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

SOURCE_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = SOURCE_DIR / 'manifest.json'
ROOT_VERSION_FILE_PATH = SOURCE_DIR / 'version.json'
FIREFOX_VERSION_FILE_PATH = SOURCE_DIR / 'version-firefox.json'

DESTINATION_REPO = Path(r'\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Repository')
PROJECT_NAME = SOURCE_DIR.name
FIREFOX_PROJECT_NAME = f'{PROJECT_NAME}-firefox'
FIREFOX_DESTINATION_DIR = DESTINATION_REPO / FIREFOX_PROJECT_NAME
FIREFOX_GECKO_ID = 'pyramid-helper@vostok-electra.local'
FIREFOX_MIN_VERSION = '140.0'
FIREFOX_UPDATE_BASE_URL = 'https://188.253.23.149.sslip.io/duplicate-marker-extension-firefox'
FIREFOX_REMOTE_SSH_HOST = '188.253.23.149'
FIREFOX_REMOTE_SSH_PORT = 44044
FIREFOX_REMOTE_SSH_USER = 'jassco'
FIREFOX_REMOTE_DEPLOY_DIR = '/var/www/duplicate-marker-extension-firefox'
SSH_NULL_CONFIG = 'NUL' if os.name == 'nt' else '/dev/null'
SIGNING_APPROVAL_TIMEOUT_MS = 30 * 60 * 1000

ROOT_FILES = [
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

DIR_FILES = {
    'Check_INN_DeathDate': [
        'inn_death_background.js',
        'inn_death_content.js',
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
]


def on_rm_error(func, path, exc_info):
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


def normalize_base_url(base_url):
    return base_url.strip().rstrip('/')


def make_update_manifest_url(base_url):
    return f'{normalize_base_url(base_url)}/updates.json'


def make_xpi_download_url(base_url, xpi_name):
    return f'{normalize_base_url(base_url)}/{quote(xpi_name)}'


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def read_source_version():
    try:
        manifest = read_json(MANIFEST_PATH)
        version = str(manifest.get('version', '')).strip()
        if version:
            return version
    except FileNotFoundError:
        pass

    version_data = read_json(ROOT_VERSION_FILE_PATH)
    return str(version_data.get('version', '')).strip()


def bump_patch_version(old_version):
    version_parts = old_version.split('.')
    version_parts[-1] = str(int(version_parts[-1]) + 1)
    return '.'.join(version_parts)


def bump_firefox_version():
    if FIREFOX_VERSION_FILE_PATH.exists():
        version_data = read_json(FIREFOX_VERSION_FILE_PATH)
        old_version = str(version_data.get('version', '')).strip()
    else:
        old_version = read_source_version()
        print(f"[INFO] {FIREFOX_VERSION_FILE_PATH.name} не найден, стартуем от версии основного расширения: {old_version}")

    if not old_version:
        print("[ERROR] Не удалось определить текущую Firefox-версию.")
        raise SystemExit(1)

    try:
        new_version = bump_patch_version(old_version)
    except (ValueError, IndexError) as e:
        print(f"[ERROR] Некорректный формат Firefox-версии {old_version!r}: {e}")
        raise SystemExit(1)

    write_json(FIREFOX_VERSION_FILE_PATH, {'version': new_version})
    print(f"[OK] Firefox-версия обновлена: {old_version} -> {new_version}")
    print("[INFO] manifest.json и version.json основного расширения не изменялись.")
    return new_version


def copy_file(relative_path, build_dir):
    source_path = SOURCE_DIR / relative_path
    if not source_path.exists():
        print(f"[WARN] Пропущен отсутствующий файл: {relative_path}")
        return False

    destination_path = build_dir / relative_path
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)
    return True


def copy_text_file_with_transform(relative_path, build_dir, transform):
    source_path = SOURCE_DIR / relative_path
    if not source_path.exists():
        print(f"[WARN] Пропущен отсутствующий файл: {relative_path}")
        return False

    content = source_path.read_text(encoding='utf-8')
    destination_path = build_dir / relative_path
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_text(transform(content), encoding='utf-8', newline='\n')
    return True


def remove_background_import_scripts(content):
    return re.sub(
        r'\n// --- Подключение модулей ---\r?\ntry \{.*?\} catch \(e\) \{\r?\n\s*console\.error\("Ошибка импорта скриптов в background\.js:", e\);\r?\n\}\r?\n',
        '\n',
        content,
        count=1,
        flags=re.DOTALL,
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
        });''',
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
        });''',
    )
    content = content.replace(
        '''        chrome.tabs.sendMessage(details.tabId, {
            action: "STAGE_TIMER_ERROR"
        }).catch(() => {});''',
        '''        sendTabMessageQuiet(details.tabId, {
            action: "STAGE_TIMER_ERROR"
        });''',
    )
    return content


def replace_notification_icon_paths(content):
    return content.replace("iconUrl: 'icon.png'", "iconUrl: 'icons/icon-128.png'")


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


def transform_main_background(content):
    content = remove_background_import_scripts(content)
    content = inject_firefox_background_helpers(content)
    content = replace_stage_timer_message_promises(content)
    content = content.replace(
        'chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => addLog(`Ошибка настройки панели: ${error}`));',
        'configureExtensionPanelBehavior();',
    )
    content = content.replace(
        'chrome.sidePanel.open({ windowId: tab.windowId });',
        'openExtensionPanel(tab);',
    )
    content = content.replace('chrome.storage.session.', 'getExtensionSessionStorage().')
    return replace_notification_icon_paths(content)


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


def transform_stage_timer_background(content):
    content = inject_stage_timer_background_helpers(content)
    return replace_stage_timer_message_promises(content)


def transform_support_background(content):
    return replace_notification_icon_paths(content)


def create_firefox_icons(build_dir):
    try:
        from PIL import Image
    except ImportError:
        print("[ERROR] Для создания квадратных Firefox-иконок нужен Pillow: pip install Pillow")
        raise SystemExit(1)

    source_path = SOURCE_DIR / 'icon.png'
    icons_dir = build_dir / 'icons'
    icons_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(source_path) as source:
        source = source.convert('RGBA')
        canvas_size = max(source.size)
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        offset = ((canvas_size - source.width) // 2, (canvas_size - source.height) // 2)
        canvas.paste(source, offset)

        for size in (16, 48, 128):
            resized = canvas.resize((size, size), Image.LANCZOS)
            resized.save(icons_dir / f'icon-{size}.png')


def existing_background_imports():
    return [
        path for path in FIREFOX_BACKGROUND_IMPORTS
        if (SOURCE_DIR / path).exists()
    ]


def create_firefox_manifest(version, update_manifest_url):
    manifest = read_json(MANIFEST_PATH)
    manifest['version'] = version
    manifest['background'] = {
        'scripts': [
            *existing_background_imports(),
            'background.js',
        ],
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
            'strict_min_version': FIREFOX_MIN_VERSION,
            'update_url': update_manifest_url,
            'data_collection_permissions': {
                'required': [
                    'personallyIdentifyingInfo',
                    'websiteActivity',
                    'websiteContent',
                ],
            },
        },
    }
    return manifest


def build_firefox_extension(version, build_dir, update_manifest_url):
    print(f"[INFO] Сборка Firefox-исходников: {build_dir}")
    build_dir.mkdir(parents=True, exist_ok=True)

    for file_path in ROOT_FILES:
        if file_path == 'background.js':
            copy_text_file_with_transform(file_path, build_dir, transform_main_background)
        else:
            copy_file(file_path, build_dir)

    create_firefox_icons(build_dir)

    for directory, file_names in DIR_FILES.items():
        for file_name in file_names:
            relative_path = f'{directory}/{file_name}'
            if relative_path == 'StageTimer/timer_background.js':
                copy_text_file_with_transform(relative_path, build_dir, transform_stage_timer_background)
            elif relative_path == 'support/support_background.js':
                copy_text_file_with_transform(relative_path, build_dir, transform_support_background)
            else:
                copy_file(relative_path, build_dir)

    write_json(build_dir / 'manifest.json', create_firefox_manifest(version, update_manifest_url))
    write_json(build_dir / 'version.json', {'version': version})
    print("[OK] Firefox-исходники собраны.")


def require_web_ext():
    web_ext = shutil.which('web-ext')
    if not web_ext:
        print("[ERROR] web-ext не найден. Установи: npm install --global web-ext")
        raise SystemExit(1)
    return web_ext


def run_checked(command, cwd=None, env=None):
    print(f"[CMD] {' '.join(str(part) for part in command)}")
    result = subprocess.run(command, cwd=cwd, env=env)
    if result.returncode != 0:
        print(f"[ERROR] Команда завершилась с кодом {result.returncode}.")
        raise SystemExit(result.returncode)


def prompt_amo_credentials():
    print("\nВведите ключи Mozilla Add-ons. Ввод видимый, значения не сохраняются в файлы проекта.")
    api_key = input("JWT issuer / WEB_EXT_API_KEY: ")
    api_secret = input("JWT secret / WEB_EXT_API_SECRET: ")
    return api_key, api_secret


def find_signed_xpi(artifacts_dir):
    xpi_files = sorted(
        artifacts_dir.glob('*.xpi'),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not xpi_files:
        print("[ERROR] web-ext sign не создал подписанный .xpi.")
        raise SystemExit(1)
    return xpi_files[0]


def prepare_destination_dir(destination_dir):
    if destination_dir.exists():
        shutil.rmtree(destination_dir, onerror=on_rm_error)
    destination_dir.mkdir(parents=True, exist_ok=True)


def create_update_manifest(version, xpi_url, xpi_path):
    return {
        'addons': {
            FIREFOX_GECKO_ID: {
                'updates': [
                    {
                        'version': version,
                        'update_link': xpi_url,
                        'update_hash': f'sha256:{sha256_file(xpi_path)}',
                    },
                ],
            },
        },
    }


def write_install_guide(destination_dir, xpi_name, update_base_url):
    update_manifest_url = make_update_manifest_url(update_base_url)
    xpi_url = make_xpi_download_url(update_base_url, xpi_name)
    guide = f"""Firefox-версия расширения

Установочный файл:
{xpi_name}

HTTPS-страница установки:
{update_base_url}

Файл автообновлений:
{update_manifest_url}

Прямая HTTPS-ссылка на .xpi:
{xpi_url}

Как установить:
1. Открыть Firefox.
2. Открыть about:addons.
3. Нажать кнопку с шестеренкой.
4. Выбрать Install Add-on From File...
5. Выбрать файл {xpi_name}.

Это подписанная unlisted-версия. Она ставится постоянно и не пропадает после перезапуска Firefox.
Автообновление заработает после установки версии, в которой уже есть update_url.
"""
    (destination_dir / 'INSTALL_FIREFOX.txt').write_text(guide, encoding='utf-8', newline='\n')


def write_web_install_page(destination_dir, version, xpi_name, update_base_url):
    xpi_url = make_xpi_download_url(update_base_url, xpi_name)
    update_manifest_url = make_update_manifest_url(update_base_url)
    html = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Помощник по Пирамиде для Firefox</title>
  <style>
    body {{ font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.5; }}
    code {{ background: #f2f2f2; padding: 2px 5px; border-radius: 4px; }}
    a.button {{ display: inline-block; margin: 12px 0; padding: 10px 14px; background: #0b57d0; color: #fff; text-decoration: none; border-radius: 6px; }}
  </style>
</head>
<body>
  <h1>Помощник по Пирамиде для Firefox</h1>
  <p>Актуальная версия: <strong>{version}</strong></p>
  <p><a class="button" href="{xpi_url}">Скачать подписанное расширение</a></p>
  <p>Файл обновлений: <code>{update_manifest_url}</code></p>
  <p>Если Firefox не предлагает установку сам, скачай файл и установи его через <code>about:addons</code> -> шестеренка -> <code>Install Add-on From File...</code>.</p>
</body>
</html>
"""
    (destination_dir / 'index.html').write_text(html, encoding='utf-8', newline='\n')


def sign_firefox_extension(web_ext, source_dir, artifacts_dir, api_key, api_secret):
    env = os.environ.copy()
    env['WEB_EXT_API_KEY'] = api_key
    env['WEB_EXT_API_SECRET'] = api_secret

    run_checked([
        web_ext,
        'lint',
        '--source-dir',
        str(source_dir),
        '--self-hosted',
    ])

    run_checked([
        web_ext,
        'sign',
        '--source-dir',
        str(source_dir),
        '--artifacts-dir',
        str(artifacts_dir),
        '--channel',
        'unlisted',
        '--approval-timeout',
        str(SIGNING_APPROVAL_TIMEOUT_MS),
    ], env=env)

    return find_signed_xpi(artifacts_dir)


def build_ssh_target(user, host):
    return f'{user}@{host}'


def ssh_base_command(port):
    return [
        'ssh',
        '-F',
        SSH_NULL_CONFIG,
        '-p',
        str(port),
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'BatchMode=yes',
    ]


def scp_base_command(port):
    return [
        'scp',
        '-F',
        SSH_NULL_CONFIG,
        '-P',
        str(port),
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'BatchMode=yes',
    ]


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def deploy_to_server(server_host, server_port, server_user, remote_dir, files):
    ssh = shutil.which('ssh')
    scp = shutil.which('scp')
    if not ssh or not scp:
        print("[ERROR] Для деплоя на HTTPS-сервер нужны ssh и scp в PATH.")
        raise SystemExit(1)

    target = build_ssh_target(server_user, server_host)
    remote_dir_quoted = shell_quote(remote_dir)

    run_checked([
        *ssh_base_command(server_port),
        target,
        f'mkdir -p {remote_dir_quoted}',
    ])

    run_checked([
        *scp_base_command(server_port),
        *[str(path) for path in files],
        f'{target}:{remote_dir}/',
    ])


def collect_deploy_files(destination_dir, xpi_name):
    return [
        destination_dir / xpi_name,
        destination_dir / 'updates.json',
        destination_dir / 'version.json',
        destination_dir / 'INSTALL_FIREFOX.txt',
        destination_dir / 'index.html',
    ]


def parse_args():
    parser = argparse.ArgumentParser(description='Собрать, подписать и задеплоить Firefox .xpi.')
    parser.add_argument(
        '--destination',
        default=str(FIREFOX_DESTINATION_DIR),
        help='Сетевая папка, куда будет скопирован подписанный .xpi.',
    )
    parser.add_argument(
        '--update-base-url',
        default=os.environ.get('FIREFOX_UPDATE_BASE_URL', FIREFOX_UPDATE_BASE_URL),
        help='HTTPS-база, где будут лежать updates.json и подписанный .xpi.',
    )
    parser.add_argument(
        '--server-host',
        default=os.environ.get('FIREFOX_UPDATE_SERVER_HOST', FIREFOX_REMOTE_SSH_HOST),
        help='SSH-хост HTTPS-сервера для деплоя Firefox-обновлений.',
    )
    parser.add_argument(
        '--server-port',
        type=int,
        default=int(os.environ.get('FIREFOX_UPDATE_SERVER_PORT', FIREFOX_REMOTE_SSH_PORT)),
        help='SSH-порт HTTPS-сервера.',
    )
    parser.add_argument(
        '--server-user',
        default=os.environ.get('FIREFOX_UPDATE_SERVER_USER', FIREFOX_REMOTE_SSH_USER),
        help='SSH-пользователь HTTPS-сервера.',
    )
    parser.add_argument(
        '--server-dir',
        default=os.environ.get('FIREFOX_UPDATE_SERVER_DIR', FIREFOX_REMOTE_DEPLOY_DIR),
        help='Папка на HTTPS-сервере, которую отдает веб-сервер.',
    )
    parser.add_argument(
        '--no-server-deploy',
        action='store_true',
        help='Не загружать результат на HTTPS-сервер, только собрать и скопировать в сетевую папку.',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    destination_dir = Path(args.destination)
    update_base_url = normalize_base_url(args.update_base_url)
    update_manifest_url = make_update_manifest_url(update_base_url)
    web_ext = require_web_ext()
    api_key, api_secret = prompt_amo_credentials()

    version = bump_firefox_version()

    with tempfile.TemporaryDirectory(prefix='firefox-extension-build-') as build_temp:
        build_root = Path(build_temp)
        source_dir = build_root / 'source'
        artifacts_dir = build_root / 'artifacts'
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        build_firefox_extension(version, source_dir, update_manifest_url)
        signed_xpi = sign_firefox_extension(web_ext, source_dir, artifacts_dir, api_key, api_secret)

        prepare_destination_dir(destination_dir)
        destination_xpi = destination_dir / signed_xpi.name
        shutil.copy2(signed_xpi, destination_xpi)

        xpi_url = make_xpi_download_url(update_base_url, signed_xpi.name)
        write_json(destination_dir / 'updates.json', create_update_manifest(version, xpi_url, signed_xpi))
        write_json(destination_dir / 'version.json', {'version': version})
        write_install_guide(destination_dir, destination_xpi.name, update_base_url)
        write_web_install_page(destination_dir, version, destination_xpi.name, update_base_url)

        if not args.no_server_deploy:
            print("\n[INFO] Деплой Firefox-обновления на HTTPS-сервер.")
            deploy_to_server(
                args.server_host,
                args.server_port,
                args.server_user,
                args.server_dir,
                collect_deploy_files(destination_dir, destination_xpi.name),
            )
        else:
            print("\n[WARN] Деплой на HTTPS-сервер пропущен по --no-server-deploy.")

    print("\n[OK] Подписанный Firefox .xpi собран и отправлен в сетевую папку.")
    print(f"Папка: {destination_dir}")
    print(f"Файл:  {destination_xpi}")
    print(f"Update manifest: {update_manifest_url}")
    if not args.no_server_deploy:
        print(f"HTTPS-сервер:    {update_base_url}")


if __name__ == '__main__':
    main()
