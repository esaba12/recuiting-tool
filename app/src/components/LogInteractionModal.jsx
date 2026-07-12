import { useState } from 'react'
import { Phone, MessageCircle, Users, Mail, MoreHorizontal } from 'lucide-react'
import { searchContactByName, addContact, addCallEntry, addInteraction, updateContact } from '../notion.js'
import { claudeJSON, CLAUDE_MODELS } from '../lib/claude.js'
import { AFFINITY_OPTIONS } from '../shared.jsx'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import Tabs from './ui/Tabs.jsx'

const CHANNELS = [
  { key: 'call',     label: 'Call',     icon: Phone },
  { key: 'linkedin', label: 'LinkedIn', icon: MessageCircle },
  { key: 'meeting',  label: 'Meeting',  icon: Users },
  { key: 'email',    label: 'Email',    icon: Mail },
  { key: 'other',    label: 'Other',    icon: MoreHorizontal },
]

const CHANNEL_TO_TYPE = { call: 'Call', linkedin: 'LinkedIn', meeting: 'Meeting', email: 'Email', other: 'Other' }
const TRANSCRIPT_CHANNELS = new Set(['call', 'linkedin'])

async function extractWithClaude(channel, text) {
  const isCall = channel === 'call'
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const prompt = isCall
    ? `Today is ${today}. Extract recruiting data from this call summary/transcript. Return ONLY valid JSON, no explanation.

{
  "contact_name": "full name",
  "contact_company": "company name",
  "contact_role": "their job title or type: SWE|PM|Recruiter|Alumni|Referral|Other",
  "contact_email": "email or null",
  "summary": "3-sentence summary of the conversation",
  "key_insights": "what they shared about company culture, role, process, or advice",
  "my_commitments": "what I said I would do next — or null",
  "follow_up_draft": "A warm 3-4 sentence follow-up email from the candidate (a CS student targeting SWE internships)",
  "notable_affinity_detected": "comma-separated subset of UMich, Same Hometown, Shared Club/Activity, Warm Intro — only if EXPLICITLY mentioned in the transcript, do not guess. Or null."
}

Call summary / transcript:
${text}`
    : `Extract recruiting-networking data from this pasted LinkedIn conversation. Return ONLY valid JSON, no explanation.

{
  "contact_name": "the other person's full name",
  "contact_company": "their company or null",
  "contact_role": "their job title or type: SWE|PM|Recruiter|Alumni|Referral|Other",
  "summary": "2-3 sentence summary of what was discussed",
  "key_points": "anything notable they offered (referral, intro, advice) — or null",
  "notable_affinity_detected": "comma-separated subset of UMich, Same Hometown, Shared Club/Activity, Warm Intro — only if EXPLICITLY mentioned in the conversation, do not guess. Or null."
}

LinkedIn conversation:
${text}`

  return claudeJSON({ model: CLAUDE_MODELS.SONNET, content: prompt, maxTokens: 1000 })
}

export default function LogInteractionModal({ contacts = [], contact = null, onClose, onSaved }) {
  const [channel, setChannel] = useState('call')

  // Transcript channels (Call / LinkedIn)
  const [text, setText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [editField, setEdit] = useState({})

  // Manual channels (Meeting / Email / Other)
  const [name, setName] = useState(contact?.name || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(null) // null | 'saving' | 'done' | 'error'
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)

  const isTranscript = TRANSCRIPT_CHANNELS.has(channel)
  const field = (key) => editField[key] ?? extracted?.[key] ?? ''
  const setField = (key, val) => setEdit(e => ({ ...e, [key]: val }))

  const nameMatches = name.trim().length > 1
    ? contacts.filter(c => c.name.toLowerCase().includes(name.toLowerCase())).slice(0, 5)
    : []

  const affinityTags = (field('notable_affinity_detected') || '').split(',').map(s => s.trim()).filter(Boolean)
  function toggleAffinityTag(tag) {
    const next = affinityTags.includes(tag) ? affinityTags.filter(t => t !== tag) : [...affinityTags, tag]
    setField('notable_affinity_detected', next.join(', '))
  }

  function switchChannel(key) {
    setChannel(key)
    setText(''); setExtracted(null); setEdit({}); setError(null); setSaved(null); setSaving(null)
  }

  async function extract() {
    if (!text.trim()) return
    setExtracting(true); setError(null); setExtracted(null); setEdit({})
    try { setExtracted(await extractWithClaude(channel, text)) }
    catch (e) { setError(e.message) }
    finally { setExtracting(false) }
  }

  async function findOrCreateContact({ name, company, role, email }) {
    if (contact?.id) return contact.id
    const existing = await searchContactByName(name)
    if (existing) return existing.id
    return (await addContact({ name, company, role, email })).id
  }

  async function saveTranscriptChannel() {
    setSaving('saving')
    try {
      const contactName = field('contact_name')
      const existing = await searchContactByName(contactName)
      const contactId = await findOrCreateContact({
        name: contactName, company: field('contact_company'), role: field('contact_role'),
        email: channel === 'call' ? field('contact_email') : undefined,
      })

      if (channel === 'call') {
        await addCallEntry({
          contactId, contactName, company: field('contact_company'),
          summary: field('summary'), keyInsights: field('key_insights'),
          commitments: field('my_commitments'), followUpDraft: field('follow_up_draft'),
        })
      }
      if (affinityTags.length > 0) {
        await updateContact(contactId, { affinity: affinityTags, isUMichAlum: affinityTags.includes('UMich') })
      }
      await addInteraction({
        contactId, contactName, type: CHANNEL_TO_TYPE[channel], direction: 'N/A',
        summary: field('summary') || field('key_points'), body: text,
      })

      setSaving('done')
      setSaved({ existed: !!existing, name: contactName, company: field('contact_company') })
      onSaved?.()
    } catch (e) {
      setError(e.message)
      setSaving('error')
    }
  }

  async function saveManualChannel() {
    if (!name.trim()) { setError('Contact name is required'); return }
    setSaving('saving'); setError(null)
    try {
      const contactId = await findOrCreateContact({ name: name.trim() })
      const summary = duration ? `${duration} min — ${notes || 'no notes'}` : (notes || undefined)
      await addInteraction({
        contactId, contactName: name.trim(), type: CHANNEL_TO_TYPE[channel], direction: 'N/A', date,
        summary, body: notes || undefined,
      })
      setSaving('done')
      onSaved?.()
    } catch (e) {
      setError(e.message)
      setSaving('error')
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between">
        <h2 className="text-base font-heading font-semibold text-ink-900">Log Interaction</h2>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
      </div>

      <div className="px-5 py-4 space-y-4">
        <Tabs options={CHANNELS} value={channel} onChange={switchChannel} className="w-full [&>button]:flex-1 [&>button]:justify-center" />

        {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

        {isTranscript ? (
          <>
            <div>
              <p className="text-sm font-medium text-ink-700 mb-1">
                {channel === 'call' ? 'Paste Granola summary' : 'Paste a LinkedIn conversation'}
              </p>
              <p className="text-xs text-ink-400 mb-3">
                {channel === 'call'
                  ? 'After a call ends, copy the summary from Granola and paste it here. Claude extracts the contact, key insights, and writes a follow-up draft.'
                  : 'Copy the message thread from LinkedIn and paste it here. Claude extracts the contact and a summary — no LinkedIn automation or account risk involved.'}
              </p>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={channel === 'call' ? 'Paste your Granola call notes or summary here...' : 'Paste the LinkedIn conversation here...'}
                rows={7}
                className="w-full px-4 py-3 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-accent-400 resize-none font-mono bg-ink-50" />
              <Button onClick={extract} disabled={extracting || !text.trim()} className="mt-2">
                {extracting ? 'Extracting...' : 'Extract with Claude →'}
              </Button>
            </div>

            {extracted && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-ink-700">Extracted — review & edit before saving</p>

                <div className="bg-white rounded-xl p-4 border border-ink-100 shadow-sm">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3">Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'contact_name',    label: 'Name' },
                      { key: 'contact_company', label: 'Company' },
                      { key: 'contact_role',    label: 'Role type' },
                      ...(channel === 'call' ? [{ key: 'contact_email', label: 'Email' }] : []),
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs text-ink-400 mb-0.5">{label}</label>
                        <input value={field(key)} onChange={e => setField(key, e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-ink-100">
                    <p className="text-xs text-ink-400 mb-1.5">Notable affinity (auto-detected, review before saving)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {AFFINITY_OPTIONS.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleAffinityTag(tag)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${affinityTags.includes(tag)
                            ? 'bg-accent-600 text-white border-accent-600'
                            : 'bg-white text-ink-500 border-ink-200 hover:border-accent-300'}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-ink-100 shadow-sm space-y-3">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Summary</p>
                  {(channel === 'call'
                    ? [{ key: 'summary', label: 'Summary', rows: 3 }, { key: 'key_insights', label: 'Key Insights', rows: 2 }, { key: 'my_commitments', label: 'My Commitments', rows: 2 }]
                    : [{ key: 'summary', label: 'Summary', rows: 3 }, { key: 'key_points', label: 'Key Points', rows: 2 }]
                  ).map(({ key, label, rows }) => (
                    <div key={key}>
                      <label className="block text-xs text-ink-500 mb-1">{label}</label>
                      <textarea value={field(key)} onChange={e => setField(key, e.target.value)} rows={rows}
                        className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
                    </div>
                  ))}
                </div>

                {channel === 'call' && (
                  <div className="bg-accent-50 border border-accent-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-accent-700">Follow-Up Draft</p>
                      <button onClick={() => navigator.clipboard.writeText(field('follow_up_draft'))} className="text-xs text-accent-500 hover:underline">Copy</button>
                    </div>
                    <textarea value={field('follow_up_draft')} onChange={e => setField('follow_up_draft', e.target.value)} rows={4}
                      className="w-full px-2.5 py-1.5 border border-accent-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none bg-white" />
                  </div>
                )}

                {saving === 'done' ? (
                  <div className="p-4 bg-success-50 border border-success-200 rounded-xl text-sm text-success-700">
                    ✓ Logged — {saved.existed ? 'updated existing contact' : 'created new contact'} <strong>{saved.name}</strong>{saved.company ? ` @ ${saved.company}` : ''}.
                  </div>
                ) : (
                  <Button onClick={saveTranscriptChannel} disabled={saving === 'saving'} className="w-full">
                    {saving === 'saving' ? 'Saving to Notion...' : '+ Log to Notion'}
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-xs text-ink-400 mb-0.5">Contact</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Start typing a name..."
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              {nameMatches.length > 0 && !contacts.some(c => c.name === name) && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
                  {nameMatches.map(c => (
                    <button key={c.id} onClick={() => setName(c.name)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-ink-50">
                      {c.name}{c.company ? ` @ ${c.company}` : ''}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-ink-400 mt-1">Not found? It'll be created as a new contact.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Duration (min)</label>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="What happened / what's next..."
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
            </div>

            {saving === 'done' ? (
              <div className="p-4 bg-success-50 border border-success-200 rounded-xl text-sm text-success-700">✓ Logged.</div>
            ) : (
              <Button onClick={saveManualChannel} disabled={saving === 'saving'} className="w-full">
                {saving === 'saving' ? 'Saving...' : '+ Log Interaction'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
