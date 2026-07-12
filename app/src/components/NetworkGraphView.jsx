import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { STATUS_CHART_COLORS, CHART_SERIES, CHART_GRID, CHART_AXIS_TEXT } from './charts/theme.js'
import { buildGraph, hexToRgba } from '../lib/networkGraph.js'

const COMPANY_COLOR = CHART_AXIS_TEXT // ink-500 — neutral, accent is reserved for the referral highlight

export default function NetworkGraphView({ contacts, compact = false, height = 520, onNodeSelect }) {
  const fgRef = useRef()
  const [hoverNode, setHoverNode] = useState(null)

  const data = useMemo(() => buildGraph(contacts), [contacts])

  const adjacency = useMemo(() => {
    const m = new Map()
    data.links.forEach(l => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source
      const tid = typeof l.target === 'object' ? l.target.id : l.target
      if (!m.has(sid)) m.set(sid, new Set())
      if (!m.has(tid)) m.set(tid, new Set())
      m.get(sid).add(tid)
      m.get(tid).add(sid)
    })
    return m
  }, [data])

  // Animated zoom-to-fit flourish whenever the graph (re)appears or its data changes —
  // delayed so the force sim has a few ticks to spread nodes out first.
  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return
    const t = setTimeout(() => {
      try { fgRef.current?.zoomToFit(800, compact ? 24 : 40) } catch { /* graph not ready yet — skip the flourish */ }
    }, 350)
    return () => clearTimeout(t)
  }, [data, compact])

  if (contacts.length === 0) {
    return <p className="text-center py-20 text-ink-400 text-sm">No contacts yet — nothing to graph.</p>
  }

  function isDimmed(nodeId) {
    if (!hoverNode) return false
    if (nodeId === hoverNode.id) return false
    return !adjacency.get(hoverNode.id)?.has(nodeId)
  }

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      height={height}
      d3VelocityDecay={0.25}
      cooldownTicks={200}
      nodeRelSize={4}
      nodeVal={n => n.kind === 'company' ? 6 : 4}
      nodeLabel={n => n.label}
      nodeCanvasObjectMode={() => 'replace'}
      nodeCanvasObject={(n, ctx, scale) => {
        // Before the force sim's first tick, nodes can carry undefined/NaN coordinates —
        // canvas gradient/arc calls with non-finite values throw and (with no error
        // boundary upstream) can blank the whole page, so just skip painting this frame.
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return

        const dimmed = isDimmed(n.id)
        const hovered = hoverNode?.id === n.id
        const baseColor = n.kind === 'company' ? COMPANY_COLOR : (STATUS_CHART_COLORS[n.contact?.status] || COMPANY_COLOR)
        const r = (n.kind === 'company' ? 6 : 4.2) * (hovered ? 1.35 : 1)

        ctx.save()
        ctx.globalAlpha = dimmed ? 0.15 : 1

        // Soft halo
        const haloR = r * 3
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR)
        gradient.addColorStop(0, hexToRgba(baseColor, 0.35))
        gradient.addColorStop(1, hexToRgba(baseColor, 0))
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(n.x, n.y, haloR, 0, 2 * Math.PI)
        ctx.fill()

        // Glowing solid node
        ctx.shadowColor = baseColor
        ctx.shadowBlur = 8
        ctx.fillStyle = baseColor
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
        ctx.fill()
        ctx.shadowBlur = 0

        if (!compact) {
          const fontSize = 10 / scale
          ctx.font = `${n.kind === 'company' ? 'bold ' : ''}${fontSize}px "Public Sans", sans-serif`
          ctx.textAlign = 'center'
          ctx.globalAlpha = dimmed ? 0.15 : 0.9
          ctx.fillStyle = CHART_AXIS_TEXT
          ctx.fillText(n.label, n.x, n.y + r + fontSize + 2)
        }

        ctx.restore()
      }}
      linkColor={l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source
        const tid = typeof l.target === 'object' ? l.target.id : l.target
        const dimmed = hoverNode && hoverNode.id !== sid && hoverNode.id !== tid
        const base = l.kind === 'referred-by' ? CHART_SERIES : CHART_GRID
        return dimmed ? hexToRgba(base, 0.1) : base
      }}
      linkWidth={l => l.kind === 'referred-by' ? 2 : 1}
      linkCurvature={l => l.kind === 'referred-by' ? 0.3 : 0.15}
      linkDirectionalArrowLength={l => l.kind === 'referred-by' ? 4 : 0}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={() => CHART_SERIES}
      linkDirectionalParticles={l => l.kind === 'referred-by' ? (compact ? 2 : 3) : 0}
      linkDirectionalParticleWidth={l => l.kind === 'referred-by' ? 2.5 : 0}
      linkDirectionalParticleColor={() => CHART_SERIES}
      linkDirectionalParticleSpeed={0.006}
      onNodeHover={n => setHoverNode(n)}
      onNodeClick={!compact && onNodeSelect ? n => n.kind === 'contact' && onNodeSelect(n.contact) : undefined}
      enableNodeDrag={!compact}
      enableZoomInteraction={!compact}
      enablePanInteraction={!compact}
    />
  )
}
