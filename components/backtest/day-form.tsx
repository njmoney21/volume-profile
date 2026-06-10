'use client'

import { useState } from 'react'
import { createDay, updateDay } from '@/app/backtest/actions'
import type { BacktestDay, BacktestDayFormData } from '@/types'

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

const defaultForm: BacktestDayFormData = {
  date: new Date().toISOString().split('T')[0],
  prev_day_poc: 0,
  prev_day_vah: 0,
  prev_day_val: 0,
}

interface DayFormProps {
  sessionId: string
  day?: BacktestDay
  onClose: () => void
}

export function DayForm({ sessionId, day, onClose }: DayFormProps) {
  const [form, setForm] = useState<BacktestDayFormData>(
    day
      ? {
          date: day.date,
          prev_day_poc: day.prev_day_poc,
          prev_day_vah: day.prev_day_vah,
          prev_day_val: day.prev_day_val,
        }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof BacktestDayFormData, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const data: BacktestDayFormData = {
      ...form,
      prev_day_poc: Number(form.prev_day_poc),
      prev_day_vah: Number(form.prev_day_vah),
      prev_day_val: Number(form.prev_day_val),
    }

    const result = day ? await updateDay(day.id, data) : await createDay(sessionId, data)

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
        <h2 className="text-lg font-semibold mb-5">{day ? 'Edit Day' : 'Add Day'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <Field label="Date">
            <input type="date" value={form.date}
              onChange={e => set('date', e.target.value)}
              className={inputClass} required />
          </Field>

          <div className="border-t border-white/10 pt-4">
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

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : day ? 'Save Changes' : 'Add Day'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
