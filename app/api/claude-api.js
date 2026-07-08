function extraQuery(query) {
  const { path, ...rest } = query
  const qs = new URLSearchParams(rest).toString()
  return qs ? `?${qs}` : ''
}

export default async function handler(req, res) {
  const target = `https://api.anthropic.com/${req.query.path || ''}${extraQuery(req.query)}`

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
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
