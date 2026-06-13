'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Trade, TradeFilters } from '@/types'
import { filterTrades, sumPnl, resultWinRate } from '@/lib/trades'
import { formatPnl } from '@/lib/utils'
import { FiltersBar } from './filters-bar'
import { TradeTable } from './trade-table'
import { TradeForm } from './trade-form'

export function JournalClient({ initialTrades }: { initialTrades: Trade[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') ?? undefined
  const initialStatus = searchParams.get('status') as TradeFilters['status'] | null
  const [filters, setFilters] = useState<TradeFilters>({
    ...(initialDate && { date: initialDate }),
    ...(initialStatus && { status: initialStatus }),
  })
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  function applyImportResult(res: Response, data: { imported?: number; stillOpen?: number; skippedSymbols?: string[]; error?: string }) {
    if (!res.ok) {
      setImportMessage(`Import failed: ${data.error ?? 'Unknown error'}`)
      return
    }
    if (!data.imported) {
      setImportMessage('No new trades to import.')
      return
    }
    const openNote = data.stillOpen ? ` (${data.stillOpen} position still open)` : ''
    const skippedNote = data.skippedSymbols?.length
      ? ` Skipped unsupported contracts: ${data.skippedSymbols.join(', ')}.`
      : ''
    setImportMessage(`Imported ${data.imported} trade${data.imported === 1 ? '' : 's'}${openNote}.${skippedNote}`)
    router.refresh()
  }

  async function handleImport() {
    setImporting(true)
    setImportMessage(null)
    try {
      const res = await fetch('/api/import/tradovate', { method: 'POST' })
      const data = await res.json()
      applyImportResult(res, data)
    } catch {
      setImportMessage('Import failed: network error.')
    } finally {
      setImporting(false)
    }
  }

  async function handleCsvSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    setImportMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/import/tradovate-csv', { method: 'POST', body: formData })
      const data = await res.json()
      applyImportResult(res, data)
    } catch {
      setImportMessage('Import failed: network error.')
    } finally {
      setImporting(false)
    }
  }

  const filtered = filterTrades(initialTrades, filters)
  const totalPnl = sumPnl(filtered)
  const wr = resultWinRate(filtered)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} trade{filtered.length !== 1 ? 's' : ''} · Win rate {wr}% ·{' '}
            <span className={totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPnl(totalPnl)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 border border-white/20 hover:bg-white/5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import from Tradovate'}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvSelected}
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 border border-white/20 hover:bg-white/5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Fills CSV'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-medium transition-colors"
          >
            + Add Trade
          </button>
        </div>
      </div>

      {importMessage && (
        <p className="text-sm text-gray-400 mb-4">{importMessage}</p>
      )}

      <div className="mb-5">
        <FiltersBar filters={filters} onChange={setFilters} />
      </div>

      <TradeTable trades={filtered} />

      {showForm && <TradeForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
