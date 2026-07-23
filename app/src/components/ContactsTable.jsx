import { useMemo, useState } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, createColumnHelper,
} from '@tanstack/react-table'
import { STATUS_COLOR, URGENCY_COLOR, REFERRAL_STATUS_COLOR, Badge, fmt, daysUntil } from '../shared.jsx'
import { statusIconFor, URGENCY_ICON } from '../lib/icons.js'
import MetButton from './MetButton.jsx'

const col = createColumnHelper()

function FacetFilter({ column, options }) {
  const value = column.getFilterValue() ?? ''
  return (
    <select value={value} onChange={e => column.setFilterValue(e.target.value || undefined)}
      className="w-full mt-1 px-1.5 py-1 border border-ink-200 rounded text-[11px] bg-white text-ink-500 focus:outline-none focus:border-accent-400">
      <option value="">All</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export default function ContactsTable({ contacts, onEdit, onMet }) {
  const [sorting, setSorting] = useState([{ id: 'urgency', desc: false }])
  const [columnFilters, setColumnFilters] = useState([])

  const columns = useMemo(() => [
    col.accessor('name', {
      header: 'Name',
      cell: info => (
        <span className="font-medium text-ink-900">
          {info.getValue()}
          {info.row.original.isUMichAlum && <span title="UMich alum" className="ml-1">🎓</span>}
          {info.row.original.wantsToSchedule && <span title="Want to schedule" className="ml-1">📅</span>}
          {info.row.original.referralStatus === 'Confirmed' && <span title="Referral confirmed" className="ml-1">🎁</span>}
        </span>
      ),
    }),
    col.accessor('company', {
      header: 'Company',
      cell: info => info.getValue() || '—',
      filterFn: 'includesString',
    }),
    col.accessor('role', {
      header: 'Role',
      filterFn: 'equalsString',
    }),
    col.accessor('status', {
      header: 'Status',
      cell: info => <Badge label={info.getValue()} color={STATUS_COLOR[info.getValue()]} icon={statusIconFor(info.getValue())} />,
      filterFn: 'equalsString',
    }),
    col.accessor('source', {
      header: 'Source',
      cell: info => info.getValue() || '—',
      filterFn: 'equalsString',
    }),
    col.accessor('urgency', {
      header: 'Urgency',
      cell: info => <Badge label={info.getValue()} color={URGENCY_COLOR[info.getValue()]} icon={URGENCY_ICON[info.getValue()]} />,
      sortingFn: (a, b) => ({ HIGH: 0, MED: 1, LOW: 2 }[a.original.urgency] ?? 2) - ({ HIGH: 0, MED: 1, LOW: 2 }[b.original.urgency] ?? 2),
      filterFn: 'equalsString',
    }),
    col.accessor('referredByName', {
      header: 'Referred By',
      cell: info => info.getValue() || '—',
    }),
    col.accessor('referralStatus', {
      header: 'Referral',
      cell: info => <Badge label={info.getValue()} color={REFERRAL_STATUS_COLOR[info.getValue()]} />,
      filterFn: 'equalsString',
    }),
    col.accessor('lastInteraction', {
      header: 'Last',
      cell: info => fmt(info.getValue()),
      sortingFn: 'datetime',
    }),
    col.accessor('followUpDate', {
      header: 'Follow-Up',
      cell: info => {
        const v = info.getValue()
        const overdue = v && daysUntil(v) <= 0
        return <span className={overdue ? 'text-danger-600 font-medium' : ''}>{fmt(v)}</span>
      },
      sortingFn: 'datetime',
    }),
    col.display({
      id: 'links',
      header: 'Links',
      cell: info => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {info.row.original.email && <a href={`mailto:${info.row.original.email}`} className="text-accent-500 hover:underline">Email</a>}
          {info.row.original.linkedin && <a href={info.row.original.linkedin} target="_blank" rel="noreferrer" className="text-accent-500 hover:underline">LinkedIn</a>}
        </div>
      ),
    }),
    col.display({
      id: 'met',
      header: '',
      cell: info => <MetButton contact={info.row.original} onMet={onMet} />,
    }),
  ], [onMet])

  const uniq = (key) => [...new Set(contacts.map(c => c[key]).filter(Boolean))].sort()

  const table = useReactTable({
    data: contacts,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-sm overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="border-b border-ink-100">
              {hg.headers.map(h => (
                <th key={h.id} className="text-left px-3 py-2 align-top">
                  <button onClick={h.column.getToggleSortingHandler()}
                    className="font-semibold text-ink-500 uppercase tracking-wide text-[10px] hover:text-ink-700 flex items-center gap-0.5">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted()] ?? ''}
                  </button>
                  {h.column.id === 'company' && (
                    <input placeholder="Filter..." value={h.column.getFilterValue() ?? ''}
                      onChange={e => h.column.setFilterValue(e.target.value || undefined)}
                      className="w-full mt-1 px-1.5 py-1 border border-ink-200 rounded text-[11px] focus:outline-none focus:border-accent-400" />
                  )}
                  {['role','status','source','urgency','referralStatus'].includes(h.column.id) && (
                    <FacetFilter column={h.column} options={uniq(h.column.id)} />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} onClick={() => onEdit(row.original)}
              className="border-b border-ink-50 last:border-0 hover:bg-ink-50 cursor-pointer">
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-3 py-2 text-ink-600">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <p className="text-center py-10 text-ink-400 text-sm">No contacts match these filters.</p>
      )}
    </div>
  )
}
