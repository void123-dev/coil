import { computeCoil } from "../coil/computeCoil.ts"
import { regimeOf } from "../coil/squeeze.ts"
import { emptyDeskCard, parseQuery, toDeskCard } from "../coil/schema.ts"
import {
  SYMBOLS,
  type CoilSnapshot,
  type Interval,
  type LiqFeed,
  type Source,
  type SymbolId,
  type Venue,
  type VenuePack,
} from "../coil/types.ts"
import { cached } from "./cache.ts"
import { fetchGravityHint } from "./gravity-client.ts"
import { fetchMmFlow } from "./mm-flow.ts"
import { fetchLiqFeed } from "./venues/coinglass-liq.ts"
import { fetchAllPits, fetchVenuePack, PIT_IDS, venuesPayload, type LivePit, type VenuesPayload } from "./venues/index.ts"

export type ParsedQuery = ReturnType<typeof parseQuery> & { venue: Venue }

function envDefaultVenue(): Venue | null {
  const v = process.env.COIL_DEFAULT_VENUE
  if (v === "binance" || v === "bybit" || v === "okx" || v === "all") return v
  return null
}

export async function getVenuesCatalog(
  symbol: SymbolId,
  interval: Interval,
  window: number,
): Promise<VenuesPayload> {
  return cached(`venues:${symbol}:${interval}:${window}`, async () => {
    const packs = await fetchAllPits(symbol, interval, window)
    return venuesPayload(packs)
  })
}

function pickQueryVenue(catalog: VenuesPayload, envVenue: Venue | null): Venue {
  if (envVenue && envVenue !== "all") {
    const pit = catalog.pits.find((p) => p.id === envVenue)
    if (pit?.source === "live") return envVenue
    if (!catalog.pits.some((p) => p.source === "live") && pit) return envVenue
  }
  return catalog.default.venue
}

export async function parseCoilQuery(url: URL): Promise<ParsedQuery> {
  const query = parseQuery(url)
  if (url.searchParams.has("venue") && query.venue) {
    return { ...query, venue: query.venue }
  }
  const catalog = await getVenuesCatalog(query.symbol as SymbolId, query.interval as Interval, query.window)
  return { ...query, venue: pickQueryVenue(catalog, envDefaultVenue()) }
}

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function packSource(pack: VenuePack): Source {
  return pack.source === "live" ? "live" : "demo"
}

function consensusOf(
  pits: Record<string, { score: number; bias: number; source: Source }>,
): CoilSnapshot["consensus"] {
  const live = Object.values(pits).filter((p) => p.source === "live")
  if (live.length < 2) return "quiet"
  const up = live.filter((p) => p.score >= 35 && p.bias > 0).length
  const down = live.filter((p) => p.score >= 35 && p.bias < 0).length
  if (up >= 2 && up > down) return "agree_up_squeeze"
  if (down >= 2 && down > up) return "agree_down_squeeze"
  if (up + down < 2) return "quiet"
  return "split"
}

function applyMedian(
  snap: CoilSnapshot,
  score: number,
  bias: number,
): CoilSnapshot {
  return {
    ...snap,
    score,
    bias,
    regime: regimeOf(score, snap.squeeze),
    series: snap.series.map((row) => ({ ...row, score, bias })),
  }
}

async function snapshotForPit(
  pit: LivePit,
  symbol: SymbolId,
  interval: Interval,
  window: number,
  venue: Venue,
  gravity: CoilSnapshot["gravity"],
  mmEvents: CoilSnapshot["mmFlow"]["events"],
  mmStatus: CoilSnapshot["mmFlow"]["status"],
  liqFeed: LiqFeed,
): Promise<CoilSnapshot> {
  const pack = await fetchVenuePack(pit, symbol, interval, window)
  const snap = computeCoil({
    symbol,
    interval,
    window,
    venue,
    pack,
    gravity,
    mmEvents: mmStatus === "disabled" ? [] : mmEvents,
    liqFeed,
  })
  snap.mmFlow = { status: mmStatus, events: mmStatus === "disabled" ? [] : mmEvents }
  return snap
}

async function resolveVenue(query: ReturnType<typeof parseQuery>): Promise<Venue> {
  if (query.venue) return query.venue
  const catalog = await getVenuesCatalog(query.symbol as SymbolId, query.interval as Interval, query.window)
  return pickQueryVenue(catalog, envDefaultVenue())
}

async function buildSnapshot(query: ParsedQuery): Promise<CoilSnapshot> {
  const symbol = query.symbol as SymbolId
  const interval = query.interval as Interval
  const window = query.window
  const venue = await resolveVenue(query)

  const [gravity, mm, liqFeed] = await Promise.all([
    fetchGravityHint(symbol, interval, window),
    fetchMmFlow(),
    fetchLiqFeed(symbol),
  ])
  const mmEvents = mm.status === "disabled" ? [] : mm.events

  if (venue === "all") {
    const packs = await fetchAllPits(symbol, interval, window)
    const pitSnaps = await Promise.all(
      PIT_IDS.map((pit) =>
        snapshotForPit(pit, symbol, interval, window, pit, gravity, mmEvents, mm.status, liqFeed),
      ),
    )
    const pits: NonNullable<CoilSnapshot["pits"]> = {}
    for (let i = 0; i < PIT_IDS.length; i++) {
      const pit = PIT_IDS[i]!
      const s = pitSnaps[i]!
      pits[pit] = { score: s.score, bias: s.bias, source: packSource(packs[pit]) }
    }
    const liveSnaps = pitSnaps.filter((_, i) => packs[PIT_IDS[i]!].source === "live")
    const base = liveSnaps[0] ?? pitSnaps[0]!
    const used = { ...base, venue: "all" as const, gravity }
    used.source = liveSnaps.length ? "live" : "demo"
    used.pits = pits
    used.consensus = consensusOf(pits)
    used.mmFlow = { status: mm.status, events: mmEvents }
    if (liveSnaps.length) {
      return applyMedian(
        used,
        median(liveSnaps.map((s) => s.score)),
        median(liveSnaps.map((s) => s.bias)),
      )
    }
    return used
  }

  return snapshotForPit(venue, symbol, interval, window, venue, gravity, mmEvents, mm.status, liqFeed)
}

export async function getCoilSnapshot(query: ParsedQuery): Promise<CoilSnapshot> {
  const venue = await resolveVenue(query)
  const resolved = { ...query, venue }
  return cached(
    `snap:${resolved.venue}:${resolved.symbol}:${resolved.interval}:${resolved.window}`,
    () => buildSnapshot(resolved),
  )
}

export async function getDeskCard(query: ParsedQuery) {
  try {
    return toDeskCard(await getCoilSnapshot(query))
  } catch {
    return emptyDeskCard(query)
  }
}

export async function getVenuesPayload(query: ReturnType<typeof parseQuery>): Promise<VenuesPayload> {
  return getVenuesCatalog(query.symbol as SymbolId, query.interval as Interval, query.window)
}

async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += n) {
    const chunk = await Promise.all(items.slice(i, i + n).map(fn))
    out.push(...chunk)
  }
  return out
}

export async function getBreadth(query: ParsedQuery) {
  const venue = await resolveVenue(query)
  const resolved = { ...query, venue }
  const items = await mapPool([...SYMBOLS], 3, async (symbol) => {
    const snap = await getCoilSnapshot({ ...resolved, symbol })
    return {
      symbol: snap.symbol,
      score: snap.score,
      bias: snap.bias,
      regime: snap.regime,
      crowdSide: snap.crowdSide,
      source: snap.source,
      headline: snap.headline,
      spotLeadsAgainstCrowd: snap.spotLeadsAgainstCrowd,
    }
  })
  return {
    asOf: Date.now(),
    venue,
    interval: query.interval,
    window: query.window,
    items,
  }
}
