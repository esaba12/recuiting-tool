// Real color values for Recharts (which needs hex strings, not Tailwind classes),
// translated from the @theme tokens in app/src/index.css. This is the one place
// that translation happens — chart components should import from here, never
// hardcode hex values inline.
//
// Palette choices validated via the repo's `dataviz` skill
// (node scripts/validate_palette.js — see that skill for the six checks):
//
// - Single-series bar/line charts (funnel, top locations, interactions trend) use
//   ONE flat hue (accent-600) rather than a per-bar ordinal ramp: these charts
//   already encode order via axis position, so redundantly ramping color per bar
//   isn't required — and no 6-step slice of the accent scale cleared the ordinal
//   validator's adjacent-lightness + light-end-contrast checks against our light
//   canvas at that count. A flat hue is the more correct choice here, not a
//   fallback.
// - The contact-status donut (5 categorical slots) passed CVD separation but got a
//   contrast WARN on warning-500/accent-500 vs the light canvas, and a chroma-floor
//   FAIL on ink-400 (intentional — "Closed" is a deliberately desaturated/neutral
//   state). Per the skill, a contrast WARN is not dismissable on its own — it
//   requires a relief channel. Every consumer of STATUS_CHART_COLORS must render
//   visible count labels/legend (not hover-tooltip-only) to satisfy that.

export const CHART_SERIES = '#e17f26' // accent-600 — single-hue default for magnitude/trend charts

export const STATUS_CHART_COLORS = {
  '🟢 Warm':     '#3c9a46', // success-500
  '🟡 Cooling':  '#d9a02b', // warning-500
  '🔴 Cold':     '#c94a4a', // danger-500
  '⭐ Champion': '#f2994a', // accent-500
  '✅ Closed':   '#86868f', // ink-400 (intentionally neutral/desaturated)
}

export const CHART_GRID = '#e9e9eb'   // ink-100
export const CHART_AXIS_TEXT = '#64646d' // ink-500
export const CHART_SURFACE = '#fbf9f5'   // canvas

// Dark "graph canvas" palette — the Network Graph view is an intentional self-contained
// dark island (matches the existing dark sidebar's ink-900 surface), not a general app
// dark mode (index.css's darkMode variant stays unused/light-only everywhere else).
// Status hues (STATUS_CHART_COLORS above) are unchanged — hue/chroma don't shift with
// the canvas — but contrast was re-checked against this dark surface specifically since
// the light-canvas neutral tokens (ink-500) drop to a graphics-only ~3:1 here:
//   success-500 5.03:1 · warning-500 7.67:1 · danger-500 3.88:1 · accent-500 8.03:1 ·
//   ink-400 4.96:1 — all clear the >=3:1 graphics-contrast floor against #16171d.
export const GRAPH_SURFACE_DARK = '#16171d'      // ink-900
export const GRAPH_NODE_NEUTRAL_DARK = '#d3d3d7' // ink-200 — company/neutral nodes, 11.98:1
export const GRAPH_TEXT_DARK = '#b0b0b7'         // ink-300 — node labels, 8.29:1
export const GRAPH_LINK_DARK = '#e9e9eb'         // ink-100 — "works-at" threads, used at low alpha
