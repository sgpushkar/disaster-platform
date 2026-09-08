"""
Trains calibrated Machine Learning models on historical disaster & flood attributes
from the DisasterScope attributes dataset (datasets/disaster_attributes/historical_flood_attributes.csv).

Outputs:
    ml/models/disaster_risk_model.joblib
    backend/models/disaster_risk_model.joblib

Artifact bundle:
    - StandardScaler
    - Risk Level Classifier (Random Forest predicting Low / Moderate / High / Critical)
    - Flood Occurrence Classifier (Random Forest predicting binary 0 / 1 with probability)
    - Continuous Risk Score Regressor (Random Forest predicting 0.0 - 100.0)
    - Feature importances and evaluation metrics
"""

import os
import shutil
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score, mean_absolute_error, r2_score

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "disaster_attributes", "historical_flood_attributes.csv")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "models")
BACKEND_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "models")

DAMAGE_MAP = {"Undamaged": 0, "Minor": 1, "Moderate": 2, "Severe": 3, "Destroyed": 4}
ROAD_MAP = {"Intact": 0, "Obstructed": 1, "Damaged": 2, "Blocked": 3}
INFRA_MAP = {"Intact": 0, "Damaged": 1, "Severely Damaged": 2}

FEATURE_COLS = [
    "temperature",
    "humidity",
    "wind_speed",
    "air_quality_index",
    "water_level",
    "vegetation_cover",
    "people_detected",
    "heat_signatures",
    "hazardous_material_detected",
    "building_damage_rank",
    "road_condition_rank",
    "infrastructure_status_rank",
    "structural_stress_index",
    "life_safety_risk_index",
    "environmental_hazard_index",
]


def load_and_preprocess(csv_path: str = DATA_PATH) -> tuple[pd.DataFrame, pd.Series, pd.Series, pd.Series]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    print(f"Loading disaster attributes from: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df):,} records with columns: {list(df.columns)}")

    # Ordinal mappings
    df["building_damage_rank"] = df["building_damage_level"].map(DAMAGE_MAP).fillna(0).astype(int)
    df["road_condition_rank"] = df["road_condition"].map(ROAD_MAP).fillna(0).astype(int)
    df["infrastructure_status_rank"] = df["infrastructure_status"].map(INFRA_MAP).fillna(0).astype(int)

    # Engineered telemetry indicators
    df["structural_stress_index"] = (
        df["building_damage_rank"] + df["road_condition_rank"] + df["infrastructure_status_rank"]
    ) / 9.0

    df["life_safety_risk_index"] = (
        df["people_detected"] * (df["heat_signatures"] + 1)
    ) * (1.0 + df["hazardous_material_detected"])

    df["environmental_hazard_index"] = (
        (df["water_level"] / 5.0) * 0.4
        + (df["air_quality_index"] / 500.0) * 0.4
        + (df["wind_speed"] / 50.0) * 0.2
    )

    # Ground-truth targets
    def map_risk_level(r):
        sev = r["disaster_severity_level"]
        if sev == "High":
            return "Critical" if (r["hazardous_material_detected"] == 1 or r["building_damage_rank"] >= 3) else "High"
        elif sev == "Medium":
            return "Moderate"
        return "Low"

    df["risk_level"] = df.apply(map_risk_level, axis=1)

    # Flood occurrence: flood area type or substantial water accumulation
    df["flood_occurred"] = (
        (df["affected_area_type"] == "Flooded") | (df["water_level"] >= 1.5)
    ).astype(int)

    # Continuous risk score (0-100)
    base_sev = df["disaster_severity_level"].map({"Low": 18.0, "Medium": 48.0, "High": 76.0})
    stress_term = df["structural_stress_index"] * 12.0
    water_term = np.clip(df["water_level"] / 5.0 * 8.0, 0, 8.0)
    haz_term = df["hazardous_material_detected"] * 8.0
    df["risk_score"] = np.clip(base_sev + stress_term + water_term + haz_term, 0.0, 100.0)

    return df[FEATURE_COLS], df["risk_level"], df["flood_occurred"], df["risk_score"]


def main():
    X, y_level, y_flood, y_score = load_and_preprocess()

    (
        X_train, X_test,
        y_lvl_train, y_lvl_test,
        y_fld_train, y_fld_test,
        y_sc_train, y_sc_test,
    ) = train_test_split(
        X, y_level, y_flood, y_score,
        test_size=0.20,
        random_state=42,
        stratify=y_level,
    )

    print(f"Train samples: {len(X_train):,} | Test samples: {len(X_test):,}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. Risk Level Classifier
    print("\n--- Training Risk Level Classifier ---")
    level_clf = RandomForestClassifier(n_estimators=40, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    level_clf.fit(X_train_scaled, y_lvl_train)
    lvl_preds = level_clf.predict(X_test_scaled)
    acc = accuracy_score(y_lvl_test, lvl_preds)
    print(f"Risk Level Accuracy: {acc * 100:.2f}%")
    print(classification_report(y_lvl_test, lvl_preds, digits=3, zero_division=0))

    # 2. Flood Occurrence Classifier
    print("--- Training Flood Occurrence Classifier ---")
    flood_clf = RandomForestClassifier(n_estimators=40, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    flood_clf.fit(X_train_scaled, y_fld_train)
    fld_probs = flood_clf.predict_proba(X_test_scaled)[:, 1]
    roc_auc = roc_auc_score(y_fld_test, fld_probs)
    print(f"Flood Occurrence ROC-AUC: {roc_auc:.4f}")

    # 3. Continuous Risk Score Regressor
    print("\n--- Training Continuous Risk Score Regressor ---")
    regressor = RandomForestRegressor(n_estimators=40, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    regressor.fit(X_train_scaled, y_sc_train)
    sc_preds = regressor.predict(X_test_scaled)
    mae = mean_absolute_error(y_sc_test, sc_preds)
    r2 = r2_score(y_sc_test, sc_preds)
    print(f"Risk Score MAE: {mae:.2f} points | R^2: {r2:.4f}")

    # Importances
    importances = regressor.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    importance_dict = {FEATURE_COLS[i]: round(float(importances[i] * 100), 2) for i in sorted_idx}

    model_bundle = {
        "scaler": scaler,
        "feature_names": FEATURE_COLS,
        "base_features": FEATURE_COLS,
        "level_classifier": level_clf,
        "flood_classifier": flood_clf,
        "regressor": regressor,
        "classes": list(level_clf.classes_),
        "feature_importances": importance_dict,
        "metrics": {
            "level_accuracy": round(float(acc), 4),
            "flood_roc_auc": round(float(roc_auc), 4),
            "score_mae": round(float(mae), 4),
            "score_r2": round(float(r2), 4),
        },
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(BACKEND_OUTPUT_DIR, exist_ok=True)

    out_file = os.path.join(OUTPUT_DIR, "disaster_risk_model.joblib")
    backend_out_file = os.path.join(BACKEND_OUTPUT_DIR, "disaster_risk_model.joblib")

    joblib.dump(model_bundle, out_file, compress=3)
    shutil.copy2(out_file, backend_out_file)

    print(f"\n[OK] Trained Disaster Risk Model saved to:")
    print(f"  -> {out_file} ({os.path.getsize(out_file):,} bytes)")
    print(f"  -> {backend_out_file}")


if __name__ == "__main__":
    main()
