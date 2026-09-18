import type { Interval, SymbolId, VenuePack } from "../../coil/types.ts"
import { getJson } from "../http.ts"
import { alignBars, nearestFill, num, type Candle } from "./align.ts"

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
      `https://www.okx.com/api/v5/public/funding-rate-history?instId=${swapId}&limit=50`,
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

  const mark = num(ticker?.data?.[0]?.markPx) ?? perpBars[perpBars.length - 1]?.close ?? 0
  const oiUsd = num(oi?.data?.[0]?.oiCcy) ?? (() => {
    const contracts = num(oi?.data?.[0]?.oi)
    return contracts !== null && mark > 0 ? contracts * mark : null
  })()
  const oiByTRaw = new Map<number, number>()
  const oiTs = num(oi?.data?.[0]?.ts)
  if (oiUsd !== null && oiTs !== null) oiByTRaw.set(oiTs, oiUsd)
  const oiHistory = oiUsd !== null ? [oiUsd] : []

  const times = perpBars.map((b) => b.t)
  const bars = alignBars(interval, spotBars, perpBars, nearestFill(fundingByT, times), nearestFill(oiByTRaw, times))
  if (bars.length < 8) return null

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
