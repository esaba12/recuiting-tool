import { useState } from 'react'
import { lsGet, lsSet } from './jobBoards/helpers.js'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { affinityScore } from '../lib/affinity.js'
import { STAGE_COLOR, Badge, EmptyState } from '../shared.jsx'
import ContactDetailModal from './ContactDetailModal.jsx'
import DraftPanel from './DraftPanel.jsx'

const TARGETS_KEY = 'rec_target_companies'

// Referral coverage: cross-references a user-maintained target-company list against
// Contacts (do I know anyone there?) and Applications (have I already applied?).
// Referred candidates convert at roughly 4x the rate of cold applicants and make up
// ~2% of applicants but ~11% of hires — so a company with zero contacts is the single
// highest-leverage gap to close before applying cold. Coverage strength uses
// lib/affinity.js's affinityScore (tie-strength bucket + affinity tags) rather than
// just "any contact at all" — a company where your only contact is a total stranger you
// added but never talked to isn't meaningfully covered.
const STRONG_COVERAGE_THRESHOLD = 3
export default function ReferralCoverageTab({ contacts, apps, interactions, onRefresh }) {
  const [targets, setTargets] = useState(() => lsGet(TARGETS_KEY) || [])
  const [editingList, setEditingList] = useState(() => (lsGet(TARGETS_KEY) || []).length === 0)
  const [draft, setDraft] = useState(() => (lsGet(TARGETS_KEY) || []).join('\n'))
  const [addingFor, setAddingFor] = useState(null) // target company name string | null
  const [draftingCompany, setDraftingCompany] = useState(null) // company key currently showing a DraftPanel | null

  function saveTargets() {
    const list = [...new Set(draft.split('\n').map(s => s.trim()).filter(Boolean))]
    setTargets(list)
    lsSet(TARGETS_KEY, list)
    setEditingList(false)
  }

  const rows = targets
    .map(company => {
      const key = normalizeCompanyName(company)
      const matchedContacts = contacts.filter(c => c.company?.trim() && normalizeCompanyName(c.company) === key)
      const matchedApps = apps.filter(a => a.company?.trim() && normalizeCompanyName(a.company) === key)
      const bestScore = matchedContacts.length > 0 ? Math.max(...matchedContacts.map(c => affinityScore(c, interactions))) : -1
      const status = matchedContacts.length === 0 ? 'gap' : bestScore >= STRONG_COVERAGE_THRESHOLD ? 'strong' : 'weak'
      return { company, matchedContacts, matchedApps, status }
    })
    .sort((a, b) => ({ gap: 0, weak: 1, strong: 2 }[a.status]) - ({ gap: 0, weak: 1, strong: 2 }[b.status]))

  const gapCount = rows.filter(r => r.status === 'gap').length
  const weakCount = rows.filter(r => r.status === 'weak').length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-100 bg-gradient-to-r from-accent-50 to-indigo-50 overflow-hidden">
        <button onClick={() => { setDraft(targets.join('\n')); setEditingList(o => !o) }}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-accent-800">
          <span>🎯 Target companies {targets.length > 0 ? `· ${targets.length} tracked` : '· click to set'}</span>
          <span className="text-accent-400 text-xs">{editingList ? '▲ collapse' : '▼ edit'}</span>
        </button>
        {editingList && (
          <div className="px-5 pb-5">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6}
              placeholder={'One company per line, e.g.\nStripe\nDatadog\nRipple'}
              className="w-full px-3 py-2 border border-accent-200 rounded-lg text-sm bg-white focus:outline-none focus:border-accent-400 resize-none font-mono" />
            <div className="flex justify-end mt-2">
              <button onClick={saveTargets}
                className="px-4 py-1.5 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 font-medium">
                Save target list
              </button>
            </div>
          </div>
        )}
      </div>

      {targets.length === 0 ? (
        <EmptyState msg="Add a target-company list above to see where you have — and don't have — a way in." />
      ) : (
        <>
          {(gapCount > 0 || weakCount > 0) && (
            <p className="text-sm text-danger-600 font-medium">
              {gapCount > 0 && `${gapCount} target compan${gapCount !== 1 ? 'ies' : 'y'} with no contact yet.`}
              {gapCount > 0 && weakCount > 0 && ' '}
              {weakCount > 0 && `${weakCount} covered only by a cold or unengaged contact.`}
            </p>
          )}
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.company}
                className={`bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between gap-3 ${r.status === 'gap' ? 'border-danger-200' : r.status === 'weak' ? 'border-warning-200' : 'border-ink-100'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-900">{r.company}</span>
                    {r.status === 'gap' && <Badge label="No contact" color="bg-danger-100 text-danger-700" />}
                    {r.status === 'weak' && <Badge label={`${r.matchedContacts.length} contact${r.matchedContacts.length !== 1 ? 's' : ''} · weak tie`} color="bg-warning-100 text-warning-800" />}
                    {r.status === 'strong' && <Badge label={`${r.matchedContacts.length} contact${r.matchedContacts.length !== 1 ? 's' : ''}`} color="bg-success-100 text-success-800" />}
                    {r.matchedApps.length > 0 && (
                      <Badge label={r.matchedApps[0].stage} color={STAGE_COLOR[r.matchedApps[0].stage]} />
                    )}
                  </div>
                  {r.matchedContacts.length > 0 && (
                    <p className="text-xs text-ink-500 mt-1 truncate">
                      {r.matchedContacts.map(c => c.name).join(', ')}
                    </p>
                  )}
                  {draftingCompany === r.company && r.matchedContacts[0] && (
                    <DraftPanel contact={r.matchedContacts[0]} kind="cold_open" />
                  )}
                </div>
                {r.status === 'gap' ? (
                  <button onClick={() => setAddingFor(r.company)}
                    className="shrink-0 px-3 py-1.5 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
                    + Add contact
                  </button>
                ) : (
                  <button onClick={() => setDraftingCompany(c => c === r.company ? null : r.company)}
                    className="shrink-0 px-3 py-1.5 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
                    {draftingCompany === r.company ? 'Hide' : '✎ Draft outreach'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {addingFor && (
        <ContactDetailModal
          contact={null}
          initial={{ company: addingFor }}
          contacts={contacts}
          interactions={interactions}
          onClose={() => setAddingFor(null)}
          onSaved={() => { setAddingFor(null); onRefresh() }}
        />
      )}
    </div>
  )
}
