import shutil
import os
import stat
import json

# --- Configuration ---

# The root directory of the project. This script assumes it is located in the project root.
SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(SOURCE_DIR, 'manifest.json')

# The network destination path.
# The 'r' prefix is important for Windows paths to handle backslashes correctly.
# The script will create a folder named 'duplicate-marker-extension' at this location.
DESTINATION_REPO = r'\\corp.vostok-electra.ru\Kgn\Отделы\Отдел взыскания по исполнительным документам\Зуйкевич Данил Иванович\Repository'
PROJECT_NAME = os.path.basename(SOURCE_DIR)
DESTINATION_DIR = os.path.join(DESTINATION_REPO, PROJECT_NAME)

# Patterns of files and directories to ignore during the copy process.
# This prevents copying version control, caches, and this script itself.
IGNORE_PATTERNS = shutil.ignore_patterns('.git', '__pycache__', '*.pyc', 'deploy.py')

# --- Helper Functions ---

def on_rm_error(func, path, exc_info):
    """
    Error handler for shutil.rmtree.
    If the error is a permission error, it attempts to change the file's permissions and retry.
    """
    # Check if the error is a PermissionError
    if not os.access(path, os.W_OK):
        # Try to change the permissions
        os.chmod(path, stat.S_IWUSR)
        # Retry the function
        func(path)

# --- Main Execution ---

def main():
    """Main function to run the deployment process."""
    print("--- Starting Deployment Script ---")

    # 1. Increment version in manifest.json
    print("\nUpdating version in manifest.json...")
    try:
        with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        old_version = manifest['version']
        version_parts = old_version.split('.')
        version_parts[-1] = str(int(version_parts[-1]) + 1)
        new_version = '.'.join(version_parts)
        manifest['version'] = new_version

        with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Version bumped from {old_version} to {new_version}")

    except FileNotFoundError:
        print("✗ ERROR: manifest.json not found!")
        exit(1)
    except (ValueError, KeyError) as e:
        print(f"✗ ERROR: Invalid format in manifest.json: {e}")
        exit(1)

    print(f"\nProject: {PROJECT_NAME} (v{new_version})")
    print(f"Source:      {SOURCE_DIR}")
    print(f"Destination: {DESTINATION_DIR}")
    print("-" * 35)

    # 2. Remove the old directory at the destination
    if os.path.exists(DESTINATION_DIR):
        print("Destination already exists. Removing old version...")
        try:
            shutil.rmtree(DESTINATION_DIR, onerror=on_rm_error)
            print("✓ Old version removed successfully.")
        except Exception as e:
            print(f"✗ ERROR: Could not remove old directory: {e}")
            print("  Please check your permissions for the network path and ensure no files are in use.")
            exit(1)
    else:
        print("Destination not found, no need to remove.")

    # 3. Copy the new version
    print("\nCopying project files...")
    try:
        shutil.copytree(SOURCE_DIR, DESTINATION_DIR, ignore=IGNORE_PATTERNS)
        print("✓ Project copied successfully!")
    except Exception as e:
        print(f"✗ ERROR: An error occurred during copy: {e}")
        exit(1)
        
    print("\n--- Deployment Finished ---")

if __name__ == '__main__':
    main()
