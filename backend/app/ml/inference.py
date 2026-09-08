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
    Evaluates disaster risk model on attributes from datasets/disaster_attributes/historical_flood_attributes.csv.
    Seamlessly supports both drone reconnaissance and meteorological/hydrological telemetry.
    """
    model_bundle = _load_disaster_risk_model()
    scaler = model_bundle["scaler"]
    feature_names = model_bundle.get("feature_names", [])
    level_clf = model_bundle["level_classifier"]
    flood_clf = model_bundle["flood_classifier"]
    regressor = model_bundle["regressor"]
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

    damage_map = {"Undamaged": 0, "Minor": 1, "Moderate": 2, "Severe": 3, "Destroyed": 4}
    road_map = {"Intact": 0, "Obstructed": 1, "Damaged": 2, "Blocked": 3}
    infra_map = {"Intact": 0, "Damaged": 1, "Severely Damaged": 2}

    if "building_damage_level" in attrs and attrs["building_damage_level"] is not None:
        bld = int(damage_map.get(attrs["building_damage_level"], 0))
    elif rain72 > 250 or water > 6.0:
        bld = 3
    elif rain72 > 100 or water > 3.0:
        bld = 2
    else:
        bld = 0

    if "road_condition" in attrs and attrs["road_condition"] is not None:
        road = int(road_map.get(attrs["road_condition"], 0))
    elif rain72 > 250 or water > 6.0:
        road = 3
    elif rain72 > 100 or water > 3.0:
        road = 2
    else:
        road = 0

    if "infrastructure_status" in attrs and attrs["infrastructure_status"] is not None:
        infra = int(infra_map.get(attrs["infrastructure_status"], 0))
    elif rain72 > 250 or water > 6.0:
        infra = 2
    elif rain72 > 100 or water > 3.0:
        infra = 1
    else:
        infra = 0

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

    if water >= 4.0 or rain72 >= 300 or river >= 6.0:
        lvl = "Critical" if (score >= 70.0 or water >= 6.0) else "High"
        flood_prob = max(flood_prob, 0.85)
        score = max(score, 72.0)
    elif rain72 == 0 and water <= 1.5 and bld == 0 and river <= 1.5:
        lvl = "Low"
        flood_prob = min(flood_prob, 0.30)
        score = min(score, 25.0)

    flood_pred = bool(flood_prob >= 0.5)

    clean_inputs = {
        "temperature": temp,
        "humidity": hum,
        "wind_speed": wind,
        "water_level": water,
        "air_quality_index": aqi,
        "building_damage_rank": bld,
        "road_condition_rank": road,
        "infrastructure_status_rank": infra,
    }

    return {
        "risk_score": round(score, 1),
        "risk_level": lvl,
        "flood_probability": round(flood_prob * 100, 2),
        "flood_predicted": flood_pred,
        "contributing_factors": importances,
        "input_attributes": clean_inputs,
    }


@lru_cache(maxsize=1)
def _load_disasterscope_model():
    path = _find_model_file("disasterscope_model.joblib")
    if not path:
        raise ModelNotTrainedError(
            "DisasterScope reconnaissance model not trained. Run `python ml/train_disasterscope_model.py`."
        )
    return joblib.load(path)


def predict_disaster_scope(telemetry: dict) -> dict:
    """
    Evaluates DisasterScope multi-target model from drone/aerial reconnaissance telemetry.
    Predicts:
    1. Disaster Severity Level ('Low', 'Medium', 'High') + class probabilities
    2. Affected Area Type ('Unblocked', 'Flooded', 'Fire-Damaged', 'Collapsed Structure') + probabilities
    3. Immediate Action Required ('Yes', 'No') + probability
    4. Survivor Presence Likelihood ('Low', 'High') + probability
    """
    bundle = _load_disasterscope_model()
    scaler = bundle["scaler"]
    feature_names = bundle["feature_names"]
    damage_map = bundle.get("damage_map", {"Undamaged": 0, "Minor": 1, "Moderate": 2, "Severe": 3, "Destroyed": 4})
    road_map = bundle.get("road_map", {"Intact": 0, "Obstructed": 1, "Damaged": 2, "Blocked": 3})
    infra_map = bundle.get("infra_map", {"Intact": 0, "Damaged": 1, "Severely Damaged": 2})
    models = bundle["models"]
    feature_importances = bundle.get("feature_importances", {})

    temp = float(telemetry.get("temperature", 25.0))
    hum = float(telemetry.get("humidity", 60.0))
    wind = float(telemetry.get("wind_speed", 10.0))
    aqi = float(telemetry.get("air_quality_index", 120.0))
    water = float(telemetry.get("water_level", 0.5))
    veg = float(telemetry.get("vegetation_cover", 50.0))
    people = int(telemetry.get("people_detected", 0))
    heat = int(telemetry.get("heat_signatures", 0))
    hazmat = int(telemetry.get("hazardous_material_detected", 0))

    bld_str = str(telemetry.get("building_damage_level", "Undamaged"))
    road_str = str(telemetry.get("road_condition", "Intact"))
    infra_str = str(telemetry.get("infrastructure_status", "Intact"))

    bld_rank = int(damage_map.get(bld_str, 0))
    road_rank = int(road_map.get(road_str, 0))
    infra_rank = int(infra_map.get(infra_str, 0))

    structural_stress = (bld_rank + road_rank + infra_rank) / 9.0
    life_safety_risk = (people * (heat + 1)) * (1.0 + hazmat)
    env_hazard_idx = (water / 5.0) * 0.4 + (aqi / 500.0) * 0.4 + (wind / 50.0) * 0.2

    import pandas as pd
    feat_values = [
        temp, hum, wind, aqi, water, veg, people, heat, hazmat,
        bld_rank, road_rank, infra_rank, structural_stress, life_safety_risk, env_hazard_idx
    ]
    x_df = pd.DataFrame([feat_values], columns=feature_names)
    x_scaled = scaler.transform(x_df)

    # Predictions and probabilities
    sev_clf = models["disaster_severity_level"]
    sev_pred = str(sev_clf.predict(x_scaled)[0])
    sev_probs = {str(c): round(float(p) * 100, 1) for c, p in zip(sev_clf.classes_, sev_clf.predict_proba(x_scaled)[0])}

    area_clf = models["affected_area_type"]
    area_pred = str(area_clf.predict(x_scaled)[0])
    area_probs = {str(c): round(float(p) * 100, 1) for c, p in zip(area_clf.classes_, area_clf.predict_proba(x_scaled)[0])}

    act_clf = models["immediate_action_required"]
    act_pred = str(act_clf.predict(x_scaled)[0])
    act_probs = {str(c): float(p) for c, p in zip(act_clf.classes_, act_clf.predict_proba(x_scaled)[0])}
    act_prob_yes = round(act_probs.get("Yes", 0.0) * 100, 1)

    surv_clf = models["survivor_presence_likelihood"]
    surv_pred = str(surv_clf.predict(x_scaled)[0])
    surv_probs = {str(c): float(p) for c, p in zip(surv_clf.classes_, surv_clf.predict_proba(x_scaled)[0])}
    surv_prob_high = round(surv_probs.get("High", 0.0) * 100, 1)

    # Urgency score (0-100)
    urgency = (
        (30.0 if sev_pred == "High" else 15.0 if sev_pred == "Medium" else 5.0)
        + (35.0 * (act_prob_yes / 100.0))
        + (20.0 * (surv_prob_high / 100.0))
        + (15.0 * structural_stress)
    )
    urgency = min(100.0, max(0.0, urgency))

    # Actionable recommendations
    recs = []
    if act_pred == "Yes" or act_prob_yes > 40:
        recs.append("Dispatch emergency rapid-response teams immediately to coordinates.")
    if hazmat == 1:
        recs.append("Hazardous materials detected: Equip first responders with Level B HAZMAT protective gear.")
    if surv_pred == "High" or surv_prob_high > 40:
        recs.append("High likelihood of survivors: prioritize acoustic sensors and thermal search-and-rescue.")
    if area_pred == "Flooded":
        recs.append("Inundation zone: mobilize inflatable rescue boats and amphibious extraction units.")
    elif area_pred == "Fire-Damaged":
        recs.append("Fire perimeter: deploy aerial suppression and inspect structural thermal containment.")
    elif area_pred == "Collapsed Structure":
        recs.append("Structural collapse: deploy canine SAR units and heavy shoring equipment.")
    if not recs:
        recs.append("Area status nominal: maintain scheduled reconnaissance drone surveillance.")

    return {
        "disaster_severity_level": sev_pred,
        "severity_probabilities": sev_probs,
        "affected_area_type": area_pred,
        "area_type_probabilities": area_probs,
        "immediate_action_required": act_pred,
        "immediate_action_probability": act_prob_yes,
        "survivor_presence_likelihood": surv_pred,
        "survivor_probability": surv_prob_high,
        "urgency_score": round(urgency, 1),
        "recommendations": recs,
        "input_telemetry": {
            "temperature": temp,
            "humidity": hum,
            "wind_speed": wind,
            "air_quality_index": aqi,
            "water_level": water,
            "vegetation_cover": veg,
            "people_detected": people,
            "heat_signatures": heat,
            "hazardous_material_detected": hazmat,
            "building_damage_level": bld_str,
            "road_condition": road_str,
            "infrastructure_status": infra_str,
        },
        "feature_importances": feature_importances.get("disaster_severity_level", {}),
    }

