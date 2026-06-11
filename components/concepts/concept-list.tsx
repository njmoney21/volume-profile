'use client'

import { useState } from 'react'
import type { Concept, ConceptCategory } from '@/types'
import { formatDate } from '@/lib/utils'
import { deleteConcept } from '@/app/concepts/actions'
import { ConceptForm } from './concept-form'

export function ConceptList({ category, items }: { category: ConceptCategory; items: Concept[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Concept | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this concept?')) return
    await deleteConcept(id)
  }

  return (
    <div className="bg-black border border-white/10 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{category}</h3>
      <div className="flex flex-col">
        {items.map(concept => {
          const isExpanded = expandedId === concept.id
          return (
            <div key={concept.id} className="border-b border-white/5 last:border-b-0">
              <button
                onClick={() => setExpandedId(isExpanded ? null : concept.id)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-white/5 transition-colors px-2 -mx-2 rounded-lg"
              >
                <span className="text-sm text-white">{concept.title}</span>
                <span className="text-gray-500 text-xs">{isExpanded ? '▾' : '▸'}</span>
              </button>
              {isExpanded && (
                <div className="px-2 pb-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{concept.body}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">Updated {formatDate(concept.updated_at.slice(0, 10))}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditing(concept)}
                        className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                      <button onClick={() => handleDelete(concept.id)}
                        className="text-xs text-gray-400 hover:text-white transition-colors">Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {editing && <ConceptForm concept={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
