import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, MapPin, Bell, ShieldAlert, Trash2, Plus, RefreshCw,
  Loader2, AlertTriangle, CheckCircle, Database, UserCog,
  Clock, Bot, Leaf, Smartphone, Send, Radio, MessageSquare,
} from 'lucide-react'
import api from '../services/api'

function AdminSection({ title, icon: Icon, children }) {
  return (
    <div className="card-panel overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
        <Icon className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-bold font-mono uppercase text-zinc-200">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function Admin() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [alerts, setAlerts] = useState([])
  const [smsSubscribers, setSmsSubscribers] = useState([])
  const [smsLogs, setSmsLogs] = useState([])
  const [smsStatus, setSmsStatus] = useState(null)
  const [smsLoading, setSmsLoading] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastRisk, setBroadcastRisk] = useState('High')
  const [broadcastLocation, setBroadcastLocation] = useState('All Regions')
  const [broadcastSending, setBroadcastSending] = useState(false)
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

  useEffect(() => {
    loadUsers()
    loadLocations()
    loadAlerts()
    loadSMSData()
  }, [])

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

  const loadSMSData = async () => {
    setSmsLoading(true)
    try {
      const [statusRes, subsRes, logsRes] = await Promise.all([
        api.get('/sms/status'),
        api.get('/sms/subscribers'),
        api.get('/sms/logs'),
      ])
      setSmsStatus(statusRes.data)
      setSmsSubscribers(subsRes.data)
      setSmsLogs(logsRes.data)
    } catch (_) {}
    finally { setSmsLoading(false) }
  }

  const sendBroadcastSMS = async (e) => {
    e.preventDefault()
    if (!broadcastMessage.trim()) return
    setBroadcastSending(true)
    try {
      const r = await api.post('/sms/broadcast', {
        message: broadcastMessage.trim(),
        min_risk_level: broadcastRisk,
        location_name: broadcastLocation === 'All Regions' ? null : broadcastLocation,
      })
      showFeedback('success', `SMS broadcast sent: ${r.data.sent} delivered, ${r.data.simulated} simulated.`)
      setBroadcastMessage('')
      loadSMSData()
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || 'Broadcast failed')
    } finally {
      setBroadcastSending(false)
    }
  }

  const sendAdminTestSMS = async (e) => {
    e.preventDefault()
    if (!testPhone.trim()) return
    setTestSending(true)
    try {
      const r = await api.post('/sms/test', { phone_number: testPhone.trim() })
      showFeedback('success', `Test SMS dispatched to ${r.data.result.recipient} (${r.data.result.status}).`)
      loadSMSData()
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || 'Test SMS failed')
    } finally {
      setTestSending(false)
    }
  }

  const TABS = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'sms', label: 'SMS Network', icon: Smartphone },
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
                ? 'border-red-500 text-red-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="text-[10px] font-mono text-zinc-500">
              ({id === 'users' ? users.length : id === 'locations' ? locations.length : id === 'alerts' ? alerts.length : smsSubscribers.length})
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
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-zinc-300">
                  {u.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{u.name}</p>
                  <p className="text-xs font-mono text-zinc-400">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  u.role === 'admin'
                    ? 'bg-red-500/10 text-red-400 border-red-500/25 font-bold'
                    : 'bg-slate-800 text-zinc-400 border-slate-700'
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

      {/* ── SMS Alerts Management Tab ── */}
      {tab === 'sms' && (
        <div className="space-y-5">
          {/* SMS Status Stats Header */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="card-panel p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-zinc-500 uppercase">Gateway Provider</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`h-2 w-2 rounded-full ${smsStatus?.is_live ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <span className="text-sm font-bold text-white">
                  {smsStatus?.is_live ? 'Twilio Live' : 'Dev Simulation'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 mt-1">
                {smsStatus?.is_live ? 'Live carrier delivery active' : 'Safe local logging mode'}
              </span>
            </div>

            <div className="card-panel p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-zinc-500 uppercase">Subscribers</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {smsStatus?.active_subscribers || 0}
              </div>
              <span className="text-[10px] text-emerald-400 mt-1">
                Active alert recipients
              </span>
            </div>

            <div className="card-panel p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-zinc-500 uppercase">Total Dispatches</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                {smsStatus?.recent_sms_count || 0}
              </div>
              <span className="text-[10px] text-zinc-400 mt-1">
                Delivered & simulated logs
              </span>
            </div>

            <div className="card-panel p-4 flex flex-col justify-between items-center text-center">
              <span className="text-[11px] font-mono text-zinc-500 uppercase mb-2">Sync Status</span>
              <button
                onClick={loadSMSData}
                disabled={smsLoading}
                className="btn-secondary text-xs py-1.5 px-3 w-full"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${smsLoading ? 'animate-spin' : ''}`} />
                Refresh Logs
              </button>
            </div>
          </div>

          {/* Broadcast & Test Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Direct SMS Broadcast Composer */}
            <form onSubmit={sendBroadcastSMS} className="card-panel p-5 space-y-3 lg:col-span-2">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-red-500" />
                Emergency SMS Broadcast to Citizens
              </h3>
              <p className="text-xs text-zinc-400">
                Instantly transmit a flash SMS alert to all registered subscribers matching location and severity.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-500 uppercase">Target Region</label>
                  <select
                    value={broadcastLocation}
                    onChange={e => setBroadcastLocation(e.target.value)}
                    className={selectCls}
                  >
                    {['All Regions', 'Pune', 'Mumbai', 'Nashik', 'Nagpur', 'Thane', 'Kolhapur'].map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-500 uppercase">Minimum Severity</label>
                  <select
                    value={broadcastRisk}
                    onChange={e => setBroadcastRisk(e.target.value)}
                    className={selectCls}
                  >
                    {['Critical', 'High', 'Moderate'].map(r => (
                      <option key={r} value={r}>{r} and above</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase">Alert Message Body</label>
                  <span className="text-[10px] font-mono text-zinc-500">{broadcastMessage.length}/320</span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  placeholder="[DISASTER INTEL ALERT] Extreme flood risk detected. River levels rising rapidly. Evacuate low-lying areas immediately. Helpline: 112."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={broadcastSending || !broadcastMessage.trim()}
                className="btn-primary text-xs py-2 px-4"
              >
                {broadcastSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {broadcastSending ? 'Broadcasting SMS...' : 'Transmit Emergency SMS'}
              </button>
            </form>

            {/* Test SMS Sender Tool */}
            <form onSubmit={sendAdminTestSMS} className="card-panel p-5 space-y-3">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
                Test SMS Verification
              </h3>
              <p className="text-xs text-zinc-400">
                Dispatch an immediate test SMS to any mobile number to verify gateway connectivity.
              </p>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase">Mobile Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={testSending || !testPhone.trim()}
                className="btn-secondary text-xs py-2 px-4 w-full"
              >
                {testSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-red-400" />}
                {testSending ? 'Sending Test...' : 'Send Test SMS'}
              </button>
            </form>
          </div>

          {/* Subscribers Table */}
          <div className="card-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-red-400" />
                Registered SMS Alert Subscribers ({smsSubscribers.length})
              </h3>
            </div>
            {smsSubscribers.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No mobile subscribers registered yet. Citizens can subscribe on the Alerts page.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
                {smsSubscribers.map((sub) => (
                  <div key={sub.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-900/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{sub.phone_number}</span>
                        {sub.name && <span className="text-zinc-400">({sub.name})</span>}
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-zinc-300">
                          {sub.location_name || 'All Regions'}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        Min Risk: {sub.min_risk_level} · Subscribed: {new Date(sub.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      sub.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-slate-800 text-zinc-500'
                    }`}>
                      {sub.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SMS Delivery Audit Logs */}
          <div className="card-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-amber-400" />
                Recent SMS Dispatch Audit Trail ({smsLogs.length})
              </h3>
            </div>
            {smsLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No SMS dispatches recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
                {smsLogs.map((log) => (
                  <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-900/40">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-zinc-200">{log.recipient}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase border ${
                          log.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          log.status === 'simulated' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                          'bg-red-500/15 text-red-400 border-red-500/30'
                        }`}>
                          {log.status}
                        </span>
                        {log.risk_level && (
                          <span className="text-[10px] font-mono text-zinc-400">
                            [{log.risk_level}]
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">
                          {new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs line-clamp-1">{log.message}</p>
                      {log.error_message && (
                        <p className="text-[10px] text-red-400">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
