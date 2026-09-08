import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, CloudRain, Upload, Image, AlertTriangle, CheckCircle,
  ShieldAlert, ChevronDown, ChevronUp, Loader2, Camera, BarChart3, Info,
  Crosshair, Radio, Users, Flame, Zap, Shield, Sparkles,
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
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskError, setRiskError] = useState('')

  const fileRef = useRef()

  // Auto-fetch current risk on load (no image required)
  useEffect(() => {
    const loc = localStorage.getItem('disaster_intel_location')
    const params = loc ? (() => { try { const p = JSON.parse(loc); return { lat: p.lat, lon: p.lon } } catch (_) { return {} } })() : {}
    api.get('/risk/current', { params }).then(r => setRiskResult(r.data)).catch(() => {})
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

  const submitCombinedRisk = async () => {
    setRiskLoading(true)
    setRiskError('')
    try {
      const loc = localStorage.getItem('disaster_intel_location')
      const params = loc ? (() => { try { const p = JSON.parse(loc); return { lat: p.lat, lon: p.lon } } catch (_) { return {} } })() : {}
      const { data } = await api.get('/risk/current', { params })
      setRiskResult(data)
    } catch (err) {
      setRiskError(err.response?.data?.detail || 'Risk computation failed.')
    } finally {
      setRiskLoading(false)
    }
  }

  // DisasterScope Recon State (Kaggle Dataset: 61,368 Records)
  const [scopeInputs, setScopeInputs] = useState({
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
  const [scopeResult, setScopeResult] = useState(null)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [scopeError, setScopeError] = useState('')

  const scopePresets = [
    {
      name: '🌊 Flood Surge',
      data: {
        temperature: 26.5, humidity: 90.0, wind_speed: 22.0, air_quality_index: 90.0,
        water_level: 3.5, vegetation_cover: 25.0, people_detected: 4, heat_signatures: 1,
        hazardous_material_detected: 0, building_damage_level: 'Moderate',
        road_condition: 'Blocked', infrastructure_status: 'Damaged',
      }
    },
    {
      name: '🔥 Wildfire Incursion',
      data: {
        temperature: 39.0, humidity: 20.0, wind_speed: 38.0, air_quality_index: 410.0,
        water_level: 0.1, vegetation_cover: 10.0, people_detected: 1, heat_signatures: 5,
        hazardous_material_detected: 0, building_damage_level: 'Severe',
        road_condition: 'Obstructed', infrastructure_status: 'Damaged',
      }
    },
    {
      name: '🏚️ Structural Collapse',
      data: {
        temperature: 25.0, humidity: 58.0, wind_speed: 10.0, air_quality_index: 260.0,
        water_level: 0.3, vegetation_cover: 15.0, people_detected: 7, heat_signatures: 4,
        hazardous_material_detected: 1, building_damage_level: 'Destroyed',
        road_condition: 'Blocked', infrastructure_status: 'Severely Damaged',
      }
    },
    {
      name: '🛡️ Nominal Patrol',
      data: {
        temperature: 23.5, humidity: 55.0, wind_speed: 8.0, air_quality_index: 65.0,
        water_level: 0.2, vegetation_cover: 75.0, people_detected: 0, heat_signatures: 0,
        hazardous_material_detected: 0, building_damage_level: 'Undamaged',
        road_condition: 'Intact', infrastructure_status: 'Intact',
      }
    }
  ]

  const submitScopeRecon = async () => {
    setScopeLoading(true)
    setScopeError('')
    try {
      const payload = {
        ...scopeInputs,
        temperature: parseFloat(scopeInputs.temperature) || 0,
        humidity: parseFloat(scopeInputs.humidity) || 0,
        wind_speed: parseFloat(scopeInputs.wind_speed) || 0,
        air_quality_index: parseFloat(scopeInputs.air_quality_index) || 0,
        water_level: parseFloat(scopeInputs.water_level) || 0,
        vegetation_cover: parseFloat(scopeInputs.vegetation_cover) || 0,
        people_detected: parseInt(scopeInputs.people_detected) || 0,
        heat_signatures: parseInt(scopeInputs.heat_signatures) || 0,
        hazardous_material_detected: parseInt(scopeInputs.hazardous_material_detected) || 0,
      }
      const { data } = await api.post('/predict/disaster-scope', payload)
      setScopeResult(data)
    } catch (err) {
      setScopeError(err.response?.data?.detail || 'Reconnaissance analysis failed. Ensure DisasterScope model is trained.')
    } finally {
      setScopeLoading(false)
    }
  }


  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Hazard Analysis</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
            AI ESTIMATION ENGINE
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Environmental risk assessment using weather conditions and rainfall signals.
          Image evidence is <strong>optional</strong> and used as secondary supporting telemetry.
        </p>
      </div>

      {/* ── Section 1: Current Environmental Risk (Primary) ── */}
      <Section title="Current Environmental Risk" icon={ShieldAlert} defaultOpen>
        <div className="pt-4 space-y-4">
          <div className="p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-xs text-red-300 leading-relaxed flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
            <span>
              Calculates risk from <strong>live weather + precipitation forecast</strong>. 
              No visual imagery required. Risk output is an <em>empirical estimate</em>.
            </span>
          </div>

          {riskResult && !riskResult.error ? (
            <div className="space-y-4">
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

      {/* ── Section 2: Drone & Aerial Recon (DisasterScope AI) ── */}
      <Section title="Drone Recon & Multi-Hazard Assessment" icon={Crosshair} iconColor="text-amber-400" defaultOpen={true}>
        <div className="pt-4 space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
            <Radio className="h-4 w-4 shrink-0 mt-0.5 text-amber-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-amber-300">DisasterScope Drone Telemetry Engine</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  KAGGLE 61K DATASET
                </span>
              </div>
              <p className="text-zinc-400 text-[11px]">
                Analyzes drone sensor telemetry, structural destruction levels, and thermal signatures to classify hazard area type, immediate action urgency, and survivor presence.
              </p>
            </div>
          </div>

          {/* Preset scenarios */}
          <div>
            <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
              Mission Simulation Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scopePresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setScopeInputs(preset.data)
                    setScopeResult(null)
                  }}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all text-left group"
                >
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 block">
                    {preset.name}
                  </span>
                  <span className="text-[10px] text-zinc-500">Apply telemetry</span>
                </button>
              ))}
            </div>
          </div>

          {/* Telemetry Input Form */}
          <div className="space-y-3 pt-2">
            <p className="text-[11px] font-mono uppercase text-zinc-400">Environmental Sensors</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Temp (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={scopeInputs.temperature}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, temperature: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Humidity (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scopeInputs.humidity}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, humidity: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Wind Speed (km/h)</label>
                <input
                  type="number"
                  min="0"
                  value={scopeInputs.wind_speed}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, wind_speed: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Air Quality (AQI)</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={scopeInputs.air_quality_index}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, air_quality_index: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Water Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={scopeInputs.water_level}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, water_level: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Vegetation (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scopeInputs.vegetation_cover}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, vegetation_cover: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
            </div>

            <p className="text-[11px] font-mono uppercase text-zinc-400 pt-2">Reconnaissance & Structural Status</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">People Detected</label>
                <input
                  type="number"
                  min="0"
                  value={scopeInputs.people_detected}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, people_detected: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Heat Signatures</label>
                <input
                  type="number"
                  min="0"
                  value={scopeInputs.heat_signatures}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, heat_signatures: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Building Damage</label>
                <select
                  value={scopeInputs.building_damage_level}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, building_damage_level: e.target.value })}
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
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Road Condition</label>
                <select
                  value={scopeInputs.road_condition}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, road_condition: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                >
                  <option value="Intact">Intact</option>
                  <option value="Obstructed">Obstructed</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Infrastructure Status</label>
                <select
                  value={scopeInputs.infrastructure_status}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, infrastructure_status: e.target.value })}
                  className="input-control text-xs py-1.5 px-2"
                >
                  <option value="Intact">Intact</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Severely Damaged">Severely Damaged</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="hazmat-check"
                  checked={Boolean(scopeInputs.hazardous_material_detected)}
                  onChange={(e) => setScopeInputs({ ...scopeInputs, hazardous_material_detected: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="hazmat-check" className="text-xs text-amber-300 font-medium cursor-pointer">
                  HAZMAT Detected
                </label>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={submitScopeRecon}
            disabled={scopeLoading}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-900/30"
          >
            {scopeLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating Drone Telemetry...</>
            ) : (
              <><Crosshair className="h-4 w-4" /> Run DisasterScope Assessment</>
            )}
          </button>

          {scopeError && (
            <p className="text-xs text-red-400 p-2.5 rounded bg-red-500/10 border border-red-500/20">
              ⚠️ {scopeError}
            </p>
          )}

          {/* Results Display */}
          {scopeResult && (
            <div className="space-y-4 pt-3 border-t border-slate-800 animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Severity */}
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 text-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Disaster Severity</span>
                  <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded inline-block ${
                    scopeResult.disaster_severity_level === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    scopeResult.disaster_severity_level === 'Medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {scopeResult.disaster_severity_level.toUpperCase()}
                  </span>
                  <p className="text-[9px] font-mono text-zinc-500 mt-1">
                    {scopeResult.severity_probabilities?.[scopeResult.disaster_severity_level] || 0}% prob
                  </p>
                </div>

                {/* Area Type */}
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 text-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Hazard Area Type</span>
                  <span className="text-xs font-bold font-mono text-cyan-300 block truncate">
                    {scopeResult.affected_area_type}
                  </span>
                  <p className="text-[9px] font-mono text-zinc-500 mt-1">
                    {scopeResult.area_type_probabilities?.[scopeResult.affected_area_type] || 0}% match
                  </p>
                </div>

                {/* Immediate Action */}
                <div className={`p-3 rounded-lg border text-center ${
                  scopeResult.immediate_action_required === 'Yes'
                    ? 'border-red-500/40 bg-red-950/30'
                    : 'border-slate-800 bg-slate-950/70'
                }`}>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Immediate Action</span>
                  <span className={`text-sm font-bold font-mono ${
                    scopeResult.immediate_action_required === 'Yes' ? 'text-red-400' : 'text-zinc-300'
                  }`}>
                    {scopeResult.immediate_action_required === 'Yes' ? '🚨 REQUIRED' : 'STANDBY'}
                  </span>
                  <p className="text-[9px] font-mono text-zinc-500 mt-1">
                    {scopeResult.immediate_action_probability}% urgency
                  </p>
                </div>

                {/* Survivor Likelihood */}
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 text-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Survivor Likelihood</span>
                  <span className={`text-sm font-bold font-mono ${
                    scopeResult.survivor_presence_likelihood === 'High' ? 'text-purple-400' : 'text-zinc-400'
                  }`}>
                    {scopeResult.survivor_presence_likelihood.toUpperCase()}
                  </span>
                  <p className="text-[9px] font-mono text-zinc-500 mt-1">
                    {scopeResult.survivor_probability}% conf
                  </p>
                </div>
              </div>

              {/* Urgency Progress Bar */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="text-zinc-300">Composite Mission Urgency Score</span>
                  <span className="font-bold text-amber-400">{scopeResult.urgency_score}/100</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      scopeResult.urgency_score > 60 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      scopeResult.urgency_score > 30 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, scopeResult.urgency_score)}%` }}
                  />
                </div>
              </div>

              {/* Recommendations */}
              {scopeResult.recommendations?.length > 0 && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 space-y-1.5">
                  <p className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5 font-semibold">
                    <Shield className="h-3.5 w-3.5" />
                    Tactical Directives & Direct Orders
                  </p>
                  <ul className="space-y-1 text-xs text-zinc-300">
                    {scopeResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── Section 3: Rainfall Forecast (LSTM) ── */}
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
          {/* Disclaimer */}
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
