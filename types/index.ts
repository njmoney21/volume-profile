export type Direction = 'long' | 'short'
export type LevelType = 'POC' | 'VAH' | 'VAL'
export type Scenario = 'retest_continue' | 'break_retest_reverse'
export type TradeSource = 'auto' | 'manual'
export type TradeResult = 'win' | 'loss' | 'breakeven'
export type TradeStatus = 'draft' | 'reviewed'

export interface Trade {
  id: string
  date: string           // "2026-06-09"
  time_entered: string   // "HH:MM:SS"
  direction: Direction
  position_size: number
  level_type: LevelType | null
  level_price: number | null
  prev_day_poc: number | null
  prev_day_vah: number | null
  prev_day_val: number | null
  scenario: Scenario | null
  result: TradeResult
  pnl: number
  notes: string | null
  source: TradeSource
  status: TradeStatus
  created_at: string
}

export interface TradeFormData {
  date: string
  time_entered: string
  direction: Direction
  position_size: number
  level_type?: LevelType | null
  level_price?: number | null
  prev_day_poc?: number | null
  prev_day_vah?: number | null
  prev_day_val?: number | null
  scenario?: Scenario | null
  result: TradeResult
  pnl: number
  notes?: string
  source?: TradeSource
}

export interface TradeFilters {
  date?: string
  direction?: Direction
  level_type?: LevelType
  scenario?: Scenario
  result?: TradeResult
  status?: TradeStatus
}

export interface BacktestSession {
  id: string
  created_at: string
  date_from: string
  date_to: string
  notes: string | null
}

export interface BacktestDay {
  id: string
  session_id: string
  date: string
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
  day_pnl: number
}

export interface BacktestTrade {
  id: string
  session_id: string
  day_id: string
  date: string
  time_entered: string
  direction: Direction
  entry_price: number
  exit_price: number
  contracts: number
  level_type: LevelType
  level_price: number
  scenario: Scenario
  pnl: number
  notes: string | null
}

export interface BreakdownRow {
  label: string
  count: number
  winRate: number
  pnl: number
}

export interface PnlPoint {
  date: string
  cumulative: number
}

export interface BacktestSessionFormData {
  date_from: string
  date_to: string
  notes?: string
}

export interface BacktestDayFormData {
  date: string
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
}

export interface BacktestTradeFormData {
  time_entered: string
  direction: Direction
  entry_price: number
  exit_price: number
  contracts: number
  level_type: LevelType
  level_price: number
  scenario: Scenario
  notes?: string
}

export type ConceptCategory = 'Setups' | 'Risk Management' | 'Psychology' | 'Market Structure' | 'General'

export interface Concept {
  id: string
  title: string
  category: ConceptCategory
  body: string
  created_at: string
  updated_at: string
}

export interface ConceptFormData {
  title: string
  category: ConceptCategory
  body: string
}
