import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { motion } from 'framer-motion'
import {
  Building2, Home, ShieldAlert, AlertTriangle, MapPin,
  Layers, Search, Flame, Shield, Navigation
} from 'lucide-react'
import api from '../services/api'

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

const userPinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;background:#f59e0b;border-radius:50%;
    border:2.5px solid white;box-shadow:0 0 0 5px rgba(245,158,11,0.25),0 3px 10px rgba(0,0,0,0.5);">
  </div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
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

export default function MapView() {
  const [locations, setLocations] = useState([])
  const [dangerZones, setDangerZones] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [userLoc, setUserLoc] = useState(null)

  const defaultCenter = [19.0760, 72.8777]

  useEffect(() => {
    // Load locations
    api.get('/map')
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load map data'))

    // Load danger zones
    api.get('/danger-zones')
      .then((res) => setDangerZones(res.data))
      .catch(() => {})

    // Get user location
    const saved = localStorage.getItem('disaster_intel_location')
    if (saved) {
      try { setUserLoc(JSON.parse(saved)) } catch (_) {}
    } else {
      navigator.geolocation?.getCurrentPosition(pos => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your Location' })
      })
    }
  }, [])

  const filtered = locations
    .filter((l) => filter === 'all' || l.type === filter)
    .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const counts = Object.fromEntries(
    ['all', ...Object.keys(typeDetails)].map(k => [
      k, k === 'all' ? locations.length : locations.filter(l => l.type === k).length
    ])
  )

  const mapCenter = userLoc ? [userLoc.lat, userLoc.lon] : defaultCenter

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Emergency GIS</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              TACTICAL GRID
            </span>
            {dangerZones.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-400 border border-rose-500/25">
                {dangerZones.length} DANGER ZONE{dangerZones.length > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Emergency civil infrastructure, hazard zones, and evacuation routes.
          </p>
        </div>
        <div className="w-full lg:w-72 relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emergency facility..."
            className="input-control pl-9 text-xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 ${
            filter === 'all' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          All ({counts.all})
        </button>
        {Object.entries(typeDetails).map(([key, info]) => {
          const Icon = info.icon
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                filter === key ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: filter === key ? '#08090c' : info.color }} />
              {info.label} ({counts[key] ?? 0})
            </button>
          )
        })}
      </div>

      {error && (
        <div className="card-panel p-3.5 border-amber-500/30 bg-amber-500/5 flex items-start gap-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Map */}
      <div className="card-panel p-2 relative overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={12}
          className="h-[560px] sm:h-[640px] w-full rounded-lg"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User location */}
          {userLoc && (
            <Marker position={[userLoc.lat, userLoc.lon]} icon={userPinIcon}>
              <Popup>
                <div className="space-y-0.5">
                  <strong className="text-white text-sm">📍 Your Location</strong>
                  <p className="text-slate-400 text-[11px] font-mono">{userLoc.name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Emergency locations */}
          {filtered.map((loc) => (
            <React.Fragment key={loc.id}>
              <Marker
                position={[loc.latitude, loc.longitude]}
                icon={markerIcons[loc.type] || markerIcons.danger_zone}
              >
                <Popup>
                  <div className="space-y-1 min-w-[160px]">
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
                      <a href={`tel:${loc.contact}`} className="text-[11px] text-blue-400">
                        📞 {loc.contact}
                      </a>
                    )}
                    <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                      {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                    </div>
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
        <div className="absolute bottom-5 right-5 z-[1000] bg-slate-900/95 border border-slate-800 rounded-lg p-3 shadow-lg text-[11px] font-mono space-y-1.5 backdrop-blur-md">
          <span className="font-semibold text-slate-300 block mb-1 uppercase text-[10px]">Map Legend</span>
          {Object.entries(typeDetails).map(([key, info]) => (
            <div key={key} className="flex items-center gap-2 text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
              {info.label}
            </div>
          ))}
          <div className="flex items-center gap-2 text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
            <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-blue-500" />
            Your Location
          </div>
          {dangerZones.length > 0 && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-orange-500 opacity-60" />
              Danger Zone Radius
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
