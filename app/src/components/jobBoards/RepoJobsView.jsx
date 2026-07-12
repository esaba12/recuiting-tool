import { useState, useEffect, useMemo, useRef } from 'react'
import { addApplication, updateApplicationTriage } from '../../notion.js'
import { EmptyState } from '../../shared.jsx'
import { BUCKET_CONFIG, BUCKET_ACTIVE, BUCKET_TO_TRIAGE, TRIAGE_TO_BUCKET, lsGet, lsSet, jobId, parseJobDate, isGhostJob } from './helpers.js'
import PreferencesPanel from './PreferencesPanel.jsx'
import JobCard from './JobCard.jsx'
import CalendarView from './CalendarView.jsx'
import JobDetailModal from './JobDetailModal.jsx'
import RepoStats from './RepoStats.jsx'

export default function RepoJobsView({ data, apps, onImported, onClear }) {
  const prefsKey   = 'rec_prefs'

  const [prefs, setPrefsState]  = useState(() => lsGet(prefsKey) || {})
  const [view, setView]         = useState('list')
  const [bucket, setBucket]     = useState('all')
  const [search, setSearch]     = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [hideStale, setHideStale] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [page, setPage]         = useState(1)
  const [optimistic, setOptimistic] = useState({}) // jobKey -> bucket key, overlays Notion state until it refreshes
  const [importState, setImportState] = useState(null) // { done, total } | null
  const PER_PAGE = 30

  // Auto-import: every open (non-closed) listing not already in the Applications DB
  // gets created there with Triage='Needs Review' — hands-off, no per-job clicking.
  // claimedKeys persists across StrictMode's dev-mode double-effect-invocation (and any
  // rapid re-pull of the same repo) so the same job never gets queued for creation twice
  // while an earlier in-flight create for it hasn't landed in `apps` yet.
  const claimedKeysRef = useRef(new Set())
  useEffect(() => {
    let cancelled = false
    const existingKeys = new Set(apps.map(a => jobId({ company: a.company, role: a.role })))
    const newJobs = data.jobs.filter(j =>
      j.status !== 'closed' && !existingKeys.has(jobId(j)) && !claimedKeysRef.current.has(jobId(j)))
    if (newJobs.length === 0) return
    newJobs.forEach(j => claimedKeysRef.current.add(jobId(j)))

    setImportState(s => ({ done: s?.done || 0, total: (s?.total || 0) + newJobs.length }))
    let idx = 0
    async function worker() {
      while (idx < newJobs.length) {
        const job = newJobs[idx++]
        try {
          await addApplication({
            company: job.company, role: job.role, jdLink: job.applyUrl,
            location: job.location, sourceRepo: data.repoName, datePosted: job.dateAdded,
          })
        } catch { claimedKeysRef.current.delete(jobId(job)) /* allow retry on next visit */ }
        if (!cancelled) setImportState(s => s && ({ ...s, done: s.done + 1 }))
      }
    }
    Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      if (!cancelled) { setImportState(null); onImported() }
    })
    return () => { cancelled = true }
  }, [data.jobs])

  const appByKey = useMemo(() =>
    Object.fromEntries(apps.map(a => [jobId({ company: a.company, role: a.role }), a])),
  [apps])

  function statusFor(job) {
    const key = jobId(job)
    if (optimistic[key]) return optimistic[key]
    const app = appByKey[key]
    return app ? (TRIAGE_TO_BUCKET[app.triage] || 'review') : null
  }

  async function updateStatus(job, s) {
    const key = jobId(job)
    const app = appByKey[key]
    if (!app) return // still importing — nothing to patch yet
    const bucketKey = s === null ? 'review' : s
    setOptimistic(o => ({ ...o, [key]: bucketKey }))
    try {
      await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey], app.stage)
      onImported()
    } catch {
      setOptimistic(o => { const n = { ...o }; delete n[key]; return n })
    }
  }

  function updatePrefs(p) {
    setPrefsState(p)
    lsSet(prefsKey, p)
  }

  useEffect(() => setPage(1), [bucket, search, locFilter, selectedDay, hideStale])

  const bucketCounts = Object.fromEntries(
    BUCKET_CONFIG.map(b => [b.key, b.key === 'all' ? data.jobs.length :
      data.jobs.filter(j => statusFor(j) === b.key).length])
  )

  const filtered = data.jobs.filter(j => {
    if (bucket !== 'all' && statusFor(j) !== bucket) return false
    if (hideStale && isGhostJob(j)) return false
    const loc = (j.location || '').toLowerCase()
    if (locFilter && !loc.includes(locFilter.toLowerCase())) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !j.company.toLowerCase().includes(q) &&
        !(j.role || '').toLowerCase().includes(q) &&
        !loc.includes(q)
      ) return false
    }
    if (selectedDay) {
      const [y, m, d] = selectedDay.split('-').map(Number)
      const date = parseJobDate(j.dateAdded)
      if (!date || date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return false
    }
    return true
  })
  // Ghost/stale listings sink to the bottom rather than being removed outright — a false
  // positive during a time-pressured season shouldn't hide a real posting, only deprioritize it.
  // Array.prototype.sort is stable, so within each group the original order is preserved.
  const sorted = hideStale ? filtered : filtered.slice().sort((a, b) => (isGhostJob(a) ? 1 : 0) - (isGhostJob(b) ? 1 : 0))

  const paginated = sorted.slice(0, page * PER_PAGE)

  return (
    <div className="space-y-4">
      {/* Repo header */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-ink-100 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={data.repoUrl} target="_blank" rel="noreferrer"
              className="font-semibold text-ink-900 hover:text-accent-600 text-sm">{data.repoName}</a>
            <span className="text-xs text-ink-400">★ {data.stars?.toLocaleString()}</span>
          </div>
          {data.description && <p className="text-xs text-ink-500 mt-0.5">{data.description}</p>}
          <p className="text-xs text-ink-400 mt-1">
            {data.jobs.length} listings · {bucketCounts.review || 0} need review · {bucketCounts.applying || 0} applying
          </p>
        </div>
        <button onClick={onClear} className="text-xs text-ink-400 hover:text-ink-600 shrink-0">✕</button>
      </div>

      {importState && (
        <div className="bg-accent-50 border border-accent-100 rounded-xl px-4 py-2.5 text-xs text-accent-700 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-accent-400 border-t-transparent rounded-full animate-spin shrink-0" />
          Importing {importState.done}/{importState.total} new job{importState.total !== 1 ? 's' : ''} to your board...
        </div>
      )}

      {/* Stats */}
      <RepoStats jobs={data.jobs} />

      {/* Preferences */}
      <PreferencesPanel prefs={prefs} onChange={updatePrefs} />

      {/* Bucket tabs + view toggle */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {BUCKET_CONFIG.map(b => (
          <button key={b.key} onClick={() => setBucket(b.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
              ${bucket === b.key
                ? (b.key === 'all' ? 'bg-ink-800 text-white border-ink-800' : BUCKET_ACTIVE[b.key] || 'bg-ink-800 text-white border-ink-800')
                : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}>
            {b.icon} {b.label}
            {bucketCounts[b.key] > 0 &&
              <span className="ml-1 opacity-70">{bucketCounts[b.key]}</span>}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {[['list','☰'],['calendar','📅']].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
                ${view === v ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:bg-ink-50'}`}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search company, role, or location..."
              className="w-full pl-8 pr-3 py-2 border border-ink-200 rounded-xl text-xs focus:outline-none focus:border-accent-400 bg-white" />
            <span className="absolute left-2.5 top-2 text-ink-300 text-sm">🔍</span>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-ink-300 hover:text-ink-500 text-xs">✕</button>
            )}
          </div>
          <div className="relative">
            <input value={locFilter} onChange={e => setLocFilter(e.target.value)}
              placeholder="Filter location..."
              className="pl-8 pr-3 py-2 border border-ink-200 rounded-xl text-xs focus:outline-none focus:border-accent-400 bg-white w-44" />
            <span className="absolute left-2.5 top-2 text-ink-300 text-sm">📍</span>
            {locFilter && (
              <button onClick={() => setLocFilter('')} className="absolute right-2.5 top-2 text-ink-300 hover:text-ink-500 text-xs">✕</button>
            )}
          </div>
          <span className="text-xs text-ink-400 shrink-0">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Quick location chips */}
        <div className="flex gap-1.5 flex-wrap">
          {['Remote', 'New York', 'Bay Area', 'Seattle', 'Austin', 'Boston', 'Chicago', 'LA'].map(loc => (
            <button key={loc}
              onClick={() => setLocFilter(locFilter === loc ? '' : loc)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors
                ${locFilter === loc
                  ? 'bg-accent-600 text-white border-accent-600'
                  : 'bg-white text-ink-500 border-ink-200 hover:border-accent-300 hover:text-accent-600'}`}>
              {loc}
            </button>
          ))}
          <button onClick={() => setHideStale(h => !h)}
            title="Hide listings with no detected update in 45+ days"
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ml-auto
              ${hideStale
                ? 'bg-warning-500 text-white border-warning-500'
                : 'bg-white text-ink-500 border-ink-200 hover:border-warning-300 hover:text-warning-700'}`}>
            👻 Hide stale
          </button>
          <button
            onClick={() => { setSearch(''); setLocFilter(''); setHideStale(false) }}
            className="px-2.5 py-1 rounded-full text-xs border border-ink-200 text-ink-400 hover:text-danger-500 hover:border-danger-200 transition-colors">
            Clear all
          </button>
        </div>
      </div>

      {/* Calendar */}
      {view === 'calendar' && (
        <CalendarView jobs={data.jobs} selectedDay={selectedDay} onDaySelect={setSelectedDay} />
      )}

      {/* Job grid */}
      {filtered.length === 0
        ? <EmptyState msg={bucket !== 'all' ? `No jobs in "${BUCKET_CONFIG.find(b => b.key === bucket)?.label}" — bucket jobs from the list to sort them here.` : 'No results.'} />
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {paginated.map((job, i) => (
              <JobCard key={`${job.company}-${i}`} job={job}
                status={statusFor(job)}
                onStatusChange={s => updateStatus(job, s)}
                onClick={() => setSelectedJob(job)} />
            ))}
          </div>
      }

      {paginated.length < filtered.length && (
        <button onClick={() => setPage(p => p + 1)}
          className="w-full py-2.5 text-sm text-ink-500 hover:text-ink-700 border border-ink-200 rounded-xl bg-white hover:bg-ink-50">
          Show more ({filtered.length - paginated.length} remaining)
        </button>
      )}

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          status={statusFor(selectedJob)}
          onStatusChange={s => { updateStatus(selectedJob, s) }}
          onClose={() => setSelectedJob(null)}
          prefs={prefs}
        />
      )}
    </div>
  )
}

