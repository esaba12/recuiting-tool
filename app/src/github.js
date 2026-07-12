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

function extractLink(cell) {
  if (!cell) return { text: '', url: null }
  // HTML link: <a href="url"><strong>Text</strong></a>
  const htmlM = cell.match(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
  if (htmlM) return { text: htmlM[2].replace(/<[^>]+>/g, '').trim(), url: htmlM[1] }
  // Markdown link: [text](url)
  const mdM = cell.match(/\[([^\]]*)\]\(([^)]*)\)/)
  if (mdM) return { text: mdM[1].replace(/\s*↗\s*$/, '').trim(), url: mdM[2] }
  // Plain — strip any stray HTML/markdown
  return { text: cell.replace(/<[^>]+>/g, '').replace(/[*_`\[\]]/g, '').trim(), url: null }
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

export function parseJobsFromMarkdown(md) {
  const lines = md.split('\n')
  const jobs = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    // Table header row
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\-\s\|:]+\|?$/)) {
      const headers = parseTableRow(line)
      i += 2 // skip separator

      const cCol = findCol(headers, 'company', 'employer', 'organization', 'name')
      const rCol = findCol(headers, 'role', 'position', 'title', 'job', 'internship')
      const lCol = findCol(headers, 'location', 'where', 'office')
      const aCol = findCol(headers, 'application', 'apply', 'link', 'url', 'job link')
      // 'age' matches boards that show a relative "5d"/"17d" column instead of an
      // absolute date (e.g. speedyapply/2027-SWE-College-Jobs, this project's actual
      // primary source — its "Posting" column is just an apply-button image, the real
      // signal is the separate "Age" column). parseJobDate() in helpers.js handles
      // both formats.
      const dCol = findCol(headers, 'date', 'posted', 'added', 'deadline', 'closes', 'age')
      const nCol = findCol(headers, 'notes', 'status', 'active', 'open', 'comments')

      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = parseTableRow(lines[i].trim())

        const companyCell = cCol !== null ? cells[cCol] : cells[0]
        const roleCell    = rCol !== null ? cells[rCol] : cells[1]
        const locCell     = lCol !== null ? cells[lCol] : ''
        const applyCell   = aCol !== null ? cells[aCol] : ''
        const dateCell    = dCol !== null ? cells[dCol] : ''
        const notesCell   = nCol !== null ? cells[nCol] : ''

        const company = extractLink(companyCell)
        const roleLink = extractLink(roleCell)
        const apply   = extractLink(applyCell)

        const companyName = company.text.replace(/[*_`]/g, '').trim()
        const roleName    = roleLink.text.replace(/[*_`]/g, '').trim()
        const location    = extractLink(locCell).text.replace(/[*_`]/g, '').trim()
        // Prefer explicit apply link, then role link, then company link
        const applyUrl    = apply.url || roleLink.url || company.url || null
        const dateStr     = extractLink(dateCell).text.replace(/[*_`]/g, '').trim()
        const notes       = extractLink(notesCell).text.replace(/[*_`]/g, '').trim()
        const status      = detectStatus(cells, nCol)

        if (companyName && companyName !== '---' && companyName.length > 0) {
          jobs.push({ company: companyName, role: roleName, location, applyUrl, dateAdded: dateStr, notes, status })
        }
        i++
      }
      continue
    }
    i++
  }
  return jobs
}

export async function fetchRepoJobs(owner, repo) {
  // Get default branch first, then README
  const repoRes = await fetch(`/gh-api/repos/${owner}/${repo}`)
  if (!repoRes.ok) throw new Error(`Repo not found: ${owner}/${repo}`)
  const repoData = await repoRes.json()
  const branch = repoData.default_branch || 'main'

  const readmeRes = await fetch(`/gh-api/repos/${owner}/${repo}/readme`)
  if (!readmeRes.ok) throw new Error(`No README found in ${owner}/${repo}`)
  const readmeData = await readmeRes.json()
  const md = atob(readmeData.content.replace(/\n/g, ''))

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
  const res = await fetch(`/gh-api${path}`)
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
