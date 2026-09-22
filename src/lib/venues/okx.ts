import type { Interval, SymbolId, VenuePack } from "../../coil/types.ts"
import { cached, seriesCacheTtlMs } from "../cache.ts"
import { getJson } from "../http.ts"
import { alignBars, nearestFill, num, overlayTakerPct, type Candle } from "./align.ts"
import { fetchBinanceLsPosition } from "./position-ratio.ts"

function parseOkxCandles(data: unknown): Candle[] {
  const list = (data as { data?: string[][] } | null)?.data
  if (!Array.isArray(list)) return []
  const out: Candle[] = []
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 7) continue
    const t = num(row[0])
    const close = num(row[4])
    const vol = num(row[7] ?? row[5])
    if (t === null || close === null || vol === null) continue
    out.push({ t, close, vol, takerBuy: vol * 0.5 })
  }
  return out.sort((a, b) => a.t - b.t)
}

function rubikPeriod(interval: Interval): string {
  if (interval === "1m" || interval === "5m") return "5m"
  if (interval === "15m") return "15m"
  if (interval === "1H") return "1H"
  return "4H"
}

function parseTsValue(data: unknown, valueIndex = 1): Map<number, number> {
  const list = (data as { data?: string[][] } | null)?.data
  const out = new Map<number, number>()
  if (!Array.isArray(list)) return out
  for (const row of list) {
    if (!Array.isArray(row)) continue
    const t = num(row[0])
    const v = num(row[valueIndex])
    if (t === null || v === null) continue
    out.set(t, v)
  }
  return out
}

function parseTakerBuyPct(data: unknown): Map<number, number> {
  const list = (data as { data?: string[][] } | null)?.data
  const out = new Map<number, number>()
  if (!Array.isArray(list)) return out
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 3) continue
    const t = num(row[0])
    const sell = num(row[1])
    const buy = num(row[2])
    if (t === null || sell === null || buy === null) continue
    const tot = buy + sell
    if (tot <= 0) continue
    out.set(t, buy / tot)
  }
  return out
}

function spanDays(times: number[]): number | null {
  if (times.length < 2) return times.length ? 0 : null
  const min = Math.min(...times)
  const max = Math.max(...times)
  return (max - min) / 86_400_000
}

async function fetchOkxLookback(swapId: string): Promise<{
  oiHistory30d: number[]
  historyDays: number | null
  oiRising: boolean | null
}> {
  return cached(`okx-lookback:${swapId}`, async () => {
    const [daily, hourly] = await Promise.all([
      getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${swapId}&period=1D&limit=100`),
      getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${swapId}&period=1H&limit=8`),
    ])
    const dailyMap = parseTsValue(daily, 3)
    const hourlyMap = parseTsValue(hourly, 3)
    const dailySorted = [...dailyMap.entries()].sort((a, b) => a[0] - b[0])
    const hourlySorted = [...hourlyMap.entries()].sort((a, b) => a[0] - b[0])
    const oiHistory30d = dailySorted.map(([, v]) => v)
    const historyDays = spanDays(dailySorted.map(([t]) => t))
    const last = hourlySorted.at(-1)?.[1]
    const prev = hourlySorted.at(-2)?.[1]
    const oiRising = last !== undefined && prev !== undefined ? last > prev : (
      oiHistory30d.length >= 2 ? oiHistory30d[oiHistory30d.length - 1]! > oiHistory30d[oiHistory30d.length - 2]! : null
    )
    return { oiHistory30d, historyDays, oiRising }
  }, seriesCacheTtlMs())
}

export async function fetchOkxPack(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<VenuePack | null> {
  const spotId = `${symbol}-USDT`
  const swapId = `${symbol}-USDT-SWAP`
  const bar = interval
  const limit = Math.min(100, Math.max(window, 96))

  const [spot, perp, ticker, funding, fundHist, oi] = await Promise.all([
    getJson(`https://www.okx.com/api/v5/market/candles?instId=${spotId}&bar=${bar}&limit=${limit}`),
    getJson(`https://www.okx.com/api/v5/market/candles?instId=${swapId}&bar=${bar}&limit=${limit}`),
    getJson<{ data?: Array<{ last?: string; markPx?: string }> }>(
      `https://www.okx.com/api/v5/market/ticker?instId=${swapId}`,
    ),
    getJson<{ data?: Array<{ fundingRate?: string }> }>(
      `https://www.okx.com/api/v5/public/funding-rate?instId=${swapId}`,
    ),
    getJson<{ data?: Array<{ fundingRate?: string; fundingTime?: string }> }>(
      `https://www.okx.com/api/v5/public/funding-rate-history?instId=${swapId}&limit=100`,
    ),
    getJson<{ data?: Array<{ oi?: string; oiCcy?: string; ts?: string }> }>(
      `https://www.okx.com/api/v5/public/open-interest?instId=${swapId}`,
    ),
  ])

  const spotBars = parseOkxCandles(spot)
  const perpBars = parseOkxCandles(perp)
  if (!spotBars.length || !perpBars.length) return null

  const currentFunding = num(funding?.data?.[0]?.fundingRate)
  const fundingHistory: number[] = []
  const fundingByT = new Map<number, number>()
  for (const row of fundHist?.data ?? []) {
    const f = num(row.fundingRate)
    const t = num(row.fundingTime)
    if (f === null) continue
    fundingHistory.push(f)
    if (t !== null) fundingByT.set(t, f)
  }
  if (currentFunding !== null) fundingHistory.push(currentFunding)

  const period = rubikPeriod(interval)
  const [oiHist, lsAcc, lsTop, takerPerp, takerSpot, lookback, lsPosition] = await Promise.all([
    getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${swapId}&period=${period}&limit=100`),
    getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${swapId}&period=${period}`),
    getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${swapId}&period=${period}`),
    getJson(`https://www.okx.com/api/v5/rubik/stat/taker-volume-contract?instId=${swapId}&period=${period}`),
    getJson(`https://www.okx.com/api/v5/rubik/stat/taker-volume?ccy=${symbol}&instType=SPOT&period=${period}`),
    fetchOkxLookback(swapId),
    fetchBinanceLsPosition(symbol),
  ])

  const mark = num(ticker?.data?.[0]?.markPx) ?? perpBars[perpBars.length - 1]?.close ?? 0
  const oiUsdSpot = num(oi?.data?.[0]?.oiCcy) ?? (() => {
    const contracts = num(oi?.data?.[0]?.oi)
    return contracts !== null && mark > 0 ? contracts * mark : null
  })()

  const oiByTRaw = parseTsValue(oiHist, 3)
  if (!oiByTRaw.size) {
    const oiTs = num(oi?.data?.[0]?.ts)
    if (oiUsdSpot !== null && oiTs !== null) oiByTRaw.set(oiTs, oiUsdSpot)
  }
  const oiHistory = [...oiByTRaw.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  if (oiUsdSpot !== null && !oiHistory.length) oiHistory.push(oiUsdSpot)

  const lsAccMap = parseTsValue(lsAcc, 1)
  const lsTopMap = parseTsValue(lsTop, 1)
  const lsAccLatest = [...lsAccMap.entries()].sort((a, b) => a[0] - b[0]).at(-1)?.[1] ?? null
  const lsTopLatest = [...lsTopMap.entries()].sort((a, b) => a[0] - b[0]).at(-1)?.[1] ?? null

  const times = perpBars.map((b) => b.t)
  let bars = alignBars(interval, spotBars, perpBars, nearestFill(fundingByT, times), nearestFill(oiByTRaw, times))
  bars = overlayTakerPct(bars, parseTakerBuyPct(takerSpot), parseTakerBuyPct(takerPerp))
  if (bars.length < 8) return null

  const lastOi = bars[bars.length - 1]?.oiUsd
  const oiUsd = lastOi && lastOi > 0 ? lastOi : oiUsdSpot

  const fundingTimes = [...fundingByT.keys()]
  const fundDays = spanDays(fundingTimes)
  const historyDays = Math.max(lookback.historyDays ?? 0, fundDays ?? 0) || lookback.historyDays

  return {
    bars,
    funding: currentFunding,
    fundingHistory,
    oiUsd,
    oiHistory,
    lsAccount: lsAccLatest,
    lsTop: lsTopLatest,
    lsPosition,
    source: "live",
    oiHistory30d: lookback.oiHistory30d,
    historyDays,
    oiRising: lookback.oiRising,
  }
}
