'use client'

import { useState } from 'react'
import { createSession, updateSession } from '@/app/backtest/actions'
import type { BacktestSession, BacktestSessionFormData } from '@/types'

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

const defaultForm: BacktestSessionFormData = {
  date_from: new Date().toISOString().split('T')[0],
  date_to: new Date().toISOString().split('T')[0],
  notes: '',
}

interface SessionFormProps {
  session?: BacktestSession
  onClose: () => void
}

export function SessionForm({ session, onClose }: SessionFormProps) {
  const [form, setForm] = useState<BacktestSessionFormData>(
    session
      ? {
          date_from: session.date_from,
          date_to: session.date_to,
          notes: session.notes ?? '',
        }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof BacktestSessionFormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = session ? await updateSession(session.id, form) : await createSession(form)

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
        <h2 className="text-lg font-semibold mb-5">{session ? 'Edit Session' : 'New Session'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date From">
              <input type="date" value={form.date_from}
                onChange={e => set('date_from', e.target.value)}
                className={inputClass} required />
            </Field>
            <Field label="Date To">
              <input type="date" value={form.date_to}
                onChange={e => set('date_to', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

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
              {loading ? 'Saving...' : session ? 'Save Changes' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
