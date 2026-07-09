import { cn } from '../../lib/cn.js'

export default function Input({ label, className, ...rest }) {
  const input = (
    <input
      className={cn(
        'w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-200',
        className,
      )}
      {...rest}
    />
  )
  if (!label) return input
  return (
    <div>
      <label className="block text-xs text-ink-400 mb-0.5">{label}</label>
      {input}
    </div>
  )
}
