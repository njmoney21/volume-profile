import type { Trade } from '@/types'
import { sumPnl, resultWinRate } from './trades'

export interface CalendarDay {
  date: string   // "YYYY-MM-DD"
  day: number    // 1-31
  pnl: number
  winRate: number
  tradeCount: number
}

export function buildCalendarGrid(trades: Trade[], year: number, month: number): (CalendarDay | null)[][] {
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = firstOfMonth.getDay() // 0 = Sunday

  const tradesByDate = new Map<string, Trade[]>()
  for (const trade of trades) {
    const list = tradesByDate.get(trade.date) ?? []
    list.push(trade)
    tradesByDate.set(trade.date, list)
  }

  const cells: (CalendarDay | null)[] = []

  for (let i = 0; i < startWeekday; i++) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayTrades = tradesByDate.get(date) ?? []
    cells.push({
      date,
      day,
      pnl: sumPnl(dayTrades),
      winRate: resultWinRate(dayTrades),
      tradeCount: dayTrades.length,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return weeks
}
