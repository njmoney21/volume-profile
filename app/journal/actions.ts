'use server'

import { createClient } from '@/lib/supabase/server'
import { prepareTradeData } from '@/lib/trades'
import type { TradeFormData } from '@/types'
import { revalidatePath } from 'next/cache'

export async function createTrade(formData: TradeFormData) {
  const supabase = await createClient()
  const data = prepareTradeData(formData)
  const { error } = await supabase.from('trades').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/journal')
  return { success: true }
}

export async function updateTrade(id: string, formData: TradeFormData) {
  const supabase = await createClient()
  const data = prepareTradeData(formData)
  const { error } = await supabase.from('trades').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/journal')
  return { success: true }
}

export async function deleteTrade(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/journal')
  return { success: true }
}
