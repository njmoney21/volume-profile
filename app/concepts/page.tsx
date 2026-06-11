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
