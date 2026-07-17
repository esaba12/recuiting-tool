// Shared client for the /claude-api proxy (see api/claude-api.js + vite.config.js).
// Extracted from 3 near-identical hand-rolled fetch calls that previously lived in
// LogInteractionModal.jsx, jobBoards/helpers.js, and AddToCalendarModal.jsx.

export const CLAUDE_MODELS = {
  HAIKU: 'claude-haiku-4-5-20251001',
  SONNET: 'claude-sonnet-4-6',
}

// content: a plain string, or a content-block array (e.g. AddToCalendarModal's
// [{type:'image', source:{...}}, {type:'text', text:'...'}] vision payload).
async function callClaude({ model, content, maxTokens = 1000 }) {
  const res = await fetch('/claude-api/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(res.status === 401 || res.status === 403
      ? 'Add ANTHROPIC_API_KEY to your .env to enable AI features'
      : err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

export async function claudeText({ model, content, maxTokens }) {
  return callClaude({ model, content, maxTokens })
}

export async function claudeJSON({ model, content, maxTokens }) {
  const text = await callClaude({ model, content, maxTokens })
  return parseJSONLoose(text)
}

// Robustly parse a JSON object out of a Claude response. Claude occasionally hits the
// max_tokens ceiling mid-output and returns a TRUNCATED array/object — a naive JSON.parse
// then throws "Expected ',' or ']' after array element at position N". This first tries a
// strict parse, then salvages a truncated document by trimming back to the last complete
// array element and closing any still-open brackets. Shared by every claudeJSON caller
// (company ranking, people extraction, contact enrichment, call/email parsing).
export function parseJSONLoose(text) {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('Could not parse Claude response as JSON')
  // Despite "no markdown" in every prompt, Haiku sometimes wraps the JSON in a ```
  // fence anyway. A trailing fence isn't a truncation (closeTruncatedJSON below only
  // repairs missing closing brackets), so strip it before attempting a parse.
  const body = text.slice(start).replace(/\s*```\s*$/, '')

  try { return JSON.parse(body) } catch { /* fall through to salvage */ }

  const repaired = closeTruncatedJSON(body)
  if (repaired) {
    try { return JSON.parse(repaired) } catch { /* give up below */ }
  }
  throw new Error('Could not parse Claude response as JSON')
}

// The closing string that would balance a (possibly truncated) JSON prefix: a quote if it
// ends mid-string, then the still-open brackets. Scans char-by-char so brackets inside
// strings don't count. Lets a single object truncated mid-value (e.g. a cut-off
// "descriptor") still parse, not just truncated arrays.
function closersFor(s) {
  const stack = []
  let inStr = false, esc = false
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
  }
  const quote = inStr ? '"' : ''
  return quote + stack.reverse().map(c => (c === '{' ? '}' : ']')).join('')
}

// Salvage a truncated JSON doc: cut back to the end of the last array element that closed
// cleanly (a '}' whose immediate parent is '['), drop any trailing partial element/comma,
// then append the brackets needed to balance it. Turns `{"x":[{a},{b},{c   <cut>` into the
// valid `{"x":[{a},{b}]}` (the incomplete {c} is dropped rather than guessed at).
function closeTruncatedJSON(s) {
  const stack = []
  let inStr = false, esc = false, lastSafe = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') {
      stack.pop()
      if (ch === '}' && stack[stack.length - 1] === '[') lastSafe = i + 1
    }
  }
  const core = (lastSafe > 0 ? s.slice(0, lastSafe) : s).replace(/[\s,]*$/, '')
  const closers = closersFor(core)
  return closers ? core + closers : null
}
