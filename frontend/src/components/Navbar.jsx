import React, { useState, useEffect } from 'react'
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
  Download,
  Menu,
  X,
  Smartphone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Risk Analysis', path: '/predict', icon: Activity },
  { label: 'GIS Map', path: '/map', icon: Map },
  { label: 'Safe Areas', path: '/safe-areas', icon: Shield },
  { label: 'Alerts & SMS', path: '/alerts', icon: Bell },
  { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  if (!user) return null

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md">
      {/* Main navigation header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-black/60 border border-slate-800 p-0.5 flex items-center justify-center overflow-hidden shadow-sm group-hover:border-red-500/50 transition-all">
            <img src="/logo.png" alt="Disaster Intel" className="h-full w-full object-contain rounded-md" />
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

          {/* User profile toggle */}
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-zinc-100 truncate max-w-[120px] sm:max-w-none">
              {user.name || user.email || 'Operations Officer'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {user.phone && (
                <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5" title="SMS alerts active">
                  <Smartphone className="h-2.5 w-2.5" />
                  <span className="hidden xs:inline">{user.phone}</span>
                </span>
              )}
              <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                user.role === 'admin' 
                  ? 'text-red-400 bg-red-500/15 border border-red-500/30' 
                  : 'text-zinc-400 bg-slate-800 border border-slate-700'
              }`}>
                {user.role}
              </span>
            </div>
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

          {/* Mobile Menu Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-zinc-300 hover:text-white border border-slate-800 transition-colors flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-red-400" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-800/80 bg-slate-950/98 backdrop-blur-2xl overflow-hidden px-4 py-3 space-y-3 shadow-2xl"
          >
            {/* Quick SMS status badge */}
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-emerald-300 font-semibold">
                  {user.phone ? `📱 SMS Registered: ${user.phone}` : '📱 Cellular SMS Alerts'}
                </span>
              </div>
              <Link
                to="/alerts"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[10px] font-mono text-white bg-emerald-600 hover:bg-emerald-500 px-2 py-0.5 rounded font-bold"
              >
                Config SMS →
              </Link>
            </div>

            {/* All navigation links grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
                { label: 'Risk Analysis', path: '/predict', icon: Activity },
                { label: 'GIS Tactical Map', path: '/map', icon: Map },
                { label: 'Safe Area Finder', path: '/safe-areas', icon: Shield },
                { label: 'Alerts & SMS', path: '/alerts', icon: Bell, badge: 'SMS' },
                { label: 'Reports Export', path: '/reports', icon: FileSpreadsheet },
                { label: 'Install App (APK)', path: '/download', icon: Download },
                ...(user.role === 'admin' ? [{ label: 'Admin Console', path: '/admin', icon: ShieldCheck, admin: true }] : [])
              ].map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                      active
                        ? 'bg-red-500/15 text-white border-red-500/40 font-semibold shadow-sm'
                        : item.admin
                        ? 'bg-slate-900 border-red-500/30 text-red-400 hover:bg-slate-800'
                        : 'bg-slate-900/80 border-slate-800/80 text-zinc-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-red-400' : 'text-zinc-400'}`} />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

