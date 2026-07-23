import { supabaseAdmin } from './supabaseAdmin.js'
import { decrypt } from './crypto.js'

// Returns the caller's own decrypted BYOK key for `provider`, or null if
// they haven't set one. Used server-side only, inside the /claude-api,
// /openai-api, /exa, /gh-api proxies — never returned to the browser.
export async function getUserKey(userId, provider) {
  const { data, error } = await supabaseAdmin()
    .from('user_api_keys')
    .select('ciphertext')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()
  if (error || !data) return null
  try { return decrypt(data.ciphertext) } catch { return null }
}
