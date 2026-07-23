import { authHeader } from './lib/supabaseClient.js'

// ── URL parsing ───────────────────────────────────────────────────────────────

export function parseGitHubInput(input) {
  input = input.trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\/$/, '')
  const parts = input.split('/').filter(Boolean)
  if (parts.length >= 2) return { type: 'repo', owner: parts[0], repo: parts[1] }
  if (parts.length === 1) return { type: 'user', username: parts[0] }
  return null
}

// ── Repo README → job listings ────────────────────────────────────────────────

function parseTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

// Common HTML entities that show up in cell text/hrefs — matters most for cells sourced
// from a real `<td>`'s innerHTML (parseHtmlTables), where the serializer escapes '&' as
// '&amp;' even inside an href, which would otherwise get used verbatim as a broken apply
// URL. &amp; must decode last so a (rare) double-escaped "&amp;lt;" doesn't get mangled.
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function extractLink(cell) {
  if (!cell) return { text: '', url: null }
  // Multi-location cells often separate entries with <br>/</br> instead of a comma
  // (e.g. vanshb03/Summer2026-Internships: "Chicago, IL</br>New York, NY") — normalize
  // to ", " before any tag-stripping, or the locations silently glue together with no
  // separator at all ("Chicago, ILNew York, NY").
  cell = cell.replace(/<\/?br\s*\/?>/gi, ', ')
  // HTML link: <a href="url"><strong>Text</strong></a>
  const htmlM = cell.match(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
  if (htmlM) return { text: decodeEntities(htmlM[2].replace(/<[^>]+>/g, '')).trim(), url: decodeEntities(htmlM[1]) }
  // Markdown link: [text](url)
  const mdM = cell.match(/\[([^\]]*)\]\(([^)]*)\)/)
  if (mdM) return { text: decodeEntities(mdM[1].replace(/\s*↗\s*$/, '')).trim(), url: decodeEntities(mdM[2]) }
  // Plain — strip any stray HTML/markdown
  return { text: decodeEntities(cell.replace(/<[^>]+>/g, '').replace(/[*_`\[\]]/g, '')).trim(), url: null }
}

function detectStatus(cells, notesIdx) {
  const notesCell = (notesIdx !== null && cells[notesIdx]) ? cells[notesIdx] : cells.join(' ')
  if (/🔒|closed|no longer|expired|filled|removed/i.test(notesCell)) return 'closed'
  return 'open'
}

function findCol(headers, ...candidates) {
  const idx = headers.findIndex(h =>
    candidates.some(c => h.toLowerCase().replace(/[^a-z]/g, '').includes(c.toLowerCase().replace(/[^a-z]/g, '')))
  )
  return idx >= 0 ? idx : null
}

// "↳" (and similar arrow glyphs) means "same company as the row above" — several
// boards use this instead of repeating the company name for a company with multiple
// open roles (e.g. SimplifyJobs/Summer2026-Internships, vanshb03/Summer2026-Internships).
// Without carrying the name forward, every ditto row silently gets dropped (falls into
// the `companyName.length > 0` guard as an empty/junk string) — on some boards that's
// dozens of real listings lost per pull.
const DITTO_RE = /^[↳↑\^]+$/

function resolveCompanyName(raw, lastCompany) {
  const cleaned = (raw || '').replace(/[*_`]/g, '').trim()
  if (!cleaned) return lastCompany || ''
  if (DITTO_RE.test(cleaned)) return lastCompany || ''
  return cleaned
}

const COL_MATCHERS = {
  c: ['company', 'employer', 'organization', 'name'],
  r: ['role', 'position', 'title', 'job', 'internship'],
  l: ['location', 'where', 'office'],
  a: ['application', 'apply', 'link', 'url', 'job link'],
  // 'age' matches boards that show a relative "5d"/"17d" column instead of an
  // absolute date (e.g. speedyapply/2027-SWE-College-Jobs — its "Posting" column is
  // just an apply-button image, the real signal is the separate "Age" column).
  // parseJobDate() in helpers.js handles both formats.
  d: ['date', 'posted', 'added', 'deadline', 'closes', 'age'],
  n: ['notes', 'status', 'active', 'open', 'comments'],
}

function resolveCols(headers) {
  return {
    cCol: findCol(headers, ...COL_MATCHERS.c),
    rCol: findCol(headers, ...COL_MATCHERS.r),
    lCol: findCol(headers, ...COL_MATCHERS.l),
    aCol: findCol(headers, ...COL_MATCHERS.a),
    dCol: findCol(headers, ...COL_MATCHERS.d),
    nCol: findCol(headers, ...COL_MATCHERS.n),
  }
}

// Cells here can be either raw markdown-table cell strings OR a `<td>`'s innerHTML —
// extractLink() already handles both (markdown links, HTML anchors, or plain text), so
// the same row-to-job logic serves both the pipe-table and HTML-table scanners below.
function jobFromCells(cells, cols, lastCompany) {
  const { cCol, rCol, lCol, aCol, dCol, nCol } = cols
  const companyCell = cCol !== null ? cells[cCol] : cells[0]
  const roleLink    = extractLink(rCol !== null ? cells[rCol] : cells[1])
  const locCell     = lCol !== null ? cells[lCol] : ''
  const applyCell   = aCol !== null ? cells[aCol] : ''
  const dateCell    = dCol !== null ? cells[dCol] : ''
  const notesCell   = nCol !== null ? cells[nCol] : ''

  const company = extractLink(companyCell)
  const apply   = extractLink(applyCell)

  const companyName = resolveCompanyName(company.text, lastCompany)
  const roleName    = roleLink.text.replace(/[*_`]/g, '').trim()
  const location    = extractLink(locCell).text.replace(/[*_`]/g, '').trim()
  // Prefer explicit apply link, then role link, then company link
  const applyUrl    = apply.url || roleLink.url || company.url || null
  const dateStr     = extractLink(dateCell).text.replace(/[*_`]/g, '').trim()
  const notes       = extractLink(notesCell).text.replace(/[*_`]/g, '').trim()
  const status      = detectStatus(cells, nCol)

  return { companyName, job: { company: companyName, role: roleName, location, applyUrl, dateAdded: dateStr, notes, status } }
}

// ── Markdown pipe tables (`| Company | Role | ... |`) ──────────────────────────────

function parsePipeTables(md) {
  const lines = md.split('\n')
  const jobs = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\-\s\|:]+\|?$/)) {
      const cols = resolveCols(parseTableRow(line))
      i += 2 // skip separator
      let lastCompany = null

      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = parseTableRow(lines[i].trim())
        const { companyName, job } = jobFromCells(cells, cols, lastCompany)
        if (companyName && companyName !== '---') {
          jobs.push(job)
          lastCompany = companyName
        }
        i++
      }
      continue
    }
    i++
  }
  return jobs
}

// ── HTML `<table>` blocks (e.g. SimplifyJobs/Summer2026-Internships) ────────────────
//
// A large share of the biggest, most-maintained boards render their table as literal
// `<table><thead>/<tbody>` HTML inside the README rather than a markdown pipe table —
// the old parser only understood pipe tables, so pulling these repos silently returned
// zero jobs. DOMParser (available in the browser this module always runs in) turns that
// HTML into real elements instead of hand-rolling an HTML tokenizer with regex.
function parseHtmlTables(md) {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(md, 'text/html')
  const jobs = []

  doc.querySelectorAll('table').forEach(table => {
    const headerCells = table.querySelectorAll('thead th, thead td')
    let headers
    let bodyRows

    if (headerCells.length) {
      headers = Array.from(headerCells).map(c => c.textContent.trim())
      bodyRows = Array.from(table.querySelectorAll('tbody tr'))
    } else {
      // No <thead> — treat the first row as the header and the rest as data.
      const allRows = Array.from(table.querySelectorAll('tr'))
      const [first, ...rest] = allRows
      if (!first) return
      headers = Array.from(first.children).map(c => c.textContent.trim())
      bodyRows = rest
    }

    const cols = resolveCols(headers)
    let lastCompany = null
    bodyRows.forEach(row => {
      const cells = Array.from(row.children).map(td => td.innerHTML)
      if (!cells.length) return
      const { companyName, job } = jobFromCells(cells, cols, lastCompany)
      if (companyName && companyName !== '---') {
        jobs.push(job)
        lastCompany = companyName
      }
    })
  })

  return jobs
}

export function parseJobsFromMarkdown(md) {
  const jobs = [...parsePipeTables(md), ...parseHtmlTables(md)]
  // Cheap safety-net de-dupe in case a board's README somehow renders the same listing
  // through both scanners (shouldn't happen — a table is either pipe or HTML — but a
  // silent double-import would otherwise look like a parser bug to the user).
  const seen = new Set()
  return jobs.filter(j => {
    const key = `${j.company.toLowerCase()}::${(j.role || '').toLowerCase()}::${(j.location || '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// GitHub's README endpoint returns `content` as base64 of the UTF-8 bytes. Plain
// `atob()` decodes base64 into a Latin1 "binary string" — one JS char per byte — which
// mangles every multi-byte UTF-8 sequence into garbage. These READMEs are full of them
// (🔒🎓🛂 status emoji, the "↳" ditto-row arrow, accented company names), so this wasn't
// a cosmetic issue: it silently broke status/ditto detection on real content.
function decodeBase64Utf8(b64) {
  const bytes = Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

export async function fetchRepoJobs(owner, repo, branch) {
  const headers = await authHeader()
  const repoRes = await fetch(`/gh-api/repos/${owner}/${repo}`, { headers })
  if (!repoRes.ok) throw new Error(`Repo not found: ${owner}/${repo}`)
  const repoData = await repoRes.json()

  const readmeUrl = `/gh-api/repos/${owner}/${repo}/readme${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`
  const readmeRes = await fetch(readmeUrl, { headers })
  if (!readmeRes.ok) throw new Error(`No README found in ${owner}/${repo}`)
  const readmeData = await readmeRes.json()
  const md = decodeBase64Utf8(readmeData.content)

  const jobs = parseJobsFromMarkdown(md)
  return {
    repoName:    repoData.full_name,
    repoUrl:     repoData.html_url,
    description: repoData.description,
    stars:       repoData.stargazers_count,
    updatedAt:   repoData.pushed_at,
    jobs,
  }
}

// ── User profile ──────────────────────────────────────────────────────────────

function usernameFromInput(input) {
  input = input.trim()
  // Accept: "torvalds", "github.com/torvalds", "https://github.com/torvalds", "https://github.com/torvalds/"
  const match = input.match(/(?:github\.com\/)?([a-zA-Z0-9-]+)\/?$/)
  return match ? match[1] : null
}

async function gh(path) {
  const res = await fetch(`/gh-api${path}`, { headers: await authHeader() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API ${res.status}`)
  }
  return res.json()
}

export async function fetchGitHubProfile(input) {
  const username = usernameFromInput(input)
  if (!username) throw new Error('Could not parse a GitHub username from that input.')

  const [profile, repos, events, contrib] = await Promise.allSettled([
    gh(`/users/${username}`),
    gh(`/users/${username}/repos?sort=pushed&per_page=8&type=owner`),
    gh(`/users/${username}/events?per_page=50`),
    fetch(`/gh-contrib/v4/${username}?y=last`).then(r => r.ok ? r.json() : null),
  ])

  return {
    username,
    profile:       profile.status       === 'fulfilled' ? profile.value       : null,
    repos:         repos.status         === 'fulfilled' ? repos.value         : [],
    events:        events.status        === 'fulfilled' ? events.value        : [],
    contributions: contrib.status       === 'fulfilled' ? contrib.value       : null,
  }
}

export function topLanguages(repos) {
  const counts = {}
  repos.forEach(r => { if (r.language) counts[r.language] = (counts[r.language] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
}

export function parseEvents(events) {
  const byType = {}
  const recent = []
  events.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1
    if (recent.length < 10) recent.push(e)
  })
  return { byType, recent }
}

export function buildWeeks(contributions) {
  if (!contributions?.contributions?.length) return []

  const days = contributions.contributions
  const weeks = []
  let week = []

  // pad first week so Sunday is index 0
  const firstDow = new Date(days[0].date + 'T12:00:00Z').getUTCDay()
  for (let i = 0; i < firstDow; i++) week.push(null)

  days.forEach(day => {
    const dow = new Date(day.date + 'T12:00:00Z').getUTCDay()
    if (dow === 0 && week.length > 0) { weeks.push(week); week = [] }
    week.push(day)
  })
  if (week.length) weeks.push(week)
  return weeks
}
