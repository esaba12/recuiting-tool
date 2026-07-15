// Free, public YC company directory (yc-oss/api) — no auth, CORS-open static JSON on
// GitHub Pages, so the browser fetches it directly. Gives structured company attributes
// (industry, tags, stage, team size, hiring status, website, one-liner) that Exa's
// web search doesn't return cleanly. We use the curated "top companies" file: it's small,
// recognizable, and higher-signal than the full ~6k-company dump.
//
// Session-only in-memory cache (no localStorage — the JSON is big and browser HTTP cache
// already covers repeat loads; avoids blowing the localStorage quota).

const YC_BASE = 'https://yc-oss.github.io/api'
const memCache = new Map()

async function fetchJson(path) {
  if (memCache.has(path)) return memCache.get(path)
  let data = null
  try {
    const res = await fetch(`${YC_BASE}${path}`)
    if (res.ok) data = await res.json()
  } catch { /* offline / blocked — degrade gracefully, Exa still covers discovery */ }
  memCache.set(path, data)
  return data
}

// Onboarding domain -> acceptable YC tag/industry names (lowercased, matched exactly
// against a company's tags[] / industry to avoid substring false positives like "ai" in
// "email"). Kept in one place so the onboarding chips and the pool filter stay in sync.
export const DOMAIN_TAGSETS = {
  'Fintech':             new Set(['fintech', 'financial services', 'payments', 'banking']),
  'AI / ML':             new Set(['artificial intelligence', 'ai', 'machine learning', 'generative ai', 'ai-powered', 'aiops']),
  'Dev tools / Infra':   new Set(['developer tools', 'infrastructure', 'devops', 'developer platform', 'open source']),
  'Healthcare':          new Set(['healthcare', 'health tech', 'digital health', 'biotech', 'medical']),
  'Climate':             new Set(['climate', 'energy', 'climate tech', 'sustainability']),
  'Consumer / Social':   new Set(['consumer', 'social', 'marketplace', 'consumer health']),
  'Gaming':              new Set(['gaming', 'games']),
  'Security':            new Set(['security', 'cybersecurity']),
  'Hardware / Robotics': new Set(['hardware', 'robotics', 'drones']),
  'Enterprise / B2B':    new Set(['b2b', 'enterprise', 'enterprise software', 'saas']),
}
export const DOMAINS = Object.keys(DOMAIN_TAGSETS)

function normalizeYc(c) {
  return {
    name: c.name,
    website: c.website || c.url || '',
    oneLiner: c.one_liner || '',
    industry: c.industry || '',
    tags: c.tags || [],
    stage: c.stage || '',
    teamSize: c.team_size || null,
    isHiring: !!c.isHiring,
    status: c.status || '',
    topCompany: !!c.top_company,
    batch: c.batch || '',
    locations: c.all_locations || '',
    source: 'yc',
  }
}

let topCache = null
async function topCompanies() {
  if (!topCache) topCache = (await fetchJson('/companies/top.json')) || []
  return topCache
}

// Autocomplete for the onboarding seed-company picker — recognizable YC names by substring.
export async function searchCompanies(q) {
  const needle = (q || '').trim().toLowerCase()
  if (needle.length < 2) return []
  const top = await topCompanies()
  return top.filter(c => c.name?.toLowerCase().includes(needle)).slice(0, 8).map(c => c.name)
}

export function companyMatchesDomain(company, domain) {
  const set = DOMAIN_TAGSETS[domain]
  if (!set) return false
  if (company.industry && set.has(company.industry.toLowerCase())) return true
  return (company.tags || []).some(t => set.has(String(t).toLowerCase()))
}

// Soft team-size band per stage preference — YC "stage" strings are inconsistent, team
// size is the reliable proxy. Lenient: an empty result falls back to unfiltered upstream.
function inStageBand(company, stage) {
  const n = company.teamSize || 0
  if (stage === 'seed_a')  return n > 0 && n <= 50
  if (stage === 'scaleup') return n > 50 && n <= 1000
  if (stage === 'bigtech') return n > 1000
  return true // 'any'
}

// Candidate pool from YC for the user's selected domains + stage band. Active companies
// only, sorted so hiring / top / larger-team companies (more likely to run real intern
// programs with mentorship) come first.
export async function filterCompanies(prefs, { limit = 40 } = {}) {
  const domains = prefs.domains || []
  if (!domains.length) return []
  const top = await topCompanies()
  const seen = new Set()
  let pool = []
  for (const raw of top) {
    if (!raw?.name || raw.status === 'Inactive') continue
    const c = normalizeYc(raw)
    if (!domains.some(d => companyMatchesDomain(c, d))) continue
    const key = c.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pool.push(c)
  }
  const banded = pool.filter(c => inStageBand(c, prefs.stage))
  const chosen = banded.length >= 5 ? banded : pool // don't starve on a tight stage band
  chosen.sort((a, b) => (b.isHiring - a.isHiring) || (b.topCompany - a.topCompany) || ((b.teamSize || 0) - (a.teamSize || 0)))
  return chosen.slice(0, limit)
}
