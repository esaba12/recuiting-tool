import { useEffect, useState } from 'react'
import { listEvents } from '../googleCalendar.js'
import { updateApplicationTriage, archiveApplication } from '../notion.js'
import { BUCKET_TO_TRIAGE, MONTH_NAMES } from './jobBoards/helpers.js'
import { Badge } from '../shared.jsx'
import ContactDetailModal from './ContactDetailModal.jsx'
import ApplicationDetailModal from './ApplicationDetailModal.jsx'
import EventDetailModal from './EventDetailModal.jsx'
import AddEventModal from './AddEventModal.jsx'

const OVERLAYS = [
  { key: 'events',       label: 'Events',       dot: 'bg-accent-600',  chipActive: 'bg-accent-600 text-white border-accent-600' },
  { key: 'followups',    label: 'Follow-ups',   dot: 'bg-indigo-500',  chipActive: 'bg-indigo-500 text-white border-indigo-500' },
  { key: 'applications', label: 'Applications', dot: 'bg-success-500', chipActive: 'bg-success-500 text-white border-success-500' },
]

function pad(n) { return String(n).padStart(2, '0') }
function dayKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }

// Google's dateTime events carry their own offset, so bucket them into a local
// calendar day via Date object math — never by slicing the ISO string, which can
// land an evening event on the wrong day depending on the viewer's timezone.
function eventDayKey(event) {
  const d = event.allDay ? new Date(`${event.start}T00:00:00`) : new Date(event.start)
  return dayKey(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function CalendarTab({ contacts, apps, onRefresh }) {
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [eventsByMonth, setEventsByMonth] = useState({}) // 'YYYY-MM' -> normalized event[]
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsError, setEventsError] = useState(null)
  const [visible, setVisible] = useState({ events: true, followups: true, applications: true })
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedContact, setSelectedContact] = useState(null)
  const [selectedApp, setSelectedApp] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [addEventOpen, setAddEventOpen] = useState(false)

  const year = viewDate.getFullYear()
  const mo   = viewDate.getMonth()
  const monthKey = `${year}-${pad(mo + 1)}`

  function fetchMonth(y, m) {
    const timeMin = new Date(y, m, 1).toISOString()
    const timeMax = new Date(y, m + 1, 1).toISOString()
    return listEvents({ timeMin, timeMax })
  }

  useEffect(() => {
    if (eventsByMonth[monthKey]) return
    let cancelled = false
    setLoadingEvents(true); setEventsError(null)
    fetchMonth(year, mo)
      .then(events => { if (!cancelled) setEventsByMonth(m => ({ ...m, [monthKey]: events })) })
      .catch(e => { if (!cancelled) setEventsError(e.message) })
      .finally(() => { if (!cancelled) setLoadingEvents(false) })
    return () => { cancelled = true }
  }, [monthKey])

  // Unlike the effect above (which only fetches if uncached), this always re-fetches —
  // used after a create/delete so the grid reflects the change immediately.
  async function refetchMonth() {
    setLoadingEvents(true); setEventsError(null)
    try {
      const events = await fetchMonth(year, mo)
      setEventsByMonth(m => ({ ...m, [monthKey]: events }))
    } catch (e) {
      setEventsError(e.message)
    } finally {
      setLoadingEvents(false)
    }
  }

  // Build a day -> { events[], followups[], applications[] } map for the visible month
  const itemsByDay = {}
  function addItem(key, type, item) {
    if (!itemsByDay[key]) itemsByDay[key] = { events: [], followups: [], applications: [] }
    itemsByDay[key][type].push(item)
  }
  ;(eventsByMonth[monthKey] || []).forEach(ev => addItem(eventDayKey(ev), 'events', ev))
  contacts.forEach(c => {
    if (!c.followUpDate) return
    const key = c.followUpDate.slice(0, 10)
    if (key.slice(0, 7) === monthKey) addItem(key, 'followups', c)
  })
  apps.forEach(a => {
    if (!a.appliedDate) return
    const key = a.appliedDate.slice(0, 10)
    if (key.slice(0, 7) === monthKey) addItem(key, 'applications', a)
  })

  const firstDow    = new Date(year, mo, 1).getDay()
  const daysInMonth = new Date(year, mo + 1, 0).getDate()
  const cells       = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const today = new Date()
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate())

  function toggle(key) { setVisible(v => ({ ...v, [key]: !v[key] })) }

  async function changeAppTriage(app, bucketKey) {
    await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
    onRefresh()
  }

  const selectedItems = selectedDay ? (itemsByDay[selectedDay] || { events: [], followups: [], applications: [] }) : null

  return (
    <div className="space-y-4">
      {/* Overlay toggles + add event */}
      <div className="flex gap-2 flex-wrap items-center">
        {OVERLAYS.map(o => (
          <button key={o.key} onClick={() => toggle(o.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${visible[o.key]
              ? o.chipActive
              : 'bg-white text-ink-600 border-ink-200 hover:border-accent-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${visible[o.key] ? 'bg-white' : o.dot}`} />
            {o.label}
          </button>
        ))}
        <button onClick={() => setAddEventOpen(true)}
          className="ml-auto px-3 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">
          + Add Event
        </button>
      </div>

      {eventsError && (
        <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">
          Couldn't load Google Calendar events: {eventsError}
        </div>
      )}

      {/* Month grid */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { setViewDate(new Date(year, mo - 1, 1)); setSelectedDay(null) }}
            className="p-1.5 hover:bg-ink-100 rounded-lg text-ink-500 text-sm">←</button>
          <div className="text-center">
            <p className="font-semibold text-ink-800 text-sm">{MONTH_NAMES[mo]} {year}</p>
            {loadingEvents && <p className="text-xs text-ink-400">Loading events...</p>}
          </div>
          <button onClick={() => { setViewDate(new Date(year, mo + 1, 1)); setSelectedDay(null) }}
            className="p-1.5 hover:bg-ink-100 rounded-lg text-ink-500 text-sm">→</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-ink-400 py-1">{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />
            const key = dayKey(year, mo, d)
            const items = itemsByDay[key]
            const isSel = selectedDay === key
            const isTod = key === todayKey
            const dots = OVERLAYS.filter(o => visible[o.key] && items?.[o.key]?.length > 0)
            return (
              <button key={d} onClick={() => setSelectedDay(isSel ? null : key)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-xs font-medium transition-all cursor-pointer hover:bg-ink-50
                  ${isSel ? 'ring-2 ring-accent-500 ring-offset-1' : ''}
                  ${isTod ? 'bg-accent-50 text-accent-600' : 'text-ink-600'}`}>
                <span>{d}</span>
                {dots.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    {dots.map(o => <span key={o.key} className={`w-1.5 h-1.5 rounded-full ${o.dot}`} />)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day agenda */}
      {selectedDay && (
        <div className="space-y-2">
          {visible.events && selectedItems.events.map(ev => (
            <button key={ev.id} onClick={() => setSelectedEvent(ev)}
              className="w-full text-left bg-white rounded-xl px-4 py-3 shadow-sm border border-ink-100 hover:shadow-md hover:border-accent-200 transition-all flex items-center gap-3">
              <Badge label="Event" color="bg-accent-100 text-accent-700" />
              <span className="text-sm font-medium text-ink-900 truncate">{ev.title}</span>
              {!ev.allDay && <span className="text-xs text-ink-400 ml-auto shrink-0">{new Date(ev.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>}
            </button>
          ))}
          {visible.followups && selectedItems.followups.map(c => (
            <button key={c.id} onClick={() => setSelectedContact(c)}
              className="w-full text-left bg-white rounded-xl px-4 py-3 shadow-sm border border-ink-100 hover:shadow-md hover:border-accent-200 transition-all flex items-center gap-3">
              <Badge label="Follow-up" color="bg-indigo-50 text-indigo-600" />
              <span className="text-sm font-medium text-ink-900 truncate">{c.name}</span>
              {c.company && <span className="text-xs text-ink-500 truncate">@ {c.company}</span>}
            </button>
          ))}
          {visible.applications && selectedItems.applications.map(a => (
            <button key={a.id} onClick={() => setSelectedApp(a)}
              className="w-full text-left bg-white rounded-xl px-4 py-3 shadow-sm border border-ink-100 hover:shadow-md hover:border-accent-200 transition-all flex items-center gap-3">
              <Badge label="Applied" color="bg-success-50 text-success-700" />
              <span className="text-sm font-medium text-ink-900 truncate">{a.company}</span>
              {a.role && <span className="text-xs text-ink-500 truncate">· {a.role}</span>}
            </button>
          ))}
          {selectedItems.events.length + selectedItems.followups.length + selectedItems.applications.length === 0 && (
            <p className="text-xs text-ink-400 text-center py-4">Nothing on this day.</p>
          )}
        </div>
      )}

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          contacts={contacts}
          onClose={() => setSelectedContact(null)}
          onSaved={() => { setSelectedContact(null); onRefresh() }}
        />
      )}

      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onStatusChange={s => changeAppTriage(selectedApp, s)}
          onClose={() => setSelectedApp(null)}
          onDelete={async () => { await archiveApplication(selectedApp.id); setSelectedApp(null); onRefresh() }}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDeleted={() => { setSelectedEvent(null); refetchMonth() }}
        />
      )}

      {addEventOpen && (
        <AddEventModal
          defaultDate={selectedDay || undefined}
          onClose={() => setAddEventOpen(false)}
          onCreated={() => { setAddEventOpen(false); refetchMonth() }}
        />
      )}
    </div>
  )
}
