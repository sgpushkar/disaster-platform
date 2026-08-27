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
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: 'Current Location',
          source: 'gps',
        }
        saveLocation(loc)
        setStatus('granted')
      },
      () => {
        setStatus('denied')
      },
      { timeout: 8000, maximumAge: 300000 }
    )
  }

  const saveLocation = (loc) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
    setLocation(loc)
    onLocationChange?.(loc)
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
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
            Acquiring sector...
          </span>
        )}

        {status === 'granted' && location && (
          <button
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg
              bg-slate-850 border border-slate-700/80 text-amber-400 hover:border-amber-500/40 transition-all shadow-sm"
          >
            <Navigation className="h-3 w-3 text-amber-400" />
            <span className="max-w-[130px] truncate font-semibold text-slate-200">{location.name}</span>
            <span className="text-amber-500/60 ml-0.5">▾</span>
          </button>
        )}

        {status === 'denied' && (
          <button
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg
              bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            <AlertCircle className="h-3 w-3" />
            Select Sector
            <span className="text-amber-500/60 ml-0.5">▾</span>
          </button>
        )}

        {status === 'idle' && (
          <button
            onClick={requestGeolocation}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg
              bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all"
          >
            <MapPin className="h-3 w-3 text-amber-400" />
            Detect Sector
          </button>
        )}
      </div>

      {/* Sector picker dropdown */}
      {showCityPicker && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-52 backdrop-blur-xl">
          <p className="text-[10px] font-mono text-slate-500 uppercase px-2.5 py-1.5 tracking-wider">Sector Telemetry</p>
          <div className="space-y-0.5">
            {DEFAULT_CITIES.map((city) => (
              <button
                key={city.name}
                onClick={() => selectCity(city)}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors font-mono flex items-center justify-between ${
                  location?.name === city.name 
                    ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/20' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{city.name}</span>
                {location?.name === city.name && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            ))}
          </div>
          {status === 'denied' && (
            <button
              onClick={() => { requestGeolocation(); setShowCityPicker(false) }}
              className="w-full text-left px-2.5 py-2 text-xs text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors font-mono mt-1 border-t border-slate-800 pt-2"
            >
              <Navigation className="h-3 w-3 inline mr-1.5" />
              Acquire GPS Location
            </button>
          )}
        </div>
      )}
    </div>
  )
}
