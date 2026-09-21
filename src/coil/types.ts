export const SYMBOLS = ["BTC","ETH","SOL","XRP","DOGE","BNB","AVAX","LINK","SUI","NEAR"] as const
export const INTERVALS = ["1m","5m","15m","1H","4H"] as const
export const WINDOWS = [24, 48, 96] as const
export const VENUES = ["okx","bybit","binance","all"] as const
export const WEIGHTS = { crowd: 0.30, fuel: 0.25, spotLead: 0.20, thinSession: 0.15, mmFlow: 0.10 } as const

export type SymbolId = (typeof SYMBOLS)[number]
export type Interval = (typeof INTERVALS)[number]
export type Venue = (typeof VENUES)[number]
export type SessionLabel =
  | "asia_open" | "asia" | "london_open" | "london"
  | "ny_open" | "ny" | "ny_close" | "weekend"
export type CrowdSide = "short" | "long" | "mixed"
export type Regime = "quiet" | "squeeze_watch" | "squeeze_armed"
export type Source = "demo" | "live"
export type SqueezeSide = "short" | "long" | "none"

export type SqueezeRead = {
  side: SqueezeSide
  watch: boolean
  armed: boolean
  fundingPct: number | null
  lsAccount: number | null
  lsTop: number | null
  oiZ: number | null
  oiRising: boolean | null
  covering: boolean
  historyDays: number | null
}

export type Bar = {
  t: number
  spot: number
  perp: number
  spotVol: number
  perpVol: number
  spotTakerBuy: number
  spotTakerSell: number
  perpTakerBuy: number
  perpTakerSell: number
  oiUsd: number
  funding: number
}

export type VenuePack = {
  bars: Bar[]
  funding: number | null
  fundingHistory: number[]
  oiUsd: number | null
  oiHistory: number[]
  lsAccount: number | null // longs/shorts, 1 = balanced, >1 more longs
  lsTop: number | null
  source: "live" | "demo"
  oiHistory30d?: number[]
  historyDays?: number | null
  oiRising?: boolean | null
}

export type GravityHint = {
  available: boolean
  source?: string
  g?: number
  coupling?: string
  spotShare?: number
  perpShare?: number
  confidence?: number
}

export type MmEvent = {
  t: number
  entity: string
  asset: string
  side: "cex_deposit" | "cex_withdrawal" | "dex_buy" | "dex_sell" | "perp_open" | "unknown"
  usd: number
  source: "demo" | "manual" | "arkham" | "lens" | "custom"
}

export type CoilComponents = {
  crowd: number
  fuel: number
  spotLead: number
  thinSession: number
  mmFlow: number
}

export type CoilSnapshot = {
  model: "COIL-1.1"
  symbol: SymbolId
  interval: Interval
  window: number
  venue: Venue
  source: Source
  asOf: number
  session: { label: SessionLabel; etHour: number; thin: boolean }
  score: number
  bias: number
  regime: Regime
  crowdSide: CrowdSide
  confidence: number
  headline: string
  headlineRu: string
  components: CoilComponents
  weights: typeof WEIGHTS
  spot: number
  perp: number
  basisBps: number
  funding: number | null
  fundingPercentile: number | null
  oiUsd: number | null
  oiZ: number | null
  lsAccount: number | null
  lsTop: number | null
  spotTakerBuyPct: number | null
  perpTakerBuyPct: number | null
  spotVol: number
  perpVol: number
  spotVolRel: number
  perpVolRel: number
  spotLeadsAgainstCrowd: boolean
  thinTape: boolean
  squeeze: SqueezeRead
  mmFlow: { status: "disabled" | "demo" | "live" | "empty"; events: MmEvent[] }
  gravity: GravityHint
  series: Array<{
    t: number; spot: number; perp: number; basisBps: number
    funding: number; oiUsd: number; score: number; bias: number
    crowd: number; fuel: number; spotLead: number; thinSession: number
  }>
  pits?: Record<string, { score: number; bias: number; source: Source }>
  consensus?: "agree_up_squeeze" | "agree_down_squeeze" | "split" | "quiet"
}

export type DeskCard = {
  score: number | null
  regime: Regime | null
  crowdSide: CrowdSide | null
  bias: number | null
  spotLeadsAgainstCrowd: boolean | null
  thinTape: boolean | null
  session: string | null
  source: Source | null
  venue: string | null
  symbol: string | null
  interval: string | null
  squeezeSide: SqueezeSide | null
  squeezeWatch: boolean | null
  squeezeArmed: boolean | null
  fundingPct: number | null
  oiZ: number | null
}
