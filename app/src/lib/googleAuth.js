import { supabase, authHeader } from './supabaseClient.js'

// "Sign in with Google" — plain login, no extra scopes. Used by LoginPage.jsx.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

// "Connect Calendar" — re-runs the Google OAuth flow requesting the
// calendar.events scope + `access_type=offline&prompt=consent` so Google
// issues a fresh refresh token every time (Google only returns a refresh
// token on the FIRST consent per scope-set otherwise). Supabase surfaces the
// resulting `provider_refresh_token` on the Session object exactly once,
// right after this exact redirect completes — see finishGoogleCalendarConnect()
// below, which SettingsTab.jsx calls on mount to catch it and persist it
// server-side (api/google-connect.js) before it's lost.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CONNECT_FLAG = 'rec_google_connect_pending'

export async function connectGoogleCalendar() {
  sessionStorage.setItem(CONNECT_FLAG, '1')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: CALENDAR_SCOPE,
      queryParams: { access_type: 'offline', prompt: 'consent' },
      redirectTo: window.location.origin,
    },
  })
  if (error) { sessionStorage.removeItem(CONNECT_FLAG); throw error }
}

// Call once on app mount (after the auth session is known). If we just came
// back from connectGoogleCalendar()'s redirect, the session carries a fresh
// provider_refresh_token — grab it and hand it to the server before it's
// gone. No-ops harmlessly on every other page load.
export async function finishGoogleCalendarConnect() {
  if (!sessionStorage.getItem(CONNECT_FLAG)) return null
  sessionStorage.removeItem(CONNECT_FLAG)

  const { data } = await supabase.auth.getSession()
  const session = data?.session
  const refreshToken = session?.provider_refresh_token
  if (!refreshToken) return null // user only re-approved login, not the calendar scope re-consent

  const email = session?.user?.user_metadata?.email || session?.user?.email || null
  const res = await fetch('/api/google-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ refreshToken, email }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function getGoogleCalendarStatus() {
  const res = await fetch('/api/google-connect', { headers: await authHeader() })
  if (!res.ok) return { connected: false, email: null }
  return res.json()
}

export async function disconnectGoogleCalendar() {
  const res = await fetch('/api/google-connect', { method: 'DELETE', headers: await authHeader() })
  if (!res.ok) throw new Error('Failed to disconnect')
  return res.json()
}
