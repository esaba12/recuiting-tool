import { useState, useEffect } from 'react'
import { fetchContacts, fetchApplications, addApplication, addContact, addCallEntry, searchContactByName, fetchInteractions } from './notion.js'
import { fetchGitHubProfile, fetchRepoJobs, parseGitHubInput, topLanguages, parseEvents, buildWeeks } from './github.js'
import { STATUS_COLOR, URGENCY_COLOR, daysSince, daysUntil, fmt, Badge, EmptyState } from './shared.jsx'
import ContactDetailModal from './components/ContactDetailModal.jsx'
import ContactsTable from './components/ContactsTable.jsx'
import LinkedInTab from './components/LinkedInTab.jsx'
import QuickLogModal from './components/QuickLogModal.jsx'
import NetworkGraphTab from './components/NetworkGraphTab.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_ORDER = ['Wishlist','Applied','Phone Screen','Technical','Onsite','Offer','Accepted','Rejected']

const STAGE_COLOR = {
  Wishlist:       'bg-gray-100 text-gray-600',
  Applied:        'bg-blue-100 text-blue-700',
  'Phone Screen': 'bg-yellow-100 text-yellow-800',
  Technical:      'bg-orange-100 text-orange-800',
  Onsite:         'bg-purple-100 text-purple-800',
  Offer:          'bg-green-100 text-green-800',
  Accepted:       'bg-green-200 text-green-900 font-semibold',
  Rejected:       'bg-red-100 text-red-600',
}

const ACTIVE_STAGES = ['Wishlist','Applied','Phone Screen','Technical','Onsite']
const INTERVIEW_STAGES = ['Phone Screen','Technical','Onsite']
const TERMINAL_STAGES = ['Rejected','Accepted']

// ── Micro-components ──────────────────────────────────────────────────────────

function KPI({ label, value, sub, accent = false }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-blue-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ contacts, apps }) {
  const activeApps   = apps.filter(a => !TERMINAL_STAGES.includes(a.stage))
  const interviews   = apps.filter(a => INTERVIEW_STAGES.includes(a.stage))
  const offers       = apps.filter(a => a.stage === 'Offer')
  const warmContacts = contacts.filter(c => c.status === '🟢 Warm')

  const overdueContacts = contacts.filter(c =>
    c.status !== '✅ Closed' && c.followUpDate && daysUntil(c.followUpDate) <= 0
  ).sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))

  const staleApps = activeApps.filter(a => {
    const d = a.daysInStage ?? daysSince(a.lastActivity)
    return d !== null && d > 14
  })

  const stageCounts = {}
  apps.forEach(a => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1 })
  const funnelStages = ['Wishlist','Applied','Phone Screen','Technical','Onsite','Offer']
  const maxCount = Math.max(...funnelStages.map(s => stageCounts[s] || 0), 1)

  const barColors = ['bg-gray-300','bg-blue-400','bg-yellow-400','bg-orange-400','bg-purple-400','bg-green-500']

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Contacts" value={contacts.length} sub={`${warmContacts.length} warm`} />
        <KPI label="Active Apps" value={activeApps.length} sub={`${apps.filter(a=>a.stage==='Applied').length} awaiting response`} />
        <KPI label="Interviews" value={interviews.length} accent={interviews.length > 0} sub={interviews.length ? interviews.map(i=>i.company).join(', ') : 'none yet'} />
        <KPI label="Offers" value={offers.length} accent={offers.length > 0} sub={offers.length ? offers.map(o=>o.company).join(', ') : 'keep pushing'} />
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Application Funnel</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-gray-400">No applications yet. Add them in Notion or let the email pipeline populate them.</p>
        ) : (
          <>
            <div className="flex items-end gap-2 h-24">
              {funnelStages.map((stage, i) => {
                const count = stageCounts[stage] || 0
                const h = Math.max(count > 0 ? (count / maxCount) * 80 : 0, count > 0 ? 6 : 0)
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-gray-700">{count || ''}</span>
                    <div className={`w-full rounded-t transition-all ${barColors[i]}`} style={{ height: `${h}px` }} />
                    <span className="text-xs text-gray-400 text-center leading-tight">{stage}</span>
                  </div>
                )
              })}
            </div>
            {(stageCounts.Rejected || stageCounts.Accepted) && (
              <p className="text-xs text-gray-400 mt-3">
                {stageCounts.Rejected ? `${stageCounts.Rejected} rejected` : ''}
                {stageCounts.Rejected && stageCounts.Accepted ? ' · ' : ''}
                {stageCounts.Accepted ? `${stageCounts.Accepted} accepted` : ''}
              </p>
            )}
          </>
        )}
      </div>

      {/* Attention */}
      {(overdueContacts.length > 0 || staleApps.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-red-700 mb-3">
            Needs Attention ({overdueContacts.length + staleApps.length})
          </h2>
          <div className="space-y-2.5">
            {overdueContacts.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800 font-medium">{c.name}
                  {c.company && <span className="font-normal text-gray-500"> @ {c.company}</span>}
                </span>
                <span className="text-red-600 text-xs font-medium">
                  Follow-up {Math.abs(daysUntil(c.followUpDate))}d overdue
                </span>
              </div>
            ))}
            {staleApps.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800 font-medium">{a.company}
                  <span className="font-normal text-gray-500"> ({a.stage})</span>
                </span>
                <span className="text-orange-600 text-xs font-medium">
                  {a.daysInStage ?? daysSince(a.lastActivity)}d no movement
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Network breakdown */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Network</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400">No contacts yet.</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(STATUS_COLOR).map(([status, color]) => {
              const count = contacts.filter(c => c.status === status).length
              return (
                <div key={status} className={`rounded-xl p-3 text-center ${color}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs mt-0.5 leading-tight">{status}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Network Tab ───────────────────────────────────────────────────────────────

function NetworkTab({ contacts, interactions, onRefresh }) {
  const [filter, setFilter]   = useState('ALL')
  const [search, setSearch]   = useState('')
  const [view, setView]       = useState('table') // 'table' | 'cards'
  const [editing, setEditing] = useState(null)   // contact object | 'new' | null
  const [quickLog, setQuickLog] = useState(false)

  const filtered = contacts
    .filter(c => {
      if (filter !== 'ALL' && c.status !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        if (![c.name, c.company, c.role, c.email].some(f => f?.toLowerCase().includes(q))) return false
      }
      return true
    })
    .sort((a, b) => {
      const u = { HIGH: 0, MED: 1, LOW: 2 }
      if (u[a.urgency] !== u[b.urgency]) return (u[a.urgency] ?? 2) - (u[b.urgency] ?? 2)
      if (a.followUpDate && b.followUpDate) return new Date(a.followUpDate) - new Date(b.followUpDate)
      return 0
    })

  const statuses = ['ALL', '🟢 Warm', '🟡 Cooling', '🔴 Cold', '⭐ Champion', '✅ Closed']

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === s
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
            {s === 'ALL' ? `All (${contacts.length})` : s}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-1 border border-gray-200 rounded-full text-xs focus:outline-none focus:border-blue-400 w-44" />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-full overflow-hidden text-xs font-medium">
            {['table','cards'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 capitalize transition-colors ${view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setQuickLog(true)}
            className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-blue-300">
            + Log
          </button>
          <button onClick={() => setEditing('new')}
            className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700">
            + Contact
          </button>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState msg={contacts.length === 0 ? 'No contacts yet — the email pipeline will add them as recruiting emails come in.' : 'No contacts match this filter.'} />
        : view === 'table'
        ? <ContactsTable contacts={filtered} onEdit={c => setEditing(c)} />
        : (
          <div className="space-y-2">
            {filtered.map(c => {
              const overdue = c.followUpDate && daysUntil(c.followUpDate) <= 0
              const lastSeen = daysSince(c.lastInteraction)
              return (
                <div key={c.id} onClick={() => setEditing(c)}
                  className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md cursor-pointer ${overdue ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        {c.company && <span className="text-sm text-gray-500">@ {c.company}</span>}
                        {c.role && <span className="text-xs text-gray-400">· {c.role}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge label={c.status} color={STATUS_COLOR[c.status]} />
                        {c.urgency && c.urgency !== 'LOW' && <Badge label={c.urgency} color={URGENCY_COLOR[c.urgency]} />}
                        {c.referredByName && <Badge label={`↩ ${c.referredByName}`} color="bg-indigo-50 text-indigo-600" />}
                        {c.email && (
                          <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline">{c.email}</a>
                        )}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline">LinkedIn ↗</a>
                        )}
                      </div>
                      {c.whatTheyDid && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{c.whatTheyDid}"</p>
                      )}
                      {!c.whatTheyDid && c.notes && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{c.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1 text-xs">
                      {lastSeen !== null && (
                        <p className="text-gray-400">Last: {fmt(c.lastInteraction)}</p>
                      )}
                      {c.followUpDate && (
                        <p className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {overdue
                            ? `⚠ ${Math.abs(daysUntil(c.followUpDate))}d overdue`
                            : `Due ${fmt(c.followUpDate)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {editing && (
        <ContactDetailModal
          contact={editing === 'new' ? null : editing}
          contacts={contacts}
          interactions={interactions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onRefresh() }}
        />
      )}

      {quickLog && (
        <QuickLogModal
          contacts={contacts}
          onClose={() => setQuickLog(false)}
          onSaved={() => { setQuickLog(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab({ apps }) {
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')

  const filtered = apps
    .filter(a => {
      if (filter === 'active' && TERMINAL_STAGES.includes(a.stage)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!a.company?.toLowerCase().includes(q) && !a.role?.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        {[['active','Active'],['all','All incl. rejected']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === val
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
            {label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, role..."
          className="ml-auto px-3 py-1 border border-gray-200 rounded-full text-xs focus:outline-none focus:border-blue-400 w-44" />
      </div>

      {filtered.length === 0
        ? <EmptyState msg={apps.length === 0 ? 'No applications yet. Add them in Notion or let the email pipeline populate them.' : 'No applications match this filter.'} />
        : (
          <div className="space-y-2">
            {filtered.map(a => {
              const days = a.daysInStage ?? daysSince(a.lastActivity)
              const stale = days !== null && days > 14 && !TERMINAL_STAGES.includes(a.stage) && a.stage !== 'Offer'
              return (
                <div key={a.id} className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md ${stale ? 'border-orange-200' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{a.company}</span>
                        {a.role && <span className="text-sm text-gray-500">· {a.role}</span>}
                        <Badge label={a.stage} color={STAGE_COLOR[a.stage]} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {a.appliedDate && <span className="text-xs text-gray-400">Applied {fmt(a.appliedDate)}</span>}
                        {days !== null && (
                          <span className={`text-xs ${stale ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                            {days}d in stage{stale ? ' ⚠' : ''}
                          </span>
                        )}
                        {a.jdLink && (
                          <a href={a.jdLink} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">JD ↗</a>
                        )}
                      </div>
                      {a.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{a.notes}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

// ── Actions Tab ───────────────────────────────────────────────────────────────

function ActionsTab({ contacts, apps }) {
  const activeApps = apps.filter(a => !TERMINAL_STAGES.includes(a.stage))

  const overdueContacts = contacts
    .filter(c => c.status !== '✅ Closed' && c.followUpDate && daysUntil(c.followUpDate) <= 0)
    .sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))

  const staleApps = activeApps
    .filter(a => {
      const d = a.daysInStage ?? daysSince(a.lastActivity)
      return d !== null && d > 14
    })
    .sort((a, b) => {
      const da = a.daysInStage ?? daysSince(a.lastActivity)
      const db = b.daysInStage ?? daysSince(b.lastActivity)
      return db - da
    })

  const highUrgencyContacts = contacts.filter(c =>
    c.urgency === 'HIGH' && c.status !== '✅ Closed' && (!c.followUpDate || daysUntil(c.followUpDate) > 0)
  )

  if (overdueContacts.length + staleApps.length + highUrgencyContacts.length === 0) {
    return <EmptyState msg="✓ Nothing overdue. You're on top of it." />
  }

  return (
    <div className="space-y-4">
      {overdueContacts.length > 0 && (
        <Section title={`Overdue Follow-Ups (${overdueContacts.length})`} accent="red">
          {overdueContacts.map(c => (
            <ActionRow key={c.id}
              primary={c.name}
              secondary={[c.company, c.role].filter(Boolean).join(' · ')}
              link={c.email ? { href: `mailto:${c.email}`, label: c.email } : null}
              badge={<Badge label={c.status} color={STATUS_COLOR[c.status]} />}
              meta={`Was due ${fmt(c.followUpDate)} (${Math.abs(daysUntil(c.followUpDate))}d ago)`}
              metaColor="text-red-600"
            />
          ))}
        </Section>
      )}

      {staleApps.length > 0 && (
        <Section title={`Stale Applications (${staleApps.length})`} accent="orange"
          subtitle="No movement in 14+ days — follow up or update the stage.">
          {staleApps.map(a => (
            <ActionRow key={a.id}
              primary={a.company}
              secondary={a.role || ''}
              link={a.jdLink ? { href: a.jdLink, label: 'View JD ↗' } : null}
              badge={<Badge label={a.stage} color={STAGE_COLOR[a.stage]} />}
              meta={`${a.daysInStage ?? daysSince(a.lastActivity)}d in ${a.stage}`}
              metaColor="text-orange-600"
            />
          ))}
        </Section>
      )}

      {highUrgencyContacts.length > 0 && (
        <Section title={`High Urgency Contacts (${highUrgencyContacts.length})`} accent="yellow">
          {highUrgencyContacts.map(c => (
            <ActionRow key={c.id}
              primary={c.name}
              secondary={[c.company, c.role].filter(Boolean).join(' · ')}
              link={c.email ? { href: `mailto:${c.email}`, label: c.email } : null}
              badge={<Badge label="HIGH" color={URGENCY_COLOR.HIGH} />}
              meta={c.followUpDate ? `Due ${fmt(c.followUpDate)}` : 'No follow-up date set'}
              metaColor="text-gray-500"
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, subtitle, accent, children }) {
  const border = { red: 'border-red-200', orange: 'border-orange-200', yellow: 'border-yellow-200' }[accent] || 'border-gray-200'
  const heading = { red: 'text-red-700', orange: 'text-orange-700', yellow: 'text-yellow-700' }[accent] || 'text-gray-700'
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1`}>{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function ActionRow({ primary, secondary, link, badge, meta, metaColor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-900">{primary}</p>
        {secondary && <p className="text-xs text-gray-500">{secondary}</p>}
        {link && <a href={link.href} target={link.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer" className="text-xs text-blue-500 hover:underline">{link.label}</a>}
      </div>
      <div className="text-right shrink-0 space-y-1">
        {badge}
        <p className={`text-xs font-medium ${metaColor}`}>{meta}</p>
      </div>
    </div>
  )
}

// ── GitHub Tab ────────────────────────────────────────────────────────────────

const LEVEL_COLOR = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
const LANG_COLOR  = ['bg-blue-500','bg-purple-500','bg-yellow-500','bg-green-500','bg-red-500','bg-orange-500']

const EVENT_LABELS = {
  PushEvent:                  'Pushed',
  PullRequestEvent:           'Pull request',
  IssuesEvent:                'Issue',
  WatchEvent:                 'Starred',
  ForkEvent:                  'Forked',
  CreateEvent:                'Created',
  DeleteEvent:                'Deleted',
  IssueCommentEvent:          'Commented',
  PullRequestReviewEvent:     'Reviewed PR',
  ReleaseEvent:               'Released',
  PublicEvent:                'Made public',
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

function ContributionGrid({ weeks, total }) {
  const thisYear = new Date().getFullYear()
  const totalThisYear = total?.[thisYear] ?? total?.[Object.keys(total || {}).pop()] ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-600">{totalThisYear} contributions in the last year</p>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          Less
          {LEVEL_COLOR.map((c, i) => (
            <span key={i} className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          More
        </div>
      </div>
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }).map((_, di) => {
              const day = week?.[di]
              return (
                <div
                  key={di}
                  title={day ? `${day.date}: ${day.count} contribution${day.count !== 1 ? 's' : ''}` : ''}
                  className="rounded-sm flex-shrink-0"
                  style={{
                    width: 11, height: 11,
                    backgroundColor: day ? LEVEL_COLOR[day.level ?? 0] : '#ebedf0',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function GitHubTab() {
  const [input, setInput]     = useState('')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [history, setHistory] = useState([])

  async function lookup(raw) {
    const val = (raw || input).trim()
    if (!val) return
    const parsed = parseGitHubInput(val)
    if (!parsed) { setError('Could not parse that GitHub URL.'); return }
    setLoading(true); setError(null); setData(null)
    try {
      let result
      if (parsed.type === 'repo') {
        result = { mode: 'repo', ...(await fetchRepoJobs(parsed.owner, parsed.repo)) }
      } else {
        result = { mode: 'user', ...(await fetchGitHubProfile(val)) }
      }
      setData(result)
      const key = parsed.type === 'repo' ? `${parsed.owner}/${parsed.repo}` : parsed.username
      setHistory(h => [key, ...h.filter(x => x !== key)].slice(0, 8))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="github.com/speedyapply/2027-SWE-College-Jobs  or  github.com/username"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
        <button onClick={() => lookup()} disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 disabled:opacity-40 font-medium transition-colors">
          {loading ? '...' : 'Pull'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {history.map(h => (
            <button key={h} onClick={() => { setInput(h); lookup(h) }}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full font-mono transition-colors">
              {h}
            </button>
          ))}
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {loading && <EmptyState msg="Fetching..." />}

      {data?.mode === 'repo'  && <RepoJobsView data={data} onClear={() => { setData(null); setInput('') }} />}
      {data?.mode === 'user'  && <UserProfileView data={data} onClear={() => { setData(null); setInput('') }} />}
    </div>
  )
}

// ── Job board: localStorage + AI helpers ─────────────────────────────────────

const BUCKET_CONFIG = [
  { key: 'all',      label: 'All',      icon: '📋' },
  { key: 'applying', label: 'Applying', icon: '📤' },
  { key: 'maybe',    label: 'Maybe',    icon: '🤔' },
  { key: 'applied',  label: 'Applied',  icon: '✅' },
  { key: 'pass',     label: 'Pass',     icon: '✕'  },
]

const BUCKET_ACTIVE = {
  applying: 'bg-blue-600 text-white border-blue-600',
  maybe:    'bg-amber-500 text-white border-amber-500',
  applied:  'bg-green-600 text-white border-green-600',
  pass:     'bg-red-500 text-white border-red-500',
}

const BUCKET_TAG = {
  applying: 'bg-blue-100 text-blue-700',
  maybe:    'bg-amber-100 text-amber-700',
  applied:  'bg-green-100 text-green-700',
  pass:     'bg-red-100 text-red-500',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function lsGet(key) { try { return JSON.parse(localStorage.getItem(key)) || null } catch { return null } }
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

function jobId(job) {
  return `${job.company}::${job.role}`.replace(/[^\w:]/g, '_').slice(0, 80)
}

function parseJobDate(str) {
  if (!str || /^[-—\s]+$/.test(str)) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str)
  const m = str.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:,?\s*(\d{4}))?/)
  if (m) {
    const mo = MONTH_NAMES.findIndex(n => n.toLowerCase() === m[1].slice(0,3).toLowerCase())
    if (mo >= 0) return new Date(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[2])
  }
  return null
}

async function generateJobAnalysis(job, prefs) {
  const prefText = [
    prefs.targetRoles        && `Target roles: ${prefs.targetRoles}`,
    prefs.preferredLocations && `Preferred locations: ${prefs.preferredLocations}`,
    prefs.interests          && `Interests / skills: ${prefs.interests}`,
    prefs.dealBreakers       && `Deal-breakers: ${prefs.dealBreakers}`,
    prefs.companyType        && `Company type: ${prefs.companyType}`,
  ].filter(Boolean).join('\n') || 'No specific preferences set'

  const res = await fetch('/claude-api/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 450,
      messages: [{
        role: 'user',
        content: `You are a recruiting advisor. A a university CS sophomore (a strong GPA, targeting SWE internships Fall 2026) is evaluating:

Company: ${job.company}
Role: ${job.role || 'Internship'}
Location: ${job.location || 'Unknown'}
${job.notes ? `Notes: ${job.notes}` : ''}

Student preferences:
${prefText}

Reply with JSON only — no explanation, no markdown:
{
  "pros": ["specific pro 1", "specific pro 2", "specific pro 3"],
  "cons": ["specific con 1", "specific con 2", "specific con 3"],
  "fitScore": 7,
  "summary": "one honest sentence about this role for this student",
  "company": {
    "about": "1-2 sentences: what the company does and why it matters",
    "techStack": "primary languages/frameworks they're known for, or 'Unknown'",
    "size": "startup|growth|mid|large|faang",
    "culture": "one honest sentence about the engineering culture or reputation"
  }
}`
      }]
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(res.status === 401 || res.status === 403
      ? 'Add ANTHROPIC_API_KEY to your .env to enable AI analysis'
      : err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  const text = data.content[0].text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Unexpected AI response format')
  return JSON.parse(match[0])
}

// ── Job board sub-components ──────────────────────────────────────────────────

function PreferencesPanel({ prefs, onChange }) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState(prefs)

  function save() { onChange(draft); setOpen(false) }

  const fields = [
    { key: 'targetRoles',        label: 'Target roles',      placeholder: 'SWE Intern, New Grad SWE' },
    { key: 'preferredLocations', label: 'Preferred locations', placeholder: 'Bay Area, NYC, Remote' },
    { key: 'interests',          label: 'Interests / skills', placeholder: 'ML, systems, fintech' },
    { key: 'companyType',        label: 'Company type',       placeholder: 'FAANG, fintech startup' },
    { key: 'dealBreakers',       label: 'Deal-breakers',      placeholder: 'Hardware, defense, no remote' },
  ]

  return (
    <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-blue-800">
        <span>🎯 What I'm looking for {Object.keys(prefs).filter(k=>prefs[k]).length > 0 ? '· saved' : '· click to set'}</span>
        <span className="text-blue-400 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-blue-700 mb-1">{label}</label>
              <input value={draft[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400" />
            </div>
          ))}
          <div className="md:col-span-2 flex justify-end">
            <button onClick={save}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function JobCard({ job, status, onStatusChange, onClick }) {
  const initials = job.company.replace(/[^a-zA-Z ]/g, '').trim().slice(0, 2).toUpperCase() || '??'
  const isClosed = job.status === 'closed'

  function toggleStatus(e, key) {
    e.stopPropagation()
    onStatusChange(status === key ? null : key)
  }

  return (
    <div onClick={() => !isClosed && onClick()}
      className={`bg-white rounded-xl border p-4 transition-all group
        ${isClosed ? 'opacity-40 cursor-default border-gray-100' :
          'cursor-pointer border-gray-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 select-none
          ${status === 'applying' ? 'bg-blue-100 text-blue-700' :
            status === 'maybe'   ? 'bg-amber-100 text-amber-700' :
            status === 'applied' ? 'bg-green-100 text-green-700' :
            status === 'pass'    ? 'bg-red-50 text-red-400' :
            'bg-gray-100 text-gray-500'}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{job.company}</p>
            {/* Heart = Applying quick-action */}
            <button onClick={e => toggleStatus(e, 'applying')}
              className={`shrink-0 text-base leading-none transition-transform active:scale-125
                ${status === 'applying' ? 'text-blue-500' : 'text-gray-200 hover:text-blue-400'}`}>
              {status === 'applying' ? '♥' : '♡'}
            </button>
          </div>
          {job.role && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-tight">{job.role}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {job.location && <span className="text-xs text-gray-400 truncate max-w-[140px]">📍 {job.location}</span>}
            {job.dateAdded && <span className="text-xs text-gray-400">{job.dateAdded}</span>}
          </div>
          {/* Status row */}
          <div className="flex items-center gap-1 mt-2.5">
            {status
              ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${BUCKET_TAG[status]}`}>
                  {BUCKET_CONFIG.find(b => b.key === status)?.icon} {BUCKET_CONFIG.find(b => b.key === status)?.label}
                </span>
              : <span className="text-[10px] text-gray-300 group-hover:text-gray-400">click to view</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarView({ jobs, selectedDay, onDaySelect }) {
  const [viewDate, setViewDate] = useState(() => {
    const dates = jobs.map(j => parseJobDate(j.dateAdded)).filter(Boolean)
    return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date()
  })

  const year = viewDate.getFullYear()
  const mo   = viewDate.getMonth()

  const jobsByDay = {}
  jobs.forEach(j => {
    const d = parseJobDate(j.dateAdded)
    if (d && d.getFullYear() === year && d.getMonth() === mo) {
      const k = d.getDate()
      jobsByDay[k] = (jobsByDay[k] || 0) + 1
    }
  })

  const firstDow    = new Date(year, mo, 1).getDay()
  const daysInMonth = new Date(year, mo + 1, 0).getDate()
  const cells       = [...Array(firstDow).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)]

  const today      = new Date()
  const todayKey   = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const totalMonth = Object.values(jobsByDay).reduce((a, b) => a + b, 0)
  const maxDay     = Math.max(...Object.values(jobsByDay), 1)

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(year, mo - 1, 1))}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-sm">←</button>
        <div className="text-center">
          <p className="font-semibold text-gray-800 text-sm">{MONTH_NAMES[mo]} {year}</p>
          {totalMonth > 0 && <p className="text-xs text-gray-400">{totalMonth} listings posted</p>}
        </div>
        <button onClick={() => setViewDate(new Date(year, mo + 1, 1))}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-sm">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const count = jobsByDay[d] || 0
          const key   = `${year}-${mo}-${d}`
          const isSel = selectedDay === key
          const isTod = key === todayKey
          const heat  = count ? Math.min(Math.ceil((count / maxDay) * 4), 4) : 0
          const heatBg = ['', 'bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600'][heat]
          const heatTx = heat >= 3 ? 'text-white' : heat > 0 ? 'text-blue-800' : 'text-gray-300'
          return (
            <button key={d} disabled={!count}
              onClick={() => onDaySelect(isSel ? null : key)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all
                ${isSel ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                ${count ? `${heatBg} ${heatTx} cursor-pointer hover:opacity-80` : `${isTod ? 'bg-blue-50 text-blue-400' : 'text-gray-200'} cursor-default`}`}>
              <span>{d}</span>
              {count > 0 && <span className="text-[9px] font-bold">{count}</span>}
            </button>
          )
        })}
      </div>
      {selectedDay && (
        <p className="text-xs text-center text-blue-600 mt-3 cursor-pointer hover:underline" onClick={() => onDaySelect(null)}>
          Showing {selectedDay.split('-')[2] && jobsByDay[+selectedDay.split('-')[2]]} jobs from this day · click to clear
        </p>
      )}
    </div>
  )
}

function JobDetailModal({ job, status, onStatusChange, onClose, prefs }) {
  const [analysis, setAnalysis]       = useState(null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState(null)
  const [notionState, setNotionState] = useState(null)

  async function doAnalysis() {
    setAiLoading(true); setAiError(null)
    try { setAnalysis(await generateJobAnalysis(job, prefs)) }
    catch (e) { setAiError(e.message) }
    finally { setAiLoading(false) }
  }

  async function addToNotion() {
    setNotionState('adding')
    try {
      await addApplication({ company: job.company, role: job.role, jdLink: job.applyUrl })
      setNotionState('done')
    } catch { setNotionState('error') }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 rounded-t-2xl md:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{job.company}</h2>
              {job.role && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{job.role}</p>}
            </div>
            <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm">✕</button>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-500">
            {job.location  && <span>📍 {job.location}</span>}
            {job.dateAdded && <span>📅 {job.dateAdded}</span>}
          </div>
          <div className="flex items-center gap-2 mt-3">
            {job.applyUrl && (
              <a href={job.applyUrl} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-gray-900 text-white text-xs rounded-xl hover:bg-gray-800 font-medium">
                Apply ↗
              </a>
            )}
            <button onClick={addToNotion} disabled={!!notionState}
              className={`px-4 py-2 text-xs rounded-xl font-medium border transition-colors
                ${notionState === 'done'  ? 'bg-green-100 text-green-700 border-green-200' :
                  notionState === 'error' ? 'bg-red-100 text-red-600 border-red-200' :
                  notionState === 'adding'? 'bg-gray-100 text-gray-400 border-gray-200' :
                  'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {notionState === 'done' ? '✓ In Notion' : notionState === 'error' ? '✕ Error' : notionState === 'adding' ? '...' : '+ Notion Wishlist'}
            </button>
          </div>
        </div>

        {/* Status buckets */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">My status</p>
          <div className="flex gap-2 flex-wrap">
            {BUCKET_CONFIG.filter(b => b.key !== 'all').map(b => (
              <button key={b.key} onClick={() => onStatusChange(status === b.key ? null : b.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
                  ${status === b.key ? BUCKET_ACTIVE[b.key] : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                {b.icon} {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Fit Analysis */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fit Analysis</p>
            {!analysis && !aiLoading && (
              <button onClick={doAnalysis}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs rounded-lg hover:bg-indigo-100 font-medium">
                Analyze →
              </button>
            )}
          </div>

          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Analyzing with Claude Haiku...
            </div>
          )}

          {aiError && (
            <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{aiError}</div>
          )}

          {analysis && (
            <div className="space-y-3">
              {analysis.summary && (
                <p className="text-sm text-gray-600 italic leading-relaxed">"{analysis.summary}"</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">Fit</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    analysis.fitScore >= 8 ? 'bg-green-500' :
                    analysis.fitScore >= 6 ? 'bg-blue-500' :
                    analysis.fitScore >= 4 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${(analysis.fitScore / 10) * 100}%` }} />
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  analysis.fitScore >= 8 ? 'text-green-600' :
                  analysis.fitScore >= 6 ? 'text-blue-600' :
                  analysis.fitScore >= 4 ? 'text-amber-600' : 'text-red-500'}`}>
                  {analysis.fitScore}/10
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-green-600 mb-2">Pros</p>
                  <ul className="space-y-1.5">
                    {analysis.pros.map((p, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5 leading-tight">
                        <span className="text-green-500 shrink-0 mt-0.5">+</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 mb-2">Cons</p>
                  <ul className="space-y-1.5">
                    {analysis.cons.map((c, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5 leading-tight">
                        <span className="text-red-400 shrink-0 mt-0.5">−</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {analysis.company && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500">Company Context</p>
                  {analysis.company.about && <p className="text-xs text-gray-600">{analysis.company.about}</p>}
                  <div className="flex gap-3 flex-wrap text-xs text-gray-500">
                    {analysis.company.techStack && <span>🛠 {analysis.company.techStack}</span>}
                    {analysis.company.size && <span>📊 {analysis.company.size}</span>}
                  </div>
                  {analysis.company.culture && <p className="text-xs text-gray-500 italic">{analysis.company.culture}</p>}
                </div>
              )}
            </div>
          )}

          {!analysis && !aiLoading && !aiError && (
            <p className="text-xs text-gray-400">
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

// ── Repo job-board view ───────────────────────────────────────────────────────

function RepoJobsView({ data, onClear }) {
  const storageKey = `rec_jobs_${data.repoName}`
  const prefsKey   = 'rec_prefs'

  const [statuses, setStatuses] = useState(() => lsGet(storageKey) || {})
  const [prefs, setPrefsState]  = useState(() => lsGet(prefsKey) || {})
  const [view, setView]         = useState('list')
  const [bucket, setBucket]     = useState('all')
  const [search, setSearch]     = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [page, setPage]         = useState(1)
  const PER_PAGE = 30

  function updateStatus(job, s) {
    setStatuses(prev => {
      const next = { ...prev }
      if (s === null) delete next[jobId(job)]
      else next[jobId(job)] = s
      lsSet(storageKey, next)
      return next
    })
  }

  function updatePrefs(p) {
    setPrefsState(p)
    lsSet(prefsKey, p)
  }

  useEffect(() => setPage(1), [bucket, search, locFilter, selectedDay])

  const bucketCounts = Object.fromEntries(
    BUCKET_CONFIG.map(b => [b.key, b.key === 'all' ? data.jobs.length :
      data.jobs.filter(j => statuses[jobId(j)] === b.key).length])
  )

  const filtered = data.jobs.filter(j => {
    if (bucket !== 'all' && statuses[jobId(j)] !== bucket) return false
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

  const paginated = filtered.slice(0, page * PER_PAGE)

  return (
    <div className="space-y-4">
      {/* Repo header */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={data.repoUrl} target="_blank" rel="noreferrer"
              className="font-semibold text-gray-900 hover:text-blue-600 text-sm">{data.repoName}</a>
            <span className="text-xs text-gray-400">★ {data.stars?.toLocaleString()}</span>
          </div>
          {data.description && <p className="text-xs text-gray-500 mt-0.5">{data.description}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {data.jobs.length} listings · {Object.keys(statuses).length} tracked · {bucketCounts.applying || 0} applying
          </p>
        </div>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">✕</button>
      </div>

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
                ? (b.key === 'all' ? 'bg-gray-800 text-white border-gray-800' : BUCKET_ACTIVE[b.key] || 'bg-gray-800 text-white border-gray-800')
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {b.icon} {b.label}
            {bucketCounts[b.key] > 0 &&
              <span className="ml-1 opacity-70">{bucketCounts[b.key]}</span>}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {[['list','☰'],['calendar','📅']].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
                ${view === v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
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
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-400 bg-white" />
            <span className="absolute left-2.5 top-2 text-gray-300 text-sm">🔍</span>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-gray-300 hover:text-gray-500 text-xs">✕</button>
            )}
          </div>
          <div className="relative">
            <input value={locFilter} onChange={e => setLocFilter(e.target.value)}
              placeholder="Filter location..."
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-400 bg-white w-44" />
            <span className="absolute left-2.5 top-2 text-gray-300 text-sm">📍</span>
            {locFilter && (
              <button onClick={() => setLocFilter('')} className="absolute right-2.5 top-2 text-gray-300 hover:text-gray-500 text-xs">✕</button>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">
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
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}>
              {loc}
            </button>
          ))}
          <button
            onClick={() => { setSearch(''); setLocFilter('') }}
            className="px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors ml-auto">
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
        ? <EmptyState msg={bucket !== 'all' ? `No jobs marked "${bucket}" yet — heart or bucket jobs from the list.` : 'No results.'} />
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {paginated.map((job, i) => (
              <JobCard key={`${job.company}-${i}`} job={job}
                status={statuses[jobId(job)] || null}
                onStatusChange={s => updateStatus(job, s)}
                onClick={() => setSelectedJob(job)} />
            ))}
          </div>
      }

      {paginated.length < filtered.length && (
        <button onClick={() => setPage(p => p + 1)}
          className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl bg-white hover:bg-gray-50">
          Show more ({filtered.length - paginated.length} remaining)
        </button>
      )}

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          status={statuses[jobId(selectedJob)] || null}
          onStatusChange={s => { updateStatus(selectedJob, s) }}
          onClose={() => setSelectedJob(null)}
          prefs={prefs}
        />
      )}
    </div>
  )
}

// ── User profile view (unchanged logic, extracted) ────────────────────────────

function UserProfileView({ data, onClear }) {
  const weeks  = buildWeeks(data.contributions)
  const langs  = topLanguages(data.repos || [])
  const { recent } = parseEvents(data.events || [])
  const profile = data?.profile

  if (!profile) return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
      Profile data unavailable — username may not exist or GitHub rate-limited the request.
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <img src={profile.avatar_url} alt={profile.login}
            className="w-16 h-16 rounded-full border border-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{profile.name || profile.login}</h2>
              <a href={profile.html_url} target="_blank" rel="noreferrer"
                className="text-xs text-blue-500 hover:underline">@{profile.login} ↗</a>
            </div>
            {profile.bio && <p className="text-sm text-gray-600 mt-0.5">{profile.bio}</p>}
            <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.company  && <span>🏢 {profile.company}</span>}
              <span>📦 {profile.public_repos} repos</span>
              <span>👥 {profile.followers} followers</span>
            </div>
          </div>
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>

      {weeks.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Contribution Timeline</h3>
          <ContributionGrid weeks={weeks} total={data.contributions?.total} />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Repos</h3>
          <div className="space-y-3">
            {(data.repos || []).filter(r => !r.fork).slice(0, 6).map(r => (
              <div key={r.id}>
                <a href={r.html_url} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline">{r.name}</a>
                {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</p>}
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {r.language && <span>{r.language}</span>}
                  {r.stargazers_count > 0 && <span>★ {r.stargazers_count}</span>}
                  <span>Updated {timeAgo(r.pushed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Languages</h3>
          <div className="space-y-2.5">
            {langs.map(([lang, count], i) => {
              const pct = Math.round((count / (data.repos?.filter(r=>!r.fork&&r.language).length || 1)) * 100)
              return (
                <div key={lang}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{lang}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${LANG_COLOR[i % LANG_COLOR.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {recent.map((e, i) => {
              const label = EVENT_LABELS[e.type] || e.type.replace('Event', '')
              const repo  = e.repo?.name || ''
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 text-xs w-16 shrink-0">{timeAgo(e.created_at)}</span>
                  <span className="text-gray-600 shrink-0 text-xs">{label}</span>
                  <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer"
                    className="text-blue-500 hover:underline text-xs truncate">{repo}</a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Job board stats ───────────────────────────────────────────────────────────

function RepoStats({ jobs }) {
  const now     = new Date()
  const weekAgo = new Date(now - 7 * 86400000)

  const newThisWeek = jobs.filter(j => { const d = parseJobDate(j.dateAdded); return d && d >= weekAgo })
  const remote      = jobs.filter(j => /remote|anywhere|usa only|worldwide|us only/i.test(j.location || ''))

  const locCounts = {}
  jobs.forEach(j => { if (j.location && j.location.length > 1 && j.location.length < 40) locCounts[j.location] = (locCounts[j.location] || 0) + 1 })
  const topLocs = Object.entries(locCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const companyCounts = {}
  jobs.forEach(j => { if (j.company) companyCounts[j.company] = (companyCounts[j.company] || 0) + 1 })
  const multiRole = Object.entries(companyCounts).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div className="space-y-3">
      {/* Stat pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Listings',  value: jobs.length,          sub: 'in this repo' },
          { label: 'New This Week',   value: newThisWeek.length,   sub: 'recently posted', accent: true },
          { label: 'Remote-Friendly', value: remote.length,        sub: `${Math.round((remote.length/jobs.length)*100)}% of listings` },
          { label: 'Cities',          value: Object.keys(locCounts).length, sub: 'unique locations' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent ? 'text-blue-600' : 'text-gray-900'}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* New this week */}
      {newThisWeek.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">🆕 Added this week</p>
          <div className="flex flex-wrap gap-1.5">
            {newThisWeek.slice(0, 16).map((j, i) => (
              <span key={i} className="px-2.5 py-1 bg-white border border-blue-200 text-blue-800 text-xs rounded-full font-medium">
                {j.company}
              </span>
            ))}
            {newThisWeek.length > 16 && <span className="text-xs text-blue-400 self-center">+{newThisWeek.length - 16} more</span>}
          </div>
        </div>
      )}

      {/* Top locations */}
      {topLocs.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3">Top Locations</p>
          <div className="space-y-1.5">
            {topLocs.map(([loc, count]) => (
              <div key={loc} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-40 truncate">{loc}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / topLocs[0][1]) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Companies hiring for multiple roles */}
      {multiRole.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Hiring Most Roles</p>
          <div className="flex flex-wrap gap-2">
            {multiRole.map(([co, n]) => (
              <span key={co} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {co} <span className="font-bold text-blue-600">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calls Tab (Granola → Notion) ──────────────────────────────────────────────

async function extractCallData(text) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const res = await fetch('/claude-api/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Today is ${today}. Extract recruiting data from this call summary/transcript. Return ONLY valid JSON, no explanation.

{
  "contact_name": "full name",
  "contact_company": "company name",
  "contact_role": "their job title or type: SWE|PM|Recruiter|Alumni|Referral|Other",
  "contact_email": "email or null",
  "call_type": "coffee_chat|recruiter_screen|technical|networking|referral",
  "summary": "3-sentence summary of the conversation",
  "key_insights": "what they shared about company culture, role, process, or advice",
  "what_they_offered": "any referrals, intros, or help they offered — or null",
  "my_commitments": "what I said I would do next — or null",
  "follow_up_draft": "A warm 3-4 sentence follow-up email from the candidate (a university CS sophomore, a strong GPA)"
}

Call summary / transcript:
${text}`
      }]
    })
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `API ${res.status}`)
  }
  const data = await res.json()
  const match = data.content[0].text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse response')
  return JSON.parse(match[0])
}

function CallsTab() {
  const [text, setText]         = useState('')
  const [extracting, setExtr]   = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [error, setError]       = useState(null)
  const [saving, setSaving]     = useState(null) // null | 'saving' | 'done' | 'error'
  const [saved, setSaved]       = useState(null)
  const [editField, setEdit]    = useState({})

  const field = (key) => editField[key] ?? extracted?.[key] ?? ''
  const setField = (key, val) => setEdit(e => ({ ...e, [key]: val }))

  async function extract() {
    if (!text.trim()) return
    setExtr(true); setError(null); setExtracted(null); setSaved(null); setEdit({})
    try { setExtracted(await extractCallData(text)) }
    catch (e) { setError(e.message) }
    finally { setExtr(false) }
  }

  async function saveToNotion() {
    setSaving('saving')
    try {
      // Find or create contact
      let contactId = null
      const existing = await searchContactByName(field('contact_name'))
      if (existing) {
        contactId = existing.id
      } else {
        const newContact = await addContact({
          name:    field('contact_name'),
          company: field('contact_company'),
          role:    field('contact_role'),
          email:   field('contact_email') || undefined,
        })
        contactId = newContact.id
      }
      // Create call entry
      await addCallEntry({
        contactId,
        contactName:   field('contact_name'),
        company:       field('contact_company'),
        summary:       field('summary'),
        keyInsights:   field('key_insights'),
        commitments:   field('my_commitments'),
        followUpDraft: field('follow_up_draft'),
      })
      setSaving('done')
      setSaved({ existed: !!existing, name: field('contact_name'), company: field('contact_company') })
    } catch (e) {
      setError(e.message)
      setSaving('error')
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Paste Granola summary</p>
        <p className="text-xs text-gray-400 mb-3">After a call ends, copy the summary from Granola and paste it here. Claude extracts the contact, key insights, and writes a follow-up draft.</p>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste your Granola call notes or summary here..."
          rows={8}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none font-mono bg-gray-50" />
        <button onClick={extract} disabled={extracting || !text.trim()}
          className="mt-2 px-5 py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 disabled:opacity-40 font-medium transition-colors">
          {extracting ? 'Extracting...' : 'Extract with Claude →'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {extracted && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Extracted — review & edit before saving</p>
            <span className="text-xs text-gray-400 capitalize">{field('call_type')?.replace('_', ' ')}</span>
          </div>

          {/* Contact info */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'contact_name',    label: 'Name' },
                { key: 'contact_company', label: 'Company' },
                { key: 'contact_role',    label: 'Role type' },
                { key: 'contact_email',   label: 'Email' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
                  <input value={field(key)} onChange={e => setField(key, e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Call content */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Call Content</p>
            {[
              { key: 'summary',        label: 'Summary',         rows: 3 },
              { key: 'key_insights',   label: 'Key Insights',    rows: 2 },
              { key: 'my_commitments', label: 'My Commitments',  rows: 2 },
            ].map(({ key, label, rows }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <textarea value={field(key)} onChange={e => setField(key, e.target.value)} rows={rows}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            ))}
          </div>

          {/* Follow-up draft */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-700">Follow-Up Draft</p>
              <button onClick={() => navigator.clipboard.writeText(field('follow_up_draft'))}
                className="text-xs text-blue-500 hover:underline">Copy</button>
            </div>
            <textarea value={field('follow_up_draft')} onChange={e => setField('follow_up_draft', e.target.value)} rows={5}
              className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none bg-white" />
          </div>

          {/* Save */}
          {saving === 'done' ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              ✓ Saved to Notion — {saved.existed ? `updated existing contact` : `created new contact`} <strong>{saved.name}</strong> @ {saved.company} + new call entry.
            </div>
          ) : (
            <button onClick={saveToNotion} disabled={saving === 'saving'}
              className="w-full py-3 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
              {saving === 'saving' ? 'Saving to Notion...' : '+ Save Contact & Call to Notion'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]           = useState('overview')
  const [contacts, setContacts] = useState([])
  const [apps, setApps]         = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [lastLoaded, setLastLoaded] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [c, a, i] = await Promise.all([fetchContacts(), fetchApplications(), fetchInteractions()])
      setContacts(c); setApps(a); setInteractions(i)
      setLastLoaded(new Date().toLocaleTimeString())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const activeApps = apps.filter(a => !['Rejected','Accepted'].includes(a.stage))
  const overdueCount = contacts.filter(c =>
    c.status !== '✅ Closed' && c.followUpDate && Math.floor((new Date(c.followUpDate) - Date.now()) / 86400000) <= 0
  ).length
  const staleCount = activeApps.filter(a => {
    const d = a.daysInStage ?? (a.lastActivity ? Math.floor((Date.now() - new Date(a.lastActivity)) / 86400000) : null)
    return d !== null && d > 14
  }).length
  const actionCount = overdueCount + staleCount

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'network',  label: `Network (${contacts.length})` },
    { id: 'graph',    label: 'Graph' },
    { id: 'pipeline', label: `Pipeline (${activeApps.length})` },
    { id: 'actions',  label: actionCount > 0 ? `Actions 🔴 ${actionCount}` : 'Actions' },
    { id: 'calls',    label: 'Calls' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'github',   label: 'Job Boards' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Recruiting OS</h1>
            <p className="text-xs text-gray-400">Fall 2026 · {lastLoaded ? `Updated ${lastLoaded}` : 'Loading...'}</p>
          </div>
          <button onClick={load} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <strong>Notion connection error:</strong> {error}
            <br /><span className="text-xs text-red-500 mt-1 block">Make sure NOTION_API_KEY is in your .env and you ran <code className="bg-red-100 px-1 rounded">npm run dev</code> from the <code className="bg-red-100 px-1 rounded">app/</code> directory.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <EmptyState msg="Loading from Notion..." />}
        {!loading && tab === 'overview' && <OverviewTab contacts={contacts} apps={apps} />}
        {!loading && tab === 'network'  && <NetworkTab contacts={contacts} interactions={interactions} onRefresh={load} />}
        {!loading && tab === 'graph'    && <NetworkGraphTab contacts={contacts} />}
        {!loading && tab === 'pipeline' && <PipelineTab apps={apps} />}
        {!loading && tab === 'actions'  && <ActionsTab contacts={contacts} apps={apps} />}
        {tab === 'calls'    && <CallsTab />}
        {tab === 'linkedin' && <LinkedInTab onSaved={load} />}
        {tab === 'github'   && <GitHubTab />}
      </div>
    </div>
  )
}
