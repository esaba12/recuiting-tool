import { useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { STATUS_COLOR, Badge, URGENCY_COLOR } from '../shared.jsx'

const STATUS_DOT = {
  '🟢 Warm':    '#16a34a',
  '🟡 Cooling': '#ca8a04',
  '🔴 Cold':    '#dc2626',
  '✅ Closed':  '#9ca3af',
  '⭐ Champion':'#ea580c',
}

function buildGraph(contacts) {
  const nodes = []
  const links = []
  const companyId = (name) => `company:${name.trim().toLowerCase()}`
  const seenCompanies = new Set()

  contacts.forEach(c => {
    nodes.push({ id: c.id, kind: 'contact', label: c.name, contact: c })
    if (c.company?.trim()) {
      const cid = companyId(c.company)
      if (!seenCompanies.has(cid)) {
        seenCompanies.add(cid)
        nodes.push({ id: cid, kind: 'company', label: c.company.trim() })
      }
      links.push({ source: c.id, target: cid, kind: 'works-at' })
    }
    if (c.referredById) {
      links.push({ source: c.referredById, target: c.id, kind: 'referred-by' })
    }
  })

  return { nodes, links }
}

export default function NetworkGraphTab({ contacts }) {
  const fgRef = useRef()
  const [selected, setSelected] = useState(null)

  const data = useMemo(() => buildGraph(contacts), [contacts])

  if (contacts.length === 0) {
    return <p className="text-center py-20 text-gray-400 text-sm">No contacts yet — nothing to graph.</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 520 }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          height={520}
          nodeLabel={n => n.label}
          nodeVal={n => n.kind === 'company' ? 6 : 4}
          nodeColor={n => n.kind === 'company' ? '#64748b' : (STATUS_DOT[n.contact?.status] || '#94a3b8')}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(n, ctx, scale) => {
            const fontSize = 10 / scale
            ctx.font = `${n.kind === 'company' ? 'bold ' : ''}${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#374151'
            ctx.fillText(n.label, n.x, n.y + 8 / scale)
          }}
          linkColor={l => l.kind === 'referred-by' ? '#6366f1' : '#e5e7eb'}
          linkWidth={l => l.kind === 'referred-by' ? 2 : 1}
          linkDirectionalArrowLength={l => l.kind === 'referred-by' ? 4 : 0}
          linkDirectionalArrowRelPos={1}
          onNodeClick={n => n.kind === 'contact' && setSelected(n.contact)}
          cooldownTicks={100}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {!selected ? (
          <div className="text-sm text-gray-400 space-y-2">
            <p>Click a contact node to see details.</p>
            <p className="text-xs">Gray squares = companies · colored circles = contacts (colored by status) · arrows = "referred by".</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selected.name}</p>
                {selected.company && <p className="text-sm text-gray-500">{selected.company}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge label={selected.status} color={STATUS_COLOR[selected.status]} />
              {selected.urgency && selected.urgency !== 'LOW' && <Badge label={selected.urgency} color={URGENCY_COLOR[selected.urgency]} />}
            </div>
            {selected.referredByName && <p className="text-xs text-gray-500">Referred by <strong>{selected.referredByName}</strong></p>}
            {selected.email && <p className="text-xs"><a href={`mailto:${selected.email}`} className="text-blue-500 hover:underline">{selected.email}</a></p>}
            {selected.linkedin && <p className="text-xs"><a href={selected.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">LinkedIn ↗</a></p>}
            {selected.whatTheyDid && <p className="text-xs text-gray-500 italic mt-2">"{selected.whatTheyDid}"</p>}
          </div>
        )}
      </div>
    </div>
  )
}
