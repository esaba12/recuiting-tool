import { useState, useEffect, useMemo, useRef } from 'react'
import { lsGet, lsSet, timeAgo } from './jobBoards/helpers.js'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { discoverPeople, normUrl } from '../lib/exa.js'
import { dueCompanies, coverageStatus, todayStr } from '../lib/discoveryScheduler.js'
import { rankCandidates, DEFAULT_PROFILE, DEFAULT_WEIGHTS, roleCategory, affinityTagsFor } from '../lib/discovery.js'
import { draftMessage } from '../lib/drafting.js'
import { addContact, updateContact, searchContactByName } from '../notion.js'
import { Badge, EmptyState } from '../shared.jsx'

const PROFILE_KEY    = 'rec_affinity_profile'
const TARGETS_KEY    = 'rec_target_companies' // shared with ReferralCoverageTab
const DISCOVERED_KEY = 'rec_discovered'        // { [companyKey]: rankedCandidate[] }
const DISMISSED_KEY  = 'rec_discovered_dismissed' // string[] of candidate keys
const ADDED_KEY      = 'rec_discovered_added'      // string[] of candidate keys
const META_KEY       = 'rec_discovery_meta'        // { lastCheck, perCompany: { [key]: { lastRun, resultHash, count } } }
const SETTINGS_KEY   = 'rec_discovery_settings'    // { cooldownDays, dailyBudget }

const DEFAULT_SETTINGS = { cooldownDays: 7, dailyBudget: 3 }
const CONCURRENCY = 3

// Broad-but-ranked scope (user decision): cast wide across roles, let discoveryScore sort.
const DISCOVER_ROLES = ['software engineer', 'engineering manager', 'technical recruiter', 'product manager']

const candKey = (company, name) => `${normalizeCompanyName(company)}::${(name || '').toLowerCase()}`
const parseList = s => [...new Set((s || '').split(/[\n,]/).map(x => x.trim()).filter(Boolean))]

// Contacts Role select value that best fits a discovered person's role category.
const ROLE_FOR_CATEGORY = { engineer: 'SWE', manager: 'SWE', pm: 'PM', recruiter: 'Recruiter', leader: 'Other', other: 'Other' }

// Personalization seed for a cold-open draft — the shared résumé signals, not the
// scoring meta-reasons ("Reachable engineer", "First contact...").
function personalizationSeed(person, reasons) {
  const signal = reasons.filter(r => !/(Reachable|reply odds|First contact|new angle|already know|Already in)/i.test(r))
  return signal.join('; ') || `They're ${person.title || 'on the team'} at ${person.company}`
}

export default function DiscoverTab({ contacts, apps, interactions, onRefresh, focus }) {
  const [profile, setProfile]     = useState(() => ({ ...DEFAULT_PROFILE, ...(lsGet(PROFILE_KEY) || {}), weights: { ...DEFAULT_WEIGHTS, ...(lsGet(PROFILE_KEY)?.weights || {}) } }))
  const [editingProfile, setEditingProfile] = useState(false)
  const [targets]                 = useState(() => lsGet(TARGETS_KEY) || [])
  const [discovered, setDiscovered] = useState(() => lsGet(DISCOVERED_KEY) || {})
  const [dismissed, setDismissed] = useState(() => new Set(lsGet(DISMISSED_KEY) || []))
  const [added, setAdded]         = useState(() => new Set(lsGet(ADDED_KEY) || []))
  const [meta, setMeta]           = useState(() => lsGet(META_KEY) || { lastCheck: null, perCompany: {} })
  const [settings, setSettings]   = useState(() => ({ ...DEFAULT_SETTINGS, ...(lsGet(SETTINGS_KEY) || {}) }))
  const [view, setView]           = useState('recommended') // 'recommended' | 'byCompany'
  const [showSettings, setShowSettings] = useState(false)
  const [loadingCompany, setLoadingCompany] = useState(null)
  const [errorFor, setErrorFor]   = useState({})
  const [running, setRunning]     = useState(false)
  const [progress, setProgress]   = useState(null) // { done, total } during a background run
  const [newCount, setNewCount]   = useState(null) // people found on the last run
  const ranRef = useRef(false)     // guard the once-per-mount background kick
  const rowRefs = useRef(new Map()) // company key → row DOM node, for the Coverage deep-link scroll

  function persistDiscovered(next) { setDiscovered(next); lsSet(DISCOVERED_KEY, next) }
  function persistMeta(next) { setMeta(next); lsSet(META_KEY, next) }
  function saveProfile(next) { setProfile(next); lsSet(PROFILE_KEY, next); setEditingProfile(false) }
  function saveSettings(next) { setSettings(next); lsSet(SETTINGS_KEY, next) }
  function dismiss(key) {
    const next = new Set(dismissed); next.add(key); setDismissed(next); lsSet(DISMISSED_KEY, [...next])
  }
  function markAdded(key) {
    const next = new Set(added); next.add(key); setAdded(next); lsSet(ADDED_KEY, [...next])
  }

  const contactsAt = (company) => {
    const key = normalizeCompanyName(company)
    return contacts.filter(c => c.company?.trim() && normalizeCompanyName(c.company) === key)
  }

  // Profile URLs we already have as contacts — dropped before Claude extraction so we never
  // spend tokens re-structuring people already in the CRM (token minimization).
  const knownUrls = useMemo(
    () => new Set(contacts.map(c => c.linkedin).filter(Boolean).map(normUrl)),
    [contacts],
  )

  const isLive = (c) => !c.isDuplicate
    && !dismissed.has(candKey(c.person.company, c.person.name))
    && !added.has(candKey(c.person.company, c.person.name))

  // Runs the scheduler over the due companies. force=true (manual "Refresh now") ignores the
  // per-company cooldown + daily budget so the whole list can re-scan on demand.
  async function runScheduler({ force = false } = {}) {
    if (running || !targets.length) return
    const due = dueCompanies(targets, contacts, apps, interactions, meta, {
      cooldownDays: force ? 0 : settings.cooldownDays,
      dailyBudget: force ? targets.length : settings.dailyBudget,
    })
    if (!due.length) { persistMeta({ ...meta, lastCheck: todayStr() }); setNewCount(0); return }

    setRunning(true); setProgress({ done: 0, total: due.length }); setNewCount(null)
    const nextDiscovered = { ...discovered }
    const nextPerCompany = { ...(meta.perCompany || {}) }
    let found = 0
    const queue = [...due]

    async function worker() {
      while (queue.length) {
        const item = queue.shift()
        try {
          const { people, resultHash, skippedExtraction } = await discoverPeople({
            company: item.company, roles: DISCOVER_ROLES, profile,
            priorResultHash: item.priorResultHash, knownUrls,
          })
          if (!skippedExtraction && people) {
            const ranked = rankCandidates(people, profile, contactsAt(item.company))
            nextDiscovered[item.key] = ranked
            found += ranked.filter(isLive).length
          }
          nextPerCompany[item.key] = { lastRun: Date.now(), resultHash, count: (nextDiscovered[item.key] || []).length }
        } catch (e) {
          setErrorFor(prev => ({ ...prev, [item.company]: e.message }))
        } finally {
          setProgress(p => ({ done: (p?.done || 0) + 1, total: due.length }))
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    persistDiscovered(nextDiscovered)
    persistMeta({ lastCheck: todayStr(), perCompany: nextPerCompany })
    setNewCount(found); setRunning(false); setProgress(null)
  }

  // Hands-off daily gate: on first mount, if we haven't checked today, quietly refresh the
  // highest-priority due companies in the background. The cooldown/budget inside the
  // scheduler keep this cheap even though the *check* happens every day.
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (targets.length && meta.lastCheck !== todayStr()) runScheduler({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Manual per-company search (By company view) — still respects the resultHash skip.
  async function findPeople(company) {
    setLoadingCompany(company); setErrorFor(e => ({ ...e, [company]: null }))
    try {
      const key = normalizeCompanyName(company)
      const prior = meta.perCompany?.[key]?.resultHash || null
      const { people, resultHash, skippedExtraction } = await discoverPeople({ company, roles: DISCOVER_ROLES, profile, priorResultHash: prior, knownUrls })
      const nextDiscovered = (!skippedExtraction && people)
        ? { ...discovered, [key]: rankCandidates(people, profile, contactsAt(company)) }
        : discovered
      if (nextDiscovered !== discovered) persistDiscovered(nextDiscovered)
      persistMeta({ ...meta, perCompany: { ...(meta.perCompany || {}), [key]: { lastRun: Date.now(), resultHash, count: (nextDiscovered[key] || []).length } } })
    } catch (e) {
      setErrorFor(prev => ({ ...prev, [company]: e.message }))
    } finally {
      setLoadingCompany(null)
    }
  }

  // Deep-link from Coverage's "🔍 Find people" button — jump to By company, run a ranked
  // search for that one company if it hasn't been searched yet, and scroll its row into
  // view. `ts` (not just company) is in the dep array so re-clicking the same company from
  // Coverage re-triggers this even though the string itself didn't change.
  useEffect(() => {
    if (!focus) return
    setView('byCompany')
    const key = normalizeCompanyName(focus.company)
    if (!discovered[key]) findPeople(focus.company)
    const el = rowRefs.current.get(key)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.ts])

  // Applied-to company keys — used to nudge prospects at companies you're pursuing up the list.
  const appliedKeys = useMemo(
    () => new Set(apps.filter(a => a.company?.trim() && a.stage !== 'Rejected').map(a => normalizeCompanyName(a.company))),
    [apps],
  )

  // "Recommended for you" — every live candidate across all companies, best first, with
  // applied-to companies breaking ties upward.
  const recommended = Object.values(discovered)
    .flat()
    .filter(isLive)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aApp = appliedKeys.has(normalizeCompanyName(a.person.company)) ? 1 : 0
      const bApp = appliedKeys.has(normalizeCompanyName(b.person.company)) ? 1 : 0
      return bApp - aApp
    })

  // By-company rows: gaps first (coverage), then covered.
  const rows = targets
    .map(company => {
      const status = coverageStatus(company, contacts, interactions)
      return { company, status, ranked: discovered[normalizeCompanyName(company)] || null, matchedCount: contactsAt(company).length }
    })
    .sort((a, b) => ({ gap: 0, weak: 1, strong: 2 }[a.status]) - ({ gap: 0, weak: 1, strong: 2 }[b.status]))

  const lastRunMs = Math.max(0, ...Object.values(meta.perCompany || {}).map(v => v.lastRun || 0))
  const cardProps = (c) => ({
    cand: c, profile,
    isAdded: added.has(candKey(c.person.company, c.person.name)),
    onDismiss: () => dismiss(candKey(c.person.company, c.person.name)),
    onAdded: () => { markAdded(candKey(c.person.company, c.person.name)); onRefresh() },
  })

  return (
    <div className="space-y-4">
      <ProfilePanel profile={profile} open={editingProfile} onToggle={() => setEditingProfile(o => !o)} onSave={saveProfile} />

      {/* Compliance note — the boundary is explicit, per plan guardrails. */}
      <p className="text-[11px] text-ink-400">
        People are surfaced from Exa's public-web search index. This never scrapes or logs into LinkedIn —
        LinkedIn links are references Exa found on the open web. Nothing is written to your CRM until you approve it.
      </p>

      {targets.length === 0 ? (
        <EmptyState msg="Add a target-company list in Network → Coverage first — Discover uses the same list." />
      ) : (
        <>
          {/* Header: view switch + status + manual refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
              {[['recommended', `✨ Recommended${recommended.length ? ` (${recommended.length})` : ''}`], ['byCompany', 'By company']].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                  className={`px-3 py-1 transition-colors ${view === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-ink-400">
                {running ? `Searching ${progress?.done ?? 0}/${progress?.total ?? '…'}…` : lastRunMs ? `Updated ${timeAgo(new Date(lastRunMs).toISOString())}` : 'Not run yet'}
              </span>
              <button onClick={() => runScheduler({ force: true })} disabled={running}
                className="px-3 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300 disabled:opacity-40">
                ↻ Refresh now
              </button>
              <button onClick={() => setShowSettings(s => !s)}
                className="px-2 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-400 hover:border-accent-300">⚙</button>
            </div>
          </div>

          {newCount != null && !running && (
            <p className="text-xs text-accent-700 font-medium">
              {newCount > 0 ? `✨ ${newCount} new ${newCount === 1 ? 'person' : 'people'} found.` : 'No new people this refresh — you’re caught up.'}
            </p>
          )}

          {showSettings && (
            <div className="flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-3 text-xs">
              <span className="text-ink-500">Hands-off refresh runs daily, but each company is only re-searched on a cooldown.</span>
              <label className="flex items-center gap-1.5 ml-auto">Cooldown (days)
                <input type="number" min="1" value={settings.cooldownDays}
                  onChange={e => saveSettings({ ...settings, cooldownDays: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-14 px-2 py-1 border border-ink-200 rounded-lg" />
              </label>
              <label className="flex items-center gap-1.5">Companies/day
                <input type="number" min="1" value={settings.dailyBudget}
                  onChange={e => saveSettings({ ...settings, dailyBudget: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-14 px-2 py-1 border border-ink-200 rounded-lg" />
              </label>
            </div>
          )}

          {view === 'recommended' ? (
            <div className="space-y-2">
              {recommended.length === 0
                ? <EmptyState msg={running ? 'Looking for people…' : 'No recommendations yet — hit “Refresh now” to search your gap companies.'} />
                : recommended.map(c => <CandidateCard key={candKey(c.person.company, c.person.name)} showCompany {...cardProps(c)} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(r => {
                const live = (r.ranked || []).filter(isLive)
                return (
                  <div key={r.company} ref={el => { if (el) rowRefs.current.set(normalizeCompanyName(r.company), el) }}
                    className={`bg-white rounded-xl p-4 shadow-sm border transition-shadow ${focus && normalizeCompanyName(focus.company) === normalizeCompanyName(r.company) ? 'ring-2 ring-accent-300' : ''} ${r.status === 'gap' ? 'border-danger-200' : r.status === 'weak' ? 'border-warning-200' : 'border-ink-100'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{r.company}</span>
                        {r.status === 'gap'
                          ? <Badge label="No contact yet" color="bg-danger-100 text-danger-700" />
                          : r.status === 'weak'
                          ? <Badge label={`${r.matchedCount} contact${r.matchedCount !== 1 ? 's' : ''} · weak — find the next`} color="bg-warning-100 text-warning-800" />
                          : <Badge label={`${r.matchedCount} contact${r.matchedCount !== 1 ? 's' : ''}`} color="bg-success-100 text-success-800" />}
                      </div>
                      <button onClick={() => findPeople(r.company)} disabled={loadingCompany === r.company}
                        className="shrink-0 px-3 py-1.5 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700 disabled:opacity-40">
                        {loadingCompany === r.company ? 'Searching…' : r.ranked ? '↻ Re-run' : '🔍 Find people'}
                      </button>
                    </div>
                    {errorFor[r.company] && (
                      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{errorFor[r.company]}</div>
                    )}
                    {r.ranked && (
                      <div className="mt-3 space-y-2">
                        {live.length === 0
                          ? <p className="text-xs text-ink-400">No new people to surface — try Re-run or widen your target roles.</p>
                          : live.map(c => <CandidateCard key={candKey(c.person.company, c.person.name)} {...cardProps(c)} />)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Candidate card ──────────────────────────────────────────────────────────────
function CandidateCard({ cand, profile, showCompany, isAdded, onDismiss, onAdded }) {
  const { person, score, reasons } = cand
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState(null)
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftErr, setDraftErr] = useState(null)
  const [genning, setGenning] = useState(false)

  async function addToContacts() {
    setAdding(true); setAddErr(null)
    try {
      // Coarse dedup: a same-company contact whose name already matches.
      const existing = await searchContactByName(person.name)
      const existingCompany = existing?.properties?.Company?.rich_text?.[0]?.plain_text || ''
      if (existing && normalizeCompanyName(existingCompany) === normalizeCompanyName(person.company || '')) {
        setAddErr('Looks like this person is already in your contacts.')
        onAdded() // mark added so the card collapses out
        return
      }
      const cat = roleCategory(person.title)
      const page = await addContact({ name: person.name, company: person.company, role: ROLE_FOR_CATEGORY[cat] || 'Other' })
      const { tags, isUMichAlum } = affinityTagsFor(person, profile)
      await updateContact(page.id, {
        status: '🔴 Cold',
        ...(person.linkedinUrl ? { linkedin: person.linkedinUrl } : {}),
        ...(tags.length ? { affinity: tags } : {}),
        ...(isUMichAlum ? { isUMichAlum: true } : {}),
      })
      onAdded()
    } catch (e) {
      setAddErr(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function generateDraft() {
    setGenning(true); setDraftErr(null)
    try {
      const res = await draftMessage({
        contact: { name: person.name, company: person.company, role: person.title },
        kind: 'cold_open',
        personalizationContext: personalizationSeed(person, reasons),
      })
      setDraft(res.draft || '')
    } catch (e) {
      setDraftErr(e.message)
    } finally {
      setGenning(false)
    }
  }

  const scoreColor = score >= 5 ? 'bg-success-100 text-success-800' : score >= 2 ? 'bg-accent-100 text-accent-700' : 'bg-ink-100 text-ink-600'

  return (
    <div className="border border-ink-100 rounded-lg p-3 bg-ink-50/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink-900">{person.name}</span>
            <Badge label={`score ${Number.isFinite(score) ? score.toFixed(1) : '—'}`} color={scoreColor} />
            {isAdded && <Badge label="✓ Added" color="bg-success-100 text-success-800" />}
          </div>
          <p className="text-xs text-ink-500 mt-0.5">
            {person.title || 'Unknown role'}{showCompany && person.company ? ` · ${person.company}` : ''}
            {person.school ? ` · ${person.school}` : ''}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reasons.slice(0, 5).map((rr, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white border border-ink-200 text-ink-500">{rr}</span>
            ))}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {person.linkedinUrl && (
            <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-500 hover:underline">LinkedIn ↗</a>
          )}
          {!isAdded && (
            <button onClick={addToContacts} disabled={adding}
              className="px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700 disabled:opacity-40">
              {adding ? 'Adding…' : '+ Add to Contacts'}
            </button>
          )}
          <div className="flex gap-1.5">
            <button onClick={() => setDrafting(d => !d)}
              className="px-2.5 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
              {drafting ? 'Hide' : '✎ Draft intro'}
            </button>
            <button onClick={onDismiss}
              className="px-2 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-400 hover:border-danger-300 hover:text-danger-600">✕</button>
          </div>
        </div>
      </div>

      {addErr && <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{addErr}</div>}

      {drafting && (
        <div className="mt-2 bg-white border border-accent-100 rounded-lg p-3">
          <p className="text-[11px] text-ink-400 mb-1.5">Personalized on: {personalizationSeed(person, reasons)}</p>
          {draftErr && <div className="p-2 mb-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{draftErr}</div>}
          {draft
            ? <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
                className="w-full px-2.5 py-1.5 border border-accent-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
            : <button onClick={generateDraft} disabled={genning}
                className="w-full py-2 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 disabled:opacity-40 font-medium">
                {genning ? 'Drafting…' : 'Generate intro →'}
              </button>}
          {draft && (
            <div className="flex gap-2 mt-2">
              <button onClick={generateDraft} disabled={genning}
                className="px-3 py-1.5 bg-white border border-accent-200 rounded-lg text-xs font-medium text-accent-700 hover:border-accent-400 disabled:opacity-40">
                {genning ? 'Regenerating…' : 'Regenerate'}
              </button>
              <button onClick={() => navigator.clipboard.writeText(draft)}
                className="px-3 py-1.5 bg-accent-600 text-white rounded-lg text-xs font-medium hover:bg-accent-700">Copy</button>
            </div>
          )}
          <p className="text-[11px] text-ink-400 mt-2">Tip: “+ Add to Contacts” first if you want the draft saved to their Notion record.</p>
        </div>
      )}
    </div>
  )
}

// ── Affinity profile editor ──────────────────────────────────────────────────────
function ProfilePanel({ profile, open, onToggle, onSave }) {
  const [uni, setUni]           = useState(profile.university || '')
  const [grad, setGrad]         = useState(profile.gradYear || '')
  const [employers, setEmployers] = useState((profile.pastEmployers || []).join('\n'))
  const [programs, setPrograms] = useState((profile.programs || []).join('\n'))
  const [hometown, setHometown] = useState(profile.hometown || '')
  const [highSchool, setHighSchool] = useState(profile.highSchool || '')
  const [weights, setWeights]   = useState({ ...DEFAULT_WEIGHTS, ...(profile.weights || {}) })

  function save() {
    onSave({
      university: uni.trim(),
      gradYear: Number(grad) || undefined,
      pastEmployers: parseList(employers),
      programs: parseList(programs),
      hometown: hometown.trim(),
      highSchool: highSchool.trim(),
      skills: profile.skills || [],
      weights,
    })
  }

  const WEIGHT_FIELDS = [
    ['pastEmployer', 'Past employer'],
    ['program', 'Program / club'],
    ['university', 'University'],
    ['hometown', 'Hometown / HS'],
  ]

  return (
    <div className="rounded-xl border border-accent-100 bg-gradient-to-r from-accent-50 to-indigo-50 overflow-hidden">
      <button onClick={onToggle} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-accent-800">
        <span>🧭 Your background signals {profile.pastEmployers?.length || profile.programs?.length ? `· ${(profile.pastEmployers?.length || 0) + (profile.programs?.length || 0)} set` : '· click to set up'}</span>
        <span className="text-accent-400 text-xs">{open ? '▲ collapse' : '▼ edit'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-xs text-accent-700">These drive the warm-tie ranking. Weights default to your priority: past employers &gt; programs &gt; university &gt; hometown.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="University"><input value={uni} onChange={e => setUni(e.target.value)} className={inputCls} /></Field>
            <Field label="Grad year"><input value={grad} onChange={e => setGrad(e.target.value)} className={inputCls} /></Field>
            <Field label="Past employers / internships (one per line)"><textarea value={employers} onChange={e => setEmployers(e.target.value)} rows={3} className={inputCls + ' resize-none font-mono'} placeholder={'Google\nJane Street'} /></Field>
            <Field label="Programs / clubs / fellowships (one per line)"><textarea value={programs} onChange={e => setPrograms(e.target.value)} rows={3} className={inputCls + ' resize-none font-mono'} placeholder={'MHacks\nCodePath'} /></Field>
            <Field label="Hometown"><input value={hometown} onChange={e => setHometown(e.target.value)} className={inputCls} /></Field>
            <Field label="High school"><input value={highSchool} onChange={e => setHighSchool(e.target.value)} className={inputCls} /></Field>
          </div>
          <div>
            <label className="block text-xs text-accent-600 mb-1">Signal weights</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEIGHT_FIELDS.map(([k, label]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-ink-500 flex-1">{label}</span>
                  <input type="number" value={weights[k]} onChange={e => setWeights(w => ({ ...w, [k]: Number(e.target.value) }))}
                    className="w-14 px-2 py-1 border border-accent-200 rounded-lg text-xs bg-white focus:outline-none focus:border-accent-400" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={save} className="px-4 py-1.5 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 font-medium">Save profile</button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-accent-200 rounded-lg text-sm bg-white focus:outline-none focus:border-accent-400'
function Field({ label, children }) {
  return <div><label className="block text-xs text-accent-600 mb-0.5">{label}</label>{children}</div>
}
