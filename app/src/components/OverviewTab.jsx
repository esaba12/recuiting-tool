import { STATUS_COLOR, TERMINAL_STAGES, INTERVIEW_STAGES, daysSince, daysUntil, isUntriaged } from '../shared.jsx'

function KPI({ label, value, sub, accent = false }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
      <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-accent-600' : 'text-ink-900'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

export default function OverviewTab({ contacts, apps }) {
  const reviewQueue  = apps.filter(a => a.triage === 'Needs Review' && a.stage === 'Wishlist')
  const triagedApps  = apps.filter(a => !isUntriaged(a))
  const activeApps   = triagedApps.filter(a => !TERMINAL_STAGES.includes(a.stage))
  const interviews   = triagedApps.filter(a => INTERVIEW_STAGES.includes(a.stage))
  const offers       = triagedApps.filter(a => a.stage === 'Offer')
  const warmContacts = contacts.filter(c => c.status === '🟢 Warm')

  const overdueContacts = contacts.filter(c =>
    c.status !== '✅ Closed' && c.followUpDate && daysUntil(c.followUpDate) <= 0
  ).sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))

  const staleApps = activeApps.filter(a => {
    const d = a.daysInStage ?? daysSince(a.lastActivity)
    return d !== null && d > 14
  })

  const stageCounts = {}
  triagedApps.forEach(a => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1 })
  const funnelStages = ['Wishlist','Applied','Phone Screen','Technical','Onsite','Offer']
  const maxCount = Math.max(...funnelStages.map(s => stageCounts[s] || 0), 1)

  const barColors = ['bg-ink-300','bg-accent-400','bg-warning-400','bg-orange-400','bg-purple-400','bg-success-500']

  return (
    <div className="space-y-6">
      {reviewQueue.length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-warning-800">
            <strong>{reviewQueue.length}</strong> job{reviewQueue.length !== 1 ? 's' : ''} imported from your boards {reviewQueue.length !== 1 ? 'are' : 'is'} waiting for review.
          </p>
          <span className="text-xs text-warning-600 shrink-0">Sort them in Job Boards → Needs Review</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Contacts" value={contacts.length} sub={`${warmContacts.length} warm`} />
        <KPI label="Active Apps" value={activeApps.length} sub={`${apps.filter(a=>a.stage==='Applied').length} awaiting response`} />
        <KPI label="Interviews" value={interviews.length} accent={interviews.length > 0} sub={interviews.length ? interviews.map(i=>i.company).join(', ') : 'none yet'} />
        <KPI label="Offers" value={offers.length} accent={offers.length > 0} sub={offers.length ? offers.map(o=>o.company).join(', ') : 'keep pushing'} />
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
        <h2 className="text-sm font-semibold text-ink-700 mb-5">Application Funnel</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-ink-400">No applications yet. Add them in Notion or let the email pipeline populate them.</p>
        ) : (
          <>
            <div className="flex items-end gap-2 h-24">
              {funnelStages.map((stage, i) => {
                const count = stageCounts[stage] || 0
                const h = Math.max(count > 0 ? (count / maxCount) * 80 : 0, count > 0 ? 6 : 0)
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-ink-700">{count || ''}</span>
                    <div className={`w-full rounded-t transition-all ${barColors[i]}`} style={{ height: `${h}px` }} />
                    <span className="text-xs text-ink-400 text-center leading-tight">{stage}</span>
                  </div>
                )
              })}
            </div>
            {(stageCounts.Rejected || stageCounts.Accepted) && (
              <p className="text-xs text-ink-400 mt-3">
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
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-danger-700 mb-3">
            Needs Attention ({overdueContacts.length + staleApps.length})
          </h2>
          <div className="space-y-2.5">
            {overdueContacts.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-800 font-medium">{c.name}
                  {c.company && <span className="font-normal text-ink-500"> @ {c.company}</span>}
                </span>
                <span className="text-danger-600 text-xs font-medium">
                  Follow-up {Math.abs(daysUntil(c.followUpDate))}d overdue
                </span>
              </div>
            ))}
            {staleApps.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-800 font-medium">{a.company}
                  <span className="font-normal text-ink-500"> ({a.stage})</span>
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
      <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
        <h2 className="text-sm font-semibold text-ink-700 mb-4">Network</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-ink-400">No contacts yet.</p>
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
