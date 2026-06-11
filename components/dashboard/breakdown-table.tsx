import type { BreakdownRow } from '@/types'
import { formatPnl } from '@/lib/utils'

export function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <h2 className="text-sm font-medium text-gray-300 mb-4">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-left text-xs">
            <th className="pb-2 font-medium">Segment</th>
            <th className="pb-2 font-medium text-right">Trades</th>
            <th className="pb-2 font-medium text-right">Win Rate</th>
            <th className="pb-2 font-medium text-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
              <td className="py-2.5 text-gray-300">{row.label}</td>
              <td className="py-2.5 text-right text-gray-400">{row.count}</td>
              <td className="py-2.5 text-right text-gray-400">{row.count > 0 ? `${row.winRate}%` : '—'}</td>
              <td className={`py-2.5 text-right font-mono ${
                row.pnl > 0 ? 'text-white' : row.pnl < 0 ? 'text-red-600' : 'text-gray-400'
              }`}>
                {row.count > 0 ? formatPnl(row.pnl) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
