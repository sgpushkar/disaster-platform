import React, { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { motion } from 'framer-motion'
import {
  Building2, Home, ShieldAlert, AlertTriangle, MapPin,
  Layers, Search, Flame, Shield, Navigation, Crosshair,
  ExternalLink, Phone, Compass, CheckCircle2, Clock, Footprints, Car
} from 'lucide-react'
import api from '../services/api'

// Controller to smoothly pan & zoom map to a target
function MapFlyController({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target && target.lat != null && target.lon != null) {
      map.flyTo([target.lat, target.lon], target.zoom || 15, { duration: 1.2 })
    }
  }, [target, map])
  return null
}

function MapBoundsComponent({ setBounds }) {
  const map = useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  })
  useEffect(() => {
    setBounds(map.getBounds())
  }, [map, setBounds])
  return null
}

const createCustomIcon = (color, emoji = '●') =>
  L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      background-color:${color};width:30px;height:30px;border-radius:50%;
      border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:13px;font-weight:bold;">
      ${emoji}
    </div>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15],
  })

// High-visibility pulsing user GPS icon
const userPinIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
    <div class="user-gps-pulse" style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.5);"></div>
    <div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;border:2.5px solid #ffffff;box-shadow:0 0 10px rgba(59,130,246,0.8);position:relative;z-index:2;"></div>
  </div>`,
  iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
})

const markerIcons = {
  hospital:     createCustomIcon('#ef4444', '🏥'),
  shelter:      createCustomIcon('#10b981', '🏠'),
  police:       createCustomIcon('#0ea5e9', '👮'),
  fire_station: createCustomIcon('#f97316', '🔥'),
  safe_zone:    createCustomIcon('#06b6d4', '✅'),
  danger_zone:  createCustomIcon('#e11d48', '⚠'),
}

const typeDetails = {
  hospital:     { label: 'Hospitals', color: '#ef4444', icon: Building2 },
  shelter:      { label: 'Shelters', color: '#10b981', icon: Home },
  police:       { label: 'Police Stations', color: '#0ea5e9', icon: ShieldAlert },
  fire_station: { label: 'Fire Stations', color: '#f97316', icon: Flame },
  safe_zone:    { label: 'Safe Zones', color: '#06b6d4', icon: Shield },
  danger_zone:  { label: 'Danger Zones', color: '#e11d48', icon: AlertTriangle },
}

// Haversine distance helper (km)
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371.0
  const dLat = (lat2 - lat1) * Math.PI / 180.0
  const dLon = (lon2 - lon1) * Math.PI / 180.0
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function formatDistance(distKm) {
  if (distKm == null) return '--'
  if (distKm < 1.0) {
    return `${Math.round(distKm * 1000)} m`
  }
  return `${distKm.toFixed(1)} km`
}

export default function MapView() {
  const [locations, setLocations] = useState([])
  const [dangerZones, setDangerZones] = useState([])
  const [filter, setFilter] = useState('all')
  const [nearbyFilter, setNearbyFilter] = useState('all')
  const [radiusFilterKm, setRadiusFilterKm] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)
  const [userLoc, setUserLoc] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [mapStyle, setMapStyle] = useState('streets')

  const [mapBounds, setMapBounds] = useState(null)
  const defaultCenter = [19.0760, 72.8777] // Default Mumbai tactical center

  const acquireExactLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const accuracy = Math.round(pos.coords.accuracy || 15)
        const coordsText = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`
        const loc = {
          lat,
          lon,
          accuracy,
          name: `Exact GPS (${coordsText})`,
          coordsText,
          source: 'gps',
        }
        setUserLoc(loc)
        setFlyTarget({ lat, lon, zoom: 15 })
        setLocating(false)
        localStorage.setItem('disaster_intel_location', JSON.stringify(loc))
        window.dispatchEvent(new CustomEvent('locationChanged', { detail: loc }))
      },
      (err) => {
        console.warn('GPS acquisition error:', err)
        setLocating(false)
        setError('Could not retrieve high-accuracy GPS position. Please ensure location permission is allowed.')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    )
  }

  useEffect(() => {
    // Load locations from DB
    api.get('/map')
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load map data'))

    // Load danger zones from DB
    api.get('/danger-zones')
      .then((res) => setDangerZones(res.data))
      .catch(() => {})

    // Load user location from storage or request GPS
    const saved = localStorage.getItem('disaster_intel_location')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setUserLoc(parsed)
        setFlyTarget({ lat: parsed.lat, lon: parsed.lon, zoom: 14 })
      } catch (_) {}
    } else {
      acquireExactLocation()
    }

    const handleLocationChange = (e) => {
      if (e.detail) {
        setUserLoc(e.detail)
        setFlyTarget({ lat: e.detail.lat, lon: e.detail.lon, zoom: 15 })
      }
    }
    window.addEventListener('locationChanged', handleLocationChange)
    return () => window.removeEventListener('locationChanged', handleLocationChange)
  }, [])

  const mapCenter = userLoc ? [userLoc.lat, userLoc.lon] : defaultCenter

  // Filter for map markers
  const filtered = locations
    .filter((l) => mapBounds ? mapBounds.contains([l.latitude, l.longitude]) : true)
    .filter((l) => filter === 'all' || l.type === filter)
    .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const counts = Object.fromEntries(
    ['all', ...Object.keys(typeDetails)].map(k => {
      const withinBounds = locations.filter(l => mapBounds ? mapBounds.contains([l.latitude, l.longitude]) : true)
      return [k, k === 'all' ? withinBounds.length : withinBounds.filter(l => l.type === k).length]
    })
  )

  // Compute nearby facilities with exact straight-line distance, walking ETA, driving ETA
  const nearbyList = useMemo(() => {
    const originLat = userLoc?.lat ?? defaultCenter[0]
    const originLon = userLoc?.lon ?? defaultCenter[1]

    return locations.map((loc) => {
      const dist = haversineKm(originLat, originLon, loc.latitude, loc.longitude)
      return {
        ...loc,
        distanceKm: dist,
        walkMinutes: dist != null ? Math.round((dist / 4.5) * 60) : null,
        driveMinutes: dist != null ? Math.max(1, Math.round((dist / 30.0) * 60)) : null,
      }
    })
    .filter((loc) => nearbyFilter === 'all' || loc.type === nearbyFilter)
    .filter((loc) => radiusFilterKm === 'all' || (loc.distanceKm != null && loc.distanceKm <= radiusFilterKm))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
  }, [locations, userLoc, nearbyFilter, radiusFilterKm])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header with Exact Location Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Emergency GIS & Nearby Infrastructure</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Compass className="h-3 w-3" />
              TACTICAL GPS
            </span>
            {dangerZones.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-400 border border-rose-500/25">
                {dangerZones.length} DANGER ZONE{dangerZones.length > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-zinc-400 font-mono">
            {userLoc ? (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Your Coordinates: <strong>{userLoc.lat.toFixed(4)}°N, {userLoc.lon.toFixed(4)}°E</strong></span>
                {userLoc.accuracy && (
                  <span className="text-zinc-500 text-[11px]">(±{userLoc.accuracy}m accuracy)</span>
                )}
              </div>
            ) : (
              <span className="text-amber-400">Locating your current GPS coordinates...</span>
            )}
          </div>
        </div>

        {/* Location & Search action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={acquireExactLocation}
            disabled={locating}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-mono shadow-md"
            title="Update to high-precision GPS position"
          >
            <Crosshair className={`h-3.5 w-3.5 ${locating ? 'animate-spin' : ''}`} />
            {locating ? 'Acquiring GPS...' : 'Locate My Position'}
          </button>

          <div className="w-full sm:w-64 relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter map facility..."
              className="input-control pl-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 ${
            filter === 'all' ? 'bg-red-600 text-white font-bold shadow-sm' : 'bg-slate-900 border border-slate-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          All On Map ({counts.all})
        </button>
        {Object.entries(typeDetails).map(([key, info]) => {
          const Icon = info.icon
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                filter === key ? 'bg-red-600 text-white font-bold shadow-sm' : 'bg-slate-900 border border-slate-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: filter === key ? '#ffffff' : info.color }} />
              {info.label} ({counts[key] ?? 0})
            </button>
          )
        })}
      </div>

      {error && (
        <div className="card-panel p-3.5 border-red-500/30 bg-red-500/5 flex items-start gap-2 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="card-panel p-2 relative overflow-hidden">
        {/* Unified Map Controls Toolbar: Recenter + Style Switcher */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-wrap items-center gap-2">
          {userLoc && (
            <button
              onClick={() => setFlyTarget({ lat: userLoc.lat, lon: userLoc.lon, zoom: 15 })}
              className="bg-slate-900/90 border border-slate-700 hover:border-blue-500 text-blue-400 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition-all active:scale-95"
              title="Recenter map on your exact GPS coordinates"
            >
              <Navigation className="h-3.5 w-3.5 text-blue-500" />
              <span>Recenter</span>
            </button>
          )}

          <div className="flex items-center bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-xl gap-1">
            <button
              type="button"
              onClick={() => setMapStyle('streets')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                mapStyle === 'streets'
                  ? 'bg-red-600 text-white shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Detailed OpenStreetMap with full place names, localities, landmarks, and roads"
            >
              🗺️ Places &amp; Streets
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('dark')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                mapStyle === 'dark'
                  ? 'bg-red-600 text-white shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Tactical dark mode with places, roads, and zero watermarks"
            >
              🌙 Dark
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('topo')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                mapStyle === 'topo'
                  ? 'bg-red-600 text-white shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Topographic terrain with elevation contours, landmarks, and roads"
            >
              ⛰️ Topo
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('satellite')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                mapStyle === 'satellite'
                  ? 'bg-red-600 text-white shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Satellite photography with places and road boundaries"
            >
              🛰️ Satellite
            </button>
          </div>
        </div>

        <MapContainer
          center={mapCenter}
          zoom={14}
          className="h-[480px] sm:h-[560px] w-full rounded-lg"
        >
          <MapFlyController target={flyTarget} />
          <MapBoundsComponent setBounds={setMapBounds} />
          
          {mapStyle === 'streets' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          {mapStyle === 'dark' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-dark-tiles"
              maxZoom={19}
            />
          )}

          {mapStyle === 'topo' && (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, METI, NRCAN, GeoBase, Kadaster NL, Ordnance Survey'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {mapStyle === 'satellite' && (
            <>
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={18}
              />
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={18}
              />
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                maxZoom={18}
              />
            </>
          )}

          {/* User Exact Location Marker with Radar Pulse and Accuracy Ring */}
          {userLoc && (
            <>
              {/* Accuracy Perimeter */}
              <Circle
                center={[userLoc.lat, userLoc.lon]}
                radius={userLoc.accuracy || 100}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: '3, 4',
                }}
              />
              <Marker position={[userLoc.lat, userLoc.lon]} icon={userPinIcon}>
                <Popup>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-sm">
                      <Crosshair className="h-4 w-4" />
                      <span>Your Exact Location</span>
                    </div>
                    <p className="text-slate-300 text-xs font-mono">
                      {userLoc.lat.toFixed(5)}°N, {userLoc.lon.toFixed(5)}°E
                    </p>
                    {userLoc.accuracy && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        GPS Accuracy: ±{userLoc.accuracy} meters
                      </p>
                    )}
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      CURRENT POSITION
                    </span>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Emergency locations */}
          {filtered.map((loc) => (
            <React.Fragment key={loc.id}>
              <Marker
                position={[loc.latitude, loc.longitude]}
                icon={markerIcons[loc.type] || markerIcons.danger_zone}
              >
                <Popup>
                  <div className="space-y-1 min-w-[170px]">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      {typeDetails[loc.type]?.label || loc.type}
                    </span>
                    <strong className="text-sm font-bold text-white block">{loc.name}</strong>
                    {loc.description && (
                      <p className="text-[11px] text-slate-400">{loc.description}</p>
                    )}
                    {loc.availability_status && (
                      <p className="text-[11px] font-mono text-emerald-400 capitalize">
                        Status: {loc.availability_status}
                      </p>
                    )}
                    {loc.contact && (
                      <a href={`tel:${loc.contact}`} className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" /> {loc.contact}
                      </a>
                    )}
                    <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                      {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                    </div>
                    {userLoc && (
                      <div className="text-[11px] font-mono text-blue-400 font-semibold pt-0.5">
                        📍 {formatDistance(haversineKm(userLoc.lat, userLoc.lon, loc.latitude, loc.longitude))} away
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

          {/* Danger zones from DB */}
          {dangerZones.filter(z => z.is_active).map((zone) => (
            <React.Fragment key={zone.id}>
              <Circle
                center={[zone.latitude, zone.longitude]}
                radius={zone.radius_m}
                pathOptions={{
                  color: zone.risk_level === 'Critical' ? '#dc2626' : '#f97316',
                  fillColor: zone.risk_level === 'Critical' ? '#dc2626' : '#f97316',
                  fillOpacity: 0.12 + (zone.risk_score / 100) * 0.12,
                  weight: 2, dashArray: '4, 4',
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <strong className="text-red-400 text-sm">⚠️ Danger Zone</strong>
                    {zone.description && <p className="text-[11px] text-slate-400">{zone.description}</p>}
                    <p className="text-[11px] font-mono text-slate-300">
                      Risk: {zone.risk_level} ({zone.risk_score?.toFixed(0)}/100)
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Radius: {zone.radius_m}m
                    </p>
                  </div>
                </Popup>
              </Circle>
              <Marker
                position={[zone.latitude, zone.longitude]}
                icon={markerIcons.danger_zone}
              >
                <Popup>
                  <div>
                    <strong className="text-red-400">⚠️ Danger Zone</strong>
                    <p className="text-[11px] font-mono text-slate-300 mt-1">
                      {zone.risk_level} · {zone.risk_score?.toFixed(0)}/100
                    </p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-5 right-5 z-[1000] bg-slate-900/95 border border-slate-800 rounded-lg p-3 shadow-lg text-[11px] font-mono space-y-1.5 backdrop-blur-md hidden sm:block">
          <span className="font-semibold text-slate-300 block mb-1 uppercase text-[10px]">Map Legend</span>
          {Object.entries(typeDetails).map(([key, info]) => (
            <div key={key} className="flex items-center gap-2 text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
              {info.label}
            </div>
          ))}
          <div className="flex items-center gap-2 text-blue-400 pt-1 border-t border-slate-800/60 mt-1">
            <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-blue-500" />
            Your Exact Location
          </div>
        </div>
      </div>

      {/* --- NEARBY THINGS SECTION --- */}
      <div className="card-panel p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Nearby Emergency Facilities</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PROXIMITY RANKED
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live distance & travel estimates from your coordinates ({userLoc ? `${userLoc.lat.toFixed(4)}°N, ${userLoc.lon.toFixed(4)}°E` : 'Locating...'})
            </p>
          </div>

          {/* Radius selector */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-500">Max Range:</span>
            {[3, 7, 15, 'all'].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusFilterKm(r)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                  radiusFilterKm === r
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-800 text-zinc-400 hover:text-white border border-slate-700'
                }`}
              >
                {r === 'all' ? 'All' : `${r} km`}
              </button>
            ))}
          </div>
        </div>

        {/* Nearby Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <button
            onClick={() => setNearbyFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
              nearbyFilter === 'all'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-900 border border-slate-800 text-zinc-400 hover:text-white'
            }`}
          >
            All Types ({nearbyList.length})
          </button>
          {['hospital', 'shelter', 'police', 'fire_station', 'safe_zone'].map((typeKey) => {
            const info = typeDetails[typeKey]
            if (!info) return null
            const count = locations.filter(l => l.type === typeKey && (radiusFilterKm === 'all' || (haversineKm(userLoc?.lat ?? defaultCenter[0], userLoc?.lon ?? defaultCenter[1], l.latitude, l.longitude) <= radiusFilterKm))).length
            return (
              <button
                key={typeKey}
                onClick={() => setNearbyFilter(typeKey)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  nearbyFilter === typeKey
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-900 border border-slate-800 text-zinc-400 hover:text-white'
                }`}
              >
                <span>{info.label}</span>
                <span className="text-[11px] opacity-75">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Nearby Items Grid */}
        {nearbyList.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
            <MapPin className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-400 font-mono">No facilities found within {radiusFilterKm === 'all' ? 'current filters' : `${radiusFilterKm} km`}.</p>
            <p className="text-xs text-zinc-500 mt-1">Try increasing the range filter or switching categories above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {nearbyList.slice(0, 18).map((loc) => {
              const details = typeDetails[loc.type] || { label: loc.type, color: '#3b82f6', icon: MapPin }
              const Icon = details.icon
              const mapsUrl = userLoc
                ? `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lon}&destination=${loc.latitude},${loc.longitude}`
                : `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`

              return (
                <div
                  key={loc.id}
                  className="card-panel p-3.5 bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{
                          backgroundColor: `${details.color}15`,
                          color: details.color,
                          border: `1px solid ${details.color}35`,
                        }}
                      >
                        <Icon className="h-3 w-3" />
                        {details.label}
                      </span>

                      {loc.distanceKm != null && (
                        <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {formatDistance(loc.distanceKm)}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {loc.name}
                      </h3>
                      {loc.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                          {loc.description}
                        </p>
                      )}
                    </div>

                    {/* ETA Indicators */}
                    {loc.distanceKm != null && (
                      <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 pt-1">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Footprints className="h-3 w-3" />
                          ~{loc.walkMinutes}m walk
                        </span>
                        <span className="flex items-center gap-1 text-blue-400">
                          <Car className="h-3 w-3" />
                          ~{loc.driveMinutes}m drive
                        </span>
                      </div>
                    )}

                    {loc.contact && (
                      <div className="pt-1">
                        <a
                          href={`tel:${loc.contact}`}
                          className="text-xs text-red-400 font-mono hover:underline flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" /> {loc.contact}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80 mt-2">
                    <button
                      onClick={() => {
                        setFlyTarget({ lat: loc.latitude, lon: loc.longitude, zoom: 16 })
                        window.scrollTo({ top: 120, behavior: 'smooth' })
                      }}
                      className="flex-1 text-center py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white transition-all flex items-center justify-center gap-1"
                    >
                      <Crosshair className="h-3 w-3 text-blue-400" />
                      View on Map
                    </button>

                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2.5 rounded bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-xs font-mono text-blue-400 transition-all flex items-center gap-1"
                      title="Open Navigation in Google Maps"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Route
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
