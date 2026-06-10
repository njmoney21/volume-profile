'use client'

import type { TradeFilters } from '@/types'

const selectClass =
  'bg-black border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30'

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
      <input type="date" value={filters.date ?? ''} title="Date"
        onChange={e => set('date', e.target.value)} className={selectClass} />
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
      <select value={filters.result ?? ''}
        onChange={e => set('result', e.target.value)} className={selectClass}>
        <option value="">All Results</option>
        <option value="win">Win</option>
        <option value="loss">Loss</option>
        <option value="breakeven">Breakeven</option>
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
