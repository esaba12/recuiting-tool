import { companySearch, exaFindSimilar } from './exa.js'
import { filterCompanies, DOMAINS } from './ycDirectory.js'
import { normalizeCompanyName } from './networkGraph.js'
import { aiJSON, AI_MODELS } from './ai.js'

// The company finder: merges YC's structured candidate pool with Exa's public-web company
// search, dedups against companies the user already tracks/applied to, then does ONE AI
// ranking call that scores each for THIS student — deliberately re-injecting the signals
// students under-weight (mentorship, return-offer reputation, real domain interest) rather
// than the prestige/pay they over-weight. Ranking mirrors jobBoards/helpers.js's
// generateJobAnalysis prompt pattern. Feeds rec_target_companies -> Coverage -> Discover.

export { DOMAINS }
export const PRIORITIES = ['Mentorship & learning', 'Ownership & impact', 'Brand & resume', 'Pay', 'Mission alignment']
export const STAGES = [
  { key: 'seed_a',  label: 'Seed / Series A' },
  { key: 'scaleup', label: 'Scale-up' },
  { key: 'bigtech', label: 'Big Tech' },
  { key: 'any',     label: 'No strong pref' },
]
export const WORK_STYLES = ['In-person', 'Hybrid', 'Remote-OK']

export const DEFAULT_COMPANY_PREFS = {
  seedCompanies: [], domains: [], roleLean: 0.7, stage: 'any',
  priorities: [], locations: [], workStyle: 'Hybrid', extras: '',
}

// Prefill company prefs from the Job Boards preferences (rec_prefs) so a returning user
// isn't starting cold. Free-text fields are split into chips where sensible.
export function prefsFromRecPrefs(recPrefs = {}) {
  const csv = s => (s || '').split(',').map(x => x.trim()).filter(Boolean)
  return {
    ...DEFAULT_COMPANY_PREFS,
    locations: csv(recPrefs.preferredLocations),
    roleLean: /pm|product/i.test(recPrefs.targetRoles || '') && !/swe|engineer/i.test(recPrefs.targetRoles || '') ? 0.3 : 0.7,
    extras: recPrefs.dealBreakers ? `Avoid: ${recPrefs.dealBreakers}` : '',
  }
}

// Natural-language interest query for Exa's company search (neural/embedding search likes
// descriptive phrasing over keyword lists).
export function buildCompanyQuery(prefs) {
  const parts = []
  parts.push(prefs.domains?.length ? `${prefs.domains.join(' or ')} companies` : 'technology companies')
  const stageWord = { seed_a: 'early-stage startups', scaleup: 'high-growth scale-ups', bigtech: 'large established tech companies' }[prefs.stage]
  if (stageWord) parts.push(stageWord)
  if (prefs.seedCompanies?.length) parts.push(`similar to ${prefs.seedCompanies.slice(0, 5).join(', ')}`)
  if (prefs.locations?.length) parts.push(`based in ${prefs.locations.join(' or ')}`)
  if (prefs.extras?.trim()) parts.push(prefs.extras.trim())
  parts.push('with a strong engineering culture that hire software engineering interns')
  return parts.join(', ')
}

// Merge candidate arrays, dropping blanks, excluded names, and duplicates (by normalized
// company name). Pure + order-stable — YC (structured) first, then Exa (web). Testable.
export function mergeCandidates(lists, excludeNames = []) {
  const exclude = new Set(excludeNames.map(normalizeCompanyName))
  const seen = new Set()
  const out = []
  for (const c of lists.flat()) {
    const key = normalizeCompanyName(c?.name || '')
    if (!key || exclude.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

function profileText(prefs) {
  return [
    prefs.domains?.length && `Domains of interest: ${prefs.domains.join(', ')}`,
    prefs.seedCompanies?.length && `Companies he already admires: ${prefs.seedCompanies.join(', ')}`,
    `Role focus: ${prefs.roleLean >= 0.5 ? 'SWE-leaning (some PM interest)' : 'PM-leaning (some SWE interest)'}`,
    prefs.stage && prefs.stage !== 'any' && `Company stage preference: ${prefs.stage}`,
    prefs.priorities?.length && `What he says matters most: ${prefs.priorities.join(', ')}`,
    prefs.locations?.length && `Preferred locations: ${prefs.locations.join(', ')} (${prefs.workStyle})`,
    prefs.extras?.trim() && `Other notes / deal-breakers: ${prefs.extras.trim()}`,
  ].filter(Boolean).join('\n') || 'No specific preferences set'
}

// Builds the "You are an internship-search advisor for ___" line from the
// signed-in user's Settings profile (school/grad_year/focus) instead of a
// hardcoded persona — falls back to a generic phrase for anyone who hasn't
// filled those fields in yet.
function advisorFraming(studentProfile) {
  const school = studentProfile?.school ? `a ${studentProfile.school} student` : 'a college student'
  const focus = studentProfile?.focus === 'PM' ? 'PM primary, SWE secondary'
    : studentProfile?.focus === 'Both' ? 'SWE and PM' : 'SWE primary, PM secondary'
  const term = studentProfile?.grad_year ? `recruiting for internships ahead of graduating in ${studentProfile.grad_year}` : 'recruiting for internships'
  return `You are an internship-search advisor for ${school} (${focus}) ${term}.`
}

async function rankCompanies(candidates, prefs, studentProfile) {
  if (!candidates.length) return []
  const list = candidates.slice(0, 30).map((c, i) =>
    `[${i}] ${c.name}${c.website ? ` (${c.website})` : ''}${c.industry ? ` · ${c.industry}` : ''}${c.stage ? ` · ${c.stage}` : ''}${c.teamSize ? ` · ~${c.teamSize} ppl` : ''}${c.isHiring ? ' · hiring' : ''}\n${(c.oneLiner || c.summary || '').slice(0, 240)}`
  ).join('\n\n')

  const content = `${advisorFraming(studentProfile)} Rank the candidate companies below by genuine fit FOR HIM. Return ONLY JSON — no markdown, no explanation.

His profile:
${profileText(prefs)}

Ranking guidance (important):
- Honor his stated domains, stage, locations, and any deal-breakers.
- Students tend to OVER-weight brand/prestige and pay and UNDER-weight mentorship quality, return-offer reputation, and genuine domain interest — factor those under-weighted signals into your ranking even though he didn't list them.
- Prefer companies that actually run strong internship programs / hire interns.
- Do not invent companies; only rank the candidates given.

Candidates:
${list}

Return the best ${Math.min(15, candidates.length)}, best first:
{
  "companies": [
    { "name": "Company", "website": "https://...", "oneLiner": "one honest sentence on what they do", "whyFit": "one specific sentence on why THIS student would like them", "fitScore": 8, "domain": "e.g. Fintech", "stage": "startup|growth|mid|large", "badges": ["hiring interns"] }
  ]
}`

  // ~15 rich objects need well over 1800 tokens; too low a cap truncates the JSON array
  // mid-element. parseJSONLoose salvages a truncation, but a comfortable cap avoids losing
  // the tail companies in the first place.
  const parsed = await aiJSON({ model: AI_MODELS.STANDARD, content, maxTokens: 3000 })
  return (parsed.companies || []).filter(c => c?.name)
}

// prefs + exclusions -> { companies (ranked) | null if skipped, resultHash, skipped }.
// skipped=true (Exa returned the same pages as priorResultHash) means the caller keeps its
// cached ranking and pays zero AI tokens.
export async function findCompanies({ prefs, excludeNames = [], priorResultHash = null, studentProfile = null }) {
  const query = buildCompanyQuery(prefs)
  const [ycPool, exaRes] = await Promise.all([
    filterCompanies(prefs).catch(() => []),
    companySearch({ query, priorResultHash }).catch(() => ({ candidates: [], resultHash: null, skipped: false })),
  ])
  if (exaRes.skipped) return { companies: null, resultHash: exaRes.resultHash, skipped: true }

  const merged = mergeCandidates([ycPool, exaRes.candidates || []], excludeNames)
  if (!merged.length) return { companies: [], resultHash: exaRes.resultHash, skipped: false }

  // Re-apply exclusion/dedup on the ranked output too: Exa surfaces messy page titles
  // ("Stripe | Payments") that the pre-rank filter can miss, but Claude returns a clean
  // `name`, so a company already in targets/apps can only be reliably dropped here.
  const companies = mergeCandidates([await rankCompanies(merged, prefs, studentProfile)], excludeNames)
  return { companies, resultHash: exaRes.resultHash, skipped: false }
}

// "More like this" from a seed company's website -> ranked similar companies.
export async function moreLikeThis({ website, prefs, excludeNames = [], studentProfile = null }) {
  const sims = await exaFindSimilar({ url: website })
  const merged = mergeCandidates([sims], excludeNames)
  return rankCompanies(merged.slice(0, 12), prefs, studentProfile)
}
