import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, AlertTriangle, ShieldAlert, Search, Filter, Clock, CheckCircle } from 'lucide-react'
import api from '../services/api'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('ALL')
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
    .filter((a) => a.message.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Emergency Broadcast Alerts</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              DISPATCH FEED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time public warnings, disaster escalations, and incident advisories issued by command authorities.
          </p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all ${
                filter === level
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-64 relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search advisory..."
            className="input-control pl-9 text-xs"
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="h-7 w-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-500">RETRIEVING DISPATCH FEED...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-panel p-12 text-center text-slate-400 text-xs font-mono space-y-2">
          <Bell className="h-8 w-8 mx-auto text-slate-600" />
          <p className="text-sm text-slate-300 font-sans font-medium">No alerts matching criteria</p>
          <p className="text-slate-500">No broadcast advisories currently match your active severity filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="card-panel p-4 flex flex-col sm:flex-row items-start justify-between gap-4 group hover:border-slate-700"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    alert.risk_level === 'Critical' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                    alert.risk_level === 'High' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' :
                    alert.risk_level === 'Moderate' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {alert.risk_level} SEVERITY
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-200 text-sm leading-relaxed">{alert.message}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
