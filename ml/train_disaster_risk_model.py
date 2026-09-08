"""
Trains calibrated Machine Learning models on historical disaster & hazard attributes
from the DisasterScope attributes dataset (datasets/disaster_attributes/historical_flood_attributes.csv).

Unified Artifact Bundle:
    - StandardScaler
    - Continuous Risk Score Regressor (Random Forest predicting 0.0 - 100.0)
    - Risk Level Classifier (Random Forest predicting Low / Moderate / High / Critical)
    - Flood Occurrence Classifier (Random Forest predicting binary 0 / 1 with probability)
    - Disaster Severity Classifier (Low / Medium / High)
    - Affected Area Type Classifier (Flooded / Fire-Damaged / Collapsed Structure / Unblocked)
    - Immediate Action Classifier (Yes / No)
    - Survivor Presence Likelihood Classifier (Low / High)
    - Feature importances and evaluation metrics

Outputs:
    ml/models/disaster_risk_model.joblib
    backend/models/disaster_risk_model.joblib
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
FALLBACK_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "disasterscope", "disasterscope.csv")
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


def load_and_preprocess(csv_path: str = DATA_PATH):
    if not os.path.exists(csv_path):
        if os.path.exists(FALLBACK_DATA_PATH):
            csv_path = FALLBACK_DATA_PATH
        else:
            raise FileNotFoundError(f"Dataset not found at {csv_path} or {FALLBACK_DATA_PATH}")

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

    y_dict = {
        "risk_level": df["risk_level"],
        "flood_occurred": df["flood_occurred"],
        "risk_score": df["risk_score"],
        "disaster_severity_level": df["disaster_severity_level"],
        "affected_area_type": df["affected_area_type"],
        "immediate_action_required": df["immediate_action_required"],
        "survivor_presence_likelihood": df["survivor_presence_likelihood"],
    }

    return df[FEATURE_COLS], y_dict, df


def main():
    X, targets, raw_df = load_and_preprocess()

    (
        X_train, X_test,
        y_lvl_tr, y_lvl_te,
        y_fld_tr, y_fld_te,
        y_sc_tr, y_sc_te,
        y_sev_tr, y_sev_te,
        y_area_tr, y_area_te,
        y_act_tr, y_act_te,
        y_surv_tr, y_surv_te,
    ) = train_test_split(
        X,
        targets["risk_level"],
        targets["flood_occurred"],
        targets["risk_score"],
        targets["disaster_severity_level"],
        targets["affected_area_type"],
        targets["immediate_action_required"],
        targets["survivor_presence_likelihood"],
        test_size=0.20,
        random_state=42,
        stratify=targets["risk_level"],
    )

    print(f"Train samples: {len(X_train):,} | Test samples: {len(X_test):,}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. Continuous Risk Score Regressor
    print("\n--- Training Continuous Risk Score Regressor ---")
    regressor = RandomForestRegressor(n_estimators=40, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    regressor.fit(X_train_scaled, y_sc_tr)
    sc_preds = regressor.predict(X_test_scaled)
    mae = mean_absolute_error(y_sc_te, sc_preds)
    r2 = r2_score(y_sc_te, sc_preds)
    print(f"Risk Score MAE: {mae:.2f} points | R^2: {r2:.4f}")

    # 2. Risk Level Classifier
    print("\n--- Training Risk Level Classifier ---")
    level_clf = RandomForestClassifier(n_estimators=40, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    level_clf.fit(X_train_scaled, y_lvl_tr)
    lvl_preds = level_clf.predict(X_test_scaled)
    acc = accuracy_score(y_lvl_te, lvl_preds)
    print(f"Risk Level Accuracy: {acc * 100:.2f}%")

    # 3. Flood Occurrence Classifier
    print("\n--- Training Flood Occurrence Classifier ---")
    flood_clf = RandomForestClassifier(n_estimators=40, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    flood_clf.fit(X_train_scaled, y_fld_tr)
    fld_probs = flood_clf.predict_proba(X_test_scaled)[:, 1]
    roc_auc = roc_auc_score(y_fld_te, fld_probs)
    print(f"Flood Occurrence ROC-AUC: {roc_auc:.4f}")

    # 4. Disaster Severity Classifier (Low, Medium, High)
    print("\n--- Training Disaster Severity Classifier ---")
    sev_clf = RandomForestClassifier(n_estimators=30, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    sev_clf.fit(X_train_scaled, y_sev_tr)
    sev_preds = sev_clf.predict(X_test_scaled)
    print(f"Disaster Severity Accuracy: {accuracy_score(y_sev_te, sev_preds) * 100:.2f}%")

    # 5. Affected Area Type Classifier
    print("\n--- Training Affected Area Type Classifier ---")
    area_clf = RandomForestClassifier(n_estimators=30, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    area_clf.fit(X_train_scaled, y_area_tr)
    area_preds = area_clf.predict(X_test_scaled)
    print(f"Affected Area Accuracy: {accuracy_score(y_area_te, area_preds) * 100:.2f}%")

    # 6. Immediate Action Classifier
    print("\n--- Training Immediate Action Classifier ---")
    act_clf = RandomForestClassifier(n_estimators=30, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    act_clf.fit(X_train_scaled, y_act_tr)
    act_preds = act_clf.predict(X_test_scaled)
    print(f"Immediate Action Accuracy: {accuracy_score(y_act_te, act_preds) * 100:.2f}%")

    # 7. Survivor Presence Classifier
    print("\n--- Training Survivor Presence Classifier ---")
    surv_clf = RandomForestClassifier(n_estimators=30, max_depth=10, min_samples_leaf=6, random_state=42, n_jobs=-1)
    surv_clf.fit(X_train_scaled, y_surv_tr)
    surv_preds = surv_clf.predict(X_test_scaled)
    print(f"Survivor Likelihood Accuracy: {accuracy_score(y_surv_te, surv_preds) * 100:.2f}%")

    # Feature Importances from regressor
    importances = regressor.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    importance_dict = {FEATURE_COLS[i]: round(float(importances[i] * 100), 2) for i in sorted_idx}

    # Precompute dataset benchmark metrics
    benchmarks = {
        "dataset_name": "DisasterScope Attributes (61K)",
        "dataset_source": "datasets/disaster_attributes/historical_flood_attributes.csv",
        "total_records": len(raw_df),
        "attribute_stats": {
            "temperature": {"mean": round(float(raw_df["temperature"].mean()), 1), "min": round(float(raw_df["temperature"].min()), 1), "max": round(float(raw_df["temperature"].max()), 1)},
            "humidity": {"mean": round(float(raw_df["humidity"].mean()), 1), "min": round(float(raw_df["humidity"].min()), 1), "max": round(float(raw_df["humidity"].max()), 1)},
            "wind_speed": {"mean": round(float(raw_df["wind_speed"].mean()), 1), "min": round(float(raw_df["wind_speed"].min()), 1), "max": round(float(raw_df["wind_speed"].max()), 1)},
            "air_quality_index": {"mean": round(float(raw_df["air_quality_index"].mean()), 1), "min": round(float(raw_df["air_quality_index"].min()), 1), "max": round(float(raw_df["air_quality_index"].max()), 1)},
            "water_level": {"mean": round(float(raw_df["water_level"].mean()), 2), "min": round(float(raw_df["water_level"].min()), 2), "max": round(float(raw_df["water_level"].max()), 2)},
            "vegetation_cover": {"mean": round(float(raw_df["vegetation_cover"].mean()), 1), "min": round(float(raw_df["vegetation_cover"].min()), 1), "max": round(float(raw_df["vegetation_cover"].max()), 1)},
        },
        "severity_distribution": {
            k: round(float(v), 2) for k, v in raw_df["disaster_severity_level"].value_counts(normalize=True).items()
        },
        "area_type_distribution": {
            k: round(float(v), 2) for k, v in raw_df["affected_area_type"].value_counts(normalize=True).items()
        }
    }

    model_bundle = {
        "scaler": scaler,
        "feature_names": FEATURE_COLS,
        "base_features": FEATURE_COLS,
        "damage_map": DAMAGE_MAP,
        "road_map": ROAD_MAP,
        "infra_map": INFRA_MAP,
        "level_classifier": level_clf,
        "flood_classifier": flood_clf,
        "regressor": regressor,
        "severity_classifier": sev_clf,
        "area_classifier": area_clf,
        "action_classifier": act_clf,
        "survivor_classifier": surv_clf,
        "classes": list(level_clf.classes_),
        "feature_importances": importance_dict,
        "benchmarks": benchmarks,
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

    print(f"\n[OK] Unified Disaster Risk Model saved to:")
    print(f"  -> {out_file} ({os.path.getsize(out_file):,} bytes)")
    print(f"  -> {backend_out_file}")


if __name__ == "__main__":
    main()
