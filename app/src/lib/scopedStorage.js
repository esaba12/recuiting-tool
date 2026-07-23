// Namespaces every `rec_*` localStorage key by the signed-in user's id, so two
// different accounts sharing one browser never see each other's cached
// preferences/discovery state (target companies, affinity profile, tracked
// boards, etc.). AuthContext.jsx calls setStorageUserId() on every auth state
// change; falls back to 'anon' before the session is known (first paint).
//
// Deliberate scope decision: this is per-browser caching, not synced storage —
// namespacing prevents cross-account leakage, but it does NOT make this data
// available across devices (same limitation the single-tenant app already
// had). Full server-side sync would mean a much larger rewrite of every
// caller; not done here — see CLAUDE.md.
let currentUserId = 'anon'

export function setStorageUserId(id) {
  currentUserId = id || 'anon'
}

function scopedKey(key) {
  return `${currentUserId}:${key}`
}

export function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(scopedKey(key))) || null } catch { return null }
}

export function lsSet(key, val) {
  localStorage.setItem(scopedKey(key), JSON.stringify(val))
}
