export default function Badge({ label, color = 'bg-ink-100 text-ink-600', icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {label}
    </span>
  )
}
