// Proxies api.anthropic.com using the CALLING USER's own BYOK Anthropic key
// (set via Settings -> /api/keys), never a shared global key — see CLAUDE.md's
// "AI Provider Switch" + BYOK sections. Vision calls (AddToCalendarModal) also
// go through here since they always use Claude regardless of the AI provider
// switch.
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

  const apiKey = await getUserKey(user.id, 'anthropic')
  if (!apiKey) {
    return res.status(400).json({ error: { message: 'Add your Anthropic API key in Settings to enable Claude-powered features.' } })
  }

  const target = `https://api.anthropic.com/${req.query.path || ''}${extraQuery(req.query)}`

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  })

  const data = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(data)
}
