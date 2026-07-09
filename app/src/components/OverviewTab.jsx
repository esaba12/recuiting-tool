import { STATUS_COLOR, TERMINAL_STAGES, INTERVIEW_STAGES, daysSince, daysUntil, isUntriaged } from '../shared.jsx'
import BarChartWrapper from './charts/BarChart.jsx'
import DonutChart from './charts/DonutChart.jsx'
import TrendChart from './charts/TrendChart.jsx'
import { STATUS_CHART_COLORS } from './charts/theme.js'

function KPI({ label, value, sub, accent = false }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
      <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-accent-600' : 'text-ink-900'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </div>
  )
}

// Monday-anchored ISO week start, used to bucket interactions for the trend chart.
function weekStart(d) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // 0=Monday
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

export default function OverviewTab({ contacts, apps, interactions = [] }) {
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
  const funnelData = funnelStages.map(stage => ({ label: stage, value: stageCounts[stage] || 0 }))

  // Stage-to-stage conversion — new signal, cheap given stageCounts already exists.
  const conversions = []
  for (let i = 0; i < funnelStages.length - 1; i++) {
    const from = stageCounts[funnelStages[i]] || 0
    const to = stageCounts[funnelStages[i + 1]] || 0
    if (from > 0) conversions.push({ from: funnelStages[i], to: funnelStages[i + 1], pct: Math.round((to / from) * 100) })
  }

  const donutData = Object.keys(STATUS_COLOR)
    .map(status => ({ label: status, value: contacts.filter(c => c.status === status).length, color: STATUS_CHART_COLORS[status] }))
    .filter(d => d.value > 0)

  // Interactions over the trailing 10 weeks — a signal not visualized anywhere else today.
  const trendWeeks = []
  const now = weekStart(new Date())
  for (let i = 9; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(start.getDate() - i * 7)
    trendWeeks.push(start)
  }
  const trendData = trendWeeks.map(start => {
    const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const count = interactions.filter(x => x.date && weekStart(x.date).getTime() === start.getTime()).length
    return { label, count }
  })
  const hasInteractions = interactions.length > 0

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
        <h2 className="text-sm font-semibold text-ink-700 mb-4">Application Funnel</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-ink-400">No applications yet. Add them in Notion or let the email pipeline populate them.</p>
        ) : (
          <>
            <BarChartWrapper data={funnelData} height={180} />
            {conversions.length > 0 && (
              <p className="text-xs text-ink-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {conversions.map(c => (
                  <span key={c.to}>{c.from} → {c.to}: <span className="font-medium text-ink-600">{c.pct}%</span></span>
                ))}
              </p>
            )}
            {(stageCounts.Rejected || stageCounts.Accepted) && (
              <p className="text-xs text-ink-400 mt-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network status donut */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">Network by Status</h2>
          {contacts.length === 0
            ? <p className="text-sm text-ink-400">No contacts yet.</p>
            : <DonutChart data={donutData} centerLabel="contacts" />}
        </div>

        {/* Interactions over time */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">Networking Activity</h2>
          {!hasInteractions
            ? <p className="text-sm text-ink-400">No logged interactions yet — use "+ Log Interaction" in Network.</p>
            : <TrendChart data={trendData} />}
        </div>
      </div>
    </div>
  )
}
