import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { STATUS_CHART_COLORS, CHART_SERIES, GRAPH_SURFACE_DARK, GRAPH_NODE_NEUTRAL_DARK, GRAPH_TEXT_DARK, GRAPH_LINK_DARK } from './charts/theme.js'
import { buildGraph, hexToRgba } from '../lib/networkGraph.js'

const COMPANY_COLOR = GRAPH_NODE_NEUTRAL_DARK // neutral dot color against the dark canvas, accent reserved for the referral highlight

export default function NetworkGraphView({ contacts, compact = false, height = 520, onNodeSelect }) {
  const containerRef = useRef()
  const fgRef = useRef()
  const [hoverNode, setHoverNode] = useState(null)
  // Measured explicitly rather than left to ForceGraph2D's own auto-detection: inside a CSS
  // grid cell (this view's parent is a `md:col-span-2` grid column), the auto-detected width
  // can be read before the grid has finished laying out, so the sim/zoomToFit compute against
  // a too-narrow canvas and never fit — some disconnected clusters end up permanently
  // off-frame. A ResizeObserver on our own wrapper sidesteps that race.
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setContainerWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

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

  // Animated zoom-to-fit flourish whenever the graph (re)appears or its data changes — an
  // early fit once the sim has had a few ticks to spread nodes out, then a final re-fit via
  // onEngineStop below once the simulation actually settles. A single fixed-delay timeout
  // undershoots on sparse/disconnected graphs: isolated clusters (e.g. a contact whose only
  // company has no other contacts) keep drifting apart under repulsion with nothing pulling
  // them back together, so positions at a fixed 350ms are rarely final.
  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return
    const t = setTimeout(() => {
      try { fgRef.current?.zoomToFit(800, compact ? 24 : 40) } catch { /* graph not ready yet — skip the flourish */ }
    }, 350)
    return () => clearTimeout(t)
  }, [data, compact])

  function handleEngineStop() {
    try { fgRef.current?.zoomToFit(600, compact ? 24 : 40) } catch { /* no-op */ }
  }

  if (contacts.length === 0) {
    return <p className="text-center py-20 text-ink-400 text-sm">No contacts yet — nothing to graph.</p>
  }

  function isDimmed(nodeId) {
    if (!hoverNode) return false
    if (nodeId === hoverNode.id) return false
    return !adjacency.get(hoverNode.id)?.has(nodeId)
  }

  // Degree (connection count) drives node size, same "more-linked = bigger" reading
  // Obsidian's graph uses — a contact tied to several colleagues/referrals reads as a hub,
  // not a same-size dot as everyone else. Capped so a very high-degree node doesn't dominate.
  function nodeRadius(n) {
    const degree = adjacency.get(n.id)?.size || 0
    const base = n.kind === 'company' ? 5.5 : 3.6
    return base + Math.min(degree, 6) * 0.5
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
    {containerWidth > 0 && (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      width={containerWidth}
      height={height}
      backgroundColor={GRAPH_SURFACE_DARK}
      d3VelocityDecay={0.22}
      cooldownTicks={250}
      nodeRelSize={4}
      nodeVal={nodeRadius}
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
        const r = nodeRadius(n) * (hovered ? 1.35 : 1)

        ctx.save()
        ctx.globalAlpha = dimmed ? 0.12 : 1

        // Soft halo — the "synapse glow": barely visible on a light canvas, this is what
        // actually reads as a glow against the dark one.
        const haloR = r * 3.2
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR)
        gradient.addColorStop(0, hexToRgba(baseColor, 0.45))
        gradient.addColorStop(1, hexToRgba(baseColor, 0))
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(n.x, n.y, haloR, 0, 2 * Math.PI)
        ctx.fill()

        // Glowing solid node
        ctx.shadowColor = baseColor
        ctx.shadowBlur = 12
        ctx.fillStyle = baseColor
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
        ctx.fill()
        ctx.shadowBlur = 0

        // Labels only for company landmarks (few, useful for wayfinding) and whichever
        // node is currently hovered — showing every contact's name at once is exactly the
        // clutter a "clean, brain-like" graph shouldn't have; hover reveals the rest on demand.
        if (!compact && (n.kind === 'company' || hovered)) {
          const fontSize = 10 / scale
          ctx.font = `${n.kind === 'company' ? 'bold ' : ''}${fontSize}px "Public Sans", sans-serif`
          ctx.textAlign = 'center'
          ctx.globalAlpha = dimmed ? 0.12 : 0.9
          ctx.fillStyle = GRAPH_TEXT_DARK
          ctx.fillText(n.label, n.x, n.y + r + fontSize + 2)
        }

        ctx.restore()
      }}
      linkColor={l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source
        const tid = typeof l.target === 'object' ? l.target.id : l.target
        const dimmed = hoverNode && hoverNode.id !== sid && hoverNode.id !== tid
        if (l.kind === 'referred-by') return dimmed ? hexToRgba(CHART_SERIES, 0.15) : CHART_SERIES
        // "works-at" threads stay faint by default — a quiet connective web, not grid lines
        return hexToRgba(GRAPH_LINK_DARK, dimmed ? 0.04 : 0.18)
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
      onEngineStop={handleEngineStop}
      onNodeHover={n => setHoverNode(n)}
      onNodeClick={!compact && onNodeSelect ? n => n.kind === 'contact' && onNodeSelect(n.contact) : undefined}
      enableNodeDrag={!compact}
      enableZoomInteraction={!compact}
      enablePanInteraction={!compact}
    />
    )}
    </div>
  )
}
