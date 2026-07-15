import { tieStrengthBucket } from './affinity.js'

// Passive "stay in touch" cadence layer. Distinct from the Follow-Up Date / Actions system,
// which handles *explicit* post-interaction to-dos ("email them back by Friday"). This layer
// answers the quieter question — "who am I drifting out of touch with?" — purely from how
// long it's been since the last interaction, with the interval set by tie strength.
//
// Zero Notion migration: cadence is a client-side POLICY derived from existing fields
// (Last Interaction + interaction count), not a stored per-contact property. Change the
// policy here and every contact re-buckets instantly.
//
// Cadence choice is inverted-U aware (see affinity.js's Rajkumar et al. citation): MODERATE
// ties — the ones most likely to transmit a referral/job — get the tightest reconnect
// interval, not the strong ties you already talk to constantly.
export const DEFAULT_CADENCE = { strong: 45, moderate: 30, weak: 75, cold: 120 }

const DAY = 86400000
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// Days between reconnects for this contact, or null if they shouldn't be resurfaced
// (Closed relationships are intentionally parked, not nagged).
export function cadenceDays(contact, interactions, settings = DEFAULT_CADENCE) {
  if (contact.status === '✅ Closed') return null
  const bucket = tieStrengthBucket(contact, interactions)
  return settings[bucket] ?? DEFAULT_CADENCE[bucket]
}

// The most recent interaction with this contact (for "last point of contact" display).
export function lastPointOfContact(contact, interactions) {
  return (interactions || [])
    .filter(i => i.contactId === contact.id)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null
}

// -> { cadence, dueDate, overdueDays, never } or null if the contact is parked.
// `never` = we have a cadence but no Last Interaction on record yet (never logged a touch).
export function reconnectStatus(contact, interactions, settings = DEFAULT_CADENCE) {
  const cadence = cadenceDays(contact, interactions, settings)
  if (cadence == null) return null

  const base = contact.lastInteraction ? startOfDay(contact.lastInteraction) : null
  if (!base) return { cadence, dueDate: null, overdueDays: null, never: true }

  const dueDate = new Date(base.getTime() + cadence * DAY)
  const overdueDays = Math.floor((startOfDay(Date.now()) - dueDate) / DAY)
  return { cadence, dueDate, overdueDays, never: false }
}

// The resurfacing queue: contacts due or overdue to reconnect, most-overdue first.
// Contacts with an explicit future Follow-Up Date are skipped — they already have a
// concrete plan owned by the Actions tab, so surfacing them here too would double-nag.
export function keepInTouchQueue(contacts, interactions, settings = DEFAULT_CADENCE) {
  const today = startOfDay(Date.now())
  return (contacts || [])
    .map(c => ({ contact: c, status: reconnectStatus(c, interactions, settings) }))
    .filter(({ contact, status }) => {
      if (!status) return false
      if (contact.followUpDate && startOfDay(contact.followUpDate) > today) return false // has a plan
      if (status.never) return true            // never logged a touch → surface
      return status.overdueDays >= 0           // due today or overdue
    })
    .sort((a, b) => {
      // "never contacted" sinks below genuinely-overdue reconnects (you likely just added them)
      const ao = a.status.never ? -1 : a.status.overdueDays
      const bo = b.status.never ? -1 : b.status.overdueDays
      return bo - ao
    })
}
