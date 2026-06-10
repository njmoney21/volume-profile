'use client'

import { useState } from 'react'
import { createBacktestTrade, updateBacktestTrade } from '@/app/backtest/actions'
import { formatDate } from '@/lib/utils'
import type { BacktestDay, BacktestTrade, BacktestTradeFormData, Direction, LevelType, Scenario } from '@/types'

const inputClass =
  'bg-black border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 w-full'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-400">{label}</label>
      {children}
    </div>
  )
}

const defaultForm: BacktestTradeFormData = {
  time_entered: '09:30',
  direction: 'long',
  entry_price: 0,
  exit_price: 0,
  contracts: 1,
  level_type: 'POC',
  level_price: 0,
  scenario: 'retest_continue',
  notes: '',
}

interface BacktestTradeFormProps {
  sessionId: string
  day: BacktestDay
  trade?: BacktestTrade
  onClose: () => void
}

export function BacktestTradeForm({ sessionId, day, trade, onClose }: BacktestTradeFormProps) {
  const [form, setForm] = useState<BacktestTradeFormData>(
    trade
      ? {
          time_entered: trade.time_entered.slice(0, 5),
          direction: trade.direction,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          contracts: trade.contracts,
          level_type: trade.level_type,
          level_price: trade.level_price,
          scenario: trade.scenario,
          notes: trade.notes ?? '',
        }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof BacktestTradeFormData, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const data: BacktestTradeFormData = {
      ...form,
      entry_price: Number(form.entry_price),
      exit_price: Number(form.exit_price),
      contracts: Number(form.contracts),
      level_price: Number(form.level_price),
    }

    const result = trade
      ? await updateBacktestTrade(trade.id, sessionId, day.id, day.date, data)
      : await createBacktestTrade(sessionId, day.id, day.date, data)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-black border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-5">{trade ? 'Edit Trade' : 'Add Trade'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <p className="text-sm text-gray-300 px-3 py-2">{formatDate(day.date)}</p>
            </Field>
            <Field label="Time (≥ 09:30)">
              <input type="time" value={form.time_entered} min="09:30"
                onChange={e => set('time_entered', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Direction">
              <select value={form.direction}
                onChange={e => set('direction', e.target.value as Direction)}
                className={inputClass}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Field>
            <Field label="Contracts">
              <input type="number" min="1" value={form.contracts}
                onChange={e => set('contracts', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Entry Price">
              <input type="number" step="0.25" value={form.entry_price}
                onChange={e => set('entry_price', e.target.value)}
                className={inputClass} required />
            </Field>
            <Field label="Exit Price">
              <input type="number" step="0.25" value={form.exit_price}
                onChange={e => set('exit_price', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Level Traded">
              <select value={form.level_type}
                onChange={e => set('level_type', e.target.value as LevelType)}
                className={inputClass}>
                <option value="POC">POC (Red)</option>
                <option value="VAH">VAH (Purple)</option>
                <option value="VAL">VAL (Purple)</option>
              </select>
            </Field>
            <Field label="Level Price">
              <input type="number" step="0.25" value={form.level_price}
                onChange={e => set('level_price', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <Field label="Scenario">
            <select value={form.scenario}
              onChange={e => set('scenario', e.target.value as Scenario)}
              className={inputClass}>
              <option value="retest_continue">Retest + Continue</option>
              <option value="break_retest_reverse">Break + Retest + Reverse</option>
            </select>
          </Field>

          <Field label="Notes (optional)">
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              className={`${inputClass} h-20 resize-none`} />
          </Field>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : trade ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
