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
    <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] hover:border-white/20 transition-colors">
      <p className="text-xs text-gray-400 mb-2 tracking-wide uppercase">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

export function StatCards({ totalTrades, winRate, totalPnl, avgWin, avgLoss, avgRR }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card label="Total Trades" value={String(totalTrades)} />
      <Card label="Win Rate" value={`${winRate}%`} />
      <Card label="Total P&L" value={formatPnl(totalPnl)}
        valueClass={totalPnl >= 0 ? 'text-white' : 'text-red-600'} />
      <Card label="Avg Win" value={formatPnl(avgWin)} valueClass="text-white" />
      <Card label="Avg Loss" value={formatPnl(avgLoss)} valueClass="text-red-600" />
      <Card label="Avg R:R" value={avgRR.toFixed(2)} />
    </div>
  )
}
