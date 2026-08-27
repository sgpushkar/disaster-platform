import React from 'react'
import { motion } from 'framer-motion'

const LEVEL_CONFIG = {
  Low: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'LOW', textColor: 'text-emerald-400' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'MODERATE', textColor: 'text-amber-400' },
  High: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'HIGH', textColor: 'text-orange-400' },
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', label: 'CRITICAL', textColor: 'text-red-400' },
}

const TREND_ICONS = {
  RAPIDLY_INCREASING: '↑↑',
  INCREASING: '↑',
  STABLE: '→',
  DECREASING: '↓',
  UNKNOWN: '—',
}

export default function RiskGauge({ riskScore = 0, riskLevel = 'Low', riskTrend = 'UNKNOWN', size = 'lg' }) {
  const cfg = LEVEL_CONFIG[riskLevel] || LEVEL_CONFIG.Low
  const trend = TREND_ICONS[riskTrend] || '—'

  // SVG arc parameters
  const isLarge = size === 'lg'
  const radius = isLarge ? 70 : 52
  const stroke = isLarge ? 10 : 8
  const svgSize = isLarge ? 180 : 136
  const cx = svgSize / 2
  const cy = svgSize / 2

  // Arc spans 240° (from 150° to 30° clockwise)
  const arcDeg = 240
  const startAngle = 150
  const circumference = 2 * Math.PI * radius
  const arcLength = (arcDeg / 360) * circumference
  const filled = (riskScore / 100) * arcLength

  // Convert angle to SVG coords
  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const describeArc = (cx, cy, r, startDeg, endDeg) => {
    const s = polarToCartesian(cx, cy, r, startDeg)
    const e = polarToCartesian(cx, cy, r, endDeg)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const endAngle = startAngle + arcDeg
  const trackPath = describeArc(cx, cy, radius, startAngle, endAngle)

  // Filled arc: from startAngle to startAngle + (riskScore/100)*arcDeg
  const filledDeg = (riskScore / 100) * arcDeg
  const filledEnd = startAngle + filledDeg
  const filledPath = filledDeg > 0.5 ? describeArc(cx, cy, radius, startAngle, Math.min(filledEnd, endAngle)) : null

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={svgSize} height={svgSize * 0.78} viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ overflow: 'visible' }}>
          {/* Track */}
          <path
            d={trackPath}
            stroke="#1e293b"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
          {/* Filled Arc */}
          {filledPath && (
            <motion.path
              d={filledPath}
              stroke={cfg.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
              style={{ filter: `drop-shadow(0 0 6px ${cfg.color}60)` }}
            />
          )}
          {/* Center text */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize={isLarge ? 28 : 22}
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
            fill={cfg.color}
          >
            {riskScore}
          </text>
          <text
            x={cx}
            y={cy + (isLarge ? 18 : 14)}
            textAnchor="middle"
            fontSize={isLarge ? 11 : 9}
            fontFamily="JetBrains Mono, monospace"
            fill="#64748b"
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Level + Trend badges */}
      <div className="flex flex-col items-center gap-1">
        <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full border
          ${riskLevel === 'Critical' ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse' :
            riskLevel === 'High' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
            riskLevel === 'Moderate' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}>
          {cfg.label}
        </span>
        {riskTrend !== 'UNKNOWN' && (
          <span className={`text-[11px] font-mono ${
            riskTrend === 'RAPIDLY_INCREASING' ? 'text-red-400' :
            riskTrend === 'INCREASING' ? 'text-orange-400' :
            riskTrend === 'DECREASING' ? 'text-emerald-400' : 'text-slate-400'
          }`}>
            {trend} {riskTrend.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </div>
  )
}
