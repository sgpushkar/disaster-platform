import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, MapPin, Bell, ShieldAlert, Trash2, Plus, RefreshCw,
  Loader2, AlertTriangle, CheckCircle, Database, UserCog,
  Clock, Bot, Leaf,
} from 'lucide-react'
import api from '../services/api'

function AdminSection({ title, icon: Icon, children }) {
  return (
    <div className="card-panel overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-bold font-mono uppercase text-slate-200">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function Admin() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [alerts, setAlerts] = useState([])
  const [tab, setTab] = useState('users')

  const [usersLoading, setUsersLoading] = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const showFeedback = (type, message) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback({ type: '', message: '' }), 4000)
  }

  const [newLocation, setNewLocation] = useState({
    name: '', latitude: '', longitude: '', type: 'shelter',
    capacity: '', availability_status: 'open',
    risk_level: 'Low', description: '', contact: '',
  })
  const [newAlert, setNewAlert] = useState({
    title: '', message: '', risk_level: 'Moderate', risk_score: '',
    location_name: '', recommended_action: '', expires_at: '',
  })

  useEffect(() => { loadUsers(); loadLocations(); loadAlerts() }, [])

  const loadUsers = async () => {
    setUsersLoading(true)
    try { const r = await api.get('/admin/users'); setUsers(r.data) }
    catch (_) {}
    finally { setUsersLoading(false) }
  }

  const loadLocations = async () => {
    setLocLoading(true)
    try { const r = await api.get('/map'); setLocations(r.data) }
    catch (_) {}
    finally { setLocLoading(false) }
  }

  const loadAlerts = async () => {
    setAlertLoading(true)
    try { const r = await api.get('/alerts', { params: { limit: 50 } }); setAlerts(r.data) }
    catch (_) {}
    finally { setAlertLoading(false) }
  }

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return
    try { await api.delete(`/admin/users/${id}`); setUsers(u => u.filter(x => x.id !== id)); showFeedback('success', 'User deleted.') }
    catch (err) { showFeedback('error', err.response?.data?.detail || 'Delete failed') }
  }

  const deleteLocation = async (id) => {
    if (!confirm('Delete this location?')) return
    try { await api.delete(`/admin/locations/${id}`); setLocations(l => l.filter(x => x.id !== id)); showFeedback('success', 'Location deleted.') }
    catch (err) { showFeedback('error', err.response?.data?.detail || 'Delete failed') }
  }

  const deleteAlert = async (id) => {
    if (!confirm('Delete this alert?')) return
    try { await api.delete(`/admin/alerts/${id}`); setAlerts(a => a.filter(x => x.id !== id)); showFeedback('success', 'Alert deleted.') }
    catch (err) { showFeedback('error', err.response?.data?.detail || 'Delete failed') }
  }

  const createLocation = async (e) => {
    e.preventDefault()
    try {
      const r = await api.post('/admin/locations', {
        ...newLocation,
        latitude: parseFloat(newLocation.latitude),
        longitude: parseFloat(newLocation.longitude),
        capacity: newLocation.capacity ? parseInt(newLocation.capacity) : null,
      })
      setLocations(l => [...l, r.data])
      setNewLocation({ name: '', latitude: '', longitude: '', type: 'shelter', capacity: '', availability_status: 'open', risk_level: 'Low', description: '', contact: '' })
      showFeedback('success', `Location "${r.data.name}" added.`)
    } catch (err) { showFeedback('error', err.response?.data?.detail || 'Failed to add location') }
  }

  const createAlert = async (e) => {
    e.preventDefault()
    try {
      const r = await api.post('/admin/alerts', {
        ...newAlert,
        risk_score: newAlert.risk_score ? parseFloat(newAlert.risk_score) : null,
        expires_at: newAlert.expires_at || null,
      })
      setAlerts(a => [r.data, ...a])
      setNewAlert({ title: '', message: '', risk_level: 'Moderate', risk_score: '', location_name: '', recommended_action: '', expires_at: '' })
      showFeedback('success', 'Alert broadcast.')
    } catch (err) { showFeedback('error', err.response?.data?.detail || 'Failed to create alert') }
  }

  const seedLocations = async () => {
    setSeedLoading(true)
    try {
      const r = await api.post('/admin/seed-locations')
      setSeedMsg(r.data.detail)
      await loadLocations()
      showFeedback('success', r.data.detail)
    } catch (err) { showFeedback('error', err.response?.data?.detail || 'Seed failed') }
    finally { setSeedLoading(false) }
  }

  const TABS = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'alerts', label: 'Alerts', icon: Bell },
  ]

  const inputCls = 'input-control text-xs py-2'
  const selectCls = 'input-control text-xs py-2 bg-slate-950/70'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Admin Panel</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
              ADMIN ONLY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">System management · Data seeding · Emergency broadcasts</p>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback.message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`card-panel p-3.5 flex items-center gap-2 text-sm ${
            feedback.type === 'success' ? 'border-emerald-500/30 text-emerald-300' : 'border-red-500/30 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {feedback.message}
        </motion.div>
      )}

      {/* Dev seed section */}
      <AdminSection title="Development Data Seeding" icon={Database}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-300 font-medium">Seed Pune Emergency Locations</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Populates hospitals, shelters, police stations, fire stations & safe zones for Pune, India.
              <strong className="text-amber-400"> Clearly marked as dev/unverified data.</strong>
            </p>
            {seedMsg && <p className="text-xs text-emerald-400 mt-1">{seedMsg}</p>}
          </div>
          <button
            onClick={seedLocations}
            disabled={seedLoading}
            className="btn-primary text-xs py-2 px-4 shrink-0"
          >
            {seedLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Leaf className="h-3.5 w-3.5" />}
            {seedLoading ? 'Seeding...' : 'Seed Locations'}
          </button>
        </div>
      </AdminSection>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium font-mono transition-all border-b-2 -mb-px ${
              tab === id
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="text-[10px] font-mono text-slate-600">
              ({id === 'users' ? users.length : id === 'locations' ? locations.length : alerts.length})
            </span>
          </button>
        ))}
      </div>

      {/* ── Users Tab ── */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={loadUsers} disabled={usersLoading} className="btn-secondary text-xs py-1.5 px-3">
              <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {users.map((u) => (
            <div key={u.id} className="card-panel p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                  {u.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{u.name}</p>
                  <p className="text-xs font-mono text-slate-400">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  u.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25 font-bold'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {u.role}
                </span>
                <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Locations Tab ── */}
      {tab === 'locations' && (
        <div className="space-y-5">
          {/* Add form */}
          <form onSubmit={createLocation} className="card-panel p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              Add Emergency Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required value={newLocation.name} onChange={e => setNewLocation(p => ({...p, name: e.target.value}))} placeholder="Name *" className={inputCls} />
              <select value={newLocation.type} onChange={e => setNewLocation(p => ({...p, type: e.target.value}))} className={selectCls}>
                {['shelter','hospital','police','fire_station','safe_zone','danger_zone'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input required type="number" step="any" value={newLocation.latitude} onChange={e => setNewLocation(p => ({...p, latitude: e.target.value}))} placeholder="Latitude *" className={inputCls} />
              <input required type="number" step="any" value={newLocation.longitude} onChange={e => setNewLocation(p => ({...p, longitude: e.target.value}))} placeholder="Longitude *" className={inputCls} />
              <input type="number" value={newLocation.capacity} onChange={e => setNewLocation(p => ({...p, capacity: e.target.value}))} placeholder="Capacity (optional)" className={inputCls} />
              <select value={newLocation.availability_status} onChange={e => setNewLocation(p => ({...p, availability_status: e.target.value}))} className={selectCls}>
                <option value="open">Open</option>
                <option value="full">Full</option>
                <option value="closed">Closed</option>
              </select>
              <select value={newLocation.risk_level} onChange={e => setNewLocation(p => ({...p, risk_level: e.target.value}))} className={selectCls}>
                {['Low','Moderate','High','Critical'].map(l => <option key={l} value={l}>{l} Risk</option>)}
              </select>
              <input value={newLocation.contact} onChange={e => setNewLocation(p => ({...p, contact: e.target.value}))} placeholder="Contact / phone" className={inputCls} />
              <input value={newLocation.description} onChange={e => setNewLocation(p => ({...p, description: e.target.value}))} placeholder="Description (optional)" className={`${inputCls} sm:col-span-2`} />
            </div>
            <button type="submit" className="btn-primary text-xs py-2 px-4">
              <Plus className="h-3.5 w-3.5" /> Add Location
            </button>
          </form>

          {/* Locations list */}
          <div className="space-y-2">
            {locations.map((loc) => (
              <div key={loc.id} className="card-panel p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium">{loc.name}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{loc.type}</span>
                    {loc.is_seed_data && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">dev seed</span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-500">
                    {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                    {loc.availability_status && ` · ${loc.availability_status}`}
                  </p>
                </div>
                <button onClick={() => deleteLocation(loc.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alerts Tab ── */}
      {tab === 'alerts' && (
        <div className="space-y-5">
          {/* Create alert form */}
          <form onSubmit={createAlert} className="card-panel p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-400" />
              Broadcast Emergency Alert
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={newAlert.title}
                onChange={e => setNewAlert(p => ({...p, title: e.target.value}))}
                placeholder="Alert title (e.g. Flood Warning — Nashik)"
                className={`${inputCls} sm:col-span-2`}
              />
              <select
                value={newAlert.risk_level}
                onChange={e => setNewAlert(p => ({...p, risk_level: e.target.value}))}
                className={selectCls}
              >
                {['Low','Moderate','High','Critical'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input
                type="number" min="0" max="100" step="0.1"
                value={newAlert.risk_score}
                onChange={e => setNewAlert(p => ({...p, risk_score: e.target.value}))}
                placeholder="Risk score 0–100 (optional)"
                className={inputCls}
              />
              <input
                value={newAlert.location_name}
                onChange={e => setNewAlert(p => ({...p, location_name: e.target.value}))}
                placeholder="Location name (optional)"
                className={inputCls}
              />
              <input
                type="datetime-local"
                value={newAlert.expires_at}
                onChange={e => setNewAlert(p => ({...p, expires_at: e.target.value}))}
                className={inputCls}
                title="Expiry date/time (optional)"
              />
            </div>
            <textarea
              required
              rows={3}
              value={newAlert.message}
              onChange={e => setNewAlert(p => ({...p, message: e.target.value}))}
              placeholder="Alert message (required) *"
              className={`${inputCls} resize-none`}
            />
            <textarea
              rows={2}
              value={newAlert.recommended_action}
              onChange={e => setNewAlert(p => ({...p, recommended_action: e.target.value}))}
              placeholder="Recommended action (optional — what should people do?)"
              className={`${inputCls} resize-none`}
            />
            <button type="submit" className="btn-primary text-xs py-2 px-4">
              <ShieldAlert className="h-3.5 w-3.5" /> Broadcast Alert
            </button>
          </form>

          {/* Alert list */}
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="card-panel p-3.5 flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      alert.risk_level === 'Critical' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                      alert.risk_level === 'High' ? 'bg-orange-500/15 text-orange-400 border-orange-500/25' :
                      'bg-amber-500/15 text-amber-400 border-amber-500/25'
                    }`}>
                      {alert.risk_level}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      alert.source === 'ai' ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    }`}>
                      {alert.source === 'ai' ? <Bot className="h-2.5 w-2.5" /> : <UserCog className="h-2.5 w-2.5" />}
                      {alert.source}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {alert.title && <p className="text-sm font-semibold text-white">{alert.title}</p>}
                  <p className="text-xs text-slate-400 line-clamp-2">{alert.message}</p>
                  {alert.recommended_action && (
                    <p className="text-[11px] text-slate-500 italic line-clamp-1">→ {alert.recommended_action}</p>
                  )}
                </div>
                <button onClick={() => deleteAlert(alert.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
