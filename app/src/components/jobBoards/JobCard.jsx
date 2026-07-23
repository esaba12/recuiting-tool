import { BUCKET_CONFIG, BUCKET_TAG, jobAgeDays, isGhostJob, daysUntilDeadline, urgencyTier } from './helpers.js'
import { BUCKET_ICON, LOCATION_ICON } from '../../lib/icons.js'

const DEADLINE_BADGE = {
  urgent: 'bg-danger-500 text-white',
  soon:   'bg-warning-400 text-white',
  known:  'bg-ink-100 text-ink-600',
}

function DeadlineBadge({ deadline }) {
  const tier = urgencyTier(deadline)
  if (tier === 'unknown') return null
  if (tier === 'rolling') return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-400">Rolling — no deadline</span>
  const days = daysUntilDeadline(deadline)
  const label = days < 0 ? 'Closed' : days === 0 ? 'Closes today' : `Closes in ${days}d`
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DEADLINE_BADGE[tier]}`}>⏰ {label}</span>
}

export default function JobCard({ job, status, blurb, deadline, onStatusChange, onClick }) {
  const initials = job.company.replace(/[^a-zA-Z ]/g, '').trim().slice(0, 2).toUpperCase() || '??'
  const isClosed = job.status === 'closed'
  const ageDays = jobAgeDays(job)
  const stale = isGhostJob(job)

  function toggleStatus(e, key) {
    e.stopPropagation()
    onStatusChange(status === key ? null : key)
  }

  return (
    <div onClick={() => !isClosed && onClick()}
      className={`bg-white rounded-xl border p-4 transition-all group
        ${isClosed ? 'opacity-40 cursor-default border-ink-100' :
          stale ? 'opacity-70 cursor-pointer border-ink-100 hover:border-accent-200 hover:shadow-md hover:-translate-y-0.5' :
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
          {blurb?.companyAbout && <p className="text-[11px] text-ink-400 mt-0.5 line-clamp-1 leading-tight">{blurb.companyAbout}</p>}
          {job.role && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2 leading-tight">{job.role}</p>}
          {blurb?.roleSummary && <p className="text-xs text-ink-400 mt-0.5 line-clamp-2 leading-tight">{blurb.roleSummary}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {job.location && (
              <span className="text-xs text-ink-400 truncate max-w-[140px] inline-flex items-center gap-0.5">
                <LOCATION_ICON size={11} />{job.location}
              </span>
            )}
            {job.dateAdded && <span className="text-xs text-ink-400">{job.dateAdded}</span>}
            {!isClosed && <DeadlineBadge deadline={deadline} />}
            {!isClosed && stale && (
              <span title={`No update detected in ${ageDays} days — may be a ghost listing`}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-100 text-warning-800">
                👻 Stale {ageDays}d
              </span>
            )}
            {!isClosed && ageDays === null && job.dateAdded && !/^[-—\s]+$/.test(job.dateAdded) && (
              <span title="Couldn't parse a posting date from this listing" className="text-[10px] text-ink-300">age unknown</span>
            )}
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

