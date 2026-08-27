import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  MapPin, Navigation, Shield, Clock, Star, ArrowRight,
  AlertTriangle, RefreshCw, Loader2, Building2, Home,
  Flame, Phone, Info,
} from 'lucide-react'
import api from '../services/api'

const TYPE_ICONS = {
  shelter: { icon: Home, color: '#10b981', label: 'Evacuation Shelter' },
  hospital: { icon: Building2, color: '#ef4444', label: 'Hospital' },
  safe_zone: { icon: Shield, color: '#3b82f6', label: 'Safe Zone' },
  fire_station: { icon: Flame, color: '#f97316', label: 'Fire Station' },
}

const createPinIcon = (color, letter) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${color};width:32px;height:32px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:white;font-weight:bold;font-size:12px">${letter}</span>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
  })

const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;background:#3b82f6;border-radius:50%;
    border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 2px 8px rgba(0,0,0,0.4)">
  </div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
})

function MapUpdater({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, 13, { animate: true }) }, [center])
  return null
}

const SCORE_COLOR = (score) =>
  score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-orange-400'

export default function SafeAreas() {
  const [userLoc, setUserLoc] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [route, setRoute] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const fetchSafeAreas = useCallback(async (lat, lon) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/safety/nearby', { params: { lat, lon, radius_km: 15 } })
      setResults(data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load safe areas. Make sure locations are seeded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('disaster_intel_location')
    if (saved) {
      try {
        const loc = JSON.parse(saved)
        setUserLoc(loc)
        fetchSafeAreas(loc.lat, loc.lon)
        return
      } catch (_) {}
    }
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your Location' }
        setUserLoc(loc)
        fetchSafeAreas(loc.lat, loc.lon)
      },
      () => {
        // Default to Pune
        const loc = { lat: 18.5204, lon: 73.8567, name: 'Pune (Default)' }
        setUserLoc(loc)
        fetchSafeAreas(loc.lat, loc.lon)
      }
    )
  }, [])

  const fetchRoute = async (result) => {
    if (!userLoc) return
    setRouteLoading(true)
    setSelected(result)
    try {
      const { data } = await api.get('/evacuation/route', {
        params: {
          from_lat: userLoc.lat, from_lon: userLoc.lon,
          to_lat: result.location.latitude, to_lon: result.location.longitude,
          to_name: result.location.name,
        }
      })
      setRoute(data)
    } catch (_) {
      setRoute(null)
    } finally {
      setRouteLoading(false)
    }
  }

  const mapCenter = userLoc ? [userLoc.lat, userLoc.lon] : [18.5204, 73.8567]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Safe Area Finder</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              RANKED BY SAFETY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Nearest shelters, hospitals & safe zones — ranked by distance, destination risk, and capacity.
          </p>
        </div>
        {userLoc && (
          <button
            onClick={() => fetchSafeAreas(userLoc.lat, userLoc.lon)}
            disabled={loading}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {error && (
        <div className="card-panel p-4 border-amber-500/30 bg-amber-500/5 flex items-start gap-3 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <p className="text-xs mt-1 text-amber-400/70">
              Tip: Go to Admin panel and click "Seed Locations" to populate Pune emergency data.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Results List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
              <p className="text-sm text-slate-400 font-mono">Searching safe areas...</p>
            </div>
          ) : results.length === 0 && !error ? (
            <div className="card-panel p-8 text-center space-y-2">
              <Shield className="h-10 w-10 text-slate-700 mx-auto" />
              <p className="text-slate-400 text-sm">No safe areas found within 15 km.</p>
              <p className="text-xs text-slate-500">Try seeding locations from the Admin panel.</p>
            </div>
          ) : (
            results.map((result, i) => {
              const typeCfg = TYPE_ICONS[result.location.type] || TYPE_ICONS.shelter
              const Icon = typeCfg.icon
              const isSelected = selected?.location?.id === result.location.id

              return (
                <motion.div
                  key={result.location.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`card-panel p-4 cursor-pointer transition-all ${
                    isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'hover:border-slate-700'
                  }`}
                  onClick={() => setSelected(isSelected ? null : result)}
                >
                  <div className="flex items-start gap-3">
                    {/* Rank */}
                    <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono border ${
                      i === 0 ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                      'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: typeCfg.color }} />
                            <p className="text-sm font-semibold text-white truncate">{result.location.name}</p>
                            {i === 0 && (
                              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                                TOP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{typeCfg.label}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-lg font-bold font-mono ${SCORE_COLOR(result.safety_score)}`}>
                            {result.safety_score}
                          </p>
                          <p className="text-[9px] font-mono text-slate-500">SAFETY</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {result.distance_km} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> ~{result.estimated_minutes} min
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          result.destination_risk === 'Low' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          result.destination_risk === 'Moderate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {result.destination_risk} Risk
                        </span>
                      </div>

                      {result.reason && (
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{result.reason}</p>
                      )}

                      {/* Availability */}
                      {result.location.availability_status && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            result.location.availability_status === 'open' ? 'bg-emerald-400' :
                            result.location.availability_status === 'full' ? 'bg-red-400' : 'bg-slate-500'
                          }`} />
                          <span className="text-[10px] font-mono text-slate-500 capitalize">
                            {result.location.availability_status}
                            {result.location.capacity && ` · Capacity: ${result.location.capacity}`}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); fetchRoute(result) }}
                          disabled={routeLoading && selected?.location?.id === result.location.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                            bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
                        >
                          {routeLoading && selected?.location?.id === result.location.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Navigation className="h-3 w-3" />
                          )}
                          View Route
                        </button>
                        {result.location.contact && (
                          <a
                            href={`tel:${result.location.contact}`}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                              bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all"
                          >
                            <Phone className="h-3 w-3" />
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-3">
          <div className="card-panel p-2 sticky top-20">
            <MapContainer
              center={mapCenter}
              zoom={13}
              className="h-[520px] w-full rounded-lg"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {userLoc && <MapUpdater center={[userLoc.lat, userLoc.lon]} />}

              {/* User location */}
              {userLoc && (
                <Marker position={[userLoc.lat, userLoc.lon]} icon={userIcon}>
                  <Popup>
                    <div className="text-sm font-mono">
                      <strong className="text-white">📍 Your Location</strong>
                      <p className="text-slate-400 text-xs mt-1">{userLoc.name}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Safe area markers */}
              {results.map((result, i) => {
                const typeCfg = TYPE_ICONS[result.location.type] || TYPE_ICONS.shelter
                const letter = result.location.name[0].toUpperCase()
                return (
                  <Marker
                    key={result.location.id}
                    position={[result.location.latitude, result.location.longitude]}
                    icon={createPinIcon(i === 0 ? '#10b981' : typeCfg.color, letter)}
                  >
                    <Popup>
                      <div className="space-y-1 min-w-[160px]">
                        <p className="font-bold text-white text-sm">{result.location.name}</p>
                        <p className="text-[11px] font-mono text-slate-400">{typeCfg.label}</p>
                        <div className="flex gap-2 text-[11px] font-mono text-slate-300">
                          <span>📏 {result.distance_km} km</span>
                          <span>🛡️ {result.safety_score}/100</span>
                        </div>
                        {result.location.contact && (
                          <p className="text-[11px] text-blue-400">📞 {result.location.contact}</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {/* Evacuation route */}
              {route?.route_coordinates?.length > 1 && (
                <Polyline
                  positions={route.route_coordinates}
                  pathOptions={{ color: '#3b82f6', weight: 4, dashArray: route.provider === 'straight_line' ? '8 6' : null }}
                />
              )}
            </MapContainer>

            {/* Route info */}
            {route && (
              <div className="mt-2 p-3 rounded-lg bg-slate-950/80 border border-blue-500/30 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-300">Route to {route.to_name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    route.provider === 'osrm'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  }`}>
                    {route.provider === 'osrm' ? 'Road Route' : 'Estimate Only'}
                  </span>
                </div>
                <div className="flex gap-4 font-mono text-slate-300">
                  <span>📏 {route.distance_km} km</span>
                  <span>⏱️ ~{route.estimated_minutes} min</span>
                </div>
                <p className="text-slate-500 leading-relaxed">{route.risk_notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
