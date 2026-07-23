// Service-role Supabase client — server-side ONLY (Vercel functions / vite dev
// middleware). Bypasses RLS, so it's the only thing allowed to touch
// user_api_keys / google_calendar_tokens. Never import this from src/.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

let client = null

export function supabaseAdmin() {
  if (client) return client
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // supabase-js's realtime client assumes a global WebSocket, which Node 20
    // doesn't have (Node 22+ does) — we never use realtime here, but the
    // client still needs a transport handed to it at construction time to
    // avoid throwing on Vercel's Node 20 runtime.
    realtime: { transport: ws },
  })
  return client
}

// Verifies the caller's Supabase access token (sent as `Authorization: Bearer
// <token>` by app/src/lib/supabaseClient.js's authHeader()) and returns the
// authenticated user, or null. Every proxy (/claude-api, /openai-api, /exa,
// /gh-api, /google-calendar) and /api/keys call this first — no anonymous
// requests are allowed to burn anyone's BYOK key.
export async function requireUser(req) {
  const authz = req.headers['authorization'] || req.headers['Authorization']
  const token = authz?.startsWith('Bearer ') ? authz.slice(7) : null
  if (!token) return null
  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
