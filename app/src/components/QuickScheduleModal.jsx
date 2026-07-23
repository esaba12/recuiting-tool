import { useState } from 'react'
import { searchContactByName, addContact, updateContact } from '../db.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'

function defaultScheduleBy() {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
}

// Fast-add entry point for "I know I want to talk to this person and need to get
// something on the calendar with them" — deliberately much lighter than
// ContactDetailModal's full form. Sets Wants To Schedule=true on the contact (creating
// one if they don't exist yet), which ActionsTab surfaces as a reminder until you mark
// it scheduled or check it off in the contact's own record.
export default function QuickScheduleModal({ contacts = [], onClose, onSaved }) {
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState(null) // set when picked from typeahead
  const [company, setCompany] = useState('')
  const [note, setNote] = useState('')
  const [scheduleBy, setScheduleBy] = useState(defaultScheduleBy())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const nameMatches = !selectedId && name.trim().length > 1
    ? contacts.filter(c => c.name.toLowerCase().includes(name.toLowerCase())).slice(0, 5)
    : []

  function pick(c) {
    setSelectedId(c.id)
    setName(c.name)
    setCompany(c.company || '')
  }

  function onNameChange(v) {
    setName(v)
    setSelectedId(null) // typing again after a pick means they may want someone else
  }

  async function save() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      let contactId = selectedId
      if (!contactId) {
        const existing = await searchContactByName(name.trim())
        contactId = existing ? existing.id : (await addContact({ name: name.trim(), company: company.trim() })).id
      }
      await updateContact(contactId, {
        wantsToSchedule: true,
        scheduleBy: scheduleBy || null,
        scheduleNote: note.trim() || null,
      })
      onSaved?.()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} size="sm">
      <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between">
        <h2 className="text-base font-heading font-semibold text-ink-900">+ Schedule</h2>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

        <div className="relative">
          <label className="block text-xs text-ink-400 mb-0.5">Who do you want to schedule with?</label>
          <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Start typing a name..." autoFocus
            className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
          {nameMatches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
              {nameMatches.map(c => (
                <button key={c.id} onClick={() => pick(c)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-ink-50">
                  {c.name}{c.company ? ` @ ${c.company}` : ''}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ink-400 mt-1">
            {selectedId ? 'Existing contact selected.' : 'Not found? A new contact will be created.'}
          </p>
        </div>

        {!selectedId && (
          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Company (optional)</label>
            <input value={company} onChange={e => setCompany(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
          </div>
        )}

        <div>
          <label className="block text-xs text-ink-400 mb-0.5">Why / what to discuss (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="e.g. wants to ask about return-offer timeline"
            className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-0.5">Schedule by</label>
          <input type="date" value={scheduleBy} onChange={e => setScheduleBy(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? 'Saving...' : '+ Add to Schedule Queue'}
        </Button>
      </div>
    </Modal>
  )
}
