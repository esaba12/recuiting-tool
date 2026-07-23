// Proxies api.openai.com using the CALLING USER's own BYOK OpenAI key — used
// instead of /claude-api for every text-only call when the user's profile
// ai_provider is 'openai' (see lib/ai.js).
import { requireUser } from './_lib/supabaseAdmin.js'
import { getUserKey } from './_lib/keys.js'

function extraQuery(query) {
  const { path, ...rest } = query
  const qs = new URLSearchParams(rest).toString()
  return qs ? `?${qs}` : ''
}

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const apiKey = await getUserKey(user.id, 'openai')
  if (!apiKey) {
    return res.status(400).json({ error: { message: 'Add your OpenAI API key in Settings to enable GPT-powered features.' } })
  }

  const target = `https://api.openai.com/${req.query.path || ''}${extraQuery(req.query)}`

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  })

  const data = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(data)
}
