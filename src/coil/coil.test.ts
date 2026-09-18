import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computeCoil } from "./computeCoil.ts"
import { emptyDeskCard, parseQuery, toDeskCard } from "./schema.ts"
import { sessionAt, sessionTag } from "./session.ts"
import type { Bar, VenuePack } from "./types.ts"
import { makeDemoPack } from "../lib/venues/demo.ts"
import { defaultVenueOf, sortPits, type PitRow } from "../lib/venues/catalog.ts"

function bars(over: Partial<Bar> = {}, n = 48): Bar[] {
  return Array.from({ length: n }, (_, i) => ({
    t: 1_700_000_000_000 + i * 300_000,
    spot: 100 + i * 0.2,
    perp: 100.2 + i * 0.2,
    spotVol: 1000,
    perpVol: 2500,
    spotTakerBuy: i === n - 1 ? 80 : 50,
    spotTakerSell: i === n - 1 ? 20 : 50,
    perpTakerBuy: 45,
    perpTakerSell: 55,
    oiUsd: 1_000_000_000,
    funding: -0.001,
    ...over,
  }))
}

function pack(over: Partial<VenuePack> = {}): VenuePack {
  const b = over.bars ?? bars()
  return {
    bars: b,
    funding: -0.001,
    fundingHistory: [0, 0.0002, 0.0004, 0.0006, 0.0008, 0.001, 0.0012],
    oiUsd: 1_000_000_000,
    oiHistory: b.map((x) => x.oiUsd),
    lsAccount: 0.6,
    lsTop: 0.55,
    source: "live",
    ...over,
  }
}

describe("sessionAt", () => {
  it("maps 16:00–18:59 ET to ny_close", () => {
    assert.equal(sessionAt(Date.parse("2026-09-17T16:00:00-04:00")).label, "ny_close")
    assert.equal(sessionAt(Date.parse("2026-09-17T17:30:00-04:00")).label, "ny_close")
    assert.equal(sessionAt(Date.parse("2026-09-17T18:59:00-04:00")).label, "ny_close")
    assert.equal(sessionAt(Date.parse("2026-09-17T16:00:00-04:00")).thin, true)
  })

  it("maps Saturday and Sunday to weekend", () => {
    assert.equal(sessionAt(Date.parse("2026-09-19T12:00:00-04:00")).label, "weekend")
    assert.equal(sessionAt(Date.parse("2026-09-20T08:00:00-04:00")).label, "weekend")
    assert.equal(sessionAt(Date.parse("2026-09-19T12:00:00-04:00")).thin, true)
  })

  it("maps NY hours to session tag us", () => {
    assert.equal(sessionTag("ny_close"), "us")
    assert.equal(sessionTag("ny"), "us")
    assert.equal(sessionTag("asia_open"), "asia")
    assert.equal(sessionTag("london"), "london")
    assert.equal(sessionTag("weekend"), "weekend")
  })
})

describe("computeCoil", () => {
  it("short crowd + low funding percentile + spot bid → bias>0 and spotLeadsAgainstCrowd", () => {
    const snap = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "okx",
      pack: pack(),
    })
    assert.equal(snap.crowdSide, "short")
    assert.ok(snap.bias > 0)
    assert.equal(snap.spotLeadsAgainstCrowd, true)
  })

  it("mm disabled → mmFlow component 0", () => {
    const snap = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "okx",
      pack: pack(),
      mmEvents: [],
    })
    assert.equal(snap.components.mmFlow, 0)
    assert.equal(snap.mmFlow.status, "disabled")
  })

  it("demo pack never labeled source as a venue id", () => {
    const demo = makeDemoPack("BTC", "5m", 48, Date.parse("2026-09-17T12:00:00Z"))
    assert.equal(demo.source, "demo")
    const snap = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "binance",
      pack: demo,
    })
    assert.equal(snap.source, "demo")
    assert.notEqual(snap.source, "binance")
  })

  it("live pack source is live, not the venue id", () => {
    const snap = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "binance",
      pack: pack({ source: "live" }),
    })
    assert.equal(snap.source, "live")
    assert.notEqual(snap.source, "binance")
  })

  it("Gravity offline does not zero score", () => {
    const snap = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "okx",
      pack: pack(),
      gravity: { available: false },
    })
    assert.ok(snap.score > 0)
    assert.equal(snap.gravity.available, false)
  })

  it("does not blend Gravity G into score", () => {
    const base = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "okx",
      pack: pack(),
      gravity: { available: false },
    })
    const withG = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "okx",
      pack: pack(),
      gravity: { available: true, g: -1 },
    })
    assert.equal(base.score, withG.score)
    assert.equal(base.components.spotLead, withG.components.spotLead)
  })
})

describe("parseQuery", () => {
  it("interval=3m falls back to 5m and does not hardcode binance", () => {
    const q = parseQuery(new URL("https://coil.test/api/coil?interval=3m"))
    assert.equal(q.interval, "5m")
    assert.equal(q.symbol, "BTC")
    assert.equal(q.window, 48)
    assert.equal(q.venue, undefined)
  })

  it("accepts venue=okx", () => {
    const q = parseQuery(new URL("https://coil.test/api/desk?symbol=BTC&interval=5m&venue=okx"))
    assert.equal(q.venue, "okx")
    assert.equal(q.symbol, "BTC")
  })
})

describe("venues catalog", () => {
  it("ranks live first even when demo volume is larger", () => {
    const pits: PitRow[] = [
      { id: "binance", label: "Binance", source: "demo", volumeUsd: 900_000_000 },
      { id: "okx", label: "OKX", source: "live", volumeUsd: 120_000_000 },
      { id: "bybit", label: "Bybit", source: "demo", volumeUsd: 400_000_000 },
    ]
    const sorted = sortPits(pits)
    assert.equal(sorted[0]?.id, "okx")
    assert.equal(sorted[0]?.source, "live")
    assert.equal(defaultVenueOf(pits).venue, "okx")
    assert.equal(defaultVenueOf(pits).interval, "5m")
  })

  it("falls back to largest-volume demo when nothing is live", () => {
    const pits: PitRow[] = [
      { id: "okx", label: "OKX", source: "demo", volumeUsd: 50 },
      { id: "binance", label: "Binance", source: "demo", volumeUsd: 900 },
      { id: "bybit", label: "Bybit", source: "demo", volumeUsd: 100 },
    ]
    assert.equal(defaultVenueOf(pits).venue, "binance")
    assert.equal(sortPits(pits)[0]?.source, "demo")
  })
})

describe("desk card", () => {
  it("emits required fields including session string and live source", () => {
    const snap = computeCoil({
      symbol: "BTC",
      interval: "5m",
      window: 48,
      venue: "okx",
      pack: pack(),
      now: Date.parse("2026-09-17T12:00:00-04:00"),
    })
    const card = toDeskCard(snap)
    assert.equal(typeof card.score, "number")
    assert.ok(card.regime === "quiet" || card.regime === "squeeze_watch" || card.regime === "squeeze_armed")
    assert.ok(card.crowdSide === "short" || card.crowdSide === "long" || card.crowdSide === "mixed")
    assert.equal(typeof card.bias, "number")
    assert.equal(typeof card.spotLeadsAgainstCrowd, "boolean")
    assert.equal(typeof card.thinTape, "boolean")
    assert.equal(card.session, "us")
    assert.equal(card.source, "live")
    assert.equal(card.venue, "okx")
    assert.equal(card.symbol, "BTC")
    assert.equal(card.interval, "5m")
  })

  it("missing fields render as null, not a crash", () => {
    const card = toDeskCard({})
    assert.equal(card.score, null)
    assert.equal(card.regime, null)
    assert.equal(card.crowdSide, null)
    assert.equal(card.bias, null)
    assert.equal(card.spotLeadsAgainstCrowd, null)
    assert.equal(card.thinTape, null)
    assert.equal(card.session, null)
    assert.equal(card.source, null)
    assert.equal(card.venue, null)
    const empty = emptyDeskCard({ symbol: "ETH" })
    assert.equal(empty.symbol, "ETH")
    assert.equal(empty.score, null)
    assert.equal(toDeskCard(null).score, null)
  })
})
