import type { LiqBin, LiqFeed, SymbolId } from "../../coil/types.ts"
import { cached, seriesCacheTtlMs } from "../cache.ts"

type CgMap = {
  code?: string | number
  data?: unknown
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function parseRows(rows: unknown, fallbackPrice: number): LiqBin[] {
  if (!Array.isArray(rows)) return []
  const out: LiqBin[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue
    const price = num(row[0]) ?? fallbackPrice
    const usd = num(row[1])
    if (price === null || usd === null || usd <= 0) continue
    out.push({ price, usd })
  }
  return out
}

export function parseLiqMap(payload: unknown): LiqBin[] {
  if (!payload || typeof payload !== "object") return []
  const root = payload as CgMap
  const inner = root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? (root.data as { data?: unknown }).data ?? root.data
    : root.data
  if (!inner || typeof inner !== "object") return []
  const bins: LiqBin[] = []
  if (Array.isArray(inner)) {
    bins.push(...parseRows(inner, 0))
    return bins
  }
  for (const [key, rows] of Object.entries(inner as Record<string, unknown>)) {
    const keyPx = num(key) ?? 0
    bins.push(...parseRows(rows, keyPx))
  }
  return bins
}

async function loadLiqFeed(symbol: SymbolId): Promise<LiqFeed> {
  const key = process.env.COINGLASS_API_KEY?.trim()
  if (!key) return { status: "no_key", bins: [] }
  try {
    const url =
      `https://open-api-v4.coinglass.com/api/futures/liquidation/map` +
      `?exchange=Binance&symbol=${encodeURIComponent(`${symbol}USDT`)}&range=1d`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4500),
      headers: {
        Accept: "application/json",
        "CG-API-KEY": key,
        "User-Agent": "COIL-1.1",
      },
    })
    if (!res.ok) return { status: "unavailable", bins: [] }
    const json = await res.json() as CgMap
    if (String(json.code ?? "0") !== "0") return { status: "unavailable", bins: [] }
    const bins = parseLiqMap(json)
    return { status: "ok", bins }
  } catch {
    return { status: "unavailable", bins: [] }
  }
}

export async function fetchLiqFeed(symbol: SymbolId): Promise<LiqFeed> {
  return cached(`cg-liq:${symbol}`, () => loadLiqFeed(symbol), seriesCacheTtlMs())
}
