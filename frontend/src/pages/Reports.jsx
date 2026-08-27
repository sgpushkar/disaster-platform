import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import api from '../services/api'

export default function Reports() {
  const [loading, setLoading] = useState(null) // 'pdf' | 'csv' | null
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const download = async (format) => {
    setLoading(format)
    setError('')
    setSuccess('')
    try {
      const { data } = await api.get(`/reports/${format}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `disaster_intel_report_${new Date().toISOString().slice(0, 10)}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setSuccess(`Generated and downloaded ${format.toUpperCase()} report successfully.`)
    } catch (err) {
      setError('Failed to generate report. Ensure backend services are online.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Incident Reports & Data Export</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              AUDIT COMPLIANT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Export comprehensive predictive analytics logs, meteorological telemetry, and risk records for post-disaster audits.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Executive Dossier */}
        <div className="card-panel p-6 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                PDF DOCUMENT
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">Executive Disaster Brief (PDF)</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Structured, publication-ready summary document containing tabular risk records, timestamps, and model predictions.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Layout:</span>
                <span className="text-slate-200">A4 Printable Format</span>
              </div>
              <div className="flex justify-between">
                <span>Engine:</span>
                <span className="text-slate-200">ReportLab Python Core</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => download('pdf')}
            disabled={loading === 'pdf'}
            className="btn-primary w-full py-2.5 text-xs font-semibold"
          >
            {loading === 'pdf' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Compiling PDF Document...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export Executive PDF
              </>
            )}
          </button>
        </div>

        {/* CSV Raw Data */}
        <div className="card-panel p-6 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                CSV TABULAR
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">Raw Incident Telemetry (CSV)</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Complete raw dataset formatted for Microsoft Excel, GIS spatial software, Python Pandas, or external business intelligence systems.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Delimiter:</span>
                <span className="text-slate-200">Comma-Separated (UTF-8)</span>
              </div>
              <div className="flex justify-between">
                <span>Schema:</span>
                <span className="text-slate-200">Timestamps, Confidences, Levels</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => download('csv')}
            disabled={loading === 'csv'}
            className="btn-secondary w-full py-2.5 text-xs font-semibold"
          >
            {loading === 'csv' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Serializing CSV Rows...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export Raw CSV Dataset
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
