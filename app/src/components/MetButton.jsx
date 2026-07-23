import { useState } from 'react'
import { Handshake, Check } from 'lucide-react'

// One-tap "met with them" — logs a Meeting interaction and bumps Last Interaction/Follow-Up
// Date via onMet (see lib/quickLog.js's logMetWithContact), with no modal in the way. Used
// wherever a contact row is already visible: ContactsTable, NetworkTab's Cards view,
// KeepInTouchTab.
export default function MetButton({ contact, onMet, className = '' }) {
  const [state, setState] = useState('idle') // idle | logging | done | error

  async function click(e) {
    e.stopPropagation()
    if (state === 'logging') return
    setState('logging')
    try {
      await onMet(contact)
      setState('done')
      setTimeout(() => setState('idle'), 2000)
    } catch (err) {
      console.error(err)
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  if (state === 'done') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-success-600 ${className}`}>
        <Check size={12} /> Logged
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span title="Failed to log — try again" className={`inline-flex items-center px-2 py-1 text-xs font-medium text-danger-600 ${className}`}>
        ✕ Failed
      </span>
    )
  }
  return (
    <button onClick={click} disabled={state === 'logging'}
      title="Log that you met with them — records it and sets a follow-up reminder, no notes required"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-ink-200 text-ink-600 hover:border-accent-300 hover:text-accent-700 disabled:opacity-50 ${className}`}>
      <Handshake size={12} /> {state === 'logging' ? 'Logging…' : 'Met'}
    </button>
  )
}
