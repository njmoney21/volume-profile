'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { PnlPoint } from '@/types'
import { formatPnl, formatDate } from '@/lib/utils'

export function PnlChart({ data }: { data: PnlPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-72 flex items-center justify-center text-sm text-gray-500">
        No trades yet — P&L chart will appear here.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-medium text-gray-300 mb-3">Cumulative P&L</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280" fontSize={12} />
          <YAxis tickFormatter={v => formatPnl(v)} stroke="#6b7280" fontSize={12} width={80} />
          <Tooltip
            formatter={(value) => formatPnl(Number(value))}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
