import { useState } from 'react'
import { Sparkles, Loader2, Target, GraduationCap, Users, Globe, Link2 } from 'lucide-react'
import { searchContactByName, addContact, updateContact } from '../notion.js'
import { enrichContact, fitSummary } from '../lib/enrichment.js'
import { DEFAULT_PROFILE, DEFAULT_WEIGHTS } from '../lib/discovery.js'
import { ROLE_OPTIONS } from '../shared.jsx'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'

const PROFILE_KEY = 'rec_affinity_profile'   // shared with DiscoverTab
const TARGETS_KEY = 'rec_target_companies'   // shared with Coverage/Discover

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

// The fastest possible "add someone I know" path: type name + where they work + what they
// do, hit ✨ Auto-fill, and the enrichment engine (Exa public-web + Claude) fills in the
// rest — LinkedIn, cleaned role, shared-background tags, and how they slot into your
// network. You glance at the filled card and save (one-tap-review flow). Replaces the old
// blank New-Contact form, which captured only 4 fields and dropped everything else.
export default function QuickAddContactModal({ contacts = [], onClose, onSaved }) {
  const [step, setStep]       = useState('entry') // 'entry' | 'enriching' | 'review'
  const [name, setName]       = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole]       = useState('')      // free-text "what they do"
  const [draft, setDraft]     = useState(null)    // enriched, editable
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }))

  async function runEnrich() {
    if (!name.trim()) { setError('Name is required'); return }
    setStep('enriching'); setError(null)
    try {
      const stored = lsGet(PROFILE_KEY)
      const profile = { ...DEFAULT_PROFILE, ...(stored || {}), weights: { ...DEFAULT_WEIGHTS, ...(stored?.weights || {}) } }
      const targetCompanies = lsGet(TARGETS_KEY) || []
      const result = await enrichContact({
        name, company, whatTheyDo: role,
        profile, targetCompanies, existingContacts: contacts,
      })
      setDraft({ ...result, email: '', referredById: '' })
      setStep('review')
    } catch (e) {
      // Enrichment is fail-soft, but if the whole thing throws, fall back to the raw entry
      // so the user can still save what they typed.
      setDraft({
        name: name.trim(), company: company.trim(), role: 'Other', title: role.trim(),
        descriptor: '', linkedin: '', email: '', affinity: [], isUMichAlum: false,
        targetMatch: false, alsoAt: [], enrichedFromWeb: false, exaError: e.message, referredById: '',
      })
      setStep('review')
    }
  }

  async function save() {
    if (!draft?.name?.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      // Reuse the DiscoverTab add pattern: create the minimal row, then patch the rich
      // fields onto the returned page id.
      const existing = await searchContactByName(draft.name.trim())
      const id = existing ? existing.id : (await addContact({
        name: draft.name.trim(), company: draft.company, role: draft.role, email: draft.email,
      })).id
      await updateContact(id, {
        company: draft.company,
        role: draft.role || null,
        email: draft.email || null,
        linkedin: draft.linkedin || null,
        notes: draft.descriptor || '',
        isUMichAlum: draft.isUMichAlum,
        affinity: draft.affinity || [],
        referredById: draft.referredById || null,
        exaEnriched: !!draft.enrichedFromWeb,
      })
      onSaved?.()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const fitChips = draft ? fitSummary(draft) : []

  return (
    <Modal onClose={onClose} size="md">
      <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between z-10">
        <h2 className="text-base font-heading font-semibold text-ink-900 flex items-center gap-2">
          <Sparkles size={16} className="text-accent-500" /> Add someone to your network
        </h2>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

        {/* ── Entry: three fields, that's it ─────────────────────────────── */}
        {step !== 'review' && (
          <>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Chen" autoFocus
                disabled={step === 'enriching'}
                onKeyDown={e => e.key === 'Enter' && runEnrich()}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 disabled:opacity-50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Where they work</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Stripe"
                  disabled={step === 'enriching'}
                  onKeyDown={e => e.key === 'Enter' && runEnrich()}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">What they do</label>
                <input value={role} onChange={e => setRole(e.target.value)} placeholder="backend engineer"
                  disabled={step === 'enriching'}
                  onKeyDown={e => e.key === 'Enter' && runEnrich()}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 disabled:opacity-50" />
              </div>
            </div>

            <Button onClick={runEnrich} disabled={step === 'enriching' || !name.trim()} className="w-full flex items-center justify-center gap-2">
              {step === 'enriching'
                ? <><Loader2 size={15} className="animate-spin" /> Filling in the rest…</>
                : <><Sparkles size={15} /> Auto-fill &amp; review</>}
            </Button>
            <p className="text-[11px] text-ink-400 text-center">
              Searches the public web for their LinkedIn, role, and shared background — then you review before saving.
            </p>
          </>
        )}

        {/* ── Review: enriched, editable ─────────────────────────────────── */}
        {step === 'review' && draft && (
          <>
            {/* How they fit into your network */}
            {fitChips.length > 0 && (
              <div className="rounded-xl border border-accent-200 bg-accent-50/60 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide mb-1.5">How they fit</p>
                <div className="flex flex-wrap gap-1.5">
                  {draft.targetMatch && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-accent-200 text-xs text-accent-700"><Target size={11} /> Target company</span>}
                  {draft.isUMichAlum && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-accent-200 text-xs text-accent-700"><GraduationCap size={11} /> UMich alum</span>}
                  {(draft.affinity || []).filter(a => a !== 'UMich').map(a => (
                    <span key={a} className="px-2 py-0.5 rounded-full bg-white border border-accent-200 text-xs text-accent-700">{a}</span>
                  ))}
                  {draft.alsoAt?.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-accent-200 text-xs text-accent-700">
                      <Users size={11} /> {draft.alsoAt.length} contact{draft.alsoAt.length > 1 ? 's' : ''} here already
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Provenance — honest about web vs. typed */}
            <p className="text-[11px] text-ink-400 flex items-center gap-1">
              {draft.enrichedFromWeb
                ? <><Globe size={11} className="text-success-600" /> Filled from public web — check the details below.</>
                : draft.exaError
                  ? <>Couldn't reach web search ({draft.exaError}). Filled from what you typed.</>
                  : <>No clear web match — filled from what you typed.</>}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Name</label>
                <input value={draft.name} onChange={e => set('name', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Company</label>
                <input value={draft.company} onChange={e => set('company', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Role</label>
                <select value={draft.role} onChange={e => set('role', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
                  {ROLE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Email <span className="text-ink-300">(optional)</span></label>
                <input value={draft.email} onChange={e => set('email', e.target.value)} type="email" placeholder="—"
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-0.5 flex items-center gap-1"><Link2 size={11} /> LinkedIn</label>
              <input value={draft.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="—"
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-0.5">What they do</label>
              <textarea value={draft.descriptor} onChange={e => set('descriptor', e.target.value)} rows={2}
                placeholder="One line on what they work on"
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
            </div>

            {draft.alsoAt?.length > 0 && (
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Did one of them introduce you? <span className="text-ink-300">(optional)</span></label>
                <select value={draft.referredById} onChange={e => set('referredById', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
                  <option value="">— No / not sure</option>
                  {draft.alsoAt.map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => setStep('entry')} disabled={saving} className="flex-1">← Back</Button>
              <Button onClick={save} disabled={saving} className="flex-[2]">
                {saving ? 'Adding…' : '+ Add to network'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
