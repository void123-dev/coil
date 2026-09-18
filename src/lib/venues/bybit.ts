import type { Interval, SymbolId, VenuePack } from "../../coil/types.ts"
import { getJson } from "../http.ts"
import { alignBars, nearestFill, num, type Candle } from "./align.ts"

function bybitInterval(interval: Interval): string {
  if (interval === "1m") return "1"
  if (interval === "5m") return "5"
  if (interval === "15m") return "15"
  if (interval === "1H") return "60"
  return "240"
}

function oiPeriod(interval: Interval): string {
  if (interval === "1m" || interval === "5m") return "5min"
  if (interval === "15m") return "15min"
  if (interval === "1H") return "1h"
  return "4h"
}

function parseBybitKlines(data: unknown): Candle[] {
  const list = (data as { result?: { list?: string[][] } } | null)?.result?.list
  if (!Array.isArray(list)) return []
  const out: Candle[] = []
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 6) continue
    const t = num(row[0])
    const close = num(row[4])
    const vol = num(row[6] ?? row[5])
    if (t === null || close === null || vol === null) continue
    out.push({ t, close, vol, takerBuy: vol * 0.5 })
  }
  return out.sort((a, b) => a.t - b.t)
}

export async function fetchBybitPack(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<VenuePack | null> {
  const pair = `${symbol}USDT`
  const iv = bybitInterval(interval)
  const limit = Math.min(200, Math.max(window, 96) + 8)

  const [spot, perp, ticker, funding, oi] = await Promise.all([
    getJson(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${pair}&interval=${iv}&limit=${limit}`),
    getJson(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${pair}&interval=${iv}&limit=${limit}`),
    getJson<{ result?: { list?: Array<{ fundingRate?: string; markPrice?: string; openInterest?: string; openInterestValue?: string }> } }>(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair}`,
    ),
    getJson<{ result?: { list?: Array<{ fundingRate?: string; fundingRateTimestamp?: string }> } }>(
      `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${pair}&limit=50`,
    ),
    getJson<{ result?: { list?: Array<{ openInterest?: string; timestamp?: string }> } }>(
      `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${pair}&intervalTime=${oiPeriod(interval)}&limit=${Math.min(limit, 200)}`,
    ),
  ])

  const spotBars = parseBybitKlines(spot)
  const perpBars = parseBybitKlines(perp)
  if (!spotBars.length || !perpBars.length) return null

  const tick = ticker?.result?.list?.[0]
  const currentFunding = num(tick?.fundingRate)
  const fundingHistory: number[] = []
  const fundingByT = new Map<number, number>()
  for (const row of funding?.result?.list ?? []) {
    const f = num(row.fundingRate)
    const t = num(row.fundingRateTimestamp)
    if (f === null) continue
    fundingHistory.push(f)
    if (t !== null) fundingByT.set(t, f)
  }
  if (currentFunding !== null) fundingHistory.push(currentFunding)

  const oiHistory: number[] = []
  const oiByTRaw = new Map<number, number>()
  const mark = num(tick?.markPrice) ?? perpBars[perpBars.length - 1]?.close ?? 0
  for (const row of oi?.result?.list ?? []) {
    const contracts = num(row.openInterest)
    const t = num(row.timestamp)
    if (contracts === null) continue
    const usd = contracts * (mark || 1)
    oiHistory.push(usd)
    if (t !== null) oiByTRaw.set(t, usd)
  }

  const times = perpBars.map((b) => b.t)
  const bars = alignBars(interval, spotBars, perpBars, nearestFill(fundingByT, times), nearestFill(oiByTRaw, times))
  if (bars.length < 8) return null

  const oiUsd = num(tick?.openInterestValue) ?? (oiHistory.length ? oiHistory[oiHistory.length - 1]! : null)

  return {
    bars,
    funding: currentFunding,
    fundingHistory,
    oiUsd,
    oiHistory,
    lsAccount: null,
    lsTop: null,
    source: "live",
  }
}
