# Deployment Guide

This covers taking the platform from `localhost` to a real deployment. Pick
the path that matches your situation — campus demo server, a VPS, or a
platform-as-a-service.

## 1. Production checklist (do these regardless of where you deploy)

- [ ] Generate a real `SECRET_KEY` — `openssl rand -hex 32` — never reuse the dev default
- [ ] Set `OPENWEATHER_API_KEY` in the production environment
- [ ] Set `FRONTEND_ORIGIN` to your real frontend domain (CORS will reject everything else)
- [ ] Switch `DATABASE_URL` to Postgres/MySQL if you expect concurrent multi-user traffic — SQLite is fine for a single-instance demo, not for real concurrent writes
- [ ] Never commit `.env` — it's already covered by a typical `.gitignore`, double check
- [ ] Train and commit (or upload separately) `ml/models/flood_model.keras`, `lstm_model.keras`, `rainfall_scaler.pkl` — these are binary artifacts, consider Git LFS or object storage instead of a normal git push if they're large
- [ ] Run `pytest tests/ -v` one more time against the production config before going live

## 2. Backend deployment

### Option A: Plain VPS (Ubuntu) with systemd + Nginx

```bash
# On the server
sudo apt update && sudo apt install python3-venv nginx
cd /opt
git clone <your-repo> disaster-platform
cd disaster-platform/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

Create `/etc/systemd/system/disaster-api.service`:
```ini
[Unit]
Description=Disaster Prediction API
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/disaster-platform/backend
Environment="PATH=/opt/disaster-platform/backend/venv/bin"
EnvironmentFile=/opt/disaster-platform/backend/.env
ExecStart=/opt/disaster-platform/backend/venv/bin/gunicorn app.main:app \
    -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now disaster-api
```

Nginx reverse proxy (`/etc/nginx/sites-available/disaster-api`):
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then `sudo certbot --nginx -d api.yourdomain.com` for free HTTPS.

### Option B: Render Deployment (Recommended for Backend)

#### Method 1: Using Render Blueprint (Simplest)
1. Push the repo to GitHub.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Connect your repository. Render will automatically read `render.yaml`.
4. Render deploys the FastAPI backend service (`disaster-intel-api`) and optionally the static frontend.
5. If using a PostgreSQL database (e.g. Neon, Supabase, Render Postgres), add your `DATABASE_URL` under Environment Variables. Otherwise, it automatically defaults to SQLite.

#### Method 2: Manual Web Service on Render
1. In the Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the following settings:
   - **Name:** `disaster-intel-api`
   - **Language / Runtime:** `Python 3`
   - **Root Directory:** `backend` (or leave blank; the repo has root fallback support)
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `PYTHON_VERSION`: `3.11.9`
   - `SECRET_KEY`: `<random 32-char hex string>`
   - `OPENWEATHER_API_KEY`: `<your_key>`
   - `DATABASE_URL`: `<your_postgres_url>` (or leave empty for SQLite)
   - `FRONTEND_ORIGIN`: `https://your-app.vercel.app,http://localhost:5173`

## 3. Frontend deployment on Vercel (Recommended)

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), click **Import** on your repository.
3. Configuration:
   - **Framework Preset:** Vite
   - **Root Directory:** `./` (or `frontend` — both are pre-configured with `vercel.json` and build scripts)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist` (or `frontend/dist` if deploying from root)
4. Add Environment Variable in Vercel:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://disaster-intel-api.onrender.com` (your deployed Render API URL, without trailing slash)
5. Click **Deploy**.
   - Client-side routing (`/dashboard`, `/alerts`, `/safe-areas`, etc.) will work seamlessly without 404s due to pre-configured `rewrites` in `vercel.json`.
   - The backend includes dynamic CORS support for all `*.vercel.app` domains.

### Option B: Same VPS as backend

```bash
cd frontend
npm install
npm run build   # outputs to dist/
```
Serve `dist/` with Nginx as static files, and proxy `/api/*` to the backend
service on the same box.

## 4. Training models in production

Model training is a one-time (or periodic retraining) offline step — don't
run it inside your API server process. Train locally or on a machine with a
GPU/decent CPU, then copy the three output files into `ml/models/` on the
server:

```
ml/models/flood_model.keras
ml/models/lstm_model.keras
ml/models/rainfall_scaler.pkl
```

The API picks these up automatically on next restart (models are cached
with `lru_cache` after first load, so restart the service after updating
them).

## 5. Monitoring basics

- `GET /health` — simple liveness check, wire this into your platform's
  health-check config or a cron + curl + alert setup.
- Watch for repeated `503`s on `/upload-image` or `/predict/rainfall` in
  logs — that means models aren't loading (wrong path, missing file,
  corrupted save).
