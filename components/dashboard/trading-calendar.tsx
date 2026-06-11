'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Trade } from '@/types'
import { buildCalendarGrid } from '@/lib/calendar'
import { formatPnl } from '@/lib/utils'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function TradingCalendar({ trades }: { trades: Trade[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const weeks = buildCalendarGrid(trades, year, month)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  return (
    <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Trading Calendar</h2>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            ←
          </button>
          <span className="text-sm font-medium text-white w-32 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-xs font-medium text-gray-500 py-1">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.flatMap((week, wi) =>
          week.map((cell, di) => {
            if (!cell) {
              return <div key={`${wi}-${di}`} className="aspect-square rounded-xl bg-white/[0.02] border border-white/5" />
            }

            const isToday = cell.date === todayStr
            const hasTrades = cell.tradeCount > 0
            const isProfit = hasTrades && cell.pnl > 0
            const isLoss = hasTrades && cell.pnl < 0

            const colorClass = isProfit
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : isLoss
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-white/[0.02] border-white/5 text-white'

            const ringClass = isToday ? 'ring-1 ring-white/30' : ''

            const content = (
              <div className={`aspect-square rounded-xl border p-2 flex flex-col ${colorClass} ${ringClass} ${hasTrades ? 'hover:border-white/40 transition-colors cursor-pointer' : ''}`}>
                <span className="text-sm font-semibold">{cell.day}</span>
                {hasTrades && (
                  <div className="mt-auto">
                    <div className="text-xs font-semibold">{formatPnl(cell.pnl)}</div>
                    <div className="text-[11px] text-gray-400">{cell.winRate}%</div>
                  </div>
                )}
              </div>
            )

            return hasTrades ? (
              <Link key={cell.date} href={`/journal?date=${cell.date}`}>
                {content}
              </Link>
            ) : (
              <div key={cell.date}>{content}</div>
            )
          })
        )}
      </div>
    </div>
  )
}
