'use client'

import { useState } from 'react'
import { createConcept, updateConcept } from '@/app/concepts/actions'
import { CONCEPT_CATEGORIES } from '@/lib/concepts'
import type { Concept, ConceptFormData, ConceptCategory } from '@/types'

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

const defaultForm: ConceptFormData = {
  title: '',
  category: 'General',
  body: '',
}

interface ConceptFormProps {
  concept?: Concept
  onClose: () => void
}

export function ConceptForm({ concept, onClose }: ConceptFormProps) {
  const [form, setForm] = useState<ConceptFormData>(
    concept
      ? { title: concept.title, category: concept.category, body: concept.body }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof ConceptFormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = concept ? await updateConcept(concept.id, form) : await createConcept(form)

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
        <h2 className="text-lg font-semibold mb-5">{concept ? 'Edit Concept' : 'Add Concept'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input type="text" value={form.title}
              onChange={e => set('title', e.target.value)}
              className={inputClass} required />
          </Field>

          <Field label="Category">
            <select value={form.category}
              onChange={e => set('category', e.target.value as ConceptCategory)}
              className={inputClass}>
              {CONCEPT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea value={form.body} onChange={e => set('body', e.target.value)}
              className={`${inputClass} h-40 resize-none`} required />
          </Field>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : concept ? 'Save Changes' : 'Add Concept'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
