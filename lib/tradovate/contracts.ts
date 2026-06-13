// $/point by contract symbol prefix. More specific prefixes (e.g. "MNQ")
// must come before the prefixes they're contained in (e.g. "NQ").
const POINT_VALUES: { prefix: string; value: number }[] = [
  { prefix: 'MNQ', value: 2 },
  { prefix: 'NQ', value: 20 },
]

export function getPointValue(symbol: string): number | null {
  for (const { prefix, value } of POINT_VALUES) {
    if (symbol.startsWith(prefix)) return value
  }
  return null
}
