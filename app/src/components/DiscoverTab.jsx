import { useState } from 'react'
import { lsGet, lsSet } from './jobBoards/helpers.js'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { discoverPeople } from '../lib/exa.js'
import { rankCandidates, DEFAULT_PROFILE, DEFAULT_WEIGHTS, roleCategory, affinityTagsFor } from '../lib/discovery.js'
import { draftMessage } from '../lib/drafting.js'
import { addContact, updateContact, searchContactByName } from '../notion.js'
import { Badge, EmptyState } from '../shared.jsx'

const PROFILE_KEY   = 'rec_affinity_profile'
const TARGETS_KEY   = 'rec_target_companies' // shared with ReferralCoverageTab
const DISCOVERED_KEY = 'rec_discovered'        // { [companyKey]: rankedCandidate[] }
const DISMISSED_KEY  = 'rec_discovered_dismissed' // string[] of candidate keys
const ADDED_KEY      = 'rec_discovered_added'      // string[] of candidate keys

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

export default function DiscoverTab({ contacts, apps, interactions, onRefresh }) {
  const [profile, setProfile]     = useState(() => ({ ...DEFAULT_PROFILE, ...(lsGet(PROFILE_KEY) || {}), weights: { ...DEFAULT_WEIGHTS, ...(lsGet(PROFILE_KEY)?.weights || {}) } }))
  const [editingProfile, setEditingProfile] = useState(() => !lsGet(PROFILE_KEY))
  const [targets]                 = useState(() => lsGet(TARGETS_KEY) || [])
  const [discovered, setDiscovered] = useState(() => lsGet(DISCOVERED_KEY) || {})
  const [dismissed, setDismissed] = useState(() => new Set(lsGet(DISMISSED_KEY) || []))
  const [added, setAdded]         = useState(() => new Set(lsGet(ADDED_KEY) || []))
  const [loadingCompany, setLoadingCompany] = useState(null)
  const [errorFor, setErrorFor]   = useState({})
  const [view, setView]           = useState('byCompany') // 'byCompany' | 'top'

  function saveProfile(next) {
    setProfile(next); lsSet(PROFILE_KEY, next); setEditingProfile(false)
  }
  function persistDiscovered(next) { setDiscovered(next); lsSet(DISCOVERED_KEY, next) }
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

  async function findPeople(company) {
    setLoadingCompany(company); setErrorFor(e => ({ ...e, [company]: null }))
    try {
      const people = await discoverPeople({ company, roles: DISCOVER_ROLES, profile })
      const ranked = rankCandidates(people, profile, contactsAt(company))
      persistDiscovered({ ...discovered, [normalizeCompanyName(company)]: ranked })
    } catch (e) {
      setErrorFor(prev => ({ ...prev, [company]: e.message }))
    } finally {
      setLoadingCompany(null)
    }
  }

  // Company rows: gaps first, same coverage logic as ReferralCoverageTab.
  const rows = targets
    .map(company => {
      const matched = contactsAt(company)
      const ranked = discovered[normalizeCompanyName(company)] || null
      return { company, matchedCount: matched.length, ranked, status: matched.length === 0 ? 'gap' : 'covered' }
    })
    .sort((a, b) => ({ gap: 0, covered: 1 }[a.status]) - ({ gap: 0, covered: 1 }[b.status]))

  // Global "top prospects" — every ranked, non-dismissed, non-duplicate candidate, best first.
  const topProspects = Object.entries(discovered)
    .flatMap(([, ranked]) => ranked)
    .filter(c => !c.isDuplicate && !dismissed.has(candKey(c.person.company, c.person.name)))
    .sort((a, b) => b.score - a.score)

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
          <div className="flex items-center gap-2">
            <div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
              {[['byCompany', 'By company'], ['top', `Top prospects${topProspects.length ? ` (${topProspects.length})` : ''}`]].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                  className={`px-3 py-1 transition-colors ${view === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {view === 'byCompany' ? (
            <div className="space-y-3">
              {rows.map(r => (
                <div key={r.company} className={`bg-white rounded-xl p-4 shadow-sm border ${r.status === 'gap' ? 'border-danger-200' : 'border-ink-100'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink-900">{r.company}</span>
                      {r.status === 'gap'
                        ? <Badge label="No contact yet" color="bg-danger-100 text-danger-700" />
                        : <Badge label={`${r.matchedCount} contact${r.matchedCount !== 1 ? 's' : ''} — find the next`} color="bg-ink-100 text-ink-600" />}
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
                      {r.ranked.filter(c => !c.isDuplicate && !dismissed.has(candKey(c.person.company, c.person.name))).length === 0 ? (
                        <p className="text-xs text-ink-400">No new people to surface — try Re-run or widen your target roles.</p>
                      ) : r.ranked
                        .filter(c => !c.isDuplicate && !dismissed.has(candKey(c.person.company, c.person.name)))
                        .map(c => (
                          <CandidateCard key={candKey(c.person.company, c.person.name)}
                            cand={c} profile={profile}
                            isAdded={added.has(candKey(c.person.company, c.person.name))}
                            onDismiss={() => dismiss(candKey(c.person.company, c.person.name))}
                            onAdded={() => { markAdded(candKey(c.person.company, c.person.name)); onRefresh() }} />
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {topProspects.length === 0
                ? <EmptyState msg="Run 'Find people' on a few companies — your best prospects across all of them rank here." />
                : topProspects.map(c => (
                  <CandidateCard key={candKey(c.person.company, c.person.name)}
                    cand={c} profile={profile} showCompany
                    isAdded={added.has(candKey(c.person.company, c.person.name))}
                    onDismiss={() => dismiss(candKey(c.person.company, c.person.name))}
                    onAdded={() => { markAdded(candKey(c.person.company, c.person.name)); onRefresh() }} />
                ))}
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
