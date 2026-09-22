import type { SymbolId } from "../../coil/types.ts"
import { cached, seriesCacheTtlMs } from "../cache.ts"
import { getJson } from "../http.ts"
import { num } from "./align.ts"

function positionUrls(symbol: SymbolId): string[] {
  const q = `symbol=${symbol}USDT&period=5m&limit=1`
  return [
    `https://fapi.binance.com/futures/data/topLongShortPositionRatio?${q}`,
    `https://www.binance.com/futures/data/topLongShortPositionRatio?${q}`,
  ]
}

/** Binance top-trader position ratio: whale notional, not account headcount. */
export async function fetchBinanceLsPosition(symbol: SymbolId): Promise<number | null> {
  return cached(`binance-ls-pos:${symbol}`, async () => {
    for (const url of positionUrls(symbol)) {
      const rows = await getJson<Array<{ longShortRatio?: string }>>(url)
      const value = num(rows?.[0]?.longShortRatio)
      if (value !== null) return value
    }
    return null
  }, seriesCacheTtlMs())
}
