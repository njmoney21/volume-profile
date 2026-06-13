import type { RawFill } from './pairFills'

const BASE_URL = 'https://demo.tradovateapi.com/v1'

interface AccessTokenResponse {
  accessToken?: string
  errorText?: string
}

export async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: process.env.TRADOVATE_USERNAME,
      password: process.env.TRADOVATE_PASSWORD,
      appId: 'volume-profile-journal',
      appVersion: '1.0',
      cid: Number(process.env.TRADOVATE_CID),
      sec: process.env.TRADOVATE_SECRET,
      deviceId: process.env.TRADOVATE_DEVICE_ID,
    }),
  })

  const data = (await res.json()) as AccessTokenResponse
  if (!res.ok || !data.accessToken) {
    throw new Error(`Tradovate auth failed: ${data.errorText ?? res.statusText}`)
  }
  return data.accessToken
}

// Raw shape of a Tradovate fill record. `tradeDate` may come back as either
// a plain "YYYY-MM-DD" string or a { date: "YYYY-MM-DDT..." } object,
// depending on API version — normalizeFill handles both.
interface TradovateFillResponse {
  id: number
  contractId: number
  timestamp: string
  tradeDate: string | { date: string }
  action: 'Buy' | 'Sell'
  price: number
  qty: number
  accountId?: number
}

function normalizeFill(raw: TradovateFillResponse): RawFill {
  const tradeDateStr = typeof raw.tradeDate === 'string' ? raw.tradeDate : raw.tradeDate.date
  return {
    id: raw.id,
    contractId: raw.contractId,
    timestamp: raw.timestamp,
    tradeDate: tradeDateStr.slice(0, 10),
    action: raw.action,
    price: raw.price,
    qty: raw.qty,
  }
}

export async function getFills(accessToken: string, accountId: number): Promise<RawFill[]> {
  const res = await fetch(`${BASE_URL}/fill/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Tradovate fill/list failed: ${res.status} ${res.statusText}`)

  const data = (await res.json()) as TradovateFillResponse[]
  return data
    .filter(f => f.accountId === undefined || f.accountId === accountId)
    .map(normalizeFill)
}

export async function getContractSymbol(accessToken: string, contractId: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/contract/item?id=${contractId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Tradovate contract/item failed: ${res.status} ${res.statusText}`)

  const data = (await res.json()) as { name: string }
  return data.name
}
