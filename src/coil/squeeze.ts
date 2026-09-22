import type { CrowdSide, Regime, Source, SqueezeRead } from "./types.ts"

const MIN_HISTORY_DAYS = 10
const POSITION_LONG = 1.5
const POSITION_SHORT = 0.8

export function shortsCrowded(
  fundingPct: number | null,
  lsAccount: number | null,
  lsTop: number | null,
): boolean {
  if (fundingPct === null || fundingPct > 0.2) return false
  if (lsAccount === null && lsTop === null) return false
  if (lsAccount !== null && lsTop !== null && lsAccount >= 1.6 && lsTop >= 2.2) return false
  return (lsAccount !== null && lsAccount <= 1.05) || (lsTop !== null && lsTop <= 0.95)
}

export function longsCrowded(
  fundingPct: number | null,
  lsAccount: number | null,
  lsTop: number | null,
): boolean {
  if (fundingPct === null || fundingPct < 0.8) return false
  if (lsAccount === null && lsTop === null) return false
  return (lsAccount !== null && lsAccount >= 1.6) || (lsTop !== null && lsTop >= 2.2)
}

export function crowdDisagrees(
  lsAccount: number | null,
  lsTop: number | null,
  lsPosition: number | null,
): boolean {
  if (lsPosition === null) return false
  const accountShort =
    (lsAccount !== null && lsAccount <= 1.05) || (lsTop !== null && lsTop <= 0.95)
  const accountLong =
    (lsAccount !== null && lsAccount >= 1.6) || (lsTop !== null && lsTop >= 2.2)
  if (accountShort && lsPosition >= POSITION_LONG) return true
  if (accountLong && lsPosition <= POSITION_SHORT) return true
  return false
}

export function fuelOn(oiZ: number | null): boolean {
  return oiZ !== null && oiZ >= 1
}

export function fuelHot(oiZ: number | null, oiRising: boolean | null): boolean {
  if (oiZ === null) return false
  return oiZ >= 1.5 || (oiZ >= 1.2 && oiRising === true)
}

function coveringOf(pxNow?: number, pxThen?: number, oiNow?: number | null, oiThen?: number | null): boolean {
  if (!pxNow || !pxThen || !oiNow || !oiThen || pxThen === 0 || oiThen === 0) return false
  const px = pxNow / pxThen - 1
  const oi = oiNow / oiThen - 1
  return px > 0.006 && oi - px < -0.004
}

export type SqueezeInput = {
  source: Source
  historyDays: number | null
  fundingPct: number | null
  lsAccount: number | null
  lsTop: number | null
  lsPosition: number | null
  oiZ: number | null
  oiRising: boolean | null
  spotLeadsAgainstCrowd: boolean
  pxNow?: number
  pxThen?: number
  oiNow?: number | null
  oiThen?: number | null
}

export function emptySqueeze(partial: Partial<SqueezeRead> = {}): SqueezeRead {
  return {
    side: "none",
    watch: false,
    armed: false,
    fundingPct: null,
    lsAccount: null,
    lsTop: null,
    lsPosition: null,
    crowdDisagrees: false,
    oiZ: null,
    oiRising: null,
    covering: false,
    historyDays: null,
    ...partial,
  }
}

export function detectSqueeze(input: SqueezeInput): SqueezeRead {
  const historyOk = input.historyDays !== null && input.historyDays >= MIN_HISTORY_DAYS
  const fields = emptySqueeze({
    fundingPct: historyOk ? input.fundingPct : null,
    lsAccount: input.lsAccount,
    lsTop: input.lsTop,
    lsPosition: input.lsPosition,
    oiZ: historyOk ? input.oiZ : null,
    oiRising: historyOk ? input.oiRising : null,
    covering: coveringOf(input.pxNow, input.pxThen, input.oiNow, input.oiThen),
    historyDays: input.historyDays,
  })

  if (input.source !== "live" || !historyOk) return fields

  const shortCrowd = shortsCrowded(fields.fundingPct, fields.lsAccount, fields.lsTop)
  const longCrowd = longsCrowded(fields.fundingPct, fields.lsAccount, fields.lsTop)
  const disagree = crowdDisagrees(fields.lsAccount, fields.lsTop, fields.lsPosition)
  const on = fuelOn(fields.oiZ)
  const hot = fuelHot(fields.oiZ, fields.oiRising)
  const lead = input.spotLeadsAgainstCrowd

  const shortWatch = shortCrowd && on
  const shortArmed = shortCrowd && hot && lead && !disagree
  const longWatch = longCrowd && on
  const longArmed = longCrowd && hot && lead && !disagree

  if ((shortWatch || shortArmed) && (longWatch || longArmed)) {
    return { ...fields, crowdDisagrees: disagree }
  }

  if (shortArmed || shortWatch) {
    return { ...fields, side: "short", watch: shortWatch || shortArmed, armed: shortArmed, crowdDisagrees: disagree }
  }
  if (longArmed || longWatch) {
    return { ...fields, side: "long", watch: longWatch || longArmed, armed: longArmed, crowdDisagrees: disagree }
  }
  return { ...fields, crowdDisagrees: disagree }
}

export function regimeOf(score: number, squeeze: SqueezeRead): Regime {
  if (squeeze.armed) return "squeeze_armed"
  if (squeeze.watch) return "squeeze_watch"
  if (score >= 35) return "squeeze_watch"
  return "quiet"
}

export function squeezeHeadline(
  squeeze: SqueezeRead,
  crowdSide: CrowdSide,
  spotLead: boolean,
): { en: string; ru: string } {
  if (squeeze.armed && squeeze.side === "short") {
    return {
      en: "Armed short squeeze · spot leads vs crowded shorts",
      ru: "Заряд шорт-сквиза · спот ведёт против толпы в шорте",
    }
  }
  if (squeeze.armed && squeeze.side === "long") {
    return {
      en: "Armed long squeeze · spot leads vs crowded longs",
      ru: "Заряд лонг-сквиза · спот ведёт против толпы в лонге",
    }
  }
  if (squeeze.watch && squeeze.side === "short" && squeeze.crowdDisagrees) {
    return {
      en: "Watch short squeeze · accounts short, whale book long",
      ru: "Наблюдение шорт-сквиза · счета в шорте, китовый ноционал в лонге",
    }
  }
  if (squeeze.watch && squeeze.side === "long" && squeeze.crowdDisagrees) {
    return {
      en: "Watch long squeeze · accounts long, whale book short",
      ru: "Наблюдение лонг-сквиза · счета в лонге, китовый ноционал в шорте",
    }
  }
  if (squeeze.watch && squeeze.side === "short") {
    return {
      en: "Watch short squeeze · funding cheap, OI extended",
      ru: "Наблюдение шорт-сквиза · дешёвый фандинг, OI растянут",
    }
  }
  if (squeeze.watch && squeeze.side === "long") {
    return {
      en: "Watch long squeeze · funding rich, OI extended",
      ru: "Наблюдение лонг-сквиза · дорогой фандинг, OI растянут",
    }
  }
  if (crowdSide === "short") {
    return {
      en: spotLead ? "No squeeze · short crowd, spot leading" : "No squeeze · short crowd",
      ru: spotLead ? "Нет сквиза · толпа в шорте, спот ведёт" : "Нет сквиза · толпа в шорте",
    }
  }
  if (crowdSide === "long") {
    return {
      en: spotLead ? "No squeeze · long crowd, spot leading" : "No squeeze · long crowd",
      ru: spotLead ? "Нет сквиза · толпа в лонге, спот ведёт" : "Нет сквиза · толпа в лонге",
    }
  }
  return { en: "No squeeze · mixed book", ru: "Нет сквиза · смешанные книги" }
}
