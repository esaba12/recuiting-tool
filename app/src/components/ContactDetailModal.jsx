import { useState } from 'react'
import { addContact, updateContact } from '../notion.js'
import { ROLE_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS, URGENCY_OPTIONS, Badge, fmt } from '../shared.jsx'
import LogInteractionModal from './LogInteractionModal.jsx'

const TYPE_COLOR = { Email: 'bg-accent-100 text-accent-700', LinkedIn: 'bg-purple-100 text-purple-700', Call: 'bg-success-100 text-success-700', Meeting: 'bg-orange-100 text-orange-700', Other: 'bg-ink-100 text-ink-600' }

export default function ContactDetailModal({ contact, contacts, interactions, onClose, onSaved }) {
  const isNew = !contact
  const [form, setForm] = useState(() => ({
    name:        contact?.name || '',
    company:     contact?.company || '',
    role:        contact?.role || '',
    email:       contact?.email || '',
    linkedin:    contact?.linkedin || '',
    source:      contact?.source || '',
    status:      contact?.status || '🟡 Cooling',
    urgency:     contact?.urgency || 'LOW',
    referredById: contact?.referredById || '',
    whatTheyDid: contact?.whatTheyDid || '',
    notes:       contact?.notes || '',
    followUpDate: contact?.followUpDate ? contact.followUpDate.slice(0, 10) : '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [logOpen, setLogOpen] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const history = (interactions || [])
    .filter(i => i.contactId === contact?.id)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  const referralOptions = (contacts || []).filter(c => c.id !== contact?.id)

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      if (isNew) {
        await addContact({ name: form.name, company: form.company, role: form.role, email: form.email })
      } else {
        await updateContact(contact.id, {
          name: form.name, company: form.company, role: form.role || null, email: form.email,
          linkedin: form.linkedin, source: form.source || null, status: form.status, urgency: form.urgency,
          referredById: form.referredById || null, whatTheyDid: form.whatTheyDid, notes: form.notes,
          followUpDate: form.followUpDate || null,
        })
      }
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const field = (label, key, props = {}) => (
    <div>
      <label className="block text-xs text-ink-400 mb-0.5">{label}</label>
      <input value={form[key]} onChange={e => set(key, e.target.value)}
        className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" {...props} />
    </div>
  )

  const select = (label, key, options) => (
    <div>
      <label className="block text-xs text-ink-400 mb-0.5">{label}</label>
      <select value={form[key]} onChange={e => set(key, e.target.value)}
        className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-900">{isNew ? 'New Contact' : contact.name}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            {field('Name', 'name')}
            {field('Company', 'company')}
            {select('Role', 'role', ROLE_OPTIONS)}
            {field('Email', 'email', { type: 'email' })}
            {field('LinkedIn URL', 'linkedin')}
            {select('Source', 'source', SOURCE_OPTIONS)}
          </div>

          {!isNew && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink-100">
              {select('Status', 'status', STATUS_OPTIONS)}
              {select('Urgency', 'urgency', URGENCY_OPTIONS)}
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Referred By</label>
                <select value={form.referredById} onChange={e => set('referredById', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
                  <option value="">—</option>
                  {referralOptions.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` @ ${c.company}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Follow-Up Date</label>
                <input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
            </div>
          )}

          {!isNew && (
            <div className="pt-3 border-t border-ink-100 space-y-3">
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">What they've done for me</label>
                <textarea value={form.whatTheyDid} onChange={e => set('whatTheyDid', e.target.value)} rows={2}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
              </div>
            </div>
          )}

          {!isNew && (
            <div className="pt-3 border-t border-ink-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">History ({history.length})</p>
              <button onClick={() => setLogOpen(true)}
                className="px-2.5 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
                + Log
              </button>
            </div>
          )}

          {!isNew && history.length > 0 && (
            <div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="bg-ink-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge label={h.type} color={TYPE_COLOR[h.type] || TYPE_COLOR.Other} />
                      {h.direction && h.direction !== 'N/A' && <span className="text-xs text-ink-400">{h.direction}</span>}
                      <span className="text-xs text-ink-400 ml-auto">{fmt(h.date)}</span>
                    </div>
                    {h.summary && <p className="text-xs text-ink-600">{h.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={save} disabled={saving}
            className="w-full py-3 bg-accent-600 text-white text-sm rounded-xl hover:bg-accent-700 disabled:opacity-50 font-medium transition-colors">
            {saving ? 'Saving...' : isNew ? '+ Add Contact' : 'Save Changes'}
          </button>
        </div>
      </div>

      {logOpen && (
        <LogInteractionModal
          contacts={contacts}
          contact={contact}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); onSaved() }}
        />
      )}
    </div>
  )
}
