"""
Trains a robust machine learning classifier on the flood image dataset.
Outputs:
    ml/models/flood_model.joblib
    backend/models/flood_model.joblib
"""
import os
import shutil
import joblib
import numpy as np
from PIL import Image

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets", "flood")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "models")
BACKEND_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "models")


def extract_features(img: Image.Image) -> np.ndarray:
    """
    Extracts deep spatial color, texture, and intensity representation:
    - RGB multi-grid color moments (mean, std per grid cell)
    - HSV color space water/silt saturation profile
    - High-frequency edge gradient distribution
    """
    img = img.convert("RGB").resize((128, 128))
    arr = np.array(img, dtype=np.float32) / 255.0

    # 4x4 spatial grid color moments
    grid_features = []
    for r in range(4):
        for c in range(4):
            cell = arr[r*32:(r+1)*32, c*32:(c+1)*32]
            grid_features.extend(cell.mean(axis=(0, 1)))
            grid_features.extend(cell.std(axis=(0, 1)))

    # Global HSV representation
    hsv_img = img.convert("HSV")
    hsv_arr = np.array(hsv_img, dtype=np.float32) / 255.0
    hsv_mean = hsv_arr.mean(axis=(0, 1))
    hsv_std = hsv_arr.std(axis=(0, 1))

    # Grayscale edge/gradient variation
    gray = np.array(img.convert("L"), dtype=np.float32) / 255.0
    gx, gy = np.gradient(gray)
    grad_mag = np.sqrt(gx**2 + gy**2)
    edge_hist, _ = np.histogram(grad_mag, bins=16, range=(0, 1), density=True)

    return np.concatenate([
        np.array(grid_features),
        hsv_mean,
        hsv_std,
        edge_hist
    ])


def main():
    flood_dir = os.path.join(DATA_DIR, "flood")
    no_flood_dir = os.path.join(DATA_DIR, "no_flood")

    if not os.path.isdir(flood_dir) or not os.path.isdir(no_flood_dir):
        raise SystemExit(f"Expected {flood_dir} and {no_flood_dir} to exist.")

    X, y = [], []

    # Load flood images (label = 1)
    for fname in os.listdir(flood_dir):
        if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.avif')):
            p = os.path.join(flood_dir, fname)
            try:
                with Image.open(p) as img:
                    X.append(extract_features(img))
                    y.append(1)
            except Exception as e:
                print(f"Warning: skipping {fname} ({e})")

    # Load no_flood images (label = 0)
    for fname in os.listdir(no_flood_dir):
        if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.avif')):
            p = os.path.join(no_flood_dir, fname)
            try:
                with Image.open(p) as img:
                    X.append(extract_features(img))
                    y.append(0)
            except Exception as e:
                print(f"Warning: skipping {fname} ({e})")

    if len(X) < 2:
        raise SystemExit("Need at least 2 images to train flood model.")

    X = np.array(X)
    y = np.array(y)

    print(f"Training Flood Model on {len(X)} samples ({sum(y == 1)} flood, {sum(y == 0)} no-flood)...")

    from sklearn.neural_network import MLPClassifier
    from sklearn.ensemble import RandomForestClassifier, VotingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    clf1 = make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=600, random_state=42))
    clf2 = make_pipeline(StandardScaler(), LogisticRegression(random_state=42, max_iter=400))
    clf3 = RandomForestClassifier(n_estimators=50, random_state=42)

    ensemble = VotingClassifier(
        estimators=[('mlp', clf1), ('lr', clf2), ('rf', clf3)],
        voting='soft'
    )
    ensemble.fit(X, y)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(BACKEND_OUTPUT_DIR, exist_ok=True)

    out_path = os.path.join(OUTPUT_DIR, "flood_model.joblib")
    backend_out_path = os.path.join(BACKEND_OUTPUT_DIR, "flood_model.joblib")

    joblib.dump(ensemble, out_path)
    shutil.copy2(out_path, backend_out_path)

    print(f"Successfully saved flood model to {out_path} and {backend_out_path}")


if __name__ == "__main__":
    main()
