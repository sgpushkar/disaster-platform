# API Documentation

Base URL (dev): `http://localhost:8000`
Interactive Swagger docs: `http://localhost:8000/docs`

All endpoints except `/signup` and `/login` require a header:
```
Authorization: Bearer <access_token>
```

---

## Auth

### `POST /signup`
Create an account. First user ever created becomes `admin`.

**Body**
```json
{ "name": "Pushkar Mhatre", "email": "you@example.com", "password": "min8chars" }
```
**Response `201`**
```json
{ "access_token": "...", "token_type": "bearer", "user": { "id": 1, "name": "...", "email": "...", "role": "admin", "created_at": "..." } }
```

### `POST /login`
**Body:** `{ "email": "...", "password": "..." }`
**Response `200`:** same shape as signup.

---

## Weather

### `GET /weather?lat=19.07&lon=72.87`
Fetches live weather from OpenWeatherMap, stores it, returns it.
`lat`/`lon` optional — defaults to `OPENWEATHER_DEFAULT_LAT/LON` in `.env`.

**Response `200`**
```json
{ "id": 1, "temperature": 29.4, "humidity": 78, "wind_speed": 4.2, "rainfall": 0.0, "pressure": 1008, "location_name": "Mumbai", "timestamp": "..." }
```
**Response `503`** if `OPENWEATHER_API_KEY` isn't configured.

---

## Predictions

### `POST /upload-image`
Multipart form upload. Field name: `file`. Accepts JPEG/PNG/WEBP, max 8MB.

**Response `200`**
```json
{ "id": 1, "filename": "...", "prediction": "Flood", "confidence": 87.3, "created_at": "..." }
```
**Response `503`** if the CNN model hasn't been trained yet.

### `POST /predict/rainfall`
**Body**
```json
{ "recent_rainfall_mm": [0, 2.5, 10, 4, 0, 0, 15] }
```
Needs at least 7 values (the LSTM's lookback window).

**Response `200`**
```json
{ "tomorrow_mm": 6.2, "next_3_days_mm": [5.1, 3.4, 2.0] }
```
**Response `503`** if the LSTM model hasn't been trained yet.

### `POST /predict/risk`
Fuses flood image + rainfall forecast + latest stored weather into one score.

**Body**
```json
{
  "flood_image_confidence": 87.3,
  "flood_image_label": "Flood",
  "rainfall_forecast_mm": 6.2,
  "use_latest_weather": true
}
```
All fields optional — the engine renormalizes weights based on what's provided.

**Response `200`**
```json
{ "risk_score": 68.4, "risk_level": "High", "breakdown": { "components": {...}, "weights_used": {...} } }
```

---

## Dashboard / History / Map / Alerts

### `GET /dashboard`
Returns the latest weather, flood prediction, rainfall forecast, current risk,
and last 5 alerts in one call.

### `GET /history?limit=50&prediction_type=risk_combined`
Prediction history, most recent first. `prediction_type` optional filter:
`flood_image` | `rainfall` | `risk_combined`.

### `GET /map?location_type=hospital`
Emergency locations for the GIS map. `location_type` optional filter:
`hospital` | `shelter` | `police` | `danger_zone`.

### `GET /alerts?limit=20`
Recent alerts, most recent first.

---

## Admin (requires `role: admin`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List all users |
| DELETE | `/admin/users/{id}` | Delete a user (can't delete yourself) |
| GET | `/admin/predictions` | All predictions across all users |
| GET | `/admin/weather` | Full weather log |
| GET | `/admin/locations` | All emergency locations |
| POST | `/admin/locations` | Create a location (`name`, `latitude`, `longitude`, `type`) |
| DELETE | `/admin/locations/{id}` | Delete a location |
| POST | `/admin/alerts` | Publish an alert (`message`, `risk_level`) |
| DELETE | `/admin/alerts/{id}` | Delete an alert |

Non-admin requests to these routes return `403`.

---

## Reports

### `GET /reports/pdf`
Streams a PDF (`application/pdf`) of the requesting user's prediction history
(admins get everyone's).

### `GET /reports/csv`
Same data as CSV (`text/csv`).

---

## Error format

All errors follow FastAPI's standard shape:
```json
{ "detail": "Human-readable message" }
```
Validation errors (`422`) include a `detail` array with per-field messages.
