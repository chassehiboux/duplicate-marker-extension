# -*- coding: utf-8 -*-
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

def create_minimal_manifest(version):
    """Создает минимальный manifest.json для StageTimer."""
    return {
        "manifest_version": 3,
        "name": "Stage Timer",
        "version": version,
        "description": "Мониторинг скорости стадий в Пирамиде",
        "icons": {
            "16": "icon.png",
            "48": "icon.png",
            "128": "icon.png"
        },
        "background": {
            "service_worker": "StageTimer/timer_background.js"
        },
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
                    "*://*.pyramid.vostok-electra.ru/*",
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
                    "*://*.pyramid.vostok-electra.ru/*",
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

def main():
    """Основная функция для выполнения развертывания."""
    print("--- Запуск скрипта развертывания StageTimer ---")

    for dest_path in DESTINATION_REPOS:
        print(f"\n--- Обработка назначения: {dest_path} ---")

        # Для каждой цели создается своя временная директория, чтобы избежать проблем состояний
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
            shutil.copy(os.path.join(SOURCE_DIR, 'StageTimer', 'timer_background.js'), os.path.join(build_dir, 'StageTimer'))
            shutil.copy(os.path.join(SOURCE_DIR, 'StageTimer', 'screenshot_hotkeys_bridge.js'), os.path.join(build_dir, 'StageTimer'))
            shutil.copy(os.path.join(SOURCE_DIR, 'extension_ui_config.js'), build_dir)
            shutil.copy(os.path.join(SOURCE_DIR, 'icon.png'), build_dir)
            
            # Создаем и записываем manifest.json с корректной версией
            manifest_data = create_minimal_manifest(new_version)
            manifest_build_path = os.path.join(build_dir, 'manifest.json')
            with open(manifest_build_path, 'w', encoding='utf-8') as f:
                json.dump(manifest_data, f, indent=2, ensure_ascii=False)
            
            # Создаем version.json для авто-обновления
            version_file_path = os.path.join(build_dir, 'version.json')
            with open(version_file_path, 'w', encoding='utf-8') as f:
                json.dump({"version": new_version}, f, indent=2)

            print("✓ Пакет собран.")

            # 3. Удаляем старую версию в папке назначения
            if os.path.exists(dest_path):
                print("Обнаружена старая версия. Удаление...")
                try:
                    shutil.rmtree(dest_path, onerror=on_rm_error)
                    print("✓ Старая версия успешно удалена.")
                except Exception as e:
                    print(f"✗ ОШИБКА: Не удалось удалить старую директорию: {e}")
                    print("  Проверьте права доступа и убедитесь, что файлы не используются.")
                    continue # Переходим к следующему пути
            else:
                print("Папка назначения не существует, будет создана новая.")

            # 4. Копируем новую версию из временной папки
            print("Копирование новых файлов...")
            try:
                shutil.copytree(build_dir, dest_path)
                print("✓ Проект успешно скопирован!")
            except Exception as e:
                print(f"✗ ОШИБКА: Произошла ошибка во время копирования: {e}")
                continue

        finally:
            # 5. Очистка временной директории
            print(f"Очистка временной директории: {build_dir}")
            shutil.rmtree(build_dir, ignore_errors=True)

    print("\n--- Развертывание StageTimer завершено ---")

if __name__ == '__main__':
    main()
