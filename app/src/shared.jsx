// ── Shared constants + micro-components used across tabs ──────────────────────

export { default as Badge } from './components/ui/Badge.jsx'
export { default as EmptyState } from './components/ui/EmptyState.jsx'

export const STATUS_COLOR = {
  '🟢 Warm':    'bg-success-100 text-success-800',
  '🟡 Cooling': 'bg-warning-100 text-warning-800',
  '🔴 Cold':    'bg-danger-100 text-danger-700',
  '✅ Closed':  'bg-ink-100 text-ink-500',
  '⭐ Champion':'bg-orange-100 text-orange-800',
}

export const URGENCY_COLOR = {
  HIGH: 'bg-danger-500 text-white',
  MED:  'bg-warning-400 text-white',
  LOW:  'bg-ink-100 text-ink-400',
}

// Whether this contact is going to give (or has given) a referral for a job
// application — distinct from ROLE_OPTIONS's 'Referral' (their relationship type
// to you) and 'Referred By' (who introduced *you* to this contact).
export const REFERRAL_STATUS_COLOR = {
  'Not Asked': 'bg-ink-100 text-ink-400',
  'Asked':     'bg-warning-100 text-warning-800',
  'Confirmed': 'bg-success-100 text-success-800',
  'Declined':  'bg-danger-100 text-danger-600',
}

export const STAGE_ORDER = ['Wishlist','Applied','Phone Screen','Technical','Onsite','Offer','Accepted','Rejected']

export const STAGE_COLOR = {
  Wishlist:       'bg-ink-100 text-ink-600',
  Applied:        'bg-accent-100 text-accent-700',
  'Phone Screen': 'bg-warning-100 text-warning-800',
  Technical:      'bg-orange-100 text-orange-800',
  Onsite:         'bg-purple-100 text-purple-800',
  Offer:          'bg-success-100 text-success-800',
  Accepted:       'bg-success-200 text-success-900 font-semibold',
  Rejected:       'bg-danger-100 text-danger-600',
}

export const INTERVIEW_STAGES = ['Phone Screen','Technical','Onsite']
export const TERMINAL_STAGES = ['Rejected','Accepted']

export const ROLE_OPTIONS = ['SWE','PM','Recruiter','Alumni','Referral','Other']
export const SOURCE_OPTIONS = ['Coffee chat','Email','Event','Referral','LinkedIn DM']
export const STATUS_OPTIONS = Object.keys(STATUS_COLOR)
export const URGENCY_OPTIONS = ['HIGH','MED','LOW']
// Shared-background signals, distinct from ROLE_OPTIONS's 'Alumni' (which describes this
// contact's relationship *type* to you, not a background they happen to share with you).
export const AFFINITY_OPTIONS = ['UMich','Same Hometown','Shared Club/Activity','Warm Intro']
export const REFERRAL_STATUS_OPTIONS = Object.keys(REFERRAL_STATUS_COLOR)

export function daysSince(d) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d)) / 86400000)
}

export function daysUntil(d) {
  if (!d) return null
  return Math.floor((new Date(d) - Date.now()) / 86400000)
}

export function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// A contact whose Follow-Up Date has passed with no newer touch recorded — the single
// source of truth for "needs a follow-up," used by Actions, Overview, the sidebar badge,
// and the Network Cards view (which previously computed this without the status guard,
// so a ✅ Closed contact with a stale date still showed a red overdue border).
export function isOverdue(c) {
  return c.status !== '✅ Closed' && !!c.followUpDate && daysUntil(c.followUpDate) <= 0
}

// A bulk-imported job board listing that hasn't been triaged yet (still sitting untouched
// in the review queue), or one the user explicitly passed on — excluded from
// Overview/Pipeline/Actions "active" stats so a big board import doesn't drown out real activity.
export function isUntriaged(a) {
  return (a.triage === 'Needs Review' && a.stage === 'Wishlist') || a.triage === 'Pass'
}

// Groups applications that normalize to the same Company+Role (trim + lowercase) —
// catches exact re-imports (e.g. the same board pulled twice) but not fuzzily-worded
// duplicates across sources (different phrasing of the same role won't match).
// Each group's entries are sorted oldest-first.
export function findDuplicateGroups(apps) {
  const groups = {}
  for (const a of apps) {
    const key = `${(a.company || '').trim().toLowerCase()}::${(a.role || '').trim().toLowerCase()}`
    if (!key.replace(/:/g, '')) continue
    ;(groups[key] ||= []).push(a)
  }
  return Object.values(groups)
    .filter(g => g.length > 1)
    .map(g => g.slice().sort((a, b) => new Date(a.createdTime || 0) - new Date(b.createdTime || 0)))
    .sort((a, b) => b.length - a.length)
}

