import { useState } from 'react'
import { draftMessage, escalationTier } from '../lib/drafting.js'
import { updateContact } from '../db.js'

const KIND_LABEL = { cold_open: 'Cold Open', follow_up: 'Follow-Up' }

// Shared drafting UI for both the Actions-tab follow-up sequencer (kind="follow_up")
// and cold-open outreach (kind="cold_open", e.g. from a referral-coverage gap row or
// a low-interaction contact). Persists the generated draft onto the Contact record
// (Follow-Up Draft / Tier / Kind) so it survives a tab close, and only regenerates
// when the kind or tier no longer match what's persisted.
export default function DraftPanel({ contact, kind, daysOverdue, onSaved }) {
  const tier = kind === 'follow_up' ? escalationTier(daysOverdue) : 0
  const hasFreshPersistedDraft = contact.followUpDraft
    && contact.followUpDraftKind === KIND_LABEL[kind]
    && (kind !== 'follow_up' || contact.followUpDraftTier === tier)

  const [draft, setDraft] = useState(hasFreshPersistedDraft ? contact.followUpDraft : '')
  const [personalization, setPersonalization] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const needsPersonalization = kind === 'cold_open' && !personalization.trim()

  async function generate() {
    if (needsPersonalization) return
    setGenerating(true); setError(null); setSaved(false)
    try {
      const result = await draftMessage({ contact, kind, tier, personalizationContext: personalization })
      setDraft(result.draft)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      await updateContact(contact.id, {
        followUpDraft: draft,
        followUpDraftTier: tier,
        followUpDraftKind: KIND_LABEL[kind],
      })
      setSaved(true)
      onSaved?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-accent-50 border border-accent-100 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-accent-700">
          {kind === 'cold_open' ? 'Draft Outreach' : `Follow-Up Draft (tier ${tier}/3)`}
        </p>
        {draft && (
          <button onClick={() => navigator.clipboard.writeText(draft)} className="text-xs text-accent-500 hover:underline">Copy</button>
        )}
      </div>

      {error && <div className="p-2 mb-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}

      {kind === 'cold_open' && (
        <div className="mb-2">
          <label className="block text-xs text-accent-600 mb-0.5">
            Why reach out to them specifically? (shared connection, mutual interest, something about their role/company) — required, this drives most of the response-rate difference
          </label>
          <input value={personalization} onChange={e => setPersonalization(e.target.value)}
            placeholder="e.g. Both UMich CS, they posted about their team's infra rewrite..."
            className="w-full px-2.5 py-1.5 border border-accent-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white" />
        </div>
      )}

      {draft ? (
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
          className="w-full px-2.5 py-1.5 border border-accent-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none bg-white" />
      ) : (
        <button onClick={generate} disabled={generating || needsPersonalization}
          title={needsPersonalization ? 'Add a personalization detail above first' : undefined}
          className="w-full py-2 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 disabled:opacity-40 font-medium">
          {generating ? 'Drafting...' : 'Generate draft →'}
        </button>
      )}

      {draft && (
        <div className="flex items-center gap-2 mt-2">
          <button onClick={generate} disabled={generating || needsPersonalization}
            className="px-3 py-1.5 bg-white border border-accent-200 rounded-lg text-xs font-medium text-accent-700 hover:border-accent-400 disabled:opacity-40">
            {generating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 bg-accent-600 text-white rounded-lg text-xs font-medium hover:bg-accent-700 disabled:opacity-40">
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save to Notion'}
          </button>
        </div>
      )}
    </div>
  )
}
