import { BUCKET_CONFIG, BUCKET_TAG } from './helpers.js'
import { BUCKET_ICON, LOCATION_ICON } from '../../lib/icons.js'

export default function JobCard({ job, status, onStatusChange, onClick }) {
  const initials = job.company.replace(/[^a-zA-Z ]/g, '').trim().slice(0, 2).toUpperCase() || '??'
  const isClosed = job.status === 'closed'

  function toggleStatus(e, key) {
    e.stopPropagation()
    onStatusChange(status === key ? null : key)
  }

  return (
    <div onClick={() => !isClosed && onClick()}
      className={`bg-white rounded-xl border p-4 transition-all group
        ${isClosed ? 'opacity-40 cursor-default border-ink-100' :
          'cursor-pointer border-ink-100 hover:border-accent-200 hover:shadow-md hover:-translate-y-0.5'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 select-none
          ${status === 'applying' ? 'bg-accent-100 text-accent-700' :
            status === 'maybe'   ? 'bg-warning-100 text-warning-700' :
            status === 'applied' ? 'bg-success-100 text-success-700' :
            status === 'pass'    ? 'bg-danger-50 text-danger-400' :
            'bg-ink-100 text-ink-500'}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-ink-900 text-sm leading-tight truncate">{job.company}</p>
            {/* Heart = Applying quick-action */}
            <button onClick={e => toggleStatus(e, 'applying')}
              className={`shrink-0 text-base leading-none transition-transform active:scale-125
                ${status === 'applying' ? 'text-accent-500' : 'text-ink-200 hover:text-accent-400'}`}>
              {status === 'applying' ? '♥' : '♡'}
            </button>
          </div>
          {job.role && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2 leading-tight">{job.role}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {job.location && (
              <span className="text-xs text-ink-400 truncate max-w-[140px] inline-flex items-center gap-0.5">
                <LOCATION_ICON size={11} />{job.location}
              </span>
            )}
            {job.dateAdded && <span className="text-xs text-ink-400">{job.dateAdded}</span>}
          </div>
          {/* Status row */}
          <div className="flex items-center gap-1 mt-2.5">
            {status
              ? (() => {
                  const Icon = BUCKET_ICON[status]
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${BUCKET_TAG[status]}`}>
                      {Icon && <Icon size={10} strokeWidth={2.5} />}
                      {BUCKET_CONFIG.find(b => b.key === status)?.label}
                    </span>
                  )
                })()
              : <span className="text-[10px] text-ink-300 group-hover:text-ink-400">click to view</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

