// Authenticated BYOK key management — the browser never talks to
// user_api_keys directly (that table has zero RLS policies, see the migration
// comment). Instead it calls this endpoint with its Supabase session token;
// we verify it server-side, then read/write via the service-role client.
//
// GET    /api/keys           -> [{ provider, hasKey, last4 }] for every BYOK provider
// POST   /api/keys            body: { provider, apiKey } -> upsert (encrypts before storing)
// DELETE /api/keys?provider=x -> remove one provider's key
import { requireUser, supabaseAdmin } from './_lib/supabaseAdmin.js'
import { encrypt } from './_lib/crypto.js'

const PROVIDERS = ['anthropic', 'openai', 'exa', 'github']

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('user_api_keys')
      .select('provider, last4, updated_at')
      .eq('user_id', user.id)
    if (error) return res.status(500).json({ error: { message: error.message } })
    const byProvider = Object.fromEntries((data || []).map(r => [r.provider, r]))
    return res.status(200).json(PROVIDERS.map(provider => ({
      provider,
      hasKey: !!byProvider[provider],
      last4: byProvider[provider]?.last4 || null,
      updatedAt: byProvider[provider]?.updated_at || null,
    })))
  }

  if (req.method === 'POST') {
    const { provider, apiKey } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } })
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 4) {
      return res.status(400).json({ error: { message: 'apiKey is required' } })
    }
    const ciphertext = encrypt(apiKey.trim())
    const last4 = apiKey.trim().slice(-4)
    const { error } = await db
      .from('user_api_keys')
      .upsert({ user_id: user.id, provider, ciphertext, last4 }, { onConflict: 'user_id,provider' })
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ provider, hasKey: true, last4 })
  }

  if (req.method === 'DELETE') {
    const provider = req.query?.provider
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } })
    const { error } = await db.from('user_api_keys').delete().eq('user_id', user.id).eq('provider', provider)
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ provider, hasKey: false })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: { message: 'Method not allowed' } })
}
