import { useState } from 'react'
import { deleteEvent } from '../googleCalendar.js'

function formatWhen(event) {
  if (event.allDay) {
    return new Date(`${event.start}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  const start = new Date(event.start)
  const end = new Date(event.end)
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  return `${dateStr} · ${timeStr}`
}

export default function EventDetailModal({ event, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  async function del() {
    if (!confirm(`Delete "${event.title}" from your Google Calendar? This cannot be undone.`)) return
    setDeleting(true); setError(null)
    try {
      await deleteEvent(event.id)
      onDeleted()
    } catch (e) {
      setError(e.message)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 rounded-t-2xl md:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-bold text-ink-900 truncate">{event.title}</h2>
            <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
          </div>
          <p className="text-sm text-ink-500 mt-1">{formatWhen(event)}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

          {event.location && (
            <p className="text-sm text-ink-600">📍 {event.location}</p>
          )}
          {event.description && (
            <p className="text-sm text-ink-600 whitespace-pre-wrap">{event.description}</p>
          )}
          {event.htmlLink && (
            <a href={event.htmlLink} target="_blank" rel="noreferrer" className="text-xs text-accent-500 hover:underline">
              Open in Google Calendar ↗
            </a>
          )}

          <button onClick={del} disabled={deleting}
            className="w-full py-2 mt-2 text-danger-600 text-xs rounded-xl hover:bg-danger-50 disabled:opacity-50 font-medium transition-colors">
            {deleting ? 'Deleting...' : 'Delete Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
