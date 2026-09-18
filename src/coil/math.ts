export function clamp(n: number, a = 0, b = 1) { return Math.min(b, Math.max(a, n)) }
export function mean(xs: number[]) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0 }
export function stdev(xs: number[]) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
export function zScore(x: number, xs: number[]) {
  const s = stdev(xs)
  return s === 0 ? 0 : (x - mean(xs)) / s
}
export function percentileRank(x: number, xs: number[]) {
  if (!xs.length) return null
  const below = xs.filter((v) => v <= x).length
  return below / xs.length
}
export function takerBuyPct(buy: number, sell: number) {
  const t = buy + sell
  return t <= 0 ? null : buy / t
}
export function basisBps(spot: number, perp: number) {
  return spot <= 0 ? 0 : ((perp / spot) - 1) * 10_000
}
