# -*- coding: utf-8 -*-
import json
import os
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

# Patterns of files and directories to ignore during the copy process.
# This prevents copying version control, caches, local build artifacts, and this script itself.
IGNORE_PATTERNS = shutil.ignore_patterns(
    '.git',
    '.agents',
    '.codex',
    '.mcp.json',
    '__pycache__',
    '*.pyc',
    'dist',
    'supabase',
    'web-ext-artifacts',
    'AGENTS.md',
    'deploy.py',
    'version-firefox.json',
)


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


# --- Main Execution ---

def main():
    """Run the Chrome/Yandex deployment process."""
    print("--- Starting Deployment Script ---")
    new_version = bump_root_version()

    print(f"\nProject: {PROJECT_NAME} (v{new_version})")
    print(f"Source:      {SOURCE_DIR}")
    print(f"Destination: {DESTINATION_DIR}")
    print("-" * 35)

    copy_directory(SOURCE_DIR, DESTINATION_DIR, ignore=IGNORE_PATTERNS)
    print("\n--- Deployment Finished ---")


if __name__ == '__main__':
    main()
