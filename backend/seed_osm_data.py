import requests
import json
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.models import EmergencyLocation
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bounding box for Mumbai (approx)
BBOX = "18.88,72.75,19.3,73.05"

def seed_db():
    db = SessionLocal()
    
    # First, let's clear existing seed data to prevent duplicates
    db.query(EmergencyLocation).filter(EmergencyLocation.is_seed_data == True).delete()
    db.commit()

    # Mock data for Mumbai center: 19.0760, 72.8777
    mock_data = [
        {"name": "City General Hospital", "type": "hospital", "lat": 19.0780, "lon": 72.8750},
        {"name": "Central Clinic", "type": "hospital", "lat": 19.0720, "lon": 72.8800},
        {"name": "District Police Station", "type": "police", "lat": 19.0750, "lon": 72.8710},
        {"name": "Main Fire Station", "type": "fire_station", "lat": 19.0790, "lon": 72.8820},
        {"name": "Community Relief Shelter", "type": "shelter", "lat": 19.0710, "lon": 72.8750},
        {"name": "High Ground Safe Zone", "type": "safe_zone", "lat": 19.0800, "lon": 72.8700},
    ]

    count = 0
    for item in mock_data:
        loc = EmergencyLocation(
            name=item["name"],
            latitude=item["lat"],
            longitude=item["lon"],
            type=item["type"],
            capacity=100,
            current_occupancy=0,
            availability_status='open',
            risk_level='Low',
            description="Mock data generated for testing.",
            contact="123-456-7890",
            is_seed_data=True
        )
        db.add(loc)
        count += 1

    try:
        db.commit()
        logger.info(f"Successfully seeded {count} mock locations into database.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
