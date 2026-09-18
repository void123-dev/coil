import type { Interval, Source, VenuePack } from "../../coil/types.ts"

export const PIT_IDS = ["okx", "bybit", "binance"] as const
export type LivePit = (typeof PIT_IDS)[number]

export const PIT_LABEL: Record<LivePit, string> = {
  okx: "OKX",
  bybit: "Bybit",
  binance: "Binance",
}

export type PitRow = {
  id: LivePit
  label: string
  source: Source
  volumeUsd: number
}

export type VenuesPayload = {
  pits: PitRow[]
  default: { venue: LivePit; interval: Interval }
}

export function packVolumeUsd(pack: VenuePack): number {
  const windowUsd = pack.bars.reduce((sum, bar) => {
    const v = bar.perpVol
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
  if (windowUsd > 0) return windowUsd
  if (pack.oiUsd && pack.oiUsd > 0) return pack.oiUsd
  return 0
}

export function sortPits(pits: readonly PitRow[]): PitRow[] {
  return [...pits].sort((a, b) => {
    const live = Number(b.source === "live") - Number(a.source === "live")
    if (live) return live
    if (b.volumeUsd !== a.volumeUsd) return b.volumeUsd - a.volumeUsd
    return a.id.localeCompare(b.id)
  })
}

export function defaultVenueOf(pits: readonly PitRow[]): VenuesPayload["default"] {
  const sorted = sortPits(pits)
  const live = sorted.find((pit) => pit.source === "live")
  const first = live ?? sorted[0]
  return { venue: first?.id ?? "okx", interval: "5m" }
}

export function pitRow(id: LivePit, pack: VenuePack): PitRow {
  return {
    id,
    label: PIT_LABEL[id],
    source: pack.source === "live" ? "live" : "demo",
    volumeUsd: Math.round(packVolumeUsd(pack)),
  }
}

export function venuesPayload(packs: Record<LivePit, VenuePack>): VenuesPayload {
  const pits = sortPits(PIT_IDS.map((id) => pitRow(id, packs[id])))
  return { pits, default: defaultVenueOf(pits) }
}
