'use server'

import { createClient } from '@/lib/supabase/server'
import { prepareBacktestTradeData } from '@/lib/backtest'
import type { BacktestSessionFormData, BacktestDayFormData, BacktestTradeFormData } from '@/types'
import { revalidatePath } from 'next/cache'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function syncDayPnl(supabase: SupabaseClient, dayId: string) {
  const { data: trades } = await supabase.from('backtest_trades').select('pnl').eq('day_id', dayId)
  const total = Math.round(((trades ?? []).reduce((sum, t) => sum + t.pnl, 0)) * 100) / 100
  await supabase.from('backtest_days').update({ day_pnl: total }).eq('id', dayId)
}

// Sessions

export async function createSession(formData: BacktestSessionFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_sessions').insert({
    date_from: formData.date_from,
    date_to: formData.date_to,
    notes: formData.notes ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function updateSession(id: string, formData: BacktestSessionFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_sessions').update({
    date_from: formData.date_from,
    date_to: formData.date_to,
    notes: formData.notes ?? null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_sessions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

// Days

export async function createDay(sessionId: string, formData: BacktestDayFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_days').insert({
    session_id: sessionId,
    date: formData.date,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
    day_pnl: 0,
  })
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function updateDay(id: string, formData: BacktestDayFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_days').update({
    date: formData.date,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function deleteDay(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_days').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

// Trades

export async function createBacktestTrade(
  sessionId: string,
  dayId: string,
  date: string,
  formData: BacktestTradeFormData
) {
  const supabase = await createClient()
  const data = prepareBacktestTradeData(sessionId, dayId, date, formData)
  const { error } = await supabase.from('backtest_trades').insert(data)
  if (error) return { error: error.message }
  await syncDayPnl(supabase, dayId)
  revalidatePath('/backtest')
  return { success: true }
}

export async function updateBacktestTrade(
  id: string,
  sessionId: string,
  dayId: string,
  date: string,
  formData: BacktestTradeFormData
) {
  const supabase = await createClient()
  const data = prepareBacktestTradeData(sessionId, dayId, date, formData)
  const { error } = await supabase.from('backtest_trades').update(data).eq('id', id)
  if (error) return { error: error.message }
  await syncDayPnl(supabase, dayId)
  revalidatePath('/backtest')
  return { success: true }
}

export async function deleteBacktestTrade(id: string, dayId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_trades').delete().eq('id', id)
  if (error) return { error: error.message }
  await syncDayPnl(supabase, dayId)
  revalidatePath('/backtest')
  return { success: true }
}
