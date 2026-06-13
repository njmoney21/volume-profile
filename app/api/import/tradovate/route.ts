import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessToken, getFills, getContractSymbol } from '@/lib/tradovate/client'
import { getPointValue } from '@/lib/tradovate/contracts'
import { runImport } from '@/lib/tradovate/runImport'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const accountId = Number(process.env.TRADOVATE_ACCOUNT_ID)

    const token = await getAccessToken()
    const fills = await getFills(token, accountId)

    const contractIds = [...new Set(fills.map(f => f.contractId))]
    const pointValueByContract = new Map<number, number>()
    let skipped = 0
    for (const contractId of contractIds) {
      const symbol = await getContractSymbol(token, contractId)
      const pointValue = getPointValue(symbol)
      if (pointValue === null) {
        skipped += fills.filter(f => f.contractId === contractId).length
        continue
      }
      pointValueByContract.set(contractId, pointValue)
    }

    const { imported, stillOpen } = await runImport(fills, pointValueByContract, admin)

    return NextResponse.json({ imported, stillOpen, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown import error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
