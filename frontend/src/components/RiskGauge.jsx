import React from 'react'
import { motion } from 'framer-motion'

const LEVEL_CONFIG = {
  Low: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'LOW RISK', textColor: 'text-emerald-400' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'MODERATE RISK', textColor: 'text-amber-400' },
  High: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'HIGH RISK', textColor: 'text-orange-400' },
  Critical: { color: '#e11d48', bg: 'rgba(225,29,72,0.15)', label: 'CRITICAL RISK', textColor: 'text-rose-400' },
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
  const radius = isLarge ? 68 : 50
  const stroke = isLarge ? 9 : 7
  const svgSize = isLarge ? 176 : 132
  const cx = svgSize / 2
  const cy = svgSize / 2

  // Arc spans 240° (from 150° to 30° clockwise)
  const arcDeg = 240
  const startAngle = 150
  const circumference = 2 * Math.PI * radius
  const arcLength = (arcDeg / 360) * circumference

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
  const filledDeg = (Math.max(0, Math.min(100, riskScore)) / 100) * arcDeg
  const filledEnd = startAngle + filledDeg
  const filledPath = filledDeg > 0.5 ? describeArc(cx, cy, radius, startAngle, Math.min(filledEnd, endAngle)) : null

  // Tick marks at 25%, 50%, 75%
  const ticks = [0.25, 0.5, 0.75].map((pct) => {
    const angle = startAngle + pct * arcDeg
    const p1 = polarToCartesian(cx, cy, radius - stroke / 2 - 2, angle)
    const p2 = polarToCartesian(cx, cy, radius + stroke / 2 + 2, angle)
    return { p1, p2, pct }
  })

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={svgSize} height={svgSize * 0.78} viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ overflow: 'visible' }}>
          {/* Subtle background glow */}
          <circle cx={cx} cy={cy} r={radius * 0.7} fill={cfg.color} opacity="0.03" />

          {/* Carbon Instrument Track */}
          <path
            d={trackPath}
            stroke="#1a1e27"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />

          {/* Ticks */}
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.p1.x}
              y1={t.p1.y}
              x2={t.p2.x}
              y2={t.p2.y}
              stroke="#2c3342"
              strokeWidth="1.5"
            />
          ))}

          {/* Calibrated Filled Arc */}
          {filledPath && (
            <motion.path
              d={filledPath}
              stroke={cfg.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              style={{ filter: `drop-shadow(0 0 5px ${cfg.color}50)` }}
            />
          )}

          {/* Numeric Value */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize={isLarge ? 30 : 22}
            fontWeight="700"
            fontFamily="JetBrains Mono, monospace"
            fill="#f8fafc"
          >
            {riskScore}
          </text>
          <text
            x={cx}
            y={cy + (isLarge ? 17 : 13)}
            textAnchor="middle"
            fontSize={isLarge ? 10 : 8}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="500"
            fill="#64748b"
            letterSpacing="1"
          >
            SCORE / 100
          </text>
        </svg>
      </div>

      {/* Mission Level & Trajectory */}
      <div className="flex flex-col items-center gap-1">
        <span className={`text-[11px] font-bold font-mono px-3 py-0.5 rounded border tracking-wider
          ${riskLevel === 'Critical' ? 'bg-rose-500/15 text-rose-400 border-rose-500/35 animate-pulse' :
            riskLevel === 'High' ? 'bg-orange-500/15 text-orange-400 border-orange-500/35' :
            riskLevel === 'Moderate' ? 'bg-amber-500/15 text-amber-400 border-amber-500/35' :
            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}>
          {cfg.label}
        </span>
        {riskTrend !== 'UNKNOWN' && (
          <span className={`text-[10px] font-mono ${
            riskTrend === 'RAPIDLY_INCREASING' ? 'text-rose-400 font-semibold' :
            riskTrend === 'INCREASING' ? 'text-amber-400' :
            riskTrend === 'DECREASING' ? 'text-emerald-400' : 'text-slate-500'
          }`}>
            {trend} {riskTrend.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </div>
  )
}
