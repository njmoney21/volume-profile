import { createClient } from '@/lib/supabase/server'
import { JournalClient } from '@/components/journal/journal-client'
import type { Trade } from '@/types'

export default async function JournalPage() {
  const supabase = await createClient()

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('date', { ascending: false })
    .order('time_entered', { ascending: false })

  return <JournalClient initialTrades={(trades as Trade[]) ?? []} />
}
