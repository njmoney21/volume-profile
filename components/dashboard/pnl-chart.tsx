'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { PnlPoint } from '@/types'
import { formatPnl, formatDate } from '@/lib/utils'

export function PnlChart({ data }: { data: PnlPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-black border border-white/10 rounded-xl p-4 h-72 flex items-center justify-center text-sm text-gray-500">
        No trades yet — P&L chart will appear here.
      </div>
    )
  }

  return (
    <div className="bg-black border border-white/10 rounded-xl p-4">
      <h2 className="text-sm font-medium text-gray-300 mb-3">Cumulative P&L</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9ca3af" fontSize={12} />
          <YAxis tickFormatter={v => formatPnl(v)} stroke="#9ca3af" fontSize={12} width={80} />
          <Tooltip
            formatter={(value) => formatPnl(Number(value))}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{ background: '#000000', border: '1px solid #ffffff1a', borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="cumulative" stroke="#ffffff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
