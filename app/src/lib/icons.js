import {
  Flame, Snowflake, CloudSnow, Star, CheckCircle2,
  AlertTriangle, AlertCircle, Circle,
  Inbox, Send, HelpCircle, X,
  LayoutDashboard, Users, Kanban, ListChecks, GitFork,
  RefreshCw, ExternalLink, Search, MapPin, Calendar,
} from 'lucide-react'

// Contact Status — STATUS_COLOR keys in shared.jsx embed the emoji in the literal string
// value written to/read from Notion (e.g. '🟢 Warm'), so lookups here are keyed on the
// label with the emoji + surrounding whitespace stripped, NOT the raw data value itself.
export const STATUS_ICON = {
  Warm: Flame,
  Cooling: Snowflake,
  Cold: CloudSnow,
  Champion: Star,
  Closed: CheckCircle2,
}

export const URGENCY_ICON = {
  HIGH: AlertTriangle,
  MED: AlertCircle,
  LOW: Circle,
}

// Job Boards triage bucket icons (BUCKET_CONFIG keys)
export const BUCKET_ICON = {
  review: Inbox,
  applying: Send,
  maybe: HelpCircle,
  applied: CheckCircle2,
  pass: X,
}

// Sidebar nav
export const NAV_ICON = {
  overview: LayoutDashboard,
  network: Users,
  pipeline: Kanban,
  actions: ListChecks,
  github: GitFork,
}

// Misc glyph replacements used inline throughout the app
export const REFRESH_ICON = RefreshCw
export const EXTERNAL_LINK_ICON = ExternalLink
export const SEARCH_ICON = Search
export const LOCATION_ICON = MapPin
export const CALENDAR_ICON = Calendar

export function statusIconFor(label) {
  const key = (label || '').replace(/[^\p{L}]/gu, '').trim()
  return STATUS_ICON[key] || null
}
