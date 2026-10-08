import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Mail, Lock, AlertTriangle, RefreshCw, Wifi, WifiOff, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { API_BASE, checkApiHealth } from '../services/api.js'

// Server status badge
function ServerStatus({ status }) {
  const cfg = {
    online:   { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Server online' },
    waking:   { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', label: 'Waking server...' },
    offline:  { dot: 'bg-red-500', text: 'text-red-400', label: 'Server unreachable' },
    checking: { dot: 'bg-zinc-500 animate-pulse', text: 'text-zinc-500', label: 'Checking...' },
  }
  const c = cfg[status] || cfg.checking
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      <span className={`text-[10px] font-mono ${c.text}`}>{c.label}</span>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember_me') !== 'false')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Authenticating...')
  const [serverStatus, setServerStatus] = useState('checking')
  const [retryCountdown, setRetryCountdown] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()
  const retryTimerRef = useRef(null)
  const countdownRef = useRef(null)
  const formRef = useRef({ email: '', password: '' })

  // Ping the server on mount to wake it up early
  const pingServer = useCallback(async () => {
    setServerStatus('waking')
    const result = await checkApiHealth()
    setServerStatus(result.ok ? 'online' : 'offline')
    return result.ok
  }, [])

  useEffect(() => {
    pingServer()
    return () => {
      clearTimeout(retryTimerRef.current)
      clearInterval(countdownRef.current)
    }
  }, [])

  // Auto-retry with countdown after network error
  const scheduleRetry = useCallback((seconds = 20) => {
    setRetryCountdown(seconds)
    clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    retryTimerRef.current = setTimeout(async () => {
      clearInterval(countdownRef.current)
      setRetryCountdown(0)
      const online = await pingServer()
      if (online && formRef.current.email && formRef.current.password) {
        // Auto-submit if credentials are ready
        doLogin(formRef.current.email, formRef.current.password)
      }
    }, seconds * 1000)
  }, [pingServer])

  const doLogin = useCallback(async (emailVal, passwordVal) => {
    setError('')
    setLoading(true)
    setLoadingMsg('Authenticating...')

    const wakeTimer = setTimeout(() => {
      setLoadingMsg('Server is waking up (~30s on free-tier)...')
      setServerStatus('waking')
    }, 4000)

    try {
      await login(emailVal, passwordVal)
      if (rememberMe) {
        localStorage.setItem('remembered_email', emailVal)
        localStorage.setItem('remember_me', 'true')
      } else {
        localStorage.removeItem('remembered_email')
        localStorage.setItem('remember_me', 'false')
      }
      navigate('/dashboard')
    } catch (err) {
      clearTimeout(wakeTimer)
      const isNetworkError = err.message === 'Network Error' || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK'
      if (isNetworkError) {
        setServerStatus('offline')
        setError('network')
        scheduleRetry(20)
      } else {
        setServerStatus('online')
        setError(err.response?.data?.detail || err.message || 'Authentication failed. Check your credentials.')
      }
    } finally {
      clearTimeout(wakeTimer)
      setLoading(false)
      setLoadingMsg('Authenticating...')
    }
  }, [login, navigate, scheduleRetry, rememberMe])

  const handleSubmit = (e) => {
    e.preventDefault()
    clearTimeout(retryTimerRef.current)
    clearInterval(countdownRef.current)
    setRetryCountdown(0)
    formRef.current = { email, password }
    doLogin(email, password)
  }

  const handleManualRetry = () => {
    clearTimeout(retryTimerRef.current)
    clearInterval(countdownRef.current)
    setRetryCountdown(0)
    setError('')
    if (formRef.current.email && formRef.current.password) {
      doLogin(formRef.current.email, formRef.current.password)
    } else {
      pingServer()
    }
  }

  const handleAutofillPushkar = () => {
    setEmail('pushkarmhatre424@gmail.com')
    setPassword('password123')
    formRef.current = { email: 'pushkarmhatre424@gmail.com', password: 'password123' }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md card-panel p-6 sm:p-8 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-black/60 border border-slate-800 p-2 flex items-center justify-center shadow-xl shadow-red-500/5">
            <img src="/logo.png" alt="Disaster Intel" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Disaster Intelligence Portal</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Operator Authentication &amp; Operations Access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); formRef.current.email = e.target.value }}
                className="input-control pl-9 text-xs"
                placeholder="pushkarmhatre424@gmail.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono uppercase text-slate-400">Access Key / Password</label>
            <div className="relative">
              <Lock className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); formRef.current.password = e.target.value }}
                className="input-control pl-9 pr-9 text-xs"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>


          {/* Remember me & Quick Autofill Row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={handleAutofillPushkar}
              className="text-[11px] font-mono text-zinc-400 hover:text-red-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded transition-colors"
              title="Quick-fill Pushkar admin credentials"
            >
              ⚡ Fill Pushkar (Admin)
            </button>
          </div>

          {/* Error / Network error block */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-lg border overflow-hidden"
              >
                {error === 'network' ? (
                  <div className="bg-amber-500/5 border-amber-500/25 p-3.5 space-y-3">
                    <div className="flex items-start gap-2">
                      <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300">Backend server is sleeping</p>
                        <p className="text-[11px] text-amber-500/80 mt-0.5">
                          Render free-tier spins down after inactivity. Auto-retrying in&nbsp;
                          <span className="font-mono font-bold text-amber-300">{retryCountdown}s</span>
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-amber-900/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-amber-400 rounded-full"
                        initial={{ width: '100%' }}
                        animate={{ width: `${(retryCountdown / 20) * 100}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleManualRetry}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/20 transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry Now
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border-red-500/30 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                    <span className="text-xs text-red-300">{error}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {loadingMsg}
              </span>
            ) : 'Sign In to Operations'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-zinc-400">
          Need an operator account?{' '}
          <Link to="/signup" className="text-red-400 hover:underline font-medium">
            Register new account
          </Link>
        </div>

        {/* Footer: server status + target node */}
        <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <ServerStatus status={serverStatus} />
          <span className="text-zinc-500 truncate max-w-[180px]" title={API_BASE}>
            {API_BASE.replace(/^https?:\/\//, '')}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
