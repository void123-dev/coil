import type { GravityHint, Interval, SymbolId } from "../coil/types.ts"
import { cached } from "./cache.ts"

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined
}

function pickSnap(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  const root = data as Record<string, unknown>
  if (root.snapshot && typeof root.snapshot === "object") {
    return root.snapshot as Record<string, unknown>
  }
  return root
}

async function loadGravity(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<GravityHint> {
  const base = process.env.GRAVITY_API_BASE?.replace(/\/$/, "")
  if (!base) return { available: false }
  try {
    const url =
      `${base}/api/export?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${encodeURIComponent(interval)}&window=${window}&venue=binance&format=json`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json", "User-Agent": "COIL-1.0" },
    })
    if (!res.ok) return { available: false }
    const snap = pickSnap(await res.json())
    if (!snap) return { available: false }
    const g =
      num(snap.g) ??
      num(snap.G) ??
      num((snap.components as { g?: unknown } | undefined)?.g)
    return {
      available: true,
      source: str(snap.source),
      g,
      coupling: str(snap.coupling),
      spotShare: num(snap.spotShare) ?? num(snap.spot_share),
      perpShare: num(snap.perpShare) ?? num(snap.perp_share),
      confidence: num(snap.confidence),
    }
  } catch {
    return { available: false }
  }
}

export async function fetchGravityHint(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<GravityHint> {
  return cached(`gravity:${symbol}:${interval}:${window}`, () =>
    loadGravity(symbol, interval, window),
  )
}
