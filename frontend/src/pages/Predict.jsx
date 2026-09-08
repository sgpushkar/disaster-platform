import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, CloudRain, Upload, Image, AlertTriangle, CheckCircle,
  ShieldAlert, ChevronDown, ChevronUp, Loader2, Camera, BarChart3, Info,
  Sliders, Shield, Sparkles, Database, RefreshCw, Thermometer, Droplets,
  Wind, Gauge, Compass, MapPin, AlertOctagon,
} from 'lucide-react'
import api from '../services/api'
import RiskGauge from '../components/RiskGauge.jsx'

function Section({ title, icon: Icon, iconColor = 'text-red-500', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card-panel overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold font-mono uppercase text-zinc-200">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-5 pb-5 border-t border-slate-800">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Predict() {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageResult, setImageResult] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)

  const [rainfallValues, setRainfallValues] = useState(Array(14).fill(''))
  const [rainfallResult, setRainfallResult] = useState(null)
  const [rainfallLoading, setRainfallLoading] = useState(false)

  const [riskResult, setRiskResult] = useState(null)
  const [currentWeather, setCurrentWeather] = useState(null)
  const [datasetComparison, setDatasetComparison] = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskError, setRiskError] = useState('')

  // Site & Environmental attribute controls (collapsible inside primary assessment)
  const [showAttributeControls, setShowAttributeControls] = useState(false)
  const [attrInputs, setAttrInputs] = useState({
    temperature: 28.0,
    humidity: 75.0,
    wind_speed: 18.0,
    air_quality_index: 165.0,
    water_level: 1.5,
    vegetation_cover: 45.0,
    people_detected: 2,
    heat_signatures: 2,
    hazardous_material_detected: 0,
    building_damage_level: 'Moderate',
    road_condition: 'Obstructed',
    infrastructure_status: 'Damaged',
  })

  const fileRef = useRef()

  const submitCombinedRisk = async () => {
    setRiskLoading(true)
    setRiskError('')
    try {
      const loc = localStorage.getItem('disaster_intel_location')
      const params = loc ? (() => { try { const p = JSON.parse(loc); return { lat: p.lat, lon: p.lon } } catch (_) { return {} } })() : {}

      const [riskRes, weatherRes, attrRes] = await Promise.all([
        api.get('/risk/current', { params }),
        api.get('/weather', { params }).catch(() => null),
        api.post('/predict/disaster-risk', {
          use_latest_weather: true,
          latitude: params.lat,
          longitude: params.lon,
        }).catch(() => null),
      ])

      setRiskResult(riskRes.data)
      if (weatherRes?.data) {
        setCurrentWeather(weatherRes.data)
        // Sync defaults with weather telemetry
        setAttrInputs(prev => ({
          ...prev,
          temperature: weatherRes.data.temperature != null ? weatherRes.data.temperature : prev.temperature,
          humidity: weatherRes.data.humidity != null ? weatherRes.data.humidity : prev.humidity,
          wind_speed: weatherRes.data.wind_speed != null ? Math.round(weatherRes.data.wind_speed * 3.6) : prev.wind_speed,
        }))
      }
      if (attrRes?.data) {
        setDatasetComparison(attrRes.data)
      } else if (riskRes.data?.dataset_benchmarks) {
        setDatasetComparison({
          ...riskRes.data.dataset_prediction,
          dataset_benchmarks: riskRes.data.dataset_benchmarks,
        })
      }
    } catch (err) {
      setRiskError(err.response?.data?.detail || 'Risk computation failed.')
    } finally {
      setRiskLoading(false)
    }
  }

  const submitCustomAttributeRisk = async () => {
    setRiskLoading(true)
    setRiskError('')
    try {
      const payload = {
        temperature: parseFloat(attrInputs.temperature) || 0,
        humidity: parseFloat(attrInputs.humidity) || 0,
        wind_speed: parseFloat(attrInputs.wind_speed) || 0,
        air_quality_index: parseFloat(attrInputs.air_quality_index) || 0,
        water_level: parseFloat(attrInputs.water_level) || 0,
        vegetation_cover: parseFloat(attrInputs.vegetation_cover) || 0,
        people_detected: parseInt(attrInputs.people_detected) || 0,
        heat_signatures: parseInt(attrInputs.heat_signatures) || 0,
        hazardous_material_detected: parseInt(attrInputs.hazardous_material_detected) || 0,
        building_damage_level: attrInputs.building_damage_level,
        road_condition: attrInputs.road_condition,
        infrastructure_status: attrInputs.infrastructure_status,
        use_latest_weather: false,
      }

      const { data } = await api.post('/predict/disaster-risk', payload)
      setDatasetComparison(data)
      setRiskResult(prev => ({
        ...prev,
        risk_score: data.risk_score,
        risk_level: data.risk_level,
        recommendation: data.recommendations?.[0] || prev?.recommendation,
        contributing_factors: Object.entries(data.contributing_factors || {}).slice(0, 5).map(([k, v]) => ({
          key: k,
          label: k.replace(/_/g, ' ').toUpperCase(),
          score: Math.round(v),
          weight_pct: Math.round(v),
          description: `DisasterScope model feature weight: ${v}%`,
        })),
        dataset_benchmarks: data.dataset_benchmarks,
      }))
    } catch (err) {
      setRiskError(err.response?.data?.detail || 'Prediction from custom attributes failed.')
    } finally {
      setRiskLoading(false)
    }
  }

  // Fetch current live attributes and predict risk on initial load
  useEffect(() => {
    submitCombinedRisk()
  }, [])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setImageResult(null)
  }

  const submitImage = async () => {
    if (!imageFile) return
    setImageLoading(true)
    try {
      const form = new FormData()
      form.append('file', imageFile)
      const { data } = await api.post('/predict/flood-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImageResult(data)
    } catch (err) {
      setImageResult({ error: err.response?.data?.detail || 'Image classification failed. Ensure the flood model is trained.' })
    } finally {
      setImageLoading(false)
    }
  }

  const submitRainfall = async () => {
    const values = rainfallValues.map(v => parseFloat(v) || 0)
    setRainfallLoading(true)
    try {
      const { data } = await api.post('/predict/rainfall', { recent_rainfall_mm: values })
      setRainfallResult(data)
    } catch (err) {
      setRainfallResult({ error: err.response?.data?.detail || 'Rainfall prediction failed. Ensure the LSTM model is trained.' })
    } finally {
      setRainfallLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Hazard Analysis</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
            DISASTERSCOPE 61K ENGINE
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Disaster risk evaluation trained on 61,368 historical environmental & structural attribute records.
          Image evidence is <strong>optional</strong> supporting telemetry.
        </p>
      </div>

      {/* ── Section 1: Disaster & Environmental Risk Assessment (Primary) ── */}
      <Section title="Disaster & Environmental Risk Assessment" icon={ShieldAlert} defaultOpen>
        <div className="pt-4 space-y-4">
          <div className="p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-xs text-red-300 leading-relaxed flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
            <span>
              Predicts comprehensive multi-hazard disaster severity and flood risk using the 
              <strong> 61K DisasterScope Attribute Model</strong>.
            </span>
          </div>

          {riskResult && !riskResult.error ? (
            <div className="space-y-4">
              {/* Primary Risk Gauge */}
              <div className="flex flex-col items-center gap-3 py-2">
                <RiskGauge
                  riskScore={Math.round(riskResult.risk_score ?? 0)}
                  riskLevel={riskResult.risk_level}
                  riskTrend={riskResult.risk_trend}
                  size="lg"
                />
                {riskResult.recommendation && (
                  <p className="text-xs text-zinc-400 text-center leading-relaxed max-w-md">
                    {riskResult.recommendation}
                  </p>
                )}
              </div>

              {/* Multi-Target Verdict Summary Badges */}
              {datasetComparison && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Severity */}
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block mb-0.5">Disaster Severity</span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded inline-block ${
                      datasetComparison.disaster_severity_level === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      datasetComparison.disaster_severity_level === 'Medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {datasetComparison.disaster_severity_level || 'LOW'}
                    </span>
                  </div>

                  {/* Area Type */}
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block mb-0.5">Area Hazard Type</span>
                    <span className="text-xs font-bold font-mono text-cyan-300 block truncate">
                      {datasetComparison.affected_area_type || 'Unblocked'}
                    </span>
                  </div>

                  {/* Immediate Action */}
                  <div className={`p-2.5 rounded-lg border text-center ${
                    datasetComparison.immediate_action_required === 'Yes'
                      ? 'border-red-500/40 bg-red-950/30'
                      : 'border-slate-800 bg-slate-900/60'
                  }`}>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block mb-0.5">Action Status</span>
                    <span className={`text-xs font-bold font-mono ${
                      datasetComparison.immediate_action_required === 'Yes' ? 'text-red-400' : 'text-zinc-300'
                    }`}>
                      {datasetComparison.immediate_action_required === 'Yes' ? '🚨 REQUIRED' : 'STANDBY'}
                    </span>
                  </div>

                  {/* Flood Probability */}
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block mb-0.5">Flood Probability</span>
                    <span className={`text-xs font-bold font-mono ${
                      (datasetComparison.flood_probability || 0) >= 50 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {datasetComparison.flood_probability ?? 0}%
                    </span>
                  </div>
                </div>
              )}

              {/* Tactical Directives / Orders */}
              {datasetComparison?.recommendations?.length > 0 && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 space-y-1.5">
                  <p className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5 font-semibold">
                    <Shield className="h-3.5 w-3.5" />
                    Directives & Emergency Recommendations
                  </p>
                  <ul className="space-y-1 text-xs text-zinc-300">
                    {datasetComparison.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contributing factors */}
              {riskResult.contributing_factors?.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-mono uppercase text-zinc-500">Decomposition Signals</p>
                  {riskResult.contributing_factors.map((f) => (
                    <div key={f.key}>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-zinc-300">{f.label}</span>
                        <span className="text-red-400 font-semibold">{f.score}/100 · {f.weight_pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, f.score)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{f.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Specific Risks */}
              {riskResult.specific_risks && Object.keys(riskResult.specific_risks).length > 0 && (
                <div className="space-y-2.5 pt-4 border-t border-slate-800">
                  <p className="text-[11px] font-mono uppercase text-zinc-500">Specific Hazard Risks</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(riskResult.specific_risks).map(([hazard, score]) => (
                      <div key={hazard} className="p-2 rounded border border-slate-800 bg-slate-900/50 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-zinc-300 font-medium">{hazard}</span>
                          <span className={`text-[10px] font-mono font-bold ${
                            score > 75 ? 'text-red-400' : score > 50 ? 'text-orange-400' : score > 25 ? 'text-yellow-400' : 'text-emerald-400'
                          }`}>
                            {score}/100
                          </span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              score > 75 ? 'bg-red-500' : score > 50 ? 'bg-orange-500' : score > 25 ? 'bg-yellow-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Meteorological Telemetry Strip */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    Live Meteorological Telemetry
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-red-400" />
                    {currentWeather?.location_name || riskResult?.location_name || 'Active Coordinate Node'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase flex items-center justify-center gap-1">
                      <Thermometer className="h-3 w-3 text-amber-400" /> Temp
                    </span>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                      {currentWeather?.temperature != null ? `${currentWeather.temperature.toFixed(1)}°C` : '—'}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase flex items-center justify-center gap-1">
                      <Droplets className="h-3 w-3 text-cyan-400" /> Humidity
                    </span>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                      {currentWeather?.humidity != null ? `${currentWeather.humidity}%` : '—'}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase flex items-center justify-center gap-1">
                      <Wind className="h-3 w-3 text-teal-400" /> Wind
                    </span>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                      {currentWeather?.wind_speed != null ? `${(currentWeather.wind_speed * 3.6).toFixed(1)} km/h` : '—'}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase flex items-center justify-center gap-1">
                      <Gauge className="h-3 w-3 text-indigo-400" /> Pressure
                    </span>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                      {currentWeather?.pressure != null ? `${currentWeather.pressure} hPa` : '—'}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-center col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase flex items-center justify-center gap-1">
                      <CloudRain className="h-3 w-3 text-blue-400" /> 24h Rain
                    </span>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                      {currentWeather?.rainfall != null ? `${currentWeather.rainfall.toFixed(1)} mm` : '0.0 mm'}
                    </p>
                  </div>
                </div>
              </div>

              {/* DisasterScope 61K Environmental Benchmark Comparison */}
              {datasetComparison?.dataset_benchmarks && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-slate-950/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <Database className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold font-mono tracking-wide text-zinc-200 uppercase">
                            DisasterScope 61K Benchmark
                          </h4>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30 font-semibold">
                            61,368 RECORDS
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          Live atmospheric telemetry benchmarked against verified disaster distributions
                        </p>
                      </div>
                    </div>

                    {datasetComparison.flood_probability != null && (
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[10px] font-mono text-zinc-400">Model Verdict:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                          datasetComparison.flood_probability >= 50
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {datasetComparison.flood_probability}% Flood Risk
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Benchmark Attribute Comparison Cards */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-mono uppercase text-zinc-500">
                      Live Telemetry vs Dataset Norms (Mean ± Range)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {datasetComparison.dataset_benchmarks.attributes?.map((attr) => {
                        const min = attr.dataset_min
                        const max = attr.dataset_max
                        const current = attr.current_value
                        const mean = attr.dataset_mean
                        const pct = Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100))
                        const meanPct = Math.max(0, Math.min(100, ((mean - min) / (max - min)) * 100))

                        return (
                          <div
                            key={attr.key}
                            className="p-2.5 rounded-lg border border-slate-800/90 bg-slate-900/60 flex flex-col justify-between gap-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[11px] font-medium text-zinc-300 block">
                                  {attr.label}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">
                                  Avg: {mean} {attr.unit} · Range: {min}–{max} {attr.unit}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-amber-300 border border-amber-500/20">
                                {attr.status}
                              </span>
                            </div>

                            <div>
                              <div className="flex justify-between items-baseline mb-1">
                                <span className="text-xs font-mono font-bold text-white">
                                  {current} <span className="text-[10px] font-normal text-zinc-400">{attr.unit}</span>
                                </span>
                                <span className="text-[9px] font-mono text-zinc-500">
                                  Benchmark μ: {mean} {attr.unit}
                                </span>
                              </div>

                              <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
                                  style={{ left: `${meanPct}%` }}
                                  title={`Dataset Mean: ${mean}`}
                                />
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    pct > 75 ? 'bg-red-500' : pct > 50 ? 'bg-orange-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsible Site & Environmental Attributes Simulator */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setShowAttributeControls(!showAttributeControls)}
                  className="w-full flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-900 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-mono uppercase text-zinc-300">
                    <Sliders className="h-3.5 w-3.5 text-amber-400" />
                    Customize DisasterScope Attributes & Simulate Risk
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                    {showAttributeControls ? 'Hide Inputs' : 'Adjust Attributes'}
                    {showAttributeControls ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>

                {showAttributeControls && (
                  <div className="p-4 border-t border-slate-800/80 space-y-4">
                    <p className="text-[11px] text-zinc-400">
                      Directly evaluate how changes in environmental, structural, and life-safety attributes impact the model's predicted disaster risk score.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Water Depth (m)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={attrInputs.water_level}
                          onChange={(e) => setAttrInputs({ ...attrInputs, water_level: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Air Quality (AQI)</label>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={attrInputs.air_quality_index}
                          onChange={(e) => setAttrInputs({ ...attrInputs, air_quality_index: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Building Damage</label>
                        <select
                          value={attrInputs.building_damage_level}
                          onChange={(e) => setAttrInputs({ ...attrInputs, building_damage_level: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        >
                          <option value="Undamaged">Undamaged</option>
                          <option value="Minor">Minor</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                          <option value="Destroyed">Destroyed</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Road Condition</label>
                        <select
                          value={attrInputs.road_condition}
                          onChange={(e) => setAttrInputs({ ...attrInputs, road_condition: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        >
                          <option value="Intact">Intact</option>
                          <option value="Obstructed">Obstructed</option>
                          <option value="Damaged">Damaged</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Infrastructure</label>
                        <select
                          value={attrInputs.infrastructure_status}
                          onChange={(e) => setAttrInputs({ ...attrInputs, infrastructure_status: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        >
                          <option value="Intact">Intact</option>
                          <option value="Damaged">Damaged</option>
                          <option value="Severely Damaged">Severely Damaged</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">People Detected</label>
                        <input
                          type="number"
                          min="0"
                          value={attrInputs.people_detected}
                          onChange={(e) => setAttrInputs({ ...attrInputs, people_detected: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Heat Signatures</label>
                        <input
                          type="number"
                          min="0"
                          value={attrInputs.heat_signatures}
                          onChange={(e) => setAttrInputs({ ...attrInputs, heat_signatures: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 block mb-1">Vegetation (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={attrInputs.vegetation_cover}
                          onChange={(e) => setAttrInputs({ ...attrInputs, vegetation_cover: e.target.value })}
                          className="input-control text-xs py-1.5 px-2"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <input
                          type="checkbox"
                          id="hazmat-toggle"
                          checked={Boolean(attrInputs.hazardous_material_detected)}
                          onChange={(e) => setAttrInputs({ ...attrInputs, hazardous_material_detected: e.target.checked ? 1 : 0 })}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
                        />
                        <label htmlFor="hazmat-toggle" className="text-xs text-amber-300 font-medium cursor-pointer">
                          HAZMAT Detected
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={submitCustomAttributeRisk}
                      disabled={riskLoading}
                      className="w-full py-2 rounded-lg font-medium text-xs bg-amber-600 hover:bg-amber-500 text-white transition-all flex items-center justify-center gap-1.5"
                    >
                      {riskLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sliders className="h-3.5 w-3.5" />}
                      Compute Risk from Custom Attributes
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              {riskResult?.error && (
                <p className="text-xs text-amber-400 mb-3">{riskResult.error}</p>
              )}
            </div>
          )}

          {riskError && (
            <p className="text-xs text-red-400">{riskError}</p>
          )}

          {/* Primary Action Button */}
          <button
            onClick={submitCombinedRisk}
            disabled={riskLoading}
            className="btn-primary w-full py-2.5"
          >
            {riskLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Computing Risk...</>
            ) : (
              <><Activity className="h-4 w-4" /> Recompute Risk from Weather</>
            )}
          </button>
        </div>
      </Section>

      {/* ── Section 2: Rainfall Forecast (LSTM) ── */}
      <Section title="Rainfall Forecast (LSTM)" icon={CloudRain} iconColor="text-cyan-400" defaultOpen={false}>
        <div className="pt-4 space-y-4">
          <p className="text-xs text-slate-400">
            Provide the last 14 days of rainfall (mm/day), oldest first.
            The LSTM model estimates tomorrow's rainfall and feeds into the risk engine.
          </p>

          <div className="grid grid-cols-7 gap-2">
            {rainfallValues.map((val, i) => (
              <div key={i} className="space-y-0.5">
                <label className="text-[10px] font-mono text-slate-600 block text-center">
                  {i === 13 ? 'Today' : i === 12 ? 'Yday' : `D-${13 - i}`}
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={val}
                  onChange={(e) => {
                    const next = [...rainfallValues]
                    next[i] = e.target.value
                    setRainfallValues(next)
                  }}
                  placeholder="0"
                  className="input-control text-center text-xs py-1.5 px-1"
                />
              </div>
            ))}
          </div>

          <button
            onClick={submitRainfall}
            disabled={rainfallLoading}
            className="btn-primary w-full py-2.5"
          >
            {rainfallLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running LSTM...</>
            ) : (
              <><BarChart3 className="h-4 w-4" /> Run Rainfall Forecast</>
            )}
          </button>

          {rainfallResult && !rainfallResult.error && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-red-500/30 text-center">
                <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Tomorrow</p>
                <p className="text-2xl font-bold font-mono text-red-400">{rainfallResult.tomorrow_mm?.toFixed(1)}</p>
                <p className="text-[10px] font-mono text-zinc-500">mm estimated</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">3-Day Total</p>
                <p className="text-2xl font-bold font-mono text-slate-200">
                  {rainfallResult.next_3_days_mm?.reduce((a, b) => a + b, 0).toFixed(1)}
                </p>
                <p className="text-[10px] font-mono text-slate-500">mm estimated</p>
              </div>
              <div className="col-span-2 text-[10px] text-slate-600 text-center">
                Estimates are based on historical pattern learning. Actual rainfall may differ.
              </div>
            </div>
          )}
          {rainfallResult?.error && (
            <p className="text-xs text-red-300 p-3 bg-red-500/5 rounded border border-red-500/25">
              ⚠️ {rainfallResult.error}
            </p>
          )}
        </div>
      </Section>

      {/* ── Section 3: Visual Check (Optional, secondary) ── */}
      <Section title="Optional: Visual Flood Check (Image)" icon={Camera} iconColor="text-zinc-400" defaultOpen={false}>
        <div className="pt-4 space-y-4">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-400" />
            <span>
              Image analysis is <strong>optional supporting evidence only</strong> (15% of risk score).
              The system can provide a full risk assessment <strong>without any image</strong>.
              Requires a trained flood image model to function.
            </span>
          </div>

          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${imageFile ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'}`}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="max-h-44 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">Drop an aerial or ground-level flood photo</p>
                <p className="text-xs text-slate-600">PNG, JPG, WEBP · max 10 MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          {imageFile && (
            <button
              onClick={submitImage}
              disabled={imageLoading}
              className="btn-primary w-full py-2.5"
            >
              {imageLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Classifying...</>
              ) : (
                <><Image className="h-4 w-4" /> Classify Image</>
              )}
            </button>
          )}

          {imageResult && !imageResult.error && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
              <div className="flex items-center gap-2">
                {imageResult.prediction === 'Flood' ? (
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                )}
                <span className={`text-sm font-bold font-mono ${
                  imageResult.prediction === 'Flood' ? 'text-orange-400' : 'text-emerald-400'
                }`}>
                  {imageResult.prediction}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-auto">
                  {(imageResult.confidence * 100).toFixed(1)}% confidence
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${imageResult.prediction === 'Flood' ? 'bg-orange-500' : 'bg-emerald-500'}`}
                  style={{ width: `${(imageResult.confidence * 100).toFixed(0)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-600">
                Image evidence accounts for ~15% of combined risk score when available.
              </p>
            </div>
          )}
          {imageResult?.error && (
            <p className="text-xs text-red-300 p-3 bg-red-500/5 rounded border border-red-500/25">
              ⚠️ {imageResult.error}
            </p>
          )}
        </div>
      </Section>
    </div>
  )
}
