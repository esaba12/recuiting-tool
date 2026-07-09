import { useState } from 'react'
import { STATUS_COLOR, Badge, URGENCY_COLOR } from '../shared.jsx'
import NetworkGraphView from './NetworkGraphView.jsx'

export default function NetworkGraphTab({ contacts }) {
  const [selected, setSelected] = useState(null)

  if (contacts.length === 0) {
    return <p className="text-center py-20 text-ink-400 text-sm">No contacts yet — nothing to graph.</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 bg-white rounded-xl border border-ink-100 shadow-sm overflow-hidden" style={{ height: 520 }}>
        <NetworkGraphView contacts={contacts} height={520} onNodeSelect={setSelected} />
      </div>

      <div className="bg-white rounded-xl border border-ink-100 shadow-sm p-4">
        {!selected ? (
          <div className="text-sm text-ink-400 space-y-2">
            <p>Click a contact node to see details.</p>
            <p className="text-xs">Gray squares = companies · colored circles = contacts (colored by status) · arrows = "referred by".</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink-900">{selected.name}</p>
                {selected.company && <p className="text-sm text-ink-500">{selected.company}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge label={selected.status} color={STATUS_COLOR[selected.status]} />
              {selected.urgency && selected.urgency !== 'LOW' && <Badge label={selected.urgency} color={URGENCY_COLOR[selected.urgency]} />}
            </div>
            {selected.referredByName && <p className="text-xs text-ink-500">Referred by <strong>{selected.referredByName}</strong></p>}
            {selected.email && <p className="text-xs"><a href={`mailto:${selected.email}`} className="text-accent-500 hover:underline">{selected.email}</a></p>}
            {selected.linkedin && <p className="text-xs"><a href={selected.linkedin} target="_blank" rel="noreferrer" className="text-accent-500 hover:underline">LinkedIn ↗</a></p>}
            {selected.whatTheyDid && <p className="text-xs text-ink-500 italic mt-2">"{selected.whatTheyDid}"</p>}
          </div>
        )}
      </div>
    </div>
  )
}
