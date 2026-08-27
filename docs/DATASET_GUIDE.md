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

## After placing data

```bash
cd disaster-platform
pip install -r backend/requirements.txt
python ml/train_flood_model.py
python ml/train_rainfall_model.py
```

This writes `flood_model.keras`, `lstm_model.keras`, and `rainfall_scaler.pkl`
into `ml/models/`. The backend automatically picks these up — no code changes
needed. Until these files exist, `/upload-image` and `/predict/rainfall` will
return a `503` with a clear message instead of a fake prediction.
