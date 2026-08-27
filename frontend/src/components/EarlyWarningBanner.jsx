import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AlertTriangle, MapPin, TrendingUp, ShieldAlert, ArrowRight, X, Phone } from 'lucide-react'

const LEVEL_CONFIG = {
  High: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    icon: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    pulse: 'bg-orange-500',
    label: '🚨 HIGH FLOOD RISK',
    barColor: 'bg-orange-500',
  },
  Critical: {
    bg: 'bg-red-500/12',
    border: 'border-red-500/50',
    icon: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    pulse: 'bg-red-500',
    label: '🆘 CRITICAL FLOOD RISK',
    barColor: 'bg-red-500',
  },
}

export default function EarlyWarningBanner({ riskScore, riskLevel, riskTrend, locationName, recommendation, onDismiss }) {
  const cfg = LEVEL_CONFIG[riskLevel]
  if (!cfg) return null

  const trendLabel = {
    RAPIDLY_INCREASING: '↑↑ Rapidly Increasing',
    INCREASING: '↑ Increasing',
    STABLE: '→ Stable',
    DECREASING: '↓ Decreasing',
    UNKNOWN: '— Unknown',
  }[riskTrend] || riskTrend

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={`relative rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-5 overflow-hidden`}
      >
        {/* Animated accent line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.barColor} animate-pulse`} />

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Left: Icon + Title */}
          <div className="flex items-start gap-3 flex-1">
            <div className={`relative mt-0.5 shrink-0`}>
              <div className={`h-10 w-10 rounded-xl ${cfg.badge} border flex items-center justify-center`}>
                <ShieldAlert className={`h-5 w-5 ${cfg.icon}`} />
              </div>
              <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${cfg.pulse} animate-ping`} />
              <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${cfg.pulse}`} />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold font-mono ${cfg.icon}`}>
                  {cfg.label}
                </span>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {locationName || 'Your Area'}
                </span>
              </div>

              {/* Risk Score + Trend */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-3xl font-bold font-mono ${cfg.icon}`}>
                  {riskScore}%
                </span>
                <div className="space-y-0.5">
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                    {trendLabel}
                  </span>
                </div>
              </div>

              {/* Recommendation */}
              <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                {recommendation || 'Prepare to move toward a designated safe area if conditions worsen.'}
              </p>
            </div>
          </div>

          {/* Right: CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link
              to="/safe-areas"
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl 
                font-semibold text-sm text-white shadow-lg transition-all active:scale-[0.97]
                ${riskLevel === 'Critical' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/25' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/25'}`}
            >
              <MapPin className="h-4 w-4" />
              Find Safest Area
            </Link>
            <Link
              to="/map"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white
                font-semibold text-sm transition-all active:scale-[0.97]"
            >
              <ArrowRight className="h-4 w-4" />
              View on Map
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
