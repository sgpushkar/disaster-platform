import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { motion } from 'framer-motion'
import { 
  Building2, 
  Home, 
  ShieldAlert, 
  AlertTriangle, 
  MapPin, 
  Layers, 
  Search,
  ExternalLink,
  Compass
} from 'lucide-react'
import api from '../services/api'

// Custom SVG Icons for Leaflet Markers
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      background-color: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: bold;
    ">
      <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

const markerIcons = {
  hospital: createCustomIcon('#ef4444'),
  shelter: createCustomIcon('#10b981'),
  police: createCustomIcon('#3b82f6'),
  danger_zone: createCustomIcon('#f97316'),
}

const typeDetails = {
  hospital: { label: 'Hospitals', color: '#ef4444', icon: Building2 },
  shelter: { label: 'Shelters', color: '#10b981', icon: Home },
  police: { label: 'Police Stations', color: '#3b82f6', icon: ShieldAlert },
  danger_zone: { label: 'Danger Zones', color: '#f97316', icon: AlertTriangle },
}

export default function MapView() {
  const [locations, setLocations] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const defaultCenter = [19.0760, 72.8777] // Mumbai default

  useEffect(() => {
    api.get('/map')
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load map data'))
  }, [])

  const filtered = locations
    .filter((l) => filter === 'all' || l.type === filter)
    .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const counts = {
    all: locations.length,
    hospital: locations.filter(l => l.type === 'hospital').length,
    shelter: locations.filter(l => l.type === 'shelter').length,
    police: locations.filter(l => l.type === 'police').length,
    danger_zone: locations.filter(l => l.type === 'danger_zone').length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">GIS Emergency Geospatial Map</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              OPENSTREETMAP TILE LAYER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time critical infrastructure, medical centers, evacuation shelters, and high-risk flood zones.
          </p>
        </div>

        {/* Search */}
        <div className="w-full lg:w-72 relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facility name..."
            className="input-control pl-9 text-xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
            filter === 'all'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          All Infrastructure ({counts.all})
        </button>

        {Object.entries(typeDetails).map(([key, info]) => {
          const Icon = info.icon
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                active
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: active ? 'white' : info.color }} />
              {info.label} ({counts[key]})
            </button>
          )
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="card-panel p-2 relative overflow-hidden">
        <MapContainer 
          center={defaultCenter} 
          zoom={12} 
          className="h-[480px] sm:h-[580px] w-full rounded-lg"
          style={{ width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filtered.map((loc) => (
            <React.Fragment key={loc.id}>
              <Marker 
                position={[loc.latitude, loc.longitude]}
                icon={markerIcons[loc.type] || markerIcons.danger_zone}
              >
                <Popup>
                  <div className="p-1 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      {typeDetails[loc.type]?.label || loc.type}
                    </span>
                    <strong className="text-sm font-bold text-white block">{loc.name}</strong>
                    <div className="text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-700/60 flex items-center justify-between gap-4">
                      <span>Coordinates:</span>
                      <span>{loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E</span>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {loc.type === 'danger_zone' && (
                <Circle
                  center={[loc.latitude, loc.longitude]}
                  radius={800}
                  pathOptions={{ 
                    color: '#f97316', 
                    fillColor: '#f97316', 
                    fillOpacity: 0.18,
                    weight: 2,
                    dashArray: '4, 4'
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Floating map legend */}
        <div className="absolute bottom-5 right-5 z-[1000] bg-slate-900/95 border border-slate-800 rounded-lg p-3 shadow-card text-[11px] font-mono space-y-1.5 backdrop-blur-md">
          <span className="font-semibold text-slate-300 block mb-1 uppercase text-[10px]">GIS Legend</span>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Hospital / Trauma Center
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Evacuation Shelter
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Police Station
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> 800m Danger Zone Radius
          </div>
        </div>
      </div>
    </div>
  )
}
