import type { SymbolId } from "../../coil/types.ts"
import { cached, seriesCacheTtlMs } from "../cache.ts"
import { getJson } from "../http.ts"
import { num } from "./align.ts"

/** Binance top-trader position ratio: whale notional, not account headcount. */
export async function fetchBinanceLsPosition(symbol: SymbolId): Promise<number | null> {
  return cached(`binance-ls-pos:${symbol}`, async () => {
    const rows = await getJson<Array<{ longShortRatio?: string }>>(
      `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}USDT&period=5m&limit=1`,
    )
    return num(rows?.[0]?.longShortRatio)
  }, seriesCacheTtlMs())
}
