// ── Shared constants + micro-components used across tabs ──────────────────────

export const STATUS_COLOR = {
  '🟢 Warm':    'bg-green-100 text-green-800',
  '🟡 Cooling': 'bg-yellow-100 text-yellow-800',
  '🔴 Cold':    'bg-red-100 text-red-700',
  '✅ Closed':  'bg-gray-100 text-gray-500',
  '⭐ Champion':'bg-orange-100 text-orange-800',
}

export const URGENCY_COLOR = {
  HIGH: 'bg-red-500 text-white',
  MED:  'bg-amber-400 text-white',
  LOW:  'bg-gray-100 text-gray-400',
}

export const ROLE_OPTIONS = ['SWE','PM','Recruiter','Alumni','Referral','Other']
export const SOURCE_OPTIONS = ['Coffee chat','Email','Event','Referral','LinkedIn DM']
export const STATUS_OPTIONS = Object.keys(STATUS_COLOR)
export const URGENCY_OPTIONS = ['HIGH','MED','LOW']

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

export function Badge({ label, color = 'bg-gray-100 text-gray-600' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
}

export function EmptyState({ msg }) {
  return <div className="text-center py-20 text-gray-400 text-sm">{msg}</div>
}
