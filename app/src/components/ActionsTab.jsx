import { useState } from 'react'
import { STATUS_COLOR, URGENCY_COLOR, STAGE_COLOR, TERMINAL_STAGES, daysSince, daysUntil, fmt, Badge, EmptyState, isUntriaged, isOverdue } from '../shared.jsx'
import { updateContact, addInteraction } from '../notion.js'
import DraftPanel from './DraftPanel.jsx'

export default function ActionsTab({ contacts, apps, interactions = [], onRefresh }) {
  const activeApps = apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))

  const overdueContacts = contacts
    .filter(isOverdue)
    .sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))

  const staleApps = activeApps
    .filter(a => {
      const d = a.daysInStage ?? daysSince(a.lastActivity)
      return d !== null && d > 14
    })
    .sort((a, b) => {
      const da = a.daysInStage ?? daysSince(a.lastActivity)
      const db = b.daysInStage ?? daysSince(b.lastActivity)
      return db - da
    })

  const highUrgencyContacts = contacts.filter(c =>
    c.urgency === 'HIGH' && c.status !== '✅ Closed' && (!c.followUpDate || daysUntil(c.followUpDate) > 0)
  )

  if (overdueContacts.length + staleApps.length + highUrgencyContacts.length === 0) {
    return <EmptyState msg="✓ Nothing overdue. You're on top of it." />
  }

  return (
    <div className="space-y-4">
      {overdueContacts.length > 0 && (
        <Section title={`Overdue Follow-Ups (${overdueContacts.length})`} accent="red">
          {overdueContacts.map(c => (
            <OverdueContactRow key={c.id} contact={c} interactions={interactions} onRefresh={onRefresh} />
          ))}
        </Section>
      )}

      {staleApps.length > 0 && (
        <Section title={`Stale Applications (${staleApps.length})`} accent="orange"
          subtitle="No movement in 14+ days — follow up or update the stage.">
          {staleApps.map(a => (
            <ActionRow key={a.id}
              primary={a.company}
              secondary={a.role || ''}
              link={a.jdLink ? { href: a.jdLink, label: 'View JD ↗' } : null}
              badge={<Badge label={a.stage} color={STAGE_COLOR[a.stage]} />}
              meta={`${a.daysInStage ?? daysSince(a.lastActivity)}d in ${a.stage}`}
              metaColor="text-orange-600"
            />
          ))}
        </Section>
      )}

      {highUrgencyContacts.length > 0 && (
        <Section title={`High Urgency Contacts (${highUrgencyContacts.length})`} accent="yellow">
          {highUrgencyContacts.map(c => (
            <ActionRow key={c.id}
              primary={c.name}
              secondary={[c.company, c.role].filter(Boolean).join(' · ')}
              link={c.email ? { href: `mailto:${c.email}`, label: c.email } : null}
              badge={<Badge label="HIGH" color={URGENCY_COLOR.HIGH} />}
              meta={c.followUpDate ? `Due ${fmt(c.followUpDate)}` : 'No follow-up date set'}
              metaColor="text-ink-500"
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, subtitle, accent, children }) {
  const border = { red: 'border-danger-200', orange: 'border-orange-200', yellow: 'border-warning-200' }[accent] || 'border-ink-200'
  const heading = { red: 'text-danger-700', orange: 'text-orange-700', yellow: 'text-warning-700' }[accent] || 'text-ink-700'
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1`}>{title}</h2>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  )
}

// A contact whose Follow-Up Date already passed, but who has a logged interaction newer
// than that date — the date's just stale, not actually overdue. Drafting an escalating
// follow-up here would nag someone already re-engaged; surface a "bump the date" hint
// instead of the draft flow.
function hasNewerInteraction(contact, interactions) {
  return interactions.some(i => i.contactId === contact.id && i.date && contact.followUpDate && new Date(i.date) > new Date(contact.followUpDate))
}

function OverdueContactRow({ contact: c, interactions, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const alreadyTouched = hasNewerInteraction(c, interactions)

  async function markFollowedUp() {
    setMarking(true)
    try {
      const nextFollowUp = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      await updateContact(c.id, { followUpDate: nextFollowUp, lastInteraction: new Date().toISOString().split('T')[0] })
      await addInteraction({ contactId: c.id, contactName: c.name, type: 'Other', direction: 'Outbound', summary: 'Followed up (marked via Actions)' })
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">{c.email}</a>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge label={c.status} color={STATUS_COLOR[c.status]} />
          <p className="text-xs font-medium text-danger-600">Was due {fmt(c.followUpDate)} ({Math.abs(daysUntil(c.followUpDate))}d ago)</p>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-accent-500 hover:underline">
              {expanded ? 'Hide' : alreadyTouched ? 'Details' : 'Draft follow-up'}
            </button>
            <button onClick={markFollowedUp} disabled={marking} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              {marking ? 'Marking...' : 'Mark followed up'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        alreadyTouched
          ? (
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 mt-2 text-xs text-warning-800">
              A newer interaction is already logged for this contact — the Follow-Up Date field is just stale. Open the contact and update it, or use "Mark followed up" above.
            </div>
          )
          : <DraftPanel contact={c} kind="follow_up" daysOverdue={Math.abs(daysUntil(c.followUpDate))} onSaved={onRefresh} />
      )}
    </div>
  )
}

function ActionRow({ primary, secondary, link, badge, meta, metaColor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-ink-900">{primary}</p>
        {secondary && <p className="text-xs text-ink-500">{secondary}</p>}
        {link && <a href={link.href} target={link.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer" className="text-xs text-accent-500 hover:underline">{link.label}</a>}
      </div>
      <div className="text-right shrink-0 space-y-1">
        {badge}
        <p className={`text-xs font-medium ${metaColor}`}>{meta}</p>
      </div>
    </div>
  )
}
