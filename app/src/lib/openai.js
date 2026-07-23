import { parseJSONLoose } from './claude.js'
import { authHeader } from './supabaseClient.js'

// Shared client for the /openai-api proxy (see api/openai.js + vite.config.js).
// Mirrors lib/claude.js's shape (openaiText/openaiJSON, same {model,content,maxTokens}
// signature) so every JSON-extraction call site in the app (job blurbs, deadline
// extraction, contact enrichment, company ranking, call/email parsing, timeline
// scanning) can swap providers by changing an import line, not a call shape.
//
// Vision (AddToCalendarModal's screenshot→event extraction) deliberately stays on
// Claude Sonnet vision — the content-block format differs enough between the two
// APIs that swapping it untested carries real regression risk, and it's the one
// place this app has no way to verify output quality without a live screenshot.

export const OPENAI_MODELS = {
  MINI:     'gpt-5.1-mini', // cheap/fast — structured extraction, blurbs, deadline reads
  STANDARD: 'gpt-5.1',      // heavier judgment calls — fit analysis, company ranking
}

// GPT-5.1+ chat completions use `max_completion_tokens` (max_tokens is deprecated /
// rejected on reasoning-tuned routes) and `response_format: {type:'json_object'}` for
// JSON mode — the prompt itself must still ask for JSON (already true of every prompt
// this proxies, carried over verbatim from the Claude call sites).
async function callOpenAI({ model, content, maxTokens = 1000, json = false }) {
  const res = await fetch('/openai-api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      max_completion_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(res.status === 401 || res.status === 403
      ? (err.error?.message || 'Add your OpenAI API key in Settings to enable AI features')
      : err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function openaiText({ model, content, maxTokens }) {
  return callOpenAI({ model, content, maxTokens })
}

// Reuses the exact same truncated-JSON salvage logic Claude call sites rely on —
// response_format:json_object makes truncation rarer, but a max_completion_tokens
// ceiling mid-array is still possible, and this keeps behavior identical either way.
export async function openaiJSON({ model, content, maxTokens }) {
  const text = await callOpenAI({ model, content, maxTokens, json: true })
  return parseJSONLoose(text)
}
