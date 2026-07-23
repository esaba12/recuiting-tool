import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar.jsx'
import ErrorBoundary from '../ErrorBoundary.jsx'

export default function AppShell({ activeTab, onTabChange, counts, loading, lastLoaded, onRefresh, onAddEvent, onAddSchedule, error, children, navItems, demoMode = false }) {
  return (
    <div className="flex min-h-screen bg-canvas font-body text-ink-900">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        counts={counts}
        loading={loading}
        lastLoaded={lastLoaded}
        onRefresh={onRefresh}
        onAddEvent={onAddEvent}
        onAddSchedule={onAddSchedule}
        navItems={navItems}
        hideQuickActions={demoMode}
        demoMode={demoMode}
      />

      <main className="flex-1 px-6 md:px-10 py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        {demoMode && (
          <div className="mb-4 p-4 bg-accent-50 border border-accent-200 rounded-xl text-sm text-accent-800 flex items-center justify-between gap-3 flex-wrap">
            <span>👋 You're viewing a <strong>live demo</strong> with sample data — nothing here is real, and nothing you do here is saved.</span>
            <a href="/" className="shrink-0 px-3 py-1.5 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700 transition-colors">
              Sign up free →
            </a>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-danger-50 border border-danger-100 rounded-xl text-sm text-danger-700">
            <strong>Data load error:</strong> {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ErrorBoundary key={activeTab}>
              {children}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
