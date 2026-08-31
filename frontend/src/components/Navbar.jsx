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
  ShieldAlert,
  Shield,
  Download
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Risk Analysis', path: '/predict', icon: Activity },
  { label: 'GIS Map', path: '/map', icon: Map },
  { label: 'Safe Areas', path: '/safe-areas', icon: Shield },
  { label: 'Alerts', path: '/alerts', icon: Bell },
  { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md">
      {/* Main navigation header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
            <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-wider text-white font-sans text-sm sm:text-base">DISASTER INTEL</span>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            </div>
            <p className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase">Emergency Operations</p>
          </div>
        </Link>

        {/* Desktop navigation links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-slate-800 text-white border border-red-500/40 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-slate-800/60'
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                location.pathname === '/admin'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/40 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
        </nav>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Download APK button */}
          <Link
            to="/download"
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              location.pathname === '/download'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-slate-900 text-zinc-300 hover:text-white hover:bg-red-600 hover:border-red-600 border-slate-700'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            Get App
          </Link>

          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-zinc-200 truncate max-w-[120px] sm:max-w-none">{user.name}</span>
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
              user.role === 'admin' 
                ? 'text-red-400 bg-red-500/10 border border-red-500/25 font-bold' 
                : 'text-zinc-400 bg-slate-800 border border-slate-700'
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
            className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-red-500/15 text-zinc-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 transition-all text-xs flex items-center gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
