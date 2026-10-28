import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Map, 
  Bell, 
  ShieldCheck,
  Activity,
  Shield,
  Download,
  Grid,
  FileSpreadsheet,
  Smartphone,
  X,
  LogOut
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'

export default function BottomNav() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  if (!user) return null

  const items = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Map', path: '/map', icon: Map },
    { 
      label: 'Safe Areas', 
      path: '/safe-areas', 
      icon: Shield, 
      isPrimary: true 
    },
    { label: 'Alerts & SMS', path: '/alerts', icon: Bell },
    { label: 'Features', action: () => setShowMoreMenu(prev => !prev), isMore: true, icon: Grid },
  ]

  const moreFeatures = [
    { label: 'Risk Analysis & LSTM', path: '/predict', desc: 'Predictive environmental modeling', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/25' },
    { label: 'Emergency SMS Dispatch', path: '/alerts', desc: 'Cellular alerts to citizens & dispatchers', icon: Smartphone, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', badge: 'ACTIVE' },
    { label: 'Tactical Intelligence Reports', path: '/reports', desc: 'Export emergency CSV & PDF records', icon: FileSpreadsheet, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
    { label: 'Install Native Android APK', path: '/download', desc: 'Offline GIS app v1.2.0 (12.9 MB)', icon: Download, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25' },
    ...(user.role === 'admin' ? [{ label: 'Admin Command Console', path: '/admin', desc: 'Manage users, infrastructure & SMS', icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25' }] : [])
  ]

  return (
    <>
      {/* Mobile "More Features" Bottom Sheet Modal */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreMenu(false)}
              className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 rounded-t-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                    <Grid className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">All Platform Features</h3>
                    <p className="text-[10px] font-mono text-zinc-400">Mobile Tactical Operations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(false)}
                  className="p-1.5 rounded-lg bg-slate-900 text-zinc-400 hover:text-white border border-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* User badge */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-white truncate">{user.name || user.email}</p>
                  <p className="text-[11px] font-mono text-emerald-400 mt-0.5">
                    {user.phone ? `📱 ${user.phone}` : 'SMS ready'} · {user.role?.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    logout()
                    navigate('/login')
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-950/40 text-red-300 border border-red-800/40 text-[11px] font-mono flex items-center gap-1"
                >
                  <LogOut className="h-3 w-3" />
                  Logout
                </button>
              </div>

              {/* Grid of All Features */}
              <div className="space-y-2">
                {moreFeatures.map((feat) => {
                  const Icon = feat.icon
                  const active = location.pathname === feat.path
                  return (
                    <Link
                      key={feat.label}
                      to={feat.path}
                      onClick={() => setShowMoreMenu(false)}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${feat.bg} ${
                        active ? 'ring-2 ring-red-500 shadow-md' : 'hover:scale-[1.01]'
                      }`}
                    >
                      <div className={`p-2 rounded-lg bg-black/40 border border-slate-800 shrink-0 ${feat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">{feat.label}</p>
                          {feat.badge && (
                            <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded">
                              {feat.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{feat.desc}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-around px-2 h-16 max-w-lg mx-auto">
          {items.map((item) => {
            const Icon = item.icon
            const active = item.path ? location.pathname === item.path : showMoreMenu

            if (item.isPrimary) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center -mt-5 group"
                >
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    active 
                      ? 'bg-red-600 text-white ring-4 ring-slate-950 shadow-red-600/40 font-bold' 
                      : 'bg-slate-800 text-zinc-300 ring-4 ring-slate-950 hover:bg-slate-700 border border-slate-700'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-mono mt-1 font-semibold ${
                    active ? 'text-red-500' : 'text-zinc-400'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              )
            }

            if (item.isMore) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all active:scale-95 ${
                    active ? 'text-red-400' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className={`p-1 rounded-lg transition-colors ${
                    active ? 'bg-red-500/10' : ''
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
                    active ? 'font-bold text-white' : 'text-zinc-400'
                  }`}>
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all active:scale-95 ${
                  active ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${
                  active ? 'bg-red-500/10' : ''
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
                  active ? 'font-bold text-white' : 'text-zinc-400'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
