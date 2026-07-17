import { useEffect, useRef, useState } from 'react'
import { generateJobBlurb, jobId, lsGet, lsSet } from './helpers.js'

const BLURB_KEY = 'rec_job_blurbs'
const CONCURRENCY = 3

// Lazily fetches + caches company/role blurbs for whichever jobs are currently visible.
// Cache is keyed by jobId and persists forever (localStorage) — a company/role description
// doesn't go stale the way a fit score would, so once fetched it's free on every later visit.
export default function useJobBlurbs(jobs) {
  const [blurbs, setBlurbs] = useState(() => lsGet(BLURB_KEY) || {})
  const blurbsRef = useRef(blurbs)
  blurbsRef.current = blurbs
  const pendingRef = useRef(new Set())

  const jobsKey = jobs.map(jobId).join('|')

  useEffect(() => {
    const missing = jobs.filter(j => {
      const key = jobId(j)
      return !blurbsRef.current[key] && !pendingRef.current.has(key)
    })
    if (missing.length === 0) return

    let cancelled = false
    let idx = 0
    missing.forEach(j => pendingRef.current.add(jobId(j)))

    async function worker() {
      while (idx < missing.length) {
        const job = missing[idx++]
        const key = jobId(job)
        try {
          const blurb = await generateJobBlurb(job)
          if (!cancelled) setBlurbs(b => {
            const next = { ...b, [key]: blurb }
            lsSet(BLURB_KEY, next)
            return next
          })
        } catch {
          // Fail-soft: leave uncached — the card just shows no description, never blocks.
        } finally {
          pendingRef.current.delete(key)
        }
      }
    }
    Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey])

  return blurbs
}
