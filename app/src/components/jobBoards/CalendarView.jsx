import { useState } from 'react'
import { MONTH_NAMES, parseJobDate } from './helpers.js'

export default function CalendarView({ jobs, selectedDay, onDaySelect }) {
  const [viewDate, setViewDate] = useState(() => {
    const dates = jobs.map(j => parseJobDate(j.dateAdded)).filter(Boolean)
    return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date()
  })

  const year = viewDate.getFullYear()
  const mo   = viewDate.getMonth()

  const jobsByDay = {}
  jobs.forEach(j => {
    const d = parseJobDate(j.dateAdded)
    if (d && d.getFullYear() === year && d.getMonth() === mo) {
      const k = d.getDate()
      jobsByDay[k] = (jobsByDay[k] || 0) + 1
    }
  })

  const firstDow    = new Date(year, mo, 1).getDay()
  const daysInMonth = new Date(year, mo + 1, 0).getDate()
  const cells       = [...Array(firstDow).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)]

  const today      = new Date()
  const todayKey   = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const totalMonth = Object.values(jobsByDay).reduce((a, b) => a + b, 0)
  const maxDay     = Math.max(...Object.values(jobsByDay), 1)

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(year, mo - 1, 1))}
          className="p-1.5 hover:bg-ink-100 rounded-lg text-ink-500 text-sm">←</button>
        <div className="text-center">
          <p className="font-semibold text-ink-800 text-sm">{MONTH_NAMES[mo]} {year}</p>
          {totalMonth > 0 && <p className="text-xs text-ink-400">{totalMonth} listings posted</p>}
        </div>
        <button onClick={() => setViewDate(new Date(year, mo + 1, 1))}
          className="p-1.5 hover:bg-ink-100 rounded-lg text-ink-500 text-sm">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-ink-400 py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const count = jobsByDay[d] || 0
          const key   = `${year}-${mo}-${d}`
          const isSel = selectedDay === key
          const isTod = key === todayKey
          const heat  = count ? Math.min(Math.ceil((count / maxDay) * 4), 4) : 0
          const heatBg = ['', 'bg-accent-100', 'bg-accent-200', 'bg-accent-400', 'bg-accent-600'][heat]
          const heatTx = heat >= 3 ? 'text-white' : heat > 0 ? 'text-accent-800' : 'text-ink-300'
          return (
            <button key={d} disabled={!count}
              onClick={() => onDaySelect(isSel ? null : key)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all
                ${isSel ? 'ring-2 ring-accent-500 ring-offset-1' : ''}
                ${count ? `${heatBg} ${heatTx} cursor-pointer hover:opacity-80` : `${isTod ? 'bg-accent-50 text-accent-400' : 'text-ink-200'} cursor-default`}`}>
              <span>{d}</span>
              {count > 0 && <span className="text-[9px] font-bold">{count}</span>}
            </button>
          )
        })}
      </div>
      {selectedDay && (
        <p className="text-xs text-center text-accent-600 mt-3 cursor-pointer hover:underline" onClick={() => onDaySelect(null)}>
          Showing {selectedDay.split('-')[2] && jobsByDay[+selectedDay.split('-')[2]]} jobs from this day · click to clear
        </p>
      )}
    </div>
  )
}

