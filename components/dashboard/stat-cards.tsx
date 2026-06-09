import { formatPnl } from '@/lib/utils'

interface StatCardsProps {
  totalTrades: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  avgRR: number
}

function Card({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

export function StatCards({ totalTrades, winRate, totalPnl, avgWin, avgLoss, avgRR }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card label="Total Trades" value={String(totalTrades)} />
      <Card label="Win Rate" value={`${winRate}%`} />
      <Card label="Total P&L" value={formatPnl(totalPnl)}
        valueClass={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
      <Card label="Avg Win" value={formatPnl(avgWin)} valueClass="text-green-400" />
      <Card label="Avg Loss" value={formatPnl(avgLoss)} valueClass="text-red-400" />
      <Card label="Avg R:R" value={avgRR.toFixed(2)} />
    </div>
  )
}
