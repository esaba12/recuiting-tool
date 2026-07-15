import { useState, useEffect, useRef } from 'react'
import { searchCompanies } from '../lib/ycDirectory.js'
import { DOMAINS, PRIORITIES, STAGES, WORK_STYLES, DEFAULT_COMPANY_PREFS } from '../lib/companyFinder.js'

// Guided interest onboarding for the company finder. Research-backed, ~6 skippable
// questions; the anchor is example-based seeding ("companies you already love") since
// revealed preference beats interrogating each dimension. Styled to match the app's
// accent-gradient panel look (see PreferencesPanel / DiscoverTab's ProfilePanel).

const inputCls = 'w-full px-3 py-2 border border-accent-200 rounded-lg text-sm bg-white focus:outline-none focus:border-accent-400'

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active
        ? 'bg-accent-600 text-white border-accent-600'
        : 'bg-white text-ink-600 border-ink-200 hover:border-accent-300'}`}>
      {label}
    </button>
  )
}

function Section({ n, title, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-800">
        <span className="text-accent-500 mr-1.5">{n}</span>{title}
      </label>
      {hint && <p className="text-[11px] text-ink-400 mb-1.5 mt-0.5">{hint}</p>}
      <div className={hint ? '' : 'mt-1.5'}>{children}</div>
    </div>
  )
}

export default function CompanyOnboarding({ initial, onSave, onCancel }) {
  const [prefs, setPrefs] = useState({ ...DEFAULT_COMPANY_PREFS, ...(initial || {}) })
  const set = (k, v) => setPrefs(p => ({ ...p, [k]: v }))

  const toggleIn = (key, val, max) => setPrefs(p => {
    const has = p[key].includes(val)
    let next = has ? p[key].filter(x => x !== val) : [...p[key], val]
    if (!has && max && next.length > max) next = next.slice(next.length - max) // keep most recent
    return { ...p, [key]: next }
  })

  return (
    <div className="rounded-2xl border border-accent-100 bg-gradient-to-br from-accent-50 to-indigo-50 p-6 space-y-5">
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink-900">Find companies you'll actually like</h2>
        <p className="text-xs text-ink-500 mt-0.5">A few quick questions — all optional. We infer the rest from the companies you already admire.</p>
      </div>

      <Section n="1" title="Companies you'd love to work at" hint="The most important one — we infer your taste from these. Type to search, or add your own.">
        <SeedCompanyPicker value={prefs.seedCompanies} onChange={v => set('seedCompanies', v)} />
      </Section>

      <Section n="2" title="Domains that excite you" hint="Pick up to 3.">
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map(d => <Chip key={d} label={d} active={prefs.domains.includes(d)} onClick={() => toggleIn('domains', d, 3)} />)}
        </div>
      </Section>

      <Section n="3" title="SWE or PM lean?">
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400 w-8">PM</span>
          <input type="range" min="0" max="100" value={Math.round(prefs.roleLean * 100)}
            onChange={e => set('roleLean', Number(e.target.value) / 100)}
            className="flex-1 accent-accent-600" />
          <span className="text-xs text-ink-400 w-8 text-right">SWE</span>
        </div>
      </Section>

      <Section n="4" title="Company stage sweet spot">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map(s => <Chip key={s.key} label={s.label} active={prefs.stage === s.key} onClick={() => set('stage', s.key)} />)}
        </div>
      </Section>

      <Section n="5" title="What matters most this summer?" hint="Pick your top 2 — forces a real trade-off.">
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map(p => <Chip key={p} label={p} active={prefs.priorities.includes(p)} onClick={() => toggleIn('priorities', p, 2)} />)}
        </div>
      </Section>

      <Section n="6" title="Location & work style" hint="Add cities, then a work style. A constraint, not a ranking factor.">
        <ChipInput value={prefs.locations} onChange={v => set('locations', v)} placeholder="Add a city + Enter (e.g. Bay Area, NYC)" />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {WORK_STYLES.map(w => <Chip key={w} label={w} active={prefs.workStyle === w} onClick={() => set('workStyle', w)} />)}
        </div>
      </Section>

      <Section n="+" title="Anything specific? (optional)" hint="e.g. “small teams”, “uses Rust”, “no crypto or defense”.">
        <input value={prefs.extras} onChange={e => set('extras', e.target.value)} className={inputCls}
          placeholder="Soft constraints, in your words" />
      </Section>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <button onClick={onCancel} className="px-4 py-2 bg-white border border-ink-200 rounded-lg text-xs font-medium text-ink-600 hover:border-accent-300">Cancel</button>}
        <button onClick={() => onSave({ ...prefs, saved: true })}
          className="px-5 py-2 bg-accent-600 text-white text-sm rounded-lg hover:bg-accent-700 font-medium">
          Find my companies →
        </button>
      </div>
    </div>
  )
}

// Seed-company picker with YC autocomplete + free-text add (for non-YC companies).
function SeedCompanyPicker({ value, onChange }) {
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const timer = useRef(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setSuggestions([]); return }
    timer.current = setTimeout(async () => {
      const found = await searchCompanies(q)
      setSuggestions(found.filter(n => !value.includes(n)))
    }, 220)
    return () => timer.current && clearTimeout(timer.current)
  }, [q, value])

  function add(name) {
    const n = name.trim()
    if (n && !value.includes(n)) onChange([...value, n])
    setQ(''); setSuggestions([])
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(name => (
            <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
              {name}
              <button onClick={() => onChange(value.filter(x => x !== name))} className="text-accent-400 hover:text-danger-600">✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); add(q) } }}
          placeholder="Search companies, or type any name + Enter" className={inputCls} />
        {suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(name => (
              <button key={name} onClick={() => add(name)}
                className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-accent-50">{name}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Generic add-on-Enter chip input (locations).
function ChipInput({ value, onChange, placeholder }) {
  const [q, setQ] = useState('')
  function add() {
    const n = q.trim()
    if (n && !value.includes(n)) onChange([...value, n])
    setQ('')
  }
  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-ink-100 text-ink-600">
              {v}<button onClick={() => onChange(value.filter(x => x !== v))} className="text-ink-400 hover:text-danger-600">✕</button>
            </span>
          ))}
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder={placeholder} className={inputCls} />
    </div>
  )
}
