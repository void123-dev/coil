import type { CoilSnapshot } from "../coil/types.ts"

const CSV_COLS = [
  "model",
  "symbol",
  "interval",
  "window",
  "venue",
  "source",
  "asOf",
  "score",
  "bias",
  "regime",
  "crowdSide",
  "confidence",
  "headline",
  "spot",
  "perp",
  "basisBps",
  "funding",
  "fundingPercentile",
  "oiUsd",
  "oiZ",
  "lsAccount",
  "lsTop",
  "lsPosition",
  "spotTakerBuyPct",
  "perpTakerBuyPct",
  "spotLeadsAgainstCrowd",
  "thinTape",
] as const

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ""
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function snapshotToCsv(snapshot: CoilSnapshot): string {
  const header = CSV_COLS.join(",")
  const row = CSV_COLS.map((k) => csvCell(snapshot[k])).join(",")
  return `${header}\n${row}\n`
}

export const EXPORT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "COIL-1.1 export envelope",
  type: "object",
  required: ["api", "snapshot"],
  properties: {
    api: { const: "coil-export" },
    version: { const: "1.1" },
    model: { const: "COIL-1.1" },
    fetchedAt: { type: "number" },
    query: {
      type: "object",
      properties: {
        symbol: { enum: ["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "AVAX", "LINK", "SUI", "NEAR"] },
        interval: { enum: ["1m", "5m", "15m", "1H", "4H"] },
        window: { enum: [24, 48, 96] },
        venue: { enum: ["okx", "bybit", "binance", "all"] },
        format: { enum: ["json", "csv", "schema"] },
      },
    },
    readme: { type: "object" },
    score: { type: ["number", "null"] },
    regime: { enum: ["quiet", "squeeze_watch", "squeeze_armed", null] },
    crowdSide: { enum: ["short", "long", "mixed", null] },
    bias: { type: ["number", "null"] },
    spotLeadsAgainstCrowd: { type: ["boolean", "null"] },
    thinTape: { type: ["boolean", "null"] },
    session: { type: ["string", "null"] },
    source: { enum: ["demo", "live", null] },
    venue: { type: ["string", "null"] },
    symbol: { type: ["string", "null"] },
    interval: { type: ["string", "null"] },
    card: { type: "object" },
    snapshot: {
      type: "object",
      required: ["source", "venue", "symbol", "interval", "score", "regime", "crowdSide", "bias", "spotLeadsAgainstCrowd", "thinTape", "session"],
      properties: {
        model: { const: "COIL-1.1" },
        score: { type: ["number", "null"], minimum: 0, maximum: 100 },
        bias: { type: ["number", "null"], minimum: -1, maximum: 1 },
        regime: { enum: ["quiet", "squeeze_watch", "squeeze_armed", null] },
        crowdSide: { enum: ["short", "long", "mixed", null] },
        source: { enum: ["demo", "live", null] },
        venue: { type: ["string", "null"] },
        symbol: { type: ["string", "null"] },
        interval: { type: ["string", "null"] },
        session: { type: ["string", "null"] },
        spotLeadsAgainstCrowd: { type: ["boolean", "null"] },
        thinTape: { type: ["boolean", "null"] },
        weights: {
          type: "object",
          properties: {
            crowd: { const: 0.3 },
            fuel: { const: 0.25 },
            spotLead: { const: 0.2 },
            thinSession: { const: 0.15 },
            mmFlow: { const: 0.1 },
          },
        },
      },
    },
  },
} as const
