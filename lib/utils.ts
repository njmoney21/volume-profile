import type { Direction } from '@/types'

export function calculatePnl(
  direction: Direction,
  entryPrice: number,
  exitPrice: number,
  contracts: number
): number {
  const points = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  return Math.round(points * contracts * 20 * 100) / 100
}

export function formatPnl(pnl: number): string {
  const abs = Math.abs(pnl).toFixed(2)
  if (pnl > 0) return `+$${abs}`
  if (pnl < 0) return `-$${abs}`
  return `$${abs}`
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
