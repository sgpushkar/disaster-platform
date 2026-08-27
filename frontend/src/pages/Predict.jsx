import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Upload, 
  CloudRain, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Sliders, 
  Activity, 
  ArrowRight,
  Image as ImageIcon,
  Sparkles,
  Info,
  Check,
  RefreshCw,
  Camera
} from 'lucide-react'
import api from '../services/api'

const PRESETS = [
  { label: 'Normal / Dry', values: '0, 0, 1.2, 0, 0.5, 0, 0' },
  { label: 'Moderate Monsoon', values: '12.5, 18.0, 15.2, 22.0, 19.4, 25.0, 20.1' },
  { label: 'Severe Cloudburst', values: '45.0, 62.5, 80.0, 55.2, 90.0, 75.4, 110.0' },
]

export default function Predict() {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageResult, setImageResult] = useState(null)
  const [imageError, setImageError] = useState('')
  const [imageLoading, setImageLoading] = useState(false)

  const [rainfallInput, setRainfallInput] = useState('12.5, 18.0, 15.2, 22.0, 19.4, 25.0, 20.1')
  const [rainfallResult, setRainfallResult] = useState(null)
  const [rainfallError, setRainfallError] = useState('')
  const [rainfallLoading, setRainfallLoading] = useState(false)

  const [riskResult, setRiskResult] = useState(null)
  const [riskError, setRiskError] = useState('')
  const [riskLoading, setRiskLoading] = useState(false)

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setImageResult(null)
    setImageError('')
  }

  const handleImageSubmit = async () => {
    if (!imageFile) return
    setImageLoading(true)
    setImageError('')
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const { data } = await api.post('/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImageResult(data)
    } catch (err) {
      setImageError(err.response?.data?.detail || 'CNN model offline or uninitialized. Train the model using DATASET_GUIDE.md.')
    } finally {
      setImageLoading(false)
    }
  }

  const handleRainfallSubmit = async () => {
    setRainfallLoading(true)
    setRainfallError('')
    try {
      const values = rainfallInput.split(',').map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v))
      if (values.length < 1) throw new Error('Please enter at least 1 historical rainfall value.')
      const { data } = await api.post('/predict/rainfall', { recent_rainfall_mm: values })
      setRainfallResult(data)
    } catch (err) {
      setRainfallError(err.response?.data?.detail || err.message || 'Rainfall LSTM forecast model offline or data invalid.')
    } finally {
      setRainfallLoading(false)
    }
  }

  const handleRiskSubmit = async () => {
    setRiskLoading(true)
    setRiskError('')
    try {
      const { data } = await api.post('/predict/risk', {
        flood_image_confidence: imageResult?.confidence ?? null,
        flood_image_label: imageResult?.prediction ?? null,
        rainfall_forecast_mm: rainfallResult?.tomorrow_mm ?? null,
        use_latest_weather: true,
      })
      setRiskResult(data)
    } catch (err) {
      setRiskError(err.response?.data?.detail || 'Multi-factor risk computation failed.')
    } finally {
      setRiskLoading(false)
    }
  }

  // Visual parsed values for rainfall mini bar preview
  const parsedRainfall = rainfallInput.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
  const maxRain = Math.max(...parsedRainfall, 20)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Disaster Intelligence & Prediction Studio</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              AI INFERENCE ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Execute CNN computer vision terrain classification, LSTM deep precipitation forecasting, and multi-sensor risk fusion.
          </p>
        </div>

        {/* Workflow indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className={imageResult ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>1. Terrain Scan</span>
          <span>→</span>
          <span className={rainfallResult ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>2. LSTM Rain</span>
          <span>→</span>
          <span className={riskResult ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>3. Risk Fusion</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Flood Image Classification (CNN) */}
        <div className="card-panel p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-200">1. Optical Flood Detection (CNN)</h2>
                  <p className="text-[11px] text-slate-400">Deep learning visual surface water classification</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">224x224 RGB</span>
            </div>

            {/* Upload & Mobile Camera Actions */}
            <div className="mt-3 space-y-3">
              {imagePreview ? (
                <div className="relative group/preview flex flex-col items-center justify-center p-3 border border-slate-800 rounded-xl bg-slate-950/60">
                  <img src={imagePreview} alt="Terrain preview" className="max-h-44 rounded-lg object-contain border border-slate-700" />
                  <button
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                      setImageResult(null)
                    }}
                    className="mt-2 text-xs text-red-400 hover:underline font-mono"
                  >
                    Clear Photo & Rescan
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-500/30 hover:border-blue-500 rounded-xl cursor-pointer bg-blue-500/5 hover:bg-blue-500/10 transition-all active:scale-[0.98]">
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                    <Camera className="h-6 w-6 text-blue-400 mb-1.5" />
                    <span className="text-xs font-semibold text-white">Snap Camera Photo</span>
                    <span className="text-[10px] font-mono text-slate-400">Mobile Camera Direct</span>
                  </label>

                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-900 transition-all active:scale-[0.98]">
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    <Upload className="h-6 w-6 text-slate-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-200">Browse Image File</span>
                    <span className="text-[10px] font-mono text-slate-500">Drone / Gallery Photo</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleImageSubmit}
              disabled={!imageFile || imageLoading}
              className="btn-primary w-full py-2.5 text-xs font-semibold"
            >
              {imageLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Running Neural Classification...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Analyze Terrain Image
                </>
              )}
            </button>

            {imageError && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{imageError}</span>
              </div>
            )}

            {imageResult && (
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">CLASSIFICATION RESULT:</span>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                    imageResult.prediction === 'Flood'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {imageResult.prediction?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Inference Confidence</span>
                    <span className="text-white font-bold">{imageResult.confidence}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        imageResult.prediction === 'Flood' ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${imageResult.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Rainfall Forecast (LSTM) */}
        <div className="card-panel p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <CloudRain className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-200">2. Precipitation Forecast (LSTM)</h2>
                  <p className="text-[11px] text-slate-400">Recurrent deep neural network time-series prediction</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">7-DAY INPUT</span>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
                <span>Quick Scenario Presets:</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setRainfallInput(p.values)}
                    className="px-2 py-1 rounded bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition-colors truncate"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono uppercase text-slate-400">
                Recent 7-Day Rainfall Values (mm):
              </label>
              <input
                value={rainfallInput}
                onChange={(e) => setRainfallInput(e.target.value)}
                className="input-control font-mono text-xs"
                placeholder="10, 15, 20, 12, 8, 4, 30"
              />
            </div>

            {/* Mini Bar Preview */}
            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1.5">Input Distribution Profile</span>
              <div className="flex items-end gap-1.5 h-12 pt-1">
                {parsedRainfall.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className="w-full bg-blue-500/40 rounded-t border-t border-blue-400/60"
                      style={{ height: `${Math.min(100, (val / maxRain) * 100)}%` }}
                    />
                    <span className="text-[9px] font-mono text-slate-500">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleRainfallSubmit}
              disabled={rainfallLoading}
              className="btn-primary w-full py-2.5 text-xs font-semibold"
            >
              {rainfallLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Computing LSTM Forecast...
                </>
              ) : (
                <>
                  <CloudRain className="h-3.5 w-3.5" />
                  Generate 4-Day Precipitation Forecast
                </>
              )}
            </button>

            {rainfallError && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{rainfallError}</span>
              </div>
            )}

            {rainfallResult && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                  <span className="text-[10px] font-mono uppercase text-blue-400 font-semibold block">Tomorrow</span>
                  <span className="text-base font-bold font-mono text-white block mt-0.5">
                    {rainfallResult.tomorrow_mm} <span className="text-[10px] font-normal text-slate-400">mm</span>
                  </span>
                </div>
                {rainfallResult.next_3_days_mm.map((mm, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Day +{i + 2}</span>
                    <span className="text-base font-bold font-mono text-slate-200 block mt-0.5">
                      {mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Multi-Source Risk Fusion Engine */}
      <div className="card-panel p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-200">3. Multi-Factor Risk Assessment Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Fuses optical terrain scan + LSTM rainfall forecast + live weather telemetry into an operational index.
            </p>
          </div>

          <button
            onClick={handleRiskSubmit}
            disabled={riskLoading}
            className="btn-primary py-2 px-5 text-xs font-semibold"
          >
            {riskLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Fusing Signals...
              </>
            ) : (
              <>
                <Activity className="h-3.5 w-3.5" />
                Compute Risk Assessment
              </>
            )}
          </button>
        </div>

        {riskError && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>{riskError}</span>
          </div>
        )}

        {riskResult ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Risk Gauge Card */}
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400">Calculated Disaster Risk</span>
              <div className="flex items-baseline gap-1 my-1">
                <span className={`text-5xl font-bold font-mono ${
                  riskResult.risk_level === 'Critical' ? 'text-red-400' :
                  riskResult.risk_level === 'High' ? 'text-orange-400' :
                  riskResult.risk_level === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {riskResult.risk_score}
                </span>
                <span className="text-slate-500 font-mono text-lg">/ 100</span>
              </div>
              <span className={`risk-badge-${riskResult.risk_level.toLowerCase()}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {riskResult.risk_level} Risk Priority
              </span>
            </div>

            {/* Telemetry Breakdown */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs">
              <span className="font-mono uppercase text-slate-400 block font-semibold">Sensor Factor Weights</span>
              <div className="space-y-2 font-mono">
                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Optical Surface Flood</span>
                    <span className="text-slate-400">40% Weight</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '40%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Precipitation Forecast</span>
                    <span className="text-slate-400">35% Weight</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: '35%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Live Station Weather</span>
                    <span className="text-slate-400">25% Weight</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: '25%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Protocol Action Checklist */}
            <div className="space-y-2 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs">
              <span className="font-mono uppercase text-slate-400 block font-semibold">Recommended Protocol</span>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {riskResult.risk_level === 'Critical' ? 'Deploy emergency evacuation & rescue teams immediately.' :
                     riskResult.risk_level === 'High' ? 'Issue flood warning to low-lying sectors and preposition shelters.' :
                     riskResult.risk_level === 'Moderate' ? 'Alert municipal drainage response teams for active monitoring.' :
                     'Nominal conditions. Maintain standard environmental telemetry.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Log incident risk index to persistent database history.</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs font-mono space-y-1">
            <ShieldAlert className="h-7 w-7 mx-auto text-slate-600 mb-2" />
            <p>Awaiting risk execution trigger</p>
            <p className="text-slate-600">Complete Steps 1 & 2 above or click "Compute Risk Assessment" to evaluate live weather.</p>
          </div>
        )}
      </div>
    </div>
  )
}
