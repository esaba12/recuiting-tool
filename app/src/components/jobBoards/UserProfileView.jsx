import { topLanguages, parseEvents, buildWeeks } from '../../github.js'
import { LANG_COLOR, EVENT_LABELS, timeAgo } from './helpers.js'
import ContributionGrid from './ContributionGrid.jsx'

export default function UserProfileView({ data, onClear }) {
  const weeks  = buildWeeks(data.contributions)
  const langs  = topLanguages(data.repos || [])
  const { recent } = parseEvents(data.events || [])
  const profile = data?.profile

  if (!profile) return (
    <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl text-sm text-warning-700">
      Profile data unavailable — username may not exist or GitHub rate-limited the request.
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
        <div className="flex items-start gap-4">
          <img src={profile.avatar_url} alt={profile.login}
            className="w-16 h-16 rounded-full border border-ink-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-ink-900">{profile.name || profile.login}</h2>
              <a href={profile.html_url} target="_blank" rel="noreferrer"
                className="text-xs text-accent-500 hover:underline">@{profile.login} ↗</a>
            </div>
            {profile.bio && <p className="text-sm text-ink-600 mt-0.5">{profile.bio}</p>}
            <div className="flex gap-4 mt-2 text-xs text-ink-500 flex-wrap">
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.company  && <span>🏢 {profile.company}</span>}
              <span>📦 {profile.public_repos} repos</span>
              <span>👥 {profile.followers} followers</span>
            </div>
          </div>
          <button onClick={onClear} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
        </div>
      </div>

      {weeks.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Contribution Timeline</h3>
          <ContributionGrid weeks={weeks} total={data.contributions?.total} />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-ink-100">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Recent Repos</h3>
          <div className="space-y-3">
            {(data.repos || []).filter(r => !r.fork).slice(0, 6).map(r => (
              <div key={r.id}>
                <a href={r.html_url} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-accent-600 hover:underline">{r.name}</a>
                {r.description && <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{r.description}</p>}
                <div className="flex gap-3 mt-1 text-xs text-ink-400">
                  {r.language && <span>{r.language}</span>}
                  {r.stargazers_count > 0 && <span>★ {r.stargazers_count}</span>}
                  <span>Updated {timeAgo(r.pushed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Languages</h3>
          <div className="space-y-2.5">
            {langs.map(([lang, count], i) => {
              const pct = Math.round((count / (data.repos?.filter(r=>!r.fork&&r.language).length || 1)) * 100)
              return (
                <div key={lang}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-ink-700">{lang}</span>
                    <span className="text-ink-400">{count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${LANG_COLOR[i % LANG_COLOR.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {recent.map((e, i) => {
              const label = EVENT_LABELS[e.type] || e.type.replace('Event', '')
              const repo  = e.repo?.name || ''
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-ink-400 text-xs w-16 shrink-0">{timeAgo(e.created_at)}</span>
                  <span className="text-ink-600 shrink-0 text-xs">{label}</span>
                  <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer"
                    className="text-accent-500 hover:underline text-xs truncate">{repo}</a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

