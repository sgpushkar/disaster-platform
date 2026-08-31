import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Smartphone, Download, ShieldCheck, Wifi, Bell, MapPin,
  Zap, ChevronRight, Star, CheckCircle, AlertTriangle,
  Activity, Shield, ExternalLink, ArrowDown
} from 'lucide-react'

const APK_URL = '/disaster-intel.apk'
const APP_VERSION = '1.0.0'
const APP_SIZE = '18.4 MB'
const MIN_ANDROID = 'Android 7.0+'

const FEATURES = [
  { icon: Bell, label: 'Real-Time Alerts', desc: 'Push notifications for flood & disaster warnings' },
  { icon: MapPin, label: 'GIS Tactical Map', desc: 'Live danger zones and safe area routing' },
  { icon: Activity, label: 'LSTM Risk Engine', desc: 'AI-powered 14-day hazard forecasting' },
  { icon: Shield, label: 'Safe Area Finder', desc: 'Ranked shelters, hospitals & evacuation routes' },
  { icon: Wifi, label: 'Offline Ready', desc: 'Critical data cached for offline access' },
  { icon: Zap, label: 'Sensor Telemetry', desc: 'Live weather data — rainfall, wind, pressure' },
]

const STEPS = [
  { num: '01', title: 'Download the APK', desc: 'Tap the button below to download the installer' },
  { num: '02', title: 'Allow Unknown Sources', desc: 'Settings → Security → Enable "Install from Unknown Sources"' },
  { num: '03', title: 'Install & Launch', desc: 'Open the downloaded file and follow the prompts' },
]

export default function DownloadPage() {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError('')

    try {
      // HEAD-check the file first to confirm it's a real APK (not a placeholder)
      const check = await fetch(APK_URL, { method: 'HEAD' }).catch(() => null)
      const contentType = check?.headers?.get('content-type') || ''
      const contentLength = parseInt(check?.headers?.get('content-length') || '0', 10)

      const isRealApk =
        check?.ok &&
        (contentType.includes('android') ||
         contentType.includes('octet-stream') ||
         contentType.includes('zip')) &&
        contentLength > 10000 // real APK is always > 10KB

      if (!isRealApk) {
        setDownloadError('APK not yet available. The build is being prepared — check back shortly or build locally.')
        setDownloading(false)
        return
      }

      // Trigger real browser download
      const a = document.createElement('a')
      a.href = APK_URL
      a.download = 'DisasterIntel.apk'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setTimeout(() => {
        setDownloading(false)
        setDownloaded(true)
      }, 1500)
    } catch {
      setDownloadError('Download failed. Please try again.')
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-red-600/10 blur-[120px]" />
          <div className="absolute top-48 -left-20 h-64 w-64 rounded-full bg-red-800/8 blur-[100px]" />
          <div className="absolute top-32 -right-20 h-64 w-64 rounded-full bg-orange-600/6 blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-mono font-semibold mb-6"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            ANDROID APK · v{APP_VERSION} · {APP_SIZE}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight mb-4">
              Disaster Intel
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-orange-400">
                Mobile App
              </span>
            </h1>
            <p className="text-zinc-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-10">
              Real-time flood prediction, evacuation routing and emergency alerts — now on Android.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              id="apk-download-btn"
              onClick={handleDownload}
              disabled={downloading}
              className="group relative inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-lg shadow-red-600/25 transition-all active:scale-[0.97] disabled:opacity-70 disabled:pointer-events-none"
            >
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {downloaded ? (
                <CheckCircle className="h-5 w-5 text-emerald-300" />
              ) : downloading ? (
                <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              {downloaded ? 'Download Started!' : downloading ? 'Preparing...' : 'Download APK'}
              {!downloading && !downloaded && (
                <ArrowDown className="h-4 w-4 opacity-70 group-hover:translate-y-0.5 transition-transform" />
              )}
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {MIN_ANDROID} · Verified build
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-500/80 bg-amber-500/5 border border-amber-500/15 px-3 py-1.5 rounded-lg"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Sideload APK — requires enabling "Install from Unknown Sources" in Android settings
          </motion.div>
        </div>
      </section>

      {/* Features + Phone Mockup */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Phone Mockup */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-red-600/15 blur-3xl rounded-full scale-110" />
              <div className="relative w-56 sm:w-64 bg-[#111114] border-2 border-slate-700/60 rounded-[2.5rem] p-3 shadow-2xl shadow-black/60">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#09090b] rounded-full flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                </div>
                <div className="bg-[#09090b] rounded-[2rem] overflow-hidden aspect-[9/19] flex flex-col pt-6">
                  <div className="flex-1 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded bg-red-600/80 flex items-center justify-center">
                          <ShieldCheck className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-[9px] font-bold text-white font-mono">DISASTER INTEL</span>
                      </div>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="bg-[#111114] rounded-lg p-2.5 border border-slate-800">
                      <div className="text-[8px] font-mono text-zinc-500 mb-1.5">COMPOSITE RISK</div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full w-3/5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] font-mono text-orange-400 font-bold">MODERATE</span>
                        <span className="text-[8px] font-mono text-zinc-500">58/100</span>
                      </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-2 flex items-start gap-1.5">
                      <Bell className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[8px] font-bold font-mono text-red-400">FLOOD WATCH</div>
                        <div className="text-[7px] text-zinc-400 leading-tight">Heavy rainfall expected. Move to high ground.</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: 'TEMP', value: '28.4°C', color: 'text-red-400' },
                        { label: 'RAIN', value: '14mm', color: 'text-cyan-400' },
                        { label: 'WIND', value: '8m/s', color: 'text-zinc-300' },
                        { label: 'HUMID', value: '82%', color: 'text-zinc-300' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-[#111114] border border-slate-800 rounded p-1.5">
                          <div className="text-[7px] font-mono text-zinc-600">{label}</div>
                          <div className={`text-[9px] font-bold font-mono ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#111114] border border-slate-800 rounded-lg h-14 flex items-center justify-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-[8px] font-mono text-zinc-500">GIS TACTICAL MAP</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-800 px-4 py-2 flex items-center justify-around">
                    {['bg-red-600','bg-slate-800','bg-slate-800','bg-slate-800'].map((bg, i) => (
                      <div key={i} className={`h-4 w-4 rounded ${bg}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-full px-3 py-1 text-[10px] font-mono text-zinc-400 whitespace-nowrap">
                v{APP_VERSION} · {MIN_ANDROID}
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="space-y-3">
            <h2 className="text-xl font-bold text-white mb-5">Everything you need in a crisis</h2>
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#111114] border border-slate-800 hover:border-slate-700 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0 group-hover:bg-red-500/15 transition-colors">
                  <Icon className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-700 ml-auto shrink-0 mt-1 group-hover:text-zinc-500 transition-colors" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Install Steps */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Install in 3 steps</h2>
          <p className="text-zinc-500 text-sm">Simple sideload — no Play Store needed</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map(({ num, title, desc }, i) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
              className="relative card-panel p-5 text-center overflow-hidden"
            >
              <div className="absolute -top-4 -left-4 text-7xl font-black font-mono text-slate-800/50 select-none">{num}</div>
              <div className="relative">
                <div className="text-base font-bold text-white mb-1.5">{title}</div>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a0a0a] via-[#111114] to-[#0e0e11] border border-red-500/20 p-8 text-center"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-64 bg-red-600/10 blur-3xl" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Star className="h-3 w-3" />
              Free — No In-App Purchases
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Stay prepared, stay safe</h2>
            <p className="text-zinc-400 text-sm mb-7 max-w-sm mx-auto">
              Download the Disaster Intel app and get instant access to critical emergency intelligence for your area.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="apk-download-btn-bottom"
                onClick={handleDownload}
                disabled={downloading}
                className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-[0.97] disabled:opacity-70 disabled:pointer-events-none"
              >
                <Download className="h-4 w-4" />
                Download APK · {APP_SIZE}
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-zinc-300 text-sm font-medium transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                View Source
              </a>
            </div>
            <p className="text-[11px] font-mono text-zinc-600 mt-5">
              APK v{APP_VERSION} · {APP_SIZE} · {MIN_ANDROID} · Built with Capacitor
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
