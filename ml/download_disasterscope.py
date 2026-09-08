"""
Downloads the DisasterScope Reconnaissance dataset from Kaggle via kagglehub.

Usage:
    python ml/download_disasterscope.py
"""
import os
import shutil
import sys

try:
    import kagglehub
except ImportError:
    print("kagglehub is not installed. Run: pip install kagglehub")
    sys.exit(1)


def download_and_sync():
    print("Connecting to Kaggle via kagglehub...")
    dataset_name = "datasetengineer/disasterscope-dataset"
    download_path = kagglehub.dataset_download(dataset_name)
    print(f"Dataset downloaded to cache: {download_path}")

    # Destination directory inside the project repository
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(project_root, "datasets", "disasterscope")
    os.makedirs(target_dir, exist_ok=True)
    target_file = os.path.join(target_dir, "disasterscope.csv")

    # Locate the CSV file in downloaded cache
    source_file = None
    for root, _, files in os.walk(download_path):
        for f in files:
            if f.endswith(".csv"):
                source_file = os.path.join(root, f)
                break
        if source_file:
            break

    if not source_file:
        raise FileNotFoundError(f"No CSV dataset found in {download_path}")

    shutil.copy2(source_file, target_file)
    print(f"Dataset copied to repository: {target_file}")
    print(f"File size: {os.path.getsize(target_file):,} bytes")
    return target_file


if __name__ == "__main__":
    download_and_sync()
