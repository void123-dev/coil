export function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

export function fmtBps(n: number): string {
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(1)} bps`
}

export function fmtPct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—"
  return `${(n * 100).toFixed(digits)}%`
}

export function fmtFunding(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—"
  const pct = n * 100
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(4)}%`
}

export function fmtZ(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}σ`
}

export function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms))
}

export function fmtPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 })
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 3 })
  return n.toLocaleString("en-US", { maximumFractionDigits: 5 })
}
