import { useState } from 'react'
import { addInteraction, searchContactByName, addContact } from '../notion.js'

const TYPES = ['Call', 'Meeting', 'Other']

export default function QuickLogModal({ contacts, onClose, onSaved }) {
  const [name, setName]     = useState('')
  const [type, setType]     = useState('Call')
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const matches = name.trim().length > 1
    ? contacts.filter(c => c.name.toLowerCase().includes(name.toLowerCase())).slice(0, 5)
    : []

  async function save() {
    if (!name.trim()) { setError('Contact name is required'); return }
    setSaving(true); setError(null)
    try {
      let contact = contacts.find(c => c.name.toLowerCase() === name.trim().toLowerCase())
      let contactId = contact?.id
      if (!contactId) {
        const existing = await searchContactByName(name.trim())
        if (existing) contactId = existing.id
        else contactId = (await addContact({ name: name.trim() })).id
      }
      const summary = duration ? `${duration} min — ${notes || 'no notes'}` : (notes || undefined)
      await addInteraction({
        contactId, contactName: name.trim(), type, direction: 'N/A', date,
        summary, body: notes || undefined,
      })
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Quick Log</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>}

          <div className="relative">
            <label className="block text-xs text-gray-400 mb-0.5">Contact</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Start typing a name..."
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
            {matches.length > 0 && name.length > 1 && !contacts.some(c => c.name === name) && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {matches.map(c => (
                  <button key={c.id} onClick={() => setName(c.name)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                    {c.name}{c.company ? ` @ ${c.company}` : ''}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-1">Not found? It'll be created as a new contact.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-0.5">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-white">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-0.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-0.5">Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="What happened / what's next..."
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-3 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
            {saving ? 'Saving...' : '+ Log Interaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
