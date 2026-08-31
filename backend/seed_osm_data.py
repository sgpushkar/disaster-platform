import requests
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import EmergencyLocation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bounding box for Mumbai (approx)
BBOX = "18.88,72.75,19.3,73.05"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def get_overpass_query(bbox):
    return f"""
    [out:json][timeout:25];
    (
      node["amenity"="hospital"]({bbox});
      way["amenity"="hospital"]({bbox});
      relation["amenity"="hospital"]({bbox});
      
      node["amenity"="clinic"]({bbox});
      way["amenity"="clinic"]({bbox});
      relation["amenity"="clinic"]({bbox});

      node["amenity"="police"]({bbox});
      way["amenity"="police"]({bbox});
      relation["amenity"="police"]({bbox});

      node["amenity"="fire_station"]({bbox});
      way["amenity"="fire_station"]({bbox});
      relation["amenity"="fire_station"]({bbox});

      node["amenity"="shelter"]({bbox});
      way["amenity"="shelter"]({bbox});
      relation["amenity"="shelter"]({bbox});
      
      node["emergency"="assembly_point"]({bbox});
    );
    out center;
    """

def fetch_osm_data():
    logger.info("Fetching data from Overpass API...")
    query = get_overpass_query(BBOX)
    headers = {
        'User-Agent': 'DisasterIntelApp/1.0',
        'Accept': '*/*'
    }
    response = requests.post(OVERPASS_URL, data={'data': query}, headers=headers)
    if response.status_code != 200:
        logger.error(f"Failed to fetch data: {response.status_code}, {response.text}")
        return None
    return response.json()

def parse_osm_type(tags):
    amenity = tags.get('amenity', '')
    emergency = tags.get('emergency', '')
    
    if amenity in ['hospital', 'clinic']:
        return 'hospital'
    elif amenity == 'police':
        return 'police'
    elif amenity == 'fire_station':
        return 'fire_station'
    elif amenity == 'shelter' or emergency == 'assembly_point':
        return 'shelter'
    return 'safe_zone'

def seed_db():
    data = fetch_osm_data()
    if not data or 'elements' not in data:
        logger.error("No valid data received")
        return

    db = SessionLocal()
    
    # Clear existing seed data to prevent duplicates
    db.query(EmergencyLocation).filter(EmergencyLocation.is_seed_data == True).delete()
    db.commit()

    count = 0
    for element in data['elements']:
        tags = element.get('tags', {})
        name = tags.get('name')
        if not name:
            name = tags.get('amenity', 'Unknown').capitalize()
        
        # Get coordinates
        lat = element.get('lat')
        lon = element.get('lon')
        if not lat or not lon:
            center = element.get('center')
            if center:
                lat = center.get('lat')
                lon = center.get('lon')
        
        if not lat or not lon:
            continue

        loc_type = parse_osm_type(tags)
        
        loc = EmergencyLocation(
            name=name,
            latitude=lat,
            longitude=lon,
            type=loc_type,
            capacity=100,  # default
            current_occupancy=0,
            availability_status='open',
            risk_level='Low',
            description=tags.get('description', ''),
            contact=tags.get('phone', ''),
            is_seed_data=True
        )
        db.add(loc)
        count += 1
        
        if count % 100 == 0:
            logger.info(f"Inserted {count} locations...")

    try:
        db.commit()
        logger.info(f"Successfully seeded {count} REAL locations into database.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
