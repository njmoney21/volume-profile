'use client'

import { useState } from 'react'
import { createTrade, updateTrade } from '@/app/journal/actions'
import type { Trade, TradeFormData, Direction, LevelType, Scenario } from '@/types'

const inputClass =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-400">{label}</label>
      {children}
    </div>
  )
}

const defaultForm: TradeFormData = {
  date: new Date().toISOString().split('T')[0],
  time_entered: '09:30',
  direction: 'long',
  entry_price: 0,
  exit_price: 0,
  contracts: 1,
  level_type: 'POC',
  level_price: 0,
  prev_day_poc: 0,
  prev_day_vah: 0,
  prev_day_val: 0,
  scenario: 'retest_continue',
  notes: '',
}

interface TradeFormProps {
  trade?: Trade
  onClose: () => void
}

export function TradeForm({ trade, onClose }: TradeFormProps) {
  const [form, setForm] = useState<TradeFormData>(
    trade
      ? {
          date: trade.date,
          time_entered: trade.time_entered.slice(0, 5),
          direction: trade.direction,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          contracts: trade.contracts,
          level_type: trade.level_type,
          level_price: trade.level_price,
          prev_day_poc: trade.prev_day_poc,
          prev_day_vah: trade.prev_day_vah,
          prev_day_val: trade.prev_day_val,
          scenario: trade.scenario,
          notes: trade.notes ?? '',
        }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof TradeFormData, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const data: TradeFormData = {
      ...form,
      entry_price: Number(form.entry_price),
      exit_price: Number(form.exit_price),
      contracts: Number(form.contracts),
      level_price: Number(form.level_price),
      prev_day_poc: Number(form.prev_day_poc),
      prev_day_vah: Number(form.prev_day_vah),
      prev_day_val: Number(form.prev_day_val),
    }

    const result = trade ? await updateTrade(trade.id, data) : await createTrade(data)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-5">{trade ? 'Edit Trade' : 'Add Trade'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input type="date" value={form.date}
                onChange={e => set('date', e.target.value)}
                className={inputClass} required />
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

          <div className="border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-500 mb-3">Previous Day Levels</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="POC (Red)">
                <input type="number" step="0.25" value={form.prev_day_poc}
                  onChange={e => set('prev_day_poc', e.target.value)}
                  className={inputClass} required />
              </Field>
              <Field label="VAH (Purple)">
                <input type="number" step="0.25" value={form.prev_day_vah}
                  onChange={e => set('prev_day_vah', e.target.value)}
                  className={inputClass} required />
              </Field>
              <Field label="VAL (Purple)">
                <input type="number" step="0.25" value={form.prev_day_val}
                  onChange={e => set('prev_day_val', e.target.value)}
                  className={inputClass} required />
              </Field>
            </div>
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : trade ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
