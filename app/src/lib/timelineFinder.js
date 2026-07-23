// Scans Applications/Calls/Interactions free-text fields for real, dated recruiting
// timeline events (interview dates, OA deadlines, application deadlines, start dates)
// that aren't captured in any structured Notion field today. Batched — one AI call
// covers every changed record — and hash-gated so an unchanged record never gets
// re-scanned on the next daily run. Findings are staged for review, not auto-created;
// TimelineFindsPanel.jsx is what actually writes to Google Calendar, on approval.

import { aiJSON, AI_MODELS } from './ai.js'

const CHUNK_SIZE = 30 // records per Haiku call — keeps prompts small even on a big history

// FNV-1a, same algorithm as exa.js's hashUrls — detects "this record's scanned text
// changed since last run" without needing a real diff.
function hashText(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}

// One candidate per source record that has non-trivial text worth scanning. `key` is
// stable across runs (used for the hash-skip cache); `anchorDate` lets Haiku resolve
// relative dates ("next Tuesday") mentioned relative to when the record was logged.
function candidatesFrom(apps, calls, interactions, contactsById) {
  const out = []
  for (const a of (apps || [])) {
    const text = (a.notes || '').trim()
    // Skip the auto-generated "Posted <date>" stub addApplication() writes on import —
    // pure noise, no real timeline signal, and the bulk of most users' Applications rows.
    // Anchored both ends + length-capped so a genuine note that happens to start with
    // "Posted" but has real content isn't silently dropped.
    if (!text || /^Posted\s+[\w,.\- ]{1,25}$/i.test(text)) continue
    out.push({ key: `application:${a.id}`, sourceType: 'application', sourceId: a.id,
      company: a.company, role: a.role, anchorDate: a.appliedDate || a.createdTime?.slice(0, 10), text })
  }
  for (const c of (calls || [])) {
    const text = [c.summary, c.keyInsights, c.fullTranscript].filter(Boolean).join('\n').trim()
    if (!text) continue
    const contact = contactsById?.get(c.contactId)
    out.push({ key: `call:${c.id}`, sourceType: 'call', sourceId: c.id,
      company: contact?.company || '', role: contact?.role || '', anchorDate: c.date, text })
  }
  for (const i of (interactions || [])) {
    const text = [i.summary, i.body].filter(Boolean).join('\n').trim()
    if (!text) continue
    const contact = contactsById?.get(i.contactId)
    out.push({ key: `interaction:${i.id}`, sourceType: 'interaction', sourceId: i.id,
      company: contact?.company || '', role: contact?.role || '', anchorDate: i.date, text })
  }
  return out.map(c => ({ ...c, hash: hashText(c.text) }))
}

const PROMPT_HEADER = `You are scanning a student's recruiting records for real, specific future events worth putting on their calendar — interview dates, online assessment (OA) deadlines, application deadlines, offer decision deadlines, or a confirmed start date. Each record is labeled with a bracketed ID and an anchor date (when the record was logged) — use the anchor date to resolve relative mentions like "next Tuesday" or "in 3 days".

Rules:
- Only return events with a specific, resolvable calendar date. Skip vague mentions ("sometime next month", "TBD", "will schedule soon").
- Never invent a date that isn't stated or clearly resolvable from the anchor date.
- One record can produce zero, one, or multiple events.
- "id" in your output must be the exact bracketed ID string from the record's label.
- Return ONLY valid JSON, no markdown, no explanation:
{"events": [{"id": "...", "title": "...", "date": "YYYY-MM-DD", "start_time": "HH:MM 24h or null", "description": "brief, quote or paraphrase the source"}]}
- If a record has no real timeline event, omit it — do not return a placeholder.

Records:
`

async function scanChunk(chunk) {
  const body = chunk.map(c =>
    `[${c.key}] anchor date: ${c.anchorDate || 'unknown'} · ${c.company || 'unknown company'}${c.role ? ' · ' + c.role : ''}\n${c.text}`
  ).join('\n---\n')

  const parsed = await aiJSON({ model: AI_MODELS.MINI, content: PROMPT_HEADER + body, maxTokens: 2000 })
  return parsed.events || []
}

// skipHashes: { [key]: hash } from the last run — records whose hash matches are skipped
// entirely (zero tokens spent re-scanning unchanged content). Returns the found events,
// the record hashes safe to persist as "scanned" (so the caller can update the skip
// cache), and an error string if any chunk failed. A failed chunk's records are left out
// of scannedKeys so they're retried on the next run instead of silently going stale —
// one malformed Haiku response (e.g. from a record with unusual characters tripping up
// JSON-boundary detection) shouldn't take the whole batch down with it.
export async function findTimelineEvents({ apps, calls, interactions, contactsById, skipHashes = {} }) {
  const all = candidatesFrom(apps, calls, interactions, contactsById)
  const fresh = all.filter(c => skipHashes[c.key] !== c.hash)
  const scannedKeys = Object.fromEntries(all.filter(c => skipHashes[c.key] === c.hash).map(c => [c.key, c.hash]))
  if (!fresh.length) return { events: [], scannedKeys, error: null }

  const chunks = []
  for (let i = 0; i < fresh.length; i += CHUNK_SIZE) chunks.push(fresh.slice(i, i + CHUNK_SIZE))
  const byKey = new Map(fresh.map(c => [c.key, c]))
  const today = new Date().toISOString().slice(0, 10)

  const results = await Promise.allSettled(chunks.map(scanChunk))
  const rawEvents = []
  const errors = []
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      rawEvents.push(...r.value)
      for (const c of chunks[idx]) scannedKeys[c.key] = c.hash
    } else {
      errors.push(r.reason?.message || 'Scan failed')
    }
  })

  const events = rawEvents
    .filter(e => byKey.has(e.id) && e.date && e.date >= today)
    .map(e => {
      const c = byKey.get(e.id)
      return {
        key: `${c.key}::${e.date}::${(e.title || '').slice(0, 40)}`,
        sourceType: c.sourceType, sourceId: c.sourceId,
        company: c.company, role: c.role,
        title: e.title || `${c.company || 'Timeline'} event`,
        date: e.date, startTime: e.start_time || '', description: e.description || '',
      }
    })

  const error = errors.length ? `${errors.length}/${chunks.length} scan batch(es) failed (will retry next run): ${errors[0]}` : null
  return { events, scannedKeys, error }
}
