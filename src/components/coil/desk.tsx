import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { INTERVALS, SYMBOLS, VENUES, WEIGHTS, WINDOWS, type CoilSnapshot, type Interval, type SymbolId, type Venue } from "@/coil/types.ts"
import { cn } from "@/lib/utils.ts"
import type { VenuesPayload } from "@/lib/venues/catalog.ts"
import { COPY, CROWD_LABEL, REGIME_LABEL, SESSION_LABEL, SQUEEZE_FLAG, SQUEEZE_SIDE, WEIGHT_LABEL, type Lang } from "./copy.ts"
import { CoilCharts } from "./charts.tsx"
import { fmtBps, fmtFunding, fmtPct, fmtPrice, fmtTime, fmtUsd, fmtZ } from "./format.ts"
import { useEffect, useMemo, useState } from "react"

type BreadthPayload = {
  items: Array<{
    symbol: SymbolId
    score: number
    bias: number
    regime: CoilSnapshot["regime"]
    crowdSide: CoilSnapshot["crowdSide"]
    source: CoilSnapshot["source"]
  }>
}

type DeskSeed = {
  snapshot: CoilSnapshot
  breadth: BreadthPayload
  venues: VenuesPayload
}

function fallbackVenue(seed?: DeskSeed): Venue {
  const fromSnap = seed?.snapshot.venue
  if (fromSnap && VENUES.includes(fromSnap)) return fromSnap
  const fromCatalog = seed?.venues.default.venue
  if (fromCatalog && VENUES.includes(fromCatalog)) return fromCatalog
  return "okx"
}

function readSearch(seed?: DeskSeed): { symbol: SymbolId; interval: Interval; window: number; venue: Venue; lang: Lang } {
  const fallback = {
    symbol: (seed?.snapshot.symbol ?? "BTC") as SymbolId,
    interval: (seed?.snapshot.interval ?? "5m") as Interval,
    window: seed?.snapshot.window ?? 48,
    venue: fallbackVenue(seed),
    lang: "en" as Lang,
  }
  if (typeof window === "undefined") return fallback
  const q = new URLSearchParams(window.location.search)
  const symbol = SYMBOLS.includes(q.get("symbol") as SymbolId) ? (q.get("symbol") as SymbolId) : fallback.symbol
  const interval = INTERVALS.includes(q.get("interval") as Interval) ? (q.get("interval") as Interval) : fallback.interval
  const windowN = Number(q.get("window"))
  const win = WINDOWS.includes(windowN as 24 | 48 | 96) ? windowN : fallback.window
  const venue = VENUES.includes(q.get("venue") as Venue) ? (q.get("venue") as Venue) : fallback.venue
  const lang: Lang = q.get("lang") === "ru" ? "ru" : "en"
  return { symbol, interval, window: win, venue, lang }
}

function qs(symbol: SymbolId, interval: Interval, window: number, venue: Venue) {
  return `symbol=${symbol}&interval=${interval}&window=${window}&venue=${venue}`
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-xs font-medium tracking-wide transition-colors duration-150 sm:h-8 sm:min-w-8",
        active
          ? "bg-accent text-accent-fg"
          : "border border-border bg-elevated text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  )
}

function Pill({
  tone,
  children,
}: {
  tone: "quiet" | "watch" | "armed" | "short" | "long" | "mixed" | "demo" | "live"
  children: ReactNode
}) {
  const cls = {
    quiet: "border-border text-muted",
    watch: "border-watch/50 text-watch",
    armed: "border-armed/50 text-armed",
    short: "border-short/50 text-short",
    long: "border-long/50 text-long",
    mixed: "border-border text-muted",
    demo: "border-watch/50 text-watch",
    live: "border-live/50 text-live",
  }[tone]
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium uppercase tracking-wider", cls)}>
      {children}
    </span>
  )
}

function SqueezeStrip({ snap, lang }: { snap: CoilSnapshot; lang: Lang }) {
  const copy = COPY[lang]
  const flag = snap.squeeze.armed ? "armed" : snap.squeeze.watch ? "watch" : "none"
  const lsAcc = snap.squeeze.lsAccount
  const lsTop = snap.squeeze.lsTop
  const lsPos = snap.squeeze.lsPosition ?? snap.lsPosition
  const ls = [
    lsAcc === null ? null : `${lsAcc.toFixed(2)} acc`,
    lsTop === null ? null : `${lsTop.toFixed(2)} top`,
    lsPos === null ? null : `${lsPos.toFixed(2)} pos`,
  ]
    .filter(Boolean)
    .join("  ·  ")
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-muted sm:grid-cols-5">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">{copy.squeeze}</div>
        <div className="text-fg">{SQUEEZE_FLAG[lang][flag]}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">{copy.squeezeSide}</div>
        <div className="text-fg">{SQUEEZE_SIDE[lang][snap.squeeze.side]}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">{copy.percentile}</div>
        <div className="text-fg">{fmtPct(snap.squeeze.fundingPct, 0)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">OI z</div>
        <div className="text-fg">{fmtZ(snap.squeeze.oiZ)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">L/S</div>
        <div className="text-fg">{ls || "—"}</div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-subtle">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-fg">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted">{hint}</div> : null}
    </div>
  )
}

function CoilMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 6.2a5.8 5.8 0 1 1-4.1 1.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 9.1a2.9 2.9 0 1 1-2 0.85" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
    </svg>
  )
}

export function CoilDesk({
  seed,
}: {
  seed?: DeskSeed
}) {
  const search = useMemo(() => readSearch(seed), [seed])
  const [symbol, setSymbol] = useState<SymbolId>(search.symbol)
  const [interval, setInterval] = useState<Interval>(search.interval)
  const [windowN, setWindowN] = useState(search.window)
  const [venue, setVenue] = useState<Venue>(search.venue)
  const [lang, setLang] = useState<Lang>(search.lang)
  const copy = COPY[lang]
  const q = qs(symbol, interval, windowN, venue)
  const seedQ = seed ? qs(seed.snapshot.symbol, seed.snapshot.interval, seed.snapshot.window, seed.snapshot.venue) : ""
  const browser = typeof window !== "undefined"

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("symbol", symbol)
    url.searchParams.set("interval", interval)
    url.searchParams.set("window", String(windowN))
    url.searchParams.set("venue", venue)
    url.searchParams.set("lang", lang)
    window.history.replaceState(null, "", url)
  }, [symbol, interval, windowN, venue, lang])

  const coil = useQuery({
    queryKey: ["coil", q],
    queryFn: async () => {
      const res = await fetch(`/api/coil?${q}`)
      if (!res.ok) throw new Error("coil")
      return (await res.json()) as CoilSnapshot
    },
    enabled: browser,
    refetchInterval: 15_000,
    initialData: q === seedQ ? seed?.snapshot : undefined,
    placeholderData: (prev) => prev,
  })

  const breadth = useQuery({
    queryKey: ["breadth", q],
    queryFn: async () => {
      const res = await fetch(`/api/breadth?${q}`)
      if (!res.ok) throw new Error("breadth")
      return (await res.json()) as BreadthPayload
    },
    enabled: browser,
    refetchInterval: 15_000,
    initialData: q === seedQ ? seed?.breadth : undefined,
    placeholderData: (prev) => prev,
  })

  const venues = useQuery({
    queryKey: ["venues", symbol, interval, windowN],
    queryFn: async () => {
      const res = await fetch(`/api/venues?symbol=${symbol}&interval=${interval}&window=${windowN}`)
      if (!res.ok) throw new Error("venues")
      return (await res.json()) as VenuesPayload
    },
    enabled: browser,
    refetchInterval: 15_000,
    initialData: seed?.venues,
    placeholderData: (prev) => prev,
  })

  const snap = coil.data
  const regimeTone = snap?.regime === "squeeze_armed" ? "armed" : snap?.regime === "squeeze_watch" ? "watch" : "quiet"
  const crowdTone = snap?.crowdSide === "short" ? "short" : snap?.crowdSide === "long" ? "long" : "mixed"
  const pitOrder: Venue[] = [
    ...(venues.data?.pits.map((p) => p.id as Venue) ?? ["okx", "bybit", "binance"]),
    "all",
  ]
  const pitSource = (id: Venue) => venues.data?.pits.find((p) => p.id === id)?.source

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <CoilMark className="size-8 text-accent" />
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-semibold tracking-[-0.03em]">COIL</h1>
                <span className="font-mono text-[11px] text-subtle">1.0</span>
              </div>
              <p className="text-sm text-muted">{copy.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {snap ? (
              <Pill tone={snap.source === "demo" ? "demo" : "live"}>
                {snap.source === "demo" ? copy.demo : copy.live}
              </Pill>
            ) : null}
            <Chip active={lang === "en"} onClick={() => setLang("en")}>en</Chip>
            <Chip active={lang === "ru"} onClick={() => setLang("ru")}>ru</Chip>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <ChipRow label={copy.pits}>
            {pitOrder.map((v) => {
              const src = pitSource(v)
              return (
                <Chip key={v} active={venue === v} onClick={() => setVenue(v)}>
                  {v}{src === "demo" ? " · demo" : ""}
                </Chip>
              )
            })}
          </ChipRow>
          <ChipRow label={copy.assets}>
            {SYMBOLS.map((s) => (
              <Chip key={s} active={symbol === s} onClick={() => setSymbol(s)}>{s}</Chip>
            ))}
          </ChipRow>
          <div className="flex flex-wrap gap-6">
            <ChipRow label={copy.interval}>
              {INTERVALS.map((i) => (
                <Chip key={i} active={interval === i} onClick={() => setInterval(i)}>{i}</Chip>
              ))}
            </ChipRow>
            <ChipRow label={copy.window}>
              {WINDOWS.map((w) => (
                <Chip key={w} active={windowN === w} onClick={() => setWindowN(w)}>{w}</Chip>
              ))}
            </ChipRow>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 py-5 sm:px-6">
        {!snap && coil.isError ? (
          <p className="text-sm text-armed">{copy.error}</p>
        ) : null}
        {!snap ? (
          <HeroSkeleton label={copy.loading} />
        ) : (
          <Hero snap={snap} lang={lang} regimeTone={regimeTone} crowdTone={crowdTone} />
        )}

        {snap ? <Metrics snap={snap} lang={lang} /> : <GridSkeleton />}
        {snap ? <Meters snap={snap} lang={lang} /> : null}
        {snap ? <CoilCharts snap={snap} lang={lang} /> : null}
        <Breadth
          items={breadth.data?.items ?? []}
          active={symbol}
          onPick={setSymbol}
          title={copy.charts.breadth}
          loading={!breadth.data}
        />
      </main>

      <footer className="border-t border-border px-4 py-4 text-xs text-muted sm:px-6">
        {copy.footer}
      </footer>
    </div>
  )
}

function liqChip(snap: CoilSnapshot, copy: (typeof COPY)[Lang]): string {
  if (!snap.liq.available) {
    return snap.liq.reason === "unavailable" ? copy.liqUnavailable : copy.liqNoKey
  }
  if (snap.liq.magnet === "short_above") {
    const pct = snap.liq.nearestShortPct
    return `${copy.liq}: ${copy.liqShortAbove}${pct === null ? "" : ` ${pct.toFixed(1)}%`}`
  }
  if (snap.liq.magnet === "long_below") {
    const pct = snap.liq.nearestLongPct
    return `${copy.liq}: ${copy.liqLongBelow}${pct === null ? "" : ` ${Math.abs(pct).toFixed(1)}%`}`
  }
  if (snap.liq.magnet === "both") return `${copy.liq}: ${copy.liqBoth}`
  return `${copy.liq}: ${copy.liqNone}`
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-subtle">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Hero({
  snap,
  lang,
  regimeTone,
  crowdTone,
}: {
  snap: CoilSnapshot
  lang: Lang
  regimeTone: "quiet" | "watch" | "armed"
  crowdTone: "short" | "long" | "mixed"
}) {
  const copy = COPY[lang]
  const biasPct = ((snap.bias + 1) / 2) * 100
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-end">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-subtle">{copy.score}</div>
          <div className="py-2 font-mono text-6xl font-medium leading-none tracking-tight tabular-nums sm:text-7xl">
            {Math.round(snap.score)}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pill tone={regimeTone}>{REGIME_LABEL[lang][snap.regime]}</Pill>
            <Pill tone={crowdTone}>{CROWD_LABEL[lang][snap.crowdSide]}</Pill>
            {snap.squeeze.crowdDisagrees ? (
              <Pill tone="watch">{copy.crowdDisagrees}</Pill>
            ) : null}
            <Pill tone={snap.liq.available && snap.liq.magnet !== "none" ? "watch" : "quiet"}>
              {liqChip(snap, copy)}
            </Pill>
            <Pill tone={snap.thinTape ? "watch" : "quiet"}>
              {copy.thin}: {snap.thinTape ? copy.yes : copy.no}
            </Pill>
            <Pill tone={snap.spotLeadsAgainstCrowd ? "live" : "quiet"}>
              {snap.spotLeadsAgainstCrowd ? copy.leading : copy.notLeading}
            </Pill>
          </div>
          <SqueezeStrip snap={snap} lang={lang} />
          <p className="text-base text-fg">{lang === "ru" ? snap.headlineRu : snap.headline}</p>
          <div>
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-subtle">
              <span>− {copy.longVulnerable}</span>
              <span>{copy.bias}</span>
              <span>+ {copy.shortVulnerable}</span>
            </div>
            <div className="relative h-2 rounded-full bg-elevated">
              <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <div
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${biasPct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
            <span>{copy.session}: {SESSION_LABEL[lang][snap.session.label]} · {String(snap.session.etHour).padStart(2, "0")} ET</span>
            <span>{snap.symbol} {fmtPrice(snap.spot)}</span>
            <span>{fmtTime(snap.asOf)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Metrics({ snap, lang }: { snap: CoilSnapshot; lang: Lang }) {
  const copy = COPY[lang]
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
      <Metric label={copy.funding} value={fmtFunding(snap.funding)} hint={snap.fundingPercentile === null ? undefined : `${copy.percentile} ${fmtPct(snap.fundingPercentile, 0)}`} />
      <Metric label={copy.lsAccount} value={snap.lsAccount === null ? "—" : snap.lsAccount.toFixed(2)} />
      <Metric label={copy.lsTop} value={snap.lsTop === null ? "—" : snap.lsTop.toFixed(2)} />
      <Metric
        label={copy.lsPosition}
        value={snap.lsPosition === null ? "—" : snap.lsPosition.toFixed(2)}
        hint={snap.squeeze.crowdDisagrees ? copy.crowdDisagrees : undefined}
      />
      <Metric
        label={copy.liq}
        value={
          !snap.liq.available ? (snap.liq.reason === "unavailable" ? copy.liqUnavailable : copy.liqNoKey)
          : snap.liq.magnet === "short_above" ? copy.liqShortAbove
          : snap.liq.magnet === "long_below" ? copy.liqLongBelow
          : snap.liq.magnet === "both" ? copy.liqBoth
          : copy.liqNone
        }
        hint={snap.liq.magnetUsd ? fmtUsd(snap.liq.magnetUsd) : undefined}
      />
      <Metric label={copy.oi} value={fmtUsd(snap.oiUsd)} hint={fmtZ(snap.squeeze.oiZ ?? snap.oiZ)} />
      <Metric
        label={copy.squeeze}
        value={SQUEEZE_FLAG[lang][snap.squeeze.armed ? "armed" : snap.squeeze.watch ? "watch" : "none"]}
        hint={snap.squeeze.side === "none" ? undefined : SQUEEZE_SIDE[lang][snap.squeeze.side]}
      />
      <Metric label={copy.basis} value={fmtBps(snap.basisBps)} />
      <Metric label={copy.spotTaker} value={fmtPct(snap.spotTakerBuyPct)} />
      <Metric label={copy.perpTaker} value={fmtPct(snap.perpTakerBuyPct)} />
      <Metric label={copy.thin} value={snap.thinTape ? copy.yes : copy.no} />
      <Metric label={copy.mm} value={snap.mmFlow.status} />
      {snap.gravity.available ? (
        <Metric
          label={copy.gravity}
          value={snap.gravity.g === undefined ? "—" : snap.gravity.g.toFixed(3)}
          hint={snap.gravity.coupling}
        />
      ) : null}
    </div>
  )
}

function Meters({ snap, lang }: { snap: CoilSnapshot; lang: Lang }) {
  const rows: Array<{ key: keyof typeof WEIGHTS; value: number }> = [
    { key: "crowd", value: snap.components.crowd },
    { key: "fuel", value: snap.components.fuel },
    { key: "spotLead", value: snap.components.spotLead },
    { key: "thinSession", value: snap.components.thinSession },
    { key: "mmFlow", value: snap.components.mmFlow },
  ]
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted">{COPY[lang].weights}</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex justify-between font-mono text-[11px] text-muted">
              <span>{WEIGHT_LABEL[lang][row.key]} {Math.round(WEIGHTS[row.key] * 100)}%</span>
              <span className="tabular-nums text-fg">{Math.round(row.value * 100)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, row.value * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Breadth({
  items,
  active,
  onPick,
  title,
  loading,
}: {
  items: BreadthPayload["items"]
  active: SymbolId
  onPick: (s: SymbolId) => void
  title: string
  loading: boolean
}) {
  const rows = items.length ? items : SYMBOLS.map((symbol) => ({
    symbol,
    score: 0,
    bias: 0,
    regime: "quiet" as const,
    crowdSide: "mixed" as const,
    source: "demo" as const,
  }))
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted">{title}</h3>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <button
            key={row.symbol}
            type="button"
            onClick={() => onPick(row.symbol)}
            className={cn(
              "grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150",
              active === row.symbol ? "bg-elevated" : "hover:bg-elevated/60",
            )}
          >
            <span className="font-mono text-xs text-fg">{row.symbol}</span>
            <div className="h-1.5 rounded-full bg-bg">
              <div
                className={cn(
                  "h-full rounded-full",
                  row.regime === "squeeze_armed" ? "bg-armed" : row.regime === "squeeze_watch" ? "bg-watch" : "bg-accent",
                )}
                style={{ width: `${loading ? 8 : Math.max(4, row.score)}%` }}
              />
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-muted">
              {loading ? "—" : Math.round(row.score)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function HeroSkeleton({ label }: { label: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="h-16 w-28 rounded-md bg-elevated" />
      <p className="mt-4 text-sm text-muted">{label}</p>
    </section>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-elevated" />
      ))}
    </div>
  )
}
