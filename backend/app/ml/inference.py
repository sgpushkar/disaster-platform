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


@lru_cache(maxsize=1)
def _load_disaster_risk_model():
    path = _find_model_file("disaster_risk_model.joblib")
    if not path:
        raise ModelNotTrainedError(
            "Disaster attribute risk model not trained. Run `python ml/train_disaster_risk_model.py`."
        )
    return joblib.load(path)


def predict_disaster_risk_from_attributes(attrs: dict) -> dict:
    """
    Evaluates unified disaster risk model on attributes from DisasterScope (61K records).
    Supports comprehensive environmental and meteorological telemetry.
    """
    model_bundle = _load_disaster_risk_model()
    scaler = model_bundle["scaler"]
    feature_names = model_bundle.get("feature_names", [])
    level_clf = model_bundle["level_classifier"]
    flood_clf = model_bundle["flood_classifier"]
    regressor = model_bundle["regressor"]
    sev_clf = model_bundle.get("severity_classifier")
    area_clf = model_bundle.get("area_classifier")
    act_clf = model_bundle.get("action_classifier")
    surv_clf = model_bundle.get("survivor_classifier")
    importances = model_bundle.get("feature_importances", {})

    temp = float(attrs.get("temperature", attrs.get("temperature_c", 25.0)) or 25.0)
    hum = float(attrs.get("humidity", attrs.get("humidity_pct", 60.0)) or 60.0)
    if "wind_speed" in attrs and attrs["wind_speed"] is not None:
        wind = float(attrs["wind_speed"])
    elif "wind_speed_ms" in attrs and attrs["wind_speed_ms"] is not None:
        wind = float(attrs["wind_speed_ms"]) * 3.6
    else:
        wind = 12.0

    rain24 = float(attrs.get("rainfall_24h_mm", 0.0) or 0.0)
    rain72 = float(attrs.get("rainfall_72h_mm", 0.0) or 0.0)
    river = float(attrs.get("river_water_level_m", 0.0) or 0.0)
    if "water_level" in attrs and attrs["water_level"] is not None:
        water = float(attrs["water_level"])
    elif river > 0:
        water = river
    elif rain72 > 0:
        water = float(np.clip(rain72 / 60.0, 0.0, 10.0))
    else:
        water = 0.5

    aqi = float(attrs.get("air_quality_index", 120.0) or 120.0)
    veg = float(attrs.get("vegetation_cover", 50.0) or 50.0)
    people = int(attrs.get("people_detected", 0) or 0)
    heat = int(attrs.get("heat_signatures", 0) or 0)
    hazmat = int(attrs.get("hazardous_material_detected", 0) or 0)

    damage_map = model_bundle.get("damage_map", {"Undamaged": 0, "Minor": 1, "Moderate": 2, "Severe": 3, "Destroyed": 4})
    road_map = model_bundle.get("road_map", {"Intact": 0, "Obstructed": 1, "Damaged": 2, "Blocked": 3})
    infra_map = model_bundle.get("infra_map", {"Intact": 0, "Damaged": 1, "Severely Damaged": 2})

    bld_raw = attrs.get("building_damage_level")
    if bld_raw is not None and str(bld_raw) in damage_map:
        bld = int(damage_map[str(bld_raw)])
        bld_str = str(bld_raw)
    elif rain72 > 250 or water > 6.0:
        bld = 3
        bld_str = "Severe"
    elif rain72 > 100 or water > 3.0:
        bld = 2
        bld_str = "Moderate"
    else:
        bld = 0
        bld_str = "Undamaged"

    road_raw = attrs.get("road_condition")
    if road_raw is not None and str(road_raw) in road_map:
        road = int(road_map[str(road_raw)])
        road_str = str(road_raw)
    elif rain72 > 250 or water > 6.0:
        road = 3
        road_str = "Blocked"
    elif rain72 > 100 or water > 3.0:
        road = 2
        road_str = "Damaged"
    else:
        road = 0
        road_str = "Intact"

    infra_raw = attrs.get("infrastructure_status")
    if infra_raw is not None and str(infra_raw) in infra_map:
        infra = int(infra_map[str(infra_raw)])
        infra_str = str(infra_raw)
    elif rain72 > 250 or water > 6.0:
        infra = 2
        infra_str = "Severely Damaged"
    elif rain72 > 100 or water > 3.0:
        infra = 1
        infra_str = "Damaged"
    else:
        infra = 0
        infra_str = "Intact"

    stress = (bld + road + infra) / 9.0
    life = (people * (heat + 1)) * (1.0 + hazmat)
    env = (min(water, 5.0) / 5.0) * 0.4 + (aqi / 500.0) * 0.4 + (wind / 50.0) * 0.2

    feats = [temp, hum, wind, aqi, water, veg, people, heat, hazmat, bld, road, infra, stress, life, env]
    import pandas as pd
    x_df = pd.DataFrame([feats], columns=feature_names)
    x_scaled = scaler.transform(x_df)

    score = float(np.clip(regressor.predict(x_scaled)[0], 0.0, 100.0))
    lvl = str(level_clf.predict(x_scaled)[0])
    flood_prob = float(flood_clf.predict_proba(x_scaled)[0][1])

    # Severity level
    if sev_clf is not None:
        sev_pred = str(sev_clf.predict(x_scaled)[0])
        sev_probs = {str(c): round(float(p) * 100, 1) for c, p in zip(sev_clf.classes_, sev_clf.predict_proba(x_scaled)[0])}
    else:
        sev_pred = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
        sev_probs = {"Low": 20.0, "Medium": 30.0, "High": 50.0}

    # Area type
    if area_clf is not None:
        area_pred = str(area_clf.predict(x_scaled)[0])
        area_probs = {str(c): round(float(p) * 100, 1) for c, p in zip(area_clf.classes_, area_clf.predict_proba(x_scaled)[0])}
    else:
        area_pred = "Flooded" if water > 1.5 else "Unblocked"
        area_probs = {area_pred: 80.0}

    # Immediate action required
    if act_clf is not None:
        act_pred = str(act_clf.predict(x_scaled)[0])
        act_probs = {str(c): float(p) for c, p in zip(act_clf.classes_, act_clf.predict_proba(x_scaled)[0])}
        act_prob_yes = round(act_probs.get("Yes", 0.0) * 100, 1)
    else:
        act_pred = "Yes" if score >= 60 else "No"
        act_prob_yes = round(score, 1)

    # Survivor presence likelihood
    if surv_clf is not None:
        surv_pred = str(surv_clf.predict(x_scaled)[0])
        surv_probs = {str(c): float(p) for c, p in zip(surv_clf.classes_, surv_clf.predict_proba(x_scaled)[0])}
        surv_prob_high = round(surv_probs.get("High", 0.0) * 100, 1)
    else:
        surv_pred = "High" if people > 0 else "Low"
        surv_prob_high = 80.0 if people > 0 else 10.0

    # Calibrated physical constraints for high water or dry baseline
    if water >= 4.0 or rain72 >= 300 or river >= 6.0:
        lvl = "Critical" if (score >= 70.0 or water >= 6.0) else "High"
        flood_prob = max(flood_prob, 0.85)
        score = max(score, 72.0)
        sev_pred = "High"
        area_pred = "Flooded"
        act_pred = "Yes"
        act_prob_yes = max(act_prob_yes, 85.0)
    elif rain72 == 0 and water <= 1.5 and bld == 0 and river <= 1.5 and people == 0 and hazmat == 0:
        lvl = "Low"
        flood_prob = min(flood_prob, 0.30)
        score = min(score, 25.0)

    flood_pred = bool(flood_prob >= 0.5)

    # Tactical recommendations based on predictions
    recs = []
    if act_pred == "Yes" or act_prob_yes > 50 or score >= 65:
        recs.append("Dispatch emergency rapid-response teams immediately to coordinates.")
    if hazmat == 1:
        recs.append("Hazardous materials detected: Equip first responders with Level B HAZMAT protective gear.")
    if surv_pred == "High" or people > 0:
        recs.append(f"Person(s) detected in risk sector ({people} located): Prioritize search-and-rescue.")
    if area_pred == "Flooded" or water >= 1.5 or flood_pred:
        recs.append("Flood inundation zone: Mobilize inflatable rescue vessels and deploy flood barriers.")
    elif area_pred == "Fire-Damaged":
        recs.append("Wildfire hazard: Deploy aerial suppression and inspect thermal perimeter containment.")
    elif area_pred == "Collapsed Structure" or bld >= 3:
        recs.append("Severe structural damage: Deploy canine SAR units and heavy shoring equipment.")
    if not recs:
        recs.append("Area status nominal: Maintain continuous ambient environmental monitoring.")

    clean_inputs = {
        "temperature": temp,
        "humidity": hum,
        "wind_speed": wind,
        "water_level": water,
        "air_quality_index": aqi,
        "vegetation_cover": veg,
        "people_detected": people,
        "heat_signatures": heat,
        "hazardous_material_detected": hazmat,
        "building_damage_level": bld_str,
        "road_condition": road_str,
        "infrastructure_status": infra_str,
        "building_damage_rank": bld,
        "road_condition_rank": road,
        "infrastructure_status_rank": infra,
    }

    dataset_benchmarks = {
        "dataset_name": "DisasterScope 61K Benchmark",
        "dataset_source": "datasets/disaster_attributes/historical_flood_attributes.csv",
        "total_records": 61368,
        "attributes": [
            {
                "key": "temperature",
                "label": "Temperature",
                "current_value": round(temp, 1),
                "unit": "°C",
                "dataset_mean": 25.0,
                "dataset_min": 15.0,
                "dataset_max": 40.0,
                "status": "Elevated Heat" if temp > 30.0 else "Normal Ambient" if temp >= 20.0 else "Cool",
            },
            {
                "key": "humidity",
                "label": "Humidity",
                "current_value": round(hum, 1),
                "unit": "%",
                "dataset_mean": 62.5,
                "dataset_min": 30.0,
                "dataset_max": 90.0,
                "status": "High (Saturated)" if hum > 75.0 else "Moderate" if hum >= 50.0 else "Dry",
            },
            {
                "key": "wind_speed",
                "label": "Wind Speed",
                "current_value": round(wind, 1),
                "unit": "km/h",
                "dataset_mean": 11.2,
                "dataset_min": 0.0,
                "dataset_max": 50.0,
                "status": "Storm Force" if wind > 30.0 else "Breezy" if wind > 15.0 else "Calm",
            },
            {
                "key": "water_level",
                "label": "Inundation / Water Level",
                "current_value": round(water, 2),
                "unit": "m",
                "dataset_mean": 0.91,
                "dataset_min": 0.0,
                "dataset_max": 5.0,
                "status": "Surge Danger" if water > 2.0 else "Elevated" if water > 1.0 else "Safe Baseline",
            },
            {
                "key": "air_quality_index",
                "label": "Air Quality (AQI)",
                "current_value": round(aqi, 0),
                "unit": "AQI",
                "dataset_mean": 167.9,
                "dataset_min": 50.0,
                "dataset_max": 500.0,
                "status": "Hazardous" if aqi > 300.0 else "Unhealthy" if aqi > 150.0 else "Moderate / Clean",
            },
        ],
        "historical_severity_distribution": {
            "Low": 60.0,
            "Medium": 30.0,
            "High": 10.0,
        },
    }

    return {
        "risk_score": round(score, 1),
        "risk_level": lvl,
        "flood_probability": round(flood_prob * 100, 2),
        "flood_predicted": flood_pred,
        "disaster_severity_level": sev_pred,
        "severity_probabilities": sev_probs,
        "affected_area_type": area_pred,
        "area_type_probabilities": area_probs,
        "immediate_action_required": act_pred,
        "immediate_action_probability": act_prob_yes,
        "survivor_presence_likelihood": surv_pred,
        "survivor_probability": surv_prob_high,
        "urgency_score": round(score, 1),
        "recommendations": recs,
        "contributing_factors": importances,
        "input_attributes": clean_inputs,
        "input_telemetry": clean_inputs,
        "dataset_benchmarks": dataset_benchmarks,
    }


@lru_cache(maxsize=1)
def _load_disasterscope_model():
    bundle = _load_disaster_risk_model()
    bundle_compat = dict(bundle)
    bundle_compat["models"] = {
        "disaster_severity_level": bundle.get("severity_classifier") or bundle.get("level_classifier"),
        "affected_area_type": bundle.get("area_classifier"),
        "immediate_action_required": bundle.get("action_classifier"),
        "survivor_presence_likelihood": bundle.get("survivor_classifier"),
    }
    return bundle_compat


def predict_disaster_scope(telemetry: dict) -> dict:
    """
    Evaluates unified disaster model directly using telemetry attributes from disasterscope.csv.
    Maintains full compatibility without maintaining separate duplicate functions.
    """
    return predict_disaster_risk_from_attributes(telemetry)


