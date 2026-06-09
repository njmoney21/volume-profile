'use client'

import { useState } from 'react'
import type { Trade, TradeFilters } from '@/types'
import { filterTrades, sumPnl, winRate } from '@/lib/trades'
import { formatPnl } from '@/lib/utils'
import { FiltersBar } from './filters-bar'
import { TradeTable } from './trade-table'
import { TradeForm } from './trade-form'

export function JournalClient({ initialTrades }: { initialTrades: Trade[] }) {
  const [filters, setFilters] = useState<TradeFilters>({})
  const [showForm, setShowForm] = useState(false)

  const filtered = filterTrades(initialTrades, filters)
  const totalPnl = sumPnl(filtered)
  const wr = winRate(filtered)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} trade{filtered.length !== 1 ? 's' : ''} · Win rate {wr}% ·{' '}
            <span className={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {formatPnl(totalPnl)}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Trade
        </button>
      </div>

      <div className="mb-5">
        <FiltersBar filters={filters} onChange={setFilters} />
      </div>

      <TradeTable trades={filtered} />

      {showForm && <TradeForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
