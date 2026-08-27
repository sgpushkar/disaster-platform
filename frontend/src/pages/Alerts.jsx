import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, AlertTriangle, ShieldAlert, Search, Clock,
  CheckCircle, Bot, UserCog, MapPin, Info
} from 'lucide-react'
import api from '../services/api'

const LEVEL_STYLES = {
  Critical: 'bg-red-500/15 text-red-300 border-red-500/35',
  High: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
  Moderate: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  Low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
}

const BORDER_STYLES = {
  Critical: 'border-red-500/25 hover:border-red-500/40',
  High: 'border-orange-500/25 hover:border-orange-500/40',
  Moderate: 'border-amber-500/25',
  Low: 'border-slate-800',
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/alerts', { params: { limit: 100 } })
      .then((res) => setAlerts(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load alerts'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = alerts
    .filter((a) => filter === 'ALL' || a.risk_level?.toUpperCase() === filter)
    .filter((a) => sourceFilter === 'ALL' || a.source?.toUpperCase() === sourceFilter)
    .filter((a) => {
      const searchLower = search.toLowerCase()
      return (
        (a.message?.toLowerCase().includes(searchLower)) ||
        (a.title?.toLowerCase().includes(searchLower))
      )
    })

  const activeCount = alerts.filter(a => a.is_active).length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Emergency Alerts</h1>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
                {activeCount} ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            AI-generated risk warnings and admin-broadcast emergency advisories.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Severity filter */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all ${
                filter === level
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-1.5 text-xs ml-auto">
          {['ALL', 'AI', 'ADMIN'].map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all flex items-center gap-1 ${
                sourceFilter === src
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {src === 'AI' && <Bot className="h-3 w-3" />}
              {src === 'ADMIN' && <UserCog className="h-3 w-3" />}
              {src}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts..."
            className="input-control pl-9 text-xs w-52"
          />
        </div>
      </div>

      {error && (
        <div className="card-panel p-3.5 border-amber-500/30 bg-amber-500/5 flex items-start gap-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="h-7 w-7 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-500">LOADING INCIDENT ALERTS...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-panel p-12 text-center space-y-2">
          <Bell className="h-8 w-8 mx-auto text-slate-700" />
          <p className="text-sm text-slate-300 font-medium">No alerts matching criteria</p>
          <p className="text-xs text-slate-500">No alerts currently match your active filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className={`card-panel p-4 border transition-all ${BORDER_STYLES[alert.risk_level] || 'border-slate-800'} ${
                !alert.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 space-y-2">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      LEVEL_STYLES[alert.risk_level] || LEVEL_STYLES.Low
                    }`}>
                      {alert.risk_level}
                    </span>

                    {/* Source badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
                      alert.source === 'ai'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    }`}>
                      {alert.source === 'ai' ? <Bot className="h-2.5 w-2.5" /> : <UserCog className="h-2.5 w-2.5" />}
                      {alert.source === 'ai' ? 'Telemetry Sensor' : 'Command Broadcast'}
                    </span>

                    {alert.risk_score != null && (
                      <span className="text-[10px] font-mono text-slate-500">
                        Score: {alert.risk_score.toFixed(0)}/100
                      </span>
                    )}

                    {!alert.is_active && (
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
                        EXPIRED
                      </span>
                    )}

                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Title */}
                  {alert.title && (
                    <p className="text-sm font-bold text-white">{alert.title}</p>
                  )}

                  {/* Message */}
                  <p className="text-slate-300 text-sm leading-relaxed">{alert.message}</p>

                  {/* Location */}
                  {alert.location_name && (
                    <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {alert.location_name}
                    </p>
                  )}

                  {/* Recommended action */}
                  {alert.recommended_action && (
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase mb-0.5">Recommended Action</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{alert.recommended_action}</p>
                      </div>
                    </div>
                  )}

                  {/* Expiry */}
                  {alert.expires_at && (
                    <p className="text-[10px] font-mono text-slate-600">
                      Expires: {new Date(alert.expires_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
