import React from 'react'
import { motion } from 'framer-motion'

const riskBadgeClass = {
  Low: 'risk-badge-low',
  Moderate: 'risk-badge-moderate',
  High: 'risk-badge-high',
  Critical: 'risk-badge-critical',
}

export default function StatCard({ title, value, unit, icon: Icon, riskLevel, subtitle, delta, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card-panel p-5 relative overflow-hidden group hover:border-slate-700 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase font-mono">{title}</p>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white">{value}</span>
            {unit && <span className="text-xs font-mono text-slate-400 font-medium">{unit}</span>}
          </div>
          
          {subtitle && (
            <p className="text-xs text-slate-400 pt-0.5 truncate max-w-[200px]">{subtitle}</p>
          )}

          {riskLevel && (
            <div className="pt-2">
              <span className={riskBadgeClass[riskLevel] || 'risk-badge-low'}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {riskLevel} Risk
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-all">
            {typeof Icon === 'function' || typeof Icon === 'object' ? <Icon className="h-5 w-5" /> : Icon}
          </div>
        )}
      </div>

      {delta && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Telemetry Delta</span>
          <span className="text-emerald-400 font-semibold">{delta}</span>
        </div>
      )}
    </motion.div>
  )
}
