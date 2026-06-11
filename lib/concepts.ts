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
