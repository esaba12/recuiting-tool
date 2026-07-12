import { claudeJSON, CLAUDE_MODELS } from '../../lib/claude.js'

export const LEVEL_COLOR = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
export const LANG_COLOR  = ['bg-blue-500','bg-purple-500','bg-yellow-500','bg-green-500','bg-red-500','bg-orange-500']

export const EVENT_LABELS = {
  PushEvent:                  'Pushed',
  PullRequestEvent:           'Pull request',
  IssuesEvent:                'Issue',
  WatchEvent:                 'Starred',
  ForkEvent:                  'Forked',
  CreateEvent:                'Created',
  DeleteEvent:                'Deleted',
  IssueCommentEvent:          'Commented',
  PullRequestReviewEvent:     'Reviewed PR',
  ReleaseEvent:               'Released',
  PublicEvent:                'Made public',
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

// ── Job board: localStorage + AI helpers ─────────────────────────────────────

export const BUCKET_CONFIG = [
  { key: 'all',      label: 'All',          icon: '📋' },
  { key: 'review',   label: 'Needs Review', icon: '📥' },
  { key: 'applying', label: 'Applying',     icon: '📤' },
  { key: 'maybe',    label: 'Maybe',        icon: '🤔' },
  { key: 'applied',  label: 'Applied',      icon: '✅' },
  { key: 'pass',     label: 'Pass',         icon: '✕'  },
]

export const BUCKET_ACTIVE = {
  review:   'bg-gray-600 text-white border-gray-600',
  applying: 'bg-blue-600 text-white border-blue-600',
  maybe:    'bg-amber-500 text-white border-amber-500',
  applied:  'bg-green-600 text-white border-green-600',
  pass:     'bg-red-500 text-white border-red-500',
}

export const BUCKET_TAG = {
  review:   'bg-gray-100 text-gray-600',
  applying: 'bg-blue-100 text-blue-700',
  maybe:    'bg-amber-100 text-amber-700',
  applied:  'bg-green-100 text-green-700',
  pass:     'bg-red-100 text-red-500',
}

// Job Boards bucket key <-> Notion Applications.Triage select value
export const BUCKET_TO_TRIAGE = { review: 'Needs Review', applying: 'Applying', maybe: 'Maybe', applied: 'Applied', pass: 'Pass' }
export const TRIAGE_TO_BUCKET = { 'Needs Review': 'review', 'Applying': 'applying', 'Maybe': 'maybe', 'Applied': 'applied', 'Pass': 'pass' }

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function lsGet(key) { try { return JSON.parse(localStorage.getItem(key)) || null } catch { return null } }
export function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

export function jobId(job) {
  return `${job.company}::${job.role}`.replace(/[^\w:]/g, '_').slice(0, 80)
}

const AGE_UNIT_MS = { h: 3600000, d: 86400000, w: 7 * 86400000, mo: 30 * 86400000, y: 365 * 86400000 }

export function parseJobDate(str) {
  if (!str || /^[-—\s]+$/.test(str)) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str)
  // Relative-age strings some boards use instead of an absolute date (e.g. "5d", "17d",
  // "3w", "2mo") — approximate, but far better than treating every row as unparseable.
  const ageM = str.match(/^(\d+)\s*(mo|[hdwy])$/i)
  if (ageM) return new Date(Date.now() - Number(ageM[1]) * AGE_UNIT_MS[ageM[2].toLowerCase()])
  const m = str.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:,?\s*(\d{4}))?/)
  if (m) {
    const mo = MONTH_NAMES.findIndex(n => n.toLowerCase() === m[1].slice(0,3).toLowerCase())
    if (mo >= 0) return new Date(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[2])
  }
  return null
}

// 27-48% of tech-sector postings show ghost-job characteristics (posted with no real
// intent to hire); 45+ days stale with no update is the strongest publicly-available
// signal (Forbes/LinkedIn analysis, ResuFit, Clarify Capital 2026 study). This threshold
// is a heuristic, not a certainty — flag/demote, never silently exclude from import,
// since a false positive during a time-pressured recruiting season would hide a real
// posting. `job.dateAdded` is unreliable by construction (github.js's column matcher
// doesn't distinguish "posted" from "deadline/closes" columns, and parseJobDate only
// handles ISO/"Mon D[, YYYY]" formats) — jobAgeDays returns null for anything it can't
// parse, and callers must treat null as "unknown age," not "fresh."
export const GHOST_JOB_THRESHOLD_DAYS = 45

export function jobAgeDays(job) {
  const posted = parseJobDate(job.dateAdded)
  if (!posted) return null
  return Math.floor((Date.now() - posted.getTime()) / 86400000)
}

export function isGhostJob(job) {
  if (job.status === 'closed') return false
  const age = jobAgeDays(job)
  return age !== null && age >= GHOST_JOB_THRESHOLD_DAYS
}

export async function generateJobAnalysis(job, prefs) {
  const prefText = [
    prefs.targetRoles        && `Target roles: ${prefs.targetRoles}`,
    prefs.preferredLocations && `Preferred locations: ${prefs.preferredLocations}`,
    prefs.interests          && `Interests / skills: ${prefs.interests}`,
    prefs.dealBreakers       && `Deal-breakers: ${prefs.dealBreakers}`,
    prefs.companyType        && `Company type: ${prefs.companyType}`,
  ].filter(Boolean).join('\n') || 'No specific preferences set'

  return claudeJSON({
    model: CLAUDE_MODELS.HAIKU,
    maxTokens: 450,
    content: `You are a recruiting advisor. A CS student targeting SWE internships is evaluating:

Company: ${job.company}
Role: ${job.role || 'Internship'}
Location: ${job.location || 'Unknown'}
${job.notes ? `Notes: ${job.notes}` : ''}

Student preferences:
${prefText}

Reply with JSON only — no explanation, no markdown:
{
  "pros": ["specific pro 1", "specific pro 2", "specific pro 3"],
  "cons": ["specific con 1", "specific con 2", "specific con 3"],
  "fitScore": 7,
  "summary": "one honest sentence about this role for this student",
  "company": {
    "about": "1-2 sentences: what the company does and why it matters",
    "techStack": "primary languages/frameworks they're known for, or 'Unknown'",
    "size": "startup|growth|mid|large|faang",
    "culture": "one honest sentence about the engineering culture or reputation"
  }
}`,
  })
}

