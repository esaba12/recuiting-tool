// AES-256-GCM encrypt/decrypt for BYOK API keys and Google refresh tokens
// before they're persisted in Postgres — see supabase/migrations/*_init.sql's
// comment on user_api_keys / google_calendar_tokens for why this exists on top
// of RLS (defense in depth: even a service-role DB leak wouldn't expose
// plaintext secrets without this repo's SECRET_ENCRYPTION_KEY).
import crypto from 'crypto'

function getKey() {
  const hex = process.env.SECRET_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('SECRET_ENCRYPTION_KEY must be set to a 32-byte hex string (64 chars) — see .env.example')
  }
  return Buffer.from(hex, 'hex')
}

// Output format: base64(iv):base64(authTag):base64(ciphertext) — self-contained,
// no separate column needed for iv/tag.
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

export function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split(':')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed ciphertext')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return plaintext.toString('utf8')
}
