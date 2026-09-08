# Dataset Placement Guide

## 1. Flood Image Dataset (`datasets/flood/`)

```
datasets/flood/
├── flood/          <- images that show flooding
└── no_flood/       <- images that don't show flooding
```

- Accepted formats: `.jpg`, `.jpeg`, `.png`
- No fixed count required, but for a project-quality model aim for **300+ images
  per class minimum** (more is better). Public sources you can pull from:
  - Kaggle: "Flood Image Dataset", "Flood Area Segmentation"
  - Roboflow Universe: search "flood detection"
- Keep classes balanced (roughly equal image counts) so the model doesn't bias
  toward the larger class.

## 2. Rainfall Dataset (`datasets/rainfall/rainfall.csv`)

CSV with at minimum these two columns, one row per day, chronological order:

```csv
date,rainfall_mm
2023-01-01,0.0
2023-01-02,4.2
2023-01-03,12.5
...
```

- Good public sources: IMD (India Meteorological Department) historical data,
  data.gov.in rainfall datasets, or Kaggle "India Rainfall" datasets.
- Need at least ~17 rows minimum to train (7-day window + validation split),
  but realistically you want **1+ years of daily data** for a model that
  actually generalizes.

## 3. Historical Disaster Attributes Dataset (`datasets/disaster_attributes/historical_flood_attributes.csv`)

CSV containing records of environmental and meteorological conditions during historical disaster occurrences and baseline non-disaster periods:

```csv
date,location,rainfall_24h_mm,rainfall_72h_mm,humidity_pct,temperature_c,wind_speed_ms,pressure_hpa,soil_moisture_pct,river_water_level_m,drainage_capacity_index,flood_occurred,risk_level,risk_score
2018-06-02,Navi Mumbai,173.6,377.4,91.2,23.7,10.5,997.6,92.7,6.88,0.57,1,Critical,80.2
...
```

- Features include:
  - `rainfall_24h_mm` & `rainfall_72h_mm`: Immediate and cumulative precipitation
  - `humidity_pct`, `temperature_c`, `wind_speed_ms`: Atmospheric condition variables
  - `pressure_hpa`: Barometric pressure (depressions under 1005 hPa indicate storm surges)
  - `soil_moisture_pct`: Ground saturation index
  - `river_water_level_m`: Water level relative to catchment danger mark
  - `drainage_capacity_index`: Urban infrastructure absorption factor (0.1 - 1.0)
  - Target labels: `flood_occurred` (0/1), `risk_level` (Low/Moderate/High/Critical), and `risk_score` (0-100 continuous)

## 4. DisasterScope Drone Reconnaissance Dataset (`datasets/disasterscope/disasterscope.csv`)

Kaggle dataset (`datasetengineer/disasterscope-dataset`) with **61,368 records** of drone reconnaissance and ground hazard telemetry:

```csv
timestamp,temperature,humidity,wind_speed,air_quality_index,water_level,building_damage_level,road_condition,infrastructure_status,vegetation_cover,people_detected,heat_signatures,hazardous_material_detected,disaster_severity_level,affected_area_type,immediate_action_required,survivor_presence_likelihood
2018-01-01 00:00:00,28.5,75.0,15.2,165.0,1.2,Moderate,Obstructed,Damaged,45.0,3,2,0,Medium,Flooded,Yes,High
...
```

- Download automatically via `kagglehub`:
  ```bash
  python ml/download_disasterscope.py
  ```
- Target labels predicted by the multi-target ensemble:
  1. `disaster_severity_level`: Low, Medium, High
  2. `affected_area_type`: Unblocked, Flooded, Fire-Damaged, Collapsed Structure
  3. `immediate_action_required`: Yes / No
  4. `survivor_presence_likelihood`: Low / High

## After placing data / Training Models

```bash
cd disaster-platform
pip install -r backend/requirements.txt

# Train all models
python ml/train_flood_model.py
python ml/train_rainfall_model.py
python ml/train_disaster_risk_model.py
python ml/train_disasterscope_model.py
```

This writes:
- `flood_model.joblib` / `flood_model.keras`
- `lstm_model.joblib` / `lstm_model.keras` + `rainfall_scaler.pkl`
- `disaster_risk_model.joblib`
- `disasterscope_model.joblib`

into `ml/models/` and syncs them to `backend/models/`. The backend automatically picks these up for inference.

