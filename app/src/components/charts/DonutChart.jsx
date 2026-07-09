import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'

// Categorical part-to-whole — always paired with a visible legend (never
// color-alone identity, per the dataviz skill's accessibility pass), which is
// also the required contrast-WARN relief channel for this app's palette (see
// theme.js). `data`: [{ label, value, color }]
export default function DonutChart({ data, height = 200, centerLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="85%" paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-ink-900">{total}</p>
            <p className="text-[11px] text-ink-400">{centerLabel}</p>
          </div>
        )}
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-ink-600">{d.label}</span>
            <span className="font-medium text-ink-900 ml-auto pl-3">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
