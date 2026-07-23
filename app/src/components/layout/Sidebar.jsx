import { NAV_ICON, REFRESH_ICON, CALENDAR_ICON, SCHEDULE_ICON } from '../../lib/icons.js'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'explore',  label: 'Explore' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'actions',  label: 'Actions' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },
]

export { NAV_ITEMS }

export default function Sidebar({ activeTab, onTabChange, counts = {}, loading, lastLoaded, onRefresh, onAddEvent, onAddSchedule }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-ink-900 text-ink-50 h-screen sticky top-0 overflow-y-auto">
        <div className="px-5 py-6">
          <h1 className="font-heading text-lg font-semibold text-white">Recruiting OS</h1>
          <p className="text-xs text-ink-400 mt-0.5">Fall 2026</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = NAV_ICON[item.id]
            const active = activeTab === item.id
            const count = counts[item.id]
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`hex-cut w-full flex items-center gap-2.5 px-3.5 py-2 border text-sm font-medium transition-colors
                  ${active ? 'bg-accent-500 border-accent-400 text-white' : 'border-ink-800 text-ink-300 hover:bg-ink-800 hover:border-ink-700 hover:text-white'}`}
              >
                {Icon && <Icon size={16} strokeWidth={2} />}
                <span className="flex-1 text-left">{item.label}</span>
                {count != null && count !== '' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-ink-700 text-ink-300'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-ink-800 space-y-2">
          <button onClick={onAddSchedule}
            className="hex-cut w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-accent-400 text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors">
            <SCHEDULE_ICON size={13} />
            + Schedule
          </button>
          <button onClick={onAddEvent}
            className="hex-cut w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-ink-700 text-xs font-medium bg-ink-800 text-ink-100 hover:bg-ink-700 transition-colors">
            <CALENDAR_ICON size={13} />
            + Event
          </button>
          <button onClick={onRefresh} disabled={loading}
            className="hex-cut w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-ink-700 text-xs font-medium bg-ink-800 text-ink-100 hover:bg-ink-700 disabled:opacity-50 transition-colors">
            <REFRESH_ICON size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <p className="text-[11px] text-ink-500 mt-2 text-center">
            {lastLoaded ? `Updated ${lastLoaded}` : 'Loading...'}
          </p>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ink-900 border-t border-ink-800 flex items-center justify-around px-1 py-2">
        {NAV_ITEMS.map(item => {
          const Icon = NAV_ICON[item.id]
          const active = activeTab === item.id
          return (
            <button key={item.id} onClick={() => onTabChange(item.id)}
              className={`hex-cut-sm flex flex-col items-center gap-0.5 px-2.5 py-1 border text-[10px] font-medium transition-colors
                ${active ? 'bg-ink-800 border-accent-500 text-accent-400' : 'border-transparent text-ink-400'}`}>
              {Icon && <Icon size={18} strokeWidth={2} />}
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Mobile floating quick-actions (anchored above the bottom bar) */}
      <button onClick={onAddSchedule}
        className="md:hidden fixed right-4 bottom-36 z-30 w-12 h-12 rounded-full bg-accent-500 text-white shadow-lg flex items-center justify-center hover:bg-accent-600">
        <SCHEDULE_ICON size={20} />
      </button>
      <button onClick={onAddEvent}
        className="md:hidden fixed right-4 bottom-20 z-30 w-12 h-12 rounded-full bg-ink-800 text-white shadow-lg flex items-center justify-center hover:bg-ink-700">
        <CALENDAR_ICON size={20} />
      </button>
    </>
  )
}
