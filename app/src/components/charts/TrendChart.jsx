import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'
import { CHART_SERIES, CHART_GRID, CHART_AXIS_TEXT, CHART_SURFACE } from './theme.js'

const tickStyle = { fill: CHART_AXIS_TEXT, fontSize: 11, fontFamily: 'Public Sans, sans-serif' }

// Single-series trend over time — { data: [{ label, count }] }, pre-bucketed by
// the consuming tab (this component is presentation-only, matching the rest of
// charts/ — no date-bucketing logic lives here).
export default function TrendChart({ data, labelKey = 'label', dataKey = 'count', height = 180 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey={labelKey} tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_GRID }} />
        <Line
          type="monotone" dataKey={dataKey} stroke={CHART_SERIES} strokeWidth={2}
          dot={{ r: 4, fill: CHART_SERIES, stroke: CHART_SURFACE, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: CHART_SERIES, stroke: CHART_SURFACE, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
