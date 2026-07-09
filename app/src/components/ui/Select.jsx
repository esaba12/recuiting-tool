import { cn } from '../../lib/cn.js'

export default function Select({ label, className, options = [], placeholder = '—', children, ...rest }) {
  const select = (
    <select
      className={cn(
        'w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm bg-white focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-200',
        className,
      )}
      {...rest}
    >
      <option value="">{placeholder}</option>
      {children || options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (!label) return select
  return (
    <div>
      <label className="block text-xs text-ink-400 mb-0.5">{label}</label>
      {select}
    </div>
  )
}
