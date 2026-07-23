import { addInteraction, updateContact } from '../db.js'

// Matches the +3d follow-up convention used elsewhere (email pipeline's upsertContact,
// notion.js's addContact) — the default cadence for "something's now in motion, check back soon."
export const MET_FOLLOW_UP_DAYS = 3

// One-tap "met with them" — for when you don't have (or don't want to type) notes, just a
// fast record that a touchpoint happened plus a nudge to follow up. Distinct from
// LogInteractionModal, which is for when you *do* want to capture notes/a transcript.
export async function logMetWithContact(contact) {
  const today     = new Date().toISOString().split('T')[0]
  const followUp  = new Date(Date.now() + MET_FOLLOW_UP_DAYS * 86400000).toISOString().split('T')[0]

  await addInteraction({
    contactId:   contact.id,
    contactName: contact.name,
    type:        'Meeting',
    direction:   'N/A',
    date:        today,
    summary:     'Met with them (quick log)',
  })
  await updateContact(contact.id, { lastInteraction: today, followUpDate: followUp })
}
