import { useEffect, useRef, useState } from 'react'
import { extractDeadlines } from '../../lib/deadlines.js'
import { jobId, lsGet, lsSet } from './helpers.js'

const DEADLINE_KEY = 'rec_job_deadlines'

// Lazily fetches + caches real deadline reads for whichever open jobs are currently
// visible, exactly like useJobBlurbs.js but batched through extractDeadlines() instead
// of one-job-per-call — a company/role blurb doesn't change, and neither does "does this
// specific apply page state a deadline", so once resolved a job is never re-checked
// (a manual "↻ Recheck" surfaced in the UI clears its cache entry to force one).
export default function useJobDeadlines(jobs) {
  const [deadlines, setDeadlines] = useState(() => lsGet(DEADLINE_KEY) || {})
  const deadlinesRef = useRef(deadlines)
  deadlinesRef.current = deadlines
  const pendingRef = useRef(new Set())

  const jobsKey = jobs.map(jobId).join('|')

  useEffect(() => {
    const missing = jobs
      .filter(j => j.status !== 'closed')
      .filter(j => {
        const key = jobId(j)
        return !deadlinesRef.current[key] && !pendingRef.current.has(key)
      })
    if (missing.length === 0) return

    let cancelled = false
    missing.forEach(j => pendingRef.current.add(jobId(j)))

    extractDeadlines(missing.map(j => ({ key: jobId(j), company: j.company, role: j.role, applyUrl: j.applyUrl })))
      .then(results => {
        if (cancelled) return
        setDeadlines(d => {
          const next = { ...d }
          for (const [key, val] of Object.entries(results)) if (!val.error) next[key] = val
          lsSet(DEADLINE_KEY, next)
          return next
        })
      })
      .catch(() => { /* fail-soft — jobs just show no deadline badge, never blocks the list */ })
      .finally(() => { missing.forEach(j => pendingRef.current.delete(jobId(j))) })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey])

  function recheck(job) {
    const key = jobId(job)
    setDeadlines(d => {
      const next = { ...d }
      delete next[key]
      lsSet(DEADLINE_KEY, next)
      return next
    })
  }

  return { deadlines, recheck }
}
