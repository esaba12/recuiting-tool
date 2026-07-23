import { exaSearch } from './exa.js'
import { aiJSON, AI_MODELS } from './ai.js'
import { affinityTagsFor, roleCategory, DEFAULT_PROFILE } from './discovery.js'
import { normalizeCompanyName } from './networkGraph.js'

// One-tap contact enrichment for the "add someone I already know" path. This is the
// mirror of lib/discovery.js's discoverPeople(): same Exa-public-web + Claude-extraction
// pipeline, but pointed at a SINGLE named individual you supply, instead of sourcing
// strangers. It never fetches linkedin.com directly — the same compliance boundary as
// Discover (Exa surfaces public pages; LinkedIn URLs are reference links only).
//
// Deliberately fail-soft: every network step is wrapped so a missing EXA/AI-provider key or
// a flaky search degrades to "use what the user typed" rather than blocking the add. The
// caller shows the result as an editable review card (one-tap-review save flow), so a
// wrong web match costs a glance, not a bad Notion row.

const norm = s => (s || '').trim().toLowerCase()

// Extracted/free-text title -> the Contacts Role select vocabulary (ROLE_OPTIONS).
// Leans on discovery.js's roleCategory so this classification stays consistent with the
// reachability/seniority logic used everywhere else.
export function roleToOption(title) {
  switch (roleCategory(title)) {
    case 'recruiter': return 'Recruiter'
    case 'pm':        return 'PM'
    case 'engineer':
    case 'manager':   return 'SWE'
    default:          return 'Other' // leader / other — no clean ROLE_OPTIONS bucket
  }
}

// Ask the AI to resolve the ONE person the user named out of the Exa result pages, and
// clean up their title into a plain-English descriptor. Returns null on any failure.
async function extractPerson({ name, company, whatTheyDo, results }) {
  const digest = results.slice(0, 6)
    .map((r, i) => `[${i}] url: ${r.url}\ntitle: ${r.title || ''}\n${(r.summary || r.text || '').slice(0, 700)}`)
    .join('\n\n')

  const content = `From the web search results below, identify the ONE real person named "${name}"${company ? ` who works at "${company}"` : ''}${whatTheyDo ? ` (described as: "${whatTheyDo}")` : ''}. Return ONLY valid JSON, no markdown, no prose.

Fields:
- title: their current job title, cleaned up (e.g. "Senior Software Engineer") — fall back to the description above if the results don't say
- descriptor: one plain-English sentence on what they actually do day-to-day (e.g. "Backend engineer on the payments platform team")
- school: undergrad or grad university if stated, else null
- pastCompanies: array of prior employers if stated, else []
- programs: clubs, fellowships, or programs mentioned, else []
- location: city/region if stated, else null
- linkedinUrl: the linkedin.com/in/... URL if one appears in a result url or text, else null

If the results clearly are NOT about this specific person, still return your best guess from the description above and set linkedinUrl to null.

Results:
${digest}

{"title":"","descriptor":"","school":null,"pastCompanies":[],"programs":[],"location":null,"linkedinUrl":null}`

  try {
    const parsed = await aiJSON({ model: AI_MODELS.MINI, content, maxTokens: 700 })
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// AI-only fallback when there are no usable web results (no EXA key, or nothing found).
// Cleans the typed role into a descriptor so the review card is still "filled in" — no web
// data (no LinkedIn / school), just a tidy interpretation of what the user typed.
async function descriptorOnly({ name, company, whatTheyDo }) {
  if (!whatTheyDo && !company) return null
  const content = `A student is adding a networking contact. Given only what they typed, return ONLY valid JSON (no markdown):
name: "${name}"
company: "${company || ''}"
what they do: "${whatTheyDo || ''}"

{"title":"a cleaned-up job title from 'what they do', or ''","descriptor":"one plain sentence describing their likely role, or ''"}`
  try {
    return await aiJSON({ model: AI_MODELS.MINI, content, maxTokens: 250 })
  } catch {
    return null
  }
}

// name + company + free-text "what they do" -> a review-ready contact draft.
// profile: the rec_affinity_profile (merged with DEFAULT_PROFILE) so shared-background
//   tags (UMich alum, shared employer, hometown) are computed the same way Discover does.
// targetCompanies: rec_target_companies — used to flag "this person is at a target company".
// existingContacts: your Contacts — used to surface who else you already know there.
export async function enrichContact({
  name, company, whatTheyDo,
  profile = DEFAULT_PROFILE, targetCompanies = [], existingContacts = [],
}) {
  const trimmedName = (name || '').trim()
  const trimmedCompany = (company || '').trim()

  // 1. Web search (fail-soft). One Exa call; category 'people' biases to profile pages.
  let results = []
  let exaError = null
  try {
    const query = [trimmedName, trimmedCompany, whatTheyDo, 'linkedin'].filter(Boolean).join(' ')
    results = await exaSearch({ query, numResults: 6, category: 'people' })
  } catch (e) {
    exaError = e.message
  }

  // 2. Structure it. Web extraction when we have results, else a cheap descriptor cleanup.
  const extracted = results.length
    ? await extractPerson({ name: trimmedName, company: trimmedCompany, whatTheyDo, results })
    : await descriptorOnly({ name: trimmedName, company: trimmedCompany, whatTheyDo })

  const e = extracted || {}
  const title = (e.title || whatTheyDo || '').trim()

  // 3. Shared-background tags — reuse the exact Discover logic so an added contact is
  //    immediately legible to the affinity/coverage systems.
  const person = {
    name: trimmedName, company: trimmedCompany, title,
    school: e.school || null,
    pastCompanies: e.pastCompanies || [],
    programs: e.programs || [],
    location: e.location || null,
  }
  const { tags, isUMichAlum } = affinityTagsFor(person, profile)

  // 4. How they fit into YOUR network (deterministic — no extra tokens, always reliable).
  const targetMatch = trimmedCompany
    ? targetCompanies.some(t => normalizeCompanyName(t) === normalizeCompanyName(trimmedCompany))
    : false
  const alsoAt = trimmedCompany
    ? existingContacts
        .filter(c => c.company &&
          normalizeCompanyName(c.company) === normalizeCompanyName(trimmedCompany) &&
          norm(c.name) !== norm(trimmedName))
        .map(c => ({ id: c.id, name: c.name, role: c.role }))
    : []

  return {
    name: trimmedName,
    company: trimmedCompany,
    role: roleToOption(title),
    title,
    descriptor: (e.descriptor || '').trim(),
    linkedin: e.linkedinUrl || '',
    school: e.school || '',
    location: e.location || '',
    pastCompanies: e.pastCompanies || [],
    affinity: tags,
    isUMichAlum,
    // network-fit signals for the review card
    targetMatch,
    alsoAt,
    // provenance so the UI can be honest about how much is web-sourced vs. typed
    enrichedFromWeb: results.length > 0 && !!extracted,
    exaError,
  }
}

// Compose the deterministic network-fit chips into a single human sentence, e.g.
// "🎯 At a target company · 🎓 UMich alum · you already know 2 people here".
// Kept out of enrichContact so the modal can render chips individually too.
export function fitSummary(draft) {
  const parts = []
  if (draft.targetMatch) parts.push('🎯 At a target company')
  if (draft.isUMichAlum) parts.push('🎓 UMich alum')
  const otherAffinity = (draft.affinity || []).filter(a => a !== 'UMich')
  if (otherAffinity.length) parts.push(otherAffinity.join(' · '))
  if (draft.alsoAt?.length) {
    parts.push(`you already know ${draft.alsoAt.length} ${draft.alsoAt.length === 1 ? 'person' : 'people'} here`)
  }
  return parts
}
