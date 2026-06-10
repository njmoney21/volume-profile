import { createClient } from '@/lib/supabase/server'
import { BacktestClient } from '@/components/backtest/backtest-client'
import type { BacktestSession, BacktestDay, BacktestTrade } from '@/types'

export default async function BacktestPage() {
  const supabase = await createClient()

  const [{ data: sessions }, { data: days }, { data: trades }] = await Promise.all([
    supabase.from('backtest_sessions').select('*').order('date_from', { ascending: false }),
    supabase.from('backtest_days').select('*').order('date', { ascending: true }),
    supabase.from('backtest_trades').select('*').order('time_entered', { ascending: true }),
  ])

  return (
    <BacktestClient
      sessions={(sessions as BacktestSession[]) ?? []}
      days={(days as BacktestDay[]) ?? []}
      trades={(trades as BacktestTrade[]) ?? []}
    />
  )
}
