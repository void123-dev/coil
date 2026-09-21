import type { Bar, Interval, SymbolId, VenuePack } from "../../coil/types.ts"

const BASE: Record<SymbolId, number> = {
  BTC: 64000,
  ETH: 3400,
  SOL: 148,
  XRP: 0.58,
  DOGE: 0.12,
  BNB: 580,
  AVAX: 28,
  LINK: 14,
  SUI: 1.8,
  NEAR: 4.2,
}

export const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1H": 3_600_000,
  "4H": 14_400_000,
}

export function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeDemoPack(
  symbol: SymbolId,
  interval: Interval,
  window: number,
  now = Date.now(),
): VenuePack {
  const intervalMs = INTERVAL_MS[interval]
  const n = Math.max(window, 96) + 8
  const seed = hash32(`${symbol}:${interval}`)
  const bucket = Math.floor(now / intervalMs)
  const base = BASE[symbol]
  const phase = (seed % 360) * (Math.PI / 180)
  const lsTilt = 0.55 + ((seed >>> 5) % 120) / 100
  const fundBias = ((seed % 9) - 4) * 0.00012
  const oiBase = base * (12_000 + (seed % 8000))

  const bars: Bar[] = []
  const fundingHistory: number[] = []
  const oiHistory: number[] = []

  for (let i = 0; i < n; i++) {
    const t = (bucket - (n - 1 - i)) * intervalMs
    const wave = Math.sin(i / 9 + phase) * 0.0045 + Math.cos(i / 17 + phase) * 0.0018
    const drift = ((seed % 80) - 40) / 1e6 * i
    const spot = base * (1 + wave + drift)
    const basis = Math.sin(i / 11 + phase) * 4.2
    const perp = spot * (1 + basis / 10_000)
    const spotVol = base * (80 + 40 * (0.5 + 0.5 * Math.sin(i / 6 + phase)))
    const perpVol = spotVol * (2.4 + 0.6 * Math.sin(i / 8 + phase))
    const spotBuyShare = 0.42 + 0.18 * Math.sin(i / 7 + phase)
    const perpBuyShare = 0.4 + 0.16 * Math.cos(i / 5 + phase)
    const funding = fundBias + Math.sin(i / 13 + phase) * 0.00008
    const oiUsd = oiBase * (1 + 0.08 * Math.sin(i / 10 + phase))
    bars.push({
      t,
      spot,
      perp,
      spotVol,
      perpVol,
      spotTakerBuy: spotVol * spotBuyShare,
      spotTakerSell: spotVol * (1 - spotBuyShare),
      perpTakerBuy: perpVol * perpBuyShare,
      perpTakerSell: perpVol * (1 - perpBuyShare),
      oiUsd,
      funding,
    })
    fundingHistory.push(funding)
    oiHistory.push(oiUsd)
  }

  const last = bars[bars.length - 1]
  return {
    bars,
    funding: last?.funding ?? fundBias,
    fundingHistory,
    oiUsd: last?.oiUsd ?? oiBase,
    oiHistory,
    lsAccount: lsTilt,
    lsTop: Math.max(0.35, lsTilt * (0.85 + ((seed >>> 11) % 40) / 100)),
    source: "demo",
    oiHistory30d: [],
    historyDays: 0,
    oiRising: null,
  }
}
