# Architecture

## System Architecture

```mermaid
graph TB
    subgraph Client
        UI["React + Vite Dashboard<br/>Tailwind · Framer Motion · Chart.js · Leaflet"]
    end

    subgraph Backend["FastAPI Backend"]
        AUTH["Auth Router<br/>JWT + bcrypt"]
        PRED["Predict Router<br/>/upload-image /predict/rainfall /predict/risk"]
        WEATH["Weather Router"]
        DASH["Dashboard Router"]
        ADMIN["Admin Router"]
        REPORTS["Reports Router<br/>PDF/CSV"]
        RISK["Risk Fusion Engine"]
    end

    subgraph ML["ML Layer"]
        CNN["CNN<br/>MobileNetV2 backbone<br/>flood_model.keras"]
        LSTM["LSTM<br/>rainfall forecaster<br/>lstm_model.keras"]
    end

    subgraph External["External Services"]
        OWM["OpenWeatherMap API"]
    end

    subgraph Data
        DB[("SQLite<br/>via SQLAlchemy")]
    end

    UI -->|"HTTPS + JWT"| AUTH
    UI --> PRED
    UI --> WEATH
    UI --> DASH
    UI --> ADMIN
    UI --> REPORTS

    PRED --> CNN
    PRED --> LSTM
    PRED --> RISK
    WEATH --> OWM
    RISK --> DB

    AUTH --> DB
    PRED --> DB
    WEATH --> DB
    DASH --> DB
    ADMIN --> DB
    REPORTS --> DB
```

## Request flow: combined risk prediction

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant F as FastAPI
    participant C as CNN Model
    participant L as LSTM Model
    participant W as WeatherData (DB)
    participant R as Risk Engine

    U->>F: POST /upload-image (photo)
    F->>C: predict_flood_image()
    C-->>F: label, confidence
    F-->>U: { prediction, confidence }

    U->>F: POST /predict/rainfall (last 7 days)
    F->>L: predict_rainfall()
    L-->>F: tomorrow_mm, next_3_days_mm
    F-->>U: forecast

    U->>F: POST /predict/risk
    F->>W: fetch latest weather record
    F->>R: compute_risk_score(image, rainfall, weather)
    R-->>F: risk_score, risk_level, breakdown
    F->>F: persist Prediction row
    F-->>U: { risk_score, risk_level, breakdown }
```

## Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ PREDICTIONS : creates
    USERS ||--o{ FLOOD_IMAGES : uploads

    USERS {
        int id PK
        string name
        string email UK
        string password
        enum role
        datetime created_at
    }

    WEATHER_DATA {
        int id PK
        float temperature
        float humidity
        float wind_speed
        float rainfall
        float pressure
        float latitude
        float longitude
        string location_name
        datetime timestamp
    }

    PREDICTIONS {
        int id PK
        int user_id FK
        string prediction_type
        float confidence
        enum risk_level
        float risk_score
        text details_json
        datetime created_at
    }

    FLOOD_IMAGES {
        int id PK
        int user_id FK
        string filename
        string prediction
        float confidence
        datetime created_at
    }

    EMERGENCY_LOCATIONS {
        int id PK
        string name
        float latitude
        float longitude
        string type
        datetime created_at
    }

    ALERTS {
        int id PK
        string message
        enum risk_level
        float latitude
        float longitude
        datetime timestamp
    }
```

## Risk Engine weighting

The fused 0-100 risk score is a weighted blend of three normalized signals:

- **Flood image confidence** — 40% (direct visual evidence)
- **Rainfall forecast** — 35% (predictive signal, mapped via IMD-style intensity bands)
- **Live weather severity** — 25% (humidity, wind speed, pressure drop as a storm indicator)

If a signal is unavailable (e.g. no image uploaded yet), its weight is
excluded and the remaining weights are renormalized — so the score stays
meaningful with partial data rather than defaulting to zero.

## Why these tech choices

- **MobileNetV2 transfer learning** for the CNN: trains fast and performs
  reasonably even on modest dataset sizes — appropriate for a student project
  timeline without a GPU cluster.
- **LSTM over a simple moving average**: rainfall has temporal dependencies
  (wet/dry spells cluster), which recurrent networks capture better than
  naive statistical baselines.
- **SQLite**: zero-config, file-based, sufficient for a single-instance
  academic deployment; the SQLAlchemy layer makes swapping to Postgres a
  one-line `DATABASE_URL` change if scaling is ever needed.
