import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { signInWithGoogle } from '../lib/googleAuth.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null); setInfo(null); setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp({ email, password, fullName })
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
      } else {
        await signIn({ email, password })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    try { await signInWithGoogle() }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl font-semibold text-ink-900">Recruiting OS</h1>
          <p className="text-sm text-ink-400 mt-1">Your job search, on autopilot. Bring your own AI keys.</p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
          <div className="flex mb-5 rounded-full bg-ink-50 p-1 text-xs font-medium">
            <button type="button" onClick={() => setMode('signin')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${mode === 'signin' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-400'}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${mode === 'signup' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-400'}`}>
              Create account
            </button>
          </div>

          {error && <div className="mb-3 p-2.5 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}
          {info && <div className="mb-3 p-2.5 bg-success-50 border border-success-200 rounded-lg text-xs text-success-700">{info}</div>}

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <Input label="Name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ada Lovelace" required />
            )}
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.edu" required />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" minLength={6} required />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px bg-ink-100" />
            <span className="text-[11px] text-ink-400">or</span>
            <div className="flex-1 h-px bg-ink-100" />
          </div>

          <Button type="button" variant="secondary" onClick={google} className="w-full flex items-center justify-center gap-2">
            <GoogleIcon /> Continue with Google
          </Button>
        </div>

        <p className="text-[11px] text-ink-400 text-center mt-4">
          Every user brings their own Anthropic/OpenAI/Exa API keys — nothing is shared. You'll add yours after signing in.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.44H12v4.62h6.48c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.86c2.26-2.08 3.58-5.16 3.58-8.83z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.86-3.02c-1.07.72-2.44 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.96H1.26v3.12C3.22 21.3 7.28 24 12 24z"/>
      <path fill="#FBBC05" d="M5.25 14.27a7.24 7.24 0 0 1 0-4.54V6.61H1.26a11.97 11.97 0 0 0 0 10.78l3.99-3.12z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.28 0 3.22 2.7 1.26 6.61l3.99 3.12C6.2 6.87 8.86 4.75 12 4.75z"/>
    </svg>
  )
}
