import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import type { Trade } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('date', { ascending: true })
    .order('time_entered', { ascending: true })

  return <DashboardClient trades={(trades as Trade[]) ?? []} />
}
