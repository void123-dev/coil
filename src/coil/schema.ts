import { z } from "zod"
import { sessionTag } from "./session.ts"
import {
  INTERVALS,
  SYMBOLS,
  VENUES,
  WINDOWS,
  type CoilSnapshot,
  type CrowdSide,
  type DeskCard,
  type Regime,
  type Source,
  type SqueezeSide,
} from "./types.ts"

export const QuerySchema = z.object({
  symbol: z.enum(SYMBOLS).default("BTC"),
  interval: z.enum(INTERVALS).default("5m"),
  window: z.coerce.number().pipe(z.union([z.literal(WINDOWS[0]), z.literal(WINDOWS[1]), z.literal(WINDOWS[2])])).default(48),
  venue: z.enum(VENUES).optional(),
  format: z.enum(["json", "csv", "schema"]).default("json"),
  download: z.string().optional(),
})

const REGIMES: readonly Regime[] = ["quiet", "squeeze_watch", "squeeze_armed"]
const CROWDS: readonly CrowdSide[] = ["short", "long", "mixed"]
const SOURCES: readonly Source[] = ["demo", "live"]
const SQUEEZE_SIDES: readonly SqueezeSide[] = ["short", "long", "none"]

export const DeskCardSchema = z.object({
  score: z.number().nullable(),
  regime: z.enum(["quiet", "squeeze_watch", "squeeze_armed"]).nullable(),
  crowdSide: z.enum(["short", "long", "mixed"]).nullable(),
  bias: z.number().nullable(),
  spotLeadsAgainstCrowd: z.boolean().nullable(),
  thinTape: z.boolean().nullable(),
  session: z.string().nullable(),
  source: z.enum(["demo", "live"]).nullable(),
  venue: z.string().nullable(),
  symbol: z.string().nullable(),
  interval: z.string().nullable(),
  squeezeSide: z.enum(["short", "long", "none"]).nullable(),
  squeezeWatch: z.boolean().nullable(),
  squeezeArmed: z.boolean().nullable(),
  fundingPct: z.number().nullable(),
  oiZ: z.number().nullable(),
  lsPosition: z.number().nullable(),
  crowdDisagrees: z.boolean().nullable(),
})

export function parseQuery(url: URL) {
  const raw = Object.fromEntries(url.searchParams.entries())
  const parsed = QuerySchema.safeParse(raw)
  return parsed.success ? parsed.data : QuerySchema.parse({})
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : null
}

function sessionFrom(s: unknown): string | null {
  if (typeof s === "string") return sessionTag(s)
  if (s && typeof s === "object" && "label" in s) {
    return sessionTag((s as { label?: string }).label)
  }
  return null
}

export function emptyDeskCard(q?: { symbol?: string; interval?: string; venue?: string }): DeskCard {
  return {
    score: null,
    regime: null,
    crowdSide: null,
    bias: null,
    spotLeadsAgainstCrowd: null,
    thinTape: null,
    session: null,
    source: null,
    venue: strOrNull(q?.venue),
    symbol: strOrNull(q?.symbol) ?? "BTC",
    interval: strOrNull(q?.interval) ?? "5m",
    squeezeSide: null,
    squeezeWatch: null,
    squeezeArmed: null,
    fundingPct: null,
    oiZ: null,
    lsPosition: null,
    crowdDisagrees: null,
  }
}

export function toDeskCard(s: Partial<CoilSnapshot> | Record<string, unknown> | null | undefined): DeskCard {
  if (!s || typeof s !== "object") return emptyDeskCard()
  const rec = s as Record<string, unknown>
  const sourceRaw = rec.source
  const regimeRaw = rec.regime
  const crowdRaw = rec.crowdSide
  const squeeze = rec.squeeze && typeof rec.squeeze === "object" ? rec.squeeze as Record<string, unknown> : rec
  const squeezeSideRaw = squeeze.side ?? rec.squeezeSide
  return {
    score: numOrNull(rec.score),
    regime: REGIMES.includes(regimeRaw as Regime) ? (regimeRaw as Regime) : null,
    crowdSide: CROWDS.includes(crowdRaw as CrowdSide) ? (crowdRaw as CrowdSide) : null,
    bias: numOrNull(rec.bias),
    spotLeadsAgainstCrowd: boolOrNull(rec.spotLeadsAgainstCrowd),
    thinTape: boolOrNull(rec.thinTape),
    session: sessionFrom(rec.session),
    source: SOURCES.includes(sourceRaw as Source) ? (sourceRaw as Source) : null,
    venue: strOrNull(rec.venue),
    symbol: strOrNull(rec.symbol),
    interval: strOrNull(rec.interval),
    squeezeSide: SQUEEZE_SIDES.includes(squeezeSideRaw as SqueezeSide) ? (squeezeSideRaw as SqueezeSide) : null,
    squeezeWatch: boolOrNull(squeeze.watch ?? rec.squeezeWatch),
    squeezeArmed: boolOrNull(squeeze.armed ?? rec.squeezeArmed),
    fundingPct: numOrNull(squeeze.fundingPct ?? rec.fundingPct),
    oiZ: numOrNull(squeeze.oiZ ?? rec.oiZ),
    lsPosition: numOrNull(squeeze.lsPosition ?? rec.lsPosition),
    crowdDisagrees: boolOrNull(squeeze.crowdDisagrees ?? rec.crowdDisagrees),
  }
}

export function exportEnvelope(query: unknown, snapshot: CoilSnapshot, fetchedAt = Date.now()) {
  const card = toDeskCard(snapshot)
  return {
    api: "coil-export",
    version: "1.1",
    model: "COIL-1.1",
    fetchedAt,
    query,
    readme: {
      score: "0–100 crowd/squeeze setup strength. Not mixed with Gravity G or ANVIL A. Not P(next candle).",
      bias: "[-1,+1]. Negative = long crowd vulnerable. Positive = short crowd vulnerable.",
      regime: "squeeze_armed only if squeeze.armed. Else squeeze_watch if squeeze.watch or score≥35. Else quiet.",
      squeeze: "Flags from 30d funding percentile, L/S accounts, OI z. Armed blocked when account L/S disagrees with whale position ratio. Not an order.",
      source: "live = real tape. demo = synthetic. Never a venue id.",
      mmFlow: "Inventory transfers, not proven intent. Weight cap 10%.",
      gravity: "Optional sibling snapshot. Not mixed into COIL score.",
    },
    ...card,
    card,
    snapshot: {
      ...snapshot,
      ...card,
    },
  }
}
