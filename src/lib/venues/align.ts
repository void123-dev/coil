import type { Bar, Interval } from "../../coil/types.ts"
import { INTERVAL_MS } from "./demo.ts"

export type Candle = {
  t: number
  close: number
  vol: number
  takerBuy: number
}

export function bucketT(t: number, interval: Interval): number {
  const ms = INTERVAL_MS[interval]
  return Math.floor(t / ms) * ms
}

export function alignBars(
  interval: Interval,
  spot: Candle[],
  perp: Candle[],
  fundingByT: Map<number, number>,
  oiByT: Map<number, number>,
): Bar[] {
  const spotMap = new Map<number, Candle>()
  for (const c of spot) spotMap.set(bucketT(c.t, interval), c)
  const bars: Bar[] = []
  for (const p of perp) {
    const t = bucketT(p.t, interval)
    const s = spotMap.get(t)
    if (!s) continue
    const spotSell = Math.max(0, s.vol - s.takerBuy)
    const perpSell = Math.max(0, p.vol - p.takerBuy)
    bars.push({
      t,
      spot: s.close,
      perp: p.close,
      spotVol: s.vol,
      perpVol: p.vol,
      spotTakerBuy: s.takerBuy,
      spotTakerSell: spotSell,
      perpTakerBuy: p.takerBuy,
      perpTakerSell: perpSell,
      oiUsd: oiByT.get(t) ?? 0,
      funding: fundingByT.get(t) ?? 0,
    })
  }
  return bars.sort((a, b) => a.t - b.t)
}

export function nearestFill(series: Map<number, number>, times: number[]): Map<number, number> {
  if (!series.size) return new Map()
  const keys = [...series.keys()].sort((a, b) => a - b)
  const out = new Map<number, number>()
  let i = 0
  for (const t of times) {
    while (i + 1 < keys.length && Math.abs(keys[i + 1]! - t) <= Math.abs(keys[i]! - t)) i += 1
    const k = keys[i]
    if (k !== undefined) out.set(t, series.get(k) ?? 0)
  }
  return out
}

export function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

export function overlayTakerPct(
  bars: Bar[],
  spotPctByT: Map<number, number>,
  perpPctByT: Map<number, number>,
): Bar[] {
  if (!spotPctByT.size && !perpPctByT.size) return bars
  const times = bars.map((b) => b.t)
  const spotPct = nearestFill(spotPctByT, times)
  const perpPct = nearestFill(perpPctByT, times)
  return bars.map((bar) => {
    const s = spotPct.get(bar.t)
    const p = perpPct.get(bar.t)
    const next = { ...bar }
    if (s !== undefined && s >= 0 && s <= 1) {
      next.spotTakerBuy = bar.spotVol * s
      next.spotTakerSell = bar.spotVol * (1 - s)
    }
    if (p !== undefined && p >= 0 && p <= 1) {
      next.perpTakerBuy = bar.perpVol * p
      next.perpTakerSell = bar.perpVol * (1 - p)
    }
    return next
  })
}
