// Pre-contact ranker for people surfaced by Exa (lib/exa.js). lib/affinity.js's
// affinityScore can't rank these — it keys off interaction history, so a brand-new
// prospect always buckets 'cold'/0. This scores the two things you CAN know about a
// stranger up front: how warm the tie looks (shared résumé signals) and how likely they
// are to actually help (reachability + whether they add coverage you don't already have).
//
// Same philosophy as affinity.js: an inspectable, overridable nudge (every point of
// score carries a human-readable reason) — not a hard filter.

export const DEFAULT_WEIGHTS = { pastEmployer: 4, program: 3, university: 2, hometown: 1 }

// Seeded with what we already know (UMich); the user fills the rest via the Discover
// tab's profile panel. Weights default to the user's stated priority order:
// past employers > programs/clubs > university > hometown.
export const DEFAULT_PROFILE = {
  university: 'University of Michigan',
  gradYear: 2028,
  pastEmployers: [],
  programs: [],
  hometown: '',
  highSchool: '',
  skills: [],
  weights: { ...DEFAULT_WEIGHTS },
}

const norm = s => (s || '').trim().toLowerCase()

// Coarse seniority/role bucket from a job title (or a Contacts Role select). Drives both
// reachability scoring and the "does this person add a NEW angle at the company" logic.
export function roleCategory(title) {
  const t = norm(title)
  if (!t) return 'other'
  if (/(recruit|talent|sourc)/.test(t)) return 'recruiter'
  if (/(chief|c[etof]o|vp|vice president|head of|founder|president|director)/.test(t)) return 'leader'
  if (/(product manager|program manager)/.test(t) || /^pm$/.test(t)) return 'pm'
  if (/(manager|lead|principal|staff)/.test(t) && /(eng|develop|softw|tech|infra|platform|data|ml)/.test(t)) return 'manager'
  if (/(engineer|developer|swe|programmer|sde)/.test(t)) return 'engineer'
  if (/manager|lead/.test(t)) return 'manager'
  return 'other'
}

const CATEGORY_LABEL = { engineer: 'Engineer', recruiter: 'Recruiter', manager: 'Eng manager', pm: 'PM', leader: 'Leader', other: 'Other' }
export function roleCategoryLabel(cat) { return CATEGORY_LABEL[cat] || 'Other' }

// Reachability × relevance: reachable ICs and recruiters reply and can refer; VPs/C-suite
// rarely respond to a student cold-open. Alumni get their floor from the university signal.
const REACHABILITY = { engineer: 2, recruiter: 2, manager: 1.5, pm: 1, leader: -1, other: 0 }

// Résumé-signal overlap, weighted by the user's (tunable) weights.
function signalOverlap(person, profile) {
  const reasons = []
  let score = 0
  const w = { ...DEFAULT_WEIGHTS, ...(profile.weights || {}) }

  const myEmployers = (profile.pastEmployers || []).map(norm).filter(Boolean)
  ;(person.pastCompanies || []).forEach(pc => {
    if (myEmployers.includes(norm(pc))) { score += w.pastEmployer; reasons.push(`Ex-${pc}, same as you`) }
  })

  const myPrograms = (profile.programs || []).map(norm).filter(Boolean)
  ;(person.programs || []).forEach(pg => {
    if (myPrograms.some(mp => norm(pg).includes(mp) || mp.includes(norm(pg)))) { score += w.program; reasons.push(`Shared: ${pg}`) }
  })

  if (profile.university && person.school && norm(person.school).includes(norm(profile.university))) {
    score += w.university; reasons.push(`${profile.university} alum`)
  }

  // Hometown / high school — scan whatever free text the extractor gave us.
  const hay = norm([person.school, person.location, ...(person.programs || []), ...(person.pastCompanies || [])].filter(Boolean).join(' '))
  if (profile.highSchool && hay.includes(norm(profile.highSchool))) { score += w.hometown; reasons.push(profile.highSchool) }
  else if (profile.hometown && hay.includes(norm(profile.hometown))) { score += w.hometown; reasons.push(`From ${profile.hometown}`) }

  return { score, reasons }
}

// person: { name, title, company, school, pastCompanies[], programs[], linkedinUrl }
// existingContactsAtCompany: your Contacts already at this company (name + role).
// -> { score, reasons[], category, isDuplicate }
export function discoveryScore(person, profile = DEFAULT_PROFILE, existingContactsAtCompany = []) {
  const reasons = []
  let score = 0

  const sig = signalOverlap(person, profile)
  score += sig.score
  reasons.push(...sig.reasons)

  const category = roleCategory(person.title)
  const reach = REACHABILITY[category] ?? 0
  score += reach
  if (reach >= 2) reasons.push(`Reachable ${roleCategoryLabel(category).toLowerCase()}`)
  else if (reach < 0) reasons.push('Senior leader — lower reply odds')

  // Already a contact? Sink it so re-runs don't re-surface people you know.
  if (existingContactsAtCompany.some(c => norm(c.name) === norm(person.name))) {
    reasons.push('Already in your contacts')
    return { score: -Infinity, reasons, category, isDuplicate: true }
  }

  // "Next best person" coverage logic.
  if (existingContactsAtCompany.length === 0) {
    score += 2
    reasons.push('First contact at this company')
  } else {
    const haveCats = new Set(existingContactsAtCompany.map(c => roleCategory(c.role)))
    if (!haveCats.has(category) && category !== 'other') {
      score += 1.5
      reasons.push(`Adds a new angle (${roleCategoryLabel(category)})`)
    } else {
      score -= 1
      reasons.push(`You already know a ${roleCategoryLabel(category)} here`)
    }
  }

  return { score, reasons, category, isDuplicate: false }
}

// Convenience: score + sort a whole batch (best first). Duplicates sink to the bottom.
export function rankCandidates(people, profile = DEFAULT_PROFILE, existingContactsAtCompany = []) {
  return people
    .map(p => ({ person: p, ...discoveryScore(p, profile, existingContactsAtCompany) }))
    .sort((a, b) => b.score - a.score)
}

// Map a scored candidate's matched signals onto the Contacts affinity vocabulary
// (Notable Affinity multi-select) so an added contact is immediately legible to the
// existing affinity/coverage systems. Mirrors ContactDetailModal's UMich<->affinity sync.
export function affinityTagsFor(person, profile = DEFAULT_PROFILE) {
  const tags = []
  const uni = norm(profile.university)
  const isUMich = /michigan|umich/.test(uni) && person.school && norm(person.school).includes(uni)
  if (isUMich) tags.push('UMich')

  const myEmployers = (profile.pastEmployers || []).map(norm).filter(Boolean)
  if ((person.pastCompanies || []).some(pc => myEmployers.includes(norm(pc)))) tags.push('Shared Employer')

  const myPrograms = (profile.programs || []).map(norm).filter(Boolean)
  if ((person.programs || []).some(pg => myPrograms.some(mp => norm(pg).includes(mp) || mp.includes(norm(pg))))) tags.push('Shared Club/Activity')

  const hay = norm([person.school, person.location, ...(person.programs || []), ...(person.pastCompanies || [])].filter(Boolean).join(' '))
  if (profile.hometown && hay.includes(norm(profile.hometown))) tags.push('Same Hometown')

  return { tags, isUMichAlum: isUMich }
}
