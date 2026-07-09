import { useState, useMemo } from 'react'
import { archiveApplication } from '../notion.js'
import { STAGE_ORDER, STAGE_COLOR, TERMINAL_STAGES, daysSince, fmt, Badge, EmptyState, isUntriaged, findDuplicateGroups } from '../shared.jsx'

function DuplicatesPanel({ apps, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState(null)

  const groups = useMemo(() => findDuplicateGroups(apps), [apps])
  if (groups.length === 0) return null

  const extraCount = groups.reduce((sum, g) => sum + (g.length - 1), 0)

  async function dedupe() {
    setArchiving(true); setError(null)
    try {
      for (const g of groups) {
        const [, ...dupes] = g // keep the oldest (first), archive the rest
        for (const d of dupes) await archiveApplication(d.id)
      }
      onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-orange-800">
            <strong>{groups.length}</strong> duplicate group{groups.length !== 1 ? 's' : ''} found
            (<strong>{extraCount}</strong> extra row{extraCount !== 1 ? 's' : ''} — same company + role).
          </p>
          <p className="text-xs text-orange-600 mt-0.5">Matches exact company/role text only — differently-worded listings of the same job aren't caught.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="px-3 py-1.5 bg-white border border-orange-200 text-orange-700 text-xs rounded-lg hover:bg-orange-100 font-medium">
            {expanded ? 'Hide' : 'Review'}
          </button>
          <button onClick={() => { if (confirm(`Archive ${extraCount} duplicate row${extraCount !== 1 ? 's' : ''}? This keeps the oldest copy of each and archives the rest in Notion (recoverable from Notion's trash).`)) dedupe() }}
            disabled={archiving}
            className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium">
            {archiving ? 'Archiving...' : `Archive ${extraCount} duplicate${extraCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-danger-600 mt-2">{error}</p>}

      {expanded && (
        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
          {groups.map((g, i) => (
            <div key={i} className="bg-white rounded-lg border border-orange-100 px-3 py-2">
              <p className="text-xs font-semibold text-ink-700">{g[0].company} · {g[0].role || '(no role)'} — {g.length} copies</p>
              <div className="mt-1 space-y-0.5">
                {g.map((a, j) => (
                  <p key={a.id} className="text-[11px] text-ink-400">
                    {j === 0 ? '✓ keep' : '✕ archive'} · {a.stage} · {a.triage}{a.sourceRepo ? ` · ${a.sourceRepo}` : ''} · {fmt(a.createdTime)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

export default function PipelineTab({ apps, onRefresh }) {
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')

  const filtered = apps
    .filter(a => {
      if (filter === 'active' && (TERMINAL_STAGES.includes(a.stage) || isUntriaged(a))) return false
      if (filter === 'review' && !(a.triage === 'Needs Review' && a.stage === 'Wishlist')) return false
      if (search) {
        const q = search.toLowerCase()
        if (!a.company?.toLowerCase().includes(q) && !a.role?.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

  return (
    <div>
      <DuplicatesPanel apps={apps} onRefresh={onRefresh} />

      <div className="flex gap-2 mb-4 items-center">
        {[['active','Active'],['review','Needs Review'],['all','All incl. rejected']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === val
              ? 'bg-accent-600 text-white border-accent-600'
              : 'bg-white text-ink-600 border-ink-200 hover:border-accent-300'}`}>
            {label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, role..."
          className="ml-auto px-3 py-1 border border-ink-200 rounded-full text-xs focus:outline-none focus:border-accent-400 w-44" />
      </div>

      {filtered.length === 0
        ? <EmptyState msg={apps.length === 0 ? 'No applications yet. Add them in Notion or let the email pipeline populate them.' : 'No applications match this filter.'} />
        : (
          <div className="space-y-2">
            {filtered.map(a => {
              const days = a.daysInStage ?? daysSince(a.lastActivity)
              const stale = days !== null && days > 14 && !TERMINAL_STAGES.includes(a.stage) && a.stage !== 'Offer'
              return (
                <div key={a.id} className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md ${stale ? 'border-orange-200' : 'border-ink-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{a.company}</span>
                        {a.role && <span className="text-sm text-ink-500">· {a.role}</span>}
                        <Badge label={a.stage} color={STAGE_COLOR[a.stage]} />
                        {isUntriaged(a) && <Badge label={a.triage} color={a.triage === 'Pass' ? 'bg-danger-100 text-danger-500' : 'bg-ink-100 text-ink-500'} />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {a.appliedDate && <span className="text-xs text-ink-400">Applied {fmt(a.appliedDate)}</span>}
                        {days !== null && (
                          <span className={`text-xs ${stale ? 'text-orange-600 font-medium' : 'text-ink-400'}`}>
                            {days}d in stage{stale ? ' ⚠' : ''}
                          </span>
                        )}
                        {a.jdLink && (
                          <a href={a.jdLink} target="_blank" rel="noreferrer" className="text-xs text-accent-500 hover:underline">JD ↗</a>
                        )}
                      </div>
                      {a.notes && <p className="text-xs text-ink-400 mt-0.5 line-clamp-1">{a.notes}</p>}
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

