import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Map, 
  Bell, 
  ShieldCheck,
  Activity,
  Shield
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()

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
    { label: 'Alerts', path: '/alerts', icon: Bell },
    user.role === 'admin'
      ? { label: 'Admin', path: '/admin', icon: ShieldCheck }
      : { label: 'Risk', path: '/predict', icon: Activity },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around px-2 h-16 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.path

          if (item.isPrimary) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center -mt-5 group"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  active 
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-slate-950 shadow-amber-500/30 font-bold' 
                    : 'bg-slate-800 text-amber-400 ring-4 ring-slate-950 hover:bg-slate-700 border border-slate-700'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[10px] font-mono mt-1 font-semibold ${
                  active ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all active:scale-95 ${
                active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${
                active ? 'bg-amber-500/10' : ''
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
                active ? 'font-bold text-white' : 'text-slate-400'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
