'use client'

import { useState } from 'react'
import type { Concept, ConceptCategory } from '@/types'
import { CONCEPT_CATEGORIES, groupByCategory } from '@/lib/concepts'
import { ConceptList } from './concept-list'
import { ConceptForm } from './concept-form'

export function ConceptsClient({ initialConcepts }: { initialConcepts: Concept[] }) {
  const [categoryFilter, setCategoryFilter] = useState<ConceptCategory | ''>('')
  const [showForm, setShowForm] = useState(false)

  const filtered = categoryFilter
    ? initialConcepts.filter(c => c.category === categoryFilter)
    : initialConcepts
  const groups = groupByCategory(filtered)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Concepts</h1>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} note{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-medium transition-colors"
        >
          + Add Concept
        </button>
      </div>

      <div className="mb-5">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as ConceptCategory | '')}
          className="bg-black border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          <option value="">All Categories</option>
          {CONCEPT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-white/10 rounded-xl">
          No concepts yet. Click &quot;+ Add Concept&quot; to add your first note.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(group => (
            <ConceptList key={group.category} category={group.category} items={group.items} />
          ))}
        </div>
      )}

      {showForm && <ConceptForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
