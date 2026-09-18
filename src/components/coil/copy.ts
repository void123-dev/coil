import type { CrowdSide, Regime, SessionLabel } from "@/coil/types.ts"

export type Lang = "en" | "ru"

export const COPY = {
  en: {
    tagline: "Crowd and squeeze. Not the next candle.",
    pits: "Pits",
    assets: "Assets",
    interval: "Interval",
    window: "Window",
    score: "Score",
    bias: "Bias",
    session: "Session",
    crowd: "Crowd",
    funding: "Funding",
    percentile: "percentile",
    lsAccount: "L/S account",
    lsTop: "L/S top",
    oi: "Open interest",
    basis: "Basis",
    spotTaker: "Spot flow",
    perpTaker: "Perp flow",
    thin: "Thin tape",
    mm: "MM flow",
    gravity: "Gravity G",
    weights: "Weights",
    charts: {
      scoreBias: "Score / bias",
      fundingPrice: "Funding vs price",
      oiPrice: "OI vs price",
      activity: "Equalized spot / perp",
      session: "Session strip",
      breadth: "Breadth",
    },
    yes: "yes",
    no: "no",
    mock: "demo",
    live: "live",
    demo: "demo",
    footer:
      "Crowd and squeeze. Not the next candle. COIL-1.0 weights: crowd 30% · fuel 25% · spot-lead 20% · thin-session 15% · mm-flow 10%.",
    loading: "Reading the tape…",
    error: "Desk feed unavailable. Retrying.",
    shortVulnerable: "short crowd vulnerable",
    longVulnerable: "long crowd vulnerable",
    leading: "spot leading against crowd",
    notLeading: "spot not leading",
  },
  ru: {
    tagline: "Толпа и сквиз. Не прогноз следующей свечи.",
    pits: "Площадки",
    assets: "Активы",
    interval: "Интервал",
    window: "Окно",
    score: "Счёт",
    bias: "Смещение",
    session: "Сессия",
    crowd: "Толпа",
    funding: "Фандинг",
    percentile: "перцентиль",
    lsAccount: "L/S счета",
    lsTop: "L/S топ",
    oi: "Открытый интерес",
    basis: "Базис",
    spotTaker: "Спот поток",
    perpTaker: "Перп поток",
    thin: "Тонкая лента",
    mm: "Поток MM",
    gravity: "Gravity G",
    weights: "Веса",
    charts: {
      scoreBias: "Счёт / смещение",
      fundingPrice: "Фандинг и цена",
      oiPrice: "OI и цена",
      activity: "Спот / перп, уравн.",
      session: "Полоса сессий",
      breadth: "Ширина",
    },
    yes: "да",
    no: "нет",
    mock: "демо",
    live: "живой",
    demo: "демо",
    footer:
      "Толпа и сквиз. Не прогноз следующей свечи. COIL-1.0: толпа 30% · топливо 25% · спот-лид 20% · тонкая сессия 15% · поток MM 10%.",
    loading: "Чтение ленты…",
    error: "Лента недоступна. Повтор.",
    shortVulnerable: "шорт-толпа уязвима",
    longVulnerable: "лонг-толпа уязвима",
    leading: "спот ведёт против толпы",
    notLeading: "спот не ведёт",
  },
} as const

export const REGIME_LABEL: Record<Lang, Record<Regime, string>> = {
  en: { quiet: "quiet", squeeze_watch: "squeeze watch", squeeze_armed: "squeeze armed" },
  ru: { quiet: "тихо", squeeze_watch: "наблюдение", squeeze_armed: "заряд" },
}

export const CROWD_LABEL: Record<Lang, Record<CrowdSide, string>> = {
  en: { short: "short crowd", long: "long crowd", mixed: "mixed books" },
  ru: { short: "толпа в шорте", long: "толпа в лонге", mixed: "смешанные книги" },
}

export const SESSION_LABEL: Record<Lang, Record<SessionLabel, string>> = {
  en: {
    asia_open: "asia open",
    asia: "asia",
    london_open: "london open",
    london: "london",
    ny_open: "ny open",
    ny: "ny",
    ny_close: "ny close",
    weekend: "weekend",
  },
  ru: {
    asia_open: "открытие Азии",
    asia: "Азия",
    london_open: "открытие Лондона",
    london: "Лондон",
    ny_open: "открытие NY",
    ny: "NY",
    ny_close: "закрытие NY",
    weekend: "выходные",
  },
}

export const WEIGHT_LABEL: Record<Lang, Record<string, string>> = {
  en: { crowd: "crowd", fuel: "fuel", spotLead: "spot-lead", thinSession: "thin-session", mmFlow: "mm-flow" },
  ru: { crowd: "толпа", fuel: "топливо", spotLead: "спот-лид", thinSession: "тонкая сессия", mmFlow: "поток MM" },
}
