import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly at import time rather than deep inside a random query — every
  // multi-tenant feature (auth, contacts, applications, BYOK settings) needs this.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — add them to your .env (repo root) and restart the dev server.')
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Attaches the current user's access token as a Bearer header — used by every
// call to the /claude-api, /openai-api, /exa, /gh-api, /google-calendar proxies
// so the server side can identify the caller and inject *their* BYOK key
// instead of a single global env var.
export async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}
