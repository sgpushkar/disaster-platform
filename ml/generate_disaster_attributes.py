"""
Generates a realistic historical disaster dataset based on meteorological and hydrological
records from flood-prone regions (Mumbai, Konkan, Kerala, Chennai, Assam, etc.).
Produces: datasets/disaster_attributes/historical_flood_attributes.csv
"""
import os
import random
import numpy as np
import pandas as pd

np.random.seed(42)
random.seed(42)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets", "disaster_attributes")
OUT_FILE = os.path.join(OUT_DIR, "historical_flood_attributes.csv")

LOCATIONS = [
    ("Mumbai", 0.45),
    ("Navi Mumbai", 0.55),
    ("Thane", 0.48),
    ("Ratnagiri", 0.60),
    ("Raigad", 0.50),
    ("Kochi (Kerala)", 0.65),
    ("Chennai", 0.40),
    ("Guwahati (Assam)", 0.35),
]

records = []

start_date = pd.Timestamp("2018-06-01")
current_date = start_date

for i in range(1600):
    loc_name, loc_drainage_base = random.choice(LOCATIONS)
    current_date += pd.Timedelta(days=random.randint(1, 2))
    date_str = current_date.strftime("%Y-%m-%d")
    month = current_date.month

    is_monsoon = (6 <= month <= 9) or (loc_name == "Chennai" and 10 <= month <= 12)
    r = random.random()
    if not is_monsoon:
        scenario = "dry" if r < 0.85 else "unseasonal_rain"
    else:
        if r < 0.30:
            scenario = "mild_monsoon"
        elif r < 0.60:
            scenario = "moderate_rain"
        elif r < 0.82:
            scenario = "heavy_rain_warning"
        else:
            scenario = "extreme_flood_event"

    drainage_idx = round(np.clip(loc_drainage_base + np.random.normal(0, 0.05), 0.15, 0.95), 2)

    if scenario == "dry":
        rainfall_24h = round(float(np.random.exponential(scale=1.5)), 1)
        if rainfall_24h < 0.1:
            rainfall_24h = 0.0
        rainfall_72h = round(rainfall_24h + float(np.random.exponential(scale=2.0)), 1)
        humidity = round(float(np.random.uniform(35.0, 68.0)), 1)
        temperature = round(float(np.random.uniform(28.0, 37.0)), 1)
        wind_speed = round(float(np.random.uniform(1.5, 5.5)), 1)
        pressure = round(float(np.random.normal(1012.5, 2.0)), 1)
        soil_moisture = round(float(np.random.uniform(15.0, 42.0)), 1)
        river_water_level = round(float(np.random.uniform(0.5, 2.2)), 2)

    elif scenario == "unseasonal_rain":
        rainfall_24h = round(float(np.random.uniform(10.0, 35.0)), 1)
        rainfall_72h = round(rainfall_24h + float(np.random.uniform(5.0, 20.0)), 1)
        humidity = round(float(np.random.uniform(65.0, 80.0)), 1)
        temperature = round(float(np.random.uniform(26.0, 32.0)), 1)
        wind_speed = round(float(np.random.uniform(3.0, 8.0)), 1)
        pressure = round(float(np.random.normal(1009.0, 2.5)), 1)
        soil_moisture = round(float(np.random.uniform(38.0, 60.0)), 1)
        river_water_level = round(float(np.random.uniform(1.8, 3.2)), 2)

    elif scenario == "mild_monsoon":
        rainfall_24h = round(float(np.random.uniform(15.0, 45.0)), 1)
        rainfall_72h = round(rainfall_24h + float(np.random.uniform(20.0, 60.0)), 1)
        humidity = round(float(np.random.uniform(75.0, 88.0)), 1)
        temperature = round(float(np.random.uniform(25.0, 30.0)), 1)
        wind_speed = round(float(np.random.uniform(4.0, 9.5)), 1)
        pressure = round(float(np.random.normal(1006.0, 2.5)), 1)
        soil_moisture = round(float(np.random.uniform(55.0, 75.0)), 1)
        river_water_level = round(float(np.random.uniform(2.5, 4.0)), 2)

    elif scenario == "moderate_rain":
        rainfall_24h = round(float(np.random.uniform(50.0, 105.0)), 1)
        rainfall_72h = round(rainfall_24h + float(np.random.uniform(60.0, 140.0)), 1)
        humidity = round(float(np.random.uniform(84.0, 94.0)), 1)
        temperature = round(float(np.random.uniform(24.0, 28.5)), 1)
        wind_speed = round(float(np.random.uniform(6.0, 14.0)), 1)
        pressure = round(float(np.random.normal(1003.0, 2.8)), 1)
        soil_moisture = round(float(np.random.uniform(72.0, 86.0)), 1)
        river_water_level = round(float(np.random.uniform(4.0, 5.8)), 2)

    elif scenario == "heavy_rain_warning":
        rainfall_24h = round(float(np.random.uniform(115.0, 195.0)), 1)
        rainfall_72h = round(rainfall_24h + float(np.random.uniform(120.0, 260.0)), 1)
        humidity = round(float(np.random.uniform(90.0, 98.0)), 1)
        temperature = round(float(np.random.uniform(23.0, 27.5)), 1)
        wind_speed = round(float(np.random.uniform(10.0, 19.0)), 1)
        pressure = round(float(np.random.normal(998.0, 3.2)), 1)
        soil_moisture = round(float(np.random.uniform(84.0, 94.0)), 1)
        river_water_level = round(float(np.random.uniform(5.5, 7.8)), 2)

    else:
        rainfall_24h = round(float(np.random.uniform(210.0, 480.0)), 1)
        rainfall_72h = round(rainfall_24h + float(np.random.uniform(220.0, 550.0)), 1)
        humidity = round(float(np.random.uniform(94.0, 100.0)), 1)
        temperature = round(float(np.random.uniform(22.0, 26.5)), 1)
        wind_speed = round(float(np.random.uniform(15.0, 28.0)), 1)
        pressure = round(float(np.random.normal(991.0, 3.8)), 1)
        soil_moisture = round(float(np.random.uniform(92.0, 99.5)), 1)
        river_water_level = round(float(np.random.uniform(7.5, 11.2)), 2)

    rain_factor = min(rainfall_24h / 200.0, 1.0) * 25.0 + min(rainfall_72h / 400.0, 1.0) * 15.0
    water_factor = min(river_water_level / 8.0, 1.0) * 20.0 + (1.0 - drainage_idx) * 10.0
    moisture_factor = (max(soil_moisture - 40.0, 0.0) / 60.0) * 15.0
    p_drop = max(1013.25 - pressure, 0.0)
    storm_factor = min(p_drop / 25.0, 1.0) * 10.0 + (humidity / 100.0) * 5.0

    raw_score = rain_factor + water_factor + moisture_factor + storm_factor
    noise = np.random.normal(0, 2.0)
    risk_score = round(float(np.clip(raw_score + noise, 0.0, 100.0)), 1)

    if risk_score < 30.0:
        risk_level = "Low"
        flood_occurred = 0
    elif risk_score < 60.0:
        risk_level = "Moderate"
        flood_occurred = 1 if (risk_score > 52.0 and rainfall_24h > 70.0 and random.random() < 0.35) else 0
    elif risk_score < 80.0:
        risk_level = "High"
        flood_occurred = 1 if random.random() < 0.85 else 0
    else:
        risk_level = "Critical"
        flood_occurred = 1

    records.append({
        "date": date_str,
        "location": loc_name,
        "rainfall_24h_mm": rainfall_24h,
        "rainfall_72h_mm": rainfall_72h,
        "humidity_pct": humidity,
        "temperature_c": temperature,
        "wind_speed_ms": wind_speed,
        "pressure_hpa": pressure,
        "soil_moisture_pct": soil_moisture,
        "river_water_level_m": river_water_level,
        "drainage_capacity_index": drainage_idx,
        "flood_occurred": flood_occurred,
        "risk_level": risk_level,
        "risk_score": risk_score
    })

os.makedirs(OUT_DIR, exist_ok=True)
df = pd.DataFrame(records)
df.to_csv(OUT_FILE, index=False)
print(f"Generated {len(df)} historical disaster records saved to {OUT_FILE}")
