import { useState } from 'react'
import { STAGE_COLOR, Badge, fmt } from '../shared.jsx'
import { BUCKET_CONFIG, BUCKET_ACTIVE, BUCKET_TO_TRIAGE, TRIAGE_TO_BUCKET, generateJobAnalysis, lsGet } from './jobBoards/helpers.js'

export default function ApplicationDetailModal({ app, onStatusChange, onClose }) {
  const [analysis, setAnalysis]   = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState(null)
  const [saving, setSaving]       = useState(false)

  const prefs = lsGet('rec_prefs') || {}
  const status = TRIAGE_TO_BUCKET[app.triage] || null
  const untriaged = app.stage === 'Wishlist'

  async function doAnalysis() {
    setAiLoading(true); setAiError(null)
    try { setAnalysis(await generateJobAnalysis(app, prefs)) }
    catch (e) { setAiError(e.message) }
    finally { setAiLoading(false) }
  }

  async function changeStatus(key) {
    setSaving(true)
    try { await onStatusChange(key) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 rounded-t-2xl md:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-ink-900 truncate">{app.company}</h2>
              {app.role && <p className="text-sm text-ink-500 mt-0.5 line-clamp-2">{app.role}</p>}
            </div>
            <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-ink-500">
            {app.location    && <span>📍 {app.location}</span>}
            {app.sourceRepo  && <span>📦 {app.sourceRepo}</span>}
            {app.createdTime && <span>📅 {fmt(app.createdTime)}</span>}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {app.jdLink && (
              <a href={app.jdLink} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-ink-900 text-white text-xs rounded-xl hover:bg-ink-800 font-medium">
                View Posting ↗
              </a>
            )}
            <Badge label={app.stage} color={STAGE_COLOR[app.stage]} />
            {app.daysInStage !== null && app.daysInStage !== undefined && (
              <span className={`text-xs ${app.daysInStage > 14 ? 'text-orange-600 font-medium' : 'text-ink-400'}`}>
                {app.daysInStage}d in stage{app.daysInStage > 14 ? ' ⚠' : ''}
              </span>
            )}
            {app.appliedDate && <span className="text-xs text-ink-400">Applied {fmt(app.appliedDate)}</span>}
          </div>
        </div>

        {/* Triage quick-actions — only while still untriaged (Stage === Wishlist) */}
        {untriaged && (
          <div className="px-5 py-4 border-b border-ink-100">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">My status</p>
            <div className="flex gap-2 flex-wrap">
              {BUCKET_CONFIG.filter(b => b.key !== 'all').map(b => (
                <button key={b.key} disabled={saving} onClick={() => changeStatus(status === b.key ? null : b.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-40
                    ${status === b.key ? BUCKET_ACTIVE[b.key] : 'bg-ink-50 text-ink-500 border-ink-200 hover:bg-ink-100'}`}>
                  {b.icon} {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {app.notes && (
          <div className="px-5 py-4 border-b border-ink-100">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-ink-600 whitespace-pre-wrap">{app.notes}</p>
          </div>
        )}

        {/* AI Fit Analysis */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Fit Analysis</p>
            {!analysis && !aiLoading && (
              <button onClick={doAnalysis}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs rounded-lg hover:bg-indigo-100 font-medium">
                Analyze →
              </button>
            )}
          </div>

          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <div className="w-3 h-3 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
              Analyzing with Claude Haiku...
            </div>
          )}

          {aiError && (
            <div className="text-xs text-danger-600 bg-danger-50 rounded-xl p-3">{aiError}</div>
          )}

          {analysis && (
            <div className="space-y-3">
              {analysis.summary && (
                <p className="text-sm text-ink-600 italic leading-relaxed">"{analysis.summary}"</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400 shrink-0">Fit</span>
                <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    analysis.fitScore >= 8 ? 'bg-success-500' :
                    analysis.fitScore >= 6 ? 'bg-accent-500' :
                    analysis.fitScore >= 4 ? 'bg-warning-400' : 'bg-danger-400'}`}
                    style={{ width: `${(analysis.fitScore / 10) * 100}%` }} />
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  analysis.fitScore >= 8 ? 'text-success-600' :
                  analysis.fitScore >= 6 ? 'text-accent-600' :
                  analysis.fitScore >= 4 ? 'text-warning-600' : 'text-danger-500'}`}>
                  {analysis.fitScore}/10
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-success-600 mb-2">Pros</p>
                  <ul className="space-y-1.5">
                    {analysis.pros.map((p, i) => (
                      <li key={i} className="text-xs text-ink-600 flex gap-1.5 leading-tight">
                        <span className="text-success-500 shrink-0 mt-0.5">+</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-danger-500 mb-2">Cons</p>
                  <ul className="space-y-1.5">
                    {analysis.cons.map((c, i) => (
                      <li key={i} className="text-xs text-ink-600 flex gap-1.5 leading-tight">
                        <span className="text-danger-400 shrink-0 mt-0.5">−</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {analysis.company && (
                <div className="mt-3 pt-3 border-t border-ink-100 space-y-1.5">
                  <p className="text-xs font-semibold text-ink-500">Company Context</p>
                  {analysis.company.about && <p className="text-xs text-ink-600">{analysis.company.about}</p>}
                  <div className="flex gap-3 flex-wrap text-xs text-ink-500">
                    {analysis.company.techStack && <span>🛠 {analysis.company.techStack}</span>}
                    {analysis.company.size && <span>📊 {analysis.company.size}</span>}
                  </div>
                  {analysis.company.culture && <p className="text-xs text-ink-500 italic">{analysis.company.culture}</p>}
                </div>
              )}
            </div>
          )}

          {!analysis && !aiLoading && !aiError && (
            <p className="text-xs text-ink-400">
              Claude Haiku (~$0.0001) reads your preferences and gives personalized pros/cons.
              {Object.keys(prefs).filter(k => prefs[k]).length === 0 &&
                ' Set your preferences in Job Boards for a more targeted analysis.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
