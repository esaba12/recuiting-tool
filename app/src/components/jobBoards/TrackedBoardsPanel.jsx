import { useState } from 'react'
import { SUGGESTED_BOARDS, getTrackedBoards, addTrackedBoard, removeTrackedBoard, toggleTrackedBoard, boardId } from './boardsRegistry.js'

// The "stop finding companies yourself" control surface: manage which boards get
// pulled together, then one button aggregates every one of them into a single,
// deduped, deadline-sorted list. Suggested boards are one-click adds — nothing is
// pre-tracked, but finding a good source still costs zero research.
export default function TrackedBoardsPanel({ onPullAll, pulling, lastPull }) {
  const [boards, setBoardsState] = useState(() => getTrackedBoards())
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)

  const trackedIds = new Set(boards.map(boardId))
  const suggestions = SUGGESTED_BOARDS.filter(s => !trackedIds.has(boardId(s)))

  function refresh(next) { setBoardsState(next) }

  function handleAdd(value) {
    setError(null)
    try { refresh(addTrackedBoard(value)); setInput('') }
    catch (e) { setError(e.message) }
  }

  function handleRemove(id) { refresh(removeTrackedBoard(id)) }
  function handleToggle(id, enabled) { refresh(toggleTrackedBoard(id, enabled)) }

  const enabledCount = boards.filter(b => b.enabled !== false).length

  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-900">📋 Tracked boards</p>
          <p className="text-xs text-ink-400 mt-0.5">
            {boards.length === 0
              ? 'Add the job boards you want scanned — one pull covers all of them.'
              : `${enabledCount} of ${boards.length} board${boards.length !== 1 ? 's' : ''} enabled`}
          </p>
        </div>
        <button onClick={() => onPullAll(boards)} disabled={pulling || enabledCount === 0}
          className="px-4 py-2 bg-ink-900 text-white text-sm rounded-xl hover:bg-ink-800 disabled:opacity-40 font-medium transition-colors shrink-0">
          {pulling ? 'Pulling…' : '↻ Pull all tracked boards'}
        </button>
      </div>

      {boards.length > 0 && (
        <div className="space-y-1.5">
          {boards.map(b => {
            const id = boardId(b)
            return (
              <div key={id} className="flex items-center gap-2 px-3 py-2 bg-ink-50 rounded-lg text-sm">
                <input type="checkbox" checked={b.enabled !== false} onChange={e => handleToggle(id, e.target.checked)}
                  className="accent-accent-600" />
                <a href={`https://github.com/${b.owner}/${b.repo}`} target="_blank" rel="noreferrer"
                  className="flex-1 min-w-0 truncate text-ink-700 hover:text-accent-600 font-medium">
                  {b.label || `${b.owner}/${b.repo}`}
                </a>
                {lastPull?.sources && (() => {
                  const s = lastPull.sources.find(s => boardId(s) === id)
                  if (!s) return null
                  return s.error
                    ? <span className="text-xs text-danger-500 shrink-0" title={s.error}>failed</span>
                    : <span className="text-xs text-ink-400 shrink-0">{s.jobCount} listings</span>
                })()}
                <button onClick={() => handleRemove(id)} className="text-ink-300 hover:text-danger-500 text-xs shrink-0">✕</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && input.trim() && handleAdd(input)}
          placeholder="Add a board: owner/repo or a github.com URL"
          className="flex-1 px-3 py-1.5 border border-ink-200 rounded-lg text-xs focus:outline-none focus:border-accent-400" />
        <button onClick={() => input.trim() && handleAdd(input)}
          className="px-3 py-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs rounded-lg font-medium">
          + Add
        </button>
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}

      {suggestions.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-ink-400 mb-1.5">Suggested:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button key={boardId(s)} onClick={() => handleAdd(s)} title={s.note}
                className="px-2.5 py-1 rounded-full text-xs border border-accent-200 text-accent-700 bg-accent-50 hover:bg-accent-100 transition-colors">
                + {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
