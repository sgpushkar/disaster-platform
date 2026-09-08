"""
Trains calibrated Machine Learning models on historical disaster & flood attributes.

Outputs:
    ml/models/disaster_risk_model.joblib
    backend/models/disaster_risk_model.joblib

The saved artifact bundle contains:
    - Feature transformer / scaler
    - Risk Level & Flood Classifier (Random Forest + Gradient Boosting ensemble)
    - Continuous Risk Score Regressor
    - Feature importance rankings and validation metrics
"""
import os
import shutil
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, VotingClassifier
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score, mean_absolute_error, r2_score

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "disaster_attributes", "historical_flood_attributes.csv")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "models")
BACKEND_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "models")

BASE_FEATURES = [
    "rainfall_24h_mm",
    "rainfall_72h_mm",
    "humidity_pct",
    "temperature_c",
    "wind_speed_ms",
    "pressure_hpa",
    "soil_moisture_pct",
    "river_water_level_m",
    "drainage_capacity_index",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Computes meteorological depression and hydrological saturation interaction terms."""
    df_feat = df[BASE_FEATURES].copy()
    # 1. Barometric depression drop (lower pressure -> storm / cyclonic depression)
    df_feat["pressure_drop"] = np.maximum(0.0, 1013.25 - df_feat["pressure_hpa"])
    # 2. Cumulative precipitation vs drainage throughput
    drainage = np.clip(df_feat["drainage_capacity_index"], 0.1, 1.0)
    df_feat["rain_per_drainage"] = df_feat["rainfall_72h_mm"] / drainage
    # 3. Hydro-saturation index: combined soil moisture and river water level
    df_feat["saturation_index"] = (df_feat["soil_moisture_pct"] / 100.0) * (df_feat["river_water_level_m"] / 10.0)
    return df_feat


def main():
    if not os.path.exists(DATA_PATH):
        raise SystemExit(f"Dataset not found at {DATA_PATH}. Run generator first.")

    print(f"Loading historical disaster attributes from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"Total historical records: {len(df)}")

    X_raw = engineer_features(df)
    feature_names = list(X_raw.columns)

    y_occurred = df["flood_occurred"].values
    y_level = df["risk_level"].values
    y_score = df["risk_score"].values

    # Stratified split based on risk_level
    (
        X_train, X_test,
        y_occ_train, y_occ_test,
        y_lvl_train, y_lvl_test,
        y_score_train, y_score_test
    ) = train_test_split(
        X_raw, y_occurred, y_level, y_score,
        test_size=0.20,
        random_state=42,
        stratify=y_level
    )

    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # 1. Scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 2. Risk Level Classification Model (Ensemble RF + GBDT)
    print("\n--- Training Risk Level Classifier ---")
    clf_rf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    clf_gb = GradientBoostingClassifier(n_estimators=100, learning_rate=0.08, max_depth=4, random_state=42)
    level_classifier = VotingClassifier(
        estimators=[("rf", clf_rf), ("gb", clf_gb)],
        voting="soft"
    )
    level_classifier.fit(X_train_scaled, y_lvl_train)

    lvl_preds = level_classifier.predict(X_test_scaled)
    acc = accuracy_score(y_lvl_test, lvl_preds)
    print(f"Risk Level Classification Accuracy: {acc * 100:.2f}%")
    print(classification_report(y_lvl_test, lvl_preds, digits=3))

    # 3. Binary Flood Occurrence Classifier
    print("--- Training Binary Flood Occurrence Classifier ---")
    flood_classifier = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    flood_classifier.fit(X_train_scaled, y_occ_train)
    occ_probs = flood_classifier.predict_proba(X_test_scaled)[:, 1]
    roc_auc = roc_auc_score(y_occ_test, occ_probs)
    print(f"Flood Occurrence ROC-AUC: {roc_auc:.4f}")

    # 4. Continuous Risk Score Regressor (0 - 100)
    print("\n--- Training Continuous Risk Score Regressor ---")
    regressor = RandomForestRegressor(n_estimators=120, max_depth=12, random_state=42)
    regressor.fit(X_train_scaled, y_score_train)

    score_preds = regressor.predict(X_test_scaled)
    mae = mean_absolute_error(y_score_test, score_preds)
    r2 = r2_score(y_score_test, score_preds)
    print(f"Risk Score MAE: {mae:.2f} points | R^2: {r2:.4f}")

    # Compute Feature Importances (from the random forest regressor)
    importances = regressor.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    importance_dict = {feature_names[i]: round(float(importances[i] * 100), 2) for i in sorted_idx}
    print("\nFeature Importance Breakdown:")
    for feat, imp in importance_dict.items():
        print(f"  - {feat:25s}: {imp:5.2f}%")

    # Bundle models & artifacts
    model_bundle = {
        "scaler": scaler,
        "feature_names": feature_names,
        "base_features": BASE_FEATURES,
        "level_classifier": level_classifier,
        "flood_classifier": flood_classifier,
        "regressor": regressor,
        "classes": list(level_classifier.classes_),
        "feature_importances": importance_dict,
        "metrics": {
            "level_accuracy": round(float(acc), 4),
            "flood_roc_auc": round(float(roc_auc), 4),
            "score_mae": round(float(mae), 4),
            "score_r2": round(float(r2), 4),
        }
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(BACKEND_OUTPUT_DIR, exist_ok=True)

    out_file = os.path.join(OUTPUT_DIR, "disaster_risk_model.joblib")
    backend_out_file = os.path.join(BACKEND_OUTPUT_DIR, "disaster_risk_model.joblib")

    joblib.dump(model_bundle, out_file)
    shutil.copy2(out_file, backend_out_file)

    print(f"\n[OK] Model successfully trained & saved to:")
    print(f"  -> {out_file}")
    print(f"  -> {backend_out_file}")


if __name__ == "__main__":
    main()
