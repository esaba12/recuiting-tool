import { useState } from 'react'
import { lsGet, lsSet } from './jobBoards/helpers.js'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { STAGE_COLOR, Badge, EmptyState } from '../shared.jsx'
import ContactDetailModal from './ContactDetailModal.jsx'

const TARGETS_KEY = 'rec_target_companies'

// Referral coverage: cross-references a user-maintained target-company list against
// Contacts (do I know anyone there?) and Applications (have I already applied?).
// Referred candidates convert at roughly 4x the rate of cold applicants and make up
// ~2% of applicants but ~11% of hires — so a company with zero contacts is the single
// highest-leverage gap to close before applying cold. "Covered" here means "any contact
// at that company" — once affinity/tie-strength weighting exists (see the alumni/affinity
// feature), this should upgrade to distinguish weak coverage from strong.
export default function ReferralCoverageTab({ contacts, apps, interactions, onRefresh }) {
  const [targets, setTargets] = useState(() => lsGet(TARGETS_KEY) || [])
  const [editingList, setEditingList] = useState(() => (lsGet(TARGETS_KEY) || []).length === 0)
  const [draft, setDraft] = useState(() => (lsGet(TARGETS_KEY) || []).join('\n'))
  const [addingFor, setAddingFor] = useState(null) // target company name string | null

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
      return { company, matchedContacts, matchedApps, status: matchedContacts.length > 0 ? 'covered' : 'gap' }
    })
    .sort((a, b) => (a.status === 'gap' ? 0 : 1) - (b.status === 'gap' ? 0 : 1))

  const gapCount = rows.filter(r => r.status === 'gap').length

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
          {gapCount > 0 && (
            <p className="text-sm text-danger-600 font-medium">
              {gapCount} target compan{gapCount !== 1 ? 'ies' : 'y'} with no contact yet.
            </p>
          )}
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.company}
                className={`bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between gap-3 ${r.status === 'gap' ? 'border-danger-200' : 'border-ink-100'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-900">{r.company}</span>
                    {r.status === 'gap'
                      ? <Badge label="No contact" color="bg-danger-100 text-danger-700" />
                      : <Badge label={`${r.matchedContacts.length} contact${r.matchedContacts.length !== 1 ? 's' : ''}`} color="bg-success-100 text-success-800" />}
                    {r.matchedApps.length > 0 && (
                      <Badge label={r.matchedApps[0].stage} color={STAGE_COLOR[r.matchedApps[0].stage]} />
                    )}
                  </div>
                  {r.matchedContacts.length > 0 && (
                    <p className="text-xs text-ink-500 mt-1 truncate">
                      {r.matchedContacts.map(c => c.name).join(', ')}
                    </p>
                  )}
                </div>
                {r.status === 'gap' && (
                  <button onClick={() => setAddingFor(r.company)}
                    className="shrink-0 px-3 py-1.5 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
                    + Add contact
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
