import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar.jsx'

export default function AppShell({ activeTab, onTabChange, counts, loading, lastLoaded, onRefresh, error, children }) {
  return (
    <div className="flex min-h-screen bg-canvas font-body text-ink-900">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        counts={counts}
        loading={loading}
        lastLoaded={lastLoaded}
        onRefresh={onRefresh}
      />

      <main className="flex-1 px-6 md:px-10 py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-4 p-4 bg-danger-50 border border-danger-100 rounded-xl text-sm text-danger-700">
            <strong>Notion connection error:</strong> {error}
            <br /><span className="text-xs text-danger-600 mt-1 block">Make sure NOTION_API_KEY is in your .env and you ran <code className="bg-danger-100 px-1 rounded">npm run dev</code> from the <code className="bg-danger-100 px-1 rounded">app/</code> directory.</span>
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
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
