import { normalizeCompanyName } from './networkGraph.js'
import { affinityScore } from './affinity.js'

// Picks which target companies the hands-off background refresh should search *right now*,
// so discovery stays cheap: it runs daily but each company is only re-searched on a
// cooldown, capped at a small per-day budget, prioritized toward the companies that matter
// most (gaps you've applied to). Pure + testable — the React layer (DiscoverTab) just runs
// discoverPeople() over whatever this returns.

// Mirrors ReferralCoverageTab.jsx's STRONG_COVERAGE_THRESHOLD — a company is "covered"
// only if its best contact is at least a moderate tie, not merely "has any contact."
const STRONG_COVERAGE_THRESHOLD = 3

export function coverageStatus(company, contacts, interactions) {
  const key = normalizeCompanyName(company)
  const matched = contacts.filter(c => c.company?.trim() && normalizeCompanyName(c.company) === key)
  if (matched.length === 0) return 'gap'
  const best = Math.max(...matched.map(c => affinityScore(c, interactions)))
  return best >= STRONG_COVERAGE_THRESHOLD ? 'strong' : 'weak'
}

// True when there's an active (non-rejected) application for this company.
function hasActiveApplication(company, apps) {
  const key = normalizeCompanyName(company)
  return apps.some(a => a.company?.trim() && normalizeCompanyName(a.company) === key && a.stage !== 'Rejected')
}

// Lower tier = higher priority. Applied-to gaps are the single highest-leverage thing to
// close before applying cold; weak coverage is a softer need.
function priorityTier(status, appliedTo) {
  if (appliedTo && status === 'gap')  return 0
  if (appliedTo && status === 'weak') return 1
  if (status === 'gap')  return 2
  return 3 // weak, not applied-to
}

const DAY_MS = 86400000

// targets: string[] company names · contacts/apps/interactions: dashboard data ·
// meta: rec_discovery_meta ({ perCompany: { [key]: { lastRun, resultHash } } })
// -> ordered [{ company, key, status, tier, priorResultHash }] to search now.
export function dueCompanies(targets, contacts, apps, interactions, meta = {}, opts = {}) {
  const { cooldownDays = 7, dailyBudget = 3, now = Date.now() } = opts
  const perCompany = meta.perCompany || {}

  return targets
    .map(company => {
      const key = normalizeCompanyName(company)
      const status = coverageStatus(company, contacts, interactions)
      const tier = priorityTier(status, hasActiveApplication(company, apps))
      const lastRun = perCompany[key]?.lastRun || 0
      return { company, key, status, tier, lastRun, priorResultHash: perCompany[key]?.resultHash || null }
    })
    .filter(r => r.status !== 'strong')                       // never spend on well-covered companies
    .filter(r => !r.lastRun || now - r.lastRun > cooldownDays * DAY_MS) // per-company cooldown
    .sort((a, b) => a.tier - b.tier || a.lastRun - b.lastRun) // priority, then oldest-searched first (rotate)
    .slice(0, dailyBudget)                                    // cap daily spend
    .map(({ lastRun, ...keep }) => keep)
}

// YYYY-MM-DD in local time — the once-per-day gate key.
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
