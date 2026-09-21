import { WEIGHTS, type CoilSnapshot, type CrowdSide, type GravityHint, type MmEvent, type Regime, type Source, type VenuePack } from "./types.ts"
import { detectSqueeze, regimeOf, squeezeHeadline } from "./squeeze.ts"
import { basisBps, clamp, mean, percentileRank, takerBuyPct, zScore } from "./math.ts"
import { sessionAt } from "./session.ts"

function crowdSideOf(ls: number | null, fundingPct: number | null): CrowdSide {
  const shortish = (ls !== null && ls < 0.85) || (fundingPct !== null && fundingPct < 0.2)
  const longish = (ls !== null && ls > 1.2) || (fundingPct !== null && fundingPct > 0.8)
  if (shortish && !longish) return "short"
  if (longish && !shortish) return "long"
  return "mixed"
}

function crowdLayer(side: CrowdSide, fundingPct: number | null, lsAccount: number | null, lsTop: number | null) {
  const fundExt = fundingPct === null ? 0 : Math.max(fundingPct, 1 - fundingPct)
  const ls = lsTop ?? lsAccount
  const lsExt = ls === null ? 0 : clamp(Math.abs(Math.log(Math.max(ls, 0.05))) / Math.log(3))
  const aligned = side !== "mixed" ? 1 : 0.35
  return clamp(0.55 * fundExt + 0.45 * lsExt) * aligned
}

function fuelLayer(oiZ: number | null, side: CrowdSide, spotRet: number) {
  const ext = oiZ === null ? 0.25 : clamp(Math.abs(oiZ) / 2)
  const against = side === "short" ? spotRet > 0 : side === "long" ? spotRet < 0 : false
  return clamp(ext * (against ? 1 : 0.7))
}

function spotLeadLayer(side: CrowdSide, spotFlow: number | null, perpFlow: number | null) {
  if (side === "mixed" || spotFlow === null) return 0
  const spotBid = spotFlow >= 0.52
  const spotOffer = spotFlow <= 0.48
  const against = (side === "short" && spotBid) || (side === "long" && spotOffer)
  if (!against) return 0.1
  const vsPerp = perpFlow === null ? 0.15 : Math.abs(spotFlow - perpFlow)
  return clamp(0.55 + vsPerp)
}

function mmLayer(events: MmEvent[], side: CrowdSide, symbol: string) {
  const recent = events.filter((e) => e.asset === symbol && Date.now() - e.t < 6 * 3600_000)
  if (!recent.length) return 0
  const usd = recent.reduce((s, e) => s + e.usd, 0)
  const deposits = recent.some((e) => e.side === "cex_deposit")
  const aligned =
    (side === "short" && deposits) || (side === "long" && deposits)
  return aligned ? clamp(Math.log10(Math.max(usd, 1)) / 8) : 0.05
}

export function computeCoil(opts: {
  symbol: CoilSnapshot["symbol"]
  interval: CoilSnapshot["interval"]
  window: number
  venue: CoilSnapshot["venue"]
  pack: VenuePack
  gravity?: GravityHint | null
  mmEvents?: MmEvent[]
  now?: number
}): CoilSnapshot {
  const now = opts.now ?? Date.now()
  const bars = opts.pack.bars.slice(-opts.window)
  const last = bars[bars.length - 1]
  const first = bars[0]
  const session = sessionAt(now)
  const source: Source = opts.pack.source === "live" ? "live" : "demo"
  const fundingPct = percentileRank(opts.pack.funding ?? last?.funding ?? 0, opts.pack.fundingHistory)
  const side = crowdSideOf(opts.pack.lsTop ?? opts.pack.lsAccount, fundingPct)
  const oiSeries = opts.pack.oiHistory.length ? opts.pack.oiHistory : bars.map((b) => b.oiUsd)
  const oiNow = opts.pack.oiUsd ?? last?.oiUsd ?? 0
  const oiZ = oiSeries.length ? zScore(oiNow, oiSeries) : null
  const spotFlow = last ? takerBuyPct(last.spotTakerBuy, last.spotTakerSell) : null
  const perpFlow = last ? takerBuyPct(last.perpTakerBuy, last.perpTakerSell) : null
  const spotRet = first && last && first.spot ? last.spot / first.spot - 1 : 0
  const avgSpot = mean(bars.map((b) => b.spotVol))
  const avgPerp = mean(bars.map((b) => b.perpVol))
  const events = opts.mmEvents ?? []
  const mmStatus = events.length ? "demo" : "disabled"

  const components = {
    crowd: crowdLayer(side, fundingPct, opts.pack.lsAccount, opts.pack.lsTop),
    fuel: fuelLayer(oiZ, side, spotRet),
    spotLead: spotLeadLayer(side, spotFlow, perpFlow),
    thinSession: session.thin ? clamp(0.6 + (last && avgSpot > 0 && last.spotVol < avgSpot * 0.8 ? 0.25 : 0)) : 0.2,
    mmFlow: mmStatus === "disabled" ? 0 : mmLayer(events, side, opts.symbol),
  }
  const score = clamp(
    100 * (
      WEIGHTS.crowd * components.crowd +
      WEIGHTS.fuel * components.fuel +
      WEIGHTS.spotLead * components.spotLead +
      WEIGHTS.thinSession * components.thinSession +
      WEIGHTS.mmFlow * components.mmFlow
    ),
    0, 100,
  )
  const bias = side === "short" ? components.crowd : side === "long" ? -components.crowd : 0
  const spotLeadsAgainstCrowd =
    (side === "short" && (spotFlow ?? 0) >= 0.52) || (side === "long" && (spotFlow ?? 1) <= 0.48)
  const lookbackOi = opts.pack.oiHistory30d?.length ? opts.pack.oiHistory30d : []
  const historyDays = opts.pack.historyDays ?? null
  const squeezeOiZ = lookbackOi.length >= 10 ? zScore(oiNow, lookbackOi) : null
  const squeezeFundPct = fundingPct
  const squeeze = detectSqueeze({
    source,
    historyDays,
    fundingPct: squeezeFundPct,
    lsAccount: opts.pack.lsAccount,
    lsTop: opts.pack.lsTop,
    oiZ: squeezeOiZ,
    oiRising: opts.pack.oiRising ?? null,
    spotLeadsAgainstCrowd,
    pxNow: last?.spot ?? 0,
    pxThen: first?.spot ?? 0,
    oiNow,
    oiThen: bars[0]?.oiUsd || oiSeries[0] || null,
  })
  const regime: Regime = regimeOf(score, squeeze)
  const conf = clamp(
    (Number(fundingPct !== null) + Number(opts.pack.lsAccount !== null) + Number(oiZ !== null) + Number(spotFlow !== null)) / 4,
  )
  const { en, ru } = squeezeHeadline(squeeze, side, spotLeadsAgainstCrowd)

  return {
    model: "COIL-1.1",
    symbol: opts.symbol, interval: opts.interval, window: opts.window, venue: opts.venue,
    source, asOf: last?.t ?? now, session, score, bias, regime, crowdSide: side,
    confidence: conf, headline: en, headlineRu: ru, components, weights: WEIGHTS,
    spot: last?.spot ?? 0, perp: last?.perp ?? 0,
    basisBps: last ? basisBps(last.spot, last.perp) : 0,
    funding: opts.pack.funding, fundingPercentile: fundingPct,
    oiUsd: oiNow, oiZ, lsAccount: opts.pack.lsAccount, lsTop: opts.pack.lsTop,
    spotTakerBuyPct: spotFlow, perpTakerBuyPct: perpFlow,
    spotVol: last?.spotVol ?? 0, perpVol: last?.perpVol ?? 0,
    spotVolRel: avgSpot ? (last?.spotVol ?? 0) / avgSpot : 1,
    perpVolRel: avgPerp ? (last?.perpVol ?? 0) / avgPerp : 1,
    spotLeadsAgainstCrowd, thinTape: session.thin,
    squeeze,
    mmFlow: { status: mmStatus === "disabled" ? "disabled" : events.length ? mmStatus : "empty", events },
    gravity: opts.gravity ?? { available: false },
    series: bars.map((b) => ({
      t: b.t, spot: b.spot, perp: b.perp, basisBps: basisBps(b.spot, b.perp),
      funding: b.funding, oiUsd: b.oiUsd, score, bias,
      crowd: components.crowd, fuel: components.fuel,
      spotLead: components.spotLead, thinSession: components.thinSession,
    })),
  }
}
