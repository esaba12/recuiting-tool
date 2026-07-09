import { useState } from 'react'
import { fetchGitHubProfile, fetchRepoJobs, parseGitHubInput } from '../../github.js'
import { EmptyState } from '../../shared.jsx'
import RepoJobsView from './RepoJobsView.jsx'
import UserProfileView from './UserProfileView.jsx'

export default function GitHubTab({ apps, onImported }) {
  const [input, setInput]     = useState('')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [history, setHistory] = useState([])

  async function lookup(raw) {
    const val = (raw || input).trim()
    if (!val) return
    const parsed = parseGitHubInput(val)
    if (!parsed) { setError('Could not parse that GitHub URL.'); return }
    setLoading(true); setError(null); setData(null)
    try {
      let result
      if (parsed.type === 'repo') {
        result = { mode: 'repo', ...(await fetchRepoJobs(parsed.owner, parsed.repo)) }
      } else {
        result = { mode: 'user', ...(await fetchGitHubProfile(val)) }
      }
      setData(result)
      const key = parsed.type === 'repo' ? `${parsed.owner}/${parsed.repo}` : parsed.username
      setHistory(h => [key, ...h.filter(x => x !== key)].slice(0, 8))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="github.com/speedyapply/2027-SWE-College-Jobs  or  github.com/username"
          className="flex-1 px-4 py-2.5 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-200" />
        <button onClick={() => lookup()} disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-ink-900 text-white text-sm rounded-xl hover:bg-ink-800 disabled:opacity-40 font-medium transition-colors">
          {loading ? '...' : 'Pull'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {history.map(h => (
            <button key={h} onClick={() => { setInput(h); lookup(h) }}
              className="px-3 py-1 bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs rounded-full font-mono transition-colors">
              {h}
            </button>
          ))}
        </div>
      )}

      {error && <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-700">{error}</div>}
      {loading && <EmptyState msg="Fetching..." />}

      {data?.mode === 'repo'  && <RepoJobsView data={data} apps={apps} onImported={onImported} onClear={() => { setData(null); setInput('') }} />}
      {data?.mode === 'user'  && <UserProfileView data={data} onClear={() => { setData(null); setInput('') }} />}
    </div>
  )
}
