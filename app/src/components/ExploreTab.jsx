import { useState, useEffect, useMemo, useRef } from 'react'
import { lsGet, lsSet, timeAgo } from './jobBoards/helpers.js'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { todayStr } from '../lib/discoveryScheduler.js'
import { findCompanies, moreLikeThis, prefsFromRecPrefs } from '../lib/companyFinder.js'
import { Badge, EmptyState } from '../shared.jsx'
import CompanyOnboarding from './CompanyOnboarding.jsx'

const PREFS_KEY     = 'rec_company_prefs'
const RESULTS_KEY   = 'rec_company_results'
const META_KEY      = 'rec_company_meta'
const ADDED_KEY     = 'rec_company_added'
const DISMISSED_KEY = 'rec_company_dismissed'
const TARGETS_KEY   = 'rec_target_companies' // shared with ReferralCoverageTab + DiscoverTab

export default function ExploreTab({ apps = [], onFindPeople }) {
  const [prefs, setPrefs]         = useState(() => lsGet(PREFS_KEY))
  const [editing, setEditing]     = useState(() => !lsGet(PREFS_KEY)?.saved)
  const [companies, setCompanies] = useState(() => lsGet(RESULTS_KEY) || [])
  const [meta, setMeta]           = useState(() => lsGet(META_KEY) || { lastCheck: null, resultHash: null })
  const [added, setAdded]         = useState(() => new Set(lsGet(ADDED_KEY) || []))
  const [dismissed, setDismissed] = useState(() => new Set(lsGet(DISMISSED_KEY) || []))
  const [running, setRunning]     = useState(false)
  const [newCount, setNewCount]   = useState(null)
  const [error, setError]         = useState(null)
  const [expanding, setExpanding] = useState(null)
  const ranRef = useRef(false)

  function persistCompanies(next) { setCompanies(next); lsSet(RESULTS_KEY, next) }
  function persistMeta(next) { setMeta(next); lsSet(META_KEY, next) }

  const nameKey = (c) => normalizeCompanyName(c.name || '')
  const appNames  = useMemo(() => apps.filter(a => a.company?.trim()).map(a => normalizeCompanyName(a.company)), [apps])

  function excludeNames() {
    const targets = (lsGet(TARGETS_KEY) || []).map(normalizeCompanyName)
    return [...new Set([...targets, ...appNames, ...[...added].map(normalizeCompanyName), ...[...dismissed].map(normalizeCompanyName)])]
  }

  async function runFind({ force = false } = {}) {
    if (running || !prefs?.saved) return
    setRunning(true); setError(null); setNewCount(null)
    try {
      const res = await findCompanies({ prefs, excludeNames: excludeNames(), priorResultHash: force ? null : meta.resultHash })
      if (res.skipped) {
        persistMeta({ lastCheck: todayStr(), lastRun: Date.now(), resultHash: res.resultHash })
        setNewCount(0)
      } else {
        const fresh = (res.companies || []).filter(c => !dismissed.has(c.name))
        persistCompanies(fresh)
        persistMeta({ lastCheck: todayStr(), lastRun: Date.now(), resultHash: res.resultHash })
        setNewCount(fresh.length)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  // Hands-off daily gate (mirrors Discover): refresh once/day in the background on open.
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (prefs?.saved && meta.lastCheck !== todayStr()) runFind({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveOnboarding(next) {
    setPrefs(next); lsSet(PREFS_KEY, next); setEditing(false)
    // Fresh interests → force a re-rank now (ignore the daily gate & cache).
    setTimeout(() => runFindWith(next), 0)
  }
  async function runFindWith(p) {
    setRunning(true); setError(null); setNewCount(null)
    try {
      const res = await findCompanies({ prefs: p, excludeNames: excludeNames(), priorResultHash: null })
      const fresh = (res.companies || []).filter(c => !dismissed.has(c.name))
      persistCompanies(fresh); persistMeta({ lastCheck: todayStr(), lastRun: Date.now(), resultHash: res.resultHash }); setNewCount(fresh.length)
    } catch (e) { setError(e.message) } finally { setRunning(false) }
  }

  function addToTargets(name) {
    const targets = lsGet(TARGETS_KEY) || []
    if (!targets.some(t => normalizeCompanyName(t) === normalizeCompanyName(name))) {
      lsSet(TARGETS_KEY, [...targets, name])
    }
    const next = new Set(added); next.add(name); setAdded(next); lsSet(ADDED_KEY, [...next])
  }
  function dismiss(name) {
    const next = new Set(dismissed); next.add(name); setDismissed(next); lsSet(DISMISSED_KEY, [...next])
    persistCompanies(companies.filter(c => c.name !== name))
  }
  async function expand(company) {
    if (!company.website) return
    setExpanding(company.name)
    try {
      const sims = await moreLikeThis({ website: company.website, prefs, excludeNames: [...excludeNames(), ...companies.map(nameKey)] })
      const have = new Set(companies.map(nameKey))
      const add = (sims || []).filter(c => !have.has(nameKey(c)) && !dismissed.has(c.name))
      if (add.length) persistCompanies([...companies, ...add])
    } catch (e) { setError(e.message) } finally { setExpanding(null) }
  }

  if (editing || !prefs?.saved) {
    return <CompanyOnboarding initial={prefs || prefsFromRecPrefs(lsGet('rec_prefs') || {})} onSave={saveOnboarding} onCancel={prefs?.saved ? () => setEditing(false) : null} />
  }

  const shown = companies.filter(c => !dismissed.has(c.name))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink-900">Companies for you</h2>
          <p className="text-[11px] text-ink-400">
            From YC's directory + Exa's public-web search, ranked for you. Add one and it flows into Coverage & Discover.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-ink-400">
            {running ? 'Searching…' : meta.lastRun ? `Updated ${timeAgo(new Date(meta.lastRun).toISOString())}` : 'Not run yet'}
          </span>
          <button onClick={() => runFind({ force: true })} disabled={running}
            className="px-3 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300 disabled:opacity-40">↻ Refresh</button>
          <button onClick={() => setEditing(true)}
            className="px-3 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">Edit interests</button>
        </div>
      </div>

      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}
      {newCount != null && !running && (
        <p className="text-xs text-accent-700 font-medium">
          {newCount > 0 ? `✨ ${newCount} compan${newCount === 1 ? 'y' : 'ies'} match your interests.` : 'No new matches this refresh — you’re caught up.'}
        </p>
      )}

      {shown.length === 0
        ? <EmptyState msg={running ? 'Finding companies you’ll like…' : 'No companies yet — hit ↻ Refresh, or edit your interests.'} />
        : (
          <div className="space-y-2">
            {shown.map((c, i) => (
              <CompanyCard key={c.name} company={c} index={i}
                isAdded={added.has(c.name)}
                onAdd={() => addToTargets(c.name)}
                onDismiss={() => dismiss(c.name)}
                onExpand={() => expand(c)}
                expanding={expanding === c.name}
                onFindPeople={onFindPeople} />
            ))}
          </div>
        )}
    </div>
  )
}

// ── Company card ─────────────────────────────────────────────────────────────────
function withProtocol(url) { return url.startsWith('http') ? url : `https://${url}` }

function CompanyCard({ company: c, index, isAdded, onAdd, onDismiss, onExpand, expanding, onFindPeople }) {
  const scoreColor = c.fitScore >= 8 ? 'bg-success-100 text-success-800' : c.fitScore >= 5 ? 'bg-accent-100 text-accent-700' : 'bg-ink-100 text-ink-600'
  const openSite = () => { if (c.website) window.open(withProtocol(c.website), '_blank', 'noopener,noreferrer') }
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(e) }
  return (
    <div onClick={c.website ? openSite : undefined}
      className={`bg-white rounded-xl p-4 shadow-sm border border-ink-100 transition-colors ${c.website ? 'cursor-pointer hover:border-accent-300 hover:shadow-md' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {c.website
              ? <a href={withProtocol(c.website)} target="_blank" rel="noreferrer" onClick={stop()}
                  className="font-semibold text-ink-900 hover:text-accent-600 hover:underline">{c.name}</a>
              : <span className="font-semibold text-ink-900">{c.name}</span>}
            {Number.isFinite(c.fitScore) && <Badge label={`fit ${c.fitScore}/10`} color={scoreColor} />}
            {isAdded && <Badge label="✓ In targets" color="bg-success-100 text-success-800" />}
          </div>
          {c.oneLiner && <p className="text-xs text-ink-500 mt-0.5">{c.oneLiner}</p>}
          {c.whyFit && <p className="text-xs text-ink-700 mt-1.5"><span className="text-accent-600 font-medium">Why you: </span>{c.whyFit}</p>}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {c.domain && <Badge label={c.domain} color="bg-indigo-50 text-indigo-600" />}
            {c.stage && <Badge label={c.stage} color="bg-ink-100 text-ink-600" />}
            {(c.badges || []).slice(0, 3).map((b, k) => <Badge key={k} label={b} color="bg-accent-50 text-accent-700" />)}
            {index < 6 && <span onClick={stop()}><GhBadge website={c.website} name={c.name} /></span>}
            {c.website && <a href={withProtocol(c.website)} target="_blank" rel="noreferrer" onClick={stop()} className="text-[11px] text-accent-500 hover:underline">Site ↗</a>}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5" onClick={stop()}>
          {isAdded
            ? <button onClick={() => onFindPeople(c.name)} className="px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">Find people →</button>
            : <button onClick={onAdd} className="px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">❤ Add to targets</button>}
          <div className="flex gap-1.5">
            <button onClick={onExpand} disabled={expanding || !c.website}
              className="px-2.5 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300 disabled:opacity-40">
              {expanding ? '…' : '🔎 More like this'}
            </button>
            <button onClick={onDismiss}
              className="px-2 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-400 hover:border-danger-300 hover:text-danger-600">✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Lazy, best-effort GitHub eng-signal badge ──────────────────────────────────────
// Resolves a plausible GitHub org from the company's domain and shows a public-repo count
// ONLY when it can confirm the org actually belongs to the company (blog/name match) — a
// wrong-but-plausible org would be misinformation, so it stays hidden when unsure.
const ghCache = new Map()

function hostOf(url) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return '' }
}

function GhBadge({ website, name }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    const host = hostOf(website)
    const slug = host ? host.split('.')[0] : ''
    if (!slug) return
    let cancelled = false
    ;(async () => {
      if (ghCache.has(slug)) { if (!cancelled) setInfo(ghCache.get(slug)); return }
      let result = null
      try {
        const res = await fetch(`/gh-api/orgs/${slug}`)
        if (res.ok) {
          const org = await res.json()
          const blogHost = hostOf(org.blog || '')
          const nameTokens = (name || '').toLowerCase().split(/\W+/).filter(t => t.length > 3)
          const plausible =
            (blogHost && host && blogHost.split('.')[0] === host.split('.')[0]) ||
            (org.name && nameTokens.some(t => org.name.toLowerCase().includes(t)))
          if (plausible && org.public_repos > 0) result = { login: org.login, repos: org.public_repos }
        }
      } catch { /* best-effort */ }
      ghCache.set(slug, result)
      if (!cancelled) setInfo(result)
    })()
    return () => { cancelled = true }
  }, [website, name])

  if (!info) return null
  return (
    <a href={`https://github.com/${info.login}`} target="_blank" rel="noreferrer"
      className="text-[11px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-600 hover:bg-ink-200">🛠 {info.repos} repos</a>
  )
}
