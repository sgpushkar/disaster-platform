import requests

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

query = get_overpass_query(BBOX)
response = requests.post(
    OVERPASS_URL, 
    data={'data': query}, 
    headers={
        'User-Agent': 'DisasterIntelApp/1.0 (contact@example.com)',
        'Accept': '*/*'
    }
)
print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    print(f"Success! Found {len(response.json().get('elements', []))} elements.")
else:
    print(response.text)
