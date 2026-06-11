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
