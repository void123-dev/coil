import type { LiqBin, LiqFeed, LiqRead, SqueezeSide } from "./types.ts"

const BAND = 0.015
const LARGE_P = 0.6

export function emptyLiq(partial: Partial<LiqRead> = {}): LiqRead {
  return {
    available: false,
    source: "none",
    range: "24h",
    price: 0,
    shortAboveUsd: null,
    longBelowUsd: null,
    nearestShortPct: null,
    nearestLongPct: null,
    magnet: "none",
    magnetUsd: null,
    againstCrowd: false,
    reason: null,
    ...partial,
  }
}

function pctile(xs: number[], p: number): number {
  if (!xs.length) return Number.POSITIVE_INFINITY
  const s = [...xs].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))
  return s[idx]!
}

function largest(bins: LiqBin[]): LiqBin | null {
  let best: LiqBin | null = null
  for (const b of bins) {
    if (!best || b.usd > best.usd) best = b
  }
  return best
}

export function magnetFromBins(bins: LiqBin[], price: number): Pick<
  LiqRead,
  "shortAboveUsd" | "longBelowUsd" | "nearestShortPct" | "nearestLongPct" | "magnet" | "magnetUsd"
> {
  if (!price || price <= 0 || !bins.length) {
    return {
      shortAboveUsd: 0,
      longBelowUsd: 0,
      nearestShortPct: null,
      nearestLongPct: null,
      magnet: "none",
      magnetUsd: null,
    }
  }
  const shorts = bins.filter((b) => b.price > price && b.usd > 0)
  const longs = bins.filter((b) => b.price < price && b.usd > 0)
  const shortAboveUsd = shorts.filter((b) => b.price <= price * (1 + BAND)).reduce((s, b) => s + b.usd, 0)
  const longBelowUsd = longs.filter((b) => b.price >= price * (1 - BAND)).reduce((s, b) => s + b.usd, 0)
  const largeShort = shortAboveUsd > 0 && shortAboveUsd >= pctile(shorts.map((b) => b.usd), LARGE_P)
  const largeLong = longBelowUsd > 0 && longBelowUsd >= pctile(longs.map((b) => b.usd), LARGE_P)

  let magnet: LiqRead["magnet"] = "none"
  if (largeShort && shortAboveUsd >= 2 * longBelowUsd) magnet = "short_above"
  else if (largeLong && longBelowUsd >= 2 * shortAboveUsd) magnet = "long_below"
  else if (largeShort && largeLong) magnet = "both"

  const topShort = largest(shorts)
  const topLong = largest(longs)
  return {
    shortAboveUsd,
    longBelowUsd,
    nearestShortPct: topShort ? (topShort.price / price - 1) * 100 : null,
    nearestLongPct: topLong ? (topLong.price / price - 1) * 100 : null,
    magnet,
    magnetUsd: magnet === "short_above" ? shortAboveUsd : magnet === "long_below" ? longBelowUsd : magnet === "both" ? Math.max(shortAboveUsd, longBelowUsd) : null,
  }
}

export function readLiq(feed: LiqFeed | null | undefined, price: number, squeezeSide: SqueezeSide): LiqRead {
  if (!feed || feed.status === "no_key") {
    return emptyLiq({ price, reason: "no_key" })
  }
  if (feed.status !== "ok") {
    return emptyLiq({ price, reason: "unavailable" })
  }
  const mag = magnetFromBins(feed.bins, price)
  const againstCrowd =
    (squeezeSide === "short" && mag.magnet === "long_below") ||
    (squeezeSide === "long" && mag.magnet === "short_above")
  return {
    available: true,
    source: "coinglass",
    range: "24h",
    price,
    ...mag,
    againstCrowd,
    reason: null,
  }
}

export function liqHeadlineSuffix(liq: LiqRead, side: SqueezeSide): { en: string; ru: string } | null {
  if (!liq.available) return null
  if (side === "short" && (liq.magnet === "short_above" || liq.magnet === "both")) {
    return { en: " · liq magnet above", ru: " · магнит ликвидаций выше" }
  }
  if (side === "long" && (liq.magnet === "long_below" || liq.magnet === "both")) {
    return { en: " · liq magnet below", ru: " · магнит ликвидаций ниже" }
  }
  return null
}
