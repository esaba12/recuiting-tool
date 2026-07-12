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
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse Claude response as JSON')
  return JSON.parse(match[0])
}
