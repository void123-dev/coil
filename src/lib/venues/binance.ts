import type { Interval, SymbolId, VenuePack } from "../../coil/types.ts"
import { getJson } from "../http.ts"
import { alignBars, nearestFill, num, type Candle } from "./align.ts"
import { fetchBinanceLsPosition } from "./position-ratio.ts"

function binanceInterval(interval: Interval): string {
  if (interval === "1H") return "1h"
  if (interval === "4H") return "4h"
  return interval
}

function klineLimit(window: number): number {
  return Math.min(500, Math.max(window, 96) + 16)
}

function parseKlines(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) return []
  const out: Candle[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 11) continue
    const t = num(row[0])
    const close = num(row[4])
    const vol = num(row[7])
    const takerBuy = num(row[10])
    if (t === null || close === null || vol === null || takerBuy === null) continue
    out.push({ t, close, vol, takerBuy })
  }
  return out
}

export async function fetchBinancePack(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<VenuePack | null> {
  const pair = `${symbol}USDT`
  const iv = binanceInterval(interval)
  const limit = klineLimit(window)
  const period = iv

  const [spot, perp, premium, fundingHist, oiNow, oiHist, lsAcc, lsTop, lsPosition] = await Promise.all([
    getJson<unknown[]>(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${iv}&limit=${limit}`),
    getJson<unknown[]>(`https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${iv}&limit=${limit}`),
    getJson<{ lastFundingRate?: string; markPrice?: string }>(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`,
    ),
    getJson<Array<{ fundingRate?: string; fundingTime?: number }>>(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${pair}&limit=100`,
    ),
    getJson<{ openInterest?: string }>(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`),
    getJson<Array<{ sumOpenInterestValue?: string; timestamp?: number }>>(
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${pair}&period=${period}&limit=${Math.min(limit, 500)}`,
    ),
    getJson<Array<{ longShortRatio?: string }>>(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${pair}&period=${period}&limit=1`,
    ),
    getJson<Array<{ longShortRatio?: string }>>(
      `https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${pair}&period=${period}&limit=1`,
    ),
    fetchBinanceLsPosition(symbol),
  ])

  const spotBars = parseKlines(spot)
  const perpBars = parseKlines(perp)
  if (!spotBars.length || !perpBars.length) return null

  const fundingByT = new Map<number, number>()
  const fundingHistory: number[] = []
  if (Array.isArray(fundingHist)) {
    for (const row of fundingHist) {
      const f = num(row.fundingRate)
      const t = num(row.fundingTime)
      if (f === null) continue
      fundingHistory.push(f)
      if (t !== null) fundingByT.set(t, f)
    }
  }
  const currentFunding = num(premium?.lastFundingRate)
  if (currentFunding !== null) fundingHistory.push(currentFunding)

  const oiByTRaw = new Map<number, number>()
  const oiHistory: number[] = []
  if (Array.isArray(oiHist)) {
    for (const row of oiHist) {
      const v = num(row.sumOpenInterestValue)
      const t = num(row.timestamp)
      if (v === null) continue
      oiHistory.push(v)
      if (t !== null) oiByTRaw.set(t, v)
    }
  }

  const times = perpBars.map((b) => b.t)
  const oiByT = nearestFill(oiByTRaw, times)
  const fundAligned = nearestFill(fundingByT, times)
  if (currentFunding !== null) {
    const lastT = times[times.length - 1]
    if (lastT !== undefined) fundAligned.set(lastT, currentFunding)
  }

  const bars = alignBars(interval, spotBars, perpBars, fundAligned, oiByT)
  if (bars.length < 8) return null

  const last = bars[bars.length - 1]
  const mark = num(premium?.markPrice) ?? last?.perp ?? 0
  const oiContracts = num(oiNow?.openInterest)
  const oiUsd =
    oiHistory.length ? (oiHistory[oiHistory.length - 1] ?? null)
    : oiContracts !== null && mark > 0 ? oiContracts * mark
    : last?.oiUsd ?? null

  return {
    bars,
    funding: currentFunding,
    fundingHistory,
    oiUsd,
    oiHistory,
    lsAccount: num(lsAcc?.[0]?.longShortRatio),
    lsTop: num(lsTop?.[0]?.longShortRatio),
    lsPosition,
    source: "live",
  }
}
