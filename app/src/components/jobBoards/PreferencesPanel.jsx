import { useState } from 'react'

export default function PreferencesPanel({ prefs, onChange }) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState(prefs)

  function save() { onChange(draft); setOpen(false) }

  const fields = [
    { key: 'targetRoles',        label: 'Target roles',      placeholder: 'SWE Intern, New Grad SWE' },
    { key: 'preferredLocations', label: 'Preferred locations', placeholder: 'Bay Area, NYC, Remote' },
    { key: 'interests',          label: 'Interests / skills', placeholder: 'ML, systems, fintech' },
    { key: 'companyType',        label: 'Company type',       placeholder: 'FAANG, fintech startup' },
    { key: 'dealBreakers',       label: 'Deal-breakers',      placeholder: 'Hardware, defense, no remote' },
  ]

  return (
    <div className="rounded-xl border border-accent-100 bg-gradient-to-r from-accent-50 to-indigo-50 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-accent-800">
        <span>🎯 What I'm looking for {Object.keys(prefs).filter(k=>prefs[k]).length > 0 ? '· saved' : '· click to set'}</span>
        <span className="text-accent-400 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-accent-700 mb-1">{label}</label>
              <input value={draft[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-1.5 border border-accent-200 rounded-lg text-xs bg-white focus:outline-none focus:border-accent-400" />
            </div>
          ))}
          <div className="md:col-span-2 flex justify-end">
            <button onClick={save}
              className="px-4 py-1.5 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 font-medium">
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

