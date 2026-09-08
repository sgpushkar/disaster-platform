import React, { useState, useEffect } from 'react'
import { MapPin, Loader2, AlertCircle, Navigation } from 'lucide-react'

const DEFAULT_CITIES = [
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Nashik', lat: 19.9975, lon: 73.7898 },
  { name: 'Kolhapur', lat: 16.7050, lon: 74.2433 },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882 },
  { name: 'Aurangabad', lat: 19.8762, lon: 75.3433 },
]

const STORAGE_KEY = 'disaster_intel_location'

export default function LocationSelector({ onLocationChange }) {
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState('idle')
  const [showCityPicker, setShowCityPicker] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const loc = JSON.parse(saved)
        setLocation(loc)
        onLocationChange?.(loc)
        setStatus('granted')
        return
      } catch (_) {}
    }
    requestGeolocation()
  }, [])

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setStatus('denied')
      return
    }
    setStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const accuracy = Math.round(pos.coords.accuracy || 20)
        const coordsText = `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`
        const loc = {
          lat,
          lon,
          accuracy,
          name: `GPS: ${coordsText}`,
          coordsText,
          source: 'gps',
        }
        saveLocation(loc)
        setStatus('granted')
      },
      () => {
        setStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }

  const saveLocation = (loc) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
    setLocation(loc)
    onLocationChange?.(loc)
    window.dispatchEvent(new CustomEvent('locationChanged', { detail: loc }))
  }

  const selectCity = (city) => {
    const loc = { lat: city.lat, lon: city.lon, name: city.name, source: 'manual' }
    saveLocation(loc)
    setStatus('granted')
    setShowCityPicker(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {status === 'requesting' && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
            Acquiring GPS...
          </span>
        )}

        {status === 'granted' && location && (
          <button
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg
              bg-slate-850 border border-slate-700 text-zinc-200 hover:border-red-500/50 transition-all shadow-sm"
          >
            <Navigation className="h-3 w-3 text-red-500" />
            <span className="max-w-[150px] truncate font-semibold text-white">{location.name}</span>
            <span className="text-zinc-500 ml-0.5">▾</span>
          </button>
        )}

        {status === 'denied' && (
          <button
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg
              bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <AlertCircle className="h-3 w-3" />
            Select Sector
            <span className="text-red-500/60 ml-0.5">▾</span>
          </button>
        )}

        {status === 'idle' && (
          <button
            onClick={requestGeolocation}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg
              bg-slate-800 border border-slate-700 text-zinc-300 hover:bg-slate-700 transition-all"
          >
            <MapPin className="h-3 w-3 text-red-500" />
            Detect Sector
          </button>
        )}
      </div>

      {/* Sector picker dropdown */}
      {showCityPicker && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#111114] border border-[#27272a] rounded-xl shadow-2xl p-1.5 w-56 backdrop-blur-xl">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Sector Telemetry</p>
            {location?.source === 'gps' && (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                LIVE GPS
              </span>
            )}
          </div>
          
          <button
            onClick={() => { requestGeolocation(); setShowCityPicker(false) }}
            className="w-full text-left px-2.5 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-mono flex items-center gap-2 mb-1 border-b border-slate-800"
          >
            <Navigation className="h-3.5 w-3.5 shrink-0 text-red-500 animate-pulse" />
            <span className="font-semibold">Acquire Exact GPS Location</span>
          </button>

          <div className="space-y-0.5">
            {DEFAULT_CITIES.map((city) => (
              <button
                key={city.name}
                onClick={() => selectCity(city)}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors font-mono flex items-center justify-between ${
                  location?.name === city.name 
                    ? 'bg-red-500/15 text-red-400 font-semibold border border-red-500/30' 
                    : 'text-zinc-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{city.name}</span>
                {location?.name === city.name && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
