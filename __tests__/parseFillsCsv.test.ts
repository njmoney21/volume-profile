import { describe, it, expect } from 'vitest'
import { parseFillsCsv } from '@/lib/tradovate/parseFillsCsv'

const SAMPLE_CSV = `_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission
536938980008,536938980005,4327110,2026-06-10 12:41:43.083Z,2026-06-10,0,2,28949.75,true,53696616,536938980008,536938980005,06/10/2026 14:41:43,6/10/26,LFE05075316160003, Buy,2,28949.75,-2,0,0.25,MNQM6,MNQ,Micro E-mini NASDAQ-100,1.0
536938980045,536938980042,4327110,2026-06-10 12:43:40.802Z,2026-06-10,1,2,28906.5,true,53696616,536938980045,536938980042,06/10/2026 14:43:40,6/10/26,LFE05075316160003, Sell,2,28906.50,-2,0,0.25,MNQM6,MNQ,Micro E-mini NASDAQ-100,1.0
`

describe('parseFillsCsv', () => {
  it('parses fills into RawFill records', () => {
    const { fills } = parseFillsCsv(SAMPLE_CSV)

    expect(fills).toEqual([
      {
        id: 536938980008,
        contractId: 4327110,
        timestamp: '2026-06-10 12:41:43.083Z',
        tradeDate: '2026-06-10',
        action: 'Buy',
        price: 28949.75,
        qty: 2,
      },
      {
        id: 536938980045,
        contractId: 4327110,
        timestamp: '2026-06-10 12:43:40.802Z',
        tradeDate: '2026-06-10',
        action: 'Sell',
        price: 28906.5,
        qty: 2,
      },
    ])
  })

  it('resolves point values for known contract symbols', () => {
    const { pointValueByContract, skippedSymbols } = parseFillsCsv(SAMPLE_CSV)

    expect(pointValueByContract.get(4327110)).toBe(2) // MNQM6 -> MNQ -> $2/point
    expect(skippedSymbols).toEqual([])
  })

  it('reports unknown contract symbols as skipped', () => {
    const csv = SAMPLE_CSV.replace(/MNQM6,MNQ/g, 'XYZU6,XYZ')
    const { pointValueByContract, skippedSymbols } = parseFillsCsv(csv)

    expect(pointValueByContract.has(4327110)).toBe(false)
    expect(skippedSymbols).toEqual(['XYZU6'])
  })

  it('returns empty result for empty input', () => {
    expect(parseFillsCsv('')).toEqual({
      fills: [],
      pointValueByContract: new Map(),
      skippedSymbols: [],
    })
  })
})
