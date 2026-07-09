import { LEVEL_COLOR } from './helpers.js'

export default function ContributionGrid({ weeks, total }) {
  const thisYear = new Date().getFullYear()
  const totalThisYear = total?.[thisYear] ?? total?.[Object.keys(total || {}).pop()] ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-ink-600">{totalThisYear} contributions in the last year</p>
        <div className="flex items-center gap-1 text-xs text-ink-400">
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

