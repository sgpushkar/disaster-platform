import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Activity, 
  Map, 
  Bell, 
  FileSpreadsheet, 
  ShieldCheck, 
  LogOut, 
  Radio,
  MapPin,
  Menu
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Predict', path: '/predict', icon: Activity },
  { label: 'GIS Map', path: '/map', icon: Map },
  { label: 'Alerts', path: '/alerts', icon: Bell },
  { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800 backdrop-blur-md">
      {/* Top telemetry sub-bar (Desktop only) */}
      <div className="hidden lg:flex items-center justify-between px-6 py-1 bg-slate-950 border-b border-slate-800/60 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <Radio className="h-3 w-3" />
            RADAR FEED: ACTIVE
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 text-slate-400">
            <MapPin className="h-3 w-3 text-slate-500" />
            SECTOR: MUMBAI METRO [19.0760° N, 72.8777° E]
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">DISASTER PREDICTION & RESPONSE OPS</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-semibold border border-blue-500/20">
            v2.4 MOBILE READY
          </span>
        </div>
      </div>

      {/* Main navigation header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white font-sans text-sm sm:text-base">DISASTER INTEL</span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 tracking-wider uppercase">Mobile Ops</p>
          </div>
        </Link>

        {/* Desktop navigation links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                location.pathname === '/admin'
                  ? 'bg-amber-600 text-white shadow-sm font-semibold'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
        </nav>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-slate-200 truncate max-w-[110px] sm:max-w-none">{user.name}</span>
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded ${
              user.role === 'admin' 
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' 
                : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
            }`}>
              {user.role}
            </span>
          </div>

          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            title="Sign out"
            className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 transition-all text-xs flex items-center gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
