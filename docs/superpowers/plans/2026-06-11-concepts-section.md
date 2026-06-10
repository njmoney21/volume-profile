# Concepts Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `app/concepts` placeholder with a working personal trading-notes section: add/edit/delete notes with a title, fixed-set category, and plain-text body, browsed as a list grouped by category with inline expand/collapse and a category filter.

**Architecture:** Follows the exact same layered pattern as the Journal module: a `lib/concepts.ts` with pure helper functions (grouping + data prep), a server component `app/concepts/page.tsx` that fetches rows via Supabase, server actions in `app/concepts/actions.ts` for create/update/delete, and client components under `components/concepts/` for the list, accordion items, and add/edit modal form.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + Auth), Vitest.

---

## Reference: spec

Full design: `docs/superpowers/specs/2026-06-11-concepts-design.md`. This plan implements that spec exactly, with one fix noted in Task 6 (date formatting for `updated_at` timestamps).

---

### Task 1: Migration file for category check constraint

**Files:**
- Create: `supabase/migrations/003_concepts_categories.sql`

- [ ] **Step 1: Write the migration file**

```sql
update concepts set category = 'General' where category not in
  ('Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General');

alter table concepts add constraint concepts_category_check
  check (category in ('Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_concepts_categories.sql
git commit -m "Add migration for concepts category check constraint"
```

This migration is run manually by the user in the Supabase SQL editor (in a new/blank query tab) — same as `002_journal_redesign.sql`. It is not run automatically and has no automated test.

---

### Task 2: Update `types/index.ts` for Concepts

**Files:**
- Modify: `types/index.ts`

The current `Concept` interface (near the bottom of the file) is:

```typescript
export interface Concept {
  id: string
  title: string
  category: string
  body: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 1: Add `ConceptCategory` type and `ConceptFormData` interface, and retype `Concept.category`**

Replace the existing `Concept` interface with:

```typescript
export type ConceptCategory = 'Setups' | 'Risk Management' | 'Psychology' | 'Market Structure' | 'General'

export interface Concept {
  id: string
  title: string
  category: ConceptCategory
  body: string
  created_at: string
  updated_at: string
}

export interface ConceptFormData {
  title: string
  category: ConceptCategory
  body: string
}
```

- [ ] **Step 2: Run typecheck to confirm no errors yet (file isn't used elsewhere yet, so this should pass)**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "Add ConceptCategory and ConceptFormData types"
```

---

### Task 3: Create `lib/concepts.ts` with tests

**Files:**
- Create: `lib/concepts.ts`
- Create: `__tests__/concepts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/concepts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { CONCEPT_CATEGORIES, groupByCategory, prepareConceptData } from '@/lib/concepts'
import type { Concept, ConceptFormData } from '@/types'

const makeConcept = (overrides: Partial<Concept> = {}): Concept => ({
  id: '1',
  title: 'Sample Concept',
  category: 'General',
  body: 'Some notes',
  created_at: '2026-06-11T10:00:00Z',
  updated_at: '2026-06-11T10:00:00Z',
  ...overrides,
})

describe('CONCEPT_CATEGORIES', () => {
  it('contains the five fixed categories in order', () => {
    expect(CONCEPT_CATEGORIES).toEqual([
      'Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General',
    ])
  })
})

describe('groupByCategory', () => {
  it('groups concepts under their category', () => {
    const concepts = [
      makeConcept({ id: '1', title: 'Breakout Setup', category: 'Setups' }),
      makeConcept({ id: '2', title: 'Position Sizing', category: 'Risk Management' }),
    ]

    const groups = groupByCategory(concepts)

    expect(groups).toEqual([
      { category: 'Setups', items: [concepts[0]] },
      { category: 'Risk Management', items: [concepts[1]] },
    ])
  })

  it('sorts items alphabetically by title within a category', () => {
    const concepts = [
      makeConcept({ id: '1', title: 'Zebra Setup', category: 'Setups' }),
      makeConcept({ id: '2', title: 'Alpha Setup', category: 'Setups' }),
    ]

    const groups = groupByCategory(concepts)

    expect(groups).toEqual([
      { category: 'Setups', items: [concepts[1], concepts[0]] },
    ])
  })

  it('excludes categories with no concepts', () => {
    const concepts = [makeConcept({ category: 'Psychology' })]

    const groups = groupByCategory(concepts)

    expect(groups).toEqual([
      { category: 'Psychology', items: concepts },
    ])
  })

  it('orders groups by CONCEPT_CATEGORIES order regardless of input order', () => {
    const concepts = [
      makeConcept({ id: '1', title: 'A', category: 'General' }),
      makeConcept({ id: '2', title: 'B', category: 'Setups' }),
    ]

    const groups = groupByCategory(concepts)

    expect(groups.map(g => g.category)).toEqual(['Setups', 'General'])
  })

  it('returns an empty array for no concepts', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('prepareConceptData', () => {
  it('maps form data to title, category, and body', () => {
    const formData: ConceptFormData = {
      title: 'New Concept',
      category: 'Market Structure',
      body: 'Some body text',
    }

    expect(prepareConceptData(formData)).toEqual({
      title: 'New Concept',
      category: 'Market Structure',
      body: 'Some body text',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/concepts.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/concepts" (file does not exist yet)

- [ ] **Step 3: Implement `lib/concepts.ts`**

Create `lib/concepts.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/concepts.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/concepts.ts __tests__/concepts.test.ts
git commit -m "Add lib/concepts.ts with grouping and data-prep helpers"
```

---

### Task 4: Create `app/concepts/actions.ts`

**Files:**
- Create: `app/concepts/actions.ts`

- [ ] **Step 1: Write the server actions**

Create `app/concepts/actions.ts`:

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

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/concepts/actions.ts
git commit -m "Add Concepts server actions"
```

---

### Task 5: Create `components/concepts/concept-form.tsx`

**Files:**
- Create: `components/concepts/concept-form.tsx`

- [ ] **Step 1: Write the component**

Create `components/concepts/concept-form.tsx`:

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

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/concepts/concept-form.tsx
git commit -m "Add ConceptForm modal component"
```

---

### Task 6: Create `components/concepts/concept-list.tsx`

**Files:**
- Create: `components/concepts/concept-list.tsx`

**Note on date formatting:** `lib/utils.ts`'s `formatDate(date)` does `new Date(date + 'T00:00:00')`, which expects a plain `YYYY-MM-DD` string (that's how Trade `date` fields are stored). `concept.updated_at` is a full ISO timestamp (e.g. `2026-06-11T22:30:00.000Z`), so passing it directly to `formatDate` would produce an invalid date (`...ZT00:00:00`). To reuse `formatDate` without modifying `lib/utils.ts` (which is shared with Backtest), slice the timestamp down to its date portion first: `formatDate(concept.updated_at.slice(0, 10))`.

- [ ] **Step 1: Write the component**

Create `components/concepts/concept-list.tsx`:

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
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/concepts/concept-list.tsx
git commit -m "Add ConceptList accordion component"
```

---

### Task 7: Create `components/concepts/concepts-client.tsx`

**Files:**
- Create: `components/concepts/concepts-client.tsx`

- [ ] **Step 1: Write the component**

Create `components/concepts/concepts-client.tsx`:

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

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/concepts/concepts-client.tsx
git commit -m "Add ConceptsClient top-level component"
```

---

### Task 8: Replace `app/concepts/page.tsx` placeholder

**Files:**
- Modify: `app/concepts/page.tsx`

Current content:

```typescript
export default function ConceptsPage() {
  return <h1 className="text-2xl font-semibold">Concepts — coming in Phase 5</h1>
}
```

- [ ] **Step 1: Replace with the server component**

Replace the entire file content with:

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

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/concepts/page.tsx
git commit -m "Wire up Concepts page with live data"
```

---

### Task 9: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all test files pass, including the new `__tests__/concepts.test.ts` (8 new tests) and all previously-passing suites (`trades.test.ts`, `backtest.test.ts`, `utils.test.ts`, `auth-routing.test.ts`)

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: build succeeds, `/concepts` listed as a route

- [ ] **Step 5: Push to GitHub**

```bash
git push origin master
```

- [ ] **Step 6: Remind the user**

After pushing, remind the user to run `supabase/migrations/003_concepts_categories.sql` manually in the Supabase SQL editor (in a new/blank query tab, not the full schema file) — same process as `002_journal_redesign.sql`. Existing rows in `concepts` (if any) with a category outside the fixed set will be reset to `'General'` by the migration before the constraint is added.

---

## Self-Review Notes

- **Spec coverage:** All sections of `2026-06-11-concepts-design.md` are covered — migration (Task 1), types (Task 2), `lib/concepts.ts` (Task 3), actions (Task 4), `ConceptForm` (Task 5), `ConceptList` (Task 6), `ConceptsClient` (Task 7), `page.tsx` (Task 8), verification/push (Task 9).
- **Date formatting fix:** Spec section 5 used `formatDate(concept.updated_at)` directly, which would break since `formatDate` expects a `YYYY-MM-DD` string but `updated_at` is a full timestamp. Task 6 fixes this with `.slice(0, 10)` — a one-line deviation from the literal spec text, called out explicitly.
- **Type consistency:** `ConceptCategory`, `ConceptFormData`, `Concept` (Task 2) are used consistently across `lib/concepts.ts` (Task 3), `actions.ts` (Task 4), and all three components (Tasks 5-7) — names and shapes match throughout.
- **No placeholders:** every step has complete, runnable code or exact commands.
