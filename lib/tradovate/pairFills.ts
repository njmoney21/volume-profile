import type { TradeFormData } from '@/types'

export interface RawFill {
  id: number
  contractId: number
  timestamp: string   // ISO 8601, e.g. "2026-06-12T14:00:00.000Z"
  tradeDate: string   // "YYYY-MM-DD"
  action: 'Buy' | 'Sell'
  price: number
  qty: number
}

export interface PairResult {
  drafts: TradeFormData[]
  // fillId -> index into drafts[], or null if part of a still-open position
  fillAssignments: Map<number, number | null>
}

interface Lot {
  qty: number
  price: number
  action: 'Buy' | 'Sell'
}

interface LifecycleStart {
  tradeDate: string
  timestamp: string
  action: 'Buy' | 'Sell'
  size: number
}

export function pairFillsIntoTrades(
  fills: RawFill[],
  pointValueByContract: Map<number, number>
): PairResult {
  const drafts: TradeFormData[] = []
  const fillAssignments = new Map<number, number | null>()

  const byContract = new Map<number, RawFill[]>()
  for (const f of fills) {
    if (!pointValueByContract.has(f.contractId)) continue
    const list = byContract.get(f.contractId) ?? []
    list.push(f)
    byContract.set(f.contractId, list)
  }

  for (const [contractId, contractFills] of byContract) {
    const pointValue = pointValueByContract.get(contractId)!
    const sorted = [...contractFills].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const queue: Lot[] = []
    let lifecycleStart: LifecycleStart | null = null
    let lifecyclePnl = 0
    let pendingFillIds: number[] = []

    const closeLifecycle = () => {
      if (!lifecycleStart) return
      const direction = lifecycleStart.action === 'Buy' ? 'long' : 'short'
      const draftIndex = drafts.length
      const pnl = Math.round(lifecyclePnl * 100) / 100
      drafts.push({
        date: lifecycleStart.tradeDate,
        time_entered: lifecycleStart.timestamp.slice(11, 19),
        direction,
        position_size: lifecycleStart.size,
        level_type: null,
        level_price: null,
        prev_day_poc: null,
        prev_day_vah: null,
        prev_day_val: null,
        scenario: null,
        result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
        pnl,
        source: 'auto',
      })
      for (const fid of pendingFillIds) fillAssignments.set(fid, draftIndex)
      pendingFillIds = []
      lifecycleStart = null
      lifecyclePnl = 0
    }

    for (const f of sorted) {
      let remaining = f.qty

      if (queue.length === 0) {
        // starts a new lifecycle
        lifecycleStart = { tradeDate: f.tradeDate, timestamp: f.timestamp, action: f.action, size: f.qty }
        lifecyclePnl = 0
        queue.push({ qty: f.qty, price: f.price, action: f.action })
        pendingFillIds.push(f.id)
        fillAssignments.set(f.id, null)
        continue
      }

      if (queue[0].action === f.action) {
        // adds to the existing position (scaling in)
        queue.push({ qty: f.qty, price: f.price, action: f.action })
        if (lifecycleStart) lifecycleStart.size += f.qty
        pendingFillIds.push(f.id)
        fillAssignments.set(f.id, null)
        continue
      }

      // opposing fill: match FIFO against the queue
      pendingFillIds.push(f.id)
      fillAssignments.set(f.id, null)

      while (remaining > 0 && queue.length > 0) {
        const lot = queue[0]
        const matched = Math.min(remaining, lot.qty)
        const directionSign = lot.action === 'Buy' ? 1 : -1
        lifecyclePnl += (f.price - lot.price) * matched * directionSign * pointValue
        lot.qty -= matched
        remaining -= matched
        if (lot.qty === 0) queue.shift()
      }

      if (queue.length === 0) {
        closeLifecycle()

        if (remaining > 0) {
          // reversal: the remainder of this fill opens a new position
          // in the opposite direction. That new lifecycle isn't tracked
          // for dedup/draft purposes until its own closing fill arrives
          // in a future import run with this fill no longer excluded —
          // a known v1 limitation for reversal fills (see spec Section 10).
          lifecycleStart = { tradeDate: f.tradeDate, timestamp: f.timestamp, action: f.action, size: remaining }
          lifecyclePnl = 0
          queue.push({ qty: remaining, price: f.price, action: f.action })
          pendingFillIds = []
        }
      }
    }
  }

  return { drafts, fillAssignments }
}
