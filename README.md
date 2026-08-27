# AI-Based Disaster Prediction and Emergency Analytics

A full-stack platform that predicts flood risk using deep learning (CNN image
classification + LSTM rainfall forecasting), live weather data, and GIS
visualization — built for authorities and citizens to monitor disaster risk
in real time.

## What's inside

| Layer      | Tech |
|------------|------|
| Frontend   | React + Vite, Tailwind CSS, Framer Motion, Chart.js, Leaflet.js |
| Backend    | Python, FastAPI, JWT auth |
| ML         | TensorFlow/Keras (CNN + LSTM), OpenCV, scikit-learn |
| Database   | SQLite + SQLAlchemy |

## Core features

- **CNN flood detection** — upload a photo, get Flood / No Flood + confidence
- **LSTM rainfall forecasting** — predicts tomorrow + next 3 days from recent rainfall
- **Live weather** — pulled from OpenWeatherMap and stored for trend analysis
- **Fused risk engine** — combines image + rainfall + weather into a 0-100 risk score
- **GIS map** — hospitals, shelters, police stations, danger zones on Leaflet/OSM
- **Auth** — JWT-based signup/login, bcrypt password hashing, role-based access
- **Admin panel** — manage users, locations, alerts, view weather/prediction logs
- **Reports** — export prediction history as PDF or CSV

## Quick start

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for full setup, and
[`docs/DATASET_GUIDE.md`](docs/DATASET_GUIDE.md) for how to train the ML models.

```bash
# Option 1: Start both Backend & Frontend together (Single Command)
npm run dev

# Option 2: Run separately
# Backend
cd backend
python -m venv venv && source venv/bin/activate # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the first account you sign up with automatically
becomes an admin.

## Project structure

```
disaster-platform/
├── frontend/          React + Vite dashboard
├── backend/            FastAPI application
│   └── app/
│       ├── routers/    API endpoints (auth, weather, predict, dashboard, admin, reports)
│       ├── models/     SQLAlchemy ORM models
│       ├── schemas/     Pydantic request/response schemas
│       ├── services/   Weather API client, risk fusion engine
│       ├── ml/          Model loading + inference
│       └── core/        Config, DB session, security/JWT
├── ml/                  Model training scripts (CNN, LSTM)
│   └── models/          Trained .keras files land here
├── database/            SQLite database file
├── datasets/            Place training data here (see DATASET_GUIDE.md)
├── tests/                Pytest suite (backend + ML logic)
└── docs/                 Full documentation set
```

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Dataset Placement Guide](docs/DATASET_GUIDE.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Project Report](docs/PROJECT_REPORT.md)

## Testing

```bash
pip install pytest
pytest tests/ -v
```

21 tests covering auth flows, JWT/role-protected routes, and the risk fusion
engine's scoring logic.

## Honest limitations (read before your viva/demo)

- The CNN and LSTM models **must be trained on real datasets you provide** —
  no pretrained weights are bundled, and no fake predictions are ever
  returned. Until trained, `/upload-image` and `/predict/rainfall` respond
  with a clear `503` explaining what's missing.
- Weather data requires a free OpenWeatherMap API key.
- SQLite is used for simplicity; swap `DATABASE_URL` for Postgres/MySQL if
  you need concurrent multi-user production traffic.
