import { useState, useEffect } from 'react'
import { fetchContacts, fetchApplications, fetchInteractions } from './notion.js'
import { STATUS_COLOR, URGENCY_COLOR, daysSince, daysUntil, fmt, Badge, EmptyState, isOverdue } from './shared.jsx'
import { statusIconFor, URGENCY_ICON } from './lib/icons.js'
import AppShell from './components/layout/AppShell.jsx'
import ContactDetailModal from './components/ContactDetailModal.jsx'
import ContactsTable from './components/ContactsTable.jsx'
import LogInteractionModal from './components/LogInteractionModal.jsx'
import NetworkGraphTab from './components/NetworkGraphTab.jsx'
import OverviewTab from './components/OverviewTab.jsx'
import PipelineTab from './components/PipelineTab.jsx'
import ActionsTab from './components/ActionsTab.jsx'
import CalendarTab from './components/CalendarTab.jsx'
import GitHubTab from './components/jobBoards/GitHubTab.jsx'
import AddToCalendarModal from './components/AddToCalendarModal.jsx'
import QuickScheduleModal from './components/QuickScheduleModal.jsx'
import ReferralCoverageTab from './components/ReferralCoverageTab.jsx'
import DiscoverTab from './components/DiscoverTab.jsx'
import { Table2, LayoutGrid, Share2, Target, UserSearch } from 'lucide-react'

// ── Network Tab ───────────────────────────────────────────────────────────────

const NETWORK_VIEWS = [
  { key: 'table',    label: 'Table',    icon: Table2 },
  { key: 'cards',    label: 'Cards',    icon: LayoutGrid },
  { key: 'graph',    label: 'Graph',    icon: Share2 },
  { key: 'coverage', label: 'Coverage', icon: Target },
  { key: 'discover', label: 'Discover', icon: UserSearch },
]

function NetworkTab({ contacts, apps, interactions, onRefresh, initialView = 'table' }) {
  const [filter, setFilter]   = useState('ALL')
  const [search, setSearch]   = useState('')
  const [view, setView]       = useState(initialView) // 'table' | 'cards' | 'graph'
  const [editing, setEditing] = useState(null)   // contact object | 'new' | null
  const [logOpen, setLogOpen] = useState(false)

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
              ? 'bg-accent-600 text-white border-accent-600'
              : 'bg-white text-ink-600 border-ink-200 hover:border-accent-300'}`}>
            {s === 'ALL' ? `All (${contacts.length})` : s}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-1 border border-ink-200 rounded-full text-xs focus:outline-none focus:border-accent-400 w-44" />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
            {NETWORK_VIEWS.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${view === v.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
                <v.icon size={13} strokeWidth={2.25} />
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setLogOpen(true)}
            className="px-3 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
            + Log Interaction
          </button>
          <button onClick={() => setEditing('new')}
            className="px-3 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">
            + Contact
          </button>
        </div>
      </div>

      {view === 'discover'
        ? <DiscoverTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={onRefresh} />
        : view === 'coverage'
        ? <ReferralCoverageTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={onRefresh} />
        : view === 'graph'
        ? <NetworkGraphTab contacts={contacts} />
        : filtered.length === 0
        ? <EmptyState msg={contacts.length === 0 ? 'No contacts yet — the email pipeline will add them as recruiting emails come in.' : 'No contacts match this filter.'} />
        : view === 'table'
        ? <ContactsTable contacts={filtered} onEdit={c => setEditing(c)} />
        : (
          <div className="space-y-2">
            {filtered.map(c => {
              const overdue = isOverdue(c)
              const lastSeen = daysSince(c.lastInteraction)
              return (
                <div key={c.id} onClick={() => setEditing(c)}
                  className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md cursor-pointer ${overdue ? 'border-danger-200' : 'border-ink-100'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{c.name}</span>
                        {c.company && <span className="text-sm text-ink-500">@ {c.company}</span>}
                        {c.role && <span className="text-xs text-ink-400">· {c.role}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge label={c.status} color={STATUS_COLOR[c.status]} icon={statusIconFor(c.status)} />
                        {c.urgency && c.urgency !== 'LOW' && <Badge label={c.urgency} color={URGENCY_COLOR[c.urgency]} icon={URGENCY_ICON[c.urgency]} />}
                        {c.referredByName && <Badge label={`↩ ${c.referredByName}`} color="bg-indigo-50 text-indigo-600" />}
                        {c.email && (
                          <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">{c.email}</a>
                        )}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">LinkedIn ↗</a>
                        )}
                      </div>
                      {c.whatTheyDid && (
                        <p className="text-xs text-ink-500 mt-1 line-clamp-1 italic">"{c.whatTheyDid}"</p>
                      )}
                      {!c.whatTheyDid && c.notes && (
                        <p className="text-xs text-ink-400 mt-1 line-clamp-1">{c.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1 text-xs">
                      {lastSeen !== null && (
                        <p className="text-ink-400">Last: {fmt(c.lastInteraction)}</p>
                      )}
                      {c.followUpDate && (
                        <p className={`font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
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

      {logOpen && (
        <LogInteractionModal
          contacts={contacts}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]           = useState('overview')
  const [networkInitialView, setNetworkInitialView] = useState('table')
  const [contacts, setContacts] = useState([])
  const [apps, setApps]         = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [lastLoaded, setLastLoaded] = useState(null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [addScheduleOpen, setAddScheduleOpen] = useState(false)

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
  const overdueCount = contacts.filter(isOverdue).length
  const staleCount = activeApps.filter(a => {
    const d = a.daysInStage ?? (a.lastActivity ? Math.floor((Date.now() - new Date(a.lastActivity)) / 86400000) : null)
    return d !== null && d > 14
  }).length
  const scheduleCount = contacts.filter(c => c.wantsToSchedule).length
  const actionCount = overdueCount + staleCount + scheduleCount

  const counts = {
    network: contacts.length,
    pipeline: activeApps.length,
    actions: actionCount > 0 ? actionCount : null,
  }

  return (
    <AppShell
      activeTab={tab}
      onTabChange={setTab}
      counts={counts}
      loading={loading}
      lastLoaded={lastLoaded}
      onRefresh={load}
      onAddEvent={() => setAddEventOpen(true)}
      onAddSchedule={() => setAddScheduleOpen(true)}
      error={error}
    >
      {loading && <EmptyState msg="Loading from Notion..." />}
      {!loading && tab === 'overview' && (
        <OverviewTab contacts={contacts} apps={apps} interactions={interactions}
          onOpenGraph={() => { setNetworkInitialView('graph'); setTab('network') }}
          onOpenActions={() => setTab('actions')} />
      )}
      {!loading && tab === 'network'  && (
        <NetworkTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={load} initialView={networkInitialView} />
      )}
      {!loading && tab === 'pipeline' && <PipelineTab apps={apps} onRefresh={load} />}
      {!loading && tab === 'actions'  && <ActionsTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={load} />}
      {!loading && tab === 'calendar' && <CalendarTab contacts={contacts} apps={apps} onRefresh={load} />}
      {tab === 'github'   && <GitHubTab apps={apps} onImported={load} />}

      {addEventOpen && <AddToCalendarModal onClose={() => setAddEventOpen(false)} />}
      {addScheduleOpen && (
        <QuickScheduleModal
          contacts={contacts}
          onClose={() => setAddScheduleOpen(false)}
          onSaved={() => { setAddScheduleOpen(false); load() }}
        />
      )}
    </AppShell>
  )
}
