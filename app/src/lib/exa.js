import { claudeJSON, CLAUDE_MODELS } from './claude.js'

// People discovery via Exa (see api/exa.js + vite.config.js). Exa searches its own index
// of the PUBLIC web — company pages, personal sites, public profile pages as crawled
// openly — the same legal posture as any search engine. It never logs into or scrapes
// LinkedIn directly; LinkedIn URLs it surfaces are treated as reference links only.
//
// Two steps: (1) Exa /search finds candidate people-pages, (2) one Claude call structures
// them into a clean people array. Ranking is intentionally NOT done here — that's
// lib/discovery.js, so the search layer stays a pure "who's out there" fetch.

// Natural-language people query from a company + target roles + the user's university
// (folding a strong résumé signal into the query surfaces warm-tie matches in results).
function buildQuery({ company, roles, profile }) {
  const roleStr = roles?.length ? roles.join(' OR ') : 'software engineer'
  const signal = profile?.university ? ` ${profile.university}` : ''
  return `${roleStr} at ${company}${signal}`
}

// Raw Exa /search over the public-web people index. Returns result pages (url/title/
// text/summary); extraction is a separate step. `type: auto` lets Exa pick neural vs
// keyword; `category: people` biases toward individual profiles over company pages.
export async function exaSearch({ query, numResults = 15, includeDomains }) {
  const res = await fetch('/exa/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      type: 'auto',
      category: 'people',
      numResults,
      ...(includeDomains ? { includeDomains } : {}),
      contents: { text: { maxCharacters: 1200 }, summary: true },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(res.status === 401 || res.status === 403
      ? 'Add EXA_API_KEY to your .env to enable people discovery'
      : err.error || err.message || `Exa error ${res.status}`)
  }
  const data = await res.json()
  return data.results || []
}

export const normUrl = u => (u || '').trim().toLowerCase().replace(/\/+$/, '').replace(/[?#].*$/, '')

// Stable 32-bit FNV-1a hash of the (sorted, normalized) result URLs — lets the caller
// detect when Exa surfaced the *same* pages as last time and skip the (token-costly)
// Claude extraction entirely. This is the biggest token saver in the hands-off refresh.
export function hashUrls(urls) {
  const key = [...new Set((urls || []).map(normUrl).filter(Boolean))].sort().join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}

// company + roles + profile -> structured people ready for discoveryScore().
// Token-frugal: if `priorResultHash` matches this run's result URLs, returns
// `{ people: null, skippedExtraction: true }` (caller keeps its cached people, no Claude
// call). `knownUrls` (a Set of already added/dismissed profile URLs) is dropped before
// extraction so we never spend tokens re-structuring people you've already handled.
// Person shape: { name, title, company, school, pastCompanies[], programs[], linkedinUrl }
export async function discoverPeople({ company, roles, profile, priorResultHash = null, knownUrls = null }) {
  const query = buildQuery({ company, roles, profile })
  const results = await exaSearch({ query })
  const resultHash = hashUrls(results.map(r => r.url))

  if (!results.length) return { people: [], resultHash, skippedExtraction: false }
  if (priorResultHash && resultHash === priorResultHash) {
    return { people: null, resultHash, skippedExtraction: true }
  }

  const usable = (knownUrls && knownUrls.size)
    ? results.filter(r => !knownUrls.has(normUrl(r.url)))
    : results
  if (!usable.length) return { people: [], resultHash, skippedExtraction: false }

  const digest = usable.slice(0, 15)
    .map((r, i) => `[${i}] url: ${r.url}\ntitle: ${r.title || ''}\n${(r.summary || r.text || '').slice(0, 900)}`)
    .join('\n\n')

  const content = `From the web search results below, extract distinct real PEOPLE who currently work at "${company}". Return ONLY valid JSON, no markdown, no explanation.

For each person include:
- name
- title (their current role)
- company (should be "${company}")
- school (undergrad or grad university, if stated — else null)
- pastCompanies (array of prior employers, if stated — else [])
- programs (clubs, fellowships, or programs mentioned — else [])
- linkedinUrl (the linkedin.com/in/... URL if present in the result url or text — else null)

Ignore results that are not about a specific individual (company/about pages, job listings, news articles). Deduplicate people. Return at most 12.

Results:
${digest}

{
  "people": [
    { "name": "Full Name", "title": "Software Engineer", "company": "${company}", "school": "University X or null", "pastCompanies": [], "programs": [], "linkedinUrl": "https://linkedin.com/in/... or null" }
  ]
}`

  const parsed = await claudeJSON({ model: CLAUDE_MODELS.HAIKU, content, maxTokens: 1500 })
  return { people: (parsed.people || []).filter(p => p?.name), resultHash, skippedExtraction: false }
}
