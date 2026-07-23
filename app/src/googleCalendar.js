import { authHeader } from './lib/supabaseClient.js'

async function gcalFetch(path, { method = 'GET', body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(query)}` : ''
  const res = await fetch(`/google-calendar/calendar/v3/calendars/primary/${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `Calendar API ${res.status}`)
  }
  return res.status === 204 ? null : res.json() // DELETE returns 204 with no body
}

function normalizeEvent(item) {
  const allDay = !item.start?.dateTime
  return {
    id: item.id,
    title: item.summary || '(untitled)',
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date,
    allDay,
    location: item.location || null,
    description: item.description || null,
    htmlLink: item.htmlLink || null,
  }
}

export async function listEvents({ timeMin, timeMax }) {
  let items = []
  let pageToken
  do {
    const data = await gcalFetch('events', {
      query: {
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      },
    })
    items = items.concat(data.items || [])
    pageToken = data.nextPageToken
  } while (pageToken)
  return items.map(normalizeEvent)
}

export function addOneHour(time) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  d.setHours(d.getHours() + 1)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export async function createEvent({ title, date, startTime, endTime, location, description }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = {
    summary: title || 'Untitled event',
    location: location || undefined,
    description: description || undefined,
    start: startTime ? { dateTime: `${date}T${startTime}:00`, timeZone } : { date },
    end:   endTime   ? { dateTime: `${date}T${endTime}:00`,   timeZone } : { date },
  }
  return gcalFetch('events', { method: 'POST', body })
}

// Note: with singleEvents=true, list() returns per-occurrence ids for recurring
// events, so deleting one of those ids removes only that occurrence, not the series.
export async function deleteEvent(eventId) {
  return gcalFetch(`events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
}
