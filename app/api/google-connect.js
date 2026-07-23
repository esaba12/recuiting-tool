// Persists the per-user Google Calendar refresh token captured right after
// the "Connect Calendar" OAuth consent (see lib/googleAuth.js's
// connectGoogleCalendar() — Supabase only surfaces provider_refresh_token in
// the Session object once, immediately after that exact OAuth redirect, so
// the client must hand it to us here to store it durably).
//
// GET    /api/google-connect -> { connected: boolean, email: string|null }
// POST   /api/google-connect  body: { refreshToken, email } -> store it
// DELETE /api/google-connect -> disconnect
import { requireUser, supabaseAdmin } from './_lib/supabaseAdmin.js'
import { encrypt } from './_lib/crypto.js'

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('google_calendar_tokens')
      .select('connected_email, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ connected: !!data, email: data?.connected_email || null })
  }

  if (req.method === 'POST') {
    const { refreshToken, email } = req.body || {}
    if (!refreshToken) return res.status(400).json({ error: { message: 'refreshToken is required' } })
    const { error } = await db.from('google_calendar_tokens').upsert({
      user_id: user.id,
      refresh_token_ciphertext: encrypt(refreshToken),
      connected_email: email || null,
    }, { onConflict: 'user_id' })
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ connected: true, email: email || null })
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('google_calendar_tokens').delete().eq('user_id', user.id)
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ connected: false })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: { message: 'Method not allowed' } })
}
