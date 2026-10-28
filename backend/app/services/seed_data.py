"""
Default seed data for emergency locations, shelters, safe zones, hospitals, and fire stations.
Provides verified baseline safe areas in Pune and Mumbai regions.
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import EmergencyLocation

DEFAULT_LOCATIONS: List[Dict[str, Any]] = [
    # ---- Pune Safe Zones & Elevated Refuge ----
    {
        "name": "Vetal Hill Safe Zone & High Ground Refuge",
        "latitude": 18.5421,
        "longitude": 73.8139,
        "type": "safe_zone",
        "capacity": 2500,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Elevated hill sanctuary (675m ASL) — high ground completely shielded from flood water runoff.",
        "contact": "020-25654000",
    },
    {
        "name": "Chatushringi Safe Zone & Community High Ground",
        "latitude": 18.5531,
        "longitude": 73.8207,
        "type": "safe_zone",
        "capacity": 1800,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "High elevation designated refuge zone with emergency generator back-up & fresh water tanks.",
        "contact": "020-25652410",
    },

    # ---- Pune Shelters ----
    {
        "name": "Shivaji Nagar Multi-Purpose Community Shelter",
        "latitude": 18.5308,
        "longitude": 73.8474,
        "type": "shelter",
        "capacity": 500,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Municipal emergency shelter with first-aid post, emergency rations, and cots.",
        "contact": "020-25501000",
    },
    {
        "name": "Baner Emergency Relief Camp",
        "latitude": 18.5590,
        "longitude": 73.7868,
        "type": "shelter",
        "capacity": 400,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Active disaster relief camp with mobile clinic & water filtration units.",
        "contact": "020-27290000",
    },
    {
        "name": "Hadapsar Evacuation & Transit Centre",
        "latitude": 18.5018,
        "longitude": 73.9260,
        "type": "shelter",
        "capacity": 600,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Transit evacuation hub equipped with food distribution and medical triage.",
        "contact": "020-26870000",
    },

    # ---- Pune Hospitals ----
    {
        "name": "Sassoon General Hospital & Trauma Center",
        "latitude": 18.5163,
        "longitude": 73.8569,
        "type": "hospital",
        "capacity": 1800,
        "current_occupancy": 320,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Government tertiary hospital with 24/7 disaster casualty & ICU beds.",
        "contact": "020-26128000",
    },
    {
        "name": "KEM Hospital Pune",
        "latitude": 18.5246,
        "longitude": 73.8553,
        "type": "hospital",
        "capacity": 900,
        "current_occupancy": 150,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Emergency acute care hospital with blood bank and pediatric emergency team.",
        "contact": "020-26127544",
    },
    {
        "name": "Ruby Hall Clinic Emergency Division",
        "latitude": 18.5312,
        "longitude": 73.8794,
        "type": "hospital",
        "capacity": 550,
        "current_occupancy": 120,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Multi-specialty emergency cardiac & trauma facility.",
        "contact": "020-66455000",
    },

    # ---- Pune Fire & Police ----
    {
        "name": "Pune Central Fire Brigade HQ",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "type": "fire_station",
        "capacity": 150,
        "current_occupancy": 20,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Fire & flood search-and-rescue headquarters with motorboat fleet.",
        "contact": "101",
    },
    {
        "name": "Kothrud Fire Station",
        "latitude": 18.5074,
        "longitude": 73.8090,
        "type": "fire_station",
        "capacity": 100,
        "current_occupancy": 10,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Rapid rescue response unit equipped with water pumps and inflatable boats.",
        "contact": "101",
    },
    {
        "name": "Shivajinagar Police Headquarters",
        "latitude": 18.5295,
        "longitude": 73.8417,
        "type": "police",
        "capacity": 200,
        "current_occupancy": 30,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Emergency dispatch & law enforcement coordination center.",
        "contact": "020-25512444",
    },

    # ---- Mumbai Safe Zones (Elevated Ground) ----
    {
        "name": "Malabar Hill High Ground Safe Zone",
        "latitude": 18.9548,
        "longitude": 72.7985,
        "type": "safe_zone",
        "capacity": 3500,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Elevated coastal ridge (50m ASL) immune to coastal surges & street flooding.",
        "contact": "022-23630000",
    },
    {
        "name": "Powai Hills High Ground Safe Zone",
        "latitude": 19.1235,
        "longitude": 72.9080,
        "type": "safe_zone",
        "capacity": 3000,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Elevated rocky plateau near IIT Bombay — designated high-capacity refuge safe haven.",
        "contact": "022-25767000",
    },
    {
        "name": "Pali Hill Bandra Elevated Safe Haven",
        "latitude": 19.0620,
        "longitude": 72.8270,
        "type": "safe_zone",
        "capacity": 2000,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Naturally elevated hill zone in Western suburbs providing storm runoff safety.",
        "contact": "022-26421000",
    },

    # ---- Mumbai Shelters ----
    {
        "name": "BKC MMRDA Evacuation Camp",
        "latitude": 19.0667,
        "longitude": 72.8647,
        "type": "shelter",
        "capacity": 1500,
        "current_occupancy": 50,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Central mega-shelter with emergency bedding, medical tents, and generator power.",
        "contact": "022-26590000",
    },
    {
        "name": "Dadar Municipal Relief Centre",
        "latitude": 19.0178,
        "longitude": 72.8478,
        "type": "shelter",
        "capacity": 800,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Municipal emergency shelter with food distribution & clean drinking water reserves.",
        "contact": "022-24220000",
    },
    {
        "name": "Andheri West Sports Complex Shelter",
        "latitude": 19.1350,
        "longitude": 72.8280,
        "type": "shelter",
        "capacity": 1200,
        "current_occupancy": 0,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Covered athletic complex converted into community evacuation center.",
        "contact": "022-26730000",
    },

    # ---- Mumbai Hospitals ----
    {
        "name": "KEM Hospital Mumbai (Parel)",
        "latitude": 18.9996,
        "longitude": 72.8427,
        "type": "hospital",
        "capacity": 1800,
        "current_occupancy": 400,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Major tertiary civic hospital with comprehensive emergency & disaster casualty wing.",
        "contact": "022-24107000",
    },
    {
        "name": "Lilavati Hospital & Research Centre (Bandra)",
        "latitude": 19.0515,
        "longitude": 72.8286,
        "type": "hospital",
        "capacity": 450,
        "current_occupancy": 110,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Multi-specialty emergency facility with life-support ambulances.",
        "contact": "022-26751000",
    },
    {
        "name": "Lokmanya Tilak Municipal General Hospital (Sion)",
        "latitude": 19.0360,
        "longitude": 72.8600,
        "type": "hospital",
        "capacity": 1400,
        "current_occupancy": 310,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Level-1 emergency trauma center equipped with specialized disaster response units.",
        "contact": "022-24076381",
    },

    # ---- Mumbai Fire Stations ----
    {
        "name": "Byculla Fire Brigade Headquarters",
        "latitude": 18.9750,
        "longitude": 72.8330,
        "type": "fire_station",
        "capacity": 200,
        "current_occupancy": 25,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Mumbai Fire Brigade HQ with heavy rescue vehicles, high-volume dewatering pumps & boats.",
        "contact": "101",
    },
    {
        "name": "Bandra Fire & Rescue Division",
        "latitude": 19.0558,
        "longitude": 72.8397,
        "type": "fire_station",
        "capacity": 120,
        "current_occupancy": 15,
        "availability_status": "open",
        "risk_level": "Low",
        "description": "Suburban rapid rescue station with amphibious capabilities.",
        "contact": "101",
    },
]


def seed_default_locations(db: Session) -> int:
    """
    Idempotently seeds all default emergency locations, shelters, hospitals, and safe zones.
    Returns the count of new locations inserted.
    """
    inserted = 0
    for loc_data in DEFAULT_LOCATIONS:
        existing = db.query(EmergencyLocation).filter(
            EmergencyLocation.name == loc_data["name"]
        ).first()
        if not existing:
            loc = EmergencyLocation(**loc_data, is_seed_data=True)
            db.add(loc)
            inserted += 1
    if inserted > 0:
        db.commit()
    return inserted

