// Proxies api.exa.ai so EXA_API_KEY never reaches the browser bundle — same flat-file
// `?path=` pattern as api/notion.js / api/claude-api.js (nested dynamic routes silently
// 404 on Vercel, see CLAUDE.md). Exa is the compliant people-discovery engine for the
// Discover tab: it searches its own index of the PUBLIC web, never scraping LinkedIn.
function extraQuery(query) {
  const { path, ...rest } = query
  const qs = new URLSearchParams(rest).toString()
  return qs ? `?${qs}` : ''
}

export default async function handler(req, res) {
  const target = `https://api.exa.ai/${req.query.path || ''}${extraQuery(req.query)}`

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'x-api-key': process.env.EXA_API_KEY || '',
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  })

  const data = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(data)
}
