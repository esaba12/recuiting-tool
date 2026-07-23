// Proxies api.exa.ai using the CALLING USER's own BYOK Exa key — powers
// Discover's people search, Explore's company search, and Job Boards'
// deadline extraction. All fail-soft in the UI when a key isn't set.
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

  const apiKey = await getUserKey(user.id, 'exa')
  if (!apiKey) {
    return res.status(400).json({ error: { message: 'Add your Exa API key in Settings to enable people/company discovery.' } })
  }

  const target = `https://api.exa.ai/${req.query.path || ''}${extraQuery(req.query)}`

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  })

  const data = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(data)
}
