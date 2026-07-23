// Tracked GitHub job boards — the "stop pasting one link at a time" layer. A tracked
// board is just {owner, repo, branch?, label} persisted to localStorage; pullAllBoards()
// fetches every tracked board in parallel, tags each job with its source, and merges +
// dedupes into one list so "give me every company across every board" is one click.
//
// Nothing is pre-tracked out of the box (deliberate — see CLAUDE.md/chat: the user opted
// to pick their own sources rather than have 3 repos silently added), but SUGGESTED_BOARDS
// below powers one-click "+ add" chips so finding good sources still costs zero research.

import { fetchRepoJobs, parseGitHubInput } from '../../github.js'
import { lsGet, lsSet } from './helpers.js'

const STORAGE_KEY = 'rec_tracked_boards'

// Verified live as of writing (GET /repos/<owner>/<repo> -> 200). Kept small and
// high-signal rather than exhaustive — these three between them cover the large-board
// (SimplifyJobs), well-maintained-alternate (vanshb03/Ouckah), and salary-annotated
// (speedyapply) niches, and SimplifyJobs' own README already sections off Product
// Management roles, so a separate PM-only board isn't needed on top of it.
export const SUGGESTED_BOARDS = [
  { owner: 'SimplifyJobs', repo: 'Summer2026-Internships', branch: 'dev',
    label: 'SimplifyJobs — Summer 2026 Internships', note: 'Biggest, updated hourly. Covers SWE, PM, Data/AI, Quant, Hardware.' },
  { owner: 'vanshb03', repo: 'Summer2026-Internships',
    label: 'Vansh/Ouckah — Summer 2026 Internships', note: 'Community-maintained alternate source — catches roles Simplify misses.' },
  { owner: 'speedyapply', repo: '2027-SWE-College-Jobs',
    label: 'speedyapply — SWE Internships & New Grad', note: 'Includes hourly pay rate per listing.' },
]

function boardId(b) { return `${b.owner}/${b.repo}`.toLowerCase() }

export function getTrackedBoards() {
  return lsGet(STORAGE_KEY) || []
}

function persist(boards) { lsSet(STORAGE_KEY, boards); return boards }

// Accepts a raw "owner/repo" string, a full github.com URL, or a {owner,repo} object
// (from SUGGESTED_BOARDS). Returns the updated list, or throws if unparseable/duplicate.
export function addTrackedBoard(input) {
  const boards = getTrackedBoards()
  const parsed = typeof input === 'string'
    ? (() => { const p = parseGitHubInput(input); return p?.type === 'repo' ? { owner: p.owner, repo: p.repo } : null })()
    : (input?.owner && input?.repo ? { owner: input.owner, repo: input.repo, branch: input.branch, label: input.label } : null)
  if (!parsed) throw new Error('Could not parse that as a GitHub repo (expected owner/repo or a github.com URL).')

  const id = boardId(parsed)
  if (boards.some(b => boardId(b) === id)) throw new Error(`${parsed.owner}/${parsed.repo} is already tracked.`)

  const board = { owner: parsed.owner, repo: parsed.repo, branch: parsed.branch, label: parsed.label || `${parsed.owner}/${parsed.repo}`, enabled: true, addedAt: Date.now() }
  return persist([...boards, board])
}

export function removeTrackedBoard(id) {
  return persist(getTrackedBoards().filter(b => boardId(b) !== id))
}

export function toggleTrackedBoard(id, enabled) {
  return persist(getTrackedBoards().map(b => boardId(b) === id ? { ...b, enabled } : b))
}

export { boardId }

// Fetch every enabled tracked board in parallel, tag each job with its source repo, and
// merge into one deduped list. Company+role+location exact-match dedup (same normalization
// findDuplicateGroups uses in shared.jsx) — the same internship is commonly cross-posted on
// 2+ boards verbatim; a looser fuzzy match risks silently collapsing two genuinely different
// roles at the same company. One board failing (bad repo, rate limit, README moved) never
// blocks the others — its error surfaces per-board instead of killing the whole pull.
export async function pullAllBoards(boards) {
  const enabled = boards.filter(b => b.enabled !== false)
  const results = await Promise.allSettled(enabled.map(b => fetchRepoJobs(b.owner, b.repo, b.branch)))

  const sources = []
  const seen = new Map() // dedupe key -> job (first source wins; later sources just get counted)
  let dupeCount = 0

  results.forEach((r, i) => {
    const board = enabled[i]
    if (r.status === 'rejected') {
      sources.push({ ...board, error: r.reason?.message || 'Failed to fetch', jobCount: 0 })
      return
    }
    const data = r.value
    sources.push({ ...board, repoName: data.repoName, repoUrl: data.repoUrl, stars: data.stars, jobCount: data.jobs.length, error: null })
    data.jobs.forEach(j => {
      const key = `${j.company.trim().toLowerCase()}::${(j.role || '').trim().toLowerCase()}::${(j.location || '').trim().toLowerCase()}`
      if (seen.has(key)) { dupeCount++; return }
      seen.set(key, { ...j, sourceRepo: data.repoName })
    })
  })

  return { jobs: [...seen.values()], sources, dupeCount }
}
