import { useState } from 'react'
import { searchContactByName, addContact, addInteraction } from '../notion.js'

async function extractLinkedInData(text) {
  const res = await fetch('/claude-api/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Extract recruiting-networking data from this pasted LinkedIn conversation. Return ONLY valid JSON, no explanation.

{
  "contact_name": "the other person's full name",
  "contact_company": "their company or null",
  "contact_role": "their job title or type: SWE|PM|Recruiter|Alumni|Referral|Other",
  "summary": "2-3 sentence summary of what was discussed",
  "key_points": "anything notable they offered (referral, intro, advice) — or null"
}

LinkedIn conversation:
${text}`
      }]
    })
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `API ${res.status}`)
  }
  const data = await res.json()
  const match = data.content[0].text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse response')
  return JSON.parse(match[0])
}

export default function LinkedInTab({ onSaved }) {
  const [text, setText]           = useState('')
  const [extracting, setExtr]     = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [error, setError]         = useState(null)
  const [saving, setSaving]       = useState(null) // null | 'saving' | 'done' | 'error'
  const [saved, setSaved]         = useState(null)
  const [editField, setEdit]      = useState({})

  const field = (key) => editField[key] ?? extracted?.[key] ?? ''
  const setField = (key, val) => setEdit(e => ({ ...e, [key]: val }))

  async function extract() {
    if (!text.trim()) return
    setExtr(true); setError(null); setExtracted(null); setSaved(null); setEdit({})
    try { setExtracted(await extractLinkedInData(text)) }
    catch (e) { setError(e.message) }
    finally { setExtr(false) }
  }

  async function saveToNotion() {
    setSaving('saving')
    try {
      const name = field('contact_name')
      let contactId = null
      const existing = await searchContactByName(name)
      if (existing) {
        contactId = existing.id
      } else {
        const newContact = await addContact({
          name, company: field('contact_company'), role: field('contact_role'),
        })
        contactId = newContact.id
      }
      await addInteraction({
        contactId, contactName: name, type: 'LinkedIn', direction: 'N/A',
        summary: field('summary'), body: text,
      })
      setSaving('done')
      setSaved({ existed: !!existing, name, company: field('contact_company') })
      onSaved?.()
    } catch (e) {
      setError(e.message)
      setSaving('error')
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Paste a LinkedIn conversation</p>
        <p className="text-xs text-gray-400 mb-3">
          Copy the message thread from LinkedIn and paste it here. Claude extracts the contact and a summary, then logs it to your Interactions history — no LinkedIn automation or account risk involved.
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste the LinkedIn conversation here..."
          rows={8}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none font-mono bg-gray-50" />
        <button onClick={extract} disabled={extracting || !text.trim()}
          className="mt-2 px-5 py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 disabled:opacity-40 font-medium transition-colors">
          {extracting ? 'Extracting...' : 'Extract with Claude →'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {extracted && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">Extracted — review & edit before saving</p>

          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'contact_name',    label: 'Name' },
                { key: 'contact_company', label: 'Company' },
                { key: 'contact_role',    label: 'Role type' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
                  <input value={field(key)} onChange={e => setField(key, e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conversation Summary</p>
            {[
              { key: 'summary',    label: 'Summary',    rows: 3 },
              { key: 'key_points', label: 'Key Points',  rows: 2 },
            ].map(({ key, label, rows }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <textarea value={field(key)} onChange={e => setField(key, e.target.value)} rows={rows}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            ))}
          </div>

          {saving === 'done' ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              ✓ Logged — {saved.existed ? 'updated existing contact' : 'created new contact'} <strong>{saved.name}</strong>{saved.company ? ` @ ${saved.company}` : ''}.
            </div>
          ) : (
            <button onClick={saveToNotion} disabled={saving === 'saving'}
              className="w-full py-3 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
              {saving === 'saving' ? 'Saving to Notion...' : '+ Log Conversation to Notion'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
