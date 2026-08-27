"""
Trains a time-series regression model on historical daily rainfall data.
Predicts precipitation for Tomorrow (+24h) and the Next 3 Days from a 7-day rolling window.
Outputs:
    ml/models/lstm_model.joblib
    ml/models/rainfall_scaler.pkl
    backend/models/lstm_model.joblib
    backend/models/rainfall_scaler.pkl
"""
import os
import pickle
import shutil
import joblib
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.multioutput import MultiOutputRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge

WINDOW_SIZE = 7
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "rainfall", "rainfall.csv")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "models")
BACKEND_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "models")


def build_sequences(values: np.ndarray, window: int):
    X, y = [], []
    for i in range(len(values) - window - 3):
        X.append(values[i:i + window])
        y.append(values[i + window:i + window + 4])  # 4 future days
    return np.array(X), np.array(y)


def main():
    if not os.path.exists(DATA_PATH):
        raise SystemExit(f"Expected datasets/rainfall/rainfall.csv to exist.")

    df = pd.read_csv(DATA_PATH)
    if "rainfall_mm" not in df.columns:
        raise SystemExit("CSV must contain 'rainfall_mm' column.")

    rainfall = df["rainfall_mm"].values.astype(float).reshape(-1, 1)
    if len(rainfall) < WINDOW_SIZE + 10:
        raise SystemExit(f"Need at least {WINDOW_SIZE + 10} rows of rainfall data.")

    print(f"Training Rainfall Forecast Model on {len(rainfall)} days of historical records...")

    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled = scaler.fit_transform(rainfall).flatten()

    X, y = build_sequences(scaled, WINDOW_SIZE)

    # Multi-output neural regressor + random forest forecaster
    base_model = MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=600, random_state=42)
    model = MultiOutputRegressor(base_model)
    model.fit(X, y)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(BACKEND_OUTPUT_DIR, exist_ok=True)

    model_path = os.path.join(OUTPUT_DIR, "lstm_model.joblib")
    scaler_path = os.path.join(OUTPUT_DIR, "rainfall_scaler.pkl")

    backend_model_path = os.path.join(BACKEND_OUTPUT_DIR, "lstm_model.joblib")
    backend_scaler_path = os.path.join(BACKEND_OUTPUT_DIR, "rainfall_scaler.pkl")

    joblib.dump(model, model_path)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)

    shutil.copy2(model_path, backend_model_path)
    shutil.copy2(scaler_path, backend_scaler_path)

    print(f"Successfully saved rainfall model to {model_path} and {backend_model_path}")
    print(f"Successfully saved scaler to {scaler_path} and {backend_scaler_path}")


if __name__ == "__main__":
    main()
