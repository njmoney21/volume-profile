import type { SupabaseClient } from '@supabase/supabase-js'
import { pairFillsIntoTrades, type RawFill } from './pairFills'
import { prepareTradeData } from '@/lib/trades'

export interface ImportResult {
  imported: number
  stillOpen: number
}

// Shared by the live Tradovate API import route and the CSV upload route:
// dedups fills against imported_fills, pairs them into draft trades, and
// persists the results.
export async function runImport(
  fills: RawFill[],
  pointValueByContract: Map<number, number>,
  admin: SupabaseClient
): Promise<ImportResult> {
  const { data: existing } = await admin
    .from('imported_fills')
    .select('fill_id')
    .not('trade_id', 'is', null)
  const processedFillIds = new Set((existing ?? []).map(r => r.fill_id))

  const newFills = fills.filter(f => !processedFillIds.has(f.id))

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

  return { imported, stillOpen }
}
