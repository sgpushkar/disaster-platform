import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  MapPin, 
  Bell, 
  CloudSun, 
  Activity, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  Send
} from 'lucide-react'
import api from '../services/api'

const TABS = [
  { label: 'Users', icon: Users },
  { label: 'Locations', icon: MapPin },
  { label: 'Alerts', icon: Bell },
  { label: 'Weather Log', icon: CloudSun },
  { label: 'Predictions', icon: Activity },
]

export default function Admin() {
  const [tab, setTab] = useState('Users')
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [alerts, setAlerts] = useState([])
  const [weather, setWeather] = useState([])
  const [predictions, setPredictions] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [newLocation, setNewLocation] = useState({ name: '', latitude: '', longitude: '', type: 'hospital' })
  const [newAlert, setNewAlert] = useState({ message: '', risk_level: 'Moderate' })
  const [submitting, setSubmitting] = useState(false)

  const loadAll = async () => {
    try {
      const [u, l, a, w, p] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/locations'),
        api.get('/alerts', { params: { limit: 50 } }),
        api.get('/admin/weather'),
        api.get('/admin/predictions'),
      ])
      setUsers(u.data)
      setLocations(l.data)
      setAlerts(a.data)
      setWeather(w.data)
      setPredictions(p.data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load administrative records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const deleteUser = async (id) => {
    if (!confirm('Are you sure you want to remove this user account?')) return
    try {
      await api.delete(`/admin/users/${id}`)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete user.')
    }
  }

  const addLocation = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/admin/locations', {
        ...newLocation,
        latitude: parseFloat(newLocation.latitude),
        longitude: parseFloat(newLocation.longitude),
      })
      setNewLocation({ name: '', latitude: '', longitude: '', type: 'hospital' })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register GIS coordinate.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteLocation = async (id) => {
    try {
      await api.delete(`/admin/locations/${id}`)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove location.')
    }
  }

  const addAlert = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/admin/alerts', newAlert)
      setNewAlert({ message: '', risk_level: 'Moderate' })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to publish emergency alert.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteAlert = async (id) => {
    try {
      await api.delete(`/admin/alerts/${id}`)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete alert.')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">System Administration Console</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              ROOT ACCESS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage user accounts, geospatial infrastructure assets, emergency dispatch advisories, and system telemetry logs.
          </p>
        </div>

        <button onClick={loadAll} className="btn-secondary text-xs py-1.5 px-3">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh All</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-medium">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.label
          return (
            <button
              key={item.label}
              onClick={() => setTab(item.label)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all shrink-0 ${
                active
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Users Tab */}
      {tab === 'Users' && (
        <div className="card-panel overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-200">Registered Accounts ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/60 font-mono uppercase text-slate-500 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Operator Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Authorization Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-200">{u.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                        u.role === 'admin' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Locations Tab */}
      {tab === 'Locations' && (
        <div className="space-y-4">
          {/* Add Location Form */}
          <div className="card-panel p-4 space-y-3">
            <span className="text-xs font-mono uppercase font-bold text-slate-300 block">
              Register New GIS Critical Infrastructure
            </span>
            <form onSubmit={addLocation} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                required
                placeholder="Facility Name (e.g. Metro Hospital)"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="input-control text-xs sm:col-span-2"
              />
              <input
                required
                type="number"
                step="any"
                placeholder="Latitude (e.g. 19.0760)"
                value={newLocation.latitude}
                onChange={(e) => setNewLocation({ ...newLocation, latitude: e.target.value })}
                className="input-control text-xs font-mono"
              />
              <input
                required
                type="number"
                step="any"
                placeholder="Longitude (e.g. 72.8777)"
                value={newLocation.longitude}
                onChange={(e) => setNewLocation({ ...newLocation, longitude: e.target.value })}
                className="input-control text-xs font-mono"
              />
              <select
                value={newLocation.type}
                onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
                className="input-control text-xs"
              >
                <option value="hospital">Hospital</option>
                <option value="shelter">Shelter</option>
                <option value="police">Police Station</option>
                <option value="danger_zone">Danger Zone</option>
              </select>
              <button type="submit" disabled={submitting} className="btn-primary text-xs sm:col-span-5 sm:w-auto">
                <Plus className="h-3.5 w-3.5" />
                Add Asset to GIS Database
              </button>
            </form>
          </div>

          {/* Locations Table */}
          <div className="card-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/60 font-mono uppercase text-slate-500 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Facility Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Coordinates (Lat, Lon)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {locations.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-200">{l.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                          {l.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {l.latitude?.toFixed(4)}, {l.longitude?.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => deleteLocation(l.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'Alerts' && (
        <div className="space-y-4">
          {/* Add Alert Form */}
          <div className="card-panel p-4 space-y-3">
            <span className="text-xs font-mono uppercase font-bold text-slate-300 block">
              Broadcast Emergency Dispatch Advisory
            </span>
            <form onSubmit={addAlert} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                required
                placeholder="Alert description (e.g. Flash flood warning issued for Sector 4)"
                value={newAlert.message}
                onChange={(e) => setNewAlert({ ...newAlert, message: e.target.value })}
                className="input-control text-xs sm:col-span-2"
              />
              <select
                value={newAlert.risk_level}
                onChange={(e) => setNewAlert({ ...newAlert, risk_level: e.target.value })}
                className="input-control text-xs font-mono"
              >
                <option value="Low">Low Priority</option>
                <option value="Moderate">Moderate Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical Priority</option>
              </select>
              <button type="submit" disabled={submitting} className="btn-primary text-xs">
                <Send className="h-3.5 w-3.5" />
                Dispatch Alert
              </button>
            </form>
          </div>

          {/* Alerts List */}
          <div className="card-panel overflow-hidden divide-y divide-slate-800/60">
            {alerts.map((a) => (
              <div key={a.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/20 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      a.risk_level === 'Critical' ? 'bg-red-500/15 text-red-400' :
                      a.risk_level === 'High' ? 'bg-orange-500/15 text-orange-400' :
                      'bg-amber-500/15 text-amber-400'
                    }`}>
                      {a.risk_level}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(a.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-200">{a.message}</p>
                </div>
                <button
                  onClick={() => deleteAlert(a.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather Log Tab */}
      {tab === 'Weather Log' && (
        <div className="card-panel overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-200">Historical Weather Log ({weather.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/60 font-mono uppercase text-slate-500 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Temperature</th>
                  <th className="py-3 px-4">Humidity</th>
                  <th className="py-3 px-4">Wind Speed</th>
                  <th className="py-3 px-4">Rainfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {weather.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{new Date(w.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4 text-white font-semibold">{w.temperature}°C</td>
                    <td className="py-3 px-4 text-slate-300">{w.humidity}%</td>
                    <td className="py-3 px-4 text-slate-300">{w.wind_speed} m/s</td>
                    <td className="py-3 px-4 text-slate-300">{w.rainfall} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Predictions Tab */}
      {tab === 'Predictions' && (
        <div className="card-panel overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-200">Neural Inference Archive ({predictions.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/60 font-mono uppercase text-slate-500 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Model Pipeline</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Execution Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {predictions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-200 capitalize">{p.prediction_type}</td>
                    <td className="py-3 px-4 text-white font-semibold">
                      {p.confidence != null ? `${p.confidence.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        p.risk_level === 'Critical' ? 'bg-red-500/15 text-red-400' :
                        p.risk_level === 'High' ? 'bg-orange-500/15 text-orange-400' :
                        'bg-blue-500/15 text-blue-400'
                      }`}>
                        {p.risk_level || 'Evaluated'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
