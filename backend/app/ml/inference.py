"""
Loads trained ML models (once, cached) and executes inference.
Supports both .joblib ensemble feature models and .keras deep networks.
"""
import io
import os
import pickle
from functools import lru_cache

import joblib
import numpy as np
from PIL import Image

from app.core.config import settings

IMG_SIZE = (128, 128)
RAINFALL_WINDOW = 7


class ModelNotTrainedError(Exception):
    pass


def _extract_image_features(img: Image.Image) -> np.ndarray:
    """Extracts spatial color moments, HSV water profile, and edge gradients."""
    img = img.convert("RGB").resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0

    # 4x4 grid color moments
    grid_features = []
    for r in range(4):
        for c in range(4):
            cell = arr[r*32:(r+1)*32, c*32:(c+1)*32]
            grid_features.extend(cell.mean(axis=(0, 1)))
            grid_features.extend(cell.std(axis=(0, 1)))

    # HSV water spectrum
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


def _find_model_file(*filenames: str) -> str | None:
    """Locates model file across standard root, ml, and backend paths."""
    search_dirs = [
        ".",
        "models",
        "../ml/models",
        "ml/models",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "models"),
        os.path.join(os.path.dirname(__file__), "..", "..", "models"),
    ]
    for d in search_dirs:
        for f in filenames:
            p = os.path.join(d, f)
            if os.path.exists(p):
                return p
    return None


@lru_cache(maxsize=1)
def _load_flood_model():
    path = _find_model_file("flood_model.joblib", "flood_model.keras")
    if not path:
        raise ModelNotTrainedError(
            "Flood model not initialized. Run `python ml/train_flood_model.py` to train on datasets/flood."
        )
    if path.endswith(".keras"):
        import tensorflow as tf
        return ("keras", tf.keras.models.load_model(path))
    else:
        return ("joblib", joblib.load(path))


@lru_cache(maxsize=1)
def _load_rainfall_model():
    path = _find_model_file("lstm_model.joblib", "lstm_model.keras")
    if not path:
        raise ModelNotTrainedError(
            "Rainfall model not initialized. Run `python ml/train_rainfall_model.py` to train on datasets/rainfall."
        )
    if path.endswith(".keras"):
        import tensorflow as tf
        return ("keras", tf.keras.models.load_model(path))
    else:
        return ("joblib", joblib.load(path))


@lru_cache(maxsize=1)
def _load_rainfall_scaler():
    path = _find_model_file("rainfall_scaler.pkl")
    if not path:
        raise ModelNotTrainedError("Rainfall scaler not found. Run `python ml/train_rainfall_model.py`.")
    with open(path, "rb") as f:
        return pickle.load(f)


def predict_flood_image(image_bytes: bytes) -> tuple[str, float]:
    """Returns (label, confidence_percent) for a flood/no-flood image classification."""
    model_type, model = _load_flood_model()
    img = Image.open(io.BytesIO(image_bytes))

    if model_type == "keras":
        img_rgb = img.convert("RGB").resize(IMG_SIZE)
        arr = np.array(img_rgb, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)
        prob = float(model.predict(arr, verbose=0)[0][0])
    else:
        features = _extract_image_features(img)
        probs = model.predict_proba([features])[0]
        # class 1 = flood, class 0 = no_flood
        prob = float(probs[1]) if len(probs) > 1 else float(probs[0])

    label = "Flood" if prob >= 0.5 else "No Flood"
    confidence = prob if label == "Flood" else 1.0 - prob
    return label, round(confidence * 100, 2)


def predict_rainfall(recent_rainfall_mm: list[float]) -> tuple[float, list[float]]:
    """
    Given the last N days of rainfall (mm), predicts tomorrow's rainfall and the
    following 3 days.
    """
    model_type, model = _load_rainfall_model()
    scaler = _load_rainfall_scaler()

    window = list(recent_rainfall_mm[-RAINFALL_WINDOW:])
    if len(window) < RAINFALL_WINDOW:
        raise ValueError(f"Need at least {RAINFALL_WINDOW} days of rainfall history")

    scaled = scaler.transform(np.array(window).reshape(-1, 1)).flatten()

    if model_type == "keras":
        current_window = window[:]
        predictions = []
        for _ in range(4):
            scaled_w = scaler.transform(np.array(current_window).reshape(-1, 1)).flatten()
            x = scaled_w.reshape(1, RAINFALL_WINDOW, 1)
            pred_scaled = model.predict(x, verbose=0)[0][0]
            pred_mm = float(scaler.inverse_transform([[pred_scaled]])[0][0])
            pred_mm = max(0.0, pred_mm)
            predictions.append(round(pred_mm, 2))
            current_window = current_window[1:] + [pred_mm]
    else:
        pred_scaled = model.predict([scaled])[0]  # array of 4 scaled predictions
        pred_mm = scaler.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()
        predictions = [round(max(0.0, float(v)), 2) for v in pred_mm]

    tomorrow = predictions[0]
    next_3_days = predictions[1:]
    return tomorrow, next_3_days
