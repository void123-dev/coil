import type { Interval, SymbolId, Venue, VenuePack } from "../../coil/types.ts"
import { cached } from "../cache.ts"
import { fetchBinancePack } from "./binance.ts"
import { fetchBybitPack } from "./bybit.ts"
import { fetchOkxPack } from "./okx.ts"
import { makeDemoPack } from "./demo.ts"
import { PIT_IDS, type LivePit } from "./catalog.ts"

export { makeDemoPack } from "./demo.ts"
export { PIT_IDS, PIT_LABEL, sortPits, defaultVenueOf, venuesPayload, type LivePit, type PitRow, type VenuesPayload } from "./catalog.ts"

async function liveOrDemo(
  pit: LivePit,
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<VenuePack> {
  try {
    const pack =
      pit === "binance" ? await fetchBinancePack(symbol, interval, window)
      : pit === "bybit" ? await fetchBybitPack(symbol, interval, window)
      : await fetchOkxPack(symbol, interval, window)
    if (pack && pack.bars.length && pack.source === "live") return pack
  } catch {
    /* fall through to demo */
  }
  return makeDemoPack(symbol, interval, window)
}

export async function fetchVenuePack(
  pit: LivePit,
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<VenuePack> {
  return cached(`pack:${pit}:${symbol}:${interval}:${window}`, () =>
    liveOrDemo(pit, symbol, interval, window),
  )
}

export async function fetchAllPits(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<Record<LivePit, VenuePack>> {
  const [okx, bybit, binance] = await Promise.all([
    fetchVenuePack("okx", symbol, interval, window),
    fetchVenuePack("bybit", symbol, interval, window),
    fetchVenuePack("binance", symbol, interval, window),
  ])
  return { okx, bybit, binance }
}

export function requestedPits(venue: Venue): LivePit[] {
  if (venue === "all") return [...PIT_IDS]
  return [venue]
}
