# Concepts Section — Design Spec

Date: 2026-06-11
Scope: `app/concepts/*`, `components/concepts/*`, `lib/concepts.ts`, `types/index.ts`, `concepts` table.

## 1. Goals & Scope

Replace the `app/concepts` placeholder ("Concepts — coming in Phase 5") with a working personal notes/research section:
- Add, edit, delete trading-concept notes (title, category, plain-text body)
- Browse notes grouped by category, with inline expand/collapse to read the body
- Filter to a single category
- Categories are a fixed set: **Setups, Risk Management, Psychology, Market Structure, General**

Out of scope: markdown rendering, search/full-text search, attachments, tagging beyond category, reordering within a category (always alphabetical by title).

## 2. Data Model

The `concepts` table already exists (`id, title, category, body, created_at, updated_at`) with RLS policy `auth_concepts`. The `Concept` type already exists in `types/index.ts`.

### `types/index.ts` additions

```typescript
export type ConceptCategory = 'Setups' | 'Risk Management' | 'Psychology' | 'Market Structure' | 'General'

export interface ConceptFormData {
  title: string
  category: ConceptCategory
  body: string
}
```

`Concept.category` becomes typed as `ConceptCategory` instead of `string`.

### Migration: `supabase/migrations/003_concepts_categories.sql`

Update any legacy rows to a valid category first, then add the check constraint:

```sql
update concepts set category = 'General' where category not in
  ('Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General');

alter table concepts add constraint concepts_category_check
  check (category in ('Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General'));
```

The user runs this migration manually in the Supabase SQL editor (in a new/blank query tab, not the full schema file), the same way `002_journal_redesign.sql` was applied.

## 3. `lib/concepts.ts`

New file:

```typescript
import type { Concept, ConceptFormData, ConceptCategory } from '@/types'

export const CONCEPT_CATEGORIES: ConceptCategory[] = [
  'Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General',
]

export function groupByCategory(concepts: Concept[]): { category: ConceptCategory; items: Concept[] }[] {
  return CONCEPT_CATEGORIES
    .map(category => ({
      category,
      items: concepts
        .filter(c => c.category === category)
        .sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter(group => group.items.length > 0)
}

export function prepareConceptData(formData: ConceptFormData): Pick<Concept, 'title' | 'category' | 'body'> {
  return {
    title: formData.title,
    category: formData.category,
    body: formData.body,
  }
}
```

- `CONCEPT_CATEGORIES` is the single source of truth for the fixed list — used by the category `<select>` in the form, the filter dropdown, and the grouping order. Categories appear in this fixed order, only when they have at least one concept.
- `groupByCategory` powers the grouped list view (alphabetical by title within each group).
- `prepareConceptData` is a pure passthrough mapping (mirrors `prepareTradeData`).

## 4. `app/concepts/page.tsx` + `app/concepts/actions.ts`

### `page.tsx` (server component)

```typescript
import { createClient } from '@/lib/supabase/server'
import { ConceptsClient } from '@/components/concepts/concepts-client'
import type { Concept } from '@/types'

export default async function ConceptsPage() {
  const supabase = await createClient()

  const { data: concepts } = await supabase
    .from('concepts')
    .select('*')
    .order('title', { ascending: true })

  return <ConceptsClient initialConcepts={(concepts as Concept[]) ?? []} />
}
```

### `actions.ts`

There is no DB trigger for `updated_at`, so `updateConcept` sets it explicitly to `new Date().toISOString()`.

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { prepareConceptData } from '@/lib/concepts'
import type { ConceptFormData } from '@/types'
import { revalidatePath } from 'next/cache'

export async function createConcept(formData: ConceptFormData) {
  const supabase = await createClient()
  const data = prepareConceptData(formData)
  const { error } = await supabase.from('concepts').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/concepts')
  return { success: true }
}

export async function updateConcept(id: string, formData: ConceptFormData) {
  const supabase = await createClient()
  const data = { ...prepareConceptData(formData), updated_at: new Date().toISOString() }
  const { error } = await supabase.from('concepts').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/concepts')
  return { success: true }
}

export async function deleteConcept(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('concepts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/concepts')
  return { success: true }
}
```

## 5. Components

### `components/concepts/concepts-client.tsx`

Top-level client component (mirrors `journal-client.tsx`): holds category-filter state and add-form visibility, computes filtered + grouped concepts, renders header, "+ Add Concept" button, category filter `<select>`, the list of `ConceptList` groups (or an empty state), and the `ConceptForm` modal when adding.

```typescript
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
```

### `components/concepts/concept-list.tsx`

One category section; each item is an accordion row with inline expand/collapse, showing Edit/Delete and "Updated <date>" when expanded.

```typescript
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
                    <span className="text-xs text-gray-500">Updated {formatDate(concept.updated_at)}</span>
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
```

### `components/concepts/concept-form.tsx`

Modal, follows `trade-form.tsx`'s structure with `Field`/`inputClass`.

```typescript
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
```

## 6. `app/concepts/page.tsx` replacement

The placeholder file:

```typescript
export default function ConceptsPage() {
  return <h1 className="text-2xl font-semibold">Concepts — coming in Phase 5</h1>
}
```

is replaced entirely by the server component shown in section 4.

## 7. Testing

Following project conventions (Vitest):
- `lib/concepts.ts`: unit tests for `groupByCategory` (correct grouping, alphabetical sort within group, empty groups excluded, category order matches `CONCEPT_CATEGORIES`) and `prepareConceptData` (passthrough mapping).
- Component-level (`concepts-client`, `concept-list`, `concept-form`): verified via `tsc`, `lint`, and manual smoke-check against the dev server (add/edit/delete a concept, filter by category, expand/collapse), matching the existing pattern for journal components.

## 8. Out of Scope

- Markdown rendering, search/full-text search, tags beyond category, custom ordering within a category, attachments/images.
