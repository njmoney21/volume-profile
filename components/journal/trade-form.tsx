'use client'

import { useState } from 'react'
import { createTrade, updateTrade } from '@/app/journal/actions'
import type { Trade, TradeFormData, Direction, LevelType, Scenario, TradeResult } from '@/types'

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

const defaultForm: TradeFormData = {
  date: new Date().toISOString().split('T')[0],
  time_entered: '09:30',
  direction: 'long',
  position_size: 0,
  level_type: 'POC',
  level_price: 0,
  prev_day_poc: 0,
  prev_day_vah: 0,
  prev_day_val: 0,
  scenario: 'retest_continue',
  result: 'breakeven',
  pnl: 0,
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
          position_size: trade.position_size,
          level_type: trade.level_type,
          level_price: trade.level_price,
          prev_day_poc: trade.prev_day_poc,
          prev_day_vah: trade.prev_day_vah,
          prev_day_val: trade.prev_day_val,
          scenario: trade.scenario,
          result: trade.result,
          pnl: trade.pnl,
          notes: trade.notes ?? '',
          source: trade.source,
        }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof TradeFormData, value: string | number | null) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const data: TradeFormData = {
      ...form,
      position_size: Number(form.position_size),
      pnl: Number(form.pnl),
      level_price: form.level_price == null ? null : Number(form.level_price),
      prev_day_poc: form.prev_day_poc == null ? null : Number(form.prev_day_poc),
      prev_day_vah: form.prev_day_vah == null ? null : Number(form.prev_day_vah),
      prev_day_val: form.prev_day_val == null ? null : Number(form.prev_day_val),
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
      <div className="bg-black border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">{trade ? 'Edit Trade' : 'Add Trade'}</h2>
          {trade?.status === 'draft' && (
            <p className="text-xs text-amber-400 mt-1">
              Imported from Tradovate — fill in the strategy fields below to mark this trade as reviewed.
            </p>
          )}
        </div>
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
            <Field label="Result">
              <select value={form.result}
                onChange={e => set('result', e.target.value as TradeResult)}
                className={inputClass}>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Position Size ($)">
              <input type="number" step="0.01" value={form.position_size}
                onChange={e => set('position_size', e.target.value)}
                className={inputClass} required />
            </Field>
            <Field label="P&L ($)">
              <input type="number" step="0.01" value={form.pnl}
                onChange={e => set('pnl', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 mb-3">Previous Day Levels</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="POC (Red)">
                <input type="number" step="0.25" value={form.prev_day_poc ?? ''}
                  onChange={e => set('prev_day_poc', e.target.value === '' ? null : e.target.value)}
                  className={inputClass} />
              </Field>
              <Field label="VAH (Purple)">
                <input type="number" step="0.25" value={form.prev_day_vah ?? ''}
                  onChange={e => set('prev_day_vah', e.target.value === '' ? null : e.target.value)}
                  className={inputClass} />
              </Field>
              <Field label="VAL (Purple)">
                <input type="number" step="0.25" value={form.prev_day_val ?? ''}
                  onChange={e => set('prev_day_val', e.target.value === '' ? null : e.target.value)}
                  className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Level Traded">
              <select value={form.level_type ?? ''}
                onChange={e => set('level_type', e.target.value === '' ? null : e.target.value as LevelType)}
                className={inputClass}>
                <option value="">— Select —</option>
                <option value="POC">POC (Red)</option>
                <option value="VAH">VAH (Purple)</option>
                <option value="VAL">VAL (Purple)</option>
              </select>
            </Field>
            <Field label="Level Price">
              <input type="number" step="0.25" value={form.level_price ?? ''}
                onChange={e => set('level_price', e.target.value === '' ? null : e.target.value)}
                className={inputClass} />
            </Field>
          </div>

          <Field label="Scenario">
            <select value={form.scenario ?? ''}
              onChange={e => set('scenario', e.target.value === '' ? null : e.target.value as Scenario)}
              className={inputClass}>
              <option value="">— Select —</option>
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
