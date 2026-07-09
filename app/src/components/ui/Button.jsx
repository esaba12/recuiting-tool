import { cn } from '../../lib/cn.js'

const VARIANTS = {
  primary:   'bg-accent-500 text-white hover:bg-accent-600 border border-transparent',
  secondary: 'bg-white text-ink-700 border border-ink-100 hover:bg-ink-50',
  ghost:     'bg-transparent text-ink-500 hover:bg-ink-50 border border-transparent',
  danger:    'bg-danger-600 text-white hover:bg-danger-700 border border-transparent',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
}

export default function Button({ variant = 'primary', size = 'md', className, children, ...rest }) {
  return (
    <button
      className={cn(
        'rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
