import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessToken, getFills, getContractSymbol } from '@/lib/tradovate/client'
import { getPointValue } from '@/lib/tradovate/contracts'
import { pairFillsIntoTrades } from '@/lib/tradovate/pairFills'
import { prepareTradeData } from '@/lib/trades'

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

    const { data: existing } = await admin
      .from('imported_fills')
      .select('fill_id')
      .not('trade_id', 'is', null)
    const processedFillIds = new Set((existing ?? []).map(r => r.fill_id))

    const newFills = fills.filter(f => !processedFillIds.has(f.id))

    const contractIds = [...new Set(newFills.map(f => f.contractId))]
    const pointValueByContract = new Map<number, number>()
    let skipped = 0
    for (const contractId of contractIds) {
      const symbol = await getContractSymbol(token, contractId)
      const pointValue = getPointValue(symbol)
      if (pointValue === null) {
        skipped += newFills.filter(f => f.contractId === contractId).length
        continue
      }
      pointValueByContract.set(contractId, pointValue)
    }

    const { drafts, fillAssignments } = pairFillsIntoTrades(newFills, pointValueByContract)

    let imported = 0
    let stillOpen = 0

    if (drafts.length > 0) {
      const rows = drafts.map(prepareTradeData)
      const { data: inserted, error } = await admin.from('trades').insert(rows).select('id')
      if (error) throw new Error(`Failed to insert draft trades: ${error.message}`)
      imported = inserted?.length ?? 0

      const fillRows = [...fillAssignments.entries()].map(([fillId, draftIndex]) => ({
        fill_id: fillId,
        trade_id: draftIndex !== null ? inserted?.[draftIndex]?.id ?? null : null,
      }))
      stillOpen = fillRows.filter(r => r.trade_id === null).length

      const { error: upsertError } = await admin.from('imported_fills').upsert(fillRows)
      if (upsertError) throw new Error(`Failed to record imported fills: ${upsertError.message}`)
    } else {
      stillOpen = [...fillAssignments.values()].filter(v => v === null).length
      if (fillAssignments.size > 0) {
        const fillRows = [...fillAssignments.entries()].map(([fillId, draftIndex]) => ({
          fill_id: fillId,
          trade_id: draftIndex,
        }))
        const { error: upsertError } = await admin.from('imported_fills').upsert(fillRows)
        if (upsertError) throw new Error(`Failed to record imported fills: ${upsertError.message}`)
      }
    }

    return NextResponse.json({ imported, stillOpen, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown import error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
