// Unlike api/notion.js-style proxies (static bearer token injection), Google's
// API needs a short-lived access token minted from a refresh token on every
// request. Multi-tenant version: the refresh token is looked up per calling
// user (from google_calendar_tokens, set via the "Connect Calendar" flow in
// Settings — see lib/googleAuth.js), not one global env var. The OAuth
// *client* (GOOGLE_CLIENT_ID/SECRET) stays a shared app-level credential —
// that's normal; only the per-user consent (refresh token) is per-user.
import { requireUser, supabaseAdmin } from './_lib/supabaseAdmin.js'
import { decrypt } from './_lib/crypto.js'

function extraQuery(query) {
  const { path, ...rest } = query
  const qs = new URLSearchParams(rest).toString()
  return qs ? `?${qs}` : ''
}

async function getRefreshToken(userId) {
  const { data, error } = await supabaseAdmin()
    .from('google_calendar_tokens')
    .select('refresh_token_ciphertext')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  try { return decrypt(data.refresh_token_ciphertext) } catch { return null }
}

async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || `Token refresh failed (${res.status})`)
  return data.access_token
}

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const refreshToken = await getRefreshToken(user.id)
  if (!refreshToken) {
    return res.status(400).json({ error: { message: 'Connect your Google Calendar in Settings first.' } })
  }

  let accessToken
  try {
    accessToken = await getAccessToken(refreshToken)
  } catch (e) {
    res.status(502).json({ error: { message: `Google auth failed: ${e.message}` } })
    return
  }

  const target = `https://www.googleapis.com/${req.query.path || ''}${extraQuery(req.query)}`

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  })

  const data = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(data)
}
