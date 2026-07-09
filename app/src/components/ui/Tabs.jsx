import { cn } from '../../lib/cn.js'

// Small segmented control — { options: [{key,label,icon?}], value, onChange }
export default function Tabs({ options, value, onChange, className }) {
  return (
    <div className={cn('inline-flex border border-ink-100 rounded-full overflow-hidden text-xs font-medium bg-white', className)}>
      {options.map(o => {
        const Icon = o.icon
        const active = value === o.key
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            className={cn(
              'px-3 py-1.5 flex items-center gap-1.5 transition-colors',
              active ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-50',
            )}>
            {Icon && <Icon size={13} strokeWidth={2.25} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
