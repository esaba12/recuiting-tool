import { parseJobDate } from './helpers.js'

export default function RepoStats({ jobs }) {
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
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-ink-100">
            <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent ? 'text-accent-600' : 'text-ink-900'}`}>{s.value}</p>
            <p className="text-xs text-ink-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* New this week */}
      {newThisWeek.length > 0 && (
        <div className="bg-accent-50 border border-accent-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-accent-700 mb-2">🆕 Added this week</p>
          <div className="flex flex-wrap gap-1.5">
            {newThisWeek.slice(0, 16).map((j, i) => (
              <span key={i} className="px-2.5 py-1 bg-white border border-accent-200 text-accent-800 text-xs rounded-full font-medium">
                {j.company}
              </span>
            ))}
            {newThisWeek.length > 16 && <span className="text-xs text-accent-400 self-center">+{newThisWeek.length - 16} more</span>}
          </div>
        </div>
      )}

      {/* Top locations */}
      {topLocs.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-ink-100">
          <p className="text-xs font-semibold text-ink-500 mb-3">Top Locations</p>
          <div className="space-y-1.5">
            {topLocs.map(([loc, count]) => (
              <div key={loc} className="flex items-center gap-2">
                <span className="text-xs text-ink-600 w-40 truncate">{loc}</span>
                <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-400 rounded-full" style={{ width: `${(count / topLocs[0][1]) * 100}%` }} />
                </div>
                <span className="text-xs text-ink-400 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Companies hiring for multiple roles */}
      {multiRole.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-ink-100">
          <p className="text-xs font-semibold text-ink-500 mb-2">Hiring Most Roles</p>
          <div className="flex flex-wrap gap-2">
            {multiRole.map(([co, n]) => (
              <span key={co} className="px-2.5 py-1 bg-ink-100 text-ink-700 text-xs rounded-full">
                {co} <span className="font-bold text-accent-600">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

