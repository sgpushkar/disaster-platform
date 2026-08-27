import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { 
  Thermometer, 
  Waves, 
  CloudRain, 
  ShieldAlert, 
  RefreshCw, 
  ArrowRight, 
  AlertTriangle, 
  Activity, 
  Wind, 
  Droplets,
  Calendar,
  Compass
} from 'lucide-react'
import api from '../services/api'
import StatCard from '../components/StatCard.jsx'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const [dashRes, histRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/history', { params: { limit: 14 } }),
      ])
      setData(dashRes.data)
      setHistory(histRes.data.reverse())
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      if (isRefresh) setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const chartData = {
    labels: history.map((h) => new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Risk Index (0-100)',
        data: history.map((h) => h.risk_score ?? 0),
        borderColor: '#3b82f6',
        borderWidth: 2,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 260)
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)')
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)')
          return gradient
        },
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#0f172a',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#e2e8f0',
        bodyColor: '#93c5fd',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => `Risk Score: ${context.parsed.y} / 100`,
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } },
        min: 0,
        max: 100,
      },
    },
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-slate-400">CONNECTING TO TELEMETRY STREAM...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner / Operational Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Emergency Analytics Command</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE MONITORING
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Aggregated multi-sensor flood risk & precipitation telemetry</span>
            <span>·</span>
            <span className="font-mono text-slate-400">LAST SYNC: {new Date().toLocaleTimeString()}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Telemetry'}</span>
          </button>
          
          <Link to="/predict" className="btn-primary text-xs py-1.5 px-3">
            <Activity className="h-3.5 w-3.5" />
            <span>Run New Analysis</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="card-panel p-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-3 text-sm text-amber-300">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Surface Temperature"
          value={data?.current_weather?.temperature != null ? data.current_weather.temperature.toFixed(1) : '—'}
          unit="°C"
          icon={Thermometer}
          subtitle={data?.current_weather?.location_name || 'Station Online'}
          delta={data?.current_weather ? `Wind: ${data.current_weather.wind_speed} m/s` : null}
          delay={0}
        />
        <StatCard
          title="Flood Image Confidence"
          value={data?.latest_flood_prediction?.confidence != null ? data.latest_flood_prediction.confidence.toFixed(0) : '—'}
          unit="%"
          icon={Waves}
          subtitle={data?.latest_flood_prediction?.prediction ? `Classification: ${data.latest_flood_prediction.prediction}` : 'No terrain scan'}
          delay={0.05}
        />
        <StatCard
          title="Rainfall Forecast"
          value={data?.latest_rainfall_forecast?.tomorrow_mm != null ? data.latest_rainfall_forecast.tomorrow_mm.toFixed(1) : '—'}
          unit="mm / 24h"
          icon={CloudRain}
          subtitle="LSTM Deep Forecast (+24h)"
          delay={0.1}
        />
        <StatCard
          title="Composite Risk Index"
          value={data?.current_risk?.risk_score != null ? data.current_risk.risk_score.toFixed(0) : '—'}
          unit="/100"
          icon={ShieldAlert}
          riskLevel={data?.current_risk?.risk_level}
          subtitle="Fused Sensor Assessment"
          delay={0.15}
        />
      </div>

      {/* Main Charts & Live Feed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-panel p-5 lg:col-span-2 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-800/80">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-200">
                14-Day Disaster Risk Timeline
              </h2>
              <p className="text-xs text-slate-400">Historical progression of multi-factor risk scores</p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {history.length} Data Points
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            {history.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-lg">
                <Activity className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 font-medium">No telemetry history recorded yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Run a risk prediction in the Predict tab to log incident scores on this timeline.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Live Weather & Recent Alerts Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-6"
        >
          {/* Live Station Conditions */}
          <div className="card-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-mono uppercase font-semibold text-slate-300 flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-blue-400" />
                Station Telemetry
              </span>
              <span className="text-[10px] font-mono text-slate-500">REALTIME</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Humidity</span>
                <p className="text-base font-bold font-mono text-white mt-0.5">
                  {data?.current_weather?.humidity != null ? `${data.current_weather.humidity}%` : '—'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Wind Velocity</span>
                <p className="text-base font-bold font-mono text-white mt-0.5">
                  {data?.current_weather?.wind_speed != null ? `${data.current_weather.wind_speed} m/s` : '—'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Rain Gauge</span>
                <p className="text-base font-bold font-mono text-white mt-0.5">
                  {data?.current_weather?.rainfall != null ? `${data.current_weather.rainfall} mm` : '0.0 mm'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Atmosphere</span>
                <p className="text-xs font-semibold text-slate-300 mt-1 capitalize truncate">
                  {data?.current_weather?.weather_description || 'Clear Sky'}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Broadcast Alerts */}
          <div className="card-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-mono uppercase font-semibold text-slate-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Active Alerts
              </span>
              <Link to="/alerts" className="text-[11px] text-blue-400 hover:underline flex items-center gap-0.5">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {data?.recent_alerts?.length > 0 ? (
                data.recent_alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold uppercase ${
                        alert.risk_level === 'Critical' ? 'text-red-400 bg-red-500/10' :
                        alert.risk_level === 'High' ? 'text-orange-400 bg-orange-500/10' :
                        'text-amber-400 bg-amber-500/10'
                      }`}>
                        {alert.risk_level} Priority
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">{alert.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">No active alerts broadcasted.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
