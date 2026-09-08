"""
DisasterScope Reconnaissance ML Model Training Pipeline
Trained on the Kaggle DisasterScope Dataset (datasetengineer/disasterscope-dataset).

Multi-target supervised classification:
1. Disaster Severity Level ('Low', 'Medium', 'High')
2. Affected Area Hazard Type ('Unblocked', 'Flooded', 'Fire-Damaged', 'Collapsed Structure')
3. Immediate Action Required ('Yes', 'No')
4. Survivor Presence Likelihood ('Low', 'High')

Artifacts generated:
- ml/models/disasterscope_model.joblib
- backend/models/disasterscope_model.joblib
"""

import os
import shutil
from datetime import datetime
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATASET_PATH = os.path.join(PROJECT_ROOT, "datasets", "disasterscope", "disasterscope.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
BACKEND_MODELS_DIR = os.path.join(PROJECT_ROOT, "backend", "models")

# Mappings for categorical inputs
DAMAGE_MAP = {"Undamaged": 0, "Minor": 1, "Moderate": 2, "Severe": 3, "Destroyed": 4}
ROAD_MAP = {"Intact": 0, "Obstructed": 1, "Damaged": 2, "Blocked": 3}
INFRA_MAP = {"Intact": 0, "Damaged": 1, "Severely Damaged": 2}

NUMERICAL_FEATURES = [
    "temperature",
    "humidity",
    "wind_speed",
    "air_quality_index",
    "water_level",
    "vegetation_cover",
    "people_detected",
    "heat_signatures",
    "hazardous_material_detected",
]

FEATURE_COLS = NUMERICAL_FEATURES + [
    "building_damage_rank",
    "road_condition_rank",
    "infrastructure_status_rank",
    "structural_stress_index",
    "life_safety_risk_index",
    "environmental_hazard_index",
]


def load_and_preprocess_data(csv_path: str = DATASET_PATH) -> pd.DataFrame:
    """Loads and preprocesses the DisasterScope dataset."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Dataset not found at {csv_path}. Please run `python ml/download_disasterscope.py` first."
        )

    df = pd.read_csv(csv_path)
    print(f"[DisasterScope] Loaded dataset with {len(df):,} records and {len(df.columns)} columns.")

    # Convert categorical reconnaissance observations to ordinal ranks
    df["building_damage_rank"] = df["building_damage_level"].map(DAMAGE_MAP).fillna(0).astype(int)
    df["road_condition_rank"] = df["road_condition"].map(ROAD_MAP).fillna(0).astype(int)
    df["infrastructure_status_rank"] = df["infrastructure_status"].map(INFRA_MAP).fillna(0).astype(int)

    # Feature engineering for composite risk telemetry
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

    return df


def train_disasterscope_pipeline():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(BACKEND_MODELS_DIR, exist_ok=True)

    df = load_and_preprocess_data()
    X = df[FEATURE_COLS]

    targets = [
        "disaster_severity_level",
        "affected_area_type",
        "immediate_action_required",
        "survivor_presence_likelihood",
    ]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    models = {}
    metrics = {}
    feature_importances = {}

    print("\n" + "=" * 65)
    print(" TRAINING DISASTERSCOPE RECONNAISSANCE ENSEMBLE CLASSIFIERS")
    print("=" * 65)

    for target in targets:
        y = df[target]
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )

        clf = RandomForestClassifier(
            n_estimators=35,
            max_depth=10,
            min_samples_leaf=6,
            random_state=42,
            n_jobs=-1,
        )
        clf.fit(X_train, y_train)

        y_pred = clf.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        print(f"\n[Target: {target.upper()}]")
        print(f"Validation Accuracy: {acc * 100:.2f}%")
        print(classification_report(y_test, y_pred, digits=3, zero_division=0))

        models[target] = clf
        metrics[target] = {
            "accuracy": round(float(acc) * 100, 2),
            "classes": [str(c) for c in clf.classes_],
        }

        # Save feature importances
        target_importances = {
            feat: round(float(imp) * 100, 2)
            for feat, imp in zip(FEATURE_COLS, clf.feature_importances_)
        }
        feature_importances[target] = dict(
            sorted(target_importances.items(), key=lambda x: x[1], reverse=True)
        )

    # Serialize complete bundle
    bundle = {
        "feature_names": FEATURE_COLS,
        "numerical_features": NUMERICAL_FEATURES,
        "damage_map": DAMAGE_MAP,
        "road_map": ROAD_MAP,
        "infra_map": INFRA_MAP,
        "scaler": scaler,
        "models": models,
        "metrics": metrics,
        "feature_importances": feature_importances,
        "trained_at": datetime.utcnow().isoformat(),
        "dataset_rows": len(df),
    }

    target_path = os.path.join(MODELS_DIR, "disasterscope_model.joblib")
    joblib.dump(bundle, target_path, compress=3)
    print(f"\nSaved model artifact to: {target_path} ({os.path.getsize(target_path):,} bytes)")

    backend_target_path = os.path.join(BACKEND_MODELS_DIR, "disasterscope_model.joblib")
    shutil.copy2(target_path, backend_target_path)
    print(f"Synchronized artifact to backend: {backend_target_path}")

    print("\n" + "=" * 65)
    print(" DISASTERSCOPE RECONNAISSANCE MODEL TRAINING COMPLETE")
    print("=" * 65)
    return bundle


if __name__ == "__main__":
    train_disasterscope_pipeline()
