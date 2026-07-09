// Shared tooltip so every chart looks like one system rather than each having
// bespoke styling — matches the app's existing card treatment.
export default function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-ink-100 shadow-sm rounded-xl px-3 py-2 text-xs">
      {label && <p className="font-medium text-ink-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-ink-500">
          {p.name ? `${p.name}: ` : ''}
          <span className="font-medium text-ink-900">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}
