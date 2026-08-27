import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import {
  Thermometer, Waves, CloudRain, ShieldAlert, RefreshCw,
  ArrowRight, AlertTriangle, Activity, Wind, Droplets,
  MapPin, TrendingUp, Bell, Zap, Gauge
} from 'lucide-react'
import api from '../services/api'
import StatCard from '../components/StatCard.jsx'
import EarlyWarningBanner from '../components/EarlyWarningBanner.jsx'
import RiskGauge from '../components/RiskGauge.jsx'
import LocationSelector from '../components/LocationSelector.jsx'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
)

const RISK_COLORS = {
  Low: '#10b981', Moderate: '#f59e0b', High: '#f97316', Critical: '#e11d48',
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [riskHistory, setRiskHistory] = useState([])
  const [forecast, setForecast] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)
  const [location, setLocation] = useState(null)

  const loadData = useCallback(async (loc = location, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const activeLoc = loc || location || (() => {
        try {
          const saved = localStorage.getItem('disaster_intel_location')
          return saved ? JSON.parse(saved) : null
        } catch (_) {
          return null
        }
      })()

      const params = activeLoc?.lat != null ? { lat: activeLoc.lat, lon: activeLoc.lon } : {}

      // Force refresh weather if requested
      if (isRefresh) {
        await api.post('/weather/refresh', null, { params }).catch(() => {})
      }

      const [dashRes, riskRes, histRes, forecastRes, weatherRes] = await Promise.all([
        api.get('/dashboard', { params }).catch((err) => {
          console.warn('Dashboard fetch warning:', err)
          return { data: null }
        }),
        api.get('/risk/current', { params }).catch((err) => {
          console.warn('Risk current warning:', err)
          return { data: null }
        }),
        api.get('/risk/history', { params: { days: 14 } }).catch(() => ({ data: [] })),
        api.get('/weather/forecast', { params }).catch(() => ({ data: [] })),
        api.get('/weather', { params }).catch(() => ({ data: null })),
      ])

      const currentWeatherData = dashRes?.data?.current_weather || weatherRes?.data || null
      const dashboardPayload = dashRes?.data || {}
      dashboardPayload.current_weather = currentWeatherData

      setData(dashboardPayload)
      if (riskRes?.data) setRiskData(riskRes.data)
      setRiskHistory(histRes?.data || [])
      setForecast(forecastRes?.data || [])

      if (!currentWeatherData && !riskRes?.data) {
        setError('Weather & risk telemetry updating. Click Refresh to acquire data.')
      } else {
        setError('')
      }
      setDismissedBanner(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Telemetry unavailable. Click Refresh.')
    } finally {
      setLoading(false)
      if (isRefresh) setRefreshing(false)
    }
  }, [location])

  const handleLocationChange = useCallback((loc) => {
    setLocation(loc)
    loadData(loc)
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  const historyForChart = riskHistory.length > 0 ? riskHistory : []

  const lineChartData = {
    labels: historyForChart.map(h =>
      new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    ),
    datasets: [{
      label: 'Risk Score',
      data: historyForChart.map(h => h.risk_score ?? 0),
      borderColor: '#f59e0b',
      borderWidth: 2,
      backgroundColor: (ctx) => {
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260)
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.22)')
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0)')
        return gradient
      },
      fill: true, tension: 0.35,
      pointBackgroundColor: historyForChart.map(h =>
        RISK_COLORS[h.risk_level] || '#f59e0b'
      ),
      pointBorderColor: '#0a0c10',
      pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7,
    }],
  }

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#11141b', titleColor: '#f8fafc', bodyColor: '#fbbf24',
        borderColor: '#282f3d', borderWidth: 1, padding: 10, cornerRadius: 8,
        callbacks: { label: ctx => `Estimated Risk: ${ctx.parsed.y}/100` }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } }, min: 0, max: 100 },
    },
  }

  const barChartData = {
    labels: forecast.length > 0
      ? forecast.map((d, i) => i === 0 ? 'Tomorrow' : `Day +${i + 1}`)
      : ['Tomorrow', 'Day +2', 'Day +3', 'Day +4'],
    datasets: [{
      label: 'Rainfall (mm)',
      data: forecast.length > 0 ? forecast.map(d => d.total_rainfall_mm) : [0, 0, 0, 0],
      backgroundColor: ['rgba(245,158,11,0.75)', 'rgba(217,119,6,0.65)', 'rgba(180,83,9,0.5)', 'rgba(146,64,14,0.4)'],
      borderColor: '#d97706', borderWidth: 1, borderRadius: 5,
    }],
  }

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} mm precipitation` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } },
    },
  }

  const currentScore = riskData?.risk_score ?? data?.current_risk_snapshot?.risk_score ?? data?.current_risk?.risk_score
  const currentLevel = riskData?.risk_level ?? data?.current_risk_snapshot?.risk_level ?? data?.current_risk?.risk_level ?? 'Low'
  const currentTrend = riskData?.risk_trend ?? data?.current_risk_snapshot?.risk_trend ?? 'UNKNOWN'
  const currentFactors = riskData?.contributing_factors ?? []
  const currentRec = riskData?.recommendation ?? ''
  const locationName = riskData?.location_name ?? data?.current_weather?.location_name ?? location?.name

  const showWarningBanner = !dismissedBanner && (currentLevel === 'High' || currentLevel === 'Critical')

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-slate-500 tracking-wider">ACQUIRING DISASTER INTEL TELEMETRY...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Incident Command</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              OPERATIONAL
            </span>
            {data?.active_warnings_count > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                {data.active_warnings_count} ACTIVE WARNING{data.active_warnings_count > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Multi-signal environmental early warning & rapid evacuation dispatch</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <LocationSelector onLocationChange={handleLocationChange} />
          <button
            onClick={() => loadData(location, true)}
            disabled={refreshing}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
          <Link to="/predict" className="btn-primary text-xs py-1.5 px-3">
            <Activity className="h-3.5 w-3.5" />
            Analyze Risk
          </Link>
        </div>
      </div>

      {error && (
        <div className="card-panel p-3.5 border-amber-500/30 bg-amber-500/5 flex items-center gap-3 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Early Warning Banner (HIGH/CRITICAL only) ── */}
      {showWarningBanner && (
        <EarlyWarningBanner
          riskScore={currentScore}
          riskLevel={currentLevel}
          riskTrend={currentTrend}
          locationName={locationName}
          recommendation={currentRec}
          onDismiss={() => setDismissedBanner(true)}
        />
      )}

      {/* ── Risk + Weather hero ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Risk Gauge Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card-panel p-5 flex flex-col items-center justify-between gap-4"
        >
          <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-amber-500" />
              Composite Flood Hazard
            </span>
            <span className="text-[10px] font-mono text-slate-500">{locationName || 'Sector pending'}</span>
          </div>
          <RiskGauge
            riskScore={Math.round(currentScore ?? 0)}
            riskLevel={currentLevel}
            riskTrend={currentTrend}
            size="lg"
          />
          {currentRec && (
            <p className="text-[11px] text-slate-400 text-center leading-relaxed max-w-xs font-sans">
              {currentRec.slice(0, 130)}{currentRec.length > 130 ? '…' : ''}
            </p>
          )}
        </motion.div>

        {/* Live Weather Telemetry */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-panel p-5 space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5 text-amber-500" />
              Sensor Telemetry
            </span>
            {data?.current_weather && (
              <span className="text-[10px] font-mono text-slate-500">
                {new Date(data.current_weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Temperature', value: data?.current_weather?.temperature != null ? `${data.current_weather.temperature.toFixed(1)}°C` : '—', icon: Thermometer, color: 'text-rose-400' },
              { label: 'Humidity', value: data?.current_weather?.humidity != null ? `${data.current_weather.humidity}%` : '—', icon: Droplets, color: 'text-amber-400' },
              { label: 'Rainfall', value: data?.current_weather?.rainfall != null ? `${data.current_weather.rainfall} mm` : '0 mm', icon: CloudRain, color: 'text-cyan-400' },
              { label: 'Wind Speed', value: data?.current_weather?.wind_speed != null ? `${data.current_weather.wind_speed} m/s` : '—', icon: Wind, color: 'text-slate-300' },
              { label: 'Pressure', value: data?.current_weather?.pressure != null ? `${data.current_weather.pressure} hPa` : '—', icon: Activity, color: 'text-violet-400' },
              { label: 'Sector', value: data?.current_weather?.location_name || locationName || '—', icon: MapPin, color: 'text-emerald-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className={`h-3 w-3 ${color}`} />
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
                </div>
                <p className="text-sm font-bold font-mono text-slate-100 truncate">{value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contributing Factors / Active Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          {/* Contributing factors */}
          {currentFactors.length > 0 && (
            <div className="card-panel p-4 space-y-3">
              <span className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Signal Decomposition
              </span>
              <div className="space-y-2">
                {currentFactors.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-300">{f.label}</span>
                      <span className="text-amber-400 font-semibold">{f.delta}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, f.score)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent alerts */}
          <div className="card-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-500" />
                Active Alerts
              </span>
              <Link to="/alerts" className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-mono">
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {data?.recent_alerts?.length > 0 ? (
                data.recent_alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        alert.risk_level === 'Critical' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' :
                        alert.risk_level === 'High' ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20' :
                        'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      }`}>
                        {alert.risk_level}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed line-clamp-2">
                      {alert.title || alert.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-2 text-center font-mono">No active alerts logged.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Rainfall Forecast ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-panel p-5"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold font-mono uppercase text-slate-200 flex items-center gap-1.5">
              <CloudRain className="h-4 w-4 text-amber-400" />
              Precipitation Trajectory (4-Day Forecast)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Numerical meteorological forecast input to hazard engine. Not a standalone flood certainty.
            </p>
          </div>
          <Link to="/predict" className="text-[11px] text-amber-400 hover:text-amber-300 font-mono">
            Execute LSTM Analysis →
          </Link>
        </div>
        <div className="h-44">
          <Bar data={barChartData} options={barOptions} />
        </div>
      </motion.div>

      {/* ── 14-Day Risk History ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card-panel p-5"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold font-mono uppercase text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              14-Day Hazard History
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Historical hazard snapshots · {riskHistory.length} checkpoints recorded
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">0 = Minimum · 100 = Critical Alert</span>
        </div>
        <div className="h-60">
          {riskHistory.length > 0 ? (
            <Line data={lineChartData} options={chartOptions} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-lg p-6">
              <Activity className="h-8 w-8 text-slate-700 mb-2" />
              <p className="text-sm text-slate-400 font-medium">No snapshots logged yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Click "Analyze Risk" to record the first risk snapshot.
              </p>
            </div>
          )}
        </div>

        {/* Risk level legend */}
        {riskHistory.length > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800 flex-wrap">
            {Object.entries(RISK_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {level}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Tactical Operations Links ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { to: '/safe-areas', icon: MapPin, label: 'Safe Area Finder', desc: 'Ranked emergency shelters & trauma centers', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/50' },
          { to: '/map', icon: Waves, label: 'GIS Tactical Map', desc: 'Danger zone perimeters & road routes', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25 hover:border-amber-500/50' },
          { to: '/alerts', icon: Bell, label: 'Incident Advisory Log', desc: `${data?.active_warnings_count ?? 0} active · tap to inspect`, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25 hover:border-rose-500/50' },
        ].map(({ to, icon: Icon, label, desc, color, bg }) => (
          <Link key={to} to={to}
            className={`card-panel p-4 flex items-center gap-3 border ${bg} transition-all group`}>
            <div className={`p-2 rounded-lg ${bg.split(' ')[0]}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">{label}</p>
              <p className="text-[11px] text-slate-500">{desc}</p>
            </div>
            <ArrowRight className={`h-4 w-4 ${color} ml-auto opacity-0 group-hover:opacity-100 transition-opacity`} />
          </Link>
        ))}
      </motion.div>
    </div>
  )
}
