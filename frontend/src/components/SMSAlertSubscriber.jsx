import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone, Radio, CheckCircle2, AlertTriangle, Send,
  Loader2, BellRing, Info, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react'
import api from '../services/api'

export default function SMSAlertSubscriber() {
  const [isOpen, setIsOpen] = useState(true)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [locationName, setLocationName] = useState('All Regions')
  const [minRiskLevel, setMinRiskLevel] = useState('High')
  
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [statusInfo, setStatusInfo] = useState(null)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error' | 'info', message: '' }
  const [subscribedPhone, setSubscribedPhone] = useState(
    localStorage.getItem('subscribed_sms_phone') || ''
  )

  useEffect(() => {
    fetchSMSStatus()
  }, [])

  const fetchSMSStatus = async () => {
    try {
      const res = await api.get('/sms/status')
      setStatusInfo(res.data)
    } catch (_) {}
  }

  const handleSubscribe = async (e) => {
    e.preventDefault()
    if (!phone || phone.trim().length < 8) {
      setFeedback({ type: 'error', message: 'Please enter a valid phone number (minimum 8 digits).' })
      return
    }

    setLoading(true)
    setFeedback(null)
    try {
      const res = await api.post('/sms/subscribe', {
        phone_number: phone.trim(),
        name: name.trim() || null,
        location_name: locationName,
        min_risk_level: minRiskLevel,
      })

      localStorage.setItem('subscribed_sms_phone', res.data.phone_number)
      setSubscribedPhone(res.data.phone_number)
      setFeedback({
        type: 'success',
        message: `Emergency SMS alerts activated for ${res.data.phone_number} (${res.data.location_name}, ${res.data.min_risk_level}+ risk). A confirmation SMS has been dispatched!`,
      })
      fetchSMSStatus()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to activate SMS alerts. Please check the number.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    const targetPhone = phone.trim() || subscribedPhone
    if (!targetPhone) {
      setFeedback({ type: 'error', message: 'Please enter a phone number to test.' })
      return
    }

    setTestLoading(true)
    setFeedback(null)
    try {
      const res = await api.post('/sms/test', {
        phone_number: targetPhone,
      })
      const result = res.data.result
      const isTrial = result.is_trial_restricted
      setFeedback({
        type: isTrial ? 'warning' : 'info',
        message: isTrial
          ? `Dispatched to ${result.recipient}! (Note: Twilio Free Trial delivered stock template because trial accounts restrict custom SMS bodies. Upgrade Twilio for custom disaster text).`
          : `Test SMS dispatched to ${result.recipient}! Provider: ${result.provider} (Status: ${result.status.toUpperCase()}).`,
      })
      fetchSMSStatus()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to dispatch test SMS.',
      })
    } finally {
      setTestLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    const targetPhone = subscribedPhone || phone.trim()
    if (!targetPhone) return

    setLoading(true)
    try {
      const res = await api.post('/sms/unsubscribe', {
        phone_number: targetPhone,
      })
      localStorage.removeItem('subscribed_sms_phone')
      setSubscribedPhone('')
      setFeedback({ type: 'info', message: res.data.detail })
      fetchSMSStatus()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to unsubscribe.',
      })
    } finally {
      setLoading(false)
    }
  }

  const LOCATIONS = [
    'All Regions',
    'Pune',
    'Mumbai',
    'Nashik',
    'Nagpur',
    'Thane',
    'Kolhapur',
  ]

  return (
    <div className="card-panel overflow-hidden border border-red-500/25 bg-gradient-to-b from-[#15151a] to-[#0f0f13]">
      {/* Top Banner / Accordion Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Emergency SMS Alert Dispatch
              </h2>
              {statusInfo && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
                    statusInfo.is_live
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                  title={
                    statusInfo.is_live
                      ? 'Connected to live Twilio SMS carrier network'
                      : 'Running in developer simulation mode. Real SMS sends as soon as Twilio credentials are in .env'
                  }
                >
                  <Radio className="h-2.5 w-2.5 animate-pulse" />
                  {statusInfo.is_live ? 'TWILIO LIVE' : 'SIMULATION MODE'}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Receive automatic, instant SMS notifications on your mobile phone when High or Critical flood risk is detected.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {statusInfo && statusInfo.active_subscribers > 0 && (
            <span className="text-[11px] font-mono text-zinc-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
              {statusInfo.active_subscribers} active {statusInfo.active_subscribers === 1 ? 'subscriber' : 'subscribers'}
            </span>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-slate-800/60 transition-colors"
            aria-label="Toggle SMS subscription panel"
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 sm:p-5 space-y-4"
          >
            {/* Feedback notification */}
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-xs flex items-start gap-2.5 border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : feedback.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : feedback.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{feedback.message}</div>
              </motion.div>
            )}

            {/* If user is already subscribed on this device */}
            {subscribedPhone && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    Subscribed on this device: <strong className="font-mono text-white">{subscribedPhone}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={testLoading}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-zinc-200 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                  >
                    {testLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 text-red-400" />}
                    Send Test SMS
                  </button>
                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={loading}
                    className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 text-[11px] font-medium transition-colors"
                  >
                    Unsubscribe
                  </button>
                </div>
              </div>
            )}

            {/* Subscription Form */}
            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Phone Number */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210 or +91..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-control text-xs py-2 pl-3 pr-3 font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500">Defaults to +91 (India) if 10 digits</span>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Citizen Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-control text-xs py-2"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Region / City
                  </label>
                  <select
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="input-control text-xs py-2 bg-[#0d0d10]"
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Severity Threshold Radio Cards */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Alert Severity Threshold
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'Critical',
                      title: 'Critical Only',
                      desc: 'Evacuations & life threats',
                      border: 'border-red-500/30',
                    },
                    {
                      id: 'High',
                      title: 'High & Critical',
                      desc: 'Recommended (flash floods, storm surges)',
                      border: 'border-orange-500/30',
                    },
                    {
                      id: 'Moderate',
                      title: 'Moderate & Above',
                      desc: 'All advisories and warnings',
                      border: 'border-amber-500/30',
                    },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setMinRiskLevel(lvl.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        minRiskLevel === lvl.id
                          ? `bg-red-500/10 border-red-500 text-white shadow-sm`
                          : `bg-slate-900/60 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:border-slate-700`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{lvl.title}</span>
                        {minRiskLevel === lvl.id && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{lvl.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs py-2 px-5 w-full sm:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BellRing className="h-3.5 w-3.5" />
                  )}
                  {loading ? 'Registering...' : 'Subscribe to Emergency SMS'}
                </button>

                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testLoading || (!phone && !subscribedPhone)}
                  className="btn-secondary text-xs py-2 px-4 w-full sm:w-auto text-zinc-300"
                >
                  {testLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 text-red-400" />
                  )}
                  {testLoading ? 'Sending...' : 'Send Test SMS Verification'}
                </button>

                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 ml-auto">
                  <Info className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>Free service. Reply STOP anytime to cancel.</span>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
