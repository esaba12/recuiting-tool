import { useState } from 'react'
import { BUCKET_CONFIG, BUCKET_ACTIVE, generateJobAnalysis, jobAgeDays, isGhostJob } from './helpers.js'

export default function JobDetailModal({ job, status, blurb, onStatusChange, onClose, prefs }) {
  const [analysis, setAnalysis]       = useState(null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState(null)
  const ageDays = jobAgeDays(job)
  const stale = isGhostJob(job)

  async function doAnalysis() {
    setAiLoading(true); setAiError(null)
    try { setAnalysis(await generateJobAnalysis(job, prefs)) }
    catch (e) { setAiError(e.message) }
    finally { setAiLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 rounded-t-2xl md:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-ink-900 truncate">{job.company}</h2>
              {blurb?.companyAbout && <p className="text-xs text-ink-400 mt-0.5">{blurb.companyAbout}</p>}
              {job.role && <p className="text-sm text-ink-500 mt-0.5 line-clamp-2">{job.role}</p>}
              {blurb?.roleSummary && <p className="text-xs text-ink-400 mt-0.5">{blurb.roleSummary}</p>}
            </div>
            <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-ink-500">
            {job.location  && <span>📍 {job.location}</span>}
            {job.dateAdded && <span>📅 {job.dateAdded}</span>}
            {stale && (
              <span className="px-1.5 py-0.5 rounded-full bg-warning-100 text-warning-800 text-[10px] font-medium">
                👻 No update in {ageDays}d
              </span>
            )}
          </div>
          {stale && (
            <p className="text-[11px] text-warning-700 mt-1.5">
              27-48% of tech postings show ghost-job characteristics — this one's been stale a while. Worth a quick check before spending an application on it.
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            {job.applyUrl && (
              <a href={job.applyUrl} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-ink-900 text-white text-xs rounded-xl hover:bg-ink-800 font-medium">
                Apply ↗
              </a>
            )}
            <span className={`px-3 py-2 text-xs rounded-xl font-medium ${status ? 'bg-success-50 text-success-700' : 'bg-ink-50 text-ink-400'}`}>
              {status ? '✓ In Notion' : 'Importing to Notion...'}
            </span>
          </div>
        </div>

        {/* Status buckets */}
        <div className="px-5 py-4 border-b border-ink-100">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">My status</p>
          <div className="flex gap-2 flex-wrap">
            {BUCKET_CONFIG.filter(b => b.key !== 'all').map(b => (
              <button key={b.key} disabled={!status} onClick={() => onStatusChange(status === b.key ? null : b.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-40
                  ${status === b.key ? BUCKET_ACTIVE[b.key] : 'bg-ink-50 text-ink-500 border-ink-200 hover:bg-ink-100'}`}>
                {b.icon} {b.label}
              </button>
            ))}
          </div>
        </div>

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
                ' Set your preferences above for a more targeted analysis.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

