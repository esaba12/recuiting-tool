import { cn } from '../../lib/cn.js'

export default function Card({ className, children, ...rest }) {
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-ink-100', className)} {...rest}>
      {children}
    </div>
  )
}
