import { HeartHandshake, MessageSquarePlus, Clock } from 'lucide-react'
import { keepInTouchQueue, lastPointOfContact, DEFAULT_CADENCE } from '../lib/keepInTouch.js'
import { tieStrengthBucket } from '../lib/affinity.js'
import { STATUS_COLOR, TYPE_COLOR, Badge, EmptyState, fmt } from '../shared.jsx'
import { statusIconFor } from '../lib/icons.js'
import MetButton from './MetButton.jsx'

const TIE_LABEL = { strong: 'Close tie', moderate: 'Moderate tie', weak: 'Weak tie', cold: 'Not yet connected' }

// The passive "who am I drifting out of touch with?" view. Reads purely from Last
// Interaction + interaction history (see lib/keepInTouch.js) — no new Notion fields. Each
// person shows their last point of contact and two ways to reconnect: a one-tap "Met"
// (see MetButton) for a fast record with no notes, or "Log" for the full modal.
export default function KeepInTouchTab({ contacts, interactions, onEdit, onLog, onMet }) {
  const queue = keepInTouchQueue(contacts, interactions)

  return (
    <div>
      <div className="flex items-start gap-3 mb-4 rounded-xl border border-ink-100 bg-white px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">
          <HeartHandshake size={17} className="text-accent-600" />
        </div>
        <div className="text-xs text-ink-500 leading-relaxed">
          <span className="font-semibold text-ink-700">Reconnect before ties go cold.</span>{' '}
          Cadence is set by how well you know someone — moderate ties every {DEFAULT_CADENCE.moderate}d,
          close ties every {DEFAULT_CADENCE.strong}d, weaker ties every {DEFAULT_CADENCE.weak}d.
          People with a scheduled follow-up already live in <span className="font-medium">Actions</span>, so they're not repeated here.
        </div>
      </div>

      {queue.length === 0 ? (
        <EmptyState msg="You're all caught up — nobody's overdue to reconnect right now. 🎉" />
      ) : (
        <div className="space-y-2">
          {queue.map(({ contact: c, status }) => {
            const last = lastPointOfContact(c, interactions)
            const bucket = tieStrengthBucket(c, interactions)
            const overdue = !status.never && status.overdueDays > 0
            return (
              <div key={c.id}
                className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md ${overdue ? 'border-accent-200' : 'border-ink-100'}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => onEdit(c)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink-900">{c.name}</span>
                      {c.company && <span className="text-sm text-ink-500">@ {c.company}</span>}
                      {c.role && <span className="text-xs text-ink-400">· {c.role}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge label={c.status} color={STATUS_COLOR[c.status]} icon={statusIconFor(c.status)} />
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
                        <Clock size={11} /> {TIE_LABEL[bucket]} · every {status.cadence}d
                      </span>
                    </div>
                    {/* Last point of contact */}
                    <div className="mt-2 text-xs text-ink-500">
                      {last ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <Badge label={last.type} color={TYPE_COLOR[last.type] || TYPE_COLOR.Other} />
                          <span className="text-ink-400">{fmt(last.date)}</span>
                          {last.summary && <span className="text-ink-500 line-clamp-1 italic">— "{last.summary}"</span>}
                        </span>
                      ) : (
                        <span className="text-ink-400">No interaction logged yet — say hello to start the thread.</span>
                      )}
                    </div>
                  </button>

                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <span className={`text-xs font-semibold ${overdue ? 'text-accent-700' : 'text-ink-400'}`}>
                      {status.never
                        ? 'Never contacted'
                        : status.overdueDays > 0
                          ? `${status.overdueDays}d overdue`
                          : 'Due today'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <MetButton contact={c} onMet={onMet} />
                      <button onClick={() => onLog(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">
                        <MessageSquarePlus size={12} /> Log
                      </button>
                    </div>
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
