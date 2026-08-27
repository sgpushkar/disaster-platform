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

### Option B: Render / Railway (simplest for a student project demo)

1. Push the repo to GitHub.
2. Create a new Web Service pointing at `backend/`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env.example` in the dashboard.
6. These platforms give you HTTPS automatically — no Nginx/certbot needed.

**Note on SQLite here:** most PaaS free tiers use ephemeral filesystems —
your SQLite DB can get wiped on redeploy. For anything beyond a demo, attach
a persistent disk or switch to a managed Postgres addon (one-line
`DATABASE_URL` change, no code changes needed).

## 3. Frontend deployment

### Option A: Vercel / Netlify (recommended — zero config for Vite)

1. Push to GitHub, import the repo, set root directory to `frontend/`.
2. Build command: `npm run build`, output directory: `dist`.
3. Set an environment variable or edit `vite.config.js`'s proxy target — in
   production you'll want to point API calls at your deployed backend URL
   instead of the dev proxy. Simplest fix: replace the `baseURL: '/api'` in
   `src/services/api.js` with your backend's full URL, e.g.
   `https://api.yourdomain.com`.

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
