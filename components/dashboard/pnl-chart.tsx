'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { PnlPoint } from '@/types'
import { formatPnl, formatDate } from '@/lib/utils'

export function PnlChart({ data }: { data: PnlPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-5 h-72 flex items-center justify-center text-sm text-gray-500 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
        No trades yet — P&L chart will appear here.
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <h2 className="text-sm font-medium text-gray-300 mb-4">Cumulative P&L</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={v => formatPnl(v)} stroke="#6b7280" fontSize={12} width={84} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => formatPnl(Number(value))}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{ background: '#0a0a0a', border: '1px solid #ffffff1a', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
          />
          <Line type="monotone" dataKey="cumulative" stroke="#ffffff" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#ffffff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
