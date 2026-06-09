'use client'

import type { TradeFilters } from '@/types'

const selectClass =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

interface FiltersBarProps {
  filters: TradeFilters
  onChange: (filters: TradeFilters) => void
}

export function FiltersBar({ filters, onChange }: FiltersBarProps) {
  function set(key: keyof TradeFilters, value: string) {
    onChange({ ...filters, [key]: value || undefined })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input type="date" value={filters.date_from ?? ''} title="From date"
        onChange={e => set('date_from', e.target.value)} className={selectClass} />
      <input type="date" value={filters.date_to ?? ''} title="To date"
        onChange={e => set('date_to', e.target.value)} className={selectClass} />
      <select value={filters.direction ?? ''}
        onChange={e => set('direction', e.target.value)} className={selectClass}>
        <option value="">All Directions</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>
      <select value={filters.level_type ?? ''}
        onChange={e => set('level_type', e.target.value)} className={selectClass}>
        <option value="">All Levels</option>
        <option value="POC">POC</option>
        <option value="VAH">VAH</option>
        <option value="VAL">VAL</option>
      </select>
      <select value={filters.scenario ?? ''}
        onChange={e => set('scenario', e.target.value)} className={selectClass}>
        <option value="">All Scenarios</option>
        <option value="retest_continue">Retest + Continue</option>
        <option value="break_retest_reverse">Break + Retest + Reverse</option>
      </select>
      {hasFilters && (
        <button onClick={() => onChange({})}
          className="text-xs text-gray-400 hover:text-white transition-colors">
          Clear filters
        </button>
      )}
    </div>
  )
}
