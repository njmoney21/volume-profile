import type { RawFill } from './pairFills'
import { getPointValue } from './contracts'

export interface ParsedFillsCsv {
  fills: RawFill[]
  pointValueByContract: Map<number, number>
  skippedSymbols: string[]
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

// Parses a Tradovate "Fills" report CSV export (Reports -> Fills -> Download CSV).
export function parseFillsCsv(csvText: string): ParsedFillsCsv {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) {
    return { fills: [], pointValueByContract: new Map(), skippedSymbols: [] }
  }

  const header = parseCsvLine(lines[0]).map(h => h.trim())
  const colIndex = (name: string) => header.indexOf(name)

  const iId = colIndex('_id')
  const iContractId = colIndex('_contractId')
  const iTimestamp = colIndex('_timestamp')
  const iTradeDate = colIndex('_tradeDate')
  const iAction = colIndex('_action')
  const iQty = colIndex('_qty')
  const iPrice = colIndex('_price')
  const iContract = colIndex('Contract')

  const fills: RawFill[] = []
  const symbolByContract = new Map<number, string>()

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i])
    const contractId = Number(row[iContractId])

    fills.push({
      id: Number(row[iId]),
      contractId,
      timestamp: row[iTimestamp].trim(),
      tradeDate: row[iTradeDate].trim(),
      action: row[iAction].trim() === '0' ? 'Buy' : 'Sell',
      price: Number(row[iPrice]),
      qty: Number(row[iQty]),
    })

    if (!symbolByContract.has(contractId)) {
      symbolByContract.set(contractId, row[iContract].trim())
    }
  }

  const pointValueByContract = new Map<number, number>()
  const skippedSymbols: string[] = []

  for (const [contractId, symbol] of symbolByContract) {
    const pointValue = getPointValue(symbol)
    if (pointValue === null) {
      skippedSymbols.push(symbol)
    } else {
      pointValueByContract.set(contractId, pointValue)
    }
  }

  return { fills, pointValueByContract, skippedSymbols }
}
