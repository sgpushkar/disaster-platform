# Installation Guide

## Prerequisites

- Python 3.10+
- Node.js 18+
- A free [OpenWeatherMap API key](https://openweathermap.org/api)

## 1. Clone / extract the project

```bash
cd disaster-platform
```

```bash
# Start both Backend and Frontend concurrently from project root
npm run dev
```

Or start them individually:

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 4. Create your first account

Sign up through the UI. **The very first user to sign up is automatically
made an admin** — every account after that is a regular user. If you need a
second admin later, promote a user manually in the SQLite DB or extend the
admin panel.

## 5. Train the ML models (required for predictions to work)

Predictions won't work until you train the models — see
[`DATASET_GUIDE.md`](DATASET_GUIDE.md) for exactly what data to place where
and how to run the training scripts. This is a deliberate choice: the
platform never fakes a prediction.

## 6. Run tests (optional but recommended)

```bash
pip install pytest
pytest tests/ -v
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `OPENWEATHER_API_KEY is not set` | Add your key to `backend/.env` |
| `/upload-image` returns 503 | Train the flood model first (see DATASET_GUIDE.md) |
| CORS errors in browser console | Confirm `FRONTEND_ORIGIN` in `.env` matches your frontend URL |
| `no such table: users` | Delete `database/disaster.db` and restart the backend to recreate tables |
