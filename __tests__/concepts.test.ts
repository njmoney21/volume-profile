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
