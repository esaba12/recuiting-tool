import { useState } from 'react'
import { TYPE_COLOR, Badge, EmptyState, fmt } from '../shared.jsx'

function OutboxRow({ msg, contactName, contactCompany }) {
  const [expanded, setExpanded] = useState(false)
  const text = expanded && msg.body ? msg.body : msg.summary

  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-ink-100">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge label={msg.type} color={TYPE_COLOR[msg.type] || TYPE_COLOR.Other} />
        <span className="font-medium text-ink-900">{contactName}</span>
        {contactCompany && <span className="text-sm text-ink-500">@ {contactCompany}</span>}
        <span className="text-xs text-ink-400 ml-auto">{fmt(msg.date)}</span>
      </div>
      {text && <p className="text-xs text-ink-600 mt-1.5 whitespace-pre-wrap">{text}</p>}
      {msg.body && msg.body !== msg.summary && (
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs text-accent-500 hover:underline mt-1">
          {expanded ? 'Show less' : 'Show full message'}
        </button>
      )}
    </div>
  )
}

export default function OutboxTab({ contacts, interactions }) {
  const contactById = Object.fromEntries((contacts || []).map(c => [c.id, c]))

  const sent = (interactions || []).filter(i => i.type === 'Email' && i.direction === 'Outbound')

  if (sent.length === 0) {
    return <EmptyState msg="No sent emails logged yet — the email pipeline tracks these automatically." />
  }

  return (
    <div className="space-y-2">
      {sent.map(msg => {
        const contact = msg.contactId ? contactById[msg.contactId] : null
        return (
          <OutboxRow key={msg.id} msg={msg}
            contactName={contact?.name || 'Unknown'}
            contactCompany={contact?.company} />
        )
      })}
    </div>
  )
}
