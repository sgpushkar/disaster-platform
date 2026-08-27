# Project Report

## AI-Based Disaster Prediction and Emergency Analytics Using Deep Learning and GIS

---

### 1. Abstract

Flooding is among the most frequent and destructive natural disasters,
disproportionately affecting regions with limited early-warning
infrastructure. This project presents a full-stack web platform that fuses
three independent prediction signals — CNN-based flood image classification,
LSTM-based rainfall forecasting, and live meteorological data — into a
single interpretable risk score, and visualizes it alongside GIS emergency
infrastructure (hospitals, shelters, police stations, danger zones) for both
citizens and authorities.

### 2. Problem Statement

Existing flood-monitoring tools are typically siloed: satellite/image-based
detection systems don't talk to weather forecasting models, and neither is
commonly paired with actionable GIS routing to emergency infrastructure.
Authorities and citizens need a single dashboard that answers three
questions at once: *Is flooding visible right now? Is it going to rain
heavily? Given both, how urgent is the situation, and where's the nearest
shelter?*

### 3. Objectives

1. Classify flood presence from user-submitted images using a CNN.
2. Forecast short-term rainfall from historical daily rainfall using an LSTM.
3. Aggregate live weather (temperature, humidity, wind, pressure) as a third
   independent risk signal.
4. Fuse all three signals into a single 0–100 risk score with a documented,
   reproducible weighting scheme.
5. Visualize emergency infrastructure and risk zones on an interactive GIS map.
6. Provide secure, role-based access (citizen vs. administrator) and
   exportable reports for record-keeping.

### 4. System Overview

The platform is a three-tier architecture:

- **Presentation tier**: React + Vite single-page application, styled with
  Tailwind CSS in a dark editorial theme, animated with Framer Motion.
- **Application tier**: FastAPI backend exposing REST endpoints for auth,
  weather, predictions, dashboard aggregation, admin management, and report
  generation.
- **Intelligence tier**: Two independently trained deep learning models
  (CNN, LSTM) plus a hand-tuned rule-based fusion engine that combines their
  outputs with live weather into the final risk assessment.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for full system, sequence, and
entity-relationship diagrams.

### 5. Methodology

#### 5.1 Flood Image Classification (CNN)

- **Architecture**: MobileNetV2 backbone (ImageNet-pretrained, frozen) +
  global average pooling + dropout + dense classification head, sigmoid
  output for binary classification (Flood / No Flood).
- **Rationale for transfer learning**: training a CNN from scratch requires
  tens of thousands of labeled images to generalize well; transfer learning
  from ImageNet features lets the model reach reasonable accuracy on a
  dataset of a few hundred to low-thousands of images, which is realistic
  for a student project timeline.
- **Data augmentation**: random horizontal flip, rotation, and zoom applied
  during training to reduce overfitting on a modest dataset size.
- **Training regime**: Adam optimizer, binary cross-entropy loss, early
  stopping on validation loss, checkpointing on best validation accuracy.

#### 5.2 Rainfall Forecasting (LSTM)

- **Architecture**: two-layer LSTM (64 → 32 units) with dropout, followed by
  a dense regression head predicting next-day rainfall in mm.
- **Input**: a sliding 7-day window of historical daily rainfall, normalized
  with a `MinMaxScaler` fit on the training set (persisted alongside the
  model so inference uses identical scaling).
- **Multi-day forecasting**: implemented recursively — the model's own
  prediction for day+1 is appended to the window and fed back in to predict
  day+2, and so on for a 3-day-ahead forecast.
- **Why LSTM over a naive baseline**: rainfall exhibits temporal
  autocorrelation (wet spells and dry spells cluster) that a recurrent
  architecture captures better than a moving average or linear regression
  baseline.

#### 5.3 Risk Fusion Engine

A deliberately transparent, rule-based fusion layer (not a third black-box
model) combines the three signals:

| Signal | Weight | Rationale |
|---|---|---|
| Flood image confidence | 40% | Direct visual ground-truth when available |
| Rainfall forecast | 35% | Strongest predictive (forward-looking) signal |
| Live weather severity | 25% | Corroborating context (humidity, wind, pressure drop) |

Rainfall is mapped to a 0–100 sub-score using IMD-style intensity bands
(light / moderate / heavy / very heavy / extremely heavy). Weather severity
combines humidity, wind speed, and pressure drop (a classic storm-system
indicator) with hand-tuned sub-weights. When a signal is missing (e.g. no
image has been uploaded), its weight is excluded and the remaining weights
are renormalized, so the score stays meaningful even with partial input
rather than silently biasing toward zero.

This design choice — rule-based fusion over a fourth ML model — was
deliberate: it keeps the final score auditable and explainable to
non-technical stakeholders (e.g. a disaster response coordinator can see
exactly why a score is 68/100, not just trust an opaque number).

#### 5.4 GIS Layer

Built on Leaflet.js with OpenStreetMap tiles (no API key or cost). Emergency
locations are stored with type classification (hospital / shelter / police /
danger_zone) and rendered as markers, with danger zones additionally
rendered as radius circles to visually communicate affected area.

### 6. Security Considerations

- Passwords hashed with bcrypt (never stored or logged in plaintext).
- JWT-based stateless authentication with configurable expiry.
- Role-based access control — admin-only routes return `403` for regular
  users, verified independently in the automated test suite.
- Input validation via Pydantic schemas on every endpoint (rejects malformed
  emails, short passwords, oversized uploads, invalid file types).
- Rate limiting (100 requests/minute default) to reduce brute-force and
  abuse risk.
- File upload validation: content-type allowlist and size cap on image
  uploads.

### 7. Testing

21 automated tests (pytest) cover:
- Signup/login success and failure paths (duplicate email, wrong password,
  weak password rejection)
- First-user-becomes-admin logic
- JWT-protected route access (rejected without token, rejected with
  malformed token)
- Role-based access control (admin routes blocked for regular users,
  allowed for admins)
- Risk fusion engine correctness (monotonic rainfall scoring, weight
  renormalization with partial signals, threshold boundaries for Low/
  Moderate/High/Critical)

Run with `pytest tests/ -v` — see [`README.md`](../README.md) for setup.

### 8. Limitations and Future Work

- **Model accuracy is dataset-dependent**: this project ships fully
  functional, real training pipelines but not pretrained weights — final
  accuracy depends entirely on the dataset quality and size the user
  supplies (see `DATASET_GUIDE.md`). This was a deliberate constraint: no
  fake or placeholder predictions are ever returned.
- **Single-instance SQLite**: sufficient for demo/small-scale deployment;
  would need a migration to Postgres for concurrent multi-admin production use.
- **Recursive multi-day rainfall forecasting compounds error**: day+3
  predictions are less reliable than day+1 since they're built on the
  model's own earlier predictions rather than ground truth. A sequence-to-
  sequence architecture (predicting all 4 days directly) would reduce this
  in future work.
- **No image-based flood segmentation** (only binary classification) —
  segmentation (pixel-level flood extent) would give richer risk maps but
  requires pixel-labeled datasets, a heavier lift than binary labels.
- **Future work**: SMS/push alert delivery integration, satellite imagery
  ingestion for wider-area monitoring, mobile app companion, multi-language
  support for wider citizen accessibility.

### 9. Conclusion

This project demonstrates an end-to-end, production-structured (not just
notebook-based) disaster prediction system: real authentication, a real
database schema, two independently trainable deep learning models, a
transparent fusion methodology, GIS visualization, and exportable reporting
— built to be honestly evaluated on real data rather than demoed with
placeholder outputs.
